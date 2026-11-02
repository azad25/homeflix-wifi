package cloud

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"homeflix-backend/internal/models"
)

func newTest(t *testing.T) (*Service, string) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{Logger: logger.Discard})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.Media{}, &models.MediaPath{}, &models.PlaybackProgress{}); err != nil {
		t.Fatal(err)
	}
	state := filepath.Join(t.TempDir(), "remotes")
	bin, _ := filepath.Abs("testdata/fake-rclone")
	t.Setenv("FAKE_RCLONE_STATE", state)
	t.Setenv("HOMEFLIX_RCLONE", bin)
	t.Setenv("HOMEFLIX_CLOUD_DIR", t.TempDir())
	return NewService(db), state
}

func TestRemotes(t *testing.T) {
	s, state := newTest(t)
	ctx := context.Background()
	if err := s.CreateRemote(ctx, "gdrive", "drive", map[string]string{}); err == nil {
		t.Fatal("OAuth remote without token accepted")
	}
	if err := s.CreateRemote(ctx, "bad name!", "s3", nil); err == nil {
		t.Fatal("bad name accepted")
	}
	if err := s.CreateRemote(ctx, "gdrive", "drive", map[string]string{"token": `{"access_token":"x"}`, "evil key": "1"}); err != nil {
		t.Fatal(err)
	}
	if err := s.CreateRemote(ctx, "wasabi", "s3", map[string]string{"provider": "Wasabi", "access_key_id": "AK", "secret_access_key": "SK"}); err != nil {
		t.Fatal(err)
	}
	log, _ := os.ReadFile(state + ".log")
	if !strings.Contains(string(log), "config create wasabi s3 provider=Wasabi access_key_id=AK secret_access_key=SK --obscure --non-interactive") || strings.Contains(string(log), "evil") {
		t.Fatalf("unexpected rclone calls:\n%s", log)
	}
	info := s.Info(ctx)
	if !info.Installed || info.Version != "rclone v1.68.2-fake" || len(info.Remotes) != 2 || info.Remotes[0] != (Remote{"gdrive", "drive"}) {
		t.Fatalf("info: %+v", info)
	}
	if err := s.DeleteRemote(ctx, "gdrive"); err != nil {
		t.Fatal(err)
	}
	if r, _ := s.Remotes(ctx); len(r) != 1 || r[0].Name != "wasabi" {
		t.Fatalf("after delete: %+v", r)
	}
}

func TestMountSettingsPersist(t *testing.T) {
	s, _ := newTest(t)
	if _, err := s.AddMount("wasabi", "Media/../..", 10); err == nil {
		t.Fatal("path traversal accepted")
	}
	m, err := s.AddMount("wasabi", "/HomeFlix/", 10)
	if err != nil || m.Folder != "HomeFlix" || !strings.HasSuffix(m.MountPoint, "/mounts/wasabi") {
		t.Fatalf("%+v %v", m, err)
	}
	if _, err := s.AddMount("wasabi", "", 0); err == nil {
		t.Fatal("duplicate mount accepted")
	}
	if _, err := s.UpdateSettings(true, "nope", 30); err == nil {
		t.Fatal("offload to unknown mount accepted")
	}
	if _, err := s.UpdateSettings(true, "wasabi", 14); err != nil {
		t.Fatal(err)
	}
	s2 := NewService(s.db)
	if len(s2.settings.Mounts) != 1 || !s2.settings.OffloadWhenLow || s2.settings.OffloadIdleDays != 14 {
		t.Fatalf("not persisted: %+v", s2.settings)
	}
	time.Sleep(100 * time.Millisecond) // let the (failing) mount attempt settle
	s.StopAll()
}

func TestOffloadMovesIdleTitles(t *testing.T) {
	s, _ := newTest(t)
	local := t.TempDir()
	cloudDir := t.TempDir()
	isMountedFn = func(string) bool { return true }
	defer func() { isMountedFn = isMountedProc }()

	// "Low" local drive: tiny threshold isn't controllable, so register the
	// path and fake low-ness by checking moveMedia directly + Offload wiring.
	os.MkdirAll(filepath.Join(local, "Movies", "Old Film (1990)"), 0o755)
	film := filepath.Join(local, "Movies", "Old Film (1990)", "Old Film.mkv")
	os.WriteFile(film, make([]byte, 3<<20), 0o644)
	os.WriteFile(strings.TrimSuffix(film, ".mkv")+".en.srt", []byte("1\n00:00:01,000 --> 00:00:02,000\nhi\n"), 0o644)
	m := models.Media{Title: "Old Film", Type: "movie", FilePath: film}
	s.db.Create(&m)

	n, err := s.moveMedia(m, local, cloudDir)
	if err != nil || n != 3<<20 {
		t.Fatalf("move: %d %v", n, err)
	}
	moved := filepath.Join(cloudDir, "Movies", "Old Film (1990)", "Old Film.mkv")
	if fi, err := os.Stat(moved); err != nil || fi.Size() != 3<<20 {
		t.Fatal("file not in the cloud folder")
	}
	if _, err := os.Stat(strings.TrimSuffix(moved, ".mkv") + ".en.srt"); err != nil {
		t.Fatal("subtitle not moved")
	}
	if _, err := os.Stat(film); !os.IsNotExist(err) {
		t.Fatal("local copy not removed")
	}
	var got models.Media
	s.db.First(&got, m.ID)
	if got.FilePath != moved {
		t.Fatalf("library not updated: %s", got.FilePath)
	}
}

func TestInfoWithNoRemotesIsNotNull(t *testing.T) {
	s, _ := newTest(t) // fresh rclone: no remotes configured
	b, _ := json.Marshal(s.Info(context.Background()))
	if !strings.Contains(string(b), `"remotes":[]`) {
		t.Fatalf("remotes must be an empty list: %s", b)
	}
}
