package handlers

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// Streaming Handlers

// NeedsTranscoding checks if a file needs transcoding based on extension and codec
func NeedsTranscoding(filePath string) bool {
	lowerPath := strings.ToLower(filePath)
	// Check for MKV container or HEVC/x265 codec indicators
	return strings.HasSuffix(lowerPath, ".mkv") ||
		strings.Contains(lowerPath, "x265") ||
		strings.Contains(lowerPath, "hevc") ||
		strings.Contains(lowerPath, "h265") ||
		strings.Contains(lowerPath, "vp9") ||
		strings.Contains(lowerPath, "av1")
}

func StreamMedia(streamService *services.OptimizedStreamService, mediaService *services.MediaService, transcodeService *services.TranscodeService) gin.HandlerFunc {
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
		
		// Handle preflight requests first
		if c.Request.Method == "OPTIONS" {
			c.Header("Access-Control-Allow-Origin", "*")
			c.Header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Range, Content-Type, Accept, Authorization, X-Requested-With")
			c.Header("Access-Control-Max-Age", "86400")
			c.Status(http.StatusOK)
			return
		}
		
		// Set essential CORS headers
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Range, Content-Type, Accept, Authorization, X-Requested-With")
		c.Header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges")
		
		// Check if file needs transcoding (MKV, HEVC, etc.)
		if transcodeService != nil && NeedsTranscoding(filePath) {
			log.Printf("🎬 File needs transcoding: %s (MKV/HEVC detected)", filePath)
			// Use transcoding service for unsupported formats
			err = transcodeService.StreamTranscoded(c.Writer, c.Request, filePath)
			if err != nil {
				log.Printf("❌ Transcoding failed for %s: %v", filePath, err)
				if !c.Writer.Written() {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Video format not supported by browser. Transcoding failed: " + err.Error()})
				}
				return
			}
			log.Printf("✅ Successfully transcoded: %s", filePath)
		} else {
			log.Printf("📹 Direct streaming: %s (browser-compatible format)", filePath)
			// Use direct streaming for supported formats
			err = streamService.StreamVideo(c.Writer, c.Request, filePath)
			if err != nil {
				log.Printf("❌ Direct streaming failed for %s: %v", filePath, err)
				// If direct streaming fails and we have transcoding available, try transcoding as fallback
				if transcodeService != nil && !c.Writer.Written() {
					log.Printf("🔄 Attempting transcoding fallback for: %s", filePath)
					err = transcodeService.StreamTranscoded(c.Writer, c.Request, filePath)
					if err != nil {
						log.Printf("❌ Transcoding fallback also failed: %v", err)
						if !c.Writer.Written() {
							c.JSON(http.StatusInternalServerError, gin.H{"error": "Video playback failed. Both direct streaming and transcoding failed: " + err.Error()})
						}
					} else {
						log.Printf("✅ Transcoding fallback succeeded for: %s", filePath)
					}
				} else if !c.Writer.Written() {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Streaming failed: " + err.Error()})
				}
				return
			}
			log.Printf("✅ Direct streaming successful: %s", filePath)
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
			c.JSON(http.StatusNotFound, gin.H{"error": "Preview clip not available"})
			return
		}
		
		// Check if file exists
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Preview clip file not found"})
			return
		}
		
		// Handle preflight requests first
		if c.Request.Method == "OPTIONS" {
			c.Header("Access-Control-Allow-Origin", "*")
			c.Header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Range, Content-Type, Accept, Authorization, X-Requested-With")
			c.Header("Access-Control-Max-Age", "86400")
			c.Status(http.StatusOK)
			return
		}
		
		// Set essential CORS headers
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Range, Content-Type, Accept, Authorization, X-Requested-With")
		c.Header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges")
		
		// Set caching for preview clips
		c.Header("Cache-Control", "public, max-age=3600")
		
		// Stream the preview clip
		err = streamService.StreamPreviewClip(c.Writer, c.Request, filePath)
		if err != nil {
			if !c.Writer.Written() {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Preview streaming failed: " + err.Error()})
			}
			return
		}
	}
}

// StreamALACAudio streams ALAC audio files for a media item
func StreamALACAudio(streamService *services.OptimizedStreamService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaID := c.Param("id")
		
		// Parse media ID
		id, err := strconv.ParseUint(mediaID, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}
		
		// Verify media exists in database
		_, err = mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}
		
		// Get ALAC audio path (this would need ALAC service integration)
		// For now, we'll construct the expected path
		alacPaths := []string{
			fmt.Sprintf("./alac_audio/alac_%d.m4a", id),
			fmt.Sprintf("./alac_audio/hq_audio_%d.m4a", id),
			fmt.Sprintf("./audio/alac_%d.m4a", id),
			fmt.Sprintf("./audio/hq_audio_%d.m4a", id),
		}
		
		var alacPath string
		for _, path := range alacPaths {
			if _, err := os.Stat(path); err == nil {
				alacPath = path
				break
			}
		}
		
		if alacPath == "" {
			c.JSON(http.StatusNotFound, gin.H{"error": "ALAC audio not found"})
			return
		}
		
		// Handle preflight requests
		if c.Request.Method == "OPTIONS" {
			c.Header("Access-Control-Allow-Origin", "*")
			c.Header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Range, Content-Type, Accept, Authorization, X-Requested-With")
			c.Header("Access-Control-Max-Age", "86400")
			c.Status(http.StatusOK)
			return
		}
		
		// Set CORS headers
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Range, Content-Type, Accept, Authorization, X-Requested-With")
		c.Header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges, X-Audio-Codec, X-Audio-Quality")
		
		// Stream ALAC audio
		err = streamService.StreamALACAudio(c.Writer, c.Request, int(id))
		if err != nil {
			if !c.Writer.Written() {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "ALAC audio streaming failed: " + err.Error()})
			}
			return
		}
	}
}

// StreamCombinedVideoALAC streams video with ALAC audio in a combined stream
func StreamCombinedVideoALAC(streamService *services.OptimizedStreamService, mediaService *services.MediaService) gin.HandlerFunc {
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
		
		// Handle preflight requests
		if c.Request.Method == "OPTIONS" {
			c.Header("Access-Control-Allow-Origin", "*")
			c.Header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Range, Content-Type, Accept, Authorization, X-Requested-With")
			c.Header("Access-Control-Max-Age", "86400")
			c.Status(http.StatusOK)
			return
		}
		
		// Set CORS headers
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Range, Content-Type, Accept, Authorization, X-Requested-With")
		c.Header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges, X-ALAC-Audio-Available, X-Audio-Enhanced")
		
		// Stream video (combined streaming not implemented yet)
		err = streamService.StreamVideo(c.Writer, c.Request, filePath)
		if err != nil {
			if !c.Writer.Written() {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Combined streaming failed: " + err.Error()})
			}
			return
		}
	}
}