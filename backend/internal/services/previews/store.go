package previews

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"homeflix-backend/internal/models"
)

const (
	cacheDirName = ".homeflix-cache"
	// ReserveBytes: never fill a drive below this with previews.
	ReserveBytes = 5 << 30
	gcGrace      = 24 * time.Hour
)

// Settings for preview storage.
type Settings struct {
	// "auto": the system drive while it has room, otherwise the library
	// drive with the most free space. Or an absolute folder.
	Location     string `json:"location"`
	BudgetGB     int    `json:"budget_gb"`     // 0 = unlimited
	ScanGenerate bool   `json:"scan_generate"` // make previews during library scans
}

func defaultSettings() Settings {
	return Settings{Location: "auto", BudgetGB: 15, ScanGenerate: true}
}

func (e *Engine) loadSettings() Settings {
	s := defaultSettings()
	if b, err := os.ReadFile(e.setFile); err == nil {
		_ = json.Unmarshal(b, &s)
	}
	if s.Location == "" {
		s.Location = "auto"
	}
	return s
}

func (e *Engine) Settings() Settings {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.settings
}

func (e *Engine) UpdateSettings(s Settings) (Settings, error) {
	s.Location = strings.TrimSpace(s.Location)
	if s.Location == "" {
		s.Location = "auto"
	}
	if s.Location != "auto" {
		if !filepath.IsAbs(s.Location) {
			return Settings{}, fmt.Errorf("use an absolute folder path")
		}
		if err := os.MkdirAll(s.Location, 0o755); err != nil {
			return Settings{}, fmt.Errorf("can't use %s: %v", s.Location, err)
		}
	}
	if s.BudgetGB < 0 {
		s.BudgetGB = 0
	}
	b, _ := json.MarshalIndent(s, "", "  ")
	if err := os.WriteFile(e.setFile, b, 0o644); err != nil {
		return Settings{}, err
	}
	e.mu.Lock()
	e.settings = s
	e.mu.Unlock()
	select {
	case e.budgetDue <- struct{}{}:
	default:
	}
	return s, nil
}

func (e *Engine) budgetBytes() int64 {
	return int64(e.Settings().BudgetGB) << 30
}

type mediaRoot struct {
	Path string
	Type string
}

func (e *Engine) mediaRoots() []mediaRoot {
	var paths []models.MediaPath
	if e.db == nil || e.db.Where("is_active = ?", true).Order("priority DESC, created_at ASC").Find(&paths).Error != nil {
		return nil
	}
	out := make([]mediaRoot, 0, len(paths))
	for _, p := range paths {
		out = append(out, mediaRoot{Path: p.Path, Type: p.PathType})
	}
	return out
}

// roots: every folder previews may live in (existing ones only).
func (e *Engine) roots() []string {
	seen := map[string]bool{}
	var out []string
	add := func(p string) {
		if p == "" {
			return
		}
		abs, err := filepath.Abs(p)
		if err != nil || seen[abs] {
			return
		}
		if fi, err := os.Stat(p); err != nil || !fi.IsDir() {
			return
		}
		seen[abs] = true
		out = append(out, p)
	}
	add(e.primary)
	if s := e.Settings(); s.Location != "auto" {
		add(s.Location)
	}
	for _, m := range e.mediaRoots() {
		add(filepath.Join(m.Path, cacheDirName, "previews"))
	}
	for _, x := range e.extra {
		add(x)
	}
	return out
}

func freeBytes(p string) (free, total int64, ok bool) {
	var st syscall.Statfs_t
	if err := syscall.Statfs(p, &st); err != nil {
		return 0, 0, false
	}
	return int64(st.Bavail) * int64(st.Bsize), int64(st.Blocks) * int64(st.Bsize), true
}

// targetDir picks where a new clip goes.
func (e *Engine) targetDir(need int64) (string, error) {
	s := e.Settings()
	if s.Location != "auto" {
		if err := os.MkdirAll(s.Location, 0o755); err == nil {
			if free, _, ok := freeBytes(s.Location); ok && free > ReserveBytes+need {
				return s.Location, nil
			}
		}
		log.Printf("⚠️ Preview folder %s is full or missing, choosing another drive", s.Location)
	}
	if free, _, ok := freeBytes(e.primary); ok && free > ReserveBytes+need {
		return e.primary, nil
	}
	best, bestFree := "", int64(0)
	for _, m := range e.mediaRoots() {
		if m.Type == "cloud" {
			continue // network mounts: slow to serve hovers from
		}
		if fi, err := os.Stat(m.Path); err != nil || !fi.IsDir() {
			continue // unplugged drive: don't create folders on the mount point
		}
		if free, _, ok := freeBytes(m.Path); ok && free > ReserveBytes+need && free > bestFree {
			best, bestFree = m.Path, free
		}
	}
	if best == "" {
		return "", fmt.Errorf("no drive has %d GB free for previews", ReserveBytes>>30)
	}
	dir := filepath.Join(best, cacheDirName, "previews")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

// owned: p is a preview file inside one of our folders (the only files
// cleanup may ever delete).
func (e *Engine) owned(p string) bool {
	if !strings.EqualFold(filepath.Ext(p), ".mp4") || !strings.Contains(strings.ToLower(filepath.Base(p)), "preview") {
		return false
	}
	abs, err := filepath.Abs(p)
	if err != nil {
		return false
	}
	for _, r := range e.roots() {
		ra, err := filepath.Abs(r)
		if err == nil && filepath.Dir(abs) == ra {
			return true
		}
	}
	return false
}

func (e *Engine) removeOwned(p string) {
	for _, c := range []string{p, filepath.Join("backend", p)} {
		if fileOK(c) && e.owned(c) {
			if err := os.Remove(c); err == nil {
				log.Printf("🧹 Removed old preview %s", c)
			}
			return
		}
	}
}

// CleanupReport describes one cleanup run.
type CleanupReport struct {
	At             time.Time `json:"at"`
	Orphans        int       `json:"orphans"`
	OrphanBytes    int64     `json:"orphan_bytes"`
	Evicted        int       `json:"evicted"`
	EvictedBytes   int64     `json:"evicted_bytes"`
	Adopted        int       `json:"adopted"`
	OtherFiles     int       `json:"other_files"` // stale thumbnails / audio of deleted titles
	OtherBytes     int64     `json:"other_bytes"`
	PreviewBytes   int64     `json:"preview_bytes"`
	PreviewCount   int       `json:"preview_count"`
	DurationMillis int64     `json:"duration_ms"`
}

func (r CleanupReport) Freed() int64 { return r.OrphanBytes + r.EvictedBytes + r.OtherBytes }

var reID = regexp.MustCompile(`(?i)^(?:preview|thumb|alac)_(\d+)(?:[_.]|$)`)

// titleMatches guards against adopting someone else's clip when a legacy
// name merely starts with a number ("preview_1917.mp4").
func titleMatches(name string, id uint, title string) bool {
	rest := strings.TrimSuffix(name, filepath.Ext(name))
	rest = strings.TrimPrefix(strings.TrimPrefix(rest, fmt.Sprintf("preview_%d", id)), "_")
	if rest == "" {
		return true
	}
	a, b := norm(rest), norm(title)
	if len(b) > 8 {
		b = b[:8]
	}
	return b != "" && strings.HasPrefix(a, b)
}

func norm(s string) string {
	var out []rune
	for _, r := range strings.ToLower(s) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			out = append(out, r)
		}
	}
	return string(out)
}

func idOf(name string) (uint, bool) {
	m := reID.FindStringSubmatch(name)
	if m == nil {
		return 0, false
	}
	n, err := strconv.ParseUint(m[1], 10, 32)
	return uint(n), err == nil && n > 0
}

type previewFile struct {
	path string
	size int64
	mod  time.Time
	id   uint
}

func (e *Engine) janitor(ctx context.Context) {
	t := time.NewTicker(6 * time.Hour)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return
	case <-time.After(3 * time.Minute): // let startup settle
	}
	e.Cleanup()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			e.Cleanup()
		case <-e.budgetDue:
			if b := e.budgetBytes(); b > 0 && e.previewBytes() > b {
				e.Cleanup()
			}
		}
	}
}

// previewBytes: quick total of preview files (cached per cleanup / 2 min).
func (e *Engine) previewBytes() int64 {
	var total int64
	for _, r := range e.roots() {
		entries, _ := os.ReadDir(r)
		for _, d := range entries {
			if fi, err := d.Info(); err == nil && fi.Mode().IsRegular() && e.owned(filepath.Join(r, d.Name())) {
				total += fi.Size()
			}
		}
	}
	return total
}

// Cleanup removes previews no title uses, adopts the ones a title lost
// track of, enforces the size budget and the free-space reserve, and drops
// thumbnails/extracted audio of titles that no longer exist.
func (e *Engine) Cleanup() CleanupReport {
	e.cleanMu.Lock()
	defer e.cleanMu.Unlock()
	t0 := time.Now()
	r := CleanupReport{At: t0}

	type row struct {
		ID              uint
		Title           string
		PreviewClipPath string
		PreviewPath     string
		ThumbnailPath   string
	}
	var rows []row
	if err := e.db.Model(&models.Media{}).Select("id", "title", "preview_clip_path", "preview_path", "thumbnail_path").Find(&rows).Error; err != nil {
		log.Printf("⚠️ Preview cleanup skipped: %v", err)
		return r
	}
	exists := make(map[uint]bool, len(rows))
	titles := make(map[uint]string, len(rows))
	inUse := map[string]bool{} // basenames referenced by a title
	hasLive := map[uint]bool{} // title's referenced preview exists
	refThumb := map[string]bool{}
	for _, x := range rows {
		exists[x.ID] = true
		titles[x.ID] = x.Title
		for _, p := range []string{x.PreviewClipPath, x.PreviewPath} {
			if p != "" {
				inUse[filepath.Base(p)] = true
				if fileOK(p) || fileOK(filepath.Join("backend", p)) {
					hasLive[x.ID] = true
				}
			}
		}
		if x.ThumbnailPath != "" {
			refThumb[filepath.Base(x.ThumbnailPath)] = true
		}
	}

	var live []previewFile
	for _, root := range e.roots() {
		entries, err := os.ReadDir(root)
		if err != nil {
			continue
		}
		for _, d := range entries {
			fi, err := d.Info()
			if err != nil || !fi.Mode().IsRegular() {
				continue
			}
			p := filepath.Join(root, d.Name())
			if strings.HasPrefix(d.Name(), ".tmp-") {
				if time.Since(fi.ModTime()) > time.Hour {
					_ = os.Remove(p)
				}
				continue
			}
			if !e.owned(p) {
				continue
			}
			f := previewFile{path: p, size: fi.Size(), mod: fi.ModTime()}
			f.id, _ = idOf(d.Name())
			switch {
			case inUse[d.Name()]:
				live = append(live, f)
			case f.id != 0 && exists[f.id] && !hasLive[f.id] && titleMatches(d.Name(), f.id, titles[f.id]):
				// a title whose DB path went stale: give it this file back
				e.adopt(f.id, p)
				hasLive[f.id] = true
				r.Adopted++
				live = append(live, f)
			case time.Since(f.mod) < gcGrace:
				live = append(live, f) // may be in the middle of being recorded
			default:
				if os.Remove(p) == nil {
					r.Orphans++
					r.OrphanBytes += f.size
				}
			}
		}
	}

	// Budget + reserve: least recently watched first.
	sort.Slice(live, func(i, j int) bool { return live[i].mod.Before(live[j].mod) })
	var total int64
	for _, f := range live {
		total += f.size
	}
	budget := e.budgetBytes()
	overBudget := budget > 0 && total > budget
	target := budget * 9 / 10 // evict a little extra so this doesn't run after every clip
	kept := live[:0]
	for _, f := range live {
		evict := overBudget && total > target
		if free, _, ok := freeBytes(filepath.Dir(f.path)); ok && free < ReserveBytes/2 {
			evict = true // the drive itself is nearly full
		}
		if evict && time.Since(f.mod) > time.Hour && os.Remove(f.path) == nil {
			total -= f.size
			r.Evicted++
			r.EvictedBytes += f.size
			if f.id != 0 {
				e.forget(f.id, f.path)
			}
			continue
		}
		kept = append(kept, f)
	}
	r.PreviewCount = len(kept)
	r.PreviewBytes = total

	// Thumbnails and extracted audio of titles that are gone.
	for _, dir := range otherCacheDirs() {
		entries, _ := os.ReadDir(dir.Path)
		for _, d := range entries {
			if d.IsDir() || (dir.Kind != "thumbnails" && dir.Kind != "audio") {
				continue
			}
			id, ok := idOf(d.Name())
			if !ok || exists[id] || refThumb[d.Name()] {
				continue
			}
			fi, err := d.Info()
			if err != nil || time.Since(fi.ModTime()) < gcGrace {
				continue
			}
			if os.Remove(filepath.Join(dir.Path, d.Name())) == nil {
				r.OtherFiles++
				r.OtherBytes += fi.Size()
			}
		}
	}

	r.DurationMillis = time.Since(t0).Milliseconds()
	e.mu.Lock()
	e.lastRun = &r
	e.mu.Unlock()
	e.sizes.invalidate()
	if r.Freed() > 0 || r.Adopted > 0 {
		log.Printf("🧹 Preview cleanup: %d unused, %d over budget, %d other files removed (%.1f MB freed), %d re-linked",
			r.Orphans, r.Evicted, r.OtherFiles, float64(r.Freed())/(1<<20), r.Adopted)
	}
	return r
}

// forget clears a title's preview after eviction (re-made on next hover).
func (e *Engine) forget(id uint, path string) {
	e.db.Model(&models.Media{}).Where("id = ? AND (preview_clip_path = ? OR preview_path = ?)", id, path, path).
		Updates(map[string]interface{}{"preview_clip_path": "", "preview_path": ""})
	e.mu.Lock()
	delete(e.known, id)
	e.mu.Unlock()
}

// ---- stats ----

type cacheDir struct {
	Kind  string // thumbnails | posters | audio | stream | subtitles
	Label string
	Path  string
}

func otherCacheDirs() []cacheDir {
	thumbs := os.Getenv("THUMBNAIL_PATH")
	if thumbs == "" {
		thumbs = "./thumbnails"
	}
	dirs := []cacheDir{
		{"thumbnails", "Thumbnails", thumbs},
		{"posters", "Posters & artwork", "./posters"},
		{"audio", "Extracted audio", "./alac_audio"},
		{"stream", "Streaming cache", "./hls_cache"},
		{"subtitles", "Subtitles", "./subtitles"},
	}
	if thumbs != "./thumbnails" {
		dirs = append(dirs, cacheDir{"thumbnails", "Thumbnails", "./thumbnails"})
	}
	return dirs
}

type sizeCache struct {
	mu  sync.Mutex
	at  time.Time
	val *Usage
}

func (c *sizeCache) invalidate() {
	c.mu.Lock()
	c.val = nil
	c.mu.Unlock()
}

func dirUsage(p string) (bytes int64, files int) {
	_ = filepath.WalkDir(p, func(_ string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.Type().IsRegular() {
			if fi, err := d.Info(); err == nil {
				bytes += fi.Size()
				files++
			}
		}
		return nil
	})
	return
}

// RootUsage is one folder holding previews.
type RootUsage struct {
	Path  string `json:"path"`
	Bytes int64  `json:"bytes"`
	Files int    `json:"files"`
	Free  int64  `json:"free"`
	Total int64  `json:"total"`
}

// CacheUsage is one other generated-asset folder.
type CacheUsage struct {
	Kind  string `json:"kind"`
	Label string `json:"label"`
	Path  string `json:"path"`
	Bytes int64  `json:"bytes"`
	Files int    `json:"files"`
}

// Usage is the Settings > Storage summary.
type Usage struct {
	Previews struct {
		Bytes   int64       `json:"bytes"`
		Files   int         `json:"files"`
		Missing int64       `json:"missing"` // titles without a preview yet
		Titles  int64       `json:"titles"`
		Roots   []RootUsage `json:"roots"`
		Next    string      `json:"next_location"`
	} `json:"previews"`
	Caches    []CacheUsage   `json:"caches"`
	Settings  Settings       `json:"settings"`
	Queue     Queue          `json:"queue"`
	Counters  Counters       `json:"counters"`
	LastClean *CleanupReport `json:"last_cleanup"`
}

// Usage measures storage (directory walks are cached for 2 minutes).
func (e *Engine) Usage() Usage {
	e.sizes.mu.Lock()
	cached := e.sizes.val
	fresh := cached != nil && time.Since(e.sizes.at) < 2*time.Minute
	e.sizes.mu.Unlock()

	var u Usage
	if fresh {
		u = *cached
	} else {
		u.Previews.Roots = []RootUsage{}
		for _, r := range e.roots() {
			var ru RootUsage
			ru.Path = r
			entries, _ := os.ReadDir(r)
			for _, d := range entries {
				if fi, err := d.Info(); err == nil && fi.Mode().IsRegular() && e.owned(filepath.Join(r, d.Name())) {
					ru.Bytes += fi.Size()
					ru.Files++
				}
			}
			ru.Free, ru.Total, _ = freeBytes(r)
			if ru.Files > 0 || r == e.primary {
				u.Previews.Roots = append(u.Previews.Roots, ru)
			}
			u.Previews.Bytes += ru.Bytes
			u.Previews.Files += ru.Files
		}
		u.Caches = []CacheUsage{}
		seen := map[string]bool{}
		for _, d := range otherCacheDirs() {
			abs, _ := filepath.Abs(d.Path)
			if seen[abs] {
				continue
			}
			seen[abs] = true
			if _, err := os.Stat(d.Path); err != nil {
				continue
			}
			b, n := dirUsage(d.Path)
			u.Caches = append(u.Caches, CacheUsage{Kind: d.Kind, Label: d.Label, Path: d.Path, Bytes: b, Files: n})
		}
		e.db.Model(&models.Media{}).Count(&u.Previews.Titles)
		e.db.Model(&models.Media{}).Where("COALESCE(preview_clip_path, '') = '' AND COALESCE(preview_path, '') = ''").Count(&u.Previews.Missing)
		if dir, err := e.targetDir(0); err == nil {
			u.Previews.Next = dir
		}
		e.sizes.mu.Lock()
		e.sizes.val, e.sizes.at = &u, time.Now()
		e.sizes.mu.Unlock()
	}
	u.Settings = e.Settings()
	u.Queue, u.Counters = e.QueueState()
	e.mu.Lock()
	u.LastClean = e.lastRun
	e.mu.Unlock()
	return u
}
