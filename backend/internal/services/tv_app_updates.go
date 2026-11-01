package services

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// TVAppPackage is the Android package the TV app updates are accepted for.
const TVAppPackage = "com.homeflix.tv"

// TVAppRelease describes the newest published TV app build
// (the JSON returned by GET /api/app/tv/latest).
type TVAppRelease struct {
	VersionCode int64     `json:"version_code"`
	VersionName string    `json:"version_name"`
	URL         string    `json:"url"`
	SHA256      string    `json:"sha256"`
	Size        int64     `json:"size"`
	Notes       string    `json:"notes,omitempty"`
	ReleasedAt  time.Time `json:"released_at"`
	Package     string    `json:"package"`

	path string
}

// Path is the APK file on disk.
func (r *TVAppRelease) Path() string { return r.path }

type apkCacheEntry struct {
	modTime time.Time
	size    int64
	release *TVAppRelease
}

// TVAppUpdates publishes HomeFlix TV app builds to the TVs.
//
// Drop an APK into Dir (or upload it through the API) and the newest version
// becomes available at /api/app/tv/latest; connected TVs are told immediately
// through OnNewRelease. Versions are read from the APK itself, so file names
// don't matter. Optional release notes: "<apk name>.txt" next to the APK.
type TVAppUpdates struct {
	Dir string
	// OnNewRelease is called when a newer version than before is published.
	OnNewRelease func(*TVAppRelease)

	mu      sync.Mutex
	scanned bool // the startup scan has run; later finds are announced
	cache   map[string]apkCacheEntry
	latest  *TVAppRelease
}

// NewTVAppUpdates uses $HOMEFLIX_TV_UPDATES_DIR or ./app-updates/tv.
func NewTVAppUpdates() *TVAppUpdates {
	dir := strings.TrimSpace(os.Getenv("HOMEFLIX_TV_UPDATES_DIR"))
	if dir == "" {
		dir = filepath.Join(".", "app-updates", "tv")
	}
	return &TVAppUpdates{Dir: dir, cache: map[string]apkCacheEntry{}}
}

// Latest returns the newest published build, or nil.
func (u *TVAppUpdates) Latest() *TVAppRelease {
	u.mu.Lock()
	defer u.mu.Unlock()
	return u.latest
}

// Release returns the published build with this version code, or nil.
func (u *TVAppUpdates) Release(versionCode int64) *TVAppRelease {
	u.mu.Lock()
	defer u.mu.Unlock()
	for path, e := range u.cache {
		if e.release != nil && e.release.VersionCode == versionCode {
			rel := *e.release
			rel.Notes = readNotes(path)
			return &rel
		}
	}
	return nil
}

// Scan re-reads Dir. APKs are only hashed when new or changed.
func (u *TVAppUpdates) Scan() error {
	_, err := u.scan()
	return err
}

// scan re-reads Dir and reports whether a newer build was announced to the TVs.
// Only the server's startup scan stays quiet (TVs check on launch anyway); any
// build that appears later — dropped in or uploaded, even the very first one —
// is pushed to connected TVs immediately.
func (u *TVAppUpdates) scan() (bool, error) {
	if err := os.MkdirAll(u.Dir, 0o755); err != nil {
		return false, err
	}
	entries, err := os.ReadDir(u.Dir)
	if err != nil {
		return false, err
	}
	seen := map[string]bool{}
	for _, e := range entries {
		if e.IsDir() || !strings.EqualFold(filepath.Ext(e.Name()), ".apk") {
			continue
		}
		path := filepath.Join(u.Dir, e.Name())
		fi, err := e.Info()
		if err != nil {
			continue
		}
		seen[path] = true
		u.mu.Lock()
		cached, ok := u.cache[path]
		u.mu.Unlock()
		if ok && cached.modTime.Equal(fi.ModTime()) && cached.size == fi.Size() {
			continue
		}
		rel, err := describeAPK(path, fi)
		if err != nil {
			log.Printf("📦 TV update: ignoring %s: %v", e.Name(), err)
		}
		u.mu.Lock()
		u.cache[path] = apkCacheEntry{modTime: fi.ModTime(), size: fi.Size(), release: rel}
		u.mu.Unlock()
	}

	u.mu.Lock()
	for path := range u.cache {
		if !seen[path] {
			delete(u.cache, path)
		}
	}
	var best *TVAppRelease
	for path, e := range u.cache {
		if e.release == nil {
			continue
		}
		if best == nil || e.release.VersionCode > best.VersionCode {
			// Published releases are immutable copies (handlers read them
			// concurrently). Notes may be edited without touching the APK.
			rel := *e.release
			rel.Notes = readNotes(path)
			best = &rel
		}
	}
	prev := u.latest
	u.latest = best
	notify := u.OnNewRelease
	startup := !u.scanned
	u.scanned = true
	u.mu.Unlock()

	if best != nil && (prev == nil || best.VersionCode > prev.VersionCode) {
		log.Printf("📦 TV update: published %s (%d)", best.VersionName, best.VersionCode)
		if notify != nil && !startup {
			notify(best)
			return true, nil
		}
	}
	return false, nil
}

func describeAPK(path string, fi os.FileInfo) (*TVAppRelease, error) {
	info, err := ReadAPKInfo(path)
	if err != nil {
		return nil, err
	}
	if info.Package != TVAppPackage {
		return nil, fmt.Errorf("package %q is not the HomeFlix TV app", info.Package)
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	h := sha256.New()
	n, err := io.Copy(h, f)
	if err != nil {
		return nil, err
	}
	return &TVAppRelease{
		VersionCode: info.VersionCode,
		VersionName: info.VersionName,
		URL:         fmt.Sprintf("/api/app/tv/download/%d", info.VersionCode),
		SHA256:      hex.EncodeToString(h.Sum(nil)),
		Size:        n,
		ReleasedAt:  fi.ModTime().UTC(),
		Package:     info.Package,
		path:        path,
	}, nil
}

func readNotes(apkPath string) string {
	b, err := os.ReadFile(apkPath + ".txt")
	if err != nil {
		b, err = os.ReadFile(strings.TrimSuffix(apkPath, filepath.Ext(apkPath)) + ".txt")
	}
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

// ErrNotTVApp is returned by Publish for files that aren't a HomeFlix TV build.
var ErrNotTVApp = errors.New("not a HomeFlix TV app build")

// Publish validates an uploaded APK and adds it to Dir as homeflix-tv-<code>.apk.
func (u *TVAppUpdates) Publish(r io.Reader, notes string) (*TVAppRelease, error) {
	if err := os.MkdirAll(u.Dir, 0o755); err != nil {
		return nil, err
	}
	tmp, err := os.CreateTemp(u.Dir, ".upload-*.tmp")
	if err != nil {
		return nil, err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)
	if _, err := io.Copy(tmp, io.LimitReader(r, 512<<20)); err != nil {
		tmp.Close()
		return nil, err
	}
	if err := tmp.Close(); err != nil {
		return nil, err
	}
	info, err := ReadAPKInfo(tmpPath)
	if err != nil || info.Package != TVAppPackage {
		return nil, ErrNotTVApp
	}
	final := filepath.Join(u.Dir, fmt.Sprintf("homeflix-tv-%d.apk", info.VersionCode))
	if err := os.Rename(tmpPath, final); err != nil {
		return nil, err
	}
	if strings.TrimSpace(notes) != "" {
		_ = os.WriteFile(final+".txt", []byte(strings.TrimSpace(notes)+"\n"), 0o644)
	}
	// Uploading is an explicit publish: announce it even if it happens to be
	// the server's first scan.
	u.mu.Lock()
	prevCode := int64(0)
	if u.latest != nil {
		prevCode = u.latest.VersionCode
	}
	u.mu.Unlock()
	announced, err := u.scan()
	if err != nil {
		return nil, err
	}
	rel := u.Release(info.VersionCode)
	if rel == nil {
		return nil, ErrNotTVApp
	}
	if !announced && rel.VersionCode > prevCode && u.OnNewRelease != nil {
		u.OnNewRelease(rel)
	}
	return rel, nil
}

// Watch rescans Dir every interval so a dropped-in APK is picked up without a restart.
func (u *TVAppUpdates) Watch(ctx context.Context, interval time.Duration) {
	if err := u.Scan(); err != nil {
		log.Printf("📦 TV update: scan failed: %v", err)
	}
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := u.Scan(); err != nil {
				log.Printf("📦 TV update: scan failed: %v", err)
			}
		}
	}
}
