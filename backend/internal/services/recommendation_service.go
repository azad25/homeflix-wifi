package services

import (
	"fmt"
	"math/rand"
	"sort"
	"time"

	"gorm.io/gorm"
	"homeflix-backend/internal/models"
)

type RecommendationService struct {
	db *gorm.DB
	sessionCache map[string][]uint // Track shown content per session
	lastRefresh time.Time
}

func NewRecommendationService(db *gorm.DB) *RecommendationService {
	return &RecommendationService{
		db: db,
		sessionCache: make(map[string][]uint),
		lastRefresh: time.Now(),
	}
}

// GetDefaultRecommendations returns general recommendations when no user system is available
func (s *RecommendationService) GetDefaultRecommendations(limit int) ([]models.Media, error) {
	var media []models.Media
	
	// CRITICAL: Filter out episodes, only show main series and movies
	// Get diverse mix of content - not just high-rated content
	err := s.db.Preload("Genres").
		Where("type != ?", "episode").
		Order("created_at DESC, view_count DESC, rating DESC").
		Limit(limit).
		Find(&media).Error
	
	if err != nil {
		// If that fails, just get recent media (excluding episodes)
		err = s.db.Preload("Genres").
			Where("type != ?", "episode").
			Order("created_at DESC").
			Limit(limit).
			Find(&media).Error
	}
	
	// Ensure at least one latest media item is included
	media = s.ensureLatestMediaIncluded(media, limit)
	
	return media, err
}

// RecommendationScore represents a media item with its recommendation score
type RecommendationScore struct {
	Media  models.Media
	Score  float32
	Reason string
}

// GetRecommendationsForUser generates personalized recommendations
func (s *RecommendationService) GetRecommendationsForUser(userID uint, limit int) ([]models.Media, error) {
	// First check if we have cached recommendations that are still fresh (less than 1 hour old)
	var cachedRecommendations []models.Recommendation
	oneHourAgo := time.Now().Add(-1 * time.Hour)
	
	err := s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ? AND category = ? AND created_at > ?", userID, "personalized", oneHourAgo).
		Order("score DESC").
		Limit(limit).
		Find(&cachedRecommendations).Error
	
	// If we have fresh cached recommendations, return them
	if err == nil && len(cachedRecommendations) >= limit/2 {
		var result []models.Media
		for _, rec := range cachedRecommendations {
			result = append(result, rec.Media)
		}
		return result, nil
	}

	// Generate fresh recommendations
	var recommendations []RecommendationScore

	// Get user's viewing history and ratings
	var viewHistory []models.ViewHistory
	s.db.Preload("Media").Preload("Media.Genres").Where("user_id = ?", userID).Find(&viewHistory)

	var userRatings []models.UserRating
	s.db.Preload("Media").Preload("Media.Genres").Where("user_id = ?", userID).Find(&userRatings)

	// Get all media for scoring (exclude already watched and episodes)
	var allMedia []models.Media
	watchedIDs := s.getWatchedMediaIDs(userID)
	
	query := s.db.Preload("Genres").Where("type != ?", "episode")
	if len(watchedIDs) > 0 {
		query = query.Where("id NOT IN ?", watchedIDs)
	}
	query.Find(&allMedia)

	// Calculate recommendation scores
	for _, media := range allMedia {
		score := s.calculateRecommendationScore(media, viewHistory, userRatings)
		if score > 0 {
			reason := s.generateRecommendationReason(media, viewHistory, userRatings)
			recommendations = append(recommendations, RecommendationScore{
				Media:  media,
				Score:  score,
				Reason: reason,
			})
		}
	}

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

		// Save recommendation to database for caching
		if len(viewHistory) > 0 || len(userRatings) > 0 {
			s.saveRecommendation(userID, rec.Media.ID, rec.Score, rec.Reason, "personalized")
		}
	}
	
	// Ensure at least one latest media item is included
	result = s.ensureLatestMediaIncluded(result, limit)

	// If no recommendations found (likely no user data), fall back to default recommendations
	if len(result) == 0 {
		fmt.Printf("No personalized recommendations found for user %d, using default recommendations\n", userID)
		return s.GetDefaultRecommendations(limit)
	}

	return result, nil
}

// GetTrendingRecommendations returns trending content based on recent views
func (s *RecommendationService) GetTrendingRecommendations(limit int) ([]models.Media, error) {
	var media []models.Media
	
	// Get media with highest view counts in the last 30 days (excluding episodes)
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)
	
	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
		Where("(last_viewed > ? OR view_count > 0) AND type != ?", thirtyDaysAgo, "episode").
		Order("view_count DESC, last_viewed DESC").
		Limit(limit).
		Find(&media).Error
	
	// Ensure at least one latest media item is included
	media = s.ensureLatestMediaIncluded(media, limit)
	
	return media, err
}

// GetSimilarMedia finds media similar to what user has watched
func (s *RecommendationService) GetSimilarMedia(userID uint, limit int) ([]models.Media, error) {
	// Get user's rated media (all ratings, not just high ones)
	var userRatings []models.UserRating
	s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ? AND rating >= 5", userID).
		Order("rating DESC").
		Limit(10).
		Find(&userRatings)

	if len(userRatings) == 0 {
		return s.GetTrendingRecommendations(limit)
	}

	// Get genres from highly rated media
	genreMap := make(map[string]int)
	for _, rating := range userRatings {
		for _, genre := range rating.Media.Genres {
			genreMap[genre.Name]++
		}
	}

	// Find media with similar genres (excluding episodes)
	var similarMedia []models.Media
	for genreName := range genreMap {
		var genreMedia []models.Media
		s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
			Joins("JOIN media_genres ON media.id = media_genres.media_id").
			Joins("JOIN genres ON media_genres.genre_id = genres.id").
			Where("genres.name = ? AND media.type != ?", genreName, "episode").
			Where("media.id NOT IN (?)", s.getWatchedMediaIDs(userID)).
			Limit(limit/len(genreMap) + 1).
			Find(&genreMedia)
		
		similarMedia = append(similarMedia, genreMedia...)
	}

	// Remove duplicates and limit
	uniqueMedia := s.removeDuplicateMedia(similarMedia)
	if len(uniqueMedia) > limit {
		uniqueMedia = uniqueMedia[:limit]
	}
	
	// Ensure at least one latest media item is included
	uniqueMedia = s.ensureLatestMediaIncluded(uniqueMedia, limit)

	return uniqueMedia, nil
}

// GetContinueWatching returns media user started but didn't finish
func (s *RecommendationService) GetContinueWatching(userID uint) ([]models.Media, error) {
	var viewHistory []models.ViewHistory
	err := s.db.Preload("Media").Preload("Media.Genres").Preload("Media.Series").
		Where("user_id = ? AND completed = false AND progress > 300", userID). // at least 5 minutes watched
		Order("watched_at DESC").
		Limit(10).
		Find(&viewHistory).Error

	var media []models.Media
	for _, history := range viewHistory {
		media = append(media, history.Media)
	}

	return media, err
}

// Helper functions

func (s *RecommendationService) calculateRecommendationScore(media models.Media, viewHistory []models.ViewHistory, userRatings []models.UserRating) float32 {
	var score float32 = 0

	// Base score from global popularity (reduced weight)
	score += float32(media.ViewCount) * 0.05

	// Genre matching score (highest weight for personalization)
	genreScore := s.calculateGenreScore(media, viewHistory, userRatings)
	score += genreScore * 5

	// Time-based diversity boost
	now := time.Now()
	hourOfDay := now.Hour()
	dayOfWeek := int(now.Weekday())
	
	// Add time-based variation to prevent same recommendations
	timeVariation := float32((hourOfDay + dayOfWeek*24) % 100) * 0.01
	score += timeVariation

	// Recency boost with graduated scoring (prioritize new content over ratings)
	daysSinceAdded := int(now.Sub(media.CreatedAt).Hours() / 24)
	if daysSinceAdded <= 7 {
		score += 5 // New content gets highest boost
	} else if daysSinceAdded <= 30 {
		score += 3 // Recent content gets medium boost
	} else if daysSinceAdded <= 90 {
		score += 2 // Somewhat recent content gets small boost
	}

	// Balanced rating boost - don't over-prioritize high ratings
	if media.Rating > 5 {
		// Linear scaling instead of exponential to reduce high-rating bias
		ratingBoost := float32(media.Rating - 5) * 0.3
		score += ratingBoost
	}

	// Diversity boost - favor content across all rating ranges
	if media.ViewCount < 50 {
		if media.Rating > 6.5 {
			score += 1.5 // Hidden gems boost
		} else if media.Rating > 5.5 {
			score += 1.0 // Decent underrated content
		} else {
			score += 0.5 // Give all content a chance
		}
	}

	// Seasonal/trending boost based on recent views
	if media.LastViewed != nil && media.LastViewed.After(now.AddDate(0, 0, -7)) {
		score += 1 // Recently watched by others
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

// RefreshRecommendations updates recommendation scores for all users after new media is added
func (s *RecommendationService) RefreshRecommendations() error {
	// Get all active users (users who have watched something in the last 90 days)
	var activeUsers []uint
	ninetyDaysAgo := time.Now().AddDate(0, 0, -90)
	
	err := s.db.Model(&models.ViewHistory{}).
		Where("watched_at > ?", ninetyDaysAgo).
		Distinct("user_id").
		Pluck("user_id", &activeUsers)
	
	if err != nil {
		// If there's an error (likely because user system isn't implemented yet),
		// use default user ID 1 for now
		fmt.Printf("Warning: Failed to get active users (user system not implemented yet): %v\n", err)
		activeUsers = []uint{1} // Use default user ID 1
	}

	// If no active users found, use default user ID 1
	if len(activeUsers) == 0 {
		fmt.Println("No active users found, using default user ID 1 for recommendations")
		activeUsers = []uint{1}
	}

	// Clear old cached recommendations to force fresh generation
	oneHourAgo := time.Now().Add(-1 * time.Hour)
	if err := s.db.Where("created_at < ?", oneHourAgo).Delete(&models.Recommendation{}).Error; err != nil {
		fmt.Printf("Warning: Failed to clean up old cached recommendations: %v\n", err)
	}

	// Refresh recommendations for each active user
	for _, userID := range activeUsers {
		// Generate fresh recommendations for this user
		_, err := s.GetRecommendationsForUser(userID, 50) // Generate up to 50 recommendations
		if err != nil {
			// Log error but continue with other users
			fmt.Printf("Warning: Failed to refresh recommendations for user %d: %v\n", userID, err)
		}
	}

	// Clean up very old recommendations (older than 7 days)
	sevenDaysAgo := time.Now().AddDate(0, 0, -7)
	if err := s.db.Where("created_at < ?", sevenDaysAgo).Delete(&models.Recommendation{}).Error; err != nil {
		return fmt.Errorf("failed to clean up old recommendations: %v", err)
	}

	return nil
}

// InvalidateUserRecommendations clears cached recommendations for a specific user
// This should be called when user's viewing behavior changes significantly
func (s *RecommendationService) InvalidateUserRecommendations(userID uint) error {
	return s.db.Where("user_id = ?", userID).Delete(&models.Recommendation{}).Error
}

// ensureLatestMediaIncluded ensures at least one of the latest media items is included in recommendations
func (s *RecommendationService) ensureLatestMediaIncluded(currentMedia []models.Media, limit int) []models.Media {
	// Get the latest media item (excluding episodes)
	var latestMedia models.Media
	err := s.db.Preload("Genres").
		Where("type != ?", "episode").
		Order("created_at DESC").
		First(&latestMedia).Error
	
	if err != nil {
		// If no latest media found, return current recommendations as-is
		return currentMedia
	}
	
	// Check if latest media is already in the recommendations
	for _, media := range currentMedia {
		if media.ID == latestMedia.ID {
			// Latest media already included, return as-is
		return currentMedia
		}
	}
	
	// Latest media not included, add it to the beginning
	result := []models.Media{latestMedia}
	
	// Add existing recommendations (up to limit-1 to make room for latest)
	maxExisting := limit - 1
	if maxExisting < 0 {
		maxExisting = 0
	}
	
	for i, media := range currentMedia {
		if i >= maxExisting {
			break
		}
		result = append(result, media)
	}
	
	return result
}

// GetDynamicRecommendations returns different content based on time-based algorithms and session awareness
func (s *RecommendationService) GetDynamicRecommendations(category string, limit int, sessionID string) ([]models.Media, error) {
	// Clean old session cache entries (older than 1 hour)
	s.cleanSessionCache()
	
	// Get current time-based algorithm index
	now := time.Now()
	algorithmIndex := (now.Hour() + int(now.Weekday())*24) % 8 // 8 different algorithms
	
	var media []models.Media
	var err error
	
	switch category {
	case "mixed":
		media, err = s.getMixedDynamicRecommendations(algorithmIndex, limit, sessionID)
	case "trending":
		media, err = s.getTrendingDynamicRecommendations(algorithmIndex, limit, sessionID)
	case "popular":
		media, err = s.getPopularDynamicRecommendations(algorithmIndex, limit, sessionID)
	case "recent":
		media, err = s.getRecentDynamicRecommendations(algorithmIndex, limit, sessionID)
	case "personalized":
		media, err = s.getPersonalizedDynamicRecommendations(algorithmIndex, limit, sessionID)
	default:
		media, err = s.getMixedDynamicRecommendations(algorithmIndex, limit, sessionID)
	}
	
	if err != nil {
		return s.GetDefaultRecommendations(limit)
	}
	
	// Apply session filtering but ensure we have enough content
	originalCount := len(media)
	media = s.filterSessionContent(media, sessionID)
	
	// If session filtering removed too much content, get fresh content
	if len(media) < limit/2 && originalCount > 0 {
		// Get additional fresh content to maintain variety
		additionalMedia := s.getLatestAddedPriority(limit)
		additionalMedia = s.filterSessionContent(additionalMedia, sessionID)
		media = append(media, additionalMedia...)
		
		// Remove duplicates
		seen := make(map[uint]bool)
		var uniqueMedia []models.Media
		for _, m := range media {
			if !seen[m.ID] {
				seen[m.ID] = true
				uniqueMedia = append(uniqueMedia, m)
				if len(uniqueMedia) >= limit {
					break
				}
			}
		}
		media = uniqueMedia
	}
	
	// Track shown content for this session
	s.trackSessionContent(media, sessionID)
	
	// Ensure variety with latest content
	media = s.ensureLatestMediaIncluded(media, limit)
	
	return media, nil
}

// getMixedDynamicRecommendations provides 8 different mixed algorithms
func (s *RecommendationService) getMixedDynamicRecommendations(algorithmIndex, limit int, sessionID string) ([]models.Media, error) {
	var media []models.Media
	
	switch algorithmIndex {
	case 0: // Latest Added (Priority: 2023-2024)
		media = s.getLatestAddedPriority(limit)
	case 1: // Recent Years Focus (2022-2024)
		media = s.getRecentYearsFocus(limit)
	case 2: // Current Year + High Rated (2024 focus)
		media = s.getCurrentYearHighRated(limit)
	case 3: // New Additions + Trending
		media = s.getNewAdditionsTrending(limit)
	case 4: // Recent Quality Content (HD/4K from 2022+)
		media = s.getRecentQualityContent(limit)
	case 5: // Fresh Discoveries (Recent + Underrated)
		media = s.getFreshDiscoveries(limit)
	case 6: // Latest Genre Mix
		media = s.getLatestGenreMix(limit)
	case 7: // Always Latest Priority
		media = s.getLatestAddedPriority(limit)
	}
	
	return media, nil
}

// getTrendingDynamicRecommendations provides 8 different trending algorithms
func (s *RecommendationService) getTrendingDynamicRecommendations(algorithmIndex, limit int, sessionID string) ([]models.Media, error) {
	var media []models.Media
	
	switch algorithmIndex {
	case 0: // Latest Trending (Recent additions with views)
		media = s.getNewAdditionsTrending(limit)
	case 1: // Current Year Trending (2024 focus)
		media = s.getCurrentYearHighRated(limit)
	case 2: // Recent Years Trending (2022-2024)
		media = s.getRecentYearsFocus(limit)
	case 3: // Latest Quality Trending (Recent HD/4K)
		media = s.getRecentQualityContent(limit)
	case 4: // Fresh Trending (Recent + Popular)
		media = s.getRecentPopular(limit)
	case 5: // Latest Genre Trending
		media = s.getLatestGenreMix(limit)
	case 6: // Trending movies only
		media = s.getTrendingMoviesOnly(limit)
	case 7: // Trending series only
		media = s.getTrendingSeriesOnly(limit)
	}
	
	return media, nil
}

// getPopularDynamicRecommendations provides 8 different popular algorithms
func (s *RecommendationService) getPopularDynamicRecommendations(algorithmIndex, limit int, sessionID string) ([]models.Media, error) {
	var media []models.Media
	
	switch algorithmIndex {
	case 0: // All-time popular
		media = s.getAllTimePopular(limit)
	case 1: // Popular by genre rotation
		genres := []string{"Action", "Drama", "Comedy", "Thriller", "Sci-Fi", "Horror"}
		genre := genres[algorithmIndex%len(genres)]
		media = s.getPopularByGenre(genre, limit)
	case 2: // Popular recent releases
		media = s.getPopularRecentReleases(limit)
	case 3: // Popular high-rated
		media = s.getPopularHighRated(limit)
	case 4: // Popular movies focus
		media = s.getPopularMoviesFocus(limit)
	case 5: // Popular series focus
		media = s.getPopularSeriesFocus(limit)
	case 6: // Popular by decade
		decade := 2020 - (algorithmIndex%3)*10 // 2020s, 2010s, 2000s
		media = s.getPopularByDecade(decade, limit)
	case 7: // Popular underrated mix
		media = s.getPopularUnderratedMix(limit)
	}
	
	return media, nil
}

// getRecentDynamicRecommendations provides 8 different recent algorithms
func (s *RecommendationService) getRecentDynamicRecommendations(algorithmIndex, limit int, sessionID string) ([]models.Media, error) {
	var media []models.Media
	
	switch algorithmIndex {
	case 0: // Latest Added Priority (Last 6 months)
		media = s.getLatestAddedPriority(limit)
	case 1: // Current Year Recent (2024)
		media = s.getCurrentYearHighRated(limit)
	case 2: // Recent Years Focus (2022-2024)
		media = s.getRecentYearsFocus(limit)
	case 3: // New Additions Trending
		media = s.getNewAdditionsTrending(limit)
	case 4: // Recent Quality Content (HD/4K)
		media = s.getRecentQualityContent(limit)
	case 5: // Fresh Discoveries (Recent + Underrated)
		media = s.getFreshDiscoveries(limit)
	case 6: // Latest Genre Mix
		media = s.getLatestGenreMix(limit)
	case 7: // Always Latest Priority
		media = s.getLatestAddedPriority(limit)
	}
	
	return media, nil
}

// getPersonalizedDynamicRecommendations provides 8 different personalized algorithms
func (s *RecommendationService) getPersonalizedDynamicRecommendations(algorithmIndex, limit int, sessionID string) ([]models.Media, error) {
	userID := uint(1) // Default user for now
	var media []models.Media
	
	switch algorithmIndex {
	case 0: // Standard personalized
		media, _ = s.GetRecommendationsForUser(userID, limit)
	case 1: // Similar media focus
		media, _ = s.GetSimilarMedia(userID, limit)
	case 2: // Personalized + trending mix
		personalizedMedia, _ := s.GetRecommendationsForUser(userID, limit/2)
		trendingMedia, _ := s.GetTrendingRecommendations(limit/2)
		media = append(personalizedMedia, trendingMedia...)
	case 3: // Genre-based personalized
		media = s.getPersonalizedByGenre(userID, limit)
	case 4: // Year-based personalized
		media = s.getPersonalizedByYear(userID, limit)
	case 5: // Rating-based personalized
		media = s.getPersonalizedByRating(userID, limit)
	case 6: // Discovery personalized (new genres)
		media = s.getPersonalizedDiscovery(userID, limit)
	case 7: // Balanced personalized
		media = s.getBalancedPersonalized(userID, limit)
	}
	
	return media, nil
}

// Helper methods for dynamic algorithms

// New priority functions for recent content
func (s *RecommendationService) getLatestAddedPriority(limit int) []models.Media {
	var media []models.Media
	// Prioritize content added in last 6 months
	cutoff := time.Now().AddDate(0, -6, 0)
	s.db.Preload("Genres").
		Where("created_at > ? AND type != ?", cutoff, "episode").
		Order("created_at DESC, rating DESC").
		Limit(limit).
		Find(&media)
	
	// If not enough recent content, fill with older diverse content
	if len(media) < limit {
		var olderMedia []models.Media
		s.db.Preload("Genres").
			Where("created_at <= ? AND type != ?", cutoff, "episode").
			Order("view_count DESC, rating DESC, created_at DESC").
			Limit(limit - len(media)).
			Find(&olderMedia)
		media = append(media, olderMedia...)
	}
	return media
}

func (s *RecommendationService) getRecentYearsFocus(limit int) []models.Media {
	var media []models.Media
	// Focus on 2022-2024 content
	s.db.Preload("Genres").
		Where("year BETWEEN ? AND ? AND type != ?", 2022, 2024, "episode").
		Order("year DESC, rating DESC, created_at DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getCurrentYearHighRated(limit int) []models.Media {
	var media []models.Media
	currentYear := time.Now().Year()
	// Prioritize current year content with diverse ratings
	s.db.Preload("Genres").
		Where("year = ? AND type != ?", currentYear, "episode").
		Order("created_at DESC, view_count DESC, rating DESC").
		Limit(limit).
		Find(&media)
	
	// Fill with previous year if needed
	if len(media) < limit {
		var prevYearMedia []models.Media
		s.db.Preload("Genres").
			Where("year = ? AND type != ?", currentYear-1, "episode").
			Order("created_at DESC, view_count DESC, rating DESC").
			Limit(limit - len(media)).
			Find(&prevYearMedia)
		media = append(media, prevYearMedia...)
	}
	return media
}

func (s *RecommendationService) getNewAdditionsTrending(limit int) []models.Media {
	var media []models.Media
	// Recent additions with good view counts
	cutoff := time.Now().AddDate(0, -3, 0) // Last 3 months
	s.db.Preload("Genres").
		Where("created_at > ? AND view_count > ? AND type != ?", cutoff, 5, "episode").
		Order("created_at DESC, view_count DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getRecentQualityContent(limit int) []models.Media {
	var media []models.Media
	// HD/4K content from 2022+
	s.db.Preload("Genres").
		Where("year >= ? AND (quality ILIKE ? OR quality ILIKE ? OR quality ILIKE ?) AND type != ?", 
			2022, "%4K%", "%1080p%", "%HD%", "episode").
		Order("year DESC, rating DESC, created_at DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getFreshDiscoveries(limit int) []models.Media {
	var media []models.Media
	// Recent content with low view counts (fresh discoveries across all ratings)
	cutoff := time.Now().AddDate(0, -4, 0) // Last 4 months
	s.db.Preload("Genres").
		Where("created_at > ? AND view_count < ? AND type != ?", cutoff, 20, "episode").
		Order("created_at DESC, rating DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getLatestGenreMix(limit int) []models.Media {
	var media []models.Media
	genres := []string{"Action", "Drama", "Comedy", "Sci-Fi", "Thriller"}
	cutoff := time.Now().AddDate(0, -6, 0) // Last 6 months
	
	for _, genre := range genres {
		var genreMedia []models.Media
		s.db.Preload("Genres").
			Joins("JOIN media_genres ON media.id = media_genres.media_id").
			Joins("JOIN genres ON media_genres.genre_id = genres.id").
			Where("genres.name = ? AND media.created_at > ? AND media.type != ?", genre, cutoff, "episode").
			Order("media.created_at DESC, media.rating DESC").
			Limit(limit / len(genres)).
			Find(&genreMedia)
		media = append(media, genreMedia...)
	}
	
	return s.shuffleMedia(media)
}

// GetEnhancedTrendingRecommendations provides trending content with mixed criteria (views, genres, latest year, high rating)
func (s *RecommendationService) GetEnhancedTrendingRecommendations(limit int, sessionID string) ([]models.Media, error) {
	var allMedia []models.Media
	currentYear := time.Now().Year()
	
	// Get a larger pool of media to work with (3x the limit for better variety)
	poolSize := limit * 3
	if poolSize < 60 {
		poolSize = 60
	}
	
	// Get recent high-quality content with good views
	err := s.db.Preload("Genres").
		Where("type != ? AND year >= ? AND rating >= ? AND view_count > ?", "episode", currentYear-3, 6.0, 5).
		Order("RANDOM()").
		Offset(rand.Intn(10)). // Random offset for variety
		Limit(poolSize/3).
		Find(&allMedia).Error
	
	if err != nil {
		return nil, err
	}
	
	// Get popular action/sci-fi/thriller content
	var genreMedia []models.Media
	err = s.db.Preload("Genres").
		Joins("JOIN media_genres mg ON media.id = mg.media_id").
		Joins("JOIN genres g ON mg.genre_id = g.id").
		Where("media.type != ? AND (g.name ILIKE ? OR g.name ILIKE ? OR g.name ILIKE ? OR g.name ILIKE ?) AND media.view_count > ?", 
			"episode", "%action%", "%sci-fi%", "%science%", "%thriller%", 10).
		Order("RANDOM()").
		Limit(poolSize/3).
		Find(&genreMedia).Error
	
	if err == nil {
		allMedia = append(allMedia, genreMedia...)
	}
	
	// Get highly rated recent content
	var ratedMedia []models.Media
	err = s.db.Preload("Genres").
		Where("type != ? AND rating >= ? AND year >= ?", "episode", 7.5, currentYear-5).
		Order("RANDOM()").
		Limit(poolSize/3).
		Find(&ratedMedia).Error
	
	if err == nil {
		allMedia = append(allMedia, ratedMedia...)
	}
	
	// Remove duplicates and shuffle
	allMedia = s.removeDuplicateMedia(allMedia)
	allMedia = s.shuffleMedia(allMedia)
	
	// Apply session filtering
	allMedia = s.filterSessionContent(allMedia, sessionID)
	
	// Limit to requested size
	if len(allMedia) > limit {
		allMedia = allMedia[:limit]
	}
	
	return allMedia, nil
}

// GetEnhancedPopularRecommendations provides popular content with mixed criteria (views, rating, year, genres)
func (s *RecommendationService) GetEnhancedPopularRecommendations(limit int, sessionID string) ([]models.Media, error) {
	var allMedia []models.Media
	currentYear := time.Now().Year()
	
	// Get a larger pool of media to work with (3x the limit for better variety)
	poolSize := limit * 3
	if poolSize < 60 {
		poolSize = 60
	}
	
	// Get most viewed content (balanced approach)
	var popularMedia []models.Media
	err := s.db.Preload("Genres").
		Where("type != ? AND view_count > ? AND view_count < ?", "episode", 15, 500).
		Order("view_count DESC, RANDOM()").
		Offset(rand.Intn(10)). // Random offset for variety
		Limit(poolSize/4).
		Find(&popularMedia).Error
	
	if err != nil {
		return nil, err
	}
	allMedia = append(allMedia, popularMedia...)
	
	// Get mixed quality content (not just high-rated)
	var mixedMedia []models.Media
	err = s.db.Preload("Genres").
		Where("type != ? AND rating >= ? AND rating <= ?", "episode", 6.0, 8.5).
		Order("RANDOM()").
		Offset(rand.Intn(10)).
		Limit(poolSize/4).
		Find(&mixedMedia).Error
	
	if err == nil {
		allMedia = append(allMedia, mixedMedia...)
	}
	
	// Get recent diverse content (not just popular)
	var recentMedia []models.Media
	err = s.db.Preload("Genres").
		Where("type != ? AND year >= ? AND view_count > ?", "episode", currentYear-4, 5).
		Order("RANDOM()").
		Offset(rand.Intn(15)).
		Limit(poolSize/4).
		Find(&recentMedia).Error
	
	if err == nil {
		allMedia = append(allMedia, recentMedia...)
	}
	
	// Get diverse genre content (balanced popularity)
	var genreMedia []models.Media
	err = s.db.Preload("Genres").
		Joins("JOIN media_genres mg ON media.id = mg.media_id").
		Joins("JOIN genres g ON mg.genre_id = g.id").
		Where("media.type != ? AND (g.name ILIKE ? OR g.name ILIKE ? OR g.name ILIKE ? OR g.name ILIKE ?) AND media.view_count > ? AND media.view_count < ?", 
			"episode", "%action%", "%drama%", "%comedy%", "%thriller%", 3, 200).
		Order("RANDOM()").
		Offset(rand.Intn(20)).
		Limit(poolSize/4).
		Find(&genreMedia).Error
	
	if err == nil {
		allMedia = append(allMedia, genreMedia...)
	}
	
	// Remove duplicates and shuffle
	allMedia = s.removeDuplicateMedia(allMedia)
	allMedia = s.shuffleMedia(allMedia)
	
	// Apply session filtering
	allMedia = s.filterSessionContent(allMedia, sessionID)
	
	// Limit to requested size
	if len(allMedia) > limit {
		allMedia = allMedia[:limit]
	}
	
	return allMedia, nil
}

// GetSciFiRecommendations provides science fiction movies and series
func (s *RecommendationService) GetSciFiRecommendations(limit int, sessionID string) ([]models.Media, error) {
	var allMedia []models.Media
	currentYear := time.Now().Year()
	
	// Get a larger pool for better variety
	poolSize := limit * 2
	if poolSize < 40 {
		poolSize = 40
	}
	
	// Get recent high-quality sci-fi content (strict sci-fi only, exclude drama/comedy)
	var recentSciFi []models.Media
	err := s.db.Preload("Genres").
		Joins("JOIN media_genres mg1 ON media.id = mg1.media_id").
		Joins("JOIN genres g1 ON mg1.genre_id = g1.id").
		Where("(g1.name ILIKE ? OR g1.name ILIKE ? OR g1.name ILIKE ?) AND media.type != ? AND media.year >= ? AND media.rating >= ?", 
			"%sci-fi%", "%science fiction%", "%science%", "episode", currentYear-5, 6.0).
		Where("media.id NOT IN (SELECT mg2.media_id FROM media_genres mg2 JOIN genres g2 ON mg2.genre_id = g2.id WHERE g2.name ILIKE ? OR g2.name ILIKE ?)", 
			"%drama%", "%comedy%").
		Order("RANDOM()").
		Limit(poolSize/2).
		Find(&recentSciFi).Error
	
	if err != nil {
		return nil, err
	}
	allMedia = append(allMedia, recentSciFi...)
	
	// Get popular sci-fi content (strict sci-fi only, exclude drama/comedy)
	var popularSciFi []models.Media
	err = s.db.Preload("Genres").
		Joins("JOIN media_genres mg1 ON media.id = mg1.media_id").
		Joins("JOIN genres g1 ON mg1.genre_id = g1.id").
		Where("(g1.name ILIKE ? OR g1.name ILIKE ? OR g1.name ILIKE ?) AND media.type != ? AND media.view_count > ?", 
			"%sci-fi%", "%science fiction%", "%science%", "episode", 3).
		Where("media.id NOT IN (SELECT mg2.media_id FROM media_genres mg2 JOIN genres g2 ON mg2.genre_id = g2.id WHERE g2.name ILIKE ? OR g2.name ILIKE ?)", 
			"%drama%", "%comedy%").
		Order("media.view_count DESC, RANDOM()").
		Limit(poolSize/2).
		Find(&popularSciFi).Error
	
	if err == nil {
		allMedia = append(allMedia, popularSciFi...)
	}
	
	// If we don't have enough sci-fi content, add some broader sci-fi/fantasy content
	if len(allMedia) < limit {
		var fallbackSciFi []models.Media
		err = s.db.Preload("Genres").
			Joins("JOIN media_genres ON media.id = media_genres.media_id").
			Joins("JOIN genres ON media_genres.genre_id = genres.id").
			Where("(genres.name ILIKE ? OR genres.name ILIKE ? OR genres.name ILIKE ? OR genres.name ILIKE ?) AND media.type != ?", 
				"%sci-fi%", "%science fiction%", "%science%", "%fantasy%", "episode").
			Order("RANDOM()").
			Limit(limit).
			Find(&fallbackSciFi).Error
		
		if err == nil {
			allMedia = append(allMedia, fallbackSciFi...)
		}
	}
	
	// Remove duplicates and shuffle
	allMedia = s.removeDuplicateMedia(allMedia)
	allMedia = s.shuffleMedia(allMedia)
	
	// Apply session filtering
	allMedia = s.filterSessionContent(allMedia, sessionID)
	
	// Limit to requested size
	if len(allMedia) > limit {
		allMedia = allMedia[:limit]
	}
	
	return allMedia, nil
}

// Keep original function for compatibility
func (s *RecommendationService) getLatestHighRated(limit int) []models.Media {
	var media []models.Media
	s.db.Preload("Genres").
		Where("type != ?", "episode").
		Order("created_at DESC, view_count DESC, rating DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getGenreRotationContent(genres []string, limit int) []models.Media {
	var media []models.Media
	for _, genre := range genres {
		var genreMedia []models.Media
		s.db.Preload("Genres").
			Joins("JOIN media_genres ON media.id = media_genres.media_id").
			Joins("JOIN genres ON media_genres.genre_id = genres.id").
			Where("genres.name ILIKE ? AND media.type != ?", "%"+genre+"%", "episode").
			Order("media.rating DESC, media.created_at DESC").
			Limit(limit / len(genres)).
			Find(&genreMedia)
		media = append(media, genreMedia...)
	}
	return s.shuffleMedia(media)
}

func (s *RecommendationService) getYearBasedContent(startYear, endYear, limit int) []models.Media {
	var media []models.Media
	s.db.Preload("Genres").
		Where("year BETWEEN ? AND ? AND type != ?", startYear, endYear, "episode").
		Order("rating DESC, view_count DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getPopularUnderratedMix(limit int) []models.Media {
	var popular []models.Media
	var underrated []models.Media
	
	// Get popular content
	s.db.Preload("Genres").
		Where("view_count > ? AND type != ?", 50, "episode").
		Order("view_count DESC").
		Limit(limit / 2).
		Find(&popular)
	
	// Get lesser-known content (not just high-rated)
	s.db.Preload("Genres").
		Where("view_count < ? AND type != ?", 20, "episode").
		Order("created_at DESC, rating DESC").
		Limit(limit / 2).
		Find(&underrated)
	
	return s.shuffleMedia(append(popular, underrated...))
}

func (s *RecommendationService) getDecadeMixContent(limit int) []models.Media {
	var media []models.Media
	decades := []int{2020, 2010, 2000}
	
	for _, decade := range decades {
		var decadeMedia []models.Media
		s.db.Preload("Genres").
			Where("year BETWEEN ? AND ? AND type != ?", decade, decade+9, "episode").
			Order("rating DESC, view_count DESC").
			Limit(limit / len(decades)).
			Find(&decadeMedia)
		media = append(media, decadeMedia...)
	}
	
	return s.shuffleMedia(media)
}

func (s *RecommendationService) getHiddenGems(limit int) []models.Media {
	var media []models.Media
	s.db.Preload("Genres").
		Where("view_count < ? AND type != ?", 30, "episode").
		Order("created_at DESC, rating DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getRandomQualityMix(limit int) []models.Media {
	var media []models.Media
	
	// Seed random with current time for variety
	rand.Seed(time.Now().UnixNano())
	
	qualities := []string{"4K", "1080p", "HD", "720p"}
	for _, quality := range qualities {
		var qualityMedia []models.Media
		s.db.Preload("Genres").
			Where("quality ILIKE ? AND type != ?", "%"+quality+"%", "episode").
			Order("RANDOM()").
			Limit(limit / len(qualities)).
			Find(&qualityMedia)
		media = append(media, qualityMedia...)
	}
	
	return s.shuffleMedia(media)
}

// Session management methods

func (s *RecommendationService) cleanSessionCache() {
	// Remove sessions older than 1 hour
	// In a real implementation, you'd track session timestamps
	if time.Since(s.lastRefresh) > time.Hour {
		s.sessionCache = make(map[string][]uint)
		s.lastRefresh = time.Now()
	}
}

func (s *RecommendationService) filterSessionContent(media []models.Media, sessionID string) []models.Media {
	if sessionID == "" {
		return media
	}
	
	shownIDs := s.sessionCache[sessionID]
	if len(shownIDs) == 0 {
		return media
	}
	
	var filtered []models.Media
	for _, item := range media {
		shown := false
		for _, shownID := range shownIDs {
			if item.ID == shownID {
				shown = true
				break
			}
		}
		if !shown {
			filtered = append(filtered, item)
		}
	}
	
	return filtered
}

func (s *RecommendationService) trackSessionContent(media []models.Media, sessionID string) {
	if sessionID == "" {
		return
	}
	
	for _, item := range media {
		s.sessionCache[sessionID] = append(s.sessionCache[sessionID], item.ID)
	}
	
	// Limit session cache size
	if len(s.sessionCache[sessionID]) > 200 {
		s.sessionCache[sessionID] = s.sessionCache[sessionID][50:] // Keep last 150
	}
}

func (s *RecommendationService) shuffleMedia(media []models.Media) []models.Media {
	if len(media) <= 1 {
		return media
	}
	
	// Create a copy to avoid modifying the original slice
	shuffled := make([]models.Media, len(media))
	copy(shuffled, media)
	
	// Fisher-Yates shuffle
	for i := len(shuffled) - 1; i > 0; i-- {
		j := rand.Intn(i + 1)
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	}
	
	return shuffled
}

// Additional helper methods for specific algorithms

func (s *RecommendationService) getMostViewedRecent(days, limit int) []models.Media {
	var media []models.Media
	cutoff := time.Now().AddDate(0, 0, -days)
	s.db.Preload("Genres").
		Where("last_viewed > ? AND type != ?", cutoff, "episode").
		Order("view_count DESC, last_viewed DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getRecentlyAddedTrending(limit int) []models.Media {
	var media []models.Media
	cutoff := time.Now().AddDate(0, 0, -30) // Last 30 days
	s.db.Preload("Genres").
		Where("created_at > ? AND view_count > ? AND type != ?", cutoff, 5, "episode").
		Order("view_count DESC, created_at DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getTrendingByGenre(genre string, limit int) []models.Media {
	var media []models.Media
	s.db.Preload("Genres").
		Joins("JOIN media_genres ON media.id = media_genres.media_id").
		Joins("JOIN genres ON media_genres.genre_id = genres.id").
		Where("genres.name ILIKE ? AND media.view_count > ? AND media.type != ?", "%"+genre+"%", 10, "episode").
		Order("media.view_count DESC, media.last_viewed DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getHighRatedRecent(limit int) []models.Media {
	var media []models.Media
	cutoff := time.Now().AddDate(0, 0, -60) // Last 60 days
	s.db.Preload("Genres").
		Where("created_at > ? AND type != ?", cutoff, "episode").
		Order("created_at DESC, view_count DESC, rating DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getPopularByYear(year, limit int) []models.Media {
	var media []models.Media
	s.db.Preload("Genres").
		Where("year = ? AND view_count > ? AND type != ?", year, 5, "episode").
		Order("view_count DESC, rating DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getTrendingMoviesOnly(limit int) []models.Media {
	var media []models.Media
	s.db.Preload("Genres").
		Where("type = ? AND view_count > ?", "movie", 10).
		Order("view_count DESC, last_viewed DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getTrendingSeriesOnly(limit int) []models.Media {
	var media []models.Media
	s.db.Preload("Genres").
		Where("(type = ? OR type = ?) AND view_count > ?", "series", "tv", 10).
		Order("view_count DESC, last_viewed DESC").
		Limit(limit).
		Find(&media)
	return media
}

// Additional missing helper methods

func (s *RecommendationService) getAllTimePopular(limit int) []models.Media {
	var media []models.Media
	s.db.Preload("Genres").
		Where("view_count > ? AND type != ?", 20, "episode").
		Order("view_count DESC, rating DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getPopularByGenre(genre string, limit int) []models.Media {
	var media []models.Media
	s.db.Preload("Genres").
		Joins("JOIN media_genres ON media.id = media_genres.media_id").
		Joins("JOIN genres ON media_genres.genre_id = genres.id").
		Where("genres.name ILIKE ? AND media.view_count > ? AND media.type != ?", "%"+genre+"%", 15, "episode").
		Order("media.view_count DESC, media.rating DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getPopularRecentReleases(limit int) []models.Media {
	var media []models.Media
	cutoff := time.Now().AddDate(-2, 0, 0) // Last 2 years
	s.db.Preload("Genres").
		Where("created_at > ? AND view_count > ? AND type != ?", cutoff, 10, "episode").
		Order("view_count DESC, created_at DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getPopularHighRated(limit int) []models.Media {
	var media []models.Media
	s.db.Preload("Genres").
		Where("view_count > ? AND type != ?", 15, "episode").
		Order("view_count DESC, rating DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getPopularMoviesFocus(limit int) []models.Media {
	var media []models.Media
	s.db.Preload("Genres").
		Where("type = ? AND view_count > ?", "movie", 10).
		Order("view_count DESC, rating DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getPopularSeriesFocus(limit int) []models.Media {
	var media []models.Media
	s.db.Preload("Genres").
		Where("(type = ? OR type = ?) AND view_count > ?", "series", "tv", 10).
		Order("view_count DESC, rating DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getPopularByDecade(decade, limit int) []models.Media {
	var media []models.Media
	s.db.Preload("Genres").
		Where("year BETWEEN ? AND ? AND view_count > ? AND type != ?", decade, decade+9, 10, "episode").
		Order("view_count DESC, rating DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getLatestAdded(limit int) []models.Media {
	var media []models.Media
	s.db.Preload("Genres").
		Where("type != ?", "episode").
		Order("created_at DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getRecentHighRated(limit int) []models.Media {
	var media []models.Media
	cutoff := time.Now().AddDate(0, 0, -90) // Last 90 days
	s.db.Preload("Genres").
		Where("created_at > ? AND type != ?", cutoff, "episode").
		Order("created_at DESC, view_count DESC, rating DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getRecentByGenre(genre string, limit int) []models.Media {
	var media []models.Media
	cutoff := time.Now().AddDate(0, 0, -60) // Last 60 days
	s.db.Preload("Genres").
		Joins("JOIN media_genres ON media.id = media_genres.media_id").
		Joins("JOIN genres ON media_genres.genre_id = genres.id").
		Where("genres.name ILIKE ? AND media.created_at > ? AND media.type != ?", "%"+genre+"%", cutoff, "episode").
		Order("media.created_at DESC, media.rating DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getRecentMoviesOnly(limit int) []models.Media {
	var media []models.Media
	cutoff := time.Now().AddDate(0, 0, -45) // Last 45 days
	s.db.Preload("Genres").
		Where("type = ? AND created_at > ?", "movie", cutoff).
		Order("created_at DESC, rating DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getRecentSeriesOnly(limit int) []models.Media {
	var media []models.Media
	cutoff := time.Now().AddDate(0, 0, -45) // Last 45 days
	s.db.Preload("Genres").
		Where("(type = ? OR type = ?) AND created_at > ?", "series", "tv", cutoff).
		Order("created_at DESC, rating DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getRecentPopular(limit int) []models.Media {
	var media []models.Media
	cutoff := time.Now().AddDate(0, 0, -30) // Last 30 days
	s.db.Preload("Genres").
		Where("created_at > ? AND view_count > ? AND type != ?", cutoff, 5, "episode").
		Order("view_count DESC, created_at DESC").
		Limit(limit).
		Find(&media)
	return media
}

func (s *RecommendationService) getRecentQualityMix(limit int) []models.Media {
	var media []models.Media
	cutoff := time.Now().AddDate(0, 0, -60) // Last 60 days
	qualities := []string{"4K", "1080p", "HD"}
	
	for _, quality := range qualities {
		var qualityMedia []models.Media
		s.db.Preload("Genres").
			Where("quality ILIKE ? AND created_at > ? AND type != ?", "%"+quality+"%", cutoff, "episode").
			Order("created_at DESC, rating DESC").
			Limit(limit / len(qualities)).
			Find(&qualityMedia)
		media = append(media, qualityMedia...)
	}
	
	return s.shuffleMedia(media)
}

func (s *RecommendationService) getRecentDiverseGenres(limit int) []models.Media {
	var media []models.Media
	cutoff := time.Now().AddDate(0, 0, -45) // Last 45 days
	genres := []string{"Action", "Drama", "Comedy", "Sci-Fi", "Thriller", "Horror", "Romance"}
	
	for _, genre := range genres {
		var genreMedia []models.Media
		s.db.Preload("Genres").
			Joins("JOIN media_genres ON media.id = media_genres.media_id").
			Joins("JOIN genres ON media_genres.genre_id = genres.id").
			Where("genres.name ILIKE ? AND media.created_at > ? AND media.type != ?", "%"+genre+"%", cutoff, "episode").
			Order("media.created_at DESC").
			Limit(limit / len(genres)).
			Find(&genreMedia)
		media = append(media, genreMedia...)
	}
	
	return s.shuffleMedia(media)
}

func (s *RecommendationService) getPersonalizedByGenre(userID uint, limit int) []models.Media {
	// Get user's preferred genres from viewing history
	var viewHistory []models.ViewHistory
	s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ?", userID).
		Order("watched_at DESC").
		Limit(20).
		Find(&viewHistory)
	
	genrePrefs := make(map[string]int)
	for _, history := range viewHistory {
		for _, genre := range history.Media.Genres {
			genrePrefs[genre.Name]++
		}
	}
	
	// Get top genres
	var topGenres []string
	for genre := range genrePrefs {
		topGenres = append(topGenres, genre)
		if len(topGenres) >= 3 {
			break
		}
	}
	
	if len(topGenres) == 0 {
		return s.getLatestHighRated(limit)
	}
	
	var media []models.Media
	for _, genre := range topGenres {
		var genreMedia []models.Media
		s.db.Preload("Genres").
			Joins("JOIN media_genres ON media.id = media_genres.media_id").
			Joins("JOIN genres ON media_genres.genre_id = genres.id").
			Where("genres.name ILIKE ? AND media.type != ?", "%"+genre+"%", "episode").
			Where("media.id NOT IN (?)", s.getWatchedMediaIDs(userID)).
			Order("media.rating DESC, media.created_at DESC").
			Limit(limit / len(topGenres)).
			Find(&genreMedia)
		media = append(media, genreMedia...)
	}
	
	return s.shuffleMedia(media)
}

func (s *RecommendationService) getPersonalizedByYear(userID uint, limit int) []models.Media {
	// Get user's preferred years from viewing history
	var viewHistory []models.ViewHistory
	s.db.Preload("Media").
		Where("user_id = ?", userID).
		Order("watched_at DESC").
		Limit(20).
		Find(&viewHistory)
	
	yearPrefs := make(map[int]int)
	for _, history := range viewHistory {
		if history.Media.Year > 0 {
			yearPrefs[history.Media.Year]++
		}
	}
	
	// Default to recent years if no history
	if len(yearPrefs) == 0 {
		return s.getYearBasedContent(2020, 2024, limit)
	}
	
	// Get most preferred year range
	var bestYear int
	maxCount := 0
	for year, count := range yearPrefs {
		if count > maxCount {
			maxCount = count
			bestYear = year
		}
	}
	
	// Get content from preferred year range (±3 years)
	var media []models.Media
	s.db.Preload("Genres").
		Where("year BETWEEN ? AND ? AND type != ?", bestYear-3, bestYear+3, "episode").
		Where("id NOT IN (?)", s.getWatchedMediaIDs(userID)).
		Order("rating DESC, view_count DESC").
		Limit(limit).
		Find(&media)
	
	return media
}

func (s *RecommendationService) getPersonalizedByRating(userID uint, limit int) []models.Media {
	// Get user's rating preferences
	var userRatings []models.UserRating
	s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ?", userID).
		Order("rating DESC").
		Find(&userRatings)
	
	avgRating := 7.0 // Default
	if len(userRatings) > 0 {
		sum := 0.0
		for _, rating := range userRatings {
			sum += float64(rating.Rating)
		}
		avgRating = sum / float64(len(userRatings))
	}
	
	var media []models.Media
	s.db.Preload("Genres").
		Where("rating >= ? AND type != ?", avgRating-0.5, "episode").
		Where("id NOT IN (?)", s.getWatchedMediaIDs(userID)).
		Order("rating DESC, view_count DESC").
		Limit(limit).
		Find(&media)
	
	return media
}

func (s *RecommendationService) getPersonalizedDiscovery(userID uint, limit int) []models.Media {
	// Get genres user hasn't explored much
	watchedGenres := make(map[string]bool)
	var viewHistory []models.ViewHistory
	s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ?", userID).
		Find(&viewHistory)
	
	for _, history := range viewHistory {
		for _, genre := range history.Media.Genres {
			watchedGenres[genre.Name] = true
		}
	}
	
	// Get all available genres
	var allGenres []models.Genre
	s.db.Find(&allGenres)
	
	var unexploredGenres []string
	for _, genre := range allGenres {
		if !watchedGenres[genre.Name] {
			unexploredGenres = append(unexploredGenres, genre.Name)
		}
	}
	
	if len(unexploredGenres) == 0 {
		return s.getLatestHighRated(limit)
	}
	
	// Get content from unexplored genres
	var media []models.Media
	for i, genre := range unexploredGenres {
		if i >= 3 { // Limit to 3 genres
			break
		}
		var genreMedia []models.Media
		s.db.Preload("Genres").
			Joins("JOIN media_genres ON media.id = media_genres.media_id").
			Joins("JOIN genres ON media_genres.genre_id = genres.id").
			Where("genres.name = ? AND media.type != ?", genre, "episode").
			Order("media.created_at DESC, media.rating DESC").
			Limit(limit / 3).
			Find(&genreMedia)
		media = append(media, genreMedia...)
	}
	
	return s.shuffleMedia(media)
}

func (s *RecommendationService) getBalancedPersonalized(userID uint, limit int) []models.Media {
	var allMedia []models.Media
	
	// 40% personalized recommendations
	if personalizedMedia, err := s.GetRecommendationsForUser(userID, limit*40/100); err == nil {
		allMedia = append(allMedia, personalizedMedia...)
	}
	
	// 30% similar media
	if similarMedia, err := s.GetSimilarMedia(userID, limit*30/100); err == nil {
		// Filter duplicates
		existingIDs := make(map[uint]bool)
		for _, item := range allMedia {
			existingIDs[item.ID] = true
		}
		
		for _, item := range similarMedia {
			if !existingIDs[item.ID] && len(allMedia) < limit {
				allMedia = append(allMedia, item)
				existingIDs[item.ID] = true
			}
		}
	}
	
	// 30% trending content
	if trendingMedia, err := s.GetTrendingRecommendations(limit*30/100); err == nil {
		existingIDs := make(map[uint]bool)
		for _, item := range allMedia {
			existingIDs[item.ID] = true
		}
		
		for _, item := range trendingMedia {
			if !existingIDs[item.ID] && len(allMedia) < limit {
				allMedia = append(allMedia, item)
			}
		}
	}
	
	return s.shuffleMedia(allMedia)
}

