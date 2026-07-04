package services

import (
	"context"
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
	maxSessions int

	sessions map[uint]*hlsSession
	mu       sync.Mutex
}

type hlsSession struct {
	mediaID   uint
	filePath  string
	duration  float64
	totalSegs int
	videoMode string // "copy" | "transcode"
	audioMode string
	dir       string

	mu         sync.Mutex
	cmd        *exec.Cmd
	cancel     context.CancelFunc
	cmdDone    chan struct{} // closed by the single Wait() owner goroutine
	encStart   int           // segment index the current ffmpeg run started at
	lastAccess time.Time
}

func NewHLSService(baseDir string) *HLSService {
	if baseDir == "" {
		baseDir = "./hls_cache"
	}
	os.MkdirAll(baseDir, 0755)

	s := &HLSService{
		baseDir:     baseDir,
		videoEnc:    detectH264Encoder(),
		hwDecode:    detectNVDec(),
		maxSessions: 3,
		sessions:    make(map[uint]*hlsSession),
	}

	// wipe stale segment dirs from previous runs
	if entries, err := os.ReadDir(baseDir); err == nil {
		for _, e := range entries {
			os.RemoveAll(filepath.Join(baseDir, e.Name()))
		}
	}

	go s.janitor()

	log.Printf("📺 HLS service ready | encoder=%s hwDecode=%v segments=%ds dir=%s",
		s.videoEnc, s.hwDecode, hlsSegmentSeconds, baseDir)
	return s
}

// detectH264Encoder verifies NVENC actually works (driver + GPU present),
// falling back to software x264.
func detectH264Encoder() string {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "ffmpeg", "-v", "error",
		"-f", "lavfi", "-i", "testsrc=duration=0.2:size=320x240:rate=25",
		"-c:v", "h264_nvenc", "-f", "null", "-")
	if err := cmd.Run(); err == nil {
		return "h264_nvenc"
	}
	log.Printf("⚠️ NVENC unavailable, HLS transcoding will use libx264 (CPU)")
	return "libx264"
}

func detectNVDec() bool {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "ffmpeg", "-hide_banner", "-hwaccels").Output()
	return err == nil && strings.Contains(string(out), "cuda")
}

// Playlist returns the full VOD playlist for a media item, creating the
// session (and starting the encoder from segment 0) if needed.
func (s *HLSService) Playlist(media *models.Media, decision StreamDecision) (string, error) {
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

	remaining := sess.duration
	for i := 0; i < sess.totalSegs; i++ {
		d := float64(hlsSegmentSeconds)
		if remaining < d {
			d = remaining
		}
		remaining -= d
		b.WriteString(fmt.Sprintf("#EXTINF:%.3f,\n", d))
		b.WriteString(fmt.Sprintf("seg%d.ts\n", i))
	}
	b.WriteString("#EXT-X-ENDLIST\n")
	return b.String(), nil
}

// Segment returns the path of a ready segment file, restarting the encoder
// at the requested position when the client seeks outside the encoded range.
func (s *HLSService) Segment(media *models.Media, decision StreamDecision, index int) (string, error) {
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
	deadline := time.Now().Add(hlsSegmentWait)
	for time.Now().Before(deadline) {
		if _, err := os.Stat(segPath); err == nil {
			return segPath, nil
		}
		time.Sleep(150 * time.Millisecond)
	}
	return "", fmt.Errorf("timed out waiting for segment %d", index)
}

func (s *HLSService) getOrCreateSession(media *models.Media, decision StreamDecision) (*hlsSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if sess, ok := s.sessions[media.ID]; ok {
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
	dir := filepath.Join(s.baseDir, fmt.Sprintf("m%d", media.ID))
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	sess := &hlsSession{
		mediaID:    media.ID,
		filePath:   media.FilePath,
		duration:   duration,
		totalSegs:  totalSegs,
		videoMode:  decision.VideoMode,
		audioMode:  decision.AudioMode,
		dir:        dir,
		encStart:   -1,
		lastAccess: time.Now(),
	}
	s.sessions[media.ID] = sess

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

	startTime := float64(startSeg * hlsSegmentSeconds)
	ctx, cancel := context.WithCancel(context.Background())

	args := []string{"-v", "error", "-nostdin"}

	// Hardware decode for transcode jobs (NVDEC handles h264/hevc/vp9,
	// including 10-bit HEVC - this is what makes HEVC cheap on this box)
	if sess.videoMode == "transcode" && s.hwDecode && s.videoEnc == "h264_nvenc" {
		args = append(args, "-hwaccel", "cuda")
	}

	if startTime > 0 {
		args = append(args, "-ss", fmt.Sprintf("%.3f", startTime))
	}
	args = append(args, "-i", sess.filePath, "-map", "0:v:0", "-map", "0:a:0?")

	if sess.videoMode == "copy" {
		// Remux: preserve source timestamps so segments align with the
		// synthetic playlist timeline
		args = append(args, "-c:v", "copy", "-copyts")
	} else {
		args = append(args, "-c:v", s.videoEnc)
		if s.videoEnc == "h264_nvenc" {
			args = append(args,
				"-preset", "p4",
				"-rc", "vbr", "-cq", "23",
				"-b:v", "0", "-maxrate", "12M", "-bufsize", "24M",
			)
		} else {
			// software fallback: keep it survivable on 4 cores
			args = append(args, "-preset", "veryfast", "-crf", "23", "-threads", "3")
		}
		args = append(args,
			"-pix_fmt", "yuv420p",
			"-profile:v", "high", "-level", "4.1",
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

	args = append(args,
		"-f", "hls",
		"-hls_time", fmt.Sprintf("%d", hlsSegmentSeconds),
		"-hls_playlist_type", "vod",
		"-hls_flags", "temp_file",
		"-hls_list_size", "0",
		"-start_number", fmt.Sprintf("%d", startSeg),
		"-hls_segment_filename", filepath.Join(sess.dir, "seg%d.ts"),
		filepath.Join(sess.dir, "live.m3u8"),
	)

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
		if err != nil && ctx.Err() == nil {
			log.Printf("⚠️ HLS encoder exited with error: media=%d err=%v (see ffmpeg.log in session dir)", mediaID, err)
		}
		close(done)
	}()

	log.Printf("🎬 HLS encoder started: media=%d from seg%d (t=%.0fs) video=%s audio=%s",
		sess.mediaID, startSeg, startTime, sess.videoMode, sess.audioMode)
	return nil
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
	delete(s.sessions, sess.mediaID)
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
