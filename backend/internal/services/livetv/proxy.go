package livetv

import (
	"bufio"
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	"golang.org/x/sync/singleflight"
)

// target is what a signed proxy URL points at.
type target struct {
	URL string `json:"u"`
	UA  string `json:"a,omitempty"`
	Ref string `json:"r,omitempty"`
	LAN bool   `json:"l,omitempty"`
}

// Proxy relays HLS streams for the players. Only URLs it signed itself are
// served, so it can't be used as an open relay, and public catalog streams
// can never reach addresses on the server's local network.
type Proxy struct {
	key     []byte
	public  *http.Client
	lan     *http.Client
	cache   *segmentCache
	flights singleflight.Group
	// Prefix of the proxy route, e.g. "/api/livetv/p/".
	Prefix string
}

func NewProxy(key []byte) *Proxy {
	return &Proxy{
		key:    key,
		public: newClient(false, 0),
		lan:    newClient(true, 0),
		cache:  newSegmentCache(160 << 20),
		Prefix: "/api/livetv/p/",
	}
}

var errPrivate = errors.New("address not allowed")

// newClient: allowLAN=false refuses loopback/private/link-local addresses at
// dial time (after DNS), which also covers redirects.
func newClient(allowLAN bool, timeout time.Duration) *http.Client {
	dialer := &net.Dialer{Timeout: 8 * time.Second, KeepAlive: 30 * time.Second}
	if !allowLAN {
		// An outbound HTTP proxy (if the server uses one) is the only local
		// address allowed; targets are then checked in request().
		proxyAddrs := outboundProxyAddrs()
		dialer.Control = func(_, address string, _ syscall.RawConn) error {
			if proxyAddrs[address] {
				return nil
			}
			host, _, err := net.SplitHostPort(address)
			if err != nil {
				return err
			}
			if !publicIP(net.ParseIP(host)) {
				return errPrivate
			}
			return nil
		}
	}
	tr := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           dialer.DialContext,
		MaxIdleConnsPerHost:   8,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   8 * time.Second,
		ResponseHeaderTimeout: 12 * time.Second,
		ForceAttemptHTTP2:     true,
	}
	return &http.Client{Transport: tr, Timeout: timeout, CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 5 {
			return errors.New("too many redirects")
		}
		return nil
	}}
}

func publicIP(ip net.IP) bool {
	return ip != nil && !(ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() ||
		ip.IsMulticast() || ip.IsUnspecified() || ip.IsInterfaceLocalMulticast())
}

// outboundProxyAddrs: host:port of the HTTP(S)_PROXY the server uses, if any.
func outboundProxyAddrs() map[string]bool {
	out := map[string]bool{}
	for _, scheme := range []string{"http", "https"} {
		req, _ := http.NewRequest(http.MethodGet, scheme+"://example.com", nil)
		u, err := http.ProxyFromEnvironment(req)
		if err != nil || u == nil {
			continue
		}
		port := u.Port()
		if port == "" {
			port = map[string]string{"http": "80", "https": "443"}[u.Scheme]
		}
		ips, err := net.LookupIP(u.Hostname())
		if err != nil {
			continue
		}
		for _, ip := range ips {
			out[net.JoinHostPort(ip.String(), port)] = true
		}
	}
	return out
}

var usingOutboundProxy = len(outboundProxyAddrs()) > 0

// checkPublicHost resolves a URL's host and refuses private addresses (used
// when an outbound proxy hides the real target from the dialer).
func checkPublicHost(ctx context.Context, raw string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return err
	}
	ips, err := net.DefaultResolver.LookupIPAddr(ctx, u.Hostname())
	if err != nil {
		return err
	}
	for _, ip := range ips {
		if !publicIP(ip.IP) {
			return errPrivate
		}
	}
	return nil
}

func (p *Proxy) mac(token string) string {
	m := hmac.New(sha256.New, p.key)
	m.Write([]byte(token))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil)[:16])
}

// Sign returns the proxy path for t; name is cosmetic (index.m3u8, seg.ts)
// so players can tell playlists from segments by extension.
func (p *Proxy) Sign(t target, name string) string {
	b, _ := json.Marshal(t)
	token := base64.RawURLEncoding.EncodeToString(b)
	return p.Prefix + p.mac(token) + "/" + token + "/" + name
}

// Verify decodes a signed path "<sig>/<token>/<name>".
func (p *Proxy) Verify(rest string) (target, error) {
	var t target
	parts := strings.SplitN(strings.TrimPrefix(rest, "/"), "/", 3)
	if len(parts) < 2 {
		return t, errors.New("bad path")
	}
	if !hmac.Equal([]byte(parts[0]), []byte(p.mac(parts[1]))) {
		return t, errors.New("bad signature")
	}
	b, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return t, err
	}
	if err := json.Unmarshal(b, &t); err != nil {
		return t, err
	}
	if !supportedScheme.MatchString(t.URL) {
		return t, errors.New("bad url")
	}
	return t, nil
}

func (p *Proxy) client(t target) *http.Client {
	if t.LAN {
		return p.lan
	}
	return p.public
}

func (p *Proxy) request(ctx context.Context, t target) (*http.Response, error) {
	if !t.LAN && usingOutboundProxy {
		if err := checkPublicHost(ctx, t.URL); err != nil {
			return nil, err
		}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, t.URL, nil)
	if err != nil {
		return nil, err
	}
	ua := t.UA
	if ua == "" {
		ua = "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
	}
	req.Header.Set("User-Agent", ua)
	if t.Ref != "" {
		req.Header.Set("Referer", t.Ref)
		if u, err := url.Parse(t.Ref); err == nil && u.Host != "" {
			req.Header.Set("Origin", u.Scheme+"://"+u.Host)
		}
	}
	return p.client(t).Do(req)
}

func isPlaylist(contentType string, head []byte) bool {
	ct := strings.ToLower(contentType)
	return strings.Contains(ct, "mpegurl") || bytes.HasPrefix(bytes.TrimSpace(bytes.TrimPrefix(head, []byte("\xef\xbb\xbf"))), []byte("#EXTM3U"))
}

var uriAttr = regexp.MustCompile(`URI="([^"]+)"`)

// rewrite points every URI in a playlist back at the proxy.
func (p *Proxy) rewrite(body []byte, base *url.URL, t target) []byte {
	var out bytes.Buffer
	sign := func(ref string) string {
		u, err := base.Parse(strings.TrimSpace(ref))
		if err != nil {
			return ref
		}
		child := target{URL: u.String(), UA: t.UA, Ref: t.Ref, LAN: t.LAN}
		name := path.Base(u.Path)
		if strings.HasSuffix(strings.ToLower(name), ".m3u8") || strings.HasSuffix(strings.ToLower(name), ".m3u") {
			name = "index.m3u8"
		} else if ext := path.Ext(name); ext != "" && len(ext) <= 5 {
			name = "seg" + ext
		} else {
			name = "seg.ts"
		}
		return p.Sign(child, name)
	}
	sc := bufio.NewScanner(bytes.NewReader(body))
	sc.Buffer(make([]byte, 64*1024), 4<<20)
	for sc.Scan() {
		line := sc.Text()
		trimmed := strings.TrimSpace(line)
		switch {
		case trimmed == "":
			out.WriteString(line)
		case strings.HasPrefix(trimmed, "#"):
			out.WriteString(uriAttr.ReplaceAllStringFunc(line, func(m string) string {
				return `URI="` + sign(uriAttr.FindStringSubmatch(m)[1]) + `"`
			}))
		default:
			out.WriteString(sign(trimmed))
		}
		out.WriteByte('\n')
	}
	return out.Bytes()
}

type fetched struct {
	status      int
	contentType string
	body        []byte
	playlist    bool
}

const maxBuffered = 12 << 20 // segments larger than this are streamed, not cached

// fetch loads a playlist or (small) segment once even if many players ask
// for it at the same moment, and caches it briefly.
func (p *Proxy) fetch(ctx context.Context, t target) (*fetched, *http.Response, error) {
	if f := p.cache.get(t.URL); f != nil {
		return f, nil, nil
	}
	var stream *http.Response
	v, err, _ := p.flights.Do(t.URL, func() (interface{}, error) {
		resp, err := p.request(ctx, t)
		if err != nil {
			return nil, err
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			return &fetched{status: resp.StatusCode}, nil
		}
		ct := resp.Header.Get("Content-Type")
		if resp.ContentLength > maxBuffered {
			stream = resp // too big to share: hand the body to this caller
			return nil, nil
		}
		body, err := io.ReadAll(io.LimitReader(resp.Body, maxBuffered+1))
		resp.Body.Close()
		if err != nil {
			return nil, err
		}
		if len(body) > maxBuffered {
			return nil, errors.New("segment too large")
		}
		f := &fetched{status: 200, contentType: ct, body: body, playlist: isPlaylist(ct, body[:min(len(body), 64)])}
		if f.playlist {
			f.body = p.rewrite(body, resp.Request.URL, t)
			f.contentType = "application/vnd.apple.mpegurl"
			p.cache.put(t.URL, f, 1500*time.Millisecond) // live playlists change every few seconds
		} else {
			p.cache.put(t.URL, f, 45*time.Second)
		}
		return f, nil
	})
	if err != nil {
		return nil, nil, err
	}
	if stream != nil {
		return nil, stream, nil
	}
	if v == nil {
		// Another caller got the oversized body: fetch our own copy.
		resp, err := p.request(ctx, t)
		return nil, resp, err
	}
	return v.(*fetched), nil, nil
}

// ServeHTTP handles GET <Prefix><sig>/<token>/<name>.
func (p *Proxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	t, err := p.Verify(strings.TrimPrefix(r.URL.Path, p.Prefix))
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	f, stream, err := p.fetch(ctx, t)
	if err != nil {
		code := http.StatusBadGateway
		if errors.Is(err, errPrivate) {
			code = http.StatusForbidden
		}
		http.Error(w, "upstream unavailable", code)
		return
	}
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if stream != nil {
		defer stream.Body.Close()
		if stream.StatusCode != http.StatusOK {
			http.Error(w, fmt.Sprintf("upstream HTTP %d", stream.StatusCode), http.StatusBadGateway)
			return
		}
		w.Header().Set("Content-Type", stream.Header.Get("Content-Type"))
		w.Header().Set("Cache-Control", "no-cache")
		_, _ = io.Copy(w, stream.Body)
		return
	}
	if f.status != http.StatusOK {
		http.Error(w, fmt.Sprintf("upstream HTTP %d", f.status), http.StatusBadGateway)
		return
	}
	if f.playlist {
		w.Header().Set("Content-Type", f.contentType)
		w.Header().Set("Cache-Control", "no-cache")
	} else {
		ct := f.contentType
		if ct == "" || strings.HasPrefix(ct, "text/") || ct == "application/octet-stream" {
			ct = "video/mp2t"
		}
		w.Header().Set("Content-Type", ct)
		w.Header().Set("Cache-Control", "public, max-age=30")
	}
	_, _ = w.Write(f.body)
}

// Probe checks that a stream really plays from here: master playlist ->
// first variant -> first segment (many listed streams answer the playlist
// but refuse the video, e.g. geo-blocked).
func (p *Proxy) Probe(ctx context.Context, t target) (bool, int) {
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	start := time.Now()
	cur := t
	for depth := 0; depth < 3; depth++ {
		resp, err := p.request(ctx, cur)
		if err != nil {
			return false, 0
		}
		if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusPartialContent {
			resp.Body.Close()
			return false, 0
		}
		head := make([]byte, 64)
		n, _ := io.ReadFull(resp.Body, head)
		head = head[:n]
		if !isPlaylist(resp.Header.Get("Content-Type"), head) {
			// Reached media data.
			drain(resp.Body, 16<<10)
			resp.Body.Close()
			return depth > 0, int(time.Since(start).Milliseconds())
		}
		rest, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		resp.Body.Close()
		body := append(head, rest...)
		next := firstURI(body)
		if next == "" {
			return false, 0
		}
		u, err := resp.Request.URL.Parse(next)
		if err != nil {
			return false, 0
		}
		cur = target{URL: u.String(), UA: t.UA, Ref: t.Ref, LAN: t.LAN}
	}
	return false, 0
}

// firstURI returns the first variant or segment of a playlist.
func firstURI(pl []byte) string {
	sc := bufio.NewScanner(bytes.NewReader(pl))
	sc.Buffer(make([]byte, 64*1024), 4<<20)
	for sc.Scan() {
		l := strings.TrimSpace(sc.Text())
		if l != "" && !strings.HasPrefix(l, "#") {
			return l
		}
	}
	return ""
}

// segmentCache is a small TTL + size bounded cache so several players on the
// same channel share one upstream fetch.
type segmentCache struct {
	mu    sync.Mutex
	max   int
	size  int
	items map[string]*cacheItem
	order []string
}

type cacheItem struct {
	f   *fetched
	exp time.Time
}

func newSegmentCache(max int) *segmentCache {
	return &segmentCache{max: max, items: map[string]*cacheItem{}}
}

func (c *segmentCache) get(k string) *fetched {
	c.mu.Lock()
	defer c.mu.Unlock()
	it := c.items[k]
	if it == nil || time.Now().After(it.exp) {
		return nil
	}
	return it.f
}

func (c *segmentCache) put(k string, f *fetched, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if old := c.items[k]; old != nil {
		c.size -= len(old.f.body)
	} else {
		c.order = append(c.order, k)
	}
	c.items[k] = &cacheItem{f: f, exp: time.Now().Add(ttl)}
	c.size += len(f.body)
	now := time.Now()
	// Evict expired first, then oldest, until under budget.
	for c.size > c.max || (len(c.order) > 0 && c.items[c.order[0]] != nil && now.After(c.items[c.order[0]].exp)) {
		if len(c.order) == 0 {
			break
		}
		oldest := c.order[0]
		c.order = c.order[1:]
		if it := c.items[oldest]; it != nil {
			c.size -= len(it.f.body)
			delete(c.items, oldest)
		}
	}
}
