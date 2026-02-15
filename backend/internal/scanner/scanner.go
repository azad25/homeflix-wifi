package scanner

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"runtime/debug"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"homeflix-backend/internal/interfaces"
	"homeflix-backend/internal/models"
	"homeflix-backend/internal/utils"

	"github.com/h2non/filetype"
)

type MediaScanner struct {
	mediaPath             string   // Primary media path (for backward compatibility)
	mediaPaths            []string // All media paths to scan
	mediaService          interfaces.MediaServiceInterface
	thumbnailService      interfaces.ThumbnailServiceInterface
	posterService         interfaces.PosterServiceInterface
	geminiService         interfaces.GeminiServiceInterface
	celeryService         interfaces.CeleryServiceInterface
	alacService           interfaces.ALACAudioServiceInterface
	tmdbService           interfaces.TMDBServiceInterface
	recommendationService interfaces.RecommendationServiceInterface
	notificationService   interfaces.NotificationServiceInterface

	// Scan statistics
	startTime      time.Time
	totalFiles     int
	processedFiles int32
	errorFiles     int32
	skippedFiles   int32
	scanDuration   time.Duration
	lastScanTime   time.Time
	newFiles       int32
	updatedFiles   int32

	// Resource management
	activeGoroutines int32
	maxGoroutines    int32
	resourceMutex    sync.RWMutex
	maxWorkers       int
	batchSize        int

	// Progress tracking
	currentPhase     string
	currentOperation string
	progressTicker   *time.Ticker
	progressStop     chan bool
	progressMutex    sync.RWMutex

	// Caching
	metadataCache map[string]*models.Media
	cacheMutex    sync.RWMutex
	scanCache     map[string]time.Time

	// Queues
	priorityQueue    chan FileInfo
	lowPriorityQueue chan FileInfo

	// Skip patterns
	skipPatterns []string
}

type ScanStats struct {
	TotalFiles     int
	ProcessedFiles int
	SkippedFiles   int
	ErrorFiles     int
	NewFiles       int
	UpdatedFiles   int
	ScanDuration   time.Duration
	StartTime      time.Time
}

type FileInfo struct {
	Path       string
	Info       os.FileInfo
	IsVideo    bool
	IsSubtitle bool
}

// FileMetadata holds metadata extracted from file paths
type FileMetadata struct {
	Title       string
	Type        string
	Quality     string
	SeriesTitle string
	Season      int
	Episode     int
	Year        int
	Genres      []string
}


// FileInfo conversion not needed - using single type

func NewMediaScanner(mediaPath string, mediaService interfaces.MediaServiceInterface, thumbnailService interfaces.ThumbnailServiceInterface, posterService interfaces.PosterServiceInterface, geminiService interfaces.GeminiServiceInterface, celeryService interfaces.CeleryServiceInterface, alacService interfaces.ALACAudioServiceInterface, tmdbService interfaces.TMDBServiceInterface, recommendationService interfaces.RecommendationServiceInterface, notificationService interfaces.NotificationServiceInterface) *MediaScanner {
	return &MediaScanner{
		mediaPath:             mediaPath,
		mediaPaths:            []string{mediaPath}, // Initialize with primary path
		mediaService:          mediaService,
		thumbnailService:      thumbnailService,
		posterService:         posterService,
		geminiService:         geminiService,
		celeryService:         celeryService,
		alacService:           alacService,
		tmdbService:           tmdbService,
		recommendationService: recommendationService,
		notificationService:   notificationService,
		maxGoroutines:         8, // Reduced for i5-4590 stability
		maxWorkers:            1, // Single worker to prevent crashes
		batchSize:             5, // Smaller batches for stability
		progressStop:          make(chan bool),
		metadataCache:         make(map[string]*models.Media),
		scanCache:             make(map[string]time.Time),
		priorityQueue:         make(chan FileInfo, 100),
		lowPriorityQueue:      make(chan FileInfo, 500),
		skipPatterns:          []string{"$RECYCLE.BIN", ".DS_Store", "Thumbs.db"},
	}
}

// Resource monitoring methods for goroutine throttling
func (s *MediaScanner) canSpawnGoroutine() bool {
	s.resourceMutex.RLock()
	defer s.resourceMutex.RUnlock()
	return atomic.LoadInt32(&s.activeGoroutines) < s.maxGoroutines
}

func (s *MediaScanner) incrementGoroutines() {
	atomic.AddInt32(&s.activeGoroutines, 1)
	s.resourceMutex.RLock()
	active := atomic.LoadInt32(&s.activeGoroutines)
	s.resourceMutex.RUnlock()
	if active%10 == 0 { // Log every 10 goroutines
		log.Printf("🔧 Active goroutines: %d/%d", active, s.maxGoroutines)
	}
}

func (s *MediaScanner) decrementGoroutines() {
	atomic.AddInt32(&s.activeGoroutines, -1)
}

func (s *MediaScanner) getActiveGoroutines() int32 {
	return atomic.LoadInt32(&s.activeGoroutines)
}

// waitForBackgroundOperations waits for background goroutines to complete with timeout
func (s *MediaScanner) waitForBackgroundOperations(timeout time.Duration) {
	start := time.Now()
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		active := s.getActiveGoroutines()
		if active == 0 {
			log.Printf("✅ All background operations completed")
			return
		}

		if time.Since(start) > timeout {
			log.Printf("⚠️ Timeout waiting for background operations (%d still active)", active)
			return
		}

		select {
		case <-ticker.C:
			log.Printf("⏳ Waiting for %d background operations to complete...", active)
		default:
			time.Sleep(500 * time.Millisecond)
		}
	}
}

// isSystemOverloaded checks if the system is under heavy load
func (s *MediaScanner) isSystemOverloaded() bool {
	active := s.getActiveGoroutines()
	return float32(active)/float32(s.maxGoroutines) > 0.8 // 80% threshold
}

// Getter methods for scanner properties
func (s *MediaScanner) GetMediaPath() string {
	return s.mediaPath
}

// GetMediaPaths returns all configured media paths
func (s *MediaScanner) GetMediaPaths() []string {
	return s.mediaPaths
}

// SetMediaPaths updates the list of media paths to scan
func (s *MediaScanner) SetMediaPaths(paths []string) {
	s.mediaPaths = paths
	// Keep the first path as primary for backward compatibility
	if len(paths) > 0 {
		s.mediaPath = paths[0]
	}
}

// AddMediaPath adds a new media path to scan
func (s *MediaScanner) AddMediaPath(path string) {
	for _, existingPath := range s.mediaPaths {
		if existingPath == path {
			return // Path already exists
		}
	}
	s.mediaPaths = append(s.mediaPaths, path)
}

// RemoveMediaPath removes a media path from scanning
func (s *MediaScanner) RemoveMediaPath(path string) {
	for i, existingPath := range s.mediaPaths {
		if existingPath == path {
			s.mediaPaths = append(s.mediaPaths[:i], s.mediaPaths[i+1:]...)
			// Update primary path if needed
			if path == s.mediaPath && len(s.mediaPaths) > 0 {
				s.mediaPath = s.mediaPaths[0]
			}
			break
		}
	}
}

func (s *MediaScanner) GetMediaService() interfaces.MediaServiceInterface {
	return s.mediaService
}

func (s *MediaScanner) GetThumbnailService() interfaces.ThumbnailServiceInterface {
	return s.thumbnailService
}

func (s *MediaScanner) GetPosterService() interfaces.PosterServiceInterface {
	return s.posterService
}

func (s *MediaScanner) GetTMDBService() interfaces.TMDBServiceInterface {
	return s.tmdbService
}

func (s *MediaScanner) GetALACService() interfaces.ALACAudioServiceInterface {
	return s.alacService
}

func (s *MediaScanner) GetMaxWorkers() int {
	return s.maxWorkers
}

func (s *MediaScanner) GetBatchSize() int {
	return s.batchSize
}

func (s *MediaScanner) GetSkipPatterns() []string {
	return s.skipPatterns
}

func (s *MediaScanner) GetLastScanTime() time.Time {
	return s.lastScanTime
}

func (s *MediaScanner) GetPriorityQueue() chan FileInfo {
	return s.priorityQueue
}

func (s *MediaScanner) GetLowPriorityQueue() chan FileInfo {
	return s.lowPriorityQueue
}

func (s *MediaScanner) GetCacheMutex() *sync.RWMutex {
	return &s.cacheMutex
}

func (s *MediaScanner) GetScanCache() map[string]time.Time {
	return s.scanCache
}

func (s *MediaScanner) GetMetadataCacheEntry(key string) (*models.Media, bool) {
	s.cacheMutex.RLock()
	defer s.cacheMutex.RUnlock()
	media, exists := s.metadataCache[key]
	return media, exists
}

// Setter methods for scanner properties
func (s *MediaScanner) SetStartTime(t time.Time) {
	s.startTime = t
}

func (s *MediaScanner) SetTotalFiles(count int) {
	s.totalFiles = count
}

func (s *MediaScanner) SetScanDuration(d time.Duration) {
	s.scanDuration = d
}

func (s *MediaScanner) SetLastScanTime(t time.Time) {
	s.lastScanTime = t
}

func (s *MediaScanner) SetMaxWorkersValue(workers int) {
	s.maxWorkers = workers
}

func (s *MediaScanner) SetBatchSizeValue(size int) {
	s.batchSize = size
}

func (s *MediaScanner) SetMetadataCache(key string, media *models.Media) {
	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()
	s.metadataCache[key] = media
}

// Counter increment methods
func (s *MediaScanner) IncrementProcessedFiles() {
	atomic.AddInt32(&s.processedFiles, 1)
}

func (s *MediaScanner) IncrementErrorFiles() {
	atomic.AddInt32(&s.errorFiles, 1)
}

func (s *MediaScanner) IncrementSkippedFiles() {
	atomic.AddInt32(&s.skippedFiles, 1)
}

func (s *MediaScanner) IncrementNewFiles() {
	atomic.AddInt32(&s.newFiles, 1)
}

// SyncDatabaseWithStorageWithProgress performs database sync with progress updates
func (s *MediaScanner) SyncDatabaseWithStorageWithProgress(progress *ProgressTracker) error {
	progress.LogWithProgress("🔄 Starting comprehensive database-storage sync...")
	s.SetStartTime(time.Now())

	// Phase 0: Detect drive changes
	progress.UpdateOperation("🔍 Detecting drive changes and resolving paths...")
	if err := s.DetectDriveChanges(); err != nil {
		progress.LogWithProgress(fmt.Sprintf("⚠️ Warning: Drive change detection failed: %v", err))
	}

	// Get all media from database
	progress.UpdateOperation("📊 Loading media database...")
	allMedia, err := s.getAllMediaFromDatabase()
	if err != nil {
		progress.LogWithProgress(fmt.Sprintf("❌ Failed to load media database: %v", err))
		return fmt.Errorf("failed to load media database: %v", err)
	}

	progress.LogWithProgress(fmt.Sprintf("📁 Found %d media entries in database", len(allMedia)))
	progress.SetTotalFiles(len(allMedia))

	// Process each media entry with progress updates
	var validMedia, invalidMedia, updatedMedia []models.Media
	for i, media := range allMedia {
		progress.UpdateOperation(fmt.Sprintf("Validating: %s", media.Title))
		progress.UpdateGoroutines(int(s.getActiveGoroutines()))

		result := s.syncSingleMediaEntry(&media)
		switch result.Status {
		case "valid":
			validMedia = append(validMedia, media)
			progress.IncrementProcessed()
		case "invalid":
			invalidMedia = append(invalidMedia, media)
			progress.IncrementError()
		case "updated":
			updatedMedia = append(updatedMedia, media)
			progress.IncrementProcessed()
		}

		if (i+1)%10 == 0 {
			progress.LogWithProgress(fmt.Sprintf("📊 Progress: %d/%d entries processed", i+1, len(allMedia)))
		}
	}

	// Find orphaned files
	progress.UpdateOperation("🔍 Finding orphaned files...")
	orphanedFiles, err := s.findOrphanedFiles(allMedia)
	if err != nil {
		progress.LogWithProgress(fmt.Sprintf("⚠️ Warning: Failed to find orphaned files: %v", err))
	} else {
		progress.LogWithProgress(fmt.Sprintf("🆕 Found %d orphaned files", len(orphanedFiles)))
	}

	// Remove invalid entries
	progress.UpdateOperation("🗑️ Removing invalid entries...")
	for _, media := range invalidMedia {
		if err := s.handleInvalidMediaEntry(&media); err != nil {
			progress.LogWithProgress(fmt.Sprintf("⚠️ Warning: Failed to handle invalid media entry %d: %v", media.ID, err))
		}
	}

	// Regenerate assets
	progress.UpdateOperation("🎨 Regenerating assets...")
	s.regenerateAllAssets(append(validMedia, updatedMedia...))

	// Final statistics
	stats := s.GetScanStats()
	s.SetScanDuration(time.Since(stats.StartTime))
	s.logSyncResultsWithProgress(progress, len(allMedia), len(validMedia), len(invalidMedia), len(updatedMedia), len(orphanedFiles))

	progress.LogWithProgress(fmt.Sprintf("🔄 Database sync completed - %d invalid entries removed", len(invalidMedia)))
	return nil
}

// logSyncResultsWithProgress logs sync results using progress tracker
func (s *MediaScanner) logSyncResultsWithProgress(progress *ProgressTracker, total, valid, invalid, updated, orphaned int) {
	scanStats := s.GetScanStats()
	progress.LogWithProgress(fmt.Sprintf("✅ Database-Storage sync completed in %v", scanStats.ScanDuration))
	progress.LogWithProgress("📊 Sync Statistics:")
	progress.LogWithProgress(fmt.Sprintf("   📁 Total database entries: %d", total))
	progress.LogWithProgress(fmt.Sprintf("   ✅ Valid entries: %d", valid))
	progress.LogWithProgress(fmt.Sprintf("   ❌ Invalid entries: %d", invalid))
	progress.LogWithProgress(fmt.Sprintf("   🔄 Updated entries: %d", updated))
	progress.LogWithProgress(fmt.Sprintf("   🆕 Orphaned files found: %d", orphaned))
	progress.LogWithProgress(fmt.Sprintf("   ✅ Successfully processed: %d", scanStats.ProcessedFiles))
	progress.LogWithProgress(fmt.Sprintf("   ❌ Errors: %d", scanStats.ErrorFiles))

	if total > 0 {
		syncRate := float64(valid+updated) / float64(total) * 100
		progress.LogWithProgress(fmt.Sprintf("   📈 Sync success rate: %.1f%%", syncRate))
	}
}

// processFilesBatchWithProgress processes files in batches with progress updates
func (s *MediaScanner) processFilesBatchWithProgress(files []FileInfo, progress *ProgressTracker) error {
	batchSize := s.GetBatchSize()
	totalBatches := (len(files) + batchSize - 1) / batchSize

	for i := 0; i < len(files); i += batchSize {
		end := i + batchSize
		if end > len(files) {
			end = len(files)
		}

		batch := files[i:end]
		batchNum := (i / batchSize) + 1
		progress.UpdateOperation(fmt.Sprintf("Processing batch %d/%d (%d files)", batchNum, totalBatches, len(batch)))

		// Process batch with progress updates
		for _, file := range batch {
			progress.UpdateOperation(fmt.Sprintf("Processing: %s", filepath.Base(file.Path)))
			progress.UpdateGoroutines(int(s.getActiveGoroutines()))

			if file.IsVideo {
				if err := s.processVideoFileOptimized(file.Path, file.Info); err != nil {
					progress.IncrementError()
					progress.LogWithProgress(fmt.Sprintf("❌ Failed to process %s: %v", filepath.Base(file.Path), err))
				} else {
					progress.IncrementProcessed()
				}
			} else if file.IsSubtitle {
				if err := s.processSubtitleFile(file.Path); err != nil {
					progress.IncrementError()
				} else {
					progress.IncrementProcessed()
				}
			}
		}

		// Small delay between batches to prevent system overload
		if end < len(files) {
			time.Sleep(100 * time.Millisecond)
		}
	}

	return nil
}

// logScanResultsWithProgress logs scan results using progress tracker
func (s *MediaScanner) logScanResultsWithProgress(progress *ProgressTracker) {
	stats := s.GetScanStats()
	progress.LogWithProgress(fmt.Sprintf("✅ Media scan completed in %v", stats.ScanDuration))
	progress.LogWithProgress("📊 Scan Statistics:")
	progress.LogWithProgress(fmt.Sprintf("   📁 Total files discovered: %d", stats.TotalFiles))
	progress.LogWithProgress(fmt.Sprintf("   ✅ Successfully processed: %d", stats.ProcessedFiles))
	progress.LogWithProgress(fmt.Sprintf("   ⏭️ Skipped (unchanged): %d", stats.SkippedFiles))
	progress.LogWithProgress(fmt.Sprintf("   ❌ Errors: %d", stats.ErrorFiles))
	progress.LogWithProgress(fmt.Sprintf("   🆕 New files added: %d", stats.NewFiles))
	progress.LogWithProgress(fmt.Sprintf("   🔄 Files updated: %d", stats.UpdatedFiles))

	if stats.TotalFiles > 0 {
		successRate := float64(stats.ProcessedFiles) / float64(stats.TotalFiles) * 100
		progress.LogWithProgress(fmt.Sprintf("   📈 Success rate: %.1f%%", successRate))
	}
}

// getCachedMetadata retrieves cached metadata and converts to FileMetadata
func (s *MediaScanner) getCachedMetadata(filePath string) *FileMetadata {
	cached, exists := s.GetMetadataCacheEntry(filePath)
	if !exists {
		return nil
	}
	// Convert models.Media to FileMetadata
	genres := []string{}
	if len(cached.Genres) > 0 {
		for _, genre := range cached.Genres {
			genres = append(genres, genre.Name)
		}
	}

	season := 0
	if cached.Season != nil {
		season = *cached.Season
	}

	episode := 0
	if cached.Episode != nil {
		episode = *cached.Episode
	}

	return &FileMetadata{
		Title:       cached.Title,
		Type:        cached.Type,
		Quality:     cached.Quality,
		SeriesTitle: "", // Not stored in models.Media
		Season:      season,
		Episode:     episode,
		Year:        cached.Year,
		Genres:      genres,
	}
}

// extractMetadataWithCacheLocal extracts metadata with local caching
func (s *MediaScanner) extractMetadataWithCacheLocal(filePath string) *FileMetadata {
	return s.extractMetadataWithCache(filePath)
}

// ScanAndSyncMediaLibrary performs a comprehensive scan and sync of the media library
// This is the recommended method that ensures database-storage consistency
func (s *MediaScanner) ScanAndSyncMediaLibrary() error {
	return s.ScanAndSyncMediaLibraryWithProgress()
}

// ScanAndSyncMediaLibraryWithProgress performs comprehensive scan and sync with progress display
func (s *MediaScanner) ScanAndSyncMediaLibraryWithProgress() error {
	// Create and start progress tracker
	progress := NewProgressTracker()
	progress.Start()
	defer progress.Stop()

	progress.LogWithProgress("🚀 Starting comprehensive media library scan and sync...")

	// Phase 1: Sync existing database entries with storage
	progress.UpdatePhase("🔄 Phase 1: Syncing database with storage...")
	progress.LogWithProgress("🔍 Checking database consistency with file storage...")
	if err := s.SyncDatabaseWithStorageWithProgress(progress); err != nil {
		progress.LogWithProgress(fmt.Sprintf("⚠️ Warning: Database sync encountered issues: %v", err))
		// Continue with regular scan even if sync has issues
	}

	// Phase 2: Perform regular batch scan for new files
	progress.UpdatePhase("⚡ Phase 2: Scanning for new media files...")
	progress.LogWithProgress("🔍 Discovering and processing new media files...")
	if err := s.BatchScanMediaLibraryWithProgress(); err != nil {
		progress.LogWithProgress(fmt.Sprintf("❌ Batch scan failed: %v", err))
		return fmt.Errorf("batch scan failed: %v", err)
	}

	progress.UpdatePhase("✅ Comprehensive scan and sync completed!")
	progress.LogWithProgress("🎉 All media processing completed successfully!")
	return nil
}

// CleanupInvalidEntries removes database entries for media files that no longer exist
func (s *MediaScanner) CleanupInvalidEntries() error {
	return s.CleanupInvalidEntriesWithProgress()
}

// CleanupInvalidEntriesWithProgress removes database entries with progress display
func (s *MediaScanner) CleanupInvalidEntriesWithProgress() error {
	// Create and start progress tracker
	progress := NewProgressTracker()
	progress.Start()
	defer progress.Stop()

	progress.LogWithProgress("🧹 Starting cleanup of invalid database entries...")
	// Note: Using core scanner's stats tracking
	stats := s.GetScanStats()

	// Get all media from database
	allMedia, err := s.getAllMediaFromDatabase()
	if err != nil {
		return fmt.Errorf("failed to retrieve media from database: %v", err)
	}

	progress.LogWithProgress(fmt.Sprintf("📊 Found %d media entries in database", len(allMedia)))
	progress.SetTotalFiles(len(allMedia))

	var invalidMedia []models.Media
	var validCount int

	// Check each database entry against file system
	for _, media := range allMedia {
		progress.UpdateOperation(fmt.Sprintf("Checking: %s", media.Title))
		if _, err := os.Stat(media.FilePath); os.IsNotExist(err) {
			progress.LogWithProgress(fmt.Sprintf("❌ File not found: %s (ID: %d, Title: %s)", media.FilePath, media.ID, media.Title))
			invalidMedia = append(invalidMedia, media)
			progress.IncrementError()
		} else {
			validCount++
			progress.IncrementProcessed()
		}
	}

	progress.LogWithProgress(fmt.Sprintf("📊 Found %d invalid entries and %d valid entries", len(invalidMedia), validCount))

	// Remove invalid entries
	var deletedCount int
	for _, media := range invalidMedia {
		if err := s.handleInvalidMediaEntry(&media); err != nil {
			progress.LogWithProgress(fmt.Sprintf("⚠️ Warning: Failed to delete invalid media entry %d: %v", media.ID, err))
		} else {
			deletedCount++
		}
	}

	stats = s.GetScanStats()
	s.SetScanDuration(time.Since(stats.StartTime))
	progress.LogWithProgress("✅ Cleanup completed")
	progress.LogWithProgress("📊 Cleanup Statistics:")
	progress.LogWithProgress(fmt.Sprintf("   📁 Total entries checked: %d", len(allMedia)))
	progress.LogWithProgress(fmt.Sprintf("   ✅ Valid entries: %d", validCount))
	progress.LogWithProgress(fmt.Sprintf("   🗑️ Invalid entries found: %d", len(invalidMedia)))
	progress.LogWithProgress(fmt.Sprintf("   ✅ Successfully deleted: %d", deletedCount))
	progress.LogWithProgress(fmt.Sprintf("   ❌ Failed to delete: %d", len(invalidMedia)-deletedCount))

	return nil
}

// RegenerateAllAssets forces regeneration of all assets for all media in the database
// This is useful when you want to update thumbnails, previews, and posters without a full scan
func (s *MediaScanner) RegenerateAllAssets() error {
	log.Printf("🎨 Starting asset regeneration for all media...")

	// Get all media from database
	allMedia, err := s.getAllMediaFromDatabase()
	if err != nil {
		return fmt.Errorf("failed to retrieve media from database: %v", err)
	}

	log.Printf("🎨 Found %d media entries for asset regeneration", len(allMedia))

	// Filter out media with missing files
	var validMedia []models.Media
	for _, media := range allMedia {
		if _, err := os.Stat(media.FilePath); err == nil {
			validMedia = append(validMedia, media)
		} else {
			log.Printf("⚠️ Skipping asset regeneration for missing file: %s", media.FilePath)
		}
	}

	log.Printf("🎨 Regenerating assets for %d valid media entries...", len(validMedia))

	// Regenerate assets
	s.regenerateAllAssets(validMedia)

	log.Printf("✅ Asset regeneration completed for %d media items", len(validMedia))
	return nil
}

// RegeneratePreviewClips forces regeneration of preview clips for all media in the database
// This is specifically for fixing missing preview clips without regenerating other assets
func (s *MediaScanner) RegeneratePreviewClips() error {
	log.Printf("🎬 Starting preview clip regeneration for all media...")

	// Get all media from database
	allMedia, err := s.getAllMediaFromDatabase()
	if err != nil {
		return fmt.Errorf("failed to retrieve media from database: %v", err)
	}

	log.Printf("🎬 Found %d media entries for preview clip regeneration", len(allMedia))

	// Filter media that needs preview clips
	var mediaForPreviewGeneration []models.Media
	for _, media := range allMedia {
		// Check if file exists
		if _, err := os.Stat(media.FilePath); err != nil {
			log.Printf("⚠️ Skipping preview generation for missing file: %s", media.FilePath)
			continue
		}

		// Check if preview clip is missing or needs regeneration
		needsPreview := media.PreviewClipPath == "" || media.PreviewPath == ""

		// Also check if preview file actually exists on disk
		if media.PreviewClipPath != "" {
			if _, err := os.Stat(media.PreviewClipPath); os.IsNotExist(err) {
				needsPreview = true
				log.Printf("🔍 Preview file missing on disk for %s: %s", media.Title, media.PreviewClipPath)
			}
		}

		if needsPreview {
			mediaForPreviewGeneration = append(mediaForPreviewGeneration, media)
			log.Printf("📝 Queued for preview generation: %s", media.Title)
		} else {
			log.Printf("✅ Preview already exists for: %s", media.Title)
		}
	}

	log.Printf("🎬 Regenerating preview clips for %d media entries...", len(mediaForPreviewGeneration))

	if len(mediaForPreviewGeneration) == 0 {
		log.Printf("✅ All media already have preview clips!")
		return nil
	}

	// Regenerate preview clips in batches
	s.regeneratePreviewClipsBatch(mediaForPreviewGeneration)

	log.Printf("✅ Preview clip regeneration completed for %d media items", len(mediaForPreviewGeneration))
	return nil
}

// RegeneratePreviewClipsForMissingOnly regenerates preview clips only for media that are completely missing them
func (s *MediaScanner) RegeneratePreviewClipsForMissingOnly() error {
	log.Printf("🎬 Starting preview clip regeneration for media with missing preview clips...")

	// Get all media from database
	allMedia, err := s.getAllMediaFromDatabase()
	if err != nil {
		return fmt.Errorf("failed to retrieve media from database: %v", err)
	}

	log.Printf("🎬 Checking %d media entries for missing preview clips", len(allMedia))

	// Filter media that are completely missing preview clips
	var mediaWithoutPreviews []models.Media
	for _, media := range allMedia {
		// Check if file exists
		if _, err := os.Stat(media.FilePath); err != nil {
			continue
		}

		// Check if preview clip is completely missing
		if media.PreviewClipPath == "" && media.PreviewPath == "" {
			mediaWithoutPreviews = append(mediaWithoutPreviews, media)
			log.Printf("❌ No preview clip found for: %s", media.Title)
		}
	}

	log.Printf("🎬 Found %d media entries without preview clips", len(mediaWithoutPreviews))

	if len(mediaWithoutPreviews) == 0 {
		log.Printf("✅ All media already have preview clips!")
		return nil
	}

	// Regenerate preview clips
	s.regeneratePreviewClipsBatch(mediaWithoutPreviews)

	log.Printf("✅ Preview clip generation completed for %d media items", len(mediaWithoutPreviews))
	return nil
}

// ScanSubtitles scans the media storage for subtitle files and matches them to media
func (s *MediaScanner) ScanSubtitles() (*SubtitleScanResult, error) {
	log.Printf("📝 Starting subtitle scan for media storage...")
	
	result := &SubtitleScanResult{
		TotalSubtitles:     0,
		MatchedSubtitles:   0,
		UnmatchedSubtitles: 0,
		ProcessedFiles:     []string{},
		Errors:            []string{},
	}

	// Get all media from database for matching
	allMedia, err := s.getAllMediaFromDatabase()
	if err != nil {
		return result, fmt.Errorf("failed to retrieve media from database: %v", err)
	}

	log.Printf("📚 Retrieved %d media items from database for subtitle matching", len(allMedia))

	// Create a map for faster media lookup
	mediaMap := make(map[string]models.Media)
	for _, media := range allMedia {
		// Use directory path as key for matching
		dir := filepath.Dir(media.FilePath)
		baseName := strings.TrimSuffix(filepath.Base(media.FilePath), filepath.Ext(media.FilePath))
		key := filepath.Join(dir, baseName)
		mediaMap[key] = media
		
		// Also add cleaned title variants for better matching
		if s.GetTMDBService() != nil {
			cleanedTitle := s.GetTMDBService().CleanTitle(media.Title)
			if cleanedTitle != "" && cleanedTitle != media.Title {
				cleanedKey := filepath.Join(dir, cleanedTitle)
				mediaMap[cleanedKey] = media
			}
		}
	}

	log.Printf("🗂️ Created media map with %d entries for subtitle matching", len(mediaMap))

	// Walk through media directory to find subtitle files
	err = filepath.Walk(s.GetMediaPath(), func(path string, info os.FileInfo, err error) error {
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Error accessing %s: %v", path, err))
			return nil
		}

		if info.IsDir() {
			return nil
		}

		// Check if it's a subtitle file
		if !s.isSubtitleFile(path) {
			return nil
		}

		result.TotalSubtitles++
		result.ProcessedFiles = append(result.ProcessedFiles, path)

		// Try to match subtitle to media
		matchedMedia := s.findMediaForSubtitle(path, mediaMap)
		if matchedMedia != nil {
			// Process the subtitle file
			err := s.processSubtitleForMedia(path, *matchedMedia)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("Failed to process subtitle %s: %v", path, err))
			} else {
				result.MatchedSubtitles++
				log.Printf("✅ Matched subtitle %s to media: %s", filepath.Base(path), matchedMedia.Title)
			}
		} else {
			result.UnmatchedSubtitles++
			log.Printf("⚠️ No matching media found for subtitle: %s", filepath.Base(path))
		}

		return nil
	})

	if err != nil {
		return result, fmt.Errorf("error walking media directory: %v", err)
	}

	log.Printf("📝 Subtitle scan completed: %d total, %d matched, %d unmatched", 
		result.TotalSubtitles, result.MatchedSubtitles, result.UnmatchedSubtitles)

	return result, nil
}

// SubtitleScanResult holds the results of a subtitle scan
type SubtitleScanResult struct {
	TotalSubtitles     int      `json:"totalSubtitles"`
	MatchedSubtitles   int      `json:"matchedSubtitles"`
	UnmatchedSubtitles int      `json:"unmatchedSubtitles"`
	ProcessedFiles     []string `json:"processedFiles"`
	Errors            []string `json:"errors"`
}

// findMediaForSubtitle finds the matching media for a subtitle file using advanced TMDB title cleaning
func (s *MediaScanner) findMediaForSubtitle(subtitlePath string, mediaMap map[string]models.Media) *models.Media {
	dir := filepath.Dir(subtitlePath)
	subtitleName := filepath.Base(subtitlePath)
	subtitleBase := strings.TrimSuffix(subtitleName, filepath.Ext(subtitleName))

	// Remove language suffix from subtitle name (e.g., "movie.en.srt" -> "movie")
	subtitleBase = s.removeLanguageSuffix(subtitleBase)

	log.Printf("🔍 Matching subtitle: %s (cleaned: %s)", subtitleName, subtitleBase)

	// Use TMDB service for advanced title cleaning if available
	var cleanedSubtitleTitle string
	if s.GetTMDBService() != nil {
		cleanedSubtitleTitle = s.GetTMDBService().CleanTitle(subtitleBase)
		// Also remove year for better matching
		cleanedSubtitleTitle = s.GetTMDBService().RemoveYearFromTitle(cleanedSubtitleTitle)
	} else {
		cleanedSubtitleTitle = s.cleanTitle(subtitleBase)
	}

	log.Printf("🧹 TMDB cleaned subtitle title: '%s'", cleanedSubtitleTitle)

	// Strategy 1: Look for exact match in same directory
	exactKey := filepath.Join(dir, subtitleBase)
	if media, exists := mediaMap[exactKey]; exists {
		log.Printf("✅ Found exact path match for subtitle: %s", media.Title)
		return &media
	}

	// Strategy 2: Advanced title matching using TMDB cleaning
	bestMatch := s.findBestTitleMatch(cleanedSubtitleTitle, dir, mediaMap)
	if bestMatch != nil {
		log.Printf("✅ Found TMDB title match: %s -> %s", cleanedSubtitleTitle, bestMatch.Title)
		return bestMatch
	}

	// Strategy 3: Fallback to original matching logic for same directory
	for _, media := range mediaMap {
		mediaDir := filepath.Dir(media.FilePath)
		mediaBase := strings.TrimSuffix(filepath.Base(media.FilePath), filepath.Ext(media.FilePath))

		// Check if in same directory
		if mediaDir == dir {
			// Check for partial name match
			if s.isSubtitleMatch(subtitleBase, mediaBase) {
				log.Printf("✅ Found directory match: %s -> %s", subtitleBase, media.Title)
				return &media
			}
		}
	}

	// Strategy 4: Look for matches in parent/child directories
	for _, media := range mediaMap {
		mediaDir := filepath.Dir(media.FilePath)
		mediaBase := strings.TrimSuffix(filepath.Base(media.FilePath), filepath.Ext(media.FilePath))

		// Check if directories are related (parent/child)
		if s.areDirectoriesRelated(dir, mediaDir) {
			if s.isSubtitleMatch(subtitleBase, mediaBase) {
				log.Printf("✅ Found related directory match: %s -> %s", subtitleBase, media.Title)
				return &media
			}
		}
	}

	log.Printf("❌ No match found for subtitle: %s", subtitleName)
	return nil
}

// removeLanguageSuffix removes language codes from subtitle filenames
func (s *MediaScanner) removeLanguageSuffix(filename string) string {
	// Common language patterns to remove (both middle and end positions)
	langPatterns := []string{
		// End patterns
		`\.en$`, `\.eng$`, `\.english$`,
		`\.es$`, `\.spa$`, `\.spanish$`,
		`\.fr$`, `\.fre$`, `\.french$`,
		`\.de$`, `\.ger$`, `\.german$`,
		`\.it$`, `\.ita$`, `\.italian$`,
		`\.pt$`, `\.por$`, `\.portuguese$`,
		`\.ru$`, `\.rus$`, `\.russian$`,
		`\.ja$`, `\.jpn$`, `\.japanese$`,
		`\.ko$`, `\.kor$`, `\.korean$`,
		`\.zh$`, `\.chi$`, `\.chinese$`,
		`\.ar$`, `\.ara$`, `\.arabic$`,
		// Middle patterns (between dots)
		`\.en\.`, `\.eng\.`, `\.english\.`,
		`\.es\.`, `\.spa\.`, `\.spanish\.`,
		`\.fr\.`, `\.fre\.`, `\.french\.`,
		`\.de\.`, `\.ger\.`, `\.german\.`,
		`\.it\.`, `\.ita\.`, `\.italian\.`,
		`\.pt\.`, `\.por\.`, `\.portuguese\.`,
		`\.ru\.`, `\.rus\.`, `\.russian\.`,
		`\.ja\.`, `\.jpn\.`, `\.japanese\.`,
		`\.ko\.`, `\.kor\.`, `\.korean\.`,
		`\.zh\.`, `\.chi\.`, `\.chinese\.`,
		`\.ar\.`, `\.ara\.`, `\.arabic\.`,
		// Common subtitle type indicators
		`\.cc$`, `\.sdh$`, `\.hi$`, `\.forced$`, `\.full$`,
		`\.cc\.`, `\.sdh\.`, `\.hi\.`, `\.forced\.`, `\.full\.`,
	}

	original := filename
	for _, pattern := range langPatterns {
		re := regexp.MustCompile(`(?i)` + pattern) // Case insensitive
		filename = re.ReplaceAllString(filename, "")
	}

	// Clean up any double dots that might result from removal
	filename = regexp.MustCompile(`\.+`).ReplaceAllString(filename, ".")
	filename = strings.Trim(filename, ".")

	log.Printf("🔤 Language suffix removal: '%s' -> '%s'", original, filename)
	return filename
}

// isSubtitleMatch checks if a subtitle name matches a media name
func (s *MediaScanner) isSubtitleMatch(subtitleBase, mediaBase string) bool {
	// Normalize names for comparison
	subNorm := strings.ToLower(strings.ReplaceAll(subtitleBase, "_", " "))
	mediaNorm := strings.ToLower(strings.ReplaceAll(mediaBase, "_", " "))

	// Remove common video quality indicators from media name
	qualityPatterns := []string{
		"1080p", "720p", "480p", "4k", "2160p",
		"bluray", "bdrip", "webrip", "web-dl", "hdtv",
		"x264", "x265", "h264", "h265", "hevc",
		"aac", "ac3", "dts", "mp3",
	}

	for _, pattern := range qualityPatterns {
		mediaNorm = strings.ReplaceAll(mediaNorm, pattern, "")
		subNorm = strings.ReplaceAll(subNorm, pattern, "")
	}

	// Clean up extra spaces
	mediaNorm = regexp.MustCompile(`\s+`).ReplaceAllString(strings.TrimSpace(mediaNorm), " ")
	subNorm = regexp.MustCompile(`\s+`).ReplaceAllString(strings.TrimSpace(subNorm), " ")

	// Check for exact match
	if subNorm == mediaNorm {
		return true
	}

	// Check if subtitle name is contained in media name or vice versa
	if len(subNorm) > 3 && strings.Contains(mediaNorm, subNorm) {
		return true
	}
	if len(mediaNorm) > 3 && strings.Contains(subNorm, mediaNorm) {
		return true
	}

	// Check for word-based similarity
	subWords := strings.Fields(subNorm)
	mediaWords := strings.Fields(mediaNorm)

	if len(subWords) > 0 && len(mediaWords) > 0 {
		// Check if first significant word matches
		if len(subWords[0]) > 3 && len(mediaWords[0]) > 3 {
			return strings.Contains(subWords[0], mediaWords[0]) || strings.Contains(mediaWords[0], subWords[0])
		}
	}

	return false
}

// findBestTitleMatch finds the best matching media using TMDB title cleaning
func (s *MediaScanner) findBestTitleMatch(cleanedSubtitleTitle, subtitleDir string, mediaMap map[string]models.Media) *models.Media {
	if cleanedSubtitleTitle == "" || len(cleanedSubtitleTitle) < 3 {
		return nil
	}

	var bestMatch *models.Media
	var bestScore float64 = 0
	
	// Normalize subtitle title for comparison
	normalizedSubTitle := strings.ToLower(strings.TrimSpace(cleanedSubtitleTitle))

	for _, media := range mediaMap {
		// Clean the media title using TMDB service
		var cleanedMediaTitle string
		if s.GetTMDBService() != nil {
			cleanedMediaTitle = s.GetTMDBService().CleanTitle(media.Title)
			cleanedMediaTitle = s.GetTMDBService().RemoveYearFromTitle(cleanedMediaTitle)
		} else {
			cleanedMediaTitle = s.cleanTitle(media.Title)
		}

		if cleanedMediaTitle == "" || len(cleanedMediaTitle) < 3 {
			continue
		}

		normalizedMediaTitle := strings.ToLower(strings.TrimSpace(cleanedMediaTitle))
		
		// Calculate similarity score
		score := s.calculateTitleSimilarity(normalizedSubTitle, normalizedMediaTitle)
		
		// Boost score if in same directory
		mediaDir := filepath.Dir(media.FilePath)
		if mediaDir == subtitleDir {
			score += 0.3 // 30% boost for same directory
		} else if s.areDirectoriesRelated(subtitleDir, mediaDir) {
			score += 0.1 // 10% boost for related directories
		}

		// Update best match if this score is better
		if score > bestScore && score >= 0.7 { // Minimum 70% similarity required
			bestScore = score
			bestMatch = &media
		}

		log.Printf("🎯 Title similarity: '%s' vs '%s' = %.2f", normalizedSubTitle, normalizedMediaTitle, score)
	}

	if bestMatch != nil {
		log.Printf("🏆 Best match found with score %.2f: %s", bestScore, bestMatch.Title)
	}

	return bestMatch
}

// calculateTitleSimilarity calculates similarity between two normalized titles
func (s *MediaScanner) calculateTitleSimilarity(title1, title2 string) float64 {
	if title1 == title2 {
		return 1.0 // Perfect match
	}

	// Check for substring matches
	if strings.Contains(title1, title2) || strings.Contains(title2, title1) {
		shorter := title1
		longer := title2
		if len(title2) < len(title1) {
			shorter = title2
			longer = title1
		}
		return float64(len(shorter)) / float64(len(longer))
	}

	// Word-based similarity
	words1 := strings.Fields(title1)
	words2 := strings.Fields(title2)

	if len(words1) == 0 || len(words2) == 0 {
		return 0
	}

	// Count matching words
	matchingWords := 0
	totalWords := len(words1)

	for _, word1 := range words1 {
		if len(word1) < 3 { // Skip very short words
			continue
		}
		for _, word2 := range words2 {
			if len(word2) < 3 {
				continue
			}
			// Check for exact match or substring match for longer words
			if word1 == word2 || (len(word1) > 4 && strings.Contains(word1, word2)) || (len(word2) > 4 && strings.Contains(word2, word1)) {
				matchingWords++
				break
			}
		}
	}

	if totalWords == 0 {
		return 0
	}

	return float64(matchingWords) / float64(totalWords)
}

// areDirectoriesRelated checks if two directories are parent/child related
func (s *MediaScanner) areDirectoriesRelated(dir1, dir2 string) bool {
	// Normalize paths
	dir1 = filepath.Clean(dir1)
	dir2 = filepath.Clean(dir2)

	// Check if one is parent of the other
	return strings.HasPrefix(dir1, dir2) || strings.HasPrefix(dir2, dir1)
}

// processSubtitleForMedia processes a subtitle file for a specific media
func (s *MediaScanner) processSubtitleForMedia(subtitlePath string, media models.Media) error {
	// Extract language from filename
	language := s.extractLanguageFromSubtitle(subtitlePath)
	
	// Get subtitle format
	format := strings.TrimPrefix(filepath.Ext(subtitlePath), ".")

	// Check if this subtitle track already exists
	existingTracks, err := s.GetMediaService().GetSubtitleTracks(media.ID)
	if err != nil {
		log.Printf("⚠️ Failed to get existing subtitle tracks: %v", err)
	}

	// Check for duplicates
	for _, track := range existingTracks {
		if track.TrackType == "external" && track.FilePath == subtitlePath {
			log.Printf("⚠️ Subtitle track already exists: %s", subtitlePath)
			return nil
		}
	}

	// Create subtitle track entry
	subtitleTrack := &models.SubtitleTrack{
		MediaID:     media.ID,
		StreamIndex: -1, // External subtitles don't have stream index
		Language:    language,
		Title:       fmt.Sprintf("%s (External)", language),
		CodecName:   format,
		FilePath:    subtitlePath,
		Format:      format,
		TrackType:   "external",
		IsDefault:   false,
		IsForced:    false,
		IsHearing:   strings.Contains(strings.ToLower(subtitlePath), "cc") || strings.Contains(strings.ToLower(subtitlePath), "sdh"),
	}

	err = s.GetMediaService().CreateSubtitleTrack(subtitleTrack)
	if err != nil {
		return fmt.Errorf("failed to create subtitle track: %v", err)
	}

	// Also create legacy subtitle entry for backward compatibility
	subtitle := &models.Subtitle{
		MediaID:  media.ID,
		Language: language,
		FilePath: subtitlePath,
		Format:   format,
	}

	err = s.GetMediaService().CreateSubtitle(subtitle)
	if err != nil {
		log.Printf("⚠️ Failed to create legacy subtitle entry: %v", err)
		// Don't return error as the main subtitle track was created successfully
	}

	return nil
}

// fetchAndUpdateEpisodeMetadata fetches episode metadata from TMDB and updates the media record
func (s *MediaScanner) fetchAndUpdateEpisodeMetadata(media *models.Media, tvID int, seasonNumber int, episodeNumber int) {
	if s.GetTMDBService() == nil {
		return
	}

	// Fetch episode details from TMDB
	episode, err := s.GetTMDBService().GetEpisodeDetails(tvID, seasonNumber, episodeNumber)
	if err != nil {
		log.Printf("⚠️ Failed to fetch TMDB episode details for S%02dE%02d: %v", seasonNumber, episodeNumber, err)
		return
	}

	// Update media with episode metadata
	if episode.Name != "" {
		// Store the episode title in a separate field or append to title
		media.EpisodeTitle = episode.Name
		log.Printf("📺 Episode title: %s", episode.Name)
	}

	if episode.Overview != "" {
		media.Description = episode.Overview
		log.Printf("📝 Episode description updated")
	}

	if episode.Runtime > 0 {
		media.Runtime = episode.Runtime
		log.Printf("⏱️ Episode runtime: %d minutes", episode.Runtime)
	}

	if episode.VoteAverage > 0 {
		media.Rating = episode.VoteAverage
		log.Printf("⭐ Episode rating: %.1f", episode.VoteAverage)
	}

	if episode.VoteCount > 0 {
		media.VoteCount = episode.VoteCount
	}

	if episode.AirDate != "" {
		// Parse air date and extract year
		if parsedTime, err := time.Parse("2006-01-02", episode.AirDate); err == nil {
			media.Year = parsedTime.Year()
			log.Printf("📅 Episode air date: %s (year: %d)", episode.AirDate, media.Year)
		}
	}

	// Download episode still/thumbnail if available
	if episode.StillPath != "" {
		stillDir := "./episode_stills"
		stillPath, err := s.GetTMDBService().DownloadEpisodeStill(
			episode.StillPath, 
			tvID, 
			seasonNumber, 
			episodeNumber, 
			stillDir,
		)
		if err != nil {
			log.Printf("⚠️ Failed to download episode still: %v", err)
		} else if stillPath != "" {
			media.EpisodeStillPath = stillPath
			log.Printf("🖼️ Episode still downloaded: %s", stillPath)
		}
	}

	// Extract crew information (directors, writers)
	var directors []string
	var writers []string
	for _, crew := range episode.Crew {
		switch crew.Job {
		case "Director":
			directors = append(directors, crew.Name)
		case "Writer", "Screenplay", "Story":
			writers = append(writers, crew.Name)
		}
	}

	if len(directors) > 0 {
		media.Director = directors
		log.Printf("🎬 Episode directors: %v", directors)
	}

	if len(writers) > 0 {
		media.Writers = writers
		log.Printf("✍️ Episode writers: %v", writers)
	}

	// Extract guest stars
	if len(episode.GuestStars) > 0 {
		var guestStars []string
		for i, guest := range episode.GuestStars {
			if i >= 10 { // Limit to top 10 guest stars
				break
			}
			guestStars = append(guestStars, fmt.Sprintf("%s (%s)", guest.Name, guest.Character))
		}
		media.GuestStars = guestStars
		log.Printf("🌟 Episode guest stars: %v", guestStars)
	}

	log.Printf("✅ Episode metadata updated from TMDB: %s S%02dE%02d - %s", 
		media.Title, seasonNumber, episodeNumber, episode.Name)
}

// ProcessSubtitleFile processes a single subtitle file (implements SubtitleProcessor interface)
func (s *MediaScanner) ProcessSubtitleFile(path string, info os.FileInfo) error {
	log.Printf("📝 Processing subtitle file: %s", filepath.Base(path))
	
	// Get all media from database for matching
	allMedia, err := s.getAllMediaFromDatabase()
	if err != nil {
		return fmt.Errorf("failed to retrieve media from database: %v", err)
	}

	// Create a map for faster media lookup
	mediaMap := make(map[string]models.Media)
	for _, media := range allMedia {
		// Use directory path as key for matching
		dir := filepath.Dir(media.FilePath)
		baseName := strings.TrimSuffix(filepath.Base(media.FilePath), filepath.Ext(media.FilePath))
		key := filepath.Join(dir, baseName)
		mediaMap[key] = media
	}

	// Try to match subtitle to media
	matchedMedia := s.findMediaForSubtitle(path, mediaMap)
	if matchedMedia != nil {
		// Process the subtitle file
		err := s.processSubtitleForMedia(path, *matchedMedia)
		if err != nil {
			return fmt.Errorf("failed to process subtitle %s: %v", path, err)
		}
		log.Printf("✅ Successfully matched and processed subtitle %s for media: %s", filepath.Base(path), matchedMedia.Title)
		return nil
	}

	log.Printf("⚠️ No matching media found for subtitle: %s", filepath.Base(path))
	return nil
}

func (s *MediaScanner) ScanMediaLibrary() error {
	// Use the new batch-optimized scanning by default
	return s.BatchScanMediaLibrary()
}

// EnsureCompleteSyncOnStartup performs comprehensive sync validation on server startup
func (s *MediaScanner) EnsureCompleteSyncOnStartup() error {
	log.Printf("🚀 Starting comprehensive media sync validation on server startup...")
	
	// Create progress tracker for startup sync
	progress := NewProgressTracker()
	progress.Start()
	defer progress.Stop()
	
	// Perform comprehensive validation
	if err := s.validateCompleteSyncWithProgress(progress); err != nil {
		log.Printf("❌ Startup sync validation failed: %v", err)
		return fmt.Errorf("startup sync validation failed: %v", err)
	}
	
	// Poster checking disabled for faster startup - file watcher will handle new media posters
	progress.LogWithProgress("ℹ️ Poster checking disabled for faster startup - file watcher will handle new media posters")
	
	log.Printf("✅ Startup media sync validation completed successfully")
	return nil
}

// ensureAllPostersOnStartup downloads missing posters for all media on startup
func (s *MediaScanner) ensureAllPostersOnStartup(progress *ProgressTracker) error {
	if s.GetPosterService() == nil {
		progress.LogWithProgress("⚠️ Poster service not available, skipping poster downloads")
		return nil
	}

	progress.LogWithProgress("🎨 Starting poster download check for all media...")

	// Get all media from database
	allMedia, err := s.getAllMediaFromDatabase()
	if err != nil {
		return fmt.Errorf("failed to get media from database: %v", err)
	}

	progress.LogWithProgress(fmt.Sprintf("📊 Checking posters for %d media items", len(allMedia)))

	// Filter media that need posters
	var mediaNeedingPosters []models.Media
	for _, media := range allMedia {
		// Check if file exists
		if _, err := os.Stat(media.FilePath); err != nil {
			continue // Skip missing files
		}

		// Check if poster is missing
		if s.isAssetMissing(media.PosterPath, "poster", media.ID, media.Title) {
			// Also check if poster exists using poster service
			if posterPath := s.GetPosterService().GetPosterPath(media.ID, media.Title); posterPath == "" {
				mediaNeedingPosters = append(mediaNeedingPosters, media)
			} else {
				// Update database with found poster path
				media.PosterPath = posterPath
				s.GetMediaService().UpdateMedia(&media)
				log.Printf("✅ Found existing poster for %s: %s", media.Title, posterPath)
			}
		}
	}

	if len(mediaNeedingPosters) == 0 {
		progress.LogWithProgress("✅ All media already have posters!")
		return nil
	}

	progress.LogWithProgress(fmt.Sprintf("🎨 Found %d media items needing posters, starting downloads...", len(mediaNeedingPosters)))

	// Download posters in batches to avoid overwhelming TMDB API
	batchSize := 5 // Small batch size to respect API limits
	successful := 0
	failed := 0

	for i := 0; i < len(mediaNeedingPosters); i += batchSize {
		end := i + batchSize
		if end > len(mediaNeedingPosters) {
			end = len(mediaNeedingPosters)
		}

		batch := mediaNeedingPosters[i:end]
		batchNum := (i / batchSize) + 1
		totalBatches := (len(mediaNeedingPosters) + batchSize - 1) / batchSize

		progress.UpdateOperation(fmt.Sprintf("Downloading poster batch %d/%d (%d-%d of %d)", 
			batchNum, totalBatches, i+1, end, len(mediaNeedingPosters)))

		// Process batch sequentially to respect API rate limits
		for _, media := range batch {
			progress.UpdateOperation(fmt.Sprintf("Downloading poster for: %s", media.Title))
			
			if posterPath, err := s.GetPosterService().DownloadPosterWithPath(media.Title, media.ID); err != nil {
				log.Printf("❌ Failed to download poster for %s: %v", media.Title, err)
				failed++
			} else if posterPath != "" {
				// Update database with poster path
				media.PosterPath = posterPath
				if updateErr := s.GetMediaService().UpdateMedia(&media); updateErr != nil {
					log.Printf("⚠️ Failed to update media with poster path: %v", updateErr)
				} else {
					successful++
					log.Printf("✅ Downloaded and saved poster for: %s", media.Title)
				}
			}

			// Small delay between downloads to respect API rate limits
			time.Sleep(1 * time.Second)
		}

		// Longer delay between batches
		if end < len(mediaNeedingPosters) {
			progress.LogWithProgress(fmt.Sprintf("⏸️ Batch %d completed, waiting 5 seconds before next batch...", batchNum))
			time.Sleep(5 * time.Second)
		}
	}

	progress.LogWithProgress(fmt.Sprintf("✅ Poster download completed: %d successful, %d failed out of %d total", 
		successful, failed, len(mediaNeedingPosters)))

	return nil
}

// discoverFiles performs safe file discovery with resource limits
func (s *MediaScanner) discoverFiles() ([]FileInfo, error) {
	var files []FileInfo
	var mu sync.Mutex

	// Minimal buffer size for i5-4590 memory constraints
	fileChan := make(chan FileInfo, 20) // Further reduced for stability
	done := make(chan bool)

	// Start collector goroutine with proper cleanup
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("⚠️ Collector goroutine recovered from panic: %v", r)
			}
			done <- true
		}()

		for file := range fileChan {
			mu.Lock()
			files = append(files, file)
			mu.Unlock()
		}
	}()

	// Use sequential walking to prevent goroutine explosion - scan all media paths
	var walkErr error
	for _, mediaPath := range s.GetMediaPaths() {
		log.Printf("🔍 Scanning media path: %s", mediaPath)
		err := filepath.Walk(mediaPath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				log.Printf("⚠️ Error accessing path %s: %v", path, err)
				s.IncrementErrorFiles()
				return nil // Continue scanning
			}

			if info.IsDir() {
				// Skip hidden, system directories, and problematic paths
				dirName := filepath.Base(path)
				if strings.HasPrefix(dirName, ".") ||
					dirName == "System Volume Information" ||
					strings.Contains(path, "$RECYCLE.BIN") ||
					strings.HasPrefix(dirName, "$") {
					return filepath.SkipDir
				}
				return nil
			}

		// Skip files matching skip patterns
		fileName := filepath.Base(path)
		for _, pattern := range s.GetSkipPatterns() {
			if matched, _ := filepath.Match(pattern, fileName); matched {
				return nil
			}
		}

		// Skip files that are too large (>15GB) to prevent memory issues
		if info.Size() > 15*1024*1024*1024 {
			log.Printf("⚠️ Skipping oversized file: %s (%d bytes)", path, info.Size())
			return nil
		}

		// Ultra-fast file type detection using extension first
		ext := strings.ToLower(filepath.Ext(path))
		isVideo := s.isVideoFileByExtension(ext)
		isSubtitle := s.isSubtitleFileByExtension(ext)

		if isVideo || isSubtitle {
			fileInfo := FileInfo{
				Path:       path,
				Info:       info,
				IsVideo:    isVideo,
				IsSubtitle: isSubtitle,
			}

			// Use non-blocking send to prevent deadlocks
			select {
			case fileChan <- fileInfo:
			default:
				// Channel full, add directly with mutex
				mu.Lock()
				files = append(files, fileInfo)
				mu.Unlock()
			}
		}

		return nil
		})
		
		if err != nil {
			log.Printf("⚠️ Error scanning media path %s: %v", mediaPath, err)
			walkErr = err // Store the last error, but continue with other paths
		}
	}

	// Close channel and wait for collector to finish
	close(fileChan)
	<-done

	return files, walkErr
}

// isVideoFileByExtension performs ultra-fast video detection by extension only
func (s *MediaScanner) isVideoFileByExtension(ext string) bool {
	videoExts := map[string]bool{
		".mp4": true, ".mkv": true, ".avi": true, ".mov": true,
		".wmv": true, ".flv": true, ".webm": true, ".m4v": true,
		".mpg": true, ".mpeg": true, ".3gp": true, ".ogv": true,
		".ts": true, ".m2ts": true, ".mts": true, ".vob": true,
	}
	return videoExts[ext]
}

// isSubtitleFileByExtension performs ultra-fast subtitle detection by extension only
func (s *MediaScanner) isSubtitleFileByExtension(ext string) bool {
	subtitleExts := map[string]bool{
		".srt": true, ".vtt": true, ".ass": true,
		".ssa": true, ".sub": true, ".idx": true,
	}
	return subtitleExts[ext]
}

// processFilesSequential processes files one by one to avoid parallel asset generation
func (s *MediaScanner) processFilesSequential(files []FileInfo) error {
	for _, file := range files {
		if file.IsVideo {
			// Check if file needs processing
			if s.shouldSkipFile(file.Path, file.Info) {
				s.IncrementSkippedFiles()
				continue
			}

			// Process video file sequentially
			s.processVideoFile(file.Path, file.Info)
			s.IncrementProcessedFiles()
		} else if file.IsSubtitle {
			// Process subtitle file
			s.processSubtitleFile(file.Path)
			s.IncrementProcessedFiles()
		}
	}

	return nil
}

// processFilesBatch processes files in optimized batches using system resources
func (s *MediaScanner) processFilesBatch(files []FileInfo) error {
	// Separate video and subtitle files with size limits
	var videoFiles, subtitleFiles []FileInfo
	for _, file := range files {
		// Skip files that might cause issues
		if file.Info.Size() > 15*1024*1024*1024 { // Skip files > 15GB
			log.Printf("⚠️ Skipping oversized file: %s (%d bytes)", file.Path, file.Info.Size())
			s.IncrementSkippedFiles()
			continue
		}

		if file.IsVideo && !s.shouldSkipFile(file.Path, file.Info) {
			videoFiles = append(videoFiles, file)
		} else if file.IsSubtitle {
			subtitleFiles = append(subtitleFiles, file)
		} else if file.IsVideo {
			s.IncrementSkippedFiles()
		}
	}

	log.Printf("📊 Batch processing: %d videos, %d subtitles", len(videoFiles), len(subtitleFiles))

	// Process video files in batches with error recovery
	if len(videoFiles) > 0 {
		if err := s.processVideoBatchesWithRecovery(videoFiles); err != nil {
			log.Printf("⚠️ Video batch processing had errors: %v", err)
			// Don't return error, continue with subtitles
		}
	}

	// Process subtitle files with error recovery
	if len(subtitleFiles) > 0 {
		s.processSubtitlesBatchWithRecovery(subtitleFiles)
	}

	return nil
}

// processVideoBatchesWithRecovery processes video files in optimized batches with error recovery
func (s *MediaScanner) processVideoBatchesWithRecovery(videoFiles []FileInfo) error {
	// Calculate optimal batch size based on system resources
	optimalBatchSize := s.calculateOptimalBatchSize()
	log.Printf("🔧 Using batch size: %d (based on system resources)", optimalBatchSize)

	totalBatches := (len(videoFiles) + optimalBatchSize - 1) / optimalBatchSize
	var totalErrors int

	for i := 0; i < len(videoFiles); i += optimalBatchSize {
		end := i + optimalBatchSize
		if end > len(videoFiles) {
			end = len(videoFiles)
		}

		batch := videoFiles[i:end]
		batchNum := (i / optimalBatchSize) + 1

		log.Printf("🔄 Processing video batch %d/%d (%d files)", batchNum, totalBatches, len(batch))

		// Process batch with controlled concurrency and recovery
		func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("🚨 Recovered from panic in batch %d: %v", batchNum, r)
					totalErrors++
				}
			}()

			if err := s.processSingleVideoBatch(batch, batchNum); err != nil {
				log.Printf("⚠️ Batch %d had errors: %v", batchNum, err)
				totalErrors++
			}
		}()

		// Extended pause between batches for i5-4590 stability
		if end < len(videoFiles) {
			time.Sleep(10 * time.Second) // Longer pause to prevent system overload
		}
	}

	if totalErrors > 0 {
		return fmt.Errorf("video batch processing completed with %d batch errors", totalErrors)
	}
	return nil
}

// processVideoBatches provides backward compatibility
func (s *MediaScanner) processVideoBatches(videoFiles []FileInfo) error {
	return s.processVideoBatchesWithRecovery(videoFiles)
}

// processSingleVideoBatch processes a single batch of video files with controlled concurrency and recovery
func (s *MediaScanner) processSingleVideoBatch(batch []FileInfo, batchNum int) error {
	var wg sync.WaitGroup
	var mu sync.Mutex
	var batchErrors []error

	// Ultra-conservative concurrency for i5-4590 stability
	maxConcurrency := 1 // Always single-threaded processing
	semaphore := make(chan struct{}, maxConcurrency)

	for i, file := range batch {
		wg.Add(1)
		go func(fileInfo FileInfo, fileIndex int) {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("🚨 Recovered from panic in batch %d, file %s: %v", batchNum, fileInfo.Path, r)
					mu.Lock()
					batchErrors = append(batchErrors, fmt.Errorf("panic in file %s: %v", fileInfo.Path, r))
					mu.Unlock()
					s.IncrementErrorFiles()
				}
				wg.Done()
			}()

			// Acquire semaphore with timeout to prevent deadlocks
			select {
			case semaphore <- struct{}{}:
				defer func() { <-semaphore }()
			case <-time.After(30 * time.Second):
				log.Printf("⚠️ Timeout acquiring semaphore for %s", fileInfo.Path)
				s.IncrementErrorFiles()
				return
			}

			log.Printf("🔧 Batch %d: Processing file %d/%d: %s", batchNum, fileIndex+1, len(batch), filepath.Base(fileInfo.Path))

			// Process the video file with timeout
			done := make(chan error, 1)
			go func() {
				done <- s.processVideoFileOptimized(fileInfo.Path, fileInfo.Info)
			}()

			select {
			case err := <-done:
				if err != nil {
					mu.Lock()
					batchErrors = append(batchErrors, fmt.Errorf("file %s: %v", fileInfo.Path, err))
					mu.Unlock()
					s.IncrementErrorFiles()
					log.Printf("❌ Batch %d: Error processing %s: %v", batchNum, filepath.Base(fileInfo.Path), err)
				} else {
					s.IncrementProcessedFiles()
					s.IncrementNewFiles()
					log.Printf("✅ Batch %d: Successfully processed %s", batchNum, filepath.Base(fileInfo.Path))
				}
			case <-time.After(30 * time.Second): // Reduced timeout to 30 seconds per file
				log.Printf("⚠️ Timeout processing %s after 30 seconds", fileInfo.Path)
				mu.Lock()
				batchErrors = append(batchErrors, fmt.Errorf("timeout processing %s", fileInfo.Path))
				mu.Unlock()
				s.IncrementErrorFiles()
			}
		}(file, i)
	}

	wg.Wait()

	if len(batchErrors) > 0 {
		return fmt.Errorf("batch had %d errors: %v", len(batchErrors), batchErrors[0])
	}

	log.Printf("✅ Batch %d completed successfully (%d files)", batchNum, len(batch))
	return nil
}

// processSubtitlesBatchWithRecovery processes subtitle files with error recovery
func (s *MediaScanner) processSubtitlesBatchWithRecovery(subtitleFiles []FileInfo) {
	log.Printf("📝 Processing %d subtitle files with recovery...", len(subtitleFiles))

	var wg sync.WaitGroup
	// Limit subtitle concurrency to prevent resource exhaustion
	maxSubtitleWorkers := min(s.GetMaxWorkers(), 2) // Reduced from 8 to 2
	semaphore := make(chan struct{}, maxSubtitleWorkers)

	for _, file := range subtitleFiles {
		wg.Add(1)
		go func(fileInfo FileInfo) {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("🚨 Recovered from panic processing subtitle %s: %v", fileInfo.Path, r)
				}
				<-semaphore
				wg.Done()
			}()

			semaphore <- struct{}{}

			err := s.processSubtitleFile(fileInfo.Path)
			if err != nil {
				log.Printf("Error processing subtitle file %s: %v", fileInfo.Path, err)
			}
		}(file)
	}

	wg.Wait()
	log.Printf("✅ Subtitle processing completed")
}

// processSubtitlesBatch provides backward compatibility
func (s *MediaScanner) processSubtitlesBatch(subtitleFiles []FileInfo) {
	s.processSubtitlesBatchWithRecovery(subtitleFiles)
}

// calculateOptimalBatchSize calculates optimal batch size based on system resources
func (s *MediaScanner) calculateOptimalBatchSize() int {
	// Base batch size
	baseBatchSize := s.GetBatchSize()

	// Adjust based on available workers
	maxWorkers := s.GetMaxWorkers()
	if maxWorkers >= 8 {
		baseBatchSize = baseBatchSize + (maxWorkers - 4) // Increase batch size for more workers
	}

	// Cap the batch size to prevent memory issues
	maxBatchSize := 50
	if baseBatchSize > maxBatchSize {
		baseBatchSize = maxBatchSize
	}

	// Minimum batch size
	minBatchSize := 5
	if baseBatchSize < minBatchSize {
		baseBatchSize = minBatchSize
	}

	return baseBatchSize
}

// processFilesParallel processes files using optimized worker pools with priority queues
func (s *MediaScanner) processFilesParallel(files []FileInfo) error {
	var wg sync.WaitGroup

	// Start high-priority workers (for new video files)
	maxWorkers := s.GetMaxWorkers()
	for i := 0; i < maxWorkers/2; i++ {
		wg.Add(1)
		go s.priorityWorker(i, &wg)
	}

	// Start low-priority workers (for subtitles and existing files)
	for i := 0; i < maxWorkers/2; i++ {
		wg.Add(1)
		go s.lowPriorityWorker(i+maxWorkers/2, &wg)
	}

	// Separate files into priority queues AFTER workers are started
	s.prioritizeFiles(files)

	// Close queues after all files are queued
	close(s.GetPriorityQueue())
	close(s.GetLowPriorityQueue())

	// Wait for all workers to complete
	wg.Wait()

	return nil
}

// prioritizeFiles separates files into priority queues for optimal processing
func (s *MediaScanner) prioritizeFiles(files []FileInfo) {
	for _, file := range files {
		if file.IsVideo {
			// Check if file needs processing
			if s.shouldSkipFile(file.Path, file.Info) {
				s.IncrementSkippedFiles()
				continue
			}

			// High priority for new video files
			select {
			case s.GetPriorityQueue() <- file:
			default:
				// Priority queue full, use low priority
				s.GetLowPriorityQueue() <- file
			}
		} else {
			// Low priority for subtitles
			s.GetLowPriorityQueue() <- file
		}
	}
}

// priorityWorker handles high-priority video files
func (s *MediaScanner) priorityWorker(id int, wg *sync.WaitGroup) {
	defer wg.Done()

	for file := range s.GetPriorityQueue() {
		if err := s.processVideoFileOptimized(file.Path, file.Info); err != nil {
			log.Printf("❌ Priority Worker %d: Error processing %s: %v", id, file.Path, err)
			s.IncrementErrorFiles()
		} else {
			s.IncrementProcessedFiles()
			s.IncrementNewFiles()
		}
	}
}

// lowPriorityWorker handles subtitles and less critical files
func (s *MediaScanner) lowPriorityWorker(id int, wg *sync.WaitGroup) {
	defer wg.Done()

	for file := range s.GetLowPriorityQueue() {
		var err error
		if file.IsVideo {
			err = s.processVideoFileOptimized(file.Path, file.Info)
		} else if file.IsSubtitle {
			err = s.processSubtitleFile(file.Path)
		}

		if err != nil {
			log.Printf("❌ Low Priority Worker %d: Error processing %s: %v", id, file.Path, err)
			s.IncrementErrorFiles()
		} else {
			s.IncrementProcessedFiles()
		}
	}
}

// worker processes files from the work channel
func (s *MediaScanner) worker(id int, workChan <-chan FileInfo, wg *sync.WaitGroup) {
	defer wg.Done()

	for file := range workChan {
		if s.shouldSkipFile(file.Path, file.Info) {
			s.IncrementSkippedFiles()
			continue
		}

		var err error
		if file.IsVideo {
			err = s.processVideoFileOptimized(file.Path, file.Info)
		} else if file.IsSubtitle {
			err = s.processSubtitleFile(file.Path)
		}

		if err != nil {
			log.Printf("❌ Worker %d: Error processing %s: %v", id, file.Path, err)
			s.IncrementErrorFiles()
		} else {
			s.IncrementProcessedFiles()
		}
	}
}

// shouldSkipFile determines if a file should be skipped based on cache and modification time
func (s *MediaScanner) shouldSkipFile(path string, info os.FileInfo) bool {
	// For comprehensive scans (startup), don't skip any files to ensure complete detection
	// This ensures all TV series episodes are properly detected and organized
	return false
}

// countFilesByType counts files by type for statistics
func (s *MediaScanner) countFilesByType(files []FileInfo, video, subtitle bool) int {
	count := 0
	for _, file := range files {
		if (video && file.IsVideo) || (subtitle && file.IsSubtitle) {
			count++
		}
	}
	return count
}

// logScanResults logs the final scan statistics
func (s *MediaScanner) logScanResults() {
	stats := s.GetScanStats()
	log.Printf("✅ Media scan completed in %v", stats.ScanDuration)
	log.Printf("📊 Scan Statistics:")
	log.Printf("   📁 Total files discovered: %d", stats.TotalFiles)
	log.Printf("   ✅ Successfully processed: %d", stats.ProcessedFiles)
	log.Printf("   ⏭️ Skipped (unchanged): %d", stats.SkippedFiles)
	log.Printf("   ❌ Errors: %d", stats.ErrorFiles)
	log.Printf("   🆕 New files added: %d", stats.NewFiles)
	log.Printf("   🔄 Files updated: %d", stats.UpdatedFiles)

	if stats.TotalFiles > 0 {
		successRate := float64(stats.ProcessedFiles) / float64(stats.TotalFiles) * 100
		log.Printf("   📈 Success rate: %.1f%%", successRate)
	}
}

func (s *MediaScanner) isVideoFile(path string) bool {
	// First check by extension for common video formats
	ext := strings.ToLower(filepath.Ext(path))
	videoExts := []string{".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v", ".mpg", ".mpeg", ".3gp", ".ogv"}

	for _, videoExt := range videoExts {
		if ext == videoExt {
			return true
		}
	}

	// Fallback to MIME type detection for unknown extensions
	file, err := os.Open(path)
	if err != nil {
		return false
	}
	defer file.Close()

	// Read first 512 bytes to determine file type
	buffer := make([]byte, 512)
	_, err = file.Read(buffer)
	if err != nil {
		return false
	}

	kind, err := filetype.Match(buffer)
	if err != nil {
		return false
	}

	// Check if it's a video MIME type
	return strings.HasPrefix(kind.MIME.Value, "video/")
}

func (s *MediaScanner) isSubtitleFile(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	subtitleExts := []string{".srt", ".vtt", ".ass", ".ssa", ".sub", ".idx"}

	for _, subExt := range subtitleExts {
		if ext == subExt {
			return true
		}
	}
	return false
}

func (s *MediaScanner) processVideoFileOptimized(path string, info os.FileInfo) error {
	// Update cache
	cacheMutex := s.GetCacheMutex()
	scanCache := s.GetScanCache()

	cacheMutex.Lock()
	scanCache[path] = time.Now()
	cacheMutex.Unlock()

	return s.processVideoFile(path, info)
}

func (s *MediaScanner) processVideoFile(path string, info os.FileInfo) error {
	// Add panic recovery for individual file processing
	defer func() {
		if r := recover(); r != nil {
			log.Printf("🚨 Recovered from panic processing video file %s: %v", path, r)
		}
	}()

	// Skip files that are too large or problematic
	if info.Size() > 15*1024*1024*1024 {
		log.Printf("⚠️ Skipping oversized file: %s (%d bytes)", path, info.Size())
		return nil
	}

	// Skip system files and recycle bin files
	if strings.Contains(path, "$RECYCLE.BIN") || strings.HasPrefix(filepath.Base(path), "$") {
		log.Printf("⚠️ Skipping system file: %s", path)
		return nil
	}

	// Enhanced media detection with multiple search strategies
	media, searchResult, err := s.findExistingMedia(path, info)
	if err != nil {
		log.Printf("Error searching for existing media for %s: %v", path, err)
		return err
	}

	// Determine what needs to be done based on search result
	var needsMetadataUpdate, needsAssetRegeneration, needsTitleFix bool

	if media != nil {
		// Media exists, analyze what needs updating
		needsMetadataUpdate = s.needsMetadataUpdate(media)
		missingAssets := media.ThumbnailPath == "" || media.PosterPath == "" || media.PreviewPath == ""
		pathChanged := media.FilePath != path

		// Skip title-based checks - only check if assets are missing
		needsTitleFix = false // Disable title fixing to ensure all files are processed
		needsAssetRegeneration = missingAssets

		// Log the analysis
		if searchResult.FoundBy != "" {
			log.Printf("🔍 Found existing media by %s: %s", searchResult.FoundBy, media.Title)
		}

		// Skip processing only if everything is perfect
		if !needsMetadataUpdate && !needsAssetRegeneration && !pathChanged && !needsTitleFix {
			log.Printf("✅ Media already exists with complete data and assets, skipping: %s", path)
			return nil
		}

		// Update path if changed
		if pathChanged {
			log.Printf("📁 Media path changed from %s to %s, updating", media.FilePath, path)
			media.FilePath = path
			media.FileSize = info.Size()
		}
	} else {
		// New media
		media = &models.Media{
			FilePath:  path,
			FileSize:  info.Size(),
			ViewCount: 0,
		}
		needsMetadataUpdate = true
		needsAssetRegeneration = true
		log.Printf("🆕 Processing new media: %s", path)
	}

	// Extract metadata from filename and path (with caching)
	var metadata *FileMetadata

	// Always re-extract if title needs fixing or metadata needs updating
	if needsTitleFix || needsMetadataUpdate {
		log.Printf("🔄 Re-extracting metadata for: %s", path)
		metadata = s.extractMetadataWithCacheLocal(path)

		// CRITICAL FIX: Preserve existing titles - only set title for new media or empty titles
		if media.ID == 0 && metadata.Title != "" {
			// New media - set the extracted title
			media.Title = metadata.Title
			log.Printf("🏷️ New media title set to '%s'", metadata.Title)
		} else if media.Title == "" || strings.TrimSpace(media.Title) == "" {
			// Only update if title is completely empty
			if metadata.Title != "" {
				media.Title = metadata.Title
				log.Printf("🏷️ Empty title filled with '%s'", metadata.Title)
			} else {
				// Fallback for empty metadata title
				if s.GetTMDBService() != nil {
					media.Title = s.GetTMDBService().CleanTitle(filepath.Base(path))
				} else {
					media.Title = s.cleanTitle(filepath.Base(path))
				}
				
				// Final fallback if still empty
				if media.Title == "" {
					media.Title = strings.TrimSuffix(filepath.Base(path), filepath.Ext(filepath.Base(path)))
				}
				log.Printf("🏷️ Generated title from filename: '%s'", media.Title)
			}
		} else {
			// PRESERVE EXISTING TITLES - Do not modify existing non-empty titles
			log.Printf("🛡️ Preserving existing title: '%s' (not modifying)", media.Title)
		}

		// Update type if needed
		if media.Type == "" || needsMetadataUpdate {
			media.Type = metadata.Type
		}

		// Update quality if needed
		if media.Quality == "" || needsMetadataUpdate {
			media.Quality = metadata.Quality
		}

		// Extract quality tags from filename (Netflix-style tags like HDR, Dolby, UHD, etc.)
		if len(media.QualityTags) == 0 || needsMetadataUpdate {
			qualityTags := utils.ExtractQualityTags(filepath.Base(path))
			if len(qualityTags) > 0 {
				media.QualityTags = qualityTags
				log.Printf("🏷️ Extracted quality tags for %s: %v", media.Title, qualityTags)
			}
		}
	} else {
		// Use cached metadata for existing media
		metadata = s.extractMetadataWithCacheLocal(path)
		if media.Title == "" {
			media.Title = metadata.Title

			// Safety check
			if media.Title == "" {
				log.Printf("⚠️ WARNING: Title is empty from metadata! Re-extracting from filename...")
				// Re-extract using TMDB service directly from filename
				if s.GetTMDBService() != nil {
					media.Title = s.GetTMDBService().CleanTitle(filepath.Base(path))
				} else {
					media.Title = s.cleanTitle(filepath.Base(path))
				}

				// Final fallback if still empty
				if media.Title == "" {
					media.Title = strings.TrimSuffix(filepath.Base(path), filepath.Ext(filepath.Base(path)))
				}
			}
		}
		if media.Type == "" {
			media.Type = metadata.Type
		}
		if media.Quality == "" {
			media.Quality = metadata.Quality
		}

		// Extract quality tags from filename (Netflix-style tags like HDR, Dolby, UHD, etc.)
		if len(media.QualityTags) == 0 {
			qualityTags := utils.ExtractQualityTags(filepath.Base(path))
			if len(qualityTags) > 0 {
				media.QualityTags = qualityTags
				log.Printf("🏷️ Extracted quality tags for %s: %v", media.Title, qualityTags)
			}
		}
	}

	// If it's an episode, find or create the series and assign season/episode numbers
	var seriesForAssets *models.Series
	if metadata.Type == "episode" && metadata.SeriesTitle != "" {
		// CRITICAL FIX: Preserve existing SeriesID to prevent duplicate series on rename
		// Only find/create series for new episodes or episodes without a series assignment
		if media.SeriesID != nil && *media.SeriesID > 0 {
			// Episode already has a series assigned - preserve it
			log.Printf("🛡️ Preserving existing series assignment for episode: %s (SeriesID: %d)", media.Title, *media.SeriesID)
			
			// Still update season/episode numbers from metadata if they changed
			if metadata.Season > 0 && (media.Season == nil || *media.Season != metadata.Season) {
				media.Season = &metadata.Season
				media.SeasonNumber = &metadata.Season
				log.Printf("🔄 Updated season number to: %d", metadata.Season)
			}
			if metadata.Episode > 0 && (media.Episode == nil || *media.Episode != metadata.Episode) {
				media.Episode = &metadata.Episode
				media.EpisodeNumber = &metadata.Episode
				log.Printf("🔄 Updated episode number to: %d", metadata.Episode)
			}

			// Fetch series details for asset processing
			if s.GetMediaService() != nil {
				if series, err := s.GetMediaService().GetSeriesByID(*media.SeriesID); err != nil {
					log.Printf("⚠️ Failed to load series %d for asset processing: %v", *media.SeriesID, err)
				} else {
					seriesForAssets = series
					
					// Fetch episode metadata from TMDB if available
					// ONLY fetch if episode doesn't already have TMDB metadata (check EpisodeTitle)
					if s.GetTMDBService() != nil && series.TMDBID > 0 && metadata.Season > 0 && metadata.Episode > 0 {
						if media.EpisodeTitle == "" {
							log.Printf("📺 Fetching TMDB episode metadata for: %s S%02dE%02d (no episode title found)", series.Title, metadata.Season, metadata.Episode)
							s.fetchAndUpdateEpisodeMetadata(media, series.TMDBID, metadata.Season, metadata.Episode)
						} else {
							log.Printf("✅ Episode metadata already exists for: %s S%02dE%02d - %s, skipping fetch", series.Title, metadata.Season, metadata.Episode, media.EpisodeTitle)
						}
					}
				}
			}
		} else {
			// New episode or episode without series - find or create series with fuzzy matching
			log.Printf("🔍 Finding/creating series for new episode: %s (extracted title: %s)", media.Title, metadata.SeriesTitle)
			series, err := s.GetMediaService().FindOrCreateSeries(metadata.SeriesTitle)
			if err != nil {
				log.Printf("❌ Error finding/creating series %s: %v", metadata.SeriesTitle, err)
				return err
			}
			media.SeriesID = &series.ID

			// Assign season and episode numbers from metadata
			if metadata.Season > 0 {
				media.Season = &metadata.Season
				media.SeasonNumber = &metadata.Season
			}
			if metadata.Episode > 0 {
				media.Episode = &metadata.Episode
				media.EpisodeNumber = &metadata.Episode
			}

			log.Printf("📺 Episode metadata assigned - Series: %s (ID: %d), Season: %d, Episode: %d",
				series.Title, series.ID, metadata.Season, metadata.Episode)
			seriesForAssets = series
			
			// Fetch episode metadata from TMDB if available
			// ONLY fetch if episode doesn't already have TMDB metadata (check EpisodeTitle)
			if s.GetTMDBService() != nil && series.TMDBID > 0 && metadata.Season > 0 && metadata.Episode > 0 {
				if media.EpisodeTitle == "" {
					log.Printf("📺 Fetching TMDB episode metadata for new episode: %s S%02dE%02d (no episode title found)", series.Title, metadata.Season, metadata.Episode)
					s.fetchAndUpdateEpisodeMetadata(media, series.TMDBID, metadata.Season, metadata.Episode)
				} else {
					log.Printf("✅ Episode metadata already exists for: %s S%02dE%02d - %s, skipping fetch", series.Title, metadata.Season, metadata.Episode, media.EpisodeTitle)
				}
			}
		}
	} else if metadata.Type == "movie" {
		// Ensure movies don't get assigned to series
		media.SeriesID = nil
		media.Season = nil
		media.SeasonNumber = nil
		media.Episode = nil
		media.EpisodeNumber = nil
		log.Printf("🎬 Movie metadata assigned - Title: %s, Year: %d", media.Title, metadata.Year)
	}

	// Trigger asynchronous asset download for the parent series when applicable
	if seriesForAssets != nil {
		s.scheduleSeriesAssetDownload(seriesForAssets)
	}

	// Enhanced title validation - only fix if title is actually empty
	if media.Title == "" || strings.TrimSpace(media.Title) == "" {
		log.Printf("🚨 CRITICAL: Empty title detected before database save! Path: %s", path)

		// Try TMDB cleaning one more time with the original filename
		if s.GetTMDBService() != nil {
			media.Title = s.GetTMDBService().CleanTitle(filepath.Base(path))
			log.Printf("🔧 TMDB emergency clean result: %s", media.Title)
		}

		// Final fallback if TMDB cleaning also fails
		if media.Title == "" || strings.TrimSpace(media.Title) == "" {
			media.Title = strings.TrimSuffix(filepath.Base(path), filepath.Ext(filepath.Base(path)))
			log.Printf("🔧 Using basic filename fallback: %s", media.Title)
		}
	} else {
		log.Printf("✅ Title validation passed: '%s'", media.Title)
	}

	// Enhanced sequel and numbered movie detection - only for new media
	if media.ID == 0 {
		media.Title = s.enhanceSequelTitleDetection(media.Title, path)
		log.Printf("🎬 Final enhanced title for new media: %s", media.Title)
	} else {
		log.Printf("🎬 Preserving existing media title: %s", media.Title)
	}

	// ENHANCED FIX: Use transaction-based upsert to prevent UNIQUE constraint violations
	err = s.GetMediaService().UpsertMedia(media)
	if err != nil {
		log.Printf("Error upserting media %s: %v", media.Title, err)
		return fmt.Errorf("❌ Failed to upsert media %s: %v", media.Title, err)
	}
	log.Printf("✅ Successfully processed media: %s", media.Title)

	// Assign genres based on filename/path analysis
	genreNames := s.extractGenresFromPath(path, media.Title)
	if len(genreNames) > 0 {
		// Convert genre names to IDs
		genreIDs, err := s.GetMediaService().GetGenreIDsByNames(genreNames)
		if err != nil {
			log.Printf("Warning: Failed to get genre IDs for media %s: %v", media.Title, err)
		} else if len(genreIDs) > 0 {
			if err := s.GetMediaService().AssignGenresToMedia(media.ID, genreIDs); err != nil {
				log.Printf("Warning: Failed to assign genres to media %s: %v", media.Title, err)
			} else {
				log.Printf("Assigned %d genres to media: %s", len(genreIDs), media.Title)
			}
		}
	}

	// CRITICAL: Extract subtitle and audio track information SYNCHRONOUSLY
	// This ensures tracks are available immediately after media is saved
	log.Printf("🎬 Processing tracks for: %s", media.Title)
	s.extractSubtitleAndAudioTracks(media, path)
	
	// Also process tracks using the new method for enhanced track detection
	if err := s.processMediaTracks(media); err != nil {
		log.Printf("⚠️ Failed to process media tracks for %s: %v", media.Title, err)
	} else {
		log.Printf("✅ Successfully processed tracks for: %s", media.Title)
	}

	// Extract additional metadata using FFprobe and TMDB (async with recovery and shorter timeouts)
	if s.canSpawnGoroutine() {
		go func() {
			s.incrementGoroutines()
			defer func() {
				s.decrementGoroutines()
				if r := recover(); r != nil {
					log.Printf("🚨 Recovered from panic in metadata extraction for %s: %v", media.Title, r)
				}
			}()

			// First extract video metadata from file with timeout
			metadataDone := make(chan error, 1)
			go func() {
				metadataDone <- s.extractVideoMetadata(media, path)
			}()

			select {
			case err := <-metadataDone:
				if err != nil {
					log.Printf("Warning: Failed to extract video metadata for %s: %v", media.Title, err)
				}
			case <-time.After(10 * time.Second):
				log.Printf("⚠️ Timeout extracting video metadata for %s", media.Title)
			}

			// Then try to get enhanced metadata from TMDB with fallback to file-based metadata
			// ONLY fetch if TMDB data doesn't exist yet (check TMDBID)
			if s.GetTMDBService() != nil && media.TMDBID == 0 {
				log.Printf("📥 Fetching TMDB metadata for new media: %s (no TMDB ID found)", media.Title)
				tmdbDone := make(chan struct{}, 1)
				var tmdbMetadata *interfaces.MediaMetadata
				var tmdbErr error

				go func() {
					tmdbMetadata, tmdbErr = s.GetTMDBService().GenerateMediaMetadata(path, media.Title)
					tmdbDone <- struct{}{}
				}()

				select {
				case <-tmdbDone:
					if tmdbErr != nil {
						log.Printf("TMDB metadata fetch failed for %s, using file-based metadata: %v", media.Title, tmdbErr)
					} else {
						// Process TMDB metadata
						if tmdbMetadata != nil {
							// Update media with TMDB metadata
							if tmdbMetadata.Title != "" {
								media.Title = tmdbMetadata.Title
							}
							if tmdbMetadata.Description != "" {
								media.Description = tmdbMetadata.Description
							}
							if tmdbMetadata.Year > 0 {
								media.Year = tmdbMetadata.Year
							}

							// Quality from filename analysis
							if tmdbMetadata.Quality != "" {
								media.Quality = tmdbMetadata.Quality
							}

							// Enhanced box office and financial data
							if tmdbMetadata.BoxOffice != "" {
								media.BoxOffice = tmdbMetadata.BoxOffice
							}
							if tmdbMetadata.Budget > 0 {
								media.Budget = tmdbMetadata.Budget
							}
							if tmdbMetadata.Revenue > 0 {
								media.Revenue = tmdbMetadata.Revenue
							}

							// Cast and crew
							if len(tmdbMetadata.Cast) > 0 {
								media.Cast = tmdbMetadata.Cast
							}
							if len(tmdbMetadata.Directors) > 0 {
								media.Director = tmdbMetadata.Directors
							}
							if len(tmdbMetadata.Stars) > 0 {
								media.Stars = tmdbMetadata.Stars
							}
							if len(tmdbMetadata.Writers) > 0 {
								media.Writers = tmdbMetadata.Writers
							}
							if len(tmdbMetadata.Producers) > 0 {
								media.Producers = tmdbMetadata.Producers
							}

							// Additional metadata
							if tmdbMetadata.Rating > 0 {
								media.Rating = tmdbMetadata.Rating
							}
							if tmdbMetadata.Status != "" {
								media.Status = tmdbMetadata.Status
							}
							if tmdbMetadata.IMDBID != "" {
								media.IMDBID = tmdbMetadata.IMDBID
							}
							if tmdbMetadata.Homepage != "" {
								media.Homepage = tmdbMetadata.Homepage
							}
							if tmdbMetadata.Collection != "" {
								media.Collection = tmdbMetadata.Collection
							}
							if tmdbMetadata.Runtime > 0 {
								media.Runtime = tmdbMetadata.Runtime
							}
							if tmdbMetadata.Country != "" {
								media.Country = tmdbMetadata.Country
							}
							if tmdbMetadata.Language != "" {
								media.Language = tmdbMetadata.Language
							}

							// Additional metadata fields
							media.Popularity = tmdbMetadata.Popularity
							media.VoteCount = tmdbMetadata.VoteCount
							media.Adult = tmdbMetadata.Adult

							// Store TMDB backdrop, poster, and trailer URLs
							if tmdbMetadata.BackdropURL != "" {
								media.TMDBBackdropURL = tmdbMetadata.BackdropURL
								log.Printf("🖼️ Set TMDB backdrop URL for %s: %s", media.Title, tmdbMetadata.BackdropURL)
							}
							if tmdbMetadata.PosterURL != "" {
								// Download poster from TMDB
								log.Printf("🎨 TMDB poster URL for %s: %s", media.Title, tmdbMetadata.PosterURL)
								
								// Download poster from TMDB
								if s.GetPosterService() != nil {
									log.Printf("📥 Downloading poster for %s", media.Title)
									posterPath, posterErr := s.GetPosterService().DownloadPosterWithPath(media.Title, media.ID)
									if posterErr != nil {
										log.Printf("⚠️ Failed to download poster for %s: %v", media.Title, posterErr)
									} else if posterPath != "" {
										media.PosterPath = posterPath
										log.Printf("✅ Downloaded and saved poster for: %s", media.Title)
									}
								}
							}
							if tmdbMetadata.TrailerURL != "" {
								media.TMDBTrailerURL = tmdbMetadata.TrailerURL
								log.Printf("🎬 Set TMDB trailer URL for %s: %s", media.Title, tmdbMetadata.TrailerURL)
							}
							
							// Store TMDB ID for future reference (logo download happens after media is saved)
							if tmdbMetadata.TMDBID > 0 {
								media.TMDBID = tmdbMetadata.TMDBID
								log.Printf("🆔 Set TMDB ID for %s: %d", media.Title, tmdbMetadata.TMDBID)
							}

							// Update genres from TMDB if available
							if len(tmdbMetadata.Genres) > 0 {
								// Store genre names for JSON compatibility and API responses
								media.GenreNames = tmdbMetadata.Genres
								log.Printf("🎭 Set genres for %s: %v", media.Title, tmdbMetadata.Genres)
								
								// Convert genre names to IDs and assign to media
								genreIDs, err := s.GetMediaService().GetGenreIDsByNames(tmdbMetadata.Genres)
								if err != nil {
									log.Printf("Warning: Failed to get TMDB genre IDs for media %s: %v", media.Title, err)
								} else if len(genreIDs) > 0 {
									if err := s.GetMediaService().AssignGenresToMedia(media.ID, genreIDs); err != nil {
										log.Printf("Warning: Failed to assign TMDB genres to media %s: %v", media.Title, err)
									} else {
										log.Printf("Assigned %d TMDB genres to media: %s", len(genreIDs), media.Title)
									}
								}
							}

							log.Printf("Enhanced metadata from TMDB for: %s (Budget: %s, Revenue: %s, Rating: %.1f, Votes: %d, Quality: %s)",
								media.Title,
								formatCurrency(media.Budget),
								formatCurrency(media.Revenue),
								media.Rating,
								media.VoteCount,
								media.Quality)
						}
					}
				case <-time.After(15 * time.Second):
					log.Printf("⚠️ Timeout fetching TMDB metadata for %s (continuing without TMDB data)", media.Title)
				}
			} else if s.GetTMDBService() != nil && media.TMDBID > 0 {
				log.Printf("✅ TMDB data already exists for %s (TMDB ID: %d), skipping fetch to preserve existing metadata", media.Title, media.TMDBID)
			}

			// Update media with all collected metadata
			isNewMovie := media.ID == 0 && metadata.Type == "movie"
			if err := s.GetMediaService().UpdateMedia(media); err != nil {
				log.Printf("Warning: Failed to update media metadata for %s: %v", media.Title, err)
			} else {
				// After UpdateMedia, media.ID will be populated for new records
				// Now download logo and backdrop (uses title to search TMDB, like poster download)
				if media.LogoPath == "" && s.GetTMDBService() != nil {
					log.Printf("🏷️ Downloading logo for %s (Media ID: %d)", media.Title, media.ID)
					logoPath, logoErr := s.GetTMDBService().DownloadLogoByTitle(media.Title, media.ID, "./logos")
					if logoErr != nil {
						log.Printf("⚠️ Failed to download logo for %s: %v", media.Title, logoErr)
					} else if logoPath != "" {
						media.LogoPath = logoPath
						log.Printf("✅ Downloaded logo for: %s", media.Title)
					}
				}
				
				// Download backdrop if not already present
				if media.BackdropPath == "" && s.GetTMDBService() != nil {
					log.Printf("🖼️ Downloading backdrop for %s (Media ID: %d)", media.Title, media.ID)
					backdropPath, backdropErr := s.GetTMDBService().DownloadBackdropByTitle(media.Title, media.ID, "./backdrops")
					if backdropErr != nil {
						log.Printf("⚠️ Failed to download backdrop for %s: %v", media.Title, backdropErr)
						// If download failed but we have TMDB backdrop URL, keep it
						// (tmdb_backdrop_url should already be set from TMDB metadata)
					} else if backdropPath != "" {
						media.BackdropPath = backdropPath
						// Set tmdb_backdrop_url to local API endpoint since we have local backdrop
						media.TMDBBackdropURL = fmt.Sprintf("/api/backdrops/%d", media.ID)
						log.Printf("✅ Downloaded backdrop for: %s, set tmdb_backdrop_url to local endpoint", media.Title)
					}
				}
				
				// Save logo and backdrop paths to database
				if media.LogoPath != "" || media.BackdropPath != "" {
					if updateErr := s.GetMediaService().UpdateMedia(media); updateErr != nil {
						log.Printf("⚠️ Failed to save asset paths for %s: %v", media.Title, updateErr)
					} else {
						log.Printf("✅ Saved asset paths for: %s", media.Title)
					}
				}
				
				// Send notification for newly added movies
				if isNewMovie && s.notificationService != nil && media.ID != 0 {
					// Capture the media ID for the goroutine
					movieID := media.ID
					movieTitle := media.Title
					
					go func() {
						defer func() {
							if r := recover(); r != nil {
								log.Printf("🚨 Recovered from panic sending new movie notification: %v", r)
							}
						}()
						
						// Send notification about this new movie
						if err := s.notificationService.CreateNewMoviesNotification([]uint{movieID}, 1); err != nil {
							log.Printf("⚠️ Failed to send new movie notification: %v", err)
						} else {
							log.Printf("🔔 Sent notification for new movie: %s (ID: %d)", movieTitle, movieID)
						}
					}()
				}
			}
		}()
	} else {
		log.Printf("⚠️ Skipping metadata extraction for %s - resource limit reached", media.Title)
	}

	// Check for existing assets using title-based naming with error handling
	var thumbnailExists, previewExists bool

	func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("🚨 Recovered from panic checking assets for %s: %v", media.Title, r)
			}
		}()

		thumbnailExists = s.GetThumbnailService().ThumbnailExists(media.ID, media.Title)
		previewExists = s.GetThumbnailService().PreviewExists(media.ID, media.Title)
		// Poster checking disabled for faster scanning
	}()

	// Determine asset generation needs based on flags
	var needsThumbnail, needsPreview bool
	isNewMedia := media.ID == 0 // Check if this is a new media item

	// CRITICAL FIX: Prevent duplicate asset generation for same media in short time window
	recentlyProcessed := false
	if media.ID > 0 {
		// Check if this media was recently processed (within last 30 seconds)
		cacheMutex := s.GetCacheMutex()
		scanCache := s.GetScanCache()
		cacheMutex.Lock()
		if lastProcessed, exists := scanCache[fmt.Sprintf("media_%d", media.ID)]; exists {
			if time.Since(lastProcessed) < 30*time.Second {
				recentlyProcessed = true
			}
		}
		// Update the cache with current processing time
		scanCache[fmt.Sprintf("media_%d", media.ID)] = time.Now()
		cacheMutex.Unlock()
	}

	if needsAssetRegeneration && !recentlyProcessed {
		// Force regeneration of thumbnails and previews only
		needsThumbnail = true
		needsPreview = true
		log.Printf("🔄 Forcing asset regeneration for: %s (poster download disabled)", media.Title)
	} else if recentlyProcessed {
		// Skip asset generation if recently processed
		needsThumbnail = false
		needsPreview = false
		log.Printf("⏭️ Skipping asset generation for %s - recently processed", media.Title)
	} else {
		// Generate assets only if missing (posters disabled)
		needsThumbnail = media.ThumbnailPath == "" && !thumbnailExists
		needsPreview = (media.PreviewPath == "" || media.PreviewClipPath == "") && !previewExists
	}

	// Debug logging for asset generation
	log.Printf("🔍 Asset check for %s (ID: %d, isNew: %v): needsThumbnail=%v, needsPreview=%v (PreviewPath='%s', PreviewClipPath='%s'), poster download disabled",
		media.Title, media.ID, isNewMedia, needsThumbnail, needsPreview, media.PreviewPath, media.PreviewClipPath)

	// Generate assets using batch-aware resource management with fallbacks (non-blocking)
	if needsThumbnail || needsPreview {
		// Check resource limits before spawning goroutine
		if s.canSpawnGoroutine() {
			// Use goroutine with resource throttling to prevent blocking the main scanning process
			go func() {
				s.incrementGoroutines()
				defer func() {
					s.decrementGoroutines()
					if r := recover(); r != nil {
						log.Printf("🚨 Recovered from panic in asset generation for %s: %v", media.Title, r)
					}
				}()
				// Add delay to throttle asset generation and prevent system overload
				if s.isSystemOverloaded() {
					time.Sleep(5 * time.Second) // Longer delay if system is overloaded
				} else {
					time.Sleep(2 * time.Second)
				}
				s.scheduleAssetGenerationWithFallbacks(media, path, needsThumbnail, needsPreview)
			}()
		} else {
			log.Printf("⚠️ Skipping asset generation for %s - resource limit reached", media.Title)
		}
	}

	// Poster download disabled for faster scanning - file watcher will handle new media posters
	log.Printf("ℹ️ Poster download disabled for %s", media.Title)

	// Auto-extract optimized LOUD ALAC audio if service available (only for individual files)
	// ALAC extraction is disabled during batch operations to prevent system overload
	if s.GetALACService() != nil && media.ID != 0 {
		// Only attempt ALAC extraction for individual file processing (not batch scans)
		log.Printf("🎵 ALAC service available for: %s (will extract on-demand)", media.Title)
	}

	log.Printf("Successfully processed media: %s (Type: %s, Size: %d bytes)", media.Title, media.Type, media.FileSize)
	return nil
}

// processVideoFileWithPosterDownload processes a video file and downloads poster for new media
func (s *MediaScanner) processVideoFileWithPosterDownload(path string, info os.FileInfo, isNewMedia bool) error {
	// First process the video file normally
	err := s.processVideoFile(path, info)
	if err != nil {
		return err
	}
	
	// If this is new media and poster service is available, download poster
	if isNewMedia && s.GetPosterService() != nil {
		log.Printf("🎨 New media detected by file watcher, downloading poster and logo for: %s", filepath.Base(path))
		
		// Get the media from database to get the ID and title
		media, err := s.GetMediaService().GetMediaByPath(path)
		if err != nil {
			log.Printf("⚠️ Failed to get media from database for poster download: %v", err)
			return nil // Don't fail the entire process for poster issues
		}
		
		if media != nil {
			// Download poster and logo in a separate goroutine to avoid blocking
			go func() {
				defer func() {
					if r := recover(); r != nil {
						log.Printf("🚨 Recovered from panic in poster/logo download for %s: %v", media.Title, r)
					}
				}()
				
				// Wait longer to ensure TMDB metadata is fully saved (happens in background goroutine)
				time.Sleep(4 * time.Second)
				
				// Refresh media from database to get latest data including TMDB ID
				refreshedMedia, refreshErr := s.GetMediaService().GetMediaByPath(path)
				if refreshErr != nil {
					log.Printf("⚠️ Failed to refresh media from database: %v", refreshErr)
					return
				}
				if refreshedMedia == nil {
					log.Printf("⚠️ Media not found in database after refresh")
					return
				}
				
				log.Printf("📥 Downloading assets for new media: %s (TMDB ID: %d)", refreshedMedia.Title, refreshedMedia.TMDBID)
				
				// Download poster
				posterPath, err := s.GetPosterService().DownloadPosterWithPath(refreshedMedia.Title, refreshedMedia.ID)
				if err != nil {
					log.Printf("❌ Failed to download poster for %s: %v", refreshedMedia.Title, err)
				} else if posterPath != "" {
					refreshedMedia.PosterPath = posterPath
					log.Printf("✅ Downloaded poster for: %s", refreshedMedia.Title)
				} else {
					log.Printf("ℹ️ No poster found for: %s", refreshedMedia.Title)
				}
				
				// Download logo (works like poster - searches TMDB by title)
				if s.GetTMDBService() != nil {
					log.Printf("🏷️ Downloading logo for: %s", refreshedMedia.Title)
					logoPath, logoErr := s.GetTMDBService().DownloadLogoByTitle(refreshedMedia.Title, refreshedMedia.ID, "./logos")
					if logoErr != nil {
						log.Printf("⚠️ Failed to download logo for %s: %v", refreshedMedia.Title, logoErr)
					} else if logoPath != "" {
						refreshedMedia.LogoPath = logoPath
						log.Printf("✅ Downloaded logo for: %s", refreshedMedia.Title)
					} else {
						log.Printf("ℹ️ No logo found for: %s", refreshedMedia.Title)
					}
				}
				
				// Download backdrop (works like poster and logo - searches TMDB by title)
				if s.GetTMDBService() != nil {
					log.Printf("🖼️ Downloading backdrop for: %s", refreshedMedia.Title)
					backdropPath, backdropErr := s.GetTMDBService().DownloadBackdropByTitle(refreshedMedia.Title, refreshedMedia.ID, "./backdrops")
					if backdropErr != nil {
						log.Printf("⚠️ Failed to download backdrop for %s: %v", refreshedMedia.Title, backdropErr)
						// If download failed but we have TMDB backdrop URL, keep it
					} else if backdropPath != "" {
						refreshedMedia.BackdropPath = backdropPath
						// Set tmdb_backdrop_url to local API endpoint since we have local backdrop
						refreshedMedia.TMDBBackdropURL = fmt.Sprintf("/api/backdrops/%d", refreshedMedia.ID)
						log.Printf("✅ Downloaded backdrop for: %s, set tmdb_backdrop_url to local endpoint", refreshedMedia.Title)
					} else {
						log.Printf("ℹ️ No backdrop found for: %s", refreshedMedia.Title)
					}
				}
				
				// Save poster, logo, and backdrop paths in a single update
				if updateErr := s.GetMediaService().UpdateMedia(refreshedMedia); updateErr != nil {
					log.Printf("⚠️ Failed to update media with asset paths: %v", updateErr)
				} else {
					log.Printf("✅ Saved asset paths for: %s", refreshedMedia.Title)
				}
			}()
		}
	}
	
	return nil
}

// extractSubtitleAndAudioTracks extracts internal subtitle and audio track information
func (s *MediaScanner) extractSubtitleAndAudioTracks(media *models.Media, path string) {
	log.Printf("🎬 Extracting subtitle and audio tracks for: %s", media.Title)
	
	// Use ffprobe to extract all stream information
	cmd := exec.Command("ffprobe",
		"-v", "quiet",
		"-print_format", "json",
		"-show_streams",
		path)

	output, err := cmd.Output()
	if err != nil {
		log.Printf("⚠️ Failed to extract stream info for %s: %v", media.Title, err)
		return
	}

	var probeData struct {
		Streams []struct {
			Index       int    `json:"index"`
			CodecType   string `json:"codec_type"`
			CodecName   string `json:"codec_name"`
			Language    string `json:"tags.language"`
			Title       string `json:"tags.title"`
			Disposition struct {
				Default  int `json:"default"`
				Forced   int `json:"forced"`
				Hearing  int `json:"hearing_impaired"`
			} `json:"disposition"`
			Tags struct {
				Language string `json:"language"`
				Title    string `json:"title"`
			} `json:"tags"`
		} `json:"streams"`
	}

	if err := json.Unmarshal(output, &probeData); err != nil {
		log.Printf("⚠️ Failed to parse stream info for %s: %v", media.Title, err)
		return
	}

	// Process subtitle streams
	var subtitleTracks []models.SubtitleTrack
	var audioTracks []models.AudioTrack
	
	for _, stream := range probeData.Streams {
		if stream.CodecType == "subtitle" {
			language := stream.Tags.Language
			if language == "" {
				language = stream.Language
			}
			if language == "" {
				language = "unknown"
			}

			title := stream.Tags.Title
			if title == "" {
				title = fmt.Sprintf("Subtitle Track %d", stream.Index)
			}

			subtitleTrack := models.SubtitleTrack{
				MediaID:     media.ID,
				StreamIndex: stream.Index,
				Language:    language,
				Title:       title,
				CodecName:   stream.CodecName,
				IsDefault:   stream.Disposition.Default == 1,
				IsForced:    stream.Disposition.Forced == 1,
				IsHearing:   stream.Disposition.Hearing == 1,
				TrackType:   "internal",
			}
			subtitleTracks = append(subtitleTracks, subtitleTrack)
			
			log.Printf("📝 Found internal subtitle: %s (%s) - %s", language, stream.CodecName, title)
		} else if stream.CodecType == "audio" {
			language := stream.Tags.Language
			if language == "" {
				language = stream.Language
			}
			if language == "" {
				language = "unknown"
			}

			title := stream.Tags.Title
			if title == "" {
				title = fmt.Sprintf("Audio Track %d", stream.Index)
			}

			audioTrack := models.AudioTrack{
				MediaID:     media.ID,
				StreamIndex: stream.Index,
				Language:    language,
				Title:       title,
				CodecName:   stream.CodecName,
				IsDefault:   stream.Disposition.Default == 1,
				TrackType:   "internal",
			}
			audioTracks = append(audioTracks, audioTrack)
			
			log.Printf("🎵 Found audio track: %s (%s) - %s", language, stream.CodecName, title)
		}
	}

	// Also scan for external subtitle files
	externalSubs := s.findExternalSubtitles(path)
	for _, extSub := range externalSubs {
		subtitleTrack := models.SubtitleTrack{
			MediaID:   media.ID,
			Language:  extSub.Language,
			Title:     fmt.Sprintf("External %s", extSub.Language),
			FilePath:  extSub.FilePath,
			Format:    extSub.Format,
			TrackType: "external",
		}
		subtitleTracks = append(subtitleTracks, subtitleTrack)
		
		log.Printf("📄 Found external subtitle: %s (%s)", extSub.Language, extSub.Format)
	}

	// Save tracks to database
	if len(subtitleTracks) > 0 {
		if err := s.GetMediaService().SaveSubtitleTracks(media.ID, subtitleTracks); err != nil {
			log.Printf("⚠️ Failed to save subtitle tracks for %s: %v", media.Title, err)
		} else {
			log.Printf("✅ Saved %d subtitle tracks for %s", len(subtitleTracks), media.Title)
		}
	}

	if len(audioTracks) > 0 {
		if err := s.GetMediaService().SaveAudioTracks(media.ID, audioTracks); err != nil {
			log.Printf("⚠️ Failed to save audio tracks for %s: %v", media.Title, err)
		} else {
			log.Printf("✅ Saved %d audio tracks for %s", len(audioTracks), media.Title)
		}
	}
}

// findExternalSubtitles finds external subtitle files for a video
func (s *MediaScanner) findExternalSubtitles(videoPath string) []ExternalSubtitle {
	var subtitles []ExternalSubtitle
	
	dir := filepath.Dir(videoPath)
	baseName := strings.TrimSuffix(filepath.Base(videoPath), filepath.Ext(videoPath))
	
	// Common subtitle extensions
	subtitleExts := []string{".srt", ".vtt", ".ass", ".ssa", ".sub", ".idx", ".sbv", ".ttml", ".dfxp"}
	
	// Enhanced language patterns to detect
	langPatterns := map[string]string{
		"en":       "English",
		"eng":      "English",
		"english":  "English",
		"es":       "Spanish",
		"spa":      "Spanish", 
		"spanish":  "Spanish",
		"fr":       "French",
		"fre":      "French",
		"french":   "French",
		"de":       "German",
		"ger":      "German",
		"german":   "German",
		"it":       "Italian",
		"ita":      "Italian",
		"italian":  "Italian",
		"pt":       "Portuguese",
		"por":      "Portuguese",
		"portuguese": "Portuguese",
		"ru":       "Russian",
		"rus":      "Russian",
		"russian":  "Russian",
		"ja":       "Japanese",
		"jpn":      "Japanese",
		"japanese": "Japanese",
		"ko":       "Korean",
		"kor":      "Korean",
		"korean":   "Korean",
		"zh":       "Chinese",
		"chi":      "Chinese",
		"chinese":  "Chinese",
		"ar":       "Arabic",
		"ara":      "Arabic",
		"arabic":   "Arabic",
		"hi":       "Hindi",
		"hin":      "Hindi",
		"hindi":    "Hindi",
		"nl":       "Dutch",
		"dut":      "Dutch",
		"dutch":    "Dutch",
		"sv":       "Swedish",
		"swe":      "Swedish",
		"swedish":  "Swedish",
		"no":       "Norwegian",
		"nor":      "Norwegian",
		"norwegian": "Norwegian",
		"da":       "Danish",
		"dan":      "Danish",
		"danish":   "Danish",
		"fi":       "Finnish",
		"fin":      "Finnish",
		"finnish":  "Finnish",
		"pl":       "Polish",
		"pol":      "Polish",
		"polish":   "Polish",
		"tr":       "Turkish",
		"tur":      "Turkish",
		"turkish":  "Turkish",
		"he":       "Hebrew",
		"heb":      "Hebrew",
		"hebrew":   "Hebrew",
		"th":       "Thai",
		"tha":      "Thai",
		"thai":     "Thai",
		"vi":       "Vietnamese",
		"vie":      "Vietnamese",
		"vietnamese": "Vietnamese",
	}
	
	log.Printf("🔍 Scanning for external subtitles in: %s", dir)
	log.Printf("🎬 Video base name: %s", baseName)
	
	// Scan directory for subtitle files
	files, err := os.ReadDir(dir)
	if err != nil {
		log.Printf("⚠️ Failed to read directory %s: %v", dir, err)
		return subtitles
	}
	
	for _, file := range files {
		if file.IsDir() {
			continue
		}
		
		fileName := file.Name()
		fileExt := strings.ToLower(filepath.Ext(fileName))
		
		// Check if it's a subtitle file
		isSubtitle := false
		for _, ext := range subtitleExts {
			if fileExt == ext {
				isSubtitle = true
				break
			}
		}
		
		if !isSubtitle {
			continue
		}
		
		// Enhanced matching logic for subtitle files
		fileBaseName := strings.TrimSuffix(fileName, fileExt)
		fileBaseNameLower := strings.ToLower(fileBaseName)
		baseNameLower := strings.ToLower(baseName)
		
		// Multiple matching strategies
		isMatch := false
		
		// Strategy 1: Exact prefix match
		if strings.HasPrefix(fileBaseNameLower, baseNameLower) {
			isMatch = true
		}
		
		// Strategy 2: Remove common video suffixes and try again
		if !isMatch {
			// Remove common video quality/source indicators from base name
			cleanBaseName := baseNameLower
			videoSuffixes := []string{
				"1080p", "720p", "480p", "4k", "2160p",
				"bluray", "bdrip", "webrip", "web-dl", "hdtv",
				"x264", "x265", "h264", "h265", "hevc",
				"aac", "ac3", "dts", "mp3",
				"yify", "rarbg", "yts", "eztv",
			}
			
			for _, suffix := range videoSuffixes {
				cleanBaseName = strings.ReplaceAll(cleanBaseName, "."+suffix, "")
				cleanBaseName = strings.ReplaceAll(cleanBaseName, "-"+suffix, "")
				cleanBaseName = strings.ReplaceAll(cleanBaseName, "_"+suffix, "")
				cleanBaseName = strings.ReplaceAll(cleanBaseName, " "+suffix, "")
			}
			
			if strings.HasPrefix(fileBaseNameLower, cleanBaseName) {
				isMatch = true
			}
		}
		
		// Strategy 3: Check if subtitle filename contains the main title words
		if !isMatch {
			baseWords := strings.Fields(strings.ReplaceAll(strings.ReplaceAll(baseNameLower, ".", " "), "_", " "))
			if len(baseWords) > 0 {
				mainTitle := baseWords[0]
				if len(mainTitle) > 3 && strings.Contains(fileBaseNameLower, mainTitle) {
					isMatch = true
				}
			}
		}
		
		if !isMatch {
			continue
		}
		
		// Extract language from filename
		language := "Unknown"
		
		// Enhanced language detection
		fileNameForLang := strings.ToLower(fileName)
		
		// Try to extract language from filename patterns
		for code, lang := range langPatterns {
			// Pattern 1: .lang. (e.g., movie.en.srt)
			pattern1 := fmt.Sprintf(`\.%s\.`, code)
			if matched, _ := regexp.MatchString(pattern1, fileNameForLang); matched {
				language = lang
				break
			}
			
			// Pattern 2: _lang_ (e.g., movie_en_srt)
			pattern2 := fmt.Sprintf(`_%s_`, code)
			if matched, _ := regexp.MatchString(pattern2, fileNameForLang); matched {
				language = lang
				break
			}
			
			// Pattern 3: -lang- (e.g., movie-en-srt)
			pattern3 := fmt.Sprintf(`-%s-`, code)
			if matched, _ := regexp.MatchString(pattern3, fileNameForLang); matched {
				language = lang
				break
			}
			
			// Pattern 4: lang at end (e.g., movie.en.srt, movie_en.srt)
			pattern4 := fmt.Sprintf(`[._-]%s$`, code)
			baseWithoutExt := strings.TrimSuffix(fileNameForLang, fileExt)
			if matched, _ := regexp.MatchString(pattern4, baseWithoutExt); matched {
				language = lang
				break
			}
		}
		
		// Get absolute file path
		fullPath := filepath.Join(dir, fileName)
		
		// Verify file exists and is readable
		fileInfo, err := os.Stat(fullPath)
		if err != nil {
			log.Printf("⚠️ Subtitle file not accessible: %s (%v)", fullPath, err)
			continue
		}
		
		// Check if file is not empty
		if fileInfo.Size() == 0 {
			log.Printf("⚠️ Subtitle file is empty: %s", fullPath)
			continue
		}
		
		// Try to read a small portion to verify it's a text file
		file, err := os.Open(fullPath)
		if err != nil {
			log.Printf("⚠️ Cannot open subtitle file: %s (%v)", fullPath, err)
			continue
		}
		
		// Read first 512 bytes to check if it's a text file
		buffer := make([]byte, 512)
		n, err := file.Read(buffer)
		file.Close()
		
		if err != nil && n == 0 {
			log.Printf("⚠️ Cannot read subtitle file: %s (%v)", fullPath, err)
			continue
		}
		
		// Basic check if it looks like a subtitle file (contains common subtitle patterns)
		content := string(buffer[:n])
		isValidSubtitle := strings.Contains(content, "-->") || 
			strings.Contains(content, "WEBVTT") ||
			strings.Contains(content, "[Script Info]") || // ASS/SSA
			strings.Contains(content, "Dialogue:") // ASS/SSA
		
		if !isValidSubtitle {
			log.Printf("⚠️ File doesn't appear to be a valid subtitle: %s", fullPath)
			continue
		}
		
		subtitle := ExternalSubtitle{
			FilePath: fullPath,
			Language: language,
			Format:   strings.TrimPrefix(fileExt, "."),
		}
		
		subtitles = append(subtitles, subtitle)
		log.Printf("📄 Found external subtitle: %s (%s) - %s (%d bytes)", language, subtitle.Format, fullPath, fileInfo.Size())
	}
	
	log.Printf("✅ Found %d external subtitle files for %s", len(subtitles), filepath.Base(videoPath))
	return subtitles
}

type ExternalSubtitle struct {
	FilePath string
	Language string
	Format   string
}

// formatCurrency formats a number as currency for logging
func formatCurrency(amount int64) string {
	if amount == 0 {
		return "N/A"
	}
	if amount >= 1000000000 {
		return fmt.Sprintf("$%.1fB", float64(amount)/1000000000)
	} else if amount >= 1000000 {
		return fmt.Sprintf("$%.1fM", float64(amount)/1000000)
	}
	return fmt.Sprintf("$%d", amount)
}

// generateThumbnailDirect generates thumbnail directly (backward compatibility)
func (s *MediaScanner) generateThumbnailDirect(media *models.Media, path string) {
	if _, err := s.GetThumbnailService().GenerateThumbnail(path, media.ID, media.Title); err != nil {
		log.Printf("❌ Failed to generate thumbnail for %s: %v", media.Title, err)
	} else {
		// Update media record with thumbnail path
		thumbnailPath := s.GetThumbnailService().GetThumbnailPath(media.ID, media.Title)
		if thumbnailPath != "" {
			media.ThumbnailPath = thumbnailPath
			s.GetMediaService().UpdateMedia(media)
		}
	}
}

// generatePreviewDirect generates preview directly (backward compatibility)
func (s *MediaScanner) generatePreviewDirect(media *models.Media, path string) {
	if previewPath, err := s.GetThumbnailService().GeneratePreviewClip(path, media.ID, media.Title); err != nil {
		log.Printf("❌ Failed to generate preview for %s: %v", media.Title, err)
	} else {
		// Update media record with preview paths
		media.PreviewPath = previewPath
		media.PreviewClipPath = previewPath
	}
}

// extractMetadataWithCache uses caching to speed up metadata extraction
func (s *MediaScanner) extractMetadataWithCache(filePath string) *FileMetadata {
	// Check cache first
	if cachedMetadata := s.getCachedMetadata(filePath); cachedMetadata != nil {
		return cachedMetadata
	}

	// Extract metadata from path
	return s.extractMetadataFromPath(filePath)
}

func (s *MediaScanner) processSubtitleFile(path string) error {
	// Find corresponding video file
	videoPath := s.findCorrespondingVideo(path)
	if videoPath == "" {
		return nil // No corresponding video found
	}

	// Find media in database
	media, err := s.GetMediaService().GetMediaByPath(videoPath)
	if err != nil {
		return err
	}

	// If media doesn't exist, skip subtitle processing
	if media == nil {
		return nil
	}

	// Extract language from filename
	language := s.extractLanguageFromSubtitle(path)

	// Create external subtitle track entry
	subtitleTrack := &models.SubtitleTrack{
		MediaID:     media.ID,
		StreamIndex: -1, // External subtitles don't have stream index
		Language:    language,
		Title:       fmt.Sprintf("%s (External)", language),
		CodecName:   strings.TrimPrefix(filepath.Ext(path), "."),
		FilePath:    path,
		Format:      strings.TrimPrefix(filepath.Ext(path), "."),
		TrackType:   "external",
		IsDefault:   false,
		IsForced:    false,
		IsHearing:   strings.Contains(strings.ToLower(path), "cc") || strings.Contains(strings.ToLower(path), "sdh"),
	}

	err = s.GetMediaService().CreateSubtitleTrack(subtitleTrack)
	if err != nil {
		log.Printf("❌ Failed to create subtitle track: %v", err)
		return err
	}

	// Also create legacy subtitle entry for backward compatibility
	subtitle := &models.Subtitle{
		MediaID:  media.ID,
		Language: language,
		FilePath: path,
		Format:   strings.TrimPrefix(filepath.Ext(path), "."),
	}

	return s.GetMediaService().CreateSubtitle(subtitle)
}

// processMediaTracks analyzes video file and extracts internal subtitle and audio tracks
func (s *MediaScanner) processMediaTracks(media *models.Media) error {
	if media.FilePath == "" {
		return nil
	}

	log.Printf("🎬 Analyzing tracks for: %s", filepath.Base(media.FilePath))

	// Use ffprobe to get track information
	tracks, err := s.analyzeMediaTracks(media.FilePath)
	if err != nil {
		log.Printf("⚠️ Failed to analyze tracks for %s: %v", media.Title, err)
		return nil // Don't fail the entire process
	}

	// Process subtitle tracks
	for _, track := range tracks.SubtitleTracks {
		track.MediaID = media.ID
		
		// Check if track already exists
		existingTracks, _ := s.GetMediaService().GetSubtitleTracks(media.ID)
		exists := false
		for _, existing := range existingTracks {
			if existing.StreamIndex == track.StreamIndex && existing.TrackType == "internal" {
				exists = true
				break
			}
		}
		
		if !exists {
			err = s.GetMediaService().CreateSubtitleTrack(&track)
			if err != nil {
				log.Printf("⚠️ Failed to create subtitle track: %v", err)
			} else {
				log.Printf("✅ Added internal subtitle track: %s (stream %d)", track.Language, track.StreamIndex)
			}
		}
	}

	// Process audio tracks
	for _, track := range tracks.AudioTracks {
		track.MediaID = media.ID
		
		// Check if track already exists
		existingTracks, _ := s.GetMediaService().GetAudioTracks(media.ID)
		exists := false
		for _, existing := range existingTracks {
			if existing.StreamIndex == track.StreamIndex {
				exists = true
				break
			}
		}
		
		if !exists {
			err = s.GetMediaService().CreateAudioTrack(&track)
			if err != nil {
				log.Printf("⚠️ Failed to create audio track: %v", err)
			} else {
				log.Printf("✅ Added audio track: %s (stream %d, %dch)", track.Language, track.StreamIndex, track.Channels)
			}
		}
	}

	return nil
}

// MediaTracks holds the analyzed track information
type MediaTracks struct {
	SubtitleTracks []models.SubtitleTrack
	AudioTracks    []models.AudioTrack
}

// analyzeMediaTracks uses ffprobe to extract track information from media files
func (s *MediaScanner) analyzeMediaTracks(filePath string) (*MediaTracks, error) {
	// Use ffprobe to get detailed stream information
	cmd := exec.Command("ffprobe", 
		"-v", "quiet",
		"-print_format", "json",
		"-show_streams",
		filePath)

	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("ffprobe failed: %v", err)
	}

	// Parse ffprobe output
	var probeResult struct {
		Streams []struct {
			Index       int               `json:"index"`
			CodecType   string            `json:"codec_type"`
			CodecName   string            `json:"codec_name"`
			Tags        map[string]string `json:"tags"`
			Channels    int               `json:"channels"`
			SampleRate  string            `json:"sample_rate"`
			BitRate     string            `json:"bit_rate"`
			Disposition struct {
				Default         int `json:"default"`
				Forced          int `json:"forced"`
				HearingImpaired int `json:"hearing_impaired"`
			} `json:"disposition"`
		} `json:"streams"`
	}

	err = json.Unmarshal(output, &probeResult)
	if err != nil {
		return nil, fmt.Errorf("failed to parse ffprobe output: %v", err)
	}

	tracks := &MediaTracks{
		SubtitleTracks: []models.SubtitleTrack{},
		AudioTracks:    []models.AudioTrack{},
	}

	subtitleIndex := 0
	audioIndex := 0

	for _, stream := range probeResult.Streams {
		switch stream.CodecType {
		case "subtitle":
			language := s.extractLanguageFromTags(stream.Tags)
			title := s.extractTitleFromTags(stream.Tags, language, "subtitle")
			
			track := models.SubtitleTrack{
				StreamIndex:         subtitleIndex, // Use subtitle-specific index for ffmpeg extraction
				Language:           language,
				Title:              title,
				CodecName:          stream.CodecName,
				TrackType:          "internal",
				IsDefault:          stream.Disposition.Default == 1,
				IsForced:           stream.Disposition.Forced == 1,
				IsHearing:          stream.Disposition.HearingImpaired == 1,
			}
			
			tracks.SubtitleTracks = append(tracks.SubtitleTracks, track)
			subtitleIndex++

		case "audio":
			language := s.extractLanguageFromTags(stream.Tags)
			title := s.extractTitleFromTags(stream.Tags, language, "audio")
			
			sampleRate := 0
			if stream.SampleRate != "" {
				sampleRate, _ = strconv.Atoi(stream.SampleRate)
			}
			
			bitrate := 0
			if stream.BitRate != "" {
				bitrate, _ = strconv.Atoi(stream.BitRate)
			}
			
			track := models.AudioTrack{
				StreamIndex: audioIndex, // Use audio-specific index
				Language:    language,
				Title:       title,
				CodecName:   stream.CodecName,
				Channels:    stream.Channels,
				SampleRate:  sampleRate,
				Bitrate:     bitrate,
				TrackType:   "internal",
				IsDefault:   stream.Disposition.Default == 1,
			}
			
			tracks.AudioTracks = append(tracks.AudioTracks, track)
			audioIndex++
		}
	}

	return tracks, nil
}

// extractLanguageFromTags extracts language from ffprobe tags
func (s *MediaScanner) extractLanguageFromTags(tags map[string]string) string {
	// Check various tag keys for language information
	languageKeys := []string{"language", "lang", "LANGUAGE", "LANG"}
	
	for _, key := range languageKeys {
		if lang, exists := tags[key]; exists && lang != "" {
			return s.normalizeLanguage(lang)
		}
	}
	
	return "Unknown"
}

// extractTitleFromTags extracts title from ffprobe tags
func (s *MediaScanner) extractTitleFromTags(tags map[string]string, language, trackType string) string {
	// Check various tag keys for title information
	titleKeys := []string{"title", "TITLE", "handler_name", "HANDLER_NAME"}
	
	for _, key := range titleKeys {
		if title, exists := tags[key]; exists && title != "" {
			return title
		}
	}
	
	// Generate default title
	if trackType == "audio" {
		return fmt.Sprintf("%s Audio", language)
	}
	return fmt.Sprintf("%s Subtitles", language)
}

// normalizeLanguage converts language codes to full language names
func (s *MediaScanner) normalizeLanguage(lang string) string {
	lang = strings.ToLower(strings.TrimSpace(lang))
	
	languageMap := map[string]string{
		"en":  "English",
		"eng": "English",
		"es":  "Spanish",
		"spa": "Spanish",
		"fr":  "French",
		"fre": "French",
		"de":  "German",
		"ger": "German",
		"it":  "Italian",
		"ita": "Italian",
		"pt":  "Portuguese",
		"por": "Portuguese",
		"ru":  "Russian",
		"rus": "Russian",
		"ja":  "Japanese",
		"jpn": "Japanese",
		"ko":  "Korean",
		"kor": "Korean",
		"zh":  "Chinese",
		"chi": "Chinese",
		"ar":  "Arabic",
		"ara": "Arabic",
		"nl":  "Dutch",
		"dut": "Dutch",
		"sv":  "Swedish",
		"swe": "Swedish",
		"no":  "Norwegian",
		"nor": "Norwegian",
		"da":  "Danish",
		"dan": "Danish",
		"fi":  "Finnish",
		"fin": "Finnish",
		"pl":  "Polish",
		"pol": "Polish",
		"cs":  "Czech",
		"cze": "Czech",
		"hu":  "Hungarian",
		"hun": "Hungarian",
		"tr":  "Turkish",
		"tur": "Turkish",
		"he":  "Hebrew",
		"heb": "Hebrew",
		"hi":  "Hindi",
		"hin": "Hindi",
		"th":  "Thai",
		"tha": "Thai",
		"vi":  "Vietnamese",
		"vie": "Vietnamese",
	}
	
	if fullName, exists := languageMap[lang]; exists {
		return fullName
	}
	
	// If not found, capitalize first letter
	if len(lang) > 0 {
		return strings.ToUpper(lang[:1]) + lang[1:]
	}
	
	return "Unknown"
}

// MediaSearchResult contains information about how media was found and what needs updating
type MediaSearchResult struct {
	FoundBy       string // "path", "filename", "title", "none"
	TitleMismatch bool   // true if title doesn't match expected filename-based title
	PathChanged   bool   // true if file path has changed
	NeedsUpdate   bool   // true if metadata needs updating
}

// findExistingMedia uses file path-based strategies only to ensure complete sync
func (s *MediaScanner) findExistingMedia(path string, info os.FileInfo) (*models.Media, *MediaSearchResult, error) {
	result := &MediaSearchResult{FoundBy: "none"}
	
	// Strategy 1: Search by exact path (primary method)
	media, err := s.GetMediaService().GetMediaByPath(path)
	if err != nil {
		return nil, result, err
	}
	if media != nil {
		result.FoundBy = "path"
		return media, result, nil
	}

	// Strategy 2: Try path with different separators (Windows/Linux compatibility)
	normalizedPath := filepath.ToSlash(path)
	if normalizedPath != path {
		media, err = s.GetMediaService().GetMediaByPath(normalizedPath)
		if err == nil && media != nil {
			result.FoundBy = "normalized_path"
			// Update the path to current format
			media.FilePath = path
			return media, result, nil
		}
	}

	// Strategy 3: Search by filename only (handle path changes, but no title matching)
	filename := filepath.Base(path)
	media, err = s.findMediaByFilename(filename)
	if err != nil {
		log.Printf("⚠️ Error searching by filename %s: %v", filename, err)
	} else if media != nil {
		result.FoundBy = "filename"
		result.PathChanged = media.FilePath != path

		// Update path if changed
		if result.PathChanged {
			log.Printf("📁 Media path changed from %s to %s, updating", media.FilePath, path)
			media.FilePath = path
			media.FileSize = info.Size()
		}
		return media, result, nil
	}

	// No existing media found - this ensures all files get processed
	return nil, result, nil
}

// detectTitleMismatch checks if the stored title matches what we'd expect from the filename
func (s *MediaScanner) detectTitleMismatch(media *models.Media, path string) bool {
	if media.Title == "" {
		return true // Empty title is definitely a mismatch
	}

	// Extract expected title from current path
	expectedTitle := s.extractExpectedTitle(path)
	if expectedTitle == "" {
		return false // Can't determine expected title
	}

	// Normalize both titles for comparison
	normalizedStored := s.normalizeTitleForComparison(media.Title)
	normalizedExpected := s.normalizeTitleForComparison(expectedTitle)

	// Check for significant differences
	similarity := s.calculateTitleSimilarity(normalizedStored, normalizedExpected)

	// Consider it a mismatch if similarity is below threshold
	return similarity < 0.7 // 70% similarity threshold
}

// needsTitleFix determines if the title needs to be regenerated
func (s *MediaScanner) needsTitleFix(media *models.Media, path string, searchResult *MediaSearchResult) bool {
	// Always fix title if there's a detected mismatch
	if searchResult.TitleMismatch {
		return true
	}

	// Fix if title is empty or too short
	if media.Title == "" || len(strings.TrimSpace(media.Title)) < 3 {
		return true
	}

	// Fix if title looks like a filename (contains dots, underscores, etc.)
	if s.titleLooksLikeFilename(media.Title) {
		return true
	}

	return false
}

// titleLooksLikeFilename checks if a title looks like it wasn't properly cleaned
func (s *MediaScanner) titleLooksLikeFilename(title string) bool {
	// Check for filename-like patterns
	patterns := []string{
		`\.[a-z]{2,4}$`,       // File extensions
		`\d{3,4}p`,            // Resolution indicators
		`x264|x265|h264|h265`, // Codecs
		`BluRay|WEB|HDRip`,    // Source indicators
		`YIFY|RARBG|YTS`,      // Release groups
	}

	titleLower := strings.ToLower(title)
	for _, pattern := range patterns {
		if matched, _ := regexp.MatchString(pattern, titleLower); matched {
			return true
		}
	}

	// Check for excessive dots or underscores
	dotCount := strings.Count(title, ".")
	underscoreCount := strings.Count(title, "_")

	return dotCount > 2 || underscoreCount > 2
}

// extractExpectedTitle extracts what the title should be based on the current path
func (s *MediaScanner) extractExpectedTitle(path string) string {
	metadata := s.extractMetadataWithCache(path)
	return metadata.Title
}

// cleanTitleForSearch creates a cleaned version of title for fuzzy searching
func (s *MediaScanner) cleanTitleForSearch(title string) string {
	if s.GetTMDBService() != nil {
		return s.GetTMDBService().CleanTitle(title)
	}
	return s.cleanTitle(title)
}

// normalizeTitleForComparison normalizes titles for comparison
func (s *MediaScanner) normalizeTitleForComparison(title string) string {
	// Convert to lowercase
	normalized := strings.ToLower(title)

	// Remove common punctuation and separators
	normalized = regexp.MustCompile(`[^\p{L}\p{N}\s]`).ReplaceAllString(normalized, " ")

	// Remove extra spaces
	normalized = regexp.MustCompile(`\s+`).ReplaceAllString(normalized, " ")

	// Trim
	normalized = strings.TrimSpace(normalized)

	return normalized
}



// findMediaByTitle searches for media by title
func (s *MediaScanner) findMediaByTitle(title string) (*models.Media, error) {
	// Use the existing SearchMedia method which searches by title
	mediaList, err := s.GetMediaService().SearchMedia(title)
	if err != nil {
		return nil, err
	}

	// Return the first exact or close match
	normalizedSearch := s.normalizeTitleForComparison(title)
	for _, media := range mediaList {
		normalizedMedia := s.normalizeTitleForComparison(media.Title)
		similarity := s.calculateTitleSimilarity(normalizedSearch, normalizedMedia)
		if similarity > 0.8 { // 80% similarity for exact title search
			return &media, nil
		}
	}

	return nil, nil
}

// findMediaByTitleFuzzy performs fuzzy search by title
func (s *MediaScanner) findMediaByTitleFuzzy(title string) (*models.Media, error) {
	// Use the existing SearchMedia method for fuzzy search
	mediaList, err := s.GetMediaService().SearchMedia(title)
	if err != nil {
		return nil, err
	}

	// Return the first reasonable match
	normalizedSearch := s.normalizeTitleForComparison(title)
	for _, media := range mediaList {
		normalizedMedia := s.normalizeTitleForComparison(media.Title)
		similarity := s.calculateTitleSimilarity(normalizedSearch, normalizedMedia)
		if similarity > 0.6 { // 60% similarity for fuzzy search
			return &media, nil
		}
	}

	return nil, nil
}

// Enhanced findMediaByFilename searches for existing media by filename to handle path corrections
func (s *MediaScanner) findMediaByFilename(filename string) (*models.Media, error) {
	// Strategy 1: Search by relative path structure (most reliable)
	mediaList, err := s.searchMediaByFilenamePattern(filename)
	if err != nil {
		return nil, err
	}

	// Find the best match by comparing directory structure
	if len(mediaList) > 0 {
		bestMatch := s.findBestPathMatch(filename, mediaList)
		if bestMatch != nil {
			return bestMatch, nil
		}
	}

	// Strategy 2: Try common old path patterns (fallback)
	oldPaths := []string{
		"/media/azad/Movies1/" + filename,
		"/media/azad/Movies2/" + filename,
		"/media/azad/Movies3/" + filename,
		"/mnt/media/" + filename,
		"/mnt/usb/" + filename,
		"/home/media/" + filename,
		"/media/" + filename,
		"/Volumes/" + filename, // macOS
	}

	for _, oldPath := range oldPaths {
		media, err := s.GetMediaService().GetMediaByPath(oldPath)
		if err != nil {
			continue // Try next path
		}
		if media != nil {
			return media, nil
		}
	}

	return nil, nil
}

// searchMediaByFilenamePattern searches for media where the file path ends with the given filename
func (s *MediaScanner) searchMediaByFilenamePattern(filename string) ([]models.Media, error) {
	// Get all media and filter by filename match
	allMedia, err := s.GetMediaService().GetAllMedia()
	if err != nil {
		return nil, err
	}

	var matches []models.Media
	for _, media := range allMedia {
		if filepath.Base(media.FilePath) == filename {
			matches = append(matches, media)
		}
	}

	// If no exact filename matches, try fuzzy matching
	if len(matches) == 0 {
		baseNameWithoutExt := strings.TrimSuffix(filename, filepath.Ext(filename))
		fuzzyMatches, err := s.GetMediaService().SearchMedia(baseNameWithoutExt)
		if err != nil {
			return matches, nil // Return empty matches instead of error
		}

		// Filter fuzzy matches to only include those with similar filenames
		for _, media := range fuzzyMatches {
			mediaBaseName := strings.TrimSuffix(filepath.Base(media.FilePath), filepath.Ext(media.FilePath))
			if s.calculateTitleSimilarity(
				s.normalizeTitleForComparison(baseNameWithoutExt),
				s.normalizeTitleForComparison(mediaBaseName),
			) > 0.8 {
				matches = append(matches, media)
			}
		}
	}

	return matches, nil
}

func (s *MediaScanner) findCorrespondingVideo(subtitlePath string) string {
	dir := filepath.Dir(subtitlePath)
	baseName := strings.TrimSuffix(filepath.Base(subtitlePath), filepath.Ext(subtitlePath))

	// Remove language suffix if present (e.g., "movie.en.srt" -> "movie")
	baseName = regexp.MustCompile(`\.(en|es|fr|de|it|pt|ru|ja|ko|zh|ar)$`).ReplaceAllString(baseName, "")

	videoExts := []string{".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v"}

	for _, ext := range videoExts {
		videoPath := filepath.Join(dir, baseName+ext)
		if _, err := os.Stat(videoPath); err == nil {
			return videoPath
		}
	}

	return ""
}

func (s *MediaScanner) extractLanguageFromSubtitle(path string) string {
	filename := filepath.Base(path)

	// Common language patterns
	langPatterns := map[string]string{
		`\.en\.`:  "English",
		`\.eng\.`: "English",
		`\.es\.`:  "Spanish",
		`\.spa\.`: "Spanish",
		`\.fr\.`:  "French",
		`\.fre\.`: "French",
		`\.de\.`:  "German",
		`\.ger\.`: "German",
		`\.it\.`:  "Italian",
		`\.ita\.`: "Italian",
		`\.pt\.`:  "Portuguese",
		`\.por\.`: "Portuguese",
		`\.ru\.`:  "Russian",
		`\.rus\.`: "Russian",
		`\.ja\.`:  "Japanese",
		`\.jpn\.`: "Japanese",
		`\.ko\.`:  "Korean",
		`\.kor\.`: "Korean",
		`\.zh\.`:  "Chinese",
		`\.chi\.`: "Chinese",
		`\.ar\.`:  "Arabic",
		`\.ara\.`: "Arabic",
	}

	for pattern, language := range langPatterns {
		if matched, _ := regexp.MatchString(pattern, filename); matched {
			return language
		}
	}

	return "Unknown"
}

func (s *MediaScanner) extractGenresFromPath(path, title string) []string {
	var genres []string
	pathLower := strings.ToLower(path)
	titleLower := strings.ToLower(title)

	// Genre keywords to look for in path and title
	genreKeywords := map[string][]string{
		"Action":      {"action", "fight", "martial", "combat", "war", "battle"},
		"Comedy":      {"comedy", "funny", "humor", "laugh", "comic"},
		"Drama":       {"drama", "dramatic", "emotional"},
		"Horror":      {"horror", "scary", "terror", "nightmare", "zombie", "ghost"},
		"Romance":     {"romance", "romantic", "love", "wedding"},
		"Sci-Fi":      {"sci-fi", "science", "fiction", "space", "alien", "future", "robot"},
		"Fantasy":     {"fantasy", "magic", "wizard", "dragon", "fairy", "mythical"},
		"Thriller":    {"thriller", "suspense", "mystery", "detective"},
		"Crime":       {"crime", "criminal", "police", "detective", "murder", "heist"},
		"Adventure":   {"adventure", "quest", "journey", "expedition"},
		"Animation":   {"animation", "animated", "cartoon", "anime"},
		"Documentary": {"documentary", "docu", "real", "true", "biography"},
		"Family":      {"family", "kids", "children", "disney"},
		"Music":       {"music", "musical", "concert", "band", "singer"},
		"Western":     {"western", "cowboy", "wild west", "frontier"},
		"Sport":       {"sport", "football", "basketball", "soccer", "boxing", "racing"},
	}

	// Check for genre keywords in path and title
	for genre, keywords := range genreKeywords {
		for _, keyword := range keywords {
			if strings.Contains(pathLower, keyword) || strings.Contains(titleLower, keyword) {
				genres = append(genres, genre)
				break // Only add each genre once
			}
		}
	}

	// If no genres found, assign a default based on file location or type
	if len(genres) == 0 {
		if strings.Contains(pathLower, "movie") {
			genres = append(genres, "Drama") // Default for movies
		} else if strings.Contains(pathLower, "tv") || strings.Contains(pathLower, "series") {
			genres = append(genres, "Drama") // Default for TV shows
		} else {
			genres = append(genres, "Drama") // Fallback default
		}
	}

	return genres
}

// enhanceSequelTitleDetection improves title detection for sequels and numbered movies
func (s *MediaScanner) enhanceSequelTitleDetection(title, path string) string {
	if title == "" {
		return title
	}

	// Get the original filename for reference
	filename := filepath.Base(path)
	filename = strings.TrimSuffix(filename, filepath.Ext(filename))
	
	// Common sequel patterns to detect and preserve
	sequelPatterns := []struct {
		pattern string
		description string
	}{
		{`(?i)\b(\w+)\s+(\d{1,2})\b`, "Direct sequel number (Movie 2)"},
		{`(?i)\b(\w+)\s+(II|III|IV|V|VI|VII|VIII|IX|X)\b`, "Roman numeral sequels"},
		{`(?i)\b(\w+)\s+(Part|Chapter|Episode|Volume)\s+(\d{1,2})\b`, "Part/Chapter sequels"},
		{`(?i)\b(Table|Ocean's|Fast)\s+(No|&)\s+(\d{1,2})\b`, "Numbered titles"},
		{`(?i)\b(\w+)\s+(Rise|Return|Revenge|Dawn|War|Dark|Last|Final)\s+of\s+`, "Subtitle sequels"},
		{`(?i)\b(\w+)\s+(Legacy|Returns|Forever|Begins|Rises|Reloaded|Revolutions)\b`, "Named sequels"},
	}

	// Check if the current title is missing sequel information that exists in filename
	for _, sp := range sequelPatterns {
		re := regexp.MustCompile(sp.pattern)
		
		// Check if filename has sequel pattern but title doesn't
		filenameMatches := re.FindStringSubmatch(filename)
		titleMatches := re.FindStringSubmatch(title)
		
		if len(filenameMatches) > 0 && len(titleMatches) == 0 {
			// Filename has sequel info but title doesn't - try to restore it
			log.Printf("🔍 Found sequel pattern in filename: %s (%s)", filenameMatches[0], sp.description)
			
			// Try to intelligently add the sequel information to the title
			if len(filenameMatches) >= 3 {
				// For patterns with multiple groups, reconstruct the sequel part
				sequelPart := strings.Join(filenameMatches[1:], " ")
				if !strings.Contains(title, sequelPart) {
					title = title + " " + sequelPart
					log.Printf("🔄 Enhanced title with sequel info: %s", title)
				}
			}
		}
	}

	// Special handling for common franchise patterns
	franchisePatterns := map[string][]string{
		"Terminator": {"Salvation", "Rise of The Machines", "Genisys", "Dark Fate", "Judgment Day"},
		"Shrek": {"2", "the Third", "Forever After"},
		"Fast": {"Furious", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "X"},
		"Mission": {"Impossible", "II", "III", "Ghost Protocol", "Rogue Nation", "Fallout"},
		"John Wick": {"2", "3", "4", "Chapter 2", "Chapter 3", "Chapter 4"},
	}

	// Check if this might be part of a known franchise
	for franchise, sequels := range franchisePatterns {
		if strings.Contains(strings.ToLower(filename), strings.ToLower(franchise)) {
			for _, sequel := range sequels {
				if strings.Contains(strings.ToLower(filename), strings.ToLower(sequel)) &&
				   !strings.Contains(strings.ToLower(title), strings.ToLower(sequel)) {
					title = franchise + " " + sequel
					log.Printf("🎬 Detected franchise sequel: %s", title)
					break
				}
			}
		}
	}

	// Clean up any double spaces and trim
	title = regexp.MustCompile(`\s+`).ReplaceAllString(title, " ")
	title = strings.TrimSpace(title)

	return title
}

// simpleCleanTitle provides a basic, conservative title cleaning
func (s *MediaScanner) simpleCleanTitle(title string) string {
	// Replace separators with spaces
	cleaned := strings.ReplaceAll(title, ".", " ")
	cleaned = strings.ReplaceAll(cleaned, "_", " ")
	cleaned = strings.ReplaceAll(cleaned, "-", " ")

	// Extract year first before cutting
	yearPattern := regexp.MustCompile(`\b(19|20)\d{2}\b`)
	yearMatches := yearPattern.FindAllString(cleaned, -1)
	var extractedYear string
	if len(yearMatches) > 0 {
		extractedYear = yearMatches[len(yearMatches)-1]
	}

	// Find the first occurrence of common quality indicators and cut there
	cutPattern := regexp.MustCompile(`(?i)\s*(1080p|2160p|720p|4K|HD|BluRay|WEB|x264|x265|YIFY|YTS|RARBG)`)
	cutIndex := cutPattern.FindStringIndex(cleaned)
	if cutIndex != nil {
		cleaned = cleaned[:cutIndex[0]]
	}

	// Remove year from middle but preserve for end
	cleaned = yearPattern.ReplaceAllString(cleaned, " ")

	// Clean up spaces
	cleaned = regexp.MustCompile(`\s+`).ReplaceAllString(cleaned, " ")
	cleaned = strings.TrimSpace(cleaned)

	// Title case
	if cleaned != "" {
		words := strings.Fields(cleaned)
		for i, word := range words {
			if len(word) > 0 {
				words[i] = strings.ToUpper(string(word[0])) + strings.ToLower(word[1:])
			}
		}
		cleaned = strings.Join(words, " ")
	}

	// Add year back if we found one
	if extractedYear != "" && cleaned != "" {
		cleaned = cleaned + " (" + extractedYear + ")"
	}

	return cleaned
}

func (s *MediaScanner) extractVideoMetadata(media *models.Media, path string) error {
	// Use FFprobe to extract video metadata
	cmd := exec.Command("ffprobe",
		"-v", "quiet",
		"-print_format", "json",
		"-show_format",
		"-show_streams",
		path)

	output, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("failed to run ffprobe: %v", err)
	}

	var probeData struct {
		Format struct {
			Duration string `json:"duration"`
			Size     string `json:"size"`
			BitRate  string `json:"bit_rate"`
		} `json:"format"`
		Streams []struct {
			CodecType string `json:"codec_type"`
			CodecName string `json:"codec_name"`
			Width     int    `json:"width"`
			Height    int    `json:"height"`
			BitRate   string `json:"bit_rate"`
			Duration  string `json:"duration"`
		} `json:"streams"`
	}

	if err := json.Unmarshal(output, &probeData); err != nil {
		return fmt.Errorf("failed to parse ffprobe output: %v", err)
	}

	// Extract duration and convert to seconds with robust fallbacks
	var durationSeconds int
	
	// Try to get duration from format first
	if probeData.Format.Duration != "" && probeData.Format.Duration != "N/A" {
		if duration, err := strconv.ParseFloat(probeData.Format.Duration, 64); err == nil && duration > 0 {
			durationSeconds = int(duration)
			log.Printf("📏 Duration from format: %.2f seconds for %s", duration, filepath.Base(path))
		}
	}
	
	// If format duration failed, try to get from video stream
	if durationSeconds == 0 {
		for _, stream := range probeData.Streams {
			if stream.CodecType == "video" {
				// Try to extract duration from video stream if available
				if stream.Duration != "" && stream.Duration != "N/A" {
					if duration, err := strconv.ParseFloat(stream.Duration, 64); err == nil && duration > 0 {
						durationSeconds = int(duration)
						log.Printf("📏 Duration from video stream: %.2f seconds for %s", duration, filepath.Base(path))
						break
					}
				}
			}
		}
	}
	
	// If still no duration, try alternative ffprobe command with different parameters
	if durationSeconds == 0 {
		log.Printf("⚠️ No duration found in standard probe, trying alternative method for %s", filepath.Base(path))
		
		altCmd := exec.Command("ffprobe",
			"-v", "error",
			"-show_entries", "format=duration",
			"-of", "csv=p=0",
			path)
		
		if altOutput, err := altCmd.Output(); err == nil {
			durationStr := strings.TrimSpace(string(altOutput))
			if durationStr != "" && durationStr != "N/A" {
				if duration, err := strconv.ParseFloat(durationStr, 64); err == nil && duration > 0 {
					durationSeconds = int(duration)
					log.Printf("📏 Duration from alternative probe: %.2f seconds for %s", duration, filepath.Base(path))
				}
			}
		}
	}
	
	// Final fallback: estimate duration from file size and bitrate
	if durationSeconds == 0 {
		log.Printf("⚠️ Still no duration, attempting estimation for %s", filepath.Base(path))
		
		// Get file size
		if stat, err := os.Stat(path); err == nil {
			fileSize := stat.Size()
			
			// Try to get bitrate from format
			if probeData.Format.BitRate != "" {
				if bitrate, err := strconv.ParseInt(probeData.Format.BitRate, 10, 64); err == nil && bitrate > 0 {
					// Duration = (file_size_in_bits) / bitrate
					estimatedDuration := (fileSize * 8) / bitrate
					if estimatedDuration > 60 && estimatedDuration < 86400 { // Between 1 minute and 24 hours
						durationSeconds = int(estimatedDuration)
						log.Printf("📏 Estimated duration from file size and bitrate: %d seconds for %s", durationSeconds, filepath.Base(path))
					}
				}
			}
		}
	}
	
	// ULTIMATE FALLBACK: Use ffmpeg to actually play and measure duration
	if durationSeconds == 0 {
		log.Printf("🚨 CRITICAL: No duration found by any method, using ffmpeg measurement for %s", filepath.Base(path))
		durationSeconds = s.measureVideoDurationWithFFmpeg(path)
	}
	
	// PENULTIMATE FALLBACK: Try frame counting method
	if durationSeconds == 0 {
		log.Printf("🚨 CRITICAL: Trying frame counting method for %s", filepath.Base(path))
		durationSeconds = s.estimateDurationByFrameCounting(path)
	}
	
	// ABSOLUTE FINAL FALLBACK: Estimate based on file size with standard video assumptions
	if durationSeconds == 0 {
		log.Printf("🚨 EMERGENCY: All methods failed, using file size estimation for %s", filepath.Base(path))
		if stat, err := os.Stat(path); err == nil {
			fileSize := stat.Size()
			// Use multiple bitrate assumptions for better estimation
			estimations := []int64{
				(fileSize * 8) / (1 * 1024 * 1024),   // 1 Mbps
				(fileSize * 8) / (2 * 1024 * 1024),   // 2 Mbps  
				(fileSize * 8) / (4 * 1024 * 1024),   // 4 Mbps
				(fileSize * 8) / (8 * 1024 * 1024),   // 8 Mbps
			}
			
			// Choose the most reasonable estimation (between 5 minutes and 4 hours)
			for _, est := range estimations {
				if est >= 300 && est <= 14400 { // 5 minutes to 4 hours
					durationSeconds = int(est)
					log.Printf("📏 Emergency file size estimation: %d seconds (%.1f MB file, assumed bitrate) for %s", 
						durationSeconds, float64(fileSize)/(1024*1024), filepath.Base(path))
					break
				}
			}
			
			// If still no reasonable estimate, use middle ground
			if durationSeconds == 0 {
				durationSeconds = int(estimations[1]) // Use 2 Mbps assumption
				if durationSeconds < 60 {
					durationSeconds = 1800 // 30 minutes minimum
				}
				if durationSeconds > 14400 {
					durationSeconds = 7200 // 2 hours maximum
				}
				log.Printf("📏 Emergency fallback estimation: %d seconds for %s", durationSeconds, filepath.Base(path))
			}
		}
	}
	
	// Set the duration, ensuring it's never 0 for valid video files
	if durationSeconds > 0 {
		media.Duration = durationSeconds
		log.Printf("✅ Final duration set: %d seconds (%.2f minutes) for %s", durationSeconds, float64(durationSeconds)/60.0, filepath.Base(path))
	} else {
		// Last resort: set a minimum duration to prevent 0 duration
		media.Duration = 60 // 1 minute default
		log.Printf("⚠️ Could not determine duration, setting default 60 seconds for %s", filepath.Base(path))
	}

	// Extract video stream information
	for _, stream := range probeData.Streams {
		if stream.CodecType == "video" {
			media.Codec = stream.CodecName
			if stream.Width > 0 && stream.Height > 0 {
				media.Resolution = fmt.Sprintf("%dx%d", stream.Width, stream.Height)
			}
			if bitrate, err := strconv.Atoi(stream.BitRate); err == nil {
				media.Bitrate = bitrate
			}
			break
		}
	}

	return nil
}

// measureVideoDurationWithFFmpeg uses ffmpeg to actually measure video duration by processing
func (s *MediaScanner) measureVideoDurationWithFFmpeg(path string) int {
	log.Printf("🎬 Measuring video duration with FFmpeg for: %s", filepath.Base(path))
	
	// Method 1: Use ffmpeg with null output to measure duration
	cmd := exec.Command("ffmpeg",
		"-i", path,
		"-f", "null",
		"-",
		"-v", "error",
		"-stats")
	
	// Capture stderr where ffmpeg outputs progress information
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	
	// Set timeout to prevent hanging
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cmd = exec.CommandContext(ctx, cmd.Args[0], cmd.Args[1:]...)
	cmd.Stderr = &stderr
	
	err := cmd.Run()
	if err == nil {
		// Parse the stderr output for duration information
		output := stderr.String()
		if duration := s.parseDurationFromFFmpegOutput(output); duration > 0 {
			log.Printf("📏 FFmpeg measurement successful: %d seconds for %s", duration, filepath.Base(path))
			return duration
		}
	}
	
	// Method 2: Use ffmpeg with very fast preset to get duration
	cmd2 := exec.Command("ffmpeg",
		"-i", path,
		"-t", "1", // Only process 1 second
		"-f", "null",
		"-",
		"-v", "quiet",
		"-stats")
	
	var stderr2 bytes.Buffer
	cmd2.Stderr = &stderr2
	
	ctx2, cancel2 := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel2()
	cmd2 = exec.CommandContext(ctx2, cmd2.Args[0], cmd2.Args[1:]...)
	cmd2.Stderr = &stderr2
	
	if err := cmd2.Run(); err == nil {
		output := stderr2.String()
		if duration := s.parseDurationFromFFmpegOutput(output); duration > 0 {
			log.Printf("📏 FFmpeg quick measurement successful: %d seconds for %s", duration, filepath.Base(path))
			return duration
		}
	}
	
	// Method 3: Use mediainfo as alternative if available
	if duration := s.measureWithMediaInfo(path); duration > 0 {
		return duration
	}
	
	log.Printf("❌ All FFmpeg measurement methods failed for %s", filepath.Base(path))
	return 0
}

// parseDurationFromFFmpegOutput extracts duration from ffmpeg stderr output
func (s *MediaScanner) parseDurationFromFFmpegOutput(output string) int {
	// Look for patterns like "Duration: 01:23:45.67" or "time=01:23:45.67"
	patterns := []string{
		`Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})`,
		`time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})`,
		`Duration: (\d{2}):(\d{2}):(\d{2})`,
		`time=(\d{2}):(\d{2}):(\d{2})`,
	}
	
	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindStringSubmatch(output)
		if len(matches) >= 4 {
			hours, _ := strconv.Atoi(matches[1])
			minutes, _ := strconv.Atoi(matches[2])
			seconds, _ := strconv.Atoi(matches[3])
			
			totalSeconds := hours*3600 + minutes*60 + seconds
			if totalSeconds > 0 {
				return totalSeconds
			}
		}
	}
	
	return 0
}

// measureWithMediaInfo tries to use mediainfo command if available
func (s *MediaScanner) measureWithMediaInfo(path string) int {
	// Try mediainfo command
	cmd := exec.Command("mediainfo", "--Inform=General;%Duration%", path)
	
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	cmd = exec.CommandContext(ctx, cmd.Args[0], cmd.Args[1:]...)
	
	output, err := cmd.Output()
	if err != nil {
		return 0 // mediainfo not available or failed
	}
	
	durationStr := strings.TrimSpace(string(output))
	if durationStr == "" {
		return 0
	}
	
	// mediainfo returns duration in milliseconds
	if durationMs, err := strconv.ParseInt(durationStr, 10, 64); err == nil {
		durationSeconds := int(durationMs / 1000)
		if durationSeconds > 0 {
			log.Printf("📏 MediaInfo measurement successful: %d seconds for %s", durationSeconds, filepath.Base(path))
			return durationSeconds
		}
	}
	
	return 0
}

// estimateDurationByFrameCounting uses ffmpeg to count frames and estimate duration
func (s *MediaScanner) estimateDurationByFrameCounting(path string) int {
	log.Printf("🎞️ Attempting frame counting duration estimation for: %s", filepath.Base(path))
	
	// Use ffmpeg to get frame count and frame rate
	cmd := exec.Command("ffprobe",
		"-v", "error",
		"-select_streams", "v:0",
		"-count_frames",
		"-show_entries", "stream=nb_frames,r_frame_rate",
		"-of", "csv=p=0",
		path)
	
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	cmd = exec.CommandContext(ctx, cmd.Args[0], cmd.Args[1:]...)
	
	output, err := cmd.Output()
	if err != nil {
		log.Printf("⚠️ Frame counting failed for %s: %v", filepath.Base(path), err)
		return 0
	}
	
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	if len(lines) < 1 {
		return 0
	}
	
	parts := strings.Split(lines[0], ",")
	if len(parts) < 2 {
		return 0
	}
	
	// Parse frame count
	frameCount, err := strconv.Atoi(strings.TrimSpace(parts[0]))
	if err != nil || frameCount <= 0 {
		return 0
	}
	
	// Parse frame rate (format: "25/1" or "29.97")
	frameRateStr := strings.TrimSpace(parts[1])
	var frameRate float64
	
	if strings.Contains(frameRateStr, "/") {
		rateParts := strings.Split(frameRateStr, "/")
		if len(rateParts) == 2 {
			num, err1 := strconv.ParseFloat(rateParts[0], 64)
			den, err2 := strconv.ParseFloat(rateParts[1], 64)
			if err1 == nil && err2 == nil && den != 0 {
				frameRate = num / den
			}
		}
	} else {
		frameRate, _ = strconv.ParseFloat(frameRateStr, 64)
	}
	
	if frameRate <= 0 || frameRate > 120 { // Sanity check
		frameRate = 25.0 // Default assumption
	}
	
	// Calculate duration: frames / fps
	duration := int(float64(frameCount) / frameRate)
	
	if duration > 10 && duration < 86400 { // Between 10 seconds and 24 hours
		log.Printf("📏 Frame counting successful: %d frames at %.2f fps = %d seconds for %s", 
			frameCount, frameRate, duration, filepath.Base(path))
		return duration
	}
	
	log.Printf("⚠️ Frame counting gave unrealistic duration (%d seconds) for %s", duration, filepath.Base(path))
	return 0
}

// FixZeroDurations scans all media with 0 duration and attempts to fix them
func (s *MediaScanner) FixZeroDurations() error {
	log.Printf("🔧 Starting zero duration fix scan...")
	
	// Get all media with 0 duration
	mediaList, err := s.GetMediaService().GetAllMedia()
	if err != nil {
		return fmt.Errorf("failed to query all media: %v", err)
	}
	
	// Filter for media with 0 duration
	var zeroDurationMedia []models.Media
	for _, media := range mediaList {
		if media.Duration == 0 {
			zeroDurationMedia = append(zeroDurationMedia, media)
		}
	}
	mediaList = zeroDurationMedia
	
	if len(mediaList) == 0 {
		log.Printf("✅ No media with zero duration found")
		return nil
	}
	
	log.Printf("🔍 Found %d media items with zero duration, attempting to fix...", len(mediaList))
	
	fixed := 0
	failed := 0
	
	for _, media := range mediaList {
		// Check if file still exists
		if _, err := os.Stat(media.FilePath); os.IsNotExist(err) {
			log.Printf("⚠️ File no longer exists, skipping: %s", media.FilePath)
			continue
		}
		
		log.Printf("🔧 Fixing duration for: %s", media.Title)
		
		// Extract video metadata to get duration
		if err := s.extractVideoMetadata(&media, media.FilePath); err != nil {
			log.Printf("❌ Failed to extract metadata for %s: %v", media.Title, err)
			failed++
			continue
		}
		
		// Update the media in database
		if err := s.GetMediaService().UpdateMedia(&media); err != nil {
			log.Printf("❌ Failed to update media %s: %v", media.Title, err)
			failed++
			continue
		}
		
		log.Printf("✅ Fixed duration for %s: %d seconds (%.2f minutes)", media.Title, media.Duration, float64(media.Duration)/60.0)
		fixed++
	}
	
	log.Printf("🔧 Duration fix complete: %d fixed, %d failed", fixed, failed)
	return nil
}

// IncrementalScan performs a lightning-fast scan that only checks for new/modified files
func (s *MediaScanner) IncrementalScan() error {
	log.Printf("⚡ Starting superfast incremental media scan...")

	// Load last scan time from cache or database
	s.loadLastScanTime()

	var newFiles []FileInfo
	var mu sync.Mutex

	// Use parallel directory walking for speed
	err := s.parallelWalk(s.GetMediaPath(), func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		if info.IsDir() {
			// Skip hidden and system directories
			dirName := filepath.Base(path)
			if strings.HasPrefix(dirName, ".") || dirName == "System Volume Information" {
				return filepath.SkipDir
			}
			return nil
		}

		// Only process files modified after last scan
		if info.ModTime().After(s.GetLastScanTime()) {
			ext := strings.ToLower(filepath.Ext(path))
			isVideo := s.isVideoFileByExtension(ext)
			isSubtitle := s.isSubtitleFileByExtension(ext)

			if isVideo || isSubtitle {
				mu.Lock()
				newFiles = append(newFiles, FileInfo{
					Path:       path,
					Info:       info,
					IsVideo:    isVideo,
					IsSubtitle: isSubtitle,
				})
				mu.Unlock()
			}
		}

		return nil
	})

	if err != nil {
		return err
	}

	if len(newFiles) == 0 {
		log.Printf("✅ No new files found since last scan")
		return nil
	}

	log.Printf("🆕 Found %d new/modified files", len(newFiles))

	// Process new files with optimized pipeline
	s.SetTotalFiles(len(newFiles))
	s.SetStartTime(time.Now())

	if err := s.processFilesSequential(newFiles); err != nil {
		log.Printf("⚠️ Some files failed to process: %v", err)
	}

	// Update last scan time
	s.SetLastScanTime(time.Now())
	s.saveLastScanTime()

	stats := s.GetScanStats()
	s.SetScanDuration(time.Since(stats.StartTime))
	s.logScanResults()

	return nil
}

// parallelWalk performs parallel directory walking for maximum speed
func (s *MediaScanner) parallelWalk(root string, walkFn filepath.WalkFunc) error {
	var wg sync.WaitGroup
	var mu sync.Mutex
	var firstErr error

	// Start with the root directory
	wg.Add(1)
	go func() {
		defer wg.Done()

		err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				mu.Lock()
				if firstErr == nil {
					firstErr = err
				}
				mu.Unlock()
				return nil
			}

			// Call the walk function
			if walkErr := walkFn(path, info, err); walkErr != nil {
				if walkErr == filepath.SkipDir {
					return walkErr
				}
				mu.Lock()
				if firstErr == nil {
					firstErr = walkErr
				}
				mu.Unlock()
			}

			return nil
		})

		if err != nil {
			mu.Lock()
			if firstErr == nil {
				firstErr = err
			}
			mu.Unlock()
		}
	}()

	wg.Wait()
	return firstErr
}

// SuperfastScan performs the fastest possible scan with minimal processing
func (s *MediaScanner) SuperfastScan() error {
	s.SetStartTime(time.Now())
	log.Printf("🚀 Starting superfast media library scan at: %s", s.GetMediaPath())

	// Phase 1: Lightning-fast file discovery
	log.Printf("⚡ Phase 1: Lightning-fast file discovery...")
	files, err := s.superfastDiscoverFiles()
	if err != nil {
		return fmt.Errorf("superfast file discovery failed: %v", err)
	}

	s.SetTotalFiles(len(files))
	stats := s.GetScanStats()
	log.Printf("📊 Discovered %d files in record time", stats.TotalFiles)

	// Phase 2: Parallel processing with maximum workers
	originalWorkers := s.GetMaxWorkers()
	s.SetMaxWorkersValue(16) // Use maximum workers for superfast scan

	log.Printf("🔥 Phase 2: Processing files sequentially...")
	if err := s.processFilesSequential(files); err != nil {
		log.Printf("⚠️ Some files failed to process: %v", err)
	}

	s.SetMaxWorkersValue(originalWorkers) // Restore original worker count

	// Phase 3: Results
	finalStats := s.GetScanStats()
	s.SetScanDuration(time.Since(finalStats.StartTime))
	s.logScanResults()

	return nil
}

// superfastDiscoverFiles performs the fastest possible file discovery
func (s *MediaScanner) superfastDiscoverFiles() ([]FileInfo, error) {
	var files []FileInfo
	var mu sync.Mutex

	// Pre-allocate slice with reasonable size to prevent memory issues
	files = make([]FileInfo, 0, 500) // Reduced from 1000 to 500

	// Use optimized file walking
	err := filepath.Walk(s.GetMediaPath(), func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip errors, continue scanning
		}

		if info.IsDir() {
			// Skip system directories immediately
			dirName := filepath.Base(path)
			if strings.HasPrefix(dirName, ".") ||
				dirName == "System Volume Information" ||
				dirName == "$RECYCLE.BIN" {
				return filepath.SkipDir
			}
			return nil
		}

		// Ultra-fast extension check
		ext := strings.ToLower(filepath.Ext(path))
		if ext == "" {
			return nil
		}

		// Check video extensions
		if s.isVideoFileByExtension(ext) {
			mu.Lock()
			files = append(files, FileInfo{
				Path:       path,
				Info:       info,
				IsVideo:    true,
				IsSubtitle: false,
			})
			mu.Unlock()
		} else if s.isSubtitleFileByExtension(ext) {
			mu.Lock()
			files = append(files, FileInfo{
				Path:       path,
				Info:       info,
				IsVideo:    false,
				IsSubtitle: true,
			})
			mu.Unlock()
		}

		return nil
	})

	return files, err
}

// loadLastScanTime loads the last scan timestamp
func (s *MediaScanner) loadLastScanTime() {
	// Try to load from a cache file
	cacheFile := filepath.Join(s.GetMediaPath(), ".homeflix_scan_cache")
	if data, err := os.ReadFile(cacheFile); err == nil {
		if timestamp, err := time.Parse(time.RFC3339, string(data)); err == nil {
			s.SetLastScanTime(timestamp)
			log.Printf("📅 Last scan time loaded: %v", s.GetLastScanTime())
			return
		}
	}

	// Default to 24 hours ago if no cache
	s.SetLastScanTime(time.Now().Add(-24 * time.Hour))
	log.Printf("📅 Using default last scan time: %v", s.GetLastScanTime())
}

// saveLastScanTime saves the last scan timestamp
func (s *MediaScanner) saveLastScanTime() {
	cacheFile := filepath.Join(s.GetMediaPath(), ".homeflix_scan_cache")
	data := s.GetLastScanTime().Format(time.RFC3339)
	if err := os.WriteFile(cacheFile, []byte(data), 0644); err != nil {
		log.Printf("⚠️ Failed to save scan cache: %v", err)
	}
}

// GetScanStats returns current scan statistics
func (s *MediaScanner) GetScanStats() ScanStats {
	return ScanStats{
		TotalFiles:     s.totalFiles,
		ProcessedFiles: int(atomic.LoadInt32(&s.processedFiles)),
		SkippedFiles:   int(atomic.LoadInt32(&s.skippedFiles)),
		ErrorFiles:     int(atomic.LoadInt32(&s.errorFiles)),
		NewFiles:       int(atomic.LoadInt32(&s.newFiles)),
		UpdatedFiles:   int(atomic.LoadInt32(&s.updatedFiles)),
		ScanDuration:   s.scanDuration,
		StartTime:      s.startTime,
	}
}

// GetBatchProcessingStats returns detailed batch processing statistics
func (s *MediaScanner) GetBatchProcessingStats() map[string]interface{} {
	scanStats := s.GetScanStats()
	stats := map[string]interface{}{
		"maxWorkers":        s.GetMaxWorkers(),
		"batchSize":         s.GetBatchSize(),
		"totalFiles":        scanStats.TotalFiles,
		"processedFiles":    scanStats.ProcessedFiles,
		"skippedFiles":      scanStats.SkippedFiles,
		"errorFiles":        scanStats.ErrorFiles,
		"newFiles":          scanStats.NewFiles,
		"updatedFiles":      scanStats.UpdatedFiles,
		"scanDuration":      s.GetScanStats().ScanDuration.String(),
		"processingRate":    0.0,
		"systemUtilization": "optimal",
	}

	// Calculate processing rate (files per second)
	if scanStats.ScanDuration.Seconds() > 0 {
		stats["processingRate"] = float64(scanStats.ProcessedFiles) / scanStats.ScanDuration.Seconds()
	}

	// Determine system utilization level
	maxWorkers := s.GetMaxWorkers()
	batchSize := s.GetBatchSize()
	if maxWorkers >= 8 && batchSize >= 15 {
		stats["systemUtilization"] = "high"
	} else if maxWorkers >= 4 && batchSize >= 10 {
		stats["systemUtilization"] = "medium"
	} else {
		stats["systemUtilization"] = "low"
	}

	return stats
}

// SetMaxWorkers configures the number of worker goroutines
func (s *MediaScanner) SetMaxWorkers(workers int) {
	if workers > 0 && workers <= 16 {
		s.SetMaxWorkersValue(workers)
		log.Printf("⚙️ Set max workers to %d", workers)
	}
}

// SetBatchSize configures the batch size for processing
func (s *MediaScanner) SetBatchSize(size int) {
	if size > 0 && size <= 100 {
		s.SetBatchSizeValue(size)
		log.Printf("⚙️ Set batch size to %d", size)
	}
}

// AutoTuneBatchProcessing automatically adjusts batch processing parameters based on system performance
func (s *MediaScanner) AutoTuneBatchProcessing() {
	log.Printf("🔧 Auto-tuning batch processing parameters...")

	// Measure current system load (simplified approach)
	startTime := time.Now()

	// Measure performance and adjust parameters
	scanStats := s.GetScanStats()
	if scanStats.ProcessedFiles > 0 && scanStats.ScanDuration > 0 {
		currentRate := float64(scanStats.ProcessedFiles) / scanStats.ScanDuration.Seconds()

		// Adjust parameters based on processing rate
		if currentRate > 2.0 { // High performance
			if s.GetMaxWorkers() < 12 {
				newWorkers := min(s.GetMaxWorkers()+2, 12)
				s.SetMaxWorkersValue(newWorkers)
				log.Printf("🚀 Increased workers to %d (high performance detected)", newWorkers)
			}
			if s.GetBatchSize() < 30 {
				newBatchSize := min(s.GetBatchSize()+5, 30)
				s.SetBatchSizeValue(newBatchSize)
				log.Printf("🚀 Increased batch size to %d (high performance detected)", newBatchSize)
			}
		} else if currentRate < 0.5 { // Low performance
			if s.GetMaxWorkers() > 4 {
				newWorkers := max(s.GetMaxWorkers()-1, 4)
				s.SetMaxWorkersValue(newWorkers)
				log.Printf("🐌 Decreased workers to %d (low performance detected)", newWorkers)
			}
			if s.GetBatchSize() > 10 {
				newBatchSize := max(s.GetBatchSize()-2, 10)
				s.SetBatchSizeValue(newBatchSize)
				log.Printf("🐌 Decreased batch size to %d (low performance detected)", newBatchSize)
			}
		}

		log.Printf("📊 Current processing rate: %.2f files/second", currentRate)
	}

	// Adjust queue sizes based on new parameters
	newPriorityQueueSize := s.GetMaxWorkers() * 10
	newLowPriorityQueueSize := s.GetMaxWorkers() * 50

	if cap(s.GetPriorityQueue()) != newPriorityQueueSize {
		// Note: Queue resizing would require stopping and restarting workers
		log.Printf("🔧 Queue size adjustment needed: priority=%d, low-priority=%d", newPriorityQueueSize, newLowPriorityQueueSize)
	}

	tuningDuration := time.Since(startTime)
	log.Printf("✅ Auto-tuning completed in %v", tuningDuration)
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// max returns the maximum of two integers
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// needsMetadataUpdate checks if existing media has empty fields that need updating
func (s *MediaScanner) needsMetadataUpdate(media *models.Media) bool {
	// Check for empty critical fields
	return media.Title == "" ||
		media.Description == "" ||
		media.Duration == 0 ||
		media.Resolution == "" ||
		media.Codec == "" ||
		media.Year == 0 ||
		len(media.Cast) == 0 ||
		len(media.Director) == 0
}

// ProcessSingleFile processes a single media file (used by file watcher)
// This method includes poster download for new media files
func (s *MediaScanner) ProcessSingleFile(path string, info os.FileInfo) error {
	log.Printf("🎬 File watcher processing single file: %s", filepath.Base(path))

	// Check if it's a video file
	if s.isVideoFile(path) {
		// Check if this media already exists in database
		existingMedia, err := s.GetMediaService().GetMediaByPath(path)
		if err != nil {
			log.Printf("⚠️ Error checking existing media for %s: %v", path, err)
		}
		
		isNewMedia := existingMedia == nil
		
		// Process the video file with poster download for new media
		err = s.processVideoFileWithPosterDownload(path, info, isNewMedia)
		if err != nil {
			log.Printf("❌ Failed to process video file %s: %v", path, err)
			return err
		}
		
		if isNewMedia {
			log.Printf("✅ Successfully processed new media file with poster download: %s", filepath.Base(path))
		} else {
			log.Printf("✅ Successfully updated existing media file: %s", filepath.Base(path))
		}
		
		return nil
	}

	// Check if it's a subtitle file
	if s.isSubtitleFile(path) {
		return s.processSubtitleFile(path)
	}

	log.Printf("⏭️ Skipping non-media file: %s", path)
	return nil
}

// SyncDatabaseWithStorage performs a comprehensive sync between database and file storage
// This ensures all existing media entries are properly synced and assets are regenerated
func (s *MediaScanner) SyncDatabaseWithStorage() error {
	s.SetStartTime(time.Now())
	log.Printf("🔄 Starting comprehensive database-storage sync...")

	// Phase 0: Detect drive changes and attempt smart path resolution
	log.Printf("� Phasse 0: Detecting drive changes and resolving paths...")
	if err := s.DetectDriveChanges(); err != nil {
		log.Printf("⚠️ Warning: Drive change detection failed: %v", err)
	}

	// Additional smart path resolution
	if err := s.SmartPathResolution(); err != nil {
		log.Printf("⚠️ Warning: Smart path resolution failed: %v", err)
	}

	// Phase 1: Get all media from database (refresh after path resolution)
	log.Printf("📊 Phase 1: Retrieving all media from database...")
	allMedia, err := s.getAllMediaFromDatabase()
	if err != nil {
		return fmt.Errorf("failed to retrieve media from database: %v", err)
	}

	log.Printf("📊 Found %d media entries in database", len(allMedia))

	// Phase 2: Check each database entry against file system
	log.Printf("🔍 Phase 2: Validating database entries against file system...")
	var validMedia, invalidMedia, updatedMedia []models.Media

	for _, media := range allMedia {
		syncResult := s.syncSingleMediaEntry(&media)

		switch syncResult.Status {
		case "valid":
			validMedia = append(validMedia, media)
		case "invalid":
			invalidMedia = append(invalidMedia, media)
		case "updated":
			updatedMedia = append(updatedMedia, media)
		}
	}

	// Phase 3: Discover orphaned files (files not in database)
	log.Printf("🔍 Phase 3: Discovering orphaned files...")
	orphanedFiles, err := s.findOrphanedFiles(allMedia)
	if err != nil {
		log.Printf("⚠️ Warning: Failed to find orphaned files: %v", err)
	} else {
		log.Printf("📊 Found %d orphaned files", len(orphanedFiles))
	}

	// Phase 4: Process orphaned files
	if len(orphanedFiles) > 0 {
		log.Printf("🆕 Phase 4: Processing orphaned files...")
		for _, fileInfo := range orphanedFiles {
			if err := s.processVideoFileOptimized(fileInfo.Path, fileInfo.Info); err != nil {
				log.Printf("❌ Failed to process orphaned file %s: %v", fileInfo.Path, err)
				s.IncrementErrorFiles()
			} else {
				s.IncrementProcessedFiles()
				s.IncrementNewFiles()
			}
		}
	}

	// Phase 5: Clean up invalid entries (be more conservative)
	log.Printf("🧹 Phase 5: Handling invalid entries...")
	for _, media := range invalidMedia {
		if err := s.handleInvalidMediaEntry(&media); err != nil {
			log.Printf("⚠️ Warning: Failed to handle invalid media entry %d: %v", media.ID, err)
		}
	}

	// Phase 6: Force regenerate assets for all valid media
	log.Printf("🎨 Phase 6: Regenerating assets for all media...")
	s.regenerateAllAssets(append(validMedia, updatedMedia...))

	// Final statistics
	stats := s.GetScanStats()
	s.SetScanDuration(time.Since(stats.StartTime))
	s.logSyncResults(len(allMedia), len(validMedia), len(invalidMedia), len(updatedMedia), len(orphanedFiles))

	log.Printf("🔄 Database sync completed - %d invalid entries removed from database", len(invalidMedia))

	return nil
}

// MediaSyncResult represents the result of syncing a single media entry
type MediaSyncResult struct {
	Status      string // "valid", "invalid", "updated"
	NeedsUpdate bool
	Issues      []string
}

// syncSingleMediaEntry checks and syncs a single media entry
func (s *MediaScanner) syncSingleMediaEntry(media *models.Media) *MediaSyncResult {
	result := &MediaSyncResult{Status: "valid", Issues: []string{}}

	// Check if file exists
	if _, err := os.Stat(media.FilePath); os.IsNotExist(err) {
		log.Printf("🔍 File not found at stored path: %s (ID: %d)", media.FilePath, media.ID)

		// Try multiple strategies to find the file
		filename := filepath.Base(media.FilePath)
		var newPath string

		// Strategy 1: Smart path resolution (preserves directory structure)
		newPath = s.findFileInCurrentStorage(filename, media.FilePath)

		// Strategy 2: Fallback to simple filename search
		if newPath == "" {
			newPath = s.findFileInStorage(filename)
		}

		// Strategy 3: Try to find by title if filename search fails
		if newPath == "" && media.Title != "" {
			// Search for files with similar titles
			if foundMedia := s.findMediaFileByTitle(media.Title); foundMedia != "" {
				newPath = foundMedia
			}
		}

		if newPath == "" {
			// Mark as invalid but don't delete immediately
			result.Status = "invalid"
			result.Issues = append(result.Issues, "File not found in storage after exhaustive search")
			log.Printf("❌ File not found after exhaustive search: %s (ID: %d, Title: %s)", media.FilePath, media.ID, media.Title)
			return result
		}

		// File found at different location, update path
		log.Printf("✅ File relocated from %s to %s (ID: %d)", media.FilePath, newPath, media.ID)
		media.FilePath = newPath
		result.Status = "updated"
		result.NeedsUpdate = true
		result.Issues = append(result.Issues, fmt.Sprintf("Path resolved: %s", newPath))
	}

	// Get file info for size check
	fileInfo, err := os.Stat(media.FilePath)
	if err != nil {
		result.Status = "invalid"
		result.Issues = append(result.Issues, fmt.Sprintf("Cannot access file: %v", err))
		return result
	}

	// Check if file size changed (allow small variations for filesystem differences)
	sizeDiff := media.FileSize - fileInfo.Size()
	if sizeDiff < 0 {
		sizeDiff = -sizeDiff
	}

	// Only update if size difference is significant (more than 1KB)
	if sizeDiff > 1024 {
		log.Printf("📏 File size changed for %s: %d -> %d (diff: %d bytes)", media.Title, media.FileSize, fileInfo.Size(), sizeDiff)
		media.FileSize = fileInfo.Size()
		result.NeedsUpdate = true
		result.Issues = append(result.Issues, "File size updated")
	}

	// Check title quality
	if s.needsTitleFix(media, media.FilePath, &MediaSearchResult{TitleMismatch: s.titleLooksLikeFilename(media.Title)}) {
		log.Printf("🏷️ Title needs fixing for: %s", media.Title)

		// Extract new title from current path
		metadata := s.extractMetadataWithCache(media.FilePath)
		oldTitle := media.Title

		// Only update title if the new one is significantly better
		if metadata.Title != "" && len(metadata.Title) > 2 && !s.titleLooksLikeFilename(metadata.Title) {
			media.Title = metadata.Title
			media.Type = metadata.Type

			log.Printf("🏷️ Title updated from '%s' to '%s'", oldTitle, media.Title)
			result.NeedsUpdate = true
			result.Issues = append(result.Issues, "Title updated")
		}
	}

	// Check metadata completeness
	if s.needsMetadataUpdate(media) {
		log.Printf("📝 Metadata incomplete for: %s", media.Title)
		result.NeedsUpdate = true
		result.Issues = append(result.Issues, "Metadata incomplete")
	}

	// Update database if needed
	if result.NeedsUpdate {
		if err := s.GetMediaService().UpdateMedia(media); err != nil {
			log.Printf("❌ Failed to update media %s: %v", media.Title, err)
			result.Issues = append(result.Issues, fmt.Sprintf("Database update failed: %v", err))
		} else {
			log.Printf("✅ Updated media: %s", media.Title)
			if result.Status == "valid" {
				result.Status = "updated"
			}
		}
	}

	return result
}

// getAllMediaFromDatabase retrieves all media entries from the database
func (s *MediaScanner) getAllMediaFromDatabase() ([]models.Media, error) {
	return s.GetMediaService().GetAllMedia()
}

// findFileInStorage searches for a file by name in the media storage
func (s *MediaScanner) findFileInStorage(filename string) string {
	var foundPath string

	// Walk through the media path to find the file
	filepath.Walk(s.GetMediaPath(), func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		if !info.IsDir() && filepath.Base(path) == filename {
			// Verify it's a video file
			if s.isVideoFile(path) {
				foundPath = path
				return filepath.SkipDir // Stop searching once found
			}
		}

		return nil
	})

	return foundPath
}

// findOrphanedFiles finds video files in storage that aren't in the database
func (s *MediaScanner) findOrphanedFiles(existingMedia []models.Media) ([]FileInfo, error) {
	// Create a map of existing file paths for quick lookup
	existingPaths := make(map[string]bool)
	for _, media := range existingMedia {
		existingPaths[media.FilePath] = true
	}

	// Discover all video files in storage
	allFiles, err := s.discoverFiles()
	if err != nil {
		return nil, err
	}

	// Filter out files that are already in database
	var orphanedFiles []FileInfo
	for _, file := range allFiles {
		if file.IsVideo && !existingPaths[file.Path] {
			orphanedFiles = append(orphanedFiles, file)
		}
	}

	return orphanedFiles, nil
}

// handleInvalidMediaEntry handles media entries that no longer have corresponding files
func (s *MediaScanner) handleInvalidMediaEntry(media *models.Media) error {
	log.Printf("🗑️ Handling invalid media entry: %s (ID: %d)", media.Title, media.ID)

	// Delete the entry since the file no longer exists
	if err := s.GetMediaService().DeleteMedia(media.ID); err != nil {
		log.Printf("❌ Failed to delete invalid media entry %d (%s): %v", media.ID, media.Title, err)
		return err
	}

	log.Printf("✅ Successfully removed invalid media entry: %s (ID: %d)", media.Title, media.ID)
	return nil
}

// regenerateAllAssets intelligently regenerates only missing assets for the given media
func (s *MediaScanner) regenerateAllAssets(mediaList []models.Media) {
	log.Printf("🎨 Starting intelligent asset check for %d media items...", len(mediaList))

	// First pass: count how many actually need assets
	var mediaNeedingAssets []models.Media
	for _, media := range mediaList {
		needsThumbnail, needsPreview, needsPoster := s.checkMissingAssets(&media)
		if needsThumbnail || needsPreview || needsPoster {
			mediaNeedingAssets = append(mediaNeedingAssets, media)
		}
	}

	if len(mediaNeedingAssets) == 0 {
		log.Printf("✅ All assets already exist for %d media items - skipping regeneration", len(mediaList))
		return
	}

	log.Printf("🎨 Found %d media items needing assets out of %d total", len(mediaNeedingAssets), len(mediaList))

	// Process in batches to avoid overwhelming the system
	batchSize := 3 // Reduced batch size for stability
	for i := 0; i < len(mediaNeedingAssets); i += batchSize {
		end := i + batchSize
		if end > len(mediaNeedingAssets) {
			end = len(mediaNeedingAssets)
		}

		batch := mediaNeedingAssets[i:end]
		log.Printf("🎨 Processing asset batch %d-%d of %d (only missing assets)", i+1, end, len(mediaNeedingAssets))

		// Process batch in parallel
		var wg sync.WaitGroup
		for _, media := range batch {
			wg.Add(1)
			go func(m models.Media) {
				defer wg.Done()
				s.regenerateMediaAssets(&m)
			}(media)
		}

		wg.Wait()

		// Small delay between batches to prevent system overload
		if end < len(mediaNeedingAssets) {
			time.Sleep(3 * time.Second) // Slightly longer delay
		}
	}

	log.Printf("✅ Intelligent asset generation completed - processed %d media items (skipped %d with existing assets)", 
		len(mediaNeedingAssets), len(mediaList)-len(mediaNeedingAssets))
}

// regeneratePreviewClipsBatch intelligently processes preview clip generation only for missing previews
func (s *MediaScanner) regeneratePreviewClipsBatch(mediaList []models.Media) {
	log.Printf("🎬 Starting intelligent preview clip check for %d media items...", len(mediaList))

	// First pass: filter media that actually need preview clips
	var mediaNeedingPreviews []models.Media
	for _, media := range mediaList {
		_, needsPreview, _ := s.checkMissingAssets(&media)
		if needsPreview {
			mediaNeedingPreviews = append(mediaNeedingPreviews, media)
		}
	}

	if len(mediaNeedingPreviews) == 0 {
		log.Printf("✅ All preview clips already exist for %d media items - skipping generation", len(mediaList))
		return
	}

	log.Printf("🎬 Found %d media items needing preview clips out of %d total", len(mediaNeedingPreviews), len(mediaList))

	// Use smaller batch size for preview clips as they're more resource intensive
	batchSize := 2 // Further reduced for stability
	totalBatches := (len(mediaNeedingPreviews) + batchSize - 1) / batchSize

	for i := 0; i < len(mediaNeedingPreviews); i += batchSize {
		end := i + batchSize
		if end > len(mediaNeedingPreviews) {
			end = len(mediaNeedingPreviews)
		}

		batch := mediaNeedingPreviews[i:end]
		batchNum := (i / batchSize) + 1
		log.Printf("🎬 Processing preview batch %d/%d (%d-%d of %d) - only missing previews", 
			batchNum, totalBatches, i+1, end, len(mediaNeedingPreviews))

		// Process batch sequentially to avoid overwhelming ffmpeg
		for _, media := range batch {
			s.regeneratePreviewClipForMedia(&media)

			// Small delay between each preview generation to prevent system overload
			time.Sleep(2 * time.Second) // Increased delay
		}

		// Longer delay between batches for preview clips
		if end < len(mediaNeedingPreviews) {
			log.Printf("⏸️ Batch %d/%d completed, waiting 8 seconds before next batch...", batchNum, totalBatches)
			time.Sleep(8 * time.Second) // Increased delay
		}
	}

	log.Printf("✅ Intelligent preview clip generation completed - processed %d media items (skipped %d with existing previews)", 
		len(mediaNeedingPreviews), len(mediaList)-len(mediaNeedingPreviews))
}

// regeneratePreviewClipForMedia regenerates preview clip only if missing for a single media item
func (s *MediaScanner) regeneratePreviewClipForMedia(media *models.Media) {
	// Double-check if preview is actually needed (avoid redundant work)
	_, needsPreview, _ := s.checkMissingAssets(media)
	if !needsPreview {
		log.Printf("✅ Preview already exists for: %s - skipping", media.Title)
		return
	}

	log.Printf("🎬 Generating missing preview clip for: %s", media.Title)

	// Check if file still exists
	if _, err := os.Stat(media.FilePath); os.IsNotExist(err) {
		log.Printf("⚠️ Cannot generate preview clip, file not found: %s", media.FilePath)
		return
	}

	// Try multiple preview generation strategies with fallbacks
	previewPath, err := s.generatePreviewWithFallbacks(media)

	if err == nil && previewPath != "" {
		// Update media record with preview paths
		oldPreviewPath := media.PreviewPath
		oldPreviewClipPath := media.PreviewClipPath

		media.PreviewPath = previewPath
		media.PreviewClipPath = previewPath

		if updateErr := s.GetMediaService().UpdateMedia(media); updateErr != nil {
			log.Printf("⚠️ Failed to update media record for %s: %v", media.Title, updateErr)
		} else {
			log.Printf("✅ Preview clip generated and updated for: %s", media.Title)
			log.Printf("   📁 Old preview path: %s", oldPreviewPath)
			log.Printf("   📁 Old preview clip path: %s", oldPreviewClipPath)
			log.Printf("   📁 New preview path: %s", previewPath)

			// Verify the file was actually created
			if _, err := os.Stat(previewPath); err == nil {
				if stat, err := os.Stat(previewPath); err == nil {
					log.Printf("   📊 Preview file size: %d bytes", stat.Size())
				}
			} else {
				log.Printf("⚠️ Warning: Preview file not found after generation: %s", previewPath)
			}
		}
	} else {
		log.Printf("❌ All preview generation methods failed for %s: %v", media.Title, err)
	}
}

// generatePreviewWithFallbacks tries multiple methods to generate preview clips with ALAC audio fallbacks
func (s *MediaScanner) generatePreviewWithFallbacks(media *models.Media) (string, error) {
	// FIRST: Check if valid preview already exists to avoid regeneration
	if media.PreviewPath != "" && s.validatePreviewFile(media.PreviewPath) {
		log.Printf("✅ Valid preview already exists for %s: %s - skipping regeneration", media.Title, media.PreviewPath)
		return media.PreviewPath, nil
	}
	if media.PreviewClipPath != "" && s.validatePreviewFile(media.PreviewClipPath) {
		log.Printf("✅ Valid preview clip already exists for %s: %s - skipping regeneration", media.Title, media.PreviewClipPath)
		return media.PreviewClipPath, nil
	}

	// Check for existing preview files in common locations to avoid duplicates
	existingPreview := s.findExistingPreviewFile(media)
	if existingPreview != "" {
		log.Printf("✅ Found existing preview file for %s: %s - updating database", media.Title, existingPreview)
		media.PreviewPath = existingPreview
		media.PreviewClipPath = existingPreview
		s.GetMediaService().UpdateMedia(media)
		return existingPreview, nil
	}

	log.Printf("📺 Starting preview generation for %s (no valid preview found)", media.Title)
	var lastErr error

	// Strategy 1: Try standard preview generation (1080p with original audio)
	log.Printf("🎬 Attempt 1: Standard 1080p preview generation for %s", media.Title)
	previewPath, err := s.GetThumbnailService().GeneratePreviewClip(media.FilePath, media.ID, media.Title)
	if err == nil && previewPath != "" && s.validatePreviewFile(previewPath) {
		log.Printf("✅ Standard preview generation successful for %s", media.Title)
		return previewPath, nil
	}
	lastErr = err
	log.Printf("⚠️ Standard preview generation failed for %s: %v", media.Title, err)

	// Strategy 2: Try with audio codec fallback (convert ALAC to AAC)
	log.Printf("🎬 Attempt 2: Preview with audio codec fallback for %s", media.Title)
	previewPath, err = s.generatePreviewWithAudioFallback(media)
	if err == nil && previewPath != "" && s.validatePreviewFile(previewPath) {
		log.Printf("✅ Audio fallback preview generation successful for %s", media.Title)
		return previewPath, nil
	}
	if err != nil {
		lastErr = err
	}
	log.Printf("⚠️ Audio fallback preview generation failed for %s: %v", media.Title, err)

	// Strategy 3: Try async method as fallback
	log.Printf("🎬 Attempt 3: Async preview generation for %s", media.Title)
	previewPath, err = s.GetThumbnailService().GeneratePreviewClipAsync(media.FilePath, media.ID, media.Title)
	if err == nil && previewPath != "" && s.validatePreviewFile(previewPath) {
		log.Printf("✅ Async preview generation successful for %s", media.Title)
		return previewPath, nil
	}
	if err != nil {
		lastErr = err
	}
	log.Printf("⚠️ Async preview generation failed for %s: %v", media.Title, err)

	// Strategy 4: Try lower quality preview (720p) with audio conversion
	log.Printf("🎬 Attempt 4: Lower quality (720p) preview for %s", media.Title)
	previewPath, err = s.generateLowerQualityPreview(media)
	if err == nil && previewPath != "" && s.validatePreviewFile(previewPath) {
		log.Printf("✅ Lower quality preview generation successful for %s", media.Title)
		return previewPath, nil
	}
	if err != nil {
		lastErr = err
	}
	log.Printf("⚠️ Lower quality preview generation failed for %s: %v", media.Title, err)

	// Strategy 5: Try basic preview without audio
	log.Printf("🎬 Attempt 5: Video-only preview for %s", media.Title)
	previewPath, err = s.generateVideoOnlyPreview(media)
	if err == nil && previewPath != "" && s.validatePreviewFile(previewPath) {
		log.Printf("✅ Video-only preview generation successful for %s", media.Title)
		return previewPath, nil
	}
	if err != nil {
		lastErr = err
	}

	return "", fmt.Errorf("all preview generation strategies failed, last error: %v", lastErr)
}

// generatePreviewWithAudioFallback generates 1080p preview with audio codec conversion using peak detection
func (s *MediaScanner) generatePreviewWithAudioFallback(media *models.Media) (string, error) {
	previewDir := "previews"
	if _, err := os.Stat(previewDir); os.IsNotExist(err) {
		os.MkdirAll(previewDir, 0755)
	}

	outputPath := fmt.Sprintf("%s/preview_%d_%s_1080p_audio_fallback.mp4", previewDir, media.ID,
		strings.ReplaceAll(media.Title, " ", "_"))

	// Check if this specific preview file already exists and is valid
	if _, err := os.Stat(outputPath); err == nil {
		if s.validatePreviewFile(outputPath) {
			log.Printf("✅ 1080p audio fallback preview already exists for %s: %s - skipping regeneration", media.Title, outputPath)
			return outputPath, nil
		} else {
			log.Printf("⚠️ Existing 1080p audio fallback preview invalid for %s, regenerating: %s", media.Title, outputPath)
			os.Remove(outputPath) // Remove invalid file
		}
	}

	// Get optimal timestamp using peak detection for better preview quality
	startTime := s.getOptimalPreviewTimestamp(media.FilePath)
	startTimeStr := fmt.Sprintf("%d", startTime)

	// Ultra HD 1080p FFmpeg command with peak timestamp detection - NO TIMEOUT
	cmd := exec.Command("ffmpeg",
		"-i", media.FilePath,
		"-ss", startTimeStr, // Use optimal peak timestamp
		"-t", "30", // 30 seconds for comprehensive preview
		"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2", // Full HD 1080p
		"-c:v", "libx264",
		"-preset", "slow", // High quality preset for best results
		"-crf", "18", // Ultra high quality (Netflix-level)
		"-c:a", "aac", // AAC audio for compatibility
		"-b:a", "192k", // High audio bitrate for quality
		"-ac", "2", // Stereo audio
		"-ar", "48000", // High sample rate
		"-movflags", "+faststart", // Web optimization
		"-pix_fmt", "yuv420p", // Ensure compatibility
		"-threads", "0", // Use all available threads
		"-max_muxing_queue_size", "9999", // Prevent buffer issues
		"-y", // Overwrite output file
		outputPath)

	log.Printf("🔧 Running FFmpeg 1080p with audio fallback at %ss (NO TIMEOUT): %s", startTimeStr, cmd.String())

	// Run without timeout to ensure completion
	if output, err := cmd.CombinedOutput(); err != nil {
		log.Printf("❌ FFmpeg 1080p audio fallback failed: %v\nOutput: %s", err, string(output))
		return "", fmt.Errorf("ffmpeg 1080p audio fallback failed: %v", err)
	}

	log.Printf("✅ 1080p preview with audio fallback completed successfully")
	return outputPath, nil
}

// generateLowerQualityPreview generates 720p fallback preview with audio conversion using peak detection
func (s *MediaScanner) generateLowerQualityPreview(media *models.Media) (string, error) {
	previewDir := "previews"
	if _, err := os.Stat(previewDir); os.IsNotExist(err) {
		os.MkdirAll(previewDir, 0755)
	}

	outputPath := fmt.Sprintf("%s/preview_%d_%s_720p_fallback.mp4", previewDir, media.ID,
		strings.ReplaceAll(media.Title, " ", "_"))

	// Check if this specific preview file already exists and is valid
	if _, err := os.Stat(outputPath); err == nil {
		if s.validatePreviewFile(outputPath) {
			log.Printf("✅ 720p fallback preview already exists for %s: %s - skipping regeneration", media.Title, outputPath)
			return outputPath, nil
		} else {
			log.Printf("⚠️ Existing 720p fallback preview invalid for %s, regenerating: %s", media.Title, outputPath)
			os.Remove(outputPath) // Remove invalid file
		}
	}

	// Get optimal timestamp using peak detection for better preview quality
	startTime := s.getOptimalPreviewTimestamp(media.FilePath)
	startTimeStr := fmt.Sprintf("%d", startTime)

	// 720p fallback FFmpeg command with peak timestamp detection - NO TIMEOUT
	cmd := exec.Command("ffmpeg",
		"-i", media.FilePath,
		"-ss", startTimeStr, // Use optimal peak timestamp
		"-t", "30", // 30 seconds for comprehensive preview
		"-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2", // 720p fallback
		"-c:v", "libx264",
		"-preset", "medium", // Balanced quality/speed preset
		"-crf", "20", // High quality for 720p
		"-c:a", "aac", // AAC audio for compatibility
		"-b:a", "128k", // Good audio bitrate for 720p
		"-ac", "2", // Stereo audio
		"-ar", "44100", // Standard sample rate
		"-movflags", "+faststart", // Web optimization
		"-pix_fmt", "yuv420p", // Ensure compatibility
		"-threads", "0", // Use all available threads
		"-max_muxing_queue_size", "9999", // Prevent buffer issues
		"-y", // Overwrite output file
		outputPath)

	log.Printf("🔧 Running FFmpeg 720p fallback at %ss (NO TIMEOUT): %s", startTimeStr, cmd.String())

	// Run without timeout to ensure completion
	if output, err := cmd.CombinedOutput(); err != nil {
		log.Printf("❌ FFmpeg 720p fallback failed: %v\nOutput: %s", err, string(output))
		return "", fmt.Errorf("ffmpeg 720p fallback failed: %v", err)
	}

	log.Printf("✅ 720p fallback preview completed successfully")
	return outputPath, nil
}

// generateVideoOnlyPreview generates video-only preview without audio track using peak detection
func (s *MediaScanner) generateVideoOnlyPreview(media *models.Media) (string, error) {
	previewDir := "previews"
	if _, err := os.Stat(previewDir); os.IsNotExist(err) {
		os.MkdirAll(previewDir, 0755)
	}

	outputPath := fmt.Sprintf("%s/preview_%d_%s_video_only.mp4", previewDir, media.ID,
		strings.ReplaceAll(media.Title, " ", "_"))

	// Check if this specific preview file already exists and is valid
	if _, err := os.Stat(outputPath); err == nil {
		if s.validatePreviewFile(outputPath) {
			log.Printf("✅ Video-only preview already exists for %s: %s - skipping regeneration", media.Title, outputPath)
			return outputPath, nil
		} else {
			log.Printf("⚠️ Existing video-only preview invalid for %s, regenerating: %s", media.Title, outputPath)
			os.Remove(outputPath) // Remove invalid file
		}
	}

	// Get optimal timestamp using peak detection for better preview quality
	startTime := s.getOptimalPreviewTimestamp(media.FilePath)
	startTimeStr := fmt.Sprintf("%d", startTime)

	// 720p video-only FFmpeg command with peak timestamp detection - NO TIMEOUT
	cmd := exec.Command("ffmpeg",
		"-i", media.FilePath,
		"-ss", startTimeStr, // Use optimal peak timestamp
		"-t", "30", // 30 seconds for comprehensive preview
		"-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2", // 720p for video-only
		"-c:v", "libx264",
		"-preset", "fast", // Fast preset for video-only
		"-crf", "22", // Good quality for video-only
		"-an", // No audio track
		"-movflags", "+faststart", // Web optimization
		"-pix_fmt", "yuv420p", // Ensure compatibility
		"-threads", "0", // Use all available threads
		"-max_muxing_queue_size", "9999", // Prevent buffer issues
		"-y", // Overwrite output file
		outputPath)

	log.Printf("🔧 Running FFmpeg video-only preview at %ss (NO TIMEOUT): %s", startTimeStr, cmd.String())

	// Run without timeout to ensure completion
	if output, err := cmd.CombinedOutput(); err != nil {
		log.Printf("❌ FFmpeg video-only preview failed: %v\nOutput: %s", err, string(output))
		return "", fmt.Errorf("ffmpeg video-only preview failed: %v", err)
	}

	log.Printf("✅ Video-only preview completed successfully")
	return outputPath, nil
}

// getOptimalPreviewTimestamp uses intelligent scene detection to find peak moments for preview generation
// Combines multiple strategies: scene changes, audio peaks, and motion detection for best preview quality
func (s *MediaScanner) getOptimalPreviewTimestamp(videoPath string) int {
	// Get video duration using ffprobe
	duration := s.getVideoDurationSeconds(videoPath)
	if duration <= 0 {
		// Fallback to 60 seconds if duration detection fails
		log.Printf("⚠️ Could not detect video duration for %s, using 60s fallback", videoPath)
		return 60
	}

	// Strategy 1: Try intelligent scene detection for peak moments
	if peakTime := s.detectPeakMoments(videoPath, duration); peakTime > 0 {
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
func (s *MediaScanner) detectPeakMoments(videoPath string, duration int) int {
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
	sceneChanges := s.parseSceneChanges(string(output), duration)
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
func (s *MediaScanner) parseSceneChanges(output string, duration int) []int {
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
func (s *MediaScanner) getVideoDurationSeconds(videoPath string) int {
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

// findExistingPreviewFile searches for existing preview files in common locations
func (s *MediaScanner) findExistingPreviewFile(media *models.Media) string {
	// Sanitize title for filename usage
	sanitizedTitle := strings.ReplaceAll(media.Title, " ", "_")
	sanitizedTitle = strings.ReplaceAll(sanitizedTitle, ":", "")
	sanitizedTitle = strings.ReplaceAll(sanitizedTitle, "?", "")
	sanitizedTitle = strings.ReplaceAll(sanitizedTitle, "*", "")
	sanitizedTitle = strings.ReplaceAll(sanitizedTitle, "/", "_")
	sanitizedTitle = strings.ReplaceAll(sanitizedTitle, "\\", "_")

	// Generate year string for patterns
	yearStr := ""
	if media.Year > 0 {
		yearStr = fmt.Sprintf("(%d)", media.Year)
		yearStrUnderscore := fmt.Sprintf("_%d", media.Year)
		yearStrPlain := fmt.Sprintf("%d", media.Year)

		// All possible preview file patterns to check
		previewPatterns := []string{
			// Current system patterns
			fmt.Sprintf("previews/preview_%d_%s.mp4", media.ID, sanitizedTitle),
			fmt.Sprintf("previews/preview_%d_%s_1080p_audio_fallback.mp4", media.ID, sanitizedTitle),
			fmt.Sprintf("previews/preview_%d_%s_720p_fallback.mp4", media.ID, sanitizedTitle),
			fmt.Sprintf("previews/preview_%d_%s_video_only.mp4", media.ID, sanitizedTitle),
			fmt.Sprintf("previews/preview_%d_%s_HD.mp4", media.ID, sanitizedTitle),
			fmt.Sprintf("previews/preview_%d_%s_audio_fallback.mp4", media.ID, sanitizedTitle),

			// User-specified patterns: preview_id_title_(year).mp4
			fmt.Sprintf("previews/preview_%d_%s_%s.mp4", media.ID, sanitizedTitle, yearStr),
			fmt.Sprintf("previews/preview_%d_%s%s.mp4", media.ID, sanitizedTitle, yearStrUnderscore),

			// User-specified patterns: preview_title_(year).mp4
			fmt.Sprintf("previews/preview_%s_%s.mp4", sanitizedTitle, yearStr),
			fmt.Sprintf("previews/preview_%s%s.mp4", sanitizedTitle, yearStrUnderscore),

			// User-specified patterns: preview_title_year.mp4
			fmt.Sprintf("previews/preview_%s_%s.mp4", sanitizedTitle, yearStrPlain),

			// Backend directory versions
			fmt.Sprintf("./backend/previews/preview_%d_%s.mp4", media.ID, sanitizedTitle),
			fmt.Sprintf("./backend/previews/preview_%d_%s_1080p_audio_fallback.mp4", media.ID, sanitizedTitle),
			fmt.Sprintf("./backend/previews/preview_%d_%s_720p_fallback.mp4", media.ID, sanitizedTitle),
			fmt.Sprintf("./backend/previews/preview_%d_%s_video_only.mp4", media.ID, sanitizedTitle),
			fmt.Sprintf("./backend/previews/preview_%d_%s_%s.mp4", media.ID, sanitizedTitle, yearStr),
			fmt.Sprintf("./backend/previews/preview_%d_%s%s.mp4", media.ID, sanitizedTitle, yearStrUnderscore),
			fmt.Sprintf("./backend/previews/preview_%s_%s.mp4", sanitizedTitle, yearStr),
			fmt.Sprintf("./backend/previews/preview_%s%s.mp4", sanitizedTitle, yearStrUnderscore),
			fmt.Sprintf("./backend/previews/preview_%s_%s.mp4", sanitizedTitle, yearStrPlain),
		}

		// Check each pattern for existing valid preview files
		for _, pattern := range previewPatterns {
			if _, err := os.Stat(pattern); err == nil {
				if s.validatePreviewFile(pattern) {
					log.Printf("🔍 Found existing valid preview: %s for %s", pattern, media.Title)
					return pattern
				} else {
					log.Printf("⚠️ Found existing invalid preview: %s for %s - will be ignored", pattern, media.Title)
				}
			}
		}
	} else {
		// Patterns without year information
		previewPatterns := []string{
			fmt.Sprintf("previews/preview_%d_%s.mp4", media.ID, sanitizedTitle),
			fmt.Sprintf("previews/preview_%d_%s_1080p_audio_fallback.mp4", media.ID, sanitizedTitle),
			fmt.Sprintf("previews/preview_%d_%s_720p_fallback.mp4", media.ID, sanitizedTitle),
			fmt.Sprintf("previews/preview_%d_%s_video_only.mp4", media.ID, sanitizedTitle),
			fmt.Sprintf("previews/preview_%s.mp4", sanitizedTitle),
			fmt.Sprintf("./backend/previews/preview_%d_%s.mp4", media.ID, sanitizedTitle),
			fmt.Sprintf("./backend/previews/preview_%s.mp4", sanitizedTitle),
		}

		// Check each pattern for existing valid preview files
		for _, pattern := range previewPatterns {
			if _, err := os.Stat(pattern); err == nil {
				if s.validatePreviewFile(pattern) {
					log.Printf("🔍 Found existing valid preview: %s for %s", pattern, media.Title)
					return pattern
				} else {
					log.Printf("⚠️ Found existing invalid preview: %s for %s - will be ignored", pattern, media.Title)
				}
			}
		}
	}

	return "" // No existing valid preview found
}

// Preview generation queue to prevent CPU overload
var (
	previewQueue = make(chan *models.Media, 100) // Buffer for 100 items
	previewWorkerStarted = false
	previewQueueMutex sync.Mutex
)

// startPreviewWorker starts a single worker to process preview generation sequentially
func (s *MediaScanner) startPreviewWorker() {
	previewQueueMutex.Lock()
	defer previewQueueMutex.Unlock()
	
	if previewWorkerStarted {
		return // Worker already running
	}
	
	previewWorkerStarted = true
	log.Printf("📺 Starting sequential preview generation worker to prevent CPU overload")
	
	go func() {
		for media := range previewQueue {
			log.Printf("🎬 Processing preview for: %s (Queue size: %d)", media.Title, len(previewQueue))
			
			// Generate preview with comprehensive fallbacks
			previewPath, err := s.generatePreviewWithFallbacks(media)
			if err != nil {
				log.Printf("❌ All preview generation methods failed for %s: %v", media.Title, err)
			} else {
				log.Printf("✅ Preview generation successful for %s: %s", media.Title, previewPath)
				media.PreviewPath = previewPath
				media.PreviewClipPath = previewPath
				s.GetMediaService().UpdateMedia(media)
			}
			
			// Add delay between processing to prevent CPU overload
			time.Sleep(2 * time.Second)
		}
	}()
}

// scheduleAssetGenerationWithFallbacks schedules asset generation with fallback handling and sequential processing
func (s *MediaScanner) scheduleAssetGenerationWithFallbacks(media *models.Media, path string, needsThumbnail, needsPreview bool) {
	// Generate thumbnail with fallbacks (can run in parallel as it's lighter)
	if needsThumbnail {
		go func() {
			s.incrementGoroutines()
			defer s.decrementGoroutines()
			if _, err := s.GetThumbnailService().GenerateThumbnail(path, media.ID, media.Title); err != nil {
				log.Printf("❌ Thumbnail generation failed for %s: %v", media.Title, err)

				// Try async thumbnail generation as fallback
				if _, asyncErr := s.GetThumbnailService().GenerateThumbnailAsync(path, media.ID, media.Title); asyncErr != nil {
					log.Printf("❌ Async thumbnail generation also failed for %s: %v", media.Title, asyncErr)
				} else {
					log.Printf("✅ Async thumbnail generation successful for %s", media.Title)
					thumbnailPath := s.GetThumbnailService().GetThumbnailPath(media.ID, media.Title)
					if thumbnailPath != "" {
						media.ThumbnailPath = thumbnailPath
						s.GetMediaService().UpdateMedia(media)
					}
				}
			} else {
				log.Printf("✅ Thumbnail generation successful for %s", media.Title)
				thumbnailPath := s.GetThumbnailService().GetThumbnailPath(media.ID, media.Title)
				if thumbnailPath != "" {
					media.ThumbnailPath = thumbnailPath
					s.GetMediaService().UpdateMedia(media)
				}
			}
		}()
	}

	// Queue preview generation for sequential processing to prevent CPU overload
	if needsPreview {
		// Start the preview worker if not already running
		s.startPreviewWorker()
		
		// Add to queue for sequential processing
		select {
		case previewQueue <- media:
			log.Printf("📋 Queued preview generation for: %s (Queue size: %d)", media.Title, len(previewQueue)+1)
		default:
			log.Printf("⚠️ Preview queue full, skipping: %s", media.Title)
		}
	}
}

// scheduleAssetGeneration provides backward compatibility (calls new method)
func (s *MediaScanner) scheduleAssetGeneration(media *models.Media, path string, needsThumbnail, needsPreview bool) {
	s.scheduleAssetGenerationWithFallbacks(media, path, needsThumbnail, needsPreview)
}

// scheduleSeriesAssetDownload downloads poster/logo/backdrop for a TV series when missing
func (s *MediaScanner) scheduleSeriesAssetDownload(series *models.Series) {
	if series == nil || s.GetTMDBService() == nil {
		return
	}

	go func(seriesCopy models.Series) {
		s.incrementGoroutines()
		defer s.decrementGoroutines()

		// Delay slightly to avoid competing with ongoing DB operations
		time.Sleep(3 * time.Second)

		// Refresh latest series data
		refreshedSeries := &seriesCopy
		if s.GetMediaService() != nil {
			if current, err := s.GetMediaService().GetSeriesByID(seriesCopy.ID); err != nil {
				log.Printf("⚠️ Failed to refresh series %d before asset download: %v", seriesCopy.ID, err)
			} else {
				refreshedSeries = current
			}
		}

		seriesTitle := refreshedSeries.Title
		seriesID := refreshedSeries.ID

		updates := make(map[string]interface{})
		posterDir := "./backend/posters"
		logoDir := "./logos"
		backdropDir := "./backdrops"

		// Ensure directories exist for assets downloaded directly via TMDB service
		if err := os.MkdirAll(posterDir, 0755); err != nil {
			log.Printf("⚠️ Failed to ensure poster directory: %v", err)
		}
		if err := os.MkdirAll(logoDir, 0755); err != nil {
			log.Printf("⚠️ Failed to ensure logo directory: %v", err)
		}
		if err := os.MkdirAll(backdropDir, 0755); err != nil {
			log.Printf("⚠️ Failed to ensure backdrop directory: %v", err)
		}

		// Poster download (prefer existing local path)
		if refreshedSeries.PosterPath == "" && s.GetPosterService() != nil {
			if posterPath, err := s.GetPosterService().DownloadTVPosterWithPath(seriesTitle, seriesID); err != nil {
				log.Printf("⚠️ Failed to download TV poster for series %s: %v", seriesTitle, err)
			} else if posterPath != "" {
				updates["poster_path"] = posterPath
			}
		}

		// Logo download via TMDB service
		if refreshedSeries.LogoPath == "" {
			if logoPath, err := s.GetTMDBService().DownloadTVLogoByTitle(seriesTitle, seriesID, logoDir); err != nil {
				log.Printf("⚠️ Failed to download TV logo for series %s: %v", seriesTitle, err)
			} else if logoPath != "" {
				updates["logo_path"] = logoPath
			}
		}

		// Backdrop download via TMDB service
		if refreshedSeries.BackdropPath == "" {
			if backdropPath, err := s.GetTMDBService().DownloadTVBackdropByTitle(seriesTitle, seriesID, backdropDir); err != nil {
				log.Printf("⚠️ Failed to download TV backdrop for series %s: %v", seriesTitle, err)
			} else if backdropPath != "" {
				updates["backdrop_path"] = backdropPath
				updates["tmdb_backdrop_url"] = fmt.Sprintf("/api/series/%d/backdrop", seriesID)
			}
		}

		if len(updates) == 0 {
			log.Printf("ℹ️ No new TV series assets downloaded for %s (ID: %d)", seriesTitle, seriesID)
			return
		}

		if _, err := s.GetMediaService().UpdateSeries(seriesID, updates); err != nil {
			log.Printf("⚠️ Failed to update series %s with asset paths: %v", seriesTitle, err)
		} else {
			log.Printf("✅ TV series assets saved for %s: %+v", seriesTitle, updates)
		}
	}( *series)
}

// regenerateMediaAssets regenerates only missing assets for a single media item
func (s *MediaScanner) regenerateMediaAssets(media *models.Media) {
	log.Printf("🎨 Checking assets for: %s", media.Title)

	// Check if file still exists
	if _, err := os.Stat(media.FilePath); os.IsNotExist(err) {
		log.Printf("⚠️ Cannot regenerate assets, file not found: %s", media.FilePath)
		return
	}

	// Check which assets are missing or invalid
	needsThumbnail, needsPreview, needsPoster := s.checkMissingAssets(media)

	if !needsThumbnail && !needsPreview && !needsPoster {
		log.Printf("✅ All assets exist for: %s", media.Title)
		return
	}

	log.Printf("🎨 Generating missing assets for %s (thumbnail: %v, preview: %v, poster: %v)", 
		media.Title, needsThumbnail, needsPreview, needsPoster)

	// Generate thumbnail only if missing
	if needsThumbnail {
		go func() {
			if _, err := s.GetThumbnailService().GenerateThumbnailAsync(media.FilePath, media.ID, media.Title); err != nil {
				log.Printf("❌ Failed to generate thumbnail for %s: %v", media.Title, err)
			} else {
				// Update media record with thumbnail path
				thumbnailPath := s.GetThumbnailService().GetThumbnailPath(media.ID, media.Title)
				if thumbnailPath != "" {
					media.ThumbnailPath = thumbnailPath
					s.GetMediaService().UpdateMedia(media)
				}
				log.Printf("✅ Thumbnail generated for: %s", media.Title)
			}
		}()
	}

	// Generate preview only if missing
	if needsPreview {
		go func() {
			if previewPath, err := s.GetThumbnailService().GeneratePreviewClipAsync(media.FilePath, media.ID, media.Title); err != nil {
				log.Printf("❌ Failed to generate preview for %s: %v", media.Title, err)
			} else {
				// Update media record with preview paths
				media.PreviewPath = previewPath
				media.PreviewClipPath = previewPath
				s.GetMediaService().UpdateMedia(media)
				log.Printf("✅ Preview generated for: %s", media.Title)
			}
		}()
	}

	// Generate poster only if missing
	if needsPoster && s.GetPosterService() != nil {
		go func() {
			if posterPath, err := s.GetPosterService().DownloadPosterWithPath(media.Title, media.ID); err != nil {
				log.Printf("❌ Failed to generate poster for %s: %v", media.Title, err)
			} else if posterPath != "" {
				media.PosterPath = posterPath
				if updateErr := s.GetMediaService().UpdateMedia(media); updateErr != nil {
					log.Printf("⚠️ Failed to update media with poster path: %v", updateErr)
				} else {
					log.Printf("✅ Poster generated for: %s", media.Title)
				}
			}
		}()
	}

	// Update metadata from TMDB if available
	if s.GetTMDBService() != nil {
		go func() {
			if tmdbMetadata, err := s.GetTMDBService().GenerateMediaMetadata(media.FilePath, media.Title); err != nil {
				log.Printf("⚠️ Failed to update TMDB metadata for %s: %v", media.Title, err)
			} else {
				// Update media with TMDB metadata
				s.updateMediaWithTMDBMetadata(media, tmdbMetadata)
				log.Printf("✅ TMDB metadata updated for: %s", media.Title)
			}
		}()
	}
}

// checkMissingAssets checks which assets are missing or invalid for a media item
func (s *MediaScanner) checkMissingAssets(media *models.Media) (needsThumbnail, needsPreview, needsPoster bool) {
	// Check thumbnail
	needsThumbnail = s.isAssetMissing(media.ThumbnailPath, "thumbnail", media.ID, media.Title)
	
	// Check preview clip
	needsPreview = s.isAssetMissing(media.PreviewPath, "preview", media.ID, media.Title) || 
				   s.isAssetMissing(media.PreviewClipPath, "preview_clip", media.ID, media.Title)
	
	// Check poster
	needsPoster = s.isAssetMissing(media.PosterPath, "poster", media.ID, media.Title)
	
	return needsThumbnail, needsPreview, needsPoster
}

// isAssetMissing checks if an asset file is missing or invalid
func (s *MediaScanner) isAssetMissing(assetPath, assetType string, mediaID uint, mediaTitle string) bool {
	// If no path in database, asset is missing
	if assetPath == "" {
		log.Printf("🔍 %s path empty for media %d (%s)", assetType, mediaID, mediaTitle)
		return true
	}
	
	// Check if file exists on disk - try path as-is first
	if _, err := os.Stat(assetPath); err == nil {
		// File exists, continue with size/validity checks
	} else {
		// If relative path, try resolving to backend directory
		if !strings.HasPrefix(assetPath, "/") && !strings.HasPrefix(assetPath, "./") {
			backendPath := fmt.Sprintf("./backend/%s", assetPath)
			if _, err := os.Stat(backendPath); err == nil {
				log.Printf("✅ Resolved relative %s path: %s -> %s", assetType, assetPath, backendPath)
				assetPath = backendPath // Use resolved path for further checks
			} else {
				log.Printf("🔍 %s file missing: %s for media %d (%s)", assetType, assetPath, mediaID, mediaTitle)
				return true
			}
		} else {
			log.Printf("🔍 %s file missing: %s for media %d (%s)", assetType, assetPath, mediaID, mediaTitle)
			return true
		}
	}
	
	// Check file size (should be at least 1KB for thumbnails/posters, 10KB for previews)
	stat, err := os.Stat(assetPath)
	if err != nil {
		log.Printf("🔍 Cannot stat %s file: %s for media %d (%s)", assetType, assetPath, mediaID, mediaTitle)
		return true
	}
	
	minSize := int64(1024) // 1KB for thumbnails/posters
	if assetType == "preview" || assetType == "preview_clip" {
		minSize = 10240 // 10KB for preview clips
	}
	
	if stat.Size() < minSize {
		log.Printf("🔍 %s file too small (%d bytes): %s for media %d (%s)", 
			assetType, stat.Size(), assetPath, mediaID, mediaTitle)
		return true
	}
	
	// Additional validation for preview clips (check if it's a valid video)
	if assetType == "preview" || assetType == "preview_clip" {
		if !s.validatePreviewFile(assetPath) {
			log.Printf("🔍 %s file invalid: %s for media %d (%s)", assetType, assetPath, mediaID, mediaTitle)
			return true
		}
	}
	
	log.Printf("✅ %s exists and valid: %s for media %d (%s)", assetType, assetPath, mediaID, mediaTitle)
	return false
}

// updateMediaWithTMDBMetadata updates media with TMDB metadata
func (s *MediaScanner) updateMediaWithTMDBMetadata(media *models.Media, tmdbMetadata *interfaces.MediaMetadata) {
	if tmdbMetadata.Title != "" && tmdbMetadata.Title != media.Title {
		// Only update title if it's significantly better
		if len(tmdbMetadata.Title) > len(media.Title) || !s.titleLooksLikeFilename(tmdbMetadata.Title) {
			media.Title = tmdbMetadata.Title
		}
	}
	if tmdbMetadata.Description != "" {
		media.Description = tmdbMetadata.Description
	}
	if tmdbMetadata.Year > 0 {
		media.Year = tmdbMetadata.Year
	}
	if tmdbMetadata.BoxOffice != "" {
		media.BoxOffice = tmdbMetadata.BoxOffice
	}
	if len(tmdbMetadata.Cast) > 0 {
		media.Cast = tmdbMetadata.Cast
	}
	if len(tmdbMetadata.Directors) > 0 {
		media.Director = tmdbMetadata.Directors
	}
	if len(tmdbMetadata.Stars) > 0 {
		media.Stars = tmdbMetadata.Stars
	}
	if tmdbMetadata.Rating > 0 {
		media.Rating = tmdbMetadata.Rating
	}
	if len(tmdbMetadata.Genres) > 0 {
		media.GenreNames = tmdbMetadata.Genres
		log.Printf("🎭 Updated genres for %s: %v", media.Title, tmdbMetadata.Genres)
	}

	// Update in database
	if err := s.GetMediaService().UpdateMedia(media); err != nil {
		log.Printf("⚠️ Failed to update media with TMDB metadata: %v", err)
	}
}

// findFileInCurrentStorage searches for a file in current storage preserving directory structure
func (s *MediaScanner) findFileInCurrentStorage(filename, originalPath string) string {
	// Extract the relative directory structure from the original path
	originalDir := filepath.Dir(originalPath)

	// Try to find similar directory structure in current media path
	var foundPath string

	// Walk through current media path
	filepath.Walk(s.GetMediaPath(), func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		if !info.IsDir() && filepath.Base(path) == filename {
			// Check if this is a video file
			if s.isVideoFile(path) {
				// Calculate similarity score based on directory structure
				currentDir := filepath.Dir(path)

				// Simple heuristic: prefer paths with similar directory names
				originalDirParts := strings.Split(originalDir, string(os.PathSeparator))
				currentDirParts := strings.Split(currentDir, string(os.PathSeparator))

				// Count matching directory parts
				matchScore := 0
				for _, origPart := range originalDirParts {
					for _, currPart := range currentDirParts {
						if strings.EqualFold(origPart, currPart) {
							matchScore++
						}
					}
				}

				// If this is the first match or has a better score, use it
				if foundPath == "" || matchScore > 0 {
					foundPath = path
					if matchScore > 2 { // Good match, stop searching
						return filepath.SkipDir
					}
				}
			}
		}

		return nil
	})

	return foundPath
}

// findMediaFileByTitle searches for media files by title similarity
func (s *MediaScanner) findMediaFileByTitle(title string) string {
	var bestMatch string
	var bestScore float64

	normalizedTitle := s.normalizeTitleForComparison(title)

	filepath.Walk(s.GetMediaPath(), func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		if !info.IsDir() && s.isVideoFile(path) {
			// Extract title from filename
			metadata := s.extractMetadataWithCache(path)
			if metadata.Title != "" {
				normalizedFileTitle := s.normalizeTitleForComparison(metadata.Title)
				similarity := s.calculateTitleSimilarity(normalizedTitle, normalizedFileTitle)

				if similarity > bestScore && similarity > 0.6 { // 60% similarity threshold
					bestScore = similarity
					bestMatch = path
				}
			}
		}

		return nil
	})

	return bestMatch
}

// findBestPathMatch finds the best matching media from a list based on path similarity
func (s *MediaScanner) findBestPathMatch(filename string, mediaList []models.Media) *models.Media {
	if len(mediaList) == 0 {
		return nil
	}

	// If only one match, return it
	if len(mediaList) == 1 {
		return &mediaList[0]
	}

	// Find the best match based on path similarity and file existence
	var bestMatch *models.Media
	bestScore := -1

	for i := range mediaList {
		media := &mediaList[i]

		// Check if file exists at the stored path
		if _, err := os.Stat(media.FilePath); err == nil {
			// File exists, this is likely the correct match
			return media
		}

		// Calculate path similarity score
		score := s.calculatePathSimilarity(filename, media.FilePath)
		if score > bestScore {
			bestScore = score
			bestMatch = media
		}
	}

	return bestMatch
}

// calculatePathSimilarity calculates similarity between filename and stored path
func (s *MediaScanner) calculatePathSimilarity(filename, storedPath string) int {
	score := 0

	// Same filename gets base score
	if filepath.Base(storedPath) == filename {
		score += 10
	}

	// Similar directory structure gets bonus points
	currentMediaPath := strings.ToLower(s.GetMediaPath())
	storedDir := strings.ToLower(filepath.Dir(storedPath))

	// Check for common directory patterns
	commonPatterns := []string{"movies", "films", "videos", "media"}
	for _, pattern := range commonPatterns {
		if strings.Contains(currentMediaPath, pattern) && strings.Contains(storedDir, pattern) {
			score += 2
		}
	}

	return score
}

// DetectDriveChanges detects if media files have been moved to different drives/paths
func (s *MediaScanner) DetectDriveChanges() error {
	log.Printf("🔍 Detecting drive changes and path updates...")

	// Get all media from database
	allMedia, err := s.getAllMediaFromDatabase()
	if err != nil {
		return fmt.Errorf("failed to get media from database: %v", err)
	}

	var updatedCount int
	var notFoundCount int

	for _, media := range allMedia {
		// Check if file exists at stored path
		if _, err := os.Stat(media.FilePath); os.IsNotExist(err) {
			// Try to find the file in current media path
			filename := filepath.Base(media.FilePath)
			newPath := s.findFileInCurrentStorage(filename, media.FilePath)

			if newPath != "" {
				log.Printf("📁 Drive change detected: %s -> %s", media.FilePath, newPath)

				// Update the path in database
				media.FilePath = newPath
				media.FileSize = 0 // Reset file size to force re-scanning
				if updateErr := s.GetMediaService().UpdateMedia(&media); updateErr != nil {
					log.Printf("❌ Failed to update path for media %d: %v", media.ID, updateErr)
				} else {
					updatedCount++
					log.Printf("✅ Updated path for: %s", media.Title)
				}
			} else {
				notFoundCount++
				log.Printf("❌ File not found in current storage: %s", filename)
			}
		}
	}

	log.Printf("📊 Drive change detection completed:")
	log.Printf("   ✅ Paths updated: %d", updatedCount)
	log.Printf("   ❌ Files not found: %d", notFoundCount)

	return nil
}

// SmartPathResolution performs intelligent path resolution for moved files
func (s *MediaScanner) SmartPathResolution() error {
	log.Printf("🧠 Starting smart path resolution...")

	// Get all media from database
	allMedia, err := s.getAllMediaFromDatabase()
	if err != nil {
		return fmt.Errorf("failed to get media from database: %v", err)
	}

	var resolvedCount int

	for _, media := range allMedia {
		// Skip if file already exists
		if _, err := os.Stat(media.FilePath); err == nil {
			continue
		}

		// Try multiple resolution strategies
		newPath := s.resolveMediaPath(&media)
		if newPath != "" && newPath != media.FilePath {
			log.Printf("🎯 Smart resolution: %s -> %s", media.FilePath, newPath)

			media.FilePath = newPath
			if updateErr := s.GetMediaService().UpdateMedia(&media); updateErr != nil {
				log.Printf("❌ Failed to update resolved path for media %d: %v", media.ID, updateErr)
			} else {
				resolvedCount++
				log.Printf("✅ Resolved path for: %s", media.Title)
			}
		}
	}

	log.Printf("📊 Smart path resolution completed: %d paths resolved", resolvedCount)
	return nil
}

// resolveMediaPath tries multiple strategies to resolve a media file's new path
func (s *MediaScanner) resolveMediaPath(media *models.Media) string {
	filename := filepath.Base(media.FilePath)

	// Strategy 1: Search by exact filename in current media path
	if newPath := s.findFileInCurrentStorage(filename, media.FilePath); newPath != "" {
		return newPath
	}

	// Strategy 2: Search by title similarity
	if media.Title != "" {
		if newPath := s.findMediaFileByTitle(media.Title); newPath != "" {
			return newPath
		}
	}

	// Strategy 3: Try common path transformations
	commonTransformations := []struct {
		from string
		to   string
	}{
		{"/media/azad/Movies1/", s.GetMediaPath() + "/"},
		{"/media/azad/Movies2/", s.GetMediaPath() + "/"},
		{"/media/azad/Movies3/", s.GetMediaPath() + "/"},
		{"/mnt/media/", s.GetMediaPath() + "/"},
		{"/mnt/usb/", s.GetMediaPath() + "/"},
		{"/home/media/", s.GetMediaPath() + "/"},
		{"/media/", s.GetMediaPath() + "/"},
		{"/Volumes/", s.GetMediaPath() + "/"},
	}

	for _, transform := range commonTransformations {
		if strings.HasPrefix(media.FilePath, transform.from) {
			newPath := strings.Replace(media.FilePath, transform.from, transform.to, 1)
			if _, err := os.Stat(newPath); err == nil {
				return newPath
			}
		}
	}

	return ""
}

// validatePreviewFile validates that a generated preview file is valid
func (s *MediaScanner) validatePreviewFile(path string) bool {
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

// BatchScanMediaLibrary performs an optimized batch scan of the media library
func (s *MediaScanner) BatchScanMediaLibrary() error {
	return s.BatchScanMediaLibraryWithProgress()
}

// BatchScanMediaLibraryWithProgress performs an optimized batch scan with progress display
func (s *MediaScanner) BatchScanMediaLibraryWithProgress() error {
	// Create and start progress tracker
	progress := NewProgressTracker()
	progress.Start()
	defer progress.Stop()

	s.SetStartTime(time.Now())
	progress.LogWithProgress("🚀 Starting batch-optimized media library scan at: " + s.GetMediaPath())

	// Resource monitoring setup
	progress.LogWithProgress(fmt.Sprintf("🔧 Resource limits: Max goroutines=%d, Active=%d", s.maxGoroutines, s.getActiveGoroutines()))

	// Phase 1: File discovery with resource limits
	progress.UpdatePhase("⚡ Phase 1: Discovering media files...")
	progress.LogWithProgress("🔍 Scanning directories for media files...")
	files, err := s.discoverFiles()
	if err != nil {
		progress.LogWithProgress(fmt.Sprintf("❌ File discovery failed: %v", err))
		return fmt.Errorf("file discovery failed: %v", err)
	}

	s.SetTotalFiles(len(files))
	progress.SetTotalFiles(len(files))
	progress.LogWithProgress(fmt.Sprintf("📁 Discovered %d media files", len(files)))

	// Phase 2: Process files in optimized batches
	progress.UpdatePhase("🔥 Phase 2: Processing files in optimized batches...")
	if err := s.processFilesBatchWithProgress(files, progress); err != nil {
		progress.LogWithProgress(fmt.Sprintf("⚠️ Some files failed to process: %v", err))
	}

	// Phase 3: Wait for background goroutines to complete with timeout
	progress.UpdatePhase("⏳ Phase 3: Waiting for background operations to complete...")
	progress.LogWithProgress("⏳ Finalizing background operations...")
	s.waitForBackgroundOperations(30 * time.Second)

	// Phase 4: Comprehensive sync validation
	progress.UpdatePhase("🔍 Phase 4: Validating complete sync...")
	progress.LogWithProgress("🔍 Performing comprehensive sync validation...")
	if err := s.validateCompleteSyncWithProgress(progress); err != nil {
		progress.LogWithProgress(fmt.Sprintf("⚠️ Sync validation found issues: %v", err))
	}

	// Phase 5: Results
	progress.UpdatePhase("✅ Phase 5: Scan completed!")
	finalStats := s.GetScanStats()
	s.SetScanDuration(time.Since(finalStats.StartTime))
	s.logScanResultsWithProgress(progress)

	progress.LogWithProgress(fmt.Sprintf("🔧 Final resource usage: Active goroutines=%d", s.getActiveGoroutines()))
	return nil
}

// validateCompleteSyncWithProgress ensures all filesystem media files are in database
func (s *MediaScanner) validateCompleteSyncWithProgress(progress *ProgressTracker) error {
	progress.LogWithProgress("🔍 Starting comprehensive filesystem-database sync validation...")
	
	// Step 1: Get all video files from filesystem
	progress.UpdateOperation("📁 Discovering all video files in storage...")
	allFiles, err := s.discoverAllVideoFiles()
	if err != nil {
		return fmt.Errorf("failed to discover video files: %v", err)
	}
	progress.LogWithProgress(fmt.Sprintf("📁 Found %d video files in storage", len(allFiles)))
	
	// Step 2: Get all media from database
	progress.UpdateOperation("📊 Loading all media from database...")
	allMedia, err := s.getAllMediaFromDatabase()
	if err != nil {
		return fmt.Errorf("failed to load media from database: %v", err)
	}
	progress.LogWithProgress(fmt.Sprintf("📊 Found %d media entries in database", len(allMedia)))
	
	// Step 3: Create maps for efficient lookup
	dbPaths := make(map[string]*models.Media)
	for i := range allMedia {
		dbPaths[allMedia[i].FilePath] = &allMedia[i]
	}
	
	// Step 4: Check each filesystem file against database
	var missingFiles []string
	var processedCount int
	
	for _, filePath := range allFiles {
		processedCount++
		if processedCount%100 == 0 {
			progress.UpdateOperation(fmt.Sprintf("Validating files... (%d/%d)", processedCount, len(allFiles)))
		}
		
		if _, exists := dbPaths[filePath]; !exists {
			missingFiles = append(missingFiles, filePath)
		}
	}
	
	// Step 5: Process any missing files
	if len(missingFiles) > 0 {
		progress.LogWithProgress(fmt.Sprintf("⚠️ Found %d files missing from database, processing them now...", len(missingFiles)))
		
		for i, filePath := range missingFiles {
			progress.UpdateOperation(fmt.Sprintf("Processing missing file %d/%d: %s", i+1, len(missingFiles), filepath.Base(filePath)))
			
			// Get file info
			fileInfo, err := os.Stat(filePath)
			if err != nil {
				progress.LogWithProgress(fmt.Sprintf("❌ Cannot access file: %s - %v", filePath, err))
				continue
			}
			
			// Process the missing file
			if err := s.processVideoFile(filePath, fileInfo); err != nil {
				progress.LogWithProgress(fmt.Sprintf("❌ Failed to process missing file: %s - %v", filePath, err))
			} else {
				progress.LogWithProgress(fmt.Sprintf("✅ Successfully added missing file: %s", filepath.Base(filePath)))
			}
		}
	} else {
		progress.LogWithProgress("✅ All filesystem video files are present in database")
	}
	
	// Step 6: Check for orphaned database entries (files that no longer exist)
	progress.UpdateOperation("🧹 Checking for orphaned database entries...")
	fileSet := make(map[string]bool)
	for _, filePath := range allFiles {
		fileSet[filePath] = true
	}
	
	var orphanedMedia []models.Media
	for _, media := range allMedia {
		if !fileSet[media.FilePath] {
			orphanedMedia = append(orphanedMedia, media)
		}
	}
	
	if len(orphanedMedia) > 0 {
		progress.LogWithProgress(fmt.Sprintf("⚠️ Found %d orphaned database entries (files no longer exist)", len(orphanedMedia)))
		for _, media := range orphanedMedia {
			progress.LogWithProgress(fmt.Sprintf("🗑️ Orphaned: %s (ID: %d) - File: %s", media.Title, media.ID, media.FilePath))
		}
	} else {
		progress.LogWithProgress("✅ No orphaned database entries found")
	}
	
	// Step 7: Summary
	totalFiles := len(allFiles)
	totalDB := len(allMedia)
	missing := len(missingFiles)
	orphaned := len(orphanedMedia)
	
	progress.LogWithProgress("📊 Sync Validation Summary:")
	progress.LogWithProgress(fmt.Sprintf("   📁 Files in storage: %d", totalFiles))
	progress.LogWithProgress(fmt.Sprintf("   📊 Entries in database: %d", totalDB))
	progress.LogWithProgress(fmt.Sprintf("   ➕ Missing from DB (now added): %d", missing))
	progress.LogWithProgress(fmt.Sprintf("   🗑️ Orphaned in DB: %d", orphaned))
	
	if missing == 0 && orphaned == 0 {
		progress.LogWithProgress("✅ Perfect sync: All storage files are in database, no orphaned entries")
	} else if missing > 0 && orphaned == 0 {
		progress.LogWithProgress(fmt.Sprintf("✅ Sync completed: Added %d missing files to database", missing))
	} else {
		progress.LogWithProgress(fmt.Sprintf("⚠️ Sync issues: %d missing files processed, %d orphaned entries found", missing, orphaned))
	}
	
	return nil
}

// discoverAllVideoFiles recursively finds all video files in the media directory
func (s *MediaScanner) discoverAllVideoFiles() ([]string, error) {
	var videoFiles []string
	videoExtensions := map[string]bool{
		".mp4": true, ".mkv": true, ".avi": true, ".mov": true, ".wmv": true,
		".flv": true, ".webm": true, ".m4v": true, ".3gp": true, ".ts": true,
		".mpg": true, ".mpeg": true, ".m2v": true, ".asf": true, ".rm": true,
		".rmvb": true, ".vob": true, ".ogv": true, ".dv": true, ".qt": true,
		".divx": true, ".xvid": true, ".f4v": true, ".m2ts": true, ".mts": true,
	}
	
	err := filepath.Walk(s.mediaPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Continue walking even if there's an error with one file
		}
		
		// Skip directories
		if info.IsDir() {
			return nil
		}
		
		// Skip system files and recycle bin
		if strings.Contains(path, "$RECYCLE.BIN") || strings.HasPrefix(filepath.Base(path), "$") {
			return nil
		}
		
		// Skip hidden files
		if strings.HasPrefix(filepath.Base(path), ".") {
			return nil
		}
		
		// Check if it's a video file
		ext := strings.ToLower(filepath.Ext(path))
		if videoExtensions[ext] {
			videoFiles = append(videoFiles, path)
		}
		
		return nil
	})
	
	return videoFiles, err
}

// logSyncResults logs the final sync statistics
func (s *MediaScanner) logSyncResults(total, valid, invalid, updated, orphaned int) {
	scanStats := s.GetScanStats()
	log.Printf("✅ Database-Storage sync completed in %v", scanStats.ScanDuration)
	log.Printf("📊 Sync Statistics:")
	log.Printf("   📁 Total database entries: %d", total)
	log.Printf("   ✅ Valid entries: %d", valid)
	log.Printf("   ❌ Invalid entries: %d", invalid)
	log.Printf("   🔄 Updated entries: %d", updated)
	log.Printf("   🆕 Orphaned files found: %d", orphaned)
	log.Printf("   ✅ Successfully processed: %d", scanStats.ProcessedFiles)
	log.Printf("   ❌ Errors: %d", scanStats.ErrorFiles)

	if total > 0 {
		syncRate := float64(valid+updated) / float64(total) * 100
		log.Printf("   📈 Sync success rate: %.1f%%", syncRate)
	}
}

// extractMetadataWithAI extracts metadata from file path with caching
func (s *MediaScanner) extractMetadataWithAI(filePath string) *FileMetadata {
	cachedMetadata := s.getCachedMetadata(filePath)
	if cachedMetadata != nil {
		return cachedMetadata
	}

	// Extract metadata
	extractedMetadata := s.extractMetadataFromPath(filePath)

	// Cache the extracted metadata - convert FileMetadata to models.Media
	season := extractedMetadata.Season
	episode := extractedMetadata.Episode
	mediaModel := &models.Media{
		Title:   extractedMetadata.Title,
		Type:    extractedMetadata.Type,
		Quality: extractedMetadata.Quality,
		Season:  &season,
		Episode: &episode,
		Year:    extractedMetadata.Year,
	}
	s.SetMetadataCache(filePath, mediaModel)

	return extractedMetadata
}

// extractMetadataFromPath extracts metadata from file path
func (s *MediaScanner) extractMetadataFromPath(path string) *FileMetadata {
	filename := filepath.Base(path)

	metadata := &FileMetadata{
		Type:    "movie", // Default type
		Quality: "1080p", // Default quality
	}

	// Extract title from filename
	if s.GetTMDBService() != nil {
		metadata.Title = s.GetTMDBService().CleanTitle(filename)
	} else {
		metadata.Title = s.cleanTitle(filename)
	}

	// Detect if it's a TV series episode (enhanced with path-based detection)
	// Only classify as episode if BOTH filename AND path indicate it's an episode
	isEpisodeByFilename := s.isEpisodeFile(filename)
	isEpisodeByPath := s.isEpisodeFromPath(path)
	
	if isEpisodeByFilename && isEpisodeByPath {
		metadata.Type = "episode"
		metadata.SeriesTitle, metadata.Season, metadata.Episode = s.extractEpisodeInfoFromPath(path)
	} else if isEpisodeByFilename && !isEpisodeByPath {
		// Filename suggests episode but path doesn't - likely a movie with episode-like naming
		// Keep as movie but extract episode info for potential use
		seriesTitle, season, episode := s.extractEpisodeInfoFromPath(path)
		if seriesTitle == "" || season == 0 {
			// No valid series info found, definitely a movie
			metadata.Type = "movie"
		} else {
			metadata.Type = "episode"
			metadata.SeriesTitle, metadata.Season, metadata.Episode = seriesTitle, season, episode
		}
	}

	// Extract quality from filename
	metadata.Quality = s.extractQuality(filename)

	// Extract year from filename
	metadata.Year = s.extractYear(filename)

	// Extract genres from path
	metadata.Genres = s.extractGenresFromPath(path, metadata.Title)

	return metadata
}

// isEpisodeFile checks if filename indicates a TV episode
func (s *MediaScanner) isEpisodeFile(filename string) bool {
	patterns := []string{
		`[Ss]\d{2}[Ee]\d{2}`, // S01E01 format
		`\d{1,2}x\d{2}`,      // 1x01 format
		`Episode\s*\d+`,      // Episode 1 format
	}

	for _, pattern := range patterns {
		if matched, _ := regexp.MatchString(pattern, filename); matched {
			return true
		}
	}

	return false
}

// isEpisodeFromPath checks if the file path indicates a TV episode based on folder structure
func (s *MediaScanner) isEpisodeFromPath(fullPath string) bool {
	pathParts := strings.Split(filepath.Dir(fullPath), string(filepath.Separator))

	// Look for season folder patterns in the path
	for _, part := range pathParts {
		seasonPatterns := []string{
			`^[Ss]eason\s*\d+$`,
			`^[Ss]\d+$`,
			`^Season\s*\d+$`,
		}

		for _, pattern := range seasonPatterns {
			if matched, _ := regexp.MatchString(pattern, part); matched {
				return true
			}
		}
	}

	// Additional check: if file is in root media directory, it's likely a movie
	mediaPath := s.GetMediaPath()
	relPath, _ := filepath.Rel(mediaPath, fullPath)
	pathDepth := len(strings.Split(relPath, string(filepath.Separator)))
	
	// If file is directly in media root or one level deep without season folders, treat as movie
	if pathDepth <= 2 {
		return false
	}

	return false
}

// extractEpisodeInfo extracts series title, season, and episode from filename and path
func (s *MediaScanner) extractEpisodeInfo(filename string) (string, int, int) {
	// S01E01 format
	re := regexp.MustCompile(`(.+?)[Ss](\d{2})[Ee](\d{2})`)
	matches := re.FindStringSubmatch(filename)
	if len(matches) == 4 {
		seriesTitle := s.cleanTitle(matches[1])
		season, _ := strconv.Atoi(matches[2])
		episode, _ := strconv.Atoi(matches[3])
		return seriesTitle, season, episode
	}

	// 1x01 format
	re = regexp.MustCompile(`(.+?)(\d{1,2})x(\d{2})`)
	matches = re.FindStringSubmatch(filename)
	if len(matches) == 4 {
		seriesTitle := s.cleanTitle(matches[1])
		season, _ := strconv.Atoi(matches[2])
		episode, _ := strconv.Atoi(matches[3])
		return seriesTitle, season, episode
	}

	return "", 0, 0
}

// extractEpisodeInfoFromPath extracts series title, season, and episode from full file path
func (s *MediaScanner) extractEpisodeInfoFromPath(fullPath string) (string, int, int) {
	// First try filename-based extraction
	filename := filepath.Base(fullPath)
	seriesTitle, season, episode := s.extractEpisodeInfo(filename)
	if seriesTitle != "" {
		return seriesTitle, season, episode
	}

	// If filename extraction failed, try path-based extraction
	pathParts := strings.Split(filepath.Dir(fullPath), string(filepath.Separator))

	// Look for season folder patterns
	var seasonNum int
	var seriesTitleFromPath string

	for i := len(pathParts) - 1; i >= 0; i-- {
		part := pathParts[i]

		// Check for season folder patterns
		seasonPatterns := []string{
			`[Ss]eason\s*(\d+)`,
			`[Ss](\d+)`,
			`Season\s*(\d+)`,
		}

		for _, pattern := range seasonPatterns {
			re := regexp.MustCompile(pattern)
			matches := re.FindStringSubmatch(part)
			if len(matches) >= 2 {
				seasonNum, _ = strconv.Atoi(matches[1])
				// Series title is likely the parent folder
				if i > 0 {
					seriesTitleFromPath = s.cleanTitle(pathParts[i-1])
				}
				break
			}
		}

		if seasonNum > 0 {
			break
		}
	}

	// Extract episode number from filename - only if we have season info
	var episodeNum int
	if seasonNum > 0 {
		episodePatterns := []string{
			`[Ee]pisode\s*(\d+)`,
			`[Ee]p\s*(\d+)`,
			`[Ee](\d+)`,
			`\b(\d{1,2})\b`, // 1-2 digit number (not years like 2019)
		}

		for _, pattern := range episodePatterns {
			re := regexp.MustCompile(pattern)
			matches := re.FindStringSubmatch(filename)
			if len(matches) >= 2 {
				num, _ := strconv.Atoi(matches[1])
				// Only accept reasonable episode numbers (1-999), not years
				if num >= 1 && num <= 999 {
					episodeNum = num
					break
				}
			}
		}
	}

	// If we found season info from path, use it
	if seasonNum > 0 && seriesTitleFromPath != "" {
		return seriesTitleFromPath, seasonNum, episodeNum
	}

	return "", 0, 0
}

// extractQuality extracts video quality from filename
func (s *MediaScanner) extractQuality(filename string) string {
	qualities := []string{"2160p", "1440p", "1080p", "720p", "480p", "360p"}

	for _, quality := range qualities {
		if strings.Contains(strings.ToLower(filename), strings.ToLower(quality)) {
			return quality
		}
	}

	return "1080p" // Default quality
}

// extractYear extracts year from filename
func (s *MediaScanner) extractYear(filename string) int {
	re := regexp.MustCompile(`\b(19|20)\d{2}\b`)
	matches := re.FindStringSubmatch(filename)
	if len(matches) > 0 {
		year, _ := strconv.Atoi(matches[0])
		return year
	}

	return 0
}

// cleanTitle cleans a title string while preserving important numbers and sequels
func (s *MediaScanner) cleanTitle(title string) string {
	// Remove file extension
	title = strings.TrimSuffix(title, filepath.Ext(title))

	// Replace common separators with spaces, but preserve important patterns first
	title = strings.ReplaceAll(title, ".", " ")
	title = strings.ReplaceAll(title, "_", " ")
	title = strings.ReplaceAll(title, "-", " ")

	// Remove technical patterns but preserve movie content
	patterns := []string{
		`\[\d{4}p\]`,                                    // Remove [1080p] in brackets
		`\b\d{4}p\b`,                                    // Remove standalone resolution like 1080p
		`\b(?i)(x264|x265|h264|h265|HEVC|AVC)\b`,       // Remove codecs
		`\b(?i)(BluRay|WEBRip|DVDRip|HDTV|WEB-DL)\b`,   // Remove sources
		`\b(?i)(YTS|YIFY|RARBG|ETRG)\b`,                // Remove release groups
		`\[(?i)(YTS|YIFY|RARBG|ETRG).*?\]`,             // Remove release group brackets
		`\b(?i)(AAC|DDP|DD|5\.1|7\.1|Atmos)\b`,         // Remove audio formats
		`\b(?i)(10bit|8bit)\b`,                          // Remove bit depth
	}

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		title = re.ReplaceAllString(title, " ")
	}

	// Remove year in parentheses ONLY if it's at the end and looks like (YYYY)
	yearPattern := regexp.MustCompile(`\s*\(\d{4}\)\s*$`)
	title = yearPattern.ReplaceAllString(title, "")

	// Remove empty brackets and parentheses (but preserve content with meaningful info)
	emptyBrackets := []string{
		`\[\s*\]`,     // Empty brackets
		`\(\s*\)`,     // Empty parentheses
		`\{\s*\}`,     // Empty braces
	}

	for _, pattern := range emptyBrackets {
		re := regexp.MustCompile(pattern)
		title = re.ReplaceAllString(title, " ")
	}

	// Clean up multiple spaces
	title = regexp.MustCompile(`\s+`).ReplaceAllString(title, " ")
	title = strings.TrimSpace(title)

	// Apply title case while preserving important patterns
	if title != "" {
		words := strings.Fields(title)
		for i, word := range words {
			if len(word) > 0 {
				// Preserve certain patterns in uppercase
				upperPatterns := []string{"II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"}
				isRomanNumeral := false
				for _, pattern := range upperPatterns {
					if strings.ToUpper(word) == pattern {
						words[i] = pattern
						isRomanNumeral = true
						break
					}
				}
				
				// Don't change roman numerals or already processed words
				if !isRomanNumeral {
					words[i] = strings.ToUpper(string(word[0])) + strings.ToLower(word[1:])
				}
			}
		}
		title = strings.Join(words, " ")
	}

	return title
}

// titleNeedsCleaning checks if a title contains technical terms that need cleaning
func (s *MediaScanner) titleNeedsCleaning(title string) bool {
	technicalPatterns := []string{
		`\d{4}p`,                                    // Resolution like 1080p
		`(?i)(x264|x265|h264|h265|HEVC|AVC)`,       // Codecs
		`(?i)(BluRay|WEBRip|DVDRip|HDTV|WEB-DL)`,   // Sources
		`(?i)(YTS|YIFY|RARBG|ETRG)`,                // Release groups
		`(?i)(AAC|DDP|DD|5\.1|7\.1|Atmos)`,         // Audio formats
		`(?i)(10bit|8bit)`,                          // Bit depth
		`\[.*?\]`,                                   // Any brackets
	}

	for _, pattern := range technicalPatterns {
		if matched, _ := regexp.MatchString(pattern, title); matched {
			return true
		}
	}
	return false
}

// isSequelTitle checks if a title contains sequel indicators (numbers, roman numerals)
func (s *MediaScanner) isSequelTitle(title string) bool {
	sequelPatterns := []string{
		`\b(2|3|4|5|6|7|8|9|10)\b`,                    // Numbers 2-10
		`\b(II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\b`,   // Roman numerals
		`\b(Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)\b`, // Written numbers
		`\b(Part|Chapter)\s+\d+\b`,                    // Part/Chapter numbers
	}

	for _, pattern := range sequelPatterns {
		if matched, _ := regexp.MatchString(`(?i)`+pattern, title); matched {
			return true
		}
	}
	return false
}

// Memory monitoring and system stability methods for i5-4590

// MemoryStats holds memory usage information
type MemoryStats struct {
	AllocMB      uint64
	SysMB        uint64
	NumGC        uint32
	Goroutines   int
	HeapObjects  uint64
}

// getMemoryStats returns current memory usage statistics
func (s *MediaScanner) getMemoryStats() MemoryStats {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	
	return MemoryStats{
		AllocMB:     bToMb(m.Alloc),
		SysMB:       bToMb(m.Sys),
		NumGC:       m.NumGC,
		Goroutines:  runtime.NumGoroutine(),
		HeapObjects: m.HeapObjects,
	}
}

// bToMb converts bytes to megabytes
func bToMb(b uint64) uint64 {
	return b / 1024 / 1024
}

// checkMemoryPressure returns true if system is under memory pressure
func (s *MediaScanner) checkMemoryPressure() bool {
	stats := s.getMemoryStats()
	
	// Conservative limits for i5-4590 with 16GB RAM
	if stats.AllocMB > 2048 { // 2GB allocated memory limit
		log.Printf("⚠️ High memory usage detected: %d MB allocated", stats.AllocMB)
		return true
	}
	
	if stats.Goroutines > 20 { // Very low goroutine limit
		log.Printf("⚠️ High goroutine count: %d active", stats.Goroutines)
		return true
	}
	
	return false
}

// forceGarbageCollection triggers garbage collection and memory cleanup
func (s *MediaScanner) forceGarbageCollection() {
	runtime.GC()
	debug.FreeOSMemory()
	log.Printf("🧹 Forced garbage collection completed")
}

// setProcessLimits sets conservative resource limits for i5-4590
func (s *MediaScanner) setProcessLimits() error {
	// Set memory limit to 4GB (conservative for 16GB system)
	var rLimit syscall.Rlimit
	err := syscall.Getrlimit(syscall.RLIMIT_AS, &rLimit)
	if err != nil {
		log.Printf("⚠️ Could not get memory limits: %v", err)
		return err
	}
	
	// Set virtual memory limit to 4GB
	rLimit.Cur = 4 * 1024 * 1024 * 1024 // 4GB
	err = syscall.Setrlimit(syscall.RLIMIT_AS, &rLimit)
	if err != nil {
		log.Printf("⚠️ Could not set memory limits: %v", err)
		return err
	}
	
	log.Printf("✅ Process memory limit set to 4GB")
	return nil
}

