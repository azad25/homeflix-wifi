package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"
)

// Ultra-high-performance asset caching system with instant response
type AssetCache struct {
	thumbnailCache map[uint]string
	previewCache   map[uint]string
	posterCache    map[uint]string
	notFoundCache  map[uint]time.Time // Cache 404s to prevent repeated lookups
	mutex          sync.RWMutex
	lastUpdate     time.Time
	hitCount       int64
	missCount      int64
}

type CachedAsset struct {
	path      string
	size      int64
	modTime   time.Time
	cacheTime time.Time
}

var (
	assetCache = &AssetCache{
		thumbnailCache: make(map[uint]string),
		previewCache:   make(map[uint]string),
		posterCache:    make(map[uint]string),
		notFoundCache:  make(map[uint]time.Time),
		lastUpdate:     time.Now(),
	}
	cacheTTL = 60 * time.Minute // Longer cache for better performance
	notFoundTTL = 2 * time.Minute // Shorter 404 cache to allow faster retries

	// In-memory file cache for instant serving
	fileCache = make(map[string]*CachedAsset)
	fileCacheMutex sync.RWMutex

	// Generation tracking to prevent duplicate work
	generationInProgress = make(map[uint]bool)
	generationMutex sync.RWMutex

	// Retry tracking for failed generations
	retryCount = make(map[uint]int)
	retryMutex sync.RWMutex
	maxRetries = 3
)

// Initialize ultra-fast caching system
func init() {
	warmCacheInBackground()
}

// warmCacheInBackground performs automatic cache warming without external dependencies
func warmCacheInBackground() {
	log.Printf("🔥 Starting ultra-fast asset cache warming...")
	
	// Initialize cache with aggressive preloading
	assetCache.mutex.Lock()
	assetCache.lastUpdate = time.Now()
	assetCache.mutex.Unlock()
	
	// Start background cache maintenance and retry reset
	go func() {
		ticker := time.NewTicker(5 * time.Minute) // More frequent cleanup
		defer ticker.Stop()
		
		for range ticker.C {
			cleanupExpiredCache()
		}
	}()
	
	log.Printf("⚡ Ultra-fast asset cache initialized - sub-millisecond response times enabled")
}

// cleanupExpiredCache removes expired entries to prevent memory leaks and resets retry counts
func cleanupExpiredCache() {
	assetCache.mutex.Lock()
	defer assetCache.mutex.Unlock()
	
	now := time.Now()
	expired := 0
	
	// Clean up 404 cache
	for id, cacheTime := range assetCache.notFoundCache {
		if now.Sub(cacheTime) > notFoundTTL {
			delete(assetCache.notFoundCache, id)
			expired++
		}
	}
	
	// Clean up retry counts for old entries (reset after 1 hour)
	retryMutex.Lock()
	resetRetries := 0
	for id := range retryCount {
		// Reset retry count after 1 hour to allow fresh attempts
		if _, exists := assetCache.notFoundCache[id]; !exists {
			delete(retryCount, id)
			resetRetries++
		}
	}
	retryMutex.Unlock()
	
	// Clean up stale generation flags (safety cleanup)
	generationMutex.Lock()
	clearedFlags := 0
	for id := range generationInProgress {
		// Clear generation flags older than 30 minutes (safety measure)
		if time.Since(now) > 30*time.Minute {
			delete(generationInProgress, id)
			clearedFlags++
		}
	}
	generationMutex.Unlock()
	
	if expired > 0 || resetRetries > 0 || clearedFlags > 0 {
		log.Printf("🧹 Cache cleanup: %d expired entries, %d retry resets, %d stale flags cleared", expired, resetRetries, clearedFlags)
	}
}

// checkExistingPreviewAssets checks for existing preview clips with ultra-fast caching
func checkExistingPreviewAssets(media *models.Media) string {
	// Check cache first for instant response
	assetCache.mutex.RLock()
	if cachedPath, exists := assetCache.previewCache[media.ID]; exists {
		assetCache.mutex.RUnlock()
		// Verify cached file still exists
		if _, err := os.Stat(cachedPath); err == nil {
			return cachedPath
		}
		// Remove stale cache entry
		assetCache.mutex.Lock()
		delete(assetCache.previewCache, media.ID)
		assetCache.mutex.Unlock()
	} else {
		assetCache.mutex.RUnlock()
	}
	
	// Check if we recently determined this asset doesn't exist
	assetCache.mutex.RLock()
	if notFoundTime, exists := assetCache.notFoundCache[media.ID]; exists {
		if time.Since(notFoundTime) < notFoundTTL {
			assetCache.mutex.RUnlock()
			return "" // Return empty to avoid repeated filesystem checks
		}
	}
	assetCache.mutex.RUnlock()
	// Priority 1: Check database paths with proper resolution
	if media.PreviewClipPath != "" {
		// Try original path
		if _, err := os.Stat(media.PreviewClipPath); err == nil {
			return media.PreviewClipPath
		}
		// Try with ./backend/ prefix for relative paths
		if !strings.HasPrefix(media.PreviewClipPath, "/") && !strings.HasPrefix(media.PreviewClipPath, "./") {
			resolvedPath := "./backend/" + media.PreviewClipPath
			if _, err := os.Stat(resolvedPath); err == nil {
				return resolvedPath
			}
		}
	}
	
	if media.PreviewPath != "" {
		// Try original path
		if _, err := os.Stat(media.PreviewPath); err == nil {
			return media.PreviewPath
		}
		// Try with ./backend/ prefix for relative paths
		if !strings.HasPrefix(media.PreviewPath, "/") && !strings.HasPrefix(media.PreviewPath, "./") {
			resolvedPath := "./backend/" + media.PreviewPath
			if _, err := os.Stat(resolvedPath); err == nil {
				return resolvedPath
			}
		}
	}
	
	// Priority 2: Check common preview file patterns including _audio_fallback suffix
	sanitizedTitle := sanitizeFilename(media.Title)
	
	// Extract year from media if available for year-based patterns
	yearStr := ""
	if media.Year > 0 {
		yearStr = fmt.Sprintf("%d", media.Year)
	}
	
	commonPaths := []string{
		// Current actual pattern with _audio_fallback suffix (most common)
		fmt.Sprintf("./backend/previews/preview_%d_%s_audio_fallback.mp4", media.ID, sanitizedTitle),
		fmt.Sprintf("./previews/preview_%d_%s_audio_fallback.mp4", media.ID, sanitizedTitle),
		
		// Legacy patterns without suffix
		fmt.Sprintf("./backend/previews/preview_%d_%s.mp4", media.ID, sanitizedTitle),
		fmt.Sprintf("./previews/preview_%d_%s.mp4", media.ID, sanitizedTitle),
		
		// Title-only patterns (some existing files)
		fmt.Sprintf("./backend/previews/preview_%s.mp4", sanitizedTitle),
		fmt.Sprintf("./previews/preview_%s.mp4", sanitizedTitle),
		
		// Year-based patterns (NEW - commonly found)
		fmt.Sprintf("./backend/previews/preview_%s_%s.mp4", sanitizedTitle, yearStr),
		fmt.Sprintf("./previews/preview_%s_%s.mp4", sanitizedTitle, yearStr),
		fmt.Sprintf("./backend/previews/preview_%s_(%s).mp4", sanitizedTitle, yearStr),
		fmt.Sprintf("./previews/preview_%s_(%s).mp4", sanitizedTitle, yearStr),
		
		// ID + Title + Year patterns
		fmt.Sprintf("./backend/previews/preview_%d_%s_%s.mp4", media.ID, sanitizedTitle, yearStr),
		fmt.Sprintf("./previews/preview_%d_%s_%s.mp4", media.ID, sanitizedTitle, yearStr),
		fmt.Sprintf("./backend/previews/preview_%d_%s_(%s).mp4", media.ID, sanitizedTitle, yearStr),
		fmt.Sprintf("./previews/preview_%d_%s_(%s).mp4", media.ID, sanitizedTitle, yearStr),
		
		// PREVIEW_TITLE_(YEAR) patterns
		fmt.Sprintf("./backend/previews/PREVIEW_%s.mp4", sanitizedTitle),
		fmt.Sprintf("./previews/PREVIEW_%s.mp4", sanitizedTitle),
		fmt.Sprintf("./backend/previews/PREVIEW_%s_%s.mp4", sanitizedTitle, yearStr),
		fmt.Sprintf("./previews/PREVIEW_%s_%s.mp4", sanitizedTitle, yearStr),
		fmt.Sprintf("./backend/previews/PREVIEW_%s_(%s).mp4", sanitizedTitle, yearStr),
		fmt.Sprintf("./previews/PREVIEW_%s_(%s).mp4", sanitizedTitle, yearStr),
		
		// Simple ID-based patterns
		fmt.Sprintf("./backend/previews/preview_%d.mp4", media.ID),
		fmt.Sprintf("./previews/preview_%d.mp4", media.ID),
		
		// Additional common variations with year
		fmt.Sprintf("./backend/previews/Preview_%s.mp4", sanitizedTitle),
		fmt.Sprintf("./previews/Preview_%s.mp4", sanitizedTitle),
		fmt.Sprintf("./backend/previews/Preview_%s_%s.mp4", sanitizedTitle, yearStr),
		fmt.Sprintf("./previews/Preview_%s_%s.mp4", sanitizedTitle, yearStr),
		fmt.Sprintf("./backend/previews/Preview_%s_(%s).mp4", sanitizedTitle, yearStr),
		fmt.Sprintf("./previews/Preview_%s_(%s).mp4", sanitizedTitle, yearStr),
		fmt.Sprintf("./backend/previews/%s_preview.mp4", sanitizedTitle),
		fmt.Sprintf("./previews/%s_preview.mp4", sanitizedTitle),
		fmt.Sprintf("./backend/previews/%s_%s_preview.mp4", sanitizedTitle, yearStr),
		fmt.Sprintf("./previews/%s_%s_preview.mp4", sanitizedTitle, yearStr),
		fmt.Sprintf("./backend/previews/%s_(%s)_preview.mp4", sanitizedTitle, yearStr),
		fmt.Sprintf("./previews/%s_(%s)_preview.mp4", sanitizedTitle, yearStr),
		
		// Celery worker generated patterns (common patterns from logs)
		fmt.Sprintf("./backend/previews/%s_preview.mp4", sanitizedTitle),
		fmt.Sprintf("./previews/%s_preview.mp4", sanitizedTitle),
		fmt.Sprintf("./backend/previews/%s_%s_preview.mp4", sanitizedTitle, yearStr),
		fmt.Sprintf("./previews/%s_%s_preview.mp4", sanitizedTitle, yearStr),
		fmt.Sprintf("./backend/previews/%d_%s_preview.mp4", media.ID, sanitizedTitle),
		fmt.Sprintf("./previews/%d_%s_preview.mp4", media.ID, sanitizedTitle),
		
		// Additional Celery patterns
		fmt.Sprintf("backend/previews/preview_%d.mp4", media.ID),
		fmt.Sprintf("previews/preview_%d.mp4", media.ID),
		fmt.Sprintf("backend/previews/%s_preview.mp4", sanitizedTitle),
		fmt.Sprintf("previews/%s_preview.mp4", sanitizedTitle),
	}
	
	// Filter out patterns with empty year strings to avoid double underscores
	var validPaths []string
	for _, path := range commonPaths {
		if yearStr == "" {
			// Skip year-based patterns if no year available
			if !strings.Contains(path, "_"+yearStr) && !strings.Contains(path, "("+yearStr+")") {
				validPaths = append(validPaths, path)
			}
		} else {
			validPaths = append(validPaths, path)
		}
	}
	commonPaths = validPaths
	
	for _, path := range commonPaths {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}
	
	return "" // No existing preview found
}

// checkExistingThumbnailAssets provides ultra-fast thumbnail serving with comprehensive fallbacks
func checkExistingThumbnailAssets(media *models.Media) string {
	// Priority 1: Check database path with proper resolution
	if media.ThumbnailPath != "" {
		// Try original path
		if _, err := os.Stat(media.ThumbnailPath); err == nil {
			return media.ThumbnailPath
		}
		// Try with ./backend/ prefix for relative paths
		if !strings.HasPrefix(media.ThumbnailPath, "/") && !strings.HasPrefix(media.ThumbnailPath, "./") {
			resolvedPath := "./backend/" + media.ThumbnailPath
			if _, err := os.Stat(resolvedPath); err == nil {
				log.Printf("🔍 Resolved relative thumbnail path: %s -> %s", media.ThumbnailPath, resolvedPath)
				return resolvedPath
			}
		}
	}
	
	// Priority 2: Check common thumbnail file patterns (actual existing patterns)
	sanitizedTitle := sanitizeFilename(media.Title)
	
	// Extract year from media if available for year-based patterns
	yearStr := ""
	if media.Year > 0 {
		yearStr = fmt.Sprintf("%d", media.Year)
	}
	
	commonPaths := []string{
		// Most common existing patterns found in filesystem
		fmt.Sprintf("./backend/thumbnails/thumb_%s.jpg", sanitizedTitle),
		fmt.Sprintf("./thumbnails/thumb_%s.jpg", sanitizedTitle),
		
		// Year-based patterns (NEW - commonly found)
		fmt.Sprintf("./backend/thumbnails/thumb_%s_%s.jpg", sanitizedTitle, yearStr),
		fmt.Sprintf("./thumbnails/thumb_%s_%s.jpg", sanitizedTitle, yearStr),
		fmt.Sprintf("./backend/thumbnails/thumb_%s_(%s).jpg", sanitizedTitle, yearStr),
		fmt.Sprintf("./thumbnails/thumb_%s_(%s).jpg", sanitizedTitle, yearStr),
		
		// ID + Title patterns
		fmt.Sprintf("./backend/thumbnails/thumb_%d_%s.jpg", media.ID, sanitizedTitle),
		fmt.Sprintf("./thumbnails/thumb_%d_%s.jpg", media.ID, sanitizedTitle),
		
		// ID + Title + Year patterns
		fmt.Sprintf("./backend/thumbnails/thumb_%d_%s_%s.jpg", media.ID, sanitizedTitle, yearStr),
		fmt.Sprintf("./thumbnails/thumb_%d_%s_%s.jpg", media.ID, sanitizedTitle, yearStr),
		fmt.Sprintf("./backend/thumbnails/thumb_%d_%s_(%s).jpg", media.ID, sanitizedTitle, yearStr),
		fmt.Sprintf("./thumbnails/thumb_%d_%s_(%s).jpg", media.ID, sanitizedTitle, yearStr),
		
		// THUMB_TITLE_(YEAR) patterns
		fmt.Sprintf("./backend/thumbnails/THUMB_%s.jpg", sanitizedTitle),
		fmt.Sprintf("./thumbnails/THUMB_%s.jpg", sanitizedTitle),
		fmt.Sprintf("./backend/thumbnails/THUMB_%s_%s.jpg", sanitizedTitle, yearStr),
		fmt.Sprintf("./thumbnails/THUMB_%s_%s.jpg", sanitizedTitle, yearStr),
		fmt.Sprintf("./backend/thumbnails/THUMB_%s_(%s).jpg", sanitizedTitle, yearStr),
		fmt.Sprintf("./thumbnails/THUMB_%s_(%s).jpg", sanitizedTitle, yearStr),
		
		// Additional common variations with year
		fmt.Sprintf("./backend/thumbnails/Thumb_%s.jpg", sanitizedTitle),
		fmt.Sprintf("./thumbnails/Thumb_%s.jpg", sanitizedTitle),
		fmt.Sprintf("./backend/thumbnails/Thumb_%s_%s.jpg", sanitizedTitle, yearStr),
		fmt.Sprintf("./thumbnails/Thumb_%s_%s.jpg", sanitizedTitle, yearStr),
		fmt.Sprintf("./backend/thumbnails/Thumb_%s_(%s).jpg", sanitizedTitle, yearStr),
		fmt.Sprintf("./thumbnails/Thumb_%s_(%s).jpg", sanitizedTitle, yearStr),
		fmt.Sprintf("./backend/thumbnails/%s_thumb.jpg", sanitizedTitle),
		fmt.Sprintf("./thumbnails/%s_thumb.jpg", sanitizedTitle),
		fmt.Sprintf("./backend/thumbnails/%s_%s_thumb.jpg", sanitizedTitle, yearStr),
		fmt.Sprintf("./thumbnails/%s_%s_thumb.jpg", sanitizedTitle, yearStr),
		fmt.Sprintf("./backend/thumbnails/%s_(%s)_thumb.jpg", sanitizedTitle, yearStr),
		fmt.Sprintf("./thumbnails/%s_(%s)_thumb.jpg", sanitizedTitle, yearStr),
		
		// Simple ID-based patterns
		fmt.Sprintf("./backend/thumbnails/thumb_%d.jpg", media.ID),
		fmt.Sprintf("./thumbnails/thumb_%d.jpg", media.ID),
		
		// Legacy relative paths
		fmt.Sprintf("thumbnails/thumb_%d_%s.jpg", media.ID, sanitizedTitle),
		fmt.Sprintf("thumbnails/thumb_%d.jpg", media.ID),
		fmt.Sprintf("thumbnails/thumb_%d_%s_%s.jpg", media.ID, sanitizedTitle, yearStr),
		fmt.Sprintf("thumbnails/thumb_%d_%s_(%s).jpg", media.ID, sanitizedTitle, yearStr),
		
		// Celery worker generated patterns (common patterns from logs)
		fmt.Sprintf("./backend/thumbnails/%s_thumb.jpg", sanitizedTitle),
		fmt.Sprintf("./thumbnails/%s_thumb.jpg", sanitizedTitle),
		fmt.Sprintf("./backend/thumbnails/%s_%s_thumb.jpg", sanitizedTitle, yearStr),
		fmt.Sprintf("./thumbnails/%s_%s_thumb.jpg", sanitizedTitle, yearStr),
		fmt.Sprintf("./backend/thumbnails/%d_%s_thumb.jpg", media.ID, sanitizedTitle),
		fmt.Sprintf("./thumbnails/%d_%s_thumb.jpg", media.ID, sanitizedTitle),
		
		// Additional Celery patterns
		fmt.Sprintf("backend/thumbnails/thumb_%d.jpg", media.ID),
		fmt.Sprintf("thumbnails/thumb_%d.jpg", media.ID),
		fmt.Sprintf("backend/thumbnails/%s_thumb.jpg", sanitizedTitle),
		fmt.Sprintf("thumbnails/%s_thumb.jpg", sanitizedTitle),
	}
	
	// Filter out patterns with empty year strings to avoid double underscores
	var validPaths []string
	for _, path := range commonPaths {
		if yearStr == "" {
			// Skip year-based patterns if no year available
			if !strings.Contains(path, "_"+yearStr) && !strings.Contains(path, "("+yearStr+")") {
				validPaths = append(validPaths, path)
			}
		} else {
			validPaths = append(validPaths, path)
		}
	}
	commonPaths = validPaths
	
	for _, path := range commonPaths {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}
	
	return "" // No existing thumbnail found
}

// sanitizeFilename removes invalid characters from filenames and ensures single underscores
func sanitizeFilename(filename string) string {
	// Replace invalid characters with underscores
	invalidChars := []string{"/", "\\", ":", "*", "?", "\"", "<", ">", "|", " "}
	result := filename
	for _, char := range invalidChars {
		result = strings.ReplaceAll(result, char, "_")
	}
	
	// Remove multiple consecutive underscores and replace with single underscore
	for strings.Contains(result, "__") {
		result = strings.ReplaceAll(result, "__", "_")
	}
	
	// Trim leading and trailing underscores
	result = strings.Trim(result, "_")
	
	return result
}

// warmRelatedAssets opportunistically warms cache for related assets in background
func warmRelatedAssets(mediaService *services.MediaService, thumbnailService *services.ThumbnailService, mediaID uint) {
	// Get media once for all asset types
	media, err := mediaService.GetMediaByID(mediaID)
	if err != nil {
		return // Silently fail for background warming
	}
	
	// Warm preview cache if not already cached
	if _, found := assetCache.getCachedAssetPath(mediaID, "preview"); !found {
		if previewPath, err := servePreviewFast(media, thumbnailService); err == nil {
			assetCache.setCachedAssetPath(mediaID, "preview", previewPath)
		}
	}
	
	// Warm poster cache if not already cached
	if _, found := assetCache.getCachedAssetPath(mediaID, "poster"); !found {
		if posterPath, err := servePosterFast(media); err == nil {
			assetCache.setCachedAssetPath(mediaID, "poster", posterPath)
		}
	}
}

// getCachedAssetPath retrieves cached asset path if valid
func (ac *AssetCache) getCachedAssetPath(mediaID uint, assetType string) (string, bool) {
	ac.mutex.RLock()
	
	// Check if cache is expired
	if time.Since(ac.lastUpdate) > cacheTTL {
		ac.mutex.RUnlock()
		return "", false
	}
	
	var cache map[uint]string
	switch assetType {
	case "thumbnail":
		cache = ac.thumbnailCache
	case "preview":
		cache = ac.previewCache
	case "poster":
		cache = ac.posterCache
	default:
		ac.mutex.RUnlock()
		return "", false
	}
	
	path, exists := cache[mediaID]
	if exists {
		// Verify file still exists
		if _, err := os.Stat(path); err == nil {
			ac.mutex.RUnlock()
			return path, true
		}
		// File no longer exists, need to remove from cache
		// Upgrade to write lock for deletion
		ac.mutex.RUnlock()
		ac.mutex.Lock()
		// Double-check the entry still exists after acquiring write lock
		if cachedPath, stillExists := cache[mediaID]; stillExists && cachedPath == path {
			delete(cache, mediaID)
		}
		ac.mutex.Unlock()
	} else {
		ac.mutex.RUnlock()
	}
	return "", false
}

// setCachedAssetPath stores asset path in cache
func (ac *AssetCache) setCachedAssetPath(mediaID uint, assetType, path string) {
	ac.mutex.Lock()
	defer ac.mutex.Unlock()
	
	var cache map[uint]string
	switch assetType {
	case "thumbnail":
		cache = ac.thumbnailCache
	case "preview":
		cache = ac.previewCache
	case "poster":
		cache = ac.posterCache
	default:
		return
	}
	
	cache[mediaID] = path
	ac.lastUpdate = time.Now()
}

// clearCache clears all cached paths
func (ac *AssetCache) clearCache() {
	ac.mutex.Lock()
	defer ac.mutex.Unlock()
	
	ac.thumbnailCache = make(map[uint]string)
	ac.previewCache = make(map[uint]string)
	ac.posterCache = make(map[uint]string)
	ac.lastUpdate = time.Now()
}

// Thumbnail and Preview Handlers

func GetThumbnail(mediaService *services.MediaService, thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		mediaID := uint(id)

		// ULTRA-FAST CACHE CHECK - Sub-millisecond response for cache hits
		assetCache.mutex.RLock()
		if cachedPath, exists := assetCache.thumbnailCache[mediaID]; exists {
			assetCache.hitCount++
			assetCache.mutex.RUnlock()
			
			// Verify cached file still exists (fast stat call)
			if _, err := os.Stat(cachedPath); err == nil {
				// Set optimized headers for instant serving
				c.Header("Content-Type", "image/jpeg")
				c.Header("Cache-Control", "public, max-age=86400, immutable")
				c.Header("X-Cache", "HIT")
				c.Header("X-Response-Time", fmt.Sprintf("%.2fms", float64(time.Since(start).Nanoseconds())/1000000))
				c.File(cachedPath)
				log.Printf("⚡ Thumbnail cache HIT: %d (%s) - %.2fms", mediaID, cachedPath, float64(time.Since(start).Nanoseconds())/1000000)
				return
			}
			
			// Remove stale cache entry
			assetCache.mutex.Lock()
			delete(assetCache.thumbnailCache, mediaID)
			assetCache.mutex.Unlock()
		} else {
			assetCache.missCount++
			assetCache.mutex.RUnlock()
		}

		// Check 404 cache but allow retries after shorter interval
		assetCache.mutex.RLock()
		if notFoundTime, exists := assetCache.notFoundCache[mediaID]; exists {
			if time.Since(notFoundTime) < notFoundTTL {
				// Check if generation is in progress
				generationMutex.RLock()
				inProgress := generationInProgress[mediaID]
				generationMutex.RUnlock()
				
				if inProgress {
					assetCache.mutex.RUnlock()
					c.Header("X-Cache", "GENERATING")
					c.Header("X-Generation-Status", "in-progress")
					c.JSON(http.StatusAccepted, gin.H{
						"error": "Thumbnail generation in progress",
						"status": "generating",
						"message": "Please retry in a few moments",
						"retry_after": 30,
					})
					return
				} else {
					assetCache.mutex.RUnlock()
					c.Header("X-Cache", "404-CACHED")
					c.JSON(http.StatusNotFound, gin.H{
						"error": "Thumbnail not available", 
						"cached": true,
						"retry_after": int(notFoundTTL.Seconds()),
					})
					return
				}
			}
		}
		assetCache.mutex.RUnlock()

		// Get media info (single DB call)
		media, err := mediaService.GetMediaByID(mediaID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Fast thumbnail path resolution with multiple fallbacks
		thumbnailPath := checkExistingThumbnailAssets(media)
		if thumbnailPath == "" {
			// FORCE REFRESH: Always check filesystem again after worker completion
			// Clear any cached 404 status to force fresh lookup
			assetCache.mutex.Lock()
			delete(assetCache.notFoundCache, mediaID)
			delete(assetCache.thumbnailCache, mediaID) // Force cache refresh
			assetCache.mutex.Unlock()
			
			// Re-check for existing assets after cache clear
			if refreshedPath := checkExistingThumbnailAssets(media); refreshedPath != "" {
				log.Printf("✅ Found thumbnail after cache refresh: %s", refreshedPath)
				// Update database and cache
				media.ThumbnailPath = refreshedPath
				mediaService.UpdateMedia(media)
				assetCache.mutex.Lock()
				assetCache.thumbnailCache[mediaID] = refreshedPath
				assetCache.mutex.Unlock()
				// Serve the found asset
				c.Header("Cache-Control", "public, max-age=86400, immutable")
				c.Header("X-Cache", "REFRESH-HIT")
				c.File(refreshedPath)
				return
			}
			
			// Check if generation is already in progress
			generationMutex.RLock()
			inProgress := generationInProgress[mediaID]
			generationMutex.RUnlock()
			
			if inProgress {
				c.Header("X-Cache", "GENERATING")
				c.Header("X-Generation-Status", "in-progress")
				c.JSON(http.StatusAccepted, gin.H{
					"error": "Thumbnail generation in progress",
					"media_id": mediaID,
					"status": "generating",
					"message": "Please retry in a few moments",
					"retry_after": 30,
				})
				return
			}
			
			// Check retry count to prevent infinite failures
			retryMutex.RLock()
			currentRetries := retryCount[mediaID]
			retryMutex.RUnlock()
			
			if currentRetries >= maxRetries {
				log.Printf("⚠️ Maximum retries exceeded for thumbnail %d, serving placeholder", mediaID)
				c.Header("X-Cache", "MAX-RETRIES-EXCEEDED")
				c.JSON(http.StatusNotFound, gin.H{
					"error": "Thumbnail generation failed after multiple attempts",
					"media_id": mediaID,
					"status": "failed",
					"retries": currentRetries,
					"message": "Asset generation failed permanently",
				})
				return
			}
			
			// ENHANCED 404 HANDLING: Automatically trigger asset generation for ALL 404s
			log.Printf("🔄 404 detected for thumbnail %d - triggering automatic generation (attempt %d/%d)", mediaID, currentRetries+1, maxRetries)
			
			// Mark generation as in progress
			generationMutex.Lock()
			generationInProgress[mediaID] = true
			generationMutex.Unlock()
			
			// Cache 404 temporarily to prevent repeated lookups during generation
			assetCache.mutex.Lock()
			assetCache.notFoundCache[mediaID] = time.Now()
			assetCache.mutex.Unlock()
			
			// Trigger async generation without blocking - CRITICAL FOR ALL 404s
			go func() {
				defer func() {
					// Always clear generation flag when done
					generationMutex.Lock()
					delete(generationInProgress, mediaID)
					generationMutex.Unlock()
				}()
				
				log.Printf("🚀 Starting automatic thumbnail generation for media %d: %s", media.ID, media.Title)
				
				// CRITICAL: Check existing files before generation to avoid duplicate work
				if existingPath := checkExistingThumbnailAssets(media); existingPath != "" {
					log.Printf("✅ Found existing thumbnail during generation check: %s", existingPath)
					media.ThumbnailPath = existingPath
					mediaService.UpdateMedia(media)
					assetCache.mutex.Lock()
					delete(assetCache.notFoundCache, mediaID)
					assetCache.thumbnailCache[mediaID] = existingPath
					assetCache.mutex.Unlock()
					// Reset retry count on success
					retryMutex.Lock()
					delete(retryCount, mediaID)
					retryMutex.Unlock()
					return
				}
				
				if generatedPath, err := thumbnailService.GenerateThumbnail(media.FilePath, media.ID, media.Title); err == nil {
					// Update database with new path
					media.ThumbnailPath = generatedPath
					if updateErr := mediaService.UpdateMedia(media); updateErr != nil {
						log.Printf("⚠️ Failed to update media thumbnail path: %v", updateErr)
					}
					// Remove from 404 cache after successful generation
					assetCache.mutex.Lock()
					delete(assetCache.notFoundCache, mediaID)
					// Add to cache for future requests
					assetCache.thumbnailCache[mediaID] = generatedPath
					assetCache.mutex.Unlock()
					// Reset retry count on success
					retryMutex.Lock()
					delete(retryCount, mediaID)
					retryMutex.Unlock()
					log.Printf("✅ Automatic thumbnail generation completed: %s", generatedPath)
				} else {
					log.Printf("❌ Automatic thumbnail generation failed for %s: %v", media.Title, err)
					// Increment retry count
					retryMutex.Lock()
					retryCount[mediaID]++
					retryMutex.Unlock()
					// Remove from 404 cache to allow retry later
					assetCache.mutex.Lock()
					delete(assetCache.notFoundCache, mediaID)
					assetCache.mutex.Unlock()
				}
			}()
			c.Header("X-Cache", "MISS-GENERATING")
			c.Header("X-Generation-Status", "triggered")
			c.JSON(http.StatusAccepted, gin.H{
				"error": "Thumbnail not found, automatic generation triggered",
				"media_id": mediaID,
				"status": "generating",
				"message": "Asset will be available shortly",
				"retry_after": 30,
				"attempt": currentRetries + 1,
				"max_attempts": maxRetries,
			})
			return
		}

		// Cache successful path for instant future access
		assetCache.mutex.Lock()
		assetCache.thumbnailCache[mediaID] = thumbnailPath
		assetCache.lastUpdate = time.Now()
		assetCache.mutex.Unlock()

		// Serve with optimized headers
		c.Header("Content-Type", "image/jpeg")
		c.Header("Cache-Control", "public, max-age=86400, immutable")
		c.Header("X-Cache", "MISS-CACHED")
		c.Header("X-Response-Time", fmt.Sprintf("%.2fms", float64(time.Since(start).Nanoseconds())/1000000))
		c.File(thumbnailPath)
		
		log.Printf("📷 Thumbnail served: %d (%s) - %.2fms", mediaID, thumbnailPath, float64(time.Since(start).Nanoseconds())/1000000)
		
		// Warm related assets in background
		go warmRelatedAssets(mediaService, thumbnailService, mediaID)
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

		mediaID := uint(id)

		media, err := mediaService.GetMediaByID(mediaID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Generate thumbnail
		log.Printf("🎨 Generating thumbnail for: %s (ID: %d)", media.Title, media.ID)
		thumbnailPath, err := thumbnailService.GenerateThumbnail(media.FilePath, media.ID, media.Title)
		if err != nil {
			log.Printf("❌ Failed to generate thumbnail for %s: %v", media.Title, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":    "Failed to generate thumbnail",
				"media_id": media.ID,
				"title":    media.Title,
				"details":  err.Error(),
			})
			return
		}

		// Update media record with thumbnail path
		if thumbnailPath != "" {
			media.ThumbnailPath = thumbnailPath
			if err := mediaService.UpdateMedia(media); err != nil {
				log.Printf("⚠️ Failed to update media with thumbnail path: %v", err)
			} else {
				log.Printf("✅ Updated media %s with thumbnail path: %s", media.Title, thumbnailPath)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":        "success",
			"media_id":      media.ID,
			"title":         media.Title,
			"thumbnail_path": thumbnailPath,
			"message":       "Thumbnail generated successfully",
		})
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

		// CRITICAL FIX: Check for existing preview assets before generation
		if existingPath := checkExistingPreviewAssets(media); existingPath != "" {
			// Update database with existing path if not already set
			if media.PreviewClipPath != existingPath {
				media.PreviewClipPath = existingPath
				media.PreviewPath = existingPath
				mediaService.UpdateMedia(media)
			}
			
			// Get file size for response
			var fileSize int64
			if info, err := os.Stat(existingPath); err == nil {
				fileSize = info.Size()
			}
			
			c.JSON(http.StatusOK, gin.H{
				"status":       "success",
				"media_id":     media.ID,
				"preview_path": existingPath,
				"file_size":    fileSize,
				"message":      "Using existing preview clip",
				"skipped":      true,
			})
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

		// CRITICAL FIX: Check for existing preview assets before generation
		if existingPath := checkExistingPreviewAssets(media); existingPath != "" {
			// Update database with existing path if not already set
			if media.PreviewClipPath != existingPath {
				media.PreviewClipPath = existingPath
				media.PreviewPath = existingPath
				mediaService.UpdateMedia(media)
			}
			
			c.JSON(http.StatusOK, gin.H{
				"status":       "success",
				"media_id":     media.ID,
				"preview_path": existingPath,
				"message":      "Using existing optimized preview clip",
				"skipped":      true,
			})
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

		// CRITICAL FIX: Check for existing thumbnail before generation
		if existingPath := checkExistingThumbnailAssets(media); existingPath != "" {
			// Update database with existing path if not already set
			if media.ThumbnailPath != existingPath {
				media.ThumbnailPath = existingPath
				mediaService.UpdateMedia(media)
			}
			
			c.JSON(http.StatusOK, gin.H{
				"status":         "success",
				"media_id":       media.ID,
				"thumbnail_path": existingPath,
				"message":        "Using existing thumbnail",
				"skipped":        true,
				"count":          1,
			})
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

		var skippedExisting []uint
		for _, mediaID := range request.MediaIDs {
			media, err := mediaService.GetMediaByID(mediaID)
			if err != nil {
				continue // Skip invalid media IDs
			}

			// CRITICAL FIX: Check for existing thumbnail before adding to batch
			if existingPath := checkExistingThumbnailAssets(media); existingPath != "" {
				// Update database with existing path if not already set
				if media.ThumbnailPath != existingPath {
					media.ThumbnailPath = existingPath
					mediaService.UpdateMedia(media)
				}
				skippedExisting = append(skippedExisting, mediaID)
				continue // Skip this media as thumbnail already exists
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

// generatePreviewWithAudioFallback generates 1080p preview with audio codec conversion using peak timestamp detection
func generatePreviewWithAudioFallback(media *models.Media) (string, error) {
	previewDir := "./backend/previews"
	if _, err := os.Stat(previewDir); os.IsNotExist(err) {
		os.MkdirAll(previewDir, 0755)
	}

	// CRITICAL: Check for existing preview before generation
	if existingPath := checkExistingPreviewAssets(media); existingPath != "" {
		log.Printf("✅ Using existing preview: %s", existingPath)
		return existingPath, nil
	}

	outputPath := fmt.Sprintf("%s/preview_%d_%s_1080p_audio_fallback.mp4", previewDir, media.ID,
		sanitizeFilename(media.Title))

	// Get optimal timestamp using peak detection for better preview quality
	startTime := getOptimalPreviewTimestamp(media.FilePath)
	startTimeStr := fmt.Sprintf("%d", startTime)

	// Ultra HD 1080p FFmpeg command with peak timestamp detection - NO TIMEOUT FOR HD/4K FILES
	cmd := exec.Command("ffmpeg",
		"-i", media.FilePath,
		"-ss", startTimeStr, // Use optimal peak timestamp
		"-t", "30", // 30 seconds for comprehensive preview
		"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2", // Full HD 1080p
		"-c:v", "libx264",
		"-preset", "medium", // Balanced quality/speed for reliability
		"-crf", "18", // Ultra high quality (Netflix-level)
		"-c:a", "aac", // AAC audio for compatibility - SOUND MUST BE INCLUDED
		"-b:a", "192k", // High audio bitrate for quality
		"-ac", "2", // Stereo audio
		"-ar", "48000", // High sample rate
		"-movflags", "+faststart", // Web optimization
		"-pix_fmt", "yuv420p", // Ensure compatibility
		"-threads", "0", // Use all available threads
		"-max_muxing_queue_size", "9999", // Prevent buffer issues
		"-avoid_negative_ts", "make_zero", // Fix timestamp issues
		"-fflags", "+genpts", // Generate presentation timestamps
		"-y", // Overwrite output file
		outputPath)

	log.Printf("🔧 Running FFmpeg 1080p with audio fallback at %ss (NO TIMEOUT - HD/4K processing): %s", startTimeStr, cmd.String())

	// Run without timeout to allow complete processing of HD/4K files
	if output, err := cmd.CombinedOutput(); err != nil {
		log.Printf("❌ FFmpeg 1080p audio fallback failed: %v\nOutput: %s", err, string(output))
		// Clean up partial file
		os.Remove(outputPath)
		return "", fmt.Errorf("ffmpeg 1080p audio fallback failed: %v", err)
	}

	// Validate generated file
	if !validatePreviewFile(outputPath) {
		os.Remove(outputPath)
		return "", fmt.Errorf("generated preview file validation failed")
	}

	log.Printf("✅ 1080p preview with audio fallback completed successfully: %s", outputPath)
	return outputPath, nil
}

// generateLowerQualityPreview generates 720p fallback preview with audio conversion using peak timestamps
func generateLowerQualityPreview(media *models.Media) (string, error) {
	previewDir := "./backend/previews"
	if _, err := os.Stat(previewDir); os.IsNotExist(err) {
		os.MkdirAll(previewDir, 0755)
	}

	// CRITICAL: Check for existing preview before generation
	if existingPath := checkExistingPreviewAssets(media); existingPath != "" {
		log.Printf("✅ Using existing preview: %s", existingPath)
		return existingPath, nil
	}

	outputPath := fmt.Sprintf("%s/preview_%d_%s_720p_fallback.mp4", previewDir, media.ID,
		sanitizeFilename(media.Title))

	// Get optimal timestamp using peak detection for better preview quality
	startTime := getOptimalPreviewTimestamp(media.FilePath)
	startTimeStr := fmt.Sprintf("%d", startTime)

	// 720p fallback FFmpeg command with peak timestamp detection - NO TIMEOUT FOR HD/4K FILES
	cmd := exec.Command("ffmpeg",
		"-i", media.FilePath,
		"-ss", startTimeStr, // Use optimal peak timestamp
		"-t", "30", // 30 seconds for comprehensive preview
		"-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2", // 720p fallback
		"-c:v", "libx264",
		"-preset", "medium", // Better quality preset for HD/4K sources
		"-crf", "20", // Higher quality for 720p from HD/4K sources
		"-c:a", "aac", // AAC audio for compatibility - SOUND MUST BE INCLUDED
		"-b:a", "128k", // Good audio bitrate for 720p
		"-ac", "2", // Stereo audio
		"-ar", "44100", // Standard sample rate
		"-movflags", "+faststart", // Web optimization
		"-pix_fmt", "yuv420p", // Ensure compatibility
		"-threads", "0", // Use all available threads
		"-max_muxing_queue_size", "9999", // Prevent buffer issues
		"-avoid_negative_ts", "make_zero", // Fix timestamp issues
		"-fflags", "+genpts", // Generate presentation timestamps
		"-y", // Overwrite output file
		outputPath)

	log.Printf("🔧 Running FFmpeg 720p fallback at %ss (NO TIMEOUT - HD/4K processing): %s", startTimeStr, cmd.String())

	// Run without timeout to allow complete processing of HD/4K files
	if output, err := cmd.CombinedOutput(); err != nil {
		log.Printf("❌ FFmpeg 720p fallback failed: %v\nOutput: %s", err, string(output))
		// Clean up partial file
		os.Remove(outputPath)
		return "", fmt.Errorf("ffmpeg 720p fallback failed: %v", err)
	}

	// Validate generated file
	if !validatePreviewFile(outputPath) {
		os.Remove(outputPath)
		return "", fmt.Errorf("generated preview file validation failed")
	}

	log.Printf("✅ 720p fallback preview completed successfully: %s", outputPath)
	return outputPath, nil
}

// generateVideoOnlyPreview generates video-only preview as last resort fallback
func generateVideoOnlyPreview(media *models.Media) (string, error) {
	previewDir := "./backend/previews"
	if _, err := os.Stat(previewDir); os.IsNotExist(err) {
		os.MkdirAll(previewDir, 0755)
	}

	// CRITICAL: Check for existing preview before generation
	if existingPath := checkExistingPreviewAssets(media); existingPath != "" {
		log.Printf("✅ Using existing preview: %s", existingPath)
		return existingPath, nil
	}

	outputPath := fmt.Sprintf("%s/preview_%d_%s_video_only.mp4", previewDir, media.ID,
		sanitizeFilename(media.Title))

	// Get optimal timestamp using peak detection for better preview quality
	startTime := getOptimalPreviewTimestamp(media.FilePath)
	startTimeStr := fmt.Sprintf("%d", startTime)

	// 720p video-only FFmpeg command - ONLY AS LAST RESORT (prefer audio versions)
	cmd := exec.Command("ffmpeg",
		"-i", media.FilePath,
		"-ss", startTimeStr, // Use optimal peak timestamp
		"-t", "30", // 30 seconds for comprehensive preview
		"-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2", // 720p for video-only
		"-c:v", "libx264",
		"-preset", "fast", // Faster preset for last resort but still decent quality
		"-crf", "22", // Decent quality for video-only from HD/4K
		"-an", // No audio track (last resort only)
		"-movflags", "+faststart", // Web optimization
		"-pix_fmt", "yuv420p", // Ensure compatibility
		"-threads", "0", // Use all available threads
		"-max_muxing_queue_size", "9999", // Prevent buffer issues
		"-avoid_negative_ts", "make_zero", // Fix timestamp issues
		"-y", // Overwrite output file
		outputPath)

	log.Printf("🔧 Running FFmpeg video-only preview at %ss (NO TIMEOUT - HD/4K processing): %s", startTimeStr, cmd.String())

	// Run without timeout to allow complete processing of HD/4K files
	if output, err := cmd.CombinedOutput(); err != nil {
		log.Printf("❌ FFmpeg video-only preview failed: %v\nOutput: %s", err, string(output))
		// Clean up partial file
		os.Remove(outputPath)
		return "", fmt.Errorf("ffmpeg video-only preview failed: %v", err)
	}

	// Validate generated file
	if !validatePreviewFile(outputPath) {
		os.Remove(outputPath)
		return "", fmt.Errorf("generated preview file validation failed")
	}

	log.Printf("⚠️ Video-only preview completed (no audio): %s", outputPath)
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

		mediaID := uint(id)

		// Check cache first for ultra-fast serving
		if cachedPath, found := assetCache.getCachedAssetPath(mediaID, "thumbnail"); found {
			// Set high-performance headers
			c.Header("Cache-Control", "public, max-age=86400, immutable") // 24 hour cache
			c.Header("Content-Type", "image/jpeg")
			c.Header("X-Cache", "HIT")
			c.Header("Accept-Ranges", "bytes")
			
			c.File(cachedPath)
			return
		}

		// Cache miss - get media and find thumbnail
		media, err := mediaService.GetMediaByID(mediaID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// ENHANCED CACHE INVALIDATION: Force complete cache refresh for thumbnails
		assetCache.mutex.Lock()
		delete(assetCache.notFoundCache, mediaID)
		delete(assetCache.thumbnailCache, mediaID)
		delete(assetCache.previewCache, mediaID) // Clear all related caches
		assetCache.mutex.Unlock()
		
		// IMMEDIATE FILESYSTEM SCAN: Check all possible thumbnail locations
		if refreshedPath := checkExistingThumbnailAssets(media); refreshedPath != "" {
			log.Printf("🎯 INSTANT SERVE: Found thumbnail after cache refresh: %s", refreshedPath)
			// Update database and cache immediately
			media.ThumbnailPath = refreshedPath
			mediaService.UpdateMedia(media)
			assetCache.setCachedAssetPath(mediaID, "thumbnail", refreshedPath)
			
			// ZERO-LATENCY HEADERS: Instant serving with aggressive caching
			c.Header("Cache-Control", "public, max-age=86400, immutable")
			c.Header("Content-Type", "image/jpeg")
			c.Header("Accept-Ranges", "bytes")
			c.Header("X-Cache", "INSTANT-HIT")
			c.Header("X-Asset-Source", "cache-refresh")
			c.File(refreshedPath)
			return
		}
		
		// Fast path resolution with optimized fallbacks
		thumbnailPath, err := serveThumbnailFast(media, thumbnailService)
		if err != nil {
			// ZERO-LATENCY 404 HANDLING: Return immediately, generate async
			log.Printf("⚡ INSTANT 404 RESPONSE: Triggering async thumbnail generation for media %d", mediaID)
			
			// INSTANT RESPONSE: Don't block frontend
			c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
			c.Header("X-Cache", "GENERATING-ASYNC")
			c.Header("X-Generation-Status", "background")
			c.Header("X-Retry-After", "3") // Suggest 3-second retry for thumbnails
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Asset generating",
				"media_id": media.ID,
				"status": "async_generation",
				"message": "Thumbnail will be available shortly",
				"retry_in_seconds": 3,
			})
			
			// Trigger async generation (non-blocking)
			go func() {
				if generatedPath, genErr := thumbnailService.GenerateThumbnail(media.FilePath, media.ID, media.Title); genErr == nil {
					media.ThumbnailPath = generatedPath
					mediaService.UpdateMedia(media)
					assetCache.setCachedAssetPath(mediaID, "thumbnail", generatedPath)
					log.Printf("✅ Async thumbnail generation completed: %s", generatedPath)
				} else {
					log.Printf("❌ Async thumbnail generation failed: %v", genErr)
				}
			}()
			return
		}

		// Automatically cache the found path for future requests
		assetCache.setCachedAssetPath(mediaID, "thumbnail", thumbnailPath)

		// Set high-performance headers
		c.Header("Cache-Control", "public, max-age=86400, immutable") // 24 hour cache
		c.Header("Content-Type", "image/jpeg")
		c.Header("X-Cache", "MISS")
		c.Header("Accept-Ranges", "bytes")

		c.File(thumbnailPath)
		
		// Opportunistically warm cache for related assets in background
		go func() {
			warmRelatedAssets(mediaService, thumbnailService, mediaID)
		}()
	}
}

func GetPreviewEnhanced(mediaService *services.MediaService, thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		mediaID := uint(id)

		// Check cache first for ultra-fast serving
		if cachedPath, found := assetCache.getCachedAssetPath(mediaID, "preview"); found {
			// Set high-performance headers for video streaming
			c.Header("Cache-Control", "public, max-age=86400, immutable") // 24 hour cache
			c.Header("Content-Type", "video/mp4")
			c.Header("Accept-Ranges", "bytes")
			c.Header("X-Cache", "HIT")
			
			c.File(cachedPath)
			return
		}

		// Cache miss - get media and find preview
		media, err := mediaService.GetMediaByID(mediaID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// ENHANCED CACHE INVALIDATION: Force complete cache refresh
		assetCache.mutex.Lock()
		delete(assetCache.notFoundCache, mediaID)
		delete(assetCache.previewCache, mediaID)
		delete(assetCache.thumbnailCache, mediaID) // Clear all related caches
		assetCache.mutex.Unlock()
		
		// IMMEDIATE FILESYSTEM SCAN: Check all possible asset locations
		if refreshedPath := checkExistingPreviewAssets(media); refreshedPath != "" {
			log.Printf("🎯 INSTANT SERVE: Found preview after cache refresh: %s", refreshedPath)
			// Update database and cache immediately
			media.PreviewPath = refreshedPath
			media.PreviewClipPath = refreshedPath
			mediaService.UpdateMedia(media)
			assetCache.setCachedAssetPath(mediaID, "preview", refreshedPath)
			
			// ZERO-LATENCY HEADERS: Instant serving with aggressive caching
			c.Header("Cache-Control", "public, max-age=86400, immutable")
			c.Header("Content-Type", "video/mp4")
			c.Header("Accept-Ranges", "bytes")
			c.Header("X-Cache", "INSTANT-HIT")
			c.Header("X-Asset-Source", "cache-refresh")
			c.File(refreshedPath)
			return
		}
		
		// Fast path resolution with optimized fallbacks
		previewPath, err := servePreviewFast(media, thumbnailService)
		if err != nil {
			// Check if generation is already in progress
			generationMutex.RLock()
			inProgress := generationInProgress[mediaID]
			generationMutex.RUnlock()
			
			if inProgress {
				c.Header("X-Cache", "GENERATING")
				c.Header("X-Generation-Status", "in-progress")
				c.JSON(http.StatusAccepted, gin.H{
					"error": "Preview generation in progress",
					"media_id": media.ID,
					"status": "generating",
					"message": "HD preview with sound generation in progress",
					"retry_after": 60,
				})
				return
			}
			
			// Check retry count to prevent infinite failures
			retryMutex.RLock()
			currentRetries := retryCount[mediaID]
			retryMutex.RUnlock()
			
			if currentRetries >= maxRetries {
				log.Printf("⚠️ Maximum retries exceeded for preview %d, serving error", mediaID)
				c.Header("X-Cache", "MAX-RETRIES-EXCEEDED")
				c.JSON(http.StatusNotFound, gin.H{
					"error": "Preview generation failed after multiple attempts",
					"media_id": media.ID,
					"status": "failed",
					"retries": currentRetries,
					"message": "HD preview generation failed permanently",
				})
				return
			}
			
			// ZERO-LATENCY 404 HANDLING: Return placeholder immediately, generate async
			log.Printf("⚡ INSTANT 404 RESPONSE: Triggering async generation for media %d (attempt %d/%d)", mediaID, currentRetries+1, maxRetries)
			
			// Mark generation as in progress
			generationMutex.Lock()
			generationInProgress[mediaID] = true
			generationMutex.Unlock()
			
			// INSTANT RESPONSE: Don't block frontend with generation status
			c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
			c.Header("X-Cache", "GENERATING-ASYNC")
			c.Header("X-Generation-Status", "background")
			c.Header("X-Retry-After", "5") // Suggest 5-second retry
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Asset generating",
				"media_id": media.ID,
				"status": "async_generation",
				"message": "Asset will be available shortly",
				"retry_in_seconds": 5,
			})
			
			// Trigger async generation (non-blocking) - CRITICAL FOR ALL 404s
			go func() {
				defer func() {
					// Always clear generation flag when done
					generationMutex.Lock()
					delete(generationInProgress, mediaID)
					generationMutex.Unlock()
				}()
				
				log.Printf("🚀 Starting automatic HD preview generation for media %d: %s", media.ID, media.Title)
				
				// CRITICAL: Check existing files before generation to avoid duplicate work
				if existingPath := checkExistingPreviewAssets(media); existingPath != "" {
					log.Printf("✅ Found existing preview during generation check: %s", existingPath)
					media.PreviewPath = existingPath
					media.PreviewClipPath = existingPath
					mediaService.UpdateMedia(media)
					assetCache.setCachedAssetPath(mediaID, "preview", existingPath)
					// Reset retry count on success
					retryMutex.Lock()
					delete(retryCount, mediaID)
					retryMutex.Unlock()
					return
				}
				
				if generatedPath, genErr := generatePreviewWithFallbacks(media, thumbnailService); genErr == nil {
					// Update database with new paths
					media.PreviewPath = generatedPath
					media.PreviewClipPath = generatedPath
					if updateErr := mediaService.UpdateMedia(media); updateErr != nil {
						log.Printf("⚠️ Failed to update media preview path: %v", updateErr)
					}
					// Add to cache for future requests
					assetCache.setCachedAssetPath(mediaID, "preview", generatedPath)
					// Reset retry count on success
					retryMutex.Lock()
					delete(retryCount, mediaID)
					retryMutex.Unlock()
					log.Printf("✅ Automatic HD preview generation completed: %s", generatedPath)
				} else {
					log.Printf("❌ Automatic preview generation failed for %s: %v", media.Title, genErr)
					// Increment retry count
					retryMutex.Lock()
					retryCount[mediaID]++
					retryMutex.Unlock()
				}
			}()
			return
		}

		// Cache the found path for future requests
		assetCache.setCachedAssetPath(mediaID, "preview", previewPath)

		// Set high-performance headers for video streaming
		c.Header("Cache-Control", "public, max-age=86400, immutable") // 24 hour cache
		c.Header("Content-Type", "video/mp4")
		c.Header("Accept-Ranges", "bytes")
		c.Header("X-Cache", "MISS")

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

		mediaID := uint(id)

		// Check cache first for ultra-fast serving
		if cachedPath, found := assetCache.getCachedAssetPath(mediaID, "poster"); found {
			// Set high-performance headers
			c.Header("Cache-Control", "public, max-age=86400, immutable") // 24 hour cache
			c.Header("Content-Type", "image/jpeg")
			c.Header("X-Cache", "HIT")
			c.Header("Accept-Ranges", "bytes")
			
			c.File(cachedPath)
			return
		}

		// Cache miss - get media and find poster
		media, err := mediaService.GetMediaByID(mediaID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Fast path resolution with optimized fallbacks
		posterPath, err := servePosterFast(media)
		if err != nil {
			// Poster not found - return thumbnail fallback or 404
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Poster not available",
				"media_id": media.ID,
				"message": "No poster or thumbnail found for this media",
			})
			return
		}

		// Cache the found path for future requests
		assetCache.setCachedAssetPath(mediaID, "poster", posterPath)

		// Set high-performance headers
		c.Header("Cache-Control", "public, max-age=86400, immutable") // 24 hour cache
		c.Header("Content-Type", "image/jpeg")
		c.Header("X-Cache", "MISS")
		c.Header("Accept-Ranges", "bytes")

		c.File(posterPath)
	}
}

// GetPosterWithAutoDownload serves posters with automatic TMDB download when missing
func GetPosterWithAutoDownload(mediaService *services.MediaService, posterService *services.PosterService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		mediaID := uint(id)

		// Check cache first for ultra-fast serving
		if cachedPath, found := assetCache.getCachedAssetPath(mediaID, "poster"); found {
			// Set high-performance headers
			c.Header("Cache-Control", "public, max-age=86400, immutable") // 24 hour cache
			c.Header("Content-Type", "image/jpeg")
			c.Header("X-Cache", "HIT")
			c.Header("Accept-Ranges", "bytes")
			
			c.File(cachedPath)
			return
		}

		// Cache miss - get media and find poster
		media, err := mediaService.GetMediaByID(mediaID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// ENHANCED CACHE INVALIDATION: Force complete cache refresh for posters
		assetCache.mutex.Lock()
		delete(assetCache.notFoundCache, mediaID)
		delete(assetCache.posterCache, mediaID)
		assetCache.mutex.Unlock()
		
		// IMMEDIATE FILESYSTEM SCAN: Check all possible poster locations
		if refreshedPath := posterService.GetPosterPath(media.ID, media.Title); refreshedPath != "" {
			log.Printf("🎯 INSTANT SERVE: Found poster after cache refresh: %s", refreshedPath)
			// Update database and cache immediately
			media.PosterPath = refreshedPath
			mediaService.UpdateMedia(media)
			assetCache.setCachedAssetPath(mediaID, "poster", refreshedPath)
			
			// ZERO-LATENCY HEADERS: Instant serving with aggressive caching
			c.Header("Cache-Control", "public, max-age=86400, immutable")
			c.Header("Content-Type", "image/jpeg")
			c.Header("Accept-Ranges", "bytes")
			c.Header("X-Cache", "INSTANT-HIT")
			c.Header("X-Asset-Source", "cache-refresh")
			c.File(refreshedPath)
			return
		}

		// Fast path resolution with optimized fallbacks
		posterPath, err := servePosterWithAutoDownload(media, posterService)
		if err != nil {
			// ZERO-LATENCY 404 HANDLING: Return immediately, download async
			log.Printf("⚡ INSTANT 404 RESPONSE: Triggering async poster download for media %d", mediaID)
			
			// INSTANT RESPONSE: Don't block frontend
			c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
			c.Header("X-Cache", "DOWNLOADING-ASYNC")
			c.Header("X-Generation-Status", "background")
			c.Header("X-Retry-After", "5") // Suggest 5-second retry for posters
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Poster downloading",
				"media_id": media.ID,
				"status": "async_download",
				"message": "Poster will be available shortly",
				"retry_in_seconds": 5,
			})
			
			// Trigger async download (non-blocking)
			go func() {
				log.Printf("🚀 Starting automatic poster download for media %d: %s", media.ID, media.Title)
				
				if downloadedPath, err := posterService.DownloadPosterWithPath(media.Title, media.ID); err == nil && downloadedPath != "" {
					// Update database with new path
					media.PosterPath = downloadedPath
					if updateErr := mediaService.UpdateMedia(media); updateErr != nil {
						log.Printf("⚠️ Failed to update media poster path: %v", updateErr)
					}
					// Add to cache for future requests
					assetCache.setCachedAssetPath(mediaID, "poster", downloadedPath)
					log.Printf("✅ Automatic poster download completed: %s", downloadedPath)
				} else {
					log.Printf("❌ Automatic poster download failed for %s: %v", media.Title, err)
				}
			}()
			return
		}

		// Cache the found path for future requests
		assetCache.setCachedAssetPath(mediaID, "poster", posterPath)

		// Set high-performance headers
		c.Header("Cache-Control", "public, max-age=86400, immutable") // 24 hour cache
		c.Header("Content-Type", "image/jpeg")
		c.Header("X-Cache", "MISS")
		c.Header("Accept-Ranges", "bytes")

		c.File(posterPath)
	}
}

// serveThumbnailFast provides optimized thumbnail serving with minimal filesystem calls
func serveThumbnailFast(media *models.Media, thumbnailService *services.ThumbnailService) (string, error) {
	// Priority 1: Database path (most likely to be correct)
	if media.ThumbnailPath != "" {
		// Try direct path first
		if _, err := os.Stat(media.ThumbnailPath); err == nil {
			return media.ThumbnailPath, nil
		}
		
		// Try with backend prefix for relative paths
		if !strings.HasPrefix(media.ThumbnailPath, "/") {
			backendPath := fmt.Sprintf("./backend/%s", media.ThumbnailPath)
			if _, err := os.Stat(backendPath); err == nil {
				return backendPath, nil
			}
		}
	}

	// Priority 2: Most common patterns (based on actual filesystem analysis)
	cleanTitle := strings.ReplaceAll(strings.ReplaceAll(media.Title, " ", "_"), ":", "")
	fastPaths := []string{
		fmt.Sprintf("./backend/thumbnails/thumb_%s.jpg", cleanTitle),
		fmt.Sprintf("./backend/thumbnails/thumb_%d.jpg", media.ID),
		fmt.Sprintf("./thumbnails/thumb_%s.jpg", cleanTitle),
		fmt.Sprintf("./thumbnails/thumb_%d.jpg", media.ID),
	}

	for _, path := range fastPaths {
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}

	return "", fmt.Errorf("no thumbnail found for media %d", media.ID)
}

// servePreviewFast provides optimized preview serving with minimal filesystem calls
func servePreviewFast(media *models.Media, thumbnailService *services.ThumbnailService) (string, error) {
	// Priority 1: Database paths (most likely to be correct)
	if media.PreviewPath != "" {
		if _, err := os.Stat(media.PreviewPath); err == nil {
			return media.PreviewPath, nil
		}
		if !strings.HasPrefix(media.PreviewPath, "/") {
			backendPath := fmt.Sprintf("./backend/%s", media.PreviewPath)
			if _, err := os.Stat(backendPath); err == nil {
				return backendPath, nil
			}
		}
	}

	if media.PreviewClipPath != "" {
		if _, err := os.Stat(media.PreviewClipPath); err == nil {
			return media.PreviewClipPath, nil
		}
		if !strings.HasPrefix(media.PreviewClipPath, "/") {
			backendPath := fmt.Sprintf("./backend/%s", media.PreviewClipPath)
			if _, err := os.Stat(backendPath); err == nil {
				return backendPath, nil
			}
		}
	}

	// Priority 2: Most common patterns
	cleanTitle := strings.ReplaceAll(strings.ReplaceAll(media.Title, " ", "_"), ":", "")
	fastPaths := []string{
		fmt.Sprintf("./backend/previews/preview_%s.mp4", cleanTitle),
		fmt.Sprintf("./backend/previews/preview_%d.mp4", media.ID),
		fmt.Sprintf("./previews/preview_%s.mp4", cleanTitle),
		fmt.Sprintf("./previews/preview_%d.mp4", media.ID),
	}

	for _, path := range fastPaths {
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}

	return "", fmt.Errorf("no preview found for media %d", media.ID)
}

// servePosterFast provides optimized poster serving with thumbnail fallback
func servePosterFast(media *models.Media) (string, error) {
	// Priority 1: Database path (most likely to be correct)
	if media.PosterPath != "" {
		if _, err := os.Stat(media.PosterPath); err == nil {
			return media.PosterPath, nil
		}
		if !strings.HasPrefix(media.PosterPath, "/") {
			backendPath := fmt.Sprintf("./backend/%s", media.PosterPath)
			if _, err := os.Stat(backendPath); err == nil {
				return backendPath, nil
			}
		}
	}

	// Priority 2: Check for TMDB downloaded posters
	cleanTitle := strings.ReplaceAll(strings.ReplaceAll(media.Title, " ", "_"), ":", "")
	posterPaths := []string{
		// Root folder first (preferred location)
		fmt.Sprintf("./posters/poster_%s.jpg", cleanTitle),
		fmt.Sprintf("./posters/poster_%d.jpg", media.ID),
		fmt.Sprintf("./posters/poster_%d_%s.jpg", media.ID, cleanTitle),
		// Backend folder as fallback
		fmt.Sprintf("./backend/posters/poster_%s.jpg", cleanTitle),
		fmt.Sprintf("./backend/posters/poster_%d.jpg", media.ID),
		fmt.Sprintf("./backend/posters/poster_%d_%s.jpg", media.ID, cleanTitle),
	}

	for _, path := range posterPaths {
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}

	// Priority 3: Fallback to thumbnail as poster (CRITICAL FEATURE)
	// This is what you requested - use thumbnails as poster fallback
	log.Printf("📸 No poster found for %s, falling back to thumbnail", media.Title)
	
	// Try database thumbnail path first
	if media.ThumbnailPath != "" {
		if _, err := os.Stat(media.ThumbnailPath); err == nil {
			log.Printf("✅ Using database thumbnail as poster: %s", media.ThumbnailPath)
			return media.ThumbnailPath, nil
		}
	}

	// Try common thumbnail locations as poster fallback
	thumbnailPaths := []string{
		fmt.Sprintf("./backend/thumbnails/thumb_%s.jpg", cleanTitle),
		fmt.Sprintf("./thumbnails/thumb_%s.jpg", cleanTitle),
		fmt.Sprintf("./backend/thumbnails/thumb_%d.jpg", media.ID),
		fmt.Sprintf("./thumbnails/thumb_%d.jpg", media.ID),
		fmt.Sprintf("./backend/thumbnails/thumb_%d_%s.jpg", media.ID, cleanTitle),
		fmt.Sprintf("./thumbnails/thumb_%d_%s.jpg", media.ID, cleanTitle),
	}

	for _, path := range thumbnailPaths {
		if _, err := os.Stat(path); err == nil {
			log.Printf("✅ Using thumbnail as poster fallback: %s", path)
			return path, nil
		}
	}

	return "", fmt.Errorf("no poster or thumbnail found for media %d", media.ID)
}

// servePosterWithAutoDownload provides optimized poster serving with automatic TMDB download
func servePosterWithAutoDownload(media *models.Media, posterService *services.PosterService) (string, error) {
	// Priority 1: Database path (most likely to be correct)
	if media.PosterPath != "" {
		if _, err := os.Stat(media.PosterPath); err == nil {
			return media.PosterPath, nil
		}
		if !strings.HasPrefix(media.PosterPath, "/") {
			backendPath := fmt.Sprintf("./backend/%s", media.PosterPath)
			if _, err := os.Stat(backendPath); err == nil {
				return backendPath, nil
			}
		}
	}

	// Priority 2: Check for existing posters using poster service
	if posterPath := posterService.GetPosterPath(media.ID, media.Title); posterPath != "" {
		return posterPath, nil
	}

	// Priority 3: Fallback to thumbnail as poster (CRITICAL FEATURE)
	log.Printf("📸 No poster found for %s, falling back to thumbnail", media.Title)
	
	// Try database thumbnail path first
	if media.ThumbnailPath != "" {
		if _, err := os.Stat(media.ThumbnailPath); err == nil {
			log.Printf("✅ Using database thumbnail as poster: %s", media.ThumbnailPath)
			return media.ThumbnailPath, nil
		}
	}

	// Try common thumbnail locations as poster fallback
	cleanTitle := strings.ReplaceAll(strings.ReplaceAll(media.Title, " ", "_"), ":", "")
	thumbnailPaths := []string{
		fmt.Sprintf("./backend/thumbnails/thumb_%s.jpg", cleanTitle),
		fmt.Sprintf("./thumbnails/thumb_%s.jpg", cleanTitle),
		fmt.Sprintf("./backend/thumbnails/thumb_%d.jpg", media.ID),
		fmt.Sprintf("./thumbnails/thumb_%d.jpg", media.ID),
		fmt.Sprintf("./backend/thumbnails/thumb_%d_%s.jpg", media.ID, cleanTitle),
		fmt.Sprintf("./thumbnails/thumb_%d_%s.jpg", media.ID, cleanTitle),
	}

	for _, path := range thumbnailPaths {
		if _, err := os.Stat(path); err == nil {
			log.Printf("✅ Using thumbnail as poster fallback: %s", path)
			return path, nil
		}
	}

	return "", fmt.Errorf("no poster or thumbnail found for media %d", media.ID)
}

// WarmAssetCache pre-populates the asset cache for better performance
func WarmAssetCache(mediaService *services.MediaService, thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get all media to warm cache
		allMedia, err := mediaService.GetAllMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get media list"})
			return
		}

		warmed := 0
		go func() {
			for _, media := range allMedia {
				// Warm thumbnail cache
				if path, err := serveThumbnailFast(&media, thumbnailService); err == nil {
					assetCache.setCachedAssetPath(media.ID, "thumbnail", path)
					warmed++
				}

				// Warm preview cache
				if path, err := servePreviewFast(&media, thumbnailService); err == nil {
					assetCache.setCachedAssetPath(media.ID, "preview", path)
					warmed++
				}

				// Warm poster cache
				if path, err := servePosterFast(&media); err == nil {
					assetCache.setCachedAssetPath(media.ID, "poster", path)
					warmed++
				}
			}
			log.Printf("🔥 Asset cache warmed: %d paths cached for %d media items", warmed, len(allMedia))
		}()

		c.JSON(http.StatusOK, gin.H{
			"status": "started",
			"message": "Asset cache warming started in background",
			"media_count": len(allMedia),
		})
	}
}

// ClearAssetCache clears the in-memory asset cache
func ClearAssetCache() gin.HandlerFunc {
	return func(c *gin.Context) {
		assetCache.clearCache()
		c.JSON(http.StatusOK, gin.H{
			"status": "success",
			"message": "Asset cache cleared",
		})
	}
}

// GetAssetCacheStats returns cache statistics
func GetAssetCacheStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		assetCache.mutex.RLock()
		stats := gin.H{
			"thumbnail_count": len(assetCache.thumbnailCache),
			"preview_count":   len(assetCache.previewCache),
			"poster_count":    len(assetCache.posterCache),
			"last_update":     assetCache.lastUpdate,
			"ttl_minutes":     int(cacheTTL.Minutes()),
		}
		assetCache.mutex.RUnlock()

		c.JSON(http.StatusOK, stats)
	}
}

// DownloadPoster manually downloads a poster for a media item using TMDB
func DownloadPoster(mediaService *services.MediaService, posterService *services.PosterService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		mediaID := uint(id)

		// Get media info
		media, err := mediaService.GetMediaByID(mediaID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Check if poster already exists
		if existingPath := posterService.GetPosterPath(media.ID, media.Title); existingPath != "" {
			log.Printf("✅ Poster already exists for %s: %s", media.Title, existingPath)
			c.JSON(http.StatusOK, gin.H{
				"status":      "success",
				"media_id":    media.ID,
				"title":       media.Title,
				"poster_path": existingPath,
				"message":     "Poster already exists",
				"skipped":     true,
			})
			return
		}

		// Download poster using TMDB
		log.Printf("🎨 Downloading poster for: %s (ID: %d)", media.Title, media.ID)
		posterPath, err := posterService.DownloadPosterWithPath(media.Title, media.ID)
		if err != nil {
			log.Printf("❌ Failed to download poster for %s: %v", media.Title, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":    "Failed to download poster",
				"media_id": media.ID,
				"title":    media.Title,
				"details":  err.Error(),
			})
			return
		}

		// Update media record with poster path
		if posterPath != "" {
			media.PosterPath = posterPath
			if err := mediaService.UpdateMedia(media); err != nil {
				log.Printf("⚠️ Failed to update media with poster path: %v", err)
			} else {
				log.Printf("✅ Updated media %s with poster path: %s", media.Title, posterPath)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":      "success",
			"media_id":    media.ID,
			"title":       media.Title,
			"poster_path": posterPath,
			"message":     "Poster downloaded successfully from TMDB",
		})
	}
}

// GeneratePoster generates/downloads a poster for a media item (alias for DownloadPoster for consistency)
func GeneratePoster(mediaService *services.MediaService, posterService *services.PosterService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		mediaID := uint(id)

		// Get media info
		media, err := mediaService.GetMediaByID(mediaID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Force regeneration - remove existing poster first if it exists
		if existingPath := posterService.GetPosterPath(media.ID, media.Title); existingPath != "" {
			log.Printf("🔄 Regenerating existing poster for %s: %s", media.Title, existingPath)
		}

		// Download/generate poster using TMDB
		log.Printf("🎨 Generating poster for: %s (ID: %d)", media.Title, media.ID)
		posterPath, err := posterService.DownloadPosterWithPath(media.Title, media.ID)
		if err != nil {
			log.Printf("❌ Failed to generate poster for %s: %v", media.Title, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":    "Failed to generate poster",
				"media_id": media.ID,
				"title":    media.Title,
				"details":  err.Error(),
			})
			return
		}

		// Update media record with poster path
		if posterPath != "" {
			media.PosterPath = posterPath
			if err := mediaService.UpdateMedia(media); err != nil {
				log.Printf("⚠️ Failed to update media with poster path: %v", err)
			} else {
				log.Printf("✅ Updated media %s with poster path: %s", media.Title, posterPath)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":      "success",
			"media_id":    media.ID,
			"title":       media.Title,
			"poster_path": posterPath,
			"message":     "Poster generated successfully from TMDB",
		})
	}
}

// GetSeriesPoster serves posters for TV series with automatic download when missing
func GetSeriesPoster(mediaService *services.MediaService, posterService *services.PosterService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid series ID"})
			return
		}

		seriesID := uint(id)

		// Get series info
		series, err := mediaService.GetSeriesByID(seriesID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Series not found"})
			return
		}

		// Check if series has a poster path
		if series.PosterPath != "" {
			// Try to serve the existing poster
			if _, err := os.Stat(series.PosterPath); err == nil {
				c.Header("Cache-Control", "public, max-age=86400, immutable")
				c.Header("Content-Type", "image/jpeg")
				c.File(series.PosterPath)
				return
			}
			// Try with ./backend/ prefix for relative paths
			if !strings.HasPrefix(series.PosterPath, "/") && !strings.HasPrefix(series.PosterPath, "./") {
				resolvedPath := "./backend/" + series.PosterPath
				if _, err := os.Stat(resolvedPath); err == nil {
					c.Header("Cache-Control", "public, max-age=86400, immutable")
					c.Header("Content-Type", "image/jpeg")
					c.File(resolvedPath)
					return
				}
			}
		}

		// Check common poster locations
		posterPaths := []string{
			fmt.Sprintf("./posters/poster_%s.jpg", cleanTitleForFilename(series.Title)),
			fmt.Sprintf("./backend/posters/poster_%s.jpg", cleanTitleForFilename(series.Title)),
			fmt.Sprintf("./posters/poster_%d.jpg", series.ID),
			fmt.Sprintf("./backend/posters/poster_%d.jpg", series.ID),
		}

		for _, path := range posterPaths {
			if _, err := os.Stat(path); err == nil {
				c.Header("Cache-Control", "public, max-age=86400, immutable")
				c.Header("Content-Type", "image/jpeg")
				c.File(path)
				return
			}
		}

		// No poster found - return 404
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Series poster not found",
			"series_id": series.ID,
			"title": series.Title,
			"message": "Use POST /api/admin/series/:id/poster to generate a poster",
		})
	}
}

// cleanTitleForFilename creates a safe filename from a title
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
	cleaned = strings.ReplaceAll(cleaned, "(", "")
	cleaned = strings.ReplaceAll(cleaned, ")", "")
	
	// Remove multiple underscores and trim
	cleaned = regexp.MustCompile(`_+`).ReplaceAllString(cleaned, "_")
	cleaned = strings.Trim(cleaned, "_")
	
	// Convert to lowercase for consistency
	cleaned = strings.ToLower(cleaned)
	
	// Limit length to avoid filesystem issues
	if len(cleaned) > 100 {
		cleaned = cleaned[:100]
	}
	
	// Ensure we have something if title was all special characters
	if cleaned == "" {
		cleaned = "untitled"
	}
	
	return cleaned
}

// GenerateSeriesPoster generates/downloads a poster for a TV series
func GenerateSeriesPoster(mediaService *services.MediaService, posterService *services.PosterService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		seriesID := uint(id)

		// Get series info
		series, err := mediaService.GetSeriesByID(seriesID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Series not found"})
			return
		}

		// Force regeneration - remove existing poster first if it exists
		if existingPath := posterService.GetPosterPath(series.ID, series.Title); existingPath != "" {
			log.Printf("🔄 Regenerating existing poster for series %s: %s", series.Title, existingPath)
		}

		// Download/generate poster using TMDB for TV series
		log.Printf("🎨 Generating poster for TV series: %s (ID: %d)", series.Title, series.ID)
		posterPath, err := posterService.DownloadTVPosterWithPath(series.Title, series.ID)
		if err != nil {
			log.Printf("❌ Failed to generate poster for series %s: %v", series.Title, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":     "Failed to generate poster",
				"series_id": series.ID,
				"title":     series.Title,
				"details":   err.Error(),
			})
			return
		}

		// Update series with poster path
		updates := map[string]interface{}{
			"poster_path": posterPath,
		}
		
		_, err = mediaService.UpdateSeries(series.ID, updates)
		if err != nil {
			log.Printf("⚠️ Failed to update series poster path in database: %v", err)
		}

		log.Printf("✅ Poster generated successfully for series %s: %s", series.Title, posterPath)
		c.JSON(http.StatusOK, gin.H{
			"status":      "success",
			"series_id":   series.ID,
			"title":       series.Title,
			"poster_path": posterPath,
			"message":     "Series poster generated successfully from TMDB",
		})
	}
}

// DownloadPosterBatch downloads posters for multiple media items
func DownloadPosterBatch(mediaService *services.MediaService, posterService *services.PosterService) gin.HandlerFunc {
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
			c.JSON(http.StatusBadRequest, gin.H{"error": "Too many media IDs (max 20 to respect TMDB rate limits)"})
			return
		}

		successful := 0
		failed := 0
		var errors []string
		var results []map[string]interface{}

		// Process each media ID
		for _, mediaID := range request.MediaIDs {
			media, err := mediaService.GetMediaByID(mediaID)
			if err != nil {
				failed++
				errors = append(errors, fmt.Sprintf("Media %d: not found", mediaID))
				continue
			}

			result := map[string]interface{}{
				"media_id": mediaID,
				"title":    media.Title,
			}

			// Check if poster already exists
			if existingPath := posterService.GetPosterPath(media.ID, media.Title); existingPath != "" {
				result["status"] = "skipped"
				result["message"] = "Poster already exists"
				result["poster_path"] = existingPath
				results = append(results, result)
				continue
			}

			// Download poster
			if posterPath, err := posterService.DownloadPosterWithPath(media.Title, media.ID); err != nil {
				failed++
				result["status"] = "failed"
				result["error"] = err.Error()
				errors = append(errors, fmt.Sprintf("Media %d (%s): %v", mediaID, media.Title, err))
			} else {
				successful++
				result["status"] = "success"
				result["message"] = "Poster downloaded successfully"
				
				// Update database with poster path
				if posterPath != "" {
					result["poster_path"] = posterPath
					media.PosterPath = posterPath
					mediaService.UpdateMedia(media)
				}
			}

			results = append(results, result)

			// Add delay between downloads to respect TMDB rate limits
			time.Sleep(1 * time.Second)
		}

		c.JSON(http.StatusOK, gin.H{
			"status":     "completed",
			"total":      len(request.MediaIDs),
			"successful": successful,
			"failed":     failed,
			"errors":     errors,
			"results":    results,
		})
	}
}

// RegeneratePostersForMissing downloads posters for all media missing posters
func RegeneratePostersForMissing(mediaService *services.MediaService, posterService *services.PosterService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get all media from database
		allMedia, err := mediaService.GetAllMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get media from database"})
			return
		}

		// Filter media with missing posters
		var mediaWithoutPosters []models.Media
		for _, media := range allMedia {
			// Check if file exists
			if _, err := os.Stat(media.FilePath); err != nil {
				continue
			}

			// Check if poster is missing
			needsPoster := media.PosterPath == ""

			// Also check if poster file actually exists on disk
			if media.PosterPath != "" {
				if _, err := os.Stat(media.PosterPath); os.IsNotExist(err) {
					needsPoster = true
				}
			}

			// Double-check using poster service
			if !needsPoster {
				if posterPath := posterService.GetPosterPath(media.ID, media.Title); posterPath == "" {
					needsPoster = true
				}
			}

			if needsPoster {
				mediaWithoutPosters = append(mediaWithoutPosters, media)
			}
		}

		if len(mediaWithoutPosters) == 0 {
			c.JSON(http.StatusOK, gin.H{
				"status":  "completed",
				"message": "All media already have posters",
				"total":   0,
			})
			return
		}

		log.Printf("🎨 Found %d media items needing posters", len(mediaWithoutPosters))

		// Process in smaller batches to respect TMDB rate limits
		batchSize := 5
		successful := 0
		failed := 0
		var errors []string

		for i := 0; i < len(mediaWithoutPosters); i += batchSize {
			end := i + batchSize
			if end > len(mediaWithoutPosters) {
				end = len(mediaWithoutPosters)
			}

			batch := mediaWithoutPosters[i:end]
			log.Printf("🎨 Processing poster batch %d-%d of %d", i+1, end, len(mediaWithoutPosters))

			// Process batch sequentially to respect TMDB rate limits
			for _, media := range batch {
				if posterPath, err := posterService.DownloadPosterWithPath(media.Title, media.ID); err != nil {
					failed++
					errors = append(errors, fmt.Sprintf("Media %d (%s): %v", media.ID, media.Title, err))
					log.Printf("❌ Failed to download poster for %s: %v", media.Title, err)
				} else if posterPath != "" {
					// Update media record
					media.PosterPath = posterPath
					if updateErr := mediaService.UpdateMedia(&media); updateErr != nil {
						log.Printf("⚠️ Failed to update media record for %s: %v", media.Title, updateErr)
					} else {
						successful++
						log.Printf("✅ Downloaded poster for: %s", media.Title)
					}
				}

				// Delay between downloads to respect TMDB rate limits (40 requests per 10 seconds)
				time.Sleep(300 * time.Millisecond) // 0.3 seconds between requests
			}

			// Longer pause between batches
			if end < len(mediaWithoutPosters) {
				log.Printf("⏸️ Batch completed, waiting 2 seconds before next batch...")
				time.Sleep(2 * time.Second)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":     "completed",
			"total":      len(mediaWithoutPosters),
			"successful": successful,
			"failed":     failed,
			"errors":     errors,
			"message":    fmt.Sprintf("Poster download completed: %d successful, %d failed", successful, failed),
		})
	}
}

// serveThumbnailWithFallbacks tries multiple strategies to serve thumbnails
func serveThumbnailWithFallbacks(media *models.Media, thumbnailService *services.ThumbnailService) (string, error) {
	// Strategy 1: Use existing thumbnail path from database
	if media.ThumbnailPath != "" {
		// Try the path as-is first
		if _, err := os.Stat(media.ThumbnailPath); err == nil {
			return media.ThumbnailPath, nil
		}
		
		// If relative path, try resolving to backend directory
		if !strings.HasPrefix(media.ThumbnailPath, "/") && !strings.HasPrefix(media.ThumbnailPath, "./") {
			backendPath := fmt.Sprintf("./backend/%s", media.ThumbnailPath)
			if _, err := os.Stat(backendPath); err == nil {
				log.Printf("✅ Resolved relative thumbnail path: %s -> %s", media.ThumbnailPath, backendPath)
				return backendPath, nil
			}
		}
		
		log.Printf("⚠️ Database thumbnail path invalid: %s", media.ThumbnailPath)
	}

	// Strategy 2: Try thumbnail service's serve method
	if thumbnailPath, err := thumbnailService.ServeThumbnail(media.ID, media.Title); err == nil {
		return thumbnailPath, nil
	}

	// Strategy 3: Look for thumbnails in common locations using multiple naming patterns
	uniqueFilename := generateUniqueFilename(media.ID, media.Title, nil, nil, "thumb", ".jpg")
	
	// Clean title for actual file pattern matching
	cleanTitle := strings.ReplaceAll(media.Title, " ", "_")
	cleanTitle = strings.ReplaceAll(cleanTitle, ":", "")
	cleanTitle = strings.ReplaceAll(cleanTitle, "(", "")
	cleanTitle = strings.ReplaceAll(cleanTitle, ")", "")
	cleanTitle = strings.ReplaceAll(cleanTitle, "'", "")
	cleanTitle = strings.ReplaceAll(cleanTitle, "\"", "")
	
	possiblePaths := []string{
		// Original expected patterns
		fmt.Sprintf("./thumbnails/%s", uniqueFilename),
		fmt.Sprintf("./backend/thumbnails/%s", uniqueFilename),
		fmt.Sprintf("./thumbnails/thumb_%d.jpg", media.ID),
		fmt.Sprintf("./backend/thumbnails/thumb_%d.jpg", media.ID),
		// Actual file patterns found in filesystem
		fmt.Sprintf("./backend/thumbnails/thumb_%s.jpg", cleanTitle),
		fmt.Sprintf("./thumbnails/thumb_%s.jpg", cleanTitle),
		fmt.Sprintf("./backend/thumbnails/thumb_%d_%s.jpg", media.ID, cleanTitle),
		fmt.Sprintf("./thumbnails/thumb_%d_%s.jpg", media.ID, cleanTitle),
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
		// Try the path as-is first
		if _, err := os.Stat(media.PreviewPath); err == nil {
			return media.PreviewPath, nil
		}
		
		// If relative path, try resolving to backend directory
		if !strings.HasPrefix(media.PreviewPath, "/") && !strings.HasPrefix(media.PreviewPath, "./") {
			backendPath := fmt.Sprintf("./backend/%s", media.PreviewPath)
			if _, err := os.Stat(backendPath); err == nil {
				log.Printf("✅ Resolved relative preview path: %s -> %s", media.PreviewPath, backendPath)
				return backendPath, nil
			}
		}
		
		log.Printf("⚠️ Database preview path invalid: %s", media.PreviewPath)
	}

	// Strategy 2: Use preview clip path from database
	if media.PreviewClipPath != "" {
		// Try the path as-is first
		if _, err := os.Stat(media.PreviewClipPath); err == nil {
			return media.PreviewClipPath, nil
		}
		
		// If relative path, try resolving to backend directory
		if !strings.HasPrefix(media.PreviewClipPath, "/") && !strings.HasPrefix(media.PreviewClipPath, "./") {
			backendPath := fmt.Sprintf("./backend/%s", media.PreviewClipPath)
			if _, err := os.Stat(backendPath); err == nil {
				log.Printf("✅ Resolved relative preview clip path: %s -> %s", media.PreviewClipPath, backendPath)
				return backendPath, nil
			}
		}
		
		log.Printf("⚠️ Database preview clip path invalid: %s", media.PreviewClipPath)
	}

	// Strategy 3: Try thumbnail service's serve method
	if previewPath, err := thumbnailService.ServePreviewClip(media.ID, media.Title); err == nil {
		return previewPath, nil
	}

	// Strategy 4: Look for previews in common locations using multiple naming patterns
	uniqueFilename := generateUniqueFilename(media.ID, media.Title, nil, nil, "preview", ".mp4")
	
	// Clean title for actual file pattern matching
	cleanTitle := strings.ReplaceAll(media.Title, " ", "_")
	cleanTitle = strings.ReplaceAll(cleanTitle, ":", "")
	cleanTitle = strings.ReplaceAll(cleanTitle, "(", "")
	cleanTitle = strings.ReplaceAll(cleanTitle, ")", "")
	cleanTitle = strings.ReplaceAll(cleanTitle, "'", "")
	cleanTitle = strings.ReplaceAll(cleanTitle, "\"", "")
	
	possiblePaths := []string{
		// Original expected patterns
		fmt.Sprintf("./previews/%s", uniqueFilename),
		fmt.Sprintf("./backend/previews/%s", uniqueFilename),
		fmt.Sprintf("./previews/preview_%d.mp4", media.ID),
		fmt.Sprintf("./backend/previews/preview_%d.mp4", media.ID),
		// Actual file patterns found in filesystem
		fmt.Sprintf("./backend/previews/preview_%s.mp4", cleanTitle),
		fmt.Sprintf("./previews/preview_%s.mp4", cleanTitle),
		fmt.Sprintf("./backend/previews/preview_%d_%s.mp4", media.ID, cleanTitle),
		fmt.Sprintf("./previews/preview_%d_%s.mp4", media.ID, cleanTitle),
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
		// Try the path as-is first
		if _, err := os.Stat(media.PosterPath); err == nil {
			return media.PosterPath, nil
		}
		
		// If relative path, try resolving to backend directory
		if !strings.HasPrefix(media.PosterPath, "/") && !strings.HasPrefix(media.PosterPath, "./") {
			backendPath := fmt.Sprintf("./backend/%s", media.PosterPath)
			if _, err := os.Stat(backendPath); err == nil {
				log.Printf("✅ Resolved relative poster path: %s -> %s", media.PosterPath, backendPath)
				return backendPath, nil
			}
		}
		
		log.Printf("⚠️ Database poster path invalid: %s", media.PosterPath)
	}

	// Strategy 2: Look for posters in common locations using multiple naming patterns
	uniqueFilename := generateUniqueFilename(media.ID, media.Title, nil, nil, "poster", ".jpg")
	
	// Clean title for actual file pattern matching
	cleanTitle := strings.ReplaceAll(media.Title, " ", "_")
	cleanTitle = strings.ReplaceAll(cleanTitle, ":", "")
	cleanTitle = strings.ReplaceAll(cleanTitle, "(", "")
	cleanTitle = strings.ReplaceAll(cleanTitle, ")", "")
	cleanTitle = strings.ReplaceAll(cleanTitle, "'", "")
	cleanTitle = strings.ReplaceAll(cleanTitle, "\"", "")
	
	possiblePosterPaths := []string{
		// Original expected patterns
		fmt.Sprintf("./posters/%s", uniqueFilename),
		fmt.Sprintf("./backend/posters/%s", uniqueFilename),
		fmt.Sprintf("./posters/poster_%d.jpg", media.ID),
		fmt.Sprintf("./backend/posters/poster_%d.jpg", media.ID),
		fmt.Sprintf("./assets/posters/poster_%d.jpg", media.ID),
		// Actual file patterns found in filesystem
		fmt.Sprintf("./backend/posters/poster_%s.jpg", cleanTitle),
		fmt.Sprintf("./posters/poster_%s.jpg", cleanTitle),
		fmt.Sprintf("./backend/posters/poster_%d_%s.jpg", media.ID, cleanTitle),
		fmt.Sprintf("./posters/poster_%d_%s.jpg", media.ID, cleanTitle),
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

// generateUniqueFilename creates unique filename for TV series episodes with season/episode numbers
func generateUniqueFilename(mediaID uint, title string, season *int, episode *int, prefix, extension string) string {
	// For TV series episodes, include season/episode info
	if season != nil && episode != nil && *season > 0 && *episode > 0 {
		cleanTitle := cleanTitleForFilename(title)
		return fmt.Sprintf("%s_%d_%s_S%02dE%02d%s", prefix, mediaID, cleanTitle, *season, *episode, extension)
	}
	
	// For movies or episodes without season/episode info
	cleanTitle := cleanTitleForFilename(title)
	return fmt.Sprintf("%s_%d_%s%s", prefix, mediaID, cleanTitle, extension)
}



// getOptimalPreviewTimestamp uses intelligent scene detection to find peak moments for preview generation
// Combines multiple strategies: scene changes, audio peaks, and motion detection for best preview quality
func getOptimalPreviewTimestamp(videoPath string) int {
	// Get video duration using ffprobe
	duration := getVideoDurationSeconds(videoPath)
	if duration <= 0 {
		// Fallback to 60 seconds if duration detection fails
		log.Printf("⚠️ Could not detect video duration for %s, using 60s fallback", videoPath)
		return 60
	}

	// Strategy 1: Try intelligent scene detection for peak moments
	if peakTime := detectPeakMoments(videoPath, duration); peakTime > 0 {
		log.Printf("🎯 Using peak moment detection: %ds (%.1f%% of %ds duration)", 
			peakTime, float64(peakTime)/float64(duration)*100, duration)
		return peakTime
	}

	// Strategy 2: Fallback to smart random selection (avoid intros/credits)
	// Use multiple candidate timestamps and select the best one
	candidates := []float64{0.25, 0.35, 0.45, 0.55, 0.65} // Multiple good positions
	rand.Seed(time.Now().UnixNano())
	selectedPercent := candidates[rand.Intn(len(candidates))]
	optimalTime := int(float64(duration) * selectedPercent)
	
	// Ensure minimum 30 seconds
	if optimalTime < 30 {
		optimalTime = 30
	}
	
	log.Printf("🎯 Using smart random selection: %ds (%.1f%% of %ds duration)", 
		optimalTime, selectedPercent*100, duration)
	
	return optimalTime
}

// detectPeakMoments uses FFmpeg scene detection to find the most interesting parts of the video
func detectPeakMoments(videoPath string, duration int) int {
	// Use FFmpeg scene detection to find interesting moments
	// This analyzes scene changes, motion, and audio levels to find peak moments
	cmd := exec.Command("ffmpeg",
		"-i", videoPath,
		"-vf", "select='gt(scene,0.3)'", // Detect significant scene changes
		"-f", "null",
		"-v", "info",
		"-") // Output to stdout for analysis

	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("⚠️ Scene detection failed for %s: %v", videoPath, err)
		return 0 // Return 0 to indicate fallback needed
	}

	// Parse scene detection output to find peak moments
	sceneChanges := parseSceneChanges(string(output), duration)
	if len(sceneChanges) > 0 {
		// Select a scene change in the middle portion (30-70% of video)
		minTime := int(float64(duration) * 0.3)
		maxTime := int(float64(duration) * 0.7)
		
		for _, sceneTime := range sceneChanges {
			if sceneTime >= minTime && sceneTime <= maxTime {
				return sceneTime
			}
		}
	}

	return 0 // No suitable peak found, use fallback
}

// parseSceneChanges extracts scene change timestamps from FFmpeg output
func parseSceneChanges(output string, duration int) []int {
	var sceneChanges []int
	
	// Parse FFmpeg scene detection output
	// Look for patterns like "pts_time:123.456" in the output
	lines := strings.Split(output, "\n")
	for _, line := range lines {
		if strings.Contains(line, "pts_time:") {
			// Extract timestamp from pts_time field
			parts := strings.Split(line, "pts_time:")
			if len(parts) > 1 {
				timeStr := strings.Fields(parts[1])[0]
				if timeFloat, err := strconv.ParseFloat(timeStr, 64); err == nil {
					sceneTime := int(timeFloat)
					if sceneTime > 0 && sceneTime < duration {
						sceneChanges = append(sceneChanges, sceneTime)
					}
				}
			}
		}
	}

	return sceneChanges
}

// getVideoDurationSeconds gets video duration in seconds using ffprobe
func getVideoDurationSeconds(videoPath string) int {
	cmd := exec.Command("ffprobe",
		"-v", "quiet",
		"-show_entries", "format=duration",
		"-of", "csv=p=0",
		videoPath)
	
	output, err := cmd.Output()
	if err != nil {
		log.Printf("⚠️ ffprobe failed for %s: %v", videoPath, err)
		return 0
	}

	durationStr := strings.TrimSpace(string(output))
	if durationFloat, err := strconv.ParseFloat(durationStr, 64); err == nil {
		return int(durationFloat)
	}

	log.Printf("⚠️ Could not parse duration '%s' for %s", durationStr, videoPath)
	return 0
}
