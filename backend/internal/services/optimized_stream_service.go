package services

import (
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

type OptimizedStreamService struct {
	chunkSize     int64
	bufferSize    int64
	cacheSize     int64
	maxWorkers    int
	flushInterval time.Duration
	preloadChunks int
	alacService   *ALACAudioService

	// Performance optimizations
	chunkCache    map[string][]byte
	cacheMutex    sync.RWMutex
	activeStreams map[string]*StreamSession
	streamsMutex  sync.RWMutex

	// Memory mapping for instant access
	mmapCache map[string][]byte
	mmapMutex sync.RWMutex

	// Network optimization
	localNetworkBoost bool
	bandwidthDetector *BandwidthDetector

	// Instant streaming optimizations
	sendfileEnabled bool
	parallelWorkers int
}

type StreamSession struct {
	FilePath        string
	FileSize        int64
	LastAccess      time.Time
	PreloadedChunks map[int64][]byte
	Quality         string
	Format          string
	MmapData        []byte

	// Instant streaming enhancements
	ChunkWorkers chan struct{}
	IsLargeFile  bool
}

type BandwidthDetector struct {
	samples []float64
	mutex   sync.RWMutex
}

func NewOptimizedStreamService(cacheSize, chunkSize int64) *OptimizedStreamService {
	// Ultra-fast streaming optimizations - 32x CPU cores for maximum I/O performance
	maxWorkers := runtime.NumCPU() * 32
	if maxWorkers > 128 {
		maxWorkers = 128 // Cap at 128 for memory management
	}

	// Adaptive chunk size for instant streaming
	if chunkSize == 0 {
		chunkSize = 16 * 1024 * 1024 // 16MB chunks for large files
	}

	// 2GB buffer for ultra-fast streaming
	bufferSize := int64(2 * 1024 * 1024 * 1024)

	// 4GB cache for maximum hit rates
	if cacheSize == 0 {
		cacheSize = int64(4 * 1024 * 1024 * 1024) // 4GB cache
	}

	service := &OptimizedStreamService{
		chunkSize:         chunkSize,
		bufferSize:        bufferSize,
		cacheSize:         cacheSize,
		maxWorkers:        maxWorkers,
		flushInterval:     0,  // No artificial delays for instant streaming
		preloadChunks:     32, // Preload first 32 chunks (512MB) for instant startup
		chunkCache:        make(map[string][]byte),
		activeStreams:     make(map[string]*StreamSession),
		mmapCache:         make(map[string][]byte),
		localNetworkBoost: true,
		bandwidthDetector: &BandwidthDetector{samples: make([]float64, 0, 10)},

		// Instant streaming optimizations
		sendfileEnabled: true,
		parallelWorkers: runtime.NumCPU() * 8,
	}

	// Start cache maintenance
	go service.maintainCache()

	// Start preloading popular content
	go service.preloadPopularContent()

	log.Printf("🚀 OptimizedStreamService initialized: %dGB cache, %dMB chunks, %d workers, sendfile=%v, parallel=%d",
		cacheSize/(1024*1024*1024), chunkSize/(1024*1024), maxWorkers, service.sendfileEnabled, service.parallelWorkers)

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
	isLargeFile := fileSize > 1024*1024*1024 // Files > 1GB are considered large

	// Create or get stream session
	sessionKey := fmt.Sprintf("%s_%d", filePath, fileSize)
	session := s.getOrCreateSession(sessionKey, filePath, fileSize)
	session.IsLargeFile = isLargeFile

	// For large files on LAN, use memory mapping for instant access
	if isLargeFile && isLocalNetwork {
		if err := s.setupMemoryMapping(session); err != nil {
			log.Printf("⚠️ Memory mapping failed, falling back to optimized streaming: %v", err)
		}
	}

	// Handle range requests for ultra-fast seeking
	rangeHeader := r.Header.Get("Range")
	if rangeHeader == "" {
		return s.streamFullFileOptimized(w, r, file, fileSize, session, isLocalNetwork)
	}

	return s.streamRangeRequestOptimized(w, r, file, fileSize, rangeHeader, session, isLocalNetwork)
}

// streamFullFileOptimized streams the entire file with zero-copy optimizations
func (s *OptimizedStreamService) streamFullFileOptimized(w http.ResponseWriter, r *http.Request, file *os.File, fileSize int64, session *StreamSession, isLocalNetwork bool) error {
	// Set optimized headers with TCP optimizations
	s.setOptimizedHeaders(w, fileSize, isLocalNetwork)

	// For large files on LAN, use sendfile for zero-copy streaming
	if session.IsLargeFile && isLocalNetwork && s.sendfileEnabled {
		return s.streamWithSendfile(w, r, file, fileSize)
	}

	// Use memory-mapped data if available
	if session.MmapData != nil {
		return s.streamFromMemoryMap(w, session.MmapData, isLocalNetwork)
	}

	// Use adaptive buffer size based on file size and network type
	bufferSize := s.getAdaptiveBufferSize(fileSize, isLocalNetwork)

	// Stream with parallel I/O for maximum throughput
	return s.streamWithParallelIO(w, r, file, fileSize, bufferSize, isLocalNetwork)
}

// streamWithSendfile uses zero-copy sendfile for maximum performance
func (s *OptimizedStreamService) streamWithSendfile(w http.ResponseWriter, r *http.Request, file *os.File, fileSize int64) error {
	// Try to get the underlying TCP connection for sendfile
	hijacker, ok := w.(http.Hijacker)
	if !ok {
		// Fallback to optimized regular streaming
		return s.streamWithOptimizedIO(w, file, fileSize)
	}

	conn, _, err := hijacker.Hijack()
	if err != nil {
		return s.streamWithOptimizedIO(w, file, fileSize)
	}
	defer conn.Close()

	// Set TCP_NODELAY for instant packet delivery
	if tcpConn, ok := conn.(*net.TCPConn); ok {
		tcpConn.SetNoDelay(true)
		tcpConn.SetWriteBuffer(16 * 1024 * 1024) // 16MB write buffer
		tcpConn.SetReadBuffer(16 * 1024 * 1024)  // 16MB read buffer
	}

	// Write HTTP headers manually for zero-copy path
	headers := fmt.Sprintf("HTTP/1.1 200 OK\r\nContent-Type: video/mp4\r\nContent-Length: %d\r\nAccept-Ranges: bytes\r\nCache-Control: public, max-age=86400\r\nConnection: close\r\n\r\n", fileSize)
	if _, err := conn.Write([]byte(headers)); err != nil {
		return err
	}

	// Use sendfile for zero-copy streaming
	if tcpConn, ok := conn.(*net.TCPConn); ok {
		if connFile, err := tcpConn.File(); err == nil {
			defer connFile.Close()

			// Sendfile system call for zero-copy transfer
			offset := int64(0)
			for offset < fileSize {
				// Send in 64MB chunks for optimal performance
				chunkSize := int64(64 * 1024 * 1024)
				if offset+chunkSize > fileSize {
					chunkSize = fileSize - offset
				}

				n, err := syscall.Sendfile(int(connFile.Fd()), int(file.Fd()), &offset, int(chunkSize))
				if err != nil {
					return err
				}
				if n == 0 {
					break
				}
			}
			return nil
		}
	}

	// Fallback to optimized regular streaming
	return s.streamWithOptimizedIO(w, file, fileSize)
}

// streamFromMemoryMap streams from memory-mapped file data
func (s *OptimizedStreamService) streamFromMemoryMap(w http.ResponseWriter, mmapData []byte, isLocalNetwork bool) error {
	// Calculate optimal chunk size for memory-mapped streaming
	chunkSize := s.chunkSize
	if isLocalNetwork {
		chunkSize *= 8 // 8x chunk size for local network (128MB chunks)
	}

	flusher, canFlush := w.(http.Flusher)
	dataLen := int64(len(mmapData))
	offset := int64(0)

	for offset < dataLen {
		end := offset + chunkSize
		if end > dataLen {
			end = dataLen
		}

		// Zero-copy write from memory map
		chunk := mmapData[offset:end]
		if _, err := w.Write(chunk); err != nil {
			return err
		}

		// Immediate flushing for instant delivery
		if canFlush {
			flusher.Flush()
		}

		offset = end
		// No delays for memory-mapped streaming
	}

	return nil
}

// streamWithParallelIO streams with parallel I/O workers for maximum throughput
func (s *OptimizedStreamService) streamWithParallelIO(w http.ResponseWriter, r *http.Request, file *os.File, fileSize int64, bufferSize int64, isLocalNetwork bool) error {
	// For very large files, use parallel chunk reading
	if fileSize > 5*1024*1024*1024 { // > 5GB
		return s.streamWithParallelChunks(w, r, file, fileSize, bufferSize, isLocalNetwork)
	}

	// For smaller files, use optimized single-threaded streaming
	return s.streamWithOptimizedIO(w, file, fileSize)
}

// streamWithParallelChunks uses multiple goroutines for parallel chunk reading
func (s *OptimizedStreamService) streamWithParallelChunks(w http.ResponseWriter, r *http.Request, file *os.File, fileSize int64, bufferSize int64, isLocalNetwork bool) error {
	// Create channels for parallel processing
	chunkChan := make(chan []byte, s.parallelWorkers*2)
	errorChan := make(chan error, 1)
	doneChan := make(chan bool, 1)

	// Start parallel readers
	go func() {
		defer close(chunkChan)

		workers := make(chan struct{}, s.parallelWorkers)
		var wg sync.WaitGroup

		offset := int64(0)
		chunkSize := bufferSize

		for offset < fileSize {
			select {
			case <-r.Context().Done():
				return
			case workers <- struct{}{}: // Acquire worker
			}

			wg.Add(1)
			go func(readOffset int64, readSize int64) {
				defer func() {
					<-workers // Release worker
					wg.Done()
				}()

				// Create dedicated file handle for this worker
				workerFile, err := os.Open(file.Name())
				if err != nil {
					select {
					case errorChan <- err:
					default:
					}
					return
				}
				defer workerFile.Close()

				// Seek to position
				if _, err := workerFile.Seek(readOffset, 0); err != nil {
					select {
					case errorChan <- err:
					default:
					}
					return
				}

				// Read chunk
				chunkBuffer := make([]byte, readSize)
				n, err := workerFile.Read(chunkBuffer)
				if n > 0 {
					select {
					case chunkChan <- chunkBuffer[:n]:
					case <-r.Context().Done():
						return
					}
				}

				if err != nil && err != io.EOF {
					select {
					case errorChan <- err:
					default:
					}
				}
			}(offset, minInt64(chunkSize, fileSize-offset))

			offset += chunkSize
		}

		wg.Wait()
		doneChan <- true
	}()

	// Stream chunks as they become available
	flusher, canFlush := w.(http.Flusher)

	for {
		select {
		case chunk, ok := <-chunkChan:
			if !ok {
				return nil // All chunks processed
			}

			if _, err := w.Write(chunk); err != nil {
				return err
			}

			// Immediate flushing for instant delivery
			if canFlush {
				flusher.Flush()
			}

		case err := <-errorChan:
			return err

		case <-doneChan:
			return nil

		case <-r.Context().Done():
			return r.Context().Err()
		}
	}
}

// streamWithOptimizedIO fallback for optimized single-threaded streaming
func (s *OptimizedStreamService) streamWithOptimizedIO(w http.ResponseWriter, file *os.File, fileSize int64) error {
	// Use large buffer for maximum throughput
	buffer := make([]byte, s.bufferSize)
	flusher, canFlush := w.(http.Flusher)

	for {
		n, err := file.Read(buffer)
		if n > 0 {
			if _, writeErr := w.Write(buffer[:n]); writeErr != nil {
				return writeErr
			}

			// Immediate flushing for instant delivery
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
		// No artificial delays
	}

	return nil
}

// getAdaptiveBufferSize calculates optimal buffer size based on file size and network
func (s *OptimizedStreamService) getAdaptiveBufferSize(fileSize int64, isLocalNetwork bool) int64 {
	baseBuffer := s.bufferSize

	// Scale buffer size based on file size
	if fileSize > 20*1024*1024*1024 { // > 20GB
		baseBuffer = 512 * 1024 * 1024 // 512MB
	} else if fileSize > 10*1024*1024*1024 { // > 10GB
		baseBuffer = 256 * 1024 * 1024 // 256MB
	} else if fileSize > 5*1024*1024*1024 { // > 5GB
		baseBuffer = 128 * 1024 * 1024 // 128MB
	} else if fileSize > 1024*1024*1024 { // > 1GB
		baseBuffer = 64 * 1024 * 1024 // 64MB
	}

	// Additional boost for local network
	if isLocalNetwork {
		baseBuffer *= 2
	}

	return baseBuffer
}

// setupMemoryMapping sets up memory mapping for large files
func (s *OptimizedStreamService) setupMemoryMapping(session *StreamSession) error {
	// Check if already mapped
	s.mmapMutex.RLock()
	if mmapData, exists := s.mmapCache[session.FilePath]; exists {
		session.MmapData = mmapData
		s.mmapMutex.RUnlock()
		return nil
	}
	s.mmapMutex.RUnlock()

	// Only map files smaller than 8GB to avoid address space issues
	if session.FileSize > 8*1024*1024*1024 {
		return fmt.Errorf("file too large for memory mapping: %d bytes", session.FileSize)
	}

	file, err := os.Open(session.FilePath)
	if err != nil {
		return err
	}
	defer file.Close()

	// Memory map the file
	mmapData, err := syscall.Mmap(int(file.Fd()), 0, int(session.FileSize), syscall.PROT_READ, syscall.MAP_PRIVATE)
	if err != nil {
		return err
	}

	// Cache the memory mapping
	s.mmapMutex.Lock()
	s.mmapCache[session.FilePath] = mmapData
	session.MmapData = mmapData
	s.mmapMutex.Unlock()

	log.Printf("🗺️ Memory mapped file for instant access: %s (%dGB)", session.FilePath, session.FileSize/(1024*1024*1024))

	return nil
}

// minInt64 helper function
func minInt64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
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
			ChunkWorkers:    make(chan struct{}, s.parallelWorkers),
		}
		s.activeStreams[sessionKey] = session

		// Start preloading first chunks for instant startup
		go s.preloadSessionChunks(session)

		// Create memory mapping for instant access
		s.createMemoryMapping(session)
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

// createMemoryMapping creates memory mapping for instant access
func (s *OptimizedStreamService) createMemoryMapping(session *StreamSession) {
	file, err := os.Open(session.FilePath)
	if err != nil {
		return
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return
	}

	// Create memory mapping
	mmapData, err := syscall.Mmap(int(file.Fd()), 0, int(fileInfo.Size()), syscall.PROT_READ, syscall.MAP_SHARED)
	if err != nil {
		return
	}

	// Store memory mapping
	s.mmapMutex.Lock()
	s.mmapCache[session.FilePath] = mmapData
	s.mmapMutex.Unlock()

	// Store memory mapping in session
	session.MmapData = mmapData
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

// maintainCache performs periodic cache maintenance with memory mapping cleanup
func (s *OptimizedStreamService) maintainCache() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		s.cacheMutex.Lock()

		// Clean up old sessions
		s.streamsMutex.Lock()
		for key, session := range s.activeStreams {
			if time.Since(session.LastAccess) > 30*time.Minute {
				// Cleanup memory mapping if exists
				if session.MmapData != nil {
					s.mmapMutex.Lock()
					if mmapData, exists := s.mmapCache[session.FilePath]; exists {
						syscall.Munmap(mmapData)
						delete(s.mmapCache, session.FilePath)
					}
					s.mmapMutex.Unlock()
				}
				delete(s.activeStreams, key)
			}
		}
		s.streamsMutex.Unlock()

		// Log cache statistics
		cacheSize := int64(0)
		for _, chunk := range s.chunkCache {
			cacheSize += int64(len(chunk))
		}

		// Log memory mapping statistics
		s.mmapMutex.RLock()
		mmapCount := len(s.mmapCache)
		mmapSize := int64(0)
		for _, mmapData := range s.mmapCache {
			mmapSize += int64(len(mmapData))
		}
		s.mmapMutex.RUnlock()

		s.cacheMutex.Unlock()

		log.Printf("📊 Stream cache: %d chunks (%dMB), %d mmaps (%dMB), %d active sessions",
			len(s.chunkCache), cacheSize/(1024*1024), mmapCount, mmapSize/(1024*1024), len(s.activeStreams))
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

// streamRangeRequestOptimized handles range requests with Netflix-like instant seeking
func (s *OptimizedStreamService) streamRangeRequestOptimized(w http.ResponseWriter, r *http.Request, file *os.File, fileSize int64, rangeHeader string, session *StreamSession, isLocalNetwork bool) error {
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
	return s.streamRangeWithChunkingOptimized(w, r, file, contentLength, start, end, session, isLocalNetwork, chunkKey)
}

// streamRangeWithChunkingOptimized streams range with intelligent chunking and caching
func (s *OptimizedStreamService) streamRangeWithChunkingOptimized(w http.ResponseWriter, r *http.Request, file *os.File, contentLength, start, end int64, session *StreamSession, isLocalNetwork bool, chunkKey string) error {
	// Calculate optimal chunk size based on range and network
	chunkSize := s.chunkSize
	if isLocalNetwork {
		chunkSize *= 4 // 4x chunk size for local network
	}

	// Adjust chunk size for small ranges
	if contentLength < chunkSize {
		chunkSize = contentLength
	}

	// Use memory-mapped data if available for this range
	if session.MmapData != nil && start+contentLength <= int64(len(session.MmapData)) {
		chunk := session.MmapData[start : start+contentLength]
		if _, err := w.Write(chunk); err != nil {
			return err
		}

		// Cache the range for future requests
		s.cacheChunk(chunkKey, chunk)
		return nil
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

			// Write chunk immediately
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

		// No sleep for instant streaming
	}

	// Cache the complete range for future requests (limit cache size)
	if len(totalData) > 0 && len(totalData) <= int(s.chunkSize*8) { // Cache ranges up to 64MB
		s.cacheChunk(chunkKey, totalData)
	}

	return nil
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
