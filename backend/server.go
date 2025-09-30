package main

import (
	"log"
	"os"

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

	// Initialize poster service
	posterService := services.NewPosterService("./posters")
	
	// Initialize media scanner
	mediaScanner := scanner.NewMediaScanner(mediaService, thumbnailService, posterService, geminiService, celeryService, cfg.MediaPath)

	// Start background media scanning
	go func() {
		log.Println("Starting media scanner...")
		log.Printf("Scanning media path: %s", cfg.MediaPath)
		if err := mediaScanner.ScanMediaLibrary(); err != nil {
			log.Printf("Media scanning error: %v", err)
		} else {
			log.Println("Media scanning completed successfully")
		}
	}()

	// Setup Gin router
	r := gin.Default()

	// CORS middleware
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Initialize API routes
	api.SetupRoutes(r, mediaService, streamService, thumbnailService, userService, recommendationService, playbackService, geminiService, celeryService)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8251"
	}

	log.Printf("Server starting on port %s", port)
	log.Printf("Server accessible at http://0.0.0.0:%s", port)
	log.Fatal(r.Run("0.0.0.0:" + port))
}
