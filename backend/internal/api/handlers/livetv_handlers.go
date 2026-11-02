package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"homeflix-backend/internal/services/livetv"
)

// ListLiveTVChannels — GET /api/livetv/channels?country=&category=&q=
func ListLiveTVChannels(s *livetv.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		st := s.Status()
		if !st.Enabled {
			c.JSON(http.StatusOK, gin.H{"enabled": false, "channels": []interface{}{}})
			return
		}
		countries, categories := s.Facets()
		c.Header("Cache-Control", "private, max-age=30")
		c.JSON(http.StatusOK, gin.H{
			"enabled":    true,
			"channels":   s.Channels(livetv.Filter{Country: c.Query("country"), Category: c.Query("category"), Query: c.Query("q")}),
			"countries":  countries,
			"categories": categories,
			"updated_at": st.UpdatedAt,
			"syncing":    st.Syncing,
		})
	}
}

// PlayLiveTVChannel — GET /api/livetv/channels/:id/play
// Returns proxied HLS playlist paths, best first; try them in order.
func PlayLiveTVChannel(s *livetv.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		ch, urls, err := s.Play(c.Param("id"))
		switch {
		case errors.Is(err, livetv.ErrNoChannel):
			c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
		case err != nil:
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
		default:
			c.Header("Cache-Control", "no-store")
			c.JSON(http.StatusOK, gin.H{"channel": ch, "urls": urls})
		}
	}
}

// LiveTVProxy — GET /api/livetv/p/<sig>/<token>/<name>
func LiveTVProxy(s *livetv.Service) gin.HandlerFunc {
	return func(c *gin.Context) { s.Proxy().ServeHTTP(c.Writer, c.Request) }
}

// GetLiveTVAdmin — GET /api/admin/livetv
func GetLiveTVAdmin(s *livetv.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"settings": s.Settings(), "status": s.Status()})
	}
}

// UpdateLiveTVSettings — PUT /api/admin/livetv/settings
func UpdateLiveTVSettings(s *livetv.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var st livetv.Settings
		if err := c.ShouldBindJSON(&st); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid settings"})
			return
		}
		if st.Countries == nil {
			st.Countries = []string{}
		}
		if err := s.UpdateSettings(st); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"settings": s.Settings(), "status": s.Status()})
	}
}

// RefreshLiveTV — POST /api/admin/livetv/refresh (rebuild lineup + check)
func RefreshLiveTV(s *livetv.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		s.Refresh()
		c.JSON(http.StatusAccepted, gin.H{"status": s.Status()})
	}
}

// CheckLiveTV — POST /api/admin/livetv/check (re-test every stream)
func CheckLiveTV(s *livetv.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		s.CheckNow()
		c.JSON(http.StatusAccepted, gin.H{"status": s.Status()})
	}
}
