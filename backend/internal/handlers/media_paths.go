package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"homeflix-backend/internal/models"
)

type MediaPathsHandler struct {
	db      *gorm.DB
	scanner MediaScannerInterface
}

func NewMediaPathsHandler(db *gorm.DB, scanner MediaScannerInterface) *MediaPathsHandler {
	return &MediaPathsHandler{
		db:      db,
		scanner: scanner,
	}
}

// GetMediaPaths returns all configured media paths
func (h *MediaPathsHandler) GetMediaPaths(c *gin.Context) {
	var mediaPaths []models.MediaPath
	
	if err := h.db.Where("is_active = ?", true).Order("priority DESC, created_at ASC").Find(&mediaPaths).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch media paths"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"media_paths": mediaPaths})
}

// AddMediaPath adds a new media path
func (h *MediaPathsHandler) AddMediaPath(c *gin.Context) {
	var req struct {
		Path        string `json:"path" binding:"required"`
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		PathType    string `json:"path_type" binding:"required"` // "primary", "torrent", "external"
		Priority    int    `json:"priority"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Validate path type
	validTypes := map[string]bool{"primary": true, "torrent": true, "external": true}
	if !validTypes[req.PathType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid path_type. Must be 'primary', 'torrent', or 'external'"})
		return
	}
	
	// Check if path already exists
	var existing models.MediaPath
	if err := h.db.Where("path = ?", req.Path).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Media path already exists"})
		return
	}
	
	mediaPath := models.MediaPath{
		Path:        req.Path,
		Name:        req.Name,
		Description: req.Description,
		PathType:    req.PathType,
		IsActive:    true,
		Priority:    req.Priority,
	}
	
	if err := h.db.Create(&mediaPath).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create media path"})
		return
	}
	
	// Update scanner with new paths
	h.updateScannerPaths()
	
	c.JSON(http.StatusCreated, gin.H{
		"message":    "Media path added successfully",
		"media_path": mediaPath,
	})
}

// UpdateMediaPath updates an existing media path
func (h *MediaPathsHandler) UpdateMediaPath(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media path ID"})
		return
	}
	
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		PathType    string `json:"path_type"`
		IsActive    *bool  `json:"is_active"`
		Priority    *int   `json:"priority"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	var mediaPath models.MediaPath
	if err := h.db.First(&mediaPath, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Media path not found"})
		return
	}
	
	// Update fields if provided
	if req.Name != "" {
		mediaPath.Name = req.Name
	}
	if req.Description != "" {
		mediaPath.Description = req.Description
	}
	if req.PathType != "" {
		validTypes := map[string]bool{"primary": true, "torrent": true, "external": true}
		if !validTypes[req.PathType] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid path_type"})
			return
		}
		mediaPath.PathType = req.PathType
	}
	if req.IsActive != nil {
		mediaPath.IsActive = *req.IsActive
	}
	if req.Priority != nil {
		mediaPath.Priority = *req.Priority
	}
	
	if err := h.db.Save(&mediaPath).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update media path"})
		return
	}
	
	// Update scanner with new paths
	h.updateScannerPaths()
	
	c.JSON(http.StatusOK, gin.H{
		"message":    "Media path updated successfully",
		"media_path": mediaPath,
	})
}

// DeleteMediaPath removes a media path
func (h *MediaPathsHandler) DeleteMediaPath(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media path ID"})
		return
	}
	
	var mediaPath models.MediaPath
	if err := h.db.First(&mediaPath, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Media path not found"})
		return
	}
	
	// Don't allow deletion of primary paths if it's the only one
	if mediaPath.PathType == "primary" {
		var count int64
		h.db.Model(&models.MediaPath{}).Where("path_type = ? AND is_active = ?", "primary", true).Count(&count)
		if count <= 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete the only active primary media path"})
			return
		}
	}
	
	if err := h.db.Delete(&mediaPath).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete media path"})
		return
	}
	
	// Update scanner with new paths
	h.updateScannerPaths()
	
	c.JSON(http.StatusOK, gin.H{"message": "Media path deleted successfully"})
}

// updateScannerPaths updates the scanner with current active media paths
func (h *MediaPathsHandler) updateScannerPaths() {
	var mediaPaths []models.MediaPath
	if err := h.db.Where("is_active = ?", true).Order("priority DESC, created_at ASC").Find(&mediaPaths).Error; err != nil {
		return
	}
	
	var paths []string
	for _, mp := range mediaPaths {
		paths = append(paths, mp.Path)
	}
	
	h.scanner.SetMediaPaths(paths)
}