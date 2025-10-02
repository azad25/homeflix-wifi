package services

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
	"homeflix-backend/internal/models"
)

type RecommendationService struct {
	db           *gorm.DB
	mediaService *MediaService
	redis        *RedisService
}

func NewRecommendationService(db *gorm.DB, mediaService *MediaService) *RecommendationService {
	return &RecommendationService{
		db:           db,
		mediaService: mediaService,
		redis:        NewRedisService(),
	}
}

// RecommendationScore represents a media item with its recommendation score
type RecommendationScore struct {
	Media  models.Media
	Score  float32
	Reason string
}

// GetRecommendationsForUser generates Netflix-style personalized recommendations
func (s *RecommendationService) GetRecommendationsForUser(userID uint, limit int) ([]models.Media, error) {
	// Try to get from cache first
	cacheKey := fmt.Sprintf("user_%d", userID)
	if s.redis != nil {
		if cachedRecommendations, err := s.redis.GetCachedRecommendations(userID, cacheKey); err == nil {
			return cachedRecommendations, nil
		}
	}

	var recommendations []RecommendationScore

	// Get user's viewing history and ratings
	var viewHistory []models.ViewHistory
	s.db.Preload("Media").Preload("Media.Genres").Where("user_id = ?", userID).Order("watched_at DESC").Find(&viewHistory)

	var userRatings []models.UserRating
	s.db.Preload("Media").Preload("Media.Genres").Where("user_id = ?", userID).Find(&userRatings)

	// Get all media for scoring
	var allMedia []models.Media
	s.db.Preload("Genres").Find(&allMedia)

	// Get user preferences from viewing patterns
	userGenrePrefs := s.calculateUserGenrePreferences(viewHistory, userRatings)
	userTimePrefs := s.calculateUserTimePreferences(viewHistory)

	// Calculate recommendation scores with Netflix-style algorithms
	for _, media := range allMedia {
		// Skip if user already watched
		if s.hasUserWatched(userID, media.ID, viewHistory) {
			continue
		}

		// Netflix-style multi-factor scoring
		score := s.calculateNetflixStyleScore(media, viewHistory, userRatings, userGenrePrefs, userTimePrefs)
		if score > 0 {
			reason := s.generateNetflixStyleReason(media, viewHistory, userRatings, userGenrePrefs)
			recommendations = append(recommendations, RecommendationScore{
				Media:  media,
				Score:  score,
				Reason: reason,
			})
		}
	}

	// Apply Netflix-style diversity and freshness
	recommendations = s.applyDiversityFilter(recommendations)
	recommendations = s.applyFreshnessBoost(recommendations)

	// Sort by score descending
	sort.Slice(recommendations, func(i, j int) bool {
		return recommendations[i].Score > recommendations[j].Score
	})

	// Convert to media slice and limit results
	var result []models.Media
	for i, rec := range recommendations {
		if i >= limit {
			break
		}
		result = append(result, rec.Media)

		// Save recommendation to database
		s.saveRecommendation(userID, rec.Media.ID, rec.Score, rec.Reason, "personalized")
	}

	// Cache the result
	if s.redis != nil {
		s.redis.CacheRecommendations(userID, cacheKey, result)
	}

	return result, nil
}

// GetTrendingRecommendations returns Netflix-style trending content
func (s *RecommendationService) GetTrendingRecommendations(limit int) ([]models.Media, error) {
	// Try to get from cache first
	if s.redis != nil {
		if cachedTrending, err := s.redis.GetCachedMediaList("trending"); err == nil {
			if len(cachedTrending) >= limit {
				return cachedTrending[:limit], nil
			}
			return cachedTrending, nil
		}
	}

	var media []models.Media
	
	// Netflix-style trending algorithm: weighted by recency and velocity
	sevenDaysAgo := time.Now().AddDate(0, 0, -7)
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)
	
	// Get view counts for different time periods
	type TrendingScore struct {
		MediaID        uint
		RecentViews    int64
		TotalViews     int64
		VelocityScore  float64
		PopularityRank float64
	}
	
	var trendingScores []TrendingScore
	s.db.Raw(`
		SELECT 
			m.id as media_id,
			COUNT(CASE WHEN vh.watched_at > ? THEN 1 END) as recent_views,
			m.view_count as total_views,
			(COUNT(CASE WHEN vh.watched_at > ? THEN 1 END) * 1.0 / GREATEST(m.view_count, 1)) as velocity_score,
			(m.view_count * 1.0 / (EXTRACT(EPOCH FROM (NOW() - m.created_at)) / 86400 + 1)) as popularity_rank
		FROM media m
		LEFT JOIN view_histories vh ON m.id = vh.media_id
		WHERE m.created_at > ?
		GROUP BY m.id, m.view_count, m.created_at
		HAVING COUNT(CASE WHEN vh.watched_at > ? THEN 1 END) > 0
		ORDER BY (recent_views * 2 + velocity_score * 10 + popularity_rank) DESC
		LIMIT ?
	`, sevenDaysAgo, sevenDaysAgo, thirtyDaysAgo, sevenDaysAgo, limit).Scan(&trendingScores)
	
	// Get the actual media objects
	var mediaIDs []uint
	for _, score := range trendingScores {
		mediaIDs = append(mediaIDs, score.MediaID)
	}
	
	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
		Where("id IN ?", mediaIDs).
		Find(&media).Error
	
	// Sort media according to trending scores
	sort.Slice(media, func(i, j int) bool {
		var scoreI, scoreJ float64
		for _, score := range trendingScores {
			if score.MediaID == media[i].ID {
				scoreI = score.VelocityScore + score.PopularityRank
			}
			if score.MediaID == media[j].ID {
				scoreJ = score.VelocityScore + score.PopularityRank
			}
		}
		return scoreI > scoreJ
	})
	
	// Cache the result
	if err == nil && s.redis != nil {
		s.redis.CacheMediaList("trending", media)
	}
	
	return media, err
}

// GetSimilarMedia finds media similar to what user has watched using Netflix-style algorithms
func (s *RecommendationService) GetSimilarMedia(userID uint, limit int) ([]models.Media, error) {
	// Get user's recent viewing history (last 10 items)
	var recentHistory []models.ViewHistory
	s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ?", userID).
		Order("watched_at DESC").
		Limit(10).
		Find(&recentHistory)

	if len(recentHistory) == 0 {
		return s.GetTrendingRecommendations(limit)
	}

	// Get user's highly rated media for additional context
	var userRatings []models.UserRating
	s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ? AND rating >= 7", userID).
		Order("rating DESC").
		Find(&userRatings)

	// Calculate genre preferences for similarity scoring
	genrePrefs := s.calculateUserGenrePreferences(recentHistory, userRatings)

	// Get all media for similarity calculation
	var allMedia []models.Media
	s.db.Preload("Genres").Find(&allMedia)

	// Score each media item for similarity
	var recommendations []RecommendationScore
	for _, media := range allMedia {
		// Skip if user already watched
		if s.hasUserWatched(userID, media.ID, recentHistory) {
			continue
		}

		// Calculate similarity score
		score := s.calculateSimilarityScore(media, recentHistory, userRatings, genrePrefs)
		if score > 0 {
			reason := s.generateSimilarityReason(media, recentHistory, genrePrefs)
			recommendations = append(recommendations, RecommendationScore{
				Media:  media,
				Score:  score,
				Reason: reason,
			})
		}
	}

	// Sort by score and apply diversity
	sort.Slice(recommendations, func(i, j int) bool {
		return recommendations[i].Score > recommendations[j].Score
	})

	recommendations = s.applyDiversityFilter(recommendations)

	// Convert to media slice and limit
	var result []models.Media
	for i, rec := range recommendations {
		if i >= limit {
			break
		}
		result = append(result, rec.Media)
	}

	return result, nil
}

// GetContinueWatching returns media user started but didn't finish with Netflix-style sorting
func (s *RecommendationService) GetContinueWatching(userID uint) ([]models.Media, error) {
	// Try to get from cache first
	if s.redis != nil {
		if cachedRecommendations, err := s.redis.GetCachedRecommendations(userID, "continue_watching"); err == nil {
			return cachedRecommendations, nil
		}
	}

	// For now, return trending content as fallback since we don't have user viewing history
	result, err := s.GetTrendingRecommendations(10)
	
	// Cache the result
	if err == nil && s.redis != nil {
		s.redis.CacheRecommendations(userID, "continue_watching", result)
	}
	
	return result, err
}

// Helper functions

func (s *RecommendationService) calculateRecommendationScore(media models.Media, viewHistory []models.ViewHistory, userRatings []models.UserRating) float32 {
	var score float32 = 0

	// Base score from global popularity
	score += float32(media.ViewCount) * 0.1

	// Genre matching score
	genreScore := s.calculateGenreScore(media, viewHistory, userRatings)
	score += genreScore * 3

	// Recency boost
	if media.CreatedAt.After(time.Now().AddDate(0, 0, -30)) {
		score += 2 // boost for recent additions
	}

	// Rating boost
	if media.Rating > 7 {
		score += float32(media.Rating - 7) * 2
	}

	return score
}

func (s *RecommendationService) calculateGenreScore(media models.Media, viewHistory []models.ViewHistory, userRatings []models.UserRating) float32 {
	userGenrePrefs := make(map[string]float32)
	
	// Calculate genre preferences from ratings
	for _, rating := range userRatings {
		for _, genre := range rating.Media.Genres {
			userGenrePrefs[genre.Name] += rating.Rating / 10.0 // normalize to 0-1
		}
	}

	// Calculate genre preferences from watch history
	for _, history := range viewHistory {
		weight := float32(1.0)
		if history.Completed {
			weight = 1.5 // boost for completed content
		}
		
		for _, genre := range history.Media.Genres {
			userGenrePrefs[genre.Name] += weight * 0.5
		}
	}

	// Calculate score for this media's genres
	var genreScore float32 = 0
	for _, genre := range media.Genres {
		if pref, exists := userGenrePrefs[genre.Name]; exists {
			genreScore += pref
		}
	}

	return genreScore
}

func (s *RecommendationService) generateRecommendationReason(media models.Media, _ []models.ViewHistory, userRatings []models.UserRating) string {
	// Find the most relevant reason
	if len(media.Genres) > 0 {
		for _, rating := range userRatings {
			for _, userGenre := range rating.Media.Genres {
				for _, mediaGenre := range media.Genres {
					if userGenre.Name == mediaGenre.Name && rating.Rating >= 8 {
						return fmt.Sprintf("Because you loved %s", rating.Media.Title)
					}
				}
			}
		}

		// Fallback to genre matching
		for _, genre := range media.Genres {
			return fmt.Sprintf("Popular %s content", genre.Name)
		}
	}

	if media.ViewCount > 100 {
		return "Trending now"
	}

	return "Recommended for you"
}

func (s *RecommendationService) hasUserWatched(_ uint, mediaID uint, viewHistory []models.ViewHistory) bool {
	for _, history := range viewHistory {
		if history.MediaID == mediaID {
			return true
		}
	}
	return false
}

func (s *RecommendationService) getWatchedMediaIDs(userID uint) []uint {
	var viewHistory []models.ViewHistory
	s.db.Where("user_id = ?", userID).Find(&viewHistory)
	
	var mediaIDs []uint
	for _, history := range viewHistory {
		mediaIDs = append(mediaIDs, history.MediaID)
	}
	return mediaIDs
}

func (s *RecommendationService) removeDuplicateMedia(media []models.Media) []models.Media {
	seen := make(map[uint]bool)
	var unique []models.Media
	
	for _, m := range media {
		if !seen[m.ID] {
			seen[m.ID] = true
			unique = append(unique, m)
		}
	}
	
	return unique
}

func (s *RecommendationService) saveRecommendation(userID uint, mediaID uint, score float32, reason string, category string) {
	recommendation := models.Recommendation{
		UserID:   userID,
		MediaID:  mediaID,
		Score:    score,
		Reason:   reason,
		Category: category,
	}
	
	// Update if exists, create if not
	s.db.Where("user_id = ? AND media_id = ?", userID, mediaID).
		Assign(recommendation).
		FirstOrCreate(&recommendation)
}

// Netflix-style helper methods

// calculateUserGenrePreferences analyzes user's genre preferences from viewing history
func (s *RecommendationService) calculateUserGenrePreferences(viewHistory []models.ViewHistory, userRatings []models.UserRating) map[string]float32 {
	genrePrefs := make(map[string]float32)
	
	// Weight genres based on completion rate and ratings
	for _, history := range viewHistory {
		weight := float32(1.0)
		if history.Completed {
			weight = 2.0 // Completed content gets higher weight
		} else if float64(history.Progress)/float64(history.Media.Duration) > 0.7 {
			weight = 1.5 // Mostly watched content
		}
		
		// Apply recency decay (Netflix prioritizes recent behavior)
		daysSince := float32(time.Since(history.WatchedAt).Hours() / 24)
		recencyWeight := float32(math.Exp(float64(-daysSince / 30.0))) // Exponential decay over 30 days
		
		for _, genre := range history.Media.Genres {
			genrePrefs[genre.Name] += weight * recencyWeight
		}
	}
	
	// Boost genres from highly rated content
	for _, rating := range userRatings {
		if rating.Rating >= 8 {
			boost := float32(rating.Rating) / 10.0 * 2.0
			for _, genre := range rating.Media.Genres {
				genrePrefs[genre.Name] += boost
			}
		}
	}
	
	return genrePrefs
}

// calculateUserTimePreferences analyzes when user typically watches content
func (s *RecommendationService) calculateUserTimePreferences(viewHistory []models.ViewHistory) map[string]float32 {
	timePrefs := make(map[string]float32)
	
	for _, history := range viewHistory {
		hour := history.WatchedAt.Hour()
		var timeSlot string
		
		switch {
		case hour >= 6 && hour < 12:
			timeSlot = "morning"
		case hour >= 12 && hour < 18:
			timeSlot = "afternoon"
		case hour >= 18 && hour < 22:
			timeSlot = "evening"
		default:
			timeSlot = "night"
		}
		
		timePrefs[timeSlot]++
	}
	
	return timePrefs
}

// calculateNetflixStyleScore implements Netflix's multi-factor recommendation scoring
func (s *RecommendationService) calculateNetflixStyleScore(media models.Media, viewHistory []models.ViewHistory, userRatings []models.UserRating, genrePrefs map[string]float32, timePrefs map[string]float32) float32 {
	var score float32 = 0
	
	// 1. Genre Affinity Score (40% weight)
	genreScore := float32(0)
	for _, genre := range media.Genres {
		if pref, exists := genrePrefs[genre.Name]; exists {
			genreScore += pref
		}
	}
	score += genreScore * 0.4
	
	// 2. Global Popularity Score (20% weight)
	popularityScore := float32(media.ViewCount) / 1000.0 // Normalize
	if popularityScore > 10 {
		popularityScore = 10 // Cap at 10
	}
	score += popularityScore * 0.2
	
	// 3. Recency Boost (15% weight)
	daysSinceRelease := float32(time.Since(media.CreatedAt).Hours() / 24)
	recencyScore := float32(math.Max(0, float64(30-daysSinceRelease))) / 30.0 * 10
	score += recencyScore * 0.15
	
	// 4. Rating Quality (15% weight)
	if media.Rating > 0 {
		ratingScore := float32(media.Rating) / 10.0 * 10
		score += ratingScore * 0.15
	}
	
	// 5. Collaborative Filtering (10% weight)
	collabScore := s.calculateCollaborativeScore(media, viewHistory, userRatings)
	score += collabScore * 0.1
	
	// Apply penalties
	// Penalize very old content unless it's highly rated
	if daysSinceRelease > 365 && media.Rating < 8 {
		score *= 0.7
	}
	
	// Boost highly rated recent content
	if daysSinceRelease < 30 && media.Rating > 8 {
		score *= 1.3
	}
	
	return score
}

// calculateCollaborativeScore finds users with similar taste and recommends what they liked
func (s *RecommendationService) calculateCollaborativeScore(media models.Media, userViewHistory []models.ViewHistory, userRatings []models.UserRating) float32 {
	// Find users who watched similar content
	var similarUsers []uint
	for _, history := range userViewHistory {
		// Find other users who watched the same content
		var otherUsers []models.ViewHistory
		s.db.Where("media_id = ? AND user_id != ?", history.MediaID, history.UserID).Find(&otherUsers)
		
		for _, other := range otherUsers {
			similarUsers = append(similarUsers, other.UserID)
		}
	}
	
	if len(similarUsers) == 0 {
		return 0
	}
	
	// Check how many similar users liked this media
	var positiveRatings int64
	s.db.Model(&models.UserRating{}).
		Where("media_id = ? AND user_id IN ? AND rating >= 7", media.ID, similarUsers).
		Count(&positiveRatings)
	
	if len(similarUsers) > 0 {
		return float32(positiveRatings) / float32(len(similarUsers)) * 10
	}
	
	return 0
}

// generateNetflixStyleReason creates Netflix-style recommendation reasons
func (s *RecommendationService) generateNetflixStyleReason(media models.Media, viewHistory []models.ViewHistory, userRatings []models.UserRating, genrePrefs map[string]float32) string {
	// Find the strongest reason
	
	// Check for "Because you watched" reasons
	for _, history := range viewHistory {
		if history.Completed || (history.Media.Duration > 0 && float64(history.Progress)/float64(history.Media.Duration) > 0.8) {
			// Check for genre overlap
			for _, historyGenre := range history.Media.Genres {
				for _, mediaGenre := range media.Genres {
					if historyGenre.ID == mediaGenre.ID {
						return fmt.Sprintf("Because you watched %s", history.Media.Title)
					}
				}
			}
		}
	}
	
	// Check for highly rated genre preferences
	var topGenre string
	var topScore float32
	for genre, score := range genrePrefs {
		if score > topScore {
			topScore = score
			topGenre = genre
		}
	}
	
	for _, genre := range media.Genres {
		if genre.Name == topGenre {
			return fmt.Sprintf("Top picks for %s fans", strings.Title(topGenre))
		}
	}
	
	// Check for trending
	if media.ViewCount > 100 {
		return "Trending now"
	}
	
	// Check for new releases
	if time.Since(media.CreatedAt).Hours() < 24*7 {
		return "New release"
	}
	
	// Check for highly rated
	if media.Rating > 8 {
		return "Critically acclaimed"
	}
	
	return "Recommended for you"
}

// applyDiversityFilter ensures genre and content type diversity in recommendations
func (s *RecommendationService) applyDiversityFilter(recommendations []RecommendationScore) []RecommendationScore {
	if len(recommendations) <= 10 {
		return recommendations
	}
	
	var filtered []RecommendationScore
	genreCount := make(map[string]int)
	typeCount := make(map[string]int)
	
	for _, rec := range recommendations {
		// Check genre diversity
		canAdd := true
		for _, genre := range rec.Media.Genres {
			if genreCount[genre.Name] >= 3 { // Max 3 per genre in top recommendations
				canAdd = false
				break
			}
		}
		
		// Check type diversity
		if typeCount[rec.Media.Type] >= 5 { // Max 5 per type
			canAdd = false
		}
		
		if canAdd {
			filtered = append(filtered, rec)
			for _, genre := range rec.Media.Genres {
				genreCount[genre.Name]++
			}
			typeCount[rec.Media.Type]++
		}
		
		if len(filtered) >= 20 { // Limit total recommendations
			break
		}
	}
	
	return filtered
}

// applyFreshnessBoost boosts newer content and penalizes stale recommendations
func (s *RecommendationService) applyFreshnessBoost(recommendations []RecommendationScore) []RecommendationScore {
	for i := range recommendations {
		daysSinceCreated := float32(time.Since(recommendations[i].Media.CreatedAt).Hours() / 24)
		
		// Boost new content (less than 30 days old)
		if daysSinceCreated < 30 {
			boost := (30 - daysSinceCreated) / 30 * 0.2 // Up to 20% boost
			recommendations[i].Score *= (1 + boost)
		}
		
		// Penalize very old content (more than 2 years old)
		if daysSinceCreated > 730 {
			penalty := math.Min(0.5, float64(daysSinceCreated-730)/365*0.1) // Up to 50% penalty
			recommendations[i].Score *= float32(1 - penalty)
		}
	}
	
	return recommendations
}

// calculateSimilarityScore calculates how similar media is to user's viewing history
func (s *RecommendationService) calculateSimilarityScore(media models.Media, viewHistory []models.ViewHistory, userRatings []models.UserRating, genrePrefs map[string]float32) float32 {
	var score float32 = 0

	// 1. Genre similarity (60% weight)
	genreScore := float32(0)
	for _, genre := range media.Genres {
		if pref, exists := genrePrefs[genre.Name]; exists {
			genreScore += pref
		}
	}
	score += genreScore * 0.6

	// 2. Content type similarity (20% weight)
	typeScore := float32(0)
	for _, history := range viewHistory {
		if history.Media.Type == media.Type {
			typeScore += 1.0
		}
	}
	typeScore = typeScore / float32(len(viewHistory)) * 10
	score += typeScore * 0.2

	// 3. Rating similarity (10% weight)
	ratingScore := float32(0)
	for _, rating := range userRatings {
		if math.Abs(float64(rating.Media.Rating-media.Rating)) < 1.0 {
			ratingScore += 2.0
		}
	}
	score += ratingScore * 0.1

	// 4. Recency boost (10% weight)
	daysSinceRelease := float32(time.Since(media.CreatedAt).Hours() / 24)
	if daysSinceRelease < 90 {
		recencyBoost := (90 - daysSinceRelease) / 90 * 5
		score += recencyBoost * 0.1
	}

	return score
}

// generateSimilarityReason creates reasons for similar content recommendations
func (s *RecommendationService) generateSimilarityReason(media models.Media, viewHistory []models.ViewHistory, genrePrefs map[string]float32) string {
	// Find the most recent highly watched content with similar genres
	for _, history := range viewHistory {
		if history.Completed || (history.Media.Duration > 0 && float64(history.Progress)/float64(history.Media.Duration) > 0.7) {
			// Check for genre overlap
			for _, historyGenre := range history.Media.Genres {
				for _, mediaGenre := range media.Genres {
					if historyGenre.ID == mediaGenre.ID {
						return fmt.Sprintf("Because you watched %s", history.Media.Title)
					}
				}
			}
		}
	}

	// Find top genre preference
	var topGenre string
	var topScore float32
	for genre, score := range genrePrefs {
		if score > topScore {
			topScore = score
			topGenre = genre
		}
	}

	// Check if media matches top genre
	for _, genre := range media.Genres {
		if genre.Name == topGenre {
			return fmt.Sprintf("More %s content for you", strings.ToLower(topGenre))
		}
	}

	return "Similar to what you've watched"
}

// TrackRecommendationClick tracks when user clicks on a recommendation
func (s *RecommendationService) TrackRecommendationClick(userID uint, mediaID uint) error {
	now := time.Now()
	return s.db.Model(&models.Recommendation{}).
		Where("user_id = ? AND media_id = ?", userID, mediaID).
		Updates(map[string]interface{}{
			"clicked":    true,
			"clicked_at": &now,
		}).Error
}

// Netflix-style category-specific recommendation methods

// GetBecauseYouWatched generates "Because you watched X" recommendations
func (s *RecommendationService) GetBecauseYouWatched(userID uint, limit int) ([]models.Media, error) {
	// Get user's most recently completed or highly progressed content
	var recentHistory []models.ViewHistory
	s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ? AND (completed = true OR progress > 1800)", userID). // 30+ minutes
		Order("watched_at DESC").
		Limit(5).
		Find(&recentHistory)

	if len(recentHistory) == 0 {
		return s.GetTrendingRecommendations(limit)
	}

	// Get the most recent item as the "anchor"
	anchorMedia := recentHistory[0].Media

	// Find similar content based on the anchor
	var similarMedia []models.Media
	s.db.Preload("Genres").
		Joins("JOIN media_genres mg1 ON media.id = mg1.media_id").
		Joins("JOIN media_genres mg2 ON mg1.genre_id = mg2.genre_id").
		Where("mg2.media_id = ? AND media.id != ?", anchorMedia.ID, anchorMedia.ID).
		Where("media.id NOT IN (?)", s.getWatchedMediaIDs(userID)).
		Group("media.id").
		Order("COUNT(mg1.genre_id) DESC, media.rating DESC, media.view_count DESC").
		Limit(limit).
		Find(&similarMedia)

	return similarMedia, nil
}

// GetTopPicksForGenre gets top picks for user's favorite genres
func (s *RecommendationService) GetTopPicksForGenre(userID uint, limit int) ([]models.Media, error) {
	// Get user's viewing history to determine favorite genres
	var viewHistory []models.ViewHistory
	s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ?", userID).
		Order("watched_at DESC").
		Limit(20).
		Find(&viewHistory)

	if len(viewHistory) == 0 {
		return s.GetTrendingRecommendations(limit)
	}

	// Calculate genre preferences
	genreCount := make(map[string]int)
	for _, history := range viewHistory {
		weight := 1
		if history.Completed {
			weight = 2
		}
		for _, genre := range history.Media.Genres {
			genreCount[genre.Name] += weight
		}
	}

	// Find top genre
	var topGenre string
	var maxCount int
	for genre, count := range genreCount {
		if count > maxCount {
			maxCount = count
			topGenre = genre
		}
	}

	if topGenre == "" {
		return s.GetTrendingRecommendations(limit)
	}

	// Get top-rated content in that genre
	var topPicks []models.Media
	s.db.Preload("Genres").
		Joins("JOIN media_genres ON media.id = media_genres.media_id").
		Joins("JOIN genres ON media_genres.genre_id = genres.id").
		Where("genres.name = ?", topGenre).
		Where("media.id NOT IN (?)", s.getWatchedMediaIDs(userID)).
		Order("media.rating DESC, media.view_count DESC").
		Limit(limit).
		Find(&topPicks)

	return topPicks, nil
}

// GetNewReleases gets recently added content with Netflix-style filtering
func (s *RecommendationService) GetNewReleases(userID uint, limit int) ([]models.Media, error) {
	// Get content added in the last 30 days
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)

	// Get user preferences for filtering
	var viewHistory []models.ViewHistory
	s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ?", userID).
		Order("watched_at DESC").
		Limit(10).
		Find(&viewHistory)

	genrePrefs := s.calculateUserGenrePreferences(viewHistory, nil)

	// Get new releases, prioritizing user's preferred genres
	var newReleases []models.Media
	s.db.Preload("Genres").
		Where("created_at > ?", thirtyDaysAgo).
		Order("created_at DESC, rating DESC").
		Find(&newReleases)

	// Score and sort by user preferences
	type ScoredRelease struct {
		Media models.Media
		Score float32
	}

	var scoredReleases []ScoredRelease
	for _, media := range newReleases {
		if s.hasUserWatched(userID, media.ID, viewHistory) {
			continue
		}

		var score float32 = 0
		// Genre preference score
		for _, genre := range media.Genres {
			if pref, exists := genrePrefs[genre.Name]; exists {
				score += pref
			}
		}
		// Base quality score
		score += float32(media.Rating) * 2
		score += float32(media.ViewCount) * 0.01

		scoredReleases = append(scoredReleases, ScoredRelease{
			Media: media,
			Score: score,
		})
	}

	// Sort by score
	sort.Slice(scoredReleases, func(i, j int) bool {
		return scoredReleases[i].Score > scoredReleases[j].Score
	})

	// Extract media and limit
	var result []models.Media
	for i, scored := range scoredReleases {
		if i >= limit {
			break
		}
		result = append(result, scored.Media)
	}

	return result, nil
}

// GetTVSeriesRecommendations gets TV series recommendations using series titles only
func (s *RecommendationService) GetTVSeriesRecommendations(userID uint, limit int) ([]models.Media, error) {
	// Get user's viewing history for TV episodes
	var viewHistory []models.ViewHistory
	s.db.Preload("Media").Preload("Media.Genres").Preload("Media.Series").
		Joins("JOIN media ON view_histories.media_id = media.id").
		Where("view_histories.user_id = ? AND media.type = ?", userID, "episode").
		Order("watched_at DESC").
		Limit(20).
		Find(&viewHistory)

	// Get user ratings for TV episodes
	var userRatings []models.UserRating
	s.db.Preload("Media").Preload("Media.Genres").Preload("Media.Series").
		Joins("JOIN media ON user_ratings.media_id = media.id").
		Where("user_ratings.user_id = ? AND media.type = ?", userID, "episode").
		Find(&userRatings)

	// Calculate genre preferences from TV viewing history
	genrePrefs := s.calculateUserGenrePreferences(viewHistory, userRatings)

	// Get all unique series titles that user hasn't watched
	watchedSeriesIDs := make(map[uint]bool)
	for _, history := range viewHistory {
		if history.Media.SeriesID != nil {
			watchedSeriesIDs[*history.Media.SeriesID] = true
		}
	}

	// Get TV series recommendations using the new GetTVSeriesForHero method
	if s.mediaService == nil {
		// Fallback: get series directly
		var allSeries []models.Series
		s.db.Preload("Episodes").Preload("Episodes.Genres").Find(&allSeries)
		
		var recommendedSeries []models.Media
		for _, series := range allSeries {
			if watchedSeriesIDs[series.ID] {
				continue // Skip watched series
			}
			
			if len(series.Episodes) > 0 {
				// Use first episode as representative
				episode := series.Episodes[0]
				seriesMedia := models.Media{
					ID:              episode.ID,
					UUID:            episode.UUID,
					Title:           series.Title, // Use series title
					Type:            "series",
					FilePath:        episode.FilePath,
					ThumbnailPath:   episode.ThumbnailPath,
					PreviewPath:     episode.PreviewPath,
					PreviewClipPath: episode.PreviewClipPath,
					PosterPath:      episode.PosterPath,
					Description:     episode.Description,
					Year:            episode.Year,
					Rating:          episode.Rating,
					Genres:          episode.Genres,
					ViewCount:       episode.ViewCount,
					CreatedAt:       episode.CreatedAt,
				}
				recommendedSeries = append(recommendedSeries, seriesMedia)
			}
		}
		
		// Score and sort series recommendations
		var scoredSeries []RecommendationScore
		for _, series := range recommendedSeries {
			score := s.calculateNetflixStyleScore(series, viewHistory, userRatings, genrePrefs, nil)
			if score > 0 {
				reason := s.generateNetflixStyleReason(series, viewHistory, userRatings, genrePrefs)
				scoredSeries = append(scoredSeries, RecommendationScore{
					Media:  series,
					Score:  score,
					Reason: reason,
				})
			}
		}
		
		// Sort by score
		sort.Slice(scoredSeries, func(i, j int) bool {
			return scoredSeries[i].Score > scoredSeries[j].Score
		})
		
		// Apply diversity and limit
		scoredSeries = s.applyDiversityFilter(scoredSeries)
		
		var result []models.Media
		for i, scored := range scoredSeries {
			if i >= limit {
				break
			}
			result = append(result, scored.Media)
		}
		
		return result, nil
	}

	// Use MediaService's GetTVSeriesForHero method
	allTVSeries, err := s.mediaService.GetTVSeriesForHero()
	if err != nil {
		return nil, err
	}

	// Filter out watched series and score them
	var scoredSeries []RecommendationScore
	for _, series := range allTVSeries {
		// Skip if user has watched this series (check by series title)
		hasWatched := false
		for _, history := range viewHistory {
			if history.Media.Series != nil && history.Media.Series.Title == series.Title {
				hasWatched = true
				break
			}
		}
		if hasWatched {
			continue
		}

		// Calculate recommendation score
		score := s.calculateNetflixStyleScore(series, viewHistory, userRatings, genrePrefs, nil)
		if score > 0 {
			reason := s.generateNetflixStyleReason(series, viewHistory, userRatings, genrePrefs)
			scoredSeries = append(scoredSeries, RecommendationScore{
				Media:  series,
				Score:  score,
				Reason: reason,
			})
		}
	}

	// Sort by score
	sort.Slice(scoredSeries, func(i, j int) bool {
		return scoredSeries[i].Score > scoredSeries[j].Score
	})

	// Apply diversity filter
	scoredSeries = s.applyDiversityFilter(scoredSeries)

	// Convert to result and limit
	var result []models.Media
	for i, scored := range scoredSeries {
		if i >= limit {
			break
		}
		result = append(result, scored.Media)
	}

	return result, nil
}

// GetPopularNow gets currently popular content with velocity scoring
func (s *RecommendationService) GetPopularNow(userID uint, limit int) ([]models.Media, error) {
	// Similar to trending but focuses on absolute popularity
	sevenDaysAgo := time.Now().AddDate(0, 0, -7)

	type PopularityScore struct {
		MediaID       uint
		RecentViews   int64
		TotalViews    int64
		Rating        float64
		PopularityRank float64
	}

	var popularityScores []PopularityScore
	s.db.Raw(`
		SELECT 
			m.id as media_id,
			COUNT(CASE WHEN vh.watched_at > ? THEN 1 END) as recent_views,
			m.view_count as total_views,
			m.rating,
			(m.view_count * 0.7 + COUNT(CASE WHEN vh.watched_at > ? THEN 1 END) * 0.3 + m.rating * 10) as popularity_rank
		FROM media m
		LEFT JOIN view_histories vh ON m.id = vh.media_id
		WHERE m.view_count > 0
		GROUP BY m.id, m.view_count, m.rating
		ORDER BY popularity_rank DESC
		LIMIT ?
	`, sevenDaysAgo, sevenDaysAgo, limit*2).Scan(&popularityScores)

	// Get the actual media objects
	var mediaIDs []uint
	for _, score := range popularityScores {
		mediaIDs = append(mediaIDs, score.MediaID)
	}

	// Filter out already watched content
	watchedIDs := s.getWatchedMediaIDs(userID)
	var filteredIDs []uint
	for _, id := range mediaIDs {
		watched := false
		for _, watchedID := range watchedIDs {
			if id == watchedID {
				watched = true
				break
			}
		}
		if !watched {
			filteredIDs = append(filteredIDs, id)
		}
	}

	// Limit results
	if len(filteredIDs) > limit {
		filteredIDs = filteredIDs[:limit]
	}

	var media []models.Media
	err := s.db.Preload("Genres").Where("id IN ?", filteredIDs).Find(&media).Error

	return media, err
}
