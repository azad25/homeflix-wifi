package livetv

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const livePage = `<html><head><link rel="canonical" href="https://www.youtube.com/watch?v=AbCdEfGhIj1">
<meta property="og:image" content="https://yt3.ggpht.example/avatar.jpg"></head>
<body><script>var ytInitialPlayerResponse = {"videoDetails":{"isLiveContent":true},"microformat":{"isLiveNow":true}};</script></body></html>`

const offlinePage = `<html><head><link rel="canonical" href="https://www.youtube.com/channel/UCxHoBXkY88Tb8z1Ssj6CWsQ">
<meta property="og:image" content="https://yt3.ggpht.example/avatar.jpg"></head></html>`

func TestParseYTLive(t *testing.T) {
	if id, av := parseYTLive(livePage); id != "AbCdEfGhIj1" || av != "https://yt3.ggpht.example/avatar.jpg" {
		t.Fatalf("live: %q %q", id, av)
	}
	if id, _ := parseYTLive(offlinePage); id != "" {
		t.Fatalf("offline channel reported live: %q", id)
	}
	// A recorded (not live) video's page has a canonical watch URL but no live flag.
	if id, _ := parseYTLive(`<link rel="canonical" href="https://www.youtube.com/watch?v=AbCdEfGhIj1">`); id != "" {
		t.Fatal("VOD reported live")
	}
}

func TestYouTubeChannelsRefs(t *testing.T) {
	chs := youtubeChannels([]YouTubeChannel{
		{Name: "A", Ref: "@ekattortelevision", Country: "bd"},
		{Name: "B", Ref: "UCxHoBXkY88Tb8z1Ssj6CWsQ", Category: "News"},
		{Name: "C", Ref: "https://www.youtube.com/@atnbanglanews/live"},
		{Name: "bad", Ref: "javascript:alert(1)"},
		{Name: "bad2", Ref: "@x"},
	})
	if len(chs) != 3 || chs[0].Country != "BD" || chs[1].Categories[0] != "news" || chs[1].Country != "ZZ" || chs[2].Streams[0].URL != "youtube:@atnbanglanews" {
		for _, c := range chs {
			t.Logf("%+v", *c)
		}
		t.Fatal("unexpected channels")
	}
}

func TestResolverAndPlayFallback(t *testing.T) {
	live := true
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/live") || !strings.Contains(r.Header.Get("Cookie"), "CONSENT") {
			http.Error(w, "bad request", 400)
			return
		}
		if live {
			w.Write([]byte(livePage))
		} else {
			w.Write([]byte(offlinePage))
		}
	}))
	defer srv.Close()
	r := newYTResolver(srv.Client())
	// Point the resolver at the test server.
	tr := &rewriteTransport{to: srv.URL, base: srv.Client().Transport}
	r.client = &http.Client{Transport: tr}
	id, avatar, err := r.Live(context.Background(), "@somoynews360")
	if err != nil || id != "AbCdEfGhIj1" || avatar == "" {
		t.Fatalf("%q %q %v", id, avatar, err)
	}

	s := &Service{proxy: NewProxy([]byte("k")), yt: r, byID: map[string]*Channel{}}
	no := false
	ch := &Channel{ID: "c1", Name: "ATN Bangla", Country: "BD", Streams: []Stream{{URL: "https://dead.example/x.m3u8", OK: &no}, youtubeStream("@atnbanglanews")}}
	s.byID["c1"] = ch
	_, urls, yt, err := s.Play(context.Background(), "c1")
	if err != nil || yt != "AbCdEfGhIj1" || len(urls) != 0 {
		t.Fatalf("play: urls=%v yt=%q err=%v", urls, yt, err)
	}
}

type rewriteTransport struct {
	to   string
	base http.RoundTripper
}

func (t *rewriteTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	u := *req.URL
	target := strings.TrimPrefix(t.to, "http://")
	u.Scheme, u.Host = "http", target
	req2 := req.Clone(req.Context())
	req2.URL = &u
	req2.Host = target
	if t.base == nil {
		t.base = http.DefaultTransport
	}
	return t.base.RoundTrip(req2)
}

func TestCatalogMergesYouTube(t *testing.T) {
	cat := &Catalog{Channels: []*Channel{{ID: "ATNBangla.bd", Name: "ATN Bangla", Country: "BD", Streams: []Stream{{URL: "https://a/x.m3u8"}}}}}
	byName := map[string]*Channel{}
	for _, c := range cat.Channels {
		byName[c.Country+"|"+normName(c.Name)] = c
	}
	for _, yc := range youtubeChannels([]YouTubeChannel{{Name: "ATN Bangla", Ref: "@atnbanglanews", Country: "BD"}, {Name: "Somoy TV", Ref: "UCxHoBXkY88Tb8z1Ssj6CWsQ", Country: "BD"}}) {
		if c := byName[yc.Country+"|"+normName(yc.Name)]; c != nil {
			c.Streams = append(c.Streams, yc.Streams...)
			continue
		}
		cat.Channels = append(cat.Channels, yc)
	}
	if len(cat.Channels) != 2 || len(cat.Channels[0].Streams) != 2 {
		t.Fatalf("merge: %d channels, %d streams", len(cat.Channels), len(cat.Channels[0].Streams))
	}
}
