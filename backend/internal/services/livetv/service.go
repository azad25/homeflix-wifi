package livetv

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// Settings are edited in Settings > Live TV.
type Settings struct {
	Enabled           bool     `json:"enabled"`
	Countries         []string `json:"countries"`
	ExcludeCategories []string `json:"exclude_categories"`
	CustomPlaylists   []string `json:"custom_playlists"`
	// Hide channels whose streams failed the last check.
	HideOffline bool `json:"hide_offline"`
	// Broadcasters' official YouTube live streams for the selected countries.
	OfficialYouTube bool `json:"official_youtube"`
	// Extra YouTube live channels added by the admin.
	YouTubeChannels []YouTubeChannel `json:"youtube_channels"`
}

// DefaultSettings: Bangladesh, India, USA, China, Korea, major EU countries
// and Arab countries.
func DefaultSettings() Settings {
	return Settings{
		Enabled:           true,
		Countries:         []string{"BD", "IN", "US", "CN", "KR", "GB", "FR", "DE", "ES", "IT", "NL", "SA", "AE", "QA", "EG", "KW", "LB"},
		ExcludeCategories: []string{},
		CustomPlaylists:   []string{},
		HideOffline:       true,
		OfficialYouTube:   true,
		YouTubeChannels:   []YouTubeChannel{},
	}
}

// Service owns the lineup, its health and the stream proxy.
type Service struct {
	store    store
	client   *http.Client // catalog + checks (public internet only)
	proxy    *Proxy
	mu       sync.RWMutex
	settings Settings
	catalog  *Catalog
	byID     map[string]*Channel

	yt       *ytResolver
	syncing  atomic.Bool
	checking atomic.Bool
	lastErr  atomic.Value // string
	progress atomic.Int64 // streams checked in the current pass
	total    atomic.Int64
	kick     chan struct{}

	favs favorites
}

// NewService uses $HOMEFLIX_LIVETV_DIR or ./data/livetv.
func NewService() *Service {
	dir := strings.TrimSpace(os.Getenv("HOMEFLIX_LIVETV_DIR"))
	if dir == "" {
		dir = "data/livetv"
	}
	s := &Service{
		store:  store{dir: dir},
		client: newClient(false, 60*time.Second),
		kick:   make(chan struct{}, 1),
	}
	s.yt = newYTResolver(newClient(false, 20*time.Second))
	s.settings = DefaultSettings()
	_ = s.store.load("settings.json", &s.settings)
	var cat Catalog
	if err := s.store.load("catalog.json", &cat); err == nil {
		s.setCatalog(&cat)
	}
	s.loadFavorites()
	s.proxy = NewProxy(s.secret())
	s.lastErr.Store("")
	return s
}

func (s *Service) secret() []byte {
	var hexKey string
	if b, err := os.ReadFile(s.store.path("secret")); err == nil && len(b) >= 32 {
		hexKey = strings.TrimSpace(string(b))
	} else {
		k := make([]byte, 32)
		_, _ = rand.Read(k)
		hexKey = hex.EncodeToString(k)
		_ = os.MkdirAll(s.store.dir, 0o755)
		_ = os.WriteFile(s.store.path("secret"), []byte(hexKey), 0o600)
	}
	k, _ := hex.DecodeString(hexKey)
	return k
}

// Proxy serves the signed stream URLs.
func (s *Service) Proxy() *Proxy { return s.proxy }

func (s *Service) setCatalog(c *Catalog) {
	byID := make(map[string]*Channel, len(c.Channels))
	for _, ch := range c.Channels {
		byID[ch.ID] = ch
	}
	s.mu.Lock()
	s.catalog, s.byID = c, byID
	s.mu.Unlock()
}

// Settings returns a copy of the current settings.
func (s *Service) Settings() Settings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	st := s.settings
	st.Countries = append([]string(nil), st.Countries...)
	return st
}

// UpdateSettings saves new settings and rebuilds the lineup if the sources changed.
func (s *Service) UpdateSettings(st Settings) error {
	for i, c := range st.Countries {
		st.Countries[i] = strings.ToUpper(strings.TrimSpace(c))
	}
	s.mu.Lock()
	old := s.settings
	s.settings = st
	s.mu.Unlock()
	if err := s.store.save("settings.json", st); err != nil {
		return err
	}
	if strings.Join(old.Countries, ",") != strings.Join(st.Countries, ",") ||
		strings.Join(old.ExcludeCategories, ",") != strings.Join(st.ExcludeCategories, ",") ||
		strings.Join(old.CustomPlaylists, "\n") != strings.Join(st.CustomPlaylists, "\n") ||
		old.OfficialYouTube != st.OfficialYouTube || fmt.Sprint(old.YouTubeChannels) != fmt.Sprint(st.YouTubeChannels) {
		s.Refresh()
	}
	return nil
}

// Status for the settings page.
type Status struct {
	Enabled     bool      `json:"enabled"`
	UpdatedAt   time.Time `json:"updated_at"`
	Source      string    `json:"source"`
	Channels    int       `json:"channels"`
	Online      int       `json:"online"`
	Offline     int       `json:"offline"`
	Unchecked   int       `json:"unchecked"`
	Syncing     bool      `json:"syncing"`
	Checking    bool      `json:"checking"`
	CheckedDone int64     `json:"checked_done"`
	CheckTotal  int64     `json:"check_total"`
	Error       string    `json:"error,omitempty"`
}

func (s *Service) Status() Status {
	s.mu.RLock()
	defer s.mu.RUnlock()
	st := Status{Enabled: s.settings.Enabled, Syncing: s.syncing.Load(), Checking: s.checking.Load(),
		CheckedDone: s.progress.Load(), CheckTotal: s.total.Load(), Error: s.lastErr.Load().(string)}
	if s.catalog != nil {
		st.UpdatedAt, st.Source, st.Channels = s.catalog.UpdatedAt, s.catalog.Source, len(s.catalog.Channels)
		for _, c := range s.catalog.Channels {
			switch c.Status() {
			case "online":
				st.Online++
			case "offline":
				st.Offline++
			default:
				st.Unchecked++
			}
		}
	}
	return st
}

// ChannelView is what clients list.
type ChannelView struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Country    string   `json:"country"`
	Categories []string `json:"categories,omitempty"`
	Logo       string   `json:"logo,omitempty"`
	Status     string   `json:"status"`
	Quality    string   `json:"quality,omitempty"`
	Number     int      `json:"number"`
	Favorite   bool     `json:"favorite,omitempty"`
}

// Filter for Channels.
type Filter struct {
	Country  string
	Category string
	Query    string
	// ByNumber keeps plain lineup order (no favourites on top).
	ByNumber bool
	// FavoritesNumbered numbers favourites 1..k and the rest after them. The
	// TV app sorts channels by number, so this is how favourites reach the
	// top of its list without an app update.
	FavoritesNumbered bool
}

// Channels lists the lineup (numbered in a stable order, like a real TV).
func (s *Service) Channels(f Filter) []ChannelView {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.catalog == nil {
		return []ChannelView{}
	}
	q := strings.ToLower(strings.TrimSpace(f.Query))
	out := make([]ChannelView, 0, 256)
	favCount := 0
	if f.FavoritesNumbered {
		for _, c := range s.catalog.Channels {
			if !(s.settings.HideOffline && c.Status() == "offline") && s.isFavorite(c.ID) {
				favCount++
			}
		}
	}
	n, favN, restN := 0, 0, 0
	for _, c := range s.catalog.Channels {
		status := c.Status()
		if s.settings.HideOffline && status == "offline" {
			continue
		}
		n++
		num := n
		if f.FavoritesNumbered {
			if s.isFavorite(c.ID) {
				favN++
				num = favN
			} else {
				restN++
				num = favCount + restN
			}
		}
		if f.Country != "" && !strings.EqualFold(c.Country, f.Country) {
			continue
		}
		if f.Category != "" && !contains(c.Categories, strings.ToLower(f.Category)) {
			continue
		}
		if q != "" && !strings.Contains(strings.ToLower(c.Name), q) {
			continue
		}
		out = append(out, ChannelView{ID: c.ID, Name: c.Name, Country: c.Country, Categories: c.Categories, Logo: c.Logo, Status: status, Quality: c.Quality(), Number: num, Favorite: s.isFavorite(c.ID)})
	}
	if !f.ByNumber {
		favoritesFirst(out)
	}
	return out
}

// numberOf is the channel's number in the full lineup (the same one Channels reports).
func (s *Service) numberOf(id string) int { return s.NumberOf(id, false) }

// NumberOf is the channel's number as Channels reports it, with or without
// favourites numbered first.
func (s *Service) NumberOf(id string, favoritesNumbered bool) int {
	for _, v := range s.Channels(Filter{ByNumber: true, FavoritesNumbered: favoritesNumbered}) {
		if v.ID == id {
			return v.Number
		}
	}
	return 0
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if strings.EqualFold(x, v) {
			return true
		}
	}
	return false
}

// Facet is a country/category with its channel count.
type Facet struct {
	Code  string `json:"code"`
	Count int    `json:"count"`
}

// Facets counts visible channels per country and category.
func (s *Service) Facets() (countries, categories []Facet) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	cc, kc := map[string]int{}, map[string]int{}
	if s.catalog != nil {
		for _, c := range s.catalog.Channels {
			if s.settings.HideOffline && c.Status() == "offline" {
				continue
			}
			cc[c.Country]++
			for _, k := range c.Categories {
				kc[k]++
			}
		}
	}
	conv := func(m map[string]int) []Facet {
		out := make([]Facet, 0, len(m))
		for k, v := range m {
			out = append(out, Facet{k, v})
		}
		sort.Slice(out, func(i, j int) bool {
			return out[i].Count > out[j].Count || (out[i].Count == out[j].Count && out[i].Code < out[j].Code)
		})
		return out
	}
	return conv(cc), conv(kc)
}

// ErrNoChannel / ErrNoStream are returned by Play.
var (
	ErrNoChannel = errors.New("channel not found")
	ErrNoStream  = errors.New("no working stream for this channel right now")
)

// Play returns proxied playlist URLs for a channel, best first. Clients try
// them in order (a stream can die between checks).
func (s *Service) Play(ctx context.Context, id string) (*ChannelView, []string, string, error) {
	s.mu.RLock()
	c := s.byID[id]
	s.mu.RUnlock()
	if c == nil {
		return nil, nil, "", ErrNoChannel
	}
	var urls []string
	youtubeID := ""
	healthy := false
	var ytRefs []string
	for _, st := range orderStreams(c.Streams) {
		if isYouTube(st) {
			ytRefs = append(ytRefs, strings.TrimPrefix(st.URL, youtubeScheme))
			continue
		}
		if st.OK != nil && !*st.OK {
			continue
		}
		if st.OK != nil && *st.OK {
			healthy = true
		}
		urls = append(urls, s.proxy.Sign(target{URL: st.URL, UA: st.UserAgent, Ref: st.Referrer, LAN: st.LAN}, "index.m3u8"))
	}
	// The broadcaster's YouTube live stream: used when no direct stream is
	// known to work (looking it up costs a request, so not on every tune).
	if !healthy {
		for _, ref := range ytRefs {
			if id, _, err := s.yt.Live(ctx, ref); err == nil && id != "" {
				youtubeID = id
				break
			}
		}
	}
	if len(urls) == 0 && youtubeID == "" {
		// Every stream failed its last check: still offer them, a check can be wrong.
		for _, st := range c.Streams {
			if !isYouTube(st) {
				urls = append(urls, s.proxy.Sign(target{URL: st.URL, UA: st.UserAgent, Ref: st.Referrer, LAN: st.LAN}, "index.m3u8"))
			}
		}
	}
	if len(urls) == 0 && youtubeID == "" {
		return nil, nil, "", ErrNoStream
	}
	v := ChannelView{ID: c.ID, Name: c.Name, Country: c.Country, Categories: c.Categories, Logo: c.Logo, Status: c.Status(), Quality: c.Quality(), Number: s.numberOf(c.ID), Favorite: s.isFavorite(c.ID)}
	return &v, urls, youtubeID, nil
}

var qualityRank = map[string]int{"1080p": 0, "720p": 1, "1080i": 2, "2160p": 3, "576p": 4, "576i": 4, "480p": 5, "360p": 6}

// orderStreams: working first, then the smoothest good quality (1080p/720p
// before 4K), then the fastest to answer.
func orderStreams(in []Stream) []Stream {
	out := append([]Stream(nil), in...)
	rank := func(s Stream) int {
		if r, ok := qualityRank[strings.ToLower(s.Quality)]; ok {
			return r
		}
		return 5
	}
	okv := func(s Stream) int {
		if s.OK == nil {
			return 1
		}
		if *s.OK {
			return 0
		}
		return 2
	}
	sort.SliceStable(out, func(i, j int) bool {
		if okv(out[i]) != okv(out[j]) {
			return okv(out[i]) < okv(out[j])
		}
		if rank(out[i]) != rank(out[j]) {
			return rank(out[i]) < rank(out[j])
		}
		return out[i].LatencyMs < out[j].LatencyMs
	})
	return out
}

// Refresh asks the background worker to rebuild the lineup now.
func (s *Service) Refresh() {
	select {
	case s.kick <- struct{}{}:
	default:
	}
}

// CheckNow starts a health check pass in the background.
func (s *Service) CheckNow() { go s.checkAll(context.Background()) }

// Run keeps the lineup fresh: rebuild daily, health-check every 6 hours.
func (s *Service) Run(ctx context.Context) {
	sync := func() {
		if !s.Settings().Enabled {
			return
		}
		if err := s.sync(ctx); err != nil {
			s.lastErr.Store(err.Error())
			log.Printf("📺 Live TV: catalog update failed: %v", err)
			return
		}
		s.lastErr.Store("")
		s.checkAll(ctx)
	}
	s.mu.RLock()
	stale := s.catalog == nil || time.Since(s.catalog.UpdatedAt) > 24*time.Hour
	s.mu.RUnlock()
	if stale {
		sync()
	} else {
		go s.checkAll(ctx)
	}
	daily := time.NewTicker(24 * time.Hour)
	checks := time.NewTicker(6 * time.Hour)
	defer daily.Stop()
	defer checks.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-s.kick:
			sync()
		case <-daily.C:
			sync()
		case <-checks.C:
			if s.Settings().Enabled {
				s.checkAll(ctx)
			}
		}
	}
}

func (s *Service) sync(ctx context.Context) error {
	if !s.syncing.CompareAndSwap(false, true) {
		return nil
	}
	defer s.syncing.Store(false)
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()
	cat, err := buildCatalog(ctx, s.client, newClient(true, 60*time.Second), s.Settings())
	if err != nil {
		return err
	}
	// Keep health results for streams we already know.
	s.mu.RLock()
	if s.catalog != nil {
		known := map[string]Stream{}
		for _, c := range s.catalog.Channels {
			for _, st := range c.Streams {
				known[st.URL] = st
			}
		}
		for _, c := range cat.Channels {
			for i := range c.Streams {
				if k, ok := known[c.Streams[i].URL]; ok {
					c.Streams[i].OK, c.Streams[i].LatencyMs, c.Streams[i].CheckedAt = k.OK, k.LatencyMs, k.CheckedAt
				}
			}
		}
	}
	s.mu.RUnlock()
	s.setCatalog(cat)
	log.Printf("📺 Live TV: %d channels from %s", len(cat.Channels), cat.Source)
	return s.store.save("catalog.json", cat)
}

// checkAll probes every stream (a few at a time) and records which work
// from this server.
func (s *Service) checkAll(ctx context.Context) {
	if !s.checking.CompareAndSwap(false, true) {
		return
	}
	defer s.checking.Store(false)
	s.mu.RLock()
	type job struct {
		ch *Channel
		st *Stream
	}
	var jobs []job
	if s.catalog != nil {
		for _, c := range s.catalog.Channels {
			for i := range c.Streams {
				jobs = append(jobs, job{c, &c.Streams[i]})
			}
		}
	}
	s.mu.RUnlock()
	s.total.Store(int64(len(jobs)))
	s.progress.Store(0)

	work := make(chan job)
	var wg sync.WaitGroup
	for w := 0; w < 16; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := range work {
				st := j.st
				var ok bool
				var ms int
				if isYouTube(*st) {
					start := time.Now()
					id, avatar, err := s.yt.Live(ctx, strings.TrimPrefix(st.URL, youtubeScheme))
					ok, ms = err == nil && id != "", int(time.Since(start).Milliseconds())
					if avatar != "" {
						s.mu.Lock()
						if j.ch.Logo == "" {
							j.ch.Logo = avatar
						}
						s.mu.Unlock()
					}
				} else {
					ok, ms = s.proxy.Probe(ctx, target{URL: st.URL, UA: st.UserAgent, Ref: st.Referrer, LAN: st.LAN})
				}
				s.mu.Lock()
				st.OK, st.LatencyMs, st.CheckedAt = &ok, ms, time.Now().UTC()
				s.mu.Unlock()
				s.progress.Add(1)
			}
		}()
	}
	for _, j := range jobs {
		select {
		case <-ctx.Done():
		case work <- j:
			continue
		}
		break
	}
	close(work)
	wg.Wait()

	s.mu.RLock()
	cat := s.catalog
	s.mu.RUnlock()
	if cat != nil {
		s.mu.RLock() // checks of a later pass must not write while we serialise
		_ = s.store.save("catalog.json", cat)
		s.mu.RUnlock()
		st := s.Status()
		log.Printf("📺 Live TV: %d channels online, %d offline", st.Online, st.Offline)
	}
}

// drain discards up to n bytes of a body so the connection can be reused.
func drain(r io.Reader, n int64) { _, _ = io.Copy(io.Discard, io.LimitReader(r, n)) }
