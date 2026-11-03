package comingsoon

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestManagedYTDLPInstallVerifiesChecksum(t *testing.T) {
	asset := ytdlpAsset()
	if asset == "" {
		t.Skip("no build for this platform")
	}
	bin := []byte("#!/bin/sh\necho 2026.10.31\n")
	sum := sha256.Sum256(bin)
	good := hex.EncodeToString(sum[:])
	sums := good + "  " + asset + "\n"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch strings.TrimPrefix(r.URL.Path, "/") {
		case "SHA2-256SUMS":
			w.Write([]byte(sums))
		case asset:
			w.Write(bin)
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	old := ytdlpBaseURL
	ytdlpBaseURL = srv.URL + "/"
	defer func() { ytdlpBaseURL = old }()
	t.Setenv("HOMEFLIX_YTDLP", "")
	t.Setenv("PATH", "/usr/bin:/bin") // no system yt-dlp

	tl := newTool(t.TempDir())
	if err := tl.Ensure(context.Background(), false); err != nil {
		t.Fatal(err)
	}
	st := tl.Status()
	if st.Source != "managed" || st.Version != "2026.10.31" {
		t.Fatalf("status %+v", st)
	}
	// Tampered download is refused and the installed copy is kept.
	bin = []byte("#!/bin/sh\necho evil\n")
	if err := tl.Ensure(context.Background(), true); err == nil || !strings.Contains(err.Error(), "checksum") {
		t.Fatalf("tampered binary accepted: %v", err)
	}
	if v := ytdlpVersion(tl.managedPath()); v != "2026.10.31" {
		t.Fatalf("installed copy replaced: %q", v)
	}
	entries, _ := os.ReadDir(tl.dir)
	if len(entries) != 1 {
		t.Fatalf("temp files left: %d", len(entries))
	}
}
