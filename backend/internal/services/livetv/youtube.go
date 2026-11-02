package livetv

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"html"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"
)

// YouTubeChannel: a broadcaster's official 24/7 YouTube live stream.
type YouTubeChannel struct {
	Name     string `json:"name"`
	Ref      string `json:"ref"` // "@handle" or "UC..." channel id
	Country  string `json:"country"`
	Category string `json:"category"`
}

// OfficialYouTube: broadcasters that stream live for free on their own
// verified YouTube channels (added when their country is selected).
var OfficialYouTube = []YouTubeChannel{
	{"Somoy TV", "UCxHoBXkY88Tb8z1Ssj6CWsQ", "BD", "news"},
	{"Jamuna TV", "UCN6sm8iHiPd0cnoUardDAnw", "BD", "news"},
	{"Ekattor TV", "@ekattortelevision", "BD", "news"},
	{"Independent TV", "UCATUkaOHwO9EP_W87zCiPbA", "BD", "news"},
	{"ATN News", "UC9Rgo0CrNyd7OWliLekqqGA", "BD", "news"},
	{"ATN Bangla", "@atnbanglanews", "BD", "general"},
	{"Channel 24", "@Channel24digital", "BD", "news"},
	{"Banglavision", "@banglavisionlive24", "BD", "general"},
	{"NTV", "@ntvlatestnews", "BD", "news"},
}

var (
	reYTRef       = regexp.MustCompile(`^(@[A-Za-z0-9._-]{3,60}|UC[A-Za-z0-9_-]{22})$`)
	reYTCanonical = regexp.MustCompile(`<link rel="canonical" href="https://www\.youtube\.com/watch\?v=([A-Za-z0-9_-]{11})"`)
	reYTLiveNow   = regexp.MustCompile(`"isLive(?:Now|Content)?":true`)
	reYTAvatar    = regexp.MustCompile(`<meta property="og:image" content="([^"]+)"`)
)

const youtubeScheme = "youtube:"

// youtubeStream turns a channel ref into a stream entry.
func youtubeStream(ref string) Stream { return Stream{URL: youtubeScheme + ref, Quality: "YouTube"} }

func isYouTube(s Stream) bool { return strings.HasPrefix(s.URL, youtubeScheme) }

func youtubeChannelID(ref string) string {
	h := sha1.Sum([]byte(strings.ToLower(ref)))
	return "yt-" + hex.EncodeToString(h[:6])
}

func youtubeChannels(list []YouTubeChannel) []*Channel {
	var out []*Channel
	for _, y := range list {
		ref := strings.TrimSpace(y.Ref)
		if strings.HasPrefix(ref, "https://") {
			// accept pasted URLs: youtube.com/@handle or /channel/UC...
			ref = strings.TrimSuffix(strings.TrimSuffix(ref, "/"), "/live")
			ref = ref[strings.LastIndex(ref, "/")+1:]
		}
		if !reYTRef.MatchString(ref) {
			continue
		}
		cat := strings.ToLower(strings.TrimSpace(y.Category))
		if cat == "" {
			cat = "general"
		}
		country := strings.ToUpper(strings.TrimSpace(y.Country))
		if country == "" {
			country = "ZZ"
		}
		out = append(out, &Channel{ID: youtubeChannelID(ref), Name: y.Name, Country: country, Categories: []string{cat}, Streams: []Stream{youtubeStream(ref)}})
	}
	return out
}

// ytResolver finds a channel's current live video (cached briefly).
type ytResolver struct {
	client *http.Client
	mu     sync.Mutex
	cache  map[string]ytLive
}

type ytLive struct {
	videoID string
	avatar  string
	at      time.Time
}

func newYTResolver(c *http.Client) *ytResolver {
	return &ytResolver{client: c, cache: map[string]ytLive{}}
}

func ytLiveURL(ref string) string {
	if strings.HasPrefix(ref, "@") {
		return "https://www.youtube.com/" + ref + "/live"
	}
	return "https://www.youtube.com/channel/" + ref + "/live"
}

// Live returns the live video id ("" when the channel isn't live) and the
// channel picture.
func (r *ytResolver) Live(ctx context.Context, ref string) (string, string, error) {
	r.mu.Lock()
	if c, ok := r.cache[ref]; ok && time.Since(c.at) < 5*time.Minute {
		r.mu.Unlock()
		return c.videoID, c.avatar, nil
	}
	r.mu.Unlock()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, ytLiveURL(ref), nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	// Skip the EU cookie-consent interstitial.
	req.Header.Set("Cookie", "CONSENT=YES+1; SOCS=CAI")
	resp, err := r.client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", "", &statusErr{resp.StatusCode}
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return "", "", err
	}
	id, avatar := parseYTLive(string(body))
	r.mu.Lock()
	r.cache[ref] = ytLive{videoID: id, avatar: avatar, at: time.Now()}
	r.mu.Unlock()
	return id, avatar, nil
}

type statusErr struct{ code int }

func (e *statusErr) Error() string { return http.StatusText(e.code) }

// parseYTLive: a channel's /live page canonicalises to the live video's
// watch URL while it is broadcasting.
func parseYTLive(page string) (videoID, avatar string) {
	if m := reYTAvatar.FindStringSubmatch(page); m != nil {
		avatar = html.UnescapeString(m[1])
	}
	m := reYTCanonical.FindStringSubmatch(page)
	if m == nil || !reYTLiveNow.MatchString(page) {
		return "", avatar
	}
	return m[1], avatar
}
