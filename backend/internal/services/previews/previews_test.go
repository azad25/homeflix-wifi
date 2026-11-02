package previews

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"homeflix-backend/internal/models"
)

func testEngine(t *testing.T) (*Engine, *gorm.DB) {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("HOMEFLIX_ASSETS_DIR", filepath.Join(dir, "data"))
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())), &gorm.Config{Logger: logger.Discard})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.Media{}, &models.MediaPath{}); err != nil {
		t.Fatal(err)
	}
	e := New(db)
	e.primary = filepath.Join(dir, "previews")
	os.MkdirAll(e.primary, 0o755)
	return e, db
}

// fakeVideo: 40 s, black for the first 20 s then a moving colour pattern.
func fakeVideo(t *testing.T, dir string) string {
	t.Helper()
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not installed")
	}
	p := filepath.Join(dir, "movie.mkv")
	out, err := exec.Command("ffmpeg", "-v", "error", "-y",
		"-f", "lavfi", "-i", "color=c=black:s=1920x800:d=20:r=24",
		"-f", "lavfi", "-i", "testsrc2=s=1920x800:d=20:r=24",
		"-f", "lavfi", "-i", "sine=f=440:d=40",
		"-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]",
		"-map", "[v]", "-map", "2:a", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", p).CombinedOutput()
	if err != nil {
		t.Fatalf("make video: %v %s", err, out)
	}
	old := time.Now().Add(-time.Hour)
	os.Chtimes(p, old, old)
	return p
}

func TestGenerateMakesSmallClipFromBrightScene(t *testing.T) {
	e, db := testEngine(t)
	src := fakeVideo(t, t.TempDir())
	m := models.Media{Title: "Big Movie", Type: "movie", FilePath: src, PreviewClipPath: "/elsewhere/old.mp4"}
	db.Create(&m)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	e.Start(ctx)

	// Many hovers at once -> one job.
	var wg sync.WaitGroup
	paths := make([]string, 8)
	for i := range paths {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			p, err := e.Generate(ctx, Source{ID: m.ID}, true, false)
			if err != nil {
				t.Error(err)
			}
			paths[i] = p
		}(i)
	}
	wg.Wait()
	for _, p := range paths {
		if p != paths[0] {
			t.Fatalf("different results: %v", paths)
		}
	}
	if _, c := e.QueueState(); c.Generated != 1 {
		t.Fatalf("generated %d clips for one title", c.Generated)
	}
	if !strings.HasPrefix(filepath.Base(paths[0]), fmt.Sprintf("preview_%d_Big_Movie", m.ID)) {
		t.Fatalf("name: %s", paths[0])
	}
	var got models.Media
	db.First(&got, m.ID)
	if got.PreviewClipPath != paths[0] || got.PreviewPath != paths[0] {
		t.Fatalf("db not updated: %+v", got.PreviewClipPath)
	}
	info, err := probe(ctx, paths[0])
	if err != nil || info.Duration < 10 || info.Duration > 13 || !info.HasAudio {
		t.Fatalf("clip probe %+v %v", info, err)
	}
	out, _ := exec.Command("ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", paths[0]).Output()
	if strings.TrimSpace(string(out)) != "1280,532" {
		t.Fatalf("clip size %q, want 1280,532 (no letterbox padding)", out)
	}
	// Black scenes score below lively ones.
	if dark, lively := sceneScore(ctx, src, 5), sceneScore(ctx, src, 25); dark >= lively || lively < 0 {
		t.Fatalf("scene scores: black %.1f, pattern %.1f", dark, lively)
	}
	if p, ok := e.Lookup(m.ID); !ok || p != paths[0] {
		t.Fatalf("lookup %q %v", p, ok)
	}
}

func TestCandidatesSkipIntroAndCredits(t *testing.T) {
	cs := candidates(7200)
	if len(cs) < 3 || cs[0] < 1200 || cs[len(cs)-1] > 5000 {
		t.Fatalf("candidates %v", cs)
	}
	if cs := candidates(8); len(cs) != 1 || cs[0] != 0 {
		t.Fatalf("short clip %v", cs)
	}
}

func TestBackgroundSkippedWhenOnDemand(t *testing.T) {
	e, _ := testEngine(t)
	s := e.Settings()
	s.ScanGenerate = false
	if _, err := e.UpdateSettings(s); err != nil {
		t.Fatal(err)
	}
	if _, err := e.Generate(context.Background(), Source{ID: 1, FilePath: "/x"}, false, false); err != ErrOnDemand {
		t.Fatalf("err %v", err)
	}
}

func TestInteractiveJumpsTheQueue(t *testing.T) {
	e, _ := testEngine(t)
	for i := 1; i <= 5; i++ {
		e.Request(Source{ID: uint(i), Title: fmt.Sprint(i)}, false, false)
	}
	j := e.Request(Source{ID: 4}, true, false) // hover on a queued title: promoted
	if !j.interactive {
		t.Fatal("not promoted")
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if got := e.next(false, ctx); got.src.ID != 4 {
		t.Fatalf("next = %d, want the hovered title", got.src.ID)
	}
	if got := e.next(false, ctx); got.src.ID != 1 {
		t.Fatalf("next = %d", got.src.ID)
	}
	q, _ := e.QueueState()
	if q.Background != 3 {
		t.Fatalf("background left %d", q.Background)
	}
}

func write(t *testing.T, p string, size int, age time.Duration) {
	t.Helper()
	if err := os.WriteFile(p, make([]byte, size), 0o644); err != nil {
		t.Fatal(err)
	}
	ts := time.Now().Add(-age)
	os.Chtimes(p, ts, ts)
}

func TestCleanupOrphansAdoptionAndBudget(t *testing.T) {
	e, db := testEngine(t)
	dir := e.primary
	a := models.Media{Title: "Alpha", Type: "movie", FilePath: "/a.mkv"}
	b := models.Media{Title: "Bravo", Type: "movie", FilePath: "/b.mkv"}
	c := models.Media{Title: "1917", Type: "movie", FilePath: "/c.mkv"}
	db.Create(&a)
	db.Create(&b)
	db.Create(&c)
	used := filepath.Join(dir, fmt.Sprintf("preview_%d_Alpha.mp4", a.ID))
	db.Model(&a).Update("preview_clip_path", used)
	write(t, used, 4096, 48*time.Hour)
	// Bravo's DB path went missing but its file is here: re-linked, not deleted.
	lost := filepath.Join(dir, fmt.Sprintf("preview_%d_Bravo.mp4", b.ID))
	write(t, lost, 4096, 48*time.Hour)
	// Deleted title + an old regenerated copy: removed.
	gone := filepath.Join(dir, "preview_999_Gone.mp4")
	write(t, gone, 4096, 48*time.Hour)
	stale := filepath.Join(dir, fmt.Sprintf("preview_%d_Alpha_20250101_101010.mp4", a.ID))
	write(t, stale, 4096, 48*time.Hour)
	// Brand new unreferenced file (being recorded): kept for now.
	fresh := filepath.Join(dir, "preview_998_New.mp4")
	write(t, fresh, 4096, time.Minute)
	// Clip of another title whose name starts with c's id must not be given to c.
	wrong := filepath.Join(dir, fmt.Sprintf("preview_%d_Other_Film.mp4", c.ID))
	write(t, wrong, 4096, 48*time.Hour)
	// Not ours: never touched.
	other := filepath.Join(dir, "notes.txt")
	write(t, other, 10, 48*time.Hour)

	r := e.Cleanup()
	for _, p := range []string{used, lost, fresh, other} {
		if _, err := os.Stat(p); err != nil {
			t.Fatalf("%s removed", filepath.Base(p))
		}
	}
	for _, p := range []string{gone, stale, wrong} {
		if _, err := os.Stat(p); err == nil {
			t.Fatalf("%s kept", filepath.Base(p))
		}
	}
	if r.Orphans != 3 || r.Adopted != 1 {
		t.Fatalf("report %+v", r)
	}
	var got models.Media
	db.First(&got, b.ID)
	if got.PreviewClipPath != lost {
		t.Fatalf("bravo not re-linked: %q", got.PreviewClipPath)
	}

	// Budget: evict least recently watched first.
	e.settings.BudgetGB = 1
	big := func(name string, age time.Duration, id uint) string {
		p := filepath.Join(dir, name)
		f, _ := os.Create(p)
		f.Truncate(400 << 20) // sparse
		f.Close()
		ts := time.Now().Add(-age)
		os.Chtimes(p, ts, ts)
		db.Model(&models.Media{}).Where("id = ?", id).Update("preview_clip_path", p)
		return p
	}
	oldest := big(fmt.Sprintf("preview_%d_Alpha.mp4", a.ID), 30*24*time.Hour, a.ID)
	mid := big(fmt.Sprintf("preview_%d_Bravo.mp4", b.ID), 10*24*time.Hour, b.ID)
	newest := big(fmt.Sprintf("preview_%d_1917.mp4", c.ID), 2*time.Hour, c.ID)
	r = e.Cleanup()
	if _, err := os.Stat(oldest); err == nil {
		t.Fatal("least recently watched preview kept over budget")
	}
	for _, p := range []string{mid, newest} {
		if _, err := os.Stat(p); err != nil {
			t.Fatalf("%s evicted", filepath.Base(p))
		}
	}
	got = models.Media{}
	db.First(&got, a.ID)
	if got.PreviewClipPath != "" || r.Evicted != 1 {
		t.Fatalf("evicted title still points at its clip (%q) / %+v", got.PreviewClipPath, r)
	}
}

func TestTargetDirPrefersConfiguredThenPrimary(t *testing.T) {
	e, _ := testEngine(t)
	if d, err := e.targetDir(0); err != nil || d != e.primary {
		t.Fatalf("auto -> %q %v", d, err)
	}
	custom := filepath.Join(t.TempDir(), "clips")
	s := e.Settings()
	s.Location = custom
	if _, err := e.UpdateSettings(s); err != nil {
		t.Fatal(err)
	}
	if d, _ := e.targetDir(0); d != custom {
		t.Fatalf("custom -> %q", d)
	}
	if _, err := e.UpdateSettings(Settings{Location: "relative/dir"}); err == nil {
		t.Fatal("relative folder accepted")
	}
}
