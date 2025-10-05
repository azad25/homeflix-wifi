package services

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type ThumbnailService struct {
	thumbnailPath string
}

func NewThumbnailService() *ThumbnailService {
	thumbnailPath := os.Getenv("THUMBNAIL_PATH")
	if thumbnailPath == "" {
		thumbnailPath = "./thumbnails"
	}
	
	// Create thumbnails directory if it doesn't exist
	os.MkdirAll(thumbnailPath, 0755)
	
	return &ThumbnailService{
		thumbnailPath: thumbnailPath,
	}
}

func (s *ThumbnailService) GenerateThumbnail(videoPath string, mediaID uint) (string, error) {
	// Create filename for HD thumbnail
	filename := fmt.Sprintf("thumb_%d.jpg", mediaID)
	thumbnailPath := filepath.Join(s.thumbnailPath, filename)
	
	// Check if thumbnail already exists
	if _, err := os.Stat(thumbnailPath); err == nil {
		return thumbnailPath, nil
	}
	
	// Get video duration to calculate first half
	duration, err := s.getVideoDuration(videoPath)
	if err != nil {
		log.Printf("Failed to get video duration for media %d: %v", mediaID, err)
		duration = 300 // Default to 5 minutes if duration can't be determined
	}
	
	// Calculate random time within first half of video
	firstHalf := duration / 2
	if firstHalf < 10 {
		firstHalf = 10 // Minimum 10 seconds
	}
	
	// Generate random time between 10 seconds and first half
	rand.Seed(time.Now().UnixNano())
	randomTime := rand.Intn(int(firstHalf-10)) + 10
	
	// Convert to time format
	timeStr := s.secondsToTimeString(randomTime)
	
	log.Printf("Generating HD thumbnail for media %d at %s (first half: %ds)", mediaID, timeStr, firstHalf)
	
	// Use FFmpeg to generate HD thumbnail from first half of video
	cmd := exec.Command("ffmpeg",
		"-i", videoPath,
		"-ss", timeStr,           // Seek to random time in first half
		"-vframes", "1",          // Extract 1 frame
		"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2", // HD scaling with padding
		"-q:v", "1",              // Highest quality (1-31, lower is better)
		"-pix_fmt", "yuvj420p",   // Better color format
		"-y",                     // Overwrite output file
		thumbnailPath,
	)
	
	err = cmd.Run()
	if err != nil {
		log.Printf("FFmpeg HD thumbnail generation failed for media %d: %v", mediaID, err)
		log.Printf("Attempting alternative thumbnail generation methods...")
		
		// Try alternative methods when FFmpeg fails
		return s.generateThumbnailFallback(videoPath, mediaID, thumbnailPath)
	}
	
	log.Printf("Successfully generated HD thumbnail for media %d", mediaID)
	return thumbnailPath, nil
}

// generateThumbnailFallback tries alternative methods when FFmpeg fails
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
	// Try ImageMagick convert with HD resolution (if available)
	cmd := exec.Command("convert", videoPath+"[10]", 
		"-resize", "1920x1080^", 
		"-gravity", "center", 
		"-extent", "1920x1080", 
		"-quality", "95",
		thumbnailPath)
	return cmd.Run()
}

// createPlaceholderThumbnail creates a simple placeholder image
func (s *ThumbnailService) createPlaceholderThumbnail(mediaID uint, thumbnailPath string) (string, error) {
	// Create a simple placeholder using ImageMagick or return error
	cmd := exec.Command("convert", "-size", "1920x1080", "xc:black", "-fill", "white", "-gravity", "center", 
		"-pointsize", "72", "-annotate", "+0+0", fmt.Sprintf("Media %d\nThumbnail\nUnavailable", mediaID), thumbnailPath)
	
	if err := cmd.Run(); err != nil {
		// If ImageMagick is not available, return error
		return "", fmt.Errorf("all thumbnail generation methods failed for media %d", mediaID)
	}
	
	return thumbnailPath, nil
}

// ServeThumbnail serves a thumbnail file
func (s *ThumbnailService) ServeThumbnail(mediaID uint) (string, error) {
	filename := fmt.Sprintf("thumb_%d.jpg", mediaID)
	thumbnailPath := filepath.Join(s.thumbnailPath, filename)
	
	// Check if thumbnail exists
	if _, err := os.Stat(thumbnailPath); err != nil {
		return "", fmt.Errorf("thumbnail not found for media ID %d", mediaID)
	}
	
	return thumbnailPath, nil
}

// ServePreviewClip serves a preview clip file
func (s *ThumbnailService) ServePreviewClip(mediaID uint) (string, error) {
	filename := fmt.Sprintf("preview_%d.mp4", mediaID)
	previewPath := filepath.Join(s.thumbnailPath, filename)
	
	// Check if preview exists
	if _, err := os.Stat(previewPath); err != nil {
		return "", fmt.Errorf("preview clip not found for media ID %d", mediaID)
	}
	
	return previewPath, nil
}

// ServePreview serves a preview file (alias for ServePreviewClip)
func (s *ThumbnailService) ServePreview(mediaID uint) (string, error) {
	return s.ServePreviewClip(mediaID)
}

func (s *ThumbnailService) GeneratePreviewClip(videoPath string, mediaID uint) (string, error) {
	// Create filename for HD preview clip
	filename := fmt.Sprintf("preview_%d.mp4", mediaID)
	previewPath := filepath.Join(s.thumbnailPath, filename)
	
	// Check if preview clip already exists
	if _, err := os.Stat(previewPath); err == nil {
		return previewPath, nil
	}
	
	// Get video duration to calculate first half
	duration, err := s.getVideoDuration(videoPath)
	if err != nil {
		log.Printf("Failed to get video duration for media %d: %v", mediaID, err)
		duration = 300 // Default to 5 minutes if duration can't be determined
	}
	
	// Calculate first half duration
	firstHalf := duration / 2
	if firstHalf < 30 {
		firstHalf = 30 // Minimum 30 seconds for meaningful preview
	}
	
	// Generate random start time within first half (leave 15s buffer for clip duration)
	rand.Seed(time.Now().UnixNano())
	maxStartTime := int(firstHalf) - 15
	if maxStartTime < 10 {
		maxStartTime = 10
	}
	
	randomStartTime := rand.Intn(maxStartTime-10) + 10
	startTimeStr := s.secondsToTimeString(randomStartTime)
	
	log.Printf("Generating 15s HD preview clip for media %d starting at %s (first half: %ds)", mediaID, startTimeStr, firstHalf)
	
	// Use FFmpeg to generate 15-second HD preview clip from first half
	cmd := exec.Command("ffmpeg",
		"-i", videoPath,
		"-ss", startTimeStr,      // Start at random time in first half
		"-t", "00:00:15",         // Duration of 15 seconds
		"-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2", // HD 720p scaling
		"-c:v", "libx264",        // H.264 codec
		"-preset", "medium",      // Balanced encoding speed/quality
		"-crf", "23",             // High quality (18-28 range, lower is better)
		"-c:a", "aac",            // AAC audio codec
		"-b:a", "128k",           // Good audio bitrate
		"-movflags", "+faststart", // Optimize for web streaming
		"-pix_fmt", "yuv420p",    // Ensure compatibility
		"-y",                     // Overwrite output file
		previewPath,
	)
	
	err = cmd.Run()
	if err != nil {
		log.Printf("Failed to generate HD preview clip for media %d: %v", mediaID, err)
		return "", fmt.Errorf("failed to generate HD preview clip: %v", err)
	}
	
	log.Printf("Successfully generated 15s HD preview clip for media %d", mediaID)
	return previewPath, nil
}

func (s *ThumbnailService) GeneratePreview(videoPath string, mediaID uint) (string, error) {
	// Use the same logic as GeneratePreviewClip for consistency
	return s.GeneratePreviewClip(videoPath, mediaID)
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

func (s *ThumbnailService) GetThumbnailPath(mediaID uint) string {
	filename := fmt.Sprintf("thumb_%d.jpg", mediaID)
	return filepath.Join(s.thumbnailPath, filename)
}

func (s *ThumbnailService) GetPreviewPath(mediaID uint) string {
	filename := fmt.Sprintf("preview_%d.mp4", mediaID)
	return filepath.Join(s.thumbnailPath, filename)
}

func (s *ThumbnailService) ThumbnailExists(mediaID uint) bool {
	thumbnailPath := s.GetThumbnailPath(mediaID)
	_, err := os.Stat(thumbnailPath)
	return err == nil
}

func (s *ThumbnailService) PreviewExists(mediaID uint) bool {
	previewPath := s.GetPreviewPath(mediaID)
	_, err := os.Stat(previewPath)
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
			"-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2",
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
		return s.GenerateThumbnail(videoPath, mediaID)
	}
	
	return thumbnailPath, nil
}

func (s *ThumbnailService) CleanupThumbnails(mediaID uint) error {
	thumbnailPath := s.GetThumbnailPath(mediaID)
	previewPath := s.GetPreviewPath(mediaID)
	
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
		"high": {"1280:720", "3M", "25", "_720p"},
		"medium": {"854:480", "1.5M", "28", "_480p"},
		"low": {"640:360", "800k", "32", "_360p"},
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
		timestamp := (firstHalf / count) * i + 10
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

// Helper function for max
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}