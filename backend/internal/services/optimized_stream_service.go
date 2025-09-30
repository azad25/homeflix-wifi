package services

import (
	"fmt"
	"io"
	"net/http"
	"os"
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
	
	// Set headers for optimal streaming
	w.Header().Set("Content-Type", "video/mp4")
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Header().Set("Connection", "keep-alive")
	
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
	buffer := make([]byte, s.chunkSize)

	for remaining > 0 {
		chunkSize := s.chunkSize
		if remaining < chunkSize {
			chunkSize = remaining
		}

		n, err := file.Read(buffer[:chunkSize])
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

		// Flush data immediately for real-time streaming
		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}

		remaining -= int64(n)

		if err == io.EOF {
			break
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
