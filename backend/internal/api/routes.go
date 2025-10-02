package api

import (
	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/api/handlers"
	"homeflix-backend/internal/services"
)

func SetupRoutes(r *gin.Engine, mediaService *services.MediaService, streamService *services.OptimizedStreamService, thumbnailService *services.ThumbnailService, userService *services.UserService, recommendationService *services.RecommendationService, playbackService *services.PlaybackService, geminiService *services.GeminiService, celeryService *services.CeleryService, alacService *services.ALACAudioService) {
	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "homeflix-backend"})
	})

	api := r.Group("/api")
	{
		// Media endpoints
		api.GET("/media", handlers.GetAllMedia(mediaService))
		api.GET("/media/movies", handlers.GetMovies(mediaService))
		api.GET("/media/tv-shows", handlers.GetTVShows(mediaService))
		api.GET("/media/tv-series-hero", handlers.GetTVSeriesForHero(mediaService))
		api.GET("/media/series-with-seasons", handlers.GetSeriesWithSeasons(mediaService))
		api.GET("/media/series/:id/seasons", handlers.GetSeriesByIDWithSeasons(mediaService))
		api.GET("/media/series/:id/seasons-list", handlers.GetSeasonsBySeriesID(mediaService))
		api.GET("/media/:id", handlers.GetMediaByID(mediaService))
		api.GET("/media/genre/:genre", handlers.GetMediaByGenre(mediaService))
		api.GET("/media/search", handlers.SearchMedia(mediaService))
		
		// Initialize handlers
		celeryHandlers := handlers.NewCeleryHandlers(celeryService)
		
		// Streaming
		api.GET("/stream/:id", handlers.StreamMedia(streamService, mediaService))
		
		// Thumbnails and previews
		api.GET("/thumbnails/:id", handlers.GetThumbnail(mediaService, thumbnailService))
		api.GET("/preview-clips/:id", handlers.GetPreviewClip(mediaService, thumbnailService))
		api.POST("/thumbnails/:id", handlers.GenerateThumbnail(mediaService, thumbnailService))
		api.GET("/previews/:id", handlers.GetPreview(mediaService, thumbnailService))
		api.GET("/posters/:id", handlers.GetPoster(mediaService))
		
		// Subtitles
		api.GET("/subtitles/:id", handlers.GetSubtitles(mediaService))
		
		// ALAC Audio endpoints
		api.GET("/audio/alac/:id", handlers.GetALACAudio(alacService, mediaService))
		api.POST("/audio/alac/:id/extract", handlers.ExtractALACAudio(alacService, mediaService))
		api.GET("/audio/alac/:id/metadata", handlers.GetALACAudioMetadata(alacService, mediaService))
		api.POST("/audio/alac/:id/spatial/:layout", handlers.ConvertToSpatialAudio(alacService, mediaService))
		api.GET("/audio/formats", handlers.GetSupportedAudioFormats(alacService))
		
		// Analytics and Playback
		api.POST("/track-view/:id", handlers.TrackView(mediaService, playbackService))
		api.POST("/playback/progress", handlers.UpdatePlaybackProgress(playbackService))
		api.GET("/playback/progress/:id", handlers.GetPlaybackProgress(playbackService, mediaService))
		api.GET("/playback/recent", handlers.GetRecentlyWatched(playbackService))
		api.GET("/playback/continue", handlers.GetContinueWatching(playbackService))
		api.GET("/playback/history", handlers.GetWatchHistory(playbackService))
		api.GET("/playback/stats", handlers.GetWatchStats(playbackService))
		
		// My List
		api.POST("/mylist/:id", handlers.AddToMyList(playbackService))
		api.DELETE("/mylist/:id", handlers.RemoveFromMyList(playbackService))
		api.GET("/mylist", handlers.GetMyList(playbackService))
		api.GET("/mylist/check/:id", handlers.CheckMyList(playbackService))
		
		// Admin utilities
		api.POST("/admin/update-genres", handlers.UpdateAllMediaGenres(mediaService))
		api.GET("/admin/media/:id", handlers.GetMediaByID(mediaService))
		api.PUT("/admin/media/:id/thumbnail", handlers.UpdateMediaThumbnail(mediaService))
		api.PUT("/admin/media/:id/preview", handlers.UpdateMediaPreview(mediaService))
		api.PUT("/admin/media/:id/video-metadata", handlers.UpdateMediaVideoMetadata(mediaService))
		
		// Media asset management
		api.GET("/admin/media/:id/assets", handlers.GetMediaAssets(mediaService))
		api.POST("/admin/media/:id/upload-asset", handlers.UploadMediaAsset(mediaService))
		api.DELETE("/admin/media/:id/delete-asset", handlers.DeleteMediaAsset(mediaService))
		api.GET("/admin/assets/:filename", handlers.ServeAsset())
		
		// Gemini AI endpoints (using existing handlers)
		// api.POST("/admin/media/:id/generate-metadata", handlers.GenerateMetadata(geminiService, mediaService))
		// api.POST("/admin/media/:id/regenerate-metadata", handlers.RegenerateMetadata(geminiService, mediaService))
		
		// Celery task management endpoints
		api.POST("/celery/queue/media/process", celeryHandlers.QueueMediaProcessing)
		api.POST("/celery/queue/metadata/generate", celeryHandlers.QueueMetadataGeneration)
		api.POST("/celery/queue/thumbnails/generate", celeryHandlers.QueueThumbnailGeneration)
		api.POST("/celery/queue/posters/download", celeryHandlers.QueuePosterDownload)
		api.POST("/celery/queue/batch/process", celeryHandlers.QueueBatchProcessing)
		api.POST("/celery/media/:id/reprocess", celeryHandlers.ReprocessMedia)
		
		// Celery monitoring endpoints
		api.GET("/celery/queues/status", celeryHandlers.GetQueueStatus)
		api.GET("/celery/queues/:queue/length", celeryHandlers.GetQueueLength)
		api.DELETE("/celery/queues/:queue/purge", celeryHandlers.PurgeQueue)
		
		// Recommendation endpoints
		api.GET("/recommendations", handlers.GetRecommendations(recommendationService))
		api.GET("/recommendations/tv-series", handlers.GetTVSeriesRecommendations(recommendationService))
		api.GET("/recommendations/similar/:id", handlers.GetSimilarMediaHandler(recommendationService))
		api.GET("/recommendations/continue-watching", handlers.GetContinueWatchingHandler(recommendationService))
		api.POST("/recommendations/track-click", handlers.TrackRecommendationClickHandler(recommendationService))
	}
	api.PUT("/admin/media/:id/metadata", handlers.UpdateMediaMetadata(mediaService))
}
