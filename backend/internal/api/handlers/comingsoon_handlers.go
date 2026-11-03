package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"homeflix-backend/internal/services/autodl"
	"homeflix-backend/internal/services/comingsoon"
)

// ComingSoonItem is one title as the web and TV apps see it.
type ComingSoonItem struct {
	TMDBID       int      `json:"tmdb_id"`
	MediaType    string   `json:"media_type"`
	Title        string   `json:"title"`
	Overview     string   `json:"overview"`
	Tagline      string   `json:"tagline,omitempty"`
	ReleaseDate  string   `json:"release_date"`
	ReleaseLabel string   `json:"release_label,omitempty"`
	Season       int      `json:"season,omitempty"`
	DaysUntil    int      `json:"days_until"`
	PosterURL    string   `json:"poster_url"`
	BackdropURL  string   `json:"backdrop_url"`
	Genres       []string `json:"genres"`
	Cast         []string `json:"cast"`
	Studio       string   `json:"studio,omitempty"`
	Rank         int      `json:"rank"`
	Trailer      struct {
		State     string  `json:"state"`               // ready | pending | downloading | encoding | failed | no_downloader | over_budget
		VideoURL  string  `json:"video_url,omitempty"` // local MP4 when ready
		YouTubeID string  `json:"youtube_id"`          // fallback
		Width     int     `json:"width,omitempty"`
		Height    int     `json:"height,omitempty"`
		Duration  float64 `json:"duration,omitempty"`
		Bytes     int64   `json:"bytes,omitempty"`
	} `json:"trailer"`
	Notify struct {
		On     bool   `json:"on"`
		Status string `json:"status,omitempty"` // auto download status (scheduled, queued, downloading, ...)
	} `json:"notify"`
}

func tmdbImg(p, size string) string {
	if p == "" {
		return ""
	}
	return "https://image.tmdb.org/t/p/" + size + p
}

func comingSoonView(e comingsoon.Entry, notify map[string]string) ComingSoonItem {
	v := ComingSoonItem{TMDBID: e.TMDBID, MediaType: e.MediaType, Title: e.Title, Overview: e.Overview, Tagline: e.Tagline,
		ReleaseDate: e.ReleaseDate, ReleaseLabel: e.ReleaseLabel, Season: e.Season, PosterURL: tmdbImg(e.PosterPath, "w500"),
		BackdropURL: tmdbImg(e.BackdropPath, "w1280"), Genres: e.Genres, Cast: e.Cast, Studio: e.Studio, Rank: e.Rank}
	if t, err := time.Parse("2006-01-02", e.ReleaseDate); err == nil {
		v.DaysUntil = int(time.Until(t).Hours()/24) + 1
	}
	if v.Genres == nil {
		v.Genres = []string{}
	}
	if v.Cast == nil {
		v.Cast = []string{}
	}
	v.Trailer.State, v.Trailer.YouTubeID = e.State, e.YouTubeID
	if e.Video != nil && e.State == comingsoon.StateReady {
		v.Trailer.VideoURL = "/api/comingsoon/video/" + e.Video.File
		v.Trailer.Width, v.Trailer.Height, v.Trailer.Duration, v.Trailer.Bytes = e.Video.Width, e.Video.Height, e.Video.Duration, e.Video.Bytes
	}
	if st, ok := notify[e.MediaType+"-"+strconv.Itoa(e.TMDBID)]; ok {
		v.Notify.On, v.Notify.Status = true, st
	}
	return v
}

func notifyIndex(a *autodl.Service) map[string]string {
	out := map[string]string{}
	if a == nil {
		return out
	}
	for _, it := range a.List() {
		k := it.MediaType + "-" + strconv.Itoa(it.TMDBID)
		if _, ok := out[k]; !ok {
			out[k] = it.Status
		}
	}
	return out
}

// GetComingSoon — GET /api/comingsoon?type=movie|tv
func GetComingSoon(cs *comingsoon.Service, a *autodl.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		snap := cs.Snapshot(false)
		idx := notifyIndex(a)
		movies, series := []ComingSoonItem{}, []ComingSoonItem{}
		if c.Query("type") != "tv" {
			for _, e := range snap.Movies {
				movies = append(movies, comingSoonView(e, idx))
			}
		}
		if c.Query("type") != "movie" {
			for _, e := range snap.Series {
				series = append(series, comingSoonView(e, idx))
			}
		}
		c.Header("Cache-Control", "no-cache")
		c.JSON(http.StatusOK, gin.H{"movies": movies, "series": series, "refreshed": snap.Refreshed})
	}
}

// ComingSoonVideo — GET /api/comingsoon/video/:name (MP4, range requests)
func ComingSoonVideo(cs *comingsoon.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		p, ok := cs.VideoPath(c.Param("name"))
		if !ok {
			c.Status(http.StatusNotFound)
			return
		}
		c.Header("Cache-Control", "public, max-age=86400")
		c.Header("Content-Type", "video/mp4")
		c.File(p)
	}
}

type notifyReq struct {
	MediaType string `json:"media_type"`
	TMDBID    int    `json:"tmdb_id"`
}

// NotifyComingSoon — POST /api/comingsoon/notify {"media_type":"movie","tmdb_id":123}
// Puts the title in the Auto Download queue; it waits for the release date
// and downloads it then (shows: that season, and later seasons too).
func NotifyComingSoon(cs *comingsoon.Service, a *autodl.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var r notifyReq
		if err := c.ShouldBindJSON(&r); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		e, ok := cs.Entry(r.MediaType, r.TMDBID)
		if !ok {
			c.JSON(http.StatusNotFound, gin.H{"error": "not in the Coming Soon lineup"})
			return
		}
		req := autodl.AddRequest{TMDBID: e.TMDBID, MediaType: e.MediaType, Title: e.Title, PosterPath: e.PosterPath}
		if len(e.ReleaseDate) >= 4 {
			req.Year, _ = strconv.Atoi(e.ReleaseDate[:4])
		}
		if t, err := time.Parse("2006-01-02", e.ReleaseDate); err == nil {
			req.NotBefore = &t // nothing to find before release day
		}
		if e.MediaType == "tv" {
			if e.Season > 0 {
				req.Seasons = []int{e.Season}
			}
			req.Follow = true
		}
		items, err := a.Add(req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		status := ""
		if len(items) > 0 {
			status = items[0].Status
		}
		c.JSON(http.StatusOK, gin.H{"on": true, "status": status, "message": "HomeFlix will download " + e.Title + " when it's released"})
	}
}

// UnnotifyComingSoon — DELETE /api/comingsoon/notify/:type/:id
func UnnotifyComingSoon(a *autodl.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := strconv.Atoi(c.Param("id"))
		mt := c.Param("type")
		removed := 0
		for _, it := range a.List() {
			if it.TMDBID == id && it.MediaType == mt && it.Status != autodl.StatusDownloading && it.Status != autodl.StatusCompleted {
				if a.Remove(it.ID) == nil {
					removed++
				}
			}
		}
		if mt == "tv" {
			_ = a.Unfollow(id)
		}
		c.JSON(http.StatusOK, gin.H{"on": false, "removed": removed})
	}
}

// ComingSoonAdmin — GET /api/admin/comingsoon (lineup, states, space, log)
func ComingSoonAdmin(cs *comingsoon.Service) gin.HandlerFunc {
	return func(c *gin.Context) { c.JSON(http.StatusOK, cs.Snapshot(true)) }
}

// RefreshComingSoon — POST /api/admin/comingsoon/refresh
func RefreshComingSoon(cs *comingsoon.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		go func() { _ = cs.Refresh(context.Background()) }()
		c.JSON(http.StatusAccepted, gin.H{"message": "Checking for new releases…"})
	}
}

// UpdateComingSoonSettings — PUT /api/admin/comingsoon/settings
func UpdateComingSoonSettings(cs *comingsoon.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var in comingsoon.Settings
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		out, err := cs.UpdateSettings(in)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"settings": out, "message": "Saved"})
	}
}
