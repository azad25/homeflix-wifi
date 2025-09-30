package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/services"
)

// Playback and Analytics Handlers

func TrackView(mediaService *services.MediaService, playbackService *services.PlaybackService) gin.HandlerFunc {
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

		// Add to recently watched
		if err := playbackService.AddToRecentlyWatched(userID, uint(mediaID)); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to track view"})
			return
		}

		// Increment view count
		media, err := mediaService.GetMediaByID(uint(mediaID))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		media.ViewCount++
		if err := mediaService.UpdateMedia(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update view count"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "View tracked successfully"})
	}
}

func UpdatePlaybackProgress(playbackService *services.PlaybackService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			MediaID  uint    `json:"media_id" binding:"required"`
			Position float64 `json:"position" binding:"required"`
			Duration float64 `json:"duration" binding:"required"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		userID := c.GetHeader("X-User-ID")
		if userID == "" {
			userID = "anonymous"
		}

		if err := playbackService.UpdatePlaybackProgress(userID, req.MediaID, req.Position, req.Duration); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update progress"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Progress updated successfully"})
	}
}

func GetPlaybackProgress(playbackService *services.PlaybackService) gin.HandlerFunc {
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

		progress, err := playbackService.GetPlaybackProgress(userID, uint(mediaID))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get progress"})
			return
		}

		c.JSON(http.StatusOK, progress)
	}
}

func GetRecentlyWatched(playbackService *services.PlaybackService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetHeader("X-User-ID")
		if userID == "" {
			userID = "anonymous"
		}

		limit := 20
		if l := c.Query("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil {
				limit = parsed
			}
		}

		// Get recently watched with progress for continue watching functionality
		progress, err := playbackService.GetRecentlyWatchedWithProgress(userID, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get recently watched"})
			return
		}

		// Transform to match frontend expectations
		type RecentlyWatchedResponse struct {
			ID              uint    `json:"id"`
			MediaID         uint    `json:"media_id"`
			UserID          string  `json:"user_id"`
			LastWatchedAt   string  `json:"last_watched_at"`
			ProgressSeconds int     `json:"progress_seconds"`
			DurationSeconds int     `json:"duration_seconds"`
			Media           interface{} `json:"media"`
		}

		var response []RecentlyWatchedResponse
		for _, p := range progress {
			response = append(response, RecentlyWatchedResponse{
				ID:              p.ID,
				MediaID:         p.MediaID,
				UserID:          p.UserID,
				LastWatchedAt:   p.LastWatched.Format("2006-01-02T15:04:05Z07:00"),
				ProgressSeconds: int(p.Position),
				DurationSeconds: int(p.Duration),
				Media:           p.Media,
			})
		}

		c.JSON(http.StatusOK, response)
	}
}

func GetContinueWatching(playbackService *services.PlaybackService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetHeader("X-User-ID")
		if userID == "" {
			userID = "anonymous"
		}

		limit := 10
		if l := c.Query("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil {
				limit = parsed
			}
		}

		progress, err := playbackService.GetContinueWatching(userID, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get continue watching"})
			return
		}

		c.JSON(http.StatusOK, progress)
	}
}

func GetWatchHistory(playbackService *services.PlaybackService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetHeader("X-User-ID")
		if userID == "" {
			userID = "anonymous"
		}

		limit := 50
		if l := c.Query("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil {
				limit = parsed
			}
		}

		history, err := playbackService.GetWatchHistory(userID, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get watch history"})
			return
		}

		c.JSON(http.StatusOK, history)
	}
}

func GetWatchStats(playbackService *services.PlaybackService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetHeader("X-User-ID")
		if userID == "" {
			userID = "anonymous"
		}

		stats, err := playbackService.GetWatchStats(userID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get watch stats"})
			return
		}

		c.JSON(http.StatusOK, stats)
	}
}
