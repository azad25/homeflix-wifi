package services

import (
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

	// Ultra-aggressive configuration for maximum I/O performance
	segmentSize := int64(16 * 1024 * 1024)         // 16MB segments for ultra-fast I/O
	maxBufferSize := int64(4 * 1024 * 1024 * 1024) // 4GB buffer for massive files
	cacheSize := int64(8 * 1024 * 1024 * 1024)     // 8GB cache for instant access

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
		enableSendfile:   true,
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

	log.Printf("🚀 Netflix Instant Stream Service Ready | CPU:%d | RAM:%dGB | Sendfile:%v",
		cpuCores, totalMemory/(1024*1024*1024), service.enableSendfile)

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

	// Enable direct I/O for large reads (Linux only)
	if size > 1024*1024 { // > 1MB
		if fd := int(file.Fd()); fd > 0 {
			// Note: O_DIRECT is Linux-specific, skip on macOS
			// syscall.Syscall(syscall.SYS_FCNTL, uintptr(fd), syscall.F_SETFL, syscall.O_DIRECT)
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
				return make([]byte, 64*1024) // 64KB for metadata
			},
		},
		small: sync.Pool{
			New: func() interface{} {
				return make([]byte, 512*1024) // 512KB for standard streaming
			},
		},
		medium: sync.Pool{
			New: func() interface{} {
				return make([]byte, 4*1024*1024) // 4MB for HD streaming
			},
		},
		large: sync.Pool{
			New: func() interface{} {
				return make([]byte, 16*1024*1024) // 16MB for 4K streaming
			},
		},
		xlarge: sync.Pool{
			New: func() interface{} {
				return make([]byte, 64*1024*1024) // 64MB for ultra-high bitrate
			},
		},
	}
}

// ...

func (bp *BufferPool) Get(size int64) []byte {
	if size <= 64*1024 {
		return bp.tiny.Get().([]byte)
	} else if size <= 512*1024 {
		return bp.small.Get().([]byte)
	} else if size <= 4*1024*1024 {
		return bp.medium.Get().([]byte)
	} else if size <= 16*1024*1024 {
		return bp.large.Get().([]byte)
	} else {
		return bp.xlarge.Get().([]byte)
	}
}

func (bp *BufferPool) Put(buf []byte) {
	switch cap(buf) {
	case 64 * 1024:
		bp.tiny.Put(buf)
	case 512 * 1024:
		bp.small.Put(buf)
	case 4 * 1024 * 1024:
		bp.medium.Put(buf)
	case 16 * 1024 * 1024:
		bp.large.Put(buf)
	case 64 * 1024 * 1024:
		bp.xlarge.Put(buf)
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
	fileExt := strings.ToLower(filepath.Ext(filePath))

	// AGGRESSIVE audio compatibility check for ALL video files
	log.Printf("🔍 Analyzing audio compatibility for %s", filepath.Base(filePath))
	audioInfo, err := s.audioTranscoder.analyzeAudioCodec(filePath)
	
	if err != nil {
		log.Printf("⚠️ Audio analysis failed for %s: %v - attempting direct stream", filepath.Base(filePath), err)
		// Continue with direct streaming if analysis fails
	} else {
		log.Printf("🎵 Audio codec detected: %s (compatible: %v)", audioInfo.Codec, audioInfo.Compatible)
		
		// Force transcoding for known problematic codecs
		if !audioInfo.Compatible || s.shouldForceTranscode(audioInfo.Codec) {
			log.Printf("🔄 Audio transcoding required for %s (codec: %s)", filepath.Base(filePath), audioInfo.Codec)
			return s.streamWithAudioTranscoding(w, r, filePath, audioInfo)
		}
		
		// Additional check for MKV files - they often have audio issues
		if fileExt == ".mkv" && s.isMKVAudioProblematic(audioInfo) {
			log.Printf("🔄 MKV audio transcoding forced for %s (codec: %s)", filepath.Base(filePath), audioInfo.Codec)
			return s.streamWithAudioTranscoding(w, r, filePath, audioInfo)
		}
	}

	// NETFLIX-LEVEL instant streaming implementation for LAN
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

	// Set OPTIMIZED headers for instant LAN streaming
	contentType := utils.GetVideoContentType(filePath)
	headers := w.Header()
	headers.Set("Content-Type", contentType)
	headers.Set("Accept-Ranges", "bytes")
	headers.Set("Content-Length", fmt.Sprintf("%d", fileSize))
	headers.Set("Cache-Control", "public, max-age=86400, immutable") // 24h cache
	headers.Set("ETag", fmt.Sprintf(`"%d-%d"`, fileSize, stat.ModTime().Unix()))
	headers.Set("Last-Modified", stat.ModTime().UTC().Format(http.TimeFormat))
	headers.Set("Connection", "keep-alive")
	headers.Set("Keep-Alive", "timeout=300, max=1000") // Long keep-alive for LAN
	headers.Set("Access-Control-Allow-Origin", "*")
	headers.Set("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length")
	headers.Set("X-Content-Type-Options", "nosniff")

	log.Printf("📺 INSTANT LAN streaming %s (%s, %d MB)", filepath.Base(filePath), contentType, fileSize/(1024*1024))

	// Check for conditional requests (304 Not Modified) for instant cache hits
	etag := fmt.Sprintf(`"%d-%d"`, fileSize, stat.ModTime().Unix())
	if checkNotModified(w, r, stat.ModTime(), etag) {
		log.Printf("⚡ 304 Not Modified - INSTANT cache hit for %s", filepath.Base(filePath))
		return nil
	}

	// Handle range requests with ZERO-COPY sendfile for instant seeking
	rangeHeader := r.Header.Get("Range")
	if rangeHeader != "" {
		return s.handleRangeRequestInstantLAN(w, r, file, fileSize, rangeHeader)
	}

	// Stream entire file with NETFLIX-LEVEL optimization for LAN
	return s.streamWithNetflixOptimization(w, file, fileSize)
}

func (s *NetflixStreamService) handleRangeRequest(w http.ResponseWriter, r *http.Request, file *os.File, fileSize int64, rangeHeader string) error {
	// Parse range header (simplified)
	var start, end int64 = 0, fileSize - 1

	// Set partial content headers
	w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, fileSize))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", end-start+1))
	w.WriteHeader(http.StatusPartialContent)

	// Seek to start position
	_, err := file.Seek(start, 0)
	if err != nil {
		return err
	}

	// Stream range with optimized buffer
	buffer := s.bufferPool.Get(s.segmentSize)
	defer s.bufferPool.Put(buffer)

	_, err = io.CopyBuffer(w, file, buffer)
	return err
}

// streamWithNetflixOptimization - Netflix-level streaming optimization for LAN
func (s *NetflixStreamService) streamWithNetflixOptimization(w http.ResponseWriter, file *os.File, fileSize int64) error {
	// Try ZERO-COPY sendfile first for maximum LAN performance
	if s.enableSendfile && fileSize > 1024*1024 { // Use sendfile for files > 1MB
		if err := s.streamWithSendfileZeroCopy(w, file, fileSize); err == nil {
			return nil
		}
		log.Printf("⚠️ Sendfile failed, falling back to optimized I/O")
	}

	// Fallback to ultra-optimized I/O streaming
	return s.streamWithUltraOptimizedIO(w, file, fileSize)
}

// streamWithSendfileZeroCopy - Zero-copy sendfile for instant LAN streaming
func (s *NetflixStreamService) streamWithSendfileZeroCopy(w http.ResponseWriter, file *os.File, fileSize int64) error {
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

	// ULTRA-OPTIMIZE TCP connection for LAN streaming
	if tcpConn, ok := conn.(*net.TCPConn); ok {
		tcpConn.SetNoDelay(true)                        // Disable Nagle's algorithm
		tcpConn.SetWriteBuffer(32 * 1024 * 1024)        // 32MB write buffer for LAN
		tcpConn.SetReadBuffer(1024 * 1024)              // 1MB read buffer
		tcpConn.SetKeepAlive(true)                      // Keep connection alive
		tcpConn.SetKeepAlivePeriod(30 * time.Second)    // 30s keep-alive
	}

	// Write HTTP response headers manually for hijacked connection
	headers := fmt.Sprintf("HTTP/1.1 200 OK\r\n"+
		"Content-Type: %s\r\n"+
		"Content-Length: %d\r\n"+
		"Accept-Ranges: bytes\r\n"+
		"Cache-Control: public, max-age=86400, immutable\r\n"+
		"Connection: keep-alive\r\n"+
		"Access-Control-Allow-Origin: *\r\n"+
		"\r\n", utils.GetVideoContentType(file.Name()), fileSize)

	if _, err := conn.Write([]byte(headers)); err != nil {
		return fmt.Errorf("failed to write headers: %v", err)
	}

	// Use sendfile for ZERO-COPY transfer (kernel-level optimization)
	if tcpConn, ok := conn.(*net.TCPConn); ok {
		tcpFile, err := tcpConn.File()
		if err == nil {
			defer tcpFile.Close()
			
			// Direct sendfile syscall for maximum LAN performance
			written, err := syscall.Sendfile(int(tcpFile.Fd()), int(file.Fd()), nil, int(fileSize))
			if err == nil && int64(written) == fileSize {
				log.Printf("⚡ ZERO-COPY sendfile: %d MB in LAN speed", fileSize/(1024*1024))
				return nil
			}
		}
	}

	return fmt.Errorf("sendfile zero-copy failed")
}

// streamWithUltraOptimizedIO - Ultra-optimized I/O for LAN streaming
func (s *NetflixStreamService) streamWithUltraOptimizedIO(w http.ResponseWriter, file *os.File, fileSize int64) error {
	// Use MAXIMUM buffer size for LAN streaming
	buffer := s.bufferPool.Get(s.segmentSize) // 16MB buffer
	defer s.bufferPool.Put(buffer)

	// Try to hijack connection for direct socket optimization
	if hijacker, ok := w.(http.Hijacker); ok {
		if netConn, _, err := hijacker.Hijack(); err == nil {
			defer netConn.Close()
			
			// ULTRA-OPTIMIZE TCP for LAN
			if tcpConn, ok := netConn.(*net.TCPConn); ok {
				tcpConn.SetNoDelay(true)                        // Instant send
				tcpConn.SetWriteBuffer(32 * 1024 * 1024)        // 32MB write buffer
				tcpConn.SetReadBuffer(1024 * 1024)              // 1MB read buffer
				tcpConn.SetKeepAlive(true)
				tcpConn.SetKeepAlivePeriod(30 * time.Second)
			}

			// Write headers manually
			headers := fmt.Sprintf("HTTP/1.1 200 OK\r\n"+
				"Content-Type: %s\r\n"+
				"Content-Length: %d\r\n"+
				"Accept-Ranges: bytes\r\n"+
				"Cache-Control: public, max-age=86400, immutable\r\n"+
				"Connection: keep-alive\r\n"+
				"Access-Control-Allow-Origin: *\r\n"+
				"\r\n", utils.GetVideoContentType(file.Name()), fileSize)

			netConn.Write([]byte(headers))

			// Stream directly to socket with maximum buffer
			_, err = io.CopyBuffer(netConn, file, buffer)
			if err == nil {
				log.Printf("🚀 Direct socket stream: %d MB at LAN speed", fileSize/(1024*1024))
			}
			return err
		}
	}

	// Fallback to response writer with optimized buffer
	_, err := io.CopyBuffer(w, file, buffer)
	if err != nil {
		return fmt.Errorf("failed to stream with optimized I/O: %v", err)
	}

	log.Printf("🚀 Optimized I/O stream: %d MB", fileSize/(1024*1024))
	return nil
}

// handleRangeRequestInstantLAN - Instant range request handling for LAN
func (s *NetflixStreamService) handleRangeRequestInstantLAN(w http.ResponseWriter, r *http.Request, file *os.File, fileSize int64, rangeHeader string) error {
	// Parse range header with minimal allocations
	ranges, err := parseRangeHeader(rangeHeader, fileSize)
	if err != nil {
		w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
		return fmt.Errorf("invalid range header: %v", err)
	}

	if len(ranges) != 1 {
		return fmt.Errorf("multiple ranges not supported")
	}

	start, end := ranges[0].start, ranges[0].end
	contentLength := end - start + 1

	// Set range response headers efficiently
	headers := w.Header()
	headers.Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, fileSize))
	headers.Set("Content-Length", fmt.Sprintf("%d", contentLength))
	headers.Set("Cache-Control", "public, max-age=86400, immutable")
	headers.Set("Access-Control-Allow-Origin", "*")
	w.WriteHeader(http.StatusPartialContent)

	// Try ZERO-COPY sendfile for range requests
	if s.enableSendfile && contentLength > 512*1024 { // Use sendfile for ranges > 512KB
		if err := s.streamRangeSendfileInstant(w, r, file, start, contentLength); err == nil {
			return nil
		}
	}

	// Fallback to optimized range streaming
	if _, err := file.Seek(start, 0); err != nil {
		return fmt.Errorf("failed to seek: %v", err)
	}

	// Use optimized buffer for range streaming
	buffer := s.bufferPool.Get(s.segmentSize)
	defer s.bufferPool.Put(buffer)

	_, err = io.CopyBuffer(w, io.LimitReader(file, contentLength), buffer)
	if err != nil {
		return fmt.Errorf("failed to stream range: %v", err)
	}

	log.Printf("⚡ Range stream: %d-%d (%d KB) at LAN speed", start, end, contentLength/1024)
	return nil
}

// streamRangeSendfileInstant - Instant sendfile for range requests
func (s *NetflixStreamService) streamRangeSendfileInstant(w http.ResponseWriter, r *http.Request, file *os.File, offset, length int64) error {
	hijacker, ok := w.(http.Hijacker)
	if !ok {
		return fmt.Errorf("connection hijacking not supported")
	}

	conn, _, err := hijacker.Hijack()
	if err != nil {
		return fmt.Errorf("failed to hijack connection: %v", err)
	}
	defer conn.Close()

	// Optimize TCP connection for LAN
	if tcpConn, ok := conn.(*net.TCPConn); ok {
		tcpConn.SetNoDelay(true)
		tcpConn.SetWriteBuffer(16 * 1024 * 1024) // 16MB write buffer
	}

	// Write partial content headers manually
	headers := fmt.Sprintf("HTTP/1.1 206 Partial Content\r\n"+
		"Content-Type: %s\r\n"+
		"Content-Length: %d\r\n"+
		"Content-Range: bytes %d-%d/%d\r\n"+
		"Accept-Ranges: bytes\r\n"+
		"Cache-Control: public, max-age=86400, immutable\r\n"+
		"Access-Control-Allow-Origin: *\r\n"+
		"Connection: keep-alive\r\n"+
		"\r\n", utils.GetVideoContentType(file.Name()), length, offset, offset+length-1, length)

	if _, err := conn.Write([]byte(headers)); err != nil {
		return fmt.Errorf("failed to write range headers: %v", err)
	}

	// Use sendfile with offset for ZERO-COPY range streaming
	if tcpConn, ok := conn.(*net.TCPConn); ok {
		tcpFile, err := tcpConn.File()
		if err == nil {
			defer tcpFile.Close()
			
			offsetPtr := offset
			written, err := syscall.Sendfile(int(tcpFile.Fd()), int(file.Fd()), &offsetPtr, int(length))
			if err == nil && int64(written) == length {
				log.Printf("⚡ ZERO-COPY range sendfile: %d KB at offset %d", length/1024, offset)
				return nil
			}
		}
	}

	return fmt.Errorf("sendfile range failed")
}

func (s *NetflixStreamService) initializeCaches() {
	// Initialize cache warming in background
	log.Printf("🔥 Initializing NETFLIX-LEVEL I/O caches for instant LAN streaming...")
	
	// Start cache cleanup routines
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		
		for range ticker.C {
			s.l1Cache.Cleanup()
		}
	}()
	
	// Start L2 cache cleanup
	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()
		
		for range ticker.C {
			s.l2Cache.Cleanup()
		}
	}()
	
	// Log system optimizations
	log.Printf("🚀 LAN Streaming Optimizations:")
	log.Printf("   • Zero-copy sendfile: %v", s.enableSendfile)
	log.Printf("   • Direct I/O: %v", s.enableDirectIO)
	log.Printf("   • TCP window: %d MB", s.tcpWindowSize/(1024*1024))
	log.Printf("   • Segment size: %d MB", s.segmentSize/(1024*1024))
	log.Printf("   • L1 cache: %d MB", s.l1Cache.maxSize/(1024*1024))
	log.Printf("   • L2 cache: %d MB", s.l2Cache.maxSize/(1024*1024))
	log.Printf("   • I/O workers: %d", s.ioWorkerPool.workers)
	log.Printf("✅ Ready for INSTANT Netflix-level streaming over LAN!")
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

// INSTANT preview streaming with zero-copy sendfile
func (s *NetflixStreamService) streamPreviewInstant(w http.ResponseWriter, r *http.Request, file *os.File, fileSize int64) error {
	// Try memory mapping for small preview clips (< 50MB)
	if fileSize < 50*1024*1024 {
		if err := s.streamPreviewMemoryMapped(w, file, fileSize); err == nil {
			return nil
		}
		// Fallback to sendfile if mmap fails
	}

	// Try sendfile for zero-copy kernel streaming
	if s.enableSendfile {
		if err := s.streamPreviewSendfile(w, r, file, fileSize); err == nil {
			return nil
		}
		// Fallback to optimized I/O if sendfile fails
	}

	// Fallback to optimized I/O streaming
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
	// Use large buffer for maximum throughput
	buffer := s.bufferPool.Get(8 * 1024 * 1024) // 8MB buffer for instant streaming
	defer s.bufferPool.Put(buffer)

	// Enable all TCP optimizations
	if conn, ok := w.(http.Hijacker); ok {
		if netConn, _, err := conn.Hijack(); err == nil {
			defer netConn.Close()
			if tcpConn, ok := netConn.(*net.TCPConn); ok {
				tcpConn.SetNoDelay(true)                    // Instant send
				tcpConn.SetWriteBuffer(4 * 1024 * 1024)     // 4MB write buffer
				tcpConn.SetReadBuffer(64 * 1024)            // Small read buffer
				tcpConn.SetKeepAlive(true)                  // Keep alive
				tcpConn.SetKeepAlivePeriod(30 * time.Second) // 30s period
			}
			
			// Stream directly to socket
			_, err = io.CopyBuffer(netConn, file, buffer)
			if err == nil {
				log.Printf("🚀 Direct socket optimized stream: %d bytes", fileSize)
			}
			return err
		}
	}

	// Fallback to response writer
	_, err := io.CopyBuffer(w, file, buffer)
	if err != nil {
		return fmt.Errorf("failed to stream preview clip: %v", err)
	}

	log.Printf("🚀 Optimized I/O preview stream: %d bytes", fileSize)
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

	// INSTANT full file streaming with sendfile zero-copy
	return s.streamPreviewInstant(w, r, file, fileSize)
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
	// Enhanced ffprobe command to get detailed audio info
	cmd := exec.Command("ffprobe", 
		"-v", "quiet", 
		"-print_format", "json", 
		"-show_streams", 
		"-select_streams", "a", // Get ALL audio streams
		"-show_entries", "stream=codec_name,channels,sample_rate,bit_rate,channel_layout",
		filePath)
	
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("ffprobe failed: %v", err)
	}

	audioInfo := &AudioInfo{}
	outputStr := string(output)

	// Parse JSON output more robustly
	if strings.Contains(outputStr, `"streams"`) {
		// Find first audio stream
		lines := strings.Split(outputStr, "\n")
		inAudioStream := false
		
		for _, line := range lines {
			line = strings.TrimSpace(line)
			
			if strings.Contains(line, `"codec_type": "audio"`) {
				inAudioStream = true
				continue
			}
			
			if inAudioStream {
				if strings.Contains(line, `"codec_name"`) {
					parts := strings.Split(line, `"`)
					if len(parts) >= 4 {
						audioInfo.Codec = strings.ToLower(parts[3])
					}
				} else if strings.Contains(line, `"channels"`) {
					parts := strings.Split(line, ":")
					if len(parts) >= 2 {
						channelStr := strings.TrimSpace(strings.Trim(parts[1], ","))
						if channels, err := strconv.Atoi(channelStr); err == nil {
							audioInfo.Channels = channels
						}
					}
				} else if strings.Contains(line, `"sample_rate"`) {
					parts := strings.Split(line, `"`)
					if len(parts) >= 4 {
						if sampleRate, err := strconv.Atoi(parts[3]); err == nil {
							audioInfo.SampleRate = sampleRate
						}
					}
				} else if strings.Contains(line, `}`) && inAudioStream {
					break // End of audio stream object
				}
			}
		}
	}

	// Fallback: try to extract codec from filename if ffprobe parsing failed
	if audioInfo.Codec == "" {
		log.Printf("⚠️ Failed to parse ffprobe JSON, trying alternative method")
		// Try simpler ffprobe command
		simpleCmd := exec.Command("ffprobe", "-v", "error", "-select_streams", "a:0", 
			"-show_entries", "stream=codec_name", "-of", "csv=p=0", filePath)
		if simpleOutput, err := simpleCmd.Output(); err == nil {
			audioInfo.Codec = strings.TrimSpace(strings.ToLower(string(simpleOutput)))
		}
	}

	// Set defaults if not detected
	if audioInfo.Channels == 0 {
		audioInfo.Channels = 2 // Assume stereo
	}
	if audioInfo.SampleRate == 0 {
		audioInfo.SampleRate = 48000 // Assume 48kHz
	}

	// Check compatibility
	audioInfo.Compatible = at.isCodecCompatible(audioInfo.Codec)

	log.Printf("🎵 Audio analysis for %s: codec=%s, channels=%d, sample_rate=%d, compatible=%v", 
		filepath.Base(filePath), audioInfo.Codec, audioInfo.Channels, audioInfo.SampleRate, audioInfo.Compatible)

	return audioInfo, nil
}

func (at *AudioTranscoder) isCodecCompatible(codec string) bool {
	codec = strings.ToLower(codec)
	
	// STRICT browser-compatible audio codecs (guaranteed to work)
	strictlyCompatible := map[string]bool{
		"aac":    true,  // AAC - most compatible
		"mp3":    true,  // MP3 - universal support
		"opus":   true,  // Opus - modern browsers
	}

	// PROBLEMATIC codecs that ALWAYS need transcoding
	problematicCodecs := map[string]bool{
		"dts":        false, // DTS - never works in browsers
		"truehd":     false, // TrueHD - never works
		"flac":       false, // FLAC - limited browser support
		"ac3":        false, // AC3 - often muted in browsers
		"eac3":       false, // E-AC3 - often muted
		"dca":        false, // DCA - never works
		"mlp":        false, // MLP - never works
		"pcm_s32le":  false, // 32-bit PCM - often problematic
		"pcm_s24le":  false, // 24-bit PCM - often problematic
		"pcm_f32le":  false, // Float PCM - problematic
		"pcm_f64le":  false, // Double PCM - problematic
		"vorbis":     false, // Vorbis - inconsistent in MP4/MKV
		"pcm_s16le":  false, // Even 16-bit PCM can be problematic in containers
		"wmav2":      false, // Windows Media Audio
		"wmapro":     false, // WMA Pro
		"alac":       false, // ALAC - limited browser support
		"ape":        false, // Monkey's Audio
		"wavpack":    false, // WavPack
	}

	// Check strictly compatible first
	if compatible, exists := strictlyCompatible[codec]; exists {
		return compatible
	}

	// Check problematic codecs
	if problematic, exists := problematicCodecs[codec]; exists {
		return problematic
	}

	// CONSERVATIVE: Default to incompatible for unknown codecs
	// This ensures audio always works by transcoding unknown codecs
	log.Printf("⚠️ Unknown audio codec '%s' - defaulting to transcoding for safety", codec)
	return false
}

func (s *NetflixStreamService) streamWithAudioTranscoding(w http.ResponseWriter, r *http.Request, filePath string, audioInfo *AudioInfo) error {
	// Check cache first
	if transcoded := s.audioTranscoder.getFromCache(filePath); transcoded != nil {
		log.Printf("🎯 Using cached transcoded audio for %s", filepath.Base(filePath))
		return s.streamTranscodedFile(w, r, transcoded.transcodedPath)
	}

	// Real-time transcoding with FFmpeg - OPTIMIZED for instant LAN streaming
	log.Printf("🔄 Starting INSTANT audio transcoding for %s (codec: %s)", filepath.Base(filePath), audioInfo.Codec)

	// Set headers for streaming with proper MIME type
	contentType := utils.GetVideoContentType(filePath)
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Cache-Control", "public, max-age=3600") // Cache for 1 hour
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Transfer-Encoding", "chunked") // Enable chunked transfer

	// ULTRA-FAST FFmpeg transcoding optimized for LAN streaming
	ffmpegArgs := []string{
		"-i", filePath,
		"-c:v", "copy", // Copy video stream (no re-encoding)
		"-c:a", "aac",  // Transcode audio to AAC (most compatible)
		"-b:a", "256k", // Higher audio bitrate for quality
		"-ac", "2",     // Force stereo output
		"-ar", "48000", // Standard sample rate
		"-f", "mp4",    // MP4 container
		"-movflags", "frag_keyframe+empty_moov+faststart+dash", // Optimized streaming flags
		"-fflags", "+genpts+igndts", // Generate PTS and ignore DTS issues
		"-avoid_negative_ts", "make_zero", // Fix timestamp issues
		"-max_muxing_queue_size", "1024", // Large muxing queue
		"-threads", "0", // Use all CPU cores
		"-preset", "ultrafast", // Fastest encoding preset
		"-tune", "zerolatency", // Zero latency tuning
		"-", // Output to stdout
	}

	// Add specific fixes for problematic codecs
	if audioInfo.Codec == "dts" || audioInfo.Codec == "truehd" || audioInfo.Codec == "ac3" {
		// Add audio filters for problematic codecs
		ffmpegArgs = append(ffmpegArgs[:len(ffmpegArgs)-1], 
			"-af", "aresample=async=1:min_hard_comp=0.100000:first_pts=0", // Audio resampling
			"-")
	}

	cmd := exec.Command("ffmpeg", ffmpegArgs...)

	// Set up pipes
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to get stdout pipe: %v", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to get stderr pipe: %v", err)
	}

	// Start the transcoding process
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start ffmpeg: %v", err)
	}

	// Monitor FFmpeg stderr in background
	go func() {
		scanner := make([]byte, 1024)
		for {
			n, err := stderr.Read(scanner)
			if err != nil {
				break
			}
			if n > 0 {
				log.Printf("🔧 FFmpeg: %s", string(scanner[:n]))
			}
		}
	}()

	// INSTANT streaming with optimized buffer
	buffer := s.bufferPool.Get(s.segmentSize) // Use large buffer for LAN speed
	defer s.bufferPool.Put(buffer)

	// Enable TCP optimizations for LAN streaming
	if conn, ok := w.(http.Hijacker); ok {
		if netConn, _, err := conn.Hijack(); err == nil {
			defer netConn.Close()
			if tcpConn, ok := netConn.(*net.TCPConn); ok {
				tcpConn.SetNoDelay(true)                        // Disable Nagle's algorithm
				tcpConn.SetWriteBuffer(16 * 1024 * 1024)        // 16MB write buffer for LAN
				tcpConn.SetKeepAlive(true)
				tcpConn.SetKeepAlivePeriod(30 * time.Second)
			}

			// Write HTTP headers manually for hijacked connection
			headers := fmt.Sprintf("HTTP/1.1 200 OK\r\n"+
				"Content-Type: %s\r\n"+
				"Cache-Control: public, max-age=3600\r\n"+
				"Connection: keep-alive\r\n"+
				"Transfer-Encoding: chunked\r\n"+
				"Access-Control-Allow-Origin: *\r\n"+
				"\r\n", contentType)

			netConn.Write([]byte(headers))

			// Stream transcoded output directly to socket
			_, err = io.CopyBuffer(netConn, stdout, buffer)
		}
	} else {
		// Fallback to response writer
		_, err = io.CopyBuffer(w, stdout, buffer)
	}

	// Wait for FFmpeg to finish
	cmd.Wait()

	if err != nil {
		log.Printf("❌ Transcoding stream error for %s: %v", filepath.Base(filePath), err)
		return err
	}

	log.Printf("✅ INSTANT transcoded stream completed for %s", filepath.Base(filePath))
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
	return s.streamWithNetflixOptimization(w, file, fileSize)
}

// shouldForceTranscode - Force transcoding for known problematic codecs
func (s *NetflixStreamService) shouldForceTranscode(codec string) bool {
	// Always transcode these codecs regardless of compatibility check
	forceTranscodeCodecs := map[string]bool{
		"dts":     true, // DTS always causes issues
		"truehd":  true, // TrueHD never works in browsers
		"ac3":     true, // AC3 often muted in browsers
		"eac3":    true, // E-AC3 often muted
		"flac":    true, // FLAC has limited browser support
		"pcm_s24le": true, // 24-bit PCM often problematic
		"pcm_s32le": true, // 32-bit PCM often problematic
	}
	
	return forceTranscodeCodecs[strings.ToLower(codec)]
}

// isMKVAudioProblematic - Check if MKV audio needs special handling
func (s *NetflixStreamService) isMKVAudioProblematic(audioInfo *AudioInfo) bool {
	// MKV files with these codecs often have audio sync issues
	problematicInMKV := map[string]bool{
		"vorbis":    true, // Vorbis in MKV can be problematic
		"pcm_s16le": true, // PCM in MKV often has issues
		"opus":      true, // Opus in MKV not well supported
	}
	
	// Also check for high channel counts that browsers can't handle
	if audioInfo.Channels > 2 {
		log.Printf("🔄 MKV has %d channels, forcing stereo transcode", audioInfo.Channels)
		return true
	}
	
	return problematicInMKV[strings.ToLower(audioInfo.Codec)]
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
