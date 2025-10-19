package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
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
		
		// Generate session ID for duplicate prevention
		sessionID := generateSessionID(c)
		
		// Use dynamic trending recommendations with session awareness
		media, err := recommendationService.GetDynamicRecommendations("trending", limit, sessionID)
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
		
		// Generate session ID for duplicate prevention
		sessionID := generateSessionID(c)
		
		// Use dynamic popular recommendations with session awareness
		media, err := recommendationService.GetDynamicRecommendations("popular", limit, sessionID)
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
		
		// Generate session ID for duplicate prevention
		sessionID := generateSessionID(c)
		
		// Use dynamic recent recommendations with session awareness
		media, err := recommendationService.GetDynamicRecommendations("recent", limit, sessionID)
		if err != nil {
			// Fallback to default recommendations
			media, err = recommendationService.GetDefaultRecommendations(limit)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recent recommendations"})
				return
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
		
		// Generate session ID for duplicate prevention
		sessionID := generateSessionID(c)
		
		// Use dynamic recommendations with diverse content across all ratings
		media, err := recommendationService.GetDynamicRecommendations("popular", limit, sessionID)
		if err != nil {
			// Fallback to default recommendations (now diverse, not high-rating biased)
			media, err = recommendationService.GetDefaultRecommendations(limit)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recommendations"})
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
		
		// Generate session ID for duplicate prevention
		sessionID := generateSessionID(c)
		
		// Use dynamic recommendations with session awareness
		media, err := recommendationService.GetDynamicRecommendations("mixed", limit, sessionID)
		if err != nil {
			// Fallback to default recommendations
			media, err = recommendationService.GetDefaultRecommendations(limit)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch mixed recommendations"})
				return
			}
		}
		
		c.JSON(http.StatusOK, media)
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
		
		// Generate session ID for duplicate prevention
		sessionID := generateSessionID(c)
		
		// Use dynamic personalized recommendations with session awareness
		media, err := recommendationService.GetDynamicRecommendations("personalized", limit, sessionID)
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

// GetRecommendations is the main recommendation handler that routes to dynamic recommendations
func GetRecommendations(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		category := c.Query("category")
		if category == "" {
			category = "mixed" // Default to mixed recommendations
		}

		limit := 20
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}

		// Generate session ID for duplicate prevention
		sessionID := generateSessionID(c)

		// Use dynamic recommendations with session awareness
		media, err := recommendationService.GetDynamicRecommendations(category, limit, sessionID)
		if err != nil {
			// Fallback to default recommendations
			media, err = recommendationService.GetDefaultRecommendations(limit)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch recommendations"})
				return
			}
		}

		c.JSON(http.StatusOK, media)
	}
}

// generateSessionID creates a unique session ID for tracking shown content
func generateSessionID(c *gin.Context) string {
	// Use IP address + User-Agent + current hour for session identification
	// This creates sessions that last about an hour and are unique per client
	clientIP := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")
	currentHour := time.Now().Format("2006010215") // YYYYMMDDHH

	// Create a simple hash-like session ID
	sessionID := fmt.Sprintf("%s_%s_%s", clientIP, userAgent, currentHour)

	// Truncate to reasonable length and make it URL-safe
	if len(sessionID) > 50 {
		sessionID = sessionID[:50]
	}

	return sessionID
}