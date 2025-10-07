package scanner

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"homeflix-backend/internal/interfaces"
	"homeflix-backend/internal/models"
	"homeflix-backend/internal/scanner/core"
	"homeflix-backend/internal/scanner/processing"
	storageSync "homeflix-backend/internal/scanner/sync"

	"github.com/h2non/filetype"
)

type MediaScanner struct {
	*core.MediaScanner
	
	// Specialized processors
	assetProcessor *processing.AssetProcessor
	storageSync    *storageSync.StorageSync
}

type ScanStats struct {
	TotalFiles       int
	ProcessedFiles   int
	SkippedFiles     int
	ErrorFiles       int
	NewFiles         int
	UpdatedFiles     int
	ScanDuration     time.Duration
	StartTime        time.Time
}

type FileInfo struct {
	Path     string
	Info     os.FileInfo
	IsVideo  bool
	IsSubtitle bool
}



// convertToCore converts main scanner FileInfo to core FileInfo
func (f FileInfo) convertToCore() core.FileInfo {
	return core.FileInfo{
		Path:       f.Path,
		Info:       f.Info,
		IsVideo:    f.IsVideo,
		IsSubtitle: f.IsSubtitle,
	}
}

func NewMediaScanner(mediaService interfaces.MediaServiceInterface, thumbnailService interfaces.ThumbnailServiceInterface, posterService interfaces.PosterServiceInterface, geminiService interfaces.GeminiServiceInterface, celeryService interfaces.CeleryServiceInterface, alacService interfaces.ALACAudioServiceInterface, tmdbService interfaces.TMDBServiceInterface, recommendationService interfaces.RecommendationServiceInterface, mediaPath string) *MediaScanner {
	// Create core scanner
	coreScanner := core.NewMediaScanner(mediaService, thumbnailService, posterService, geminiService, celeryService, alacService, tmdbService, recommendationService, mediaPath)
	
	// Create main scanner with specialized processors
	scanner := &MediaScanner{
		MediaScanner: coreScanner,
	}
	
	// Initialize specialized processors
	scanner.assetProcessor = processing.NewAssetProcessor(coreScanner)
	scanner.storageSync = storageSync.NewStorageSync(coreScanner)
	
	return scanner
}

// ScanAndSyncMediaLibrary performs a comprehensive scan and sync of the media library
// This is the recommended method that ensures database-storage consistency
func (s *MediaScanner) ScanAndSyncMediaLibrary() error {
	log.Printf("🚀 Starting comprehensive media library scan and sync...")
	
	// Phase 1: Sync existing database entries with storage
	log.Printf("🔄 Phase 1: Syncing database with storage...")
	if err := s.SyncDatabaseWithStorage(); err != nil {
		log.Printf("⚠️ Warning: Database sync encountered issues: %v", err)
		// Continue with regular scan even if sync has issues
	}
	
	// Phase 2: Regular media library scan for any remaining files
	log.Printf("📂 Phase 2: Regular media library scan...")
	if err := s.ScanMediaLibrary(); err != nil {
		return fmt.Errorf("media library scan failed: %v", err)
	}
	
	log.Printf("✅ Comprehensive scan and sync completed successfully!")
	return nil
}



// CleanupInvalidEntries removes database entries for media files that no longer exist
func (s *MediaScanner) CleanupInvalidEntries() error {
	log.Printf("🧹 Starting cleanup of invalid database entries...")
	// Note: Using core scanner's stats tracking
	stats := s.GetScanStats()
	
	// Get all media from database
	allMedia, err := s.getAllMediaFromDatabase()
	if err != nil {
		return fmt.Errorf("failed to retrieve media from database: %v", err)
	}
	
	log.Printf("📊 Found %d media entries in database", len(allMedia))
	
	var invalidMedia []models.Media
	var validCount int
	
	// Check each database entry against file system
	for _, media := range allMedia {
		if _, err := os.Stat(media.FilePath); os.IsNotExist(err) {
			log.Printf("❌ File not found: %s (ID: %d, Title: %s)", media.FilePath, media.ID, media.Title)
			invalidMedia = append(invalidMedia, media)
		} else {
			validCount++
		}
	}
	
	log.Printf("📊 Found %d invalid entries and %d valid entries", len(invalidMedia), validCount)
	
	// Remove invalid entries
	var deletedCount int
	for _, media := range invalidMedia {
		if err := s.handleInvalidMediaEntry(&media); err != nil {
			log.Printf("⚠️ Warning: Failed to delete invalid media entry %d: %v", media.ID, err)
		} else {
			deletedCount++
		}
	}
	
	stats = s.GetScanStats()
	s.SetScanDuration(time.Since(stats.StartTime))
	log.Printf("✅ Cleanup completed")
	log.Printf("📊 Cleanup Statistics:")
	log.Printf("   📁 Total entries checked: %d", len(allMedia))
	log.Printf("   ✅ Valid entries: %d", validCount)
	log.Printf("   🗑️ Invalid entries found: %d", len(invalidMedia))
	log.Printf("   ✅ Successfully deleted: %d", deletedCount)
	log.Printf("   ❌ Failed to delete: %d", len(invalidMedia)-deletedCount)
	
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

func (s *MediaScanner) ScanMediaLibrary() error {
	// Use the new batch-optimized scanning by default
	return s.BatchScanMediaLibrary()
}

// discoverFiles performs superfast file discovery with smart filtering
func (s *MediaScanner) discoverFiles() ([]FileInfo, error) {
	var files []FileInfo
	var mu sync.Mutex
	
	// Use goroutines for parallel directory scanning
	var wg sync.WaitGroup
	fileChan := make(chan FileInfo, 1000)
	
	// Start collector goroutine
	go func() {
		for file := range fileChan {
			mu.Lock()
			files = append(files, file)
			mu.Unlock()
		}
	}()

	err := filepath.Walk(s.GetMediaPath(), func(path string, info os.FileInfo, err error) error {
		if err != nil {
			log.Printf("⚠️ Error accessing path %s: %v", path, err)
			s.IncrementErrorFiles()
			return nil // Continue scanning
		}

		if info.IsDir() {
			// Skip hidden and system directories
			dirName := filepath.Base(path)
			if strings.HasPrefix(dirName, ".") || dirName == "System Volume Information" {
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

		// Ultra-fast file type detection using extension first
		ext := strings.ToLower(filepath.Ext(path))
		isVideo := s.isVideoFileByExtension(ext)
		isSubtitle := s.isSubtitleFileByExtension(ext)

		if isVideo || isSubtitle {
			wg.Add(1)
			go func(p string, i os.FileInfo) {
				defer wg.Done()
				
				fileInfo := FileInfo{
					Path:       p,
					Info:       i,
					IsVideo:    isVideo,
					IsSubtitle: isSubtitle,
				}
				
				select {
				case fileChan <- fileInfo:
				default:
					// Channel full, add directly
					mu.Lock()
					files = append(files, fileInfo)
					mu.Unlock()
				}
			}(path, info)
		}

		return nil
	})
	
	wg.Wait()
	close(fileChan)
	
	// Small delay to ensure collector finishes
	time.Sleep(100 * time.Millisecond)

	return files, err
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
	// Separate video and subtitle files
	var videoFiles, subtitleFiles []FileInfo
	for _, file := range files {
		if file.IsVideo && !s.shouldSkipFile(file.Path, file.Info) {
			videoFiles = append(videoFiles, file)
		} else if file.IsSubtitle {
			subtitleFiles = append(subtitleFiles, file)
		} else if file.IsVideo {
			s.IncrementSkippedFiles()
		}
	}
	
	log.Printf("📊 Batch processing: %d videos, %d subtitles", len(videoFiles), len(subtitleFiles))
	
	// Process video files in batches (metadata extraction + database operations)
	if len(videoFiles) > 0 {
		if err := s.processVideoBatches(videoFiles); err != nil {
			return err
		}
	}
	
	// Process subtitle files in parallel (lightweight operations)
	if len(subtitleFiles) > 0 {
		s.processSubtitlesBatch(subtitleFiles)
	}
	
	return nil
}

// processVideoBatches processes video files in optimized batches
func (s *MediaScanner) processVideoBatches(videoFiles []FileInfo) error {
	// Calculate optimal batch size based on system resources
	optimalBatchSize := s.calculateOptimalBatchSize()
	log.Printf("🔧 Using batch size: %d (based on system resources)", optimalBatchSize)
	
	totalBatches := (len(videoFiles) + optimalBatchSize - 1) / optimalBatchSize
	
	for i := 0; i < len(videoFiles); i += optimalBatchSize {
		end := i + optimalBatchSize
		if end > len(videoFiles) {
			end = len(videoFiles)
		}
		
		batch := videoFiles[i:end]
		batchNum := (i / optimalBatchSize) + 1
		
		log.Printf("🔄 Processing video batch %d/%d (%d files)", batchNum, totalBatches, len(batch))
		
		// Process batch with controlled concurrency
		if err := s.processSingleVideoBatch(batch, batchNum); err != nil {
			log.Printf("⚠️ Batch %d had errors: %v", batchNum, err)
		}
		
		// Brief pause between batches to prevent system overload
		if end < len(videoFiles) {
			time.Sleep(500 * time.Millisecond)
		}
	}
	
	return nil
}

// processSingleVideoBatch processes a single batch of video files with controlled concurrency
func (s *MediaScanner) processSingleVideoBatch(batch []FileInfo, batchNum int) error {
	var wg sync.WaitGroup
	var mu sync.Mutex
	var batchErrors []error
	
	// Use semaphore to control concurrency within batch
	semaphore := make(chan struct{}, s.GetMaxWorkers())
	
	for i, file := range batch {
		wg.Add(1)
		go func(fileInfo FileInfo, fileIndex int) {
			defer wg.Done()
			
			// Acquire semaphore
			semaphore <- struct{}{}
			defer func() { <-semaphore }()
			
			log.Printf("🔧 Batch %d: Processing file %d/%d: %s", batchNum, fileIndex+1, len(batch), filepath.Base(fileInfo.Path))
			
			// Process the video file
			if err := s.processVideoFileOptimized(fileInfo.Path, fileInfo.Info); err != nil {
				mu.Lock()
				batchErrors = append(batchErrors, fmt.Errorf("file %s: %v", fileInfo.Path, err))
				mu.Unlock()
				s.IncrementErrorFiles()
				log.Printf("❌ Batch %d: Error processing %s: %v", batchNum, filepath.Base(fileInfo.Path), err)
			} else {
				mu.Lock()
				mu.Unlock()
				s.IncrementProcessedFiles()
				s.IncrementNewFiles()
				log.Printf("✅ Batch %d: Successfully processed %s", batchNum, filepath.Base(fileInfo.Path))
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

// processSubtitlesBatch processes subtitle files in parallel
func (s *MediaScanner) processSubtitlesBatch(subtitleFiles []FileInfo) {
	log.Printf("📝 Processing %d subtitle files in parallel...", len(subtitleFiles))
	
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, s.GetMaxWorkers()*2) // Allow more concurrency for lightweight subtitle processing
	
	for _, file := range subtitleFiles {
		wg.Add(1)
		go func(fileInfo FileInfo) {
			defer wg.Done()
			
			semaphore <- struct{}{}
			defer func() { <-semaphore }()
			
			if err := s.processSubtitleFile(fileInfo.Path); err != nil {
				log.Printf("⚠️ Error processing subtitle %s: %v", fileInfo.Path, err)
				s.IncrementErrorFiles()
			} else {
				s.IncrementProcessedFiles()
			}
		}(file)
	}
	
	wg.Wait()
	log.Printf("✅ Subtitle processing completed")
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
			case s.GetPriorityQueue() <- file.convertToCore():
			default:
				// Priority queue full, use low priority
				s.GetLowPriorityQueue() <- file.convertToCore()
			}
		} else {
			// Low priority for subtitles
			s.GetLowPriorityQueue() <- file.convertToCore()
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
	cacheMutex := s.GetCacheMutex()
	scanCache := s.GetScanCache()
	
	cacheMutex.RLock()
	lastProcessed, exists := scanCache[path]
	cacheMutex.RUnlock()

	if exists && info.ModTime().Before(lastProcessed) {
		// File hasn't been modified since last scan
		return true
	}

	// Check if media already exists in database
	if exists, err := s.GetMediaService().MediaExists(path); err == nil && exists {
		// Update cache
		cacheMutex.Lock()
		scanCache[path] = time.Now()
		cacheMutex.Unlock()
		return true
	}

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
		
		// Check if title matches filename (title-filename mismatch detection)
		needsTitleFix = s.needsTitleFix(media, path, searchResult)
		
		// Force asset regeneration if title was fixed or filename doesn't match
		needsAssetRegeneration = missingAssets || needsTitleFix || searchResult.TitleMismatch
		
		// Log the analysis
		if searchResult.FoundBy != "" {
			log.Printf("🔍 Found existing media by %s: %s", searchResult.FoundBy, media.Title)
		}
		if searchResult.TitleMismatch {
			log.Printf("⚠️ Title-filename mismatch detected for: %s", path)
		}
		if needsTitleFix {
			log.Printf("🔧 Title needs fixing for: %s", path)
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
			FilePath: path,
			FileSize: info.Size(),
			ViewCount: 0,
		}
		needsMetadataUpdate = true
		needsAssetRegeneration = true
		log.Printf("🆕 Processing new media: %s", path)
	}

	// Extract metadata from filename and path (with caching)
	var metadata *core.FileMetadata
	
	// Always re-extract if title needs fixing or metadata needs updating
	if needsTitleFix || needsMetadataUpdate {
		log.Printf("🔄 Re-extracting metadata for: %s", path)
		metadata = s.extractMetadataWithCacheLocal(path)
		
		// Update title if it needs fixing
		if needsTitleFix {
			oldTitle := media.Title
			media.Title = metadata.Title
			log.Printf("🏷️ Title updated from '%s' to '%s'", oldTitle, media.Title)
			
			// Safety check
			if media.Title == "" {
				log.Printf("⚠️ WARNING: Title is empty after update! Re-extracting from filename...")
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
		
		// Update type if needed
		if media.Type == "" || needsMetadataUpdate {
			media.Type = metadata.Type
		}
		
		// Update quality if needed
		if media.Quality == "" || needsMetadataUpdate {
			media.Quality = metadata.Quality
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
	}

	// If it's an episode, find or create the series
	if metadata.Type == "episode" && metadata.SeriesTitle != "" {
		series, err := s.GetMediaService().FindOrCreateSeries(metadata.SeriesTitle)
		if err != nil {
			log.Printf("Error finding/creating series %s: %v", metadata.SeriesTitle, err)
			return err
		}
		media.SeriesID = &series.ID
	}

	// Final safety check before database operations
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
	}

	// Save or update media to database
	if media.ID == 0 {
		if err := s.GetMediaService().CreateMedia(media); err != nil {
			log.Printf("Error creating media %s: %v", media.Title, err)
			return err
		}
		log.Printf("✅ Created new media: %s", media.Title)
	} else {
		if err := s.GetMediaService().UpdateMedia(media); err != nil {
			log.Printf("Error updating media %s: %v", media.Title, err)
			return err
		}
		log.Printf("✅ Updated existing media: %s", media.Title)
	}

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

	// Extract additional metadata using FFprobe and TMDB (async)
	go func() {
		// First extract video metadata from file
		if err := s.extractVideoMetadata(media, path); err != nil {
			log.Printf("Warning: Failed to extract video metadata for %s: %v", media.Title, err)
		}

		// Then try to get enhanced metadata from TMDB with fallback to file-based metadata
		if s.GetTMDBService() != nil {
			tmdbMetadata, err := s.GetTMDBService().GenerateMediaMetadata(path, media.Title)
			if err != nil {
				log.Printf("TMDB metadata fetch failed for %s, using file-based metadata: %v", media.Title, err)
			} else {
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
				
				// Update genres from TMDB if available
				if len(tmdbMetadata.Genres) > 0 {
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

		// Update media with all collected metadata
		if err := s.GetMediaService().UpdateMedia(media); err != nil {
			log.Printf("Warning: Failed to update media metadata for %s: %v", media.Title, err)
		}
	}()

	// Check for existing assets using title-based naming
	thumbnailExists := s.GetThumbnailService().ThumbnailExists(media.ID, media.Title)
	previewExists := s.GetThumbnailService().PreviewExists(media.ID, media.Title)
	posterExists := s.GetPosterService() != nil && s.GetPosterService().GetPosterPath(media.ID, media.Title) != ""

	// Determine asset generation needs based on flags
	var needsThumbnail, needsPreview, needsPoster bool
	
	if needsAssetRegeneration {
		// Force regeneration of all assets
		needsThumbnail = true
		needsPreview = true
		needsPoster = s.GetPosterService() != nil
		log.Printf("🔄 Forcing asset regeneration for: %s", media.Title)
	} else {
		// Generate assets only if missing
		needsThumbnail = media.ThumbnailPath == "" && !thumbnailExists
		needsPreview = (media.PreviewPath == "" || media.PreviewClipPath == "") && !previewExists
		needsPoster = media.PosterPath == "" && !posterExists
	}

	// Debug logging for preview generation
	log.Printf("🔍 Asset check for %s: needsThumbnail=%v, needsPreview=%v (PreviewPath='%s', PreviewClipPath='%s'), needsPoster=%v", 
		media.Title, needsThumbnail, needsPreview, media.PreviewPath, media.PreviewClipPath, needsPoster)

	// Generate assets using batch-aware resource management with fallbacks
	if needsThumbnail || needsPreview {
		s.scheduleAssetGenerationWithFallbacks(media, path, needsThumbnail, needsPreview)
	}

	if needsPoster && s.GetPosterService() != nil {
		if err := s.GetPosterService().DownloadPoster(media.Title, media.ID); err != nil {
			log.Printf("Failed to download poster for %s: %v", media.Title, err)
		} else {
			posterPath := s.GetPosterService().GetPosterPath(media.ID, media.Title)
			if posterPath != "" {
				media.PosterPath = posterPath
				s.GetMediaService().UpdateMedia(media)
				log.Printf("Updated media %s with poster: %s", media.Title, posterPath)
			}
		}
	}

	// Auto-extract optimized LOUD ALAC audio if service available (only for individual files)
	// ALAC extraction is disabled during batch operations to prevent system overload
	if s.GetALACService() != nil && media.ID != 0 {
		// Only attempt ALAC extraction for individual file processing (not batch scans)
		log.Printf("🎵 ALAC service available for: %s (will extract on-demand)", media.Title)
	}

	log.Printf("Successfully processed media: %s (Type: %s, Size: %d bytes)", media.Title, media.Type, media.FileSize)
	return nil
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
		s.GetMediaService().UpdateMedia(media)
	}
}

// extractMetadataWithCache uses caching to speed up metadata extraction
func (s *MediaScanner) extractMetadataWithCache(path string) *core.FileMetadata {
	// Check cache first
	if cached, exists := s.GetMetadataCacheEntry(path); exists {
		return cached
	}
	
	// Extract metadata
	metadata := s.extractMetadata(path)
	
	// Convert to core.FileMetadata
	coreMetadata := &core.FileMetadata{
		Title:       metadata.Title,
		Type:        metadata.Type,
		Quality:     metadata.Quality,
		SeriesTitle: metadata.SeriesTitle,
		Season:      metadata.Season,
		Episode:     metadata.Episode,
		Year:        metadata.Year,
		Genres:      metadata.Genres,
	}
	
	// Cache the result
	s.SetMetadataCache(path, coreMetadata)
	
	return coreMetadata
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

	subtitle := &models.Subtitle{
		MediaID:  media.ID,
		Language: language,
		FilePath: path,
		Format:   strings.TrimPrefix(filepath.Ext(path), "."),
	}

	return s.GetMediaService().CreateSubtitle(subtitle)
}

// MediaSearchResult contains information about how media was found and what needs updating
type MediaSearchResult struct {
	FoundBy        string // "path", "filename", "title", "none"
	TitleMismatch  bool   // true if title doesn't match expected filename-based title
	PathChanged    bool   // true if file path has changed
	NeedsUpdate    bool   // true if metadata needs updating
}

// findExistingMedia uses multiple strategies to find existing media
func (s *MediaScanner) findExistingMedia(path string, info os.FileInfo) (*models.Media, *MediaSearchResult, error) {
	result := &MediaSearchResult{FoundBy: "none"}
	// Strategy 1: Search by exact path (fastest)
	media, err := s.GetMediaService().GetMediaByPath(path)
	if err != nil {
		return nil, result, err
	}
	if media != nil {
		result.FoundBy = "path"
		result.TitleMismatch = s.detectTitleMismatch(media, path)
		return media, result, nil
	}
	
	// Strategy 2: Search by filename (handle path changes)
	filename := filepath.Base(path)
	media, err = s.findMediaByFilename(filename)
	if err != nil {
		log.Printf("⚠️ Error searching by filename %s: %v", filename, err)
	} else if media != nil {
		result.FoundBy = "filename"
		result.PathChanged = media.FilePath != path
		result.TitleMismatch = s.detectTitleMismatch(media, path)
		
		// Update path if changed
		if result.PathChanged {
			media.FilePath = path
			media.FileSize = info.Size()
		}
		return media, result, nil
	}
	
	// Strategy 3: Search by expected title (handle title changes)
	expectedTitle := s.extractExpectedTitle(path)
	if expectedTitle != "" {
		media, err = s.findMediaByTitle(expectedTitle)
		if err != nil {
			log.Printf("⚠️ Error searching by title %s: %v", expectedTitle, err)
		} else if media != nil {
			result.FoundBy = "title"
			result.PathChanged = media.FilePath != path
			result.TitleMismatch = true // Title search implies mismatch
			
			// Update path if changed
			if result.PathChanged {
				media.FilePath = path
				media.FileSize = info.Size()
			}
			return media, result, nil
		}
	}
	
	// Strategy 4: Fuzzy search by cleaned filename
	cleanedTitle := s.cleanTitleForSearch(filename)
	if cleanedTitle != "" && cleanedTitle != expectedTitle {
		media, err = s.findMediaByTitleFuzzy(cleanedTitle)
		if err != nil {
			log.Printf("⚠️ Error in fuzzy search for %s: %v", cleanedTitle, err)
		} else if media != nil {
			result.FoundBy = "fuzzy_title"
			result.PathChanged = media.FilePath != path
			result.TitleMismatch = true
			
			// Update path if changed
			if result.PathChanged {
				media.FilePath = path
				media.FileSize = info.Size()
			}
			return media, result, nil
		}
	}
	
	// No existing media found
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
		`\.[a-z]{2,4}$`,           // File extensions
		`\d{3,4}p`,                // Resolution indicators
		`x264|x265|h264|h265`,     // Codecs
		`BluRay|WEB|HDRip`,        // Source indicators
		`YIFY|RARBG|YTS`,          // Release groups
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

// calculateTitleSimilarity calculates similarity between two titles (0.0 to 1.0)
func (s *MediaScanner) calculateTitleSimilarity(title1, title2 string) float64 {
	if title1 == title2 {
		return 1.0
	}
	
	// Simple word-based similarity
	words1 := strings.Fields(title1)
	words2 := strings.Fields(title2)
	
	if len(words1) == 0 || len(words2) == 0 {
		return 0.0
	}
	
	// Count common words
	commonWords := 0
	for _, word1 := range words1 {
		for _, word2 := range words2 {
			if word1 == word2 && len(word1) > 2 { // Only count meaningful words
				commonWords++
				break
			}
		}
	}
	
	// Calculate similarity as ratio of common words to total unique words
	totalWords := len(words1) + len(words2) - commonWords
	if totalWords == 0 {
		return 1.0
	}
	
	return float64(commonWords*2) / float64(totalWords)
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
		`\.en\.`:    "English",
		`\.eng\.`:   "English",
		`\.es\.`:    "Spanish",
		`\.spa\.`:   "Spanish",
		`\.fr\.`:    "French",
		`\.fre\.`:   "French",
		`\.de\.`:    "German",
		`\.ger\.`:   "German",
		`\.it\.`:    "Italian",
		`\.ita\.`:   "Italian",
		`\.pt\.`:    "Portuguese",
		`\.por\.`:   "Portuguese",
		`\.ru\.`:    "Russian",
		`\.rus\.`:   "Russian",
		`\.ja\.`:    "Japanese",
		`\.jpn\.`:   "Japanese",
		`\.ko\.`:    "Korean",
		`\.kor\.`:   "Korean",
		`\.zh\.`:    "Chinese",
		`\.chi\.`:   "Chinese",
		`\.ar\.`:    "Arabic",
		`\.ara\.`:   "Arabic",
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
		"Action": {"action", "fight", "martial", "combat", "war", "battle"},
		"Comedy": {"comedy", "funny", "humor", "laugh", "comic"},
		"Drama": {"drama", "dramatic", "emotional"},
		"Horror": {"horror", "scary", "terror", "nightmare", "zombie", "ghost"},
		"Romance": {"romance", "romantic", "love", "wedding"},
		"Sci-Fi": {"sci-fi", "science", "fiction", "space", "alien", "future", "robot"},
		"Fantasy": {"fantasy", "magic", "wizard", "dragon", "fairy", "mythical"},
		"Thriller": {"thriller", "suspense", "mystery", "detective"},
		"Crime": {"crime", "criminal", "police", "detective", "murder", "heist"},
		"Adventure": {"adventure", "quest", "journey", "expedition"},
		"Animation": {"animation", "animated", "cartoon", "anime"},
		"Documentary": {"documentary", "docu", "real", "true", "biography"},
		"Family": {"family", "kids", "children", "disney"},
		"Music": {"music", "musical", "concert", "band", "singer"},
		"Western": {"western", "cowboy", "wild west", "frontier"},
		"Sport": {"sport", "football", "basketball", "soccer", "boxing", "racing"},
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
		} `json:"streams"`
	}

	if err := json.Unmarshal(output, &probeData); err != nil {
		return fmt.Errorf("failed to parse ffprobe output: %v", err)
	}

	// Extract duration and convert to seconds
	if duration, err := strconv.ParseFloat(probeData.Format.Duration, 64); err == nil {
		media.Duration = int(duration)
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
	
	// Pre-allocate slice for better performance
	files = make([]FileInfo, 0, 1000)
	
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
	coreStats := s.MediaScanner.GetScanStats()
	return ScanStats{
		TotalFiles:     coreStats.TotalFiles,
		ProcessedFiles: coreStats.ProcessedFiles,
		SkippedFiles:   coreStats.SkippedFiles,
		ErrorFiles:     coreStats.ErrorFiles,
		NewFiles:       coreStats.NewFiles,
		UpdatedFiles:   coreStats.UpdatedFiles,
		ScanDuration:   coreStats.ScanDuration,
		StartTime:      coreStats.StartTime,
	}
}

// GetBatchProcessingStats returns detailed batch processing statistics
func (s *MediaScanner) GetBatchProcessingStats() map[string]interface{} {
	scanStats := s.GetScanStats()
	stats := map[string]interface{}{
		"maxWorkers":           s.GetMaxWorkers(),
		"batchSize":           s.GetBatchSize(),
		"totalFiles":          scanStats.TotalFiles,
		"processedFiles":      scanStats.ProcessedFiles,
		"skippedFiles":        scanStats.SkippedFiles,
		"errorFiles":          scanStats.ErrorFiles,
		"newFiles":            scanStats.NewFiles,
		"updatedFiles":        scanStats.UpdatedFiles,
		"scanDuration":        s.GetScanStats().ScanDuration.String(),
		"processingRate":      0.0,
		"systemUtilization":   "optimal",
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
func (s *MediaScanner) ProcessSingleFile(path string, info os.FileInfo) error {
	log.Printf("🔍 Processing single file: %s", path)
	
	// Check if it's a video file
	if s.isVideoFile(path) {
		return s.processVideoFileOptimized(path, info)
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

// regenerateAllAssets forces regeneration of all assets for the given media
func (s *MediaScanner) regenerateAllAssets(mediaList []models.Media) {
	log.Printf("🎨 Starting asset regeneration for %d media items...", len(mediaList))
	
	// Process in batches to avoid overwhelming the system
	batchSize := 5
	for i := 0; i < len(mediaList); i += batchSize {
		end := i + batchSize
		if end > len(mediaList) {
			end = len(mediaList)
		}
		
		batch := mediaList[i:end]
		log.Printf("🎨 Processing asset batch %d-%d of %d", i+1, end, len(mediaList))
		
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
		if end < len(mediaList) {
			time.Sleep(2 * time.Second)
		}
	}
	
	log.Printf("✅ Asset regeneration completed for %d media items", len(mediaList))
}

// regeneratePreviewClipsBatch processes preview clip generation in optimized batches
func (s *MediaScanner) regeneratePreviewClipsBatch(mediaList []models.Media) {
	log.Printf("🎬 Starting preview clip batch generation for %d media items...", len(mediaList))
	
	// Use smaller batch size for preview clips as they're more resource intensive
	batchSize := 3
	totalBatches := (len(mediaList) + batchSize - 1) / batchSize
	
	for i := 0; i < len(mediaList); i += batchSize {
		end := i + batchSize
		if end > len(mediaList) {
			end = len(mediaList)
		}
		
		batch := mediaList[i:end]
		batchNum := (i / batchSize) + 1
		log.Printf("🎬 Processing preview batch %d/%d (%d-%d of %d)", batchNum, totalBatches, i+1, end, len(mediaList))
		
		// Process batch sequentially to avoid overwhelming ffmpeg
		for _, media := range batch {
			s.regeneratePreviewClipForMedia(&media)
			
			// Small delay between each preview generation to prevent system overload
			time.Sleep(1 * time.Second)
		}
		
		// Longer delay between batches for preview clips
		if end < len(mediaList) {
			log.Printf("⏸️ Batch %d/%d completed, waiting 5 seconds before next batch...", batchNum, totalBatches)
			time.Sleep(5 * time.Second)
		}
	}
	
	log.Printf("✅ Preview clip batch generation completed for %d media items", len(mediaList))
}

// regeneratePreviewClipForMedia regenerates preview clip for a single media item with fallback handling
func (s *MediaScanner) regeneratePreviewClipForMedia(media *models.Media) {
	log.Printf("🎬 Generating preview clip for: %s", media.Title)
	
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

// generatePreviewWithAudioFallback generates preview with audio codec conversion
func (s *MediaScanner) generatePreviewWithAudioFallback(media *models.Media) (string, error) {
	previewDir := "previews"
	if _, err := os.Stat(previewDir); os.IsNotExist(err) {
		os.MkdirAll(previewDir, 0755)
	}
	
	outputPath := fmt.Sprintf("%s/preview_%d_%s_audio_fallback.mp4", previewDir, media.ID, 
		strings.ReplaceAll(media.Title, " ", "_"))
	
	// FFmpeg command with audio codec fallback (ALAC -> AAC conversion)
	cmd := exec.Command("ffmpeg",
		"-i", media.FilePath,
		"-ss", "60", // Start at 1 minute
		"-t", "30",  // 30 second duration
		"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
		"-c:v", "libx264",
		"-preset", "fast",
		"-crf", "23",
		"-c:a", "aac", // Force AAC audio codec
		"-b:a", "128k", // Audio bitrate
		"-ac", "2", // Stereo audio
		"-ar", "44100", // Sample rate
		"-movflags", "+faststart",
		"-y", // Overwrite output file
		outputPath)
	
	log.Printf("🔧 Running FFmpeg with audio fallback: %s", cmd.String())
	
	if output, err := cmd.CombinedOutput(); err != nil {
		log.Printf("❌ FFmpeg audio fallback failed: %v\nOutput: %s", err, string(output))
		return "", fmt.Errorf("ffmpeg audio fallback failed: %v", err)
	}
	
	return outputPath, nil
}

// generateLowerQualityPreview generates 720p preview with audio conversion
func (s *MediaScanner) generateLowerQualityPreview(media *models.Media) (string, error) {
	previewDir := "previews"
	if _, err := os.Stat(previewDir); os.IsNotExist(err) {
		os.MkdirAll(previewDir, 0755)
	}
	
	outputPath := fmt.Sprintf("%s/preview_%d_%s_720p.mp4", previewDir, media.ID, 
		strings.ReplaceAll(media.Title, " ", "_"))
	
	// FFmpeg command for 720p with audio conversion
	cmd := exec.Command("ffmpeg",
		"-i", media.FilePath,
		"-ss", "60", // Start at 1 minute
		"-t", "30",  // 30 second duration
		"-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2",
		"-c:v", "libx264",
		"-preset", "ultrafast", // Faster encoding
		"-crf", "28", // Lower quality for faster processing
		"-c:a", "aac", // Force AAC audio codec
		"-b:a", "96k", // Lower audio bitrate
		"-ac", "2", // Stereo audio
		"-ar", "44100", // Sample rate
		"-movflags", "+faststart",
		"-y", // Overwrite output file
		outputPath)
	
	log.Printf("🔧 Running FFmpeg 720p preview: %s", cmd.String())
	
	if output, err := cmd.CombinedOutput(); err != nil {
		log.Printf("❌ FFmpeg 720p preview failed: %v\nOutput: %s", err, string(output))
		return "", fmt.Errorf("ffmpeg 720p preview failed: %v", err)
	}
	
	return outputPath, nil
}

// generateVideoOnlyPreview generates preview without audio track
func (s *MediaScanner) generateVideoOnlyPreview(media *models.Media) (string, error) {
	previewDir := "previews"
	if _, err := os.Stat(previewDir); os.IsNotExist(err) {
		os.MkdirAll(previewDir, 0755)
	}
	
	outputPath := fmt.Sprintf("%s/preview_%d_%s_video_only.mp4", previewDir, media.ID, 
		strings.ReplaceAll(media.Title, " ", "_"))
	
	// FFmpeg command without audio
	cmd := exec.Command("ffmpeg",
		"-i", media.FilePath,
		"-ss", "60", // Start at 1 minute
		"-t", "30",  // 30 second duration
		"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
		"-c:v", "libx264",
		"-preset", "fast",
		"-crf", "23",
		"-an", // No audio
		"-movflags", "+faststart",
		"-y", // Overwrite output file
		outputPath)
	
	log.Printf("🔧 Running FFmpeg video-only preview: %s", cmd.String())
	
	if output, err := cmd.CombinedOutput(); err != nil {
		log.Printf("❌ FFmpeg video-only preview failed: %v\nOutput: %s", err, string(output))
		return "", fmt.Errorf("ffmpeg video-only preview failed: %v", err)
	}
	
	return outputPath, nil
}

// scheduleAssetGenerationWithFallbacks schedules asset generation with fallback handling
func (s *MediaScanner) scheduleAssetGenerationWithFallbacks(media *models.Media, path string, needsThumbnail, needsPreview bool) {
	// Generate thumbnail with fallbacks
	if needsThumbnail {
		go func() {
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
	
	// Generate preview with comprehensive fallbacks
	if needsPreview {
		go func() {
			previewPath, err := s.generatePreviewWithFallbacks(media)
			if err != nil {
				log.Printf("❌ All preview generation methods failed for %s: %v", media.Title, err)
			} else {
				log.Printf("✅ Preview generation successful for %s: %s", media.Title, previewPath)
				media.PreviewPath = previewPath
				media.PreviewClipPath = previewPath
				s.GetMediaService().UpdateMedia(media)
			}
		}()
	}
}

// scheduleAssetGeneration provides backward compatibility (calls new method)
func (s *MediaScanner) scheduleAssetGeneration(media *models.Media, path string, needsThumbnail, needsPreview bool) {
	s.scheduleAssetGenerationWithFallbacks(media, path, needsThumbnail, needsPreview)
}

// regenerateMediaAssets regenerates all assets for a single media item
func (s *MediaScanner) regenerateMediaAssets(media *models.Media) {
	log.Printf("🎨 Regenerating assets for: %s", media.Title)
	
	// Check if file still exists
	if _, err := os.Stat(media.FilePath); os.IsNotExist(err) {
		log.Printf("⚠️ Cannot regenerate assets, file not found: %s", media.FilePath)
		return
	}
	
	// Generate thumbnail
	go func() {
		if _, err := s.GetThumbnailService().GenerateThumbnailAsync(media.FilePath, media.ID, media.Title); err != nil {
			log.Printf("❌ Failed to regenerate thumbnail for %s: %v", media.Title, err)
		} else {
			// Update media record with thumbnail path
			thumbnailPath := s.GetThumbnailService().GetThumbnailPath(media.ID, media.Title)
			if thumbnailPath != "" {
				media.ThumbnailPath = thumbnailPath
				s.GetMediaService().UpdateMedia(media)
			}
			log.Printf("✅ Thumbnail regenerated for: %s", media.Title)
		}
	}()
	
	// Generate preview
	go func() {
		if previewPath, err := s.GetThumbnailService().GeneratePreviewClipAsync(media.FilePath, media.ID, media.Title); err != nil {
			log.Printf("❌ Failed to regenerate preview for %s: %v", media.Title, err)
		} else {
			// Update media record with preview paths
			media.PreviewPath = previewPath
			media.PreviewClipPath = previewPath
			s.GetMediaService().UpdateMedia(media)
			log.Printf("✅ Preview regenerated for: %s", media.Title)
		}
	}()
	
	// Generate poster
	if s.GetPosterService() != nil {
		go func() {
			if err := s.GetPosterService().DownloadPoster(media.Title, media.ID); err != nil {
				log.Printf("❌ Failed to regenerate poster for %s: %v", media.Title, err)
			} else {
				posterPath := s.GetPosterService().GetPosterPath(media.ID, media.Title)
				if posterPath != "" {
					media.PosterPath = posterPath
					s.GetMediaService().UpdateMedia(media)
				}
				log.Printf("✅ Poster regenerated for: %s", media.Title)
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
	s.SetStartTime(time.Now())
	mediaPath := s.GetMediaPath()
	log.Printf("🚀 Starting batch-optimized media library scan at: %s", mediaPath)

	// Check if media path exists
	if _, err := os.Stat(mediaPath); os.IsNotExist(err) {
		log.Printf("❌ Media path does not exist: %s", mediaPath)
		return fmt.Errorf("media path does not exist: %s", mediaPath)
	}

	// Phase 1: Fast file discovery
	log.Printf("📂 Phase 1: File discovery...")
	files, err := s.discoverFiles()
	if err != nil {
		return fmt.Errorf("file discovery failed: %v", err)
	}

	s.SetTotalFiles(len(files))
	stats := s.GetScanStats()
	log.Printf("📊 Discovered %d files (%d videos, %d subtitles)", 
		stats.TotalFiles, 
		s.countFilesByType(files, true, false),
		s.countFilesByType(files, false, true))

	// Phase 2: Process files
	log.Printf("⚡ Phase 2: Processing files...")
	if err := s.processFilesBatch(files); err != nil {
		log.Printf("⚠️ Some files had errors: %v", err)
	}

	// Phase 3: Results
	scanStats := s.GetScanStats()
	s.SetScanDuration(time.Since(scanStats.StartTime))
	s.logScanResults()

	return nil
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

// extractMetadataWithCacheLocal extracts metadata from file path with caching
func (s *MediaScanner) extractMetadataWithCacheLocal(path string) *core.FileMetadata {
	// Check cache first
	if cachedMetadata, exists := s.GetMetadataCacheEntry(path); exists {
		return cachedMetadata
	}
	
	// Extract metadata
	extractedMetadata := s.extractMetadataFromPath(path)
	
	// Cache the result
	s.SetMetadataCache(path, extractedMetadata)
	
	return extractedMetadata
}

// extractMetadataFromPath extracts metadata from file path
func (s *MediaScanner) extractMetadataFromPath(path string) *core.FileMetadata {
	filename := filepath.Base(path)
	
	metadata := &core.FileMetadata{
		Type:    "movie", // Default type
		Quality: "1080p", // Default quality
	}
	
	// Extract title from filename
	if s.GetTMDBService() != nil {
		metadata.Title = s.GetTMDBService().CleanTitle(filename)
	} else {
		metadata.Title = s.cleanTitle(filename)
	}
	
	// Detect if it's a TV series episode
	if s.isEpisodeFile(filename) {
		metadata.Type = "episode"
		metadata.SeriesTitle, metadata.Season, metadata.Episode = s.extractEpisodeInfo(filename)
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

// extractEpisodeInfo extracts series title, season, and episode from filename
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

// cleanTitle cleans a title string (simple version)
func (s *MediaScanner) cleanTitle(title string) string {
	// Remove file extension
	title = strings.TrimSuffix(title, filepath.Ext(title))
	
	// Replace common separators with spaces
	title = strings.ReplaceAll(title, ".", " ")
	title = strings.ReplaceAll(title, "_", " ")
	title = strings.ReplaceAll(title, "-", " ")
	
	// Remove common patterns
	patterns := []string{
		`\[.*?\]`,     // Remove brackets
		`\(.*?\)`,     // Remove parentheses
		`\d{4}p`,      // Remove resolution
		`x264|x265|h264|h265`, // Remove codecs
		`BluRay|WEBRip|DVDRip|HDTV`, // Remove sources
	}
	
	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		title = re.ReplaceAllString(title, " ")
	}
	
	// Clean up multiple spaces
	title = regexp.MustCompile(`\s+`).ReplaceAllString(title, " ")
	title = strings.TrimSpace(title)
	
	// Apply title case
	if title != "" {
		words := strings.Fields(title)
		for i, word := range words {
			if len(word) > 0 {
				words[i] = strings.ToUpper(string(word[0])) + strings.ToLower(word[1:])
			}
		}
		title = strings.Join(words, " ")
	}
	
	return title
}

// extractMetadata extracts metadata from file path (wrapper for extractMetadataFromPath)
func (s *MediaScanner) extractMetadata(path string) *core.FileMetadata {
	return s.extractMetadataFromPath(path)
}

