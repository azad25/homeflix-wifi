package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"homeflix-backend/internal/interfaces"
)

type ThumbnailService struct {
	thumbnailPath   string
	workerPool      *WorkerPool
	hwAcceleration  string
	maxConcurrent   int
	processingQueue chan ProcessingTask
	mu              sync.RWMutex
	activeJobs      map[string]*JobStatus
	alacService     *ALACAudioService                // Reference to ALAC service for preview clips with audio
	mediaService    interfaces.MediaServiceInterface // Reference to media service for database queries
}

type ProcessingTask struct {
	ID        string
	Type      string // "thumbnail" or "preview"
	VideoPath string
	MediaID   uint
	Title     string
	Season    *int // Season number for TV series episodes
	Episode   *int // Episode number for TV series episodes
	Priority  int
	Callback  func(string, error)
}

type JobStatus struct {
	ID        string
	Type      string
	Status    string // "queued", "processing", "completed", "failed"
	Progress  float64
	StartTime time.Time
	Error     error
}

type WorkerPool struct {
	workers     int
	taskQueue   chan ProcessingTask
	wg          sync.WaitGroup
	ctx         context.Context
	cancel      context.CancelFunc
	hwAccel     string
	alacService *ALACAudioService // Reference to ALAC service for preview clips with audio
	service     *ThumbnailService // Reference to thumbnail service for processing methods
}

type FFmpegConfig struct {
	HWAccel    string
	Encoder    string
	Decoder    string
	Preset     string
	Threads    int
	ExtraFlags []string
}

func NewThumbnailService() *ThumbnailService {
	thumbnailPath := os.Getenv("THUMBNAIL_PATH")
	if thumbnailPath == "" {
		thumbnailPath = "./thumbnails"
	}

	// Create thumbnails directory if it doesn't exist
	os.MkdirAll(thumbnailPath, 0755)

	// Also create root-level directories for fallback
	os.MkdirAll("./thumbnails", 0755)
	os.MkdirAll("./previews", 0755)
	os.MkdirAll("./posters", 0755)

	// Detect hardware acceleration
	hwAccel := detectHardwareAcceleration()
	log.Printf("🚀 Hardware acceleration detected: %s", hwAccel)

	// Optimized for (4 cores) - prevent system crashes
	maxConcurrent := 1 // Conservative limit for i5-4590 stability

	service := &ThumbnailService{
		thumbnailPath:   thumbnailPath,
		hwAcceleration:  hwAccel,
		maxConcurrent:   maxConcurrent,
		processingQueue: make(chan ProcessingTask, 1000), // Increased from 100 to 1000
		activeJobs:      make(map[string]*JobStatus),
	}

	// Initialize optimized worker pool
	service.workerPool = NewWorkerPool(maxConcurrent, hwAccel)
	service.workerPool.Start()

	// Start queue processor
	go service.processQueue()

	// Start queue maintenance
	service.StartQueueMaintenance()

	// Start periodic maintenance (includes CUDA health checks)
	service.StartPeriodicMaintenance()

	log.Printf("🎬 Optimized ThumbnailService initialized with %d workers and %s acceleration",
		maxConcurrent, hwAccel)

	return service
}

// SetALACService sets the ALAC service for preview clips with audio
func (s *ThumbnailService) SetALACService(alacService *ALACAudioService) {
	s.alacService = alacService
	// Also set it in the worker pool
	if s.workerPool != nil {
		s.workerPool.alacService = alacService
	}
}

// detectHardwareAcceleration detects the best available hardware acceleration
func detectHardwareAcceleration() string {
	// Test hardware acceleration methods in order of preference
	// CUDA moved to second position due to exit status 234 issues
	accelerations := []string{"vaapi", "qsv", "cuda", "opencl"}

	for _, accel := range accelerations {
		if testHardwareAcceleration(accel) {
			log.Printf("✅ Hardware acceleration test passed: %s", accel)
			return accel
		} else {
			log.Printf("❌ Hardware acceleration test failed: %s", accel)
		}
	}

	log.Printf("⚠️ No hardware acceleration available, using software encoding")
	return "none"
}

// testHardwareAcceleration tests if a specific hardware acceleration is available
func testHardwareAcceleration(accel string) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var cmd *exec.Cmd
	switch accel {
	case "vaapi":
		cmd = exec.CommandContext(ctx, "ffmpeg", "-f", "lavfi", "-i", "testsrc2=duration=1:size=320x240:rate=1",
			"-vaapi_device", "/dev/dri/renderD128", "-vf", "format=nv12,hwupload", "-c:v", "h264_vaapi",
			"-t", "1", "-f", "null", "-")
	case "cuda":
		// Test CUDA with minimal parameters to avoid exit status 234
		cmd = exec.CommandContext(ctx, "ffmpeg", "-f", "lavfi", "-i", "testsrc2=duration=1:size=320x240:rate=1",
			"-c:v", "h264_nvenc", "-preset", "fast", "-rc", "vbr", "-cq", "23", "-t", "1", "-f", "null", "-")
	case "qsv":
		cmd = exec.CommandContext(ctx, "ffmpeg", "-f", "lavfi", "-i", "testsrc2=duration=1:size=320x240:rate=1",
			"-c:v", "h264_qsv", "-t", "1", "-f", "null", "-")
	case "opencl":
		cmd = exec.CommandContext(ctx, "ffmpeg", "-f", "lavfi", "-i", "testsrc2=duration=1:size=320x240:rate=1",
			"-init_hw_device", "opencl", "-t", "1", "-f", "null", "-")
	default:
		return false
	}

	err := cmd.Run()
	return err == nil
}

// NewWorkerPool creates a new optimized worker pool
func NewWorkerPool(workers int, hwAccel string) *WorkerPool {
	ctx, cancel := context.WithCancel(context.Background())
	return &WorkerPool{
		workers:   workers,
		taskQueue: make(chan ProcessingTask, workers*2),
		ctx:       ctx,
		cancel:    cancel,
		hwAccel:   hwAccel,
	}
}

// Start starts the worker pool
func (wp *WorkerPool) Start() {
	for i := 0; i < wp.workers; i++ {
		wp.wg.Add(1)
		go wp.worker(i)
	}
	log.Printf("🔥 Started %d optimized workers with %s acceleration", wp.workers, wp.hwAccel)
}

// Stop stops the worker pool
func (wp *WorkerPool) Stop() {
	wp.cancel()
	close(wp.taskQueue)
	wp.wg.Wait()
}

// Submit submits a task to the worker pool
func (wp *WorkerPool) Submit(task ProcessingTask) {
	select {
	case wp.taskQueue <- task:
	case <-wp.ctx.Done():
		if task.Callback != nil {
			task.Callback("", fmt.Errorf("worker pool stopped"))
		}
	}
}

// worker processes tasks from the queue
func (wp *WorkerPool) worker(id int) {
	defer wp.wg.Done()

	for {
		select {
		case task := <-wp.taskQueue:
			log.Printf("🔧 Worker %d processing %s task for media %d", id, task.Type, task.MediaID)

			var result string
			var err error

			switch task.Type {
			case "thumbnail":
				result, err = wp.processThumbnailOptimized(task)
			case "thumbnail_unlimited":
				result, err = wp.processThumbnailUnlimited(task)
			case "thumbnail_regeneration":
				result, err = wp.processThumbnailRegeneration(task)
			case "preview":
				result, err = wp.processPreviewOptimized(task)
			case "preview_unlimited":
				result, err = wp.processPreviewUnlimited(task)
			case "preview_regeneration":
				result, err = wp.processPreviewRegeneration(task)
			default:
				err = fmt.Errorf("unknown task type: %s", task.Type)
			}

			if task.Callback != nil {
				task.Callback(result, err)
			}

		case <-wp.ctx.Done():
			return
		}
	}
}

// processQueue processes the main service queue with monitoring
func (s *ThumbnailService) processQueue() {
	queueMonitorTicker := time.NewTicker(30 * time.Second)
	defer queueMonitorTicker.Stop()

	go func() {
		for range queueMonitorTicker.C {
			queueLength := len(s.processingQueue)
			activeJobs := len(s.activeJobs)
			if queueLength > 500 || activeJobs > 100 {
				log.Printf("⚠️ ThumbnailService queue status: %d queued, %d active jobs", queueLength, activeJobs)
			}
		}
	}()

	for task := range s.processingQueue {
		// Update job status
		s.mu.Lock()
		if job, exists := s.activeJobs[task.ID]; exists {
			job.Status = "processing"
		}
		s.mu.Unlock()

		// Submit to worker pool
		s.workerPool.Submit(task)
	}
}

// processThumbnailOptimized processes thumbnail generation with hardware acceleration
func (wp *WorkerPool) processThumbnailOptimized(task ProcessingTask) (string, error) {
	// Use season/episode data from task if available
	var season, episode *int
	if task.Season != nil && task.Episode != nil {
		season = task.Season
		episode = task.Episode
	}

	// Generate unique filename with season and episode info if available
	filename := generateUniqueFilename(task.MediaID, task.Title, season, episode, "thumb", ".jpg")

	// Try root folder first (preferred location)
	rootThumbnailPath := filepath.Join("./thumbnails", filename)
	if _, err := os.Stat(rootThumbnailPath); err == nil {
		return rootThumbnailPath, nil
	}

	thumbnailPath := rootThumbnailPath

	// Get optimized FFmpeg configuration
	config := wp.getOptimizedFFmpegConfig("thumbnail")

	// Get video duration for smart timestamp selection
	duration, err := getVideoDurationFast(task.VideoPath)
	if err != nil {
		log.Printf("Failed to get video duration for media %d: %v", task.MediaID, err)
		duration = 300 // Default fallback
	}

	// Calculate optimal timestamp (avoid intro/credits)
	timestamp := calculateOptimalTimestamp(duration, "thumbnail")
	timeStr := secondsToTimeString(timestamp)

	log.Printf("🎯 Generating optimized HD thumbnail for media %d at %s using %s",
		task.MediaID, timeStr, config.HWAccel)

	// Build optimized FFmpeg command
	args := buildThumbnailCommand(task.VideoPath, thumbnailPath, timeStr, config)

	// Use context with timeout for optimized processing
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "ffmpeg", args...)

	// Run with timeout
	err = cmd.Run()
	if err != nil {
		log.Printf("❌ Optimized thumbnail generation failed for media %d: %v", task.MediaID, err)
		// Fallback to software encoding
		return wp.generateThumbnailFallback(task.VideoPath, task.MediaID, thumbnailPath)
	}

	// Verify thumbnail was created
	if _, err := os.Stat(thumbnailPath); err != nil {
		return wp.generateThumbnailFallback(task.VideoPath, task.MediaID, thumbnailPath)
	}

	log.Printf("✅ Optimized HD thumbnail generated for media %d: %s", task.MediaID, thumbnailPath)
	return thumbnailPath, nil
}

// processPreviewOptimized processes preview generation with hardware acceleration and ALAC audio
func (wp *WorkerPool) processPreviewOptimized(task ProcessingTask) (string, error) {
	// Create unique filename for HD preview clip
	filename := generateUniqueFilename(task.MediaID, task.Title, nil, nil, "preview", ".mp4")

	// Try root folder first (preferred location)
	rootPreviewPath := filepath.Join("./previews", filename)
	if _, err := os.Stat(rootPreviewPath); err == nil {
		return rootPreviewPath, nil
	}

	previewPath := rootPreviewPath

	// Get optimized FFmpeg configuration
	config := wp.getOptimizedFFmpegConfig("preview")

	// Get video duration for smart segment selection
	duration, err := getVideoDurationFast(task.VideoPath)
	if err != nil {
		log.Printf("Failed to get video duration for media %d: %v", task.MediaID, err)
		duration = 300 // Default fallback
	}

	// Calculate optimal start time and duration
	startTime := calculateOptimalTimestamp(duration, "preview")
	clipDuration := 15 // 15 seconds

	// Ensure we don't exceed video duration
	if startTime+clipDuration > duration {
		startTime = max(10, duration-clipDuration-5)
	}

	startTimeStr := secondsToTimeString(startTime)

	log.Printf("🎬 Generating optimized 15s HD preview with ALAC audio for media %d starting at %s using %s",
		task.MediaID, startTimeStr, config.HWAccel)

	// Try to generate preview with ALAC audio first
	if previewWithALAC, err := wp.generatePreviewWithALAC(task, previewPath, startTimeStr, clipDuration, config); err == nil {
		return previewWithALAC, nil
	}

	// Fallback to standard preview generation
	args := buildPreviewCommand(task.VideoPath, previewPath, startTimeStr, clipDuration, config)

	// No timeout for large video files - let it take as long as needed
	cmd := exec.Command("ffmpeg", args...)

	// Run without timeout constraints
	err = cmd.Run()
	if err != nil {
		log.Printf("❌ Optimized preview generation failed for media %d: %v", task.MediaID, err)

		// Check for specific CUDA errors (exit status 234 is common CUDA issue)
		if config.HWAccel == "cuda" {
			log.Printf("🔄 CUDA preview failed (likely exit status 234), immediately trying software fallback for media %d", task.MediaID)
			return wp.generatePreviewWithSoftwareEncoding(task.VideoPath, task.MediaID, previewPath, startTimeStr, clipDuration)
		}

		// Fallback to other methods
		return wp.generatePreviewFallback(task.VideoPath, task.MediaID, previewPath)
	}

	// Verify preview was created
	if _, err := os.Stat(previewPath); err != nil {
		return wp.generatePreviewFallback(task.VideoPath, task.MediaID, previewPath)
	}

	log.Printf("✅ Optimized 15s HD preview generated for media %d: %s", task.MediaID, previewPath)
	return previewPath, nil
}

// generatePreviewWithALAC generates preview clip with ALAC audio automatically
func (wp *WorkerPool) generatePreviewWithALAC(task ProcessingTask, previewPath, startTimeStr string, clipDuration int, config FFmpegConfig) (string, error) {
	// Check if ALAC audio exists for this media
	alacPath := wp.getALACPath(task.MediaID)
	if alacPath == "" {
		// No ALAC audio available, skip ALAC preview
		return "", fmt.Errorf("no ALAC audio available for media %d", task.MediaID)
	}

	log.Printf("🎵 Generating preview with ALAC audio for media %d", task.MediaID)

	// Build FFmpeg command with ALAC audio
	args := []string{
		"-ss", startTimeStr, // Start time
		"-i", task.VideoPath, // Video input
		"-ss", startTimeStr, // Start time for audio
		"-i", alacPath, // ALAC audio input
		"-t", fmt.Sprintf("%d", clipDuration), // Duration
		"-map", "0:v:0", // Map video from first input
		"-map", "1:a:0", // Map ALAC audio from second input
	}

	// Add hardware acceleration if available
	if config.HWAccel != "none" {
		switch config.HWAccel {
		case "cuda":
			args = append(args, "-hwaccel", "cuda", "-hwaccel_output_format", "cuda")
			args = append(args, "-c:v", "h264_nvenc")
		case "vaapi":
			args = append(args, "-hwaccel", "vaapi", "-hwaccel_output_format", "vaapi")
			args = append(args, "-c:v", "h264_vaapi")
		}
	} else {
		args = append(args, "-c:v", "libx264")
	}

	// Audio settings - copy ALAC or re-encode if needed
	args = append(args,
		"-c:a", "aac", // Re-encode to AAC for web compatibility
		"-b:a", "192k", // High quality audio bitrate
		"-ar", "48000", // 48kHz sample rate
		"-ac", "2", // Stereo for previews
		"-af", "loudnorm=I=-16:TP=-1.5:LRA=11", // Loudness normalization
	)

	// Video quality settings
	args = append(args,
		"-preset", "fast", // Fast encoding
		"-crf", "23", // Good quality
		"-pix_fmt", "yuv420p", // Web compatibility
		"-movflags", "+faststart", // Web optimization
		"-y", // Overwrite existing
		previewPath,
	)

	// No timeout for ALAC processing - let it take as long as needed
	cmd := exec.Command("ffmpeg", args...)

	err := cmd.Run()
	if err != nil {
		log.Printf("❌ Preview with ALAC audio generation failed for media %d: %v", task.MediaID, err)
		return "", err
	}

	// Verify preview was created
	if _, err := os.Stat(previewPath); err != nil {
		return "", fmt.Errorf("preview file not created: %v", err)
	}

	log.Printf("✅ Preview with ALAC audio generated for media %d: %s", task.MediaID, previewPath)
	return previewPath, nil
}

// getALACPath returns the ALAC audio path for a media ID (integration point with ALAC service)
func (wp *WorkerPool) getALACPath(mediaID uint) string {
	// Use injected ALAC service if available
	if wp.alacService != nil {
		return wp.alacService.GetAudioPath(int(mediaID))
	}

	// Fallback: check common ALAC paths
	alacPaths := []string{
		fmt.Sprintf("./alac_audio/alac_%d.m4a", mediaID),
		fmt.Sprintf("./alac_audio/hq_audio_%d.m4a", mediaID),
		fmt.Sprintf("./audio/alac_%d.m4a", mediaID),
		fmt.Sprintf("./audio/hq_audio_%d.m4a", mediaID),
	}

	for _, path := range alacPaths {
		if _, err := os.Stat(path); err == nil {
			// Verify file is not too large (under 1GB)
			if fileInfo, err := os.Stat(path); err == nil && fileInfo.Size() <= 1024*1024*1024 {
				return path
			}
		}
	}

	return ""
}

// getOptimizedFFmpegConfig returns optimized FFmpeg configuration based on hardware
func (wp *WorkerPool) getOptimizedFFmpegConfig(taskType string) FFmpegConfig {
	config := FFmpegConfig{
		HWAccel: wp.hwAccel,
		Threads: runtime.NumCPU(),
	}

	switch wp.hwAccel {
	case "vaapi":
		config.Decoder = "h264"
		if taskType == "preview" {
			config.Encoder = "h264_vaapi"
			config.ExtraFlags = []string{
				"-vaapi_device", "/dev/dri/renderD128",
				"-hwaccel_output_format", "vaapi",
			}
		}
		config.Preset = "fast"

	case "cuda":
		// Ultra-simplified CUDA configuration to avoid exit status 234
		if taskType == "preview" {
			config.Encoder = "h264_nvenc"
			config.ExtraFlags = []string{
				"-preset", "fast",
				"-rc", "vbr",
				"-cq", "23",
			}
		}
		// Use software decoder to avoid CUVID compatibility issues

	case "qsv":
		config.Decoder = "h264_qsv"
		if taskType == "preview" {
			config.Encoder = "h264_qsv"
			config.ExtraFlags = []string{
				"-preset", "veryfast",
				"-look_ahead", "0",
			}
		}

	default: // Software encoding
		config.Encoder = "libx264"
		config.Preset = "ultrafast"
		config.ExtraFlags = []string{
			"-threads", strconv.Itoa(config.Threads),
		}
	}

	return config
}

// buildThumbnailCommand builds optimized FFmpeg command for thumbnail generation
func buildThumbnailCommand(videoPath, outputPath, timestamp string, config FFmpegConfig) []string {
	args := []string{"-y"} // Overwrite output

	// Hardware acceleration setup
	if config.HWAccel != "none" {
		args = append(args, "-hwaccel", config.HWAccel)
		if len(config.ExtraFlags) > 0 {
			args = append(args, config.ExtraFlags...)
		}
	}

	// Input and seeking
	args = append(args,
		"-ss", timestamp, // Seek before input for faster processing
		"-i", videoPath,
		"-vframes", "1", // Extract 1 frame
	)

	// HD 1920x1080p video filters for GTX 1050 Ti (4GB VRAM)
	vf := "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2"
	if config.HWAccel == "vaapi" {
		vf = "format=nv12,hwupload," + vf + ",hwdownload,format=nv12"
	}
	args = append(args, "-vf", vf)

	// Quality settings optimized for stability
	args = append(args,
		"-q:v", "3", // Slightly lower quality for stability
		"-pix_fmt", "yuv420p", // Standard format
		outputPath,
	)

	return args
}

// buildPreviewCommand builds optimized FFmpeg command for preview generation
func buildPreviewCommand(videoPath, outputPath, startTime string, duration int, config FFmpegConfig) []string {
	args := []string{"-y"} // Overwrite output

	// Optimized hardware acceleration for GTX 1050 Ti
	if config.HWAccel == "cuda" {
		// Minimal CUDA setup for 4GB VRAM
		args = append(args, "-hwaccel", "cuda", "-hwaccel_device", "0")
	} else if config.HWAccel != "none" {
		args = append(args, "-hwaccel", config.HWAccel)
		if len(config.ExtraFlags) > 0 {
			args = append(args, config.ExtraFlags...)
		}
	}

	// Input and timing
	args = append(args,
		"-ss", startTime, // Seek before input
		"-i", videoPath,
		"-t", fmt.Sprintf("%d", duration), // Duration
	)

	// Optimized video encoding for GTX 1050 Ti (4GB VRAM)
	if config.HWAccel == "cuda" {
		args = append(args,
			"-c:v", "h264_nvenc",
			"-preset", "p6", // Faster preset for stability
			"-rc", "vbr", // Variable bitrate
			"-cq", "23", // Balanced quality
			"-b:v", "1.5M", // Lower bitrate for VRAM
		)

		// Use software scaling for stability
		args = append(args, "-vf", "scale=1280:720:force_original_aspect_ratio=decrease")
	} else if config.Encoder != "" {
		args = append(args, "-c:v", config.Encoder)

		// Video filters for non-CUDA
		vf := "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2"
		if config.HWAccel == "vaapi" {
			vf = "format=nv12,hwupload," + vf
		}
		args = append(args, "-vf", vf)
	}

	// Encoding settings optimized for speed and compatibility
	if config.HWAccel == "none" {
		args = append(args,
			"-preset", "ultrafast",
			"-crf", "23", // Good quality/speed balance
		)
	}

	// Optimized audio and container settings
	args = append(args,
		"-c:a", "aac",
		"-b:a", "96k", // Lower audio bitrate
		"-ac", "2", // Stereo
		"-movflags", "+faststart", // Web optimization
		"-pix_fmt", "yuv420p",
		outputPath,
	)

	return args
}

// GenerateThumbnail generates thumbnail asynchronously using optimized worker pool
func (s *ThumbnailService) GenerateThumbnail(videoPath string, mediaID uint, title string) (string, error) {
	// Check if thumbnail already exists using unique naming
	filename := generateUniqueFilename(mediaID, title, nil, nil, "thumb", ".jpg")

	rootThumbnailPath := filepath.Join("./thumbnails", filename)
	if _, err := os.Stat(rootThumbnailPath); err == nil {
		return rootThumbnailPath, nil
	}

	backendThumbnailPath := filepath.Join(s.thumbnailPath, filename)
	if _, err := os.Stat(backendThumbnailPath); err == nil {
		return backendThumbnailPath, nil
	}

	// Generate using optimized worker pool
	return s.GenerateThumbnailAsync(videoPath, mediaID, title)
}

// GenerateThumbnailAsync generates thumbnail asynchronously with callback
func (s *ThumbnailService) GenerateThumbnailAsync(videoPath string, mediaID uint, title string) (string, error) {
	taskID := fmt.Sprintf("thumb_%d_%d", mediaID, time.Now().Unix())

	// Create job status
	s.mu.Lock()
	s.activeJobs[taskID] = &JobStatus{
		ID:        taskID,
		Type:      "thumbnail",
		Status:    "queued",
		StartTime: time.Now(),
	}
	s.mu.Unlock()

	// Create result channel for synchronous response
	resultChan := make(chan struct {
		path string
		err  error
	}, 1)

	task := ProcessingTask{
		ID:        taskID,
		Type:      "thumbnail",
		VideoPath: videoPath,
		MediaID:   mediaID,
		Title:     title,
		Priority:  1,
		Callback: func(path string, err error) {
			// Update job status
			s.mu.Lock()
			if job, exists := s.activeJobs[taskID]; exists {
				if err != nil {
					job.Status = "failed"
					job.Error = err
				} else {
					job.Status = "completed"
				}
			}
			s.mu.Unlock()

			// Send result
			resultChan <- struct {
				path string
				err  error
			}{path, err}
		},
	}

	// Submit to queue with timeout instead of immediate failure
	select {
	case s.processingQueue <- task:
		// Successfully queued
	case <-time.After(5 * time.Second):
		return "", fmt.Errorf("processing queue full - timeout after 5 seconds")
	}

	// Wait for result without timeout for large files
	result := <-resultChan
	return result.path, result.err
}

// GenerateThumbnailUnlimited generates thumbnail without timeout constraints
func (s *ThumbnailService) GenerateThumbnailUnlimited(ctx context.Context, videoPath string, mediaID uint, title string) (string, error) {
	taskID := fmt.Sprintf("thumb_unlimited_%d_%d", mediaID, time.Now().Unix())

	// Create job status
	s.mu.Lock()
	s.activeJobs[taskID] = &JobStatus{
		ID:        taskID,
		Type:      "thumbnail_unlimited",
		Status:    "queued",
		StartTime: time.Now(),
	}
	s.mu.Unlock()

	// Create result channel for synchronous response
	resultChan := make(chan struct {
		path string
		err  error
	}, 1)

	task := ProcessingTask{
		ID:        taskID,
		Type:      "thumbnail_unlimited",
		VideoPath: videoPath,
		MediaID:   mediaID,
		Title:     title,
		Priority:  1,
		Callback: func(path string, err error) {
			// Update job status
			s.mu.Lock()
			if job, exists := s.activeJobs[taskID]; exists {
				if err != nil {
					job.Status = "failed"
					job.Error = err
				} else {
					job.Status = "completed"
				}
			}
			s.mu.Unlock()

			// Send result
			resultChan <- struct {
				path string
				err  error
			}{path, err}
		},
	}

	// Submit to queue
	select {
	case s.processingQueue <- task:
		// Successfully queued
	case <-time.After(10 * time.Second):
		return "", fmt.Errorf("processing queue full - timeout after 10 seconds")
	}

	// Wait for result without timeout (use context for cancellation)
	select {
	case result := <-resultChan:
		return result.path, result.err
	case <-ctx.Done():
		return "", fmt.Errorf("thumbnail generation cancelled: %v", ctx.Err())
	}
}

// GenerateThumbnailBatch generates multiple thumbnails in parallel
func (s *ThumbnailService) GenerateThumbnailBatch(requests []struct {
	VideoPath string
	MediaID   uint
	Title     string
}) []struct {
	Path  string
	Error error
} {
	results := make([]struct {
		Path  string
		Error error
	}, len(requests))

	var wg sync.WaitGroup
	for i, req := range requests {
		wg.Add(1)
		go func(index int, request struct {
			VideoPath string
			MediaID   uint
			Title     string
		}) {
			defer wg.Done()
			path, err := s.GenerateThumbnailAsync(request.VideoPath, request.MediaID, request.Title)
			results[index] = struct {
				Path  string
				Error error
			}{path, err}
		}(i, req)
	}

	wg.Wait()
	return results
}

// generateThumbnailFallback tries alternative methods when FFmpeg fails (worker pool version)
func (wp *WorkerPool) generateThumbnailFallback(videoPath string, mediaID uint, thumbnailPath string) (string, error) {
	// Method 1: Try ffprobe + ffmpeg with minimal parameters
	log.Printf("Trying ffprobe-based thumbnail generation...")
	if err := wp.tryFFProbeMethod(videoPath, thumbnailPath); err == nil {
		return thumbnailPath, nil
	}

	// Method 2: Try ImageMagick if available
	log.Printf("Trying ImageMagick-based thumbnail generation...")
	if err := wp.tryImageMagickMethod(videoPath, thumbnailPath); err == nil {
		return thumbnailPath, nil
	}

	// Method 3: Create a placeholder thumbnail
	log.Printf("Creating placeholder thumbnail for media %d", mediaID)
	return wp.createPlaceholderThumbnail(mediaID, thumbnailPath)
}

// generatePreviewWithSoftwareEncoding tries software encoding when CUDA fails
func (wp *WorkerPool) generatePreviewWithSoftwareEncoding(videoPath string, mediaID uint, previewPath, startTime string, duration int) (string, error) {
	log.Printf("🔄 Trying software encoding for preview generation (media %d) - CUDA fallback", mediaID)

	// No timeout for software encoding - let it take as long as needed

	// Build optimized software encoding command with multiple fallback levels
	args := []string{
		"-y", // Overwrite output
		"-ss", startTime,
		"-i", videoPath,
		"-t", fmt.Sprintf("%d", duration),
		"-c:v", "libx264",
		"-preset", "fast", // Balanced speed/quality
		"-crf", "23",
		"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
		"-c:a", "aac",
		"-b:a", "128k",
		"-ac", "2",
		"-movflags", "+faststart",
		"-pix_fmt", "yuv420p",
		"-threads", "4", // Limit threads for stability
		previewPath,
	}

	cmd := exec.Command("ffmpeg", args...)

	if err := cmd.Run(); err != nil {
		log.Printf("❌ Software encoding failed for media %d: %v", mediaID, err)

		// Try ultra-fast software encoding as last resort
		log.Printf("🔄 Trying ultra-fast software encoding for media %d", mediaID)
		return wp.generateUltraFastPreview(videoPath, mediaID, previewPath, startTime, duration)
	}

	log.Printf("✅ Software encoding preview successful for media %d", mediaID)
	return previewPath, nil
}

// generateUltraFastPreview creates a preview with minimal quality settings for maximum compatibility
func (wp *WorkerPool) generateUltraFastPreview(videoPath string, mediaID uint, previewPath, startTime string, duration int) (string, error) {
	log.Printf("🚀 Trying ultra-fast preview generation for media %d", mediaID)

	// No timeout for ultra-fast preview - let it take as long as needed

	// Ultra-minimal FFmpeg command for maximum compatibility
	args := []string{
		"-y",
		"-ss", startTime,
		"-i", videoPath,
		"-t", fmt.Sprintf("%d", duration),
		"-c:v", "libx264",
		"-preset", "ultrafast",
		"-crf", "28", // Lower quality for speed
		"-vf", "scale=1280:720:force_original_aspect_ratio=decrease", // Lower resolution
		"-c:a", "aac",
		"-b:a", "96k",
		"-ac", "2",
		"-movflags", "+faststart",
		"-pix_fmt", "yuv420p",
		"-threads", "2", // Minimal threads
		previewPath,
	}

	cmd := exec.Command("ffmpeg", args...)

	if err := cmd.Run(); err != nil {
		log.Printf("❌ Ultra-fast encoding also failed for media %d: %v", mediaID, err)
		return wp.generatePreviewFallback(videoPath, mediaID, previewPath)
	}

	log.Printf("✅ Ultra-fast preview successful for media %d", mediaID)
	return previewPath, nil
}

// generatePreviewFallback tries alternative methods when preview generation fails (worker pool version)
func (wp *WorkerPool) generatePreviewFallback(videoPath string, mediaID uint, previewPath string) (string, error) {
	log.Printf("Trying fallback preview generation methods for media %d", mediaID)

	// Method 1: Try with software encoding and simpler parameters
	if err := wp.trySimplePreviewGeneration(videoPath, previewPath); err == nil {
		return previewPath, nil
	}

	// Method 2: Try shorter duration
	if err := wp.tryShortPreviewGeneration(videoPath, previewPath); err == nil {
		return previewPath, nil
	}

	// Method 3: Create placeholder preview
	return wp.createPlaceholderPreview(mediaID, previewPath)
}

// tryFFProbeMethod uses ffprobe to find a good frame, then extracts it in HD (worker pool version)
func (wp *WorkerPool) tryFFProbeMethod(videoPath, thumbnailPath string) error {
	// First, verify video is readable with ffprobe
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", videoPath)
	_, err := cmd.Output()
	if err != nil {
		return err
	}

	// Try extracting HD frame with minimal ffmpeg parameters
	ctx2, cancel2 := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel2()

	cmd = exec.CommandContext(ctx2, "ffmpeg", "-y", "-i", videoPath,
		"-vframes", "1",
		"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
		"-q:v", "2",
		"-f", "image2",
		thumbnailPath)
	return cmd.Run()
}

// tryImageMagickMethod uses ImageMagick's convert command for HD thumbnails (worker pool version)
func (wp *WorkerPool) tryImageMagickMethod(videoPath, thumbnailPath string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "convert",
		videoPath+"[0]",        // First frame
		"-resize", "1920x1080", // Full HD resolution
		"-gravity", "center",
		"-extent", "1920x1080", // Ensure exact dimensions with padding
		thumbnailPath,
	)
	return cmd.Run()
}

// createPlaceholderThumbnail creates a simple placeholder image (worker pool version)
func (wp *WorkerPool) createPlaceholderThumbnail(mediaID uint, thumbnailPath string) (string, error) {
	// Create a Full HD placeholder image using ImageMagick
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "convert",
		"-size", "1920x1080",
		"xc:black",
		"-fill", "white",
		"-gravity", "center",
		"-pointsize", "72", // Larger font for HD resolution
		"-annotate", "+0+0", fmt.Sprintf("Thumbnail\nUnavailable\nMedia %d", mediaID),
		thumbnailPath,
	)
	if err := cmd.Run(); err != nil {
		// If ImageMagick is not available, return error
		return "", fmt.Errorf("all thumbnail generation methods failed for media %d", mediaID)
	}

	return thumbnailPath, nil
}

// trySimplePreviewGeneration uses minimal FFmpeg parameters (worker pool version)
func (wp *WorkerPool) trySimplePreviewGeneration(videoPath, previewPath string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-y",              // Overwrite output
		"-ss", "00:01:00", // Start at 1 minute
		"-i", videoPath,
		"-t", "00:00:15", // Duration of 15 seconds
		"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
		"-c:v", "libx264",
		"-preset", "ultrafast",
		"-crf", "25",
		"-c:a", "aac",
		"-b:a", "128k",
		"-ac", "2",
		"-movflags", "+faststart",
		"-pix_fmt", "yuv420p",
		previewPath,
	)
	return cmd.Run()
}

// tryShortPreviewGeneration creates a very short preview (worker pool version)
func (wp *WorkerPool) tryShortPreviewGeneration(videoPath, previewPath string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-i", videoPath,
		"-ss", "00:00:30", // Start at 30 seconds
		"-t", "00:00:10", // Duration of 10 seconds
		"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2", // Full HD fallback
		"-c:v", "libx264",
		"-preset", "ultrafast",
		"-crf", "30",
		"-an", // No audio
		"-y",
		previewPath,
	)
	return cmd.Run()
}

// createPlaceholderPreview creates a simple placeholder preview (worker pool version)
func (wp *WorkerPool) createPlaceholderPreview(mediaID uint, previewPath string) (string, error) {
	// Create a simple black video with text using FFmpeg
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-f", "lavfi",
		"-i", "color=black:size=1920x1080:duration=5:rate=25",
		"-vf", fmt.Sprintf("drawtext=text='Preview\\nUnavailable\\nMedia %d':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2", mediaID),
		"-c:v", "libx264",
		"-preset", "ultrafast",
		"-crf", "30",
		"-pix_fmt", "yuv420p",
		"-y",
		previewPath,
	)

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("all preview generation methods failed for media %d: %v", mediaID, err)
	}

	return previewPath, nil
}

// generateThumbnailFallback tries alternative methods when FFmpeg fails (original service version)
func (s *ThumbnailService) generateThumbnailFallback(videoPath string, mediaID uint, thumbnailPath string) (string, error) {
	// Method 1: Try ffprobe + ffmpeg with minimal parameters
	log.Printf("Trying ffprobe-based thumbnail generation...")
	if err := s.tryFFProbeMethod(videoPath, thumbnailPath); err == nil {
		return thumbnailPath, nil
	}

	// Method 2: Try ImageMagick if available
	log.Printf("Trying ImageMagick-based thumbnail generation...")
	if err := s.tryImageMagickMethod(videoPath, thumbnailPath); err == nil {
		return thumbnailPath, nil
	}

	// Method 3: Create a placeholder thumbnail
	log.Printf("Creating placeholder thumbnail for media %d", mediaID)
	return s.createPlaceholderThumbnail(mediaID, thumbnailPath)
}

// tryFFProbeMethod uses ffprobe to find a good frame, then extracts it in HD
func (s *ThumbnailService) tryFFProbeMethod(videoPath, thumbnailPath string) error {
	// First, verify video is readable with ffprobe
	cmd := exec.Command("ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", videoPath)
	_, err := cmd.Output()
	if err != nil {
		return err
	}

	// Try extracting HD frame with minimal ffmpeg parameters
	cmd = exec.Command("ffmpeg", "-y", "-i", videoPath,
		"-vframes", "1",
		"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
		"-q:v", "2",
		"-f", "image2",
		thumbnailPath)
	return cmd.Run()
}

// tryImageMagickMethod uses ImageMagick's convert command for HD thumbnails
func (s *ThumbnailService) tryImageMagickMethod(videoPath, thumbnailPath string) error {
	cmd := exec.Command("convert",
		videoPath+"[0]",        // First frame
		"-resize", "1920x1080", // Full HD resolution
		"-gravity", "center",
		"-extent", "1920x1080", // Ensure exact dimensions with padding
		thumbnailPath,
	)
	return cmd.Run()
}

// createPlaceholderThumbnail creates a simple placeholder image
func (s *ThumbnailService) createPlaceholderThumbnail(mediaID uint, thumbnailPath string) (string, error) {
	// Create a Full HD placeholder image using ImageMagick
	cmd := exec.Command("convert",
		"-size", "1920x1080",
		"xc:black",
		"-fill", "white",
		"-gravity", "center",
		"-pointsize", "72", // Larger font for HD resolution
		"-annotate", "+0+0", fmt.Sprintf("Thumbnail\nUnavailable\nMedia %d", mediaID),
		thumbnailPath,
	)
	if err := cmd.Run(); err != nil {
		// If ImageMagick is not available, return error
		return "", fmt.Errorf("all thumbnail generation methods failed for media %d", mediaID)
	}

	return thumbnailPath, nil
}

// ServeThumbnail serves a thumbnail file
func (s *ThumbnailService) ServeThumbnail(mediaID uint, title string) (string, error) {
	filename := generateUniqueFilename(mediaID, title, nil, nil, "thumb", ".jpg")

	// Check root folder first
	rootThumbnailPath := filepath.Join("./thumbnails", filename)
	if _, err := os.Stat(rootThumbnailPath); err == nil {
		return rootThumbnailPath, nil
	}

	// Check backend folder as fallback
	backendThumbnailPath := filepath.Join(s.thumbnailPath, filename)
	if _, err := os.Stat(backendThumbnailPath); err == nil {
		return backendThumbnailPath, nil
	}

	return "", fmt.Errorf("thumbnail not found for media ID %d", mediaID)
}

// ServePreviewClip serves a preview clip file
func (s *ThumbnailService) ServePreviewClip(mediaID uint, title string) (string, error) {
	filename := generateUniqueFilename(mediaID, title, nil, nil, "preview", ".mp4")

	// Check root folder first
	rootPreviewPath := filepath.Join("./previews", filename)
	if _, err := os.Stat(rootPreviewPath); err == nil {
		return rootPreviewPath, nil
	}

	// Check backend folder as fallback
	backendPreviewPath := filepath.Join(s.thumbnailPath, filename)
	if _, err := os.Stat(backendPreviewPath); err == nil {
		return backendPreviewPath, nil
	}

	return "", fmt.Errorf("preview clip not found for media ID %d", mediaID)
}

// ServePreview serves a preview file (alias for ServePreviewClip)
func (s *ThumbnailService) ServePreview(mediaID uint, title string) (string, error) {
	return s.ServePreviewClip(mediaID, title)
}

// getVideoDurationFast gets video duration using optimized ffprobe
func getVideoDurationFast(videoPath string) (int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "ffprobe",
		"-v", "quiet",
		"-show_entries", "format=duration",
		"-of", "csv=p=0",
		videoPath,
	)

	output, err := cmd.Output()
	if err != nil {
		return 0, fmt.Errorf("failed to get video duration: %v", err)
	}

	durationStr := strings.TrimSpace(string(output))
	duration, err := strconv.ParseFloat(durationStr, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse duration: %v", err)
	}

	return int(duration), nil
}

// calculateOptimalTimestamp calculates the best timestamp for thumbnail/preview
func calculateOptimalTimestamp(duration int, taskType string) int {
	if taskType == "thumbnail" {
		// For thumbnails, use 30-70% of video (avoid intro/credits) - matches Python tasks
		start := int(float64(duration) * 0.30)
		end := int(float64(duration) * 0.70)
		if end-start < 30 {
			start = max(30, duration/3)
			end = min(duration-30, start+60)
		}
		return start + rand.Intn(max(1, end-start))
	} else {
		// For previews, use 30-70% of video - matches Python tasks
		start := int(float64(duration) * 0.30)
		end := int(float64(duration) * 0.70)
		if end-start < 45 {
			start = max(45, duration/4)
			end = min(duration-20, start+120)
		}
		return start + rand.Intn(max(1, end-start))
	}
}

// secondsToTimeString converts seconds to HH:MM:SS format
func secondsToTimeString(seconds int) string {
	hours := seconds / 3600
	minutes := (seconds % 3600) / 60
	secs := seconds % 60
	return fmt.Sprintf("%02d:%02d:%02d", hours, minutes, secs)
}

// runCommandWithTimeout runs a command with timeout and enhanced error logging
func runCommandWithTimeout(cmd *exec.Cmd, timeout time.Duration) error {
	done := make(chan error, 1)

	// Capture both stdout and stderr for better error diagnosis
	var stderr strings.Builder
	cmd.Stderr = &stderr

	go func() {
		done <- cmd.Run()
	}()

	select {
	case err := <-done:
		if err != nil {
			// Log detailed error information for CUDA debugging
			stderrOutput := stderr.String()
			if strings.Contains(stderrOutput, "cuda") || strings.Contains(stderrOutput, "nvenc") {
				log.Printf("🔍 CUDA Error Details: %s", stderrOutput)
				log.Printf("🔍 Command Args: %v", cmd.Args)
			}
			return fmt.Errorf("command failed: %v (stderr: %s)", err, stderrOutput)
		}
		return nil
	case <-time.After(timeout):
		if cmd.Process != nil {
			cmd.Process.Kill()
		}
		return fmt.Errorf("command timeout after %v", timeout)
	}
}

// generateUniqueFilename creates unique filename for TV series episodes with season/episode numbers
func generateUniqueFilename(mediaID uint, title string, season *int, episode *int, prefix, extension string) string {
	// For TV series episodes, include season/episode info
	if season != nil && episode != nil && *season > 0 && *episode > 0 {
		cleanTitle := cleanTitleForFilename(title)
		return fmt.Sprintf("%s_%d_%s_S%02dE%02d%s", prefix, mediaID, cleanTitle, *season, *episode, extension)
	}
	
	// For movies or episodes without season/episode info
	cleanTitle := cleanTitleForFilename(title)
	return fmt.Sprintf("%s_%d_%s%s", prefix, mediaID, cleanTitle, extension)
}

// generateUniqueFilenameWithTimestamp creates unique filename with timestamp for regeneration
func generateUniqueFilenameWithTimestamp(mediaID uint, title string, season *int, episode *int, prefix, extension string) string {
	timestamp := time.Now().Format("20060102_150405") // YYYYMMDD_HHMMSS format
	
	// For TV series episodes, include season/episode info
	if season != nil && episode != nil && *season > 0 && *episode > 0 {
		cleanTitle := cleanTitleForFilename(title)
		return fmt.Sprintf("%s_%d_%s_S%02dE%02d_%s%s", prefix, mediaID, cleanTitle, *season, *episode, timestamp, extension)
	}
	
	// For movies or episodes without season/episode info
	cleanTitle := cleanTitleForFilename(title)
	return fmt.Sprintf("%s_%d_%s_%s%s", prefix, mediaID, cleanTitle, timestamp, extension)
}

// cleanTitleForFilename creates a safe filename from a title
func cleanTitleForFilename(title string) string {
	// Remove or replace characters that are not safe for filenames
	cleaned := strings.ReplaceAll(title, " ", "_")
	cleaned = strings.ReplaceAll(cleaned, ":", "")
	cleaned = strings.ReplaceAll(cleaned, "/", "_")
	cleaned = strings.ReplaceAll(cleaned, "\\", "_")
	cleaned = strings.ReplaceAll(cleaned, "?", "")
	cleaned = strings.ReplaceAll(cleaned, "*", "")
	cleaned = strings.ReplaceAll(cleaned, "<", "")
	cleaned = strings.ReplaceAll(cleaned, ">", "")
	cleaned = strings.ReplaceAll(cleaned, "|", "")
	cleaned = strings.ReplaceAll(cleaned, "\"", "")
	cleaned = strings.ReplaceAll(cleaned, "'", "")
	
	// Remove year patterns in parentheses for cleaner filenames
	cleaned = regexp.MustCompile(`\s*\(\d{4}\)\s*`).ReplaceAllString(cleaned, "")

	// Remove multiple underscores and trim
	cleaned = regexp.MustCompile(`_+`).ReplaceAllString(cleaned, "_")
	cleaned = strings.Trim(cleaned, "_")

	// Limit length to avoid filesystem issues
	if len(cleaned) > 50 {
		cleaned = cleaned[:50]
	}

	// Ensure we have something if title was all special characters
	if cleaned == "" {
		cleaned = "untitled"
	}

	return cleaned
}

// Helper function for max
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// Helper function for min
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// GeneratePreviewClip generates preview clip asynchronously using optimized worker pool
func (s *ThumbnailService) GeneratePreviewClip(videoPath string, mediaID uint, title string) (string, error) {
	return s.GeneratePreviewClipWithEpisodeInfo(videoPath, mediaID, title, nil, nil)
}

// GeneratePreviewClipWithEpisodeInfo generates preview clip with season/episode info for proper naming
func (s *ThumbnailService) GeneratePreviewClipWithEpisodeInfo(videoPath string, mediaID uint, title string, season *int, episode *int) (string, error) {
	// Check if preview already exists using unique naming
	filename := generateUniqueFilename(mediaID, title, season, episode, "preview", ".mp4")

	previewPaths := []string{
		filepath.Join("./previews", filename),
		filepath.Join(s.thumbnailPath, filename),
	}

	for _, path := range previewPaths {
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}

	// Generate using optimized worker pool
	return s.GeneratePreviewClipAsyncWithEpisodeInfo(videoPath, mediaID, title, season, episode)
}

// GeneratePreviewClipAsync generates preview clip asynchronously with callback
func (s *ThumbnailService) GeneratePreviewClipAsync(videoPath string, mediaID uint, title string) (string, error) {
	return s.GeneratePreviewClipAsyncWithEpisodeInfo(videoPath, mediaID, title, nil, nil)
}

// GeneratePreviewClipAsyncWithEpisodeInfo generates preview clip asynchronously with callback and season/episode info
func (s *ThumbnailService) GeneratePreviewClipAsyncWithEpisodeInfo(videoPath string, mediaID uint, title string, season *int, episode *int) (string, error) {
	taskID := fmt.Sprintf("preview_%d_%d", mediaID, time.Now().Unix())

	// Create job status
	s.mu.Lock()
	s.activeJobs[taskID] = &JobStatus{
		ID:        taskID,
		Type:      "preview",
		Status:    "queued",
		StartTime: time.Now(),
	}
	s.mu.Unlock()

	// Create result channel for synchronous response
	resultChan := make(chan struct {
		path string
		err  error
	}, 1)

	task := ProcessingTask{
		ID:        taskID,
		Type:      "preview",
		VideoPath: videoPath,
		MediaID:   mediaID,
		Title:     title,
		Priority:  1,
		Callback: func(path string, err error) {
			// Update job status
			s.mu.Lock()
			if job, exists := s.activeJobs[taskID]; exists {
				if err != nil {
					job.Status = "failed"
					job.Error = err
				} else {
					job.Status = "completed"
				}
			}
			s.mu.Unlock()

			// Send result
			resultChan <- struct {
				path string
				err  error
			}{path, err}
		},
	}

	// Submit to queue with timeout instead of immediate failure
	select {
	case s.processingQueue <- task:
		// Successfully queued
	case <-time.After(5 * time.Second):
		return "", fmt.Errorf("processing queue full - timeout after 5 seconds")
	}

	// Wait for result with timeout
	select {
	case result := <-resultChan:
		return result.path, result.err
	case <-time.After(120 * time.Second): // Longer timeout for previews
		return "", fmt.Errorf("preview generation timeout")
	}
}

// RegenerateThumbnailAsync forces thumbnail regeneration with timestamped filename
func (s *ThumbnailService) RegenerateThumbnailAsync(videoPath string, mediaID uint, title string) (string, error) {
	return s.RegenerateThumbnailAsyncWithEpisodeInfo(videoPath, mediaID, title, nil, nil)
}

// RegenerateThumbnailAsyncWithEpisodeInfo forces thumbnail regeneration with timestamped filename and episode info
func (s *ThumbnailService) RegenerateThumbnailAsyncWithEpisodeInfo(videoPath string, mediaID uint, title string, season *int, episode *int) (string, error) {
	taskID := fmt.Sprintf("regen_thumb_%d_%d", mediaID, time.Now().Unix())

	// Create job status
	s.mu.Lock()
	s.activeJobs[taskID] = &JobStatus{
		ID:        taskID,
		Type:      "thumbnail_regeneration",
		Status:    "queued",
		StartTime: time.Now(),
	}
	s.mu.Unlock()

	// Create result channel for synchronous response
	resultChan := make(chan struct {
		path string
		err  error
	}, 1)

	task := ProcessingTask{
		ID:        taskID,
		Type:      "thumbnail_regeneration",
		VideoPath: videoPath,
		MediaID:   mediaID,
		Title:     title,
		Priority:  1,
		Season:    season,
		Episode:   episode,
		Callback: func(path string, err error) {
			// Update job status
			s.mu.Lock()
			if job, exists := s.activeJobs[taskID]; exists {
				if err != nil {
					job.Status = "failed"
					job.Error = err
				} else {
					job.Status = "completed"
				}
			}
			s.mu.Unlock()

			// Send result
			resultChan <- struct {
				path string
				err  error
			}{path, err}
		},
	}

	// Submit to queue with timeout
	select {
	case s.processingQueue <- task:
		// Successfully queued
	case <-time.After(5 * time.Second):
		return "", fmt.Errorf("processing queue full - timeout after 5 seconds")
	}

	// Wait for result
	result := <-resultChan
	return result.path, result.err
}

// RegeneratePreviewClipAsync forces preview clip regeneration with timestamped filename
func (s *ThumbnailService) RegeneratePreviewClipAsync(videoPath string, mediaID uint, title string) (string, error) {
	return s.RegeneratePreviewClipAsyncWithEpisodeInfo(videoPath, mediaID, title, nil, nil)
}

// RegeneratePreviewClipAsyncWithEpisodeInfo forces preview clip regeneration with timestamped filename and episode info
func (s *ThumbnailService) RegeneratePreviewClipAsyncWithEpisodeInfo(videoPath string, mediaID uint, title string, season *int, episode *int) (string, error) {
	taskID := fmt.Sprintf("regen_preview_%d_%d", mediaID, time.Now().Unix())

	// Create job status
	s.mu.Lock()
	s.activeJobs[taskID] = &JobStatus{
		ID:        taskID,
		Type:      "preview_regeneration",
		Status:    "queued",
		StartTime: time.Now(),
	}
	s.mu.Unlock()

	// Create result channel for synchronous response
	resultChan := make(chan struct {
		path string
		err  error
	}, 1)

	task := ProcessingTask{
		ID:        taskID,
		Type:      "preview_regeneration",
		VideoPath: videoPath,
		MediaID:   mediaID,
		Title:     title,
		Priority:  1,
		Season:    season,
		Episode:   episode,
		Callback: func(path string, err error) {
			// Update job status
			s.mu.Lock()
			if job, exists := s.activeJobs[taskID]; exists {
				if err != nil {
					job.Status = "failed"
					job.Error = err
				} else {
					job.Status = "completed"
				}
			}
			s.mu.Unlock()

			// Send result
			resultChan <- struct {
				path string
				err  error
			}{path, err}
		},
	}

	// Submit to queue with timeout
	select {
	case s.processingQueue <- task:
		// Successfully queued
	case <-time.After(5 * time.Second):
		return "", fmt.Errorf("processing queue full - timeout after 5 seconds")
	}

	// Wait for result with timeout
	select {
	case result := <-resultChan:
		return result.path, result.err
	case <-time.After(120 * time.Second): // Longer timeout for previews
		return "", fmt.Errorf("preview regeneration timeout")
	}
}

// GeneratePreviewClipBatch generates multiple preview clips in parallel
func (s *ThumbnailService) GeneratePreviewClipBatch(requests []struct {
	VideoPath string
	MediaID   uint
	Title     string
}) []struct {
	Path  string
	Error error
} {
	results := make([]struct {
		Path  string
		Error error
	}, len(requests))

	var wg sync.WaitGroup
	for i, req := range requests {
		wg.Add(1)
		go func(index int, request struct {
			VideoPath string
			MediaID   uint
			Title     string
		}) {
			defer wg.Done()
			path, err := s.GeneratePreviewClipAsync(request.VideoPath, request.MediaID, request.Title)
			results[index] = struct {
				Path  string
				Error error
			}{path, err}
		}(i, req)
	}

	wg.Wait()
	return results
}

func (s *ThumbnailService) GeneratePreview(videoPath string, mediaID uint, title string) (string, error) {
	// Use the same logic as GeneratePreviewClip for consistency
	return s.GeneratePreviewClip(videoPath, mediaID, title)
}

func (s *ThumbnailService) GetVideoMetadata(videoPath string) (map[string]interface{}, error) {
	// Use FFprobe to get video metadata
	cmd := exec.Command("ffprobe",
		"-v", "quiet",
		"-print_format", "json",
		"-show_format",
		"-show_streams",
		videoPath,
	)

	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get video metadata: %v", err)
	}

	// Parse JSON output
	var metadata map[string]interface{}
	if err := json.Unmarshal(output, &metadata); err != nil {
		// Fallback to raw output if JSON parsing fails
		metadata = map[string]interface{}{
			"raw_output": string(output),
		}
	}

	return metadata, nil
}

// getVideoDuration extracts video duration in seconds using ffprobe
func (s *ThumbnailService) getVideoDuration(videoPath string) (int, error) {
	cmd := exec.Command("ffprobe",
		"-v", "quiet",
		"-show_entries", "format=duration",
		"-of", "csv=p=0",
		videoPath,
	)

	output, err := cmd.Output()
	if err != nil {
		return 0, fmt.Errorf("failed to get video duration: %v", err)
	}

	durationStr := strings.TrimSpace(string(output))
	duration, err := strconv.ParseFloat(durationStr, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse duration: %v", err)
	}

	return int(duration), nil
}

// secondsToTimeString converts seconds to HH:MM:SS format
func (s *ThumbnailService) secondsToTimeString(seconds int) string {
	hours := seconds / 3600
	minutes := (seconds % 3600) / 60
	secs := seconds % 60
	return fmt.Sprintf("%02d:%02d:%02d", hours, minutes, secs)
}

func (s *ThumbnailService) GetThumbnailPath(mediaID uint, title string) string {
	filename := generateUniqueFilename(mediaID, title, nil, nil, "thumb", ".jpg")

	// Check root folder first
	rootPath := filepath.Join("./thumbnails", filename)
	if _, err := os.Stat(rootPath); err == nil {
		return rootPath
	}

	// Return backend path as fallback (even if it doesn't exist)
	return filepath.Join(s.thumbnailPath, filename)
}

func (s *ThumbnailService) GetPreviewPath(mediaID uint, title string) string {
	filename := generateUniqueFilename(mediaID, title, nil, nil, "preview", ".mp4")

	// Check root folder first
	rootPath := filepath.Join("./previews", filename)
	if _, err := os.Stat(rootPath); err == nil {
		return rootPath
	}

	// Return backend path as fallback (even if it doesn't exist)
	return filepath.Join(s.thumbnailPath, filename)
}

func (s *ThumbnailService) ThumbnailExists(mediaID uint, title string) bool {
	filename := generateUniqueFilename(mediaID, title, nil, nil, "thumb", ".jpg")

	// Check root folder first
	rootPath := filepath.Join("./thumbnails", filename)
	if _, err := os.Stat(rootPath); err == nil {
		return true
	}

	// Check backend folder
	backendPath := filepath.Join(s.thumbnailPath, filename)
	_, err := os.Stat(backendPath)
	return err == nil
}

func (s *ThumbnailService) PreviewExists(mediaID uint, title string) bool {
	filename := generateUniqueFilename(mediaID, title, nil, nil, "preview", ".mp4")

	// Check root folder first
	rootPath := filepath.Join("./previews", filename)
	if _, err := os.Stat(rootPath); err == nil {
		return true
	}

	// Check backend folder
	backendPath := filepath.Join(s.thumbnailPath, filename)
	_, err := os.Stat(backendPath)
	return err == nil
}

// GenerateMultiplePreviewClips generates multiple 15s HD preview clips from first half
func (s *ThumbnailService) GenerateMultiplePreviewClips(videoPath string, mediaID uint, count int) ([]string, error) {
	var previewPaths []string

	// Get video duration to calculate first half
	duration, err := s.getVideoDuration(videoPath)
	if err != nil {
		log.Printf("Failed to get video duration for media %d: %v", mediaID, err)
		duration = 300 // Default to 5 minutes
	}

	firstHalf := duration / 2
	if firstHalf < 30 {
		firstHalf = 30
	}

	// Generate multiple preview clips
	for i := 0; i < count; i++ {
		filename := fmt.Sprintf("preview_%d_%d.mp4", mediaID, i+1)
		previewPath := filepath.Join(s.thumbnailPath, filename)

		// Check if preview already exists
		if _, err := os.Stat(previewPath); err == nil {
			previewPaths = append(previewPaths, previewPath)
			continue
		}

		// Generate random start time for each clip
		rand.Seed(time.Now().UnixNano() + int64(i))
		maxStartTime := int(firstHalf) - 15
		if maxStartTime < 10 {
			maxStartTime = 10
		}

		randomStartTime := rand.Intn(maxStartTime-10) + 10
		startTimeStr := s.secondsToTimeString(randomStartTime)

		log.Printf("Generating preview clip %d/%d for media %d at %s", i+1, count, mediaID, startTimeStr)

		// Generate the preview clip
		cmd := exec.Command("ffmpeg",
			"-i", videoPath,
			"-ss", startTimeStr,
			"-t", "00:00:15",
			"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
			"-c:v", "libx264",
			"-preset", "medium",
			"-crf", "23",
			"-c:a", "aac",
			"-b:a", "128k",
			"-movflags", "+faststart",
			"-pix_fmt", "yuv420p",
			"-y",
			previewPath,
		)

		if err := cmd.Run(); err != nil {
			log.Printf("Failed to generate preview clip %d for media %d: %v", i+1, mediaID, err)
			continue
		}

		previewPaths = append(previewPaths, previewPath)
	}

	return previewPaths, nil
}

// GenerateHDThumbnailGrid generates a grid of thumbnails from first half
func (s *ThumbnailService) GenerateHDThumbnailGrid(videoPath string, mediaID uint, gridSize int) (string, error) {
	filename := fmt.Sprintf("thumb_grid_%d.jpg", mediaID)
	thumbnailPath := filepath.Join(s.thumbnailPath, filename)

	// Check if grid thumbnail already exists
	if _, err := os.Stat(thumbnailPath); err == nil {
		return thumbnailPath, nil
	}

	// Get video duration
	duration, err := s.getVideoDuration(videoPath)
	if err != nil {
		duration = 300 // Default fallback
	}

	firstHalf := duration / 2
	if firstHalf < 60 {
		firstHalf = 60 // Minimum 1 minute for grid
	}

	// Calculate interval for grid thumbnails
	interval := firstHalf / gridSize
	if interval < 5 {
		interval = 5 // Minimum 5 seconds between thumbnails
	}

	log.Printf("Generating %dx%d HD thumbnail grid for media %d from first %ds", gridSize, gridSize, mediaID, firstHalf)

	// Generate thumbnail grid using FFmpeg
	cmd := exec.Command("ffmpeg",
		"-i", videoPath,
		"-vf", fmt.Sprintf("select='not(mod(n\\,%d))',scale=320:180,tile=%dx%d", interval*25, gridSize, gridSize), // Assuming 25fps
		"-frames:v", "1",
		"-q:v", "2",
		"-y",
		thumbnailPath,
	)

	if err := cmd.Run(); err != nil {
		log.Printf("Failed to generate thumbnail grid for media %d: %v", mediaID, err)
		// Fallback to single thumbnail
		return s.GenerateThumbnail(videoPath, mediaID, "thumbnail_grid")
	}

	return thumbnailPath, nil
}

func (s *ThumbnailService) CleanupThumbnails(mediaID uint, title string) error {
	thumbnailPath := s.GetThumbnailPath(mediaID, title)
	previewPath := s.GetPreviewPath(mediaID, title)

	// Remove thumbnail if exists
	if _, err := os.Stat(thumbnailPath); err == nil {
		os.Remove(thumbnailPath)
	}

	// Remove preview if exists
	if _, err := os.Stat(previewPath); err == nil {
		os.Remove(previewPath)
	}

	// Remove multiple preview clips
	for i := 1; i <= 5; i++ {
		filename := fmt.Sprintf("preview_%d_%d.mp4", mediaID, i)
		previewPath := filepath.Join(s.thumbnailPath, filename)
		if _, err := os.Stat(previewPath); err == nil {
			os.Remove(previewPath)
		}
	}

	// Remove grid thumbnail
	gridFilename := fmt.Sprintf("thumb_grid_%d.jpg", mediaID)
	gridPath := filepath.Join(s.thumbnailPath, gridFilename)
	if _, err := os.Stat(gridPath); err == nil {
		os.Remove(gridPath)
	}

	return nil
}

// GenerateOptimizedPreviewClip creates multiple quality versions of preview clips
func (s *ThumbnailService) GenerateOptimizedPreviewClip(videoPath string, mediaID uint) (map[string]string, error) {
	previewPaths := make(map[string]string)

	// Create previews directory if it doesn't exist
	os.MkdirAll("./previews", 0755)

	// Get video duration
	duration, err := s.getVideoDuration(videoPath)
	if err != nil {
		duration = 300 // Default fallback
	}

	// Calculate optimal start time
	var startTime int
	if duration > 600 {
		startTime = 60 + rand.Intn(120)
	} else if duration > 300 {
		startTime = 30 + rand.Intn(60)
	} else {
		startTime = 10 + rand.Intn(30)
	}

	clipDuration := 25 // 25 second clips
	if startTime+clipDuration > duration {
		startTime = max(0, duration-clipDuration-10)
	}

	// Generate different quality versions
	qualities := map[string]struct {
		resolution string
		bitrate    string
		crf        string
		suffix     string
	}{
		"high":   {"1280:720", "3M", "25", "_720p"},
		"medium": {"854:480", "1.5M", "28", "_480p"},
		"low":    {"640:360", "800k", "32", "_360p"},
	}

	for quality, settings := range qualities {
		filename := fmt.Sprintf("preview_%d%s.mp4", mediaID, settings.suffix)
		previewPath := filepath.Join("./previews", filename)

		// Check if this quality already exists
		if _, err := os.Stat(previewPath); err == nil {
			previewPaths[quality] = previewPath
			continue
		}

		// Generate this quality version
		cmd := exec.Command("ffmpeg",
			"-i", videoPath,
			"-ss", strconv.Itoa(startTime),
			"-t", strconv.Itoa(clipDuration),
			"-c:v", "libx264",
			"-preset", "fast",
			"-crf", settings.crf,
			"-maxrate", settings.bitrate,
			"-bufsize", "2M",
			"-vf", fmt.Sprintf("scale=%s:force_original_aspect_ratio=decrease", settings.resolution),
			"-c:a", "aac",
			"-b:a", "96k",
			"-ac", "2",
			"-movflags", "+faststart",
			"-f", "mp4",
			"-y",
			previewPath,
		)

		log.Printf("Generating %s quality preview for media %d", quality, mediaID)

		output, err := cmd.CombinedOutput()
		if err != nil {
			log.Printf("Failed to generate %s quality preview for media %d: %v\nOutput: %s", quality, mediaID, err, string(output))
			continue
		}

		previewPaths[quality] = previewPath
		log.Printf("Generated %s quality preview: %s", quality, previewPath)
	}

	return previewPaths, nil
}

// GenerateMultipleThumbnails generates multiple thumbnails at different timestamps
func (s *ThumbnailService) GenerateMultipleThumbnails(videoPath string, mediaID uint, count int) ([]map[string]interface{}, error) {
	var results []map[string]interface{}

	// Get video duration
	duration, err := s.getVideoDuration(videoPath)
	if err != nil {
		duration = 300 // Default fallback
	}

	// Calculate first half
	firstHalf := duration / 2
	if firstHalf < 60 {
		firstHalf = 60
	}

	// Generate thumbnails at different timestamps
	for i := 0; i < count; i++ {
		// Calculate timestamp for this thumbnail
		timestamp := (firstHalf/count)*i + 10
		if timestamp >= firstHalf-10 {
			timestamp = firstHalf - 10
		}

		filename := fmt.Sprintf("thumb_%d_%d.jpg", mediaID, i+1)
		thumbnailPath := filepath.Join(s.thumbnailPath, filename)

		result := map[string]interface{}{
			"index":     i + 1,
			"timestamp": timestamp,
			"path":      thumbnailPath,
		}

		// Check if thumbnail already exists
		if _, err := os.Stat(thumbnailPath); err == nil {
			result["status"] = "success"
			result["message"] = "Thumbnail already exists"
			results = append(results, result)
			continue
		}

		// Generate thumbnail at specific timestamp
		timeStr := s.secondsToTimeString(timestamp)
		cmd := exec.Command("ffmpeg",
			"-i", videoPath,
			"-ss", timeStr,
			"-vframes", "1",
			"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
			"-q:v", "2",
			"-y",
			thumbnailPath,
		)

		if err := cmd.Run(); err != nil {
			result["status"] = "failed"
			result["error"] = err.Error()
			log.Printf("Failed to generate thumbnail %d for media %d: %v", i+1, mediaID, err)
		} else {
			result["status"] = "success"
			result["message"] = "Thumbnail generated successfully"
			log.Printf("Generated thumbnail %d for media %d at %s", i+1, mediaID, timeStr)
		}

		results = append(results, result)
	}

	return results, nil
}

// generatePreviewFallback tries alternative methods when preview generation fails
func (s *ThumbnailService) generatePreviewFallback(videoPath string, mediaID uint, previewPath string) (string, error) {
	log.Printf("Trying fallback preview generation methods for media %d", mediaID)

	// Method 1: Try with simpler FFmpeg parameters
	if err := s.trySimplePreviewGeneration(videoPath, previewPath); err == nil {
		return previewPath, nil
	}

	// Method 2: Try shorter duration
	if err := s.tryShortPreviewGeneration(videoPath, previewPath); err == nil {
		return previewPath, nil
	}

	// Method 3: Generate from thumbnail if available
	thumbnailPath := s.GetThumbnailPath(mediaID, "fallback")
	if _, err := os.Stat(thumbnailPath); err == nil {
		if err := s.createVideoFromThumbnail(thumbnailPath, previewPath); err == nil {
			return previewPath, nil
		}
	}

	// Method 4: Create placeholder preview
	return s.createPlaceholderPreview(mediaID, previewPath)
}

// trySimplePreviewGeneration uses minimal FFmpeg parameters with random timestamp
func (s *ThumbnailService) trySimplePreviewGeneration(videoPath, previewPath string) error {
	// Get random timestamp using same logic as Python tasks (30-70% of video)
	startTime := s.getRandomPreviewTimestamp(videoPath)
	startTimeStr := s.secondsToTimeString(startTime)
	
	cmd := exec.Command("ffmpeg",
		"-i", videoPath,
		"-ss", startTimeStr, // Use random timestamp instead of fixed 1 minute
		"-t", "00:00:15", // Duration of 15 seconds
		"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2", // Full HD quality
		"-c:v", "libx264",
		"-preset", "medium", // Better quality preset
		"-crf", "23", // Higher quality
		"-c:a", "aac", // Add audio codec
		"-b:a", "128k", // Audio bitrate
		"-movflags", "+faststart", // Web optimization
		"-pix_fmt", "yuv420p", // Compatibility
		"-y",
		previewPath,
	)
	return cmd.Run()
}

// tryShortPreviewGeneration creates a short preview with random timestamp
func (s *ThumbnailService) tryShortPreviewGeneration(videoPath, previewPath string) error {
	// Get random timestamp using same logic as Python tasks (30-70% of video)
	startTime := s.getRandomPreviewTimestamp(videoPath)
	startTimeStr := s.secondsToTimeString(startTime)
	
	cmd := exec.Command("ffmpeg",
		"-i", videoPath,
		"-ss", startTimeStr, // Use random timestamp instead of fixed 30 seconds
		"-t", "00:00:15", // Duration of 15 seconds
		"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2", // Full HD quality
		"-c:v", "libx264",
		"-preset", "fast", // Fast preset for short preview
		"-crf", "25", // Good quality
		"-c:a", "aac", // Add audio codec
		"-b:a", "96k", // Lower audio bitrate for short preview
		"-movflags", "+faststart", // Web optimization
		"-pix_fmt", "yuv420p", // Compatibility
		"-y",
		previewPath,
	)
	return cmd.Run()
}

// createVideoFromThumbnail creates a static video from thumbnail
func (s *ThumbnailService) createVideoFromThumbnail(thumbnailPath, previewPath string) error {
	cmd := exec.Command("ffmpeg",
		"-loop", "1",
		"-i", thumbnailPath,
		"-t", "5", // 5 second static video
		"-vf", "scale=640:360",
		"-c:v", "libx264",
		"-preset", "ultrafast",
		"-crf", "30",
		"-pix_fmt", "yuv420p",
		"-y",
		previewPath,
	)
	return cmd.Run()
}

// createPlaceholderPreview creates a simple placeholder preview
func (s *ThumbnailService) createPlaceholderPreview(mediaID uint, previewPath string) (string, error) {
	// Create a simple black video with text using FFmpeg
	cmd := exec.Command("ffmpeg",
		"-f", "lavfi",
		"-i", "color=black:size=1920x1080:duration=5:rate=25",
		"-vf", fmt.Sprintf("drawtext=text='Preview\\nUnavailable\\nMedia %d':fontcolor=white:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2", mediaID),
		"-c:v", "libx264",
		"-preset", "ultrafast",
		"-crf", "30",
		"-pix_fmt", "yuv420p",
		"-y",
		previewPath,
	)

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("all preview generation methods failed for media %d: %v", mediaID, err)
	}

	return previewPath, nil
}

// GetJobStatus returns the status of a processing job
func (s *ThumbnailService) GetJobStatus(jobID string) (*JobStatus, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	job, exists := s.activeJobs[jobID]
	return job, exists
}

// GetActiveJobs returns all active jobs
func (s *ThumbnailService) GetActiveJobs() map[string]*JobStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	jobs := make(map[string]*JobStatus)
	for k, v := range s.activeJobs {
		jobs[k] = v
	}
	return jobs
}

// GetWorkerPoolStats returns worker pool statistics
func (s *ThumbnailService) GetWorkerPoolStats() map[string]interface{} {
	queueLength := len(s.processingQueue)
	activeJobs := len(s.activeJobs)
	queueCapacity := cap(s.processingQueue)
	queueUtilization := float64(queueLength) / float64(queueCapacity) * 100

	return map[string]interface{}{
		"workers":           s.workerPool.workers,
		"hardware_accel":    s.hwAcceleration,
		"max_concurrent":    s.maxConcurrent,
		"queue_length":      queueLength,
		"queue_capacity":    queueCapacity,
		"queue_utilization": queueUtilization,
		"active_jobs":       activeJobs,
		"queue_health":      s.getQueueHealth(queueUtilization),
	}
}

// getQueueHealth returns queue health status
func (s *ThumbnailService) getQueueHealth(utilization float64) string {
	if utilization < 50 {
		return "healthy"
	} else if utilization < 80 {
		return "busy"
	} else if utilization < 95 {
		return "overloaded"
	} else {
		return "critical"
	}
}

// IsQueueHealthy checks if the processing queue is healthy
func (s *ThumbnailService) IsQueueHealthy() bool {
	queueLength := len(s.processingQueue)
	queueCapacity := cap(s.processingQueue)
	utilization := float64(queueLength) / float64(queueCapacity) * 100
	return utilization < 80 // Consider healthy if less than 80% full
}

// CleanupCompletedJobs removes completed jobs older than specified duration
func (s *ThumbnailService) CleanupCompletedJobs(maxAge time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()

	cutoff := time.Now().Add(-maxAge)
	cleaned := 0
	for id, job := range s.activeJobs {
		if (job.Status == "completed" || job.Status == "failed") && job.StartTime.Before(cutoff) {
			delete(s.activeJobs, id)
			cleaned++
		}
	}

	if cleaned > 0 {
		log.Printf("🧹 Cleaned up %d completed jobs older than %v", cleaned, maxAge)
	}
}

// DrainQueue safely drains excess items from the queue when it's too full
func (s *ThumbnailService) DrainQueue(maxItems int) int {
	drained := 0
	for len(s.processingQueue) > maxItems {
		select {
		case task := <-s.processingQueue:
			// Mark job as failed due to queue overflow
			s.mu.Lock()
			if job, exists := s.activeJobs[task.ID]; exists {
				job.Status = "failed"
				job.Error = fmt.Errorf("dropped due to queue overflow")
			}
			s.mu.Unlock()

			// Call callback with error
			if task.Callback != nil {
				task.Callback("", fmt.Errorf("dropped due to queue overflow"))
			}
			drained++
		default:
			break
		}
	}

	if drained > 0 {
		log.Printf("⚠️ Drained %d tasks from overloaded queue", drained)
	}

	return drained
}

// StartQueueMaintenance starts a background goroutine for queue maintenance
func (s *ThumbnailService) StartQueueMaintenance() {
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			// Clean up old completed jobs
			s.CleanupCompletedJobs(10 * time.Minute)

			// Check queue health and drain if necessary
			queueLength := len(s.processingQueue)
			queueCapacity := cap(s.processingQueue)
			utilization := float64(queueLength) / float64(queueCapacity) * 100

			if utilization > 90 {
				log.Printf("🚨 Queue critically full (%.1f%%), draining excess tasks", utilization)
				s.DrainQueue(int(float64(queueCapacity) * 0.8)) // Drain to 80% capacity
			}
		}
	}()
}

// Shutdown gracefully shuts down the thumbnail service
func (s *ThumbnailService) Shutdown() {
	log.Println("🛑 Shutting down ThumbnailService...")

	// Stop worker pool
	if s.workerPool != nil {
		s.workerPool.Stop()
	}

	// Close processing queue
	close(s.processingQueue)

	log.Println("✅ ThumbnailService shutdown complete")
}

// cleanTitleForFilename creates a safe filename from a title
func (s *ThumbnailService) cleanTitleForFilename(title string) string {
	// Remove or replace characters that are not safe for filenames
	cleaned := strings.ReplaceAll(title, " ", "_")
	cleaned = strings.ReplaceAll(cleaned, ":", "")
	cleaned = strings.ReplaceAll(cleaned, "/", "_")
	cleaned = strings.ReplaceAll(cleaned, "\\", "_")
	cleaned = strings.ReplaceAll(cleaned, "?", "")
	cleaned = strings.ReplaceAll(cleaned, "*", "")
	cleaned = strings.ReplaceAll(cleaned, "<", "")
	cleaned = strings.ReplaceAll(cleaned, ">", "")
	cleaned = strings.ReplaceAll(cleaned, "|", "")
	cleaned = strings.ReplaceAll(cleaned, "\"", "")
	cleaned = strings.ReplaceAll(cleaned, "'", "")

	// Remove multiple underscores and trim
	cleaned = regexp.MustCompile(`_+`).ReplaceAllString(cleaned, "_")
	cleaned = strings.Trim(cleaned, "_")

	// Limit length to avoid filesystem issues
	if len(cleaned) > 100 {
		cleaned = cleaned[:100]
	}

	// Ensure we have something if title was all special characters
	if cleaned == "" {
		cleaned = "untitled"
	}

	return cleaned
}

// runCommandWithProgress runs a command and shows a progress indicator
func (s *ThumbnailService) runCommandWithProgress(cmd *exec.Cmd, description string) error {
	log.Printf("🎬 %s...", description)

	// Start the command
	err := cmd.Start()
	if err != nil {
		return fmt.Errorf("failed to start command: %w", err)
	}

	// Show progress dots while command is running
	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	dots := 0
	for {
		select {
		case err := <-done:
			if err != nil {
				log.Printf("❌ %s failed", description)
				return err
			}
			log.Printf("✅ %s completed successfully", description)
			return nil
		case <-ticker.C:
			dots = (dots + 1) % 4
			progress := strings.Repeat(".", dots) + strings.Repeat(" ", 3-dots)
			log.Printf("⏳ %s in progress%s", description, progress)
		}
	}
}

// CheckCUDAHealth performs a health check on CUDA acceleration
func (s *ThumbnailService) CheckCUDAHealth() bool {
	if s.hwAcceleration != "cuda" {
		return true // Not using CUDA, so it's "healthy"
	}

	log.Printf("🔍 Performing CUDA health check...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Simple CUDA test
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-f", "lavfi", "-i", "testsrc2=duration=1:size=320x240:rate=1",
		"-c:v", "h264_nvenc", "-preset", "fast", "-rc", "vbr", "-cq", "23",
		"-t", "1", "-f", "null", "-")

	err := cmd.Run()
	if err != nil {
		log.Printf("❌ CUDA health check failed: %v", err)
		log.Printf("🔄 Switching to software encoding due to CUDA issues")
		s.hwAcceleration = "none"
		return false
	}

	log.Printf("✅ CUDA health check passed")
	return true
}

// PerformMaintenanceCheck runs various health checks and maintenance tasks
func (s *ThumbnailService) PerformMaintenanceCheck() {
	log.Printf("🔧 Performing thumbnail service maintenance check...")

	// Check CUDA health if using CUDA
	if s.hwAcceleration == "cuda" {
		s.CheckCUDAHealth()
	}

	// Check queue health
	stats := s.GetWorkerPoolStats()
	queueHealth := stats["queue_health"].(string)
	if queueHealth == "critical" || queueHealth == "overloaded" {
		log.Printf("⚠️ Queue health is %s, performing maintenance", queueHealth)
		s.DrainQueue(int(float64(cap(s.processingQueue)) * 0.7))
	}

	// Clean up old jobs
	s.CleanupCompletedJobs(15 * time.Minute)

	log.Printf("✅ Maintenance check completed")
}

// StartPeriodicMaintenance starts periodic maintenance tasks
func (s *ThumbnailService) StartPeriodicMaintenance() {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			s.PerformMaintenanceCheck()
		}
	}()
}

// GeneratePreviewClipUnlimited generates preview clip without timeout constraints
func (s *ThumbnailService) GeneratePreviewClipUnlimited(ctx context.Context, videoPath string, mediaID uint, title string) (string, error) {
	taskID := fmt.Sprintf("preview_unlimited_%d_%d", mediaID, time.Now().Unix())

	// Create job status
	s.mu.Lock()
	s.activeJobs[taskID] = &JobStatus{
		ID:        taskID,
		Type:      "preview_unlimited",
		Status:    "queued",
		StartTime: time.Now(),
	}
	s.mu.Unlock()

	// Create result channel for synchronous response
	resultChan := make(chan struct {
		path string
		err  error
	}, 1)

	task := ProcessingTask{
		ID:        taskID,
		Type:      "preview_unlimited",
		VideoPath: videoPath,
		MediaID:   mediaID,
		Title:     title,
		Priority:  1,
		Callback: func(path string, err error) {
			// Update job status
			s.mu.Lock()
			if job, exists := s.activeJobs[taskID]; exists {
				if err != nil {
					job.Status = "failed"
					job.Error = err
				} else {
					job.Status = "completed"
				}
			}
			s.mu.Unlock()

			// Send result
			resultChan <- struct {
				path string
				err  error
			}{path, err}
		},
	}

	// Submit to queue
	select {
	case s.processingQueue <- task:
		// Successfully queued
	case <-time.After(10 * time.Second):
		return "", fmt.Errorf("processing queue full - timeout after 10 seconds")
	}

	// Wait for result without timeout (use context for cancellation)
	select {
	case result := <-resultChan:
		return result.path, result.err
	case <-ctx.Done():
		return "", fmt.Errorf("preview generation cancelled: %v", ctx.Err())
	}
}

// processThumbnailUnlimited processes thumbnail generation without timeout
func (wp *WorkerPool) processThumbnailUnlimited(task ProcessingTask) (string, error) {
	// Create unique filename for HD thumbnail
	filename := generateUniqueFilename(task.MediaID, task.Title, nil, nil, "thumb", ".jpg")

	// Try root folder first (preferred location)
	rootThumbnailPath := filepath.Join("./thumbnails", filename)
	if _, err := os.Stat(rootThumbnailPath); err == nil {
		return rootThumbnailPath, nil
	}

	thumbnailPath := rootThumbnailPath

	// Get optimized FFmpeg configuration
	config := wp.getOptimizedFFmpegConfig("thumbnail")

	// Get video duration for smart timestamp selection
	duration, err := getVideoDurationFast(task.VideoPath)
	if err != nil {
		log.Printf("Failed to get video duration for media %d: %v", task.MediaID, err)
		duration = 300 // Default fallback
	}

	// Calculate optimal timestamp (avoid intro/credits)
	timestamp := calculateOptimalTimestamp(duration, "thumbnail")
	timeStr := secondsToTimeString(timestamp)

	log.Printf("🎯 Generating unlimited HD thumbnail for media %d at %s using %s",
		task.MediaID, timeStr, config.HWAccel)

	// Build optimized FFmpeg command
	args := buildThumbnailCommand(task.VideoPath, thumbnailPath, timeStr, config)

	// Use context without timeout for unlimited processing
	ctx := context.Background()
	cmd := exec.CommandContext(ctx, "ffmpeg", args...)

	// Run without timeout constraints
	err = cmd.Run()
	if err != nil {
		log.Printf("❌ Unlimited thumbnail generation failed for media %d: %v", task.MediaID, err)
		// Fallback to software encoding
		return wp.generateThumbnailFallback(task.VideoPath, task.MediaID, thumbnailPath)
	}

	// Verify thumbnail was created
	if _, err := os.Stat(thumbnailPath); err != nil {
		return wp.generateThumbnailFallback(task.VideoPath, task.MediaID, thumbnailPath)
	}

	log.Printf("✅ Unlimited HD thumbnail generated for media %d: %s", task.MediaID, thumbnailPath)
	return thumbnailPath, nil
}

// processPreviewUnlimited processes preview generation without timeout
func (wp *WorkerPool) processPreviewUnlimited(task ProcessingTask) (string, error) {
	// Create unique filename for HD preview clip
	filename := generateUniqueFilename(task.MediaID, task.Title, nil, nil, "preview", ".mp4")

	// Try root folder first (preferred location)
	rootPreviewPath := filepath.Join("./previews", filename)
	if _, err := os.Stat(rootPreviewPath); err == nil {
		return rootPreviewPath, nil
	}

	previewPath := rootPreviewPath

	// Get optimized FFmpeg configuration
	config := wp.getOptimizedFFmpegConfig("preview")

	// Get video duration for smart segment selection
	duration, err := getVideoDurationFast(task.VideoPath)
	if err != nil {
		log.Printf("Failed to get video duration for media %d: %v", task.MediaID, err)
		duration = 300 // Default fallback
	}

	// Calculate optimal start time and duration
	startTime := calculateOptimalTimestamp(duration, "preview")
	clipDuration := 15 // 15 seconds

	// Ensure we don't exceed video duration
	if startTime+clipDuration > duration {
		startTime = max(10, duration-clipDuration-5)
	}

	startTimeStr := secondsToTimeString(startTime)

	log.Printf("🎬 Generating unlimited 15s HD preview with ALAC audio for media %d starting at %s using %s",
		task.MediaID, startTimeStr, config.HWAccel)

	// Try to generate preview with ALAC audio first
	if previewWithALAC, err := wp.generatePreviewWithALACUnlimited(task, previewPath, startTimeStr, clipDuration, config); err == nil {
		return previewWithALAC, nil
	}

	// Fallback to standard preview generation without timeout
	args := buildPreviewCommand(task.VideoPath, previewPath, startTimeStr, clipDuration, config)

	// Use context without timeout for unlimited processing
	ctx := context.Background()
	cmd := exec.CommandContext(ctx, "ffmpeg", args...)

	// Run without timeout constraints
	err = cmd.Run()
	if err != nil {
		log.Printf("❌ Unlimited preview generation failed for media %d: %v", task.MediaID, err)

		// Check for specific CUDA errors (exit status 234 is common CUDA issue)
		if config.HWAccel == "cuda" {
			log.Printf("🔄 CUDA preview failed (likely exit status 234), trying software fallback for media %d", task.MediaID)
			return wp.generatePreviewWithSoftwareEncodingUnlimited(task.VideoPath, task.MediaID, previewPath, startTimeStr, clipDuration)
		}

		// Fallback to other methods
		return wp.generatePreviewFallback(task.VideoPath, task.MediaID, previewPath)
	}

	// Verify preview was created
	if _, err := os.Stat(previewPath); err != nil {
		return wp.generatePreviewFallback(task.VideoPath, task.MediaID, previewPath)
	}

	log.Printf("✅ Unlimited 15s HD preview generated for media %d: %s", task.MediaID, previewPath)
	return previewPath, nil
}

// generatePreviewWithALACUnlimited generates preview with ALAC audio without timeout
func (wp *WorkerPool) generatePreviewWithALACUnlimited(task ProcessingTask, previewPath, startTimeStr string, clipDuration int, config FFmpegConfig) (string, error) {
	// Check if ALAC audio exists for this media
	alacPath := wp.getALACPath(task.MediaID)
	if alacPath == "" {
		// No ALAC audio available, skip ALAC preview
		return "", fmt.Errorf("no ALAC audio available for media %d", task.MediaID)
	}

	log.Printf("🎵 Generating unlimited preview with ALAC audio for media %d", task.MediaID)

	// Build FFmpeg command with ALAC audio
	args := []string{
		"-ss", startTimeStr, // Start time
		"-i", task.VideoPath, // Video input
		"-ss", startTimeStr, // Start time for audio
		"-i", alacPath, // ALAC audio input
		"-t", fmt.Sprintf("%d", clipDuration), // Duration
		"-map", "0:v:0", // Map video from first input
		"-map", "1:a:0", // Map ALAC audio from second input
	}

	// Add hardware acceleration if available
	if config.HWAccel != "none" {
		switch config.HWAccel {
		case "cuda":
			args = append(args, "-hwaccel", "cuda", "-hwaccel_output_format", "cuda")
			args = append(args, "-c:v", "h264_nvenc")
		case "vaapi":
			args = append(args, "-hwaccel", "vaapi", "-hwaccel_output_format", "vaapi")
			args = append(args, "-c:v", "h264_vaapi")
		}
	} else {
		args = append(args, "-c:v", "libx264")
	}

	// Audio settings - copy ALAC or re-encode if needed
	args = append(args,
		"-c:a", "aac", // Re-encode to AAC for web compatibility
		"-b:a", "192k", // High quality audio bitrate
		"-ar", "48000", // 48kHz sample rate
		"-ac", "2", // Stereo for previews
		"-af", "loudnorm=I=-16:TP=-1.5:LRA=11", // Loudness normalization
	)

	// Video quality settings
	args = append(args,
		"-preset", "fast", // Fast encoding
		"-crf", "23", // Good quality
		"-pix_fmt", "yuv420p", // Web compatibility
		"-movflags", "+faststart", // Web optimization
		"-y", // Overwrite existing
		previewPath,
	)

	// Use context without timeout for unlimited processing
	ctx := context.Background()
	cmd := exec.CommandContext(ctx, "ffmpeg", args...)

	err := cmd.Run()
	if err != nil {
		log.Printf("❌ Unlimited preview with ALAC audio generation failed for media %d: %v", task.MediaID, err)
		return "", err
	}

	// Verify preview was created
	if _, err := os.Stat(previewPath); err != nil {
		return "", fmt.Errorf("preview file not created: %v", err)
	}

	log.Printf("✅ Unlimited preview with ALAC audio generated for media %d: %s", task.MediaID, previewPath)
	return previewPath, nil
}

// generatePreviewWithSoftwareEncodingUnlimited tries software encoding without timeout
func (wp *WorkerPool) generatePreviewWithSoftwareEncodingUnlimited(videoPath string, mediaID uint, previewPath, startTime string, duration int) (string, error) {
	log.Printf("🔄 Trying unlimited software encoding for preview generation (media %d) - CUDA fallback", mediaID)

	// Use context without timeout for unlimited processing
	ctx := context.Background()

	// Build optimized software encoding command
	args := []string{
		"-y", // Overwrite output
		"-ss", startTime,
		"-i", videoPath,
		"-t", fmt.Sprintf("%d", duration),
		"-c:v", "libx264",
		"-preset", "fast", // Balanced speed/quality
		"-crf", "23",
		"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
		"-c:a", "aac",
		"-b:a", "128k",
		"-ac", "2",
		"-movflags", "+faststart",
		"-pix_fmt", "yuv420p",
		"-threads", "4", // Limit threads for stability
		previewPath,
	}

	cmd := exec.CommandContext(ctx, "ffmpeg", args...)

	if err := cmd.Run(); err != nil {
		log.Printf("❌ Unlimited software encoding failed for media %d: %v", mediaID, err)

		// Try ultra-fast software encoding as last resort
		log.Printf("🔄 Trying unlimited ultra-fast software encoding for media %d", mediaID)
		return wp.generateUltraFastPreviewUnlimited(videoPath, mediaID, previewPath, startTime, duration)
	}

	log.Printf("✅ Unlimited software encoding preview successful for media %d", mediaID)
	return previewPath, nil
}

// generateUltraFastPreviewUnlimited creates a preview with minimal quality settings without timeout
func (wp *WorkerPool) generateUltraFastPreviewUnlimited(videoPath string, mediaID uint, previewPath, startTime string, duration int) (string, error) {
	log.Printf("🚀 Trying unlimited ultra-fast preview generation for media %d", mediaID)

	// Use context without timeout for unlimited processing
	ctx := context.Background()

	// Ultra-minimal FFmpeg command for maximum compatibility
	args := []string{
		"-y",
		"-ss", startTime,
		"-i", videoPath,
		"-t", fmt.Sprintf("%d", duration),
		"-c:v", "libx264",
		"-preset", "ultrafast",
		"-crf", "28", // Lower quality for speed
		"-vf", "scale=1280:720:force_original_aspect_ratio=decrease", // Lower resolution
		"-c:a", "aac",
		"-b:a", "96k",
		"-ac", "2",
		"-movflags", "+faststart",
		"-pix_fmt", "yuv420p",
		"-threads", "2", // Minimal threads
		previewPath,
	}

	cmd := exec.CommandContext(ctx, "ffmpeg", args...)

	if err := cmd.Run(); err != nil {
		log.Printf("❌ Unlimited ultra-fast encoding also failed for media %d: %v", mediaID, err)
		return wp.generatePreviewFallback(videoPath, mediaID, previewPath)
	}

	log.Printf("✅ Unlimited ultra-fast preview successful for media %d", mediaID)
	return previewPath, nil
}

// processThumbnailRegeneration processes thumbnail regeneration with timestamped filename
func (wp *WorkerPool) processThumbnailRegeneration(task ProcessingTask) (string, error) {
	// Create unique filename with timestamp for regeneration
	filename := generateUniqueFilenameWithTimestamp(task.MediaID, task.Title, task.Season, task.Episode, "thumb", ".jpg")

	// Always use root folder for regenerated assets
	thumbnailPath := filepath.Join("./thumbnails", filename)

	// Get optimized FFmpeg configuration
	config := wp.getOptimizedFFmpegConfig("thumbnail")

	// Get video duration for smart timestamp selection
	duration, err := getVideoDurationFast(task.VideoPath)
	if err != nil {
		log.Printf("Failed to get video duration for media %d: %v", task.MediaID, err)
		duration = 300 // Default fallback
	}

	// Calculate optimal timestamp (avoid intro/credits)
	timestamp := calculateOptimalTimestamp(duration, "thumbnail")
	timeStr := secondsToTimeString(timestamp)

	log.Printf("🔄 Regenerating HD thumbnail for media %d at %s using %s (timestamped: %s)",
		task.MediaID, timeStr, config.HWAccel, filename)

	// Build optimized FFmpeg command
	args := buildThumbnailCommand(task.VideoPath, thumbnailPath, timeStr, config)

	// Use context with reasonable timeout for regeneration
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "ffmpeg", args...)

	// Run with timeout
	err = cmd.Run()
	if err != nil {
		log.Printf("❌ Thumbnail regeneration failed for media %d: %v", task.MediaID, err)
		// Fallback to software encoding
		return wp.generateThumbnailFallback(task.VideoPath, task.MediaID, thumbnailPath)
	}

	// Verify thumbnail was created
	if _, err := os.Stat(thumbnailPath); err != nil {
		return wp.generateThumbnailFallback(task.VideoPath, task.MediaID, thumbnailPath)
	}

	log.Printf("✅ HD thumbnail regenerated for media %d: %s", task.MediaID, thumbnailPath)
	return thumbnailPath, nil
}

// processPreviewRegeneration processes preview regeneration with timestamped filename
func (wp *WorkerPool) processPreviewRegeneration(task ProcessingTask) (string, error) {
	// Create unique filename with timestamp for regeneration
	filename := generateUniqueFilenameWithTimestamp(task.MediaID, task.Title, task.Season, task.Episode, "preview", ".mp4")

	// Always use root folder for regenerated assets
	previewPath := filepath.Join("./previews", filename)

	// Get optimized FFmpeg configuration
	config := wp.getOptimizedFFmpegConfig("preview")

	// Get video duration for smart segment selection
	duration, err := getVideoDurationFast(task.VideoPath)
	if err != nil {
		log.Printf("Failed to get video duration for media %d: %v", task.MediaID, err)
		duration = 300 // Default fallback
	}

	// Calculate optimal start time and duration
	startTime := calculateOptimalTimestamp(duration, "preview")
	clipDuration := 15 // 15 seconds

	// Ensure we don't exceed video duration
	if startTime+clipDuration > duration {
		startTime = max(10, duration-clipDuration-5)
	}

	startTimeStr := secondsToTimeString(startTime)

	log.Printf("🔄 Regenerating 15s HD preview with ALAC audio for media %d starting at %s using %s (timestamped: %s)",
		task.MediaID, startTimeStr, config.HWAccel, filename)

	// Try to generate preview with ALAC audio first
	if previewWithALAC, err := wp.generatePreviewWithALACRegeneration(task, previewPath, startTimeStr, clipDuration, config); err == nil {
		return previewWithALAC, nil
	}

	// Fallback to standard preview generation
	args := buildPreviewCommand(task.VideoPath, previewPath, startTimeStr, clipDuration, config)

	// Use context with reasonable timeout for regeneration
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "ffmpeg", args...)

	// Run with timeout
	err = cmd.Run()
	if err != nil {
		log.Printf("❌ Preview regeneration failed for media %d: %v", task.MediaID, err)

		// Check for specific CUDA errors
		if config.HWAccel == "cuda" {
			log.Printf("🔄 CUDA preview regeneration failed, trying software fallback for media %d", task.MediaID)
			return wp.generatePreviewWithSoftwareEncodingRegeneration(task.VideoPath, task.MediaID, previewPath, startTimeStr, clipDuration)
		}

		// Fallback to other methods
		return wp.generatePreviewFallback(task.VideoPath, task.MediaID, previewPath)
	}

	// Verify preview was created
	if _, err := os.Stat(previewPath); err != nil {
		return wp.generatePreviewFallback(task.VideoPath, task.MediaID, previewPath)
	}

	log.Printf("✅ 15s HD preview regenerated for media %d: %s", task.MediaID, previewPath)
	return previewPath, nil
}

// generatePreviewWithALACRegeneration generates preview with ALAC audio for regeneration
func (wp *WorkerPool) generatePreviewWithALACRegeneration(task ProcessingTask, previewPath, startTimeStr string, clipDuration int, config FFmpegConfig) (string, error) {
	// Check if ALAC audio exists for this media
	alacPath := wp.getALACPath(task.MediaID)
	if alacPath == "" {
		// No ALAC audio available, skip ALAC preview
		return "", fmt.Errorf("no ALAC audio available for media %d", task.MediaID)
	}

	log.Printf("🎵 Regenerating preview with ALAC audio for media %d", task.MediaID)

	// Build FFmpeg command with ALAC audio (same as unlimited version but with timeout)
	args := []string{
		"-ss", startTimeStr, // Start time
		"-i", task.VideoPath, // Video input
		"-ss", startTimeStr, // Start time for audio
		"-i", alacPath, // ALAC audio input
		"-t", fmt.Sprintf("%d", clipDuration), // Duration
		"-map", "0:v:0", // Map video from first input
		"-map", "1:a:0", // Map ALAC audio from second input
	}

	// Add hardware acceleration if available
	if config.HWAccel != "none" {
		switch config.HWAccel {
		case "cuda":
			args = append(args, "-hwaccel", "cuda", "-hwaccel_output_format", "cuda")
			args = append(args, "-c:v", "h264_nvenc")
		case "vaapi":
			args = append(args, "-hwaccel", "vaapi", "-hwaccel_output_format", "vaapi")
			args = append(args, "-c:v", "h264_vaapi")
		}
	} else {
		args = append(args, "-c:v", "libx264")
	}

	// Audio settings - copy ALAC or re-encode if needed
	args = append(args,
		"-c:a", "aac", // Re-encode to AAC for web compatibility
		"-b:a", "192k", // High quality audio bitrate
		"-ar", "48000", // 48kHz sample rate
		"-ac", "2", // Stereo for previews
		"-af", "loudnorm=I=-16:TP=-1.5:LRA=11", // Loudness normalization
	)

	// Video quality settings
	args = append(args,
		"-preset", "fast", // Fast encoding
		"-crf", "23", // Good quality
		"-pix_fmt", "yuv420p", // Web compatibility
		"-movflags", "+faststart", // Web optimization
		"-y", // Overwrite existing
		previewPath,
	)

	// Use context with timeout for regeneration
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "ffmpeg", args...)

	err := cmd.Run()
	if err != nil {
		log.Printf("❌ Preview regeneration with ALAC audio failed for media %d: %v", task.MediaID, err)
		return "", err
	}

	// Verify preview was created
	if _, err := os.Stat(previewPath); err != nil {
		return "", fmt.Errorf("preview file not created: %v", err)
	}

	log.Printf("✅ Preview regenerated with ALAC audio for media %d: %s", task.MediaID, previewPath)
	return previewPath, nil
}

// generatePreviewWithSoftwareEncodingRegeneration tries software encoding for regeneration
func (wp *WorkerPool) generatePreviewWithSoftwareEncodingRegeneration(videoPath string, mediaID uint, previewPath, startTime string, duration int) (string, error) {
	log.Printf("🔄 Trying software encoding for preview regeneration (media %d) - CUDA fallback", mediaID)

	// Use context with timeout for regeneration
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	// Build optimized software encoding command
	args := []string{
		"-y", // Overwrite output
		"-ss", startTime,
		"-i", videoPath,
		"-t", fmt.Sprintf("%d", duration),
		"-c:v", "libx264",
		"-preset", "fast", // Balanced speed/quality
		"-crf", "23",
		"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
		"-c:a", "aac",
		"-b:a", "128k",
		"-ac", "2",
		"-movflags", "+faststart",
		"-pix_fmt", "yuv420p",
		"-threads", "4", // Limit threads for stability
		previewPath,
	}

	cmd := exec.CommandContext(ctx, "ffmpeg", args...)

	if err := cmd.Run(); err != nil {
		log.Printf("❌ Software encoding regeneration failed for media %d: %v", mediaID, err)
		return wp.generatePreviewFallback(videoPath, mediaID, previewPath)
	}

	log.Printf("✅ Software encoding preview regeneration successful for media %d", mediaID)
	return previewPath, nil
}

// getRandomPreviewTimestamp generates a random timestamp for preview generation
// Uses the same logic as Python Celery tasks: 30-70% of video duration
func (s *ThumbnailService) getRandomPreviewTimestamp(videoPath string) int {
	// Get video duration using ffprobe
	duration := s.getVideoDurationSeconds(videoPath)
	if duration <= 0 {
		// Fallback to 60 seconds if duration detection fails
		log.Printf("⚠️ Could not detect video duration for %s, using 60s fallback", videoPath)
		return 60
	}

	// Use random timestamp between 30-70% of video duration (same as Python tasks)
	// This avoids boring intros (first 30%) and credits (last 30%)
	rand.Seed(time.Now().UnixNano())
	startPercent := 0.3 + rand.Float64()*0.4 // Random between 0.3 and 0.7
	randomStartTime := int(float64(duration) * startPercent)
	
	// Ensure minimum 30 seconds
	if randomStartTime < 30 {
		randomStartTime = 30
	}
	
	log.Printf("🎯 Generated random preview timestamp: %ds (%.1f%% of %ds duration)", 
		randomStartTime, startPercent*100, duration)
	
	return randomStartTime
}

// getVideoDurationSeconds gets video duration in seconds using ffprobe
func (s *ThumbnailService) getVideoDurationSeconds(videoPath string) int {
	cmd := exec.Command("ffprobe",
		"-v", "quiet",
		"-show_entries", "format=duration",
		"-of", "csv=p=0",
		videoPath)
	
	output, err := cmd.Output()
	if err != nil {
		log.Printf("⚠️ ffprobe failed for %s: %v", videoPath, err)
		return 0
	}

	durationStr := strings.TrimSpace(string(output))
	if durationFloat, err := strconv.ParseFloat(durationStr, 64); err == nil {
		return int(durationFloat)
	}

	log.Printf("⚠️ Could not parse duration '%s' for %s", durationStr, videoPath)
	return 0
}
