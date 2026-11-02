// Package previews makes the short hover/hero preview clips and manages the
// disk space they use.
//
//   - One job per title at a time: asking again (another hover, the hero,
//     a scan) joins the running job instead of queuing a duplicate ffmpeg.
//   - Two lanes: what a viewer is pointing at right now (interactive) jumps
//     ahead of library scans and batch jobs, and one worker only ever serves
//     that lane, so a hover never waits behind a 500-title scan.
//   - Clips are written next to the library when the system drive is
//     short on space, kept under a size budget (least recently watched
//     previews go first and are re-made on the next hover), and files no
//     title refers to any more are cleaned up.
package previews

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"

	"homeflix-backend/internal/models"
)

// ErrOnDemand: previews aren't made during scans (setting); the first hover makes one.
var ErrOnDemand = errors.New("previews are made on demand")

// errBusy: the file is still being written (download/copy in progress).
var errBusy = errors.New("video file is still being written")

// Source identifies the video to preview. ID may be 0 for a title that is
// not saved yet (then the DB isn't updated).
type Source struct {
	ID       uint
	FilePath string
	Title    string
	Season   *int
	Episode  *int
}

func (s Source) key() string {
	if s.ID != 0 {
		return fmt.Sprintf("id:%d", s.ID)
	}
	return "file:" + s.FilePath
}

type Job struct {
	src         Source
	force       bool
	interactive bool
	started     bool
	queuedAt    time.Time
	done        chan struct{}
	path        string
	err         error
}

type failure struct {
	until time.Time
	err   error
}

// Engine generates preview clips. Safe for concurrent use.
type Engine struct {
	db      *gorm.DB
	primary string // ./previews: the classic location on the system drive
	extra   []string
	setFile string

	mu       sync.Mutex
	cond     *sync.Cond
	settings Settings
	inflight map[string]*Job
	hi, lo   []*Job
	failed   map[string]failure
	known    map[uint]string
	misses   map[uint]time.Time
	running  map[string]Source
	counters Counters
	lastRun  *CleanupReport

	tonemap bool
	hwaccel string

	cleanMu   sync.Mutex
	budgetDue chan struct{}
	sizes     sizeCache
}

// Counters for the Settings page.
type Counters struct {
	Generated     int     `json:"generated"`
	Failed        int     `json:"failed"`
	Joined        int     `json:"joined"` // requests that piggy-backed on a running job
	AvgSeconds    float64 `json:"avg_seconds"`
	LastError     string  `json:"last_error,omitempty"`
	LastGenerated string  `json:"last_generated,omitempty"`
}

// New creates the engine and starts its workers. extraRoots are other
// folders older versions wrote previews into (scanned for cleanup).
func New(db *gorm.DB, extraRoots ...string) *Engine {
	dataDir := strings.TrimSpace(os.Getenv("HOMEFLIX_ASSETS_DIR"))
	if dataDir == "" {
		dataDir = "./data/assets"
	}
	_ = os.MkdirAll(dataDir, 0o755)
	e := &Engine{
		db:        db,
		primary:   "./previews",
		extra:     extraRoots,
		setFile:   filepath.Join(dataDir, "settings.json"),
		inflight:  map[string]*Job{},
		failed:    map[string]failure{},
		known:     map[uint]string{},
		misses:    map[uint]time.Time{},
		running:   map[string]Source{},
		budgetDue: make(chan struct{}, 1),
	}
	e.cond = sync.NewCond(&e.mu)
	e.settings = e.loadSettings()
	_ = os.MkdirAll(e.primary, 0o755)
	return e
}

// Start launches the workers and the janitor. Call once.
func (e *Engine) Start(ctx context.Context) {
	e.tonemap = hasFilter("zscale") && hasFilter("tonemap")
	if hasCUDA() {
		e.hwaccel = "cuda"
	}
	go e.worker(ctx, true)  // interactive only: hovers never wait behind scans
	go e.worker(ctx, false) // interactive first, then background
	go e.janitor(ctx)
	log.Printf("🎞️ Preview engine ready (720p clips, tonemap=%v, hwdecode=%q)", e.tonemap, e.hwaccel)
}

// Request queues (or joins) a preview job and returns immediately.
func (e *Engine) Request(src Source, interactive, force bool) *Job {
	e.mu.Lock()
	defer e.mu.Unlock()
	k := src.key()
	if j := e.inflight[k]; j != nil {
		e.counters.Joined++
		if interactive && !j.interactive && !j.started {
			j.interactive = true
			e.hi = append(e.hi, j) // promote; the stale entry in lo is skipped
			e.cond.Broadcast()
		}
		return j
	}
	if f, ok := e.failed[k]; ok && !force && time.Now().Before(f.until) {
		j := &Job{src: src, done: make(chan struct{}), err: f.err}
		close(j.done)
		return j
	}
	j := &Job{src: src, force: force, interactive: interactive, queuedAt: time.Now(), done: make(chan struct{})}
	e.inflight[k] = j
	if interactive {
		e.hi = append(e.hi, j)
	} else {
		e.lo = append(e.lo, j)
	}
	e.cond.Broadcast()
	return j
}

// Generate makes (or returns the existing) preview and waits for it.
// Background callers (scans, batches) get ErrOnDemand when scan-time
// generation is switched off.
func (e *Engine) Generate(ctx context.Context, src Source, interactive, force bool) (string, error) {
	if !interactive && !force && !e.Settings().ScanGenerate {
		return "", ErrOnDemand
	}
	if !force && src.ID != 0 {
		if p, ok := e.Lookup(src.ID); ok {
			return p, nil
		}
	}
	j := e.Request(src, interactive, force)
	select {
	case <-j.done:
		return j.path, j.err
	case <-ctx.Done():
		return "", ctx.Err()
	}
}

// Wait blocks until j finishes or d passes.
func (j *Job) Wait(d time.Duration) (path string, done bool, err error) {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-j.done:
		return j.path, true, j.err
	case <-t.C:
		return "", false, nil
	}
}

func (e *Engine) next(interactiveOnly bool, ctx context.Context) *Job {
	e.mu.Lock()
	defer e.mu.Unlock()
	for {
		if ctx.Err() != nil {
			return nil
		}
		for len(e.hi) > 0 {
			j := e.hi[0]
			e.hi = e.hi[1:]
			if !j.started {
				j.started = true
				return j
			}
		}
		if !interactiveOnly {
			for len(e.lo) > 0 {
				j := e.lo[0]
				e.lo = e.lo[1:]
				if !j.started {
					j.started = true
					return j
				}
			}
		}
		e.cond.Wait()
	}
}

func (e *Engine) worker(ctx context.Context, interactiveOnly bool) {
	go func() { <-ctx.Done(); e.mu.Lock(); e.cond.Broadcast(); e.mu.Unlock() }()
	for {
		j := e.next(interactiveOnly, ctx)
		if j == nil {
			return
		}
		k := j.src.key()
		e.mu.Lock()
		e.running[k] = j.src
		e.mu.Unlock()

		t0 := time.Now()
		path, err := e.make(ctx, &j.src)

		e.mu.Lock()
		delete(e.running, k)
		delete(e.inflight, k)
		j.path, j.err = path, err
		if err != nil {
			e.counters.Failed++
			e.counters.LastError = fmt.Sprintf("%s: %v", j.src.Title, err)
			retry := 30 * time.Minute
			if errors.Is(err, errBusy) {
				retry = 2 * time.Minute
			}
			e.failed[k] = failure{until: time.Now().Add(retry), err: err}
		} else {
			delete(e.failed, k)
			n := float64(e.counters.Generated)
			e.counters.AvgSeconds = (e.counters.AvgSeconds*n + time.Since(t0).Seconds()) / (n + 1)
			e.counters.Generated++
			e.counters.LastGenerated = j.src.Title
			if j.src.ID != 0 {
				e.known[j.src.ID] = path
			}
		}
		e.mu.Unlock()
		close(j.done)
		if err != nil {
			log.Printf("⚠️ Preview for %q failed: %v", j.src.Title, err)
		} else {
			log.Printf("🎞️ Preview for %q ready in %.1fs: %s", j.src.Title, time.Since(t0).Seconds(), path)
			select {
			case e.budgetDue <- struct{}{}:
			default:
			}
		}
	}
}

// make does the actual work for one title.
func (e *Engine) make(ctx context.Context, src *Source) (string, error) {
	if src.FilePath == "" && src.ID != 0 {
		var m models.Media
		if err := e.db.Select("id", "title", "file_path", "season", "episode").First(&m, src.ID).Error; err != nil {
			return "", fmt.Errorf("title not found: %w", err)
		}
		src.FilePath, src.Title, src.Season, src.Episode = m.FilePath, m.Title, m.Season, m.Episode
	}
	fi, err := os.Stat(src.FilePath)
	if err != nil {
		return "", fmt.Errorf("video file missing: %w", err)
	}
	if time.Since(fi.ModTime()) < 90*time.Second {
		return "", errBusy
	}
	info, err := probe(ctx, src.FilePath)
	if err != nil {
		return "", err
	}
	dir, err := e.targetDir(8 << 20)
	if err != nil {
		return "", err
	}
	name := fileName(*src)
	dst := filepath.Join(dir, name)
	tmp := filepath.Join(dir, ".tmp-"+name)
	defer os.Remove(tmp)

	length := float64(clipSeconds)
	if info.Duration > 0 && info.Duration < length {
		length = info.Duration
	}
	opts := encodeOpts{
		Start:    pickStart(ctx, src.FilePath, info.Duration),
		Length:   length,
		HDR:      info.HDR,
		HasAudio: info.HasAudio,
		Tonemap:  e.tonemap,
		HWAccel:  e.hwaccel,
	}
	if err := encode(ctx, src.FilePath, tmp, opts); err != nil {
		return "", err
	}
	if err := os.Rename(tmp, dst); err != nil {
		return "", err
	}
	if src.ID != 0 {
		e.adopt(src.ID, dst)
	}
	return dst, nil
}

// adopt records path as the title's preview and removes the one it replaces.
func (e *Engine) adopt(id uint, path string) {
	var m models.Media
	if e.db.Select("id", "preview_clip_path", "preview_path").First(&m, id).Error == nil {
		for _, old := range []string{m.PreviewClipPath, m.PreviewPath} {
			if old != "" && !samePath(old, path) {
				e.removeOwned(old)
			}
		}
	}
	e.db.Model(&models.Media{}).Where("id = ?", id).Updates(map[string]interface{}{
		"preview_clip_path": path,
		"preview_path":      path,
	})
	e.mu.Lock()
	e.known[id] = path
	e.mu.Unlock()
}

var unsafeChars = regexp.MustCompile(`[^A-Za-z0-9._-]+`)

func cleanTitle(t string) string {
	t = unsafeChars.ReplaceAllString(strings.ReplaceAll(t, " ", "_"), "")
	if len(t) > 60 {
		t = t[:60]
	}
	return t
}

// fileName keeps the established preview_<id>_<title>[_SxxEyy].mp4 scheme
// (the id is what cleanup keys on).
func fileName(s Source) string {
	t := cleanTitle(s.Title)
	if s.ID == 0 {
		t = cleanTitle(strings.TrimSuffix(filepath.Base(s.FilePath), filepath.Ext(s.FilePath)))
	}
	if s.Season != nil && s.Episode != nil && *s.Season > 0 && *s.Episode > 0 {
		return fmt.Sprintf("preview_%d_%s_S%02dE%02d.mp4", s.ID, t, *s.Season, *s.Episode)
	}
	return fmt.Sprintf("preview_%d_%s.mp4", s.ID, t)
}

func samePath(a, b string) bool {
	aa, err1 := filepath.Abs(a)
	bb, err2 := filepath.Abs(b)
	return err1 == nil && err2 == nil && aa == bb
}

// Lookup finds an existing preview clip for a title (DB paths first, then
// the file naming schemes older versions used).
func (e *Engine) Lookup(id uint) (string, bool) {
	e.mu.Lock()
	p, ok := e.known[id]
	e.mu.Unlock()
	if ok {
		if fileOK(p) {
			return p, true
		}
		e.mu.Lock()
		delete(e.known, id)
		e.mu.Unlock()
	}
	var m models.Media
	if err := e.db.Select("id", "title", "preview_clip_path", "preview_path").First(&m, id).Error; err != nil {
		return "", false
	}
	for _, c := range []string{m.PreviewClipPath, m.PreviewPath} {
		if c == "" {
			continue
		}
		for _, v := range []string{c, filepath.Join("backend", c)} {
			if fileOK(v) {
				e.remember(id, v)
				return v, true
			}
		}
	}
	e.mu.Lock()
	recentMiss := time.Since(e.misses[id]) < time.Minute
	e.mu.Unlock()
	if recentMiss {
		return "", false
	}
	defer func() {
		e.mu.Lock()
		e.misses[id] = time.Now()
		e.mu.Unlock()
	}()
	for _, root := range e.roots() {
		for _, pat := range []string{fmt.Sprintf("preview_%d_*.mp4", id), fmt.Sprintf("preview_%d.mp4", id)} {
			matches, _ := filepath.Glob(filepath.Join(root, pat))
			for _, f := range matches {
				if fileOK(f) && titleMatches(filepath.Base(f), id, m.Title) {
					e.adopt(id, f)
					return f, true
				}
			}
		}
	}
	return "", false
}

func (e *Engine) remember(id uint, p string) {
	e.mu.Lock()
	e.known[id] = p
	e.mu.Unlock()
}

func fileOK(p string) bool {
	fi, err := os.Stat(p)
	return err == nil && fi.Mode().IsRegular() && fi.Size() > 1024
}

// Touch marks a preview as recently watched (the budget evicts the least
// recently watched first). Cheap: at most one write per file per day.
func Touch(p string) {
	if fi, err := os.Stat(p); err == nil && time.Since(fi.ModTime()) > 24*time.Hour {
		now := time.Now()
		_ = os.Chtimes(p, now, now)
	}
}

// Queue reports what the engine is doing.
type Queue struct {
	Interactive int      `json:"interactive"`
	Background  int      `json:"background"`
	Running     []string `json:"running"`
}

func (e *Engine) QueueState() (Queue, Counters) {
	e.mu.Lock()
	defer e.mu.Unlock()
	q := Queue{Running: []string{}}
	for _, j := range e.hi {
		if !j.started {
			q.Interactive++
		}
	}
	for _, j := range e.lo {
		if !j.started && !j.interactive {
			q.Background++
		}
	}
	for _, s := range e.running {
		q.Running = append(q.Running, s.Title)
	}
	return q, e.counters
}

// QueueMissing queues every title without a preview at background
// priority (stops at 95% of the budget). Returns how many were queued.
func (e *Engine) QueueMissing() int {
	var rows []models.Media
	e.db.Select("id", "title", "file_path", "season", "episode", "preview_clip_path", "preview_path").
		Where("file_path <> ''").Find(&rows)
	budget := e.budgetBytes()
	used := e.previewBytes()
	n := 0
	for _, m := range rows {
		if budget > 0 && used > budget*95/100 {
			break
		}
		if _, ok := e.Lookup(m.ID); ok {
			continue
		}
		e.Request(Source{ID: m.ID, FilePath: m.FilePath, Title: m.Title, Season: m.Season, Episode: m.Episode}, false, false)
		used += 1500 << 10 // ~typical clip
		n++
	}
	return n
}
