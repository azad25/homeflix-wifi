package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/services"
)

// GetALACAudio serves ALAC audio files for a media item
func GetALACAudio(alacService *services.ALACAudioService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		uuid := c.Param("id")
		if uuid == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media UUID"})
			return
		}

		// Get media by UUID
		media, err := mediaService.GetMediaByUUID(uuid)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		audioPath := alacService.GetAudioPath(int(media.ID))
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
		uuid := c.Param("id")
		if uuid == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media UUID"})
			return
		}

		// Get media file path
		media, err := mediaService.GetMediaByUUID(uuid)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Extract ALAC audio
		audioPath, err := alacService.ExtractALACAudio(media.FilePath, int(media.ID))
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
func GetALACAudioMetadata(alacService *services.ALACAudioService, mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		uuid := c.Param("id")
		if uuid == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media UUID"})
			return
		}

		// Get media by UUID
		media, err := mediaService.GetMediaByUUID(uuid)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		audioPath := alacService.GetAudioPath(int(media.ID))
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
		uuid := c.Param("id")
		if uuid == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media UUID"})
			return
		}

		// Get media by UUID
		media, err := mediaService.GetMediaByUUID(uuid)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
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

		// Convert to spatial audio
		spatialPath, err := alacService.ConvertToSpatialAudio(media.FilePath, int(media.ID), layout)
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
				"max_sample_rate": "192kHz",
				"max_bit_depth": "32-bit",
				"max_channels": 12,
			},
		})
	}
}
