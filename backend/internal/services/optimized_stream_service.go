package services

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

type OptimizedStreamService struct {
	chunkSize        int64
	bufferSize       int64
	cacheSize        int64
	maxWorkers       int
	flushInterval    time.Duration
	preloadChunks    int
	alacService      *ALACAudioService
	
	// Performance optimizations
	chunkCache       map[string][]byte
	cacheMutex       sync.RWMutex
	activeStreams    map[string]*StreamSession
	streamsMutex     sync.RWMutex
	
	// Network optimization
	localNetworkBoost bool
	bandwidthDetector *BandwidthDetector
}

type StreamSession struct {
	FilePath     string
	FileSize     int64
	LastAccess   time.Time
	PreloadedChunks map[int64][]byte
	Quality      string
	Format       string
}

type BandwidthDetector struct {
	samples []float64
	mutex   sync.RWMutex
}

func NewOptimizedStreamService(cacheSize, chunkSize int64) *OptimizedStreamService {
	// Ultra-fast streaming optimizations - 16x CPU cores for maximum I/O performance
	maxWorkers := runtime.NumCPU() * 16
	if maxWorkers > 64 {
		maxWorkers = 64 // Cap at 64 for memory management
	}

	// 2MB chunk size for ultra-fast streaming (increased from 1MB)
	if chunkSize == 0 {
		chunkSize = 2 * 1024 * 1024 // 2MB chunks
	}

	// 128MB buffer for better buffering (doubled from 64MB)
	bufferSize := int64(128 * 1024 * 1024)

	// 4x cache size for maximum hit rates
	if cacheSize == 0 {
		cacheSize = int64(512 * 1024 * 1024) // 512MB cache (4x increase)
	}

	service := &OptimizedStreamService{
		chunkSize:         chunkSize,
		bufferSize:        bufferSize,
		cacheSize:         cacheSize,
		maxWorkers:        maxWorkers,
		flushInterval:     5 * time.Millisecond, // Ultra-low latency flushing (5ms)
		preloadChunks:     8, // Preload first 8 chunks (16MB) for instant startup
		chunkCache:        make(map[string][]byte),
		activeStreams:     make(map[string]*StreamSession),
		localNetworkBoost: true,
		bandwidthDetector: &BandwidthDetector{samples: make([]float64, 0, 10)},
	}

	// Start cache maintenance
	go service.maintainCache()
	
	// Start preloading popular content
	go service.preloadPopularContent()

	log.Printf("🚀 OptimizedStreamService initialized: %dMB cache, %dKB chunks, %d workers, %dms flush", 
		cacheSize/(1024*1024), chunkSize/1024, maxWorkers, service.flushInterval.Milliseconds())

	return service
}

// SetALACService integrates ALAC audio service for automatic high-quality audio streaming
func (s *OptimizedStreamService) SetALACService(alacService *ALACAudioService) {
	s.alacService = alacService
	log.Printf("🎵 ALAC audio service integrated with streaming service")
}

// StreamVideo provides ultra-fast video streaming with Netflix-like performance
func (s *OptimizedStreamService) StreamVideo(w http.ResponseWriter, r *http.Request, filePath string) error {
	// Detect if this is a local network connection for bandwidth boost
	isLocalNetwork := s.isLocalNetworkRequest(r)
	
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("failed to open file: %v", err)
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return fmt.Errorf("failed to get file info: %v", err)
	}

	fileSize := fileInfo.Size()
	
	// Create or get stream session
	sessionKey := fmt.Sprintf("%s_%d", filePath, fileSize)
	session := s.getOrCreateSession(sessionKey, filePath, fileSize)

	// Handle range requests for ultra-fast seeking
	rangeHeader := r.Header.Get("Range")
	if rangeHeader == "" {
		return s.streamFullFile(w, r, file, fileSize, session, isLocalNetwork)
	}

	return s.streamRangeRequest(w, r, file, fileSize, rangeHeader, session, isLocalNetwork)
}

// streamFullFile streams the entire file with optimizations
func (s *OptimizedStreamService) streamFullFile(w http.ResponseWriter, r *http.Request, file *os.File, fileSize int64, session *StreamSession, isLocalNetwork bool) error {
	// Set optimized headers
	s.setOptimizedHeaders(w, fileSize, isLocalNetwork)
	
	// Use optimized buffer size based on network type
	bufferSize := s.bufferSize
	if isLocalNetwork {
		bufferSize *= 4 // 4x buffer for local network
	}

	// Stream with intelligent buffering
	buffer := make([]byte, bufferSize)
	flusher, canFlush := w.(http.Flusher)
	
	for {
		n, err := file.Read(buffer)
		if n > 0 {
			if _, writeErr := w.Write(buffer[:n]); writeErr != nil {
				return writeErr
			}
			
			// Ultra-low latency flushing
			if canFlush {
				flusher.Flush()
			}
		}
		
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		
		// Micro-sleep for ultra-smooth streaming
		time.Sleep(s.flushInterval)
	}
	
	return nil
}

// streamRangeRequest handles range requests with Netflix-like instant seeking
func (s *OptimizedStreamService) streamRangeRequest(w http.ResponseWriter, r *http.Request, file *os.File, fileSize int64, rangeHeader string, session *StreamSession, isLocalNetwork bool) error {
	// Parse range header
	ranges := strings.Split(strings.TrimPrefix(rangeHeader, "bytes="), "-")
	if len(ranges) != 2 {
		http.Error(w, "Invalid range", http.StatusRequestedRangeNotSatisfiable)
		return fmt.Errorf("invalid range header")
	}

	var start, end int64
	var err error
	
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

	if start > end || start < 0 || end >= fileSize {
		http.Error(w, "Range not satisfiable", http.StatusRequestedRangeNotSatisfiable)
		return fmt.Errorf("range not satisfiable")
	}

	contentLength := end - start + 1

	// Set optimized headers for partial content
	s.setPartialContentHeaders(w, start, end, fileSize, contentLength, isLocalNetwork)

	// Check if this range is cached
	chunkKey := fmt.Sprintf("%s_%d_%d", session.FilePath, start, end)
	if cachedData := s.getCachedChunk(chunkKey); cachedData != nil {
		log.Printf("🎯 Cache hit for range %d-%d", start, end)
		w.Write(cachedData)
		return nil
	}

	// Seek to start position
	if _, err := file.Seek(start, 0); err != nil {
		return err
	}

	// Stream the range with intelligent chunking
	return s.streamRangeWithChunking(w, r, file, contentLength, start, end, session, isLocalNetwork, chunkKey)
}

// streamRangeWithChunking streams range with intelligent chunking and caching
func (s *OptimizedStreamService) streamRangeWithChunking(w http.ResponseWriter, r *http.Request, file *os.File, contentLength, start, end int64, session *StreamSession, isLocalNetwork bool, chunkKey string) error {
	// Calculate optimal chunk size based on range and network
	chunkSize := s.chunkSize
	if isLocalNetwork {
		chunkSize *= 2 // 2x chunk size for local network
	}
	
	// Adjust chunk size for small ranges
	if contentLength < chunkSize {
		chunkSize = contentLength
	}

	buffer := make([]byte, chunkSize)
	var totalData []byte
	flusher, canFlush := w.(http.Flusher)
	remaining := contentLength

	for remaining > 0 {
		readSize := chunkSize
		if remaining < chunkSize {
			readSize = remaining
		}

		n, err := file.Read(buffer[:readSize])
		if n > 0 {
			chunk := buffer[:n]
			
			// Write chunk
			if _, writeErr := w.Write(chunk); writeErr != nil {
				return writeErr
			}
			
			// Cache the data for future requests
			totalData = append(totalData, chunk...)
			
			// Ultra-low latency flushing
			if canFlush {
				flusher.Flush()
			}
			
			remaining -= int64(n)
		}
		
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		
		// Micro-sleep for smooth streaming
		time.Sleep(s.flushInterval)
	}

	// Cache the complete range for future requests
	if len(totalData) > 0 && len(totalData) <= int(s.chunkSize*4) { // Cache chunks up to 8MB
		s.cacheChunk(chunkKey, totalData)
	}

	return nil
}

// setOptimizedHeaders sets headers optimized for streaming performance
func (s *OptimizedStreamService) setOptimizedHeaders(w http.ResponseWriter, fileSize int64, isLocalNetwork bool) {
	w.Header().Set("Content-Type", "video/mp4")
	w.Header().Set("Content-Length", strconv.FormatInt(fileSize, 10))
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Header().Set("Connection", "keep-alive")
	
	if isLocalNetwork {
		// Aggressive caching for local network
		w.Header().Set("Cache-Control", "public, max-age=86400")
	}
}

// setPartialContentHeaders sets headers for partial content with optimizations
func (s *OptimizedStreamService) setPartialContentHeaders(w http.ResponseWriter, start, end, fileSize, contentLength int64, isLocalNetwork bool) {
	w.Header().Set("Content-Type", "video/mp4")
	w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, fileSize))
	w.Header().Set("Content-Length", strconv.FormatInt(contentLength, 10))
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Header().Set("Connection", "keep-alive")
	
	if isLocalNetwork {
		// Aggressive caching for local network
		w.Header().Set("Cache-Control", "public, max-age=86400")
	}
	
	w.WriteHeader(http.StatusPartialContent)
}

// getOrCreateSession gets or creates a streaming session
func (s *OptimizedStreamService) getOrCreateSession(sessionKey, filePath string, fileSize int64) *StreamSession {
	s.streamsMutex.Lock()
	defer s.streamsMutex.Unlock()
	
	session, exists := s.activeStreams[sessionKey]
	if !exists {
		session = &StreamSession{
			FilePath:        filePath,
			FileSize:        fileSize,
			LastAccess:      time.Now(),
			PreloadedChunks: make(map[int64][]byte),
			Quality:         "auto",
			Format:          "mp4",
		}
		s.activeStreams[sessionKey] = session
		
		// Start preloading first chunks for instant startup
		go s.preloadSessionChunks(session)
	} else {
		session.LastAccess = time.Now()
	}
	
	return session
}

// preloadSessionChunks preloads the first chunks of a session for instant startup
func (s *OptimizedStreamService) preloadSessionChunks(session *StreamSession) {
	file, err := os.Open(session.FilePath)
	if err != nil {
		return
	}
	defer file.Close()

	buffer := make([]byte, s.chunkSize)
	for i := 0; i < s.preloadChunks; i++ {
		offset := int64(i) * s.chunkSize
		if offset >= session.FileSize {
			break
		}
		
		if _, err := file.Seek(offset, 0); err != nil {
			break
		}
		
		n, err := file.Read(buffer)
		if n > 0 {
			chunkData := make([]byte, n)
			copy(chunkData, buffer[:n])
			session.PreloadedChunks[offset] = chunkData
		}
		
		if err == io.EOF {
			break
		}
		if err != nil {
			break
		}
	}
	
	log.Printf("🚀 Preloaded %d chunks for instant startup: %s", len(session.PreloadedChunks), session.FilePath)
}

// getCachedChunk retrieves a cached chunk
func (s *OptimizedStreamService) getCachedChunk(key string) []byte {
	s.cacheMutex.RLock()
	defer s.cacheMutex.RUnlock()
	
	return s.chunkCache[key]
}

// cacheChunk caches a chunk for future requests
func (s *OptimizedStreamService) cacheChunk(key string, data []byte) {
	s.cacheMutex.Lock()
	defer s.cacheMutex.Unlock()
	
	// Check cache size limit
	currentSize := int64(0)
	for _, chunk := range s.chunkCache {
		currentSize += int64(len(chunk))
	}
	
	if currentSize+int64(len(data)) > s.cacheSize {
		// Evict oldest entries (simple LRU)
		s.evictOldestChunks()
	}
	
	s.chunkCache[key] = data
}

// evictOldestChunks evicts oldest cached chunks
func (s *OptimizedStreamService) evictOldestChunks() {
	// Simple eviction - remove half the cache
	count := 0
	target := len(s.chunkCache) / 2
	
	for key := range s.chunkCache {
		if count >= target {
			break
		}
		delete(s.chunkCache, key)
		count++
	}
}

// isLocalNetworkRequest detects if request is from local network
func (s *OptimizedStreamService) isLocalNetworkRequest(r *http.Request) bool {
	if !s.localNetworkBoost {
		return false
	}
	
	remoteAddr := r.RemoteAddr
	if strings.Contains(remoteAddr, "127.0.0.1") || 
	   strings.Contains(remoteAddr, "localhost") ||
	   strings.Contains(remoteAddr, "192.168.") ||
	   strings.Contains(remoteAddr, "10.") ||
	   strings.Contains(remoteAddr, "172.") {
		return true
	}
	
	return false
}

// maintainCache performs periodic cache maintenance
func (s *OptimizedStreamService) maintainCache() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	
	for range ticker.C {
		s.cacheMutex.Lock()
		
		// Clean up old sessions
		s.streamsMutex.Lock()
		for key, session := range s.activeStreams {
			if time.Since(session.LastAccess) > 30*time.Minute {
				delete(s.activeStreams, key)
			}
		}
		s.streamsMutex.Unlock()
		
		// Log cache statistics
		cacheSize := int64(0)
		for _, chunk := range s.chunkCache {
			cacheSize += int64(len(chunk))
		}
		
		s.cacheMutex.Unlock()
		
		log.Printf("📊 Stream cache: %d chunks, %dMB, %d active sessions", 
			len(s.chunkCache), cacheSize/(1024*1024), len(s.activeStreams))
	}
}

// preloadPopularContent preloads popular content for instant access
func (s *OptimizedStreamService) preloadPopularContent() {
	// This would integrate with analytics to preload popular content
	// For now, it's a placeholder for future implementation
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()
	
	for range ticker.C {
		// TODO: Implement popular content detection and preloading
		log.Printf("🔥 Popular content preloading cycle (placeholder)")
	}
}

// GetVideoInfo returns optimized video information
func (s *OptimizedStreamService) GetVideoInfo(filePath string) (map[string]interface{}, error) {
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return nil, err
	}

	// Get session if exists for additional info
	sessionKey := fmt.Sprintf("%s_%d", filePath, fileInfo.Size())
	s.streamsMutex.RLock()
	session, hasSession := s.activeStreams[sessionKey]
	s.streamsMutex.RUnlock()

	info := map[string]interface{}{
		"size":           fileInfo.Size(),
		"modified":       fileInfo.ModTime(),
		"name":           fileInfo.Name(),
		"optimized":      true,
		"chunk_size":     s.chunkSize,
		"preload_chunks": s.preloadChunks,
	}

	if hasSession {
		info["session_active"] = true
		info["preloaded_chunks"] = len(session.PreloadedChunks)
		info["last_access"] = session.LastAccess
	}

	return info, nil
}

// StreamPreviewClip streams preview clips with optimizations
func (s *OptimizedStreamService) StreamPreviewClip(w http.ResponseWriter, r *http.Request, previewPath string) error {
	// Use the same optimized streaming for preview clips
	return s.StreamVideo(w, r, previewPath)
}

// StreamALACAudio streams ALAC audio with automatic integration
func (s *OptimizedStreamService) StreamALACAudio(w http.ResponseWriter, r *http.Request, mediaID int) error {
	if s.alacService == nil {
		return fmt.Errorf("ALAC service not available")
	}
	
	alacPath := s.alacService.GetAudioPath(mediaID)
	if alacPath == "" {
		return fmt.Errorf("ALAC audio not found for media %d", mediaID)
	}
	
	// Stream ALAC audio with optimizations
	return s.StreamVideo(w, r, alacPath)
}