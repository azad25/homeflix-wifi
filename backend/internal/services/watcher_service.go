package services

import (
	"log"
	"os"
	"sync"

	"homeflix-backend/internal/watcher"
)

// ScannerInterface defines the interface for media scanning operations
type ScannerInterface interface {
	ScanMediaLibrary() error
	IncrementalScan() error
	ProcessSingleFile(path string, info os.FileInfo) error
}

type WatcherService struct {
	fileWatcher *watcher.FileWatcher
	scanner     ScannerInterface
	isRunning   bool
	mu          sync.RWMutex
}

func NewWatcherService(mediaScanner ScannerInterface, watchPaths []string) (*WatcherService, error) {
	fileWatcher, err := watcher.NewFileWatcher(mediaScanner, watchPaths)
	if err != nil {
		return nil, err
	}

	return &WatcherService{
		fileWatcher: fileWatcher,
		scanner:     mediaScanner,
		isRunning:   false,
	}, nil
}

func (ws *WatcherService) Start() error {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	if ws.isRunning {
		log.Printf("⚠️ Watcher service is already running")
		return nil
	}

	if err := ws.fileWatcher.Start(); err != nil {
		return err
	}

	ws.isRunning = true
	log.Printf("🚀 Watcher service started successfully")
	return nil
}

func (ws *WatcherService) Stop() {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	if !ws.isRunning {
		return
	}

	ws.fileWatcher.Stop()
	ws.isRunning = false
	log.Printf("🛑 Watcher service stopped")
}

func (ws *WatcherService) IsRunning() bool {
	ws.mu.RLock()
	defer ws.mu.RUnlock()
	return ws.isRunning
}

func (ws *WatcherService) GetWatchedPaths() []string {
	return ws.fileWatcher.GetWatchedPaths()
}

func (ws *WatcherService) TriggerManualScan() error {
	log.Printf("🔍 Triggering manual media scan...")
	return ws.scanner.ScanMediaLibrary()
}

func (ws *WatcherService) TriggerIncrementalScan() error {
	log.Printf("⚡ Triggering incremental media scan...")
	return ws.scanner.IncrementalScan()
}
