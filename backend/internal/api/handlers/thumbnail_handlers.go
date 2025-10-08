package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"
)

// Thumbnail and Preview Handlers

func GetThumbnail(mediaService *services.MediaService, thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		thumbnailPath, err := thumbnailService.ServeThumbnail(media.ID, media.Title)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.File(thumbnailPath)
	}
}

func GetPreviewClip(mediaService *services.MediaService, thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		previewPath, err := thumbnailService.ServePreviewClip(media.ID, media.Title)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.File(previewPath)
	}
}

func GenerateThumbnail(mediaService *services.MediaService, thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		_, err = thumbnailService.GenerateThumbnail(media.FilePath, media.ID, media.Title)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Thumbnail generated successfully"})
	}
}

func GetPreview(mediaService *services.MediaService, thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		previewPath, err := thumbnailService.ServePreview(media.ID, media.Title)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.File(previewPath)
	}
}

func GetPoster(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		if media.PosterPath == "" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Poster not found"})
			return
		}

		c.File(media.PosterPath)
	}
}

// GeneratePreviewClip generates a preview clip for hero backgrounds with fallback handling
func GeneratePreviewClip(mediaService *services.MediaService, thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Try multiple preview generation strategies with fallbacks
		previewPath, err := generatePreviewWithFallbacks(media, thumbnailService)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":   "failed",
				"media_id": media.ID,
				"error":    err.Error(),
				"message":  "All preview generation methods failed",
			})
			return
		}

		// Update media record with preview clip path
		media.PreviewClipPath = previewPath
		media.PreviewPath = previewPath
		if err := mediaService.UpdateMedia(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update media record"})
			return
		}

		// Get file size for compatibility with Python response
		var fileSize int64
		if info, err := os.Stat(previewPath); err == nil {
			fileSize = info.Size()
		}

		c.JSON(http.StatusOK, gin.H{
			"status":       "success",
			"media_id":     media.ID,
			"preview_path": previewPath,
			"file_size":    fileSize,
			"message":      "Preview clip generated successfully",
		})
	}
}

// GenerateOptimizedPreviewClip generates multiple quality preview clips
func GenerateOptimizedPreviewClip(mediaService *services.MediaService, thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Generate optimized preview clips
		previewPaths, err := thumbnailService.GenerateOptimizedPreviewClip(media.FilePath, media.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":   "failed",
				"media_id": media.ID,
				"error":    err.Error(),
			})
			return
		}

		// Update media record with high quality preview path
		if highPath, exists := previewPaths["high"]; exists {
			media.PreviewClipPath = highPath
			mediaService.UpdateMedia(media)
		}

		// Calculate total file sizes
		totalSize := int64(0)
		for _, path := range previewPaths {
			if info, err := os.Stat(path); err == nil {
				totalSize += info.Size()
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":        "success",
			"media_id":      media.ID,
			"preview_paths": previewPaths,
			"total_size":    totalSize,
			"qualities":     len(previewPaths),
			"message":       "Optimized preview clips generated successfully",
		})
	}
}

// GenerateMultipleThumbnails generates multiple thumbnails at different timestamps (matching Python task)
func GenerateMultipleThumbnails(mediaService *services.MediaService, thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		// Get count parameter (default 5)
		count := 5
		if countStr := c.Query("count"); countStr != "" {
			if parsed, err := strconv.Atoi(countStr); err == nil && parsed > 0 && parsed <= 10 {
				count = parsed
			}
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Generate multiple thumbnails (this would need to be implemented in thumbnail service)
		results, err := thumbnailService.GenerateMultipleThumbnails(media.FilePath, media.ID, count)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":   "failed",
				"media_id": media.ID,
				"error":    err.Error(),
			})
			return
		}

		successful := 0
		for _, result := range results {
			if result["status"] == "success" {
				successful++
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":     "completed",
			"media_id":   media.ID,
			"total":      count,
			"successful": successful,
			"results":    results,
		})
	}
}

// UpdateThumbnailPath updates media thumbnail path (API endpoint for Python tasks)
func UpdateThumbnailPath(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		var request struct {
			ThumbnailPath string `json:"thumbnail_path"`
		}

		if err := c.BindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		media.ThumbnailPath = request.ThumbnailPath
		if err := mediaService.UpdateMedia(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update media"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Thumbnail path updated successfully"})
	}
}

// UpdatePreviewPath updates media preview clip path (API endpoint for Python tasks)
func UpdatePreviewPath(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		var request struct {
			PreviewPath string `json:"preview_path"`
		}

		if err := c.BindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		media.PreviewClipPath = request.PreviewPath
		if err := mediaService.UpdateMedia(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update media"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Preview path updated successfully"})
	}
}

// GetThumbnailServiceStats returns thumbnail service statistics
func GetThumbnailServiceStats(thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		stats := thumbnailService.GetWorkerPoolStats()
		activeJobs := thumbnailService.GetActiveJobs()

		// Add job statistics
		jobStats := map[string]int{
			"queued":     0,
			"processing": 0,
			"completed":  0,
			"failed":     0,
		}

		for _, job := range activeJobs {
			jobStats[job.Status]++
		}

		c.JSON(http.StatusOK, gin.H{
			"worker_pool": stats,
			"job_stats":   jobStats,
			"active_jobs": len(activeJobs),
		})
	}
}

// GetJobStatus returns the status of a specific job
func GetJobStatus(thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		jobID := c.Param("jobId")

		job, exists := thumbnailService.GetJobStatus(jobID)
		if !exists {
			c.JSON(http.StatusNotFound, gin.H{"error": "Job not found"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"job": job,
		})
	}
}

// GenerateThumbnailBatch generates multiple thumbnails in parallel
func GenerateThumbnailBatch(mediaService *services.MediaService, thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var request struct {
			MediaIDs []uint `json:"media_ids"`
		}

		if err := c.BindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		if len(request.MediaIDs) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No media IDs provided"})
			return
		}

		if len(request.MediaIDs) > 50 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Too many media IDs (max 50)"})
			return
		}

		// Prepare batch requests
		var batchRequests []struct {
			VideoPath string
			MediaID   uint
			Title     string
		}

		for _, mediaID := range request.MediaIDs {
			media, err := mediaService.GetMediaByID(mediaID)
			if err != nil {
				continue // Skip invalid media IDs
			}

			batchRequests = append(batchRequests, struct {
				VideoPath string
				MediaID   uint
				Title     string
			}{
				VideoPath: media.FilePath,
				MediaID:   media.ID,
				Title:     media.Title,
			})
		}

		// Generate thumbnails in parallel
		results := thumbnailService.GenerateThumbnailBatch(batchRequests)

		// Process results
		successful := 0
		failed := 0
		var errors []string

		for i, result := range results {
			if result.Error != nil {
				failed++
				errors = append(errors, fmt.Sprintf("Media %d: %v", batchRequests[i].MediaID, result.Error))
			} else {
				successful++
				// Update media record
				media, _ := mediaService.GetMediaByID(batchRequests[i].MediaID)
				if media != nil {
					media.ThumbnailPath = result.Path
					mediaService.UpdateMedia(media)
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":     "completed",
			"total":      len(batchRequests),
			"successful": successful,
			"failed":     failed,
			"errors":     errors,
		})
	}
}

// RegeneratePreviewsForMissing regenerates preview clips for media with missing previews
func RegeneratePreviewsForMissing(mediaService *services.MediaService, thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get all media from database
		allMedia, err := mediaService.GetAllMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get media from database"})
			return
		}

		// Filter media with missing preview clips
		var mediaWithoutPreviews []models.Media
		for _, media := range allMedia {
			// Check if file exists
			if _, err := os.Stat(media.FilePath); err != nil {
				continue
			}

			// Check if preview clip is missing
			needsPreview := media.PreviewClipPath == "" || media.PreviewPath == ""

			// Also check if preview file actually exists on disk
			if media.PreviewClipPath != "" {
				if _, err := os.Stat(media.PreviewClipPath); os.IsNotExist(err) {
					needsPreview = true
				}
			}

			if needsPreview {
				mediaWithoutPreviews = append(mediaWithoutPreviews, media)
			}
		}

		if len(mediaWithoutPreviews) == 0 {
			c.JSON(http.StatusOK, gin.H{
				"status":  "completed",
				"message": "All media already have preview clips",
				"total":   0,
			})
			return
		}

		// Process in smaller batches to avoid overwhelming the system
		batchSize := 5
		successful := 0
		failed := 0
		var errors []string

		for i := 0; i < len(mediaWithoutPreviews); i += batchSize {
			end := i + batchSize
			if end > len(mediaWithoutPreviews) {
				end = len(mediaWithoutPreviews)
			}

			batch := mediaWithoutPreviews[i:end]
			log.Printf("🎬 Processing preview batch %d-%d of %d", i+1, end, len(mediaWithoutPreviews))

			// Process batch sequentially to avoid system overload
			for _, media := range batch {
				previewPath, err := generatePreviewWithFallbacks(&media, thumbnailService)
				if err != nil {
					failed++
					errors = append(errors, fmt.Sprintf("Media %d (%s): %v", media.ID, media.Title, err))
					log.Printf("❌ Failed to generate preview for %s: %v", media.Title, err)
				} else {
					// Update media record
					media.PreviewPath = previewPath
					media.PreviewClipPath = previewPath
					if updateErr := mediaService.UpdateMedia(&media); updateErr != nil {
						log.Printf("⚠️ Failed to update media record for %s: %v", media.Title, updateErr)
					} else {
						successful++
						log.Printf("✅ Generated preview for: %s", media.Title)
					}
				}
			}

			// Brief pause between batches
			if end < len(mediaWithoutPreviews) {
				log.Printf("⏸️ Batch completed, waiting 3 seconds before next batch...")
				// Note: In a real handler, you might want to use a background job instead of sleeping
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":     "completed",
			"total":      len(mediaWithoutPreviews),
			"successful": successful,
			"failed":     failed,
			"errors":     errors,
			"message":    fmt.Sprintf("Preview generation completed: %d successful, %d failed", successful, failed),
		})
	}
}

// GeneratePreviewClipBatch generates multiple preview clips in parallel
func GeneratePreviewClipBatch(mediaService *services.MediaService, thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var request struct {
			MediaIDs []uint `json:"media_ids"`
		}

		if err := c.BindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		if len(request.MediaIDs) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No media IDs provided"})
			return
		}

		if len(request.MediaIDs) > 20 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Too many media IDs (max 20)"})
			return
		}

		// Prepare batch requests
		var batchRequests []struct {
			VideoPath string
			MediaID   uint
			Title     string
		}

		for _, mediaID := range request.MediaIDs {
			media, err := mediaService.GetMediaByID(mediaID)
			if err != nil {
				continue // Skip invalid media IDs
			}

			batchRequests = append(batchRequests, struct {
				VideoPath string
				MediaID   uint
				Title     string
			}{
				VideoPath: media.FilePath,
				MediaID:   media.ID,
				Title:     media.Title,
			})
		}

		// Generate preview clips with fallback handling
		successful := 0
		failed := 0
		var errors []string

		for _, request := range batchRequests {
			media, err := mediaService.GetMediaByID(request.MediaID)
			if err != nil {
				failed++
				errors = append(errors, fmt.Sprintf("Media %d: not found", request.MediaID))
				continue
			}

			// Use fallback preview generation
			previewPath, err := generatePreviewWithFallbacks(media, thumbnailService)
			if err != nil {
				failed++
				errors = append(errors, fmt.Sprintf("Media %d: %v", request.MediaID, err))
			} else {
				successful++
				// Update media record
				media.PreviewPath = previewPath
				media.PreviewClipPath = previewPath
				mediaService.UpdateMedia(media)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":     "completed",
			"total":      len(batchRequests),
			"successful": successful,
			"failed":     failed,
			"errors":     errors,
		})
	}
}

// generatePreviewWithFallbacks tries multiple methods to generate preview clips with ALAC audio fallbacks
func generatePreviewWithFallbacks(media *models.Media, thumbnailService *services.ThumbnailService) (string, error) {
	var lastErr error

	// Strategy 1: Try standard preview generation (1080p with original audio)
	log.Printf("🎬 Attempt 1: Standard 1080p preview generation for %s", media.Title)
	previewPath, err := thumbnailService.GeneratePreviewClip(media.FilePath, media.ID, media.Title)
	if err == nil && previewPath != "" && validatePreviewFile(previewPath) {
		log.Printf("✅ Standard preview generation successful for %s", media.Title)
		return previewPath, nil
	}
	lastErr = err
	log.Printf("⚠️ Standard preview generation failed for %s: %v", media.Title, err)

	// Strategy 2: Try with audio codec fallback (convert ALAC to AAC)
	log.Printf("🎬 Attempt 2: Preview with audio codec fallback for %s", media.Title)
	previewPath, err = generatePreviewWithAudioFallback(media)
	if err == nil && previewPath != "" && validatePreviewFile(previewPath) {
		log.Printf("✅ Audio fallback preview generation successful for %s", media.Title)
		return previewPath, nil
	}
	if err != nil {
		lastErr = err
	}
	log.Printf("⚠️ Audio fallback preview generation failed for %s: %v", media.Title, err)

	// Strategy 3: Try async method as fallback
	log.Printf("🎬 Attempt 3: Async preview generation for %s", media.Title)
	previewPath, err = thumbnailService.GeneratePreviewClipAsync(media.FilePath, media.ID, media.Title)
	if err == nil && previewPath != "" && validatePreviewFile(previewPath) {
		log.Printf("✅ Async preview generation successful for %s", media.Title)
		return previewPath, nil
	}
	if err != nil {
		lastErr = err
	}
	log.Printf("⚠️ Async preview generation failed for %s: %v", media.Title, err)

	// Strategy 4: Try lower quality preview (720p) with audio conversion
	log.Printf("🎬 Attempt 4: Lower quality (720p) preview for %s", media.Title)
	previewPath, err = generateLowerQualityPreview(media)
	if err == nil && previewPath != "" && validatePreviewFile(previewPath) {
		log.Printf("✅ Lower quality preview generation successful for %s", media.Title)
		return previewPath, nil
	}
	if err != nil {
		lastErr = err
	}
	log.Printf("⚠️ Lower quality preview generation failed for %s: %v", media.Title, err)

	// Strategy 5: Try basic preview without audio
	log.Printf("🎬 Attempt 5: Video-only preview for %s", media.Title)
	previewPath, err = generateVideoOnlyPreview(media)
	if err == nil && previewPath != "" && validatePreviewFile(previewPath) {
		log.Printf("✅ Video-only preview generation successful for %s", media.Title)
		return previewPath, nil
	}
	if err != nil {
		lastErr = err
	}

	return "", fmt.Errorf("all preview generation strategies failed, last error: %v", lastErr)
}

// generatePreviewWithAudioFallback generates preview with audio codec conversion
func generatePreviewWithAudioFallback(media *models.Media) (string, error) {
	previewDir := "previews"
	if _, err := os.Stat(previewDir); os.IsNotExist(err) {
		os.MkdirAll(previewDir, 0755)
	}

	outputPath := fmt.Sprintf("%s/preview_%d_%s_audio_fallback.mp4", previewDir, media.ID,
		strings.ReplaceAll(media.Title, " ", "_"))

	// Optimized FFmpeg command for i5-4590 system
	cmd := exec.Command("ffmpeg",
		"-i", media.FilePath,
		"-ss", "60", // Start at 1 minute
		"-t", "10", // Reduced to 10 seconds for stability
		"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2", // HD 1920x1080p quality
		"-c:v", "libx264",
		"-preset", "fast",
		"-crf", "23",
		"-c:a", "aac", // Force AAC audio codec
		"-b:a", "96k", // Lower audio bitrate
		"-ac", "2", // Stereo audio
		"-ar", "44100", // Sample rate
		"-movflags", "+faststart",
		"-threads", "2", // Limit threads for i5-4590
		"-y", // Overwrite output file
		outputPath)

	log.Printf("🔧 Running FFmpeg with audio fallback: %s", cmd.String())

	if output, err := cmd.CombinedOutput(); err != nil {
		log.Printf("❌ FFmpeg audio fallback failed: %v\nOutput: %s", err, string(output))
		return "", fmt.Errorf("ffmpeg audio fallback failed: %v", err)
	}

	return outputPath, nil
}

// generateLowerQualityPreview generates HD 1080p preview with audio conversion
func generateLowerQualityPreview(media *models.Media) (string, error) {
	previewDir := "previews"
	if _, err := os.Stat(previewDir); os.IsNotExist(err) {
		os.MkdirAll(previewDir, 0755)
	}

	outputPath := fmt.Sprintf("%s/preview_%d_%s_HD.mp4", previewDir, media.ID,
		strings.ReplaceAll(media.Title, " ", "_"))

	// Optimized FFmpeg command for i5-4590 HD preview
	cmd := exec.Command("ffmpeg",
		"-i", media.FilePath,
		"-ss", "60", // Start at 1 minute
		"-t", "15", // Reduced duration for stability
		"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2", // HD 1920x1080p quality
		"-c:v", "libx264",
		"-preset", "fast", // Faster preset for i5-4590
		"-crf", "23", // Balanced quality
		"-c:a", "aac", // Force AAC audio codec
		"-b:a", "96k", // Lower audio bitrate
		"-ac", "2", // Stereo audio
		"-ar", "44100", // Sample rate
		"-movflags", "+faststart",
		"-threads", "2", // Limit threads for stability
		"-y", // Overwrite output file
		outputPath)

	log.Printf("🔧 Running FFmpeg HD preview: %s", cmd.String())

	if output, err := cmd.CombinedOutput(); err != nil {
		log.Printf("❌ FFmpeg HD preview failed: %v\nOutput: %s", err, string(output))
		return "", fmt.Errorf("ffmpeg HD preview failed: %v", err)
	}

	return outputPath, nil
}

// generateVideoOnlyPreview generates preview without audio track
func generateVideoOnlyPreview(media *models.Media) (string, error) {
	previewDir := "previews"
	if _, err := os.Stat(previewDir); os.IsNotExist(err) {
		os.MkdirAll(previewDir, 0755)
	}

	outputPath := fmt.Sprintf("%s/preview_%d_%s_video_only.mp4", previewDir, media.ID,
		strings.ReplaceAll(media.Title, " ", "_"))

	// Optimized FFmpeg command for video-only preview
	cmd := exec.Command("ffmpeg",
		"-i", media.FilePath,
		"-ss", "60", // Start at 1 minute
		"-t", "10", // Short duration for stability
		"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2", // HD 1920x1080p quality
		"-c:v", "libx264",
		"-preset", "ultrafast", // Fastest preset for video-only
		"-crf", "25", // Lower quality for speed
		"-an", // No audio
		"-movflags", "+faststart",
		"-threads", "2", // Limit threads for i5-4590
		"-y", // Overwrite output file
		outputPath)

	log.Printf("🔧 Running FFmpeg video-only preview: %s", cmd.String())

	if output, err := cmd.CombinedOutput(); err != nil {
		log.Printf("❌ FFmpeg video-only preview failed: %v\nOutput: %s", err, string(output))
		return "", fmt.Errorf("ffmpeg video-only preview failed: %v", err)
	}

	return outputPath, nil
}

// validatePreviewFile validates that a generated preview file is valid
func validatePreviewFile(path string) bool {
	if path == "" {
		return false
	}

	// Check if file exists
	stat, err := os.Stat(path)
	if err != nil {
		log.Printf("⚠️ Preview file not found: %s", path)
		return false
	}

	// Check file size (should be at least 1KB)
	if stat.Size() < 1024 {
		log.Printf("⚠️ Preview file too small (%d bytes): %s", stat.Size(), path)
		return false
	}

	// Check if it's a valid video file using FFprobe
	cmd := exec.Command("ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", path)
	if output, err := cmd.CombinedOutput(); err != nil {
		log.Printf("⚠️ Preview file validation failed: %s - %v", path, err)
		return false
	} else {
		// Parse the output to check duration
		var probeData struct {
			Format struct {
				Duration string `json:"duration"`
			} `json:"format"`
		}

		if json.Unmarshal(output, &probeData) == nil {
			if duration, err := strconv.ParseFloat(probeData.Format.Duration, 64); err == nil {
				if duration > 5 { // Should be at least 5 seconds
					log.Printf("✅ Preview file validated: %s (%.1fs, %d bytes)", path, duration, stat.Size())
					return true
				} else {
					log.Printf("⚠️ Preview file too short (%.1fs): %s", duration, path)
				}
			}
		}
	}

	return false
}

// Enhanced asset serving handlers with better error handling and fallbacks

func GetThumbnailEnhanced(mediaService *services.MediaService, thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Try multiple thumbnail serving strategies
		thumbnailPath, err := serveThumbnailWithFallbacks(media, thumbnailService)
		if err != nil {
			// Generate thumbnail on-demand if not found
			log.Printf("🔄 Thumbnail not found for media %d, generating on-demand", media.ID)

			generatedPath, genErr := thumbnailService.GenerateThumbnail(media.FilePath, media.ID, media.Title)
			if genErr != nil {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "Thumbnail not available and generation failed",
					"details": genErr.Error(),
				})
				return
			}

			// Update media record
			media.ThumbnailPath = generatedPath
			mediaService.UpdateMedia(media)
			thumbnailPath = generatedPath
		}

		// Set appropriate headers for caching
		c.Header("Cache-Control", "public, max-age=3600")
		c.Header("Content-Type", "image/jpeg")

		c.File(thumbnailPath)
	}
}

func GetPreviewEnhanced(mediaService *services.MediaService, thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Try multiple preview serving strategies
		previewPath, err := servePreviewWithFallbacks(media, thumbnailService)
		if err != nil {
			// Generate preview on-demand if not found
			log.Printf("🔄 Preview not found for media %d, generating on-demand", media.ID)

			generatedPath, genErr := generatePreviewWithFallbacks(media, thumbnailService)
			if genErr != nil {
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "Preview not available and generation failed",
					"details": genErr.Error(),
				})
				return
			}

			// Update media record
			media.PreviewPath = generatedPath
			media.PreviewClipPath = generatedPath
			mediaService.UpdateMedia(media)
			previewPath = generatedPath
		}

		// Set appropriate headers for video streaming
		c.Header("Cache-Control", "public, max-age=3600")
		c.Header("Content-Type", "video/mp4")
		c.Header("Accept-Ranges", "bytes")

		c.File(previewPath)
	}
}

func GetPosterEnhanced(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Try multiple poster serving strategies
		posterPath, err := servePosterWithFallbacks(media)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{
				"error":   "Poster not available",
				"details": err.Error(),
			})
			return
		}

		// Set appropriate headers for caching
		c.Header("Cache-Control", "public, max-age=3600")
		c.Header("Content-Type", "image/jpeg")

		c.File(posterPath)
	}
}

// serveThumbnailWithFallbacks tries multiple strategies to serve thumbnails
func serveThumbnailWithFallbacks(media *models.Media, thumbnailService *services.ThumbnailService) (string, error) {
	// Strategy 1: Use existing thumbnail path from database
	if media.ThumbnailPath != "" {
		if _, err := os.Stat(media.ThumbnailPath); err == nil {
			return media.ThumbnailPath, nil
		}
		log.Printf("⚠️ Database thumbnail path invalid: %s", media.ThumbnailPath)
	}

	// Strategy 2: Try thumbnail service's serve method
	if thumbnailPath, err := thumbnailService.ServeThumbnail(media.ID, media.Title); err == nil {
		return thumbnailPath, nil
	}

	// Strategy 3: Look for thumbnails in common locations
	cleanTitle := cleanTitleForFilename(media.Title)
	possiblePaths := []string{
		fmt.Sprintf("./thumbnails/thumb_%s.jpg", cleanTitle),
		fmt.Sprintf("./backend/thumbnails/thumb_%s.jpg", cleanTitle),
		fmt.Sprintf("./thumbnails/thumb_%d.jpg", media.ID),
		fmt.Sprintf("./backend/thumbnails/thumb_%d.jpg", media.ID),
	}

	for _, path := range possiblePaths {
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}

	return "", fmt.Errorf("no thumbnail found for media %d", media.ID)
}

// servePreviewWithFallbacks tries multiple strategies to serve preview clips
func servePreviewWithFallbacks(media *models.Media, thumbnailService *services.ThumbnailService) (string, error) {
	// Strategy 1: Use existing preview path from database
	if media.PreviewPath != "" {
		if _, err := os.Stat(media.PreviewPath); err == nil {
			return media.PreviewPath, nil
		}
		log.Printf("⚠️ Database preview path invalid: %s", media.PreviewPath)
	}

	// Strategy 2: Use preview clip path from database
	if media.PreviewClipPath != "" {
		if _, err := os.Stat(media.PreviewClipPath); err == nil {
			return media.PreviewClipPath, nil
		}
		log.Printf("⚠️ Database preview clip path invalid: %s", media.PreviewClipPath)
	}

	// Strategy 3: Try thumbnail service's serve method
	if previewPath, err := thumbnailService.ServePreviewClip(media.ID, media.Title); err == nil {
		return previewPath, nil
	}

	// Strategy 4: Look for previews in common locations
	cleanTitle := cleanTitleForFilename(media.Title)
	possiblePaths := []string{
		fmt.Sprintf("./previews/preview_%s.mp4", cleanTitle),
		fmt.Sprintf("./backend/previews/preview_%s.mp4", cleanTitle),
		fmt.Sprintf("./previews/preview_%d.mp4", media.ID),
		fmt.Sprintf("./backend/previews/preview_%d.mp4", media.ID),
	}

	for _, path := range possiblePaths {
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}

	return "", fmt.Errorf("no preview found for media %d", media.ID)
}

// servePosterWithFallbacks tries multiple strategies to serve posters
func servePosterWithFallbacks(media *models.Media) (string, error) {
	// Strategy 1: Use existing poster path from database
	if media.PosterPath != "" {
		if _, err := os.Stat(media.PosterPath); err == nil {
			return media.PosterPath, nil
		}
		log.Printf("⚠️ Database poster path invalid: %s", media.PosterPath)
	}

	// Strategy 2: Look for posters in common locations
	cleanTitle := cleanTitleForFilename(media.Title)
	possiblePosterPaths := []string{
		fmt.Sprintf("./posters/poster_%s.jpg", cleanTitle),
		fmt.Sprintf("./backend/posters/poster_%s.jpg", cleanTitle),
		fmt.Sprintf("./posters/poster_%d.jpg", media.ID),
		fmt.Sprintf("./backend/posters/poster_%d.jpg", media.ID),
		fmt.Sprintf("./assets/posters/poster_%s.jpg", cleanTitle),
		fmt.Sprintf("./assets/posters/poster_%d.jpg", media.ID),
	}

	for _, path := range possiblePosterPaths {
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}

	// Strategy 3: Fallback to thumbnail if no poster found
	log.Printf("📸 No poster found for media %d, falling back to thumbnail", media.ID)
	
	// Try existing thumbnail path from database
	if media.ThumbnailPath != "" {
		if _, err := os.Stat(media.ThumbnailPath); err == nil {
			return media.ThumbnailPath, nil
		}
	}

	// Try common thumbnail locations
	possibleThumbnailPaths := []string{
		fmt.Sprintf("./thumbnails/thumb_%s.jpg", cleanTitle),
		fmt.Sprintf("./backend/thumbnails/thumb_%s.jpg", cleanTitle),
		fmt.Sprintf("./thumbnails/thumb_%d.jpg", media.ID),
		fmt.Sprintf("./backend/thumbnails/thumb_%d.jpg", media.ID),
		fmt.Sprintf("./assets/thumbnails/thumb_%s.jpg", cleanTitle),
		fmt.Sprintf("./assets/thumbnails/thumb_%d.jpg", media.ID),
	}

	for _, path := range possibleThumbnailPaths {
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}

	return "", fmt.Errorf("no poster or thumbnail found for media %d", media.ID)
}

// cleanTitleForFilename cleans a title to be safe for use in filenames
func cleanTitleForFilename(title string) string {
	// Remove or replace characters that are not safe for filenames
	cleaned := strings.ReplaceAll(title, " ", "_")
	cleaned = strings.ReplaceAll(cleaned, ":", "")
	cleaned = strings.ReplaceAll(cleaned, "/", "_")
	cleaned = strings.ReplaceAll(cleaned, "\\", "_")
	cleaned = strings.ReplaceAll(cleaned, "?", "")
	cleaned = strings.ReplaceAll(cleaned, "*", "")
	cleaned = strings.ReplaceAll(cleaned, "<", "")
	cleaned = strings.ReplaceAll(cleaned, ">", "")
	cleaned = strings.ReplaceAll(cleaned, "|", "")
	cleaned = strings.ReplaceAll(cleaned, "\"", "")
	cleaned = strings.ReplaceAll(cleaned, "'", "")

	// Convert to lowercase for consistency
	cleaned = strings.ToLower(cleaned)

	// Remove multiple underscores
	for strings.Contains(cleaned, "__") {
		cleaned = strings.ReplaceAll(cleaned, "__", "_")
	}

	// Trim underscores from start and end
	cleaned = strings.Trim(cleaned, "_")

	return cleaned
}
