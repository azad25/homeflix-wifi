package libclean

import (
	"os"
	"path/filepath"
	"testing"

	"homeflix-backend/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestRunRemovesOnlyJunkRows(t *testing.T) {
	dir := t.TempDir()
	t.Chdir(dir)
	lib := filepath.Join(dir, "lib")
	write := func(rel string, size int64, head []byte) string {
		p := filepath.Join(lib, rel)
		os.MkdirAll(filepath.Dir(p), 0o755)
		f, _ := os.Create(p)
		f.Write(head)
		f.Truncate(size)
		f.Close()
		return p
	}
	big := int64(64 << 20)
	movie := write("Movies/Heat (1995)/Heat.1995.mkv", big, nil)
	ep := write("TV/Dark/Season 1/Dark.S01E01.mkv", big, nil)
	tsSrc := write("code/app/src/index.ts", big, []byte("export const x = 1;\n"+string(make([]byte, 500))))
	nm := write("code/app/node_modules/pkg/types.ts", big, []byte("declare const y: number;"))
	sample := write("Movies/Heat (1995)/heat-sample.mkv", big, nil)
	clip := write("Movies/clip.mp4", 2<<20, nil)
	gone := filepath.Join("/mnt/unplugged/Movies/Alien.1979.mkv") // file unreadable: kept

	db, _ := gorm.Open(sqlite.Open(filepath.Join(dir, "t.db")), &gorm.Config{Logger: logger.Discard})
	db.AutoMigrate(&models.Media{}, &models.Series{}, &models.Season{}, &models.Genre{}, &models.MediaPath{}, &models.PlaybackProgress{})
	db.Create(&models.MediaPath{Path: lib, Name: "lib", PathType: "primary", IsActive: true})
	show := models.Series{Title: "Dark"}
	junkShow := models.Series{Title: "index"}
	db.Create(&show)
	db.Create(&junkShow)
	add := func(p, typ string, series *uint) uint {
		m := models.Media{Title: filepath.Base(p), Type: typ, FilePath: p, SeriesID: series}
		db.Create(&m)
		return m.ID
	}
	keepMovie := add(movie, "movie", nil)
	add(ep, "episode", &show.ID)
	add(tsSrc, "episode", &junkShow.ID)
	add(nm, "movie", nil)
	add(sample, "movie", nil)
	add(clip, "movie", nil)
	add(gone, "movie", nil)
	db.Create(&models.PlaybackProgress{UserID: "1", MediaID: keepMovie, Position: 10})

	rep := Run(db)
	if rep == nil || len(rep.Removed) != 4 || rep.EmptySeries != 1 {
		t.Fatalf("report: %+v", rep)
	}
	var left []string
	db.Table("media").Pluck("file_path", &left)
	if len(left) != 3 {
		t.Fatalf("left: %v", left)
	}
	var shows int64
	db.Table("series").Count(&shows)
	if shows != 1 {
		t.Fatalf("series left: %d", shows)
	}
	var progress int64
	db.Table("playback_progresses").Count(&progress)
	if progress != 1 {
		t.Fatal("kept title lost its watch progress")
	}
	for _, p := range []string{movie, ep, tsSrc, nm, sample, clip} {
		if _, err := os.Stat(p); err != nil {
			t.Fatalf("file on disk touched: %s", p)
		}
	}
	if _, err := os.Stat(reportFile); err != nil {
		t.Fatal("no report written")
	}
	// Second run: nothing more to do.
	if rep := Run(db); rep == nil || len(rep.Removed) != 0 {
		t.Fatalf("second run removed more: %+v", rep)
	}
}
