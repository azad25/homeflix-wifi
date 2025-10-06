package main

import (
	"fmt"
	"log"
	"os"

	"homeflix-backend/internal/config"
	"homeflix-backend/internal/scanner"
	"homeflix-backend/internal/services"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run test_cleanup.go <command>")
		fmt.Println("Commands:")
		fmt.Println("  sync        - Run full database sync")
		fmt.Println("  cleanup     - Run cleanup of invalid entries only")
		fmt.Println("  stats       - Show current database stats")
		os.Exit(1)
	}

	command := os.Args[1]

	// Load configuration
	cfg := config.LoadConfig()

	// Initialize database
	db, err := gorm.Open(sqlite.Open(cfg.DatabasePath), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Initialize services
	mediaService := services.NewMediaService(db)

	// Initialize scanner
	mediaScanner := scanner.NewMediaScanner(
		mediaService,
		nil, // thumbnailService
		nil, // posterService
		nil, // geminiService
		nil, // celeryService
		nil, // alacService
		nil, // tmdbService
		nil, // recommendationService
		cfg.MediaPath,
	)

	switch command {
	case "sync":
		log.Println("🔄 Starting comprehensive database-storage sync...")
		if err := mediaScanner.SyncDatabaseWithStorage(); err != nil {
			log.Fatalf("❌ Database sync failed: %v", err)
		}
		log.Println("✅ Database sync completed successfully!")

	case "cleanup":
		log.Println("🧹 Starting cleanup of invalid entries...")
		if err := mediaScanner.CleanupInvalidEntries(); err != nil {
			log.Fatalf("❌ Cleanup failed: %v", err)
		}
		log.Println("✅ Cleanup completed successfully!")

	case "stats":
		log.Println("📊 Getting database statistics...")
		allMedia, err := mediaService.GetAllMedia()
		if err != nil {
			log.Fatalf("❌ Failed to get media: %v", err)
		}

		var validCount, invalidCount int
		for _, media := range allMedia {
			if _, err := os.Stat(media.FilePath); os.IsNotExist(err) {
				invalidCount++
				log.Printf("❌ Invalid: %s (ID: %d)", media.Title, media.ID)
			} else {
				validCount++
			}
		}

		log.Printf("📊 Database Statistics:")
		log.Printf("   📁 Total entries: %d", len(allMedia))
		log.Printf("   ✅ Valid entries: %d", validCount)
		log.Printf("   ❌ Invalid entries: %d", invalidCount)

	default:
		fmt.Printf("Unknown command: %s\n", command)
		os.Exit(1)
	}
}