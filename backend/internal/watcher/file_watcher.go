package watcher

import (
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// MediaProcessor defines the interface for processing media files
type MediaProcessor interface {
	ProcessSingleFile(path string, info os.FileInfo) error
}

// SubtitleProcessor defines the interface for processing subtitle files
type SubtitleProcessor interface {
	ProcessSubtitleFile(path string, info os.FileInfo) error
}

type FileWatcher struct {
	watcher       *fsnotify.Watcher
	processor     MediaProcessor
	watchPaths    []string
	debouncer     map[string]*time.Timer
	debounceMux   sync.RWMutex
	debounceDelay time.Duration
	isRunning     bool
	stopChan      chan bool
}

type WatchEvent struct {
	Path      string
	Operation string
	Timestamp time.Time
}

func NewFileWatcher(mediaProcessor MediaProcessor, watchPaths []string) (*FileWatcher, error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	return &FileWatcher{
		watcher:       watcher,
		processor:     mediaProcessor,
		watchPaths:    watchPaths,
		debouncer:     make(map[string]*time.Timer),
		debounceDelay: 2 * time.Second, // Wait 2 seconds before processing
		stopChan:      make(chan bool),
	}, nil
}

func (fw *FileWatcher) Start() error {
	if fw.isRunning {
		return nil
	}

	// Add watch paths
	for _, path := range fw.watchPaths {
		if err := fw.addWatchRecursively(path); err != nil {
			log.Printf("⚠️ Failed to watch path %s: %v", path, err)
			continue
		}
		log.Printf("👁️ Watching directory: %s", path)
	}

	fw.isRunning = true
	go fw.watchLoop()
	
	log.Printf("🚀 File watcher started, monitoring %d paths", len(fw.watchPaths))
	return nil
}

func (fw *FileWatcher) Stop() {
	if !fw.isRunning {
		return
	}

	fw.isRunning = false
	fw.stopChan <- true
	fw.watcher.Close()
	
	// Cancel all pending debounced operations
	fw.debounceMux.Lock()
	for _, timer := range fw.debouncer {
		timer.Stop()
	}
	fw.debouncer = make(map[string]*time.Timer)
	fw.debounceMux.Unlock()
	
	log.Printf("🛑 File watcher stopped")
}

func (fw *FileWatcher) addWatchRecursively(root string) error {
	return filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Continue on errors
		}

		if info.IsDir() {
			// Skip hidden and system directories
			dirName := filepath.Base(path)
			if strings.HasPrefix(dirName, ".") || 
			   dirName == "System Volume Information" ||
			   dirName == "$RECYCLE.BIN" {
				return filepath.SkipDir
			}

			// Add directory to watcher
			if err := fw.watcher.Add(path); err != nil {
				log.Printf("⚠️ Failed to add watch for directory %s: %v", path, err)
			}
		}

		return nil
	})
}

func (fw *FileWatcher) watchLoop() {
	for fw.isRunning {
		select {
		case event, ok := <-fw.watcher.Events:
			if !ok {
				return
			}
			fw.handleEvent(event)

		case err, ok := <-fw.watcher.Errors:
			if !ok {
				return
			}
			log.Printf("❌ File watcher error: %v", err)

		case <-fw.stopChan:
			return
		}
	}
}

func (fw *FileWatcher) handleEvent(event fsnotify.Event) {
	// Only process relevant events
	if !fw.isRelevantEvent(event) {
		return
	}

	log.Printf("📁 File event: %s %s", event.Op.String(), event.Name)

	// Handle directory creation (need to add new directories to watcher)
	if event.Op&fsnotify.Create == fsnotify.Create {
		if info, err := os.Stat(event.Name); err == nil && info.IsDir() {
			fw.addWatchRecursively(event.Name)
			log.Printf("👁️ Added new directory to watch: %s", event.Name)
		}
	}

	// Debounce file processing to avoid processing incomplete file operations
	fw.debounceFileProcessing(event.Name)
}

func (fw *FileWatcher) isRelevantEvent(event fsnotify.Event) bool {
	// Skip temporary files and system files
	filename := filepath.Base(event.Name)
	if strings.HasPrefix(filename, ".") || 
	   strings.HasSuffix(filename, ".tmp") ||
	   strings.HasSuffix(filename, ".temp") ||
	   strings.Contains(filename, "~") {
		return false
	}

	// Check if it's a video or subtitle file
	ext := strings.ToLower(filepath.Ext(event.Name))
	videoExts := map[string]bool{
		".mp4": true, ".mkv": true, ".avi": true, ".mov": true,
		".wmv": true, ".flv": true, ".webm": true, ".m4v": true,
		".mpg": true, ".mpeg": true, ".3gp": true, ".ogv": true,
		".ts": true, ".m2ts": true, ".mts": true, ".vob": true,
	}
	
	subtitleExts := map[string]bool{
		".srt": true, ".vtt": true, ".ass": true,
		".ssa": true, ".sub": true, ".idx": true,
	}

	return videoExts[ext] || subtitleExts[ext] || event.Op&fsnotify.Create == fsnotify.Create
}

func (fw *FileWatcher) debounceFileProcessing(path string) {
	fw.debounceMux.Lock()
	defer fw.debounceMux.Unlock()

	// Cancel existing timer for this path
	if timer, exists := fw.debouncer[path]; exists {
		timer.Stop()
	}

	// Create new timer
	fw.debouncer[path] = time.AfterFunc(fw.debounceDelay, func() {
		fw.processFile(path)
		
		// Clean up timer
		fw.debounceMux.Lock()
		delete(fw.debouncer, path)
		fw.debounceMux.Unlock()
	})
}

func (fw *FileWatcher) processFile(path string) {
	// Check if file still exists (might have been deleted)
	info, err := os.Stat(path)
	if err != nil {
		log.Printf("📁 File no longer exists, skipping: %s", path)
		return
	}

	if info.IsDir() {
		// Directory created, scan it for media files
		log.Printf("📂 New directory detected, scanning: %s", path)
		go fw.scanNewDirectory(path)
		return
	}

	// Check file type
	ext := strings.ToLower(filepath.Ext(path))
	videoExts := map[string]bool{
		".mp4": true, ".mkv": true, ".avi": true, ".mov": true,
		".wmv": true, ".flv": true, ".webm": true, ".m4v": true,
		".mpg": true, ".mpeg": true, ".3gp": true, ".ogv": true,
	}
	
	subtitleExts := map[string]bool{
		".srt": true, ".vtt": true, ".ass": true,
		".ssa": true, ".sub": true, ".idx": true,
	}

	if videoExts[ext] {
		log.Printf("🎬 New video file detected: %s", path)
		go fw.processNewVideoFile(path, info)
	} else if subtitleExts[ext] {
		log.Printf("📝 New subtitle file detected: %s", path)
		go fw.processNewSubtitleFile(path, info)
	}
}

func (fw *FileWatcher) scanNewDirectory(dirPath string) {
	log.Printf("🔍 Scanning new directory for media files: %s", dirPath)
	
	err := filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		if !info.IsDir() {
			ext := strings.ToLower(filepath.Ext(path))
			videoExts := map[string]bool{
				".mp4": true, ".mkv": true, ".avi": true, ".mov": true,
				".wmv": true, ".flv": true, ".webm": true, ".m4v": true,
			}
			
			subtitleExts := map[string]bool{
				".srt": true, ".vtt": true, ".ass": true,
				".ssa": true, ".sub": true, ".idx": true,
			}

			if videoExts[ext] {
				fw.processNewVideoFile(path, info)
			} else if subtitleExts[ext] {
				fw.processNewSubtitleFile(path, info)
			}
		}

		return nil
	})

	if err != nil {
		log.Printf("❌ Error scanning new directory %s: %v", dirPath, err)
	}
}

func (fw *FileWatcher) processNewVideoFile(path string, info os.FileInfo) {
	log.Printf("⚡ Processing new video file: %s", path)
	
	// Use the processor to process the new file
	if err := fw.processor.ProcessSingleFile(path, info); err != nil {
		log.Printf("❌ Failed to process new video file %s: %v", path, err)
	} else {
		log.Printf("✅ Successfully processed new video file: %s", path)
		
		// After processing video file, scan for related subtitles
		go fw.scanForRelatedSubtitles(path)
	}
}

func (fw *FileWatcher) processNewSubtitleFile(path string, info os.FileInfo) {
	log.Printf("📝 Processing new subtitle file: %s", path)
	
	// For subtitle files, we need to find the corresponding video file
	// and trigger subtitle scanning for that media
	if subtitleProcessor, ok := fw.processor.(SubtitleProcessor); ok {
		if err := subtitleProcessor.ProcessSubtitleFile(path, info); err != nil {
			log.Printf("❌ Failed to process new subtitle file %s: %v", path, err)
		} else {
			log.Printf("✅ Successfully processed new subtitle file: %s", path)
		}
	} else {
		log.Printf("⚠️ Processor doesn't support subtitle processing for: %s", path)
	}
}

func (fw *FileWatcher) scanForRelatedSubtitles(videoPath string) {
	log.Printf("🔍 Scanning for subtitles related to: %s", videoPath)
	
	dir := filepath.Dir(videoPath)
	baseName := strings.TrimSuffix(filepath.Base(videoPath), filepath.Ext(videoPath))
	
	// Look for subtitle files in the same directory
	files, err := os.ReadDir(dir)
	if err != nil {
		log.Printf("❌ Failed to read directory %s: %v", dir, err)
		return
	}
	
	subtitleExts := map[string]bool{
		".srt": true, ".vtt": true, ".ass": true,
		".ssa": true, ".sub": true, ".idx": true,
	}
	
	for _, file := range files {
		if file.IsDir() {
			continue
		}
		
		fileName := file.Name()
		fileExt := strings.ToLower(filepath.Ext(fileName))
		
		if !subtitleExts[fileExt] {
			continue
		}
		
		// Check if subtitle filename matches video filename
		subtitleBase := strings.TrimSuffix(fileName, fileExt)
		if fw.isSubtitleRelated(baseName, subtitleBase) {
			subtitlePath := filepath.Join(dir, fileName)
			log.Printf("📝 Found related subtitle: %s", subtitlePath)
			
			if info, err := file.Info(); err == nil {
				fw.processNewSubtitleFile(subtitlePath, info)
			}
		}
	}
}

func (fw *FileWatcher) isSubtitleRelated(videoBase, subtitleBase string) bool {
	// Remove language suffixes from subtitle name
	cleanSubtitle := fw.removeLanguageSuffix(subtitleBase)
	
	// Normalize names for comparison
	videoNorm := strings.ToLower(strings.ReplaceAll(videoBase, "_", " "))
	subNorm := strings.ToLower(strings.ReplaceAll(cleanSubtitle, "_", " "))
	
	// Check for exact match
	if videoNorm == subNorm {
		return true
	}
	
	// Check if subtitle name starts with video name
	if strings.HasPrefix(subNorm, videoNorm) {
		return true
	}
	
	// Check if video name starts with subtitle name (for cases where subtitle has shorter name)
	if len(subNorm) > 3 && strings.HasPrefix(videoNorm, subNorm) {
		return true
	}
	
	return false
}

func (fw *FileWatcher) removeLanguageSuffix(filename string) string {
	// Common language patterns to remove
	langPatterns := []string{
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
	}

	for _, pattern := range langPatterns {
		if matched, _ := regexp.MatchString(pattern, filename); matched {
			filename = regexp.MustCompile(pattern).ReplaceAllString(filename, "")
		}
	}

	return filename
}

// SetDebounceDelay configures the debounce delay
func (fw *FileWatcher) SetDebounceDelay(delay time.Duration) {
	fw.debounceDelay = delay
	log.Printf("⚙️ Set debounce delay to %v", delay)
}

// GetWatchedPaths returns the currently watched paths
func (fw *FileWatcher) GetWatchedPaths() []string {
	return fw.watchPaths
}

// IsRunning returns whether the file watcher is currently running
func (fw *FileWatcher) IsRunning() bool {
	return fw.isRunning
}
