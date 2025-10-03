package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"
)

// Media Handlers

func GetAllMedia(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		media, err := mediaService.GetAllMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, media)
	}
}

func GetMediaByID(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idParam := c.Param("id")
		if idParam == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		var media *models.Media
		var err error

		// Try to parse as numeric ID first
		if id, parseErr := strconv.ParseUint(idParam, 10, 32); parseErr == nil {
			media, err = mediaService.GetMediaByID(uint(id))
		} else {
			// If not numeric, treat as UUID
			media, err = mediaService.GetMediaByUUID(idParam)
		}

		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		c.JSON(http.StatusOK, media)
	}
}

func GetMovies(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		movies, err := mediaService.GetMovies()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, movies)
	}
}

func GetRecentMedia(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		media, err := mediaService.GetRecentMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, media)
	}
}

func GetRecentlyAdded(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		media, err := mediaService.GetRecentlyAdded(20)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, media)
	}
}

func GetMostWatched(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		media, err := mediaService.GetMostWatched(20)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, media)
	}
}

func GetPopularMedia(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		media, err := mediaService.GetPopularMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, media)
	}
}

func GetTVShows(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		shows, err := mediaService.GetTVShows()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, shows)
	}
}

func GetTVSeriesForHero(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		series, err := mediaService.GetTVSeriesForHero()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, series)
	}
}

func GetSeriesWithSeasons(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		series, err := mediaService.GetSeriesWithSeasons()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, series)
	}
}

func GetSeriesByIDWithSeasons(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		seriesID, err := strconv.ParseUint(id, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid series ID"})
			return
		}

		series, err := mediaService.GetSeriesByIDWithSeasons(uint(seriesID))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Series not found"})
			return
		}
		c.JSON(http.StatusOK, series)
	}
}

func GetSeasonsBySeriesID(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		seriesID, err := strconv.ParseUint(id, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid series ID"})
			return
		}

		seasons, err := mediaService.GetSeasonsBySeriesID(uint(seriesID))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, seasons)
	}
}

func GetMediaByGenre(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		genre := c.Param("genre")
		media, err := mediaService.GetMediaByGenre(genre)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, media)
	}
}

func SearchMedia(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := c.Query("q")
		if query == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter 'q' is required"})
			return
		}

		results, err := mediaService.SearchMedia(query)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"media": results})
	}
}

func UpdateAllMediaGenres(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		err := mediaService.UpdateAllMediaGenres()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "All media genres updated successfully"})
	}
}

// UpdateMediaThumbnail updates the thumbnail path for a media item
func UpdateMediaThumbnail(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		var request struct {
			ThumbnailPath string `json:"thumbnail_path"`
		}

		if err := c.BindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Update thumbnail path
		media.ThumbnailPath = request.ThumbnailPath

		if err := mediaService.UpdateMedia(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update thumbnail path"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Thumbnail path updated successfully"})
	}
}

// UpdateMediaPreview updates the preview clip path for a media item
func UpdateMediaPreview(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		var request struct {
			PreviewPath string `json:"preview_path"`
		}

		if err := c.BindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Update preview path (using PreviewClipPath field)
		media.PreviewClipPath = request.PreviewPath

		if err := mediaService.UpdateMedia(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update preview path"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Preview path updated successfully"})
	}
}

// UpdateMediaVideoMetadata updates video metadata for a media item
func UpdateMediaVideoMetadata(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		var request struct {
			Resolution   string  `json:"resolution"`
			VideoCodec   string  `json:"video_codec"`
			Codec        string  `json:"codec"`
			Bitrate      int     `json:"bitrate"`
			Duration     float64 `json:"duration"`
			Width        int     `json:"width"`
			Height       int     `json:"height"`
			AudioCodec   string  `json:"audio_codec"`
			FormatName   string  `json:"format_name"`
		}

		if err := c.BindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Update video metadata
		if request.Resolution != "" {
			media.Resolution = request.Resolution
		}
		// Use video_codec field if provided, otherwise fall back to codec
		codec := request.VideoCodec
		if codec == "" {
			codec = request.Codec
		}
		if codec != "" {
			media.Codec = codec
		}
		if request.Bitrate > 0 {
			media.Bitrate = request.Bitrate
		}
		if request.Duration > 0 {
			media.Duration = int(request.Duration)
		}

		if err := mediaService.UpdateMedia(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update video metadata"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Video metadata updated successfully"})
	}
}
