package handlers

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// Streaming Handlers

// NeedsTranscoding checks if a file needs transcoding based on extension and codec
// NOTE: This function is now deprecated. The NetflixStreamService automatically
// determines the best streaming strategy based on seekability and audio compatibility.
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

func StreamMedia(streamService *services.NetflixStreamService, mediaService *services.MediaService, transcodeService *services.TranscodeService, profileService *services.StreamProfileService) gin.HandlerFunc {
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
		c.Header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges, X-Streaming-Strategy")

		// FAST PATH: decide from the stored stream profile - zero ffprobe,
		// zero User-Agent guessing, first byte in milliseconds
		if profileService != nil && c.Query("force_transcode") != "true" {
			if err := profileService.EnsureProfile(media); err == nil {
				decision := services.Decide(media, resolveClientProfile(c))
				if decision.Strategy == "direct" {
					c.Header("X-Streaming-Strategy", "direct")
					if err := streamService.StreamDirect(c.Writer, c.Request, filePath); err != nil {
						log.Printf("❌ Direct streaming failed for %s: %v", filepath.Base(filePath), err)
					}
					return
				}
				// Incompatible file hit the legacy byte-range URL. New clients
				// use /stream/:id/info and get HLS; keep the legacy transcode
				// path below so old clients still get something playable.
				log.Printf("ℹ️ %s not direct-playable (%s) - legacy client fallback", filepath.Base(filePath), decision.Reason)
			} else {
				log.Printf("⚠️ Stream profile probe failed for %s: %v", filepath.Base(filePath), err)
			}
		}

		// LEGACY PATH: per-request analysis + inline audio transcoding
		err = streamService.Stream(c.Writer, c.Request, filePath)
		if err != nil {
			log.Printf("❌ Legacy streaming failed for %s: %v", filePath, err)
			if !c.Writer.Written() {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": "Video streaming failed: " + err.Error(),
					"note":  "This file may be corrupted or in an unsupported format",
				})
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

func ServeSubtitleFile(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			log.Printf("❌ Invalid media ID: %s", c.Param("id"))
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		// Get language parameter
		language := c.Query("lang")
		if language == "" {
			language = "English" // Default to English
		}

		log.Printf("📝 Serving subtitle for media ID %d, language: %s", id, language)

		// Get subtitles for this media
		subtitles, err := mediaService.GetSubtitles(uint(id))
		if err != nil {
			log.Printf("❌ Failed to get subtitles for media ID %d: %v", id, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		log.Printf("📊 Found %d subtitle(s) for media ID %d", len(subtitles), id)

		// Find subtitle file for requested language
		var subtitleFile *models.Subtitle
		for _, sub := range subtitles {
			log.Printf("   📝 Available subtitle: %s (%s)", sub.Language, sub.FilePath)
			if strings.EqualFold(sub.Language, language) {
				subtitleFile = &sub
				break
			}
		}

		// If no exact match, try to find any subtitle file
		if subtitleFile == nil && len(subtitles) > 0 {
			subtitleFile = &subtitles[0] // Use first available subtitle
			log.Printf("📝 Using first available subtitle: %s", subtitleFile.Language)
		}

		if subtitleFile == nil {
			log.Printf("❌ No subtitle file found for media ID %d, language: %s", id, language)
			c.JSON(http.StatusNotFound, gin.H{"error": "No subtitle file found"})
			return
		}

		// Check if subtitle file exists
		if _, err := os.Stat(subtitleFile.FilePath); os.IsNotExist(err) {
			log.Printf("❌ Subtitle file not found on disk: %s", subtitleFile.FilePath)
			c.JSON(http.StatusNotFound, gin.H{"error": "Subtitle file not found on disk"})
			return
		}

		// Determine content type based on format
		contentType := "text/plain"
		switch strings.ToLower(subtitleFile.Format) {
		case "srt":
			contentType = "text/srt"
		case "vtt":
			contentType = "text/vtt"
		case "ass", "ssa":
			contentType = "text/ass"
		}

		log.Printf("✅ Serving subtitle file: %s (%s)", subtitleFile.FilePath, contentType)

		// Set headers for subtitle serving
		c.Header("Content-Type", contentType+"; charset=utf-8")
		c.Header("Cache-Control", "public, max-age=3600") // Cache for 1 hour
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Headers", "Range")

		// Serve the subtitle file
		c.File(subtitleFile.FilePath)
	}
}

// StreamPreviewClip serves preview clips with INSTANT zero-copy streaming
func StreamPreviewClip(streamService *services.NetflixStreamService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaID := c.Param("id")
		
		// Parse media ID with minimal overhead
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
		
		// Fast preview clip path resolution with fallbacks
		var filePath string
		if media.PreviewClipPath != "" {
			// Try database path first
			if strings.HasPrefix(media.PreviewClipPath, "/") || strings.HasPrefix(media.PreviewClipPath, "./") {
				filePath = media.PreviewClipPath
			} else {
				// Resolve relative path
				filePath = "./backend/" + media.PreviewClipPath
			}
		} else if media.PreviewPath != "" {
			// Try preview path
			if strings.HasPrefix(media.PreviewPath, "/") || strings.HasPrefix(media.PreviewPath, "./") {
				filePath = media.PreviewPath
			} else {
				filePath = "./backend/" + media.PreviewPath
			}
		} else {
			// Fast fallback pattern matching
			basePatterns := []string{
				fmt.Sprintf("./backend/previews/preview_%d.mp4", id),
				fmt.Sprintf("./backend/previews/preview_%s.mp4", strings.ReplaceAll(media.Title, " ", "_")),
				fmt.Sprintf("./backend/previews/preview_%s.mp4", media.Title),
			}
			
			for _, pattern := range basePatterns {
				if _, err := os.Stat(pattern); err == nil {
					filePath = pattern
					break
				}
			}
			
			if filePath == "" {
				c.JSON(http.StatusNotFound, gin.H{"error": "Preview clip not available"})
				return
			}
		}
		
		// Fast file existence check
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Preview clip file not found: " + filePath})
			return
		}
		
		// Handle preflight requests instantly
		if c.Request.Method == "OPTIONS" {
			c.Header("Access-Control-Allow-Origin", "*")
			c.Header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Range, Content-Type, Accept, Authorization, X-Requested-With")
			c.Header("Access-Control-Max-Age", "86400")
			c.Status(http.StatusOK)
			return
		}
		
		// DO NOT set any headers - let StreamPreviewClip handle all headers for instant streaming
		// The instant streaming service sets optimal headers including:
		// - Cache-Control: public, max-age=86400, immutable
		// - Connection: keep-alive
		// - All CORS headers
		// - ETag and Last-Modified for 304 responses
		
		// INSTANT preview clip streaming with zero-copy sendfile
		err = streamService.StreamPreviewClip(c.Writer, c.Request, filePath)
		if err != nil {
			// Only send JSON error if headers haven't been written
			if !c.Writer.Written() {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Preview streaming failed: " + err.Error()})
			}
			return
		}
	}
}

// StreamALACAudio streams ALAC audio files for a media item
func StreamALACAudio(streamService *services.NetflixStreamService, mediaService *services.MediaService) gin.HandlerFunc {
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
func StreamCombinedVideoALAC(streamService *services.NetflixStreamService, mediaService *services.MediaService) gin.HandlerFunc {
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
		err = streamService.Stream(c.Writer, c.Request, filePath)
		if err != nil {
			if !c.Writer.Written() {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Combined streaming failed: " + err.Error()})
			}
			return
		}
	}
}

// GetVideoInfo returns detailed information about a video file including seeking support
func GetVideoInfo(streamService *services.NetflixStreamService, mediaService *services.MediaService) gin.HandlerFunc {
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
		
		// Get detailed video information
		videoInfo, err := streamService.GetVideoInfo(filePath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to analyze video: " + err.Error()})
			return
		}
		
		// Get streaming strategy
		strategy, err := streamService.GetStreamingStrategy(filePath)
		if err != nil {
			log.Printf("⚠️ Failed to determine streaming strategy: %v", err)
			strategy = "unknown"
		}
		
		// Add streaming strategy to response
		videoInfo["streaming_strategy"] = strategy
		videoInfo["media_id"] = id
		videoInfo["title"] = media.Title
		
		c.JSON(http.StatusOK, videoInfo)
	}
}

// CheckSeekingSupport checks if a video file supports seeking
func CheckSeekingSupport(streamService *services.NetflixStreamService, mediaService *services.MediaService) gin.HandlerFunc {
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
		
		// Check seeking support
		seekable, err := streamService.CheckSeekingSupport(filePath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check seeking support: " + err.Error()})
			return
		}
		
		// Get streaming strategy
		strategy, _ := streamService.GetStreamingStrategy(filePath)
		
		c.JSON(http.StatusOK, gin.H{
			"media_id":           id,
			"seekable":          seekable,
			"streaming_strategy": strategy,
			"file_path":         filePath,
		})
	}
}

// PreTranscodeMedia pre-transcodes unseekable media files for better seeking performance
func PreTranscodeMedia(streamService *services.NetflixStreamService, mediaService *services.MediaService) gin.HandlerFunc {
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
		
		// Start pre-transcoding in background
		go func() {
			err := streamService.PreTranscodeUnseekableFile(filePath)
			if err != nil {
				log.Printf("❌ Pre-transcoding failed for %s: %v", filePath, err)
			} else {
				log.Printf("✅ Pre-transcoding completed for %s", filePath)
			}
		}()
		
		c.JSON(http.StatusAccepted, gin.H{
			"message":  "Pre-transcoding started",
			"media_id": id,
			"status":   "processing",
		})
	}
}

// CheckAudioCompatibility checks audio codec compatibility for different browsers
func CheckAudioCompatibility(streamService *services.NetflixStreamService, mediaService *services.MediaService) gin.HandlerFunc {
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
		
		// Check audio compatibility for different browsers
		chromeCompatible, chromeErr := streamService.CheckChromeAudioCompatibility(filePath)
		generalCompatible, generalErr := streamService.CheckGeneralAudioCompatibility(filePath)
		
		// Get detailed audio info
		audioInfo, audioErr := streamService.GetAudioInfo(filePath)
		
		response := gin.H{
			"media_id":   id,
			"file_path":  filePath,
			"chrome": gin.H{
				"needs_transcoding": chromeCompatible,
				"error":            nil,
			},
			"general": gin.H{
				"needs_transcoding": generalCompatible,
				"error":            nil,
			},
			"audio_info": audioInfo,
		}
		
		if chromeErr != nil {
			response["chrome"].(gin.H)["error"] = chromeErr.Error()
		}
		
		if generalErr != nil {
			response["general"].(gin.H)["error"] = generalErr.Error()
		}
		
		if audioErr != nil {
			response["audio_error"] = audioErr.Error()
		}
		
		c.JSON(http.StatusOK, response)
	}
}