package main

import (
	"fmt"
	"log"
	"os"

	"homeflix-backend/internal/config"
	"homeflix-backend/internal/database"
	"homeflix-backend/internal/scanner"
	"homeflix-backend/internal/services"
)

func main() {
	log.Println("🚀 Starting Media Library Sync Tool...")

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

	// Check command line arguments
	if len(os.Args) < 2 {
		printUsage()
		return
	}

	command := os.Args[1]

	switch command {
	case "sync":
		log.Println("🔄 Starting comprehensive scan and sync...")
		if err := mediaScanner.ScanAndSyncMediaLibrary(); err != nil {
			log.Fatalf("❌ Sync failed: %v", err)
		}
		log.Println("✅ Sync completed successfully!")

	case "database-sync":
		log.Println("🔄 Starting database-storage sync...")
		if err := mediaScanner.SyncDatabaseWithStorage(); err != nil {
			log.Fatalf("❌ Database sync failed: %v", err)
		}
		log.Println("✅ Database sync completed successfully!")

	case "regenerate-assets":
		log.Println("🎨 Starting asset regeneration...")
		if err := mediaScanner.RegenerateAllAssets(); err != nil {
			log.Fatalf("❌ Asset regeneration failed: %v", err)
		}
		log.Println("✅ Asset regeneration completed successfully!")

	case "regenerate-previews":
		log.Println("🎬 Starting preview clip regeneration...")
		if err := mediaScanner.RegeneratePreviewClips(); err != nil {
			log.Fatalf("❌ Preview regeneration failed: %v", err)
		}
		log.Println("✅ Preview regeneration completed successfully!")

	case "regenerate-missing-previews":
		log.Println("🎬 Starting missing preview clip regeneration...")
		if err := mediaScanner.RegeneratePreviewClipsForMissingOnly(); err != nil {
			log.Fatalf("❌ Missing preview regeneration failed: %v", err)
		}
		log.Println("✅ Missing preview regeneration completed successfully!")

	case "full-scan":
		log.Println("📂 Starting full media scan...")
		if err := mediaScanner.ScanMediaLibrary(); err != nil {
			log.Fatalf("❌ Full scan failed: %v", err)
		}
		log.Println("✅ Full scan completed successfully!")

	case "incremental-scan":
		log.Println("⚡ Starting incremental scan...")
		if err := mediaScanner.IncrementalScan(); err != nil {
			log.Fatalf("❌ Incremental scan failed: %v", err)
		}
		log.Println("✅ Incremental scan completed successfully!")

	case "stats":
		stats := mediaScanner.GetScanStats()
		fmt.Printf("📊 Scanner Statistics:\n")
		fmt.Printf("   Total Files: %d\n", stats.TotalFiles)
		fmt.Printf("   Processed Files: %d\n", stats.ProcessedFiles)
		fmt.Printf("   Skipped Files: %d\n", stats.SkippedFiles)
		fmt.Printf("   Error Files: %d\n", stats.ErrorFiles)
		fmt.Printf("   New Files: %d\n", stats.NewFiles)
		fmt.Printf("   Updated Files: %d\n", stats.UpdatedFiles)
		fmt.Printf("   Scan Duration: %v\n", stats.ScanDuration)

	default:
		fmt.Printf("❌ Unknown command: %s\n", command)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("📖 Media Library Sync Tool Usage:")
	fmt.Println("")
	fmt.Println("Commands:")
	fmt.Println("  sync                      - Comprehensive scan and sync (recommended)")
	fmt.Println("  database-sync             - Sync database entries with storage")
	fmt.Println("  regenerate-assets         - Regenerate all thumbnails, previews, and posters")
	fmt.Println("  regenerate-previews       - Regenerate preview clips for all media")
	fmt.Println("  regenerate-missing-previews - Regenerate preview clips only for missing ones")
	fmt.Println("  full-scan                 - Full media library scan")
	fmt.Println("  incremental-scan          - Incremental scan for new/modified files")
	fmt.Println("  stats                     - Show current scanner statistics")
	fmt.Println("")
	fmt.Println("Examples:")
	fmt.Println("  go run scripts/sync_media.go sync")
	fmt.Println("  go run scripts/sync_media.go database-sync")
	fmt.Println("  go run scripts/sync_media.go regenerate-assets")
	fmt.Println("  go run scripts/sync_media.go regenerate-previews")
	fmt.Println("  go run scripts/sync_media.go regenerate-missing-previews")
	fmt.Println("")
	fmt.Println("Description:")
	fmt.Println("  sync                      - Performs a comprehensive sync that ensures all")
	fmt.Println("                              database entries match storage files, fixes")
	fmt.Println("                              titles, updates metadata, and regenerates assets")
	fmt.Println("")
	fmt.Println("  database-sync             - Validates all database entries against storage,")
	fmt.Println("                              fixes path issues, and updates metadata")
	fmt.Println("")
	fmt.Println("  regenerate-assets         - Forces regeneration of thumbnails, previews,")
	fmt.Println("                              and posters for all existing media")
	fmt.Println("")
	fmt.Println("  regenerate-previews       - Regenerates preview clips for all media that")
	fmt.Println("                              need them (missing or corrupted)")
	fmt.Println("")
	fmt.Println("  regenerate-missing-previews - Regenerates preview clips ONLY for media")
	fmt.Println("                                that are completely missing preview clips")
}