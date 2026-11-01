package api

import (
	"compress/gzip"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func gzipRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(Gzip())
	big := make([]map[string]string, 300)
	for i := range big {
		big[i] = map[string]string{"title": "Some Movie Title", "description": strings.Repeat("lorem ipsum ", 10)}
	}
	r.GET("/api/big", func(c *gin.Context) { c.JSON(http.StatusOK, big) })
	r.GET("/api/small", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) })
	r.GET("/api/image", func(c *gin.Context) { c.Data(http.StatusOK, "image/jpeg", make([]byte, 4096)) })
	r.GET("/api/none", func(c *gin.Context) { c.Status(http.StatusNoContent) })
	r.GET("/api/stream/1", func(c *gin.Context) { c.Data(http.StatusOK, "text/plain", []byte(strings.Repeat("x", 5000))) })
	return r
}

func do(r http.Handler, path string, gz bool) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if gz {
		req.Header.Set("Accept-Encoding", "gzip, deflate")
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestGzipCompressesLargeJSON(t *testing.T) {
	r := gzipRouter()
	plain := do(r, "/api/big", false)
	w := do(r, "/api/big", true)
	if w.Header().Get("Content-Encoding") != "gzip" {
		t.Fatalf("expected gzip, headers %v", w.Header())
	}
	if w.Body.Len()*4 > plain.Body.Len() {
		t.Fatalf("poor compression: %d vs %d", w.Body.Len(), plain.Body.Len())
	}
	zr, err := gzip.NewReader(w.Body)
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(zr)
	var v []map[string]string
	if err := json.Unmarshal(body, &v); err != nil || len(v) != 300 {
		t.Fatalf("decompressed body invalid: %v len=%d", err, len(v))
	}
	if w.Header().Get("Content-Length") != "" {
		t.Fatalf("stale Content-Length kept")
	}
}

func TestGzipPassThrough(t *testing.T) {
	r := gzipRouter()
	for _, path := range []string{"/api/image", "/api/stream/1", "/api/none"} {
		w := do(r, path, true)
		if w.Header().Get("Content-Encoding") != "" {
			t.Errorf("%s should not be compressed", path)
		}
	}
	if w := do(r, "/api/big", false); w.Header().Get("Content-Encoding") != "" {
		t.Errorf("compressed without Accept-Encoding")
	}
	if w := do(r, "/api/image", true); w.Body.Len() != 4096 {
		t.Errorf("image body altered: %d", w.Body.Len())
	}
}
