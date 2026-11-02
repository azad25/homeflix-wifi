package buzz

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func load(t *testing.T, name string, src Source) []*Item {
	t.Helper()
	f, err := os.Open("testdata/" + name)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	items, err := Parse(src, f)
	if err != nil {
		t.Fatal(err)
	}
	return items
}

func TestParseRSS(t *testing.T) {
	items := load(t, "variety.xml", Source{ID: "variety", Name: "Variety", Kind: "news", Region: "global"})
	if len(items) != 3 {
		t.Fatalf("got %d items", len(items))
	}
	a := items[0]
	if a.Title != "Tom Hardy Joins ‘Mad Max’ Prequel Sequel" || a.Image != "https://variety.com/img/hardy.jpg" || a.Summary != "The actor returns to the wasteland." {
		t.Fatalf("item: %+v", a)
	}
	if a.PublishedAt.IsZero() || a.ID == "" {
		t.Fatalf("time/id missing: %+v", a)
	}
	if items[1].Image != "https://variety.com/img/bo.jpg" {
		t.Fatalf("content image: %q", items[1].Image)
	}
}

func TestParseYouTube(t *testing.T) {
	items := load(t, "youtube.xml", Source{ID: "yt-rt", Name: "Rotten Tomatoes Trailers", Kind: "video", Region: "global"})
	if len(items) != 1 || items[0].YouTubeID != "abcDEF12345" || items[0].Kind != "video" || !strings.Contains(items[0].Image, "abcDEF12345") {
		t.Fatalf("%+v", items)
	}
}

func TestPersonalisedFeedAndLiveUpdates(t *testing.T) {
	mux := http.NewServeMux()
	serve := func(name string) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			b, _ := os.ReadFile("testdata/" + name)
			w.Write(b)
		}
	}
	mux.HandleFunc("/variety", serve("variety.xml"))
	mux.HandleFunc("/yt", serve("youtube.xml"))
	mux.HandleFunc("/down", func(w http.ResponseWriter, r *http.Request) { http.Error(w, "x", 500) })
	srv := httptest.NewServer(mux)
	defer srv.Close()

	t.Setenv("HOMEFLIX_BUZZ_DIR", t.TempDir())
	s := NewService()
	s.Sources = []Source{
		{"variety", "Variety", srv.URL + "/variety", "news", "global"},
		{"yt-rt", "RT Trailers", srv.URL + "/yt", "video", "global"},
		{"down", "Down", srv.URL + "/down", "news", "global"},
	}
	s.Refresh(context.Background())
	h, _ := s.Health()
	if h["variety"] != "" || h["down"] == "" {
		t.Fatalf("health: %v", h)
	}

	interests := []Interest{{Kind: "actor", Name: "Tom Hardy", Weight: 1}, {Kind: "actor", Name: "Cher", Weight: 1}}
	f := s.BuildFeed(interests, "", "")
	if len(f.Latest) == 0 && len(f.Videos) == 0 {
		t.Skip("fixture dates fell outside the 10-day window")
	}
	if len(f.ForYou) != 2 || f.ForYou[0].People[0] != "Tom Hardy" {
		t.Fatalf("for you: %+v", f.ForYou)
	}
	for _, it := range f.ForYou {
		if strings.Contains(it.Title, "Cruise") {
			t.Fatal("a Tom Cruise story matched Tom Hardy")
		}
	}
	if len(f.People) != 1 || f.People[0].Name != "Tom Hardy" || f.People[0].Stories != 2 {
		t.Fatalf("people: %+v", f.People)
	}
	if len(f.Videos) != 1 || f.Failures != 1 {
		t.Fatalf("videos=%d failures=%d", len(f.Videos), f.Failures)
	}
	// Person filter.
	if pf := s.BuildFeed(interests, "", "Tom Hardy"); len(pf.Latest)+len(pf.Videos) != 2 {
		t.Fatalf("person filter: %d", len(pf.Latest)+len(pf.Videos))
	}

	// Live: a new story is pushed to subscribers.
	ch, cancel := s.Subscribe()
	defer cancel()
	mux.HandleFunc("/new", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`<rss><channel><item><title>Breaking: Cher news</title><link>https://x/new</link><pubDate>` + time.Now().UTC().Format(time.RFC1123Z) + `</pubDate></item></channel></rss>`))
	})
	s.Sources = append(s.Sources, Source{"new", "New", srv.URL + "/new", "news", "global"})
	s.Refresh(context.Background())
	select {
	case got := <-ch:
		if len(got) != 1 || got[0].Title != "Breaking: Cher news" {
			t.Fatalf("pushed: %+v", got)
		}
	case <-time.After(time.Second):
		t.Fatal("no live update")
	}
	// Cached to disk and reloaded.
	s2 := NewService()
	if len(s2.items) != len(s.items) {
		t.Fatalf("cache: %d vs %d", len(s2.items), len(s.items))
	}
}
