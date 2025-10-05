package services

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

// ALACAudioService handles ALAC (Apple Lossless Audio Codec) processing
type ALACAudioService struct {
	outputDir string
}

// ALACAudioMetadata represents ALAC audio file metadata
type ALACAudioMetadata struct {
	Codec       string  `json:"codec"`
	SampleRate  int     `json:"sample_rate"`
	BitDepth    int     `json:"bit_depth"`
	Channels    int     `json:"channels"`
	Bitrate     int     `json:"bitrate"`
	Duration    float64 `json:"duration"`
	IsLossless  bool    `json:"is_lossless"`
	FileSize    int64   `json:"file_size"`
	Format      string  `json:"format"`
}

// NewALACAudioService creates a new ALAC audio service
func NewALACAudioService(outputDir string) *ALACAudioService {
	// Ensure output directory exists
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		log.Printf("Warning: Could not create ALAC output directory: %v", err)
	}

	return &ALACAudioService{
		outputDir: outputDir,
	}
}

// ExtractALACAudio extracts high-quality ALAC audio from video files
func (s *ALACAudioService) ExtractALACAudio(inputPath string, mediaID int) (string, error) {
	outputPath := filepath.Join(s.outputDir, fmt.Sprintf("alac_%d.m4a", mediaID))

	// Check if ALAC file already exists
	if _, err := os.Stat(outputPath); err == nil {
		log.Printf("ALAC audio already exists for media ID %d", mediaID)
		return outputPath, nil
	}

	// Extract audio using FFmpeg with ALAC codec
	cmd := exec.Command("ffmpeg",
		"-i", inputPath,
		"-vn",                    // No video
		"-c:a", "alac",          // ALAC codec
		"-ar", "96000",          // 96kHz sample rate for Hi-Res
		"-sample_fmt", "s32p",   // 32-bit sample format
		"-compression_level", "0", // Maximum quality (no compression)
		"-movflags", "+faststart", // Web optimization
		"-y",                    // Overwrite existing
		outputPath,
	)

	log.Printf("Extracting ALAC audio for media ID %d: %s", mediaID, inputPath)
	
	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("FFmpeg ALAC extraction failed: %v\nOutput: %s", err, string(output))
		
		// Fallback to high-quality AAC if ALAC fails
		return s.extractHighQualityAAC(inputPath, mediaID)
	}

	log.Printf("✅ ALAC audio extracted successfully: %s", outputPath)
	return outputPath, nil
}

// extractHighQualityAAC extracts high-quality AAC as fallback
func (s *ALACAudioService) extractHighQualityAAC(inputPath string, mediaID int) (string, error) {
	outputPath := filepath.Join(s.outputDir, fmt.Sprintf("hq_audio_%d.m4a", mediaID))

	cmd := exec.Command("ffmpeg",
		"-i", inputPath,
		"-vn",                    // No video
		"-c:a", "aac",           // AAC codec
		"-b:a", "320k",          // High bitrate
		"-ar", "48000",          // 48kHz sample rate
		"-ac", "8",              // Up to 8 channels for surround
		"-movflags", "+faststart",
		"-y",
		outputPath,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("high-quality AAC extraction failed: %v\nOutput: %s", err, string(output))
	}

	log.Printf("✅ High-quality AAC audio extracted as fallback: %s", outputPath)
	return outputPath, nil
}

// AnalyzeAudioQuality analyzes audio file for quality metrics
func (s *ALACAudioService) AnalyzeAudioQuality(filePath string) (*ALACAudioMetadata, error) {
	// Use FFprobe to analyze audio metadata
	cmd := exec.Command("ffprobe",
		"-v", "quiet",
		"-print_format", "json",
		"-show_format",
		"-show_streams",
		"-select_streams", "a:0", // First audio stream
		filePath,
	)

	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("ffprobe analysis failed: %v", err)
	}

	// Parse basic metadata from ffprobe output
	metadata := &ALACAudioMetadata{
		Format: "Unknown",
	}

	// Extract key information from ffprobe JSON output
	outputStr := string(output)
	
	// Extract codec
	if strings.Contains(outputStr, `"codec_name":"alac"`) {
		metadata.Codec = "ALAC"
		metadata.IsLossless = true
	} else if strings.Contains(outputStr, `"codec_name":"flac"`) {
		metadata.Codec = "FLAC"
		metadata.IsLossless = true
	} else if strings.Contains(outputStr, `"codec_name":"aac"`) {
		metadata.Codec = "AAC"
		metadata.IsLossless = false
	} else {
		metadata.Codec = "Unknown"
	}

	// Get file size
	if fileInfo, err := os.Stat(filePath); err == nil {
		metadata.FileSize = fileInfo.Size()
	}

	// Use ffprobe to get detailed audio information
	detailCmd := exec.Command("ffprobe",
		"-v", "error",
		"-select_streams", "a:0",
		"-show_entries", "stream=sample_rate,channels,bit_rate,duration,bits_per_sample",
		"-of", "csv=p=0",
		filePath,
	)

	detailOutput, err := detailCmd.Output()
	if err == nil {
		parts := strings.Split(strings.TrimSpace(string(detailOutput)), ",")
		if len(parts) >= 4 {
			if sampleRate, err := strconv.Atoi(parts[0]); err == nil {
				metadata.SampleRate = sampleRate
			}
			if channels, err := strconv.Atoi(parts[1]); err == nil {
				metadata.Channels = channels
			}
			if bitrate, err := strconv.Atoi(parts[2]); err == nil {
				metadata.Bitrate = bitrate
			}
			if duration, err := strconv.ParseFloat(parts[3], 64); err == nil {
				metadata.Duration = duration
			}
			if len(parts) > 4 {
				if bitDepth, err := strconv.Atoi(parts[4]); err == nil {
					metadata.BitDepth = bitDepth
				}
			}
		}
	}

	// Determine if it's truly lossless based on characteristics
	if metadata.Codec == "ALAC" || metadata.Codec == "FLAC" {
		metadata.IsLossless = true
	} else if metadata.Bitrate > 1000000 && metadata.SampleRate >= 44100 { // High bitrate suggests lossless
		metadata.IsLossless = true
	}

	// Set format based on codec and quality
	if metadata.IsLossless {
		if metadata.SampleRate >= 96000 {
			metadata.Format = "Hi-Res Lossless"
		} else {
			metadata.Format = "Lossless"
		}
	} else {
		metadata.Format = "Lossy"
	}

	log.Printf("🎵 Audio analysis complete:")
	log.Printf("   Codec: %s", metadata.Codec)
	log.Printf("   Sample Rate: %d Hz", metadata.SampleRate)
	log.Printf("   Bit Depth: %d bit", metadata.BitDepth)
	log.Printf("   Channels: %d", metadata.Channels)
	log.Printf("   Bitrate: %d bps", metadata.Bitrate)
	log.Printf("   Lossless: %v", metadata.IsLossless)
	log.Printf("   Format: %s", metadata.Format)

	return metadata, nil
}

// ConvertToSpatialAudio converts audio to multi-channel spatial format
func (s *ALACAudioService) ConvertToSpatialAudio(inputPath string, mediaID int, layout string) (string, error) {
	outputPath := filepath.Join(s.outputDir, fmt.Sprintf("spatial_%s_%d.m4a", layout, mediaID))

	// Check if spatial audio file already exists
	if _, err := os.Stat(outputPath); err == nil {
		return outputPath, nil
	}

	var channelLayout string
	var filterComplex string

	switch layout {
	case "5.1":
		channelLayout = "5.1"
		filterComplex = "[0:a]channelmap=channel_layout=5.1[out]"
	case "7.1":
		channelLayout = "7.1"
		filterComplex = "[0:a]channelmap=channel_layout=7.1[out]"
	case "atmos":
		channelLayout = "7.1.4"
		// Simulate Atmos by upmixing to 7.1.4 layout
		filterComplex = "[0:a]aformat=channel_layouts=7.1,apad[base];[base]asplit=12[ch0][ch1][ch2][ch3][ch4][ch5][ch6][ch7][ch8][ch9][ch10][ch11];[ch0][ch1][ch2][ch3][ch4][ch5][ch6][ch7][ch8][ch9][ch10][ch11]amerge=inputs=12[out]"
	default:
		channelLayout = "stereo"
		filterComplex = "[0:a]aformat=channel_layouts=stereo[out]"
	}

	cmd := exec.Command("ffmpeg",
		"-i", inputPath,
		"-filter_complex", filterComplex,
		"-map", "[out]",
		"-c:a", "alac",
		"-ar", "96000",
		"-sample_fmt", "s32p",
		"-channel_layout", channelLayout,
		"-movflags", "+faststart",
		"-y",
		outputPath,
	)

	log.Printf("Converting to spatial audio (%s) for media ID %d", layout, mediaID)
	
	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Spatial audio conversion failed: %v\nOutput: %s", err, string(output))
		return "", err
	}

	log.Printf("✅ Spatial audio (%s) created: %s", layout, outputPath)
	return outputPath, nil
}

// GetAudioPath returns the path to the ALAC audio file for a media ID
func (s *ALACAudioService) GetAudioPath(mediaID int) string {
	alacPath := filepath.Join(s.outputDir, fmt.Sprintf("alac_%d.m4a", mediaID))
	if _, err := os.Stat(alacPath); err == nil {
		return alacPath
	}

	// Fallback to high-quality AAC
	aacPath := filepath.Join(s.outputDir, fmt.Sprintf("hq_audio_%d.m4a", mediaID))
	if _, err := os.Stat(aacPath); err == nil {
		return aacPath
	}

	return ""
}

// GetSupportedFormats returns list of supported audio formats
func (s *ALACAudioService) GetSupportedFormats() []string {
	return []string{
		"ALAC (Apple Lossless)",
		"FLAC (Free Lossless Audio Codec)",
		"AAC (Advanced Audio Coding)",
		"MP3 (MPEG Audio Layer III)",
		"WAV (Waveform Audio File Format)",
		"AIFF (Audio Interchange File Format)",
	}
}

// ValidateALACSupport checks if system supports ALAC encoding
func (s *ALACAudioService) ValidateALACSupport() bool {
	cmd := exec.Command("ffmpeg", "-encoders")
	output, err := cmd.Output()
	if err != nil {
		return false
	}

	return strings.Contains(string(output), "alac")
}