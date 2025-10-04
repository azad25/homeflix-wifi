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
	return &OptimizedStreamService{
		cache:     make(map[string]*CacheEntry),
		cacheSize: cacheSize,
		chunkSize: int64(chunkSize),
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
	
	// Set headers for optimal streaming with better caching and performance
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Cache-Control", "public, max-age=86400, immutable") // 24 hours cache
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // Disable nginx buffering for real-time streaming
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Range")
	
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
	
	// Use adaptive buffer size based on remaining data
	bufferSize := s.chunkSize
	if remaining < s.chunkSize {
		bufferSize = remaining
	}
	
	// Increase buffer size for better performance on larger files
	if remaining > 50*1024*1024 { // 50MB+
		bufferSize = s.chunkSize * 4 // 4x chunk size for large files
	} else if remaining > 10*1024*1024 { // 10MB+
		bufferSize = s.chunkSize * 2 // 2x chunk size for medium files
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

		// Adaptive flushing - flush more frequently for smaller chunks
		if bytesWritten%s.chunkSize == 0 || remaining == 0 {
			if flusher, ok := w.(http.Flusher); ok {
				flusher.Flush()
			}
		}

		if err == io.EOF {
			break
		}
		
		// Small delay for very large transfers to prevent overwhelming the connection
		if bytesWritten > 0 && bytesWritten%(10*s.chunkSize) == 0 {
			time.Sleep(1 * time.Millisecond)
		}
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
	case ".mpg", ".mpeg":
		return "video/mpeg"
	case ".3gp":
		return "video/3gpp"
	case ".ogv":
		return "video/ogg"
	case ".ts":
		return "video/mp2t"
	case ".mts", ".m2ts":
		return "video/mp2t"
	case ".vob":
		return "video/dvd"
	case ".asf":
		return "video/x-ms-asf"
	case ".rm", ".rmvb":
		return "video/x-pn-realvideo"
	case ".divx":
		return "video/divx"
	case ".xvid":
		return "video/x-msvideo"
	default:
		return "video/mp4" // Default fallback
	}
}
