package comingsoon

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

var now = time.Date(2026, 11, 3, 12, 0, 0, 0, time.UTC)

// fakeTMDB serves canned JSON by path.
type fakeTMDB map[string]interface{}

func (f fakeTMDB) Get(path string, q url.Values, out interface{}) error {
	key := path
	if p := q.Get("page"); p != "" && p != "1" {
		key += "?page=" + p
	}
	v, ok := f[key]
	if !ok {
		return fmt.Errorf("404 %s", key)
	}
	b, _ := json.Marshal(v)
	return json.Unmarshal(b, out)
}

type M = map[string]interface{}

func cast(pops ...float64) []M {
	var c []M
	for i, p := range pops {
		c = append(c, M{"name": fmt.Sprintf("Star %d", i), "popularity": p, "order": i})
	}
	return c
}

func movie(id int, title, date string, pop float64, stars []M, extra M) M {
	m := M{"id": id, "title": title, "original_language": "en", "release_date": date, "status": "Post Production", "popularity": pop,
		"poster_path": "/p.jpg", "backdrop_path": "/b.jpg", "production_countries": []M{{"iso_3166_1": "US"}},
		"production_companies": []M{{"name": "Big Studio"}}, "genres": []M{{"id": 28, "name": "Action"}},
		"credits": M{"cast": stars}, "videos": M{"results": []M{{"key": fmt.Sprintf("yt%08d", id), "name": "Official Trailer", "site": "YouTube", "type": "Trailer", "official": true, "iso_639_1": "en"}}}}
	for k, v := range extra {
		m[k] = v
	}
	return m
}

func TestPickMoviesFiltersAndRanks(t *testing.T) {
	f := fakeTMDB{
		"/discover/movie": M{"results": []M{{"id": 1, "popularity": 300}, {"id": 2, "popularity": 250}, {"id": 3, "popularity": 200}, {"id": 4, "popularity": 150}, {"id": 5, "popularity": 120}, {"id": 6, "popularity": 90}, {"id": 7, "popularity": 80}, {"id": 8, "popularity": 70}}},
		"/movie/upcoming": M{"results": []M{{"id": 1, "popularity": 300}}},
		"/movie/1":        movie(1, "Big Sequel", "2026-12-18", 300, cast(80, 60, 40), nil),
		"/movie/2":        movie(2, "Indie Thing", "2027-03-01", 250, cast(1, 0.5), nil),                                                  // nobody famous
		"/movie/3":        movie(3, "Foreign Hit", "2027-01-10", 200, cast(50, 40), M{"production_countries": []M{{"iso_3166_1": "IN"}}}), // not Hollywood
		"/movie/4":        movie(4, "No Trailer", "2027-02-01", 150, cast(50, 40), M{"videos": M{"results": []M{}}}),
		"/movie/5":        movie(5, "Already Out", "2026-10-01", 120, cast(50, 40), nil),
		"/movie/6":        movie(6, "Far Future", "2028-06-01", 90, cast(50, 40), nil),
		"/movie/7":        movie(7, "Big Sequel", "2027-05-01", 80, cast(50, 40), nil), // same title
		"/movie/8":        movie(8, "Spring Blockbuster", "2027-04-17", 70, cast(70, 30, 20), nil),
	}
	got, err := PickMovies(f, now, 10)
	if err != nil {
		t.Fatal(err)
	}
	var titles []string
	for _, c := range got {
		titles = append(titles, c.Title)
	}
	if strings.Join(titles, ",") != "Big Sequel,Spring Blockbuster" {
		t.Fatalf("picked %v", titles)
	}
	if got[0].YouTubeID != "yt00000001" || got[0].Studio != "Big Studio" || len(got[0].Cast) != 3 {
		t.Fatalf("candidate %+v", got[0])
	}
}

func TestPickSeriesNewAndReturning(t *testing.T) {
	show := func(id int, name string, extra M) M {
		m := M{"id": id, "name": name, "original_language": "en", "origin_country": []string{"US"}, "popularity": 100,
			"poster_path": "/p.jpg", "backdrop_path": "/b.jpg", "genres": []M{{"id": 18, "name": "Drama"}}, "networks": []M{{"name": "HBO"}},
			"aggregate_credits": M{"cast": cast(60, 50, 40)}, "videos": M{"results": []M{{"key": fmt.Sprintf("tv%08d", id), "name": "Teaser", "site": "YouTube", "type": "Teaser", "official": true}}}}
		for k, v := range extra {
			m[k] = v
		}
		return m
	}
	f := fakeTMDB{
		"/discover/tv":           M{"results": []M{{"id": 10, "popularity": 100}}},
		"/tv/popular":            M{"results": []M{{"id": 11, "popularity": 300}, {"id": 12, "popularity": 200}, {"id": 13, "popularity": 150}}},
		"/tv/on_the_air":         M{"results": []M{}},
		"/tv/10":                 show(10, "Brand New Show", M{"first_air_date": "2027-01-20"}),
		"/tv/11":                 show(11, "Returning Hit", M{"first_air_date": "2019-01-01", "next_episode_to_air": M{"air_date": "2027-02-14", "season_number": 3, "episode_number": 1}}),
		"/tv/11/season/3/videos": M{"results": []M{{"key": "s3trailer01", "name": "Season 3 Official Trailer", "site": "YouTube", "type": "Trailer", "official": true}}},
		"/tv/12":                 show(12, "Mid Season", M{"first_air_date": "2020-01-01", "next_episode_to_air": M{"air_date": "2026-11-10", "season_number": 4, "episode_number": 5}}),
		"/tv/13":                 show(13, "Talk Tonight", M{"first_air_date": "2027-01-01", "genres": []M{{"id": 10767, "name": "Talk"}}}),
	}
	got, err := PickSeries(f, now, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0].Title != "Returning Hit" || got[0].ReleaseLabel != "Season 3" || got[0].YouTubeID != "s3trailer01" ||
		got[1].Title != "Brand New Show" || got[1].ReleaseLabel != "New Series" {
		b, _ := json.Marshal(got)
		t.Fatalf("series %s", b)
	}
}

func fakeTrailer(t *testing.T, dir string) string {
	t.Helper()
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg missing")
	}
	p := filepath.Join(dir, "src.mkv")
	if out, err := exec.Command("ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=2560x1080:d=6:r=24", "-f", "lavfi", "-i", "sine=d=6",
		"-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", p).CombinedOutput(); err != nil {
		t.Fatalf("%v %s", err, out)
	}
	return p
}

func TestPipelineDownloadsEncodesAndRotates(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("HOMEFLIX_COMINGSOON_DIR", dir)
	f := fakeTMDB{
		"/discover/movie": M{"results": []M{{"id": 1, "popularity": 300}, {"id": 8, "popularity": 70}}},
		"/movie/upcoming": M{"results": []M{}},
		"/movie/1":        movie(1, "Big Sequel", "2026-12-18", 300, cast(80, 60, 40), nil),
		"/movie/8":        movie(8, "Spring Blockbuster", "2027-04-17", 70, cast(70, 30, 20), nil),
		"/discover/tv":    M{"results": []M{}},
		"/tv/popular":     M{"results": []M{}},
		"/tv/on_the_air":  M{"results": []M{}},
	}
	s := New(f)
	s.now = func() time.Time { return now }
	downloads := 0
	s.downloadFn = func(ctx context.Context, id, job string) (string, error) {
		downloads++
		src := fakeTrailer(t, job)
		return src, nil
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go s.worker(ctx)
	if err := s.Refresh(ctx); err != nil {
		t.Fatal(err)
	}
	waitReady := func(n int) Snapshot {
		deadline := time.Now().Add(90 * time.Second)
		for time.Now().Before(deadline) {
			snap := s.Snapshot(false)
			ready := 0
			for _, e := range snap.Movies {
				if e.State == StateReady {
					ready++
				}
			}
			if ready == n {
				return snap
			}
			time.Sleep(300 * time.Millisecond)
		}
		t.Fatalf("not ready: %+v", s.Snapshot(false))
		return Snapshot{}
	}
	snap := waitReady(2)
	v := snap.Movies[0].Video
	if v == nil || v.Width != 1920 || v.Height%2 != 0 || v.Bytes <= 0 || v.Bytes > DefaultBudget/20 {
		t.Fatalf("video %+v", v)
	}
	if _, ok := s.VideoPath(v.File); !ok {
		t.Fatal("video not served")
	}
	if _, ok := s.VideoPath("../state.json"); ok {
		t.Fatal("path traversal")
	}
	// Big Sequel gets released (drops out); a new title arrives; Spring keeps its video.
	delete(f, "/movie/1")
	f["/discover/movie"] = M{"results": []M{{"id": 8, "popularity": 70}, {"id": 9, "popularity": 60}}}
	f["/movie/9"] = movie(9, "Summer Epic", "2027-07-04", 60, cast(40, 30, 20), nil)
	before := downloads
	if err := s.Refresh(ctx); err != nil {
		t.Fatal(err)
	}
	snap = waitReady(2)
	if downloads != before+1 {
		t.Fatalf("re-downloaded existing trailers: %d -> %d", before, downloads)
	}
	if len(snap.Movies) != 2 || snap.Movies[0].Title != "Spring Blockbuster" || snap.Movies[1].Title != "Summer Epic" {
		t.Fatalf("lineup %v %v", snap.Movies[0].Title, snap.Movies[1].Title)
	}
	files, _ := filepath.Glob(filepath.Join(dir, "videos", "*.mp4"))
	if len(files) != 2 {
		t.Fatalf("old video kept: %v", files)
	}
	// Without yt-dlp: titles stay, with the YouTube fallback.
	s.downloadFn = func(ctx context.Context, id, job string) (string, error) { return "", errNoTool }
	f["/movie/9"] = movie(9, "Summer Epic", "2027-07-04", 60, cast(40, 30, 20), M{"videos": M{"results": []M{{"key": "newTrailer1", "name": "Official Trailer 2", "site": "YouTube", "type": "Trailer", "official": true}}}})
	s.Refresh(ctx)
	time.Sleep(1500 * time.Millisecond)
	e, _ := s.Entry("movie", 9)
	if e.State != StateNoTool || e.YouTubeID != "newTrailer1" || e.Video != nil {
		t.Fatalf("no-tool entry %+v", e)
	}
	if _, err := os.Stat(filepath.Join(dir, "state.json")); err != nil {
		t.Fatal("state not saved")
	}
}

func TestBudgetEvictsLowestRank(t *testing.T) {
	s := &Service{st: state{Settings: Settings{BudgetBytes: 100}, Entries: map[string]*Entry{}}, dir: t.TempDir()}
	for i := 1; i <= 3; i++ {
		s.st.Entries[fmt.Sprintf("movie-%d", i)] = &Entry{Candidate: Candidate{TMDBID: i, MediaType: "movie"}, Rank: i, State: StateReady, Video: &Video{File: fmt.Sprintf("movie-%d.mp4", i), Bytes: 45}}
	}
	s.enforceBudgetLocked()
	if s.st.Entries["movie-3"].Video != nil || s.st.Entries["movie-3"].State != StateOverBudget || s.st.Entries["movie-1"].Video == nil {
		t.Fatal("wrong eviction")
	}
}

func TestVideoKbps(t *testing.T) {
	// ~51 MB for a 150 s trailer -> about 2.5 Mb/s of video
	if k := videoKbps(DefaultBudget/20, 150); k < 2300 || k > 2700 {
		t.Fatalf("kbps %d", k)
	}
	if k := videoKbps(DefaultBudget/20, 20); k != 6000 {
		t.Fatalf("short clip cap %d", k)
	}
}
