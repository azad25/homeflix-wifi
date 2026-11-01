package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"homeflix-backend/internal/services"
)

func tasteUserID(c *gin.Context) string {
	if id := c.GetHeader("X-User-ID"); id != "" {
		return id
	}
	if id := c.Query("user_id"); id != "" {
		return id
	}
	return "1" // the web and TV apps use user "1" by default
}

// GetForYouRecommendations returns personalised rows (Top Picks, Because You
// Watched, More with <actor>, Continue <collection>, ...) learned from watch
// history, or quality/recency rows when there's no history yet.
func GetForYouRecommendations(taste *services.TasteService) gin.HandlerFunc {
	return func(c *gin.Context) {
		perRow, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
		res, err := taste.Recommend(tasteUserID(c), perRow)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Header("Cache-Control", "private, max-age=60")
		c.JSON(http.StatusOK, res)
	}
}

// GetMoreLikeThis returns titles similar to a movie or series.
func GetMoreLikeThis(taste *services.TasteService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "15"))
		items, err := taste.Similar(c.Param("kind"), uint(id), limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Header("Cache-Control", "private, max-age=300")
		c.JSON(http.StatusOK, gin.H{"items": items})
	}
}
