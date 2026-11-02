// Package livetv builds a Live TV lineup from public, free-to-air stream
// listings (the community-maintained iptv-org index), keeps it healthy with
// background checks and serves the streams through a signed HLS proxy.
package livetv

import (
	"bufio"
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

// Stream is one source for a channel.
type Stream struct {
	URL       string `json:"url"`
	Quality   string `json:"quality,omitempty"`
	UserAgent string `json:"user_agent,omitempty"`
	Referrer  string `json:"referrer,omitempty"`
	// LAN marks streams from the admin's own playlists, which may point at
	// private addresses (e.g. a tuner on the local network).
	LAN bool `json:"lan,omitempty"`

	OK        *bool     `json:"ok,omitempty"`
	LatencyMs int       `json:"latency_ms,omitempty"`
	CheckedAt time.Time `json:"checked_at,omitempty"`
}

// Channel is a TV channel with one or more streams.
type Channel struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Country    string   `json:"country"`
	Categories []string `json:"categories,omitempty"`
	Logo       string   `json:"logo,omitempty"`
	Website    string   `json:"website,omitempty"`
	Streams    []Stream `json:"streams"`
}

// Status summarises the channel's streams.
func (c *Channel) Status() string {
	unknown := false
	for _, s := range c.Streams {
		if s.OK == nil {
			unknown = true
		} else if *s.OK {
			return "online"
		}
	}
	if unknown {
		return "unknown"
	}
	return "offline"
}

// Quality of the best working (or first) stream.
func (c *Channel) Quality() string {
	for _, s := range c.Streams {
		if s.OK != nil && *s.OK {
			return s.Quality
		}
	}
	if len(c.Streams) > 0 {
		return c.Streams[0].Quality
	}
	return ""
}

// Catalog is the persisted lineup.
type Catalog struct {
	UpdatedAt time.Time  `json:"updated_at"`
	Source    string     `json:"source"`
	Channels  []*Channel `json:"channels"`
}

// Upstream data sources (first that answers wins).
var sourceBases = []string{
	"https://iptv-org.github.io/api/",
	"https://raw.githubusercontent.com/iptv-org/api/gh-pages/",
}

type rawChannel struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Country    string   `json:"country"`
	Categories []string `json:"categories"`
	IsNSFW     bool     `json:"is_nsfw"`
	Closed     *string  `json:"closed"`
	Website    *string  `json:"website"`
}

type rawStream struct {
	Channel   *string `json:"channel"`
	Feed      *string `json:"feed"`
	Title     string  `json:"title"`
	URL       string  `json:"url"`
	Quality   *string `json:"quality"`
	UserAgent *string `json:"user_agent"`
	Referrer  *string `json:"referrer"`
}

type rawLogo struct {
	Channel string  `json:"channel"`
	Feed    *string `json:"feed"`
	InUse   bool    `json:"in_use"`
	Width   int     `json:"width"`
	Format  *string `json:"format"`
	URL     string  `json:"url"`
}

func str(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// fetchJSON downloads one iptv-org API file, trying each source base.
func fetchJSON(ctx context.Context, client *http.Client, name string, v interface{}) (string, error) {
	var lastErr error
	for _, base := range sourceBases {
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, base+name, nil)
		req.Header.Set("User-Agent", "HomeFlix-Server")
		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			lastErr = fmt.Errorf("%s: HTTP %d", base+name, resp.StatusCode)
			continue
		}
		err = json.NewDecoder(io.LimitReader(resp.Body, 64<<20)).Decode(v)
		resp.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}
		return base, nil
	}
	return "", lastErr
}

var supportedScheme = regexp.MustCompile(`^https?://`)

// buildCatalog downloads the public listings and keeps the channels for the
// configured countries. Adult and closed channels are always left out.
func buildCatalog(ctx context.Context, client, lanClient *http.Client, st Settings) (*Catalog, error) {
	var (
		channels []rawChannel
		streams  []rawStream
		logos    []rawLogo
	)
	src, err := fetchJSON(ctx, client, "channels.json", &channels)
	if err != nil {
		return nil, fmt.Errorf("channel list: %w", err)
	}
	if _, err := fetchJSON(ctx, client, "streams.json", &streams); err != nil {
		return nil, fmt.Errorf("stream list: %w", err)
	}
	if _, err := fetchJSON(ctx, client, "logos.json", &logos); err != nil {
		logos = nil // logos are optional
	}

	countries := map[string]bool{}
	for _, c := range st.Countries {
		countries[strings.ToUpper(c)] = true
	}
	excluded := map[string]bool{}
	for _, c := range st.ExcludeCategories {
		excluded[strings.ToLower(c)] = true
	}

	byID := map[string]*Channel{}
	for _, rc := range channels {
		if rc.IsNSFW || rc.Closed != nil || !countries[strings.ToUpper(rc.Country)] {
			continue
		}
		skip := false
		for _, cat := range rc.Categories {
			if cat == "xxx" || excluded[strings.ToLower(cat)] {
				skip = true
			}
		}
		if skip {
			continue
		}
		byID[rc.ID] = &Channel{ID: rc.ID, Name: rc.Name, Country: strings.ToUpper(rc.Country), Categories: rc.Categories, Website: str(rc.Website)}
	}
	for _, rs := range streams {
		ch := byID[str(rs.Channel)]
		if ch == nil || !supportedScheme.MatchString(rs.URL) {
			continue
		}
		dup := false
		for _, s := range ch.Streams {
			if s.URL == rs.URL {
				dup = true
			}
		}
		if !dup {
			ch.Streams = append(ch.Streams, Stream{URL: rs.URL, Quality: str(rs.Quality), UserAgent: str(rs.UserAgent), Referrer: str(rs.Referrer)})
		}
	}
	// Logo: prefer the channel-wide (no feed) logo in use, PNG, widest.
	bestLogo := map[string]rawLogo{}
	for _, l := range logos {
		if byID[l.Channel] == nil || l.URL == "" {
			continue
		}
		cur, ok := bestLogo[l.Channel]
		score := func(x rawLogo) int {
			s := x.Width
			if x.InUse {
				s += 10000
			}
			if x.Feed == nil {
				s += 5000
			}
			if strings.EqualFold(str(x.Format), "PNG") {
				s += 1000
			}
			return s
		}
		if !ok || score(l) > score(cur) {
			bestLogo[l.Channel] = l
		}
	}

	cat := &Catalog{UpdatedAt: time.Now().UTC(), Source: src}
	for id, ch := range byID {
		if len(ch.Streams) == 0 {
			continue
		}
		if l, ok := bestLogo[id]; ok {
			ch.Logo = l.URL
		}
		cat.Channels = append(cat.Channels, ch)
	}

	for _, pl := range st.CustomPlaylists {
		// The admin's own playlists may live on the local network.
		custom, err := fetchM3U(ctx, lanClient, pl)
		if err != nil {
			continue
		}
		cat.Channels = append(cat.Channels, custom...)
	}
	sortChannels(cat.Channels)
	return cat, nil
}

func sortChannels(chs []*Channel) {
	sort.SliceStable(chs, func(i, j int) bool {
		if chs[i].Country != chs[j].Country {
			return chs[i].Country < chs[j].Country
		}
		return strings.ToLower(chs[i].Name) < strings.ToLower(chs[j].Name)
	})
}

var (
	attrRe = regexp.MustCompile(`([a-zA-Z-]+)="([^"]*)"`)
)

// fetchM3U parses an extended M3U playlist (the admin's own sources).
func fetchM3U(ctx context.Context, client *http.Client, url string) ([]*Channel, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return parseM3U(io.LimitReader(resp.Body, 16<<20)), nil
}

func parseM3U(r io.Reader) []*Channel {
	var out []*Channel
	byKey := map[string]*Channel{}
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 64*1024), 1024*1024)
	var pending *Channel
	var ua, ref string
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		switch {
		case strings.HasPrefix(line, "#EXTINF"):
			attrs := map[string]string{}
			for _, m := range attrRe.FindAllStringSubmatch(line, -1) {
				attrs[strings.ToLower(m[1])] = m[2]
			}
			name := line
			if i := strings.LastIndex(line, ","); i >= 0 {
				name = strings.TrimSpace(line[i+1:])
			}
			pending = &Channel{Name: name, Logo: attrs["tvg-logo"], Country: strings.ToUpper(attrs["tvg-country"])}
			if g := attrs["group-title"]; g != "" {
				pending.Categories = []string{strings.ToLower(g)}
			}
			if pending.Country == "" {
				pending.Country = "ZZ" // "My channels"
			}
		case strings.HasPrefix(line, "#EXTVLCOPT:http-user-agent="):
			ua = strings.TrimPrefix(line, "#EXTVLCOPT:http-user-agent=")
		case strings.HasPrefix(line, "#EXTVLCOPT:http-referrer="):
			ref = strings.TrimPrefix(line, "#EXTVLCOPT:http-referrer=")
		case line == "" || strings.HasPrefix(line, "#"):
		default:
			if pending == nil || !supportedScheme.MatchString(line) {
				continue
			}
			key := strings.ToLower(pending.Name)
			ch := byKey[key]
			if ch == nil {
				h := sha1.Sum([]byte(key))
				pending.ID = "custom-" + hex.EncodeToString(h[:6])
				ch = pending
				byKey[key] = ch
				out = append(out, ch)
			}
			ch.Streams = append(ch.Streams, Stream{URL: line, UserAgent: ua, Referrer: ref, LAN: true})
			pending, ua, ref = nil, "", ""
		}
	}
	return out
}

// store persists the catalog and settings under dir.
type store struct {
	dir string
	mu  sync.Mutex
}

func (s *store) path(name string) string { return filepath.Join(s.dir, name) }

func (s *store) load(name string, v interface{}) error {
	b, err := os.ReadFile(s.path(name))
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

func (s *store) save(name string, v interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return err
	}
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	tmp := s.path(name + ".tmp")
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, s.path(name))
}
