package handlers

import (
	"fmt"
	"net/http"
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
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
// GeneratePreviewClip generates a preview clip for hero backgrounds (matching Python task)
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

		// Generate preview clip with Python task compatibility
		previewPath, err := thumbnailService.GeneratePreviewClip(media.FilePath, media.ID, media.Title)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status": "failed",
				"media_id": media.ID,
				"error": err.Error(),
			})
			return
		}

		// Update media record with preview clip path
		media.PreviewClipPath = previewPath
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
			"status": "success",
			"media_id": media.ID,
			"preview_path": previewPath,
			"file_size": fileSize,
			"message": "Preview clip generated successfully",
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
				"status": "failed",
				"media_id": media.ID,
				"error": err.Error(),
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
			"status": "success",
			"media_id": media.ID,
			"preview_paths": previewPaths,
			"total_size": totalSize,
			"qualities": len(previewPaths),
			"message": "Optimized preview clips generated successfully",
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
				"status": "failed",
				"media_id": media.ID,
				"error": err.Error(),
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
			"status": "completed",
			"media_id": media.ID,
			"total": count,
			"successful": successful,
			"results": results,
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

		// Generate preview clips in parallel
		results := thumbnailService.GeneratePreviewClipBatch(batchRequests)

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
					media.PreviewPath = result.Path
					media.PreviewClipPath = result.Path
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