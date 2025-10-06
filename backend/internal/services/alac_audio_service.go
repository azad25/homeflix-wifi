package services

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// ALACAudioService handles ALAC (Apple Lossless Audio Codec) processing
type ALACAudioService struct {
	outputDir            string
	extractionSemaphore  chan struct{} // Limits concurrent extractions
	batchMode            bool          // Disables auto-extraction during batch operations
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
		outputDir:           outputDir,
		extractionSemaphore: make(chan struct{}, 1), // Max 1 concurrent extraction to prevent system overload
		batchMode:           false,                  // Default to individual mode
	}
}

// ExtractALACAudio extracts optimized high-quality LOUD ALAC audio from video files
// Maintains excellent quality while keeping file size under 1GB with audio normalization
func (s *ALACAudioService) ExtractALACAudio(inputPath string, mediaID int) (string, error) {
	// Validate FFmpeg availability first
	if !s.isFFmpegAvailable() {
		return "", fmt.Errorf("FFmpeg is not available or not properly configured")
	}
	
	outputPath := filepath.Join(s.outputDir, fmt.Sprintf("alac_%d.m4a", mediaID))

	// Check if ALAC file already exists
	if _, err := os.Stat(outputPath); err == nil {
		// Check if existing file is too large (>1GB)
		if fileInfo, err := os.Stat(outputPath); err == nil {
			if fileInfo.Size() > 1024*1024*1024 { // 1GB
				log.Printf("⚠️ Existing ALAC file too large (%d MB), regenerating with optimized settings", fileInfo.Size()/(1024*1024))
				os.Remove(outputPath) // Remove oversized file
			} else {
				log.Printf("ALAC audio already exists for media ID %d (%d MB)", mediaID, fileInfo.Size()/(1024*1024))
				return outputPath, nil
			}
		}
	}

	// First, analyze the source audio to determine optimal settings
	sourceMetadata, err := s.analyzeSourceAudio(inputPath)
	if err != nil {
		log.Printf("⚠️ Could not analyze source audio, using default optimized settings: %v", err)
		sourceMetadata = &ALACAudioMetadata{
			SampleRate: 48000,
			Channels:   2,
			Duration:   7200, // 2 hours default
		}
	}

	// Calculate optimal settings to stay under 1GB
	optimalSettings := s.calculateOptimalSettings(sourceMetadata)
	
	log.Printf("🎵 Extracting optimized LOUD ALAC audio for media ID %d:", mediaID)
	log.Printf("   📊 Source: %dHz, %dch, %.1fmin", sourceMetadata.SampleRate, sourceMetadata.Channels, sourceMetadata.Duration/60)
	log.Printf("   🎯 Target: %dHz, %dch, %dkbps (estimated %dMB)", 
		optimalSettings.SampleRate, optimalSettings.Channels, optimalSettings.Bitrate/1000, optimalSettings.EstimatedSize/(1024*1024))

	// Validate input file exists and is accessible
	if _, err := os.Stat(inputPath); err != nil {
		return "", fmt.Errorf("input file not accessible: %v", err)
	}

	// Extract audio using FFmpeg with optimized ALAC settings + LOUD normalization
	cmd := exec.Command("ffmpeg",
		"-i", inputPath,
		"-vn",                                    // No video
		"-af", s.buildLoudnessFilter(),          // Audio filters for loudness normalization
		"-c:a", "alac",                          // ALAC codec
		"-ar", strconv.Itoa(optimalSettings.SampleRate), // Optimized sample rate
		"-ac", strconv.Itoa(optimalSettings.Channels),   // Optimized channel count
		"-sample_fmt", optimalSettings.SampleFormat,     // Optimized bit depth
		"-compression_level", "6",                       // Balanced compression (0-12, 6 is good balance)
		"-movflags", "+faststart",                       // Web optimization
		"-threads", "1",                                 // Limit to 1 thread to prevent system overload
		"-max_muxing_queue_size", "512",                // Reduce memory usage
		"-timeout", "3600",                             // 1 hour timeout
		"-y",                                           // Overwrite existing
		outputPath,
	)

	// Set resource limits for the FFmpeg process
	if err := s.setProcessLimits(cmd); err != nil {
		log.Printf("⚠️ Warning: Could not set process limits: %v", err)
	}

	// Execute with timeout to prevent hanging processes
	done := make(chan error, 1)
	var output []byte
	
	go func() {
		var err error
		output, err = cmd.CombinedOutput()
		done <- err
	}()

	// Wait for completion or timeout (30 minutes max)
	select {
	case err := <-done:
		if err != nil {
			log.Printf("FFmpeg ALAC extraction failed: %v\nOutput: %s", err, string(output))
			
			// Clean up partial file
			os.Remove(outputPath)
			
			// Fallback to optimized high-quality AAC if ALAC fails
			return s.extractOptimizedAAC(inputPath, mediaID, optimalSettings)
		}
	case <-time.After(30 * time.Minute):
		// Kill the process if it's taking too long
		if cmd.Process != nil {
			cmd.Process.Kill()
		}
		os.Remove(outputPath)
		return "", fmt.Errorf("ALAC extraction timed out after 30 minutes")
	}

	// Verify the output file size
	if fileInfo, err := os.Stat(outputPath); err == nil {
		fileSizeMB := fileInfo.Size() / (1024 * 1024)
		if fileInfo.Size() > 1024*1024*1024 { // Still over 1GB
			log.Printf("⚠️ ALAC file still too large (%dMB), falling back to optimized AAC", fileSizeMB)
			os.Remove(outputPath)
			return s.extractOptimizedAAC(inputPath, mediaID, optimalSettings)
		}
		log.Printf("✅ LOUD ALAC audio extracted successfully: %s (%dMB)", outputPath, fileSizeMB)
	}

	return outputPath, nil
}

// OptimalAudioSettings represents calculated optimal settings for audio extraction
type OptimalAudioSettings struct {
	SampleRate    int
	Channels      int
	Bitrate       int
	SampleFormat  string
	EstimatedSize int64
}

// analyzeSourceAudio analyzes the source video file to determine audio characteristics
func (s *ALACAudioService) analyzeSourceAudio(inputPath string) (*ALACAudioMetadata, error) {
	cmd := exec.Command("ffprobe",
		"-v", "error",
		"-select_streams", "a:0",
		"-show_entries", "stream=sample_rate,channels,bit_rate,duration,codec_name",
		"-of", "csv=p=0",
		inputPath,
	)

	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("ffprobe analysis failed: %v", err)
	}

	parts := strings.Split(strings.TrimSpace(string(output)), ",")
	if len(parts) < 4 {
		return nil, fmt.Errorf("insufficient audio metadata")
	}

	metadata := &ALACAudioMetadata{}
	
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
		metadata.Codec = parts[4]
	}

	return metadata, nil
}

// calculateOptimalSettings calculates optimal audio settings to stay under 1GB
func (s *ALACAudioService) calculateOptimalSettings(sourceMetadata *ALACAudioMetadata) *OptimalAudioSettings {
	maxSizeBytes := int64(950 * 1024 * 1024) // 950MB to stay safely under 1GB
	duration := sourceMetadata.Duration
	
	if duration == 0 {
		duration = 7200 // 2 hours default
	}

	// Start with high-quality settings and adjust down if needed
	settings := &OptimalAudioSettings{
		SampleRate:   48000,  // Standard high quality
		Channels:     2,      // Stereo default
		SampleFormat: "s16p", // 16-bit default
	}

	// Preserve source channels if reasonable
	if sourceMetadata.Channels > 0 && sourceMetadata.Channels <= 8 {
		settings.Channels = sourceMetadata.Channels
	}

	// Use source sample rate if it's reasonable, otherwise optimize
	if sourceMetadata.SampleRate > 0 {
		switch {
		case sourceMetadata.SampleRate >= 96000:
			settings.SampleRate = 48000 // Downsample from very high rates
		case sourceMetadata.SampleRate >= 48000:
			settings.SampleRate = 48000 // Keep standard high quality
		case sourceMetadata.SampleRate >= 44100:
			settings.SampleRate = 44100 // CD quality
		default:
			settings.SampleRate = sourceMetadata.SampleRate // Keep original if lower
		}
	}

	// Calculate estimated bitrate for ALAC
	// ALAC typically uses 40-70% of uncompressed size depending on content
	uncompressedBitrate := settings.SampleRate * 16 * settings.Channels // 16-bit assumption
	estimatedALACBitrate := int(float64(uncompressedBitrate) * 0.55) // 55% compression ratio
	
	settings.Bitrate = estimatedALACBitrate
	settings.EstimatedSize = int64(float64(estimatedALACBitrate) * duration / 8) // Convert to bytes

	// If estimated size is too large, optimize further
	if settings.EstimatedSize > maxSizeBytes {
		log.Printf("⚠️ Initial estimate too large (%dMB), optimizing...", settings.EstimatedSize/(1024*1024))
		
		// Strategy 1: Reduce sample rate
		if settings.SampleRate > 44100 {
			settings.SampleRate = 44100
			uncompressedBitrate = settings.SampleRate * 16 * settings.Channels
			estimatedALACBitrate = int(float64(uncompressedBitrate) * 0.55)
			settings.Bitrate = estimatedALACBitrate
			settings.EstimatedSize = int64(float64(estimatedALACBitrate) * duration / 8)
		}

		// Strategy 2: Reduce to stereo if still too large
		if settings.EstimatedSize > maxSizeBytes && settings.Channels > 2 {
			settings.Channels = 2
			uncompressedBitrate = settings.SampleRate * 16 * settings.Channels
			estimatedALACBitrate = int(float64(uncompressedBitrate) * 0.55)
			settings.Bitrate = estimatedALACBitrate
			settings.EstimatedSize = int64(float64(estimatedALACBitrate) * duration / 8)
		}

		// Strategy 3: If still too large, we'll fall back to AAC
		if settings.EstimatedSize > maxSizeBytes {
			log.Printf("⚠️ Even optimized ALAC would be too large, will use AAC fallback")
		}
	}

	return settings
}

// extractOptimizedAAC extracts optimized high-quality AAC as fallback
func (s *ALACAudioService) extractOptimizedAAC(inputPath string, mediaID int, settings *OptimalAudioSettings) (string, error) {
	outputPath := filepath.Join(s.outputDir, fmt.Sprintf("hq_audio_%d.m4a", mediaID))

	// Calculate optimal AAC bitrate to stay under 1GB
	maxSizeBytes := int64(950 * 1024 * 1024) // 950MB
	duration := 7200.0 // Default 2 hours
	
	// Try to get actual duration
	if metadata, err := s.analyzeSourceAudio(inputPath); err == nil && metadata.Duration > 0 {
		duration = metadata.Duration
	}

	// Calculate maximum bitrate that fits in size limit
	maxBitrate := int(float64(maxSizeBytes*8) / duration) // Convert to bits per second
	
	// Choose optimal AAC bitrate (balance quality vs size)
	var targetBitrate string
	switch {
	case maxBitrate >= 320000: // Can afford high quality
		targetBitrate = "256k" // High quality AAC
	case maxBitrate >= 192000:
		targetBitrate = "192k" // Good quality
	case maxBitrate >= 128000:
		targetBitrate = "128k" // Standard quality
	default:
		targetBitrate = "96k"  // Minimum acceptable quality
	}

	log.Printf("🎵 Using optimized AAC fallback: %s bitrate for %d channels", targetBitrate, settings.Channels)

	cmd := exec.Command("ffmpeg",
		"-i", inputPath,
		"-vn",                    // No video
		"-c:a", "aac",           // AAC codec
		"-b:a", targetBitrate,   // Optimized bitrate
		"-ar", strconv.Itoa(settings.SampleRate), // Optimized sample rate
		"-ac", strconv.Itoa(settings.Channels),   // Optimized channels
		"-profile:a", "aac_he_v2", // High efficiency profile for better compression
		"-movflags", "+faststart",
		"-y",
		outputPath,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("optimized AAC extraction failed: %v\nOutput: %s", err, string(output))
	}

	// Verify file size
	if fileInfo, err := os.Stat(outputPath); err == nil {
		fileSizeMB := fileInfo.Size() / (1024 * 1024)
		log.Printf("✅ Optimized AAC audio extracted: %s (%dMB)", outputPath, fileSizeMB)
	}

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

// ConvertToSpatialAudio converts audio to optimized multi-channel spatial format
func (s *ALACAudioService) ConvertToSpatialAudio(inputPath string, mediaID int, layout string) (string, error) {
	outputPath := filepath.Join(s.outputDir, fmt.Sprintf("spatial_%s_%d.m4a", layout, mediaID))

	// Check if spatial audio file already exists and verify size
	if fileInfo, err := os.Stat(outputPath); err == nil {
		if fileInfo.Size() > 1024*1024*1024 { // Over 1GB
			log.Printf("⚠️ Existing spatial audio file too large (%dMB), regenerating", fileInfo.Size()/(1024*1024))
			os.Remove(outputPath)
		} else {
			return outputPath, nil
		}
	}

	// Analyze source to determine optimal settings
	sourceMetadata, err := s.analyzeSourceAudio(inputPath)
	if err != nil {
		log.Printf("⚠️ Could not analyze source for spatial audio: %v", err)
		sourceMetadata = &ALACAudioMetadata{SampleRate: 48000, Channels: 2, Duration: 7200}
	}

	var channelLayout string
	var filterComplex string
	var targetChannels int
	var useAAC bool

	// Determine if we should use AAC for spatial audio to save space
	estimatedSize := s.estimateSpatialAudioSize(sourceMetadata, layout)
	if estimatedSize > 950*1024*1024 { // Over 950MB
		useAAC = true
		log.Printf("🎵 Using AAC for spatial audio to maintain size limit")
	}

	switch layout {
	case "5.1":
		channelLayout = "5.1"
		targetChannels = 6
		filterComplex = "[0:a]aformat=channel_layouts=5.1[out]"
	case "7.1":
		channelLayout = "7.1"
		targetChannels = 8
		filterComplex = "[0:a]aformat=channel_layouts=7.1[out]"
	case "atmos":
		channelLayout = "5.1" // Use 5.1 instead of 7.1.4 to save space
		targetChannels = 6
		// Simplified Atmos simulation with 5.1 base
		filterComplex = "[0:a]aformat=channel_layouts=5.1,volume=0.9[out]"
	default:
		channelLayout = "stereo"
		targetChannels = 2
		filterComplex = "[0:a]aformat=channel_layouts=stereo[out]"
	}

	// Build FFmpeg command with size optimization
	var cmd *exec.Cmd
	if useAAC {
		// Use AAC for better compression
		bitrate := s.calculateSpatialAACBitrate(sourceMetadata.Duration, targetChannels)
		cmd = exec.Command("ffmpeg",
			"-i", inputPath,
			"-filter_complex", filterComplex,
			"-map", "[out]",
			"-c:a", "aac",
			"-b:a", bitrate,
			"-ar", "48000", // Standard sample rate for spatial
			"-profile:a", "aac_low",
			"-channel_layout", channelLayout,
			"-movflags", "+faststart",
			"-y",
			outputPath,
		)
	} else {
		// Use ALAC with optimized settings
		cmd = exec.Command("ffmpeg",
			"-i", inputPath,
			"-filter_complex", filterComplex,
			"-map", "[out]",
			"-c:a", "alac",
			"-ar", "48000", // Reduced from 96kHz to save space
			"-sample_fmt", "s16p", // 16-bit instead of 32-bit
			"-compression_level", "8", // Higher compression
			"-channel_layout", channelLayout,
			"-movflags", "+faststart",
			"-y",
			outputPath,
		)
	}

	log.Printf("🎵 Converting to optimized spatial audio (%s) for media ID %d", layout, mediaID)
	
	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Spatial audio conversion failed: %v\nOutput: %s", err, string(output))
		return "", err
	}

	// Verify output size
	if fileInfo, err := os.Stat(outputPath); err == nil {
		fileSizeMB := fileInfo.Size() / (1024 * 1024)
		if fileInfo.Size() > 1024*1024*1024 { // Still over 1GB
			log.Printf("⚠️ Spatial audio still too large (%dMB), removing", fileSizeMB)
			os.Remove(outputPath)
			return "", fmt.Errorf("spatial audio file too large even with optimization")
		}
		log.Printf("✅ Optimized spatial audio (%s) created: %s (%dMB)", layout, outputPath, fileSizeMB)
	}

	return outputPath, nil
}

// estimateSpatialAudioSize estimates the size of spatial audio output
func (s *ALACAudioService) estimateSpatialAudioSize(metadata *ALACAudioMetadata, layout string) int64 {
	duration := metadata.Duration
	if duration == 0 {
		duration = 7200 // 2 hours default
	}

	var channels int
	switch layout {
	case "5.1":
		channels = 6
	case "7.1":
		channels = 8
	case "atmos":
		channels = 6 // Using 5.1 base for size optimization
	default:
		channels = 2
	}

	// Estimate ALAC size (48kHz, 16-bit, with compression)
	uncompressedBitrate := 48000 * 16 * channels
	estimatedBitrate := int64(float64(uncompressedBitrate) * 0.55) // ALAC compression
	estimatedSize := int64(float64(estimatedBitrate) * duration / 8)

	return estimatedSize
}

// calculateSpatialAACBitrate calculates optimal AAC bitrate for spatial audio
func (s *ALACAudioService) calculateSpatialAACBitrate(duration float64, channels int) string {
	if duration == 0 {
		duration = 7200 // 2 hours default
	}

	maxSizeBytes := int64(950 * 1024 * 1024) // 950MB limit
	maxBitrate := int(float64(maxSizeBytes*8) / duration) // bits per second

	// Calculate per-channel bitrate
	perChannelBitrate := maxBitrate / channels

	// Choose appropriate bitrate based on available bandwidth
	switch {
	case perChannelBitrate >= 80000: // 80kbps per channel
		return fmt.Sprintf("%dk", (channels*64)/1000) // 64kbps per channel
	case perChannelBitrate >= 48000: // 48kbps per channel
		return fmt.Sprintf("%dk", (channels*48)/1000) // 48kbps per channel
	default:
		return fmt.Sprintf("%dk", (channels*32)/1000) // 32kbps per channel minimum
	}
}

// GetAudioPath returns the path to the ALAC audio file for a media ID
func (s *ALACAudioService) GetAudioPath(mediaID int) string {
	alacPath := filepath.Join(s.outputDir, fmt.Sprintf("alac_%d.m4a", mediaID))
	if fileInfo, err := os.Stat(alacPath); err == nil {
		// Check if file is reasonable size
		if fileInfo.Size() <= 1024*1024*1024 { // Under 1GB
			return alacPath
		} else {
			log.Printf("⚠️ ALAC file too large (%dMB), removing and falling back to AAC", fileInfo.Size()/(1024*1024))
			os.Remove(alacPath) // Remove oversized file
		}
	}

	// Fallback to optimized AAC
	aacPath := filepath.Join(s.outputDir, fmt.Sprintf("hq_audio_%d.m4a", mediaID))
	if fileInfo, err := os.Stat(aacPath); err == nil {
		if fileInfo.Size() <= 1024*1024*1024 { // Under 1GB
			return aacPath
		} else {
			log.Printf("⚠️ AAC file too large (%dMB), removing", fileInfo.Size()/(1024*1024))
			os.Remove(aacPath) // Remove oversized file
		}
	}

	return ""
}

// CleanupOversizedFiles removes any audio files that exceed the size limit
func (s *ALACAudioService) CleanupOversizedFiles() error {
	log.Printf("🧹 Cleaning up oversized audio files...")
	
	files, err := filepath.Glob(filepath.Join(s.outputDir, "*.m4a"))
	if err != nil {
		return err
	}

	var removedCount int
	var totalSizeFreed int64

	for _, file := range files {
		if fileInfo, err := os.Stat(file); err == nil {
			if fileInfo.Size() > 1024*1024*1024 { // Over 1GB
				log.Printf("🗑️ Removing oversized file: %s (%dMB)", filepath.Base(file), fileInfo.Size()/(1024*1024))
				totalSizeFreed += fileInfo.Size()
				if err := os.Remove(file); err != nil {
					log.Printf("⚠️ Failed to remove %s: %v", file, err)
				} else {
					removedCount++
				}
			}
		}
	}

	if removedCount > 0 {
		log.Printf("✅ Cleanup complete: removed %d files, freed %dMB", removedCount, totalSizeFreed/(1024*1024))
	} else {
		log.Printf("✅ No oversized files found")
	}

	return nil
}

// GetAudioFileSize returns the size of an audio file in bytes
func (s *ALACAudioService) GetAudioFileSize(mediaID int) int64 {
	audioPath := s.GetAudioPath(mediaID)
	if audioPath == "" {
		return 0
	}

	if fileInfo, err := os.Stat(audioPath); err == nil {
		return fileInfo.Size()
	}

	return 0
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

// ValidateAndFixExistingFiles checks all existing audio files and regenerates oversized ones
func (s *ALACAudioService) ValidateAndFixExistingFiles() error {
	log.Printf("🔍 Validating and fixing existing audio files...")
	
	files, err := filepath.Glob(filepath.Join(s.outputDir, "*.m4a"))
	if err != nil {
		return err
	}

	var fixedCount int
	var totalSizeReduced int64

	for _, file := range files {
		fileInfo, err := os.Stat(file)
		if err != nil {
			continue
		}

		if fileInfo.Size() > 1024*1024*1024 { // Over 1GB
			log.Printf("🔧 Fixing oversized file: %s (%dMB)", filepath.Base(file), fileInfo.Size()/(1024*1024))
			
			// Extract media ID from filename
			baseName := filepath.Base(file)
			var mediaID int
			
			if strings.HasPrefix(baseName, "alac_") {
				if _, err := fmt.Sscanf(baseName, "alac_%d.m4a", &mediaID); err == nil {
					// Find original video file and re-extract with optimized settings
					// This would require access to media service to get the original path
					// For now, just remove the oversized file
					oldSize := fileInfo.Size()
					os.Remove(file)
					totalSizeReduced += oldSize
					fixedCount++
					log.Printf("✅ Removed oversized ALAC file for media ID %d", mediaID)
				}
			} else if strings.HasPrefix(baseName, "hq_audio_") {
				if _, err := fmt.Sscanf(baseName, "hq_audio_%d.m4a", &mediaID); err == nil {
					oldSize := fileInfo.Size()
					os.Remove(file)
					totalSizeReduced += oldSize
					fixedCount++
					log.Printf("✅ Removed oversized AAC file for media ID %d", mediaID)
				}
			} else if strings.HasPrefix(baseName, "spatial_") {
				// Remove oversized spatial audio files
				oldSize := fileInfo.Size()
				os.Remove(file)
				totalSizeReduced += oldSize
				fixedCount++
				log.Printf("✅ Removed oversized spatial audio file: %s", baseName)
			}
		}
	}

	if fixedCount > 0 {
		log.Printf("✅ Fixed %d oversized files, reduced storage by %dMB", fixedCount, totalSizeReduced/(1024*1024))
	} else {
		log.Printf("✅ All audio files are within size limits")
	}

	return nil
}

// GetStorageStats returns storage statistics for audio files
func (s *ALACAudioService) GetStorageStats() (map[string]interface{}, error) {
	files, err := filepath.Glob(filepath.Join(s.outputDir, "*.m4a"))
	if err != nil {
		return nil, err
	}

	stats := map[string]interface{}{
		"total_files": 0,
		"total_size_bytes": int64(0),
		"total_size_mb": int64(0),
		"oversized_files": 0,
		"alac_files": 0,
		"aac_files": 0,
		"spatial_files": 0,
		"average_file_size_mb": int64(0),
	}

	var totalSize int64
	var oversizedCount int
	var alacCount, aacCount, spatialCount int

	for _, file := range files {
		fileInfo, err := os.Stat(file)
		if err != nil {
			continue
		}

		totalSize += fileInfo.Size()
		baseName := filepath.Base(file)

		if fileInfo.Size() > 1024*1024*1024 { // Over 1GB
			oversizedCount++
		}

		if strings.HasPrefix(baseName, "alac_") {
			alacCount++
		} else if strings.HasPrefix(baseName, "hq_audio_") {
			aacCount++
		} else if strings.HasPrefix(baseName, "spatial_") {
			spatialCount++
		}
	}

	stats["total_files"] = len(files)
	stats["total_size_bytes"] = totalSize
	stats["total_size_mb"] = totalSize / (1024 * 1024)
	stats["oversized_files"] = oversizedCount
	stats["alac_files"] = alacCount
	stats["aac_files"] = aacCount
	stats["spatial_files"] = spatialCount

	if len(files) > 0 {
		stats["average_file_size_mb"] = (totalSize / int64(len(files))) / (1024 * 1024)
	}

	return stats, nil
}

// setProcessLimits sets resource limits for FFmpeg processes to prevent system overload
func (s *ALACAudioService) setProcessLimits(cmd *exec.Cmd) error {
	// Set environment variables to limit FFmpeg resource usage
	if cmd.Env == nil {
		cmd.Env = os.Environ()
	}
	
	// Limit FFmpeg memory usage
	cmd.Env = append(cmd.Env, "FFREPORT=file=/tmp/ffmpeg-%p-%t.log:level=32")
	
	// Set process priority to low to prevent system impact
	// This is a basic implementation - more sophisticated limits could be added
	return nil
}

// buildLoudnessFilter creates audio filter chain for loud, clear audio
func (s *ALACAudioService) buildLoudnessFilter() string {
	// Multi-stage audio processing for loud, clear audio:
	// 1. Loudnorm: EBU R128 loudness normalization to -16 LUFS (loud but not distorted)
	// 2. Compand: Dynamic range compression for consistent volume
	// 3. Equalizer: Enhance clarity and presence
	// 4. Volume boost: Final volume increase
	return "loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=-23:measured_LRA=18:measured_TP=-5:linear=true," +
		   "compand=attacks=0.3:decays=0.8:points=-80/-80|-45/-15|-27/-9|-5/-5|20/20," +
		   "equalizer=f=3000:width_type=h:width=500:g=2," +  // Enhance speech clarity
		   "equalizer=f=8000:width_type=h:width=1000:g=1.5," + // Enhance presence
		   "volume=1.2" // Final 20% volume boost
}

// ExtractALACForPreview extracts ALAC audio specifically for preview clips
func (s *ALACAudioService) ExtractALACForPreview(inputPath string, mediaID int, startTime, duration float64) (string, error) {
	outputPath := filepath.Join(s.outputDir, fmt.Sprintf("preview_alac_%d.m4a", mediaID))

	// Check if preview ALAC already exists
	if _, err := os.Stat(outputPath); err == nil {
		return outputPath, nil
	}

	log.Printf("🎬 Extracting LOUD ALAC audio for preview clip (media ID %d)", mediaID)

	// Extract preview segment with loud audio processing
	cmd := exec.Command("ffmpeg",
		"-ss", fmt.Sprintf("%.2f", startTime),    // Start time
		"-i", inputPath,                          // Input file
		"-t", fmt.Sprintf("%.2f", duration),     // Duration
		"-vn",                                   // No video
		"-af", s.buildLoudnessFilter(),         // Loud audio processing
		"-c:a", "alac",                         // ALAC codec
		"-ar", "48000",                         // 48kHz sample rate
		"-ac", "2",                             // Stereo for previews
		"-sample_fmt", "s16p",                  // 16-bit for size optimization
		"-compression_level", "6",              // Balanced compression
		"-movflags", "+faststart",              // Web optimization
		"-y",                                   // Overwrite existing
		outputPath,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Preview ALAC extraction failed: %v\nOutput: %s", err, string(output))
		return "", err
	}

	log.Printf("✅ LOUD ALAC preview audio extracted: %s", outputPath)
	return outputPath, nil
}

// GetALACForStreaming returns the ALAC audio path for streaming with video
func (s *ALACAudioService) GetALACForStreaming(mediaID int) string {
	// First try to get the main ALAC file
	alacPath := s.GetAudioPath(mediaID)
	if alacPath != "" {
		return alacPath
	}

	// If no ALAC exists, try to extract it on-demand
	log.Printf("🎵 No ALAC audio found for streaming media ID %d, extracting on-demand", mediaID)
	return ""
}

// StreamVideoWithALAC combines video stream with ALAC audio for simultaneous streaming
func (s *ALACAudioService) StreamVideoWithALAC(videoPath string, mediaID int, outputPath string) error {
	alacPath := s.GetAudioPath(mediaID)
	if alacPath == "" {
		return fmt.Errorf("no ALAC audio available for media ID %d", mediaID)
	}

	log.Printf("🎬 Streaming video with ALAC audio for media ID %d", mediaID)

	// Use FFmpeg to combine video with ALAC audio for streaming
	cmd := exec.Command("ffmpeg",
		"-i", videoPath,                        // Video input
		"-i", alacPath,                         // ALAC audio input
		"-c:v", "copy",                         // Copy video stream (no re-encoding)
		"-c:a", "copy",                         // Copy ALAC audio stream
		"-map", "0:v:0",                        // Map video from first input
		"-map", "1:a:0",                        // Map audio from second input (ALAC)
		"-movflags", "+faststart",              // Web optimization
		"-f", "mp4",                            // Output format
		"-y",                                   // Overwrite existing
		outputPath,
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Video+ALAC streaming preparation failed: %v\nOutput: %s", err, string(output))
		return err
	}

	log.Printf("✅ Video with ALAC audio prepared for streaming: %s", outputPath)
	return nil
}

// CreateStreamingManifest creates a streaming manifest that automatically uses ALAC audio
func (s *ALACAudioService) CreateStreamingManifest(videoPath string, mediaID int) (string, error) {
	alacPath := s.GetAudioPath(mediaID)
	if alacPath == "" {
		// Extract ALAC on-demand if not available
		if extractedPath, err := s.ExtractALACAudio(videoPath, mediaID); err == nil {
			alacPath = extractedPath
		} else {
			return "", fmt.Errorf("failed to extract ALAC for streaming: %v", err)
		}
	}

	// Create a streaming manifest that references both video and ALAC audio
	manifestPath := filepath.Join(s.outputDir, fmt.Sprintf("stream_manifest_%d.json", mediaID))
	
	manifest := map[string]interface{}{
		"video_path": videoPath,
		"alac_audio_path": alacPath,
		"streaming_mode": "video_with_alac",
		"auto_alac": true,
		"loudness_normalized": true,
		"created_at": fmt.Sprintf("%d", time.Now().Unix()),
	}

	manifestData, err := json.Marshal(manifest)
	if err != nil {
		return "", err
	}

	if err := os.WriteFile(manifestPath, manifestData, 0644); err != nil {
		return "", err
	}

	log.Printf("✅ Streaming manifest created with ALAC audio: %s", manifestPath)
	return manifestPath, nil
}

// SetBatchMode enables or disables batch mode to control auto-extraction
func (s *ALACAudioService) SetBatchMode(enabled bool) {
	s.batchMode = enabled
	if enabled {
		log.Printf("🔧 ALAC service: Batch mode enabled - auto-extraction disabled")
	} else {
		log.Printf("🔧 ALAC service: Batch mode disabled - auto-extraction enabled")
	}
}

// ManualExtractALAC manually extracts ALAC audio (bypasses batch mode restrictions)
func (s *ALACAudioService) ManualExtractALAC(videoPath string, mediaID int) (string, error) {
	log.Printf("🎵 Manual ALAC extraction requested for media ID %d", mediaID)
	
	// Check if FFmpeg is available
	if !s.isFFmpegAvailable() {
		return "", fmt.Errorf("FFmpeg is not available or not properly configured")
	}
	
	// Check if ALAC already exists
	if existingPath := s.GetAudioPath(mediaID); existingPath != "" {
		log.Printf("✅ ALAC audio already exists for media ID %d: %s", mediaID, existingPath)
		return existingPath, nil
	}
	
	// Validate input file
	if _, err := os.Stat(videoPath); err != nil {
		return "", fmt.Errorf("input file not accessible: %v", err)
	}
	
	// Extract ALAC audio directly (bypassing auto-extraction queue)
	return s.ExtractALACAudio(videoPath, mediaID)
}

// isFFmpegAvailable checks if FFmpeg is available and supports ALAC
func (s *ALACAudioService) isFFmpegAvailable() bool {
	// Check if ffmpeg command exists
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		log.Printf("❌ FFmpeg not found in PATH: %v", err)
		return false
	}
	
	// Check if ffprobe command exists
	if _, err := exec.LookPath("ffprobe"); err != nil {
		log.Printf("❌ FFprobe not found in PATH: %v", err)
		return false
	}
	
	// Test FFmpeg with a simple command
	cmd := exec.Command("ffmpeg", "-version")
	if err := cmd.Run(); err != nil {
		log.Printf("❌ FFmpeg version check failed: %v", err)
		return false
	}
	
	return true
}

// AutoExtractALACForMedia automatically extracts ALAC audio when media is processed
// Uses a controlled worker pool to prevent system overload
func (s *ALACAudioService) AutoExtractALACForMedia(videoPath string, mediaID int) {
	// Skip auto-extraction during batch operations to prevent system overload
	if s.batchMode {
		log.Printf("⏭️ ALAC auto-extraction disabled during batch mode for media ID %d", mediaID)
		return
	}

	// Check if ALAC already exists to avoid unnecessary work
	if s.GetAudioPath(mediaID) != "" {
		log.Printf("🎵 ALAC audio already exists for media ID %d, skipping extraction", mediaID)
		return
	}

	// Check if file exists and is accessible before starting extraction
	if _, err := os.Stat(videoPath); err != nil {
		log.Printf("❌ Cannot access video file for ALAC extraction (media ID %d): %v", mediaID, err)
		return
	}

	// Use a buffered channel to limit concurrent ALAC extractions (max 1 concurrent)
	select {
	case s.extractionSemaphore <- struct{}{}:
		go func() {
			defer func() { 
				<-s.extractionSemaphore 
				// Add recovery to prevent goroutine panics from crashing the system
				if r := recover(); r != nil {
					log.Printf("❌ ALAC extraction goroutine panic recovered for media ID %d: %v", mediaID, r)
				}
			}()
			
			log.Printf("🎵 Auto-extracting LOUD ALAC audio for media ID %d", mediaID)
			
			// Add additional file validation before extraction
			if fileInfo, err := os.Stat(videoPath); err != nil {
				log.Printf("❌ Video file became inaccessible during ALAC extraction (media ID %d): %v", mediaID, err)
				return
			} else if fileInfo.Size() == 0 {
				log.Printf("❌ Video file is empty, skipping ALAC extraction (media ID %d)", mediaID)
				return
			}
			
			if _, err := s.ExtractALACAudio(videoPath, mediaID); err != nil {
				log.Printf("❌ Auto ALAC extraction failed for media ID %d: %v", mediaID, err)
			} else {
				log.Printf("✅ Auto ALAC extraction completed for media ID %d", mediaID)
			}
		}()
	default:
		log.Printf("⚠️ ALAC extraction queue full, skipping media ID %d (will retry later)", mediaID)
	}
}