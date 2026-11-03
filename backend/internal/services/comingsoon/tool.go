package comingsoon

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

// HomeFlix manages its own yt-dlp: the official standalone build is
// downloaded from GitHub into <data>/bin, verified against the release's
// SHA-256 checksums, and updated weekly. YouTube changes often and distro
// packages fall behind, so the managed copy is preferred over a system one.

var ytdlpBaseURL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/"

// ytdlpAsset: the standalone build for this OS/CPU ("" if there is none).
func ytdlpAsset() string {
	switch runtime.GOOS + "/" + runtime.GOARCH {
	case "linux/amd64":
		return "yt-dlp_linux"
	case "linux/arm64":
		return "yt-dlp_linux_aarch64"
	case "linux/arm":
		return "yt-dlp_linux_armv7l"
	case "darwin/amd64", "darwin/arm64":
		return "yt-dlp_macos"
	}
	return ""
}

// ToolStatus is reported in Settings.
type ToolStatus struct {
	Path       string    `json:"path,omitempty"`
	Source     string    `json:"source,omitempty"` // managed | system | env
	Version    string    `json:"version,omitempty"`
	Installing bool      `json:"installing,omitempty"`
	CheckedAt  time.Time `json:"checked_at,omitempty"`
	Error      string    `json:"error,omitempty"`
}

type tool struct {
	dir    string // <data>/bin
	client *http.Client

	mu     sync.Mutex
	status ToolStatus
}

func newTool(dataDir string) *tool {
	return &tool{dir: filepath.Join(dataDir, "bin"), client: &http.Client{Timeout: 5 * time.Minute}}
}

func (t *tool) managedPath() string { return filepath.Join(t.dir, "yt-dlp") }

func executable(p string) bool {
	fi, err := os.Stat(p)
	return err == nil && fi.Mode().IsRegular() && fi.Mode()&0o111 != 0
}

// path: $HOMEFLIX_YTDLP, then the managed copy, then yt-dlp on PATH.
func (t *tool) path() (string, string) {
	if p := strings.TrimSpace(os.Getenv("HOMEFLIX_YTDLP")); p != "" {
		return p, "env"
	}
	if executable(t.managedPath()) {
		return t.managedPath(), "managed"
	}
	if p, err := exec.LookPath("yt-dlp"); err == nil {
		return p, "system"
	}
	return "", ""
}

func (t *tool) Status() ToolStatus {
	t.mu.Lock()
	st := t.status
	t.mu.Unlock()
	st.Path, st.Source = t.path()
	if st.Path != "" && st.Version == "" {
		st.Version = ytdlpVersion(st.Path)
	}
	return st
}

func (t *tool) setErr(err error) {
	t.mu.Lock()
	t.status.Error = ""
	if err != nil {
		t.status.Error = err.Error()
	}
	t.status.CheckedAt = time.Now()
	t.mu.Unlock()
}

// Ensure installs the managed copy if missing, or updates it when older than
// a week (force: always check for an update now).
func (t *tool) Ensure(ctx context.Context, force bool) error {
	t.mu.Lock()
	if t.status.Installing {
		t.mu.Unlock()
		return nil
	}
	t.status.Installing = true
	t.mu.Unlock()
	defer func() {
		t.mu.Lock()
		t.status.Installing = false
		t.mu.Unlock()
	}()
	if p := strings.TrimSpace(os.Getenv("HOMEFLIX_YTDLP")); p != "" {
		return nil // the admin pinned one
	}
	mp := t.managedPath()
	if executable(mp) {
		fi, _ := os.Stat(mp)
		if !force && time.Since(fi.ModTime()) < 7*24*time.Hour {
			return nil
		}
	}
	err := t.install(ctx)
	t.setErr(err)
	if err == nil {
		t.mu.Lock()
		t.status.Version = ytdlpVersion(mp)
		t.mu.Unlock()
	}
	return err
}

func (t *tool) get(ctx context.Context, url string, w io.Writer, limit int64) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := t.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%s: HTTP %d", filepath.Base(url), resp.StatusCode)
	}
	n, err := io.Copy(w, io.LimitReader(resp.Body, limit+1))
	if err == nil && n > limit {
		err = fmt.Errorf("%s is unexpectedly large", filepath.Base(url))
	}
	return err
}

// install downloads the latest standalone build and verifies its checksum.
func (t *tool) install(ctx context.Context) error {
	asset := ytdlpAsset()
	if asset == "" {
		return fmt.Errorf("no yt-dlp build for %s/%s; install yt-dlp yourself", runtime.GOOS, runtime.GOARCH)
	}
	var sums strings.Builder
	if err := t.get(ctx, ytdlpBaseURL+"SHA2-256SUMS", &sums, 1<<20); err != nil {
		return fmt.Errorf("couldn't fetch yt-dlp checksums: %v", err)
	}
	want := ""
	sc := bufio.NewScanner(strings.NewReader(sums.String()))
	for sc.Scan() {
		f := strings.Fields(sc.Text())
		if len(f) == 2 && strings.TrimPrefix(f[1], "*") == asset {
			want = strings.ToLower(f[0])
		}
	}
	if want == "" {
		return fmt.Errorf("no checksum published for %s", asset)
	}
	if err := os.MkdirAll(t.dir, 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(t.dir, ".yt-dlp-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	h := sha256.New()
	if err := t.get(ctx, ytdlpBaseURL+asset, io.MultiWriter(tmp, h), 300<<20); err != nil {
		tmp.Close()
		return fmt.Errorf("couldn't download yt-dlp: %v", err)
	}
	tmp.Close()
	if got := hex.EncodeToString(h.Sum(nil)); got != want {
		return fmt.Errorf("yt-dlp checksum mismatch (got %s, want %s)", got[:12], want[:12])
	}
	if err := os.Chmod(tmp.Name(), 0o755); err != nil {
		return err
	}
	if v := ytdlpVersion(tmp.Name()); v == "" {
		return fmt.Errorf("the downloaded yt-dlp doesn't run on this server")
	}
	if err := os.Rename(tmp.Name(), t.managedPath()); err != nil {
		return err
	}
	now := time.Now()
	_ = os.Chtimes(t.managedPath(), now, now)
	return nil
}

// jsRuntimeArgs: YouTube extraction in current yt-dlp wants a JavaScript
// runtime. Deno is used automatically when installed; otherwise point it at
// Node (which HomeFlix's web app already needs).
func jsRuntimeArgs() []string {
	if _, err := exec.LookPath("deno"); err == nil {
		return nil
	}
	if p, err := exec.LookPath("node"); err == nil {
		return []string{"--js-runtimes", "node:" + p}
	}
	return nil
}
