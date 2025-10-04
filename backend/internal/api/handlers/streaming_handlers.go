package handlers

import (
	"net/http"
	"os"
	"strconv"

	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// Streaming Handlers

func StreamMedia(streamService *services.OptimizedStreamService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaID := c.Param("id")
		
		// Parse media ID
		id, err := strconv.ParseUint(mediaID, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}
		
		// Get media information from database
		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}
		
		// Use the file path from the media record
		filePath := media.FilePath
		if filePath == "" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media file path not available"})
			return
		}
		
		// Check if file exists
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media file not found on disk"})
			return
		}
		
		// Set additional headers for better streaming performance
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "SAMEORIGIN")
		c.Header("Vary", "Accept-Encoding")
		
		// Use the optimized streaming service
		err = streamService.StreamVideo(c.Writer, c.Request, filePath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Streaming failed: " + err.Error()})
			return
		}
	}
}

func GetSubtitles(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		subtitles, err := mediaService.GetSubtitles(uint(id))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		
		c.JSON(http.StatusOK, subtitles)
	}
}
