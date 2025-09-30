package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/services"
)

// My List Handlers

func AddToMyList(playbackService *services.PlaybackService) gin.HandlerFunc {
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

		if err := playbackService.AddToMyList(userID, uint(mediaID)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Added to My List successfully"})
	}
}

func RemoveFromMyList(playbackService *services.PlaybackService) gin.HandlerFunc {
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

		if err := playbackService.RemoveFromMyList(userID, uint(mediaID)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove from My List"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Removed from My List successfully"})
	}
}

func GetMyList(playbackService *services.PlaybackService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetHeader("X-User-ID")
		if userID == "" {
			userID = "anonymous"
		}

		myList, err := playbackService.GetMyList(userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get My List"})
			return
		}

		c.JSON(http.StatusOK, myList)
	}
}

func CheckMyList(playbackService *services.PlaybackService) gin.HandlerFunc {
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

		inList, err := playbackService.IsInMyList(userID, uint(mediaID))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check My List"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"in_list": inList})
	}
}
