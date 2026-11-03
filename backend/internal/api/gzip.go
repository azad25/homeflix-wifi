package api

import (
	"bufio"
	"compress/gzip"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
)

// Gzip compresses textual responses (JSON, HTML, JS, SVG, XML). Library
// listings, widget payloads and search results are large JSON documents that
// shrink 80-90%, which matters most for TVs and phones on Wi-Fi.
//
// Video, images, HLS playlists, event streams, range requests and websocket
// upgrades are passed through untouched. The decision is made on the first
// body write, once the handler has set Content-Type.
func Gzip() gin.HandlerFunc {
	pool := sync.Pool{New: func() interface{} {
		w, _ := gzip.NewWriterLevel(nil, gzip.BestSpeed)
		return w
	}}

	return func(c *gin.Context) {
		r := c.Request
		if r.Method == http.MethodHead ||
			!strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") ||
			r.Header.Get("Range") != "" ||
			strings.EqualFold(r.Header.Get("Connection"), "upgrade") || r.Header.Get("Upgrade") != "" ||
			strings.HasPrefix(r.URL.Path, "/api/stream/") || strings.HasPrefix(r.URL.Path, "/api/hls/") ||
			strings.HasPrefix(r.URL.Path, "/api/livetv/p/") || r.URL.Path == "/api/buzz/stream" || r.URL.Path == "/api/admin/scanner/stream" {
			c.Next()
			return
		}

		gw := &gzipResponseWriter{ResponseWriter: c.Writer, pool: &pool}
		c.Writer = gw
		defer gw.finish()
		c.Next()
	}
}

func compressibleType(ct string) bool {
	ct = strings.ToLower(strings.TrimSpace(strings.SplitN(ct, ";", 2)[0]))
	switch {
	case ct == "":
		return false
	case ct == "text/event-stream": // must stream unbuffered
		return false
	case strings.HasPrefix(ct, "text/"):
		return true
	case ct == "application/json", ct == "application/javascript", ct == "application/xml",
		ct == "image/svg+xml", strings.HasSuffix(ct, "+json"):
		return true
	}
	return false
}

type gzipResponseWriter struct {
	gin.ResponseWriter
	pool     *sync.Pool
	gz       *gzip.Writer
	decided  bool
	compress bool
}

func (w *gzipResponseWriter) decide() {
	if w.decided {
		return
	}
	w.decided = true
	h := w.ResponseWriter.Header()
	status := w.ResponseWriter.Status()
	if status < 200 || status == http.StatusNoContent || status == http.StatusNotModified || status == http.StatusPartialContent {
		return
	}
	if h.Get("Content-Encoding") != "" || !compressibleType(h.Get("Content-Type")) {
		return
	}
	if cl := h.Get("Content-Length"); cl != "" {
		if n, err := strconv.Atoi(cl); err == nil && n < 1024 {
			return // not worth it
		}
	}
	h.Del("Content-Length")
	h.Set("Content-Encoding", "gzip")
	h.Add("Vary", "Accept-Encoding")
	gz := w.pool.Get().(*gzip.Writer)
	gz.Reset(w.ResponseWriter)
	w.gz = gz
	w.compress = true
}

func (w *gzipResponseWriter) Write(b []byte) (int, error) {
	w.decide()
	if w.compress {
		return w.gz.Write(b)
	}
	return w.ResponseWriter.Write(b)
}

func (w *gzipResponseWriter) WriteString(s string) (int, error) {
	return w.Write([]byte(s))
}

// WriteHeaderNow is used for bodiless responses; nothing to compress then.
func (w *gzipResponseWriter) WriteHeaderNow() {
	if !w.decided {
		w.decided = true
	}
	w.ResponseWriter.WriteHeaderNow()
}

func (w *gzipResponseWriter) Flush() {
	if w.compress {
		_ = w.gz.Flush()
	}
	w.ResponseWriter.Flush()
}

func (w *gzipResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	return w.ResponseWriter.Hijack()
}

// Unwrap lets http.ResponseController reach the underlying connection
// (e.g. to lift the server's WriteTimeout for long-lived streams).
func (w *gzipResponseWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

func (w *gzipResponseWriter) finish() {
	if w.compress && w.gz != nil {
		_ = w.gz.Close()
		w.gz.Reset(nil)
		w.pool.Put(w.gz)
		w.gz = nil
	}
}
