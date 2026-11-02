package handlers

import (
	"errors"
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
		c.Header("Cache-Control", "private, max-age=15")
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

// GetTasteRating returns the user's thumbs rating of a movie or series:
// {"kind":"movie","id":12,"rating":1}; rating 0 = not rated.
func GetTasteRating(taste *services.TasteService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		c.Header("Cache-Control", "no-store")
		c.JSON(http.StatusOK, gin.H{"kind": c.Param("kind"), "id": id, "rating": taste.Rating(tasteUserID(c), c.Param("kind"), uint(id))})
	}
}

// PutTasteRating rates a movie or series: body {"rating": -1|0|1|2}
// (not for me, clear, like, love). Ratings steer /recommendations/for-you.
func PutTasteRating(taste *services.TasteService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		var body struct {
			Rating *int `json:"rating"`
		}
		if err := c.ShouldBindJSON(&body); err != nil || body.Rating == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": `body must be {"rating": -1|0|1|2}`})
			return
		}
		if err := taste.SetRating(tasteUserID(c), c.Param("kind"), uint(id), *body.Rating); err != nil {
			status := http.StatusBadRequest
			if errors.Is(err, services.ErrRatingTarget) {
				status = http.StatusNotFound
			}
			c.JSON(status, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"kind": c.Param("kind"), "id": id, "rating": *body.Rating})
	}
}

// DeleteTasteRating clears a rating.
func DeleteTasteRating(taste *services.TasteService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
			return
		}
		if err := taste.SetRating(tasteUserID(c), c.Param("kind"), uint(id), 0); err != nil && !errors.Is(err, services.ErrRatingTarget) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"kind": c.Param("kind"), "id": id, "rating": 0})
	}
}

// ListTasteRatings returns all of the user's ratings, newest first.
func ListTasteRatings(taste *services.TasteService) gin.HandlerFunc {
	return func(c *gin.Context) {
		list, err := taste.Ratings(tasteUserID(c))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Header("Cache-Control", "no-store")
		c.JSON(http.StatusOK, gin.H{"ratings": list})
	}
}
