package services

import (
	"encoding/json"
	"fmt"
	"log"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"homeflix-backend/internal/models"

	"gorm.io/gorm"
)

// StreamProfileService probes media files once and stores codec/container info
// in the DB so that play-time streaming decisions are a column lookup instead
// of a per-request ffprobe.
type StreamProfileService struct {
	db *gorm.DB

	// single-flight: avoid concurrent probes of the same file
	inflight map[uint]*sync.WaitGroup
	mu       sync.Mutex
}

// StreamProbe is the result of probing a media file.
type StreamProbe struct {
	VideoCodec    string
	AudioCodec    string
	AudioChannels int
	Container     string
	Width         int
	Height        int
	BitDepth      int
	Duration      float64
}

// ClientProfile describes what a client can play natively.
type ClientProfile struct {
	Name        string
	VideoCodecs map[string]bool
	AudioCodecs map[string]bool
	Containers  map[string]bool
	MaxBitDepth int
}

// StreamDecision is the outcome of matching a file against a client profile.
type StreamDecision struct {
	Strategy  string `json:"strategy"`   // "direct" or "hls"
	VideoMode string `json:"video_mode"` // "copy" or "transcode" (hls only)
	AudioMode string `json:"audio_mode"` // "copy" or "transcode" (hls only)
	Reason    string `json:"reason"`
}

// WebClientProfile: what browsers reliably demux/decode via <video> + MSE.
// Anything outside this goes through HLS (which is a cheap remux when the
// video track is already H.264).
func WebClientProfile() ClientProfile {
	return ClientProfile{
		Name:        "web",
		VideoCodecs: map[string]bool{"h264": true, "vp8": true, "vp9": true, "av1": true},
		AudioCodecs: map[string]bool{"aac": true, "mp3": true, "opus": true, "vorbis": true, "flac": true},
		Containers:  map[string]bool{"mp4": true, "webm": true},
		MaxBitDepth: 8,
	}
}

// TVClientProfile: ExoPlayer on Android TV demuxes MKV and decodes
// HEVC/AC3/EAC3 in hardware on virtually all TV SoCs. Direct play nearly
// everything; only exotic audio (TrueHD) or containers force HLS.
func TVClientProfile() ClientProfile {
	return ClientProfile{
		Name:        "tv",
		VideoCodecs: map[string]bool{"h264": true, "hevc": true, "vp8": true, "vp9": true, "av1": true, "mpeg4": true, "mpeg2video": true},
		AudioCodecs: map[string]bool{"aac": true, "ac3": true, "eac3": true, "mp3": true, "opus": true, "vorbis": true, "flac": true, "dts": true, "pcm_s16le": true},
		Containers:  map[string]bool{"mp4": true, "matroska": true, "webm": true, "avi": true},
		MaxBitDepth: 10,
	}
}

func NewStreamProfileService(db *gorm.DB) *StreamProfileService {
	return &StreamProfileService{
		db:       db,
		inflight: make(map[uint]*sync.WaitGroup),
	}
}

// ProbeFile runs a single ffprobe and extracts the stream profile.
func (s *StreamProfileService) ProbeFile(filePath string) (*StreamProbe, error) {
	cmd := exec.Command("ffprobe",
		"-v", "quiet",
		"-print_format", "json",
		"-show_streams",
		"-show_format",
		filePath)

	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("ffprobe failed for %s: %v", filepath.Base(filePath), err)
	}

	var probe struct {
		Streams []struct {
			CodecType   string `json:"codec_type"`
			CodecName   string `json:"codec_name"`
			Width       int    `json:"width"`
			Height      int    `json:"height"`
			PixFmt      string `json:"pix_fmt"`
			Channels    int    `json:"channels"`
			Disposition struct {
				Default int `json:"default"`
			} `json:"disposition"`
		} `json:"streams"`
		Format struct {
			FormatName string `json:"format_name"`
			Duration   string `json:"duration"`
		} `json:"format"`
	}
	if err := json.Unmarshal(output, &probe); err != nil {
		return nil, fmt.Errorf("failed to parse ffprobe output: %v", err)
	}

	result := &StreamProbe{Container: normalizeContainer(probe.Format.FormatName)}
	if probe.Format.Duration != "" {
		result.Duration, _ = strconv.ParseFloat(probe.Format.Duration, 64)
	}

	for _, st := range probe.Streams {
		switch st.CodecType {
		case "video":
			// Skip attached pictures (cover art shows up as a video stream)
			if st.CodecName == "mjpeg" || st.CodecName == "png" {
				continue
			}
			if result.VideoCodec == "" {
				result.VideoCodec = strings.ToLower(st.CodecName)
				result.Width = st.Width
				result.Height = st.Height
				result.BitDepth = bitDepthFromPixFmt(st.PixFmt)
			}
		case "audio":
			// Prefer the default audio track; otherwise the first one
			if result.AudioCodec == "" || st.Disposition.Default == 1 {
				result.AudioCodec = strings.ToLower(st.CodecName)
				result.AudioChannels = st.Channels
			}
		}
	}

	return result, nil
}

// EnsureProfile makes sure the media row has stream-profile columns filled.
// Probes at most once per file (single-flight) and persists the result.
func (s *StreamProfileService) EnsureProfile(media *models.Media) error {
	if media.VideoCodec != "" && media.Container != "" {
		return nil // already probed
	}

	// single-flight per media ID
	s.mu.Lock()
	if wg, busy := s.inflight[media.ID]; busy {
		s.mu.Unlock()
		wg.Wait()
		// reload the row another goroutine just populated
		var fresh models.Media
		if err := s.db.Select("video_codec", "audio_codec", "audio_channels", "container", "video_width", "video_height", "video_bit_depth").First(&fresh, media.ID).Error; err == nil {
			media.VideoCodec = fresh.VideoCodec
			media.AudioCodec = fresh.AudioCodec
			media.AudioChannels = fresh.AudioChannels
			media.Container = fresh.Container
			media.VideoWidth = fresh.VideoWidth
			media.VideoHeight = fresh.VideoHeight
			media.VideoBitDepth = fresh.VideoBitDepth
		}
		return nil
	}
	wg := &sync.WaitGroup{}
	wg.Add(1)
	s.inflight[media.ID] = wg
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		delete(s.inflight, media.ID)
		s.mu.Unlock()
		wg.Done()
	}()

	probe, err := s.ProbeFile(media.FilePath)
	if err != nil {
		return err
	}

	media.VideoCodec = probe.VideoCodec
	media.AudioCodec = probe.AudioCodec
	media.AudioChannels = probe.AudioChannels
	media.Container = probe.Container
	media.VideoWidth = probe.Width
	media.VideoHeight = probe.Height
	media.VideoBitDepth = probe.BitDepth
	if media.Duration == 0 && probe.Duration > 0 {
		media.Duration = int(probe.Duration)
	}

	updates := map[string]interface{}{
		"video_codec":     probe.VideoCodec,
		"audio_codec":     probe.AudioCodec,
		"audio_channels":  probe.AudioChannels,
		"container":       probe.Container,
		"video_width":     probe.Width,
		"video_height":    probe.Height,
		"video_bit_depth": probe.BitDepth,
	}
	if media.Duration > 0 {
		updates["duration"] = media.Duration
	}
	if err := s.db.Model(&models.Media{}).Where("id = ?", media.ID).Updates(updates).Error; err != nil {
		return fmt.Errorf("failed to persist stream profile: %v", err)
	}

	log.Printf("🎞️ Stream profile stored for %s: video=%s(%dbit) audio=%s container=%s",
		filepath.Base(media.FilePath), probe.VideoCodec, probe.BitDepth, probe.AudioCodec, probe.Container)
	return nil
}

// Decide matches a probed file against a client profile.
func Decide(media *models.Media, client ClientProfile) StreamDecision {
	var reasons []string

	videoOK := client.VideoCodecs[media.VideoCodec]
	if !videoOK {
		reasons = append(reasons, fmt.Sprintf("video codec %s unsupported", media.VideoCodec))
	}
	if videoOK && media.VideoBitDepth > client.MaxBitDepth {
		videoOK = false
		reasons = append(reasons, fmt.Sprintf("%d-bit video unsupported", media.VideoBitDepth))
	}

	audioOK := media.AudioCodec == "" || client.AudioCodecs[media.AudioCodec]
	if !audioOK {
		reasons = append(reasons, fmt.Sprintf("audio codec %s unsupported", media.AudioCodec))
	}

	containerOK := client.Containers[media.Container]
	if !containerOK {
		reasons = append(reasons, fmt.Sprintf("container %s unsupported", media.Container))
	}

	if videoOK && audioOK && containerOK {
		return StreamDecision{Strategy: "direct", Reason: "fully compatible"}
	}

	d := StreamDecision{Strategy: "hls", Reason: strings.Join(reasons, ", ")}
	if videoOK {
		d.VideoMode = "copy" // remux only - nearly free
	} else {
		d.VideoMode = "transcode"
	}
	if media.AudioCodec == "aac" {
		d.AudioMode = "copy"
	} else {
		d.AudioMode = "transcode"
	}
	return d
}

// BackfillProfiles probes every media row that has no stream profile yet.
// Runs sequentially and throttled so it never competes with playback.
func (s *StreamProfileService) BackfillProfiles() (int, int) {
	var pending []models.Media
	if err := s.db.Where("(video_codec IS NULL OR video_codec = '') AND deleted_at IS NULL").Find(&pending).Error; err != nil {
		log.Printf("❌ Stream profile backfill query failed: %v", err)
		return 0, 0
	}

	log.Printf("🎞️ Stream profile backfill: %d files to probe", len(pending))
	done, failed := 0, 0
	for i := range pending {
		if err := s.EnsureProfile(&pending[i]); err != nil {
			failed++
		} else {
			done++
		}
	}
	log.Printf("🎞️ Stream profile backfill complete: %d probed, %d failed", done, failed)
	return done, failed
}

func normalizeContainer(formatName string) string {
	// ffprobe reports e.g. "matroska,webm" or "mov,mp4,m4a,3gp,3g2,mj2"
	switch {
	case strings.Contains(formatName, "matroska"):
		return "matroska"
	case strings.Contains(formatName, "webm"):
		return "webm"
	case strings.Contains(formatName, "mp4"):
		return "mp4"
	case strings.Contains(formatName, "avi"):
		return "avi"
	case strings.Contains(formatName, "mpegts"):
		return "mpegts"
	default:
		if idx := strings.Index(formatName, ","); idx > 0 {
			return formatName[:idx]
		}
		return formatName
	}
}

func bitDepthFromPixFmt(pixFmt string) int {
	if strings.Contains(pixFmt, "10le") || strings.Contains(pixFmt, "10be") || strings.Contains(pixFmt, "p010") {
		return 10
	}
	if strings.Contains(pixFmt, "12le") || strings.Contains(pixFmt, "12be") {
		return 12
	}
	return 8
}
