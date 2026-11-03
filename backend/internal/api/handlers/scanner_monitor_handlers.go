package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"homeflix-backend/internal/models"
	"homeflix-backend/internal/scanner"
	"homeflix-backend/internal/services"
	"homeflix-backend/internal/storage"
)

// ---- Settings > Scanner: status, live activity and library analysis ----

// ScannerStatus — GET /api/admin/scanner/status
func ScannerStatus(sc *scanner.MediaScanner, watcher *services.WatcherService) gin.HandlerFunc {
	return func(c *gin.Context) {
		out := gin.H{
			"current": scanner.Mon.Current(),
			"history": scanner.Mon.History(),
		}
		if sc != nil {
			last := sc.GetLastScanTime()
			if !last.IsZero() {
				out["last_scan"] = last
			}
			out["workers"], out["batch_size"] = sc.GetMaxWorkers(), sc.GetBatchSize()
			out["media_paths"] = sc.GetMediaPaths()
		}
		if watcher != nil {
			out["watcher"] = gin.H{"running": watcher.IsRunning(), "paths": watcher.GetWatchedPaths()}
		}
		c.JSON(http.StatusOK, out)
	}
}

// ScannerEvents — GET /api/admin/scanner/events?after=<seq>&limit=400
func ScannerEvents() gin.HandlerFunc {
	return func(c *gin.Context) {
		after, _ := strconv.ParseInt(c.Query("after"), 10, 64)
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "400"))
		ev := scanner.Mon.Events(after, limit)
		if ev == nil {
			ev = []scanner.Event{}
		}
		c.JSON(http.StatusOK, gin.H{"events": ev})
	}
}

// ScannerStream — GET /api/admin/scanner/stream (SSE)
// "event" messages carry activity lines; "run" messages carry the run's
// live counters (every second while a scan runs, and at start/finish).
func ScannerStream() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")
		c.Header("X-Accel-Buffering", "no")
		ch, cancel := scanner.Mon.Subscribe()
		defer cancel()
		send := func(kind string, v interface{}) bool {
			b, _ := json.Marshal(v)
			if _, err := fmt.Fprintf(c.Writer, "event: %s\ndata: %s\n\n", kind, b); err != nil {
				return false
			}
			c.Writer.Flush()
			return true
		}
		send("run", scanner.Mon.Current())
		tick := time.NewTicker(time.Second)
		defer tick.Stop()
		ping := time.NewTicker(25 * time.Second)
		defer ping.Stop()
		for {
			select {
			case <-c.Request.Context().Done():
				return
			case m := <-ch:
				var ok bool
				if m.Type == "event" {
					ok = send("event", m.Event)
				} else {
					ok = send("run", m.Run)
				}
				if !ok {
					return
				}
			case <-tick.C:
				if cur := scanner.Mon.Current(); cur != nil && !send("run", cur) {
					return
				}
			case <-ping.C:
				if _, err := io.WriteString(c.Writer, ": ping\n\n"); err != nil {
					return
				}
				c.Writer.Flush()
			}
		}
	}
}

// ---- analysis ----

type countBucket struct {
	Label string `json:"label"`
	Count int64  `json:"count"`
}

type issueSample struct {
	ID    uint   `json:"id"`
	Title string `json:"title"`
	Path  string `json:"path,omitempty"`
}

// LibraryIssue is one health check.
type LibraryIssue struct {
	Key     string        `json:"key"`
	Label   string        `json:"label"`
	Detail  string        `json:"detail"`
	Count   int64         `json:"count"`
	Tone    string        `json:"tone"`   // danger | info
	Action  string        `json:"action"` // POST endpoint that fixes it ("" = none)
	Fix     string        `json:"fix,omitempty"`
	Samples []issueSample `json:"samples"`
}

type folderStat struct {
	Name   string `json:"name"`
	Path   string `json:"path"`
	Type   string `json:"type"`
	Active bool   `json:"active"`
	Online bool   `json:"online"`
	Files  int64  `json:"files"`
	Bytes  int64  `json:"bytes"`
	Free   uint64 `json:"free"`
	Total  uint64 `json:"total"`
}

// LibraryAnalysis is the Scanner page's library report.
type LibraryAnalysis struct {
	GeneratedAt    time.Time      `json:"generated_at"`
	Movies         int64          `json:"movies"`
	Series         int64          `json:"series"`
	Seasons        int64          `json:"seasons"`
	Episodes       int64          `json:"episodes"`
	Bytes          int64          `json:"bytes"`
	MovieBytes     int64          `json:"movie_bytes"`
	TVBytes        int64          `json:"tv_bytes"`
	HoursOfVideo   float64        `json:"hours"`
	Added7d        int64          `json:"added_7d"`
	Added30d       int64          `json:"added_30d"`
	Resolution     []countBucket  `json:"resolution"`
	VideoCodecs    []countBucket  `json:"video_codecs"`
	AudioCodecs    []countBucket  `json:"audio_codecs"`
	Containers     []countBucket  `json:"containers"`
	HDR            int64          `json:"hdr"`
	Folders        []folderStat   `json:"folders"`
	Issues         []LibraryIssue `json:"issues"`
	Recent         []issueSample  `json:"recent"`
	MissingChecked int            `json:"missing_checked"` // files checked on disk
}

var (
	analysisMu    sync.Mutex
	analysisCache *LibraryAnalysis
)

func groupCounts(db *gorm.DB, col string) []countBucket {
	var rows []struct {
		Label string
		Count int64
	}
	db.Model(&models.Media{}).Select("COALESCE(NULLIF("+col+", ''), 'unknown') AS label, COUNT(*) AS count").
		Where("type IN ?", []string{"movie", "episode"}).Group("label").Order("count DESC").Limit(8).Scan(&rows)
	out := make([]countBucket, 0, len(rows))
	for _, r := range rows {
		out = append(out, countBucket{Label: r.Label, Count: r.Count})
	}
	return out
}

func samples(q *gorm.DB) []issueSample {
	var rows []models.Media
	q.Select("id", "title", "file_path", "type", "season_number", "episode_number").Order("created_at DESC").Limit(8).Find(&rows)
	out := make([]issueSample, 0, len(rows))
	for _, m := range rows {
		t := m.Title
		if m.Type == "episode" && m.SeasonNumber != nil && m.EpisodeNumber != nil {
			t = fmt.Sprintf("%s S%02dE%02d", t, *m.SeasonNumber, *m.EpisodeNumber)
		}
		out = append(out, issueSample{ID: m.ID, Title: t, Path: m.FilePath})
	}
	return out
}

func analyze(ctx context.Context, db *gorm.DB) *LibraryAnalysis {
	a := &LibraryAnalysis{GeneratedAt: time.Now()}
	media := func() *gorm.DB { return db.Model(&models.Media{}) }
	movies := func() *gorm.DB { return media().Where("type = ?", "movie") }
	videos := func() *gorm.DB { return media().Where("type IN ?", []string{"movie", "episode"}) }

	movies().Count(&a.Movies)
	media().Where("type = ?", "episode").Count(&a.Episodes)
	db.Model(&models.Series{}).Count(&a.Series)
	db.Model(&models.Season{}).Count(&a.Seasons)
	var sz struct{ M, T, D int64 }
	videos().Select("COALESCE(SUM(CASE WHEN type='movie' THEN file_size END),0) AS m, COALESCE(SUM(CASE WHEN type='episode' THEN file_size END),0) AS t, COALESCE(SUM(duration),0) AS d").Scan(&sz)
	a.MovieBytes, a.TVBytes, a.Bytes = sz.M, sz.T, sz.M+sz.T
	a.HoursOfVideo = float64(sz.D) / 3600
	videos().Where("created_at > ?", time.Now().AddDate(0, 0, -7)).Count(&a.Added7d)
	videos().Where("created_at > ?", time.Now().AddDate(0, 0, -30)).Count(&a.Added30d)

	// Resolution from the probed height; unprobed files count as unknown.
	var res struct{ UHD, FHD, HD, SD, Unknown int64 }
	videos().Select(`SUM(CASE WHEN video_height >= 1600 THEN 1 ELSE 0 END) AS uhd,
		SUM(CASE WHEN video_height >= 900 AND video_height < 1600 THEN 1 ELSE 0 END) AS fhd,
		SUM(CASE WHEN video_height >= 650 AND video_height < 900 THEN 1 ELSE 0 END) AS hd,
		SUM(CASE WHEN video_height > 0 AND video_height < 650 THEN 1 ELSE 0 END) AS sd,
		SUM(CASE WHEN video_height IS NULL OR video_height = 0 THEN 1 ELSE 0 END) AS unknown`).Scan(&res)
	a.Resolution = []countBucket{{"4K", res.UHD}, {"1080p", res.FHD}, {"720p", res.HD}, {"SD", res.SD}, {"Not probed", res.Unknown}}
	a.VideoCodecs = groupCounts(db, "video_codec")
	a.AudioCodecs = groupCounts(db, "audio_codec")
	a.Containers = groupCounts(db, "container")
	videos().Where("quality_tags LIKE ? OR quality_tags LIKE ?", "%HDR%", "%Dolby Vision%").Count(&a.HDR)

	// Folders: files and size per library folder, drive space.
	var paths []models.MediaPath
	db.Order("priority DESC").Find(&paths)
	for _, p := range paths {
		f := folderStat{Name: p.Name, Path: p.Path, Type: p.PathType, Active: p.IsActive, Online: storage.DriveAvailable(p.Path)}
		prefix := strings.TrimRight(p.Path, "/") + "/%"
		var agg struct{ N, B int64 }
		videos().Where("file_path LIKE ?", prefix).Select("COUNT(*) AS n, COALESCE(SUM(file_size),0) AS b").Scan(&agg)
		f.Files, f.Bytes = agg.N, agg.B
		if f.Online {
			if info, err := storage.GetDiskUsage(p.Path); err == nil {
				f.Free, f.Total = info.Free, info.Total
			}
		}
		a.Folders = append(a.Folders, f)
	}

	// Health checks.
	add := func(key, label, detail, tone, action, fix string, q *gorm.DB) {
		var n int64
		q.Session(&gorm.Session{}).Count(&n)
		if n == 0 {
			return
		}
		a.Issues = append(a.Issues, LibraryIssue{Key: key, Label: label, Detail: detail, Count: n, Tone: tone, Action: action, Fix: fix, Samples: samples(q.Session(&gorm.Session{}))})
	}
	add("no_metadata", "Movies without TMDB match", "No poster, cast or plot until matched. Usually an unusual file name.", "danger",
		"/api/admin/update-tmdb-data", "Match with TMDB", movies().Where("tmdb_id IS NULL OR tmdb_id = 0"))
	add("no_poster", "Movies without a poster", "Shown with a placeholder in rows and grids.", "info",
		"/api/admin/scan/regenerate-assets", "Fetch artwork", movies().Where("COALESCE(poster_path,'') = '' AND COALESCE(tmdb_backdrop_url,'') = ''"))
	add("not_probed", "Files not analysed yet", "Codec and resolution unknown: the first play has to probe the file, so it starts slower.", "info",
		"/api/admin/stream-profiles/backfill", "Analyse now", videos().Where("COALESCE(video_codec,'') = ''"))
	add("no_preview", "Movies without a hover preview", "Made automatically the first time someone hovers them.", "info",
		"/api/admin/storage/assets/generate-missing", "Make previews", movies().Where("COALESCE(preview_clip_path,'') = '' AND COALESCE(preview_path,'') = ''"))
	add("orphan_episodes", "Episodes not linked to a series", "They won't appear on any show page.", "danger",
		"/api/admin/scan/sync", "Re-scan & link", media().Where("type = ? AND (series_id IS NULL OR series_id = 0)", "episode"))

	// Duplicates: the same TMDB movie in more than one file.
	var dups []struct {
		TMDBID int
		N      int64
		Title  string
	}
	movies().Select("tmdb_id, COUNT(*) AS n, MIN(title) AS title").Where("tmdb_id > 0").Group("tmdb_id").Having("COUNT(*) > 1").Order("n DESC").Limit(50).Scan(&dups)
	if len(dups) > 0 {
		is := LibraryIssue{Key: "duplicates", Label: "Movies in more than one file", Detail: "Same film, several copies: check which quality to keep.", Tone: "info", Samples: []issueSample{}}
		for i, d := range dups {
			is.Count += d.N - 1
			if i < 8 {
				is.Samples = append(is.Samples, issueSample{Title: fmt.Sprintf("%s (%d files)", d.Title, d.N)})
			}
		}
		a.Issues = append(a.Issues, is)
	}

	// Files that vanished from disk (checked against online folders only, so
	// an unplugged drive doesn't flag its whole library).
	var rows []models.Media
	videos().Select("id", "title", "file_path", "type", "season_number", "episode_number").Order("id DESC").Limit(20000).Find(&rows)
	offline := []string{}
	for _, f := range a.Folders {
		if !f.Online {
			offline = append(offline, strings.TrimRight(f.Path, "/")+"/")
		}
	}
	missing := LibraryIssue{Key: "missing_files", Label: "Files missing on disk", Detail: "In the library but no longer where they were. Cleanup removes them.", Tone: "danger",
		Action: "/api/admin/scan/cleanup-invalid", Fix: "Clean up", Samples: []issueSample{}}
	deadline := time.Now().Add(6 * time.Second)
rowsLoop:
	for _, m := range rows {
		if ctx.Err() != nil || time.Now().After(deadline) {
			break
		}
		for _, o := range offline {
			if strings.HasPrefix(m.FilePath, o) {
				continue rowsLoop
			}
		}
		a.MissingChecked++
		if _, err := os.Stat(m.FilePath); os.IsNotExist(err) {
			missing.Count++
			if len(missing.Samples) < 8 {
				missing.Samples = append(missing.Samples, issueSample{ID: m.ID, Title: m.Title, Path: m.FilePath})
			}
		}
	}
	if missing.Count > 0 {
		a.Issues = append([]LibraryIssue{missing}, a.Issues...)
	}
	if a.Issues == nil {
		a.Issues = []LibraryIssue{}
	}
	a.Recent = samples(videos())
	return a
}

// ScannerAnalysis — GET /api/admin/scanner/analysis[?fresh=1] (cached 2 min)
func ScannerAnalysis(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		analysisMu.Lock()
		defer analysisMu.Unlock()
		if analysisCache == nil || c.Query("fresh") == "1" || time.Since(analysisCache.GeneratedAt) > 2*time.Minute {
			analysisCache = analyze(c.Request.Context(), db)
		}
		c.JSON(http.StatusOK, analysisCache)
	}
}
