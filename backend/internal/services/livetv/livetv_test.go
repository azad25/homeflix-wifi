package livetv

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// fakeHLS serves master -> variant -> segment, like a real channel.
func fakeHLS(t *testing.T) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/live/master.m3u8", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Referer") != "https://ref.example/" {
			http.Error(w, "need referer", 403)
			return
		}
		w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
		io.WriteString(w, "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000\nlow/index.m3u8\n")
	})
	mux.HandleFunc("/live/low/index.m3u8", func(w http.ResponseWriter, r *http.Request) {
		io.WriteString(w, "#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXT-X-KEY:METHOD=AES-128,URI=\"../key.bin\"\n#EXTINF:4,\nseg1.ts\n#EXTINF:4,\nhttps://cdn.example/abs/seg2.ts\n")
	})
	mux.HandleFunc("/live/low/seg1.ts", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "video/mp2t")
		w.Write([]byte{0x47, 1, 2, 3})
	})
	mux.HandleFunc("/dead.m3u8", func(w http.ResponseWriter, r *http.Request) { http.Error(w, "geo", 403) })
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func TestProxySignedPlaylistRewriteAndSegments(t *testing.T) {
	up := fakeHLS(t)
	p := NewProxy([]byte("0123456789abcdef0123456789abcdef"))
	front := httptest.NewServer(p)
	defer front.Close()

	master := p.Sign(target{URL: up.URL + "/live/master.m3u8", Ref: "https://ref.example/", LAN: true}, "index.m3u8")
	get := func(path string) (int, string) {
		resp, err := http.Get(front.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		b, _ := io.ReadAll(resp.Body)
		return resp.StatusCode, string(b)
	}

	code, body := get(master)
	if code != 200 || !strings.Contains(body, "#EXT-X-STREAM-INF") || strings.Contains(body, up.URL) {
		t.Fatalf("master not rewritten (%d):\n%s", code, body)
	}
	variant := firstURI([]byte(body))
	if !strings.HasPrefix(variant, p.Prefix) || !strings.HasSuffix(variant, "/index.m3u8") {
		t.Fatalf("variant not proxied: %s", variant)
	}
	code, body = get(variant)
	if code != 200 || strings.Contains(body, "seg1.ts\n") || strings.Contains(body, "cdn.example") || !strings.Contains(body, `URI="`+p.Prefix) {
		t.Fatalf("variant not rewritten (%d):\n%s", code, body)
	}
	seg := firstURI([]byte(body))
	if !strings.HasSuffix(seg, "/seg.ts") {
		t.Fatalf("segment name: %s", seg)
	}
	code, body = get(seg)
	if code != 200 || body != string([]byte{0x47, 1, 2, 3}) {
		t.Fatalf("segment (%d) %q", code, body)
	}

	// Tampering with the token or signature is refused.
	parts := strings.Split(strings.TrimPrefix(master, p.Prefix), "/")
	evil, _ := json.Marshal(target{URL: "http://169.254.169.254/latest/meta-data", LAN: true})
	forged := p.Prefix + parts[0] + "/" + b64(evil) + "/index.m3u8"
	if code, _ := get(forged); code != http.StatusForbidden {
		t.Fatalf("forged token accepted: %d", code)
	}
}

func b64(b []byte) string { return base64.RawURLEncoding.EncodeToString(b) }

func TestPublicStreamsCannotReachLAN(t *testing.T) {
	up := fakeHLS(t) // listens on 127.0.0.1
	p := NewProxy([]byte("k"))
	front := httptest.NewServer(p)
	defer front.Close()
	path := p.Sign(target{URL: up.URL + "/live/low/index.m3u8"}, "index.m3u8") // LAN=false
	resp, err := http.Get(front.URL + path)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode == 200 {
		t.Fatal("public catalog stream reached a loopback address")
	}
	if ok, _ := p.Probe(context.Background(), target{URL: up.URL + "/live/low/index.m3u8"}); ok {
		t.Fatal("probe reached a loopback address")
	}
}

func TestProbeFollowsToMedia(t *testing.T) {
	up := fakeHLS(t)
	p := NewProxy([]byte("k"))
	if ok, _ := p.Probe(context.Background(), target{URL: up.URL + "/live/master.m3u8", Ref: "https://ref.example/", LAN: true}); !ok {
		t.Fatal("working stream reported dead")
	}
	if ok, _ := p.Probe(context.Background(), target{URL: up.URL + "/live/master.m3u8", LAN: true}); ok {
		t.Fatal("stream needing a referrer reported working without it")
	}
	if ok, _ := p.Probe(context.Background(), target{URL: up.URL + "/dead.m3u8", LAN: true}); ok {
		t.Fatal("geo-blocked stream reported working")
	}
}

func TestBuildCatalogFilters(t *testing.T) {
	mux := http.NewServeMux()
	j := func(v interface{}) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) { json.NewEncoder(w).Encode(v) }
	}
	closed := "2020-01-01"
	mux.HandleFunc("/channels.json", j([]map[string]interface{}{
		{"id": "Somoy.bd", "name": "Somoy TV", "country": "BD", "categories": []string{"news"}, "is_nsfw": false},
		{"id": "Adult.us", "name": "X", "country": "US", "categories": []string{}, "is_nsfw": true},
		{"id": "Gone.in", "name": "Gone", "country": "IN", "categories": []string{}, "is_nsfw": false, "closed": closed},
		{"id": "Other.br", "name": "Other", "country": "BR", "categories": []string{}, "is_nsfw": false},
		{"id": "NoStream.bd", "name": "No Stream", "country": "BD", "categories": []string{}, "is_nsfw": false},
	}))
	mux.HandleFunc("/streams.json", j([]map[string]interface{}{
		{"channel": "Somoy.bd", "url": "https://a.example/somoy.m3u8", "quality": "720p"},
		{"channel": "Somoy.bd", "url": "rtmp://x/y", "quality": "720p"},
		{"channel": "Adult.us", "url": "https://a.example/x.m3u8"},
		{"channel": "Gone.in", "url": "https://a.example/g.m3u8"},
		{"channel": "Other.br", "url": "https://a.example/o.m3u8"},
	}))
	mux.HandleFunc("/logos.json", j([]map[string]interface{}{
		{"channel": "Somoy.bd", "in_use": true, "width": 512, "format": "PNG", "url": "https://img/somoy.png"},
	}))
	srv := httptest.NewServer(mux)
	defer srv.Close()
	old := sourceBases
	sourceBases = []string{srv.URL + "/"}
	defer func() { sourceBases = old }()

	cat, err := buildCatalog(context.Background(), srv.Client(), srv.Client(), Settings{Countries: []string{"bd", "US", "IN"}})
	if err != nil {
		t.Fatal(err)
	}
	if len(cat.Channels) != 1 || cat.Channels[0].ID != "Somoy.bd" || len(cat.Channels[0].Streams) != 1 || cat.Channels[0].Logo != "https://img/somoy.png" {
		b, _ := json.Marshal(cat.Channels)
		t.Fatalf("unexpected lineup: %s", b)
	}
}

func TestParseM3U(t *testing.T) {
	pl := `#EXTM3U
#EXTINF:-1 tvg-logo="http://l/a.png" tvg-country="BD" group-title="News",My News HD
#EXTVLCOPT:http-referrer=http://ref/
http://192.168.1.20:8080/news.m3u8
#EXTINF:-1,My News HD
http://backup/news.m3u8
#EXTINF:-1,Bad
rtsp://x/y
`
	chs := parseM3U(strings.NewReader(pl))
	if len(chs) != 1 || chs[0].Name != "My News HD" || chs[0].Country != "BD" || len(chs[0].Streams) != 2 || !chs[0].Streams[0].LAN || chs[0].Streams[0].Referrer != "http://ref/" {
		b, _ := json.Marshal(chs)
		t.Fatalf("parse: %s", b)
	}
}

func TestOrderStreamsPrefersWorkingSmooth(t *testing.T) {
	yes, no := true, false
	in := []Stream{{URL: "4k", Quality: "2160p", OK: &yes}, {URL: "dead", Quality: "1080p", OK: &no}, {URL: "hd", Quality: "1080p", OK: &yes}, {URL: "unk", Quality: "720p"}}
	out := orderStreams(in)
	got := []string{out[0].URL, out[1].URL, out[2].URL, out[3].URL}
	if strings.Join(got, ",") != "hd,4k,unk,dead" {
		t.Fatalf("order %v", got)
	}
}

func TestPlayReportsTheLineupNumber(t *testing.T) {
	t.Setenv("HOMEFLIX_LIVETV_DIR", t.TempDir())
	s := NewService()
	ok := true
	s.setCatalog(&Catalog{Channels: []*Channel{
		{ID: "a.us", Name: "A", Country: "US", Streams: []Stream{{URL: "https://example.com/a.m3u8", OK: &ok}}},
		{ID: "b.us", Name: "B", Country: "US", Streams: []Stream{{URL: "https://example.com/b.m3u8", OK: &ok}}},
	}})
	var want int
	for _, v := range s.Channels(Filter{}) {
		if v.ID == "b.us" {
			want = v.Number
		}
	}
	ch, urls, _, err := s.Play(context.Background(), "b.us")
	if err != nil || len(urls) == 0 {
		t.Fatalf("play: %v %v", urls, err)
	}
	if want == 0 || ch.Number != want {
		t.Fatalf("play number = %d, lineup number = %d", ch.Number, want)
	}
}

func TestFavoritesComeFirstAndPersist(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("HOMEFLIX_LIVETV_DIR", dir)
	s := NewService()
	ok := true
	mk := func(id, name string) *Channel {
		return &Channel{ID: id, Name: name, Country: "US", Streams: []Stream{{URL: "https://example.com/" + id + ".m3u8", OK: &ok}}}
	}
	s.setCatalog(&Catalog{Channels: []*Channel{mk("a.us", "A"), mk("b.us", "B"), mk("c.us", "C"), mk("d.us", "D")}})
	if _, err := s.SetFavorites([]string{"nope.us"}, true); err == nil {
		t.Fatal("unknown channel accepted as favourite")
	}
	if _, err := s.SetFavorites([]string{"d.us", "b.us", "b.us"}, true); err != nil {
		t.Fatal(err)
	}
	ids := func(l []ChannelView) string {
		var x []string
		for _, v := range l {
			id := v.ID
			if v.Favorite {
				id += "*"
			}
			x = append(x, fmt.Sprintf("%s#%d", id, v.Number))
		}
		return strings.Join(x, ",")
	}
	// favourites on top (by number), rest below; numbers unchanged
	if got := ids(s.Channels(Filter{})); got != "b.us*#2,d.us*#4,a.us#1,c.us#3" {
		t.Fatalf("lineup %s", got)
	}
	if got := ids(s.Channels(Filter{ByNumber: true})); got != "a.us#1,b.us*#2,c.us#3,d.us*#4" {
		t.Fatalf("by number %s", got)
	}
	// /play still reports the lineup number
	if ch, _, _, _ := s.Play(context.Background(), "d.us"); ch == nil || ch.Number != 4 {
		t.Fatalf("play number %+v", ch)
	}
	// persisted across restarts
	s2 := NewService()
	if f := s2.Favorites(); len(f) != 2 || f[0] != "d.us" || f[1] != "b.us" {
		t.Fatalf("not saved: %v", f)
	}
	s2.SetFavorites([]string{"d.us"}, false)
	if f := s2.Favorites(); len(f) != 1 || f[0] != "b.us" {
		t.Fatalf("remove: %v", f)
	}
}
