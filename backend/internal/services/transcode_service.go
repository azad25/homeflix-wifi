package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// TranscodeService handles on-the-fly video transcoding
type TranscodeService struct {
	hwAccel       string
	activeStreams map[string]*TranscodeSession
	mutex         sync.RWMutex
}

type TranscodeSession struct {
	filePath     string
	cmd          *exec.Cmd
	cancel       context.CancelFunc
	startTime    time.Time
	bytesWritten int64
}

type VideoInfo struct {
	CodecName  string `json:"codec_name"`
	CodecType  string `json:"codec_type"`
	Width      int    `json:"width"`
	Height     int    `json:"height"`
	Duration   string `json:"duration"`
}

type FFProbeOutput struct {
	Streams []VideoInfo `json:"streams"`
}

func NewTranscodeService(hwAccel string) *TranscodeService {
	return &TranscodeService{
		hwAccel:       hwAccel,
		activeStreams: make(map[string]*TranscodeSession),
	}
}

// DetectCodec detects video codec using ffprobe
func (s *TranscodeService) DetectCodec(filePath string) (string, error) {
	cmd := exec.Command("ffprobe",
		"-v", "quiet",
		"-print_format", "json",
		"-show_streams",
		"-select_streams", "v:0",
		filePath,
	)

	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("ffprobe failed: %v", err)
	}

	var probe FFProbeOutput
	if err := json.Unmarshal(output, &probe); err != nil {
		return "", fmt.Errorf("failed to parse ffprobe output: %v", err)
	}

	if len(probe.Streams) == 0 {
		return "", fmt.Errorf("no video streams found")
	}

	codec := probe.Streams[0].CodecName
	log.Printf("🔍 Detected codec: %s for %s", codec, filePath)
	return codec, nil
}

// StreamTranscoded streams video with on-the-fly transcoding
func (s *TranscodeService) StreamTranscoded(w http.ResponseWriter, r *http.Request, filePath string) error {
	// Detect codec
	codec, err := s.DetectCodec(filePath)
	if err != nil {
		return fmt.Errorf("codec detection failed: %v", err)
	}

	// Determine if we need transcoding or just remuxing
	needsTranscode := s.needsTranscoding(codec)

	sessionKey := fmt.Sprintf("%s_%d", filePath, time.Now().Unix())
	ctx, cancel := context.WithCancel(r.Context())

	session := &TranscodeSession{
		filePath:  filePath,
		cancel:    cancel,
		startTime: time.Now(),
	}

	s.mutex.Lock()
	s.activeStreams[sessionKey] = session
	s.mutex.Unlock()

	defer func() {
		cancel()
		s.mutex.Lock()
		delete(s.activeStreams, sessionKey)
		s.mutex.Unlock()
		log.Printf("🛑 Transcoding session ended: %s", sessionKey)
	}()

	// Set headers for MP4 streaming
	w.Header().Set("Content-Type", "video/mp4")
	w.Header().Set("Accept-Ranges", "none") // Transcoding doesn't support range requests
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if needsTranscode {
		log.Printf("🎬 Starting TRANSCODE (HEVC→H.264) for: %s", filePath)
		return s.transcodeStream(ctx, w, filePath, session)
	} else {
		log.Printf("📦 Starting REMUX (MKV→MP4) for: %s", filePath)
		return s.remuxStream(ctx, w, filePath, session)
	}
}

// needsTranscoding checks if codec needs transcoding
func (s *TranscodeService) needsTranscoding(codec string) bool {
	// H.264 is browser-compatible, just needs remuxing
	// HEVC/VP9/AV1 need transcoding to H.264
	codec = strings.ToLower(codec)
	return codec == "hevc" || codec == "h265" || codec == "vp9" || codec == "av1"
}

// remuxStream remuxes MKV to MP4 without re-encoding (fast)
func (s *TranscodeService) remuxStream(ctx context.Context, w http.ResponseWriter, filePath string, session *TranscodeSession) error {
	args := []string{
		"-i", filePath,
		"-c:v", "copy",      // Copy video codec (no re-encoding)
		"-c:a", "aac",       // Convert audio to AAC if needed
		"-avoid_negative_ts", "make_zero", // Fix timestamp issues
		"-fflags", "+genpts", // Generate presentation timestamps
		"-movflags", "frag_keyframe+empty_moov+faststart+dash", // Enable streaming with DASH
		"-f", "mp4",         // Output format
		"-y",                // Overwrite output
		"pipe:1",            // Output to stdout
	}

	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	session.cmd = cmd

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to get stdout pipe: %v", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start ffmpeg: %v", err)
	}

	// Stream output to HTTP response
	flusher, canFlush := w.(http.Flusher)
	buffer := make([]byte, 256*1024) // 256KB buffer

	for {
		n, err := stdout.Read(buffer)
		if n > 0 {
			if _, writeErr := w.Write(buffer[:n]); writeErr != nil {
				cmd.Process.Kill()
				return writeErr
			}
			session.bytesWritten += int64(n)

			if canFlush {
				flusher.Flush()
			}
		}

		if err == io.EOF {
			break
		}
		if err != nil {
			cmd.Process.Kill()
			return err
		}

		// Check context cancellation
		select {
		case <-ctx.Done():
			cmd.Process.Kill()
			return ctx.Err()
		default:
		}
	}

	return cmd.Wait()
}

// transcodeStream transcodes video to H.264 (slower, higher CPU)
func (s *TranscodeService) transcodeStream(ctx context.Context, w http.ResponseWriter, filePath string, session *TranscodeSession) error {
	args := []string{
		"-i", filePath,
		"-c:v", "libx264",   // Transcode to H.264
		"-preset", "veryfast", // Fast encoding preset
		"-crf", "23",        // Quality (18-28, lower = better)
		"-profile:v", "high", // H.264 profile for better compatibility
		"-level", "4.1",     // H.264 level for web compatibility
		"-pix_fmt", "yuv420p", // Pixel format for web compatibility
		"-c:a", "aac",       // Audio to AAC
		"-b:a", "192k",      // Audio bitrate
		"-ar", "48000",      // Audio sample rate
		"-avoid_negative_ts", "make_zero", // Fix timestamp issues
		"-fflags", "+genpts", // Generate presentation timestamps
		"-movflags", "frag_keyframe+empty_moov+faststart+dash",
		"-f", "mp4",
		"-y",                // Overwrite output
		"pipe:1",
	}

	// Add hardware acceleration if available
	if s.hwAccel != "none" && s.hwAccel != "" {
		switch s.hwAccel {
		case "vaapi":
			args = append([]string{"-hwaccel", "vaapi", "-hwaccel_device", "/dev/dri/renderD128", "-hwaccel_output_format", "vaapi"}, args...)
			// Replace libx264 with VAAPI encoder
			for i, arg := range args {
				if arg == "libx264" {
					args[i] = "h264_vaapi"
				}
			}
		case "cuda":
			args = append([]string{"-hwaccel", "cuda", "-hwaccel_output_format", "cuda"}, args...)
			// Replace libx264 with hardware encoder
			for i, arg := range args {
				if arg == "libx264" {
					args[i] = "h264_nvenc"
					break
				}
			}
		case "qsv":
			args = append([]string{"-hwaccel", "qsv", "-hwaccel_output_format", "qsv"}, args...)
			for i, arg := range args {
				if arg == "libx264" {
					args[i] = "h264_qsv"
					break
				}
			}
		default:
			log.Printf("⚠️ Unknown hardware acceleration: %s, using software encoding", s.hwAccel)
		}
	}

	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	session.cmd = cmd

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to get stdout pipe: %v", err)
	}

	stderr, _ := cmd.StderrPipe()
	go func() {
		// Log ffmpeg errors with better formatting
		buf := make([]byte, 1024)
		for {
			n, err := stderr.Read(buf)
			if n > 0 {
				output := string(buf[:n])
				// Only log important messages, filter out progress spam
				if strings.Contains(output, "error") || strings.Contains(output, "Error") ||
					strings.Contains(output, "warning") || strings.Contains(output, "Warning") ||
					strings.Contains(output, "failed") || strings.Contains(output, "Failed") {
					log.Printf("🔧 FFmpeg: %s", strings.TrimSpace(output))
				}
			}
			if err != nil {
				break
			}
		}
	}()

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start ffmpeg: %v", err)
	}

	// Stream output to HTTP response
	flusher, canFlush := w.(http.Flusher)
	buffer := make([]byte, 256*1024)

	for {
		n, err := stdout.Read(buffer)
		if n > 0 {
			if _, writeErr := w.Write(buffer[:n]); writeErr != nil {
				cmd.Process.Kill()
				return writeErr
			}
			session.bytesWritten += int64(n)

			if canFlush {
				flusher.Flush()
			}
		}

		if err == io.EOF {
			break
		}
		if err != nil {
			cmd.Process.Kill()
			return err
		}

		select {
		case <-ctx.Done():
			cmd.Process.Kill()
			return ctx.Err()
		default:
		}
	}

	return cmd.Wait()
}

// GetActiveStreams returns count of active transcoding streams
func (s *TranscodeService) GetActiveStreams() int {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return len(s.activeStreams)
}
