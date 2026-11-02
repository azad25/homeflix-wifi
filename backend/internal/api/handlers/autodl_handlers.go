package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"homeflix-backend/internal/services"
	"homeflix-backend/internal/services/autodl"
)

// ListAutoDownloads — GET /api/autodownload
func ListAutoDownloads(s *autodl.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		c.JSON(http.StatusOK, gin.H{"items": s.List(), "settings": s.Settings()})
	}
}

// AddAutoDownload — POST /api/autodownload
// {tmdb_id, media_type: movie|tv, title, year, poster_path, seasons: [1,2]}
func AddAutoDownload(s *autodl.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req autodl.AddRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		items, err := s.Add(req)
		if errors.Is(err, autodl.ErrInvalid) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"items": items})
	}
}

func idParam(c *gin.Context) (uint, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return 0, false
	}
	return uint(id), true
}

// RemoveAutoDownload — DELETE /api/autodownload/:id (a running torrent keeps going; manage it in Downloads)
func RemoveAutoDownload(s *autodl.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		if id, ok := idParam(c); ok {
			if err := s.Remove(id); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"ok": true})
		}
	}
}

// RetryAutoDownload — POST /api/autodownload/:id/retry
func RetryAutoDownload(s *autodl.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		if id, ok := idParam(c); ok {
			if err := s.Retry(id); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"ok": true})
		}
	}
}

// RunAutoDownloads — POST /api/autodownload/run
func RunAutoDownloads(s *autodl.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		s.Kick()
		c.JSON(http.StatusAccepted, gin.H{"ok": true})
	}
}

// GetAutoDownloadSettings — GET /api/autodownload/settings
func GetAutoDownloadSettings(s *autodl.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"settings": s.Settings(), "profiles": autodl.Profiles})
	}
}

// UpdateAutoDownloadSettings — PUT /api/autodownload/settings
func UpdateAutoDownloadSettings(s *autodl.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var st autodl.Settings
		if err := c.ShouldBindJSON(&st); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid settings"})
			return
		}
		saved, err := s.UpdateSettings(st)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"settings": saved, "profiles": autodl.Profiles})
	}
}

// GetNotificationPrefs — GET /api/notifications/settings
func GetNotificationPrefs() gin.HandlerFunc {
	return func(c *gin.Context) { c.JSON(http.StatusOK, services.GetNotificationPrefs()) }
}

// UpdateNotificationPrefs — PUT /api/notifications/settings
func UpdateNotificationPrefs() gin.HandlerFunc {
	return func(c *gin.Context) {
		p := services.GetNotificationPrefs()
		if err := c.ShouldBindJSON(&p); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid settings"})
			return
		}
		if err := services.SaveNotificationPrefs(p); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, p)
	}
}
