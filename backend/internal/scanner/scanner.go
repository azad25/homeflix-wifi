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

	"github.com/h2non/filetype"
)

type MediaScanner struct {
	mediaService           interfaces.MediaServiceInterface
	thumbnailService       interfaces.ThumbnailServiceInterface
	posterService          interfaces.PosterServiceInterface
	geminiService          interfaces.GeminiServiceInterface
	celeryService          interfaces.CeleryServiceInterface
	alacService            interfaces.ALACAudioServiceInterface
	tmdbService            interfaces.TMDBServiceInterface
	recommendationService  interfaces.RecommendationServiceInterface
	mediaPath              string
	
	// Enhanced scanning options
	maxWorkers       int
	batchSize        int
	lastScanTime     time.Time
	scanCache        map[string]time.Time
	cacheMutex       sync.RWMutex
	
	// Performance tracking
	stats            ScanStats
	
	// Advanced caching and optimization
	fileHashCache    map[string]string
	metadataCache    map[string]*FileMetadata
	skipPatterns     []string
	priorityQueue    chan FileInfo
	lowPriorityQueue chan FileInfo
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

func NewMediaScanner(mediaService interfaces.MediaServiceInterface, thumbnailService interfaces.ThumbnailServiceInterface, posterService interfaces.PosterServiceInterface, geminiService interfaces.GeminiServiceInterface, celeryService interfaces.CeleryServiceInterface, alacService interfaces.ALACAudioServiceInterface, tmdbService interfaces.TMDBServiceInterface, recommendationService interfaces.RecommendationServiceInterface, mediaPath string) *MediaScanner {
	return &MediaScanner{
		mediaService:          mediaService,
		thumbnailService:      thumbnailService,
		posterService:         posterService,
		geminiService:         geminiService,
		celeryService:         celeryService,
		alacService:           alacService,
		tmdbService:           tmdbService,
		recommendationService: recommendationService,
		mediaPath:             mediaPath,
		maxWorkers:       8, // Increased worker count for faster processing
		batchSize:        20, // Larger batch size
		scanCache:        make(map[string]time.Time),
		fileHashCache:    make(map[string]string),
		metadataCache:    make(map[string]*FileMetadata),
		stats:            ScanStats{},
		skipPatterns:     []string{".DS_Store", "Thumbs.db", ".tmp", ".temp", "._*"},
		priorityQueue:    make(chan FileInfo, 100),
		lowPriorityQueue: make(chan FileInfo, 500),
	}
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
	s.stats.StartTime = time.Now()
	
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
	
	s.stats.ScanDuration = time.Since(s.stats.StartTime)
	log.Printf("✅ Cleanup completed in %v", s.stats.ScanDuration)
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

	err := filepath.Walk(s.mediaPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			log.Printf("⚠️ Error accessing path %s: %v", path, err)
			s.stats.ErrorFiles++
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
		for _, pattern := range s.skipPatterns {
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
				s.stats.SkippedFiles++
				continue
			}
			
			// Process video file sequentially
			s.processVideoFile(file.Path, file.Info)
			s.stats.ProcessedFiles++
		} else if file.IsSubtitle {
			// Process subtitle file
			s.processSubtitleFile(file.Path)
			s.stats.ProcessedFiles++
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
			s.stats.SkippedFiles++
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
	semaphore := make(chan struct{}, s.maxWorkers)
	
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
				s.stats.ErrorFiles++
				mu.Unlock()
				log.Printf("❌ Batch %d: Error processing %s: %v", batchNum, filepath.Base(fileInfo.Path), err)
			} else {
				mu.Lock()
				s.stats.ProcessedFiles++
				s.stats.NewFiles++
				mu.Unlock()
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
	semaphore := make(chan struct{}, s.maxWorkers*2) // Allow more concurrency for lightweight subtitle processing
	
	for _, file := range subtitleFiles {
		wg.Add(1)
		go func(fileInfo FileInfo) {
			defer wg.Done()
			
			semaphore <- struct{}{}
			defer func() { <-semaphore }()
			
			if err := s.processSubtitleFile(fileInfo.Path); err != nil {
				log.Printf("⚠️ Error processing subtitle %s: %v", fileInfo.Path, err)
				s.stats.ErrorFiles++
			} else {
				s.stats.ProcessedFiles++
			}
		}(file)
	}
	
	wg.Wait()
	log.Printf("✅ Subtitle processing completed")
}

// calculateOptimalBatchSize calculates optimal batch size based on system resources
func (s *MediaScanner) calculateOptimalBatchSize() int {
	// Base batch size
	baseBatchSize := s.batchSize
	
	// Adjust based on available workers
	if s.maxWorkers >= 8 {
		baseBatchSize = baseBatchSize + (s.maxWorkers - 4) // Increase batch size for more workers
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
	for i := 0; i < s.maxWorkers/2; i++ {
		wg.Add(1)
		go s.priorityWorker(i, &wg)
	}
	
	// Start low-priority workers (for subtitles and existing files)
	for i := 0; i < s.maxWorkers/2; i++ {
		wg.Add(1)
		go s.lowPriorityWorker(i+s.maxWorkers/2, &wg)
	}
	
	// Separate files into priority queues AFTER workers are started
	s.prioritizeFiles(files)
	
	// Close queues after all files are queued
	close(s.priorityQueue)
	close(s.lowPriorityQueue)

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
				s.stats.SkippedFiles++
				continue
			}
			
			// High priority for new video files
			select {
			case s.priorityQueue <- file:
			default:
				// Priority queue full, use low priority
				s.lowPriorityQueue <- file
			}
		} else {
			// Low priority for subtitles
			s.lowPriorityQueue <- file
		}
	}
}

// priorityWorker handles high-priority video files
func (s *MediaScanner) priorityWorker(id int, wg *sync.WaitGroup) {
	defer wg.Done()
	
	for file := range s.priorityQueue {
		if err := s.processVideoFileOptimized(file.Path, file.Info); err != nil {
			log.Printf("❌ Priority Worker %d: Error processing %s: %v", id, file.Path, err)
			s.stats.ErrorFiles++
		} else {
			s.stats.ProcessedFiles++
			s.stats.NewFiles++
		}
	}
}

// lowPriorityWorker handles subtitles and less critical files
func (s *MediaScanner) lowPriorityWorker(id int, wg *sync.WaitGroup) {
	defer wg.Done()
	
	for file := range s.lowPriorityQueue {
		var err error
		if file.IsVideo {
			err = s.processVideoFileOptimized(file.Path, file.Info)
		} else if file.IsSubtitle {
			err = s.processSubtitleFile(file.Path)
		}
		
		if err != nil {
			log.Printf("❌ Low Priority Worker %d: Error processing %s: %v", id, file.Path, err)
			s.stats.ErrorFiles++
		} else {
			s.stats.ProcessedFiles++
		}
	}
}

// worker processes files from the work channel
func (s *MediaScanner) worker(id int, workChan <-chan FileInfo, wg *sync.WaitGroup) {
	defer wg.Done()

	for file := range workChan {
		if s.shouldSkipFile(file.Path, file.Info) {
			s.stats.SkippedFiles++
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
			s.stats.ErrorFiles++
		} else {
			s.stats.ProcessedFiles++
		}
	}
}

// shouldSkipFile determines if a file should be skipped based on cache and modification time
func (s *MediaScanner) shouldSkipFile(path string, info os.FileInfo) bool {
	s.cacheMutex.RLock()
	lastProcessed, exists := s.scanCache[path]
	s.cacheMutex.RUnlock()

	if exists && info.ModTime().Before(lastProcessed) {
		// File hasn't been modified since last scan
		return true
	}

	// Check if media already exists in database
	if exists, err := s.mediaService.MediaExists(path); err == nil && exists {
		// Update cache
		s.cacheMutex.Lock()
		s.scanCache[path] = time.Now()
		s.cacheMutex.Unlock()
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
	log.Printf("✅ Media scan completed in %v", s.stats.ScanDuration)
	log.Printf("📊 Scan Statistics:")
	log.Printf("   📁 Total files discovered: %d", s.stats.TotalFiles)
	log.Printf("   ✅ Successfully processed: %d", s.stats.ProcessedFiles)
	log.Printf("   ⏭️ Skipped (unchanged): %d", s.stats.SkippedFiles)
	log.Printf("   ❌ Errors: %d", s.stats.ErrorFiles)
	log.Printf("   🆕 New files added: %d", s.stats.NewFiles)
	log.Printf("   🔄 Files updated: %d", s.stats.UpdatedFiles)
	
	if s.stats.TotalFiles > 0 {
		successRate := float64(s.stats.ProcessedFiles) / float64(s.stats.TotalFiles) * 100
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
	s.cacheMutex.Lock()
	s.scanCache[path] = time.Now()
	s.cacheMutex.Unlock()

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
	var metadata *FileMetadata
	
	// Always re-extract if title needs fixing or metadata needs updating
	if needsTitleFix || needsMetadataUpdate {
		log.Printf("🔄 Re-extracting metadata for: %s", path)
		metadata = s.extractMetadataWithCache(path)
		
		// Update title if it needs fixing
		if needsTitleFix {
			oldTitle := media.Title
			media.Title = metadata.Title
			log.Printf("🏷️ Title updated from '%s' to '%s'", oldTitle, media.Title)
			
			// Safety check
			if media.Title == "" {
				log.Printf("⚠️ WARNING: Title is empty after update! Re-extracting from filename...")
				// Re-extract using TMDB service directly from filename
				if s.tmdbService != nil {
					media.Title = s.tmdbService.CleanTitle(filepath.Base(path))
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
		metadata = s.extractMetadataWithCache(path)
		if media.Title == "" {
			media.Title = metadata.Title
			
			// Safety check
			if media.Title == "" {
				log.Printf("⚠️ WARNING: Title is empty from metadata! Re-extracting from filename...")
				// Re-extract using TMDB service directly from filename
				if s.tmdbService != nil {
					media.Title = s.tmdbService.CleanTitle(filepath.Base(path))
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
		series, err := s.mediaService.FindOrCreateSeries(metadata.SeriesTitle)
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
		if s.tmdbService != nil {
			media.Title = s.tmdbService.CleanTitle(filepath.Base(path))
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
		if err := s.mediaService.CreateMedia(media); err != nil {
			log.Printf("Error creating media %s: %v", media.Title, err)
			return err
		}
		log.Printf("✅ Created new media: %s", media.Title)
	} else {
		if err := s.mediaService.UpdateMedia(media); err != nil {
			log.Printf("Error updating media %s: %v", media.Title, err)
			return err
		}
		log.Printf("✅ Updated existing media: %s", media.Title)
	}

	// Assign genres based on filename/path analysis
	genreNames := s.extractGenresFromPath(path, media.Title)
	if len(genreNames) > 0 {
		// Convert genre names to IDs
		genreIDs, err := s.mediaService.GetGenreIDsByNames(genreNames)
		if err != nil {
			log.Printf("Warning: Failed to get genre IDs for media %s: %v", media.Title, err)
		} else if len(genreIDs) > 0 {
			if err := s.mediaService.AssignGenresToMedia(media.ID, genreIDs); err != nil {
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
		if s.tmdbService != nil {
			tmdbMetadata, err := s.tmdbService.GenerateMediaMetadata(path, media.Title)
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
					genreIDs, err := s.mediaService.GetGenreIDsByNames(tmdbMetadata.Genres)
					if err != nil {
						log.Printf("Warning: Failed to get TMDB genre IDs for media %s: %v", media.Title, err)
					} else if len(genreIDs) > 0 {
						if err := s.mediaService.AssignGenresToMedia(media.ID, genreIDs); err != nil {
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
		if err := s.mediaService.UpdateMedia(media); err != nil {
			log.Printf("Warning: Failed to update media metadata for %s: %v", media.Title, err)
		}
	}()

	// Check for existing assets using title-based naming
	thumbnailExists := s.thumbnailService.ThumbnailExists(media.ID, media.Title)
	previewExists := s.thumbnailService.PreviewExists(media.ID, media.Title)
	posterExists := s.posterService != nil && s.posterService.GetPosterPath(media.ID, media.Title) != ""

	// Determine asset generation needs based on flags
	var needsThumbnail, needsPreview, needsPoster bool
	
	if needsAssetRegeneration {
		// Force regeneration of all assets
		needsThumbnail = true
		needsPreview = true
		needsPoster = s.posterService != nil
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

	// Generate assets using batch-aware resource management
	if needsThumbnail || needsPreview {
		s.scheduleAssetGeneration(media, path, needsThumbnail, needsPreview)
	}

	if needsPoster && s.posterService != nil {
		if err := s.posterService.DownloadPoster(media.Title, media.ID); err != nil {
			log.Printf("Failed to download poster for %s: %v", media.Title, err)
		} else {
			posterPath := s.posterService.GetPosterPath(media.ID, media.Title)
			if posterPath != "" {
				media.PosterPath = posterPath
				s.mediaService.UpdateMedia(media)
				log.Printf("Updated media %s with poster: %s", media.Title, posterPath)
			}
		}
	}

	// Auto-extract optimized LOUD ALAC audio if service available (only for individual files)
	// ALAC extraction is disabled during batch operations to prevent system overload
	if s.alacService != nil && media.ID != 0 {
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
	if _, err := s.thumbnailService.GenerateThumbnail(path, media.ID, media.Title); err != nil {
		log.Printf("❌ Failed to generate thumbnail for %s: %v", media.Title, err)
	} else {
		// Update media record with thumbnail path
		thumbnailPath := s.thumbnailService.GetThumbnailPath(media.ID, media.Title)
		if thumbnailPath != "" {
			media.ThumbnailPath = thumbnailPath
			s.mediaService.UpdateMedia(media)
		}
	}
}

// generatePreviewDirect generates preview directly (backward compatibility)
func (s *MediaScanner) generatePreviewDirect(media *models.Media, path string) {
	if previewPath, err := s.thumbnailService.GeneratePreviewClip(path, media.ID, media.Title); err != nil {
		log.Printf("❌ Failed to generate preview for %s: %v", media.Title, err)
	} else {
		// Update media record with preview paths
		media.PreviewPath = previewPath
		media.PreviewClipPath = previewPath
		s.mediaService.UpdateMedia(media)
	}
}

// extractMetadataWithCache uses caching to speed up metadata extraction
func (s *MediaScanner) extractMetadataWithCache(path string) *FileMetadata {
	// Check cache first
	s.cacheMutex.RLock()
	if cached, exists := s.metadataCache[path]; exists {
		s.cacheMutex.RUnlock()
		return cached
	}
	s.cacheMutex.RUnlock()
	
	// Extract metadata
	metadata := s.extractMetadata(path)
	
	// Cache the result
	s.cacheMutex.Lock()
	s.metadataCache[path] = metadata
	s.cacheMutex.Unlock()
	
	return metadata
}

func (s *MediaScanner) processSubtitleFile(path string) error {
	// Find corresponding video file
	videoPath := s.findCorrespondingVideo(path)
	if videoPath == "" {
		return nil // No corresponding video found
	}

	// Find media in database
	media, err := s.mediaService.GetMediaByPath(videoPath)
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

	return s.mediaService.CreateSubtitle(subtitle)
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
	media, err := s.mediaService.GetMediaByPath(path)
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
	if s.tmdbService != nil {
		return s.tmdbService.CleanTitle(title)
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
	mediaList, err := s.mediaService.SearchMedia(title)
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
	mediaList, err := s.mediaService.SearchMedia(title)
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
		media, err := s.mediaService.GetMediaByPath(oldPath)
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
	allMedia, err := s.mediaService.GetAllMedia()
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
		fuzzyMatches, err := s.mediaService.SearchMedia(baseNameWithoutExt)
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

type FileMetadata struct {
	Title         string
	Type          string // "movie" or "episode"
	SeriesTitle   string
	SeasonNumber  *int
	EpisodeNumber *int
	Quality       string // Video quality (4K, Full HD, HD, SD, etc.)
}

func (s *MediaScanner) extractMetadata(path string) *FileMetadata {
	filename := filepath.Base(path)
	filenameWithoutExt := strings.TrimSuffix(filename, filepath.Ext(filename))
	
	metadata := &FileMetadata{
		Title:   filenameWithoutExt,
		Type:    "movie", // Default to movie
		Quality: s.detectQuality(path), // Detect quality from filename
	}

	// Check for TV series patterns
	// Pattern 1: Series.Name.S01E01.Title
	seriesPattern1 := regexp.MustCompile(`^(.+?)\.S(\d+)E(\d+)`)
	if matches := seriesPattern1.FindStringSubmatch(filenameWithoutExt); len(matches) == 4 {
		metadata.Type = "episode"
		metadata.SeriesTitle = strings.ReplaceAll(matches[1], ".", " ")
		if season, err := strconv.Atoi(matches[2]); err == nil {
			metadata.SeasonNumber = &season
		}
		if episode, err := strconv.Atoi(matches[3]); err == nil {
			metadata.EpisodeNumber = &episode
		}
		metadata.Title = fmt.Sprintf("%s S%sE%s", metadata.SeriesTitle, matches[2], matches[3])
		return metadata
	}

	// Pattern 2: Series Name - S01E01 - Episode Title
	seriesPattern2 := regexp.MustCompile(`^(.+?)\s*-\s*S(\d+)E(\d+)`)
	if matches := seriesPattern2.FindStringSubmatch(filenameWithoutExt); len(matches) == 4 {
		metadata.Type = "episode"
		metadata.SeriesTitle = strings.TrimSpace(matches[1])
		if season, err := strconv.Atoi(matches[2]); err == nil {
			metadata.SeasonNumber = &season
		}
		if episode, err := strconv.Atoi(matches[3]); err == nil {
			metadata.EpisodeNumber = &episode
		}
		metadata.Title = fmt.Sprintf("%s S%sE%s", metadata.SeriesTitle, matches[2], matches[3])
		return metadata
	}

	// Pattern 3: Series/Season/Episode structure in path
	pathParts := strings.Split(filepath.Dir(path), string(os.PathSeparator))
	if len(pathParts) >= 2 {
		seasonPattern := regexp.MustCompile(`(?i)season\s*(\d+)`)
		for i := len(pathParts) - 1; i >= 0; i-- {
			if matches := seasonPattern.FindStringSubmatch(pathParts[i]); len(matches) == 2 {
				if i > 0 {
					metadata.Type = "episode"
					metadata.SeriesTitle = pathParts[i-1]
					if season, err := strconv.Atoi(matches[1]); err == nil {
						metadata.SeasonNumber = &season
					}
					
					// Try to extract episode number from filename
					episodePattern := regexp.MustCompile(`(?i)e(\d+)|episode\s*(\d+)|(\d+)`)
					if epMatches := episodePattern.FindStringSubmatch(filenameWithoutExt); len(epMatches) > 1 {
						for j := 1; j < len(epMatches); j++ {
							if epMatches[j] != "" {
								if episode, err := strconv.Atoi(epMatches[j]); err == nil {
									metadata.EpisodeNumber = &episode
									break
								}
							}
						}
					}
					
					if metadata.EpisodeNumber != nil {
						metadata.Title = fmt.Sprintf("%s S%dE%d", metadata.SeriesTitle, *metadata.SeasonNumber, *metadata.EpisodeNumber)
					} else {
						metadata.Title = fmt.Sprintf("%s S%d - %s", metadata.SeriesTitle, *metadata.SeasonNumber, filenameWithoutExt)
					}
					return metadata
				}
			}
		}
	}

	// For movies, try to use the folder name if it's more descriptive than the filename
	folderName := filepath.Base(filepath.Dir(path))
	
	// Check if the folder name looks like a movie title (contains year, quality indicators, etc.)
	folderHasMoviePattern := regexp.MustCompile(`(?i)\b(19|20)\d{2}\b|\b(1080p|2160p|720p|4K|BluRay|WEB|HDRip)\b`).MatchString(folderName)
	
	// Check if folder is a generic name like "Movies", "Films", etc.
	genericFolderPattern := regexp.MustCompile(`(?i)^(movies?\d*|films?|videos?|media|downloads?|torrents?|dc\s+movies|marvel\s+movies)$`)
	
	var titleSource string
	
	// Use folder name if:
	// 1. Folder has movie patterns (year/quality indicators) 
	// 2. AND folder is not a generic name
	// 3. OR folder name is significantly longer and more descriptive
	if folderHasMoviePattern && !genericFolderPattern.MatchString(folderName) {
		titleSource = folderName
	} else if !genericFolderPattern.MatchString(folderName) && len(folderName) > len(filenameWithoutExt)+5 {
		// Use folder if it's significantly more descriptive
		titleSource = folderName
	} else {
		titleSource = filenameWithoutExt
	}

	// Clean up movie title using TMDB service if available
	if s.tmdbService != nil {
		metadata.Title = s.tmdbService.CleanTitle(titleSource)
	} else {
		metadata.Title = s.cleanTitle(titleSource)
	}
	
	// Debug logging for title extraction
	log.Printf("🔍 Title extraction for %s:", filepath.Base(path))
	log.Printf("   📁 Folder: %s", folderName)
	log.Printf("   📄 Filename: %s", filenameWithoutExt)
	log.Printf("   🎯 Source used: %s", titleSource)
	log.Printf("   ✨ Cleaned title: %s", metadata.Title)
	
	// Validate the cleaned title and try alternatives if needed
	if !s.isValidTitle(metadata.Title) || len(metadata.Title) <= 2 {
		log.Printf("   ⚠️ Title invalid or too short ('%s'), trying alternative source...", metadata.Title)
		alternativeSource := filenameWithoutExt
		if titleSource == filenameWithoutExt {
			alternativeSource = folderName
		}
		
		// Skip generic folder names for alternatives
		if !genericFolderPattern.MatchString(alternativeSource) {
			var alternativeTitle string
			if s.tmdbService != nil {
				alternativeTitle = s.tmdbService.CleanTitle(alternativeSource)
			} else {
				alternativeTitle = s.cleanTitle(alternativeSource)
			}
			
			// Use alternative if it's better (valid and longer)
			if s.isValidTitle(alternativeTitle) && len(alternativeTitle) > len(metadata.Title) {
				log.Printf("   🔄 Using alternative title: %s", alternativeTitle)
				metadata.Title = alternativeTitle
			}
		}
		
		// If still not good, try simple cleaning on both sources
		if !s.isValidTitle(metadata.Title) || len(metadata.Title) <= 2 {
			simpleFolder := s.simpleCleanTitle(folderName)
			simpleFilename := s.simpleCleanTitle(filenameWithoutExt)
			
			if !genericFolderPattern.MatchString(folderName) && s.isValidTitle(simpleFolder) && len(simpleFolder) > len(metadata.Title) {
				log.Printf("   🔄 Using simple folder title: %s", simpleFolder)
				metadata.Title = simpleFolder
			} else if s.isValidTitle(simpleFilename) && len(simpleFilename) > len(metadata.Title) {
				log.Printf("   🔄 Using simple filename title: %s", simpleFilename)
				metadata.Title = simpleFilename
			}
		}
	}
	
	// Final safety check - ensure we always have a title
	if len(metadata.Title) <= 2 || metadata.Title == "" {
		log.Printf("   🚨 All cleaning failed, using basic filename fallback...")
		// Last resort: use the filename with minimal cleaning
		basicTitle := strings.TrimSuffix(filename, filepath.Ext(filename))
		basicTitle = strings.ReplaceAll(basicTitle, ".", " ")
		basicTitle = strings.ReplaceAll(basicTitle, "_", " ")
		basicTitle = strings.ReplaceAll(basicTitle, "-", " ")
		
		// Remove common quality indicators
		basicTitle = regexp.MustCompile(`(?i)\b(1080p|2160p|720p|4K|HD|BluRay|WEB|x264|x265|YIFY|YTS|RARBG)\b`).ReplaceAllString(basicTitle, "")
		
		// Clean up spaces and apply title case
		basicTitle = regexp.MustCompile(`\s+`).ReplaceAllString(basicTitle, " ")
		basicTitle = strings.TrimSpace(basicTitle)
		
		// Apply basic title case
		if basicTitle != "" {
			words := strings.Fields(basicTitle)
			for i, word := range words {
				if len(word) > 0 {
					words[i] = strings.ToUpper(string(word[0])) + strings.ToLower(word[1:])
				}
			}
			basicTitle = strings.Join(words, " ")
		}
		
		if basicTitle != "" {
			metadata.Title = basicTitle
			log.Printf("   📝 Final fallback title: %s", metadata.Title)
		} else {
			// Absolute last resort - use original filename
			metadata.Title = strings.TrimSuffix(filename, filepath.Ext(filename))
			log.Printf("   ❌ Using raw filename as title: %s", metadata.Title)
		}
	}
	
	return metadata
}

// detectQuality detects video quality from filename and path
func (s *MediaScanner) detectQuality(filePath string) string {
	filename := strings.ToLower(filepath.Base(filePath))
	
	// 4K/UHD detection
	if regexp.MustCompile(`\b(2160p|4K|UHD|4096x2160|3840x2160)\b`).MatchString(filename) {
		return "4K"
	}
	
	// 1440p/QHD detection
	if regexp.MustCompile(`\b(1440p|QHD|2560x1440)\b`).MatchString(filename) {
		return "QHD"
	}
	
	// 1080p/Full HD detection
	if regexp.MustCompile(`\b(1080p|FHD|1920x1080)\b`).MatchString(filename) {
		return "Full HD"
	}
	
	// 720p/HD detection
	if regexp.MustCompile(`\b(720p|HD|1280x720)\b`).MatchString(filename) {
		return "HD"
	}
	
	// 480p/SD detection
	if regexp.MustCompile(`\b(480p|SD|854x480|640x480)\b`).MatchString(filename) {
		return "SD"
	}
	
	// 360p detection
	if regexp.MustCompile(`\b(360p|640x360)\b`).MatchString(filename) {
		return "360p"
	}
	
	// Check for BluRay/high quality sources
	if regexp.MustCompile(`\b(BluRay|BRRip|BDRip)\b`).MatchString(filename) {
		// If BluRay but no specific resolution, assume HD
		return "HD"
	}
	
	// Check for WEB sources
	if regexp.MustCompile(`\b(WEBRip|WEB.DL|WEB)\b`).MatchString(filename) {
		// If WEB but no specific resolution, assume HD
		return "HD"
	}
	
	// Default fallback
	return "HD"
}

func (s *MediaScanner) cleanTitle(title string) string {
	// Step 1: Extract year FIRST before any other processing
	originalTitle := title
	yearPattern := regexp.MustCompile(`\b(19|20)\d{2}\b`)
	yearMatches := yearPattern.FindAllString(originalTitle, -1)
	var extractedYear string
	if len(yearMatches) > 0 {
		// Use the last year found (usually the release year)
		extractedYear = yearMatches[len(yearMatches)-1]
	}

	// Step 2: Replace common separators with spaces
	cleaned := strings.ReplaceAll(title, ".", " ")
	cleaned = strings.ReplaceAll(cleaned, "_", " ")
	cleaned = strings.ReplaceAll(cleaned, "-", " ")

	// Step 3: Extract the main title before quality indicators (excluding years from the cut pattern)
	titleEndPattern := regexp.MustCompile(`(?i)\s*(\b(1080p|2160p|720p|480p|4K|8K|UHD|FHD|HD|BluRay|BRRip|BDRip|DVDRip|WEBRip|WEB|HDTV|HDRip|x264|x265|h264|h265|HEVC|AVC|XviD|10bit|8bit|HDR|AAC|AC3|DTS|5\.1|7\.1|YIFY|YTS|RARBG|PSA|ETRG)\b)`)
	
	// Find where the title likely ends
	titleEndIndex := titleEndPattern.FindStringIndex(cleaned)
	if titleEndIndex != nil {
		// Extract everything before the quality indicators
		cleaned = cleaned[:titleEndIndex[0]]
	}

	// Step 3: Remove anything in brackets or parentheses that might remain
	bracketsPattern := regexp.MustCompile(`[\[\(\{][^\]\)\}]*[\]\)\}]*`)
	cleaned = bracketsPattern.ReplaceAllString(cleaned, " ")

	// Step 4: Remove any remaining quality indicators and video codecs
	qualityPattern := regexp.MustCompile(`(?i)\b(` +
		`1080p|2160p|720p|480p|360p|4K|8K|UHD|FHD|HD|SD|` +
		`BluRay|BRRip|BDRip|DVDRip|WEBRip|WEB.DL|WEB|HDTV|HDRip|BrRip|` +
		`x264|x265|h264|h265|HEVC|AVC|XviD|` +
		`10bit|8bit|HDR|HDR10|DV|DoVi|` +
		`AAC|AC3|DTS|DDP|DD|EAC3|FLAC|MP3|Atmos|TrueHD|` +
		`5\.1|7\.1|2\.0|2ch|6ch|8ch|` +
		`PROPER|REPACK|INTERNAL|LIMITED|SUBBED|DUBBED|UNRATED|` +
		`EXTENDED|THEATRICAL|DIRECTORS?\.?CUT|DC|UNCUT|` +
		`REMASTERED|ANNIVERSARY|SPECIAL\.?EDITION|SE|` +
		`MULTI|DUAL|VOSTFR|TRUEFRENCH|` +
		`COMPLETE|FULL|` +
		`ESub|ESubs|Subs?|Subtitle|Subtitles|` +
		`DVD|CD\d|DISC\d` +
		`)\b`)
	cleaned = qualityPattern.ReplaceAllString(cleaned, " ")

	// Step 5: Remove release groups (specific known groups only)
	releaseGroupPattern := regexp.MustCompile(`(?i)\b(` +
		`YIFY|YTS|RARBG|PSA|ETRG|AMZN|NF|NETFLIX|ATVP|DSNP|` +
		`HMAX|HBO|HULU|DISNEY|APPLE|PARAMOUNT|` +
		`SPARKS|GECKOS|ROVERS|GALAXY|ORBS|CMRG|ETHiCS|` +
		`DEFLATE|STUTTERSHIT|VETO|BLOW|SCENE|FGT|` +
		`EVOLVE|KILLERS|DEMAND|FLEET|ION10|ION|` +
		`MX` +
		`)\b`)
	cleaned = releaseGroupPattern.ReplaceAllString(cleaned, " ")

	// Step 6: Remove years from the middle of the title (we already extracted it)
	cleaned = yearPattern.ReplaceAllString(cleaned, " ")

	// Step 7: Remove file size indicators
	sizePattern := regexp.MustCompile(`(?i)\b\d+(\.\d+)?\s?(GB|MB|GiB|MiB)\b`)
	cleaned = sizePattern.ReplaceAllString(cleaned, " ")

	// Step 8: Clean up multiple spaces and trim
	cleaned = regexp.MustCompile(`\s+`).ReplaceAllString(cleaned, " ")
	cleaned = strings.TrimSpace(cleaned)

	// Step 9: If we're left with a very short string, try a fallback approach
	if len(cleaned) <= 2 || cleaned == "" {
		// Fallback: try to extract title from the original more conservatively
		words := strings.Fields(strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(title, ".", " "), "_", " "), "-", " "))
		var titleWords []string
		for _, word := range words {
			// Stop at first quality indicator or year
			if regexp.MustCompile(`(?i)^(19|20)\d{2}$|^(1080p|2160p|720p|4K|HD|BluRay|WEB|x264|x265)$`).MatchString(word) {
				break
			}
			titleWords = append(titleWords, word)
			// Don't take more than 5 words for the title
			if len(titleWords) >= 5 {
				break
			}
		}
		if len(titleWords) > 0 {
			cleaned = strings.Join(titleWords, " ")
		}
	}

	// Step 10: Final fallback - if still empty or too short, use basic filename cleanup
	if len(cleaned) <= 2 || cleaned == "" {
		// Ultimate fallback: just clean the basic filename
		fallbackTitle := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(title, ".", " "), "_", " "), "-", " ")
		fallbackTitle = regexp.MustCompile(`\s+`).ReplaceAllString(fallbackTitle, " ")
		fallbackTitle = strings.TrimSpace(fallbackTitle)
		
		// If we have something reasonable, use it
		if len(fallbackTitle) > 2 {
			cleaned = fallbackTitle
		}
	}

	// Step 11: Title case formatting
	if cleaned != "" {
		words := strings.Fields(cleaned)
		for i, word := range words {
			if len(word) > 0 {
				// Keep short articles/prepositions lowercase (except at start)
				if i > 0 && len(word) <= 3 && regexp.MustCompile(`(?i)^(a|an|the|and|or|but|of|in|on|at|to|for|by|with)$`).MatchString(word) {
					words[i] = strings.ToLower(word)
				} else {
					// Title case for other words
					words[i] = strings.ToUpper(string(word[0])) + strings.ToLower(word[1:])
				}
			}
		}
		cleaned = strings.Join(words, " ")
	}

	// Step 12: Add year back to the title if we found one
	if extractedYear != "" && cleaned != "" {
		cleaned = cleaned + " (" + extractedYear + ")"
	}

	// Final validation - check if the cleaned title makes sense
	if !s.isValidTitle(cleaned) {
		// Try a simpler approach
		simpleTitle := s.simpleCleanTitle(title)
		if s.isValidTitle(simpleTitle) && len(simpleTitle) > len(cleaned) {
			cleaned = simpleTitle
		}
	}

	return cleaned
}

// isValidTitle checks if a title looks reasonable
func (s *MediaScanner) isValidTitle(title string) bool {
	if title == "" || len(title) <= 2 {
		return false
	}
	
	// Check if title contains at least one letter
	hasLetter := regexp.MustCompile(`[a-zA-Z]`).MatchString(title)
	if !hasLetter {
		return false
	}
	
	// Check if title is mostly numbers (probably not a good title)
	words := strings.Fields(title)
	numberWords := 0
	for _, word := range words {
		if regexp.MustCompile(`^\d+$`).MatchString(word) {
			numberWords++
		}
	}
	
	// If more than half the words are numbers, it's probably not a good title
	if len(words) > 0 && float64(numberWords)/float64(len(words)) > 0.5 {
		return false
	}
	
	// Check for common bad patterns
	badPatterns := []string{
		`^[0-9\s]+$`,           // Only numbers and spaces
		`^[^a-zA-Z]*$`,         // No letters at all
		`^\s*$`,                // Only whitespace
	}
	
	for _, pattern := range badPatterns {
		if matched, _ := regexp.MatchString(pattern, title); matched {
			return false
		}
	}
	
	return true
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
	err := s.parallelWalk(s.mediaPath, func(path string, info os.FileInfo, err error) error {
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
		if info.ModTime().After(s.lastScanTime) {
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
	s.stats.TotalFiles = len(newFiles)
	s.stats.StartTime = time.Now()
	
	if err := s.processFilesSequential(newFiles); err != nil {
		log.Printf("⚠️ Some files failed to process: %v", err)
	}
	
	// Update last scan time
	s.lastScanTime = time.Now()
	s.saveLastScanTime()
	
	s.stats.ScanDuration = time.Since(s.stats.StartTime)
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
	s.stats.StartTime = time.Now()
	log.Printf("🚀 Starting superfast media library scan at: %s", s.mediaPath)

	// Phase 1: Lightning-fast file discovery
	log.Printf("⚡ Phase 1: Lightning-fast file discovery...")
	files, err := s.superfastDiscoverFiles()
	if err != nil {
		return fmt.Errorf("superfast file discovery failed: %v", err)
	}

	s.stats.TotalFiles = len(files)
	log.Printf("📊 Discovered %d files in record time", s.stats.TotalFiles)

	// Phase 2: Parallel processing with maximum workers
	originalWorkers := s.maxWorkers
	s.maxWorkers = 16 // Use maximum workers for superfast scan
	
	log.Printf("🔥 Phase 2: Processing files sequentially...")
	if err := s.processFilesSequential(files); err != nil {
		log.Printf("⚠️ Some files failed to process: %v", err)
	}
	
	s.maxWorkers = originalWorkers // Restore original worker count

	// Phase 3: Results
	s.stats.ScanDuration = time.Since(s.stats.StartTime)
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
	err := filepath.Walk(s.mediaPath, func(path string, info os.FileInfo, err error) error {
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
	cacheFile := filepath.Join(s.mediaPath, ".homeflix_scan_cache")
	if data, err := os.ReadFile(cacheFile); err == nil {
		if timestamp, err := time.Parse(time.RFC3339, string(data)); err == nil {
			s.lastScanTime = timestamp
			log.Printf("📅 Last scan time loaded: %v", s.lastScanTime)
			return
		}
	}
	
	// Default to 24 hours ago if no cache
	s.lastScanTime = time.Now().Add(-24 * time.Hour)
	log.Printf("📅 Using default last scan time: %v", s.lastScanTime)
}

// saveLastScanTime saves the last scan timestamp
func (s *MediaScanner) saveLastScanTime() {
	cacheFile := filepath.Join(s.mediaPath, ".homeflix_scan_cache")
	data := s.lastScanTime.Format(time.RFC3339)
	if err := os.WriteFile(cacheFile, []byte(data), 0644); err != nil {
		log.Printf("⚠️ Failed to save scan cache: %v", err)
	}
}

// GetScanStats returns current scan statistics
func (s *MediaScanner) GetScanStats() ScanStats {
	return s.stats
}

// GetBatchProcessingStats returns detailed batch processing statistics
func (s *MediaScanner) GetBatchProcessingStats() map[string]interface{} {
	stats := map[string]interface{}{
		"maxWorkers":           s.maxWorkers,
		"batchSize":           s.batchSize,
		"totalFiles":          s.stats.TotalFiles,
		"processedFiles":      s.stats.ProcessedFiles,
		"skippedFiles":        s.stats.SkippedFiles,
		"errorFiles":          s.stats.ErrorFiles,
		"newFiles":            s.stats.NewFiles,
		"updatedFiles":        s.stats.UpdatedFiles,
		"scanDuration":        s.stats.ScanDuration.String(),
		"processingRate":      0.0,
		"systemUtilization":   "optimal",
	}
	
	// Calculate processing rate (files per second)
	if s.stats.ScanDuration.Seconds() > 0 {
		stats["processingRate"] = float64(s.stats.ProcessedFiles) / s.stats.ScanDuration.Seconds()
	}
	
	// Determine system utilization level
	if s.maxWorkers >= 8 && s.batchSize >= 15 {
		stats["systemUtilization"] = "high"
	} else if s.maxWorkers >= 4 && s.batchSize >= 10 {
		stats["systemUtilization"] = "medium"
	} else {
		stats["systemUtilization"] = "low"
	}
	
	return stats
}

// SetMaxWorkers configures the number of worker goroutines
func (s *MediaScanner) SetMaxWorkers(workers int) {
	if workers > 0 && workers <= 16 {
		s.maxWorkers = workers
		log.Printf("⚙️ Set max workers to %d", workers)
	}
}

// SetBatchSize configures the batch size for processing
func (s *MediaScanner) SetBatchSize(size int) {
	if size > 0 && size <= 100 {
		s.batchSize = size
		log.Printf("⚙️ Set batch size to %d", size)
	}
}

// AutoTuneBatchProcessing automatically adjusts batch processing parameters based on system performance
func (s *MediaScanner) AutoTuneBatchProcessing() {
	log.Printf("🔧 Auto-tuning batch processing parameters...")
	
	// Measure current system load (simplified approach)
	startTime := time.Now()
	
	// Measure performance and adjust parameters
	if s.stats.ProcessedFiles > 0 && s.stats.ScanDuration > 0 {
		currentRate := float64(s.stats.ProcessedFiles) / s.stats.ScanDuration.Seconds()
		
		// Adjust parameters based on processing rate
		if currentRate > 2.0 { // High performance
			if s.maxWorkers < 12 {
				s.maxWorkers = min(s.maxWorkers+2, 12)
				log.Printf("🚀 Increased workers to %d (high performance detected)", s.maxWorkers)
			}
			if s.batchSize < 30 {
				s.batchSize = min(s.batchSize+5, 30)
				log.Printf("🚀 Increased batch size to %d (high performance detected)", s.batchSize)
			}
		} else if currentRate < 0.5 { // Low performance
			if s.maxWorkers > 4 {
				s.maxWorkers = max(s.maxWorkers-1, 4)
				log.Printf("🐌 Decreased workers to %d (low performance detected)", s.maxWorkers)
			}
			if s.batchSize > 10 {
				s.batchSize = max(s.batchSize-2, 10)
				log.Printf("🐌 Decreased batch size to %d (low performance detected)", s.batchSize)
			}
		}
		
		log.Printf("📊 Current processing rate: %.2f files/second", currentRate)
	}
	
	// Adjust queue sizes based on new parameters
	newPriorityQueueSize := s.maxWorkers * 10
	newLowPriorityQueueSize := s.maxWorkers * 50
	
	if cap(s.priorityQueue) != newPriorityQueueSize {
		s.priorityQueue = make(chan FileInfo, newPriorityQueueSize)
		s.lowPriorityQueue = make(chan FileInfo, newLowPriorityQueueSize)
		log.Printf("🔧 Adjusted queue sizes: priority=%d, low-priority=%d", newPriorityQueueSize, newLowPriorityQueueSize)
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
	s.stats.StartTime = time.Now()
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
				s.stats.ErrorFiles++
			} else {
				s.stats.ProcessedFiles++
				s.stats.NewFiles++
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
	s.stats.ScanDuration = time.Since(s.stats.StartTime)
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
		if err := s.mediaService.UpdateMedia(media); err != nil {
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
	return s.mediaService.GetAllMedia()
}

// findFileInStorage searches for a file by name in the media storage
func (s *MediaScanner) findFileInStorage(filename string) string {
	var foundPath string
	
	// Walk through the media path to find the file
	filepath.Walk(s.mediaPath, func(path string, info os.FileInfo, err error) error {
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
	if err := s.mediaService.DeleteMedia(media.ID); err != nil {
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

// regeneratePreviewClipForMedia regenerates preview clip for a single media item
func (s *MediaScanner) regeneratePreviewClipForMedia(media *models.Media) {
	log.Printf("🎬 Generating preview clip for: %s", media.Title)
	
	// Check if file still exists
	if _, err := os.Stat(media.FilePath); os.IsNotExist(err) {
		log.Printf("⚠️ Cannot generate preview clip, file not found: %s", media.FilePath)
		return
	}
	
	// Generate preview clip synchronously for better control
	previewPath, err := s.thumbnailService.GeneratePreviewClip(media.FilePath, media.ID, media.Title)
	if err != nil {
		log.Printf("❌ Failed to generate preview clip for %s: %v", media.Title, err)
		
		// Try async method as fallback
		log.Printf("🔄 Trying async preview generation for %s...", media.Title)
		if asyncPreviewPath, asyncErr := s.thumbnailService.GeneratePreviewClipAsync(media.FilePath, media.ID, media.Title); asyncErr != nil {
			log.Printf("❌ Async preview generation also failed for %s: %v", media.Title, asyncErr)
		} else {
			previewPath = asyncPreviewPath
			err = nil
		}
	}
	
	if err == nil && previewPath != "" {
		// Update media record with preview paths
		oldPreviewPath := media.PreviewPath
		oldPreviewClipPath := media.PreviewClipPath
		
		media.PreviewPath = previewPath
		media.PreviewClipPath = previewPath
		
		if updateErr := s.mediaService.UpdateMedia(media); updateErr != nil {
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
	}
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
		if _, err := s.thumbnailService.GenerateThumbnailAsync(media.FilePath, media.ID, media.Title); err != nil {
			log.Printf("❌ Failed to regenerate thumbnail for %s: %v", media.Title, err)
		} else {
			// Update media record with thumbnail path
			thumbnailPath := s.thumbnailService.GetThumbnailPath(media.ID, media.Title)
			if thumbnailPath != "" {
				media.ThumbnailPath = thumbnailPath
				s.mediaService.UpdateMedia(media)
			}
			log.Printf("✅ Thumbnail regenerated for: %s", media.Title)
		}
	}()
	
	// Generate preview
	go func() {
		if previewPath, err := s.thumbnailService.GeneratePreviewClipAsync(media.FilePath, media.ID, media.Title); err != nil {
			log.Printf("❌ Failed to regenerate preview for %s: %v", media.Title, err)
		} else {
			// Update media record with preview paths
			media.PreviewPath = previewPath
			media.PreviewClipPath = previewPath
			s.mediaService.UpdateMedia(media)
			log.Printf("✅ Preview regenerated for: %s", media.Title)
		}
	}()
	
	// Generate poster
	if s.posterService != nil {
		go func() {
			if err := s.posterService.DownloadPoster(media.Title, media.ID); err != nil {
				log.Printf("❌ Failed to regenerate poster for %s: %v", media.Title, err)
			} else {
				posterPath := s.posterService.GetPosterPath(media.ID, media.Title)
				if posterPath != "" {
					media.PosterPath = posterPath
					s.mediaService.UpdateMedia(media)
				}
				log.Printf("✅ Poster regenerated for: %s", media.Title)
			}
		}()
	}
	
	// Update metadata from TMDB if available
	if s.tmdbService != nil {
		go func() {
			if tmdbMetadata, err := s.tmdbService.GenerateMediaMetadata(media.FilePath, media.Title); err != nil {
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
	if err := s.mediaService.UpdateMedia(media); err != nil {
		log.Printf("⚠️ Failed to update media with TMDB metadata: %v", err)
	}
}

// findBestPathMatch finds the best matching media entry based on directory structure similarity
func (s *MediaScanner) findBestPathMatch(currentPath string, candidates []models.Media) *models.Media {
	if len(candidates) == 0 {
		return nil
	}
	
	// If only one candidate, return it
	if len(candidates) == 1 {
		return &candidates[0]
	}
	
	// Extract relative path structure from current path
	currentRelPath := s.extractRelativePathStructure(currentPath)
	
	var bestMatch *models.Media
	var bestScore float64
	
	for _, candidate := range candidates {
		// Extract relative path structure from candidate
		candidateRelPath := s.extractRelativePathStructure(candidate.FilePath)
		
		// Calculate structure similarity
		score := s.calculatePathStructureSimilarity(currentRelPath, candidateRelPath)
		
		if score > bestScore {
			bestScore = score
			bestMatch = &candidate
		}
	}
	
	// Only return match if similarity is reasonable
	if bestScore > 0.6 {
		return bestMatch
	}
	
	return nil
}

// extractRelativePathStructure extracts the directory structure relative to common mount points
func (s *MediaScanner) extractRelativePathStructure(fullPath string) string {
	// Common mount point patterns to strip
	mountPatterns := []string{
		`^/media/[^/]+/[^/]+/`,     // /media/user/drive/
		`^/mnt/[^/]+/`,             // /mnt/drive/
		`^/Volumes/[^/]+/`,         // /Volumes/drive/ (macOS)
		`^/home/[^/]+/[^/]+/`,      // /home/user/media/
		`^[A-Z]:\\`,                // C:\ (Windows)
	}
	
	relPath := fullPath
	for _, pattern := range mountPatterns {
		re := regexp.MustCompile(pattern)
		if re.MatchString(fullPath) {
			relPath = re.ReplaceAllString(fullPath, "")
			break
		}
	}
	
	return relPath
}

// calculatePathStructureSimilarity calculates similarity between two path structures
func (s *MediaScanner) calculatePathStructureSimilarity(path1, path2 string) float64 {
	if path1 == path2 {
		return 1.0
	}
	
	// Split paths into components
	parts1 := strings.Split(filepath.Clean(path1), string(filepath.Separator))
	parts2 := strings.Split(filepath.Clean(path2), string(filepath.Separator))
	
	// Remove empty parts
	parts1 = s.removeEmptyStrings(parts1)
	parts2 = s.removeEmptyStrings(parts2)
	
	if len(parts1) == 0 || len(parts2) == 0 {
		return 0.0
	}
	
	// Calculate common suffix (most important for file structure)
	commonSuffix := 0
	minLen := len(parts1)
	if len(parts2) < minLen {
		minLen = len(parts2)
	}
	
	for i := 1; i <= minLen; i++ {
		if parts1[len(parts1)-i] == parts2[len(parts2)-i] {
			commonSuffix++
		} else {
			break
		}
	}
	
	// Calculate similarity based on common suffix and total length
	maxLen := len(parts1)
	if len(parts2) > maxLen {
		maxLen = len(parts2)
	}
	
	return float64(commonSuffix*2) / float64(maxLen)
}

// removeEmptyStrings removes empty strings from a slice
func (s *MediaScanner) removeEmptyStrings(slice []string) []string {
	var result []string
	for _, str := range slice {
		if str != "" {
			result = append(result, str)
		}
	}
	return result
}

// SmartPathResolution attempts to resolve moved/remounted drive paths
func (s *MediaScanner) SmartPathResolution() error {
	log.Printf("🔍 Starting smart path resolution for moved/remounted drives...")
	
	// Get all media with potentially invalid paths
	allMedia, err := s.getAllMediaFromDatabase()
	if err != nil {
		return fmt.Errorf("failed to get media from database: %v", err)
	}
	
	var resolvedCount, unresolvedCount int
	
	for _, media := range allMedia {
		// Check if current path exists
		if _, err := os.Stat(media.FilePath); os.IsNotExist(err) {
			log.Printf("🔍 Attempting to resolve missing path: %s", media.FilePath)
			
			// Try to find the file in current media path
			filename := filepath.Base(media.FilePath)
			newPath := s.findFileInCurrentStorage(filename, media.FilePath)
			
			if newPath != "" {
				log.Printf("✅ Resolved path: %s -> %s", media.FilePath, newPath)
				
				// Update file info
				if fileInfo, err := os.Stat(newPath); err == nil {
					media.FilePath = newPath
					media.FileSize = fileInfo.Size()
					
					if err := s.mediaService.UpdateMedia(&media); err != nil {
						log.Printf("❌ Failed to update resolved path for %s: %v", media.Title, err)
					} else {
						resolvedCount++
					}
				}
			} else {
				log.Printf("❌ Could not resolve path for: %s", media.FilePath)
				unresolvedCount++
			}
		}
	}
	
	log.Printf("✅ Smart path resolution completed: %d resolved, %d unresolved", resolvedCount, unresolvedCount)
	return nil
}

// findFileInCurrentStorage searches for a file in the current media storage using multiple strategies
func (s *MediaScanner) findFileInCurrentStorage(filename string, originalPath string) string {
	// Strategy 1: Search by exact filename in current media path
	foundPath := s.findFileInStorage(filename)
	if foundPath != "" {
		return foundPath
	}
	
	// Strategy 2: Try to preserve directory structure
	relativeStructure := s.extractRelativePathStructure(originalPath)
	if relativeStructure != originalPath {
		// Try to reconstruct path with current media root
		potentialPath := filepath.Join(s.mediaPath, relativeStructure)
		if _, err := os.Stat(potentialPath); err == nil {
			log.Printf("🎯 Found file using preserved structure: %s", potentialPath)
			return potentialPath
		}
	}
	
	// Strategy 3: Search in subdirectories with similar names
	originalDir := filepath.Dir(originalPath)
	originalDirName := filepath.Base(originalDir)
	
	var foundInSimilarDir string
	filepath.Walk(s.mediaPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		
		if info.IsDir() {
			dirName := filepath.Base(path)
			// Check if directory name is similar to original
			if s.calculateTitleSimilarity(
				s.normalizeTitleForComparison(originalDirName),
				s.normalizeTitleForComparison(dirName),
			) > 0.7 {
				// Check if file exists in this similar directory
				potentialFile := filepath.Join(path, filename)
				if _, err := os.Stat(potentialFile); err == nil {
					foundInSimilarDir = potentialFile
					return filepath.SkipDir
				}
			}
		}
		
		return nil
	})
	
	if foundInSimilarDir != "" {
		log.Printf("🎯 Found file in similar directory: %s", foundInSimilarDir)
		return foundInSimilarDir
	}
	
	return ""
}





// detectOldMountPoints analyzes media paths to find common old mount points
func (s *MediaScanner) detectOldMountPoints(mediaList []models.Media) map[string]int {
	mountPoints := make(map[string]int)
	
	for _, media := range mediaList {
		// Check if file doesn't exist (indicating potential mount point change)
		if _, err := os.Stat(media.FilePath); os.IsNotExist(err) {
			// Extract potential mount point patterns
			pathParts := strings.Split(media.FilePath, "/")
			
			// Common mount point patterns
			if len(pathParts) >= 4 {
				// /media/user/drive pattern
				if pathParts[1] == "media" && len(pathParts) >= 4 {
					mountPoint := "/" + strings.Join(pathParts[1:4], "/")
					mountPoints[mountPoint]++
				}
				// /mnt/drive pattern
				if pathParts[1] == "mnt" && len(pathParts) >= 3 {
					mountPoint := "/" + strings.Join(pathParts[1:3], "/")
					mountPoints[mountPoint]++
				}
			}
		}
	}
	
	return mountPoints
}

// DetectDriveChanges detects when external drives have been remounted with different paths
func (s *MediaScanner) DetectDriveChanges() error {
	log.Printf("🔍 Detecting drive changes and remounts...")
	
	// Get all media entries
	allMedia, err := s.getAllMediaFromDatabase()
	if err != nil {
		return err
	}
	
	// Group media by potential drive/mount point
	driveGroups := make(map[string][]models.Media)
	
	for _, media := range allMedia {
		driveRoot := s.extractDriveRoot(media.FilePath)
		driveGroups[driveRoot] = append(driveGroups[driveRoot], media)
	}
	
	// Check each drive group
	for driveRoot, mediaList := range driveGroups {
		if len(mediaList) == 0 {
			continue
		}
		
		// Check if any files in this drive group exist
		existingCount := 0
		for _, media := range mediaList {
			if _, err := os.Stat(media.FilePath); err == nil {
				existingCount++
			}
		}
		
		// If less than 10% of files exist, the drive might be remounted
		existenceRatio := float64(existingCount) / float64(len(mediaList))
		if existenceRatio < 0.1 {
			log.Printf("🚨 Potential drive remount detected for %s (%.1f%% files exist)", driveRoot, existenceRatio*100)
			
			// Try to find new mount point for this drive
			if newDriveRoot := s.findNewDriveLocation(mediaList); newDriveRoot != "" {
				log.Printf("🎯 Found potential new location: %s", newDriveRoot)
				s.migrateDrivePaths(mediaList, driveRoot, newDriveRoot)
			}
		}
	}
	
	return nil
}

// extractDriveRoot extracts the drive/mount point root from a path
func (s *MediaScanner) extractDriveRoot(path string) string {
	// Common patterns for drive roots
	patterns := []string{
		`^(/media/[^/]+/[^/]+)`,     // /media/user/drive
		`^(/mnt/[^/]+)`,             // /mnt/drive
		`^(/Volumes/[^/]+)`,         // /Volumes/drive (macOS)
		`^([A-Z]:)`,                 // C: (Windows)
	}
	
	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		if matches := re.FindStringSubmatch(path); len(matches) > 1 {
			return matches[1]
		}
	}
	
	// Fallback: use first two path components
	parts := strings.Split(filepath.Clean(path), string(filepath.Separator))
	if len(parts) >= 3 {
		return "/" + parts[1] + "/" + parts[2]
	}
	
	return filepath.Dir(path)
}

// findNewDriveLocation attempts to find where a drive has been remounted
func (s *MediaScanner) findNewDriveLocation(mediaList []models.Media) string {
	if len(mediaList) == 0 {
		return ""
	}
	
	// Take a sample of files to search for
	sampleSize := 5
	if len(mediaList) < sampleSize {
		sampleSize = len(mediaList)
	}
	
	sampleFiles := mediaList[:sampleSize]
	
	// Common mount points to check
	mountPoints := []string{
		"/media",
		"/mnt",
		"/Volumes", // macOS
	}
	
	for _, mountPoint := range mountPoints {
		if _, err := os.Stat(mountPoint); os.IsNotExist(err) {
			continue
		}
		
		// Check subdirectories in mount point
		entries, err := os.ReadDir(mountPoint)
		if err != nil {
			continue
		}
		
		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}
			
			potentialRoot := filepath.Join(mountPoint, entry.Name())
			
			// Check if sample files exist in this potential location
			foundCount := 0
			for _, media := range sampleFiles {
				relPath := s.extractRelativePathStructure(media.FilePath)
				potentialPath := filepath.Join(potentialRoot, relPath)
				
				if _, err := os.Stat(potentialPath); err == nil {
					foundCount++
				}
			}
			
			// If we found most of the sample files, this is likely the new location
			if float64(foundCount)/float64(len(sampleFiles)) > 0.6 {
				return potentialRoot
			}
		}
	}
	
	return ""
}

// migrateDrivePaths updates all media paths from old drive root to new drive root
func (s *MediaScanner) migrateDrivePaths(mediaList []models.Media, oldRoot, newRoot string) {
	log.Printf("🔄 Migrating %d media paths from %s to %s", len(mediaList), oldRoot, newRoot)
	
	var successCount, failCount int
	
	for _, media := range mediaList {
		// Calculate new path
		relativePath := strings.TrimPrefix(media.FilePath, oldRoot)
		newPath := filepath.Join(newRoot, relativePath)
		
		// Verify new path exists
		if _, err := os.Stat(newPath); err == nil {
			// Update media record
			oldPath := media.FilePath
			media.FilePath = newPath
			
			if fileInfo, err := os.Stat(newPath); err == nil {
				media.FileSize = fileInfo.Size()
			}
			
			if err := s.mediaService.UpdateMedia(&media); err != nil {
				log.Printf("❌ Failed to migrate path for %s: %v", media.Title, err)
				failCount++
			} else {
				log.Printf("✅ Migrated: %s -> %s", oldPath, newPath)
				successCount++
			}
		} else {
			log.Printf("⚠️ New path doesn't exist for %s: %s", media.Title, newPath)
			failCount++
		}
	}
	
	log.Printf("✅ Drive migration completed: %d successful, %d failed", successCount, failCount)
}

// findMediaFileByTitle searches for a media file by title in the current storage
func (s *MediaScanner) findMediaFileByTitle(title string) string {
	var foundPath string
	normalizedTitle := s.normalizeTitleForComparison(title)
	
	// Walk through media path to find files with similar titles
	filepath.Walk(s.mediaPath, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		
		// Check if it's a video file
		if !s.isVideoFile(path) {
			return nil
		}
		
		// Extract title from filename and compare
		metadata := s.extractMetadataWithCache(path)
		if metadata.Title != "" {
			normalizedFileTitle := s.normalizeTitleForComparison(metadata.Title)
			similarity := s.calculateTitleSimilarity(normalizedTitle, normalizedFileTitle)
			
			// If similarity is high enough, consider it a match
			if similarity > 0.8 {
				foundPath = path
				return filepath.SkipDir // Stop searching once found
			}
		}
		
		return nil
	})
	
	return foundPath
}

// RepairBrokenPaths is a comprehensive method to fix all broken media paths
// This is the main method you should call when external drives are remounted
func (s *MediaScanner) RepairBrokenPaths() error {
	log.Printf("🔧 Starting comprehensive broken path repair...")
	
	startTime := time.Now()
	
	// Step 1: Detect and migrate entire drives
	log.Printf("🔍 Step 1: Detecting drive changes...")
	if err := s.DetectDriveChanges(); err != nil {
		log.Printf("⚠️ Drive change detection failed: %v", err)
	}
	
	// Step 2: Smart path resolution for individual files
	log.Printf("🔍 Step 2: Smart path resolution...")
	if err := s.SmartPathResolution(); err != nil {
		log.Printf("⚠️ Smart path resolution failed: %v", err)
	}
	
	// Step 3: Get statistics on remaining broken paths
	allMedia, err := s.getAllMediaFromDatabase()
	if err != nil {
		return fmt.Errorf("failed to get media from database: %v", err)
	}
	
	var brokenPaths, repairedPaths int
	for _, media := range allMedia {
		if _, err := os.Stat(media.FilePath); os.IsNotExist(err) {
			brokenPaths++
		}
	}
	
	repairedPaths = len(allMedia) - brokenPaths
	
	duration := time.Since(startTime)
	log.Printf("✅ Path repair completed in %v", duration)
	log.Printf("📊 Repair Statistics:")
	log.Printf("   📁 Total media entries: %d", len(allMedia))
	log.Printf("   ✅ Paths working: %d", repairedPaths)
	log.Printf("   ❌ Paths still broken: %d", brokenPaths)
	
	if brokenPaths > 0 {
		log.Printf("⚠️ %d paths could not be automatically repaired", brokenPaths)
		log.Printf("💡 Consider running a full sync to handle remaining issues")
	}
	
	return nil
}

// GetBrokenPathsReport returns a detailed report of broken media paths
func (s *MediaScanner) GetBrokenPathsReport() (map[string]interface{}, error) {
	allMedia, err := s.getAllMediaFromDatabase()
	if err != nil {
		return nil, err
	}
	
	var brokenMedia []map[string]interface{}
	var workingCount int
	
	for _, media := range allMedia {
		if _, err := os.Stat(media.FilePath); os.IsNotExist(err) {
			brokenMedia = append(brokenMedia, map[string]interface{}{
				"id":       media.ID,
				"title":    media.Title,
				"path":     media.FilePath,
				"fileSize": media.FileSize,
				"type":     media.Type,
			})
		} else {
			workingCount++
		}
	}
	
	report := map[string]interface{}{
		"totalMedia":    len(allMedia),
		"workingPaths":  workingCount,
		"brokenPaths":   len(brokenMedia),
		"brokenMedia":   brokenMedia,
		"healthScore":   float64(workingCount) / float64(len(allMedia)) * 100,
	}
	
	return report, nil
}

// scheduleAssetGeneration schedules asset generation with batch-aware resource management
func (s *MediaScanner) scheduleAssetGeneration(media *models.Media, path string, needsThumbnail, needsPreview bool) {
	// Use a more intelligent scheduling approach for batch processing
	if needsThumbnail {
		go func() {
			// Smart queue management - check load and adjust timing
			queueDelay := s.calculateQueueDelay("thumbnail")
			if queueDelay > 0 {
				log.Printf("⏳ Delaying thumbnail generation for %s by %v (queue management)", media.Title, queueDelay)
				time.Sleep(queueDelay)
			}
			
			// Generate thumbnail with batch-optimized retry logic
			if err := s.generateAssetWithRetry("thumbnail", media, path); err != nil {
				log.Printf("❌ Failed to generate thumbnail for %s: %v", media.Title, err)
			}
		}()
	}
	
	if needsPreview {
		log.Printf("🎬 Scheduling optimized preview generation for: %s", media.Title)
		go func() {
			// Longer delay for previews as they're more resource intensive
			queueDelay := s.calculateQueueDelay("preview")
			if queueDelay > 0 {
				log.Printf("⏳ Delaying preview generation for %s by %v (queue management)", media.Title, queueDelay)
				time.Sleep(queueDelay)
			}
			
			// Generate preview with batch-optimized retry logic
			if err := s.generateAssetWithRetry("preview", media, path); err != nil {
				log.Printf("❌ Failed to generate preview for %s: %v", media.Title, err)
			}
		}()
	}
}

// calculateQueueDelay calculates appropriate delay based on current system load
func (s *MediaScanner) calculateQueueDelay(assetType string) time.Duration {
	// Check if thumbnail service is available and healthy
	if s.thumbnailService == nil {
		return 0
	}
	
	// Check queue health
	if !s.thumbnailService.IsQueueHealthy() {
		// Calculate delay based on asset type and current load
		baseDelay := 5 * time.Second
		if assetType == "preview" {
			baseDelay = 10 * time.Second // Previews need more resources
		}
		
		// Add some randomization to prevent thundering herd
		randomDelay := time.Duration(float64(baseDelay) * (0.5 + (float64(time.Now().UnixNano()%1000) / 2000.0)))
		return randomDelay
	}
	
	return 0
}

// generateAssetWithRetry generates assets with intelligent retry logic
func (s *MediaScanner) generateAssetWithRetry(assetType string, media *models.Media, path string) error {
	maxRetries := 3
	baseDelay := 2 * time.Second
	
	for attempt := 1; attempt <= maxRetries; attempt++ {
		var err error
		var assetPath string
		
		switch assetType {
		case "thumbnail":
			assetPath, err = s.thumbnailService.GenerateThumbnailAsync(path, media.ID, media.Title)
			if err == nil && assetPath != "" {
				media.ThumbnailPath = assetPath
				s.mediaService.UpdateMedia(media)
				log.Printf("✅ Batch-optimized thumbnail generated for: %s", media.Title)
				return nil
			}
		case "preview":
			assetPath, err = s.thumbnailService.GeneratePreviewClipAsync(path, media.ID, media.Title)
			if err == nil && assetPath != "" {
				media.PreviewPath = assetPath
				media.PreviewClipPath = assetPath
				s.mediaService.UpdateMedia(media)
				log.Printf("🎬 Batch-optimized preview generated for: %s", media.Title)
				return nil
			}
		}
		
		if err != nil {
			if attempt == maxRetries {
				return fmt.Errorf("failed after %d attempts: %v", maxRetries, err)
			}
			
			// Exponential backoff with jitter
			delay := time.Duration(attempt) * baseDelay
			jitter := time.Duration(float64(delay) * (0.1 + (float64(time.Now().UnixNano()%100) / 1000.0)))
			totalDelay := delay + jitter
			
			log.Printf("⚠️ %s generation attempt %d failed for %s, retrying in %v: %v", 
				assetType, attempt, media.Title, totalDelay, err)
			time.Sleep(totalDelay)
		}
	}
	
	return fmt.Errorf("all retry attempts failed")
}

// OptimizeBatchProcessing adjusts scanner settings for optimal batch processing
func (s *MediaScanner) OptimizeBatchProcessing() {
	// Adjust worker count based on system capabilities
	if s.maxWorkers < 4 {
		s.maxWorkers = 4
		log.Printf("🔧 Increased workers to %d for better batch processing", s.maxWorkers)
	}
	
	// Optimize batch size for current workload
	if s.batchSize < 10 {
		s.batchSize = 15
		log.Printf("🔧 Increased batch size to %d for better throughput", s.batchSize)
	}
	
	// Initialize queues with larger capacity for batch processing
	if cap(s.priorityQueue) < 200 {
		s.priorityQueue = make(chan FileInfo, 200)
		s.lowPriorityQueue = make(chan FileInfo, 1000)
		log.Printf("🔧 Increased queue capacity for batch processing")
	}
}

// BatchScanMediaLibrary performs an optimized batch scan of the media library
func (s *MediaScanner) BatchScanMediaLibrary() error {
	s.stats.StartTime = time.Now()
	log.Printf("🚀 Starting batch-optimized media library scan at: %s", s.mediaPath)

	// Enable batch mode to disable ALAC auto-extraction during scanning
	if s.alacService != nil {
		s.alacService.SetBatchMode(true)
		defer s.alacService.SetBatchMode(false) // Re-enable after scanning
	}

	// Optimize settings for batch processing
	s.OptimizeBatchProcessing()

	// Check if media path exists
	if _, err := os.Stat(s.mediaPath); os.IsNotExist(err) {
		log.Printf("❌ Media path does not exist: %s", s.mediaPath)
		return fmt.Errorf("media path does not exist: %s", s.mediaPath)
	}

	// Phase 1: Fast file discovery with pre-filtering
	log.Printf("📂 Phase 1: Batch file discovery...")
	files, err := s.batchDiscoverFiles()
	if err != nil {
		return fmt.Errorf("batch file discovery failed: %v", err)
	}

	s.stats.TotalFiles = len(files)
	log.Printf("📊 Discovered %d files (%d videos, %d subtitles)", 
		s.stats.TotalFiles, 
		s.countFilesByType(files, true, false),
		s.countFilesByType(files, false, true))

	// Phase 2: Intelligent batch processing
	log.Printf("⚡ Phase 2: Intelligent batch processing...")
	if err := s.processFilesBatch(files); err != nil {
		log.Printf("⚠️ Some batches had errors: %v", err)
	}

	// Phase 3: Results and cleanup
	s.stats.ScanDuration = time.Since(s.stats.StartTime)
	s.logScanResults()

	// Refresh recommendations after batch processing
	if s.recommendationService != nil && s.stats.ProcessedFiles > 0 {
		log.Println("🔄 Refreshing recommendations after batch scan...")
		if err := s.recommendationService.RefreshRecommendations(); err != nil {
			log.Printf("⚠️ Warning: Failed to refresh recommendations: %v", err)
		} else {
			log.Println("✅ Recommendations refreshed successfully")
		}
	}

	return nil
}

// batchDiscoverFiles performs optimized file discovery for batch processing
func (s *MediaScanner) batchDiscoverFiles() ([]FileInfo, error) {
	var files []FileInfo
	var mu sync.Mutex
	
	// Pre-allocate with estimated capacity
	files = make([]FileInfo, 0, 2000)
	
	// Use buffered channel for better performance
	fileChan := make(chan FileInfo, 2000)
	done := make(chan bool)
	
	// Start collector goroutine with batch collection
	go func() {
		defer close(done)
		batch := make([]FileInfo, 0, 100)
		
		for file := range fileChan {
			batch = append(batch, file)
			
			// Process in mini-batches for better memory usage
			if len(batch) >= 100 {
				mu.Lock()
				files = append(files, batch...)
				mu.Unlock()
				batch = batch[:0] // Reset batch
			}
		}
		
		// Process remaining files
		if len(batch) > 0 {
			mu.Lock()
			files = append(files, batch...)
			mu.Unlock()
		}
	}()

	// Parallel directory walking with worker pool
	var wg sync.WaitGroup
	walkSemaphore := make(chan struct{}, 4) // Limit concurrent directory walkers
	
	err := filepath.Walk(s.mediaPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			log.Printf("⚠️ Error accessing path %s: %v", path, err)
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
		for _, pattern := range s.skipPatterns {
			if matched, _ := filepath.Match(pattern, fileName); matched {
				return nil
			}
		}

		// Ultra-fast file type detection
		ext := strings.ToLower(filepath.Ext(path))
		isVideo := s.isVideoFileByExtension(ext)
		isSubtitle := s.isSubtitleFileByExtension(ext)

		if isVideo || isSubtitle {
			wg.Add(1)
			go func(p string, i os.FileInfo) {
				defer wg.Done()
				
				walkSemaphore <- struct{}{}
				defer func() { <-walkSemaphore }()
				
				fileInfo := FileInfo{
					Path:       p,
					Info:       i,
					IsVideo:    isVideo,
					IsSubtitle: isSubtitle,
				}
				
				select {
				case fileChan <- fileInfo:
				default:
					// Channel full, add directly (fallback)
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
	<-done // Wait for collector to finish

	return files, err
}

// logSyncResults logs the final sync statistics
func (s *MediaScanner) logSyncResults(total, valid, invalid, updated, orphaned int) {
	log.Printf("✅ Database-Storage sync completed in %v", s.stats.ScanDuration)
	log.Printf("📊 Sync Statistics:")
	log.Printf("   📁 Total database entries: %d", total)
	log.Printf("   ✅ Valid entries: %d", valid)
	log.Printf("   ❌ Invalid entries: %d", invalid)
	log.Printf("   🔄 Updated entries: %d", updated)
	log.Printf("   🆕 Orphaned files found: %d", orphaned)
	log.Printf("   ✅ Successfully processed: %d", s.stats.ProcessedFiles)
	log.Printf("   ❌ Errors: %d", s.stats.ErrorFiles)
	
	if total > 0 {
		syncRate := float64(valid+updated) / float64(total) * 100
		log.Printf("   📈 Sync success rate: %.1f%%", syncRate)
	}
}