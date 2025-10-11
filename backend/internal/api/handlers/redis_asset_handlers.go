package handlers

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"
)

// RedisAssetHandlers provides Redis-cached asset serving
type RedisAssetHandlers struct {
	mediaService     *services.MediaService
	thumbnailService *services.ThumbnailService
	redisCache       *services.RedisAssetCache
}

// NewRedisAssetHandlers creates new Redis asset handlers
func NewRedisAssetHandlers(mediaService *services.MediaService, thumbnailService *services.ThumbnailService, redisCache *services.RedisAssetCache) *RedisAssetHandlers {
	return &RedisAssetHandlers{
		mediaService:     mediaService,
		thumbnailService: thumbnailService,
		redisCache:       redisCache,
	}
}

// GetThumbnailCached serves thumbnails with Redis caching for instant loading
func (h *RedisAssetHandlers) GetThumbnailCached() gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		mediaID := uint(id)

		// Try Redis cache first - instant serving
		data, metadata, err := h.redisCache.GetAsset(mediaID, "thumbnail")
		if err == nil && data != nil {
			// Cache HIT - serve instantly
			h.setOptimalHeaders(c, "thumbnail", metadata)
			c.Header("X-Cache", "REDIS-HIT")
			c.Data(http.StatusOK, metadata.ContentType, data)
			return
		}

		// Cache MISS - try to find and cache the asset
		media, err := h.mediaService.GetMediaByID(mediaID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Find existing thumbnail with optimized path resolution
		thumbnailPath := h.findThumbnailPath(media)
		if thumbnailPath == "" {
			// No thumbnail found - return 404 and trigger async generation
			c.JSON(http.StatusNotFound, gin.H{
				"error":    "Thumbnail not available",
				"media_id": mediaID,
				"message":  "Asset will be generated and cached",
			})

			// Async generation and caching
			go h.generateAndCacheThumbnail(media)
			return
		}

		// Serve file and cache it for future requests
		h.serveAndCacheAsset(c, mediaID, "thumbnail", thumbnailPath)

		// Update database if path changed
		if media.ThumbnailPath != thumbnailPath {
			media.ThumbnailPath = thumbnailPath
			go h.mediaService.UpdateMedia(media)
		}
	}
}

// GetPreviewCached serves preview clips with Redis caching
func (h *RedisAssetHandlers) GetPreviewCached() gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		mediaID := uint(id)

		// For previews, we cache path only due to large file sizes
		cachedPath, err := h.redisCache.GetAssetPath(mediaID, "preview")
		if err == nil && cachedPath != "" {
			// Verify file still exists
			if _, err := os.Stat(cachedPath); err == nil {
				h.setOptimalHeaders(c, "preview", nil)
				c.Header("X-Cache", "REDIS-PATH-HIT")
				c.File(cachedPath)
				return
			}
			// File no longer exists, invalidate cache
			go h.redisCache.InvalidateAsset(mediaID, "preview")
		}

		// Cache miss - find preview
		media, err := h.mediaService.GetMediaByID(mediaID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		previewPath := h.findPreviewPath(media)
		if previewPath == "" {
			c.JSON(http.StatusNotFound, gin.H{
				"error":    "Preview not available",
				"media_id": mediaID,
				"message":  "Asset will be generated and cached",
			})

			// Async generation and caching
			go h.generateAndCachePreview(media)
			return
		}

		// Serve file and cache path
		h.setOptimalHeaders(c, "preview", nil)
		c.Header("X-Cache", "REDIS-MISS")
		c.File(previewPath)

		// Cache the path for future requests
		go h.redisCache.SetAssetPath(mediaID, "preview", previewPath)

		// Update database if needed
		if media.PreviewClipPath != previewPath {
			media.PreviewClipPath = previewPath
			go h.mediaService.UpdateMedia(media)
		}
	}
}

// GetPosterCached serves posters with Redis caching
func (h *RedisAssetHandlers) GetPosterCached() gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		mediaID := uint(id)

		// Try Redis cache first
		data, metadata, err := h.redisCache.GetAsset(mediaID, "poster")
		if err == nil && data != nil {
			h.setOptimalHeaders(c, "poster", metadata)
			c.Header("X-Cache", "REDIS-HIT")
			c.Data(http.StatusOK, metadata.ContentType, data)
			return
		}

		// Cache miss - find poster
		media, err := h.mediaService.GetMediaByID(mediaID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		posterPath := h.findPosterPath(media)
		if posterPath == "" {
			c.JSON(http.StatusNotFound, gin.H{
				"error":    "Poster not available",
				"media_id": mediaID,
			})
			return
		}

		// Serve and cache
		h.serveAndCacheAsset(c, mediaID, "poster", posterPath)
	}
}

// WarmAssetCache pre-loads assets into Redis cache
func (h *RedisAssetHandlers) WarmAssetCache() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get limit parameter
		limit := 100
		if limitStr := c.Query("limit"); limitStr != "" {
			if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 && parsed <= 1000 {
				limit = parsed
			}
		}

		// Get media items
		allMedia, err := h.mediaService.GetAllMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get media"})
			return
		}

		// Limit processing
		if len(allMedia) > limit {
			allMedia = allMedia[:limit]
		}

		warmed := 0
		errors := 0

		// Warm cache for each media item
		for _, media := range allMedia {
			thumbnailPath := h.findThumbnailPath(&media)
			previewPath := h.findPreviewPath(&media)
			posterPath := h.findPosterPath(&media)

			err := h.redisCache.WarmCache(media.ID, thumbnailPath, previewPath, posterPath)
			if err != nil {
				errors++
			} else {
				warmed++
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":        "completed",
			"total_media":   len(allMedia),
			"warmed":        warmed,
			"errors":        errors,
			"message":       fmt.Sprintf("Cache warmed for %d media items", warmed),
		})
	}
}

// GetCacheStats returns Redis cache statistics
func (h *RedisAssetHandlers) GetCacheStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		stats, err := h.redisCache.GetCacheStats()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get cache stats"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"cache_stats": stats,
			"timestamp":   time.Now(),
		})
	}
}

// ClearAssetCache clears all cached assets
func (h *RedisAssetHandlers) ClearAssetCache() gin.HandlerFunc {
	return func(c *gin.Context) {
		err := h.redisCache.ClearCache()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear cache"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "Asset cache cleared successfully",
		})
	}
}

// Helper methods

func (h *RedisAssetHandlers) findThumbnailPath(media *models.Media) string {
	// Check database path first
	if media.ThumbnailPath != "" {
		if h.resolveRelativePath(media.ThumbnailPath) != "" {
			return h.resolveRelativePath(media.ThumbnailPath)
		}
	}

	// Check common patterns (optimized - only 4 most common)
	patterns := []string{
		fmt.Sprintf("./thumbnails/thumb_%d_%s.jpg", media.ID, h.sanitizeFilename(media.Title)),
		fmt.Sprintf("./thumbnails/thumb_%d.jpg", media.ID),
		fmt.Sprintf("./backend/thumbnails/thumb_%d_%s.jpg", media.ID, h.sanitizeFilename(media.Title)),
		fmt.Sprintf("./backend/thumbnails/thumb_%d.jpg", media.ID),
	}

	for _, pattern := range patterns {
		if _, err := os.Stat(pattern); err == nil {
			return pattern
		}
	}

	return ""
}

func (h *RedisAssetHandlers) findPreviewPath(media *models.Media) string {
	// Check database paths
	if media.PreviewClipPath != "" {
		if h.resolveRelativePath(media.PreviewClipPath) != "" {
			return h.resolveRelativePath(media.PreviewClipPath)
		}
	}

	if media.PreviewPath != "" {
		if h.resolveRelativePath(media.PreviewPath) != "" {
			return h.resolveRelativePath(media.PreviewPath)
		}
	}

	// Check common patterns
	patterns := []string{
		fmt.Sprintf("./previews/preview_%d_%s.mp4", media.ID, h.sanitizeFilename(media.Title)),
		fmt.Sprintf("./previews/preview_%d.mp4", media.ID),
		fmt.Sprintf("./backend/previews/preview_%d_%s.mp4", media.ID, h.sanitizeFilename(media.Title)),
		fmt.Sprintf("./backend/previews/preview_%d.mp4", media.ID),
	}

	for _, pattern := range patterns {
		if _, err := os.Stat(pattern); err == nil {
			return pattern
		}
	}

	return ""
}

func (h *RedisAssetHandlers) findPosterPath(media *models.Media) string {
	// Check database path
	if media.PosterPath != "" {
		if h.resolveRelativePath(media.PosterPath) != "" {
			return h.resolveRelativePath(media.PosterPath)
		}
	}

	// Check common patterns
	patterns := []string{
		fmt.Sprintf("./posters/poster_%d_%s.jpg", media.ID, h.sanitizeFilename(media.Title)),
		fmt.Sprintf("./posters/poster_%d.jpg", media.ID),
		fmt.Sprintf("./backend/posters/poster_%d_%s.jpg", media.ID, h.sanitizeFilename(media.Title)),
		fmt.Sprintf("./backend/posters/poster_%d.jpg", media.ID),
	}

	for _, pattern := range patterns {
		if _, err := os.Stat(pattern); err == nil {
			return pattern
		}
	}

	return ""
}

func (h *RedisAssetHandlers) resolveRelativePath(path string) string {
	// If path is relative and doesn't start with ./ or /, prepend ./backend/
	if path != "" && !strings.HasPrefix(path, "/") && !strings.HasPrefix(path, "./") {
		resolvedPath := "./backend/" + path
		if _, err := os.Stat(resolvedPath); err == nil {
			return resolvedPath
		}
	}

	// Check original path
	if _, err := os.Stat(path); err == nil {
		return path
	}

	return ""
}

func (h *RedisAssetHandlers) sanitizeFilename(filename string) string {
	invalidChars := []string{"/", "\\", ":", "*", "?", "\"", "<", ">", "|", " "}
	result := filename
	for _, char := range invalidChars {
		result = strings.ReplaceAll(result, char, "_")
	}
	return result
}

func (h *RedisAssetHandlers) setOptimalHeaders(c *gin.Context, assetType string, metadata *services.AssetMetadata) {
	// Set aggressive caching headers for instant loading
	c.Header("Cache-Control", "public, max-age=86400, immutable") // 24 hour cache
	c.Header("Accept-Ranges", "bytes")
	c.Header("X-Content-Type-Options", "nosniff")

	// Set content type based on asset type
	switch assetType {
	case "thumbnail", "poster":
		if metadata != nil && metadata.ContentType != "" {
			c.Header("Content-Type", metadata.ContentType)
		} else {
			c.Header("Content-Type", "image/jpeg")
		}
	case "preview":
		c.Header("Content-Type", "video/mp4")
	}

	// Add CORS headers for cross-origin requests
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Range")
	c.Header("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges")
}

func (h *RedisAssetHandlers) serveAndCacheAsset(c *gin.Context, mediaID uint, assetType, filePath string) {
	// Set headers
	h.setOptimalHeaders(c, assetType, nil)
	c.Header("X-Cache", "REDIS-MISS")

	// Serve file
	c.File(filePath)

	// Cache asset in background (for small files like thumbnails/posters)
	if assetType == "thumbnail" || assetType == "poster" {
		go h.redisCache.SetAsset(mediaID, assetType, filePath)
	} else {
		// For large files like previews, cache path only
		go h.redisCache.SetAssetPath(mediaID, assetType, filePath)
	}
}

func (h *RedisAssetHandlers) generateAndCacheThumbnail(media *models.Media) {
	thumbnailPath, err := h.thumbnailService.GenerateThumbnail(media.FilePath, media.ID, media.Title)
	if err != nil {
		return
	}

	// Update database
	media.ThumbnailPath = thumbnailPath
	h.mediaService.UpdateMedia(media)

	// Cache the generated thumbnail
	h.redisCache.SetAsset(media.ID, "thumbnail", thumbnailPath)
}

func (h *RedisAssetHandlers) generateAndCachePreview(media *models.Media) {
	previewPath, err := h.thumbnailService.GeneratePreviewClip(media.FilePath, media.ID, media.Title)
	if err != nil {
		return
	}

	// Update database
	media.PreviewClipPath = previewPath
	h.mediaService.UpdateMedia(media)

	// Cache the preview path
	h.redisCache.SetAssetPath(media.ID, "preview", previewPath)
}
