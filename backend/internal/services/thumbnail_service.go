package services

import (
	"fmt"
	"math/rand"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Scene represents a potential preview scene with engagement metrics
type Scene struct {
	StartTime    int     `json:"start_time"`
	Duration     int     `json:"duration"`
	Score        float64 `json:"score"`
	AudioLevel   float64 `json:"audio_level"`
	MotionLevel  float64 `json:"motion_level"`
	SceneChange  bool    `json:"scene_change"`
	DialoguePresent bool `json:"dialogue_present"`
}

// FFProbeOutput represents the structure of ffprobe JSON output
type FFProbeOutput struct {
	Streams []struct {
		CodecType string `json:"codec_type"`
		Duration  string `json:"duration"`
	} `json:"streams"`
	Format struct {
		Duration string `json:"duration"`
	} `json:"format"`
}

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
	// Create filename for thumbnail
	filename := fmt.Sprintf("thumb_%d.jpg", mediaID)
	thumbnailPath := filepath.Join(s.thumbnailPath, filename)
	
	// Check if thumbnail already exists
	if _, err := os.Stat(thumbnailPath); err == nil {
		return thumbnailPath, nil
	}
	
	// Get video duration first to calculate random timestamp within first 50%
	duration, err := s.getVideoDuration(videoPath)
	if err != nil {
		// Fallback to fixed timestamp if duration detection fails
		duration = 3600 // Assume 1 hour
	}
	
	// Calculate random timestamp within first 50% of video duration
	// Avoid first 30 seconds (intro/credits) and use first 50% only
	startOffset := 30 // Skip first 30 seconds
	maxTimestamp := duration / 2 // First 50% of video
	if maxTimestamp <= startOffset {
		maxTimestamp = startOffset + 60 // Ensure at least 1 minute range
	}
	
	// Generate random timestamp between startOffset and maxTimestamp
	randomTimestamp := startOffset + (int(time.Now().UnixNano()) % (maxTimestamp - startOffset))
	
	// Convert to time format
	timestampStr := s.secondsToTimeFormat(randomTimestamp)
	
	// Use FFmpeg to generate high quality thumbnail at random timestamp
	cmd := exec.Command("ffmpeg",
		"-i", videoPath,
		"-ss", timestampStr,   // Seek to random timestamp in first 50%
		"-vframes", "1",       // Extract 1 frame
		"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2", // Full HD 1080p thumbnail with aspect ratio
		"-q:v", "2",           // High quality
		"-y",                  // Overwrite output file
		thumbnailPath,
	)
	
	err = cmd.Run()
	if err != nil {
		return "", fmt.Errorf("failed to generate thumbnail: %v", err)
	}
	
	return thumbnailPath, nil
}

// ServeThumbnail serves a thumbnail file
func (s *ThumbnailService) ServeThumbnail(mediaID uint) (string, error) {
	filename := fmt.Sprintf("thumb_%d.jpg", mediaID)
	thumbnailPath := filepath.Join(s.thumbnailPath, filename)
	
	// Check if thumbnail exists, if not try to generate it
	if _, err := os.Stat(thumbnailPath); err != nil {
		// Try to find the media and generate thumbnail
		return "", fmt.Errorf("thumbnail not found for media ID %d - use POST /thumbnails/%d to generate", mediaID, mediaID)
	}
	
	return thumbnailPath, nil
}

// ServePreviewClip serves a preview clip file
func (s *ThumbnailService) ServePreviewClip(mediaID uint) (string, error) {
	filename := fmt.Sprintf("preview_%d.mp4", mediaID)
	previewPath := filepath.Join(s.thumbnailPath, filename)
	
	// Check if preview exists
	if _, err := os.Stat(previewPath); err != nil {
		return "", fmt.Errorf("preview clip not found for media ID %d - files need to be generated via Celery tasks", mediaID)
	}
	
	return previewPath, nil
}

// ServePreview serves a preview file (alias for ServePreviewClip)
func (s *ThumbnailService) ServePreview(mediaID uint) (string, error) {
	return s.ServePreviewClip(mediaID)
}

func (s *ThumbnailService) GeneratePreviewClip(videoPath string, mediaID uint) (string, error) {
	// Skip preview clip generation for problematic files to prevent hanging
	if strings.Contains(videoPath, "$RECYCLE.BIN") || strings.HasPrefix(filepath.Base(videoPath), "$") {
		return "", fmt.Errorf("skipping preview generation for system/recycle bin file")
	}
	
	// Create filename for preview clip
	filename := fmt.Sprintf("preview_%d.mp4", mediaID)
	previewPath := filepath.Join(s.thumbnailPath, filename)
	
	// Check if preview clip already exists
	if _, err := os.Stat(previewPath); err == nil {
		return previewPath, nil
	}
	
	// Get video duration first to determine optimal start time
	duration, err := s.getVideoDuration(videoPath)
	if err != nil {
		// Fallback to default start time if duration detection fails
		duration = 3600 // Assume 1 hour
	}
	
	// Calculate intelligent start time (avoid intro/credits)
	startTime := 60 // Default 1 minute
	if duration > 600 { // If video is longer than 10 minutes
		startTime = int(float64(duration) * 0.15) // Start at 15% into the video
		if startTime < 60 {
			startTime = 60
		}
		if startTime > 300 { // Don't start later than 5 minutes
			startTime = 300
		}
	}
	
	// High quality HD preview generation with audio
	cmd := exec.Command("ffmpeg",
		"-i", videoPath,
		"-ss", fmt.Sprintf("%d", startTime), // Intelligent start time
		"-t", "30",                          // 30-second clip
		"-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2", // HD with aspect ratio preservation
		"-c:v", "libx264",                   // H.264 codec
		"-preset", "faster",                 // Good balance of speed and quality
		"-crf", "23",                        // High quality (lower CRF = better quality)
		"-pix_fmt", "yuv420p",              // Better compatibility
		"-c:a", "aac",                      // AAC audio codec
		"-b:a", "128k",                     // Good audio bitrate
		"-movflags", "+faststart",          // Better streaming
		"-y",                               // Overwrite output file
		previewPath,
	)
	
	// Set timeout to prevent hanging (increased for HD processing)
	done := make(chan error, 1)
	go func() {
		done <- cmd.Run()
	}()
	
	select {
	case err := <-done:
		if err != nil {
			// Try fallback with simpler settings if HD generation fails
			fallbackCmd := exec.Command("ffmpeg",
				"-i", videoPath,
				"-ss", "60",
				"-t", "30",
				"-vf", "scale=1280:720",
				"-c:v", "libx264",
				"-preset", "fast",
				"-crf", "25",
				"-c:a", "aac",
				"-b:a", "96k",
				"-y",
				previewPath,
			)
			
			fallbackDone := make(chan error, 1)
			go func() {
				fallbackDone <- fallbackCmd.Run()
			}()
			
			select {
			case fallbackErr := <-fallbackDone:
				if fallbackErr != nil {
					return "", fmt.Errorf("failed to generate preview clip (both HD and fallback): %v", fallbackErr)
				}
			case <-time.After(30 * time.Second):
				fallbackCmd.Process.Kill()
				return "", fmt.Errorf("fallback preview generation timed out")
			}
		}
	case <-time.After(60 * time.Second): // Longer timeout for HD processing
		cmd.Process.Kill()
		return "", fmt.Errorf("HD preview generation timed out")
	}
	
	return previewPath, nil
}

func (s *ThumbnailService) GeneratePreview(videoPath string, mediaID uint) (string, error) {
	// Create filename for preview
	filename := fmt.Sprintf("preview_%d.mp4", mediaID)
	previewPath := filepath.Join(s.thumbnailPath, filename)
	
	// Check if preview already exists
	if _, err := os.Stat(previewPath); err == nil {
		return previewPath, nil
	}
	
	// Use FFmpeg to generate 30-second preview starting at 10% of video
	cmd := exec.Command("ffmpeg",
		"-i", videoPath,
		"-ss", "00:01:00",    // Start at 1 minute
		"-t", "00:00:30",     // Duration of 30 seconds
		"-vf", "scale=640:360", // Scale to smaller resolution
		"-c:v", "libx264",    // Video codec
		"-c:a", "aac",        // Audio codec
		"-b:v", "500k",       // Video bitrate
		"-y",                 // Overwrite output file
		previewPath,
	)
	
	err := cmd.Run()
	if err != nil {
		return "", fmt.Errorf("failed to generate preview: %v", err)
	}
	
	return previewPath, nil
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
	
	// For simplicity, we'll extract basic info manually
	// In a production app, you'd parse the JSON output
	metadata := map[string]interface{}{
		"raw_output": string(output),
	}
	
	return metadata, nil
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
	
	return nil
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

// secondsToTimeFormat converts seconds to HH:MM:SS format
func (s *ThumbnailService) secondsToTimeFormat(seconds int) string {
	hours := seconds / 3600
	minutes := (seconds % 3600) / 60
	secs := seconds % 60
	return fmt.Sprintf("%02d:%02d:%02d", hours, minutes, secs)
}

// findEngagingScenes uses FFmpeg to analyze video and find engaging scenes
func (s *ThumbnailService) findEngagingScenes(videoPath string, duration int) ([]Scene, error) {
	var scenes []Scene
	
	// Analyze video in segments to find engaging parts
	segmentDuration := 60 // Analyze in 60-second segments
	numSegments := (duration + segmentDuration - 1) / segmentDuration
	
	for i := 0; i < numSegments; i++ {
		startTime := i * segmentDuration
		endTime := startTime + segmentDuration
		if endTime > duration {
			endTime = duration
		}
		
		// Analyze this segment for engagement metrics
		scene, err := s.analyzeSegment(videoPath, startTime, endTime-startTime)
		if err != nil {
			continue // Skip failed segments
		}
		
		scenes = append(scenes, scene)
	}
	
	// Sort scenes by engagement score
	sort.Slice(scenes, func(i, j int) bool {
		return scenes[i].Score > scenes[j].Score
	})
	
	return scenes, nil
}

// analyzeSegment analyzes a video segment for engagement metrics
func (s *ThumbnailService) analyzeSegment(videoPath string, startTime, duration int) (Scene, error) {
	scene := Scene{
		StartTime: startTime,
		Duration:  duration,
	}
	
	// Use FFmpeg to analyze audio levels and motion
	startTimeStr := s.secondsToTimeFormat(startTime)
	durationStr := s.secondsToTimeFormat(duration)
	
	// Analyze audio levels (dialogue detection)
	audioCmd := exec.Command("ffmpeg",
		"-i", videoPath,
		"-ss", startTimeStr,
		"-t", durationStr,
		"-af", "volumedetect",
		"-f", "null",
		"-y", "/dev/null",
	)
	
	audioOutput, err := audioCmd.CombinedOutput()
	if err == nil {
		// Parse audio level from output
		audioStr := string(audioOutput)
		if strings.Contains(audioStr, "mean_volume:") {
			// Extract mean volume (higher values indicate more dialogue/action)
			if idx := strings.Index(audioStr, "mean_volume: "); idx != -1 {
				volumeStr := strings.Fields(audioStr[idx+13:])[0]
				if volume, err := strconv.ParseFloat(volumeStr, 64); err == nil {
					// Convert dB to engagement score (higher is better)
					scene.AudioLevel = -volume // Invert since dB is negative
					scene.DialoguePresent = scene.AudioLevel > 20 // Threshold for dialogue
				}
			}
		}
	}
	
	// Analyze motion/scene changes using frame difference
	motionCmd := exec.Command("ffmpeg",
		"-i", videoPath,
		"-ss", startTimeStr,
		"-t", durationStr,
		"-vf", "select='gt(scene,0.3)',showinfo",
		"-f", "null",
		"-y", "/dev/null",
	)
	
	motionOutput, err := motionCmd.CombinedOutput()
	if err == nil {
		// Count scene changes (more changes = more engaging)
		sceneChanges := strings.Count(string(motionOutput), "scene:")
		scene.MotionLevel = float64(sceneChanges) / float64(duration) * 60 // Changes per minute
		scene.SceneChange = sceneChanges > 2 // Threshold for significant scene changes
	}
	
	// Calculate engagement score based on multiple factors
	scene.Score = s.calculateEngagementScore(scene)
	
	return scene, nil
}

// calculateEngagementScore computes an engagement score for a scene
func (s *ThumbnailService) calculateEngagementScore(scene Scene) float64 {
	score := 0.0
	
	// Audio engagement (dialogue, music, effects)
	if scene.DialoguePresent {
		score += 30.0 // Dialogue is highly engaging
	}
	score += scene.AudioLevel * 0.5 // General audio activity
	
	// Motion engagement (action, scene changes)
	score += scene.MotionLevel * 10.0 // Scene changes indicate action
	if scene.SceneChange {
		score += 20.0 // Significant scene changes are engaging
	}
	
	// Avoid very beginning and end of movie (credits, slow starts)
	if scene.StartTime < 300 { // First 5 minutes
		score *= 0.7
	}
	if scene.StartTime > 7200 { // After 2 hours (likely ending)
		score *= 0.8
	}
	
	// Prefer middle sections (typically most engaging)
	if scene.StartTime > 900 && scene.StartTime < 5400 { // 15min to 90min
		score *= 1.2
	}
	
	return score
}

// generateFallbackScenes creates fallback scenes when analysis fails
func (s *ThumbnailService) generateFallbackScenes(duration int) []Scene {
	var scenes []Scene
	
	// Generate multiple candidate scenes from different parts of the movie
	candidates := []struct {
		start    float64 // Percentage of movie duration
		priority float64 // Priority score
		name     string  // Description
	}{
		{0.25, 80.0, "First quarter (setup complete)"},
		{0.35, 90.0, "Early middle (rising action)"},
		{0.45, 95.0, "Mid-point (peak engagement)"},
		{0.55, 85.0, "Late middle (climax approach)"},
		{0.65, 75.0, "Third quarter (climax)"},
		{0.15, 60.0, "Early setup (fallback)"},
		{0.75, 70.0, "Resolution (fallback)"},
	}
	
	rand.Seed(time.Now().UnixNano())
	
	for _, candidate := range candidates {
		startTime := int(float64(duration) * candidate.start)
		
		// Ensure we have enough time for a 30-second clip
		if startTime+30 > duration {
			startTime = duration - 30
		}
		if startTime < 0 {
			startTime = 0
		}
		
		// Add some randomness to avoid predictable clips
		randomOffset := rand.Intn(120) - 60 // ±60 seconds
		startTime += randomOffset
		if startTime < 0 {
			startTime = 0
		}
		if startTime+30 > duration {
			startTime = duration - 30
		}
		
		scene := Scene{
			StartTime:       startTime,
			Duration:        30,
			Score:           candidate.priority + rand.Float64()*10, // Add randomness
			AudioLevel:      50.0,                                   // Assume moderate audio
			MotionLevel:     3.0,                                    // Assume moderate motion
			SceneChange:     true,                                   // Assume scene changes
			DialoguePresent: true,                                   // Assume dialogue
		}
		
		scenes = append(scenes, scene)
	}
	
	// Sort by score
	sort.Slice(scenes, func(i, j int) bool {
		return scenes[i].Score > scenes[j].Score
	})
	
	return scenes
}

// selectBestScene chooses the most engaging scene from candidates
func (s *ThumbnailService) selectBestScene(scenes []Scene, duration int) Scene {
	if len(scenes) == 0 {
		// Ultimate fallback: middle of the movie
		startTime := duration / 3 // Start at 1/3 point
		return Scene{
			StartTime:       startTime,
			Duration:        30,
			Score:           50.0,
			AudioLevel:      40.0,
			MotionLevel:     2.0,
			SceneChange:     true,
			DialoguePresent: true,
		}
	}
	
	// Return the highest-scoring scene
	bestScene := scenes[0]
	
	// Ensure the scene has enough duration
	if bestScene.StartTime+30 > duration {
		bestScene.StartTime = duration - 30
		if bestScene.StartTime < 0 {
			bestScene.StartTime = 0
		}
	}
	
	return bestScene
}
