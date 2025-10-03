package services

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

type OptimizedStreamService struct {
	cache     map[string]*CacheEntry
	cacheMux  sync.RWMutex
	cacheSize int
	chunkSize int64
}

type CacheEntry struct {
	data      []byte
	timestamp time.Time
	size      int64
}

func NewOptimizedStreamService(cacheSize int, chunkSize int) *OptimizedStreamService {
	// Optimize for WiFi streaming with larger chunk sizes
	optimizedChunkSize := chunkSize
	if chunkSize < 256*1024 { // Minimum 256KB for WiFi
		optimizedChunkSize = 256 * 1024
	}
	
	return &OptimizedStreamService{
		cache:     make(map[string]*CacheEntry),
		cacheSize: cacheSize,
		chunkSize: int64(optimizedChunkSize),
	}
}

func (s *OptimizedStreamService) StreamVideo(w http.ResponseWriter, r *http.Request, filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return err
	}

	fileSize := fileInfo.Size()
	
	// Detect content type based on file extension
	contentType := s.getContentType(filePath)
	
	// Set headers for optimal WiFi streaming with Netflix-level performance
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable") // 1 year cache for videos
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // Disable nginx buffering
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Range, Content-Type, Accept")
	w.Header().Set("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Vary", "Accept-Encoding")
	// WiFi optimization headers
	w.Header().Set("Transfer-Encoding", "chunked")
	w.Header().Set("X-Accel-Limit-Rate", "0") // No rate limiting
	
	// Handle range requests for efficient streaming
	rangeHeader := r.Header.Get("Range")
	if rangeHeader == "" {
		// No range request, serve with chunked transfer
		w.Header().Set("Content-Length", strconv.FormatInt(fileSize, 10))
		return s.streamWithChunks(w, file, 0, fileSize-1)
	}

	// Parse range header
	ranges := strings.Split(strings.TrimPrefix(rangeHeader, "bytes="), "-")
	if len(ranges) != 2 {
		http.Error(w, "Invalid range", http.StatusRequestedRangeNotSatisfiable)
		return fmt.Errorf("invalid range header")
	}

	var start, end int64
	
	if ranges[0] != "" {
		start, err = strconv.ParseInt(ranges[0], 10, 64)
		if err != nil {
			http.Error(w, "Invalid range start", http.StatusRequestedRangeNotSatisfiable)
			return err
		}
	}

	if ranges[1] != "" {
		end, err = strconv.ParseInt(ranges[1], 10, 64)
		if err != nil {
			http.Error(w, "Invalid range end", http.StatusRequestedRangeNotSatisfiable)
			return err
		}
	} else {
		end = fileSize - 1
	}

	// Validate range
	if start > end || start < 0 || end >= fileSize {
		http.Error(w, "Range not satisfiable", http.StatusRequestedRangeNotSatisfiable)
		return fmt.Errorf("range not satisfiable")
	}

	contentLength := end - start + 1

	// Set partial content headers
	w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, fileSize))
	w.Header().Set("Content-Length", strconv.FormatInt(contentLength, 10))
	w.WriteHeader(http.StatusPartialContent)

	return s.streamWithChunks(w, file, start, end)
}

func (s *OptimizedStreamService) streamWithChunks(w http.ResponseWriter, file *os.File, start, end int64) error {
	// Seek to start position
	_, err := file.Seek(start, 0)
	if err != nil {
		return err
	}

	remaining := end - start + 1
	
	// Adaptive buffer sizing optimized for WiFi streaming
	bufferSize := s.chunkSize
	if remaining < s.chunkSize {
		bufferSize = remaining
	}
	
	// Netflix-style adaptive buffering for WiFi
	if remaining > 100*1024*1024 { // 100MB+ (full movies)
		bufferSize = s.chunkSize * 8 // 8x for large files - aggressive buffering
	} else if remaining > 50*1024*1024 { // 50MB+ (episodes)
		bufferSize = s.chunkSize * 6 // 6x for medium-large files
	} else if remaining > 10*1024*1024 { // 10MB+ (clips)
		bufferSize = s.chunkSize * 4 // 4x for medium files
	} else if remaining > 1*1024*1024 { // 1MB+ (previews)
		bufferSize = s.chunkSize * 2 // 2x for small files
	}
	
	buffer := make([]byte, bufferSize)
	bytesWritten := int64(0)

	for remaining > 0 {
		readSize := int64(bufferSize)
		if remaining < readSize {
			readSize = remaining
		}

		n, err := file.Read(buffer[:readSize])
		if err != nil && err != io.EOF {
			return err
		}

		if n == 0 {
			break
		}

		_, writeErr := w.Write(buffer[:n])
		if writeErr != nil {
			return writeErr
		}

		bytesWritten += int64(n)
		remaining -= int64(n)

		// Netflix-style adaptive flushing for smooth playback
		if bytesWritten%(s.chunkSize/2) == 0 || remaining == 0 {
			if flusher, ok := w.(http.Flusher); ok {
				flusher.Flush()
			}
		}

		if err == io.EOF {
			break
		}
		
		// No artificial delays for WiFi - let TCP handle flow control
		// WiFi networks benefit from continuous streaming without delays
	}

	return nil
}

func (s *OptimizedStreamService) GetCachedData(key string) (*CacheEntry, bool) {
	s.cacheMux.RLock()
	defer s.cacheMux.RUnlock()
	
	entry, exists := s.cache[key]
	if !exists {
		return nil, false
	}
	
	// Check if cache entry is still valid (1 hour)
	if time.Since(entry.timestamp) > time.Hour {
		delete(s.cache, key)
		return nil, false
	}
	
	return entry, true
}

func (s *OptimizedStreamService) SetCachedData(key string, data []byte, size int64) {
	s.cacheMux.Lock()
	defer s.cacheMux.Unlock()
	
	// Simple LRU eviction if cache is full
	if len(s.cache) >= s.cacheSize {
		// Remove oldest entry
		var oldestKey string
		var oldestTime time.Time = time.Now()
		
		for k, v := range s.cache {
			if v.timestamp.Before(oldestTime) {
				oldestTime = v.timestamp
				oldestKey = k
			}
		}
		
		if oldestKey != "" {
			delete(s.cache, oldestKey)
		}
	}
	
	s.cache[key] = &CacheEntry{
		data:      data,
		timestamp: time.Now(),
		size:      size,
	}
}

func (s *OptimizedStreamService) GetVideoInfo(filePath string) (map[string]interface{}, error) {
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return nil, err
	}

	info := map[string]interface{}{
		"size":         fileInfo.Size(),
		"modified":     fileInfo.ModTime(),
		"name":         fileInfo.Name(),
		"optimized":    true,
		"chunk_size":   s.chunkSize,
		"cache_enabled": len(s.cache) >= 0,
	}

	return info, nil
}

// getContentType determines the MIME type based on file extension
func (s *OptimizedStreamService) getContentType(filePath string) string {
	ext := filepath.Ext(strings.ToLower(filePath))
	
	switch ext {
	case ".mp4":
		return "video/mp4"
	case ".webm":
		return "video/webm"
	case ".mkv":
		return "video/x-matroska"
	case ".avi":
		return "video/x-msvideo"
	case ".mov":
		return "video/quicktime"
	case ".wmv":
		return "video/x-ms-wmv"
	case ".flv":
		return "video/x-flv"
	case ".m4v":
		return "video/x-m4v"
	default:
		return "video/mp4" // Default fallback
	}
}
