package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"
)

// Admin API Handlers for Celery worker database updates

// UpdateMediaMetadata updates media metadata from Celery workers
func UpdateMediaMetadata(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		var request struct {
			Title       string   `json:"title"`
			Tagline     string   `json:"tagline"`
			Description string   `json:"description"`
			Year        int      `json:"year"`
			Rating      float64  `json:"rating"`
			Country     string   `json:"country"`
			Stars       []string `json:"stars"`
			Directors   []string `json:"directors"`
			Genres      []string `json:"genres"`
		}

		if err := c.BindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Update metadata fields
		if request.Title != "" {
			media.Title = request.Title
		}
		if request.Tagline != "" {
			media.Tagline = request.Tagline
		}
		if request.Description != "" {
			media.Description = request.Description
		}
		if request.Year > 0 {
			media.Year = request.Year
		}
		if request.Rating > 0 {
			media.Rating = request.Rating
		}
		if request.Country != "" {
			media.Country = request.Country
		}
		if len(request.Stars) > 0 {
			media.Stars = request.Stars
		}
		if len(request.Directors) > 0 {
			media.Director = request.Directors
		}

		// Update genres if provided
		if len(request.Genres) > 0 {
			if err := mediaService.AssignGenresToMedia(uint(id), request.Genres); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update genres"})
				return
			}
		}

		if err := mediaService.UpdateMedia(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update media metadata"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Media updated successfully",
			"media":   media,
		})
	}
}

// CreateMediaAdmin creates a new media entry (for file watcher)
func CreateMediaAdmin(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var request struct {
			Title         string `json:"title" binding:"required"`
			FilePath      string `json:"file_path" binding:"required"`
			Year          *int   `json:"year"`
			Type          string `json:"type"`
			FileSize      int64  `json:"file_size"`
			FileExtension string `json:"file_extension"`
		}

		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Create new media entry
		media := &models.Media{
			Title:    request.Title,
			FilePath: request.FilePath,
			Type:     request.Type,
			FileSize: request.FileSize,
		}

		// Handle optional year
		if request.Year != nil {
			media.Year = *request.Year
		}

		// Set default values
		if media.Type == "" {
			media.Type = "movie"
		}

		// Save to database
		if err := mediaService.CreateMedia(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create media"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{
			"message": "Media created successfully",
			"id":      media.ID,
			"uuid":    media.UUID,
			"media":   media,
		})
	}
}

// UpdateMediaAdmin updates media entry (general admin endpoint)
func UpdateMediaAdmin(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		var request struct {
			Title       *string `json:"title"`
			Year        *int    `json:"year"`
			Type        *string `json:"type"`
			Description *string `json:"description"`
			Rating      *float64 `json:"rating"`
		}

		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Update fields if provided
		if request.Title != nil {
			media.Title = *request.Title
		}
		if request.Year != nil {
			media.Year = *request.Year
		}
		if request.Type != nil {
			media.Type = *request.Type
		}
		if request.Description != nil {
			media.Description = *request.Description
		}
		if request.Rating != nil {
			media.Rating = *request.Rating
		}

		if err := mediaService.UpdateMedia(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update media"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Media updated successfully",
			"media":   media,
		})
	}
}

// UpdateMediaThumbnailAdmin updates thumbnail path from Celery workers
func UpdateMediaThumbnailAdmin(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		var request struct {
			ThumbnailPath string `json:"thumbnail_path"`
		}

		if err := c.BindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		media.ThumbnailPath = request.ThumbnailPath

		if err := mediaService.UpdateMedia(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update thumbnail path"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Thumbnail path updated successfully"})
	}
}

// UpdateMediaPreviewAdmin updates preview clip path from Celery workers
func UpdateMediaPreviewAdmin(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		var request struct {
			PreviewPath string `json:"preview_path"`
		}

		if err := c.BindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		media.PreviewClipPath = request.PreviewPath

		if err := mediaService.UpdateMedia(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update preview path"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Preview path updated successfully"})
	}
}

// UpdateMediaPosterAdmin updates poster path from Celery workers
func UpdateMediaPosterAdmin(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		var request struct {
			PosterPath string `json:"poster_path"`
		}

		if err := c.BindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		media.PosterPath = request.PosterPath

		if err := mediaService.UpdateMedia(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update poster path"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Poster path updated successfully"})
	}
}

// GetMediaByIDAdmin gets media by ID for admin operations
func GetMediaByIDAdmin(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		c.JSON(http.StatusOK, media)
	}
}

// BatchUpdateMediaPaths updates multiple media paths in a single request
func BatchUpdateMediaPaths(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var request struct {
			Updates []struct {
				MediaID       uint   `json:"media_id"`
				ThumbnailPath string `json:"thumbnail_path,omitempty"`
				PreviewPath   string `json:"preview_path,omitempty"`
				PosterPath    string `json:"poster_path,omitempty"`
			} `json:"updates"`
		}

		if err := c.BindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
			return
		}

		var results []gin.H
		successCount := 0

		for _, update := range request.Updates {
			media, err := mediaService.GetMediaByID(update.MediaID)
			if err != nil {
				results = append(results, gin.H{
					"media_id": update.MediaID,
					"status":   "failed",
					"error":    "Media not found",
				})
				continue
			}

			// Update paths if provided
			if update.ThumbnailPath != "" {
				media.ThumbnailPath = update.ThumbnailPath
			}
			if update.PreviewPath != "" {
				media.PreviewClipPath = update.PreviewPath
			}
			if update.PosterPath != "" {
				media.PosterPath = update.PosterPath
			}

			if err := mediaService.UpdateMedia(media); err != nil {
				results = append(results, gin.H{
					"media_id": update.MediaID,
					"status":   "failed",
					"error":    "Failed to update media",
				})
			} else {
				results = append(results, gin.H{
					"media_id": update.MediaID,
					"status":   "success",
				})
				successCount++
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"message":      "Batch update completed",
			"total":        len(request.Updates),
			"successful":   successCount,
			"failed":       len(request.Updates) - successCount,
			"results":      results,
		})
	}
}
