package handlers

import (
	"homeflix-backend/internal/services"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// NeedsTranscoding is now defined in streaming_handlers.go to avoid duplication

func StreamTranscoded(transcodeService *services.TranscodeService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		// Get media info
		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		filePath := media.FilePath
		log.Printf("🎬 Transcoding request for: %s (ID: %d)", media.Title, id)

		// Stream with on-the-fly transcoding/remuxing
		if err := transcodeService.StreamTranscoded(c.Writer, c.Request, filePath); err != nil {
			log.Printf("❌ Transcode error: %v", err)
			// Don't send error response if headers already sent
			if !c.Writer.Written() {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Transcoding failed"})
			}
		}
	}
}

func GetTranscodeStatus(transcodeService *services.TranscodeService) gin.HandlerFunc {
	return func(c *gin.Context) {
		activeStreams := transcodeService.GetActiveStreams()
		c.JSON(http.StatusOK, gin.H{
			"active_streams": activeStreams,
			"status":         "operational",
		})
	}
}
