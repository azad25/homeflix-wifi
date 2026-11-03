// Package autodl downloads what users add to the "To Download" list in the
// background: it finds a release that fits the chosen quality profile, waits
// for enough free space, starts the torrent and follows it until the title
// is in the library.
package autodl

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"homeflix-backend/internal/services/governor"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"

	"homeflix-backend/internal/models"
	"homeflix-backend/internal/storage"
	"homeflix-backend/internal/torrent"
)

// Statuses
const (
	StatusQueued      = "queued"      // waiting for its turn
	StatusScheduled   = "scheduled"   // not released yet / user picked a later date
	StatusWaiting     = "waiting"     // no release / no space / no indexer yet (see Message)
	StatusDownloading = "downloading" // torrent running
	StatusCompleted   = "completed"   // downloaded and imported
	StatusInLibrary   = "in_library"  // already in the library, nothing to do
	StatusFailed      = "failed"      // gave up after repeated torrent errors
)

// Item is one movie or TV season in the queue.
type Item struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	TMDBID         int       `gorm:"index" json:"tmdb_id"`
	MediaType      string    `json:"media_type"` // movie | tv
	Season         int       `json:"season"`     // tv only
	Title          string    `json:"title"`
	Year           int       `json:"year"`
	PosterPath     string    `json:"poster_path"`
	Status         string    `gorm:"index" json:"status"`
	Message        string    `json:"message"`
	TorrentID      string    `json:"torrent_id"`
	ReleaseName    string    `json:"release_name"`
	ReleaseQuality string    `json:"release_quality"`
	ReleaseSource  string    `json:"release_source"`
	ReleaseSize    int64     `json:"release_size"`
	ReleaseSeeders int       `json:"release_seeders"`
	Attempts       int       `json:"attempts"`
	NextAttemptAt  time.Time `json:"next_attempt_at"`
	Rejected       string    `json:"-"` // magnets that failed, one per line
	// Stall detection: last seen progress and when it last moved.
	LastProgress float64    `json:"-"`
	ProgressAt   *time.Time `json:"-"`
	SpaceNotified  bool      `json:"-"`
	// Scheduling: when the title can be downloaded (TMDB release / season
	// finale), and an optional user-chosen earliest date.
	AvailableAt      *time.Time `json:"available_at,omitempty"`
	ReleaseLabel     string     `json:"release_label,omitempty"`
	ReleaseCheckedAt *time.Time `json:"-"`
	NotBefore        *time.Time `json:"not_before,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	CompletedAt      *time.Time `json:"completed_at,omitempty"`
}

func (Item) TableName() string { return "auto_download_items" }

// Follow: a show whose new seasons are queued automatically.
type Follow struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	TMDBID     int        `gorm:"uniqueIndex" json:"tmdb_id"`
	Title      string     `json:"title"`
	PosterPath string     `json:"poster_path"`
	CheckedAt  *time.Time `json:"checked_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

func (Follow) TableName() string { return "auto_download_follows" }

// Releases answers "when can this be downloaded?" (TMDB).
type Releases interface {
	Movie(tmdbID int) (at time.Time, label string, err error)
	Season(tmdbID, season int) (at time.Time, label string, err error)
	Seasons(tmdbID int) ([]int, error)
}

// Settings are edited in Settings > Auto Download.
type Settings struct {
	Enabled          bool     `json:"enabled"`
	Profile          string   `json:"profile"` // compact | fullhd | uhd | custom
	Qualities        []string `json:"qualities"`
	PreferredSources []string `json:"preferred_sources"`
	BlockedTerms     []string `json:"blocked_terms"`
	MinSeeders       int      `json:"min_seeders"`
	MaxMovieGB       float64  `json:"max_movie_gb"`
	MaxSeasonGB      float64  `json:"max_season_gb"`
	MinFreeGB        float64  `json:"min_free_gb"`
	MaxConcurrent    int      `json:"max_concurrent"`
	UseYTS           bool     `json:"use_yts"`
}

var defaultBlocked = []string{"cam", "camrip", "hdcam", "ts", "hdts", "telesync", "tc", "telecine", "scr", "screener", "dvdscr", "hc", "korsub"}

// Profiles are the presets; "custom" keeps the user's own values.
var Profiles = map[string]Settings{
	"compact": {Qualities: []string{"1080p", "720p"}, PreferredSources: []string{"webrip", "web-dl", "bluray"}, MinSeeders: 10, MaxMovieGB: 3, MaxSeasonGB: 15},
	"fullhd":  {Qualities: []string{"1080p"}, PreferredSources: []string{"web-dl", "bluray", "webrip"}, MinSeeders: 8, MaxMovieGB: 8, MaxSeasonGB: 40},
	"uhd":     {Qualities: []string{"2160p", "1080p"}, PreferredSources: []string{"web-dl", "bluray", "webrip"}, MinSeeders: 5, MaxMovieGB: 25, MaxSeasonGB: 90},
	"saver":   {Qualities: []string{"720p", "1080p"}, PreferredSources: []string{"webrip", "web-dl"}, MinSeeders: 10, MaxMovieGB: 1.5, MaxSeasonGB: 8},
}

func DefaultSettings() Settings {
	s := Profiles["compact"]
	s.Enabled, s.Profile, s.BlockedTerms, s.MinFreeGB, s.MaxConcurrent, s.UseYTS = true, "compact", defaultBlocked, 20, 2, true
	return s
}

// applyProfile fills the quality rules from a preset (unless custom).
func applyProfile(s Settings) Settings {
	if p, ok := Profiles[s.Profile]; ok {
		s.Qualities, s.PreferredSources, s.MinSeeders, s.MaxMovieGB, s.MaxSeasonGB = p.Qualities, p.PreferredSources, p.MinSeeders, p.MaxMovieGB, p.MaxSeasonGB
	} else {
		s.Profile = "custom"
	}
	if len(s.BlockedTerms) == 0 {
		s.BlockedTerms = defaultBlocked
	}
	if s.MaxConcurrent < 1 {
		s.MaxConcurrent = 1
	}
	if s.MinSeeders < 1 {
		s.MinSeeders = 1
	}
	return s
}

// Torrents is what the service needs from the torrent system.
type Torrents interface {
	SearchReal(query string) ([]torrent.SearchResult, error)
	Enqueue(magnet, title, mediaType string, tmdbID int, quality string, sizeHint int64) (*torrent.DownloadInfo, error)
}

// Abandoner is implemented by torrent backends that can drop a dead
// download and its partial data.
type Abandoner interface {
	Abandon(torrentID string) error
}

// StallAfter: a download with no progress for this long is a dead release;
// it is dropped and another release is tried.
var StallAfter = 6 * time.Hour

// Notify sends a user-visible notification (kind: queued, started,
// completed, failed, space).
type Notify func(kind, title, message string, tmdbID int, mediaType string)

type Service struct {
	db       *gorm.DB
	torrents Torrents
	notify   Notify
	dir      string
	yts      func(query string) ([]torrent.SearchResult, error)
	freeFn   func() (free int64, ok bool)
	releases Releases
	now      func() time.Time

	mu       sync.Mutex
	settings Settings
	kick     chan struct{}
	running  sync.Mutex
}

// NewService migrates the queue table and loads settings from
// $HOMEFLIX_AUTODL_DIR (default ./data/autodownload).
func NewService(db *gorm.DB, t Torrents, notify Notify) *Service {
	dir := strings.TrimSpace(os.Getenv("HOMEFLIX_AUTODL_DIR"))
	if dir == "" {
		dir = "data/autodownload"
	}
	if err := db.AutoMigrate(&Item{}, &Follow{}); err != nil {
		log.Printf("⬇️ Auto Download: migrate failed: %v", err)
	}
	s := &Service{db: db, torrents: t, notify: notify, dir: dir, yts: torrent.SearchYTSMovies, kick: make(chan struct{}, 1), now: time.Now}
	s.settings = DefaultSettings()
	if b, err := os.ReadFile(filepath.Join(dir, "settings.json")); err == nil {
		_ = json.Unmarshal(b, &s.settings)
	}
	s.settings = applyProfile(s.settings)
	s.freeFn = func() (int64, bool) {
		// The roomiest of all drives downloads can use (primary, downloads,
		// external; plugged in and writable). The torrent client writes each
		// download to a drive that fits it, so one full drive doesn't block.
		_, free := storage.MostFree(storage.DownloadTargets(db))
		return free, free > 0
	}
	if notify == nil {
		s.notify = func(string, string, string, int, string) {}
	}
	return s
}

// SetReleases enables release-date scheduling.
func (s *Service) SetReleases(r Releases) { s.releases = r }

func (s *Service) Settings() Settings {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.settings
}

func (s *Service) UpdateSettings(st Settings) (Settings, error) {
	st = applyProfile(st)
	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return st, err
	}
	b, _ := json.MarshalIndent(st, "", "  ")
	if err := os.WriteFile(filepath.Join(s.dir, "settings.json"), b, 0o644); err != nil {
		return st, err
	}
	s.mu.Lock()
	s.settings = st
	s.mu.Unlock()
	s.Kick()
	return st, nil
}

// Kick runs a pass soon (after adds, settings changes, retries).
func (s *Service) Kick() {
	select {
	case s.kick <- struct{}{}:
	default:
	}
}

// AddRequest adds a movie or one item per TV season.
type AddRequest struct {
	TMDBID     int    `json:"tmdb_id"`
	MediaType  string `json:"media_type"`
	Title      string `json:"title"`
	Year       int    `json:"year"`
	PosterPath string `json:"poster_path"`
	Seasons    []int  `json:"seasons"`
	// Follow (TV): also queue future seasons when they're announced.
	Follow bool `json:"follow"`
	// Don't download before this time (optional).
	NotBefore *time.Time `json:"not_before"`
}

var ErrInvalid = errors.New("tmdb_id, media_type (movie|tv) and title are required")

func (s *Service) Add(req AddRequest) ([]Item, error) {
	if req.TMDBID <= 0 || strings.TrimSpace(req.Title) == "" || (req.MediaType != "movie" && req.MediaType != "tv") {
		return nil, ErrInvalid
	}
	seasons := []int{0}
	if req.MediaType == "tv" {
		seasons = req.Seasons
		if len(seasons) == 0 && s.releases != nil {
			seasons, _ = s.releases.Seasons(req.TMDBID)
		}
		if len(seasons) == 0 {
			seasons = []int{1}
		}
		if req.Follow {
			f := Follow{TMDBID: req.TMDBID, Title: strings.TrimSpace(req.Title), PosterPath: req.PosterPath}
			s.db.Where(Follow{TMDBID: req.TMDBID}).Attrs(f).FirstOrCreate(&f)
		}
	}
	var out []Item
	for _, season := range seasons {
		var existing Item
		err := s.db.Where("tmdb_id = ? AND media_type = ? AND season = ?", req.TMDBID, req.MediaType, season).First(&existing).Error
		if err == nil {
			if existing.Status == StatusFailed || existing.Status == StatusWaiting {
				existing.Status, existing.Message, existing.NextAttemptAt = StatusQueued, "", time.Time{}
				s.db.Save(&existing)
			}
			out = append(out, existing)
			continue
		}
		it := Item{TMDBID: req.TMDBID, MediaType: req.MediaType, Season: season, Title: strings.TrimSpace(req.Title), Year: req.Year,
			PosterPath: req.PosterPath, Status: StatusQueued, NotBefore: req.NotBefore}
		if err := s.db.Create(&it).Error; err != nil {
			return out, err
		}
		out = append(out, it)
	}
	s.Kick()
	return out, nil
}

// ItemView adds live torrent progress.
type ItemView struct {
	Item
	Progress     float64 `json:"progress"`
	DownloadRate int64   `json:"download_rate"`
}

func (s *Service) List() []ItemView {
	var items []Item
	s.db.Order("created_at DESC").Find(&items)
	out := make([]ItemView, 0, len(items))
	for _, it := range items {
		v := ItemView{Item: it}
		if it.Status == StatusDownloading && it.TorrentID != "" {
			var td models.TorrentDownload
			if s.db.Where("torrent_id = ?", it.TorrentID).First(&td).Error == nil {
				v.Progress = td.Progress
			}
		} else if it.Status == StatusCompleted {
			v.Progress = 100
		}
		out = append(out, v)
	}
	return out
}

// Follows lists followed shows.
func (s *Service) Follows() []Follow {
	var out []Follow
	s.db.Order("created_at DESC").Find(&out)
	return out
}

func (s *Service) Unfollow(tmdbID int) error {
	return s.db.Where("tmdb_id = ?", tmdbID).Delete(&Follow{}).Error
}

// Schedule sets (or clears, with nil) the earliest download time.
func (s *Service) Schedule(id uint, notBefore *time.Time) error {
	err := s.db.Model(&Item{}).Where("id = ?", id).Updates(map[string]interface{}{
		"not_before": notBefore, "status": StatusQueued, "message": "", "next_attempt_at": time.Time{},
	}).Error
	s.Kick()
	return err
}

func (s *Service) Remove(id uint) error {
	return s.db.Delete(&Item{}, id).Error
}

func (s *Service) Retry(id uint) error {
	err := s.db.Model(&Item{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status": StatusQueued, "message": "", "next_attempt_at": time.Time{}, "attempts": 0,
	}).Error
	s.Kick()
	return err
}

// Run processes the queue every 10 minutes and whenever kicked.
func (s *Service) Run(ctx context.Context) {
	t := time.NewTicker(10 * time.Minute)
	defer t.Stop()
	time.Sleep(20 * time.Second) // let the torrent client restore first
	s.Pass(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		case <-s.kick:
		}
		s.Pass(ctx)
	}
}

// Pass updates running downloads and starts new ones.
func (s *Service) Pass(ctx context.Context) {
	if !s.running.TryLock() {
		return
	}
	defer s.running.Unlock()
	st := s.Settings()

	// 1. Follow running downloads.
	var active []Item
	s.db.Where("status = ?", StatusDownloading).Find(&active)
	running := 0
	for i := range active {
		it := &active[i]
		var td models.TorrentDownload
		if err := s.db.Where("torrent_id = ?", it.TorrentID).First(&td).Error; err != nil {
			s.retryLater(it, "The download disappeared - looking for another release", time.Minute)
			continue
		}
		switch td.Status {
		case "completed":
			now := time.Now()
			it.Status, it.Message, it.CompletedAt = StatusCompleted, "Downloaded and added to your library", &now
			s.db.Save(it)
			s.notify("completed", it.display()+" is ready to watch", "Downloaded "+it.ReleaseQuality+" and added to your library.", it.TMDBID, it.MediaType)
		case "error":
			it.Rejected += td.MagnetURI + "\n"
			if strings.Count(it.Rejected, "\n") >= 3 {
				it.Status, it.Message = StatusFailed, "The download failed 3 times"
				s.db.Save(it)
				s.notify("failed", "Couldn't download "+it.display(), "The download failed 3 times. You can retry it from My List.", it.TMDBID, it.MediaType)
			} else {
				s.retryLater(it, "The download failed - trying another release", time.Minute)
			}
		default:
			if s.stalled(it, &td) {
				continue
			}
			running++
		}
	}
	if !st.Enabled {
		return
	}

	// 2. Followed shows: queue newly announced seasons (once a day).
	s.checkFollows()

	// 3. Start new ones, oldest first. Scheduled items whose date came are
	// picked up here too.
	var next []Item
	s.db.Where("status IN ? AND next_attempt_at <= ?", []string{StatusQueued, StatusWaiting, StatusScheduled}, s.now()).Order("created_at ASC").Find(&next)
	for i := range next {
		if ctx.Err() != nil {
			return
		}
		if s.schedule(&next[i]) {
			continue // not available yet
		}
		if running >= st.MaxConcurrent {
			continue
		}
		// Host short of memory or overloaded (see governor): don't add a new
		// torrent now; it starts on a later check.
		if governor.Default.Mode() == governor.ModeCritical {
			continue
		}
		if s.process(&next[i], st) {
			running++
		}
	}
}

func (s *Service) checkFollows() {
	if s.releases == nil {
		return
	}
	var follows []Follow
	s.db.Where("checked_at IS NULL OR checked_at < ?", s.now().Add(-24*time.Hour)).Find(&follows)
	for _, f := range follows {
		seasons, err := s.releases.Seasons(f.TMDBID)
		if err != nil {
			continue
		}
		now := s.now()
		f.CheckedAt = &now
		s.db.Save(&f)
		for _, n := range seasons {
			var count int64
			s.db.Model(&Item{}).Where("tmdb_id = ? AND media_type = ? AND season = ?", f.TMDBID, "tv", n).Count(&count)
			if count == 0 {
				s.db.Create(&Item{TMDBID: f.TMDBID, MediaType: "tv", Season: n, Title: f.Title, PosterPath: f.PosterPath, Status: StatusQueued})
				log.Printf("⬇️ Auto Download: following %s - queued season %d", f.Title, n)
			}
		}
	}
}

func fmtDate(t time.Time) string { return t.Local().Format("Jan 2, 2006") }

// schedule: true if the item isn't downloadable yet (and parks it until it is).
func (s *Service) schedule(it *Item) bool {
	now := s.now()
	if it.NotBefore != nil && now.Before(*it.NotBefore) {
		it.Status, it.Message, it.NextAttemptAt = StatusScheduled, "Scheduled for "+fmtDate(*it.NotBefore), *it.NotBefore
		s.db.Save(it)
		return true
	}
	if s.releases == nil {
		return false
	}
	// Look the release up (again daily while it's in the future: dates move).
	if it.ReleaseCheckedAt == nil || (now.Sub(*it.ReleaseCheckedAt) > 24*time.Hour && (it.AvailableAt == nil || now.Before(*it.AvailableAt))) {
		var (
			at    time.Time
			label string
			err   error
		)
		if it.MediaType == "movie" {
			at, label, err = s.releases.Movie(it.TMDBID)
		} else {
			at, label, err = s.releases.Season(it.TMDBID, it.Season)
		}
		if err == nil {
			it.ReleaseCheckedAt = &now
			it.ReleaseLabel = label
			if !at.IsZero() {
				it.AvailableAt = &at
			} else {
				it.AvailableAt = nil
			}
		}
	}
	switch {
	case it.AvailableAt != nil && now.Before(*it.AvailableAt):
		it.Status, it.Message = StatusScheduled, fmt.Sprintf("%s · downloads from %s", it.ReleaseLabel, fmtDate(*it.AvailableAt))
		next := *it.AvailableAt
		if next.Sub(now) > 24*time.Hour {
			next = now.Add(24 * time.Hour) // re-check: release dates move
		}
		it.NextAttemptAt = next
	case it.AvailableAt == nil && it.MediaType == "tv" && it.ReleaseLabel != "":
		// Season or finale not announced yet.
		it.Status, it.Message, it.NextAttemptAt = StatusScheduled, it.ReleaseLabel+" - checking again in a few days", now.Add(72*time.Hour)
	default:
		if it.Status == StatusScheduled {
			it.Status, it.Message = StatusQueued, ""
			s.db.Save(it)
		}
		return false
	}
	s.db.Save(it)
	return true
}

func (it *Item) display() string {
	if it.MediaType == "tv" {
		return fmt.Sprintf("%s, Season %d", it.Title, it.Season)
	}
	if it.Year > 0 {
		return fmt.Sprintf("%s (%d)", it.Title, it.Year)
	}
	return it.Title
}

// stalled tracks a running download's progress. After StallAfter without
// any progress (while it is actually trying to download, not paused for
// space) the release is rejected and dropped, and another one is tried.
func (s *Service) stalled(it *Item, td *models.TorrentDownload) bool {
	now := s.now()
	moved := td.Progress > it.LastProgress+0.05
	// Time paused (e.g. waiting for disk space) doesn't count as stalled.
	if it.ProgressAt == nil || moved || td.Status != "downloading" {
		it.LastProgress, it.ProgressAt = td.Progress, &now
		s.db.Model(it).Updates(map[string]interface{}{"last_progress": it.LastProgress, "progress_at": it.ProgressAt})
		return false
	}
	if now.Sub(*it.ProgressAt) < StallAfter {
		return false
	}
	ab, ok := s.torrents.(Abandoner)
	if !ok {
		return false
	}
	if err := ab.Abandon(it.TorrentID); err != nil {
		log.Printf("⚠️ Auto Download: dropping stalled %s: %v", it.display(), err)
	}
	it.Rejected += td.MagnetURI + "\n"
	it.ProgressAt, it.LastProgress = nil, 0
	if strings.Count(it.Rejected, "\n") >= 3 {
		it.Status, it.Message = StatusFailed, "No release made progress (3 tried)"
		s.db.Save(it)
		s.notify("failed", "Couldn't download "+it.display(), "Three releases stopped making progress. You can retry it from My List.", it.TMDBID, it.MediaType)
		return true
	}
	s.retryLater(it, fmt.Sprintf("Stuck at %.0f%% for %s - trying another release", td.Progress, StallAfter), time.Minute)
	return true
}

func (s *Service) retryLater(it *Item, msg string, after time.Duration) {
	it.Status, it.Message, it.NextAttemptAt = StatusWaiting, msg, time.Now().Add(after)
	s.db.Save(it)
}

func (s *Service) inLibrary(it *Item) bool {
	var n int64
	if it.MediaType == "movie" {
		s.db.Model(&models.Media{}).Where("tmdb_id = ? AND type = ?", it.TMDBID, "movie").Count(&n)
		return n > 0
	}
	var series models.Series
	if s.db.Where("tmdb_id = ?", it.TMDBID).First(&series).Error != nil {
		return false
	}
	s.db.Model(&models.Media{}).Where("series_id = ? AND season_number = ?", series.ID, it.Season).Count(&n)
	return n > 0
}

// process finds and starts a release for one item; true if a download started.
func (s *Service) process(it *Item, st Settings) bool {
	if s.inLibrary(it) {
		it.Status, it.Message = StatusInLibrary, "Already in your library"
		s.db.Save(it)
		return false
	}

	var queries []string
	if it.MediaType == "movie" {
		if it.Year > 0 {
			queries = append(queries, fmt.Sprintf("%s %d", it.Title, it.Year))
		}
		queries = append(queries, it.Title)
	} else {
		queries = append(queries, fmt.Sprintf("%s S%02d", it.Title, it.Season), fmt.Sprintf("%s Season %d", it.Title, it.Season))
	}

	var results []torrent.SearchResult
	indexer := true
	for _, q := range queries {
		r, err := s.torrents.SearchReal(q)
		if errors.Is(err, torrent.ErrNoIndexer) {
			indexer = false
			break
		}
		if err == nil {
			results = append(results, r...)
		}
	}
	if it.MediaType == "movie" && st.UseYTS && s.yts != nil {
		if r, err := s.yts(it.Title); err == nil {
			results = append(results, r...)
		}
	}
	if !indexer && (it.MediaType == "tv" || !st.UseYTS) {
		s.retryLater(it, "Set up a torrent indexer (Jackett) in Settings > Downloads", 6*time.Hour)
		return false
	}

	rejected := map[string]bool{}
	for _, m := range strings.Split(it.Rejected, "\n") {
		if m != "" {
			rejected[m] = true
		}
	}
	// Space: pick the best release that fits on some drive with the reserve
	// left over (a smaller release beats waiting); wait only if none fits.
	reserve := int64(st.MinFreeGB * float64(1<<30))
	free, haveFree := s.freeFn()
	fitSt := st
	if haveFree {
		room := gb(free - reserve)
		if it.MediaType == "tv" {
			if fitSt.MaxSeasonGB <= 0 || fitSt.MaxSeasonGB > room {
				fitSt.MaxSeasonGB = room
			}
		} else if fitSt.MaxMovieGB <= 0 || fitSt.MaxMovieGB > room {
			fitSt.MaxMovieGB = room
		}
	}
	var c *Candidate
	if !haveFree || free > reserve {
		c = Pick(results, *it, fitSt, rejected)
	}
	if c == nil {
		if best := Pick(results, *it, st, rejected); best != nil && haveFree {
			msg := fmt.Sprintf("Waiting for free space: needs %.1f GB plus %.0f GB reserve, the roomiest drive has %.1f GB free", gb(best.Bytes), st.MinFreeGB, gb(free))
			if !it.SpaceNotified {
				it.SpaceNotified = true
				s.notify("space", "Not enough space for "+it.display(), msg+". Add a drive or free space in Settings > Storage.", it.TMDBID, it.MediaType)
			}
			s.retryLater(it, msg, 30*time.Minute)
			return false
		}
		it.Attempts++
		s.retryLater(it, "No release matches your quality settings yet - checking again later", 12*time.Hour)
		return false
	}

	info, err := s.torrents.Enqueue(c.Result.MagnetURI, it.display(), it.MediaType, it.TMDBID, c.Quality, c.Bytes)
	if err != nil {
		s.retryLater(it, "Couldn't start the download: "+err.Error(), 15*time.Minute)
		return false
	}
	it.Status, it.Message, it.TorrentID = StatusDownloading, "", info.ID
	it.ReleaseName, it.ReleaseQuality, it.ReleaseSource, it.ReleaseSize, it.ReleaseSeeders = c.Result.Title, c.Quality, c.Source, c.Bytes, c.Result.Seeders
	it.SpaceNotified = false
	s.db.Save(it)
	s.notify("started", "Downloading "+it.display(), fmt.Sprintf("%s %s · %.1f GB · %d seeders", c.Quality, strings.ToUpper(c.Source), gb(c.Bytes), c.Result.Seeders), it.TMDBID, it.MediaType)
	log.Printf("⬇️ Auto Download: %s -> %s", it.display(), c.Result.Title)
	return true
}

func gb(b int64) float64 { return float64(b) / float64(1<<30) }
