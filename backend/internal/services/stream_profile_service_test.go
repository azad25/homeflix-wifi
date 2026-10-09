package services

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"homeflix-backend/internal/models"
)

func TestDecide(t *testing.T) {
	web := WebClientProfile()
	tv := TVClientProfile()
	safari := ClientProfileFromCaps(web, "h264,hevc", "aac,ac3,eac3", "mp4", "hevc")

	cases := []struct {
		name                   string
		media                  models.Media
		client                 ClientProfile
		strategy, video, audio string
	}{
		{"h264 aac mp4 web", models.Media{VideoCodec: "h264", AudioCodec: "aac", Container: "mp4", VideoBitDepth: 8}, web, "direct", "", ""},
		{"h264 ac3 mkv web remuxes", models.Media{VideoCodec: "h264", AudioCodec: "ac3", Container: "matroska", VideoBitDepth: 8}, web, "hls", "copy", "transcode"},
		// VP9 in MPEG-TS never plays in a browser - must transcode, not copy
		{"vp9 mkv web", models.Media{VideoCodec: "vp9", AudioCodec: "opus", Container: "matroska", VideoBitDepth: 8}, web, "hls", "transcode", "transcode"},
		{"10-bit h264 web", models.Media{VideoCodec: "h264", AudioCodec: "aac", Container: "mp4", VideoBitDepth: 10}, web, "hls", "transcode", "copy"},
		{"hevc10 mkv tv direct", models.Media{VideoCodec: "hevc", AudioCodec: "eac3", Container: "matroska", VideoBitDepth: 10}, tv, "direct", "", ""},
		{"10-bit h264 tv transcodes", models.Media{VideoCodec: "h264", AudioCodec: "aac", Container: "matroska", VideoBitDepth: 10}, tv, "hls", "transcode", "copy"},
		{"truehd tv keeps hevc", models.Media{VideoCodec: "hevc", AudioCodec: "truehd", Container: "matroska", VideoBitDepth: 10}, tv, "hls", "copy", "transcode"},
		{"hevc mp4 safari direct", models.Media{VideoCodec: "hevc", AudioCodec: "eac3", Container: "mp4", VideoBitDepth: 10}, safari, "direct", "", ""},
		{"hevc mp4 plain web", models.Media{VideoCodec: "hevc", AudioCodec: "aac", Container: "mp4", VideoBitDepth: 8}, web, "hls", "transcode", "copy"},
		{"silent file", models.Media{VideoCodec: "h264", Container: "matroska", VideoBitDepth: 8}, web, "hls", "copy", "copy"},
	}
	for _, tc := range cases {
		d := Decide(&tc.media, tc.client)
		if d.Strategy != tc.strategy || d.VideoMode != tc.video || d.AudioMode != tc.audio {
			t.Errorf("%s: got %s/%s/%s (%s), want %s/%s/%s", tc.name, d.Strategy, d.VideoMode, d.AudioMode, d.Reason, tc.strategy, tc.video, tc.audio)
		}
	}
}

func TestClientProfileFromCapsIgnoresUnknownTokens(t *testing.T) {
	p := ClientProfileFromCaps(WebClientProfile(), "h264, bogus ,HEVC", "", "", "none")
	if !p.VideoCodecs["h264"] || !p.VideoCodecs["hevc"] || p.VideoCodecs["bogus"] || len(p.VideoCodecs) != 2 {
		t.Fatalf("video codecs = %v", p.VideoCodecs)
	}
	if !p.AudioCodecs["aac"] {
		t.Fatalf("empty acodecs must keep base profile, got %v", p.AudioCodecs)
	}
	if len(p.HighBitDepth) != 0 {
		t.Fatalf("hbd=none must disable high bit depth, got %v", p.HighBitDepth)
	}
}

func requireFFmpeg(t *testing.T) {
	t.Helper()
	for _, bin := range []string{"ffmpeg", "ffprobe"} {
		if _, err := exec.LookPath(bin); err != nil {
			t.Skipf("%s not installed", bin)
		}
	}
}

func ffmpeg(t *testing.T, args ...string) {
	t.Helper()
	out, err := exec.Command("ffmpeg", append([]string{"-v", "error", "-y"}, args...)...).CombinedOutput()
	if err != nil {
		t.Fatalf("ffmpeg %v: %v\n%s", args, err, out)
	}
}

// VP9 + two audio tracks where the SECOND one is the default: the probe
// must describe (and HLS must map) the default track, and a browser must
// get playable H.264/AAC segments.
func TestProbeAndHLSForIncompatibleFile(t *testing.T) {
	requireFFmpeg(t)
	dir := t.TempDir()
	src := filepath.Join(dir, "in.mkv")
	ffmpeg(t,
		"-f", "lavfi", "-i", "testsrc=duration=10:size=320x240:rate=24",
		"-f", "lavfi", "-i", "sine=frequency=300:duration=10",
		"-f", "lavfi", "-i", "sine=frequency=900:duration=10",
		"-map", "0:v", "-map", "1:a", "-map", "2:a",
		"-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "300k",
		"-c:a:0", "mp3", "-ac:a:0", "1", "-c:a:1", "ac3", "-ac:a:1", "2",
		"-disposition:a:0", "0", "-disposition:a:1", "default",
		src)

	probe, err := (&StreamProfileService{}).ProbeFile(src)
	if err != nil {
		t.Fatal(err)
	}
	if probe.VideoCodec != "vp9" || probe.AudioCodec != "ac3" || probe.AudioStream != "0:a:1" || probe.Container != "matroska" {
		t.Fatalf("probe = %+v", probe)
	}

	media := &models.Media{
		FilePath: src, Duration: 10,
		VideoCodec: probe.VideoCodec, AudioCodec: probe.AudioCodec, AudioStream: probe.AudioStream,
		Container: probe.Container, VideoHeight: probe.Height, VideoBitDepth: probe.BitDepth,
	}
	media.ID = 42
	d := Decide(media, WebClientProfile())
	if d.Strategy != "hls" || d.VideoMode != "transcode" || d.AudioMode != "transcode" {
		t.Fatalf("decision = %+v", d)
	}

	hls := &HLSService{baseDir: filepath.Join(dir, "hls"), videoEnc: "libx264", maxSessions: 3, sessions: map[string]*hlsSession{}}
	playlist, err := hls.Playlist(media, d, "profile=web&vcodecs=h264")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(playlist, "seg0.ts?profile=web&vcodecs=h264\n") || !strings.Contains(playlist, "#EXT-X-ENDLIST") {
		t.Fatalf("playlist does not carry the client query:\n%s", playlist)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	seg, err := hls.Segment(ctx, media, d, 1)
	if err != nil {
		t.Fatal(err)
	}
	out, err := exec.Command("ffprobe", "-v", "error", "-show_entries", "stream=codec_name,channels", "-of", "csv=p=0", seg).Output()
	if err != nil {
		t.Fatal(err)
	}
	got := strings.TrimSpace(string(out))
	if !strings.Contains(got, "h264") || !strings.Contains(got, "aac,2") {
		t.Fatalf("segment streams = %q, want h264 + stereo aac", got)
	}

	// A TV client with different modes must get its own session, not reuse
	// the browser transcode
	tvDecision := StreamDecision{Strategy: "hls", VideoMode: "copy", AudioMode: "copy"}
	if _, err := hls.Playlist(media, tvDecision, ""); err != nil {
		t.Fatal(err)
	}
	if n := hls.ActiveSessions(); n != 2 {
		t.Fatalf("sessions = %d, want 2 (one per output mode)", n)
	}

	// A canceled request stops waiting immediately
	canceled, stop := context.WithCancel(context.Background())
	stop()
	if _, err := hls.Segment(canceled, media, tvDecision, 2); err != ErrSegmentWaitCanceled {
		if _, statErr := os.Stat(filepath.Join(hls.baseDir, sessionKey(media.ID, tvDecision), "seg2.ts")); statErr != nil {
			t.Fatalf("canceled wait returned %v", err)
		}
	}
	hls.mu.Lock()
	for _, s := range hls.sessions {
		hls.destroySessionLocked(s)
	}
	hls.mu.Unlock()
}

func TestEncoderArgsGPUPipeline(t *testing.T) {
	s := &HLSService{videoEnc: "h264_nvenc", hwDecode: true, cudaFormatConv: true, nvencPreset: "p4", gpuFailed: map[string]bool{}}
	sess := &hlsSession{filePath: "in.mkv", dir: "d", videoMode: "transcode", audioMode: "transcode",
		audioMap: "0:a:0", height: 2160, videoCodec: "hevc", bitDepth: 10}
	sess.pipeline = s.initialPipeline("hevc", 10)
	if sess.pipeline != pipeGPU {
		t.Fatalf("pipeline = %s, want gpu", sess.pipeline)
	}
	args := strings.Join(s.encoderArgs(sess, 3), " ")
	for _, want := range []string{"-hwaccel cuda -hwaccel_output_format cuda", "-vf scale_cuda=format=yuv420p", "-c:v h264_nvenc", "-maxrate 40M", "-forced-idr 1"} {
		if !strings.Contains(args, want) {
			t.Errorf("args missing %q: %s", want, args)
		}
	}
	for _, bad := range []string{"-pix_fmt", "-level"} {
		if strings.Contains(args, bad) {
			t.Errorf("gpu args must not contain %q: %s", bad, args)
		}
	}

	// Without GPU 10-bit conversion, 10-bit sources start on the hybrid tier
	s.cudaFormatConv = false
	if p := s.initialPipeline("hevc", 10); p != pipeHybrid {
		t.Fatalf("pipeline = %s, want hybrid", p)
	}
	// A combo that failed on the GPU before starts lower
	s.gpuFailed[gpuKey("av1", 8)] = true
	if p := s.initialPipeline("av1", 8); p != pipeHybrid {
		t.Fatalf("pipeline = %s, want hybrid", p)
	}
}

// With a GPU that can't do the job (here: none at all) the encoder must
// step down gpu -> hybrid -> software and still deliver segments.
func TestEncoderFallsBackToSoftware(t *testing.T) {
	requireFFmpeg(t)
	dir := t.TempDir()
	src := filepath.Join(dir, "in.mp4")
	ffmpeg(t, "-f", "lavfi", "-i", "testsrc=duration=10:size=320x240:rate=24",
		"-f", "lavfi", "-i", "sine=duration=10", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", src)

	hls := &HLSService{baseDir: filepath.Join(dir, "hls"), videoEnc: "h264_nvenc", hwDecode: true, nvencPreset: "p4",
		maxSessions: 3, sessions: map[string]*hlsSession{}, gpuFailed: map[string]bool{}}
	media := &models.Media{FilePath: src, Duration: 10, VideoCodec: "h264", AudioCodec: "aac", AudioStream: "0:a:0", Container: "mp4", VideoHeight: 240, VideoBitDepth: 8}
	media.ID = 7
	d := StreamDecision{Strategy: "hls", VideoMode: "transcode", AudioMode: "copy"}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	if _, err := hls.Segment(ctx, media, d, 0); err != nil {
		t.Fatal(err)
	}
	hls.mu.Lock()
	sess := hls.sessions[sessionKey(media.ID, d)]
	hls.mu.Unlock()
	sess.mu.Lock()
	p := sess.pipeline
	sess.mu.Unlock()
	if p != pipeSoftware {
		t.Fatalf("pipeline = %s, want software after fallback", p)
	}
	hls.gpuFailedMu.Lock()
	remembered := hls.gpuFailed[gpuKey("h264", 8)]
	hls.gpuFailedMu.Unlock()
	if !remembered {
		t.Fatal("gpu failure was not remembered")
	}
	hls.mu.Lock()
	hls.destroySessionLocked(sess)
	hls.mu.Unlock()
}
