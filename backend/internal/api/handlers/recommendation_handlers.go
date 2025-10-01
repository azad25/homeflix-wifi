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
		userID := c.Query("user_id")
		category := c.Query("category")
		limitStr := c.DefaultQuery("limit", "20")

		limit, err := strconv.Atoi(limitStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid limit parameter"})
			return
		}

		var userIDUint uint = 1 // Default user ID
		if userID != "" {
			if id, err := strconv.ParseUint(userID, 10, 32); err == nil {
				userIDUint = uint(id)
			}
		}

		var media []models.Media
		var responseCategory string

		switch category {
		case "continue_watching":
			media, err = recommendationService.GetContinueWatching(userIDUint)
			responseCategory = "continue_watching"
		case "trending":
			media, err = recommendationService.GetTrendingRecommendations(limit)
			responseCategory = "trending"
		case "similar":
			media, err = recommendationService.GetSimilarMedia(userIDUint, limit)
			responseCategory = "similar"
		default:
			media, err = recommendationService.GetRecommendationsForUser(userIDUint, limit)
			responseCategory = "for_you"
		}

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get recommendations", "details": err.Error()})
			return
		}

		// Convert to ScoredMedia format for frontend compatibility
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
				"_score":     float64(100 - i), // Simple scoring based on order
				"_source":    "backend_api",
				"_category":  responseCategory,
				"_reasons":   []string{"Recommended for you"},
			}
			scoredMedia = append(scoredMedia, scored)
		}

		c.JSON(http.StatusOK, gin.H{
			"items":    scoredMedia,
			"category": responseCategory,
			"total":    len(scoredMedia),
		})
	}
}

// GetSimilarMedia returns media similar to a specific item
func GetSimilarMediaHandler(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaIDStr := c.Param("id")
		userID := c.DefaultQuery("user_id", "1")
		limitStr := c.DefaultQuery("limit", "10")

		mediaID, err := strconv.ParseUint(mediaIDStr, 10, 32)
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
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get similar media", "details": err.Error()})
			return
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
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get continue watching", "details": err.Error()})
			return
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
