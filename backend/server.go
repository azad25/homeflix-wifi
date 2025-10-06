package main

import (
	"log"
	"os"

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
	streamService := services.NewOptimizedStreamService(cfg.CacheSize, cfg.ChunkSize)
	thumbnailService := services.NewThumbnailService()
	userService := services.NewUserService(db)
	recommendationService := services.NewRecommendationService(db)
	playbackService := services.NewPlaybackService(db)
	geminiService := services.NewGeminiService()
	celeryService := services.NewCeleryService()
	alacService := services.NewALACAudioService("./alac_audio")
	tmdbService := services.NewTMDBService()

	// Integrate ALAC service with streaming service for automatic ALAC audio streaming
	streamService.SetALACService(alacService)

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
	mediaScanner := scanner.NewMediaScanner(mediaServiceAdapter, thumbnailServiceAdapter, posterServiceAdapter, geminiServiceAdapter, celeryServiceAdapter, alacServiceAdapter, tmdbServiceAdapter, recommendationServiceAdapter, cfg.MediaPath)

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

	// Start background media scanning
	go func() {
		log.Println("Starting initial media scanner...")
		log.Printf("Scanning media path: %s", cfg.MediaPath)
		if err := mediaScanner.ScanMediaLibrary(); err != nil {
			log.Printf("Media scanning error: %v", err)
		} else {
			log.Println("Initial media scanning completed successfully")
		}
	}()

	// Setup Gin router
	r := gin.Default()

	// CORS middleware
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-User-ID", "x-user-id", "Range"},
		ExposeHeaders:    []string{"Content-Length", "Content-Range", "Accept-Ranges", "Content-Type"},
		AllowCredentials: false, // Set to false when using wildcard origin
	}))

	// Initialize API routes
	api.SetupRoutes(r, mediaService, streamService, thumbnailService, userService, recommendationService, playbackService, geminiService, celeryService, alacService, tmdbService, mediaScanner, watcherService)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8252"
	}

	log.Printf("Server starting on port %s", port)
	log.Printf("Server accessible at http://0.0.0.0:%s", port)
	log.Fatal(r.Run("0.0.0.0:" + port))
}
