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
		
		// Netflix-style quality and format handling
		quality := c.Query("quality")
		format := c.Query("format")
		
		// Set Netflix-style streaming headers
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "SAMEORIGIN")
		c.Header("Vary", "Accept-Encoding, Range")
		c.Header("X-Robots-Tag", "noindex")
		
		// Quality-specific headers
		if quality == "high" {
			c.Header("X-Video-Quality", "1080p")
			c.Header("X-Video-Bitrate", "high")
		} else if quality == "medium" {
			c.Header("X-Video-Quality", "720p")
			c.Header("X-Video-Bitrate", "medium")
		} else if quality == "low" {
			c.Header("X-Video-Quality", "480p")
			c.Header("X-Video-Bitrate", "low")
		}
		
		// Format-specific content type override
		if format == "webm" {
			c.Header("Content-Type", "video/webm")
		} else if format == "mov" {
			c.Header("Content-Type", "video/quicktime")
		}
		
		// Enhanced CORS for video streaming
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Range, Content-Type, Accept, Authorization")
		c.Header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges")
		
		// Handle preflight requests
		if c.Request.Method == "OPTIONS" {
			c.Status(http.StatusOK)
			return
		}
		
		// Use the optimized streaming service with error recovery
		err = streamService.StreamVideo(c.Writer, c.Request, filePath)
		if err != nil {
			// Don't send JSON error if headers already sent (streaming started)
			if !c.Writer.Written() {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Streaming failed: " + err.Error()})
			}
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

// StreamPreviewClip serves preview clips for hero backgrounds and hover previews
func StreamPreviewClip(streamService *services.OptimizedStreamService, mediaService *services.MediaService) gin.HandlerFunc {
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
		
		// Try to find preview clip path
		var filePath string
		if media.PreviewClipPath != "" {
			filePath = media.PreviewClipPath
		} else if media.PreviewPath != "" {
			filePath = media.PreviewPath
		} else {
			// Fallback: try to generate preview clip path from main file
			// This would typically be handled by a background service
			c.JSON(http.StatusNotFound, gin.H{"error": "Preview clip not available"})
			return
		}
		
		// Check if file exists
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Preview clip file not found"})
			return
		}
		
		// Set headers optimized for preview clips (shorter, smaller files)
		c.Header("Content-Type", "video/mp4")
		c.Header("Cache-Control", "public, max-age=86400") // 24 hours cache for previews
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Headers", "Range, Content-Type, Accept")
		c.Header("X-Content-Type-Options", "nosniff")
		
		// Handle quality parameter for preview clips
		quality := c.Query("quality")
		if quality == "low" {
			c.Header("X-Video-Quality", "360p")
		} else {
			c.Header("X-Video-Quality", "720p")
		}
		
		// Handle format parameter
		format := c.Query("format")
		if format == "webm" {
			c.Header("Content-Type", "video/webm")
		}
		
		// Handle preflight requests
		if c.Request.Method == "OPTIONS" {
			c.Status(http.StatusOK)
			return
		}
		
		// Stream the preview clip
		err = streamService.StreamVideo(c.Writer, c.Request, filePath)
		if err != nil {
			if !c.Writer.Written() {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Preview streaming failed: " + err.Error()})
			}
			return
		}
	}
}