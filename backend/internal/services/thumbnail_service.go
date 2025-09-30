package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
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
	// Create filename for thumbnail
	filename := fmt.Sprintf("thumb_%d.jpg", mediaID)
	thumbnailPath := filepath.Join(s.thumbnailPath, filename)
	
	// Check if thumbnail already exists
	if _, err := os.Stat(thumbnailPath); err == nil {
		return thumbnailPath, nil
	}
	
	// Use FFmpeg to generate thumbnail at 10% of video duration
	cmd := exec.Command("ffmpeg",
		"-i", videoPath,
		"-ss", "00:00:10", // Seek to 10 seconds
		"-vframes", "1",   // Extract 1 frame
		"-q:v", "2",       // High quality
		"-y",              // Overwrite output file
		thumbnailPath,
	)
	
	err := cmd.Run()
	if err != nil {
		return "", fmt.Errorf("failed to generate thumbnail: %v", err)
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
	// Create filename for preview clip
	filename := fmt.Sprintf("preview_%d.mp4", mediaID)
	previewPath := filepath.Join(s.thumbnailPath, filename)
	
	// Check if preview clip already exists
	if _, err := os.Stat(previewPath); err == nil {
		return previewPath, nil
	}
	
	// Use FFmpeg to generate 10-second preview clip starting at 30 seconds
	cmd := exec.Command("ffmpeg",
		"-i", videoPath,
		"-ss", "00:00:30",    // Start at 30 seconds
		"-t", "00:00:10",     // Duration of 10 seconds
		"-vf", "scale=640:360", // Scale to 360p for faster loading
		"-c:v", "libx264",    // H.264 codec
		"-preset", "fast",    // Fast encoding
		"-crf", "28",         // Balanced quality/size
		"-c:a", "aac",        // AAC audio
		"-b:a", "64k",        // Low audio bitrate
		"-y",                 // Overwrite output file
		previewPath,
	)
	
	err := cmd.Run()
	if err != nil {
		return "", fmt.Errorf("failed to generate preview clip: %v", err)
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
