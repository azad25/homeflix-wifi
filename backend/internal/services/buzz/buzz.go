// Package buzz collects entertainment news (RSS/Atom from film & TV press,
// Bollywood and K-drama sites) and videos (official YouTube channel feeds),
// and personalises them with the people a household watches.
package buzz

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

// Source is a news or video feed.
type Source struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	URL    string `json:"url"`
	Kind   string `json:"kind"`   // news | video
	Region string `json:"region"` // global | in | kr | bd
}

// DefaultSources: well-known film/TV outlets and official channels. A feed
// that fails is skipped and reported in Health.
var DefaultSources = []Source{
	{"variety", "Variety", "https://variety.com/feed/", "news", "global"},
	{"deadline", "Deadline", "https://deadline.com/feed/", "news", "global"},
	{"thr", "The Hollywood Reporter", "https://www.hollywoodreporter.com/feed/", "news", "global"},
	{"indiewire", "IndieWire", "https://www.indiewire.com/feed/", "news", "global"},
	{"collider", "Collider", "https://collider.com/feed/", "news", "global"},
	{"screenrant", "Screen Rant", "https://screenrant.com/feed/", "news", "global"},
	{"slashfilm", "/Film", "https://www.slashfilm.com/feed/", "news", "global"},
	{"imdb", "IMDb News", "https://www.imdb.com/news/feed", "news", "global"},
	{"rottentomatoes", "Rotten Tomatoes", "https://editorial.rottentomatoes.com/feed/", "news", "global"},
	{"movieweb", "MovieWeb", "https://movieweb.com/feed/", "news", "global"},
	{"cbr", "CBR", "https://www.cbr.com/feed/", "news", "global"},
	{"denofgeek", "Den of Geek", "https://www.denofgeek.com/feed/", "news", "global"},
	{"joblo", "JoBlo", "https://www.joblo.com/feed/", "news", "global"},
	{"comingsoon", "ComingSoon.net", "https://www.comingsoon.net/feed", "news", "global"},
	{"koimoi", "Koimoi", "https://www.koimoi.com/feed/", "news", "in"},
	{"bollywoodhungama", "Bollywood Hungama", "https://www.bollywoodhungama.com/feed/", "news", "in"},
	{"soompi", "Soompi", "https://www.soompi.com/feed", "news", "kr"},
	{"letterboxd-journal", "Letterboxd Journal", "https://letterboxd.com/journal/rss/", "news", "global"},
	{"yt-rt", "Rotten Tomatoes Trailers", "https://www.youtube.com/feeds/videos.xml?channel_id=UCi8e0iOVk1fEOogdfu4YgfA", "video", "global"},
	{"yt-ign", "IGN", "https://www.youtube.com/feeds/videos.xml?channel_id=UCKy1dAqELo0zrOtPkf0eTMw", "video", "global"},
	{"yt-netflix", "Netflix", "https://www.youtube.com/feeds/videos.xml?channel_id=UCWOA1ZGywLbqmigxE4Qlvuw", "video", "global"},
	{"yt-marvel", "Marvel Entertainment", "https://www.youtube.com/feeds/videos.xml?channel_id=UCvC4D8onUfXzvjTOM-dBfEA", "video", "global"},
	{"yt-wb", "Warner Bros. Pictures", "https://www.youtube.com/feeds/videos.xml?channel_id=UCjmJDM5pRKbUlVIzDYYWb6g", "video", "global"},
	{"yt-universal", "Universal Pictures", "https://www.youtube.com/feeds/videos.xml?channel_id=UCq0OueAsdxH6b8nyAspwViw", "video", "global"},
	{"yt-tseries", "T-Series", "https://www.youtube.com/feeds/videos.xml?channel_id=UCq-Fj5jknLsUf-MWSy4_brA", "video", "in"},
	{"yt-yrf", "Yash Raj Films", "https://www.youtube.com/feeds/videos.xml?channel_id=UCbTLwN10NoCU4WDzLf1JMOA", "video", "in"},
}

// Item is a story or video.
type Item struct {
	ID          string    `json:"id"`
	Kind        string    `json:"kind"` // news | video
	Title       string    `json:"title"`
	Summary     string    `json:"summary,omitempty"`
	URL         string    `json:"url"`
	Image       string    `json:"image,omitempty"`
	YouTubeID   string    `json:"youtube_id,omitempty"`
	Source      string    `json:"source"`
	SourceID    string    `json:"source_id"`
	Region      string    `json:"region"`
	PublishedAt time.Time `json:"published_at"`
	// Letterboxd diary/review entry (Kind "letterboxd").
	Letterboxd *LetterboxdEntry `json:"letterboxd,omitempty"`
	// Set per viewer by Feed.
	People []string `json:"people,omitempty"` // matched actors/directors
	Score  float64  `json:"score,omitempty"`
}

// LetterboxdEntry is a film a followed Letterboxd member logged.
type LetterboxdEntry struct {
	Member      string  `json:"member"`   // display name
	Username    string  `json:"username"` // letterboxd.com/<username>
	Film        string  `json:"film"`     // empty for lists
	Year        int     `json:"year,omitempty"`
	Rating      float64 `json:"rating,omitempty"` // 0.5-5 stars, 0 = not rated
	Liked       bool    `json:"liked,omitempty"`
	Rewatch     bool    `json:"rewatch,omitempty"`
	WatchedDate string  `json:"watched_date,omitempty"`
	TMDBID      int     `json:"tmdb_id,omitempty"`
	Review      string  `json:"review,omitempty"`
}

// Settings: what the viewer follows besides the built-in sources.
type Settings struct {
	LetterboxdUsers []string `json:"letterboxd_users"`
}

var reLetterboxdUser = regexp.MustCompile(`^[A-Za-z0-9_]{2,30}$`)

// LetterboxdSource is a member's public diary feed.
func LetterboxdSource(user string) Source {
	return Source{ID: "lb-" + strings.ToLower(user), Name: user + " on Letterboxd", URL: "https://letterboxd.com/" + user + "/rss/", Kind: "letterboxd", Region: "global"}
}

type Service struct {
	Sources []Source
	client  *http.Client
	dir     string

	mu      sync.RWMutex
	items   map[string]*Item
	health  map[string]string // source id -> "" ok, else error
	updated time.Time

	subsMu sync.Mutex
	subs   map[chan []Item]struct{}
	kick   chan struct{}

	setMu    sync.RWMutex
	settings Settings
}

func (s *Service) Settings() Settings {
	s.setMu.RLock()
	defer s.setMu.RUnlock()
	out := Settings{LetterboxdUsers: append([]string{}, s.settings.LetterboxdUsers...)}
	return out
}

// UpdateSettings validates and saves; items of unfollowed members go away
// and new members are fetched right away.
func (s *Service) UpdateSettings(in Settings) (Settings, error) {
	seen := map[string]bool{}
	var users []string
	for _, u := range in.LetterboxdUsers {
		u = strings.TrimSpace(strings.TrimPrefix(strings.TrimSuffix(strings.TrimSpace(u), "/"), "@"))
		if i := strings.LastIndex(u, "letterboxd.com/"); i >= 0 { // pasted profile URL
			u = strings.SplitN(u[i+len("letterboxd.com/"):], "/", 2)[0]
		}
		if u == "" || seen[strings.ToLower(u)] {
			continue
		}
		if !reLetterboxdUser.MatchString(u) {
			return Settings{}, fmt.Errorf("%q isn't a Letterboxd username", u)
		}
		seen[strings.ToLower(u)] = true
		users = append(users, u)
	}
	if len(users) > 20 {
		return Settings{}, fmt.Errorf("follow at most 20 Letterboxd members")
	}
	out := Settings{LetterboxdUsers: users}
	if err := os.MkdirAll(s.dir, 0o755); err == nil {
		if b, err := json.MarshalIndent(out, "", "  "); err == nil {
			if err := os.WriteFile(filepath.Join(s.dir, "settings.json"), b, 0o644); err != nil {
				return Settings{}, err
			}
		}
	}
	s.setMu.Lock()
	s.settings = out
	s.setMu.Unlock()
	keep := map[string]bool{}
	for _, src := range s.allSources() {
		keep[src.ID] = true
	}
	s.mu.Lock()
	for id, it := range s.items {
		if it.Kind == "letterboxd" && !keep[it.SourceID] {
			delete(s.items, id)
		}
	}
	for id := range s.health {
		if !keep[id] {
			delete(s.health, id)
		}
	}
	s.mu.Unlock()
	s.Kick()
	return out, nil
}

// allSources: the built-in sources plus followed Letterboxd members.
func (s *Service) allSources() []Source {
	out := append([]Source{}, s.Sources...)
	for _, u := range s.Settings().LetterboxdUsers {
		out = append(out, LetterboxdSource(u))
	}
	return out
}

// NewService uses $HOMEFLIX_BUZZ_DIR (default ./data/buzz) for its cache.
func NewService() *Service {
	dir := strings.TrimSpace(os.Getenv("HOMEFLIX_BUZZ_DIR"))
	if dir == "" {
		dir = "data/buzz"
	}
	s := &Service{
		Sources: DefaultSources,
		client:  &http.Client{Timeout: 20 * time.Second},
		dir:     dir,
		items:   map[string]*Item{},
		health:  map[string]string{},
		subs:    map[chan []Item]struct{}{},
		kick:    make(chan struct{}, 1),
	}
	if b, err := os.ReadFile(filepath.Join(dir, "settings.json")); err == nil {
		_ = json.Unmarshal(b, &s.settings)
	}
	var cached []*Item
	if b, err := os.ReadFile(filepath.Join(dir, "items.json")); err == nil && json.Unmarshal(b, &cached) == nil {
		for _, it := range cached {
			s.items[it.ID] = it
		}
	}
	return s
}

// ---- parsing ----

type rss struct {
	Channel struct {
		Items []struct {
			Title       string `xml:"title"`
			Link        string `xml:"link"`
			GUID        string `xml:"guid"`
			PubDate     string `xml:"pubDate"`
			Description string `xml:"description"`
			Content     string `xml:"http://purl.org/rss/1.0/modules/content/ encoded"`
			Enclosure   struct {
				URL  string `xml:"url,attr"`
				Type string `xml:"type,attr"`
			} `xml:"enclosure"`
			Media []struct {
				URL    string `xml:"url,attr"`
				Medium string `xml:"medium,attr"`
				Type   string `xml:"type,attr"`
			} `xml:"http://search.yahoo.com/mrss/ content"`
			Thumb []struct {
				URL string `xml:"url,attr"`
			} `xml:"http://search.yahoo.com/mrss/ thumbnail"`
			// Letterboxd member feeds
			Creator      string `xml:"http://purl.org/dc/elements/1.1/ creator"`
			FilmTitle    string `xml:"https://letterboxd.com filmTitle"`
			FilmYear     int    `xml:"https://letterboxd.com filmYear"`
			MemberRating string `xml:"https://letterboxd.com memberRating"`
			MemberLike   string `xml:"https://letterboxd.com memberLike"`
			Rewatch      string `xml:"https://letterboxd.com rewatch"`
			WatchedDate  string `xml:"https://letterboxd.com watchedDate"`
			TMDBMovieID  int    `xml:"https://themoviedb.org movieId"`
		} `xml:"item"`
	} `xml:"channel"`
}

type atom struct {
	Entries []struct {
		ID        string `xml:"id"`
		VideoID   string `xml:"http://www.youtube.com/xml/schemas/2015 videoId"`
		Title     string `xml:"title"`
		Published string `xml:"published"`
		Link      struct {
			Href string `xml:"href,attr"`
		} `xml:"link"`
		Group struct {
			Description string `xml:"http://search.yahoo.com/mrss/ description"`
			Thumbnail   struct {
				URL string `xml:"url,attr"`
			} `xml:"http://search.yahoo.com/mrss/ thumbnail"`
		} `xml:"http://search.yahoo.com/mrss/ group"`
	} `xml:"entry"`
}

var (
	reImg  = regexp.MustCompile(`(?i)<img[^>]+src=["']([^"']+)["']`)
	reTags = regexp.MustCompile(`<[^>]*>`)
	reWS   = regexp.MustCompile(`\s+`)
	// "wasteland ." -> "wasteland." after tags were replaced by spaces
	rePunctSpace = regexp.MustCompile(`\s+([.,!?;:])`)
)

func plain(s string, max int) string {
	s = html.UnescapeString(reTags.ReplaceAllString(s, " "))
	s = strings.TrimSpace(reWS.ReplaceAllString(s, " "))
	s = rePunctSpace.ReplaceAllString(s, "$1")
	if max > 0 && len([]rune(s)) > max {
		r := []rune(s)[:max]
		s = strings.TrimSpace(string(r)) + "…"
	}
	return s
}

func parseTime(s string) time.Time {
	s = strings.TrimSpace(s)
	for _, l := range []string{time.RFC1123Z, time.RFC1123, time.RFC3339, "Mon, 2 Jan 2006 15:04:05 -0700", "Mon, 2 Jan 2006 15:04:05 MST", "2006-01-02T15:04:05Z07:00"} {
		if t, err := time.Parse(l, s); err == nil {
			return t.UTC()
		}
	}
	return time.Time{}
}

func itemID(src, key string) string {
	h := uint64(1469598103934665603)
	for _, c := range []byte(src + "|" + key) {
		h ^= uint64(c)
		h *= 1099511628211
	}
	return src + "-" + strings.ToLower(strings.TrimLeft(strings.ToUpper(hex64(h)), "0"))
}

func hex64(v uint64) string {
	const d = "0123456789abcdef"
	b := make([]byte, 16)
	for i := 15; i >= 0; i-- {
		b[i] = d[v&15]
		v >>= 4
	}
	return string(b)
}

// Parse reads an RSS or Atom (YouTube) document from a source.
func Parse(src Source, r io.Reader) ([]*Item, error) {
	body, err := io.ReadAll(io.LimitReader(r, 8<<20))
	if err != nil {
		return nil, err
	}
	var out []*Item
	if strings.Contains(string(body[:min(len(body), 2048)]), "<feed") {
		var a atom
		if err := xml.Unmarshal(body, &a); err != nil {
			return nil, err
		}
		for _, e := range a.Entries {
			if e.Title == "" {
				continue
			}
			it := &Item{Kind: src.Kind, Title: plain(e.Title, 200), URL: e.Link.Href, YouTubeID: e.VideoID, Image: e.Group.Thumbnail.URL,
				Summary: plain(e.Group.Description, 280), Source: src.Name, SourceID: src.ID, Region: src.Region, PublishedAt: parseTime(e.Published)}
			if it.YouTubeID != "" {
				it.Kind = "video"
				if it.Image == "" {
					it.Image = "https://i.ytimg.com/vi/" + it.YouTubeID + "/hqdefault.jpg"
				}
			}
			it.ID = itemID(src.ID, firstNonEmpty(e.ID, e.Link.Href, e.Title))
			out = append(out, it)
		}
		return out, nil
	}
	var feed rss
	if err := xml.Unmarshal(body, &feed); err != nil {
		return nil, err
	}
	for _, e := range feed.Channel.Items {
		if e.Title == "" || e.Link == "" {
			continue
		}
		img := ""
		for _, m := range e.Media {
			if m.URL != "" && (m.Medium == "image" || strings.HasPrefix(m.Type, "image") || m.Medium == "") {
				img = m.URL
				break
			}
		}
		if img == "" && len(e.Thumb) > 0 {
			img = e.Thumb[0].URL
		}
		if img == "" && strings.HasPrefix(e.Enclosure.Type, "image") {
			img = e.Enclosure.URL
		}
		if img == "" {
			if m := reImg.FindStringSubmatch(e.Content + e.Description); m != nil {
				img = html.UnescapeString(m[1])
			}
		}
		it := &Item{Kind: src.Kind, Title: plain(e.Title, 200), URL: strings.TrimSpace(e.Link), Image: img,
			Summary: plain(firstNonEmpty(e.Description, e.Content), 280), Source: src.Name, SourceID: src.ID, Region: src.Region,
			PublishedAt: parseTime(e.PubDate)}
		it.ID = itemID(src.ID, firstNonEmpty(e.GUID, e.Link))
		if src.Kind == "letterboxd" {
			lb := &LetterboxdEntry{
				Member:      firstNonEmpty(strings.TrimSpace(e.Creator), strings.TrimSuffix(src.Name, " on Letterboxd")),
				Username:    strings.TrimPrefix(src.ID, "lb-"),
				Film:        strings.TrimSpace(e.FilmTitle),
				Year:        e.FilmYear,
				Liked:       strings.EqualFold(e.MemberLike, "yes"),
				Rewatch:     strings.EqualFold(e.Rewatch, "yes"),
				WatchedDate: strings.TrimSpace(e.WatchedDate),
				TMDBID:      e.TMDBMovieID,
			}
			if u := reLetterboxdURLUser.FindStringSubmatch(it.URL); u != nil {
				lb.Username = u[1]
			}
			fmt.Sscan(strings.TrimSpace(e.MemberRating), &lb.Rating)
			// The description is the poster then the review; "Watched on ..." when there's no review.
			review := plain(e.Description, 400)
			if strings.HasPrefix(review, "Watched on ") || strings.HasPrefix(review, "Rewatched on ") || strings.HasPrefix(review, "Added ") {
				review = ""
			}
			lb.Review = review
			it.Summary = review
			if lb.Film != "" {
				it.Title = lb.Film
			}
			it.Letterboxd = lb
		}
		out = append(out, it)
	}
	return out, nil
}

var reLetterboxdURLUser = regexp.MustCompile(`letterboxd\.com/([A-Za-z0-9_]+)/`)

func firstNonEmpty(v ...string) string {
	for _, s := range v {
		if strings.TrimSpace(s) != "" {
			return s
		}
	}
	return ""
}

// ---- fetching ----

func (s *Service) fetch(ctx context.Context, src Source) ([]*Item, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, src.URL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; HomeFlix/5.5; +https://github.com/azad25/homeflix-wifi)")
	req.Header.Set("Accept", "application/rss+xml, application/atom+xml, application/xml, text/xml")
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, &httpError{resp.StatusCode}
	}
	return Parse(src, resp.Body)
}

type httpError struct{ code int }

func (e *httpError) Error() string { return "HTTP " + http.StatusText(e.code) }

// Refresh fetches every source (a few at a time) and publishes new items.
func (s *Service) Refresh(ctx context.Context) int {
	type res struct {
		src   Source
		items []*Item
		err   error
	}
	ch := make(chan res)
	sem := make(chan struct{}, 6)
	sources := s.allSources()
	for _, src := range sources {
		go func(src Source) {
			sem <- struct{}{}
			defer func() { <-sem }()
			items, err := s.fetch(ctx, src)
			ch <- res{src, items, err}
		}(src)
	}
	var fresh []Item
	s.mu.Lock()
	for range sources {
		r := <-ch
		if r.err != nil {
			s.health[r.src.ID] = r.err.Error()
			continue
		}
		s.health[r.src.ID] = ""
		for _, it := range r.items {
			if it.PublishedAt.IsZero() {
				it.PublishedAt = time.Now().UTC()
			}
			if it.PublishedAt.Before(cutoffFor(it)) {
				continue
			}
			if _, seen := s.items[it.ID]; !seen {
				s.items[it.ID] = it
				if len(s.items) > 0 && !s.updated.IsZero() {
					fresh = append(fresh, *it)
				}
			}
		}
	}
	// Keep the newest 800.
	all := make([]*Item, 0, len(s.items))
	for _, it := range s.items {
		if it.PublishedAt.After(cutoffFor(it)) {
			all = append(all, it)
		}
	}
	sort.Slice(all, func(i, j int) bool { return all[i].PublishedAt.After(all[j].PublishedAt) })
	if len(all) > 800 {
		all = all[:800]
	}
	s.items = map[string]*Item{}
	for _, it := range all {
		s.items[it.ID] = it
	}
	s.updated = time.Now()
	s.mu.Unlock()

	if err := os.MkdirAll(s.dir, 0o755); err == nil {
		if b, err := json.Marshal(all); err == nil {
			_ = os.WriteFile(filepath.Join(s.dir, "items.json"), b, 0o644)
		}
	}
	if len(fresh) > 0 {
		s.publish(fresh)
	}
	return len(fresh)
}

// cutoffFor: news goes stale in 10 days; friends' diaries are slower.
func cutoffFor(it *Item) time.Time {
	if it.Kind == "letterboxd" {
		return time.Now().Add(-90 * 24 * time.Hour)
	}
	return time.Now().Add(-10 * 24 * time.Hour)
}

// Run refreshes every 20 minutes (and when kicked).
func (s *Service) Run(ctx context.Context) {
	s.Refresh(ctx)
	t := time.NewTicker(20 * time.Minute)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		case <-s.kick:
		}
		n := s.Refresh(ctx)
		if n > 0 {
			log.Printf("📰 Buzz: %d new stories/videos", n)
		}
	}
}

func (s *Service) Kick() {
	select {
	case s.kick <- struct{}{}:
	default:
	}
}

// ---- live updates ----

// Subscribe receives batches of new items until cancel is called.
func (s *Service) Subscribe() (<-chan []Item, func()) {
	ch := make(chan []Item, 4)
	s.subsMu.Lock()
	s.subs[ch] = struct{}{}
	s.subsMu.Unlock()
	return ch, func() {
		s.subsMu.Lock()
		delete(s.subs, ch)
		s.subsMu.Unlock()
	}
}

func (s *Service) publish(items []Item) {
	s.subsMu.Lock()
	defer s.subsMu.Unlock()
	for ch := range s.subs {
		select {
		case ch <- items:
		default: // slow client: it will catch up on its next full load
		}
	}
}

// ---- reading ----

// Health reports each source's last fetch result.
func (s *Service) Health() (map[string]string, time.Time) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	h := make(map[string]string, len(s.health))
	for k, v := range s.health {
		h[k] = v
	}
	return h, s.updated
}

// Interest is what the viewer cares about (from the taste profile).
type Interest struct {
	Kind   string
	Name   string
	Weight float64
}

// Feed is the personalised page.
type Feed struct {
	ForYou []Item `json:"for_you"`
	Latest []Item `json:"latest"`
	Videos []Item `json:"videos"`
	// Diary entries and reviews of followed Letterboxd members, newest first.
	Letterboxd []Item         `json:"letterboxd"`
	People     []PersonBuzz   `json:"people"`
	Regions    map[string]int `json:"regions"`
	Updated    time.Time      `json:"updated"`
	Sources    int            `json:"sources"`
	Failures   int            `json:"failures"`
}

// PersonBuzz: someone the viewer watches and how many stories mention them.
type PersonBuzz struct {
	Name    string `json:"name"`
	Kind    string `json:"kind"`
	Stories int    `json:"stories"`
}

// mentions: whole-name, case-insensitive match ("Tom Hardy", not "Tom").
func mentions(text, name string) bool {
	if len(name) < 4 || !strings.Contains(name, " ") {
		return false // single names are too ambiguous
	}
	t := " " + strings.ToLower(reNonWord.ReplaceAllString(text, " ")) + " "
	n := " " + strings.ToLower(reNonWord.ReplaceAllString(name, " ")) + " "
	return strings.Contains(t, n)
}

var reNonWord = regexp.MustCompile(`[^\p{L}\p{N}]+`)

// BuildFeed ranks items for the viewer: stories about the people and genres
// they watch first, then everything by recency.
func (s *Service) BuildFeed(interests []Interest, region, person string) Feed {
	s.mu.RLock()
	all := make([]Item, 0, len(s.items))
	for _, it := range s.items {
		all = append(all, *it)
	}
	updated := s.updated
	failures := 0
	for _, e := range s.health {
		if e != "" {
			failures++
		}
	}
	s.mu.RUnlock()
	sort.Slice(all, func(i, j int) bool { return all[i].PublishedAt.After(all[j].PublishedAt) })

	f := Feed{Regions: map[string]int{}, Updated: updated, Sources: len(s.allSources()), Failures: failures, Letterboxd: []Item{}}
	counts := map[string]int{}
	now := time.Now()
	var scored []Item
	for _, it := range all {
		if it.Kind == "letterboxd" {
			if len(f.Letterboxd) < 40 {
				f.Letterboxd = append(f.Letterboxd, it)
			}
			continue
		}
		f.Regions[it.Region]++
		if region != "" && it.Region != region && it.Region != "global" {
			continue
		}
		text := it.Title + " " + it.Summary
		score := 0.0
		for _, in := range interests {
			if in.Kind == "genre" {
				if strings.Contains(strings.ToLower(text), strings.ToLower(in.Name)) {
					score += 0.3 * in.Weight
				}
				continue
			}
			if mentions(text, in.Name) {
				it.People = append(it.People, in.Name)
				counts[in.Name]++
				score += 2 * in.Weight
			}
		}
		if person != "" && !contains(it.People, person) && !mentions(text, person) {
			continue
		}
		age := now.Sub(it.PublishedAt).Hours()
		it.Score = score + 1/(1+age/24) // fresher is better
		if it.Kind == "video" {
			if len(f.Videos) < 40 {
				f.Videos = append(f.Videos, it)
			}
		} else if len(f.Latest) < 60 {
			f.Latest = append(f.Latest, it)
		}
		if score > 0 {
			scored = append(scored, it)
		}
	}
	sort.SliceStable(scored, func(i, j int) bool { return scored[i].Score > scored[j].Score })
	if len(scored) > 24 {
		scored = scored[:24]
	}
	f.ForYou = scored
	for _, in := range interests {
		if in.Kind != "genre" && counts[in.Name] > 0 {
			f.People = append(f.People, PersonBuzz{Name: in.Name, Kind: in.Kind, Stories: counts[in.Name]})
		}
	}
	return f
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if strings.EqualFold(x, v) {
			return true
		}
	}
	return false
}
