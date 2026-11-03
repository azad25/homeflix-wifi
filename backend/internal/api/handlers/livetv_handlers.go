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
			"enabled": true,
			// Favourites first (marked "favorite": true), then the rest of the
			// lineup; ?order=number keeps plain channel-number order.
			"channels":   s.Channels(livetv.Filter{Country: c.Query("country"), Category: c.Query("category"), Query: c.Query("q"), ByNumber: c.Query("order") == "number", FavoritesNumbered: favoritesNumbered(c)}),
			"favorites":  s.Favorites(),
			"countries":  countries,
			"categories": categories,
			"updated_at": st.UpdatedAt,
			"syncing":    st.Syncing,
		})
	}
}

// favoritesNumbered: the TV app sorts channels by number, so for it (and for
// ?order=favorites) favourites are numbered 1..k and the rest follow, which
// puts them at the top of its list. ?order=number always keeps lineup numbers.
func favoritesNumbered(c *gin.Context) bool {
	switch c.Query("order") {
	case "number":
		return false
	case "favorites":
		return true
	}
	return isTVAppClient(c)
}

// PlayLiveTVChannel — GET /api/livetv/channels/:id/play
// Returns proxied HLS playlist paths, best first; try them in order.
func PlayLiveTVChannel(s *livetv.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		ch, urls, youtubeID, err := s.Play(c.Request.Context(), c.Param("id"))
		switch {
		case errors.Is(err, livetv.ErrNoChannel):
			c.JSON(http.StatusNotFound, gin.H{"error": "channel not found"})
		case err != nil:
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
		default:
			if favoritesNumbered(c) {
				ch.Number = s.NumberOf(ch.ID, true) // same number the channel list gave
			}
			c.Header("Cache-Control", "no-store")
			c.JSON(http.StatusOK, gin.H{"channel": ch, "urls": urls, "youtube_id": youtubeID})
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

// LiveTVFavorites — GET /api/livetv/favorites
func LiveTVFavorites(s *livetv.Service) gin.HandlerFunc {
	return func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"favorites": s.Favorites()}) }
}

func setFavorites(c *gin.Context, s *livetv.Service, ids []string, on bool) {
	favs, err := s.SetFavorites(ids, on)
	switch {
	case errors.Is(err, livetv.ErrNoChannel):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case err != nil:
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusOK, gin.H{"favorites": favs})
	}
}

// AddLiveTVFavorite — PUT /api/livetv/favorites/:id
func AddLiveTVFavorite(s *livetv.Service) gin.HandlerFunc {
	return func(c *gin.Context) { setFavorites(c, s, []string{c.Param("id")}, true) }
}

// RemoveLiveTVFavorite — DELETE /api/livetv/favorites/:id
func RemoveLiveTVFavorite(s *livetv.Service) gin.HandlerFunc {
	return func(c *gin.Context) { setFavorites(c, s, []string{c.Param("id")}, false) }
}

// MergeLiveTVFavorites — POST /api/livetv/favorites {"ids": [...]}: adds the
// ones the server knows (used to bring over favourites saved in a browser).
func MergeLiveTVFavorites(s *livetv.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var in struct {
			IDs []string `json:"ids"`
		}
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		known := map[string]bool{}
		for _, ch := range s.Channels(livetv.Filter{ByNumber: true}) {
			known[ch.ID] = true
		}
		var ids []string
		for _, id := range in.IDs {
			if known[id] {
				ids = append(ids, id)
			}
		}
		setFavorites(c, s, ids, true)
	}
}
