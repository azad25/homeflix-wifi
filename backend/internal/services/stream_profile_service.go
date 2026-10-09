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
	AudioStream   string // ffmpeg map spec of the chosen audio track, "none" if silent
}

// ClientProfile describes what a client can play natively.
type ClientProfile struct {
	Name        string
	VideoCodecs map[string]bool
	AudioCodecs map[string]bool
	Containers  map[string]bool
	// Codecs the client decodes above 8-bit (HEVC Main10, VP9 profile 2,
	// AV1 10-bit). 10-bit H.264 is almost never hardware-decodable.
	HighBitDepth map[string]bool
	// Codecs that may be stream-copied into MPEG-TS HLS segments for this
	// client. Browsers (hls.js / Safari) only handle H.264 in TS; copying
	// VP9/AV1/HEVC into TS produces a stream that never starts.
	HLSVideoCopy map[string]bool
	HLSAudioCopy map[string]bool
}

// StreamDecision is the outcome of matching a file against a client profile.
type StreamDecision struct {
	Strategy  string `json:"strategy"`   // "direct" or "hls"
	VideoMode string `json:"video_mode"` // "copy" or "transcode" (hls only)
	AudioMode string `json:"audio_mode"` // "copy" or "transcode" (hls only)
	Reason    string `json:"reason"`
}

func set(items ...string) map[string]bool {
	m := make(map[string]bool, len(items))
	for _, it := range items {
		m[it] = true
	}
	return m
}

// WebClientProfile: the conservative default for a browser that did not
// report its capabilities. Browsers that do report them (see
// ClientProfileFromCaps) get direct play for everything they can decode.
func WebClientProfile() ClientProfile {
	return ClientProfile{
		Name:         "web",
		VideoCodecs:  set("h264", "vp8", "vp9", "av1"),
		AudioCodecs:  set("aac", "mp3", "opus", "vorbis", "flac"),
		Containers:   set("mp4", "webm"),
		HighBitDepth: set(),
		HLSVideoCopy: set("h264"),
		HLSAudioCopy: set("aac", "mp3"),
	}
}

// CastClientProfile: Chromecast default media receiver baseline.
func CastClientProfile() ClientProfile {
	return ClientProfile{
		Name:         "cast",
		VideoCodecs:  set("h264", "vp8"),
		AudioCodecs:  set("aac", "mp3", "opus", "vorbis", "flac"),
		Containers:   set("mp4", "webm"),
		HighBitDepth: set(),
		HLSVideoCopy: set("h264"),
		HLSAudioCopy: set("aac", "mp3"),
	}
}

// TVClientProfile: ExoPlayer on Android TV demuxes MKV and decodes
// HEVC/AC3/EAC3 in hardware on virtually all TV SoCs. Direct play nearly
// everything; only exotic audio (TrueHD) or containers force HLS.
func TVClientProfile() ClientProfile {
	return ClientProfile{
		Name:         "tv",
		VideoCodecs:  set("h264", "hevc", "vp8", "vp9", "av1", "mpeg4", "mpeg2video"),
		AudioCodecs:  set("aac", "ac3", "eac3", "mp3", "opus", "vorbis", "flac", "dts", "pcm_s16le"),
		Containers:   set("mp4", "matroska", "webm", "avi"),
		HighBitDepth: set("hevc", "vp9", "av1"),
		HLSVideoCopy: set("h264", "hevc", "mpeg2video"),
		HLSAudioCopy: set("aac", "mp3", "ac3", "eac3"),
	}
}

// Capability tokens a client may report. Anything else is ignored so a
// client can never make the server attempt something it doesn't model.
var (
	knownVideoCodecs = set("h264", "hevc", "vp8", "vp9", "av1", "mpeg4", "mpeg2video")
	knownAudioCodecs = set("aac", "mp3", "opus", "vorbis", "flac", "ac3", "eac3", "dts", "truehd", "pcm_s16le")
	knownContainers  = set("mp4", "webm", "matroska", "avi", "mpegts")
)

// ClientProfileFromCaps refines a base profile with the codec lists the
// client measured itself (canPlayType / MediaSource.isTypeSupported).
// Empty lists keep the base profile's values. HLS copy rules stay those of
// the base profile: they describe the segment pipeline, not the decoder.
func ClientProfileFromCaps(base ClientProfile, vcodecs, acodecs, containers, highBitDepth string) ClientProfile {
	parse := func(raw string, known map[string]bool) map[string]bool {
		if strings.TrimSpace(raw) == "" {
			return nil
		}
		m := map[string]bool{}
		for _, tok := range strings.Split(strings.ToLower(raw), ",") {
			tok = strings.TrimSpace(tok)
			if known[tok] {
				m[tok] = true
			}
		}
		return m
	}
	p := base
	if m := parse(vcodecs, knownVideoCodecs); m != nil {
		p.VideoCodecs = m
	}
	if m := parse(acodecs, knownAudioCodecs); m != nil {
		p.AudioCodecs = m
	}
	if m := parse(containers, knownContainers); m != nil {
		p.Containers = m
	}
	if m := parse(highBitDepth, knownVideoCodecs); m != nil {
		p.HighBitDepth = m
	}
	return p
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

	result.AudioStream = "none"
	audioIdx := 0
	pickedDefault := false
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
			// Prefer the first default-flagged audio track, otherwise the
			// first one. Record which, so HLS maps the same track the
			// decision was made for.
			isDefault := st.Disposition.Default == 1
			if result.AudioCodec == "" || (isDefault && !pickedDefault) {
				result.AudioCodec = strings.ToLower(st.CodecName)
				result.AudioChannels = st.Channels
				result.AudioStream = fmt.Sprintf("0:a:%d", audioIdx)
				pickedDefault = isDefault
			}
			audioIdx++
		}
	}

	return result, nil
}

// EnsureProfile makes sure the media row has stream-profile columns filled.
// Probes at most once per file (single-flight) and persists the result.
func (s *StreamProfileService) EnsureProfile(media *models.Media) error {
	if media.VideoCodec != "" && media.Container != "" && media.AudioStream != "" {
		return nil // already probed
	}

	// single-flight per media ID
	s.mu.Lock()
	if wg, busy := s.inflight[media.ID]; busy {
		s.mu.Unlock()
		wg.Wait()
		// reload the row another goroutine just populated
		var fresh models.Media
		if err := s.db.Select("video_codec", "audio_codec", "audio_channels", "container", "video_width", "video_height", "video_bit_depth", "audio_stream").First(&fresh, media.ID).Error; err == nil {
			media.VideoCodec = fresh.VideoCodec
			media.AudioCodec = fresh.AudioCodec
			media.AudioChannels = fresh.AudioChannels
			media.Container = fresh.Container
			media.VideoWidth = fresh.VideoWidth
			media.VideoHeight = fresh.VideoHeight
			media.VideoBitDepth = fresh.VideoBitDepth
			media.AudioStream = fresh.AudioStream
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
	media.AudioStream = probe.AudioStream
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
		"audio_stream":    probe.AudioStream,
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
	if videoOK && media.VideoBitDepth > 8 && !client.HighBitDepth[media.VideoCodec] {
		videoOK = false
		reasons = append(reasons, fmt.Sprintf("%d-bit %s unsupported", media.VideoBitDepth, media.VideoCodec))
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
	d.VideoMode, d.AudioMode = HLSModes(media, client, videoOK, audioOK)
	return d
}

// HLSModes picks copy vs transcode per track for an HLS session. Copy is
// only used when the client decodes the codec AND the codec is valid in
// MPEG-TS segments for that client.
func HLSModes(media *models.Media, client ClientProfile, videoOK, audioOK bool) (videoMode, audioMode string) {
	videoMode, audioMode = "transcode", "transcode"
	if videoOK && client.HLSVideoCopy[media.VideoCodec] {
		videoMode = "copy" // remux only - nearly free
	}
	if media.AudioCodec == "" || (audioOK && client.HLSAudioCopy[media.AudioCodec]) {
		audioMode = "copy"
	}
	return videoMode, audioMode
}

// BackfillProfiles probes every media row that has no stream profile yet.
// Runs sequentially and throttled so it never competes with playback.
func (s *StreamProfileService) BackfillProfiles() (int, int) {
	var pending []models.Media
	if err := s.db.Where("(video_codec IS NULL OR video_codec = '' OR audio_stream IS NULL OR audio_stream = '') AND deleted_at IS NULL").Find(&pending).Error; err != nil {
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
