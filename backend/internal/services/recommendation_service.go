package services

import (
	"fmt"
	"sort"
	"time"

	"gorm.io/gorm"
	"homeflix-backend/internal/models"
)

type RecommendationService struct {
	db *gorm.DB
}

func NewRecommendationService(db *gorm.DB) *RecommendationService {
	return &RecommendationService{db: db}
}

// GetDefaultRecommendations returns general recommendations when no user system is available
func (s *RecommendationService) GetDefaultRecommendations(limit int) ([]models.Media, error) {
	var media []models.Media
	
	// Get popular and highly rated media as default recommendations
	err := s.db.Preload("Genres").
		Where("rating > ? OR view_count > ?", 7.0, 10).
		Order("rating DESC, view_count DESC, created_at DESC").
		Limit(limit).
		Find(&media).Error
	
	if err != nil {
		// If that fails, just get recent media
		err = s.db.Preload("Genres").
			Order("created_at DESC").
			Limit(limit).
			Find(&media).Error
	}
	
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

	// Get all media for scoring (exclude already watched)
	var allMedia []models.Media
	watchedIDs := s.getWatchedMediaIDs(userID)
	
	query := s.db.Preload("Genres")
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
	
	// Get media with highest view counts in the last 30 days
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)
	
	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
		Where("last_viewed > ? OR view_count > 0", thirtyDaysAgo).
		Order("view_count DESC, last_viewed DESC").
		Limit(limit).
		Find(&media).Error
	
	return media, err
}

// GetSimilarMedia finds media similar to what user has watched
func (s *RecommendationService) GetSimilarMedia(userID uint, limit int) ([]models.Media, error) {
	// Get user's highly rated media
	var userRatings []models.UserRating
	s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ? AND rating >= 7", userID).
		Order("rating DESC").
		Limit(5).
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

	// Find media with similar genres
	var similarMedia []models.Media
	for genreName := range genreMap {
		var genreMedia []models.Media
		s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
			Joins("JOIN media_genres ON media.id = media_genres.media_id").
			Joins("JOIN genres ON media_genres.genre_id = genres.id").
			Where("genres.name = ?", genreName).
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

	// Recency boost with graduated scoring
	daysSinceAdded := int(now.Sub(media.CreatedAt).Hours() / 24)
	if daysSinceAdded <= 7 {
		score += 3 // New content gets highest boost
	} else if daysSinceAdded <= 30 {
		score += 2 // Recent content gets medium boost
	} else if daysSinceAdded <= 90 {
		score += 1 // Somewhat recent content gets small boost
	}

	// Rating boost with exponential scaling
	if media.Rating > 6 {
		ratingBoost := float32(media.Rating - 6) * float32(media.Rating - 6) * 0.5
		score += ratingBoost
	}

	// Diversity boost - slightly favor less popular content to avoid echo chamber
	if media.ViewCount < 50 && media.Rating > 7 {
		score += 1.5 // Hidden gems boost
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
