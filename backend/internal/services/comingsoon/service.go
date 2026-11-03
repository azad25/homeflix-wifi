// Package comingsoon keeps the 10 most anticipated upcoming Hollywood movies
// and 10 series (this year and next), with their trailers downloaded and
// re-encoded for smooth playback on the web app and the TV app.
//
// Every 12 hours the lineup is rebuilt from TMDB. New titles are queued for
// download, titles that dropped out or have been released are removed along
// with their video, and the trailers on disk never exceed the budget
// (1 GB by default). A title whose trailer isn't downloaded (yet) still
// shows, with its YouTube ID as a fallback.
package comingsoon

import (
	"context"
	"encoding/json"
	"fmt"
	"homeflix-backend/internal/services/governor"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	PerType       = 10
	DefaultBudget = 1 << 30 // 1 GB for all 20 trailers
)

// Trailer states.
const (
	StatePending     = "pending"
	StateDownloading = "downloading"
	StateEncoding    = "encoding"
	StateReady       = "ready"
	StateFailed      = "failed"
	StateNoTool      = "no_downloader" // yt-dlp isn't installed: YouTube fallback
	StateOverBudget  = "over_budget"   // didn't fit in the space budget
)

// Entry is one title in the lineup.
type Entry struct {
	Candidate
	Rank      int        `json:"rank"`
	State     string     `json:"state"`
	Error     string     `json:"error,omitempty"`
	Attempts  int        `json:"attempts"`
	RetryAt   *time.Time `json:"retry_at,omitempty"`
	Video     *Video     `json:"video,omitempty"`
	VideoFor  string     `json:"video_for,omitempty"` // youtube id the video was made from
	AddedAt   time.Time  `json:"added_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// Settings for the feature.
type Settings struct {
	Enabled     bool  `json:"enabled"`
	BudgetBytes int64 `json:"budget_bytes"`
}

type state struct {
	Settings  Settings          `json:"settings"`
	Entries   map[string]*Entry `json:"entries"`
	Refreshed time.Time         `json:"refreshed"`
	LastError string            `json:"last_error,omitempty"`
}

// Service runs the pipeline. Safe for concurrent use.
type Service struct {
	tmdb TMDB
	dir  string // data dir; videos in dir/videos
	now  func() time.Time

	tool *tool
	// InLibrary reports a title (tv: that season) the library already has.
	InLibrary func(mediaType string, tmdbID, season int) bool

	mu      sync.Mutex
	st      state
	working string // key of the entry being processed
	kick    chan struct{}
	log     []string

	// for tests
	downloadFn func(ctx context.Context, youtubeID, dir string) (string, error)
	encodeFn   func(ctx context.Context, src, dst string, budget int64) (Video, error)
}

// New uses $HOMEFLIX_COMINGSOON_DIR (default ./data/comingsoon).
func New(tmdb TMDB) *Service {
	dir := strings.TrimSpace(os.Getenv("HOMEFLIX_COMINGSOON_DIR"))
	if dir == "" {
		dir = "./data/comingsoon"
	}
	s := &Service{tmdb: tmdb, dir: dir, now: time.Now, kick: make(chan struct{}, 1), tool: newTool(dir)}
	s.st = state{Settings: Settings{Enabled: true, BudgetBytes: DefaultBudget}, Entries: map[string]*Entry{}}
	if b, err := os.ReadFile(filepath.Join(dir, "state.json")); err == nil {
		_ = json.Unmarshal(b, &s.st)
	}
	if s.st.Entries == nil {
		s.st.Entries = map[string]*Entry{}
	}
	if s.st.Settings.BudgetBytes <= 0 {
		s.st.Settings.BudgetBytes = DefaultBudget
	}
	// A crash mid-job leaves an entry "downloading": start it over.
	for _, e := range s.st.Entries {
		if e.State == StateDownloading || e.State == StateEncoding {
			e.State = StatePending
		}
	}
	_ = os.MkdirAll(s.videoDir(), 0o755)
	s.downloadFn = func(ctx context.Context, id, dir string) (string, error) {
		bin, _ := s.tool.path()
		if bin == "" {
			return "", errNoTool
		}
		return download(ctx, bin, id, dir)
	}
	s.encodeFn = encode
	return s
}

var errNoTool = fmt.Errorf("yt-dlp is not installed")

func (s *Service) videoDir() string { return filepath.Join(s.dir, "videos") }

func (s *Service) saveLocked() {
	b, err := json.MarshalIndent(s.st, "", "  ")
	if err != nil {
		return
	}
	_ = os.MkdirAll(s.dir, 0o755)
	tmp := filepath.Join(s.dir, "state.json.tmp")
	if os.WriteFile(tmp, b, 0o644) == nil {
		_ = os.Rename(tmp, filepath.Join(s.dir, "state.json"))
	}
}

func (s *Service) logf(format string, a ...interface{}) {
	msg := fmt.Sprintf(format, a...)
	log.Printf("🎬 Coming Soon: %s", msg)
	s.mu.Lock()
	s.log = append(s.log, s.now().Format("15:04 ")+msg)
	if len(s.log) > 40 {
		s.log = s.log[len(s.log)-40:]
	}
	s.mu.Unlock()
}

// Run refreshes on start (after a minute) and every 12 hours, and works
// through the download queue in between.
func (s *Service) Run(ctx context.Context) {
	go s.worker(ctx)
	go s.keepToolUpdated(ctx)
	select {
	case <-ctx.Done():
		return
	case <-time.After(time.Minute):
	}
	t := time.NewTicker(12 * time.Hour)
	defer t.Stop()
	for {
		if s.Settings().Enabled {
			if err := s.Refresh(ctx); err != nil {
				s.logf("refresh failed: %v", err)
			}
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

// keepToolUpdated installs yt-dlp on start (when enabled) and updates it weekly.
func (s *Service) keepToolUpdated(ctx context.Context) {
	for {
		if s.Settings().Enabled {
			s.UpdateTool(ctx, false)
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(24 * time.Hour): // Ensure only re-downloads after 7 days
		}
	}
}

// UpdateTool installs or updates the managed yt-dlp; titles that were waiting
// for a downloader are queued again.
func (s *Service) UpdateTool(ctx context.Context, force bool) error {
	err := s.tool.Ensure(ctx, force)
	if err != nil {
		s.logf("yt-dlp: %v", err)
		return err
	}
	if bin, src := s.tool.path(); bin != "" {
		s.mu.Lock()
		n := 0
		for _, e := range s.st.Entries {
			if e.State == StateNoTool {
				e.State, e.Error = StatePending, ""
				n++
			}
		}
		if n > 0 {
			s.saveLocked()
		}
		s.mu.Unlock()
		if n > 0 || force {
			s.logf("yt-dlp ready (%s, %s)", ytdlpVersion(bin), src)
		}
		s.Kick()
	}
	return nil
}

func (s *Service) Kick() {
	select {
	case s.kick <- struct{}{}:
	default:
	}
}

// Refresh rebuilds the lineup: adds new titles, drops the rest (and their
// videos), and queues downloads.
func (s *Service) Refresh(ctx context.Context) error {
	now := s.now()
	skip := func(c Candidate) bool { return s.InLibrary != nil && s.InLibrary(c.MediaType, c.TMDBID, c.Season) }
	movies, err1 := PickMovies(s.tmdb, now, PerType, skip)
	series, err2 := PickSeries(s.tmdb, now, PerType, skip)
	if err1 != nil && err2 != nil {
		s.mu.Lock()
		s.st.LastError = err1.Error()
		s.saveLocked()
		s.mu.Unlock()
		return err1
	}
	fresh := map[string]Candidate{}
	rank := map[string]int{}
	if err1 == nil {
		for i, c := range movies {
			fresh[c.Key()], rank[c.Key()] = c, i+1
		}
	}
	if err2 == nil {
		for i, c := range series {
			fresh[c.Key()], rank[c.Key()] = c, i+1
		}
	}
	s.mu.Lock()
	added, removed := 0, 0
	for k, e := range s.st.Entries {
		// Keep a type's old lineup if only that type failed to load.
		if (e.MediaType == "movie" && err1 != nil) || (e.MediaType == "tv" && err2 != nil) {
			continue
		}
		if _, ok := fresh[k]; !ok && k != s.working {
			s.dropVideoLocked(e)
			delete(s.st.Entries, k)
			removed++
		}
	}
	for k, c := range fresh {
		e := s.st.Entries[k]
		if e == nil {
			e = &Entry{State: StatePending, AddedAt: now}
			s.st.Entries[k] = e
			added++
		}
		e.Candidate, e.Rank, e.UpdatedAt = c, rank[k], now
		if e.VideoFor != "" && e.VideoFor != c.YouTubeID && k != s.working {
			// A better trailer came out (teaser -> trailer): replace the video.
			s.dropVideoLocked(e)
			e.State, e.Attempts, e.RetryAt = StatePending, 0, nil
		}
		if bin, _ := s.tool.path(); e.State == StateNoTool && bin != "" {
			e.State = StatePending // yt-dlp has been installed since
		}
	}
	s.st.Refreshed = now
	s.st.LastError = ""
	if err1 != nil {
		s.st.LastError = "movies: " + err1.Error()
	} else if err2 != nil {
		s.st.LastError = "series: " + err2.Error()
	}
	s.saveLocked()
	s.mu.Unlock()
	s.cleanOrphans()
	s.logf("lineup refreshed: %d movies, %d series (%d new, %d removed)", len(movies), len(series), added, removed)
	s.Kick()
	return nil
}

func (s *Service) dropVideoLocked(e *Entry) {
	if e.Video != nil {
		_ = os.Remove(filepath.Join(s.videoDir(), e.Video.File))
	}
	e.Video, e.VideoFor = nil, ""
}

var reVideoFile = regexp.MustCompile(`^(movie|tv)-\d+\.mp4$`)

// cleanOrphans removes video files no entry points at (and stale temp dirs).
func (s *Service) cleanOrphans() {
	s.mu.Lock()
	keep := map[string]bool{}
	for _, e := range s.st.Entries {
		if e.Video != nil {
			keep[e.Video.File] = true
		}
	}
	working := s.working
	s.mu.Unlock()
	entries, _ := os.ReadDir(s.videoDir())
	for _, d := range entries {
		n := d.Name()
		if d.IsDir() && strings.HasPrefix(n, ".job-") && !strings.HasPrefix(n, ".job-"+working) {
			_ = os.RemoveAll(filepath.Join(s.videoDir(), n))
			continue
		}
		if reVideoFile.MatchString(n) && !keep[n] {
			_ = os.Remove(filepath.Join(s.videoDir(), n))
		}
	}
}

// next: the highest-ranked entry that needs a video (movies and series
// interleaved by rank).
func (s *Service) nextLocked() *Entry {
	now := s.now()
	var list []*Entry
	for _, e := range s.st.Entries {
		if (e.State == StatePending || e.State == StateFailed) && e.Attempts < 4 && (e.RetryAt == nil || now.After(*e.RetryAt)) {
			list = append(list, e)
		}
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].Rank != list[j].Rank {
			return list[i].Rank < list[j].Rank
		}
		return list[i].MediaType < list[j].MediaType
	})
	if len(list) == 0 {
		return nil
	}
	return list[0]
}

// perVideoBudget: an even share of the budget for each title.
func (s *Service) perVideoBudgetLocked() int64 {
	return s.st.Settings.BudgetBytes / (2 * PerType)
}

func (s *Service) worker(ctx context.Context) {
	for {
		s.mu.Lock()
		e := (*Entry)(nil)
		if s.st.Settings.Enabled {
			e = s.nextLocked()
		}
		if e != nil {
			s.working = e.Key()
			e.State = StateDownloading
			s.saveLocked()
		}
		var budget int64
		var cand Candidate
		if e != nil {
			budget, cand = s.perVideoBudgetLocked(), e.Candidate
		}
		s.mu.Unlock()
		if e == nil {
			select {
			case <-ctx.Done():
				return
			case <-s.kick:
			case <-time.After(30 * time.Minute):
			}
			continue
		}
		v, err := s.process(ctx, cand, budget)
		s.mu.Lock()
		s.working = ""
		cur := s.st.Entries[cand.Key()]
		switch {
		case cur == nil || cur.YouTubeID != cand.YouTubeID:
			// dropped or changed meanwhile: discard
			if err == nil {
				_ = os.Remove(filepath.Join(s.videoDir(), v.File))
			}
		case err == errNoTool:
			cur.State, cur.Error = StateNoTool, "Install yt-dlp on the server to download trailers; the YouTube trailer is used meanwhile."
		case err != nil:
			cur.Attempts++
			retry := s.now().Add(time.Duration(cur.Attempts*cur.Attempts) * time.Hour)
			cur.State, cur.Error, cur.RetryAt = StateFailed, err.Error(), &retry
		default:
			cur.Video, cur.VideoFor, cur.State, cur.Error, cur.Attempts, cur.RetryAt = &v, cand.YouTubeID, StateReady, "", 0, nil
		}
		s.enforceBudgetLocked()
		s.saveLocked()
		s.mu.Unlock()
		if err == errNoTool {
			s.markAllNoTool()
		} else if err != nil {
			s.logf("%s: %v", cand.Title, err)
		} else {
			s.logf("%s: trailer ready (%dp, %.1f MB)", cand.Title, v.Height, float64(v.Bytes)/(1<<20))
		}
	}
}

// markAllNoTool: without yt-dlp nothing can download; say so on every title.
func (s *Service) markAllNoTool() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, e := range s.st.Entries {
		if e.State == StatePending || e.State == StateFailed {
			e.State, e.Error = StateNoTool, "Install yt-dlp on the server to download trailers; the YouTube trailer is used meanwhile."
		}
	}
	s.saveLocked()
}

func (s *Service) process(ctx context.Context, c Candidate, budget int64) (Video, error) {
	ctx, cancel := context.WithTimeout(ctx, 20*time.Minute)
	defer cancel()
	job := filepath.Join(s.videoDir(), ".job-"+c.Key())
	_ = os.RemoveAll(job)
	if err := os.MkdirAll(job, 0o755); err != nil {
		return Video{}, err
	}
	defer os.RemoveAll(job)
	src, err := s.downloadFn(ctx, c.YouTubeID, job)
	if err != nil {
		return Video{}, err
	}
	s.mu.Lock()
	if e := s.st.Entries[c.Key()]; e != nil {
		e.State = StateEncoding
	}
	s.mu.Unlock()
	tmp := filepath.Join(job, "out.mp4")
	// Trailer encodes are the least urgent work on the box: wait for a bulk
	// slot (none while someone is watching; at most MaxWait when busy).
	release, err := governor.Default.Acquire(ctx, governor.Bulk)
	if err != nil {
		return Video{}, err
	}
	v, err := s.encodeFn(ctx, src, tmp, budget)
	release()
	if err != nil {
		return Video{}, err
	}
	name := c.Key() + ".mp4"
	if err := os.Rename(tmp, filepath.Join(s.videoDir(), name)); err != nil {
		return Video{}, err
	}
	v.File = name
	return v, nil
}

// enforceBudgetLocked: if the videos exceed the budget, drop the
// lowest-ranked ones (they fall back to YouTube) until they fit.
func (s *Service) enforceBudgetLocked() {
	var ready []*Entry
	var total int64
	for _, e := range s.st.Entries {
		if e.Video != nil {
			ready = append(ready, e)
			total += e.Video.Bytes
		}
	}
	sort.Slice(ready, func(i, j int) bool { return ready[i].Rank > ready[j].Rank })
	for _, e := range ready {
		if total <= s.st.Settings.BudgetBytes {
			break
		}
		total -= e.Video.Bytes
		s.dropVideoLocked(e)
		e.State, e.Error = StateOverBudget, "Didn't fit in the trailer space budget"
	}
}

// ---- reading ----

// Snapshot is the lineup as the API returns it.
type Snapshot struct {
	Movies    []Entry     `json:"movies"`
	Series    []Entry     `json:"series"`
	Refreshed string      `json:"refreshed,omitempty"`
	Settings  Settings    `json:"settings"`
	UsedBytes int64       `json:"used_bytes"`
	Working   string      `json:"working,omitempty"`
	LastError string      `json:"last_error,omitempty"`
	Log       []string    `json:"log,omitempty"`
	YTDLP     string      `json:"ytdlp,omitempty"` // version, "" if missing
	Tool      *ToolStatus `json:"tool,omitempty"`
}

func (s *Service) Snapshot(withLog bool) Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	snap := Snapshot{Movies: []Entry{}, Series: []Entry{}, Settings: s.st.Settings, Working: s.working, LastError: s.st.LastError}
	if !s.st.Refreshed.IsZero() {
		snap.Refreshed = s.st.Refreshed.UTC().Format(time.RFC3339)
	}
	today := s.now().Format(day)
	for _, e := range s.st.Entries {
		if e.Video != nil {
			snap.UsedBytes += e.Video.Bytes
		}
		if !withLog && (e.ReleaseDate <= today || (s.InLibrary != nil && s.InLibrary(e.MediaType, e.TMDBID, e.Season))) {
			continue // out now or already here: gone at the next refresh
		}
		if e.MediaType == "movie" {
			snap.Movies = append(snap.Movies, *e)
		} else {
			snap.Series = append(snap.Series, *e)
		}
	}
	by := func(l []Entry) { sort.Slice(l, func(i, j int) bool { return l[i].Rank < l[j].Rank }) }
	by(snap.Movies)
	by(snap.Series)
	if withLog {
		snap.Log = append([]string{}, s.log...)
		ts := s.tool.Status()
		snap.Tool = &ts
		snap.YTDLP = ts.Version
	}
	return snap
}

// Entry returns one title.
func (s *Service) Entry(mediaType string, id int) (Entry, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.st.Entries[fmt.Sprintf("%s-%d", mediaType, id)]
	if !ok {
		return Entry{}, false
	}
	return *e, true
}

// VideoPath returns the file for a published video name ("movie-123.mp4").
func (s *Service) VideoPath(name string) (string, bool) {
	if !reVideoFile.MatchString(name) {
		return "", false
	}
	p := filepath.Join(s.videoDir(), name)
	if fi, err := os.Stat(p); err != nil || !fi.Mode().IsRegular() {
		return "", false
	}
	return p, true
}

func (s *Service) Settings() Settings {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.st.Settings
}

// UpdateSettings: budget between 200 MB and 10 GB.
func (s *Service) UpdateSettings(in Settings) (Settings, error) {
	if in.BudgetBytes == 0 {
		in.BudgetBytes = DefaultBudget
	}
	if in.BudgetBytes < 200<<20 || in.BudgetBytes > 10<<30 {
		return Settings{}, fmt.Errorf("space must be between 200 MB and 10 GB")
	}
	s.mu.Lock()
	s.st.Settings = in
	s.enforceBudgetLocked()
	s.saveLocked()
	s.mu.Unlock()
	s.Kick()
	return in, nil
}
