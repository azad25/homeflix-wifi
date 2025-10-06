package handlers

import (
	"net/http"
	"os"
	"strconv"
	"strings"

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
		
		// Netflix-level quality and format handling
		quality := c.Query("quality")
		format := c.Query("format")
		
		// Set Netflix-level streaming headers
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "SAMEORIGIN")
		c.Header("Vary", "Accept-Encoding, Range, User-Agent")
		c.Header("X-Robots-Tag", "noindex")
		c.Header("X-Stream-Engine", "homeflix-ultra")
		
		// Advanced quality-specific headers
		switch quality {
		case "4k", "ultra":
			c.Header("X-Video-Quality", "4k")
			c.Header("X-Video-Bitrate", "ultra-high")
			c.Header("X-Hardware-Decode", "required")
		case "high", "1080p":
			c.Header("X-Video-Quality", "1080p")
			c.Header("X-Video-Bitrate", "high")
			c.Header("X-Hardware-Decode", "recommended")
		case "medium", "720p":
			c.Header("X-Video-Quality", "720p")
			c.Header("X-Video-Bitrate", "medium")
			c.Header("X-Hardware-Decode", "optional")
		case "low", "480p":
			c.Header("X-Video-Quality", "480p")
			c.Header("X-Video-Bitrate", "low")
			c.Header("X-Hardware-Decode", "software")
		default:
			// Auto-detect based on user agent
			userAgent := c.GetHeader("User-Agent")
			if strings.Contains(strings.ToLower(userAgent), "mobile") {
				c.Header("X-Video-Quality", "720p")
				c.Header("X-Video-Bitrate", "medium")
			} else {
				c.Header("X-Video-Quality", "1080p")
				c.Header("X-Video-Bitrate", "high")
			}
		}
		
		// Format-specific content type override with codec hints
		switch format {
		case "webm":
			c.Header("Content-Type", "video/webm; codecs=\"vp9, opus\"")
		case "mov":
			c.Header("Content-Type", "video/quicktime; codecs=\"avc1.42E01E, mp4a.40.2\"")
		case "mp4":
			c.Header("Content-Type", "video/mp4; codecs=\"avc1.42E01E, mp4a.40.2\"")
		}
		
		// Ultra-enhanced CORS for cross-device streaming
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Range, Content-Type, Accept, Authorization, X-Requested-With, X-Device-Type, X-Network-Speed")
		c.Header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges, X-Video-Quality, X-Stream-Health, X-Buffer-Status")
		c.Header("Access-Control-Max-Age", "86400")
		
		// Performance optimization headers
		c.Header("X-Stream-Optimization", "netflix-level")
		c.Header("X-Buffer-Strategy", "aggressive-preload")
		c.Header("X-Latency-Mode", "ultra-low")
		
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
		
		// Set headers optimized for ultra-fast preview clips
		c.Header("Content-Type", "video/mp4; codecs=\"avc1.42E01E, mp4a.40.2\"")
		c.Header("Cache-Control", "public, max-age=86400, stale-while-revalidate=3600") // Aggressive caching
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Headers", "Range, Content-Type, Accept, X-Preview-Quality")
		c.Header("Access-Control-Expose-Headers", "Content-Length, Content-Range, X-Preview-Duration")
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Preview-Clip", "true")
		c.Header("X-Stream-Priority", "high") // High priority for instant loading
		
		// Ultra-optimized quality handling for preview clips
		quality := c.Query("quality")
		switch quality {
		case "high":
			c.Header("X-Video-Quality", "720p")
			c.Header("X-Preview-Bitrate", "2000k")
		case "medium":
			c.Header("X-Video-Quality", "480p")
			c.Header("X-Preview-Bitrate", "1000k")
		case "low":
			c.Header("X-Video-Quality", "360p")
			c.Header("X-Preview-Bitrate", "500k")
		default:
			// Auto-detect optimal quality for previews
			userAgent := c.GetHeader("User-Agent")
			if strings.Contains(strings.ToLower(userAgent), "mobile") {
				c.Header("X-Video-Quality", "480p")
				c.Header("X-Preview-Bitrate", "800k")
			} else {
				c.Header("X-Video-Quality", "720p")
				c.Header("X-Preview-Bitrate", "1500k")
			}
		}
		
		// Format optimization for preview clips
		format := c.Query("format")
		switch format {
		case "webm":
			c.Header("Content-Type", "video/webm; codecs=\"vp9, opus\"")
			c.Header("X-Preview-Format", "webm")
		case "mp4":
			c.Header("Content-Type", "video/mp4; codecs=\"avc1.42E01E, mp4a.40.2\"")
			c.Header("X-Preview-Format", "mp4")
		default:
			c.Header("X-Preview-Format", "auto")
		}
		
		// Preview-specific performance headers
		c.Header("X-Preview-Optimization", "instant-load")
		c.Header("X-Buffer-Strategy", "preview-optimized")
		c.Header("X-Preload-Hint", "aggressive")
		
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