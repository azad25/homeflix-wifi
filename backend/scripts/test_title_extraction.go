package main

import (
	"fmt"
	"log"
	"strings"

	"homeflix-backend/internal/config"
	"homeflix-backend/internal/database"
	"homeflix-backend/internal/scanner"
	"homeflix-backend/internal/services"
)

func main() {
	log.Println("🧪 Testing Title Extraction...")

	// Load configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize database
	dbManager, err := database.NewDBManager(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer dbManager.Close()

	// Initialize services
	mediaService := services.NewMediaService(dbManager)
	thumbnailService := services.NewThumbnailService(cfg.ThumbnailPath, cfg.PreviewPath)
	posterService := services.NewPosterService(cfg.PosterPath)
	geminiService := services.NewGeminiService()
	celeryService := services.NewCeleryService(cfg.RedisURL)
	alacService := services.NewALACAudioService(cfg.AudioPath)
	tmdbService := services.NewTMDBService()
	recommendationService := services.NewRecommendationService(mediaService)

	// Initialize media scanner
	mediaScanner := scanner.NewMediaScanner(
		mediaService,
		thumbnailService,
		posterService,
		geminiService,
		celeryService,
		alacService,
		tmdbService,
		recommendationService,
		cfg.MediaPath,
	)

	// Test files
	testFiles := []string{
		"/media/azad/Movies1/The.intern.2015.mkv",
		"/media/azad/Movies1/Avatar.2009.1080p.BluRay.x264.mkv",
		"/media/azad/Movies1/The.Matrix.1999.mkv",
		"/media/azad/Movies1/Inception.2010.720p.mkv",
	}

	fmt.Println("🔍 Testing title extraction for sample files:")
	fmt.Println(strings.Repeat("=", 60))

	for _, testFile := range testFiles {
		fmt.Printf("\n📁 File: %s\n", testFile)
		
		// Test TMDB service title cleaning
		if tmdbService != nil {
			tmdbTitle := tmdbService.CleanTitle(testFile)
			fmt.Printf("   🎬 TMDB Cleaned: '%s'\n", tmdbTitle)
		}
		
		// Test scanner's internal title extraction
		// Note: This is a simplified test - in real usage, the scanner uses more complex logic
		filename := testFile[len("/media/azad/Movies1/"):]
		fmt.Printf("   📄 Filename: '%s'\n", filename)
		
		fmt.Println("   " + strings.Repeat("-", 40))
	}

	fmt.Println("\n✅ Title extraction test completed!")
	fmt.Println("\nTo test with real scanning, run:")
	fmt.Println("  go run scripts/sync_media.go sync")
}