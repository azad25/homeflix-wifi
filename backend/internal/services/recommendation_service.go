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

// RecommendationScore represents a media item with its recommendation score
type RecommendationScore struct {
	Media  models.Media
	Score  float32
	Reason string
}

// GetRecommendationsForUser generates personalized recommendations
func (s *RecommendationService) GetRecommendationsForUser(userID uint, limit int) ([]models.Media, error) {
	var recommendations []RecommendationScore

	// Get user's viewing history and ratings
	var viewHistory []models.ViewHistory
	s.db.Preload("Media").Preload("Media.Genres").Where("user_id = ?", userID).Find(&viewHistory)

	var userRatings []models.UserRating
	s.db.Preload("Media").Preload("Media.Genres").Where("user_id = ?", userID).Find(&userRatings)

	// Get all media for scoring
	var allMedia []models.Media
	s.db.Preload("Genres").Find(&allMedia)

	// Calculate recommendation scores
	for _, media := range allMedia {
		// Skip if user already watched
		if s.hasUserWatched(userID, media.ID, viewHistory) {
			continue
		}

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

		// Save recommendation to database
		s.saveRecommendation(userID, rec.Media.ID, rec.Score, rec.Reason, "personalized")
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
		score += (media.Rating - 7) * 2
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
