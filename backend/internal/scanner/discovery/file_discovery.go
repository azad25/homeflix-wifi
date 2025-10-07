package discovery

import (
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"homeflix-backend/internal/scanner/core"
)

// DiscoverFiles performs superfast file discovery with smart filtering
func DiscoverFiles(s *core.MediaScanner) ([]core.FileInfo, error) {
	var files []core.FileInfo
	var mu sync.Mutex
	
	// Use goroutines for parallel directory scanning
	var wg sync.WaitGroup
	fileChan := make(chan core.FileInfo, 1000)
	
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
		isVideo := isVideoFileByExtension(ext)
		isSubtitle := isSubtitleFileByExtension(ext)

		if isVideo || isSubtitle {
			wg.Add(1)
			go func(p string, i os.FileInfo) {
				defer wg.Done()
				
				fileInfo := core.FileInfo{
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
func isVideoFileByExtension(ext string) bool {
	videoExts := map[string]bool{
		".mp4": true, ".mkv": true, ".avi": true, ".mov": true, 
		".wmv": true, ".flv": true, ".webm": true, ".m4v": true, 
		".mpg": true, ".mpeg": true, ".3gp": true, ".ogv": true,
		".ts": true, ".m2ts": true, ".mts": true, ".vob": true,
	}
	return videoExts[ext]
}

// isSubtitleFileByExtension performs ultra-fast subtitle detection by extension only
func isSubtitleFileByExtension(ext string) bool {
	subtitleExts := map[string]bool{
		".srt": true, ".vtt": true, ".ass": true, 
		".ssa": true, ".sub": true, ".idx": true,
	}
	return subtitleExts[ext]
}