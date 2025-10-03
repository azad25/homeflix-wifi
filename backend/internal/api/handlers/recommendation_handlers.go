package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"
)

// GetRecommendations returns personalized recommendations for a user
func GetRecommendations(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr := c.DefaultQuery("user_id", "1")
		limitStr := c.DefaultQuery("limit", "20")
		category := c.DefaultQuery("category", "for_you")

		userID, err := strconv.ParseUint(userIDStr, 10, 32)
		if err != nil {
			userID = 1 // Default user ID
		}

		limit, err := strconv.Atoi(limitStr)
		if err != nil {
			limit = 20
		}

		var recommendations []models.Media
		
		switch category {
		case "trending":
			recommendations, err = recommendationService.GetTrendingRecommendations(limit)
		case "top_picks":
			recommendations, err = recommendationService.GetTopPicksForGenre(uint(userID), limit)
		case "continue_watching":
			recommendations, err = recommendationService.GetContinueWatching(uint(userID))
		case "because_you_watched":
			recommendations, err = recommendationService.GetBecauseYouWatched(uint(userID), limit)
		case "new_releases":
			recommendations, err = recommendationService.GetNewReleases(uint(userID), limit)
		default: // "for_you"
			recommendations, err = recommendationService.GetRecommendationsForUser(uint(userID), limit)
		}

		if err != nil {
			// Fallback: Get trending recommendations if specific category fails
			fallbackRecommendations, fallbackErr := recommendationService.GetTrendingRecommendations(limit)
			if fallbackErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get recommendations", "details": err.Error()})
				return
			}
			recommendations = fallbackRecommendations
		}

		// Convert to consistent format
		var items []map[string]interface{}
		for i, m := range recommendations {
			item := map[string]interface{}{
				"id":          m.ID,
				"uuid":        m.UUID,
				"title":       m.Title,
				"description": m.Description,
				"type":        m.Type,
				"rating":      m.Rating,
				"duration":    m.Duration,
				"file_path":   m.FilePath,
				"poster_path": m.PosterPath,
				"banner_path": m.BannerPath,
				"trailer_path": m.TrailerPath,
				"release_date": m.ReleaseDate,
				"genres":      m.Genres,
				"series":      m.Series,
				"view_count":  m.ViewCount,
				"last_viewed": m.LastViewed,
				"created_at":  m.CreatedAt,
				"updated_at":  m.UpdatedAt,
				// Scoring metadata
				"mediaId":    m.ID,
				"_score":     float64(100 - i*2), // Decreasing score
				"_source":    "recommendation_engine",
				"_category":  category,
			}
			items = append(items, item)
		}

		c.JSON(http.StatusOK, gin.H{
			"items":    items,
			"category": category,
			"total":    len(items),
		})
	}
}

func GetTVSeriesRecommendations(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr := c.DefaultQuery("user_id", "1")
		limitStr := c.DefaultQuery("limit", "20")

		userID, err := strconv.ParseUint(userIDStr, 10, 32)
		if err != nil {
			userID = 1 // Default user ID
		}

		limit, err := strconv.Atoi(limitStr)
		if err != nil {
			limit = 20
		}

		recommendations, err := recommendationService.GetTVSeriesRecommendations(uint(userID), limit)
		if err != nil {
			// Fallback: Get trending recommendations if specific category fails
			fallbackRecommendations, fallbackErr := recommendationService.GetTrendingRecommendations(limit)
			if fallbackErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get recommendations", "details": err.Error()})
				return
			}
			recommendations = fallbackRecommendations
		}

		// Convert to consistent format
		var items []map[string]interface{}
		for i, m := range recommendations {
			item := map[string]interface{}{
				"id":          m.ID,
				"uuid":        m.UUID,
				"title":       m.Title,
				"description": m.Description,
				"type":        m.Type,
				"rating":      m.Rating,
				"duration":    m.Duration,
				"file_path":   m.FilePath,
				"poster_path": m.PosterPath,
				"banner_path": m.BannerPath,
				"trailer_path": m.TrailerPath,
				"release_date": m.ReleaseDate,
				"genres":      m.Genres,
				"series":      m.Series,
				"view_count":  m.ViewCount,
				"last_viewed": m.LastViewed,
				"created_at":  m.CreatedAt,
				"updated_at":  m.UpdatedAt,
				// Scoring metadata
				"mediaId":    m.ID,
				"_score":     float64(100 - i*2), // Decreasing score
				"_source":    "tv_series_recommendations",
				"_category":  "tv_series",
			}
			items = append(items, item)
		}

		c.JSON(http.StatusOK, gin.H{
			"items":    items,
			"category": "tv_series",
			"total":    len(items),
		})
	}
}

// GetSimilarMedia returns media similar to a specific item
func GetSimilarMediaHandler(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaIDStr := c.Param("id")
		userID := c.DefaultQuery("user_id", "1")
		limitStr := c.DefaultQuery("limit", "10")

		_, err := strconv.ParseUint(mediaIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		userIDUint, err := strconv.ParseUint(userID, 10, 32)
		if err != nil {
			userIDUint = 1 // Default user ID
		}

		limit, err := strconv.Atoi(limitStr)
		if err != nil {
			limit = 10
		}

		media, err := recommendationService.GetSimilarMedia(uint(userIDUint), limit)
		if err != nil {
			// Fallback: Get trending recommendations
			fallbackMedia, fallbackErr := recommendationService.GetTrendingRecommendations(limit)
			if fallbackErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get similar media", "details": err.Error()})
				return
			}
			media = fallbackMedia
		}

		// Convert to ScoredMedia format
		var scoredMedia []map[string]interface{}
		for i, m := range media {
			scored := map[string]interface{}{
				"id":          m.ID,
				"title":       m.Title,
				"description": m.Description,
				"type":        m.Type,
				"rating":      m.Rating,
				"duration":    m.Duration,
				"file_path":   m.FilePath,
				"poster_path": m.PosterPath,
				"banner_path": m.BannerPath,
				"trailer_path": m.TrailerPath,
				"release_date": m.ReleaseDate,
				"genres":      m.Genres,
				"series":      m.Series,
				"view_count":  m.ViewCount,
				"last_viewed": m.LastViewed,
				"created_at":  m.CreatedAt,
				"updated_at":  m.UpdatedAt,
				// Scoring metadata
				"mediaId":    m.ID,
				"_score":     float64(90 - i*2), // Decreasing score
				"_source":    "similar_content",
				"_category":  "similar",
				"_reasons":   []string{"Similar to your selection"},
			}
			scoredMedia = append(scoredMedia, scored)
		}

		c.JSON(http.StatusOK, gin.H{
			"items":    scoredMedia,
			"category": "similar",
			"total":    len(scoredMedia),
		})
	}
}

// GetContinueWatching returns media user started but didn't finish
func GetContinueWatchingHandler(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.DefaultQuery("user_id", "1")

		userIDUint, err := strconv.ParseUint(userID, 10, 32)
		if err != nil {
			userIDUint = 1 // Default user ID
		}

		media, err := recommendationService.GetContinueWatching(uint(userIDUint))
		if err != nil {
			// Fallback: Get trending recommendations
			fallbackMedia, fallbackErr := recommendationService.GetTrendingRecommendations(10)
			if fallbackErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get continue watching", "details": err.Error()})
				return
			}
			media = fallbackMedia
		}

		// Convert to ScoredMedia format
		var scoredMedia []map[string]interface{}
		for _, m := range media {
			scored := map[string]interface{}{
				"id":          m.ID,
				"title":       m.Title,
				"description": m.Description,
				"type":        m.Type,
				"rating":      m.Rating,
				"duration":    m.Duration,
				"file_path":   m.FilePath,
				"poster_path": m.PosterPath,
				"banner_path": m.BannerPath,
				"trailer_path": m.TrailerPath,
				"release_date": m.ReleaseDate,
				"genres":      m.Genres,
				"series":      m.Series,
				"view_count":  m.ViewCount,
				"last_viewed": m.LastViewed,
				"created_at":  m.CreatedAt,
				"updated_at":  m.UpdatedAt,
				// Scoring metadata
				"mediaId":    m.ID,
				"_score":     100.0, // High score for continue watching
				"_source":    "continue_watching",
				"_category":  "continue_watching",
				"_reasons":   []string{"Continue watching"},
			}
			scoredMedia = append(scoredMedia, scored)
		}

		c.JSON(http.StatusOK, gin.H{
			"items":    scoredMedia,
			"category": "continue_watching",
			"total":    len(scoredMedia),
		})
	}
}

// TrackRecommendationClick tracks when user interacts with recommendations
func TrackRecommendationClickHandler(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var request struct {
			UserID   uint   `json:"user_id"`
			MediaID  uint   `json:"media_id"`
			Category string `json:"category"`
		}

		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
			return
		}

		if request.UserID == 0 {
			request.UserID = 1 // Default user ID
		}

		err := recommendationService.TrackRecommendationClick(request.UserID, request.MediaID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to track click", "details": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}
