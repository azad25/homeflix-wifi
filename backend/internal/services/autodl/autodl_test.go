package autodl

import (
	"context"
	"fmt"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"homeflix-backend/internal/models"
	"homeflix-backend/internal/torrent"
)

const GiB = int64(1 << 30)

func r(title string, seeders int, size int64) torrent.SearchResult {
	return torrent.SearchResult{Title: title, MagnetURI: "magnet:?xt=urn:btih:" + title, Seeders: seeders, SizeBytes: size}
}

func TestPickCompactProfile(t *testing.T) {
	st := applyProfile(Settings{Profile: "compact"})
	it := Item{MediaType: "movie", Title: "Dune", Year: 2021}
	results := []torrent.SearchResult{
		r("Dune.2021.2160p.WEB-DL.HDR", 300, 18*GiB),                                 // too big for compact
		r("Dune.2021.1080p.HDCAM", 900, 2*GiB),                                       // cam: blocked
		r("Dune Part Two 2024 1080p WEBRip", 800, 2*GiB),                             // different movie
		r("Dune.2021.1080p.WEBRip.x265", 4, 2*GiB),                                   // too few seeders
		r("Dune (2021) [1080p] [YTS]", 120, 2*GiB),                                   // ok
		r("Dune.2021.1080p.WEBRip.x264-RARBG", 250, 2*GiB),                           // best: preferred source + seeders
		r("Dune.2021.720p.WEBRip", 600, 1*GiB),                                       // lower quality preference
		r("Dune 1984 1080p BluRay", 500, 2*GiB),                                      // other film
		{Title: "Dune.2021.1080p.WEBRip.unknown.size", MagnetURI: "m", Seeders: 999}, // unknown size
	}
	c := Pick(results, it, st, nil)
	if c == nil || c.Result.Title != "Dune.2021.1080p.WEBRip.x264-RARBG" {
		t.Fatalf("picked %+v", c)
	}
	// Rejected releases are skipped.
	c = Pick(results, it, st, map[string]bool{c.Result.MagnetURI: true})
	if c == nil || c.Result.Title != "Dune (2021) [1080p] [YTS]" {
		t.Fatalf("after reject picked %+v", c)
	}
}

func TestPickUHDPrefers4K(t *testing.T) {
	st := applyProfile(Settings{Profile: "uhd"})
	it := Item{MediaType: "movie", Title: "Arrival", Year: 2016}
	c := Pick([]torrent.SearchResult{
		r("Arrival.2016.1080p.BluRay", 900, 9*GiB),
		r("Arrival.2016.2160p.UHD.BluRay", 40, 20*GiB),
	}, it, st, nil)
	if c == nil || c.Quality != "2160p" {
		t.Fatalf("picked %+v", c)
	}
}

func TestPickSeasonPacks(t *testing.T) {
	st := applyProfile(Settings{Profile: "compact"})
	it := Item{MediaType: "tv", Title: "Severance", Season: 2}
	c := Pick([]torrent.SearchResult{
		r("Severance.S02E03.1080p.WEB-DL", 900, 1*GiB), // single episode
		r("Severance.S01.1080p.WEBRip", 900, 9*GiB),    // wrong season
		r("Severance S02 1080p WEBRip x265", 200, 8*GiB),
	}, it, st, nil)
	if c == nil || c.Result.Title != "Severance S02 1080p WEBRip x265" {
		t.Fatalf("picked %+v", c)
	}
}

func TestParseSize(t *testing.T) {
	for in, want := range map[string]int64{"1.5 GB": GiB + GiB/2, "700 MB": 700 << 20, "2,048 MiB": 2 * GiB, "n/a": 0} {
		if got := ParseSize(in); got != want {
			t.Errorf("%q = %d, want %d", in, got, want)
		}
	}
}

// fakeTorrents records what the service starts.
type fakeTorrents struct {
	db      *gorm.DB
	results []torrent.SearchResult
	noIdx   bool
	started []string
}

func (f *fakeTorrents) SearchReal(q string) ([]torrent.SearchResult, error) {
	if f.noIdx {
		return nil, torrent.ErrNoIndexer
	}
	return f.results, nil
}

func (f *fakeTorrents) Enqueue(magnet, title, mediaType string, tmdbID int, quality string) (*torrent.DownloadInfo, error) {
	id := fmt.Sprintf("t%d", len(f.started)+1)
	f.started = append(f.started, title)
	f.db.Create(&models.TorrentDownload{TorrentID: id, Name: title, MagnetURI: magnet, Status: "downloading"})
	return &torrent.DownloadInfo{ID: id}, nil
}

func newTestService(t *testing.T, free int64) (*Service, *fakeTorrents, *[]string) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{Logger: logger.Discard})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.TorrentDownload{}, &models.Media{}, &models.Series{}); err != nil {
		t.Fatal(err)
	}
	t.Setenv("HOMEFLIX_AUTODL_DIR", t.TempDir())
	ft := &fakeTorrents{db: db}
	var notes []string
	s := NewService(db, ft, func(kind, title, msg string, _ int, _ string) { notes = append(notes, kind+": "+title) })
	s.yts = nil
	s.freeFn = func() (int64, bool) { return free, true }
	return s, ft, &notes
}

func TestPassLifecycle(t *testing.T) {
	s, ft, notes := newTestService(t, 100*GiB)
	ft.results = []torrent.SearchResult{r("Heat.1995.1080p.WEBRip", 80, 2*GiB)}
	items, err := s.Add(AddRequest{TMDBID: 949, MediaType: "movie", Title: "Heat", Year: 1995})
	if err != nil || len(items) != 1 {
		t.Fatal(err)
	}
	// Adding twice doesn't duplicate.
	if again, _ := s.Add(AddRequest{TMDBID: 949, MediaType: "movie", Title: "Heat", Year: 1995}); again[0].ID != items[0].ID {
		t.Fatal("duplicate item")
	}
	s.Pass(context.Background())
	list := s.List()
	if list[0].Status != StatusDownloading || len(ft.started) != 1 || list[0].ReleaseQuality != "1080p" {
		t.Fatalf("not started: %+v", list[0])
	}
	// Torrent finishes -> item completed + notification.
	s.db.Model(&models.TorrentDownload{}).Where("torrent_id = ?", list[0].TorrentID).Update("status", "completed")
	s.Pass(context.Background())
	if got := s.List()[0]; got.Status != StatusCompleted || got.Progress != 100 {
		t.Fatalf("not completed: %+v", got)
	}
	if len(*notes) != 2 || (*notes)[1] != "completed: Heat (1995) is ready to watch" {
		t.Fatalf("notifications: %v", *notes)
	}
}

func TestPassWaitsForSpaceAndRespectsConcurrency(t *testing.T) {
	s, ft, notes := newTestService(t, 21*GiB) // reserve 20 GB: a 2 GB release doesn't fit
	ft.results = []torrent.SearchResult{r("Up.2009.1080p.WEBRip", 80, 2*GiB)}
	s.Add(AddRequest{TMDBID: 14160, MediaType: "movie", Title: "Up", Year: 2009})
	s.Pass(context.Background())
	it := s.List()[0]
	if it.Status != StatusWaiting || len(ft.started) != 0 || len(*notes) != 1 {
		t.Fatalf("expected to wait for space: %+v notes=%v", it, *notes)
	}

	s2, ft2, _ := newTestService(t, 500*GiB)
	ft2.results = []torrent.SearchResult{
		r("Alien.1979.1080p.WEBRip", 80, 2*GiB), r("Jaws.1975.1080p.WEBRip", 80, 2*GiB), r("Rocky.1976.1080p.WEBRip", 80, 2*GiB),
	}
	s2.Add(AddRequest{TMDBID: 348, MediaType: "movie", Title: "Alien", Year: 1979})
	s2.Add(AddRequest{TMDBID: 578, MediaType: "movie", Title: "Jaws", Year: 1975})
	s2.Add(AddRequest{TMDBID: 1366, MediaType: "movie", Title: "Rocky", Year: 1976})
	s2.Pass(context.Background())
	if len(ft2.started) != 2 { // max_concurrent = 2
		t.Fatalf("started %v", ft2.started)
	}
}

func TestPassNeedsIndexerForTV(t *testing.T) {
	s, ft, _ := newTestService(t, 500*GiB)
	ft.noIdx = true
	s.Add(AddRequest{TMDBID: 95396, MediaType: "tv", Title: "Severance", Seasons: []int{1, 2}})
	s.Pass(context.Background())
	list := s.List()
	if len(list) != 2 || list[0].Status != StatusWaiting || list[0].Message == "" {
		t.Fatalf("%+v", list)
	}
}

func TestSkipsWhatIsInLibrary(t *testing.T) {
	s, ft, _ := newTestService(t, 500*GiB)
	s.db.Create(&models.Media{Title: "Heat", Type: "movie", TMDBID: 949, FilePath: "/m/heat.mkv"})
	ft.results = []torrent.SearchResult{r("Heat.1995.1080p.WEBRip", 80, 2*GiB)}
	s.Add(AddRequest{TMDBID: 949, MediaType: "movie", Title: "Heat", Year: 1995})
	s.Pass(context.Background())
	if it := s.List()[0]; it.Status != StatusInLibrary || len(ft.started) != 0 {
		t.Fatalf("%+v", it)
	}
}

type fakeReleases struct {
	movie   map[int]time.Time
	seasons map[int][]int
	season  map[[2]int]time.Time
}

func (f *fakeReleases) Movie(id int) (time.Time, string, error) {
	return f.movie[id], "Digital release", nil
}
func (f *fakeReleases) Season(id, n int) (time.Time, string, error) {
	at, ok := f.season[[2]int{id, n}]
	if !ok {
		return time.Time{}, "Not announced yet", nil
	}
	return at, "After the season finale", nil
}
func (f *fakeReleases) Seasons(id int) ([]int, error) { return f.seasons[id], nil }

func TestScheduledUntilRelease(t *testing.T) {
	s, ft, _ := newTestService(t, 500*GiB)
	now := time.Date(2026, 11, 2, 12, 0, 0, 0, time.UTC)
	s.now = func() time.Time { return now }
	rel := &fakeReleases{movie: map[int]time.Time{1: now.AddDate(0, 3, 0)}}
	s.SetReleases(rel)
	ft.results = []torrent.SearchResult{r("Future.Film.2027.1080p.WEBRip", 80, 2*GiB)}
	s.Add(AddRequest{TMDBID: 1, MediaType: "movie", Title: "Future Film", Year: 2027})
	s.Pass(context.Background())
	it := s.List()[0]
	if it.Status != StatusScheduled || it.AvailableAt == nil || len(ft.started) != 0 {
		t.Fatalf("expected scheduled: %+v", it.Item)
	}
	// Release day arrives -> downloads.
	now = now.AddDate(0, 3, 1)
	s.Pass(context.Background())
	if it := s.List()[0]; it.Status != StatusDownloading || len(ft.started) != 1 {
		t.Fatalf("expected download on release: %+v", it.Item)
	}
}

func TestManualNotBefore(t *testing.T) {
	s, ft, _ := newTestService(t, 500*GiB)
	now := time.Date(2026, 11, 2, 12, 0, 0, 0, time.UTC)
	s.now = func() time.Time { return now }
	ft.results = []torrent.SearchResult{r("Heat.1995.1080p.WEBRip", 80, 2*GiB)}
	night := now.Add(10 * time.Hour)
	s.Add(AddRequest{TMDBID: 949, MediaType: "movie", Title: "Heat", Year: 1995, NotBefore: &night})
	s.Pass(context.Background())
	if it := s.List()[0]; it.Status != StatusScheduled || len(ft.started) != 0 {
		t.Fatalf("%+v", it.Item)
	}
	now = night.Add(time.Minute)
	s.Pass(context.Background())
	if len(ft.started) != 1 {
		t.Fatal("not started after the scheduled time")
	}
}

func TestFollowQueuesNewSeasons(t *testing.T) {
	s, ft, _ := newTestService(t, 500*GiB)
	now := time.Date(2026, 11, 2, 12, 0, 0, 0, time.UTC)
	s.now = func() time.Time { return now }
	rel := &fakeReleases{
		seasons: map[int][]int{7: {1}},
		season:  map[[2]int]time.Time{{7, 1}: now.AddDate(-1, 0, 0)},
	}
	s.SetReleases(rel)
	ft.results = []torrent.SearchResult{r("Show S01 1080p WEBRip", 80, 8*GiB), r("Show S02 1080p WEBRip", 80, 8*GiB)}
	s.Add(AddRequest{TMDBID: 7, MediaType: "tv", Title: "Show", Follow: true})
	s.Pass(context.Background())
	if len(s.List()) != 1 || len(ft.started) != 1 {
		t.Fatalf("season 1: %+v started=%v", s.List(), ft.started)
	}
	// Season 2 announced with a finale next month: queued + scheduled.
	rel.seasons[7] = []int{1, 2}
	rel.season[[2]int{7, 2}] = now.AddDate(0, 1, 0)
	now = now.Add(25 * time.Hour)
	s.Pass(context.Background())
	var s2 *ItemView
	for _, it := range s.List() {
		if it.Season == 2 {
			it := it
			s2 = &it
		}
	}
	if s2 == nil || s2.Status != StatusScheduled {
		t.Fatalf("season 2 not scheduled: %+v", s.List())
	}
	if len(s.Follows()) != 1 {
		t.Fatal("follow not stored")
	}
}
