package sync

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"homeflix-backend/internal/models"
	"homeflix-backend/internal/scanner/core"
)

// StorageSync handles database-storage synchronization
type StorageSync struct {
	scanner *core.MediaScanner
}

func NewStorageSync(scanner *core.MediaScanner) *StorageSync {
	return &StorageSync{
		scanner: scanner,
	}
}

// SyncDatabaseWithStorage syncs database entries with actual storage
func (ss *StorageSync) SyncDatabaseWithStorage() error {
	log.Printf("🔄 Starting database-storage synchronization...")
	
	// Get all media from database
	allMedia, err := ss.scanner.GetMediaService().GetAllMedia()
	if err != nil {
		return fmt.Errorf("failed to retrieve media from database: %v", err)
	}
	
	log.Printf("📊 Found %d media entries in database", len(allMedia))
	
	var (
		validMedia    []models.Media
		invalidMedia  []models.Media
		movedMedia    []models.Media
		updatedCount  int
	)
	
	// Check each database entry
	for _, media := range allMedia {
		if ss.validateMediaFile(&media) {
			validMedia = append(validMedia, media)
		} else {
			// Try to find the file in new location
			if newPath := ss.findMovedFile(&media); newPath != "" {
				media.FilePath = newPath
				movedMedia = append(movedMedia, media)
				log.Printf("📁 Found moved file: %s -> %s", filepath.Base(media.FilePath), newPath)
			} else {
				invalidMedia = append(invalidMedia, media)
				log.Printf("❌ File not found: %s", media.FilePath)
			}
		}
	}
	
	// Update moved files
	for _, media := range movedMedia {
		if err := ss.scanner.GetMediaService().UpdateMedia(&media); err != nil {
			log.Printf("⚠️ Failed to update moved media %s: %v", media.Title, err)
		} else {
			updatedCount++
		}
	}
	
	// Handle invalid entries
	if len(invalidMedia) > 0 {
		log.Printf("🗑️ Found %d invalid entries", len(invalidMedia))
		if err := ss.handleInvalidEntries(invalidMedia); err != nil {
			log.Printf("⚠️ Error handling invalid entries: %v", err)
		}
	}
	
	// Regenerate assets for files with missing assets
	ss.regenerateAssetsForValidMedia(validMedia)
	ss.regenerateAssetsForValidMedia(movedMedia)
	
	log.Printf("✅ Database sync completed:")
	log.Printf("   📁 Valid entries: %d", len(validMedia))
	log.Printf("   🔄 Moved entries updated: %d", updatedCount)
	log.Printf("   🗑️ Invalid entries: %d", len(invalidMedia))
	
	return nil
}

// validateMediaFile checks if a media file exists and is accessible
func (ss *StorageSync) validateMediaFile(media *models.Media) bool {
	if media.FilePath == "" {
		return false
	}
	
	stat, err := os.Stat(media.FilePath)
	if err != nil {
		return false
	}
	
	// Update file size if changed
	if stat.Size() != media.FileSize {
		media.FileSize = stat.Size()
		ss.scanner.GetMediaService().UpdateMedia(media)
	}
	
	return true
}

// findMovedFile attempts to find a file that has been moved
func (ss *StorageSync) findMovedFile(media *models.Media) string {
	if media.FilePath == "" {
		return ""
	}
	
	filename := filepath.Base(media.FilePath)
	mediaPath := ss.scanner.GetMediaPath()
	
	// Search strategies
	searchPaths := []string{
		// Direct filename search in media path
		filepath.Join(mediaPath, filename),
		// Search in common subdirectories
		filepath.Join(mediaPath, "Movies", filename),
		filepath.Join(mediaPath, "TV Shows", filename),
		filepath.Join(mediaPath, "Series", filename),
	}
	
	// Check direct paths first
	for _, path := range searchPaths {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}
	
	// Recursive search as last resort (limited depth)
	foundPath := ""
	filepath.Walk(mediaPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		
		if info.IsDir() {
			// Limit search depth
			depth := strings.Count(strings.TrimPrefix(path, mediaPath), string(os.PathSeparator))
			if depth > 3 {
				return filepath.SkipDir
			}
			return nil
		}
		
		if filepath.Base(path) == filename && info.Size() == media.FileSize {
			foundPath = path
			return fmt.Errorf("found") // Stop walking
		}
		
		return nil
	})
	
	return foundPath
}

// handleInvalidEntries handles database entries for missing files
func (ss *StorageSync) handleInvalidEntries(invalidMedia []models.Media) error {
	for _, media := range invalidMedia {
		log.Printf("🗑️ Removing invalid entry: %s (ID: %d)", media.Title, media.ID)
		
		// Clean up associated assets
		ss.cleanupMediaAssets(&media)
		
		// Remove from database
		if err := ss.scanner.GetMediaService().DeleteMedia(media.ID); err != nil {
			log.Printf("⚠️ Failed to delete invalid media %d: %v", media.ID, err)
		}
	}
	
	return nil
}

// cleanupMediaAssets removes associated asset files
func (ss *StorageSync) cleanupMediaAssets(media *models.Media) {
	assetsToClean := []string{
		media.ThumbnailPath,
		media.PreviewPath,
		media.PreviewClipPath,
		media.PosterPath,
	}
	
	for _, assetPath := range assetsToClean {
		if assetPath != "" {
			if err := os.Remove(assetPath); err != nil {
				log.Printf("⚠️ Failed to remove asset %s: %v", assetPath, err)
			} else {
				log.Printf("🗑️ Removed asset: %s", assetPath)
			}
		}
	}
}

// regenerateAssetsForValidMedia regenerates missing assets for valid media
func (ss *StorageSync) regenerateAssetsForValidMedia(mediaList []models.Media) {
	for _, media := range mediaList {
		needsAssets := false
		
		// Check if assets are missing or invalid
		if media.ThumbnailPath == "" || !ss.assetExists(media.ThumbnailPath) {
			needsAssets = true
		}
		if media.PreviewPath == "" || !ss.assetExists(media.PreviewPath) {
			needsAssets = true
		}
		if media.PosterPath == "" || !ss.assetExists(media.PosterPath) {
			needsAssets = true
		}
		
		if needsAssets {
			log.Printf("🎨 Scheduling asset regeneration for: %s", media.Title)
			ss.scheduleAssetRegeneration(&media)
		}
	}
}

// assetExists checks if an asset file exists
func (ss *StorageSync) assetExists(path string) bool {
	if path == "" {
		return false
	}
	
	_, err := os.Stat(path)
	return err == nil
}

// scheduleAssetRegeneration schedules asset regeneration for a media item
func (ss *StorageSync) scheduleAssetRegeneration(media *models.Media) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("❌ Asset regeneration panic for %s: %v", media.Title, r)
			}
		}()
		
		// Generate thumbnail if missing
		if media.ThumbnailPath == "" || !ss.assetExists(media.ThumbnailPath) {
			if thumbnailPath, err := ss.scanner.GetThumbnailService().GenerateThumbnail(media.FilePath, media.ID, media.Title); err == nil {
				media.ThumbnailPath = thumbnailPath
			}
		}
		
		// Generate preview if missing
		if media.PreviewPath == "" || !ss.assetExists(media.PreviewPath) {
			if previewPath, err := ss.scanner.GetThumbnailService().GeneratePreviewClip(media.FilePath, media.ID, media.Title); err == nil {
				media.PreviewPath = previewPath
				media.PreviewClipPath = previewPath
			}
		}
		
		// Generate poster if missing
		if media.PosterPath == "" || !ss.assetExists(media.PosterPath) {
			if err := ss.scanner.GetPosterService().DownloadPoster(media.Title, media.ID); err == nil {
				media.PosterPath = ss.scanner.GetPosterService().GetPosterPath(media.ID, media.Title)
			}
		}
		
		// Update media record
		if err := ss.scanner.GetMediaService().UpdateMedia(media); err != nil {
			log.Printf("⚠️ Failed to update media after asset regeneration: %v", err)
		}
	}()
}

// CheckStorageHealth performs health check on storage
func (ss *StorageSync) CheckStorageHealth() error {
	mediaPath := ss.scanner.GetMediaPath()
	
	// Check if media path exists
	if _, err := os.Stat(mediaPath); err != nil {
		return fmt.Errorf("media path not accessible: %s - %v", mediaPath, err)
	}
	
	// Check if media path is writable
	testFile := filepath.Join(mediaPath, ".homeflix_test")
	if err := os.WriteFile(testFile, []byte("test"), 0644); err != nil {
		return fmt.Errorf("media path not writable: %s - %v", mediaPath, err)
	}
	os.Remove(testFile)
	
	// Check asset directories
	assetDirs := []string{"./thumbnails", "./previews", "./posters"}
	for _, dir := range assetDirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			log.Printf("⚠️ Failed to create asset directory %s: %v", dir, err)
		}
	}
	
	log.Printf("✅ Storage health check passed")
	return nil
}

// GetSyncStats returns synchronization statistics
func (ss *StorageSync) GetSyncStats() map[string]interface{} {
	allMedia, err := ss.scanner.GetMediaService().GetAllMedia()
	if err != nil {
		return map[string]interface{}{"error": err.Error()}
	}
	
	var (
		validCount   int
		invalidCount int
		missingAssets int
	)
	
	for _, media := range allMedia {
		if ss.validateMediaFile(&media) {
			validCount++
			
			// Check assets
			if media.ThumbnailPath == "" || media.PreviewPath == "" || media.PosterPath == "" {
				missingAssets++
			}
		} else {
			invalidCount++
		}
	}
	
	return map[string]interface{}{
		"total_media":     len(allMedia),
		"valid_files":     validCount,
		"invalid_files":   invalidCount,
		"missing_assets":  missingAssets,
		"last_sync":       time.Now(),
		"media_path":      ss.scanner.GetMediaPath(),
	}
}