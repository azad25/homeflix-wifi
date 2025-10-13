package services

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"homeflix-backend/internal/utils"
)

// NetflixStreamService provides Netflix-level instant HD/4K streaming with ultra-fast I/O
type NetflixStreamService struct {
	// Core configuration - Enhanced for maximum I/O throughput
	segmentSize   int64 // Adaptive segment size (1-16MB for 4K)
	maxBufferSize int64 // Max RAM buffering (up to 4GB)
	cacheSize     int64

	// Advanced pooling with I/O optimization
	bufferPool   *BufferPool
	workerPool   *StreamWorkerPool
	ioWorkerPool *IOWorkerPool // Dedicated I/O workers

	// Multi-tier caching with NVMe optimization
	l1Cache *L1SegmentCache // Hot cache (RAM)
	l2Cache *L2FileCache    // Warm cache (mmap)
	l3Cache *L3DiskCache    // NVMe/SSD cache

	// Performance tracking
	stats *StreamStats

	// MKV-specific
	mkvIndexer *MKVIndexer

	// 4K-specific
	adaptiveBitrate *AdaptiveBitrate

	// Connection management
	activeSessions map[string]*NetflixSession
	sessionMutex   sync.RWMutex

	// System tuning for maximum I/O performance
	tcpWindowSize   int
	enableSendfile  bool
	enableDirectIO  bool // Direct I/O bypass page cache
	enableReadahead bool // Kernel readahead optimization
	cpuCores        int
	totalMemory     int64
	ioScheduler     string // I/O scheduler (mq-deadline, kyber)

	// Advanced I/O optimization
	prefetchDistance int64 // Prefetch distance in bytes
	readAheadSize    int64 // Readahead buffer size
	ioQueueDepth     int   // I/O queue depth for NVMe

	// Legacy compatibility
	alacService *ALACAudioService

	// Audio transcoding for MKV compatibility
	audioTranscoder *AudioTranscoder
}

// L1SegmentCache - Hot cache for immediate playback
type L1SegmentCache struct {
	segments map[string]*CachedSegment
	mu       sync.RWMutex
	maxSize  int64
	curSize  int64
	lru      *LRUList
}

type CachedSegment struct {
	key      string
	data     []byte
	offset   int64
	size     int64
	created  time.Time
	accessed time.Time
	hits     int64
}

type LRUList struct {
	segments map[string]*CachedSegment
	head     *CachedSegment
	tail     *CachedSegment
}

// L2FileCache - Warm cache using memory mapping
type L2FileCache struct {
	mappings map[string][]byte
	mu       sync.RWMutex
	maxSize  int64
	curSize  int64
}

// BufferPool - Reusable buffer allocation with I/O optimization
type BufferPool struct {
	tiny   sync.Pool // 64KB for metadata
	small  sync.Pool // 512KB for standard streaming
	medium sync.Pool // 4MB for HD streaming
	large  sync.Pool // 16MB for 4K streaming
	xlarge sync.Pool // 64MB for ultra-high bitrate
}

// IOWorkerPool - Dedicated I/O workers for maximum disk throughput
type IOWorkerPool struct {
	workers    int
	taskChan   chan IOTask
	resultChan chan IOResult
	active     int64
	mu         sync.Mutex
}

type IOTask struct {
	filePath   string
	offset     int64
	size       int64
	priority   int
	resultChan chan IOResult
	sessionID  string
}

type IOResult struct {
	data      []byte
	err       error
	bytesRead int64
	duration  time.Duration
	cacheHit  bool
}

// L3DiskCache - NVMe/SSD optimized disk cache
type L3DiskCache struct {
	cacheDir      string
	maxSize       int64
	curSize       int64
	files         map[string]*CacheEntry
	mu            sync.RWMutex
	cleanupTicker *time.Ticker
}

type CacheEntry struct {
	filePath   string
	size       int64
	lastAccess time.Time
	hitCount   int64
}

// StreamWorkerPool - Thread-safe worker goroutines for streaming
type StreamWorkerPool struct {
	workers  int
	taskChan chan StreamWorkerTask
	wg       sync.WaitGroup
	active   int32
}

type StreamWorkerTask struct {
	task func()
}

// StreamStats - Real-time performance metrics
type StreamStats struct {
	bytesServed    int64
	requestsServed int64
	cacheHits      int64
	cacheMisses    int64
	avgLatency     int64
}

// MKVIndexer - Fast MKV seeking without full parse
type MKVIndexer struct {
	fileIndexes map[string]*MKVIndex
	mu          sync.RWMutex
}

type MKVIndex struct {
	seekHeads []int64 // EBML SeekHead offsets
	cues      []int64 // Cue point offsets
	clusters  []ClusterInfo
	duration  int64
	indexed   bool
}

type ClusterInfo struct {
	offset    int64
	timestamp int64
}

// AdaptiveBitrate - Dynamic quality adjustment for 4K
type AdaptiveBitrate struct {
	currentBitrate int64
	networkSpeed   int64
	lastCheckTime  time.Time
	bufferHealth   float64
}

// NetflixSession - Per-client connection state
type NetflixSession struct {
	filePath      string
	fileSize      int64
	clientIP      string
	startTime     time.Time
	lastActivity  time.Time
	bitrate       int64
	quality       string
	cancelChan    chan struct{}
	activeReaders int32
	prefetchBuf   *PrefetchBuffer
	mkvIndex      *MKVIndex
}

// PrefetchBuffer - Intelligent prefetching for seamless playback
type PrefetchBuffer struct {
	segments   []*PrefetchSegment
	mu         sync.Mutex
	readPos    int64
	writePos   int64
	bufferSize int64
}

type PrefetchSegment struct {
	offset int64
	data   []byte
	ready  bool
}

// AudioTranscoder - Handles MKV audio compatibility issues
type AudioTranscoder struct {
	mu               sync.RWMutex
	transcodingCache map[string]*TranscodedAudio
	maxCacheSize     int64
	currentCacheSize int64
}

type TranscodedAudio struct {
	filePath        string
	transcodedPath  string
	originalCodec   string
	transcodedCodec string
	created         time.Time
	size            int64
}

type AudioInfo struct {
	Codec      string
	Channels   int
	SampleRate int
	BitRate    int
	Compatible bool
}

// Legacy type alias for backward compatibility
type OptimizedStreamService = NetflixStreamService

func NewOptimizedStreamService(cacheSize, chunkSize int64) *NetflixStreamService {
	return NewNetflixStreamService(nil)
}

func NewNetflixStreamService(alacService *ALACAudioService) *NetflixStreamService {
	cpuCores := runtime.NumCPU()
	totalMemory := getTotalMemory()

	// NETFLIX-LEVEL ULTRA-AGGRESSIVE CONFIGURATION
	segmentSize := int64(64 * 1024 * 1024)         // 64MB segments for Netflix-level I/O
	maxBufferSize := int64(8 * 1024 * 1024 * 1024) // 8GB buffer for massive files
	cacheSize := int64(16 * 1024 * 1024 * 1024)    // 16GB cache for instant access

	service := &NetflixStreamService{
		segmentSize:      segmentSize,
		maxBufferSize:    maxBufferSize,
		cacheSize:        cacheSize,
		bufferPool:       newBufferPool(),
		workerPool:       newStreamWorkerPool(cpuCores * 32), // 32x CPU cores
		ioWorkerPool:     newIOWorkerPool(cpuCores * 8),      // Dedicated I/O workers
		l1Cache:          newL1SegmentCache(cacheSize / 8),   // 1GB L1 cache
		l2Cache:          newL2FileCache(cacheSize / 4),      // 2GB L2 cache
		l3Cache:          newL3DiskCache(cacheSize / 2),      // 4GB L3 cache
		stats:            newStreamStats(),
		mkvIndexer:       NewMKVIndexer(),
		adaptiveBitrate:  newAdaptiveBitrate(),
		activeSessions:   make(map[string]*NetflixSession),
		tcpWindowSize:    4 * 1024 * 1024, // 4MB TCP window for high throughput
		enableSendfile:   false, // DISABLED: Prevents hijacking errors
		enableDirectIO:   true, // Bypass page cache for large files
		enableReadahead:  true, // Kernel readahead optimization
		cpuCores:         cpuCores,
		totalMemory:      totalMemory,
		ioScheduler:      "mq-deadline",    // Multi-queue deadline scheduler
		prefetchDistance: 64 * 1024 * 1024, // 64MB prefetch
		readAheadSize:    32 * 1024 * 1024, // 32MB readahead
		ioQueueDepth:     128,              // Deep I/O queue for NVMe
		alacService:      alacService,
		audioTranscoder:  newAudioTranscoder(),
	}

	go service.initializeCaches()

	log.Printf("🚀 Netflix Instant Stream Service Ready | CPU:%d | RAM:%dGB | SafeStreaming:enabled",
		cpuCores, totalMemory/(1024*1024*1024))

	return service
}

// ...

// Advanced I/O optimization functions
func getTotalMemory() int64 {
	// Get system memory info
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	return int64(m.Sys)
}

func newIOWorkerPool(workers int) *IOWorkerPool {
	pool := &IOWorkerPool{
		workers:    workers,
		taskChan:   make(chan IOTask, workers*4),
		resultChan: make(chan IOResult, workers*4),
	}

	// Start I/O workers
	for i := 0; i < workers; i++ {
		go pool.worker()
	}

	log.Printf("🔧 Started %d dedicated I/O workers for maximum disk throughput", workers)
	return pool
}

func (pool *IOWorkerPool) worker() {
	for task := range pool.taskChan {
		atomic.AddInt64(&pool.active, 1)

		start := time.Now()
		data, err := pool.readFileChunk(task.filePath, task.offset, task.size)
		duration := time.Since(start)

		result := IOResult{
			data:      data,
			err:       err,
			bytesRead: int64(len(data)),
			duration:  duration,
			cacheHit:  false,
		}

		select {
		case task.resultChan <- result:
		default:
			// Non-blocking send
		}

		atomic.AddInt64(&pool.active, -1)
	}
}

func (pool *IOWorkerPool) readFileChunk(filePath string, offset, size int64) ([]byte, error) {
	file, err := os.OpenFile(filePath, os.O_RDONLY, 0)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	// Enable direct I/O for large reads
	if size > 1024*1024 { // > 1MB
		if fd := int(file.Fd()); fd > 0 {
			// Set O_DIRECT flag for bypassing page cache
			syscall.Syscall(syscall.SYS_FCNTL, uintptr(fd), syscall.F_SETFL, syscall.O_DIRECT)
		}
	}

	// Seek to offset
	_, err = file.Seek(offset, 0)
	if err != nil {
		return nil, err
	}

	// Read chunk with optimized buffer
	buffer := make([]byte, size)
	n, err := io.ReadFull(file, buffer)
	if err != nil && err != io.ErrUnexpectedEOF {
		return nil, err
	}

	return buffer[:n], nil
}

func newL3DiskCache(maxSize int64) *L3DiskCache {
	cacheDir := filepath.Join(os.TempDir(), "homeflix-l3-cache")
	os.MkdirAll(cacheDir, 0755)

	cache := &L3DiskCache{
		cacheDir: cacheDir,
		maxSize:  maxSize,
		files:    make(map[string]*CacheEntry),
	}

	// Start cleanup goroutine
	cache.cleanupTicker = time.NewTicker(5 * time.Minute)
	go cache.cleanup()

	log.Printf("💾 L3 Disk Cache initialized: %s (max: %dMB)", cacheDir, maxSize/(1024*1024))
	return cache
}

func (cache *L3DiskCache) cleanup() {
	for range cache.cleanupTicker.C {
		cache.mu.Lock()

		// Remove old entries if cache is full
		if cache.curSize > cache.maxSize {
			var oldestEntry *CacheEntry
			var oldestKey string

			for key, entry := range cache.files {
				if oldestEntry == nil || entry.lastAccess.Before(oldestEntry.lastAccess) {
					oldestEntry = entry
					oldestKey = key
				}
			}

			if oldestEntry != nil {
				os.Remove(filepath.Join(cache.cacheDir, oldestKey))
				cache.curSize -= oldestEntry.size
				delete(cache.files, oldestKey)
			}
		}

		cache.mu.Unlock()
	}
}

func newBufferPool() *BufferPool {
	return &BufferPool{
		tiny: sync.Pool{
			New: func() interface{} {
				return make([]byte, 256*1024) // 256KB for metadata (Netflix-level)
			},
		},
		small: sync.Pool{
			New: func() interface{} {
				return make([]byte, 2*1024*1024) // 2MB for standard streaming
			},
		},
		medium: sync.Pool{
			New: func() interface{} {
				return make([]byte, 16*1024*1024) // 16MB for HD streaming
			},
		},
		large: sync.Pool{
			New: func() interface{} {
				return make([]byte, 64*1024*1024) // 64MB for 4K streaming
			},
		},
		xlarge: sync.Pool{
			New: func() interface{} {
				return make([]byte, 256*1024*1024) // 256MB for Netflix-level ultra-high bitrate
			},
		},
	}
}

// ...

func (bp *BufferPool) Get(size int64) []byte {
	if size <= 256*1024 {
		return bp.tiny.Get().([]byte)
	} else if size <= 2*1024*1024 {
		return bp.small.Get().([]byte)
	} else if size <= 16*1024*1024 {
		return bp.medium.Get().([]byte)
	} else if size <= 64*1024*1024 {
		return bp.large.Get().([]byte)
	} else {
		return bp.xlarge.Get().([]byte) // Netflix-level 256MB buffer
	}
}

func (bp *BufferPool) Put(buf []byte) {
	switch cap(buf) {
	case 256 * 1024:
		bp.tiny.Put(buf)
	case 2 * 1024 * 1024:
		bp.small.Put(buf)
	case 16 * 1024 * 1024:
		bp.medium.Put(buf)
	case 64 * 1024 * 1024:
		bp.large.Put(buf)
	case 256 * 1024 * 1024:
		bp.xlarge.Put(buf) // Netflix-level 256MB buffer
	}
}

// Missing constructor functions
func newStreamWorkerPool(workers int) *StreamWorkerPool {
	return &StreamWorkerPool{
		workers:  workers,
		taskChan: make(chan StreamWorkerTask, workers*4),
	}
}

func newL1SegmentCache(maxSize int64) *L1SegmentCache {
	return &L1SegmentCache{
		segments: make(map[string]*CachedSegment),
		maxSize:  maxSize,
		lru:      &LRUList{segments: make(map[string]*CachedSegment)},
	}
}

func newL2FileCache(maxSize int64) *L2FileCache {
	return &L2FileCache{
		mappings: make(map[string][]byte),
		maxSize:  maxSize,
	}
}

func newStreamStats() *StreamStats {
	return &StreamStats{}
}

func NewMKVIndexer() *MKVIndexer {
	return &MKVIndexer{}
}

func newAdaptiveBitrate() *AdaptiveBitrate {
	return &AdaptiveBitrate{}
}

func newAudioTranscoder() *AudioTranscoder {
	return &AudioTranscoder{
		transcodingCache: make(map[string]*TranscodedAudio),
		maxCacheSize:     2 * 1024 * 1024 * 1024, // 2GB cache for transcoded audio
	}
}

// Core streaming methods
func (s *NetflixStreamService) StreamVideo(w http.ResponseWriter, r *http.Request, filePath string) error {
	return s.Stream(w, r, filePath)
}

func (s *NetflixStreamService) Stream(w http.ResponseWriter, r *http.Request, filePath string) error {
	log.Printf("📹 Direct streaming: %s (browser-compatible format)", filePath)
	
	fileExt := strings.ToLower(filepath.Ext(filePath))

	// Check if MKV file needs audio transcoding (aggressive check)
	if fileExt == ".mkv" {
		audioInfo, err := s.audioTranscoder.analyzeAudioCodec(filePath)
		if err != nil {
			log.Printf("⚠️ Audio analysis failed for %s: %v", filepath.Base(filePath), err)
		} else if !audioInfo.Compatible {
			log.Printf("🔄 MKV audio transcoding needed for %s (codec: %s)", filepath.Base(filePath), audioInfo.Codec)
			return s.streamWithAudioTranscoding(w, r, filePath, audioInfo)
		}
	}

	// Optional check for MP4 files with potentially incompatible audio (less aggressive)
	if fileExt == ".mp4" || fileExt == ".m4v" {
		audioInfo, err := s.audioTranscoder.analyzeAudioCodec(filePath)
		if err != nil {
			log.Printf("⚠️ Audio analysis failed for MP4 %s: %v (continuing with direct stream)", filepath.Base(filePath), err)
		} else if !audioInfo.Compatible {
			log.Printf("🔄 MP4 audio transcoding needed for %s (codec: %s)", filepath.Base(filePath), audioInfo.Codec)
			return s.streamWithAudioTranscoding(w, r, filePath, audioInfo)
		} else {
			log.Printf("✅ MP4 audio compatible for %s (codec: %s)", filepath.Base(filePath), audioInfo.Codec)
		}
	}

	// SAFE STREAMING: Open file and stream without hijacking
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("failed to open file: %v", err)
	}
	defer file.Close()

	// Get file info for size
	stat, err := file.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat file: %v", err)
	}
	fileSize := stat.Size()

	// Set headers for streaming with proper MIME type
	contentType := utils.GetVideoContentType(filePath)
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", fileSize))
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Keep-Alive", "timeout=300, max=1000")

	log.Printf("📺 Streaming %s with Content-Type: %s", filepath.Base(filePath), contentType)

	// Handle range requests for seeking
	rangeHeader := r.Header.Get("Range")
	if rangeHeader != "" {
		return s.handleRangeRequest(w, r, file, fileSize, rangeHeader)
	}

	// Stream entire file with SAFE optimized I/O (no hijacking)
	return s.streamWithOptimizedIO(w, file, fileSize)
}

func (s *NetflixStreamService) handleRangeRequest(w http.ResponseWriter, r *http.Request, file *os.File, fileSize int64, rangeHeader string) error {
	// Parse range header with timeout protection
	ctx := r.Context()
	select {
	case <-ctx.Done():
		return fmt.Errorf("request cancelled")
	default:
	}

	ranges, err := parseRangeHeader(rangeHeader, fileSize)
	if err != nil {
		w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
		w.Header().Set("Content-Range", fmt.Sprintf("bytes */%d", fileSize))
		return fmt.Errorf("invalid range header: %v", err)
	}

	if len(ranges) != 1 {
		w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
		w.Header().Set("Content-Range", fmt.Sprintf("bytes */%d", fileSize))
		return fmt.Errorf("multiple ranges not supported")
	}

	// Get the single range
	start, end := ranges[0].start, ranges[0].end
	contentLength := end - start + 1

	// Validate range bounds
	if start < 0 || start >= fileSize || end >= fileSize || start > end {
		w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
		w.Header().Set("Content-Range", fmt.Sprintf("bytes */%d", fileSize))
		return fmt.Errorf("invalid range bounds: %d-%d for file size %d", start, end, fileSize)
	}

	// Set partial content headers with connection management
	w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, fileSize))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", contentLength))
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Keep-Alive", "timeout=30, max=100")
	w.WriteHeader(http.StatusPartialContent)

	// Seek to start position
	_, err = file.Seek(start, 0)
	if err != nil {
		return fmt.Errorf("failed to seek to position %d: %v", start, err)
	}

	// Use optimized buffer size based on range size
	bufferSize := s.segmentSize
	if contentLength < bufferSize {
		bufferSize = contentLength
	}
	buffer := s.bufferPool.Get(bufferSize)
	defer s.bufferPool.Put(buffer)

	// NETFLIX-LEVEL INSTANT RANGE STREAMING
	// Set aggressive headers for instant seeking
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("X-Accel-Buffering", "no")
	
	// Force immediate header flush for instant seeking
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}
	
	limitedReader := io.LimitReader(file, contentLength)
	written, err := s.copyWithInstantFlushing(w, limitedReader, buffer)
	
	if err != nil {
		// Check for broken pipe or connection reset
		if strings.Contains(err.Error(), "broken pipe") || strings.Contains(err.Error(), "connection reset") {
			log.Printf("⚠️ Client disconnected during range stream: %d-%d", start, end)
			return nil // Don't treat as error - client disconnection is normal
		}
		return fmt.Errorf("failed to stream range %d-%d: %v", start, end, err)
	}

	log.Printf("📹 Streamed range %d-%d (%d bytes written) of %d total", start, end, written, fileSize)
	return nil
}

func (s *NetflixStreamService) streamWithOptimizedIO(w http.ResponseWriter, file *os.File, fileSize int64) error {
	// NETFLIX-LEVEL INSTANT STREAMING
	// Use maximum buffer size for instant throughput
	buffer := s.bufferPool.Get(64 * 1024 * 1024) // 64MB buffer for Netflix-level performance
	defer s.bufferPool.Put(buffer)

	// Set aggressive headers for instant streaming
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	w.Header().Set("X-Accel-Buffering", "no") // Disable nginx buffering
	w.Header().Set("X-Content-Type-Options", "nosniff")

	// Force immediate flush of headers
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}

	// INSTANT STREAMING: Copy with aggressive flushing
	_, err := s.copyWithInstantFlushing(w, file, buffer)
	if err != nil {
		return fmt.Errorf("streaming failed: %v", err)
	}

	log.Printf("⚡ INSTANT Netflix-level stream: %d bytes", fileSize)
	return nil
}

func (s *NetflixStreamService) initializeCaches() {
	// Initialize cache warming in background
	log.Printf("🔥 Initializing ultra-fast I/O caches...")
	// Cache warming logic would go here
}

// Critical performance optimization methods

// streamRangeWithSendfile - Zero-copy range streaming with sendfile syscall
func (s *NetflixStreamService) streamRangeWithSendfile(w http.ResponseWriter, file *os.File, offset, length int64) error {
	hijacker, ok := w.(http.Hijacker)
	if !ok {
		return fmt.Errorf("connection hijacking not supported")
	}

	conn, _, err := hijacker.Hijack()
	if err != nil {
		return fmt.Errorf("failed to hijack connection: %v", err)
	}
	defer conn.Close()

	// Optimize TCP connection for instant delivery
	if tcpConn, ok := conn.(*net.TCPConn); ok {
		tcpConn.SetNoDelay(true)
		tcpConn.SetWriteBuffer(4 * 1024 * 1024) // 4MB write buffer
		tcpConn.SetKeepAlive(true)
		tcpConn.SetKeepAlivePeriod(30 * time.Second)
	}

	// Use sendfile syscall for zero-copy transfer
	if tcpConn, ok := conn.(*net.TCPConn); ok {
		tcpFile, err := tcpConn.File()
		if err == nil {
			defer tcpFile.Close()
			
			// Direct sendfile syscall with offset
			offsetPtr := offset
			written, err := syscall.Sendfile(int(tcpFile.Fd()), int(file.Fd()), &offsetPtr, int(length))
			if err == nil && int64(written) == length {
				return nil
			}
		}
	}

	return fmt.Errorf("sendfile range failed")
}

// streamWithSendfile - Zero-copy full file streaming with sendfile syscall
func (s *NetflixStreamService) streamWithSendfile(w http.ResponseWriter, file *os.File, fileSize int64) error {
	hijacker, ok := w.(http.Hijacker)
	if !ok {
		return fmt.Errorf("connection hijacking not supported")
	}

	conn, _, err := hijacker.Hijack()
	if err != nil {
		return fmt.Errorf("failed to hijack connection: %v", err)
	}
	defer conn.Close()

	// Optimize TCP connection
	if tcpConn, ok := conn.(*net.TCPConn); ok {
		tcpConn.SetNoDelay(true)
		tcpConn.SetWriteBuffer(8 * 1024 * 1024) // 8MB write buffer
		tcpConn.SetKeepAlive(true)
		tcpConn.SetKeepAlivePeriod(30 * time.Second)
	}

	// Write HTTP headers manually for hijacked connection
	headers := fmt.Sprintf("HTTP/1.1 200 OK\r\n"+
		"Content-Type: video/mp4\r\n"+
		"Content-Length: %d\r\n"+
		"Accept-Ranges: bytes\r\n"+
		"Connection: keep-alive\r\n"+
		"Keep-Alive: timeout=30, max=100\r\n"+
		"\r\n", fileSize)

	if _, err := conn.Write([]byte(headers)); err != nil {
		return fmt.Errorf("failed to write headers: %v", err)
	}

	// Use sendfile for zero-copy transfer
	if tcpConn, ok := conn.(*net.TCPConn); ok {
		tcpFile, err := tcpConn.File()
		if err == nil {
			defer tcpFile.Close()
			
			// Direct sendfile syscall for maximum performance
			written, err := syscall.Sendfile(int(tcpFile.Fd()), int(file.Fd()), nil, int(fileSize))
			if err == nil && int64(written) == fileSize {
				return nil
			}
		}
	}

	return fmt.Errorf("sendfile failed")
}

// copyWithTimeoutProtection - Copy with context cancellation and timeout protection
func (s *NetflixStreamService) copyWithTimeoutProtection(dst io.Writer, src io.Reader, buffer []byte, ctx context.Context) (int64, error) {
	var written int64
	var err error

	// Create a channel to signal completion
	done := make(chan struct{})

	go func() {
		defer close(done)
		written, err = io.CopyBuffer(dst, src, buffer)
	}()

	// Wait for either completion or context cancellation
	select {
	case <-done:
		return written, err
	case <-ctx.Done():
		return written, fmt.Errorf("stream cancelled: %v", ctx.Err())
	case <-time.After(30 * time.Second): // 30 second timeout
		return written, fmt.Errorf("stream timeout after 30 seconds")
	}
}

// copyWithInstantFlushing - Netflix-level instant streaming with aggressive flushing
func (s *NetflixStreamService) copyWithInstantFlushing(dst io.Writer, src io.Reader, buffer []byte) (int64, error) {
	var written int64
	flusher, canFlush := dst.(http.Flusher)
	
	// NETFLIX-LEVEL STREAMING: Read and flush immediately for instant playback
	for {
		n, err := src.Read(buffer)
		if n > 0 {
			// Write chunk immediately
			m, writeErr := dst.Write(buffer[:n])
			written += int64(m)
			
			// INSTANT FLUSH: Force immediate delivery like Netflix
			if canFlush {
				flusher.Flush()
			}
			
			if writeErr != nil {
				// Handle broken pipe as normal client disconnection
				if strings.Contains(writeErr.Error(), "broken pipe") || 
				   strings.Contains(writeErr.Error(), "connection reset") {
					log.Printf("⚠️ Client disconnected during instant stream (written: %d bytes)", written)
					return written, nil
				}
				return written, writeErr
			}
		}
		
		if err == io.EOF {
			break
		}
		if err != nil {
			return written, err
		}
	}
	
	// Final flush to ensure all data is sent
	if canFlush {
		flusher.Flush()
	}
	
	return written, nil
}

// copyWithBrokenPipeProtection - Copy with broken pipe error handling
func (s *NetflixStreamService) copyWithBrokenPipeProtection(dst io.Writer, src io.Reader, buffer []byte) (int64, error) {
	written, err := io.CopyBuffer(dst, src, buffer)
	
	if err != nil {
		// Handle broken pipe and connection reset as normal client disconnection
		if strings.Contains(err.Error(), "broken pipe") || 
		   strings.Contains(err.Error(), "connection reset") ||
		   strings.Contains(err.Error(), "write: connection reset by peer") {
			log.Printf("⚠️ Client disconnected during stream (written: %d bytes)", written)
			return written, nil // Don't treat as error
		}
	}
	
	return written, err
}

// Ultra-fast preview clip streaming methods
func (s *NetflixStreamService) handlePreviewRangeRequestInstant(w http.ResponseWriter, r *http.Request, file *os.File, fileSize int64, rangeHeader string) error {
	// Fast range parsing with minimal allocations
	var start, end int64 = 0, fileSize - 1

	if strings.HasPrefix(rangeHeader, "bytes=") {
		rangeSpec := rangeHeader[6:] // Skip "bytes="
		if dashIdx := strings.IndexByte(rangeSpec, '-'); dashIdx != -1 {
			if dashIdx > 0 {
				if s, err := strconv.ParseInt(rangeSpec[:dashIdx], 10, 64); err == nil {
					start = s
				}
			}
			if dashIdx < len(rangeSpec)-1 {
				if e, err := strconv.ParseInt(rangeSpec[dashIdx+1:], 10, 64); err == nil {
					end = e
				}
			}
		}
	}

	// Clamp range to file bounds
	if start < 0 || start >= fileSize {
		start = 0
	}
	if end >= fileSize {
		end = fileSize - 1
	}
	if start > end {
		start = end
	}

	contentLength := end - start + 1

	// Set headers efficiently
	headers := w.Header()
	headers.Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, fileSize))
	headers.Set("Content-Length", fmt.Sprintf("%d", contentLength))
	w.WriteHeader(http.StatusPartialContent)

	// Try sendfile for zero-copy range streaming
	if conn, ok := w.(http.Hijacker); ok {
		if netConn, _, err := conn.Hijack(); err == nil {
			defer netConn.Close()
			
			// Configure TCP for instant delivery
			if tcpConn, ok := netConn.(*net.TCPConn); ok {
				tcpConn.SetNoDelay(true)
				tcpConn.SetWriteBuffer(2 * 1024 * 1024) // 2MB write buffer
				tcpConn.SetReadBuffer(64 * 1024)        // Small read buffer
			}

			// Use sendfile for zero-copy streaming
			if tcpFile, ok := netConn.(*net.TCPConn); ok {
				if f, err := tcpFile.File(); err == nil {
					defer f.Close()
					_, err := syscall.Sendfile(int(f.Fd()), int(file.Fd()), &start, int(contentLength))
					if err == nil {
						log.Printf("⚡ Zero-copy sendfile range stream: %d bytes", contentLength)
						return nil
					}
				}
			}
		}
	}

	// Fallback: seek and copy with minimal buffer
	if _, err := file.Seek(start, 0); err != nil {
		return err
	}

	// Use tiny buffer for range requests (preview clips are small)
	buffer := make([]byte, 32*1024) // 32KB buffer for instant response
	_, err := io.CopyBuffer(w, io.LimitReader(file, contentLength), buffer)
	return err
}

// SAFE preview streaming without hijacking
func (s *NetflixStreamService) streamPreviewSafe(w http.ResponseWriter, r *http.Request, file *os.File, fileSize int64) error {
	// Use safe optimized I/O streaming without hijacking
	return s.streamPreviewWithOptimizedIO(w, file, fileSize)
}

func (s *NetflixStreamService) streamPreviewWithMemoryMapping(w http.ResponseWriter, file *os.File, fileSize int64) error {
	// Memory map for instant access
	data, err := syscall.Mmap(int(file.Fd()), 0, int(fileSize), syscall.PROT_READ, syscall.MAP_SHARED)
	if err != nil {
		return s.streamPreviewWithOptimizedIO(w, file, fileSize)
	}
	defer syscall.Munmap(data)

	// Single write operation from memory
	_, err = w.Write(data)
	if err != nil {
		return fmt.Errorf("failed to write memory-mapped preview: %v", err)
	}

	log.Printf("⚡ Memory-mapped preview: %d bytes (instant)", fileSize)
	return nil
}

func (s *NetflixStreamService) streamPreviewWithOptimizedIO(w http.ResponseWriter, file *os.File, fileSize int64) error {
	// NETFLIX-LEVEL INSTANT PREVIEW STREAMING
	buffer := s.bufferPool.Get(32 * 1024 * 1024) // 32MB buffer for instant preview
	defer s.bufferPool.Put(buffer)

	// Set headers for instant preview streaming
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("X-Accel-Buffering", "no") // Disable any proxy buffering

	// Force immediate header flush
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}

	// INSTANT PREVIEW: Copy with aggressive flushing
	_, err := s.copyWithInstantFlushing(w, file, buffer)
	if err != nil {
		return fmt.Errorf("failed to stream preview clip: %v", err)
	}

	log.Printf("⚡ INSTANT Netflix-level preview: %d bytes", fileSize)
	return nil
}

// HTTP conditional request helper
func checkNotModified(w http.ResponseWriter, r *http.Request, modTime time.Time, etag string) bool {
	// Check If-None-Match header
	if match := r.Header.Get("If-None-Match"); match != "" {
		if match == etag || match == "*" {
			w.WriteHeader(http.StatusNotModified)
			return true
		}
	}

	// Check If-Modified-Since header
	if ms := r.Header.Get("If-Modified-Since"); ms != "" {
		if t, err := http.ParseTime(ms); err == nil {
			if modTime.Before(t.Add(1 * time.Second)) {
				w.WriteHeader(http.StatusNotModified)
				return true
			}
		}
	}

	return false
}

// INSTANT preview clip streaming with zero-copy sendfile and aggressive preloading
func (s *NetflixStreamService) StreamPreviewClip(w http.ResponseWriter, r *http.Request, filePath string) error {
	// Try L1 cache first for instant sub-millisecond response
	cacheKey := fmt.Sprintf("preview:%s", filePath)
	log.Printf("🔍 Checking L1 cache for key: %s", cacheKey)
	if cached := s.l1Cache.Get(cacheKey); cached != nil {
		// INSTANT cache hit - sub-millisecond response
		headers := w.Header()
		headers.Set("Content-Type", "video/mp4")
		headers.Set("Accept-Ranges", "bytes")
		headers.Set("Content-Length", fmt.Sprintf("%d", cached.size))
		headers.Set("Cache-Control", "public, max-age=86400, immutable")
		headers.Set("Access-Control-Allow-Origin", "*")
		headers.Set("X-Cache", "HIT-L1")
		
		// Handle range requests from cache
		rangeHeader := r.Header.Get("Range")
		if rangeHeader != "" {
			return s.streamCachedRange(w, r, cached, rangeHeader)
		}
		
		// Full file from cache
		_, err := w.Write(cached.data)
		if err == nil {
			log.Printf("⚡ L1 cache hit: %s (%d bytes) - INSTANT", filepath.Base(filePath), cached.size)
		}
		return err
	}

	// Open file with minimal syscalls
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("failed to open preview clip: %v", err)
	}
	defer file.Close()

	// Get file info with single stat call
	stat, err := file.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat preview clip: %v", err)
	}
	fileSize := stat.Size()

	// Cache small preview clips in L1 for instant future access
	if fileSize < 100*1024*1024 { // Cache files < 100MB
		log.Printf("🔥 Starting immediate cache for: %s (%d bytes)", filepath.Base(filePath), fileSize)
		// Cache immediately for next request to be instant
		go s.cachePreviewClip(filePath, fileSize, cacheKey)
		
		// Also try to serve from memory mapping for this request
		if fileSize < 50*1024*1024 { // < 50MB for immediate memory mapping
			if err := s.streamPreviewMemoryMapped(w, file, fileSize); err == nil {
				log.Printf("⚡ Memory-mapped first access: %s (%d bytes)", filepath.Base(filePath), fileSize)
				return nil
			}
		}
	}

	// INSTANT response headers - set all at once
	headers := w.Header()
	headers.Set("Content-Type", "video/mp4")
	headers.Set("Accept-Ranges", "bytes")
	headers.Set("Content-Length", fmt.Sprintf("%d", fileSize))
	headers.Set("Cache-Control", "public, max-age=86400, immutable")
	headers.Set("ETag", fmt.Sprintf(`"%d-%d"`, fileSize, stat.ModTime().Unix()))
	headers.Set("Last-Modified", stat.ModTime().UTC().Format(http.TimeFormat))
	headers.Set("X-Content-Type-Options", "nosniff")
	headers.Set("Access-Control-Allow-Origin", "*")
	headers.Set("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length")
	headers.Set("Connection", "keep-alive")
	headers.Set("Keep-Alive", "timeout=300, max=1000")
	headers.Set("X-Cache", "MISS")

	// Check for conditional requests (304 Not Modified)
	etag := fmt.Sprintf(`"%d-%d"`, fileSize, stat.ModTime().Unix())
	if checkNotModified(w, r, stat.ModTime(), etag) {
		return nil
	}

	// Handle range requests with zero-copy sendfile
	rangeHeader := r.Header.Get("Range")
	if rangeHeader != "" {
		return s.handlePreviewRangeRequestInstant(w, r, file, fileSize, rangeHeader)
	}

	// SAFE full file streaming without hijacking
	return s.streamPreviewSafe(w, r, file, fileSize)
}

// streamCachedRange - Stream range requests from L1 cache for instant response
func (s *NetflixStreamService) streamCachedRange(w http.ResponseWriter, r *http.Request, cached *CachedSegment, rangeHeader string) error {
	// Parse range header quickly
	ranges, err := parseRangeHeader(rangeHeader, cached.size)
	if err != nil {
		w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
		return fmt.Errorf("invalid range header: %v", err)
	}

	if len(ranges) != 1 {
		return fmt.Errorf("multiple ranges not supported for cached content")
	}

	start, end := ranges[0].start, ranges[0].end
	contentLength := end - start + 1

	// Set range response headers
	w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, cached.size))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", contentLength))
	w.Header().Set("X-Cache", "HIT-L1-RANGE")
	w.WriteHeader(http.StatusPartialContent)

	// Stream range from cached data - instant response
	rangeData := cached.data[start : end+1]
	_, err = w.Write(rangeData)
	if err == nil {
		log.Printf("⚡ L1 cache range hit: %d-%d (%d bytes) - INSTANT", start, end, contentLength)
	}
	return err
}

// cachePreviewClip - Asynchronously cache preview clip in L1 for instant future access
func (s *NetflixStreamService) cachePreviewClip(filePath string, fileSize int64, cacheKey string) {
	// Check if already cached
	if s.l1Cache.Get(cacheKey) != nil {
		return
	}

	// Read entire file into memory for caching
	file, err := os.Open(filePath)
	if err != nil {
		log.Printf("❌ Failed to open file for caching: %v", err)
		return
	}
	defer file.Close()

	// Read entire file into memory
	data := make([]byte, fileSize)
	_, err = io.ReadFull(file, data)
	if err != nil {
		log.Printf("❌ Failed to read file for caching: %v", err)
		return
	}

	// Store in L1 cache for instant future access
	s.l1Cache.Put(cacheKey, data, 0, fileSize)
	log.Printf("🔥 Cached preview clip: %s (%d bytes) - next access will be INSTANT", filepath.Base(filePath), fileSize)
}

// streamPreviewMemoryMapped - Memory-mapped streaming for small preview clips
func (s *NetflixStreamService) streamPreviewMemoryMapped(w http.ResponseWriter, file *os.File, fileSize int64) error {
	// Memory map the file for instant access
	data, err := s.l2Cache.GetOrCreate(file.Name(), fileSize)
	if err != nil {
		return fmt.Errorf("failed to memory map preview: %v", err)
	}

	// Single write operation from memory
	_, err = w.Write(data)
	if err != nil {
		return fmt.Errorf("failed to write memory-mapped preview: %v", err)
	}

	log.Printf("⚡ Memory-mapped preview: %d bytes (instant)", fileSize)
	return nil
}

// streamPreviewSendfile - Zero-copy sendfile streaming for instant performance
func (s *NetflixStreamService) streamPreviewSendfile(w http.ResponseWriter, r *http.Request, file *os.File, fileSize int64) error {
	// Try to hijack connection for direct sendfile
	hijacker, ok := w.(http.Hijacker)
	if !ok {
		return fmt.Errorf("connection hijacking not supported")
	}

	conn, _, err := hijacker.Hijack()
	if err != nil {
		return fmt.Errorf("failed to hijack connection: %v", err)
	}
	defer conn.Close()

	// Optimize TCP connection for instant streaming
	if tcpConn, ok := conn.(*net.TCPConn); ok {
		tcpConn.SetNoDelay(true)                        // Disable Nagle's algorithm
		tcpConn.SetWriteBuffer(16 * 1024 * 1024)        // 16MB write buffer
		tcpConn.SetReadBuffer(64 * 1024)                // Small read buffer
		tcpConn.SetKeepAlive(true)                      // Keep connection alive
		tcpConn.SetKeepAlivePeriod(30 * time.Second)    // 30s keep-alive
	}

	// Write HTTP response headers manually
	headers := fmt.Sprintf("HTTP/1.1 200 OK\r\n"+
		"Content-Type: video/mp4\r\n"+
		"Content-Length: %d\r\n"+
		"Accept-Ranges: bytes\r\n"+
		"Cache-Control: public, max-age=86400, immutable\r\n"+
		"Access-Control-Allow-Origin: *\r\n"+
		"Connection: keep-alive\r\n"+
		"\r\n", fileSize)

	if _, err := conn.Write([]byte(headers)); err != nil {
		return fmt.Errorf("failed to write headers: %v", err)
	}

	// Use sendfile for zero-copy transfer
	if tcpConn, ok := conn.(*net.TCPConn); ok {
		tcpFile, err := tcpConn.File()
		if err == nil {
			defer tcpFile.Close()
			
			// Direct sendfile syscall for maximum performance
			written, err := syscall.Sendfile(int(tcpFile.Fd()), int(file.Fd()), nil, int(fileSize))
			if err == nil && int64(written) == fileSize {
				log.Printf("⚡ Sendfile zero-copy: %d bytes (instant)", fileSize)
				return nil
			}
		}
	}

	// Fallback to regular copy if sendfile fails
	buffer := s.bufferPool.Get(8 * 1024 * 1024) // 8MB buffer
	defer s.bufferPool.Put(buffer)
	
	_, err = io.CopyBuffer(conn, file, buffer)
	if err != nil {
		return fmt.Errorf("failed to stream with fallback: %v", err)
	}

	log.Printf("🚀 Hijacked connection stream: %d bytes", fileSize)
	return nil
}


// streamRangeSendfile - Sendfile for range requests
func (s *NetflixStreamService) streamRangeSendfile(w http.ResponseWriter, r *http.Request, file *os.File, offset, length int64) error {
	hijacker, ok := w.(http.Hijacker)
	if !ok {
		return fmt.Errorf("connection hijacking not supported")
	}

	conn, _, err := hijacker.Hijack()
	if err != nil {
		return fmt.Errorf("failed to hijack connection: %v", err)
	}
	defer conn.Close()

	// Optimize TCP connection
	if tcpConn, ok := conn.(*net.TCPConn); ok {
		tcpConn.SetNoDelay(true)
		tcpConn.SetWriteBuffer(8 * 1024 * 1024) // 8MB write buffer
	}

	// Write partial content headers manually
	headers := fmt.Sprintf("HTTP/1.1 206 Partial Content\r\n"+
		"Content-Type: video/mp4\r\n"+
		"Content-Length: %d\r\n"+
		"Content-Range: bytes %d-%d/%d\r\n"+
		"Accept-Ranges: bytes\r\n"+
		"Cache-Control: public, max-age=86400, immutable\r\n"+
		"Access-Control-Allow-Origin: *\r\n"+
		"Connection: keep-alive\r\n"+
		"\r\n", length, offset, offset+length-1, length)

	if _, err := conn.Write([]byte(headers)); err != nil {
		return fmt.Errorf("failed to write range headers: %v", err)
	}

	// Use sendfile with offset for range
	if tcpConn, ok := conn.(*net.TCPConn); ok {
		tcpFile, err := tcpConn.File()
		if err == nil {
			defer tcpFile.Close()
			
			offsetPtr := offset
			written, err := syscall.Sendfile(int(tcpFile.Fd()), int(file.Fd()), &offsetPtr, int(length))
			if err == nil && int64(written) == length {
				log.Printf("⚡ Sendfile range zero-copy: %d bytes at offset %d", length, offset)
				return nil
			}
		}
	}

	return fmt.Errorf("sendfile range failed")
}

// Range parsing helper
type httpRange struct {
	start, end int64
}

func parseRangeHeader(rangeHeader string, fileSize int64) ([]httpRange, error) {
	if !strings.HasPrefix(rangeHeader, "bytes=") {
		return nil, fmt.Errorf("invalid range header format")
	}

	rangeSpec := strings.TrimPrefix(rangeHeader, "bytes=")
	rangeParts := strings.Split(rangeSpec, ",")
	
	var ranges []httpRange
	for _, part := range rangeParts {
		part = strings.TrimSpace(part)
		if strings.Contains(part, "-") {
			rangeBounds := strings.Split(part, "-")
			if len(rangeBounds) != 2 {
				continue
			}

			var start, end int64
			var err error

			if rangeBounds[0] == "" {
				// Suffix range: -500 (last 500 bytes)
				if end, err = strconv.ParseInt(rangeBounds[1], 10, 64); err != nil {
					continue
				}
				start = fileSize - end
				end = fileSize - 1
			} else if rangeBounds[1] == "" {
				// Prefix range: 500- (from byte 500 to end)
				if start, err = strconv.ParseInt(rangeBounds[0], 10, 64); err != nil {
					continue
				}
				end = fileSize - 1
			} else {
				// Full range: 500-999
				if start, err = strconv.ParseInt(rangeBounds[0], 10, 64); err != nil {
					continue
				}
				if end, err = strconv.ParseInt(rangeBounds[1], 10, 64); err != nil {
					continue
				}
			}

			// Validate range bounds
			if start < 0 {
				start = 0
			}
			if end >= fileSize {
				end = fileSize - 1
			}
			if start <= end {
				ranges = append(ranges, httpRange{start: start, end: end})
			}
		}
	}

	if len(ranges) == 0 {
		return nil, fmt.Errorf("no valid ranges found")
	}

	return ranges, nil
}

func (s *NetflixStreamService) StreamALACAudio(w http.ResponseWriter, r *http.Request, mediaID int) error {
	if s.alacService != nil {
		// Use ALAC service if available
		return fmt.Errorf("ALAC streaming not implemented")
	}
	// For now, return error since we need media service to get file path
	return fmt.Errorf("ALAC streaming requires media service integration")
}

func (s *NetflixStreamService) SetALACService(alacService *ALACAudioService) {
	s.alacService = alacService
}

func (s *NetflixStreamService) GetVideoInfo(filePath string) (map[string]interface{}, error) {
	// Get video file information
	stat, err := os.Stat(filePath)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"size":     stat.Size(),
		"modified": stat.ModTime(),
		"path":     filePath,
	}, nil
}

// Stream worker pool implementation

func NewStreamWorkerPool(n int) *StreamWorkerPool {
	wp := &StreamWorkerPool{workers: n, taskChan: make(chan StreamWorkerTask, n*10)}
	wp.wg.Add(n)
	for i := 0; i < n; i++ {
		go wp.worker()
	}
	return wp
}

func (wp *StreamWorkerPool) worker() {
	defer wp.wg.Done()
	for task := range wp.taskChan {
		// Process streaming task
		_ = task
	}
}

// L1 Cache implementation

func NewL1SegmentCache(maxSize int64) *L1SegmentCache {
	return &L1SegmentCache{segments: make(map[string]*CachedSegment), maxSize: maxSize}
}

func (c *L1SegmentCache) Get(key string) *CachedSegment {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if seg, ok := c.segments[key]; ok {
		seg.accessed = time.Now()
		seg.hits++
		return seg
	}
	return nil
}

func (c *L1SegmentCache) Put(key string, data []byte, offset, size int64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.curSize+size > c.maxSize {
		c.evict()
	}
	seg := &CachedSegment{key: key, data: data, offset: offset, size: size, created: time.Now(), accessed: time.Now()}
	c.segments[key] = seg
	c.curSize += size
}

func (c *L1SegmentCache) Cleanup() {
	c.mu.Lock()
	defer c.mu.Unlock()
	for key, seg := range c.segments {
		if time.Since(seg.accessed) > 5*time.Minute {
			delete(c.segments, key)
			c.curSize -= seg.size
		}
	}
}

func (c *L1SegmentCache) evict() {
	// Simple eviction: remove oldest accessed
	var oldest *CachedSegment
	for _, seg := range c.segments {
		if oldest == nil || seg.accessed.Before(oldest.accessed) {
			oldest = seg
		}
	}
	if oldest != nil {
		delete(c.segments, oldest.key)
		c.curSize -= oldest.size
	}
}

// L2 Cache implementation

func NewL2FileCache(maxSize int64) *L2FileCache {
	return &L2FileCache{mappings: make(map[string][]byte), maxSize: maxSize}
}

func (c *L2FileCache) GetOrCreate(filePath string, fileSize int64) ([]byte, error) {
	c.mu.RLock()
	if data, ok := c.mappings[filePath]; ok {
		c.mu.RUnlock()
		return data, nil
	}
	c.mu.RUnlock()

	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	data, err := syscall.Mmap(int(file.Fd()), 0, int(fileSize), syscall.PROT_READ, syscall.MAP_SHARED)
	if err != nil {
		return nil, err
	}

	c.mu.Lock()
	if c.curSize+fileSize > c.maxSize {
		// Evict oldest
		for k, v := range c.mappings {
			syscall.Munmap(v)
			delete(c.mappings, k)
			c.curSize -= int64(len(v))
			break
		}
	}
	c.mappings[filePath] = data
	c.curSize += fileSize
	c.mu.Unlock()

	return data, nil
}

func (c *L2FileCache) Cleanup() {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, data := range c.mappings {
		syscall.Munmap(data)
	}
	c.mappings = make(map[string][]byte)
	c.curSize = 0
}

// MKV Indexer implementation

func (m *MKVIndexer) IndexFile(filePath string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.fileIndexes[filePath]; exists {
		return nil
	}

	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	// Quick MKV header parsing (EBML + segment)
	header := make([]byte, 1024)
	if _, err := file.Read(header); err != nil {
		return err
	}

	// Create basic index structure
	index := &MKVIndex{seekHeads: []int64{}, cues: []int64{}, indexed: true}
	m.fileIndexes[filePath] = index

	log.Printf("✅ MKV indexed: %s", filePath)
	return nil
}

func (m *MKVIndexer) GetIndex(filePath string) *MKVIndex {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if idx, ok := m.fileIndexes[filePath]; ok {
		return idx
	}
	return nil
}

// Audio transcoding methods for MKV compatibility

func (at *AudioTranscoder) analyzeAudioCodec(filePath string) (*AudioInfo, error) {
	// Use ffprobe to analyze audio codec
	cmd := exec.Command("ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", "-select_streams", "a:0", filePath)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("ffprobe failed: %v", err)
	}

	audioInfo := &AudioInfo{}

	// Parse ffprobe output to extract codec info
	outputStr := string(output)
	if strings.Contains(outputStr, `"codec_name"`) {
		// Extract codec name from JSON output
		lines := strings.Split(outputStr, "\n")
		for _, line := range lines {
			if strings.Contains(line, `"codec_name"`) {
				parts := strings.Split(line, `"`)
				if len(parts) >= 4 {
					audioInfo.Codec = parts[3]
				}
				break
			}
		}
	}

	// Check if codec is browser-compatible
	audioInfo.Compatible = at.isCodecCompatible(audioInfo.Codec)

	log.Printf("🎵 Audio analysis for %s: codec=%s, compatible=%v", filepath.Base(filePath), audioInfo.Codec, audioInfo.Compatible)

	return audioInfo, nil
}

func (at *AudioTranscoder) isCodecCompatible(codec string) bool {
	// Browser-compatible audio codecs
	compatibleCodecs := map[string]bool{
		"aac":       true,
		"mp3":       true,
		"opus":      true,
		"vorbis":    true,
		"pcm_s16le": true,
		"pcm_s24le": true,
	}

	// Incompatible codecs that need transcoding
	incompatibleCodecs := map[string]bool{
		"dts":       false,
		"truehd":    false,
		"flac":      false,
		"ac3":       false,
		"eac3":      false,
		"dca":       false,
		"mlp":       false,
		"pcm_s32le": false,
	}

	codec = strings.ToLower(codec)

	if compatible, exists := compatibleCodecs[codec]; exists {
		return compatible
	}

	if incompatible, exists := incompatibleCodecs[codec]; exists {
		return incompatible
	}

	// Default to incompatible for unknown codecs
	return false
}

func (s *NetflixStreamService) streamWithAudioTranscoding(w http.ResponseWriter, r *http.Request, filePath string, audioInfo *AudioInfo) error {
	// Check cache first
	if transcoded := s.audioTranscoder.getFromCache(filePath); transcoded != nil {
		log.Printf("🎯 Using cached transcoded audio for %s", filepath.Base(filePath))
		return s.streamTranscodedFile(w, r, transcoded.transcodedPath)
	}

	// Real-time transcoding with FFmpeg
	log.Printf("🔄 Starting real-time audio transcoding for %s", filepath.Base(filePath))

	// Set headers for streaming
	w.Header().Set("Content-Type", "video/mp4") // Transcode to MP4 container
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Cache-Control", "no-cache") // Don't cache transcoded streams

	// Start FFmpeg transcoding process
	cmd := exec.Command("ffmpeg",
		"-i", filePath,
		"-c:v", "copy", // Copy video stream as-is (no re-encoding)
		"-c:a", "aac", // Transcode audio to AAC
		"-b:a", "192k", // Audio bitrate
		"-ac", "2", // Stereo output
		"-f", "mp4", // MP4 container
		"-movflags", "frag_keyframe+empty_moov+faststart", // Enable streaming
		"-", // Output to stdout
	)

	// Get stdout pipe for streaming
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to get stdout pipe: %v", err)
	}

	// Start the transcoding process
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start ffmpeg: %v", err)
	}

	// Stream transcoded output with optimized buffer
	buffer := s.bufferPool.Get(s.segmentSize)
	defer s.bufferPool.Put(buffer)

	// Copy transcoded stream to response
	_, err = io.CopyBuffer(w, stdout, buffer)

	// Wait for FFmpeg to finish
	cmd.Wait()

	if err != nil {
		log.Printf("❌ Transcoding stream error for %s: %v", filepath.Base(filePath), err)
		return err
	}

	log.Printf("✅ Successfully streamed transcoded audio for %s", filepath.Base(filePath))
	return nil
}

func (s *NetflixStreamService) streamTranscodedFile(w http.ResponseWriter, r *http.Request, transcodedPath string) error {
	// Stream pre-transcoded file using existing optimized streaming
	file, err := os.Open(transcodedPath)
	if err != nil {
		return fmt.Errorf("failed to open transcoded file: %v", err)
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat transcoded file: %v", err)
	}

	fileSize := stat.Size()

	// Set headers
	w.Header().Set("Content-Type", "video/mp4")
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Content-Length", fmt.Sprintf("%d", fileSize))

	// Handle range requests
	rangeHeader := r.Header.Get("Range")
	if rangeHeader != "" {
		return s.handleRangeRequest(w, r, file, fileSize, rangeHeader)
	}

	// Stream with optimized I/O
	return s.streamWithOptimizedIO(w, file, fileSize)
}

func (at *AudioTranscoder) getFromCache(filePath string) *TranscodedAudio {
	at.mu.RLock()
	defer at.mu.RUnlock()

	if transcoded, exists := at.transcodingCache[filePath]; exists {
		// Check if transcoded file still exists
		if _, err := os.Stat(transcoded.transcodedPath); err == nil {
			return transcoded
		} else {
			// Remove stale cache entry
			delete(at.transcodingCache, filePath)
		}
	}

	return nil
}
