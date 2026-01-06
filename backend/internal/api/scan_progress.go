package api

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// ScanProgress represents the current scanning progress
type ScanProgress struct {
	IsScanning      bool     `json:"isScanning"`
	CurrentStep     string   `json:"currentStep"`
	Progress        float64  `json:"progress"`
	TotalFiles      int      `json:"totalFiles"`
	ProcessedFiles  int      `json:"processedFiles"`
	Errors          []string `json:"errors"`
	Warnings        []string `json:"warnings"`
	CurrentFile     string   `json:"currentFile"`
	ETA             string   `json:"eta"`
	StartTime       time.Time `json:"startTime"`
	LastUpdate      time.Time `json:"lastUpdate"`
}

// Global scan progress state
var (
	currentScanProgress = &ScanProgress{
		IsScanning: false,
		Errors:     []string{},
		Warnings:   []string{},
	}
	scanProgressMutex sync.RWMutex
)

// UpdateScanProgress updates the global scan progress
func UpdateScanProgress(progress *ScanProgress) {
	scanProgressMutex.Lock()
	defer scanProgressMutex.Unlock()
	
	progress.LastUpdate = time.Now()
	currentScanProgress = progress
}

// GetScanProgress returns the current scan progress
func GetScanProgress() *ScanProgress {
	scanProgressMutex.RLock()
	defer scanProgressMutex.RUnlock()
	
	// Create a copy to avoid race conditions
	progress := *currentScanProgress
	return &progress
}

// StartScanProgress initializes a new scan progress
func StartScanProgress(totalFiles int) {
	scanProgressMutex.Lock()
	defer scanProgressMutex.Unlock()
	
	currentScanProgress = &ScanProgress{
		IsScanning:     true,
		CurrentStep:    "Initializing scan...",
		Progress:       0,
		TotalFiles:     totalFiles,
		ProcessedFiles: 0,
		Errors:         []string{},
		Warnings:       []string{},
		CurrentFile:    "",
		ETA:            "Calculating...",
		StartTime:      time.Now(),
		LastUpdate:     time.Now(),
	}
}

// CompleteScanProgress marks the scan as complete
func CompleteScanProgress() {
	scanProgressMutex.Lock()
	defer scanProgressMutex.Unlock()
	
	currentScanProgress.IsScanning = false
	currentScanProgress.CurrentStep = "Scan completed"
	currentScanProgress.Progress = 100
	currentScanProgress.CurrentFile = ""
	currentScanProgress.ETA = ""
	currentScanProgress.LastUpdate = time.Now()
}

// AddScanError adds an error to the scan progress
func AddScanError(err string) {
	scanProgressMutex.Lock()
	defer scanProgressMutex.Unlock()
	
	currentScanProgress.Errors = append(currentScanProgress.Errors, err)
	currentScanProgress.LastUpdate = time.Now()
	
	// Keep only the last 50 errors to prevent memory issues
	if len(currentScanProgress.Errors) > 50 {
		currentScanProgress.Errors = currentScanProgress.Errors[len(currentScanProgress.Errors)-50:]
	}
}

// AddScanWarning adds a warning to the scan progress
func AddScanWarning(warning string) {
	scanProgressMutex.Lock()
	defer scanProgressMutex.Unlock()
	
	currentScanProgress.Warnings = append(currentScanProgress.Warnings, warning)
	currentScanProgress.LastUpdate = time.Now()
	
	// Keep only the last 50 warnings to prevent memory issues
	if len(currentScanProgress.Warnings) > 50 {
		currentScanProgress.Warnings = currentScanProgress.Warnings[len(currentScanProgress.Warnings)-50:]
	}
}

// UpdateScanFile updates the currently processing file
func UpdateScanFile(filename string, processed int) {
	scanProgressMutex.Lock()
	defer scanProgressMutex.Unlock()
	
	currentScanProgress.CurrentFile = filename
	currentScanProgress.ProcessedFiles = processed
	
	// Calculate progress
	if currentScanProgress.TotalFiles > 0 {
		currentScanProgress.Progress = float64(processed) / float64(currentScanProgress.TotalFiles) * 100
	}
	
	// Calculate ETA
	if processed > 0 && currentScanProgress.Progress > 0 {
		elapsed := time.Since(currentScanProgress.StartTime)
		totalEstimated := time.Duration(float64(elapsed) / (currentScanProgress.Progress / 100))
		remaining := totalEstimated - elapsed
		
		if remaining > 0 {
			if remaining > time.Hour {
				currentScanProgress.ETA = remaining.Truncate(time.Minute).String()
			} else if remaining > time.Minute {
				currentScanProgress.ETA = remaining.Truncate(time.Second).String()
			} else {
				currentScanProgress.ETA = remaining.Truncate(time.Second).String()
			}
		} else {
			currentScanProgress.ETA = "Almost done"
		}
	}
	
	currentScanProgress.LastUpdate = time.Now()
}

// GetScanProgressHandler returns the current scan progress as JSON
func (h *Handler) GetScanProgressHandler(c *gin.Context) {
	progress := GetScanProgress()
	c.JSON(http.StatusOK, progress)
}

// StartFullScanHandler starts a full media scan with progress tracking
func (h *Handler) StartFullScanHandler(c *gin.Context) {
	var request struct {
		Paths           []string `json:"paths"`
		GenerateAssets  bool     `json:"generateAssets"`
		UpdateMetadata  bool     `json:"updateMetadata"`
	}
	
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
		return
	}
	
	// Check if a scan is already running
	if GetScanProgress().IsScanning {
		c.JSON(http.StatusConflict, gin.H{"error": "A scan is already in progress"})
		return
	}
	
	// Start scan in background
	go func() {
		h.performFullScan(request.Paths, request.GenerateAssets, request.UpdateMetadata)
	}()
	
	c.JSON(http.StatusOK, gin.H{
		"message": "Full scan started successfully",
		"scanId":  "full-scan-" + time.Now().Format("20060102-150405"),
	})
}

// performFullScan performs the actual scanning with progress updates
func (h *Handler) performFullScan(paths []string, generateAssets, updateMetadata bool) {
	defer func() {
		if r := recover(); r != nil {
			AddScanError("Scan failed with panic: " + string(r.([]byte)))
			CompleteScanProgress()
		}
	}()
	
	// Initialize progress
	StartScanProgress(0)
	
	// Phase 1: Count total files
	UpdateScanProgress(&ScanProgress{
		IsScanning:  true,
		CurrentStep: "Counting media files...",
		Progress:    0,
		StartTime:   time.Now(),
		LastUpdate:  time.Now(),
		Errors:      []string{},
		Warnings:    []string{},
	})
	
	totalFiles := 0
	for _, path := range paths {
		count, err := h.countMediaFiles(path)
		if err != nil {
			AddScanError("Failed to count files in " + path + ": " + err.Error())
			continue
		}
		totalFiles += count
	}
	
	if totalFiles == 0 {
		AddScanWarning("No media files found in specified paths")
		CompleteScanProgress()
		return
	}
	
	// Update with total count
	progress := GetScanProgress()
	progress.TotalFiles = totalFiles
	progress.CurrentStep = "Scanning media files..."
	UpdateScanProgress(progress)
	
	// Phase 2: Process files
	processedFiles := 0
	for _, path := range paths {
		err := h.scanPath(path, &processedFiles, generateAssets, updateMetadata)
		if err != nil {
			AddScanError("Failed to scan path " + path + ": " + err.Error())
		}
	}
	
	// Phase 3: Generate missing assets (if requested)
	if generateAssets {
		progress := GetScanProgress()
		progress.CurrentStep = "Generating thumbnails and posters..."
		progress.Progress = 90
		UpdateScanProgress(progress)
		
		err := h.generateMissingAssets()
		if err != nil {
			AddScanError("Failed to generate assets: " + err.Error())
		}
	}
	
	// Phase 4: Update metadata (if requested)
	if updateMetadata {
		progress := GetScanProgress()
		progress.CurrentStep = "Updating metadata from TMDB..."
		progress.Progress = 95
		UpdateScanProgress(progress)
		
		err := h.updateAllMetadata()
		if err != nil {
			AddScanError("Failed to update metadata: " + err.Error())
		}
	}
	
	// Complete scan
	CompleteScanProgress()
}

// Helper functions (these would need to be implemented based on your existing scanner)
func (h *Handler) countMediaFiles(path string) (int, error) {
	// This should count media files in the given path
	// Implementation depends on your existing file scanning logic
	return 100, nil // Placeholder
}

func (h *Handler) scanPath(path string, processedFiles *int, generateAssets, updateMetadata bool) error {
	// This should scan the path and update progress
	// Implementation depends on your existing scanner logic
	
	// Simulate scanning with progress updates
	for i := 0; i < 10; i++ {
		*processedFiles++
		UpdateScanFile(path+"/sample_file_"+string(rune(i))+".mp4", *processedFiles)
		time.Sleep(100 * time.Millisecond) // Simulate work
	}
	
	return nil
}

func (h *Handler) generateMissingAssets() error {
	// Generate thumbnails, posters, etc.
	return nil
}

func (h *Handler) updateAllMetadata() error {
	// Update metadata from TMDB
	return nil
}