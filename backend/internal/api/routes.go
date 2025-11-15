package api

import (
	"homeflix-backend/internal/api/handlers"
	torrentHandlers "homeflix-backend/internal/handlers"
	"homeflix-backend/internal/scanner"
	"homeflix-backend/internal/services"
	"gorm.io/gorm"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(r *gin.Engine, mediaService *services.MediaService, streamService *services.OptimizedStreamService, thumbnailService *services.ThumbnailService, userService *services.UserService, recommendationService *services.RecommendationService, playbackService *services.PlaybackService, geminiService *services.GeminiService, celeryService *services.CeleryService, alacService *services.ALACAudioService, tmdbService *services.TMDBService, mediaScanner *scanner.MediaScanner, watcherService *services.WatcherService, redisCache *services.RedisAssetCache, transcodeService *services.TranscodeService, newsService *services.NewsService, posterService *services.PosterService, openSubService *services.OpenSubtitlesService, db *gorm.DB) {
	api := r.Group("/api")
	{
		// Media routes
		api.GET("/media", handlers.GetAllMedia(mediaService))
		api.GET("/media/movies", handlers.GetMovies(mediaService))
		api.GET("/media/tv-shows", handlers.GetTVShows(mediaService))
		api.GET("/media/genre/:genre", handlers.GetMediaByGenre(mediaService))
		api.GET("/media/search", handlers.SearchMedia(mediaService))
		
		// Enhanced subtitle and audio track endpoints (must be before /media/:id)
		api.GET("/media/:id/subtitles", handlers.GetSubtitleTracks(mediaService))
		api.GET("/media/:id/audio", handlers.GetAudioTracks(mediaService))
		api.GET("/media/:id/subtitles/:trackId/file", handlers.GetSubtitleFile(mediaService))
		api.GET("/media/:id/alac-audio", handlers.StreamALACAudio(streamService, mediaService))
		
		// General media routes (must be after specific sub-routes)
		api.GET("/media/:id", handlers.GetMediaByID(mediaService))
		api.DELETE("/media/:id", handlers.DeleteMedia(mediaService))

		// Hierarchical TV series routes
		api.GET("/series", handlers.GetAllSeries(mediaService))
		api.GET("/series/:id", handlers.GetSeriesByID(mediaService))
		api.DELETE("/series/:id", handlers.DeleteSeries(mediaService))
		api.PUT("/series/:id/metadata", handlers.UpdateSeriesMetadata(mediaService))
		api.GET("/series/:id/seasons", handlers.GetSeasonsBySeriesID(mediaService))
		api.GET("/series/:id/seasons/:season/episodes", handlers.GetEpisodesBySeriesAndSeason(mediaService))
		api.GET("/series/:id/poster", handlers.GetSeriesPoster(mediaService, posterService))

		// Genre endpoints
		api.GET("/genres", handlers.GetAllGenres(mediaService))
		api.GET("/genres/:id", handlers.GetGenreByID(mediaService))
		api.POST("/genres", handlers.CreateGenre(mediaService))
		api.DELETE("/genres/:id", handlers.DeleteGenre(mediaService))
		api.GET("/genres/stats", handlers.GetGenreStats(mediaService))

		// Initialize handlers
		celeryHandlers := handlers.NewCeleryHandlers(celeryService)
		scannerHandlers := handlers.NewScannerHandlers(mediaScanner)
		watcherHandler := NewWatcherHandler(watcherService)
		newsHandlers := handlers.NewNewsHandlers(newsService)
		torrentHandler := torrentHandlers.NewTorrentHandler(db, mediaScanner)
		mediaPathsHandler := torrentHandlers.NewMediaPathsHandler(db, mediaScanner)

		// Initialize Redis asset handlers if Redis cache is available
		var redisAssetHandlers *handlers.RedisAssetHandlers
		if redisCache != nil {
			redisAssetHandlers = handlers.NewRedisAssetHandlers(mediaService, thumbnailService, redisCache)
		}

		// Streaming (with automatic ALAC integration and transcoding for MKV/HEVC)
		api.GET("/stream/:id", handlers.StreamMedia(streamService, mediaService, transcodeService))

		// Preview clips serving - Redis-cached for instant loading
		if redisAssetHandlers != nil {
			api.GET("/preview-clips/:id", redisAssetHandlers.GetPreviewCachedWithFallback(mediaService, thumbnailService))
		} else {
			api.GET("/preview-clips/:id", handlers.StreamPreviewClip(streamService, mediaService))
		}

		// Transcode status endpoint
		api.GET("/admin/transcode/status", handlers.GetTranscodeStatus(transcodeService))

		// Additional ALAC Audio endpoints (moved above)

		// Asset serving endpoints - Redis-cached for instant loading with enhanced fallback
		if redisAssetHandlers != nil {
			// Redis-cached asset serving for instant loading
			api.GET("/thumbnails/:id", redisAssetHandlers.GetThumbnailCachedWithFallback(mediaService, thumbnailService))
			api.GET("/previews/:id", redisAssetHandlers.GetPreviewCachedWithFallback(mediaService, thumbnailService))
			api.GET("/posters/:id", redisAssetHandlers.GetPosterCachedWithFallback(mediaService))

			// Alternative asset serving endpoints (Redis-cached)
			api.GET("/assets/thumbnails/:id", redisAssetHandlers.GetThumbnailCachedWithFallback(mediaService, thumbnailService))
			api.GET("/assets/previews/:id", redisAssetHandlers.GetPreviewCachedWithFallback(mediaService, thumbnailService))
			api.GET("/assets/posters/:id", redisAssetHandlers.GetPosterCachedWithFallback(mediaService))
		} else {
			// Fallback to enhanced handlers when Redis is not available
			api.GET("/thumbnails/:id", handlers.GetThumbnailEnhanced(mediaService, thumbnailService))
			api.GET("/previews/:id", handlers.GetPreviewEnhanced(mediaService, thumbnailService))
			api.GET("/posters/:id", handlers.GetPosterWithAutoDownload(mediaService, posterService))

			// Alternative asset serving endpoints (enhanced handlers)
			api.GET("/assets/thumbnails/:id", handlers.GetThumbnailEnhanced(mediaService, thumbnailService))
			api.GET("/assets/previews/:id", handlers.GetPreviewEnhanced(mediaService, thumbnailService))
			api.GET("/assets/posters/:id", handlers.GetPosterWithAutoDownload(mediaService, posterService))
		}

		// Direct static file serving as fallback (for debugging)
		api.Static("/static/thumbnails", "./thumbnails")
		api.Static("/static/previews", "./previews")
		api.Static("/static/posters", "./posters")

		// Thumbnail generation endpoint (always available)
		api.POST("/thumbnails/:id", handlers.GenerateThumbnail(mediaService, thumbnailService))
		
		// Force regeneration endpoints (for settings page)
		api.POST("/admin/thumbnails/:id/regenerate", handlers.RegenerateThumbnail(mediaService, thumbnailService))
		api.POST("/admin/preview-clips/:id/regenerate", handlers.RegeneratePreviewClip(mediaService, thumbnailService))

		// Poster download endpoints (TMDB integration)
		api.POST("/posters/:id", handlers.DownloadPoster(mediaService, posterService))
		api.POST("/admin/posters/generate/:id", handlers.GeneratePoster(mediaService, posterService))
		api.POST("/admin/series/:id/poster", handlers.GenerateSeriesPoster(mediaService, posterService))
		api.POST("/admin/posters/batch", handlers.DownloadPosterBatch(mediaService, posterService))
		api.POST("/admin/posters/regenerate-missing", handlers.RegeneratePostersForMissing(mediaService, posterService))

		// Preview clip generation
		api.POST("/admin/preview-clips/:id/generate", handlers.GeneratePreviewClip(mediaService, thumbnailService))
		api.POST("/admin/preview-clips/:id/generate-optimized", handlers.GenerateOptimizedPreviewClip(mediaService, thumbnailService))

		// Optimized batch processing endpoints
		api.POST("/admin/thumbnails/batch", handlers.GenerateThumbnailBatch(mediaService, thumbnailService))
		api.POST("/admin/preview-clips/batch", handlers.GeneratePreviewClipBatch(mediaService, thumbnailService))
		api.POST("/admin/preview-clips/regenerate-missing", handlers.RegeneratePreviewsForMissing(mediaService, thumbnailService))

		// Thumbnail service monitoring
		api.GET("/admin/thumbnail-service/stats", handlers.GetThumbnailServiceStats(thumbnailService))
		api.GET("/admin/thumbnail-service/jobs/:jobId", handlers.GetJobStatus(thumbnailService))

		// Cache management endpoints
		if redisAssetHandlers != nil {
			// Redis cache management (primary cache system)
			api.POST("/admin/assets/cache/warm", redisAssetHandlers.WarmAssetCache())
			api.POST("/admin/assets/cache/warm-critical", redisAssetHandlers.WarmCriticalAssets())
			api.DELETE("/admin/assets/cache/clear", redisAssetHandlers.ClearAssetCache())
			api.DELETE("/admin/assets/cache/clear-expired", redisAssetHandlers.ClearExpiredAssets())
			api.GET("/admin/assets/cache/stats", redisAssetHandlers.GetCacheStats())
			api.GET("/admin/assets/cache/health", redisAssetHandlers.GetCacheHealth())

			// In-memory cache management (fallback)
			api.DELETE("/admin/assets/cache/clear-memory", handlers.ClearAssetCache())
			api.GET("/admin/assets/cache/stats-memory", handlers.GetAssetCacheStats())
		} else {
			// Fallback cache management when Redis is not available
			api.DELETE("/admin/assets/cache/clear", handlers.ClearAssetCache())
			api.GET("/admin/assets/cache/stats", handlers.GetAssetCacheStats())
		}

		// Subtitles
		api.GET("/subtitles/:id", handlers.GetSubtitles(mediaService))
		api.GET("/subtitles/:id/file", handlers.ServeSubtitleFile(mediaService))
		
		// Enhanced subtitle and audio track endpoints (moved above)
		
		// Subtitle management endpoints
		api.POST("/admin/media/:id/upload-subtitle", handlers.UploadSubtitle(mediaService))
		api.DELETE("/admin/media/:id/subtitles/:trackId", handlers.DeleteSubtitle(mediaService))
		api.POST("/admin/scan/subtitles", scannerHandlers.ScanSubtitles)
		api.GET("/admin/subtitles/unmatched", handlers.GetUnmatchedSubtitles(mediaService))
		api.GET("/admin/subtitles/test/:id", handlers.TestSubtitles(mediaService))

		// OpenSubtitles integration endpoints
		api.GET("/opensubtitles/search", handlers.SearchOpenSubtitles(openSubService))
		api.POST("/admin/media/:id/opensubtitles/download", handlers.DownloadOpenSubtitle(mediaService, openSubService))
		api.GET("/opensubtitles/download", handlers.DownloadOpenSubtitleDirect(openSubService))
		api.GET("/opensubtitles/languages", handlers.GetOpenSubtitlesLanguages(openSubService))

		// ALAC Audio endpoints
		api.GET("/audio/alac/:id", handlers.GetALACAudio(alacService))
		api.POST("/audio/alac/:id/extract", handlers.ExtractALACAudio(alacService, mediaService))
		api.GET("/audio/alac/:id/metadata", handlers.GetALACAudioMetadata(alacService))
		api.POST("/audio/alac/:id/spatial/:layout", handlers.ConvertToSpatialAudio(alacService, mediaService))
		api.GET("/audio/formats", handlers.GetSupportedAudioFormats(alacService))
		api.POST("/admin/alac/cleanup-oversized", handlers.CleanupOversizedAudioFiles(alacService))
		api.GET("/audio/alac/:id/info", handlers.GetAudioFileInfo(alacService))

		// Analytics and Playback
		api.POST("/track-view/:id", handlers.TrackView(mediaService, playbackService))
		api.POST("/playback/progress", handlers.UpdatePlaybackProgress(playbackService))
		api.GET("/playback/progress/:id", handlers.GetPlaybackProgress(playbackService))
		api.POST("/playback/initialize/:id", handlers.InitializePlaybackProgress(playbackService))
		api.GET("/playback/recent", handlers.GetRecentlyWatched(playbackService))
		api.GET("/playback/recently-watched", handlers.GetRecentlyWatched(playbackService))
		api.GET("/playback/continue", handlers.GetContinueWatching(playbackService))
		api.GET("/playback/history", handlers.GetWatchHistory(playbackService))
		api.GET("/playback/stats", handlers.GetWatchStats(playbackService))

		// Recommendation tracking
		api.POST("/recommendations/track-click/:id", handlers.TrackRecommendationClick(recommendationService))

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
		api.POST("/admin/series/:id/update-with-tmdb", handlers.UpdateSeriesWithTMDB(mediaService, tmdbService))
		api.GET("/media/:id/cast-images", handlers.GetCastImages(mediaService, tmdbService))
		api.POST("/admin/generate-recommendations", handlers.GenerateRecommendations(geminiService))

		// Main recommendations endpoint (handles category-based routing)
		api.GET("/recommendations", handlers.GetRecommendations(recommendationService))

		// Enhanced recommendation endpoints with session awareness
		api.GET("/recommendations/unique", handlers.GetUniqueRecommendations(recommendationService, mediaService))
		api.GET("/recommendations/trending", handlers.GetSmartTrendingRecommendationsEnhanced(recommendationService, mediaService))
		api.GET("/recommendations/popular", handlers.GetPopularRecommendations(recommendationService))
		api.GET("/recommendations/recent", handlers.GetRecentRecommendations(recommendationService))
		api.GET("/recommendations/top-rated", handlers.GetHighRatedRecommendations(recommendationService))
		api.GET("/recommendations/genre", handlers.GetGenreRecommendations(recommendationService))
		api.GET("/recommendations/mixed", handlers.GetMixedRecommendationsEnhanced(recommendationService, mediaService))

		// Advanced recommendation endpoints with session awareness
		api.GET("/recommendations/personalized", handlers.GetPersonalizedRecommendationsEnhanced(recommendationService, mediaService))
		api.GET("/recommendations/smart-trending", handlers.GetSmartTrendingRecommendationsEnhanced(recommendationService, mediaService))
		api.GET("/recommendations/similar", handlers.GetSimilarRecommendations(recommendationService))
		api.GET("/recommendations/similar/:id", handlers.GetSimilarMediaByID(recommendationService, mediaService))
		api.GET("/recommendations/continue-watching", handlers.GetContinueWatchingRecommendations(recommendationService))
		api.POST("/admin/recommendations/refresh", handlers.RefreshAllRecommendations(recommendationService))

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
		api.POST("/admin/series/:id/fetch-tmdb", handlers.UpdateSeriesWithTMDB(mediaService, tmdbService))
		
		// Update local media with TMDB backdrop and trailer data
		api.POST("/admin/update-tmdb-data", handlers.UpdateLocalMediaWithTMDB(mediaService, tmdbService))

		// Media scanner endpoints
		api.POST("/admin/scan/full", scannerHandlers.StartFullScan)
		api.POST("/admin/scan/incremental", scannerHandlers.StartIncrementalScan)
		api.POST("/admin/scan/superfast", scannerHandlers.StartSuperfastScan)
		api.POST("/admin/scan/sync", scannerHandlers.StartScanAndSync)
		api.POST("/admin/scan/database-sync", scannerHandlers.StartDatabaseSync)
		api.POST("/admin/scan/cleanup-invalid", scannerHandlers.StartCleanupInvalidEntries)
		api.POST("/admin/scan/regenerate-assets", scannerHandlers.RegenerateAllAssets)
		api.POST("/admin/scan/regenerate-previews", scannerHandlers.RegeneratePreviewClips)
		api.POST("/admin/scan/regenerate-missing-previews", scannerHandlers.RegenerateMissingPreviewClips)
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

		// Now Playing TV Channel endpoints
		api.GET("/now-playing/previews", handlers.GetNowPlayingPreviews())

		// News endpoints for TV channel
		api.GET("/news/latest", newsHandlers.GetLatestNews())
		api.GET("/news/breaking", newsHandlers.GetBreakingNews())
		api.GET("/news/ticker", newsHandlers.GetNewsForTicker())
		api.GET("/news/health", newsHandlers.GetNewsHealth())

		// TMDB upcoming movies endpoint (cached for 24 hours)
		api.GET("/upcoming-movies", handlers.GetUpcomingMovies(tmdbService))
		
		// TMDB TV series endpoint (airing today, on the air, trending)
		api.GET("/upcoming-tv-series", handlers.GetUpcomingTVSeries(tmdbService))
		
		// TMDB movie details endpoint (cached for 6 hours)
		api.GET("/tmdb-movie/:id", handlers.GetTMDBMovieDetails(tmdbService))
		
		// TMDB search endpoints
		api.GET("/tmdb/search", handlers.SearchTMDB(tmdbService))
		api.GET("/tmdb/suggestions", handlers.SearchTMDBSuggestions(tmdbService))
		
		// TMDB related content endpoints
		api.GET("/tmdb/:id/related", handlers.GetRelatedMedia(tmdbService))
		api.GET("/tmdb/movie/:id/similar", handlers.GetSimilarMovies(tmdbService))
		api.GET("/tmdb/movie/:id/recommendations", handlers.GetRecommendedMovies(tmdbService))
		api.GET("/tmdb/tv/:id/similar", handlers.GetSimilarTVShows(tmdbService))
		api.GET("/tmdb/tv/:id/recommendations", handlers.GetRecommendedTVShows(tmdbService))

		// Torrent download endpoints
		api.GET("/torrent/search", torrentHandler.SearchTorrents)
		api.POST("/torrent/download", torrentHandler.StartDownload)
		api.GET("/torrent/downloads", torrentHandler.GetDownloads)
		api.GET("/torrent/downloads/:id", torrentHandler.GetDownload)
		api.POST("/torrent/downloads/:id/pause", torrentHandler.PauseDownload)
		api.POST("/torrent/downloads/:id/resume", torrentHandler.ResumeDownload)
		api.DELETE("/torrent/downloads/:id", torrentHandler.RemoveDownload)
		api.GET("/torrent/config", torrentHandler.GetConfig)
		api.PUT("/torrent/config", torrentHandler.UpdateConfig)
		api.POST("/torrent/test-connection", torrentHandler.TestConnection)

		// Media paths management endpoints
		api.GET("/admin/media-paths", mediaPathsHandler.GetMediaPaths)
		api.POST("/admin/media-paths", mediaPathsHandler.AddMediaPath)
		api.PUT("/admin/media-paths/:id", mediaPathsHandler.UpdateMediaPath)
		api.DELETE("/admin/media-paths/:id", mediaPathsHandler.DeleteMediaPath)

		// System monitoring endpoints
		api.GET("/admin/system/stats", handlers.GetSystemStats())
		api.GET("/admin/system/info", handlers.GetSystemInfo())
		api.GET("/admin/system/logs", handlers.GetServerLogs())
		api.GET("/admin/system/logs/stream", handlers.StreamServerLogs())
		api.GET("/admin/system/stats/stream", handlers.StreamSystemStats())
	}
}
