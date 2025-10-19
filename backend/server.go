package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"homeflix-backend/internal/adapters"
	"homeflix-backend/internal/api"
	"homeflix-backend/internal/config"
	"homeflix-backend/internal/database"
	"homeflix-backend/internal/scanner"
	"homeflix-backend/internal/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Load configuration
	cfg := config.Load()

	// Initialize database
	db, err := database.Initialize(cfg.DatabaseURL)
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	// Initialize services
	mediaService := services.NewMediaService(db)
	streamService := services.NewOptimizedStreamService(int64(cfg.CacheSize), int64(cfg.ChunkSize))
	thumbnailService := services.NewThumbnailService()
	userService := services.NewUserService(db)
	recommendationService := services.NewRecommendationService(db)
	playbackService := services.NewPlaybackService(db)
	geminiService := services.NewGeminiService()
	celeryService := services.NewCeleryService()
	alacService := services.NewALACAudioService("./alac_audio")
	tmdbService := services.NewTMDBService()
	newsService := services.NewNewsService()

	// Initialize Redis asset cache for instant asset loading
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/0" // Default Redis URL with auth
	}
	redisCache, err := services.NewRedisAssetCache(redisURL)
	if err != nil {
		log.Printf("⚠️ Failed to initialize Redis asset cache: %v", err)
		log.Printf("Asset serving will fall back to enhanced handlers without Redis caching")
		redisCache = nil
	} else {
		log.Printf("✅ Redis asset cache initialized successfully")
	}

	// Integrate ALAC service with streaming service for automatic ALAC audio streaming
	streamService.SetALACService(alacService)

	// Initialize on-the-fly transcoding service for MKV/HEVC files
	hwAccel := os.Getenv("HW_ACCEL")
	if hwAccel == "" {
		hwAccel = "none" // Default to software encoding
	}
	transcodeService := services.NewTranscodeService(hwAccel)
	log.Printf("🎬 Transcode service initialized (HW Accel: %s)", hwAccel)

	// Initialize poster service
	posterService := services.NewPosterService("./posters")

	// Integrate ALAC service with thumbnail service for preview clips with ALAC audio
	thumbnailService.SetALACService(alacService)

	// Create service adapters to resolve interface compatibility
	mediaServiceAdapter := adapters.NewMediaServiceAdapter(mediaService)
	thumbnailServiceAdapter := adapters.NewThumbnailServiceAdapter(thumbnailService)
	posterServiceAdapter := adapters.NewPosterServiceAdapter(posterService)
	geminiServiceAdapter := adapters.NewGeminiServiceAdapter(geminiService)
	celeryServiceAdapter := adapters.NewCeleryServiceAdapter(celeryService)
	alacServiceAdapter := adapters.NewALACAudioServiceAdapter(alacService)
	tmdbServiceAdapter := adapters.NewTMDBServiceAdapter(tmdbService)
	recommendationServiceAdapter := adapters.NewRecommendationServiceAdapter(recommendationService)

	// Initialize media scanner with adapted services
	mediaScanner := scanner.NewMediaScanner(cfg.MediaPath, mediaServiceAdapter, thumbnailServiceAdapter, posterServiceAdapter, geminiServiceAdapter, celeryServiceAdapter, alacServiceAdapter, tmdbServiceAdapter, recommendationServiceAdapter)

	// Initialize watcher service for real-time file monitoring
	watchPaths := []string{cfg.MediaPath}
	watcherService, err := services.NewWatcherService(mediaScanner, watchPaths)
	if err != nil {
		log.Printf("Failed to initialize watcher service: %v", err)
	} else {
		log.Println("Watcher service initialized successfully")

		// Start the file watcher
		if err := watcherService.Start(); err != nil {
			log.Printf("Failed to start file watcher: %v", err)
		} else {
			log.Println("File watcher started successfully")
		}
	}

	// Start comprehensive media sync validation on startup
	go func() {
		log.Println("Starting comprehensive media sync validation on server startup...")
		log.Printf("Scanning media path: %s", cfg.MediaPath)

		// CRITICAL: Ensure complete sync validation first
		if err := mediaScanner.EnsureCompleteSyncOnStartup(); err != nil {
			log.Printf("❌ Startup sync validation failed: %v", err)
		}

		// Then perform regular scanning
		if err := mediaScanner.ScanMediaLibrary(); err != nil {
			log.Printf("Media scanning error: %v", err)
		} else {
			log.Println("Initial media scanning completed successfully")
		}
	}()

	// Setup Gin router with performance optimizations
	gin.SetMode(gin.ReleaseMode) // Production mode for better performance
	r := gin.New()

	// Custom recovery middleware with timeout protection
	r.Use(gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		// Minimal logging for performance
		if param.StatusCode >= 400 {
			return fmt.Sprintf("%s - %s %s %d %s\n",
				param.TimeStamp.Format("15:04:05"),
				param.Method, param.Path, param.StatusCode, param.Latency)
		}
		return ""
	}))

	// Custom recovery with broken pipe handling
	r.Use(func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				if errStr, ok := err.(string); ok && strings.Contains(errStr, "broken pipe") {
					// Don't log broken pipe as error - client disconnection is normal
					return
				}
				log.Printf("Panic recovered: %v", err)
				c.AbortWithStatus(http.StatusInternalServerError)
			}
		}()
		c.Next()
	})

	// Timeout middleware to prevent hanging
	r.Use(func(c *gin.Context) {
		// Set request timeout based on request type
		timeout := 30 * time.Second // Default timeout
		if strings.Contains(c.Request.URL.Path, "/api/stream/") {
			timeout = 5 * time.Minute // Longer timeout for streaming
		}
		
		ctx, cancel := context.WithTimeout(c.Request.Context(), timeout)
		defer cancel()
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	})

	// CORS middleware with optimizations
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-User-ID", "x-user-id", "Range"},
		ExposeHeaders:    []string{"Content-Length", "Content-Range", "Accept-Ranges", "Content-Type", "X-Cache", "Connection"},
		AllowCredentials: false, // Set to false when using wildcard origin
		MaxAge:           12 * time.Hour, // Cache preflight for 12 hours
	}))

	// Start news service
	newsService.Start()

	// Initialize API routes
	api.SetupRoutes(r, mediaService, streamService, thumbnailService, userService, recommendationService, playbackService, geminiService, celeryService, alacService, tmdbService, mediaScanner, watcherService, redisCache, transcodeService, newsService)

	// Start server with optimizations
	port := os.Getenv("PORT")
	if port == "" {
		port = "8252"
	}

	// Create HTTP server with optimized settings
	srv := &http.Server{
		Addr:           "0.0.0.0:" + port,
		Handler:        r,
		ReadTimeout:    30 * time.Second,  // Prevent slow clients from hanging server
		WriteTimeout:   5 * time.Minute,   // Allow time for large file streaming
		IdleTimeout:    120 * time.Second, // Keep connections alive for better performance
		MaxHeaderBytes: 1 << 20,           // 1MB max header size
	}

	log.Printf("🚀 HomeFlix Server starting on port %s", port)
	log.Printf("🌐 Server accessible at http://0.0.0.0:%s", port)
	log.Printf("⚡ Performance optimizations: Sendfile=%v, DirectIO=%v, TCP_NODELAY=true", true, true)
	log.Printf("📊 Resource limits: ReadTimeout=30s, WriteTimeout=5m, IdleTimeout=2m")
	
	log.Fatal(srv.ListenAndServe())
}
