package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/scanner"
)

// ScannerHandlers handles media scanning operations
type ScannerHandlers struct {
	scanner *scanner.MediaScanner
}

// NewScannerHandlers creates new scanner handlers
func NewScannerHandlers(scanner *scanner.MediaScanner) *ScannerHandlers {
	return &ScannerHandlers{
		scanner: scanner,
	}
}

// StartFullScan starts a full media library scan
func (h *ScannerHandlers) StartFullScan(c *gin.Context) {
	go func() {
		if err := h.scanner.ScanMediaLibrary(); err != nil {
			// Log error but don't block response
		}
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "Full media scan started",
		"status":  "running",
	})
}

// StartIncrementalScan starts an incremental scan for new/modified files
func (h *ScannerHandlers) StartIncrementalScan(c *gin.Context) {
	go func() {
		if err := h.scanner.IncrementalScan(); err != nil {
			// Log error but don't block response
		}
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "Incremental scan started",
		"status":  "running",
	})
}

// StartSuperfastScan starts the fastest possible scan
func (h *ScannerHandlers) StartSuperfastScan(c *gin.Context) {
	go func() {
		if err := h.scanner.SuperfastScan(); err != nil {
			// Log error but don't block response
		}
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "Superfast scan started",
		"status":  "running",
	})
}

// StartScanAndSync starts a comprehensive scan and sync operation
func (h *ScannerHandlers) StartScanAndSync(c *gin.Context) {
	go func() {
		if err := h.scanner.ScanAndSyncMediaLibrary(); err != nil {
			// Log error but don't block response
		}
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "Comprehensive scan and sync started",
		"description": "This will sync all database entries with storage and regenerate assets",
		"status":  "running",
	})
}

// StartDatabaseSync starts database-storage synchronization
func (h *ScannerHandlers) StartDatabaseSync(c *gin.Context) {
	go func() {
		if err := h.scanner.SyncDatabaseWithStorage(); err != nil {
			// Log error but don't block response
		}
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "Database-storage sync started",
		"description": "This will validate all database entries against storage and remove non-existent files",
		"status":  "running",
	})
}



// StartCleanupInvalidEntries starts cleanup of invalid database entries
func (h *ScannerHandlers) StartCleanupInvalidEntries(c *gin.Context) {
	go func() {
		if err := h.scanner.CleanupInvalidEntries(); err != nil {
			// Log error but don't block response
		}
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "Invalid entries cleanup started",
		"description": "This will remove database entries for media files that no longer exist in storage",
		"status":  "running",
	})
}

// RegenerateAllAssets regenerates all thumbnails, previews, and posters
func (h *ScannerHandlers) RegenerateAllAssets(c *gin.Context) {
	go func() {
		if err := h.scanner.RegenerateAllAssets(); err != nil {
			// Log error but don't block response
		}
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "Asset regeneration started",
		"description": "This will regenerate thumbnails, previews, and posters for all media",
		"status":  "running",
	})
}

// RegeneratePreviewClips regenerates preview clips for all media
func (h *ScannerHandlers) RegeneratePreviewClips(c *gin.Context) {
	go func() {
		if err := h.scanner.RegeneratePreviewClips(); err != nil {
			// Log error but don't block response
		}
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "Preview clip regeneration started",
		"description": "This will regenerate preview clips for all media that need them",
		"status":  "running",
	})
}

// RegenerateMissingPreviewClips regenerates preview clips only for media that are completely missing them
func (h *ScannerHandlers) RegenerateMissingPreviewClips(c *gin.Context) {
	go func() {
		if err := h.scanner.RegeneratePreviewClipsForMissingOnly(); err != nil {
			// Log error but don't block response
		}
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "Missing preview clip regeneration started",
		"description": "This will generate preview clips only for media that are completely missing them",
		"status":  "running",
	})
}

// GetScanStats returns current scan statistics
func (h *ScannerHandlers) GetScanStats(c *gin.Context) {
	stats := h.scanner.GetScanStats()
	
	c.JSON(http.StatusOK, gin.H{
		"stats": stats,
	})
}

// ConfigureScanner allows configuration of scanner parameters
func (h *ScannerHandlers) ConfigureScanner(c *gin.Context) {
	var config struct {
		MaxWorkers int `json:"max_workers"`
		BatchSize  int `json:"batch_size"`
	}

	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid configuration"})
		return
	}

	if config.MaxWorkers > 0 {
		h.scanner.SetMaxWorkers(config.MaxWorkers)
	}

	if config.BatchSize > 0 {
		h.scanner.SetBatchSize(config.BatchSize)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Scanner configuration updated",
		"config":  config,
	})
}

// SetMaxWorkers sets the maximum number of worker goroutines
func SetMaxWorkers(scanner *scanner.MediaScanner) gin.HandlerFunc {
	return func(c *gin.Context) {
		workersStr := c.Param("workers")
		workers, err := strconv.Atoi(workersStr)
		if err != nil || workers < 1 || workers > 32 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid worker count (1-32)"})
			return
		}

		scanner.SetMaxWorkers(workers)
		c.JSON(http.StatusOK, gin.H{
			"message": "Max workers updated",
			"workers": workers,
		})
	}
}

// SetBatchSize sets the batch size for processing
func SetBatchSize(scanner *scanner.MediaScanner) gin.HandlerFunc {
	return func(c *gin.Context) {
		sizeStr := c.Param("size")
		size, err := strconv.Atoi(sizeStr)
		if err != nil || size < 1 || size > 1000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid batch size (1-1000)"})
			return
		}

		scanner.SetBatchSize(size)
		c.JSON(http.StatusOK, gin.H{
			"message": "Batch size updated",
			"size":    size,
		})
	}
}