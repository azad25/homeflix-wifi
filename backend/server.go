package main

import (
	"log"
	"os"
	"time"

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
	recommendationService := services.NewRecommendationService(db, mediaService)
	playbackService := services.NewPlaybackService(db)
	geminiService := services.NewGeminiService()
	celeryService := services.NewCeleryService()
	alacService := services.NewALACAudioService("./alac_audio")

	// Initialize poster service
	posterService := services.NewPosterService("./posters")
	
	// Initialize media scanner
	mediaScanner := scanner.NewMediaScanner(mediaService, thumbnailService, posterService, geminiService, celeryService, cfg.MediaPath)

	// Start continuous background media scanning
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Media scanner panic recovered: %v", r)
			}
		}()
		
		log.Println("Starting continuous media scanner...")
		log.Printf("Scanning media path: %s", cfg.MediaPath)
		
		// Check if media path exists and is accessible
		if _, err := os.Stat(cfg.MediaPath); os.IsNotExist(err) {
			log.Printf("Media path does not exist: %s", cfg.MediaPath)
			return
		}
		
		// Process existing media items first (queue tasks for already discovered media)
		log.Println("🔄 Processing existing media items for comprehensive task queuing...")
		if err := mediaScanner.ProcessExistingMedia(); err != nil {
			log.Printf("Existing media processing error: %v", err)
		} else {
			log.Println("✅ Existing media processing completed successfully")
		}

		// Initial scan on startup (discover new media and queue tasks)
		log.Println("🔍 Media path exists, starting initial scan for new media...")
		if err := mediaScanner.ScanMediaLibrary(); err != nil {
			log.Printf("Initial media scanning error: %v", err)
		} else {
			log.Println("✅ Initial media scanning completed successfully")
		}
		
		// Set up periodic scanning using configurable interval
		scanInterval := time.Duration(cfg.ScanInterval) * time.Minute
		ticker := time.NewTicker(scanInterval)
		defer ticker.Stop()
		
		log.Printf("Starting periodic media scanning (every %d minutes)...", cfg.ScanInterval)
		
		for range ticker.C {
			log.Println("Starting periodic media scan...")
			if err := mediaScanner.ScanMediaLibrary(); err != nil {
				log.Printf("Periodic media scanning error: %v", err)
			} else {
				log.Println("Periodic media scanning completed successfully")
			}
		}
	}()

	// Setup Gin router
	r := gin.Default()

	// CORS middleware
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-User-ID", "x-user-id"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Initialize API routes
	api.SetupRoutes(r, mediaService, streamService, thumbnailService, userService, recommendationService, playbackService, geminiService, celeryService, alacService)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8251"
	}

	log.Printf("Server starting on port %s", port)
	log.Printf("Server accessible at http://0.0.0.0:%s", port)
	log.Fatal(r.Run("0.0.0.0:" + port))
}
