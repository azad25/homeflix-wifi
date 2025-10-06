package api

import (
	"homeflix-backend/internal/api/handlers"
	"homeflix-backend/internal/scanner"
	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(r *gin.Engine, mediaService *services.MediaService, streamService *services.OptimizedStreamService, thumbnailService *services.ThumbnailService, userService *services.UserService, recommendationService *services.RecommendationService, playbackService *services.PlaybackService, geminiService *services.GeminiService, celeryService *services.CeleryService, alacService *services.ALACAudioService, tmdbService *services.TMDBService, mediaScanner *scanner.MediaScanner, watcherService *services.WatcherService) {
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
		scannerHandlers := handlers.NewScannerHandlers(mediaScanner)
		watcherHandler := NewWatcherHandler(watcherService)

		// Streaming
		api.GET("/stream/:id", handlers.StreamMedia(streamService, mediaService))
		api.GET("/preview-clips/:id", handlers.StreamPreviewClip(streamService, mediaService))

		// Thumbnails and previews
		api.GET("/thumbnails/:id", handlers.GetThumbnail(mediaService, thumbnailService))
		api.POST("/thumbnails/:id", handlers.GenerateThumbnail(mediaService, thumbnailService))
		api.GET("/previews/:id", handlers.GetPreview(mediaService, thumbnailService))
		api.GET("/posters/:id", handlers.GetPoster(mediaService))

		// Preview clip generation
		api.POST("/admin/preview-clips/:id/generate", handlers.GeneratePreviewClip(mediaService, thumbnailService))
		api.POST("/admin/preview-clips/:id/generate-optimized", handlers.GenerateOptimizedPreviewClip(mediaService, thumbnailService))

		// Optimized batch processing endpoints
		api.POST("/admin/thumbnails/batch", handlers.GenerateThumbnailBatch(mediaService, thumbnailService))
		api.POST("/admin/preview-clips/batch", handlers.GeneratePreviewClipBatch(mediaService, thumbnailService))

		// Thumbnail service monitoring
		api.GET("/admin/thumbnail-service/stats", handlers.GetThumbnailServiceStats(thumbnailService))
		api.GET("/admin/thumbnail-service/jobs/:jobId", handlers.GetJobStatus(thumbnailService))

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
		api.GET("/playback/recently-watched", handlers.GetRecentlyWatched(playbackService))
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

		// TMDB metadata endpoints
		api.POST("/admin/media/:id/generate-metadata", handlers.GenerateMediaMetadata(mediaService, tmdbService))
		api.POST("/admin/media/:id/update-with-tmdb", handlers.UpdateMediaWithTMDB(mediaService, tmdbService))
		api.POST("/admin/generate-recommendations", handlers.GenerateRecommendations(geminiService))

		// Netflix-style recommendation endpoints
		api.GET("/recommendations/trending", handlers.GetTrendingRecommendations(mediaService))
		api.GET("/recommendations/popular", handlers.GetPopularRecommendations(mediaService))
		api.GET("/recommendations/recent", handlers.GetRecentRecommendations(mediaService))
		api.GET("/recommendations/top-rated", handlers.GetHighRatedRecommendations(mediaService))
		api.GET("/recommendations/genre", handlers.GetGenreRecommendations(mediaService))
		api.GET("/recommendations/mixed", handlers.GetMixedRecommendations(mediaService))

		// Celery task management endpoints
		// Remove celery task management endpoints
		// api.POST("/celery/queue/media/process", celeryHandlers.QueueMediaProcessing)
		// api.POST("/celery/queue/metadata/generate", celeryHandlers.QueueMetadataGeneration)
		// api.POST("/celery/queue/thumbnails/generate", celeryHandlers.QueueThumbnailGeneration)
		// api.POST("/celery/queue/posters/download", celeryHandlers.QueuePosterDownload)
		// api.POST("/celery/queue/batch/process", celeryHandlers.QueueBatchProcessing)
		// api.POST("/celery/media/:id/reprocess", celeryHandlers.ReprocessMedia)

		// Celery monitoring endpoints
		api.GET("/celery/queues/status", celeryHandlers.GetQueueStatus)
		api.GET("/celery/queues/:queue/length", celeryHandlers.GetQueueLength)
		api.DELETE("/celery/queues/:queue/purge", celeryHandlers.PurgeQueue)

		// Manual metadata update endpoint
		api.PUT("/admin/media/:id/metadata", handlers.UpdateMediaMetadata(mediaService))

		// Thumbnail and preview path update endpoints (for Python tasks)
		api.PUT("/admin/media/:id/thumbnail", handlers.UpdateThumbnailPath(mediaService))
		api.PUT("/admin/media/:id/preview", handlers.UpdatePreviewPath(mediaService))

		// TMDB auto-update endpoint (alternative endpoint)
		api.POST("/admin/media/:id/fetch-tmdb", handlers.UpdateMediaWithTMDB(mediaService, tmdbService))

		// Media scanner endpoints
		api.POST("/admin/scan/full", scannerHandlers.StartFullScan)
		api.POST("/admin/scan/incremental", scannerHandlers.StartIncrementalScan)
		api.POST("/admin/scan/superfast", scannerHandlers.StartSuperfastScan)
		api.GET("/admin/scan/stats", scannerHandlers.GetScanStats)
		api.PUT("/admin/scan/config", scannerHandlers.ConfigureScanner)
		api.PUT("/admin/scan/workers/:workers", handlers.SetMaxWorkers(mediaScanner))
		api.PUT("/admin/scan/batch-size/:size", handlers.SetBatchSize(mediaScanner))

		// File watcher endpoints
		api.POST("/admin/watcher/start", watcherHandler.StartWatcher)
		api.POST("/admin/watcher/stop", watcherHandler.StopWatcher)
		api.GET("/admin/watcher/status", watcherHandler.GetWatcherStatus)
		api.POST("/admin/watcher/scan/manual", watcherHandler.TriggerManualScan)
		api.POST("/admin/watcher/scan/incremental", watcherHandler.TriggerIncrementalScan)
	}
}
