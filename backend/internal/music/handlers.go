package music

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// SearchTracks handles track search
func (h *Handler) SearchTracks(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter required"})
		return
	}

	maxResults := 25
	if mr := c.Query("limit"); mr != "" {
		if parsed, err := strconv.Atoi(mr); err == nil && parsed > 0 {
			maxResults = parsed
		}
	}

	tracks, err := h.service.SearchTracks(query, maxResults)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tracks": tracks})
}

// GetTrendingTracks handles trending tracks
func (h *Handler) GetTrendingTracks(c *gin.Context) {
	maxResults := 50
	if mr := c.Query("limit"); mr != "" {
		if parsed, err := strconv.Atoi(mr); err == nil && parsed > 0 {
			maxResults = parsed
		}
	}

	tracks, err := h.service.GetTrendingTracks(maxResults)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tracks": tracks})
}

// CreatePlaylist handles playlist creation
func (h *Handler) CreatePlaylist(c *gin.Context) {
	var req struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// For now, use a default user ID - in production, get from auth
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		userID = "default-user"
	}

	playlist, err := h.service.CreatePlaylist(req.Name, req.Description, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, playlist)
}

// GetPlaylists handles getting user playlists
func (h *Handler) GetPlaylists(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		userID = "default-user"
	}

	playlists, err := h.service.GetPlaylists(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"playlists": playlists})
}

// GetPlaylist handles getting a specific playlist
func (h *Handler) GetPlaylist(c *gin.Context) {
	playlistID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid playlist ID"})
		return
	}

	playlist, err := h.service.GetPlaylistWithTracks(uint(playlistID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "playlist not found"})
		return
	}

	c.JSON(http.StatusOK, playlist)
}

// AddTrackToPlaylist handles adding track to playlist
func (h *Handler) AddTrackToPlaylist(c *gin.Context) {
	playlistID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid playlist ID"})
		return
	}

	var req struct {
		TrackID uint `json:"track_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		userID = "default-user"
	}

	err = h.service.AddTrackToPlaylist(uint(playlistID), req.TrackID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "track added to playlist"})
}

// LikeTrack handles liking/unliking tracks
func (h *Handler) LikeTrack(c *gin.Context) {
	trackID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid track ID"})
		return
	}

	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		userID = "default-user"
	}

	err = h.service.LikeTrack(uint(trackID), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "track like toggled"})
}

// GetLikedTracks handles getting liked tracks
func (h *Handler) GetLikedTracks(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		userID = "default-user"
	}

	tracks, err := h.service.GetLikedTracks(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tracks": tracks})
}

// PlayTrack handles track play (adds to recently played)
func (h *Handler) PlayTrack(c *gin.Context) {
	trackID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid track ID"})
		return
	}

	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		userID = "default-user"
	}

	err = h.service.AddToRecentlyPlayed(uint(trackID), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "track played"})
}

// GetRecentlyPlayed handles getting recently played tracks
func (h *Handler) GetRecentlyPlayed(c *gin.Context) {
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		userID = "default-user"
	}

	limit := 50
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	recent, err := h.service.GetRecentlyPlayed(userID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tracks": recent})
}

// GetTrackStream handles getting track stream URL
func (h *Handler) GetTrackStream(c *gin.Context) {
	youtubeID := c.Param("youtube_id")
	if youtubeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "youtube_id required"})
		return
	}

	// Return YouTube embed URL for audio streaming
	streamURL := "https://www.youtube.com/embed/" + youtubeID + "?autoplay=1&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1"
	
	c.JSON(http.StatusOK, gin.H{
		"stream_url": streamURL,
		"youtube_id": youtubeID,
	})
}

// GetTopCharts handles getting top music charts
func (h *Handler) GetTopCharts(c *gin.Context) {
	maxResults := 50
	if mr := c.Query("limit"); mr != "" {
		if parsed, err := strconv.Atoi(mr); err == nil && parsed > 0 {
			maxResults = parsed
		}
	}

	tracks, err := h.service.GetTopCharts(maxResults)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tracks": tracks})
}

// GetNewReleases handles getting new music releases
func (h *Handler) GetNewReleases(c *gin.Context) {
	maxResults := 30
	if mr := c.Query("limit"); mr != "" {
		if parsed, err := strconv.Atoi(mr); err == nil && parsed > 0 {
			maxResults = parsed
		}
	}

	tracks, err := h.service.GetNewReleases(maxResults)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tracks": tracks})
}

// GetGenreMusic handles getting music by genre
func (h *Handler) GetGenreMusic(c *gin.Context) {
	genre := c.Param("genre")
	if genre == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "genre parameter required"})
		return
	}

	maxResults := 25
	if mr := c.Query("limit"); mr != "" {
		if parsed, err := strconv.Atoi(mr); err == nil && parsed > 0 {
			maxResults = parsed
		}
	}

	tracks, err := h.service.GetGenreMusic(genre, maxResults)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tracks": tracks})
}

// GetMoodMusic handles getting music by mood
func (h *Handler) GetMoodMusic(c *gin.Context) {
	mood := c.Param("mood")
	if mood == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "mood parameter required"})
		return
	}

	maxResults := 25
	if mr := c.Query("limit"); mr != "" {
		if parsed, err := strconv.Atoi(mr); err == nil && parsed > 0 {
			maxResults = parsed
		}
	}

	tracks, err := h.service.GetMoodMusic(mood, maxResults)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tracks": tracks})
}