package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/services"
)

// GetRecommendationScoreForMedia returns a personalized recommendation score for a specific media item
func GetRecommendationScoreForMedia(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaID, err := strconv.Atoi(c.Param("id"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		userID := c.GetHeader("X-User-ID")
		if userID == "" {
			userID = "anonymous"
		}

		score, reason, err := recommendationService.GetScoreForMedia(userID, uint(mediaID))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to calculate recommendation score",
				"score": 75, // Fallback score
				"reason": "Recommended for you",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"score":    score,
			"reason":   reason,
			"media_id": mediaID,
		})
	}
}
