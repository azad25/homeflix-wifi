package services

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func copyFile(t *testing.T, src, dst string) {
	t.Helper()
	b, err := os.ReadFile(src)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(dst, b, 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestReadAPKInfo_RealBuilds(t *testing.T) {
	cases := map[string]APKInfo{
		"testdata/homeflix-tv-7.apk": {Package: "com.homeflix.tv", VersionCode: 7, VersionName: "5.2"}, // R8 release
		"testdata/homeflix-tv-6.apk": {Package: "com.homeflix.tv", VersionCode: 6, VersionName: "5.1"}, // debug
	}
	for path, want := range cases {
		got, err := ReadAPKInfo(path)
		if err != nil || got != want {
			t.Errorf("%s: got %+v, %v; want %+v", path, got, err, want)
		}
	}
}

func TestReadAPKInfo_RejectsJunk(t *testing.T) {
	dir := t.TempDir()
	junk := filepath.Join(dir, "junk.apk")
	os.WriteFile(junk, []byte("not a zip"), 0o644)
	if _, err := ReadAPKInfo(junk); err == nil {
		t.Fatal("junk accepted")
	}
}

func TestScan_PicksHighestVersion_AndAnnouncesNewOnes(t *testing.T) {
	dir := t.TempDir()
	u := &TVAppUpdates{Dir: dir, cache: map[string]apkCacheEntry{}}
	var announced []int64
	u.OnNewRelease = func(r *TVAppRelease) { announced = append(announced, r.VersionCode) }

	if err := u.Scan(); err != nil || u.Latest() != nil {
		t.Fatalf("empty dir: latest=%v err=%v", u.Latest(), err)
	}
	// The server started with an empty folder; the user then drops the FIRST build in.
	// That must reach the TVs (this was the "TV never offered the update" bug).
	copyFile(t, "testdata/homeflix-tv-6.apk", filepath.Join(dir, "anything.apk"))
	os.WriteFile(filepath.Join(dir, "broken.apk"), []byte("nope"), 0o644)
	u.Scan()
	if l := u.Latest(); l == nil || l.VersionCode != 6 {
		t.Fatalf("want 6, got %+v", l)
	}
	if len(announced) != 1 || announced[0] != 6 {
		t.Fatalf("first build dropped in after startup must be announced: %v", announced)
	}
	announced = nil

	copyFile(t, "testdata/homeflix-tv-7.apk", filepath.Join(dir, "newer.apk"))
	os.WriteFile(filepath.Join(dir, "newer.txt"), []byte("Faster trailers\n"), 0o644)
	u.Scan()
	l := u.Latest()
	if l == nil || l.VersionCode != 7 || l.VersionName != "5.2" || l.Notes != "Faster trailers" {
		t.Fatalf("want 7 with notes, got %+v", l)
	}
	if l.URL != "/api/app/tv/download/7" || len(l.SHA256) != 64 || l.Size <= 0 {
		t.Fatalf("bad release fields: %+v", l)
	}
	if len(announced) != 1 || announced[0] != 7 {
		t.Fatalf("want announce [7], got %v", announced)
	}
	u.Scan() // unchanged: no second announcement
	if len(announced) != 1 {
		t.Fatalf("re-announced: %v", announced)
	}
	if r := u.Release(6); r == nil || r.VersionCode != 6 {
		t.Fatalf("older build should still be downloadable")
	}

	os.Remove(filepath.Join(dir, "newer.apk"))
	u.Scan()
	if l := u.Latest(); l == nil || l.VersionCode != 6 {
		t.Fatalf("after removing 7 want 6, got %+v", l)
	}
}

func TestScan_StartupStaysQuiet(t *testing.T) {
	dir := t.TempDir()
	copyFile(t, "testdata/homeflix-tv-7.apk", filepath.Join(dir, "a.apk"))
	u := &TVAppUpdates{Dir: dir, cache: map[string]apkCacheEntry{}}
	var announced []int64
	u.OnNewRelease = func(r *TVAppRelease) { announced = append(announced, r.VersionCode) }
	u.Scan() // server start: already-published build is not re-announced
	if len(announced) != 0 || u.Latest() == nil {
		t.Fatalf("startup: latest=%v announced=%v", u.Latest(), announced)
	}
}

func TestPublish_ValidatesAndStores(t *testing.T) {
	dir := t.TempDir()
	u := &TVAppUpdates{Dir: dir, cache: map[string]apkCacheEntry{}}
	var announced []int64
	u.OnNewRelease = func(r *TVAppRelease) { announced = append(announced, r.VersionCode) }

	if _, err := u.Publish(bytes.NewReader([]byte("PK junk")), ""); err != ErrNotTVApp {
		t.Fatalf("junk: want ErrNotTVApp, got %v", err)
	}
	b, _ := os.ReadFile("testdata/homeflix-tv-7.apk")
	rel, err := u.Publish(bytes.NewReader(b), "Cast support")
	if err != nil || rel.VersionCode != 7 || rel.Notes != "Cast support" {
		t.Fatalf("publish: %+v %v", rel, err)
	}
	if _, err := os.Stat(filepath.Join(dir, "homeflix-tv-7.apk")); err != nil {
		t.Fatal("stored file missing")
	}
	if len(announced) != 1 {
		t.Fatalf("upload must announce exactly once: %v", announced)
	}
	entries, _ := os.ReadDir(dir)
	for _, e := range entries {
		if filepath.Ext(e.Name()) == ".tmp" {
			t.Fatalf("temp file left behind: %s", e.Name())
		}
	}
}
