package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/services"
)

// GetALACAudio serves ALAC audio files for a media item
func GetALACAudio(alacService *services.ALACAudioService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		mediaID, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		audioPath := alacService.GetAudioPath(mediaID)
		if audioPath == "" {
			c.JSON(http.StatusNotFound, gin.H{"error": "ALAC audio not found"})
			return
		}

		// Set appropriate headers for audio streaming
		c.Header("Content-Type", "audio/mp4")
		c.Header("Accept-Ranges", "bytes")
		c.Header("Cache-Control", "public, max-age=3600")
		
		c.File(audioPath)
	}
}

// ExtractALACAudio extracts ALAC audio from a video file
func ExtractALACAudio(alacService *services.ALACAudioService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		mediaID, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		// Get media file path
		media, err := mediaService.GetMediaByID(uint(mediaID))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Extract ALAC audio using manual extraction (bypasses batch mode restrictions)
		audioPath, err := alacService.ManualExtractALAC(media.FilePath, mediaID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to extract ALAC audio", "details": err.Error()})
			return
		}

		// Analyze the extracted audio
		metadata, err := alacService.AnalyzeAudioQuality(audioPath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to analyze audio quality", "details": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "ALAC audio extracted successfully",
			"audio_path": audioPath,
			"metadata": metadata,
		})
	}
}

// GetALACAudioMetadata returns metadata for ALAC audio
func GetALACAudioMetadata(alacService *services.ALACAudioService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		mediaID, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		audioPath := alacService.GetAudioPath(mediaID)
		if audioPath == "" {
			c.JSON(http.StatusNotFound, gin.H{"error": "ALAC audio not found"})
			return
		}

		metadata, err := alacService.AnalyzeAudioQuality(audioPath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to analyze audio quality", "details": err.Error()})
			return
		}

		c.JSON(http.StatusOK, metadata)
	}
}

// ConvertToSpatialAudio converts audio to spatial format
func ConvertToSpatialAudio(alacService *services.ALACAudioService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		mediaID, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		layout := c.Param("layout")
		if layout == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Audio layout not specified"})
			return
		}

		// Validate layout
		validLayouts := []string{"stereo", "5.1", "7.1", "atmos"}
		isValid := false
		for _, validLayout := range validLayouts {
			if layout == validLayout {
				isValid = true
				break
			}
		}
		if !isValid {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid audio layout", "valid_layouts": validLayouts})
			return
		}

		// Get media file path
		media, err := mediaService.GetMediaByID(uint(mediaID))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Convert to spatial audio
		spatialPath, err := alacService.ConvertToSpatialAudio(media.FilePath, mediaID, layout)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to convert to spatial audio", "details": err.Error()})
			return
		}

		// Analyze the spatial audio
		metadata, err := alacService.AnalyzeAudioQuality(spatialPath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to analyze spatial audio quality", "details": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Spatial audio created successfully",
			"layout": layout,
			"audio_path": spatialPath,
			"metadata": metadata,
		})
	}
}

// GetSupportedAudioFormats returns list of supported audio formats
func GetSupportedAudioFormats(alacService *services.ALACAudioService) gin.HandlerFunc {
	return func(c *gin.Context) {
		formats := alacService.GetSupportedFormats()
		alacSupported := alacService.ValidateALACSupport()

		c.JSON(http.StatusOK, gin.H{
			"supported_formats": formats,
			"alac_supported": alacSupported,
			"capabilities": gin.H{
				"lossless_encoding": alacSupported,
				"spatial_audio": true,
				"hi_res_audio": alacSupported,
				"dolby_atmos_simulation": true,
				"max_sample_rate": "48kHz", // Optimized for size
				"max_bit_depth": "16-bit",  // Optimized for size
				"max_channels": 8,
				"size_optimization": true,
				"max_file_size": "1GB",
			},
		})
	}
}

// CleanupOversizedAudioFiles removes audio files that exceed size limits
func CleanupOversizedAudioFiles(alacService *services.ALACAudioService) gin.HandlerFunc {
	return func(c *gin.Context) {
		err := alacService.CleanupOversizedFiles()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to cleanup oversized files",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Oversized audio files cleanup completed",
			"status": "success",
		})
	}
}

// GetAudioFileInfo returns information about an audio file including size
func GetAudioFileInfo(alacService *services.ALACAudioService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		mediaID, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		audioPath := alacService.GetAudioPath(mediaID)
		if audioPath == "" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Audio file not found"})
			return
		}

		fileSize := alacService.GetAudioFileSize(mediaID)
		metadata, err := alacService.AnalyzeAudioQuality(audioPath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to analyze audio file",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"audio_path": audioPath,
			"file_size_bytes": fileSize,
			"file_size_mb": fileSize / (1024 * 1024),
			"within_size_limit": fileSize <= 1024*1024*1024,
			"metadata": metadata,
		})
	}
}