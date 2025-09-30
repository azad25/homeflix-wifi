package api

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/services"
)

func SetupRoutes(r *gin.Engine, mediaService *services.MediaService, streamService *services.OptimizedStreamService, thumbnailService *services.ThumbnailService, userService *services.UserService, recommendationService *services.RecommendationService) {
	api := r.Group("/api")
	{
		// Media endpoints
		api.GET("/media", getAllMedia(mediaService))
		api.GET("/media/:id", getMediaByID(mediaService))
		api.GET("/movies", getMovies(mediaService))
		api.GET("/recent", getRecentMedia(mediaService))
		api.GET("/recently-added", getRecentlyAdded(mediaService))
		api.GET("/most-watched", getMostWatched(mediaService))
		api.GET("/popular", getPopularMedia(mediaService))
		
		// Series endpoints
		api.GET("/series", getAllSeries(mediaService))
		api.GET("/series-list", getSeries(mediaService))
		api.GET("/series/:id", getSeriesByID(mediaService))
		
		// Search and filtering
		api.GET("/search", searchMedia(mediaService))
		api.GET("/search/advanced", searchMediaAdvanced(mediaService))
		api.GET("/genres", getGenres(mediaService))
		api.GET("/genres/:name/media", getMediaByGenre(mediaService))
		
		// Recommendations
		api.GET("/recommendations", getRecommendations(userService, recommendationService))
		api.GET("/recommendations/trending", getTrendingRecommendations(recommendationService))
		api.GET("/recommendations/similar", getSimilarRecommendations(userService, recommendationService))
		api.GET("/recommendations/continue", getContinueWatching(userService, recommendationService))
		api.POST("/recommendations/:mediaId/click", trackRecommendationClick(userService, recommendationService))
		
		// User interactions
		api.POST("/user/rate/:id", rateMedia(userService))
		api.GET("/user/rating/:id", getUserRating(userService))
		api.POST("/user/watchlist/:id", addToWatchlist(userService))
		api.DELETE("/user/watchlist/:id", removeFromWatchlist(userService))
		api.GET("/user/watchlist", getWatchlist(userService))
		api.GET("/user/history", getViewHistory(userService))
		api.POST("/user/progress/:id", updateProgress(userService))
		
		// Streaming
		api.GET("/stream/:id", streamMedia(mediaService, streamService))
		api.GET("/video/:id", streamVideo(mediaService, streamService))
		api.POST("/track-view/:id", trackView(mediaService, userService))
		
		// Thumbnails and previews
		api.GET("/thumbnails/:id", getThumbnail(mediaService, thumbnailService))
		api.GET("/preview-clips/:id", getPreviewClip(mediaService, thumbnailService))
		api.POST("/thumbnails/:id", generateThumbnail(mediaService, thumbnailService))
		api.GET("/previews/:id", getPreview(mediaService, thumbnailService))
		api.GET("/posters/:id", getPoster(mediaService))
		
		// Subtitles
		api.GET("/subtitles/:id", getSubtitles(mediaService))
		
		// Analytics (removed recordView for now)
		
		// Admin utilities
		api.POST("/admin/update-genres", updateAllMediaGenres(mediaService))
	}
}

func getAllMedia(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		media, err := mediaService.GetAllMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, media)
	}
}

func getRecentMedia(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
		media, err := mediaService.GetRecentlyAdded(limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, media)
	}
}

func getPopularMedia(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
		media, err := mediaService.GetMostWatched(limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, media)
	}
}

func getAllSeries(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		series, err := mediaService.GetAllSeries()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, series)
	}
}

func streamMedia(mediaService *services.MediaService, streamService *services.OptimizedStreamService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		err = streamService.StreamVideo(c.Writer, c.Request, media.FilePath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
}

func getPreviewClip(mediaService *services.MediaService, thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		mediaID := uint(id)
		
		// Get media to check if preview clip exists
		media, err := mediaService.GetMediaByID(mediaID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}
		
		// Check if preview clip exists, if not generate it
		if media.PreviewClipPath == "" {
			previewPath, err := thumbnailService.GeneratePreviewClip(media.FilePath, mediaID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate preview clip"})
				return
			}
			
			// Update media with preview clip path
			media.PreviewClipPath = previewPath
			mediaService.UpdateMedia(media)
		}

		// Serve the preview clip file
		c.Header("Content-Type", "video/mp4")
		c.File(media.PreviewClipPath)
	}
}

func generateThumbnail(mediaService *services.MediaService, thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		mediaID := uint(id)
		media, err := mediaService.GetMediaByID(mediaID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		thumbnailPath, err := thumbnailService.GenerateThumbnail(media.FilePath, mediaID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate thumbnail"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"thumbnail_path": thumbnailPath})
	}
}

func getMediaByID(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}
		c.JSON(http.StatusOK, media)
	}
}

func getMovies(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		movies, err := mediaService.GetMovies()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, movies)
	}
}

func getSeries(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		series, err := mediaService.GetSeries()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, series)
	}
}

func getSeriesByID(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid series ID"})
			return
		}

		series, err := mediaService.GetSeriesByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Series not found"})
			return
		}
		c.JSON(http.StatusOK, series)
	}
}

func searchMedia(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := c.Query("q")
		if query == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Search query is required"})
			return
		}

		media, err := mediaService.SearchMedia(query)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, media)
	}
}

func getGenres(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		genres, err := mediaService.GetAllGenres()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, genres)
	}
}

func getMediaByGenre(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		genreName := c.Param("name")
		media, err := mediaService.GetMediaByGenre(genreName)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, media)
	}
}

func getRecentlyAdded(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 20
		if l := c.Query("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
				limit = parsed
			}
		}

		media, err := mediaService.GetRecentlyAdded(limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, media)
	}
}

func getMostWatched(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 20
		if l := c.Query("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
				limit = parsed
			}
		}

		media, err := mediaService.GetMostWatched(limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, media)
	}
}

func streamVideo(mediaService *services.MediaService, streamService services.StreamServiceInterface) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		err = streamService.StreamVideo(c.Writer, c.Request, media.FilePath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}
}

func getThumbnail(mediaService *services.MediaService, thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		mediaID := uint(id)
		
		// Check if thumbnail exists, if not generate it
		if !thumbnailService.ThumbnailExists(mediaID) {
			media, err := mediaService.GetMediaByID(mediaID)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
				return
			}
			
			_, err = thumbnailService.GenerateThumbnail(media.FilePath, mediaID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate thumbnail"})
				return
			}
		}

		thumbnailPath := thumbnailService.GetThumbnailPath(mediaID)
		c.File(thumbnailPath)
	}
}

func getPreview(mediaService *services.MediaService, thumbnailService *services.ThumbnailService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		mediaID := uint(id)
		
		// Check if preview exists, if not generate it
		if !thumbnailService.PreviewExists(mediaID) {
			media, err := mediaService.GetMediaByID(mediaID)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
				return
			}
			
			_, err = thumbnailService.GeneratePreview(media.FilePath, mediaID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate preview"})
				return
			}
		}

		previewPath := thumbnailService.GetPreviewPath(mediaID)
		c.File(previewPath)
	}
}

func getSubtitles(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		c.JSON(http.StatusOK, media.Subtitles)
	}
}

// Enhanced trackView with user tracking
func trackView(mediaService *services.MediaService, userService *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		// Get default user
		user, err := userService.GetOrCreateDefaultUser()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
			return
		}

		// Track view in user history
		err = userService.TrackView(user.ID, uint(id), 0, false)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to track view"})
			return
		}

		// Update media view count
		err = mediaService.UpdateMediaViewCount(uint(id))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "View recorded"})
	}
}

// New handler functions for recommendations and user interactions

func searchMediaAdvanced(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := c.Query("q")
		genre := c.Query("genre")
		mediaType := c.Query("type")
		minRating := c.DefaultQuery("min_rating", "0")

		rating, _ := strconv.ParseFloat(minRating, 32)
		
		media, err := mediaService.SearchMediaAdvanced(query, genre, mediaType, float32(rating))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, media)
	}
}

func getRecommendations(userService *services.UserService, recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, err := userService.GetOrCreateDefaultUser()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
			return
		}

		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
		recommendations, err := recommendationService.GetRecommendationsForUser(user.ID, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, recommendations)
	}
}

func getTrendingRecommendations(recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
		trending, err := recommendationService.GetTrendingRecommendations(limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, trending)
	}
}

func getSimilarRecommendations(userService *services.UserService, recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, err := userService.GetOrCreateDefaultUser()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
			return
		}

		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
		similar, err := recommendationService.GetSimilarMedia(user.ID, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, similar)
	}
}

func getContinueWatching(userService *services.UserService, recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, err := userService.GetOrCreateDefaultUser()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
			return
		}

		continueWatching, err := recommendationService.GetContinueWatching(user.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, continueWatching)
	}
}

func trackRecommendationClick(userService *services.UserService, recommendationService *services.RecommendationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaID, err := strconv.ParseUint(c.Param("mediaId"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		user, err := userService.GetOrCreateDefaultUser()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
			return
		}

		err = recommendationService.TrackRecommendationClick(user.ID, uint(mediaID))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Click tracked"})
	}
}

func rateMedia(userService *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaID, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		var req struct {
			Rating float32 `json:"rating" binding:"required,min=0,max=10"`
			Review string  `json:"review"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		user, err := userService.GetOrCreateDefaultUser()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
			return
		}

		err = userService.RateMedia(user.ID, uint(mediaID), req.Rating, req.Review)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Rating saved"})
	}
}

func getUserRating(userService *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaID, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		user, err := userService.GetOrCreateDefaultUser()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
			return
		}

		rating, err := userService.GetUserRating(user.ID, uint(mediaID))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "No rating found"})
			return
		}
		c.JSON(http.StatusOK, rating)
	}
}

func addToWatchlist(userService *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaID, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		user, err := userService.GetOrCreateDefaultUser()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
			return
		}

		err = userService.AddToWatchlist(user.ID, uint(mediaID))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Added to watchlist"})
	}
}

func removeFromWatchlist(userService *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaID, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		user, err := userService.GetOrCreateDefaultUser()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
			return
		}

		err = userService.RemoveFromWatchlist(user.ID, uint(mediaID))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Removed from watchlist"})
	}
}

func getWatchlist(userService *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, err := userService.GetOrCreateDefaultUser()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
			return
		}

		watchlist, err := userService.GetWatchlist(user.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, watchlist)
	}
}

func getViewHistory(userService *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, err := userService.GetOrCreateDefaultUser()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
			return
		}

		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
		history, err := userService.GetViewHistory(user.ID, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, history)
	}
}

func updateProgress(userService *services.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		mediaID, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		var req struct {
			Progress int `json:"progress" binding:"required,min=0"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		user, err := userService.GetOrCreateDefaultUser()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
			return
		}

		err = userService.UpdateMediaProgress(user.ID, uint(mediaID), req.Progress)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "Progress updated"})
	}
}

func updateAllMediaGenres(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get all media
		allMedia, err := mediaService.GetAllMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		updated := 0
		for _, media := range allMedia {
			// Extract genres from path and title
			genres := extractGenresFromPath(media.FilePath, media.Title)
			if len(genres) > 0 {
				if err := mediaService.AssignGenresToMedia(media.ID, genres); err == nil {
					updated++
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Genres updated",
			"updated": updated,
			"total":   len(allMedia),
		})
	}
}

func extractGenresFromPath(path, title string) []string {
	var genres []string
	pathLower := strings.ToLower(path)
	titleLower := strings.ToLower(title)
	
	// Genre keywords to look for in path and title
	genreKeywords := map[string][]string{
		"Action": {"action", "fight", "martial", "combat", "war", "battle"},
		"Comedy": {"comedy", "funny", "humor", "laugh", "comic"},
		"Drama": {"drama", "dramatic", "emotional"},
		"Horror": {"horror", "scary", "terror", "nightmare", "zombie", "ghost"},
		"Romance": {"romance", "romantic", "love", "wedding"},
		"Sci-Fi": {"sci-fi", "science", "fiction", "space", "alien", "future", "robot"},
		"Fantasy": {"fantasy", "magic", "wizard", "dragon", "fairy", "mythical"},
		"Thriller": {"thriller", "suspense", "mystery", "detective"},
		"Crime": {"crime", "criminal", "police", "detective", "murder", "heist"},
		"Adventure": {"adventure", "quest", "journey", "expedition"},
		"Animation": {"animation", "animated", "cartoon", "anime"},
		"Documentary": {"documentary", "docu", "real", "true", "biography"},
		"Family": {"family", "kids", "children", "disney"},
		"Music": {"music", "musical", "concert", "band", "singer"},
		"Western": {"western", "cowboy", "wild west", "frontier"},
		"Sport": {"sport", "football", "basketball", "soccer", "boxing", "racing"},
	}
	
	// Check for genre keywords in path and title
	for genre, keywords := range genreKeywords {
		for _, keyword := range keywords {
			if strings.Contains(pathLower, keyword) || strings.Contains(titleLower, keyword) {
				genres = append(genres, genre)
				break // Only add each genre once
			}
		}
	}
	
	// If no genres found, assign a default based on file location or type
	if len(genres) == 0 {
		if strings.Contains(pathLower, "movie") {
			genres = append(genres, "Drama") // Default for movies
		} else if strings.Contains(pathLower, "tv") || strings.Contains(pathLower, "series") {
			genres = append(genres, "Drama") // Default for TV shows
		} else {
			genres = append(genres, "Drama") // Fallback default
		}
	}
	
	return genres
}

func getPoster(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Check if poster exists
		if media.PosterPath == "" {
			c.JSON(http.StatusNotFound, gin.H{"error": "No poster available"})
			return
		}

		// Serve the poster file
		c.Header("Content-Type", "image/jpeg")
		c.File(media.PosterPath)
	}
}
