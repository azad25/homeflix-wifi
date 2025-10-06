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
	metadataCache    map[string]*MediaMetadata
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
		metadataCache:    make(map[string]*MediaMetadata),
		stats:            ScanStats{},
		skipPatterns:     []string{".DS_Store", "Thumbs.db", ".tmp", ".temp", "._*"},
		priorityQueue:    make(chan FileInfo, 100),
		lowPriorityQueue: make(chan FileInfo, 500),
	}
}

func (s *MediaScanner) ScanMediaLibrary() error {
	s.stats.StartTime = time.Now()
	log.Printf("🔍 Starting optimized media library scan at: %s", s.mediaPath)

	// Check if media path exists
	if _, err := os.Stat(s.mediaPath); os.IsNotExist(err) {
		log.Printf("❌ Media path does not exist: %s", s.mediaPath)
		return fmt.Errorf("media path does not exist: %s", s.mediaPath)
	}

	// Phase 1: Fast file discovery
	log.Printf("📂 Phase 1: Discovering files...")
	files, err := s.discoverFiles()
	if err != nil {
		return fmt.Errorf("file discovery failed: %v", err)
	}

	s.stats.TotalFiles = len(files)
	log.Printf("📊 Discovered %d files (%d videos, %d subtitles)", 
		s.stats.TotalFiles, 
		s.countFilesByType(files, true, false),
		s.countFilesByType(files, false, true))

	// Phase 2: Sequential processing for asset generation
	log.Printf("⚡ Phase 2: Processing files sequentially...")
	if err := s.processFilesSequential(files); err != nil {
		log.Printf("⚠️ Some files failed to process: %v", err)
	}

	// Phase 3: Cleanup and statistics
	s.stats.ScanDuration = time.Since(s.stats.StartTime)
	s.logScanResults()

	// Refresh recommendations after scanning new media
	if s.recommendationService != nil && s.stats.ProcessedFiles > 0 {
		log.Println("🔄 Refreshing recommendations after media scan...")
		if err := s.recommendationService.RefreshRecommendations(); err != nil {
			log.Printf("⚠️ Warning: Failed to refresh recommendations: %v", err)
		} else {
			log.Println("✅ Recommendations refreshed successfully")
		}
	}

	return nil
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
	// Check if media already exists by current path
	media, err := s.mediaService.GetMediaByPath(path)
	if err != nil {
		log.Printf("Error checking if media exists for %s: %v", path, err)
		return err
	}

	// If not found by current path, try to find by filename (handle path corrections)
	if media == nil {
		filename := filepath.Base(path)
		existingMedia, err := s.findMediaByFilename(filename)
		if err != nil {
			log.Printf("Error searching for existing media by filename %s: %v", filename, err)
		} else if existingMedia != nil {
			// Found existing media with different path - update the path
			log.Printf("Found existing media with old path %s, updating to new path %s", existingMedia.FilePath, path)
			existingMedia.FilePath = path
			existingMedia.FileSize = info.Size()
			media = existingMedia
		}
	}

	if media != nil {
		// Media exists, check if any fields are empty or assets are missing
		needsUpdate := s.needsMetadataUpdate(media)
		missingAssets := media.ThumbnailPath == "" || media.PosterPath == "" || media.PreviewPath == ""
		pathChanged := media.FilePath != path
		
		if !needsUpdate && !missingAssets && !pathChanged {
			log.Printf("Media already exists with complete data and assets, skipping: %s", path)
			return nil
		}
		
		if needsUpdate {
			log.Printf("Media exists but has empty fields, updating metadata: %s", path)
		}
		if missingAssets {
			log.Printf("Media exists but missing assets, generating: %s", path)
		}
		if pathChanged {
			log.Printf("Media path changed from %s to %s, updating", media.FilePath, path)
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
		log.Printf("Processing new media: %s", path)
	}

	// Extract metadata from filename and path (with caching)
	metadata := s.extractMetadataWithCache(path)
	media.Title = metadata.Title
	media.Type = metadata.Type

	// If it's an episode, find or create the series
	if metadata.Type == "episode" && metadata.SeriesTitle != "" {
		series, err := s.mediaService.FindOrCreateSeries(metadata.SeriesTitle)
		if err != nil {
			log.Printf("Error finding/creating series %s: %v", metadata.SeriesTitle, err)
			return err
		}
		media.SeriesID = &series.ID
	}

	// Save or update media to database
	if media.ID == 0 {
		if err := s.mediaService.CreateMedia(media); err != nil {
			log.Printf("Error creating media %s: %v", media.Title, err)
			return err
		}
	} else {
		if err := s.mediaService.UpdateMedia(media); err != nil {
			log.Printf("Error updating media %s: %v", media.Title, err)
			return err
		}
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
				log.Printf("Enhanced metadata from TMDB for: %s", media.Title)
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

	// Generate assets only if missing
	needsThumbnail := media.ThumbnailPath == "" && !thumbnailExists
	needsPreview := (media.PreviewPath == "" || media.PreviewClipPath == "") && !previewExists
	needsPoster := media.PosterPath == "" && !posterExists

	// Debug logging for preview generation
	log.Printf("🔍 Asset check for %s: needsThumbnail=%v, needsPreview=%v (PreviewPath='%s', PreviewClipPath='%s'), needsPoster=%v", 
		media.Title, needsThumbnail, needsPreview, media.PreviewPath, media.PreviewClipPath, needsPoster)

	// Generate assets using optimized service with retry logic and queue health check
	if needsThumbnail {
		go func() {
			// Check queue health before submitting
			if !s.thumbnailService.IsQueueHealthy() {
				log.Printf("⚠️ Thumbnail service queue overloaded, delaying thumbnail generation for %s", media.Title)
				time.Sleep(10 * time.Second) // Wait for queue to clear
			}
			
			// Retry logic for thumbnail generation
			maxRetries := 3
			for attempt := 1; attempt <= maxRetries; attempt++ {
				if _, err := s.thumbnailService.GenerateThumbnailAsync(path, media.ID, media.Title); err != nil {
					if attempt == maxRetries {
						log.Printf("❌ Failed to generate thumbnail for %s after %d attempts: %v", media.Title, maxRetries, err)
					} else {
						log.Printf("⚠️ Thumbnail generation attempt %d failed for %s, retrying in %ds: %v", attempt, media.Title, attempt*2, err)
						time.Sleep(time.Duration(attempt*2) * time.Second)
					}
				} else {
					// Update media record with thumbnail path
					thumbnailPath := s.thumbnailService.GetThumbnailPath(media.ID, media.Title)
					if thumbnailPath != "" {
						media.ThumbnailPath = thumbnailPath
						s.mediaService.UpdateMedia(media)
					}
					log.Printf("✅ Optimized thumbnail generation completed for: %s", media.Title)
					break
				}
			}
		}()
	}
	
	if needsPreview {
		log.Printf("🎬 Starting optimized preview generation for: %s", media.Title)
		go func() {
			// Check queue health before submitting
			if !s.thumbnailService.IsQueueHealthy() {
				log.Printf("⚠️ Thumbnail service queue overloaded, delaying preview generation for %s", media.Title)
				time.Sleep(15 * time.Second) // Wait longer for previews as they're more resource intensive
			}
			
			// Retry logic for preview generation
			maxRetries := 3
			for attempt := 1; attempt <= maxRetries; attempt++ {
				if previewPath, err := s.thumbnailService.GeneratePreviewClipAsync(path, media.ID, media.Title); err != nil {
					if attempt == maxRetries {
						log.Printf("❌ Failed to generate preview for %s after %d attempts: %v", media.Title, maxRetries, err)
					} else {
						log.Printf("⚠️ Preview generation attempt %d failed for %s, retrying in %ds: %v", attempt, media.Title, attempt*3, err)
						time.Sleep(time.Duration(attempt*3) * time.Second)
					}
				} else {
					// Update media record with preview paths
					media.PreviewPath = previewPath
					media.PreviewClipPath = previewPath
					s.mediaService.UpdateMedia(media)
					log.Printf("🎬 Optimized preview generation completed for: %s", media.Title)
					break
				}
			}
		}()
	} else {
		log.Printf("⏭️ Skipping preview generation for %s - already exists", media.Title)
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

	// Extract ALAC audio if service available
	if s.alacService != nil {
		if audioPath, err := s.alacService.ExtractALACAudio(path, int(media.ID)); err != nil {
			log.Printf("Failed to extract ALAC audio for %s: %v", media.Title, err)
		} else {
			log.Printf("ALAC audio extracted: %s", audioPath)
		}
	}

	log.Printf("Successfully processed media: %s (Type: %s, Size: %d bytes)", media.Title, media.Type, media.FileSize)
	return nil
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
func (s *MediaScanner) extractMetadataWithCache(path string) *MediaMetadata {
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

// findMediaByFilename searches for existing media by filename to handle path corrections
func (s *MediaScanner) findMediaByFilename(filename string) (*models.Media, error) {
	// Try common old path patterns to find existing media
	oldPaths := []string{
		"/media/azad/Movies1/" + filename,
		"/media/azad/Movies1/" + filepath.Dir(filename) + "/" + filepath.Base(filename),
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

type MediaMetadata struct {
	Title         string
	Type          string // "movie" or "episode"
	SeriesTitle   string
	SeasonNumber  *int
	EpisodeNumber *int
}

func (s *MediaScanner) extractMetadata(path string) *MediaMetadata {
	filename := filepath.Base(path)
	filenameWithoutExt := strings.TrimSuffix(filename, filepath.Ext(filename))
	
	metadata := &MediaMetadata{
		Title: filenameWithoutExt,
		Type:  "movie", // Default to movie
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
		basicTitle = regexp.MustCompile(`\s+`).ReplaceAllString(basicTitle, " ")
		basicTitle = strings.TrimSpace(basicTitle)
		
		if basicTitle != "" {
			metadata.Title = basicTitle
			log.Printf("   📝 Final fallback title: %s", metadata.Title)
		} else {
			// Absolute last resort
			metadata.Title = "Unknown Movie"
			log.Printf("   ❌ Could not extract any title, using: %s", metadata.Title)
		}
	}
	
	return metadata
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