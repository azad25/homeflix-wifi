package previews

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Clip format. Hover previews are shown in cards and the hero at most a
// few hundred pixels tall (the hero upscales fine from 720p): 720p H.264 at
// CRF 26 is ~1-2 MB for 12 s, against 4-6 MB for the old padded 1080p clips,
// and it encodes 3-4x faster.
const (
	clipSeconds = 12
	maxWidth    = 1280
	maxHeight   = 720
)

type probeInfo struct {
	Duration float64
	HDR      bool
	HasAudio bool
	HasVideo bool
}

func probe(ctx context.Context, src string) (probeInfo, error) {
	ctx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "ffprobe", "-v", "error",
		"-show_entries", "format=duration:stream=codec_type,color_transfer",
		"-of", "json", src).Output()
	if err != nil {
		return probeInfo{}, fmt.Errorf("ffprobe: %w", err)
	}
	var r struct {
		Format struct {
			Duration string `json:"duration"`
		} `json:"format"`
		Streams []struct {
			CodecType     string `json:"codec_type"`
			ColorTransfer string `json:"color_transfer"`
		} `json:"streams"`
	}
	if err := json.Unmarshal(out, &r); err != nil {
		return probeInfo{}, err
	}
	var p probeInfo
	p.Duration, _ = strconv.ParseFloat(r.Format.Duration, 64)
	for _, s := range r.Streams {
		switch s.CodecType {
		case "video":
			if !p.HasVideo {
				p.HasVideo = true
				p.HDR = s.ColorTransfer == "smpte2084" || s.ColorTransfer == "arib-std-b67"
			}
		case "audio":
			p.HasAudio = true
		}
	}
	if !p.HasVideo {
		return p, fmt.Errorf("no video stream")
	}
	return p, nil
}

// candidates: where to look for a good scene. Skips the opening (logos,
// recaps, intros) and the end (credits, spoilers).
func candidates(duration float64) []float64 {
	if duration <= clipSeconds+4 {
		return []float64{0}
	}
	if duration < 180 {
		return []float64{duration * 0.3}
	}
	var out []float64
	for _, f := range []float64{0.24, 0.37, 0.5, 0.63} {
		out = append(out, duration*f)
	}
	return out
}

var (
	reYAVG = regexp.MustCompile(`lavfi\.signalstats\.YAVG=([0-9.]+)`)
	reSAT  = regexp.MustCompile(`lavfi\.signalstats\.SATAVG=([0-9.]+)`)
	reYDIF = regexp.MustCompile(`lavfi\.signalstats\.YDIF=([0-9.]+)`)
)

// sceneScore rates ~1.5 s of video starting at t: bright enough, colourful
// and moving beats dark, grey and static (black frames, title cards,
// talking heads in the dark). -1 if the sample can't be read.
func sceneScore(ctx context.Context, src string, t float64) float64 {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "ffmpeg", "-nostdin", "-hide_banner", "-v", "error",
		"-ss", fmt.Sprintf("%.2f", t), "-i", src, "-t", "1.5", "-an", "-sn",
		"-vf", "fps=2,scale=160:-2,signalstats,metadata=mode=print:file=-",
		"-f", "null", "-")
	out, err := cmd.Output()
	if err != nil {
		return -1
	}
	mean := func(re *regexp.Regexp) (float64, int) {
		var sum float64
		m := re.FindAllSubmatch(out, -1)
		for _, x := range m {
			v, _ := strconv.ParseFloat(string(x[1]), 64)
			sum += v
		}
		if len(m) == 0 {
			return 0, 0
		}
		return sum / float64(len(m)), len(m)
	}
	y, n := mean(reYAVG)
	if n == 0 {
		return -1
	}
	sat, _ := mean(reSAT)
	motion, _ := mean(reYDIF)
	score := 0.0
	switch {
	case y < 28: // near black
		score -= 100
	case y > 215: // white flash / title card
		score -= 40
	default:
		score += 60 - absf(y-110)/2
	}
	score += minf(sat, 60) * 0.6
	score += minf(motion, 20) * 1.5
	return score
}

func absf(v float64) float64 {
	if v < 0 {
		return -v
	}
	return v
}

func minf(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

// pickStart samples candidate scenes and returns the most watchable one.
func pickStart(ctx context.Context, src string, duration float64) float64 {
	cs := candidates(duration)
	if len(cs) == 1 {
		return cs[0]
	}
	best, bestScore := cs[0], -1e9
	for _, t := range cs {
		if s := sceneScore(ctx, src, t); s > bestScore {
			best, bestScore = t, s
		}
	}
	return best
}

type encodeOpts struct {
	Start    float64
	Length   float64
	HDR      bool
	HasAudio bool
	Tonemap  bool   // zscale available
	HWAccel  string // "cuda" or ""
}

func videoFilter(o encodeOpts) string {
	scale := fmt.Sprintf("scale=w='min(%d,iw)':h='min(%d,ih)':force_original_aspect_ratio=decrease", maxWidth, maxHeight)
	vf := scale + ",scale=trunc(iw/2)*2:trunc(ih/2)*2"
	if o.HDR && o.Tonemap {
		// HDR10/HLG: tone-map to SDR, otherwise the clip looks washed out
		vf += ",zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv"
	}
	return vf + ",format=yuv420p"
}

func encodeArgs(src, dst string, o encodeOpts) []string {
	args := []string{"-nostdin", "-hide_banner", "-v", "error", "-y"}
	if o.HWAccel != "" {
		args = append(args, "-hwaccel", o.HWAccel) // decode only; frames come back to RAM
	}
	args = append(args,
		"-ss", fmt.Sprintf("%.2f", o.Start), "-i", src, "-t", fmt.Sprintf("%.2f", o.Length),
		"-map", "0:v:0")
	if o.HasAudio {
		args = append(args, "-map", "0:a:0?")
	}
	args = append(args,
		"-sn", "-dn", "-map_metadata", "-1", "-map_chapters", "-1",
		"-vf", videoFilter(o),
		"-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
		"-maxrate", "2500k", "-bufsize", "5000k", "-profile:v", "high", "-g", "48")
	if o.HasAudio {
		args = append(args, "-c:a", "aac", "-b:a", "96k", "-ac", "2")
	}
	return append(args, "-movflags", "+faststart", "-f", "mp4", dst)
}

// encode writes the clip to dst (an mp4). Low CPU/IO priority so playback
// always wins; GPU decoding is tried first when available.
func encode(ctx context.Context, src, dst string, o encodeOpts) error {
	run := func(o encodeOpts) error {
		ctx, cancel := context.WithTimeout(ctx, 4*time.Minute)
		defer cancel()
		cmd := niceCommand(ctx, "ffmpeg", encodeArgs(src, dst, o)...)
		var stderr bytes.Buffer
		cmd.Stderr = &stderr
		if err := cmd.Run(); err != nil {
			msg := strings.TrimSpace(stderr.String())
			if len(msg) > 300 {
				msg = msg[len(msg)-300:]
			}
			return fmt.Errorf("ffmpeg: %v: %s", err, msg)
		}
		fi, err := os.Stat(dst)
		if err != nil || fi.Size() < 1024 {
			return fmt.Errorf("ffmpeg produced no clip")
		}
		return nil
	}
	err := run(o)
	if err != nil && o.HWAccel != "" {
		o.HWAccel = ""
		err = run(o)
	}
	return err
}

func niceCommand(ctx context.Context, name string, args ...string) *exec.Cmd {
	if p, err := exec.LookPath("ionice"); err == nil {
		if _, err := exec.LookPath("nice"); err == nil {
			return exec.CommandContext(ctx, p, append([]string{"-c", "3", "nice", "-n", "15", name}, args...)...)
		}
	}
	return exec.CommandContext(ctx, name, args...)
}

func hasFilter(name string) bool {
	out, err := exec.Command("ffmpeg", "-hide_banner", "-filters").Output()
	return err == nil && bytes.Contains(out, []byte(" "+name+" "))
}

func hasCUDA() bool {
	if _, err := os.Stat("/dev/nvidia0"); err != nil {
		return false
	}
	out, err := exec.Command("ffmpeg", "-hide_banner", "-hwaccels").Output()
	return err == nil && bytes.Contains(out, []byte("cuda"))
}
