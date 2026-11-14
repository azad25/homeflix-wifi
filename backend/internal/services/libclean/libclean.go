// Package libclean removes library entries that are not movies or episodes
// (source code with a video extension, samples, trailers, extras, clips…),
// using the same rule as the scanner (internal/mediafiles).
//
// It only deletes database rows: files on disk are never touched. Files that
// can't be read (e.g. on an unplugged drive) are kept. Every removal is
// listed in data/library-cleanup.json.
package libclean

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"homeflix-backend/internal/mediafiles"

	"gorm.io/gorm"
)

// Removed is one entry taken out of the library.
type Removed struct {
	ID     uint   `json:"id"`
	Path   string `json:"path"`
	Reason string `json:"reason"`
}

// Report is the result of a run.
type Report struct {
	At            time.Time `json:"at"`
	Checked       int       `json:"checked"`
	Removed       []Removed `json:"removed"`
	EmptySeries   int       `json:"empty_series_removed"`
	DurationMs    int64     `json:"duration_ms"`
}

const reportFile = "./data/library-cleanup.json"

var running sync.Mutex

// roots: the library folders (Settings > Storage) plus MEDIA_PATH.
func roots(db *gorm.DB) []string {
	var paths []string
	db.Table("media_paths").Where("deleted_at IS NULL").Pluck("path", &paths)
	if p := strings.TrimSpace(os.Getenv("MEDIA_PATH")); p != "" {
		paths = append(paths, p)
	}
	return paths
}

// Run checks every library entry and removes those that aren't movies or
// episodes. Safe to call often: it skips if a run is already going.
func Run(db *gorm.DB) *Report {
	if db == nil || !running.TryLock() {
		return nil
	}
	defer running.Unlock()
	t0 := time.Now()
	rep := &Report{At: t0, Removed: []Removed{}}
	rs := roots(db)

	type row struct {
		ID       uint
		FilePath string
		FileSize int64
	}
	var rows []row
	if err := db.Table("media").Select("id, file_path, file_size").Where("deleted_at IS NULL AND file_path <> ''").Find(&rows).Error; err != nil {
		log.Printf("⚠️ Library cleanup: %v", err)
		return nil
	}
	rep.Checked = len(rows)
	var ids []uint
	for _, r := range rows {
		size := r.FileSize
		if size <= 0 {
			if fi, err := os.Stat(r.FilePath); err == nil {
				size = fi.Size()
			} else {
				size = -1 // unknown: the size rule is skipped
			}
		}
		if why := mediafiles.Reason(rs, r.FilePath, size, mediafiles.OpenFile); why != "" {
			ids = append(ids, r.ID)
			rep.Removed = append(rep.Removed, Removed{ID: r.ID, Path: r.FilePath, Reason: why})
		}
	}

	for start := 0; start < len(ids); start += 500 {
		end := start + 500
		if end > len(ids) {
			end = len(ids)
		}
		removeRows(db, ids[start:end])
	}
	if len(ids) > 0 {
		rep.EmptySeries = removeEmptySeries(db)
	}
	rep.DurationMs = time.Since(t0).Milliseconds()

	if len(rep.Removed) > 0 {
		_ = os.MkdirAll(filepath.Dir(reportFile), 0o755)
		if b, err := json.MarshalIndent(rep, "", "  "); err == nil {
			_ = os.WriteFile(reportFile, b, 0o644)
		}
		log.Printf("🧹 Library cleanup: removed %d entries that aren't movies or episodes (files on disk untouched), %d empty series; list in %s",
			len(rep.Removed), rep.EmptySeries, reportFile)
	}
	return rep
}

// removeRows deletes media rows and everything that points at them.
// Missing tables are ignored (older databases).
func removeRows(db *gorm.DB, ids []uint) {
	_ = db.Transaction(func(tx *gorm.DB) error {
		for _, table := range []string{
			"media_genres", "subtitles", "subtitle_tracks", "audio_tracks",
			"playback_progresses", "recently_watcheds", "watch_histories", "view_histories",
			"my_list_items", "collection_items", "watchlist_items",
		} {
			if tx.Migrator().HasTable(table) {
				tx.Exec("DELETE FROM "+table+" WHERE media_id IN ?", ids)
			}
		}
		return tx.Exec("DELETE FROM media WHERE id IN ?", ids).Error
	})
}

// removeEmptySeries drops shows left with no episodes (created by junk files).
func removeEmptySeries(db *gorm.DB) int {
	var empty []uint
	db.Raw(`SELECT id FROM series WHERE deleted_at IS NULL AND NOT EXISTS
		(SELECT 1 FROM media m WHERE m.series_id = series.id AND m.deleted_at IS NULL)`).Scan(&empty)
	if len(empty) == 0 {
		return 0
	}
	_ = db.Transaction(func(tx *gorm.DB) error {
		for _, table := range []string{"series_genres", "seasons"} {
			if tx.Migrator().HasTable(table) {
				tx.Exec("DELETE FROM "+table+" WHERE series_id IN ?", empty)
			}
		}
		return tx.Exec("DELETE FROM series WHERE id IN ?", empty).Error
	})
	return len(empty)
}
