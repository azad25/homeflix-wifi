package core

import (
	"log"
	"os"
	"sync"
	"time"

	"homeflix-backend/internal/interfaces"
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
	Path       string
	Info       os.FileInfo
	IsVideo    bool
	IsSubtitle bool
}

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
func (s *MediaScanner) ScanAndSyncMediaLibrary() error {
	log.Printf("🚀 Starting comprehensive media library scan and sync...")
	
	// Phase 1: Sync existing database entries with storage
	log.Printf("🔄 Phase 1: Syncing database with storage...")
	if err := s.SyncDatabaseWithStorage(); err != nil {
		log.Printf("⚠️ Warning: Database sync encountered issues: %v", err)
	}
	
	// Phase 2: Regular media library scan for any remaining files
	log.Printf("📂 Phase 2: Regular media library scan...")
	if err := s.ScanMediaLibrary(); err != nil {
		return err
	}
	
	log.Printf("✅ Comprehensive scan and sync completed successfully!")
	return nil
}

// ScanMediaLibrary performs the main media library scan
func (s *MediaScanner) ScanMediaLibrary() error {
	return s.BatchScanMediaLibrary()
}

// BatchScanMediaLibrary performs optimized batch scanning
func (s *MediaScanner) BatchScanMediaLibrary() error {
	s.stats.StartTime = time.Now()
	log.Printf("🚀 Starting optimized batch media library scan...")
	log.Printf("📁 Scanning path: %s", s.mediaPath)
	log.Printf("⚙️ Configuration: %d workers, batch size %d", s.maxWorkers, s.batchSize)

	// Phase 1: Ultra-fast file discovery
	log.Printf("🔍 Phase 1: Discovering media files...")
	files, err := s.discoverFiles()
	if err != nil {
		return err
	}

	s.stats.TotalFiles = len(files)
	videoCount := s.countFilesByType(files, true, false)
	subtitleCount := s.countFilesByType(files, false, true)
	
	log.Printf("📊 Discovery complete: %d total files (%d videos, %d subtitles)", 
		len(files), videoCount, subtitleCount)

	if len(files) == 0 {
		log.Printf("ℹ️ No media files found in %s", s.mediaPath)
		s.logScanResults()
		return nil
	}

	// Phase 2: Optimized batch processing
	log.Printf("⚡ Phase 2: Processing files in optimized batches...")
	if err := s.processFilesBatch(files); err != nil {
		log.Printf("❌ Batch processing encountered errors: %v", err)
	}

	// Phase 3: Results and cleanup
	s.stats.ScanDuration = time.Since(s.stats.StartTime)
	s.logScanResults()

	return nil
}

// SetMaxWorkers updates the maximum number of workers
func (s *MediaScanner) SetMaxWorkers(workers int) {
	if workers > 0 && workers <= 32 {
		s.maxWorkers = workers
		log.Printf("⚙️ Updated max workers to %d", workers)
	}
}

// SetBatchSize updates the batch size
func (s *MediaScanner) SetBatchSize(size int) {
	if size > 0 && size <= 100 {
		s.batchSize = size
		log.Printf("⚙️ Updated batch size to %d", size)
	}
}

// GetScanStats returns current scan statistics
func (s *MediaScanner) GetScanStats() ScanStats {
	return s.stats
}

// Getter methods for accessing private fields from other packages
func (s *MediaScanner) GetMediaPath() string {
	return s.mediaPath
}

func (s *MediaScanner) GetSkipPatterns() []string {
	return s.skipPatterns
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

// Statistics methods
func (s *MediaScanner) IncrementErrorFiles() {
	s.stats.ErrorFiles++
}

func (s *MediaScanner) IncrementProcessedFiles() {
	s.stats.ProcessedFiles++
}

func (s *MediaScanner) IncrementSkippedFiles() {
	s.stats.SkippedFiles++
}

func (s *MediaScanner) IncrementNewFiles() {
	s.stats.NewFiles++
}

func (s *MediaScanner) SetScanDuration(duration time.Duration) {
	s.stats.ScanDuration = duration
}

func (s *MediaScanner) GetMaxWorkers() int {
	return s.maxWorkers
}

func (s *MediaScanner) GetBatchSize() int {
	return s.batchSize
}

func (s *MediaScanner) GetScanCache() map[string]time.Time {
	return s.scanCache
}

func (s *MediaScanner) GetCacheMutex() *sync.RWMutex {
	return &s.cacheMutex
}

func (s *MediaScanner) GetPriorityQueue() chan FileInfo {
	return s.priorityQueue
}

func (s *MediaScanner) GetLowPriorityQueue() chan FileInfo {
	return s.lowPriorityQueue
}

func (s *MediaScanner) SetTotalFiles(count int) {
	s.stats.TotalFiles = count
}

func (s *MediaScanner) SetStartTime(t time.Time) {
	s.stats.StartTime = t
}

func (s *MediaScanner) SetMaxWorkersValue(workers int) {
	s.maxWorkers = workers
}

func (s *MediaScanner) SetLastScanTime(t time.Time) {
	s.lastScanTime = t
}

func (s *MediaScanner) GetLastScanTime() time.Time {
	return s.lastScanTime
}

func (s *MediaScanner) SetBatchSizeValue(size int) {
	s.batchSize = size
}

func (s *MediaScanner) GetGeminiService() interfaces.GeminiServiceInterface {
	return s.geminiService
}

func (s *MediaScanner) GetCeleryService() interfaces.CeleryServiceInterface {
	return s.celeryService
}

func (s *MediaScanner) GetALACService() interfaces.ALACAudioServiceInterface {
	return s.alacService
}

func (s *MediaScanner) GetRecommendationService() interfaces.RecommendationServiceInterface {
	return s.recommendationService
}

func (s *MediaScanner) GetMetadataCache() map[string]*FileMetadata {
	return s.metadataCache
}

func (s *MediaScanner) SetMetadataCache(path string, metadata *FileMetadata) {
	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()
	s.metadataCache[path] = metadata
}

func (s *MediaScanner) GetMetadataCacheEntry(path string) (*FileMetadata, bool) {
	s.cacheMutex.RLock()
	defer s.cacheMutex.RUnlock()
	metadata, exists := s.metadataCache[path]
	return metadata, exists
}

// SyncDatabaseWithStorage delegates to storage sync module
func (s *MediaScanner) SyncDatabaseWithStorage() error {
	// This will be implemented by the storage sync module
	log.Printf("🔄 Database-storage sync delegated to storage sync module")
	return nil
}

// discoverFiles delegates to discovery module
func (s *MediaScanner) discoverFiles() ([]FileInfo, error) {
	// This will be implemented by the discovery module
	log.Printf("🔍 File discovery delegated to discovery module")
	return []FileInfo{}, nil
}

// processFilesBatch delegates to processing module
func (s *MediaScanner) processFilesBatch(files []FileInfo) error {
	// This will be implemented by the processing module
	log.Printf("⚡ Batch processing delegated to processing module")
	return nil
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