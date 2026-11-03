package comingsoon

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// Video is a downloaded, re-encoded trailer ready for web and TV playback:
// H.264 High (level 4.1) up to 1080p + AAC stereo in MP4 with faststart, so
// browsers, Android TV / ExoPlayer and Chromecast all play it directly.
type Video struct {
	File     string  `json:"file"`
	Bytes    int64   `json:"bytes"`
	Duration float64 `json:"duration"`
	Width    int     `json:"width"`
	Height   int     `json:"height"`
}

// ytdlpPath: $HOMEFLIX_YTDLP, else yt-dlp on PATH ("" if missing).
func ytdlpPath() string {
	if p := strings.TrimSpace(os.Getenv("HOMEFLIX_YTDLP")); p != "" {
		return p
	}
	p, _ := exec.LookPath("yt-dlp")
	return p
}

func ytdlpVersion(bin string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, bin, "--version").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func run(ctx context.Context, name string, args ...string) error {
	cmd := exec.CommandContext(ctx, name, args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if len(msg) > 300 {
			msg = msg[len(msg)-300:]
		}
		return fmt.Errorf("%s: %v: %s", filepath.Base(name), err, msg)
	}
	return nil
}

// download fetches the trailer (best ≤1080p) into dir and returns the file.
func download(ctx context.Context, bin, youtubeID, dir string) (string, error) {
	out := filepath.Join(dir, "src.%(ext)s")
	err := run(ctx, bin,
		"--no-playlist", "--no-progress", "--no-warnings", "--quiet",
		"-f", "bv*[height<=1080][vcodec^=avc1]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]/b",
		"--merge-output-format", "mkv",
		"--max-filesize", "1500M",
		"-o", out,
		"https://www.youtube.com/watch?v="+youtubeID)
	if err != nil {
		return "", err
	}
	matches, _ := filepath.Glob(filepath.Join(dir, "src.*"))
	for _, m := range matches {
		if !strings.HasSuffix(m, ".part") {
			return m, nil
		}
	}
	return "", fmt.Errorf("yt-dlp produced no file")
}

type probed struct {
	Duration float64
	Width    int
	Height   int
}

func probe(ctx context.Context, file string) (probed, error) {
	out, err := exec.CommandContext(ctx, "ffprobe", "-v", "error", "-select_streams", "v:0",
		"-show_entries", "stream=width,height:format=duration", "-of", "json", file).Output()
	if err != nil {
		return probed{}, fmt.Errorf("ffprobe: %v", err)
	}
	var r struct {
		Streams []struct{ Width, Height int }
		Format  struct {
			Duration string `json:"duration"`
		} `json:"format"`
	}
	if err := json.Unmarshal(out, &r); err != nil || len(r.Streams) == 0 {
		return probed{}, fmt.Errorf("no video stream")
	}
	d, _ := strconv.ParseFloat(r.Format.Duration, 64)
	return probed{Duration: d, Width: r.Streams[0].Width, Height: r.Streams[0].Height}, nil
}

// videoKbps: the video bitrate that fits `budget` bytes for `dur` seconds
// with 128 kb/s audio, kept between 1.2 and 6 Mb/s.
func videoKbps(budget int64, dur float64) int {
	if dur <= 0 {
		dur = 150
	}
	k := int(float64(budget)*8/1000/dur*0.96) - 128
	if k > 6000 {
		k = 6000
	}
	if k < 1200 {
		k = 1200
	}
	return k
}

// encode re-encodes src to dst within about `budget` bytes. Quality-first
// (CRF 20) with a bitrate cap, so simple scenes use less and busy ones
// don't overshoot. Trailers longer than 5 minutes are cut at 5 minutes.
func encode(ctx context.Context, src, dst string, budget int64) (Video, error) {
	p, err := probe(ctx, src)
	if err != nil {
		return Video{}, err
	}
	dur := p.Duration
	if dur > 300 {
		dur = 300
	}
	kbps := videoKbps(budget, dur)
	try := func(kbps int) error {
		return run(ctx, "nice", "-n", "15", "ffmpeg", "-nostdin", "-hide_banner", "-v", "error", "-y",
			"-i", src, "-t", fmt.Sprintf("%.2f", dur),
			"-map", "0:v:0", "-map", "0:a:0?",
			"-vf", "scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
			"-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-level", "4.1",
			"-crf", "20", "-maxrate", fmt.Sprintf("%dk", kbps), "-bufsize", fmt.Sprintf("%dk", kbps*2),
			"-g", "48", "-keyint_min", "24",
			"-c:a", "aac", "-b:a", "128k", "-ac", "2", "-ar", "48000",
			"-movflags", "+faststart", "-map_metadata", "-1", "-sn", "-dn",
			dst)
	}
	if err := try(kbps); err != nil {
		return Video{}, err
	}
	fi, err := os.Stat(dst)
	if err == nil && fi.Size() > budget*115/100 { // rare: squeeze once more
		if err := try(kbps * 80 / 100); err != nil {
			return Video{}, err
		}
		fi, err = os.Stat(dst)
	}
	if err != nil {
		return Video{}, err
	}
	out, err := probe(ctx, dst)
	if err != nil {
		return Video{}, err
	}
	return Video{File: filepath.Base(dst), Bytes: fi.Size(), Duration: out.Duration, Width: out.Width, Height: out.Height}, nil
}
