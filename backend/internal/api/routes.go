package api

import (
	"context"
	"fmt"
	"homeflix-backend/internal/services/autodl"
	"homeflix-backend/internal/services/buzz"
	"homeflix-backend/internal/services/cloud"
	"homeflix-backend/internal/services/comingsoon"
	"homeflix-backend/internal/services/livetv"
	"log"
	"time"

	"homeflix-backend/internal/api/handlers"
	torrentHandlers "homeflix-backend/internal/handlers"
	"homeflix-backend/internal/models"
	"homeflix-backend/internal/scanner"
	"homeflix-backend/internal/services"

	"gorm.io/gorm"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(r *gin.Engine, mediaService *services.MediaService, streamService *services.OptimizedStreamService, thumbnailService *services.ThumbnailService, userService *services.UserService, recommendationService *services.RecommendationService, playbackService *services.PlaybackService, geminiService *services.GeminiService, celeryService *services.CeleryService, alacService *services.ALACAudioService, tmdbService *services.TMDBService, mediaScanner *scanner.MediaScanner, watcherService *services.WatcherService, redisCache *services.RedisAssetCache, transcodeService *services.TranscodeService, newsService *services.NewsService, posterService *services.PosterService, openSubService *services.OpenSubtitlesService, notificationService *services.NotificationService, streamProfileService *services.StreamProfileService, hlsService *services.HLSService, searchService *services.SearchService, db *gorm.DB) {
	// Initialize API handler
	apiHandler := NewHandler(db)

	api := r.Group("/api")
	{
		// Health check
		api.GET("/health", apiHandler.HealthCheckHandler)

		// Media routes
		api.GET("/media", handlers.GetAllMedia(mediaService))
		api.GET("/media/movies", handlers.GetMovies(mediaService))
		api.GET("/media/tv-shows", handlers.GetTVShows(mediaService))
		api.GET("/media/genre/:genre", handlers.GetMediaByGenre(mediaService))
		api.GET("/media/search", handlers.SearchMedia(mediaService, searchService))
		api.GET("/media/:id/next-episode", handlers.GetNextEpisode(mediaService))
		api.GET("/media/counts", handlers.GetLibraryCounts(db))
		api.GET("/community", handlers.GetCommunity())

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
		api.GET("/series/:id/logo", handlers.GetSeriesLogo(mediaService, tmdbService))
		api.GET("/series/:id/backdrop", handlers.GetSeriesBackdrop(mediaService, tmdbService))
		api.GET("/series/:id/cast-images", handlers.GetSeriesCastImages(mediaService, tmdbService))

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
		mediaPathsHandler := torrentHandlers.NewMediaPathsHandler(db, mediaScanner)

		// Initialize widget service and handler
		widgetService := services.NewWidgetService(db, mediaService, tmdbService, notificationService, playbackService)
		widgetService.InitializeWidgets() // Run migration and seeding
		widgetHandler := handlers.NewWidgetHandler(widgetService, mediaService, tmdbService)

		// Initialize dynamic pages service/handler
		pageService := services.NewPageService(db)
		_ = pageService.Migrate()
		pageHandler := handlers.NewPageHandler(pageService)
		// Seed a sample page if none exists
		if pages, err := pageService.GetAllPages(); err == nil && len(pages) == 0 {
			pageService.Create(&models.Page{
				Slug:         "discover",
				Title:        "Discover",
				Description:  "Dynamic discovery page",
				IsNavVisible: true,
			})
		}

		// Initialize collection service and handler
		collectionService := services.NewCollectionService(db)
		collectionHandler := handlers.NewCollectionHandlers(collectionService)

		// Initialize Redis asset handlers if Redis cache is available
		var redisAssetHandlers *handlers.RedisAssetHandlers
		if redisCache != nil {
			redisAssetHandlers = handlers.NewRedisAssetHandlers(mediaService, thumbnailService, redisCache)
		}

		// Streaming (with automatic ALAC integration and transcoding for MKV/HEVC)
		api.GET("/stream/:id", handlers.StreamMedia(streamService, mediaService, transcodeService, streamProfileService))

		// Playback decision + HLS delivery (DB-driven, no per-request ffprobe)
		api.GET("/stream/:id/info", handlers.GetStreamInfo(streamProfileService, hlsService, mediaService))
		api.GET("/stream/:id/hls/index.m3u8", handlers.GetHLSPlaylist(streamProfileService, hlsService, mediaService))
		api.GET("/stream/:id/hls/:segment", handlers.GetHLSSegment(streamProfileService, hlsService, mediaService))
		api.DELETE("/stream/:id/hls", handlers.ReleaseHLSSession(hlsService))
		api.POST("/stream/:id/hls/release", handlers.ReleaseHLSSession(hlsService))
		api.POST("/admin/stream-profiles/backfill", handlers.BackfillStreamProfiles(streamProfileService))

		// Preview clips: served from disk; missing ones are made at hover priority
		previewEngine := thumbnailService.PreviewEngine()
		if previewEngine != nil {
			api.GET("/preview-clips/:id", handlers.ServePreviewClip(previewEngine))
			api.GET("/admin/storage/assets", handlers.GetAssetStorage(previewEngine))
			api.PUT("/admin/storage/assets/settings", handlers.UpdateAssetStorageSettings(previewEngine))
			api.POST("/admin/storage/assets/cleanup", handlers.CleanupAssetStorage(previewEngine))
			api.POST("/admin/storage/assets/generate-missing", handlers.GenerateMissingPreviews(previewEngine))
		} else if redisAssetHandlers != nil {
			api.GET("/preview-clips/:id", redisAssetHandlers.GetPreviewCachedWithFallback(mediaService, thumbnailService))
		} else {
			api.GET("/preview-clips/:id", handlers.StreamPreviewClip(streamService, mediaService))
		}

		// Transcode status endpoint
		api.GET("/admin/transcode/status", handlers.GetTranscodeStatus(transcodeService))

		// Additional ALAC Audio endpoints (moved above)

		previewRoute := func(fallback gin.HandlerFunc) gin.HandlerFunc {
			if previewEngine != nil {
				return handlers.ServePreviewClip(previewEngine)
			}
			return fallback
		}
		// Asset serving endpoints - Redis-cached for instant loading with enhanced fallback
		if redisAssetHandlers != nil {
			// Redis-cached asset serving for instant loading
			api.GET("/thumbnails/:id", redisAssetHandlers.GetThumbnailCachedWithFallback(mediaService, thumbnailService))
			api.GET("/previews/:id", previewRoute(redisAssetHandlers.GetPreviewCachedWithFallback(mediaService, thumbnailService)))
			api.GET("/posters/:id", redisAssetHandlers.GetPosterCachedWithFallback(mediaService))
			api.GET("/backdrops/:id", handlers.GetBackdropWithAutoDownload(mediaService, tmdbService))

			// Alternative asset serving endpoints (Redis-cached)
			api.GET("/assets/thumbnails/:id", redisAssetHandlers.GetThumbnailCachedWithFallback(mediaService, thumbnailService))
			api.GET("/assets/previews/:id", previewRoute(redisAssetHandlers.GetPreviewCachedWithFallback(mediaService, thumbnailService)))
			api.GET("/assets/posters/:id", redisAssetHandlers.GetPosterCachedWithFallback(mediaService))
			api.GET("/assets/backdrops/:id", handlers.GetBackdropWithAutoDownload(mediaService, tmdbService))
		} else {
			// Fallback to enhanced handlers when Redis is not available
			api.GET("/thumbnails/:id", handlers.GetThumbnailEnhanced(mediaService, thumbnailService))
			api.GET("/previews/:id", previewRoute(handlers.GetPreviewEnhanced(mediaService, thumbnailService)))
			api.GET("/posters/:id", handlers.GetPosterWithAutoDownload(mediaService, posterService))
			api.GET("/backdrops/:id", handlers.GetBackdropWithAutoDownload(mediaService, tmdbService))

			// Alternative asset serving endpoints (enhanced handlers)
			api.GET("/assets/thumbnails/:id", handlers.GetThumbnailEnhanced(mediaService, thumbnailService))
			api.GET("/assets/previews/:id", previewRoute(handlers.GetPreviewEnhanced(mediaService, thumbnailService)))
			api.GET("/assets/posters/:id", handlers.GetPosterWithAutoDownload(mediaService, posterService))
			api.GET("/assets/backdrops/:id", handlers.GetBackdropWithAutoDownload(mediaService, tmdbService))
		}

		// Direct static file serving as fallback (for debugging)
		api.Static("/static/thumbnails", "./thumbnails")
		api.Static("/static/previews", "./previews")
		api.Static("/static/posters", "./posters")
		api.Static("/static/backdrops", "./backdrops")    // Serve backdrop files
		api.Static("/logos", "./logos")                   // Serve logo files
		api.Static("/episode_stills", "./episode_stills") // Serve episode still files

		// Episode still serving endpoint with auto-download
		api.GET("/episode-stills/:id", handlers.GetEpisodeStillWithAutoDownload(mediaService, tmdbService))
		api.GET("/assets/episode-stills/:id", handlers.GetEpisodeStillWithAutoDownload(mediaService, tmdbService))

		// Logo scan endpoint
		api.POST("/admin/scan/logos", handlers.ScanMovieLogos(mediaService, tmdbService))

		// Backdrop scan endpoint
		api.POST("/admin/scan/backdrops", handlers.ScanMovieBackdrops(mediaService, tmdbService))

		// Backdrop URL migration endpoint
		api.POST("/admin/migrate/backdrop-urls", handlers.MigrateBackdropURLs(mediaService))

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
		api.GET("/opensubtitles/search-standalone", handlers.SearchOpenSubtitlesStandalone(openSubService))
		api.POST("/admin/media/:id/opensubtitles/download", handlers.DownloadOpenSubtitle(mediaService, openSubService))
		api.GET("/opensubtitles/download", handlers.DownloadOpenSubtitleDirect(openSubService))
		api.GET("/opensubtitles/languages", handlers.GetOpenSubtitlesLanguages(openSubService))

		// Initialize subtitle management services
		subtitleCleanupService := services.NewSubtitleCleanupService(mediaService)
		subtitleMatcherService := services.NewSubtitleMatcherService(openSubService, mediaService)

		// Subtitle management endpoints (cleanup and auto-download)
		api.GET("/subtitles/stats", handlers.GetSubtitleStats(subtitleCleanupService))
		api.GET("/subtitles/media-without-subs", handlers.GetMediaWithoutSubtitles(mediaService))
		api.POST("/subtitles/cleanup/all", handlers.CleanupAllSubtitles(subtitleCleanupService))
		api.POST("/subtitles/cleanup/:id", handlers.CleanupMediaSubtitles(subtitleCleanupService, mediaService))
		api.POST("/subtitles/download/:id", handlers.DownloadSubtitleForMedia(subtitleMatcherService, mediaService))
		api.POST("/subtitles/download/all", handlers.DownloadSubtitlesForAll(subtitleMatcherService, mediaService))
		api.POST("/subtitles/download/missing", handlers.DownloadSubtitlesForMissing(subtitleMatcherService, mediaService))
		api.POST("/subtitles/cleanup-and-download", handlers.CleanupAndDownloadSubtitles(subtitleCleanupService, subtitleMatcherService, mediaService))

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
		api.GET("/recommendations/score/:id", handlers.GetRecommendationScoreForMedia(recommendationService, db))

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
		api.POST("/admin/series/:id/fetch-episode-metadata", handlers.FetchSeriesEpisodeMetadata(mediaService, tmdbService))
		api.POST("/admin/episodes/:id/update-with-tmdb", handlers.UpdateEpisodeWithTMDB(mediaService, tmdbService))
		api.POST("/admin/seasons/:seriesId/:seasonNumber/update-with-tmdb", handlers.UpdateSeasonWithTMDB(mediaService, tmdbService))
		api.GET("/media/:id/cast-images", handlers.GetCastImages(mediaService, tmdbService))
		api.POST("/admin/generate-recommendations", handlers.GenerateRecommendations(geminiService))

		// Cast to the HomeFlix TV app (see docs/TV_CAST_PROTOCOL.md)
		castHub := services.NewCastHub()
		api.GET("/cast/tv/ws", handlers.CastTVSocket(castHub))
		api.GET("/cast/devices", handlers.ListCastDevices(castHub))
		api.GET("/cast/devices/:id/status", handlers.GetCastDeviceStatus(castHub))
		api.GET("/cast/devices/:id/events", handlers.CastDeviceEvents(castHub))
		api.POST("/cast/devices/:id/command", handlers.SendCastCommand(castHub))

		// TV app self-updates (see docs/TV_APP_UPDATES.md): drop an APK into
		// ./app-updates/tv (or upload it); TVs are told over the cast socket.
		tvUpdates := services.NewTVAppUpdates()
		tvUpdates.OnNewRelease = func(rel *services.TVAppRelease) {
			n := castHub.Broadcast(map[string]interface{}{
				"type": "update_available", "version_code": rel.VersionCode, "version_name": rel.VersionName,
			})
			log.Printf("📦 TV update %s announced to %d TV(s)", rel.VersionName, n)
			notificationService.AddEvent(services.EventNotification{Event: "tvapp_published", Title: "TV app " + rel.VersionName + " published",
				Message: fmt.Sprintf("Your TVs are updating (%d connected).", n), Link: "/settings?tab=updates"})
		}
		go tvUpdates.Watch(context.Background(), time.Minute)
		api.GET("/app/tv/latest", handlers.GetTVAppLatest(tvUpdates))
		api.GET("/app/tv/download/:code", handlers.DownloadTVApp(tvUpdates))
		api.HEAD("/app/tv/download/:code", handlers.DownloadTVApp(tvUpdates))
		api.POST("/admin/app/tv/upload", handlers.UploadTVApp(tvUpdates))
		api.POST("/admin/app/tv/rescan", handlers.RescanTVApp(tvUpdates))
		// Pull new builds straight from the TV app's GitHub repo
		tvAppSource := services.NewTVAppSource()
		api.GET("/admin/app/tv/source", handlers.TVAppSourceStatus(tvUpdates, tvAppSource))
		api.POST("/admin/app/tv/fetch", handlers.FetchTVAppFromSource(tvUpdates, tvAppSource))
		startEventWatchers(context.Background(), db, notificationService, tvAppSource, tvUpdates)
		api.GET("/notifications/settings", handlers.GetNotificationPrefs())
		api.PUT("/notifications/settings", handlers.UpdateNotificationPrefs())

		// Cloud drives via rclone (mounted as library folders, offload target)
		cloudSvc := cloud.NewService(db)
		cloudSvc.Notify = func(title, message string) {
			notificationService.AddEvent(services.EventNotification{Event: "low_storage", Title: title, Message: message, Link: "/settings?tab=storage"})
		}
		go cloudSvc.Run(context.Background())
		api.GET("/admin/cloud", handlers.GetCloud(cloudSvc))
		api.POST("/admin/cloud/remotes", handlers.CreateCloudRemote(cloudSvc))
		api.DELETE("/admin/cloud/remotes/:name", handlers.DeleteCloudRemote(cloudSvc))
		api.POST("/admin/cloud/mounts", handlers.AddCloudMount(cloudSvc))
		api.PATCH("/admin/cloud/mounts/:remote", handlers.UpdateCloudMount(cloudSvc))
		api.DELETE("/admin/cloud/mounts/:remote", handlers.DeleteCloudMount(cloudSvc))
		api.PUT("/admin/cloud/settings", handlers.UpdateCloudSettings(cloudSvc))
		api.POST("/admin/cloud/offload", handlers.RunCloudOffload(cloudSvc))

		// Live TV from public free-to-air listings (see docs/LIVE_TV.md)
		liveTV := livetv.NewService()
		go liveTV.Run(context.Background())
		api.GET("/livetv/channels", handlers.ListLiveTVChannels(liveTV))
		api.GET("/livetv/channels/:id/play", handlers.PlayLiveTVChannel(liveTV))
		api.GET("/livetv/favorites", handlers.LiveTVFavorites(liveTV))
		api.POST("/livetv/favorites", handlers.MergeLiveTVFavorites(liveTV))
		api.PUT("/livetv/favorites/:id", handlers.AddLiveTVFavorite(liveTV))
		api.DELETE("/livetv/favorites/:id", handlers.RemoveLiveTVFavorite(liveTV))
		api.GET("/livetv/p/*path", handlers.LiveTVProxy(liveTV))
		api.GET("/admin/livetv", handlers.GetLiveTVAdmin(liveTV))
		api.PUT("/admin/livetv/settings", handlers.UpdateLiveTVSettings(liveTV))
		api.POST("/admin/livetv/refresh", handlers.RefreshLiveTV(liveTV))
		api.POST("/admin/livetv/check", handlers.CheckLiveTV(liveTV))

		// Personalised recommendations learned from watch history
		tasteService := services.NewTasteService(db)
		// Entertainment news + videos personalised with the taste profile
		buzzService := buzz.NewService()
		go buzzService.Run(context.Background())
		api.GET("/buzz", handlers.GetBuzz(buzzService, tasteService))
		api.GET("/buzz/stream", handlers.BuzzStream(buzzService))
		api.GET("/buzz/settings", handlers.GetBuzzSettings(buzzService))
		api.PUT("/buzz/settings", handlers.UpdateBuzzSettings(buzzService))
		api.GET("/admin/buzz/health", handlers.BuzzHealth(buzzService))
		api.POST("/admin/buzz/refresh", handlers.RefreshBuzz(buzzService))
		api.GET("/recommendations/for-you", handlers.GetForYouRecommendations(tasteService))
		api.GET("/recommendations/more-like/:kind/:id", handlers.GetMoreLikeThis(tasteService))
		// Top 10 charts from real plays (kind = movie | series | all).
		api.GET("/charts/top10", handlers.GetTop10Chart(tasteService))
		// Thumbs ratings (kind = movie | series) that steer the recommendations above.
		api.GET("/ratings", handlers.ListTasteRatings(tasteService))
		api.GET("/ratings/:kind/:id", handlers.GetTasteRating(tasteService))
		api.PUT("/ratings/:kind/:id", handlers.PutTasteRating(tasteService))
		api.POST("/ratings/:kind/:id", handlers.PutTasteRating(tasteService))
		api.DELETE("/ratings/:kind/:id", handlers.DeleteTasteRating(tasteService))

		// Main recommendations endpoint (handles category-based routing)
		api.GET("/recommendations", handlers.GetRecommendations(recommendationService))

		// Enhanced recommendation endpoints with session awareness
		api.GET("/recommendations/unique", handlers.GetUniqueRecommendations(recommendationService, mediaService))
		api.GET("/recommendations/trending", handlers.GetSmartTrendingRecommendationsEnhanced(recommendationService, mediaService))
		api.GET("/recommendations/popular", handlers.GetPopularRecommendations(recommendationService))
		api.GET("/recommendations/recent", handlers.GetRecentRecommendations(recommendationService))
		api.GET("/recommendations/top-rated", handlers.GetHighRatedRecommendations(recommendationService))
		api.GET("/recommendations/genre", handlers.GetGenreRecommendations(recommendationService))
		api.GET("/recommendations/scifi", handlers.GetSciFiRecommendations(recommendationService))
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
		// Settings > Scanner: live run, history, activity (the scanner's log
		// lines) and a library health analysis
		api.GET("/admin/scanner/status", handlers.ScannerStatus(mediaScanner, watcherService))
		api.GET("/admin/scanner/events", handlers.ScannerEvents())
		api.GET("/admin/scanner/stream", handlers.ScannerStream())
		api.GET("/admin/scanner/analysis", handlers.ScannerAnalysis(db))
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
		api.GET("/now-playing/previews", handlers.GetNowPlayingPreviews(mediaService))

		// News endpoints for TV channel
		api.GET("/news/latest", newsHandlers.GetLatestNews())
		api.GET("/news/breaking", newsHandlers.GetBreakingNews())
		api.GET("/news/ticker", newsHandlers.GetNewsForTicker())
		api.GET("/news/health", newsHandlers.GetNewsHealth())

		// TMDB upcoming movies endpoint (cached for 24 hours)
		api.GET("/upcoming-movies", handlers.GetUpcomingMovies(tmdbService))

		// TMDB TV series endpoint (airing today, on the air, trending)
		api.GET("/upcoming-tv-series", handlers.GetUpcomingTVSeries(tmdbService))

		// New TMDB movie list endpoints
		api.GET("/tmdb/movie/latest", handlers.GetLatestMovie(tmdbService))
		api.GET("/tmdb/movie/now-playing", handlers.GetNowPlayingMoviesList(tmdbService))
		api.GET("/tmdb/movie/upcoming", handlers.GetUpcomingMoviesList(tmdbService))
		api.GET("/tmdb/movie/popular", handlers.GetPopularMoviesList(tmdbService))
		api.GET("/tmdb/shelf/:name", handlers.GetTMDBShelf(tmdbService, db))
		api.GET("/tmdb/trailer/:type/:id", handlers.GetTMDBTrailer(tmdbService))
		api.GET("/tmdb/discover/movie", handlers.DiscoverMoviesByFilters(tmdbService))
		api.GET("/tmdb/movie/:id/images", handlers.GetMovieImagesList(tmdbService))

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

		// Initialize provider service
		providerService := services.NewProviderService()

		// Streaming provider endpoints (Netflix, Prime, Disney+, Hulu, etc.)
		api.GET("/providers", handlers.GetAllProviders(providerService))
		api.GET("/providers/showcase", handlers.GetProviderShowcase(providerService, redisCache))
		api.GET("/providers/:id", handlers.GetProviderByID(providerService))
		api.GET("/providers/:id/content", handlers.GetProviderContent(providerService))
		api.GET("/providers/:id/movies", handlers.GetProviderMovies(providerService))
		api.GET("/providers/:id/tv", handlers.GetProviderTV(providerService))
		api.GET("/providers/:id/trending", handlers.GetProviderTrending(providerService))
		api.GET("/providers/:id/popular", handlers.GetProviderPopular(providerService))
		api.GET("/providers/:id/top-rated", handlers.GetProviderTopRated(providerService))
		api.GET("/providers/:id/new", handlers.GetProviderNewReleases(providerService))
		api.GET("/content/:type/:id/providers", handlers.GetContentProviders(providerService))

		var torrentHandler *torrentHandlers.TorrentHandler
		if notificationService != nil {
			// Initialize torrent handler with notification service
			torrentHandler = torrentHandlers.NewTorrentHandler(db, mediaScanner, notificationService)
		} else {
			// Initialize torrent handler without notification service
			torrentHandler = torrentHandlers.NewTorrentHandler(db, mediaScanner, nil)
		}

		// Torrent download endpoints
		// Auto Download: titles added to the download list are fetched in the
		// background with the quality profile from Settings > Auto Download.
		autoDL := autodl.NewService(db, torrentHandler, func(kind, title, message string, tmdbID int, mediaType string) {
			notificationService.AddEvent(services.EventNotification{Event: "download_" + kind, Title: title, Message: message,
				Link: "/my-list?tab=downloads", TMDBID: tmdbID, MediaType: mediaType})
		})
		if tmdbService != nil {
			autoDL.SetReleases(services.AutoDownloadReleases{TMDB: tmdbService})
		}
		go autoDL.Run(context.Background())
		api.POST("/autodownload/:id/schedule", handlers.ScheduleAutoDownload(autoDL))
		api.DELETE("/autodownload/follows/:tmdb_id", handlers.UnfollowShow(autoDL))
		api.GET("/autodownload", handlers.ListAutoDownloads(autoDL))
		api.POST("/autodownload", handlers.AddAutoDownload(autoDL))
		api.DELETE("/autodownload/:id", handlers.RemoveAutoDownload(autoDL))
		api.POST("/autodownload/:id/retry", handlers.RetryAutoDownload(autoDL))
		api.POST("/autodownload/run", handlers.RunAutoDownloads(autoDL))

		// Coming Soon: the 10 most anticipated upcoming movies and series, with
		// trailers downloaded for smooth playback (docs/COMING_SOON.md).
		if tmdbService != nil {
			comingSoon := comingsoon.New(tmdbService)
			// Never feature what the library already has (movie, new series,
			// or that new season).
			comingSoon.InLibrary = func(mediaType string, tmdbID, season int) bool {
				var n int64
				if mediaType == "movie" {
					db.Model(&models.Media{}).Where("type = ? AND tmdb_id = ?", "movie", tmdbID).Count(&n)
					return n > 0
				}
				var series models.Series
				if db.Select("id").Where("tmdb_id = ?", tmdbID).First(&series).Error != nil {
					return false
				}
				if season <= 1 {
					return true
				}
				db.Model(&models.Media{}).Where("series_id = ? AND season_number = ?", series.ID, season).Count(&n)
				return n > 0
			}
			go comingSoon.Run(context.Background())
			api.GET("/comingsoon", handlers.GetComingSoon(comingSoon, autoDL))
			api.GET("/comingsoon/video/:name", handlers.ComingSoonVideo(comingSoon))
			api.GET("/comingsoon/title/:type/:id", handlers.GetComingSoonTitle(comingSoon, autoDL))
			api.HEAD("/comingsoon/video/:name", handlers.ComingSoonVideo(comingSoon))
			api.POST("/comingsoon/notify", handlers.NotifyComingSoon(comingSoon, autoDL))
			api.DELETE("/comingsoon/notify/:type/:id", handlers.UnnotifyComingSoon(autoDL))
			api.GET("/admin/comingsoon", handlers.ComingSoonAdmin(comingSoon))
			api.POST("/admin/comingsoon/refresh", handlers.RefreshComingSoon(comingSoon))
			api.PUT("/admin/comingsoon/settings", handlers.UpdateComingSoonSettings(comingSoon))
			api.POST("/admin/comingsoon/ytdlp", handlers.UpdateComingSoonTool(comingSoon))
		}
		api.GET("/autodownload/settings", handlers.GetAutoDownloadSettings(autoDL))
		api.PUT("/autodownload/settings", handlers.UpdateAutoDownloadSettings(autoDL))

		api.GET("/torrents/search", torrentHandler.SearchTorrents)
		api.GET("/torrents/files/preview", torrentHandler.PreviewTorrentFiles)
		api.POST("/torrents/download", torrentHandler.StartDownload)
		api.GET("/torrents/downloads", torrentHandler.GetDownloads)
		api.GET("/torrents/downloads/:id", torrentHandler.GetDownload)
		api.POST("/torrents/downloads/:id/pause", torrentHandler.PauseDownload)
		api.POST("/torrents/downloads/:id/resume", torrentHandler.ResumeDownload)
		api.DELETE("/torrents/downloads/:id", torrentHandler.RemoveDownload)
		api.GET("/torrents/config", torrentHandler.GetConfig)
		api.PUT("/torrents/config", torrentHandler.UpdateConfig)
		api.POST("/torrents/test-connection", torrentHandler.TestConnection)
		api.GET("/torrents/bandwidth-stats", torrentHandler.GetBandwidthStats)
		api.GET("/torrents/database-stats", torrentHandler.GetDatabaseStats) // Diagnostic endpoint

		// Media paths management endpoints
		api.GET("/admin/media-paths", mediaPathsHandler.GetMediaPaths)
		api.POST("/admin/media-paths", mediaPathsHandler.AddMediaPath)
		api.PUT("/admin/media-paths/:id", mediaPathsHandler.UpdateMediaPath)
		api.DELETE("/admin/media-paths/:id", mediaPathsHandler.DeleteMediaPath)

		// Storage monitoring endpoints (auto-failover, low-storage alerts)
		api.GET("/admin/storage/stats", handlers.GetStorageStats(db))

		// System monitoring endpoints
		api.GET("/admin/system/stats", handlers.GetSystemStats())
		api.GET("/admin/system/governor", handlers.GetGovernorStatus())
		api.PUT("/admin/system/governor", handlers.UpdateGovernor())
		api.GET("/admin/system/info", handlers.GetSystemInfo())

		// Safe self-update endpoints (Settings > System Update)
		// Finish an update whose job was killed by the service restart.
		handlers.FinalizeUpdateAfterRestart()
		api.GET("/admin/update/check", handlers.CheckUpdate())
		api.POST("/admin/update/apply", handlers.ApplyUpdate())
		api.GET("/admin/update/status", handlers.UpdateStatus())
		api.GET("/admin/system/logs", handlers.GetServerLogs())
		api.GET("/admin/system/logs/stream", handlers.StreamServerLogs())
		api.GET("/admin/system/stats/stream", handlers.StreamSystemStats())
		api.GET("/admin/system/terminal", handlers.GetTerminalOutput())
		api.GET("/admin/system/terminal/stream", handlers.StreamTerminalOutput())

		// Terminal command execution endpoints
		api.POST("/admin/system/command", handlers.ExecuteCommand())
		api.GET("/admin/system/command/stream", handlers.StreamCommandExecution())
		api.POST("/admin/system/command/auth", handlers.AuthenticateTerminal())

		// Server control endpoints
		api.GET("/admin/server/status", handlers.GetServerStatus())
		api.POST("/admin/server/production/start", handlers.StartProductionServer())
		api.POST("/admin/server/production/stop", handlers.StopProductionServer())
		api.POST("/admin/server/production/restart", handlers.RestartProductionServer())
		api.POST("/admin/server/dev/start", handlers.StartDevServer())
		api.POST("/admin/server/dev/stop", handlers.StopDevServer())
		api.POST("/admin/server/dev/restart", handlers.RestartDevServer())

		// Build endpoints
		api.POST("/admin/build/backend", handlers.BuildBackend())
		api.POST("/admin/build/frontend", handlers.BuildFrontend())
		api.GET("/admin/build/backend/stream", handlers.StreamBuildBackend())
		api.GET("/admin/build/frontend/stream", handlers.StreamBuildFrontend())

		// Widget management endpoints
		api.GET("/widgets", widgetHandler.GetAllWidgets)
		api.GET("/widgets/status", widgetHandler.GetWidgetStatus)
		api.GET("/widgets/meta", widgetHandler.GetWidgetMeta)
		api.GET("/widgets/types", widgetHandler.GetWidgetTypes)
		api.GET("/widgets/pages", widgetHandler.GetWidgetPages)
		api.GET("/widgets/layouts", widgetHandler.GetWidgetLayouts)
		api.GET("/widgets/data-sources", widgetHandler.GetWidgetDataSources)
		api.GET("/widgets/content-types", widgetHandler.GetWidgetContentTypes)
		api.GET("/widgets/languages", widgetHandler.GetWidgetLanguages)
		api.GET("/widgets/countries", widgetHandler.GetWidgetCountries)
		api.GET("/widgets/page/:page", widgetHandler.GetWidgetsByPage)
		api.GET("/widgets/page/:page/with-data", widgetHandler.GetWidgetsWithDataByPage)
		api.GET("/widgets/:id", widgetHandler.GetWidgetByID)
		api.POST("/widgets", widgetHandler.CreateWidget)
		api.PUT("/widgets/:id", widgetHandler.UpdateWidget)
		api.DELETE("/widgets/:id", widgetHandler.DeleteWidget)
		api.POST("/widgets/reorder", widgetHandler.ReorderWidgets)
		api.PUT("/widgets/:id/toggle", widgetHandler.ToggleWidget)
		api.POST("/widgets/:id/duplicate", widgetHandler.DuplicateWidget)
		api.DELETE("/widgets/cache/clear", widgetHandler.ClearCache) // Add cache clearing endpoint

		// Dynamic pages endpoints
		api.GET("/pages", pageHandler.List)
		api.GET("/pages/nav", pageHandler.Nav)
		api.GET("/pages/home", pageHandler.GetHomePage)
		api.GET("/pages/:slug", pageHandler.Get)
		api.POST("/pages", pageHandler.Create)
		api.PUT("/pages/:slug", pageHandler.Update)
		api.DELETE("/pages/:slug", pageHandler.Delete)

		// TMDB genre endpoints for widget configuration
		api.GET("/tmdb/genres/movie", widgetHandler.GetTMDBGenres)
		api.GET("/tmdb/genres/tv", widgetHandler.GetTMDBGenres)

		// Collection management endpoints
		api.GET("/collections", collectionHandler.GetUserCollections)
		api.GET("/collections/public", collectionHandler.GetPublicCollections)
		api.GET("/collections/search", collectionHandler.SearchCollections)
		api.GET("/collections/:id", collectionHandler.GetCollection)
		api.GET("/collections/:id/items", collectionHandler.GetCollectionItems)
		api.GET("/collections/:id/stats", collectionHandler.GetCollectionStats)
		api.GET("/collections/:id/export", collectionHandler.ExportCollection)
		api.POST("/collections", collectionHandler.CreateCollection)
		api.POST("/collections/import", collectionHandler.ImportCollection)
		api.POST("/collections/:id/items", collectionHandler.AddItemToCollection)
		api.POST("/collections/:id/items/bulk", collectionHandler.AddMultipleItemsToCollection)
		api.PUT("/collections/:id", collectionHandler.UpdateCollection)
		api.DELETE("/collections/:id", collectionHandler.DeleteCollection)
		api.DELETE("/collections/:id/items/:mediaId", collectionHandler.RemoveItemFromCollection)

		// My List endpoints (enhanced)
		api.GET("/mylist", collectionHandler.GetMyList)
		api.GET("/mylist/check/:id", collectionHandler.CheckMyList)
		api.POST("/mylist/:id", collectionHandler.AddToMyList)
		api.DELETE("/mylist/:id", collectionHandler.RemoveFromMyList)

		// Notification endpoints
		api.GET("/notifications", handlers.GetNotifications(notificationService))
		api.GET("/notifications/count", handlers.GetNotificationCount(notificationService))
		api.POST("/notifications/:id/read", handlers.MarkNotificationAsRead(notificationService))
	}
}
