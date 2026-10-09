package handlers

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func testFile(t *testing.T, size int) (string, []byte) {
	t.Helper()
	data := make([]byte, size)
	for i := range data {
		data[i] = byte(i * 7)
	}
	p := filepath.Join(t.TempDir(), "movie.mp4")
	if err := os.WriteFile(p, data, 0o644); err != nil {
		t.Fatal(err)
	}
	return p, data
}

func TestServeMediaFileRange(t *testing.T) {
	gin.SetMode(gin.TestMode)
	path, data := testFile(t, 3<<20)
	r := gin.New()
	r.GET("/f", func(c *gin.Context) { serveMediaFile(c, path) })
	srv := httptest.NewServer(r)
	defer srv.Close()

	req, _ := http.NewRequest("GET", srv.URL+"/f", nil)
	req.Header.Set("Range", "bytes=1000000-1999999")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != http.StatusPartialContent {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	if !bytes.Equal(body, data[1000000:2000000]) {
		t.Fatalf("range body mismatch (%d bytes)", len(body))
	}
	if got := resp.Header.Get("Content-Range"); got != "bytes 1000000-1999999/3145728" {
		t.Fatalf("Content-Range = %q", got)
	}
}

// The writer must expose ReadFrom so net/http can use sendfile.
func TestSendfileWriterExposesReaderFrom(t *testing.T) {
	var w http.ResponseWriter = sendfileWriter{}
	if _, ok := w.(io.ReaderFrom); !ok {
		t.Fatal("sendfileWriter does not implement io.ReaderFrom")
	}
}

// A slow reader (a paused/buffer-full browser) must not be cut off by the
// server-wide WriteTimeout once the handler calls prepareLongStream.
func TestLongStreamOutlivesWriteTimeout(t *testing.T) {
	gin.SetMode(gin.TestMode)
	path, data := testFile(t, 8<<20)
	r := gin.New()
	r.GET("/f", func(c *gin.Context) {
		prepareLongStream(c)
		serveMediaFile(c, path)
	})
	srv := httptest.NewUnstartedServer(r)
	srv.Config.WriteTimeout = 300 * time.Millisecond
	srv.Start()
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/f")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var got []byte
	buf := make([]byte, 256<<10)
	for {
		n, err := resp.Body.Read(buf)
		got = append(got, buf[:n]...)
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("stream cut off after %d bytes: %v", len(got), err)
		}
		time.Sleep(25 * time.Millisecond) // read at "playback speed"
	}
	if !bytes.Equal(got, data) {
		t.Fatalf("got %d bytes, want %d", len(got), len(data))
	}
}
