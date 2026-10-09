package services

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"homeflix-backend/internal/models"
)

const (
	hlsSegmentSeconds = 4
	// how far ahead of the encoder a segment request may be before we
	// kill ffmpeg and restart it at the requested position (a seek)
	hlsSeekAheadSegments = 15 // 60s
	hlsSessionIdle       = 5 * time.Minute
	hlsSegmentWait       = 45 * time.Second
)

// HLSService turns any media file into a seekable HLS stream.
// Video is stream-copied when the client can decode it (near-zero cost) and
// transcoded via NVENC when it can't (HEVC/10-bit -> H.264), keeping the
// 4-core CPU free. Segments are time-based, so seeking works on every file
// regardless of container - this is what byte-range streaming of live
// ffmpeg output could never do.
type HLSService struct {
	baseDir     string
	videoEnc    string // "h264_nvenc" or "libx264"
	hwDecode    bool   // NVDEC available
	nvencPreset string // "p4" on FFmpeg >= 4.3, "medium" on older builds
	// scale_cuda can convert 10-bit to 8-bit on the GPU (FFmpeg >= 5),
	// which lets 10-bit HEVC stay in GPU memory end to end
	cudaFormatConv bool
	maxSessions    int

	// codec/bit-depth combos whose full-GPU pipeline failed at runtime
	// (e.g. no NVDEC support on this card); they start one tier lower
	gpuFailed   map[string]bool
	gpuFailedMu sync.Mutex

	sessions map[string]*hlsSession
	mu       sync.Mutex
}

type hlsSession struct {
	key        string
	mediaID    uint
	filePath   string
	audioMap   string // ffmpeg map spec for the audio track, "" for none
	height     int
	videoCodec string
	bitDepth   int
	pipeline   pipeline // transcode tier; steps down when ffmpeg fails
	duration   float64
	totalSegs  int
	videoMode  string // "copy" | "transcode"
	audioMode  string
	dir        string

	mu         sync.Mutex
	cmd        *exec.Cmd
	cancel     context.CancelFunc
	cmdDone    chan struct{} // closed by the single Wait() owner goroutine
	encStart   int           // segment index the current ffmpeg run started at
	lastAccess time.Time
}

// pipeline is the video transcode tier, fastest first.
type pipeline int

const (
	// NVDEC decodes into GPU memory, scale_cuda converts if needed, NVENC
	// encodes: frames never touch system RAM, CPU only handles audio
	pipeGPU pipeline = iota
	// NVDEC decode, frames copied to RAM for pixel-format conversion on the
	// CPU, NVENC encode
	pipeHybrid
	// libx264 on the CPU, capped at 1080p
	pipeSoftware
)

func (p pipeline) String() string {
	return [...]string{"gpu", "hybrid", "software"}[p]
}

func NewHLSService(baseDir string) *HLSService {
	if baseDir == "" {
		baseDir = "./hls_cache"
	}
	os.MkdirAll(baseDir, 0755)

	s := &HLSService{
		baseDir:     baseDir,
		videoEnc:    "libx264",
		maxSessions: 3,
		sessions:    make(map[string]*hlsSession),
		gpuFailed:   make(map[string]bool),
	}
	if preset, ok := detectNVENC(); ok {
		s.videoEnc = "h264_nvenc"
		s.nvencPreset = preset
		s.hwDecode = detectNVDec()
		if s.hwDecode {
			s.cudaFormatConv = detectCudaFormatConversion()
		}
	} else {
		log.Printf("⚠️ NVENC unavailable, HLS transcoding will use libx264 (CPU)")
	}

	// wipe stale segment dirs from previous runs
	if entries, err := os.ReadDir(baseDir); err == nil {
		for _, e := range entries {
			os.RemoveAll(filepath.Join(baseDir, e.Name()))
		}
	}

	go s.janitor()

	log.Printf("📺 HLS service ready | encoder=%s hwDecode=%v gpu10bit=%v segments=%ds dir=%s",
		s.videoEnc, s.hwDecode, s.cudaFormatConv, hlsSegmentSeconds, baseDir)
	return s
}

func ffmpegWorks(args ...string) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return exec.CommandContext(ctx, "ffmpeg", append([]string{"-v", "error", "-nostdin"}, args...)...).Run() == nil
}

// detectNVENC verifies NVENC actually works (driver + GPU present) and
// finds a preset name this FFmpeg build accepts.
func detectNVENC() (preset string, ok bool) {
	for _, preset := range []string{"p4", "medium"} {
		if ffmpegWorks("-f", "lavfi", "-i", "testsrc=duration=0.2:size=320x240:rate=25",
			"-c:v", "h264_nvenc", "-preset", preset, "-f", "null", "-") {
			return preset, true
		}
	}
	return "", false
}

// detectCudaFormatConversion checks that a 10-bit frame can be converted to
// 8-bit and encoded without leaving the GPU.
func detectCudaFormatConversion() bool {
	return ffmpegWorks("-init_hw_device", "cuda=gpu", "-filter_hw_device", "gpu",
		"-f", "lavfi", "-i", "testsrc=duration=0.2:size=320x240:rate=25",
		"-vf", "format=p010le,hwupload,scale_cuda=format=yuv420p",
		"-c:v", "h264_nvenc", "-f", "null", "-")
}

func gpuKey(codec string, bitDepth int) string {
	return fmt.Sprintf("%s:%d", codec, bitDepth)
}

// initialPipeline picks the fastest tier expected to work for a source.
func (s *HLSService) initialPipeline(codec string, bitDepth int) pipeline {
	if s.videoEnc != "h264_nvenc" {
		return pipeSoftware
	}
	if !s.hwDecode {
		return pipeHybrid
	}
	if bitDepth > 8 && !s.cudaFormatConv {
		return pipeHybrid
	}
	s.gpuFailedMu.Lock()
	failed := s.gpuFailed[gpuKey(codec, bitDepth)]
	s.gpuFailedMu.Unlock()
	if failed {
		return pipeHybrid
	}
	return pipeGPU
}

func detectNVDec() bool {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "ffmpeg", "-hide_banner", "-hwaccels").Output()
	return err == nil && strings.Contains(string(out), "cuda")
}

// ErrSegmentWaitCanceled is returned when the client stops waiting for a
// segment (seeked elsewhere or closed the player).
var ErrSegmentWaitCanceled = errors.New("segment request canceled")

// sessionKey separates encodes of the same file with different output
// modes, so a TV remux and a browser transcode never share segments.
func sessionKey(mediaID uint, d StreamDecision) string {
	return fmt.Sprintf("m%d-v%s-a%s", mediaID, d.VideoMode, d.AudioMode)
}

// Playlist returns the full VOD playlist for a media item, creating the
// session if needed. segmentQuery (raw, without "?") is appended to every
// segment URI so segment requests resolve the same client profile as the
// playlist request did.
func (s *HLSService) Playlist(media *models.Media, decision StreamDecision, segmentQuery string) (string, error) {
	sess, err := s.getOrCreateSession(media, decision)
	if err != nil {
		return "", err
	}

	sess.mu.Lock()
	sess.lastAccess = time.Now()
	sess.mu.Unlock()

	var b strings.Builder
	b.WriteString("#EXTM3U\n")
	b.WriteString("#EXT-X-VERSION:3\n")
	b.WriteString(fmt.Sprintf("#EXT-X-TARGETDURATION:%d\n", hlsSegmentSeconds+1))
	b.WriteString("#EXT-X-MEDIA-SEQUENCE:0\n")
	b.WriteString("#EXT-X-PLAYLIST-TYPE:VOD\n")

	suffix := ""
	if segmentQuery != "" {
		suffix = "?" + segmentQuery
	}
	remaining := sess.duration
	for i := 0; i < sess.totalSegs; i++ {
		d := float64(hlsSegmentSeconds)
		if remaining < d {
			d = remaining
		}
		remaining -= d
		b.WriteString(fmt.Sprintf("#EXTINF:%.3f,\n", d))
		b.WriteString(fmt.Sprintf("seg%d.ts%s\n", i, suffix))
	}
	b.WriteString("#EXT-X-ENDLIST\n")
	return b.String(), nil
}

// Segment returns the path of a ready segment file, restarting the encoder
// at the requested position when the client seeks outside the encoded range.
// It stops waiting as soon as ctx is canceled (client gone).
func (s *HLSService) Segment(ctx context.Context, media *models.Media, decision StreamDecision, index int) (string, error) {
	sess, err := s.getOrCreateSession(media, decision)
	if err != nil {
		return "", err
	}
	if index < 0 || index >= sess.totalSegs {
		return "", fmt.Errorf("segment %d out of range (0-%d)", index, sess.totalSegs-1)
	}

	sess.mu.Lock()
	sess.lastAccess = time.Now()
	segPath := filepath.Join(sess.dir, fmt.Sprintf("seg%d.ts", index))

	if _, err := os.Stat(segPath); err == nil {
		sess.mu.Unlock()
		return segPath, nil
	}

	// Segment not ready. Decide whether the encoder will reach it soon or
	// whether this is a seek that needs a restart.
	ready := sess.highestReadyLocked()
	needRestart := sess.cmd == nil ||
		index < sess.encStart ||
		index > ready+hlsSeekAheadSegments

	if needRestart {
		if err := s.startEncoderLocked(sess, index); err != nil {
			sess.mu.Unlock()
			return "", err
		}
	}
	sess.mu.Unlock()

	// Wait for the segment to appear (temp_file flag means existence == complete)
	timeout := time.NewTimer(hlsSegmentWait)
	defer timeout.Stop()
	poll := time.NewTicker(100 * time.Millisecond)
	defer poll.Stop()
	for {
		if _, err := os.Stat(segPath); err == nil {
			sess.mu.Lock()
			sess.lastAccess = time.Now()
			sess.mu.Unlock()
			return segPath, nil
		}
		select {
		case <-ctx.Done():
			return "", ErrSegmentWaitCanceled
		case <-timeout.C:
			return "", fmt.Errorf("timed out waiting for segment %d", index)
		case <-poll.C:
		}
	}
}

func (s *HLSService) getOrCreateSession(media *models.Media, decision StreamDecision) (*hlsSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	key := sessionKey(media.ID, decision)
	if sess, ok := s.sessions[key]; ok {
		return sess, nil
	}

	if len(s.sessions) >= s.maxSessions {
		if !s.evictIdleLocked() {
			return nil, fmt.Errorf("too many active streams (%d), try again shortly", s.maxSessions)
		}
	}

	duration := float64(media.Duration)
	if duration <= 0 {
		return nil, fmt.Errorf("media %d has no known duration", media.ID)
	}

	totalSegs := int(duration)/hlsSegmentSeconds + 1
	dir := filepath.Join(s.baseDir, key)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	audioMap := "0:a:0?" // rows probed before audio_stream existed
	switch media.AudioStream {
	case "none":
		audioMap = ""
	case "":
	default:
		audioMap = media.AudioStream
	}

	sess := &hlsSession{
		key:        key,
		mediaID:    media.ID,
		audioMap:   audioMap,
		height:     media.VideoHeight,
		videoCodec: media.VideoCodec,
		bitDepth:   media.VideoBitDepth,
		pipeline:   s.initialPipeline(media.VideoCodec, media.VideoBitDepth),
		filePath:   media.FilePath,
		duration:   duration,
		totalSegs:  totalSegs,
		videoMode:  decision.VideoMode,
		audioMode:  decision.AudioMode,
		dir:        dir,
		encStart:   -1,
		lastAccess: time.Now(),
	}
	s.sessions[key] = sess

	log.Printf("📺 HLS session created: media=%d video=%s audio=%s segs=%d (%s)",
		media.ID, decision.VideoMode, decision.AudioMode, totalSegs, filepath.Base(media.FilePath))
	return sess, nil
}

// startEncoderLocked (re)starts ffmpeg at the given segment index.
// Caller must hold sess.mu.
func (s *HLSService) startEncoderLocked(sess *hlsSession, startSeg int) error {
	if sess.cancel != nil {
		sess.cancel()
		// Wait for the previous run's single Wait() owner to reap the
		// process. NEVER call cmd.Wait() here - a second concurrent Wait
		// blocks forever (this deadlocked the whole session once).
		if sess.cmdDone != nil {
			select {
			case <-sess.cmdDone:
			case <-time.After(5 * time.Second):
				log.Printf("⚠️ HLS media=%d: previous encoder did not exit within 5s", sess.mediaID)
			}
		}
	}

	ctx, cancel := context.WithCancel(context.Background())
	args := s.encoderArgs(sess, startSeg)
	cmd := exec.CommandContext(ctx, "ffmpeg", args...)

	// Capture ffmpeg stderr so silent encoder deaths are diagnosable
	logFile, _ := os.Create(filepath.Join(sess.dir, "ffmpeg.log"))
	if logFile != nil {
		cmd.Stderr = logFile
	}

	if err := cmd.Start(); err != nil {
		cancel()
		if logFile != nil {
			logFile.Close()
		}
		return fmt.Errorf("failed to start HLS encoder: %v", err)
	}

	done := make(chan struct{})
	sess.cmd = cmd
	sess.cancel = cancel
	sess.cmdDone = done
	sess.encStart = startSeg

	// Single owner of cmd.Wait() for this run
	mediaID := sess.mediaID
	go func() {
		err := cmd.Wait()
		if logFile != nil {
			logFile.Close()
		}
		close(done)
		if err != nil && ctx.Err() == nil {
			log.Printf("⚠️ HLS encoder exited with error: media=%d err=%v (see ffmpeg.log in session dir)", mediaID, err)
			s.encoderFailed(sess, done)
		}
	}()

	pipe := "-"
	if sess.videoMode == "transcode" {
		pipe = sess.pipeline.String()
	}
	log.Printf("🎬 HLS encoder started: media=%d from seg%d (t=%ds) video=%s(%s) audio=%s",
		sess.mediaID, startSeg, startSeg*hlsSegmentSeconds, sess.videoMode, pipe, sess.audioMode)
	return nil
}

// encoderFailed steps a transcode down one pipeline tier and resumes from
// the first segment not yet written, so a GPU problem (codec NVDEC can't
// decode, NVENC session limit, missing filter) costs a few seconds instead
// of a dead stream.
func (s *HLSService) encoderFailed(sess *hlsSession, run chan struct{}) {
	sess.mu.Lock()
	defer sess.mu.Unlock()
	if sess.cmdDone != run || sess.videoMode != "transcode" || sess.pipeline == pipeSoftware {
		return // superseded by a seek, or nothing left to fall back to
	}
	if sess.pipeline == pipeGPU {
		s.gpuFailedMu.Lock()
		s.gpuFailed[gpuKey(sess.videoCodec, sess.bitDepth)] = true
		s.gpuFailedMu.Unlock()
	}
	if sess.pipeline == pipeHybrid && s.videoEnc != "h264_nvenc" {
		return
	}
	sess.pipeline++
	resume := sess.highestReadyLocked() + 1
	if resume < sess.encStart {
		resume = sess.encStart
	}
	if resume >= sess.totalSegs {
		return
	}
	log.Printf("↘️ HLS media=%d: falling back to %s pipeline at seg%d", sess.mediaID, sess.pipeline, resume)
	if err := s.startEncoderLocked(sess, resume); err != nil {
		log.Printf("❌ HLS media=%d: fallback failed: %v", sess.mediaID, err)
	}
}

// encoderArgs builds the ffmpeg command line for one encoder run.
func (s *HLSService) encoderArgs(sess *hlsSession, startSeg int) []string {
	startTime := float64(startSeg * hlsSegmentSeconds)
	transcode := sess.videoMode == "transcode"
	args := []string{"-v", "error", "-nostdin"}

	if transcode {
		switch sess.pipeline {
		case pipeGPU:
			args = append(args, "-hwaccel", "cuda", "-hwaccel_output_format", "cuda")
		case pipeHybrid:
			if s.hwDecode {
				args = append(args, "-hwaccel", "cuda")
			}
		}
	}

	if startTime > 0 {
		args = append(args, "-ss", fmt.Sprintf("%.3f", startTime))
	}
	args = append(args, "-i", sess.filePath, "-map", "0:v:0")
	if sess.audioMap != "" {
		args = append(args, "-map", sess.audioMap)
	}

	if !transcode {
		// Remux: preserve source timestamps so segments align with the
		// synthetic playlist timeline
		args = append(args, "-c:v", "copy", "-copyts")
	} else {
		switch sess.pipeline {
		case pipeGPU, pipeHybrid:
			maxrate, bufsize := "12M", "24M"
			if sess.height > 1080 {
				maxrate, bufsize = "40M", "80M" // 4K output; LAN has room
			}
			if sess.pipeline == pipeGPU && sess.bitDepth > 8 {
				// 10-bit -> 8-bit on the GPU; 8-bit frames go to NVENC as is
				args = append(args, "-vf", "scale_cuda=format=yuv420p")
			}
			args = append(args, "-c:v", "h264_nvenc",
				"-preset", s.nvencPreset,
				"-rc", "vbr", "-cq", "23",
				"-b:v", "0", "-maxrate", maxrate, "-bufsize", bufsize,
				"-profile:v", "high",
				// keyframes forced below must be IDR to start a segment
				"-forced-idr", "1",
			)
			if sess.pipeline == pipeHybrid {
				args = append(args, "-pix_fmt", "yuv420p")
			}
			// No -level: NVENC picks one that fits the resolution (a fixed
			// 4.1 is invalid for 4K output)
		default:
			// software: keep it survivable on 4 cores. x264 cannot encode
			// 4K in real time on a small CPU, which shows up as endless
			// buffering - cap the output at 1080p.
			args = append(args, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-threads", "3")
			if sess.height > 1080 {
				args = append(args, "-vf", "scale=-2:1080")
			}
			args = append(args, "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1")
		}
		args = append(args,
			// exact 4s keyframes so segment boundaries match the playlist
			"-force_key_frames", fmt.Sprintf("expr:gte(t,n_forced*%d)", hlsSegmentSeconds),
			"-output_ts_offset", fmt.Sprintf("%.3f", startTime),
		)
	}

	if sess.audioMode == "copy" {
		args = append(args, "-c:a", "copy")
	} else {
		args = append(args, "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "48000")
	}

	return append(args,
		"-f", "hls",
		"-hls_time", fmt.Sprintf("%d", hlsSegmentSeconds),
		"-hls_playlist_type", "vod",
		"-hls_flags", "temp_file",
		"-hls_list_size", "0",
		"-start_number", fmt.Sprintf("%d", startSeg),
		"-hls_segment_filename", filepath.Join(sess.dir, "seg%d.ts"),
		filepath.Join(sess.dir, "live.m3u8"),
	)
}

// highestReadyLocked finds the highest contiguous ready segment of the
// current encoder run via binary search (segments are written in order).
// Caller must hold sess.mu.
func (sess *hlsSession) highestReadyLocked() int {
	if sess.encStart < 0 {
		return -1
	}
	lo, hi := sess.encStart, sess.totalSegs-1
	if _, err := os.Stat(filepath.Join(sess.dir, fmt.Sprintf("seg%d.ts", lo))); err != nil {
		return sess.encStart - 1 // nothing ready yet
	}
	for lo < hi {
		mid := (lo + hi + 1) / 2
		if _, err := os.Stat(filepath.Join(sess.dir, fmt.Sprintf("seg%d.ts", mid))); err == nil {
			lo = mid
		} else {
			hi = mid - 1
		}
	}
	return lo
}

// evictIdleLocked kills the least-recently-used session that has been idle
// for at least 30s. Caller must hold s.mu.
func (s *HLSService) evictIdleLocked() bool {
	var oldest *hlsSession
	for _, sess := range s.sessions {
		sess.mu.Lock()
		idle := time.Since(sess.lastAccess)
		sess.mu.Unlock()
		if idle < 30*time.Second {
			continue
		}
		if oldest == nil || sess.lastAccess.Before(oldest.lastAccess) {
			oldest = sess
		}
	}
	if oldest == nil {
		return false
	}
	s.destroySessionLocked(oldest)
	return true
}

func (s *HLSService) destroySessionLocked(sess *hlsSession) {
	sess.mu.Lock()
	if sess.cancel != nil {
		sess.cancel()
	}
	sess.mu.Unlock()
	delete(s.sessions, sess.key)
	os.RemoveAll(sess.dir)
	log.Printf("🧹 HLS session destroyed: media=%d", sess.mediaID)
}

func (s *HLSService) janitor() {
	ticker := time.NewTicker(time.Minute)
	for range ticker.C {
		s.mu.Lock()
		for _, sess := range s.sessions {
			sess.mu.Lock()
			idle := time.Since(sess.lastAccess)
			sess.mu.Unlock()
			if idle > hlsSessionIdle {
				s.destroySessionLocked(sess)
			}
		}
		s.mu.Unlock()
	}
}

// ActiveSessions returns the number of live HLS sessions (for /info & admin).
func (s *HLSService) ActiveSessions() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.sessions)
}
