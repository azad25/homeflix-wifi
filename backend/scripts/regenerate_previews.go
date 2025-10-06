package main

import (
	"flag"
	"log"
	"os"

	"homeflix-backend/internal/adapters"
	"homeflix-backend/internal/scanner"
	"homeflix-backend/internal/services"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	var (
		dbPath    = flag.String("db", "homeflix.db", "Path to SQLite database")
		mediaPath = flag.String("media", "/media/azad/Movies1", "Path to media directory")
		mode      = flag.String("mode", "missing", "Mode: 'all' (regenerate all), 'missing' (only missing), 'force' (force all)")
	)
	flag.Parse()

	log.Printf("🎬 Starting preview clip regeneration...")
	log.Printf("📊 Database: %s", *dbPath)
	log.Printf("📁 Media path: %s", *mediaPath)
	log.Printf("🔧 Mode: %s", *mode)

	// Check if database exists
	if _, err := os.Stat(*dbPath); os.IsNotExist(err) {
		log.Fatalf("❌ Database file not found: %s", *dbPath)
	}

	// Check if media path exists
	if _, err := os.Stat(*mediaPath); os.IsNotExist(err) {
		log.Fatalf("❌ Media path not found: %s", *mediaPath)
	}

	// Initialize database
	db, err := gorm.Open(sqlite.Open(*dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("❌ Failed to connect to database: %v", err)
	}

	// Initialize services
	mediaService := services.NewMediaService(db)
	thumbnailService := services.NewThumbnailService()

	// Create service adapters
	mediaServiceAdapter := adapters.NewMediaServiceAdapter(mediaService)
	thumbnailServiceAdapter := adapters.NewThumbnailServiceAdapter(thumbnailService)

	// Initialize scanner
	mediaScanner := scanner.NewMediaScanner(
		mediaServiceAdapter,
		thumbnailServiceAdapter,
		nil, // posterService
		nil, // geminiService
		nil, // celeryService
		nil, // alacService
		nil, // tmdbService
		nil, // recommendationService
		*mediaPath,
	)

	// Execute based on mode
	switch *mode {
	case "all":
		log.Println("🎬 Regenerating preview clips for ALL media...")
		if err := mediaScanner.RegeneratePreviewClips(); err != nil {
			log.Fatalf("❌ Preview clip regeneration failed: %v", err)
		}
	case "missing":
		log.Println("🎬 Regenerating preview clips for media with MISSING preview clips...")
		if err := mediaScanner.RegeneratePreviewClipsForMissingOnly(); err != nil {
			log.Fatalf("❌ Missing preview clip regeneration failed: %v", err)
		}
	case "force":
		log.Println("🎬 FORCE regenerating ALL assets (thumbnails, previews, posters)...")
		if err := mediaScanner.RegenerateAllAssets(); err != nil {
			log.Fatalf("❌ Asset regeneration failed: %v", err)
		}
	default:
		log.Fatalf("❌ Invalid mode: %s. Use 'all', 'missing', or 'force'", *mode)
	}

	log.Println("✅ Preview clip regeneration completed successfully!")
}