package services

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type OptimizedStreamService struct {
	chunkSize    int64
	alacService  *ALACAudioService // Reference to ALAC service
}

func NewOptimizedStreamService(cacheSize int, chunkSize int) *OptimizedStreamService {
	service := &OptimizedStreamService{
		chunkSize: int64(chunkSize),
	}
	
	// Set minimum chunk size
	if service.chunkSize < 1024*1024 {
		service.chunkSize = 1024 * 1024 // 1MB minimum
	}
	
	return service
}

// SetALACService sets the ALAC service for audio streaming integration
func (s *OptimizedStreamService) SetALACService(alacService *ALACAudioService) {
	s.alacService = alacService
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
	
	// Set essential headers
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	
	// Handle range requests
	rangeHeader := r.Header.Get("Range")
	if rangeHeader == "" {
		// No range request, serve full file
		w.Header().Set("Content-Length", strconv.FormatInt(fileSize, 10))
		w.WriteHeader(http.StatusOK)
		
		// Stream the entire file
		_, err = io.Copy(w, file)
		return err
	}

	// Parse range header
	start, end, err := s.parseRangeHeader(rangeHeader, fileSize)
	if err != nil {
		w.Header().Set("Content-Range", fmt.Sprintf("bytes */%d", fileSize))
		w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
		return err
	}

	contentLength := end - start + 1

	// Set partial content headers
	w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, fileSize))
	w.Header().Set("Content-Length", strconv.FormatInt(contentLength, 10))
	w.WriteHeader(http.StatusPartialContent)

	// Seek to start position
	_, err = file.Seek(start, 0)
	if err != nil {
		return err
	}

	// Stream the requested range
	_, err = io.CopyN(w, file, contentLength)
	return err
}

// StreamPreview streams preview clips with optimized settings
func (s *OptimizedStreamService) StreamPreview(w http.ResponseWriter, r *http.Request, filePath string) error {
	// Use the same streaming logic as regular video
	return s.StreamVideo(w, r, filePath)
}

func (s *OptimizedStreamService) parseRangeHeader(rangeHeader string, fileSize int64) (int64, int64, error) {
	// Remove "bytes=" prefix
	rangeSpec := strings.TrimPrefix(rangeHeader, "bytes=")
	
	// Split on comma to handle multiple ranges (we'll just use the first one)
	ranges := strings.Split(rangeSpec, ",")
	if len(ranges) == 0 {
		return 0, 0, fmt.Errorf("invalid range header")
	}
	
	// Parse the first range
	rangeParts := strings.Split(strings.TrimSpace(ranges[0]), "-")
	if len(rangeParts) != 2 {
		return 0, 0, fmt.Errorf("invalid range format")
	}

	var start, end int64
	var err error
	
	// Parse start
	if rangeParts[0] != "" {
		start, err = strconv.ParseInt(rangeParts[0], 10, 64)
		if err != nil || start < 0 {
			return 0, 0, fmt.Errorf("invalid range start")
		}
	} else {
		start = 0
	}

	// Parse end
	if rangeParts[1] != "" {
		end, err = strconv.ParseInt(rangeParts[1], 10, 64)
		if err != nil || end < 0 {
			return 0, 0, fmt.Errorf("invalid range end")
		}
	} else {
		end = fileSize - 1
	}

	// Validate range
	if start >= fileSize {
		return 0, 0, fmt.Errorf("range start beyond file size")
	}
	
	if end >= fileSize {
		end = fileSize - 1
	}
	
	if start > end {
		return 0, 0, fmt.Errorf("invalid range: start > end")
	}

	return start, end, nil
}

// StreamVideoWithALAC streams video with ALAC audio automatically
func (s *OptimizedStreamService) StreamVideoWithALAC(w http.ResponseWriter, r *http.Request, filePath string, mediaID uint) error {
	// Check if ALAC audio is available
	if s.alacService != nil {
		alacPath := s.alacService.GetALACForStreaming(int(mediaID))
		if alacPath != "" {
			// Stream the video with ALAC audio
			return s.streamVideoWithALACAudio(w, r, filePath, alacPath, mediaID)
		}
	}
	
	// Fallback to regular video streaming
	return s.StreamVideo(w, r, filePath)
}

// streamVideoWithALACAudio handles streaming video with ALAC audio
func (s *OptimizedStreamService) streamVideoWithALACAudio(w http.ResponseWriter, r *http.Request, videoPath, alacPath string, mediaID uint) error {
	// For now, we'll stream the video normally and provide ALAC audio info in headers
	// In a full implementation, you might want to create a combined stream or use HLS/DASH
	
	// Add ALAC audio information to headers
	w.Header().Set("X-ALAC-Audio-Available", "true")
	w.Header().Set("X-ALAC-Audio-Path", fmt.Sprintf("/api/media/%d/alac-audio", mediaID))
	w.Header().Set("X-Audio-Enhanced", "true")
	w.Header().Set("X-Audio-Quality", "lossless")
	
	// Stream the video normally
	return s.StreamVideo(w, r, videoPath)
}

// StreamALACAudio streams ALAC audio files
func (s *OptimizedStreamService) StreamALACAudio(w http.ResponseWriter, r *http.Request, alacPath string) error {
	file, err := os.Open(alacPath)
	if err != nil {
		return err
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return err
	}

	fileSize := fileInfo.Size()
	
	// Set ALAC-specific headers
	w.Header().Set("Content-Type", "audio/mp4")
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Cache-Control", "public, max-age=7200") // Longer cache for audio
	w.Header().Set("X-Audio-Codec", "ALAC")
	w.Header().Set("X-Audio-Quality", "lossless")
	w.Header().Set("X-Audio-Enhanced", "true")

	// Handle range requests for audio
	rangeHeader := r.Header.Get("Range")
	if rangeHeader == "" {
		// No range request, serve full audio file
		w.Header().Set("Content-Length", strconv.FormatInt(fileSize, 10))
		w.WriteHeader(http.StatusOK)
		
		// Stream the entire audio file
		_, err = io.Copy(w, file)
		return err
	}

	// Parse range header for audio streaming
	start, end, err := s.parseRangeHeader(rangeHeader, fileSize)
	if err != nil {
		w.Header().Set("Content-Range", fmt.Sprintf("bytes */%d", fileSize))
		w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
		return err
	}

	contentLength := end - start + 1

	// Set partial content headers
	w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, fileSize))
	w.Header().Set("Content-Length", strconv.FormatInt(contentLength, 10))
	w.WriteHeader(http.StatusPartialContent)

	// Seek to start position
	_, err = file.Seek(start, 0)
	if err != nil {
		return err
	}

	// Stream the requested audio range
	_, err = io.CopyN(w, file, contentLength)
	return err
}

// CreateCombinedStream creates a combined video+ALAC stream for simultaneous playback
func (s *OptimizedStreamService) CreateCombinedStream(w http.ResponseWriter, r *http.Request, videoPath string, mediaID uint) error {
	if s.alacService == nil {
		return s.StreamVideo(w, r, videoPath)
	}

	alacPath := s.alacService.GetALACForStreaming(int(mediaID))
	if alacPath == "" {
		return s.StreamVideo(w, r, videoPath)
	}

	// Create a temporary combined file path
	tempDir := "./temp_streams"
	os.MkdirAll(tempDir, 0755)
	
	combinedPath := filepath.Join(tempDir, fmt.Sprintf("combined_%d.mp4", mediaID))
	
	// Check if combined stream already exists
	if _, err := os.Stat(combinedPath); err == nil {
		// Stream existing combined file
		return s.StreamVideo(w, r, combinedPath)
	}

	// Create combined stream in background and stream original for now
	go func() {
		if err := s.alacService.StreamVideoWithALAC(videoPath, int(mediaID), combinedPath); err != nil {
			fmt.Printf("Failed to create combined stream: %v\n", err)
		}
	}()

	// For now, stream video with ALAC headers
	return s.streamVideoWithALACAudio(w, r, videoPath, alacPath, mediaID)
}

func (s *OptimizedStreamService) getContentType(filePath string) string {
	ext := strings.ToLower(filepath.Ext(filePath))
	
	switch ext {
	case ".mp4", ".m4v":
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
	case ".mpg", ".mpeg":
		return "video/mpeg"
	case ".3gp":
		return "video/3gpp"
	case ".ogv":
		return "video/ogg"
	case ".ts", ".mts", ".m2ts":
		return "video/mp2t"
	default:
		return "video/mp4" // Default fallback
	}
}

// GetVideoInfo returns basic video file information
func (s *OptimizedStreamService) GetVideoInfo(filePath string) (map[string]interface{}, error) {
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return nil, err
	}

	info := map[string]interface{}{
		"size":       fileInfo.Size(),
		"modified":   fileInfo.ModTime(),
		"name":       fileInfo.Name(),
		"chunk_size": s.chunkSize,
	}

	return info, nil
}