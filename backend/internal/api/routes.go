package api

import (
	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/api/handlers"
	"homeflix-backend/internal/services"
)

func SetupRoutes(r *gin.Engine, mediaService *services.MediaService, streamService *services.OptimizedStreamService, thumbnailService *services.ThumbnailService, userService *services.UserService, recommendationService *services.RecommendationService, playbackService *services.PlaybackService, geminiService *services.GeminiService, celeryService *services.CeleryService, alacService *services.ALACAudioService) {
	api := r.Group("/api")
	{
		// Media endpoints
		api.GET("/media", handlers.GetAllMedia(mediaService))
		api.GET("/media/:id", handlers.GetMediaByID(mediaService))
		api.GET("/media/movies", handlers.GetMovies(mediaService))
		api.GET("/media/tv-shows", handlers.GetTVShows(mediaService))
		api.GET("/movies", handlers.GetMovies(mediaService))
		api.GET("/genre/:genre", handlers.GetMediaByGenre(mediaService))
		api.GET("/search", handlers.SearchMedia(mediaService))
		api.GET("/media/search", handlers.SearchMedia(mediaService))
		api.GET("/search/advanced", handlers.SearchMediaAdvanced(mediaService))
		api.GET("/media/trending", handlers.GetTrendingMedia(mediaService))
		api.GET("/trending", handlers.GetTrendingMedia(mediaService))
		api.GET("/media/popular", handlers.GetPopularMedia(mediaService))
		api.GET("/popular", handlers.GetPopularMedia(mediaService))
		api.GET("/media/recent", handlers.GetRecentMedia(mediaService))
		api.GET("/recent", handlers.GetRecentMedia(mediaService))
		
		// Genre endpoints
		api.GET("/genres", handlers.GetAllGenres(mediaService))
		api.GET("/genres/:id", handlers.GetGenreByID(mediaService))
		api.POST("/genres", handlers.CreateGenre(mediaService))
		api.PUT("/genres/:id", handlers.UpdateGenre(mediaService))
		api.DELETE("/genres/:id", handlers.DeleteGenre(mediaService))
		api.GET("/genres/stats", handlers.GetGenreStats(mediaService))
		
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
		api.GET("/audio/alac/:id", handlers.GetALACAudio(alacService))
		api.POST("/audio/alac/:id/extract", handlers.ExtractALACAudio(alacService, mediaService))
		api.GET("/audio/alac/:id/metadata", handlers.GetALACAudioMetadata(alacService))
		api.POST("/audio/alac/:id/spatial/:layout", handlers.ConvertToSpatialAudio(alacService, mediaService))
		api.GET("/audio/formats", handlers.GetSupportedAudioFormats(alacService))
		
		// Analytics and Playback
		api.POST("/track-view/:id", handlers.TrackView(mediaService, playbackService))
		api.POST("/playback/progress", handlers.UpdatePlaybackProgress(playbackService))
		api.GET("/playback/progress/:id", handlers.GetPlaybackProgress(playbackService))
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
	}
	api.PUT("/admin/media/:id/metadata", handlers.UpdateMediaMetadata(mediaService))
}
