package services

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"
)

// fakeGitHub serves the API + raw endpoints the TV app source uses.
func fakeGitHub(t *testing.T, apk string, gradleCode int) (*TVAppSource, *int) {
	t.Helper()
	body, err := os.ReadFile(apk)
	if err != nil {
		t.Fatal(err)
	}
	downloads := 0
	mux := http.NewServeMux()
	j := func(w http.ResponseWriter, v interface{}) { _ = json.NewEncoder(w).Encode(v) }
	mux.HandleFunc("/api/repos/o/tv", func(w http.ResponseWriter, r *http.Request) { j(w, map[string]string{"default_branch": "v5"}) })
	mux.HandleFunc("/api/repos/o/tv/commits/v5", func(w http.ResponseWriter, r *http.Request) {
		j(w, map[string]interface{}{"sha": "abc123", "commit": map[string]interface{}{"message": "5.9.6: better remote\n\ndetails", "committer": map[string]string{"date": "2026-11-02T10:40:05Z"}}})
	})
	mux.HandleFunc("/api/repos/o/tv/contents/apk", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("ref") != "abc123" {
			t.Errorf("contents not pinned to the head commit: %q", r.URL.RawQuery)
		}
		j(w, []map[string]interface{}{{"name": "README.md", "path": "apk/README.md", "type": "file"}, {"name": "homeflix-tv-v5.apk", "path": "apk/homeflix-tv-v5.apk", "type": "file", "size": len(body)}})
	})
	mux.HandleFunc("/raw/o/tv/abc123/app/build.gradle.kts", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("android {\n  defaultConfig {\n    versionCode = " + strconv.Itoa(gradleCode) + "\n    versionName = \"5.9.6\"\n  }\n}\n"))
	})
	mux.HandleFunc("/raw/o/tv/abc123/apk/homeflix-tv-v5.apk", func(w http.ResponseWriter, r *http.Request) {
		downloads++
		w.Write(body)
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return &TVAppSource{Repo: "o/tv", APIBase: srv.URL + "/api", RawBase: srv.URL + "/raw", Client: srv.Client()}, &downloads
}

func TestTVAppSourceCheckAndFetch(t *testing.T) {
	src, downloads := fakeGitHub(t, "testdata/homeflix-tv-7.apk", 7)
	ctx := context.Background()

	remote, err := src.Check(ctx, false)
	if err != nil {
		t.Fatal(err)
	}
	if remote.Branch != "v5" || remote.VersionCode != 7 || remote.VersionName != "5.9.6" || remote.APKPath != "apk/homeflix-tv-v5.apk" || remote.CommitMessage != "5.9.6: better remote" {
		t.Fatalf("unexpected remote: %+v", remote)
	}
	if !strings.HasSuffix(remote.DownloadURL, "/raw/o/tv/abc123/apk/homeflix-tv-v5.apk") {
		t.Fatalf("download not pinned to the commit: %s", remote.DownloadURL)
	}

	u := &TVAppUpdates{Dir: t.TempDir(), cache: map[string]apkCacheEntry{}}
	var announced []int64
	u.OnNewRelease = func(r *TVAppRelease) { announced = append(announced, r.VersionCode) }
	// Server already has build 6: build 7 gets downloaded, published, announced.
	src6, _ := os.ReadFile("testdata/homeflix-tv-6.apk")
	if err := os.WriteFile(u.Dir+"/homeflix-tv-6.apk", src6, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := u.Scan(); err != nil {
		t.Fatal(err)
	}
	res, err := u.FetchLatest(ctx, src)
	if err != nil {
		t.Fatal(err)
	}
	if !res.Updated || res.Release.VersionCode != 7 || u.Latest().VersionCode != 7 {
		t.Fatalf("not published: %+v", res)
	}
	if res.Release.Notes != "5.9.6: better remote" {
		t.Fatalf("notes = %q", res.Release.Notes)
	}
	if len(announced) != 1 || announced[0] != 7 {
		t.Fatalf("TVs not told about the new build: %v", announced)
	}

	// Up to date: no second download.
	res, err = u.FetchLatest(ctx, src)
	if err != nil || res.Updated || *downloads != 1 {
		t.Fatalf("expected no-op, got %+v err=%v downloads=%d", res, err, *downloads)
	}
}

func TestTVAppSourceGradleAheadOfAPK(t *testing.T) {
	// gradle bumped to 8 but the committed APK is still build 7 = what we have.
	src, downloads := fakeGitHub(t, "testdata/homeflix-tv-7.apk", 8)
	u := &TVAppUpdates{Dir: t.TempDir(), cache: map[string]apkCacheEntry{}}
	b, _ := os.ReadFile("testdata/homeflix-tv-7.apk")
	os.WriteFile(u.Dir+"/homeflix-tv-7.apk", b, 0o644)
	u.Scan()
	res, err := u.FetchLatest(context.Background(), src)
	if err != nil || res.Updated || *downloads != 1 || u.Latest().VersionCode != 7 {
		t.Fatalf("stale APK must not be republished: %+v err=%v", res, err)
	}
	entries, _ := os.ReadDir(u.Dir)
	if len(entries) != 1 {
		t.Fatalf("temp download left behind: %d files", len(entries))
	}
}

func TestTVAppSourceRejectsOtherApps(t *testing.T) {
	// Corrupt "APK": not a zip with a TV manifest.
	tmp := t.TempDir() + "/x.apk"
	os.WriteFile(tmp, []byte("not an apk"), 0o644)
	src2, _ := fakeGitHub(t, tmp, 9)
	u := &TVAppUpdates{Dir: t.TempDir(), cache: map[string]apkCacheEntry{}}
	if _, err := u.FetchLatest(context.Background(), src2); err != ErrNotTVApp {
		t.Fatalf("err = %v, want ErrNotTVApp", err)
	}
	if u.Latest() != nil {
		t.Fatal("garbage was published")
	}
}

func TestTVAppSourceWithoutGitHubAPI(t *testing.T) {
	// API rate-limited: fall back to raw files on HEAD (the default branch).
	body, _ := os.ReadFile("testdata/homeflix-tv-7.apk")
	mux := http.NewServeMux()
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusForbidden) })
	mux.HandleFunc("/raw/o/tv/HEAD/app/build.gradle.kts", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`versionCode = 7` + "\n" + `versionName = "5.9.6"`))
	})
	mux.HandleFunc("/raw/o/tv/HEAD/apk/homeflix-tv-v5.apk", func(w http.ResponseWriter, r *http.Request) { w.Write(body) })
	srv := httptest.NewServer(mux)
	defer srv.Close()
	src := &TVAppSource{Repo: "o/tv", APIBase: srv.URL + "/api", RawBase: srv.URL + "/raw", Client: srv.Client()}

	u := &TVAppUpdates{Dir: t.TempDir(), cache: map[string]apkCacheEntry{}}
	res, err := u.FetchLatest(context.Background(), src)
	if err != nil || !res.Updated || res.Release.VersionCode != 7 {
		t.Fatalf("fallback fetch failed: %+v err=%v", res, err)
	}
}
