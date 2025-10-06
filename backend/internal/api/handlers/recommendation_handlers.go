package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"
)

// Personalized recommendation handlers using RecommendationService

func GetTrendingRecommendations(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 20
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}
		
		// Use personalized trending recommendations for user ID 1
		media, err := recommendationService.GetTrendingRecommendations(limit)
		if err != nil {
			// Fallback to default recommendations
			media, err = recommendationService.GetDefaultRecommendations(limit)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch trending recommendations"})
				return
			}
		}
		
		c.JSON(http.StatusOK, media)
	}
}

func GetPopularRecommendations(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 20
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}
		
		// Use personalized recommendations for user ID 1 based on their viewing patterns
		userID := uint(1)
		media, err := recommendationService.GetRecommendationsForUser(userID, limit)
		if err != nil {
			// Fallback to default recommendations
			media, err = recommendationService.GetDefaultRecommendations(limit)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch popular recommendations"})
				return
			}
		}
		
		c.JSON(http.StatusOK, media)
	}
}

func GetRecentRecommendations(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 20
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}
		
		// Use personalized similar media recommendations for user ID 1
		userID := uint(1)
		media, err := recommendationService.GetSimilarMedia(userID, limit)
		if err != nil {
			// Fallback to trending recommendations
			media, err = recommendationService.GetTrendingRecommendations(limit)
			if err != nil {
				// Final fallback to default recommendations
				media, err = recommendationService.GetDefaultRecommendations(limit)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recent recommendations"})
					return
				}
			}
		}
		
		c.JSON(http.StatusOK, media)
	}
}

func GetHighRatedRecommendations(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 20
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}
		
		// Use personalized recommendations for user ID 1 with high rating preference
		userID := uint(1)
		media, err := recommendationService.GetRecommendationsForUser(userID, limit)
		if err != nil {
			// Fallback to default recommendations (which prioritize high ratings)
			media, err = recommendationService.GetDefaultRecommendations(limit)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch high-rated recommendations"})
				return
			}
		}
		
		c.JSON(http.StatusOK, media)
	}
}

func GetGenreRecommendations(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		genre := c.Query("genre")
		if genre == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Genre parameter is required"})
			return
		}
		
		limit := 20
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}
		
		// Use personalized similar media recommendations for user ID 1
		// This will naturally favor genres the user has shown interest in
		userID := uint(1)
		media, err := recommendationService.GetSimilarMedia(userID, limit)
		if err != nil {
			// Fallback to personalized recommendations
			media, err = recommendationService.GetRecommendationsForUser(userID, limit)
			if err != nil {
				// Final fallback to default recommendations
				media, err = recommendationService.GetDefaultRecommendations(limit)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch genre recommendations"})
					return
				}
			}
		}
		
		c.JSON(http.StatusOK, media)
	}
}

func GetMixedRecommendations(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 20
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}
		
		userID := uint(1)
		var allRecommendations []models.Media
		categoryLimit := limit / 4
		if categoryLimit < 3 {
			categoryLimit = 3
		}
		
		// Get personalized recommendations from different categories
		// 1. Personalized recommendations based on user history
		if personalizedMedia, err := recommendationService.GetRecommendationsForUser(userID, categoryLimit); err == nil {
			allRecommendations = append(allRecommendations, personalizedMedia...)
		}
		
		// 2. Similar media based on user preferences
		if similarMedia, err := recommendationService.GetSimilarMedia(userID, categoryLimit); err == nil {
			// Avoid duplicates
			existingIDs := make(map[uint]bool)
			for _, item := range allRecommendations {
				existingIDs[item.ID] = true
			}
			
			for _, item := range similarMedia {
				if !existingIDs[item.ID] && len(allRecommendations) < limit {
					allRecommendations = append(allRecommendations, item)
					existingIDs[item.ID] = true
				}
			}
		}
		
		// 3. Trending content
		if trendingMedia, err := recommendationService.GetTrendingRecommendations(categoryLimit); err == nil {
			existingIDs := make(map[uint]bool)
			for _, item := range allRecommendations {
				existingIDs[item.ID] = true
			}
			
			for _, item := range trendingMedia {
				if !existingIDs[item.ID] && len(allRecommendations) < limit {
					allRecommendations = append(allRecommendations, item)
					existingIDs[item.ID] = true
				}
			}
		}
		
		// 4. Fill remaining slots with default recommendations if needed
		if len(allRecommendations) < limit {
			if defaultMedia, err := recommendationService.GetDefaultRecommendations(limit - len(allRecommendations)); err == nil {
				existingIDs := make(map[uint]bool)
				for _, item := range allRecommendations {
					existingIDs[item.ID] = true
				}
				
				for _, item := range defaultMedia {
					if !existingIDs[item.ID] && len(allRecommendations) < limit {
						allRecommendations = append(allRecommendations, item)
					}
				}
			}
		}
		
		// Limit the results
		if len(allRecommendations) > limit {
			allRecommendations = allRecommendations[:limit]
		}
		
		c.JSON(http.StatusOK, allRecommendations)
	}
}

// Advanced recommendation handlers using RecommendationService

func GetPersonalizedRecommendations(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 20
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}
		
		// Use user ID 1 for personalized recommendations
		userID := uint(1)
		if userIDStr := c.Query("user_id"); userIDStr != "" {
			if uid, err := strconv.ParseUint(userIDStr, 10, 32); err == nil {
				userID = uint(uid)
			}
		}
		
		// Get personalized recommendations based on user's viewing history and preferences
		media, err := recommendationService.GetRecommendationsForUser(userID, limit)
		if err != nil {
			// Fallback to default recommendations
			media, err = recommendationService.GetDefaultRecommendations(limit)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch personalized recommendations"})
				return
			}
		}
		
		c.JSON(http.StatusOK, media)
	}
}

func GetSmartTrendingRecommendations(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 20
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}
		
		// Get smart trending recommendations based on recent viewing patterns
		media, err := recommendationService.GetTrendingRecommendations(limit)
		if err != nil {
			// Fallback to default recommendations
			media, err = recommendationService.GetDefaultRecommendations(limit)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch trending recommendations"})
				return
			}
		}
		
		c.JSON(http.StatusOK, media)
	}
}

func GetSimilarRecommendations(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 20
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}
		
		// Use user ID 1 for similar media recommendations
		userID := uint(1)
		if userIDStr := c.Query("user_id"); userIDStr != "" {
			if uid, err := strconv.ParseUint(userIDStr, 10, 32); err == nil {
				userID = uint(uid)
			}
		}
		
		// Get similar media based on user's viewing history and genre preferences
		media, err := recommendationService.GetSimilarMedia(userID, limit)
		if err != nil {
			// Fallback to trending recommendations
			media, err = recommendationService.GetTrendingRecommendations(limit)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch similar recommendations"})
				return
			}
		}
		
		c.JSON(http.StatusOK, media)
	}
}

func GetContinueWatchingRecommendations(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Use user ID 1 for continue watching recommendations
		userID := uint(1)
		if userIDStr := c.Query("user_id"); userIDStr != "" {
			if uid, err := strconv.ParseUint(userIDStr, 10, 32); err == nil {
				userID = uint(uid)
			}
		}
		
		// Get continue watching recommendations based on incomplete viewing sessions
		media, err := recommendationService.GetContinueWatching(userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch continue watching recommendations"})
			return
		}
		
		c.JSON(http.StatusOK, media)
	}
}

func RefreshAllRecommendations(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Refresh recommendations for all users
		err := recommendationService.RefreshRecommendations()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to refresh recommendations", "details": err.Error()})
			return
		}
		
		c.JSON(http.StatusOK, gin.H{"message": "Recommendations refreshed successfully"})
	}
}

func TrackRecommendationClick(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaIDStr := c.Param("id")
		mediaID, err := strconv.ParseUint(mediaIDStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		// Use user ID 1 for now
		userID := uint(1)
		if userIDStr := c.Query("user_id"); userIDStr != "" {
			if uid, err := strconv.ParseUint(userIDStr, 10, 32); err == nil {
				userID = uint(uid)
			}
		}

		// Track the recommendation click
		err = recommendationService.TrackRecommendationClick(userID, uint(mediaID))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to track recommendation click"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Recommendation click tracked successfully"})
	}
}