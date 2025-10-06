package main

import (
	"flag"
	"fmt"
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
		dbPath = flag.String("db", "homeflix.db", "Path to SQLite database")
	)
	flag.Parse()

	log.Printf("🔍 Checking for missing preview clips...")
	log.Printf("📊 Database: %s", *dbPath)

	// Check if database exists
	if _, err := os.Stat(*dbPath); os.IsNotExist(err) {
		log.Fatalf("❌ Database file not found: %s", *dbPath)
	}

	// Initialize database
	db, err := gorm.Open(sqlite.Open(*dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("❌ Failed to connect to database: %v", err)
	}

	// Initialize services
	mediaService := services.NewMediaService(db)
	mediaServiceAdapter := adapters.NewMediaServiceAdapter(mediaService)

	// Get all media from database
	allMedia, err := mediaServiceAdapter.GetAllMedia()
	if err != nil {
		log.Fatalf("❌ Failed to retrieve media from database: %v", err)
	}

	log.Printf("📊 Found %d total media entries", len(allMedia))

	var missingPreviewClips []string
	var missingPreviewPaths []string
	var missingBoth []string
	var hasPreview []string
	var fileNotFound []string

	for _, media := range allMedia {
		// Check if file exists
		if _, err := os.Stat(media.FilePath); os.IsNotExist(err) {
			fileNotFound = append(fileNotFound, fmt.Sprintf("ID:%d - %s (File: %s)", media.ID, media.Title, media.FilePath))
			continue
		}

		hasPreviewClip := media.PreviewClipPath != ""
		hasPreviewPath := media.PreviewPath != ""

		if !hasPreviewClip && !hasPreviewPath {
			missingBoth = append(missingBoth, fmt.Sprintf("ID:%d - %s", media.ID, media.Title))
		} else if !hasPreviewClip {
			missingPreviewClips = append(missingPreviewClips, fmt.Sprintf("ID:%d - %s (has PreviewPath: %s)", media.ID, media.Title, media.PreviewPath))
		} else if !hasPreviewPath {
			missingPreviewPaths = append(missingPreviewPaths, fmt.Sprintf("ID:%d - %s (has PreviewClipPath: %s)", media.ID, media.Title, media.PreviewClipPath))
		} else {
			// Check if preview files actually exist on disk
			previewExists := true
			if media.PreviewClipPath != "" {
				if _, err := os.Stat(media.PreviewClipPath); os.IsNotExist(err) {
					previewExists = false
				}
			}
			if media.PreviewPath != "" && media.PreviewPath != media.PreviewClipPath {
				if _, err := os.Stat(media.PreviewPath); os.IsNotExist(err) {
					previewExists = false
				}
			}

			if previewExists {
				hasPreview = append(hasPreview, fmt.Sprintf("ID:%d - %s", media.ID, media.Title))
			} else {
				missingBoth = append(missingBoth, fmt.Sprintf("ID:%d - %s (files missing on disk)", media.ID, media.Title))
			}
		}
	}

	// Print summary
	fmt.Println("\n📊 PREVIEW CLIP ANALYSIS SUMMARY:")
	fmt.Println("=" + fmt.Sprintf("%50s", "="))
	fmt.Printf("📁 Total media entries: %d\n", len(allMedia))
	fmt.Printf("❌ Files not found on disk: %d\n", len(fileNotFound))
	fmt.Printf("✅ Has working preview clips: %d\n", len(hasPreview))
	fmt.Printf("⚠️ Missing both PreviewPath and PreviewClipPath: %d\n", len(missingBoth))
	fmt.Printf("⚠️ Missing PreviewClipPath only: %d\n", len(missingPreviewClips))
	fmt.Printf("⚠️ Missing PreviewPath only: %d\n", len(missingPreviewPaths))

	// Show details if requested
	if len(missingBoth) > 0 {
		fmt.Println("\n❌ MEDIA MISSING BOTH PREVIEW PATHS:")
		for i, media := range missingBoth {
			fmt.Printf("  %d. %s\n", i+1, media)
			if i >= 9 { // Show only first 10
				fmt.Printf("  ... and %d more\n", len(missingBoth)-10)
				break
			}
		}
	}

	if len(fileNotFound) > 0 {
		fmt.Println("\n🗂️ MEDIA WITH MISSING FILES:")
		for i, media := range fileNotFound {
			fmt.Printf("  %d. %s\n", i+1, media)
			if i >= 4 { // Show only first 5
				fmt.Printf("  ... and %d more\n", len(fileNotFound)-5)
				break
			}
		}
	}

	fmt.Println("\n🔧 RECOMMENDED ACTIONS:")
	if len(missingBoth) > 0 {
		fmt.Printf("  • Run: go run scripts/regenerate_previews.go -mode missing\n")
		fmt.Printf("    This will generate preview clips for %d media items\n", len(missingBoth))
	}
	if len(fileNotFound) > 0 {
		fmt.Printf("  • Run: go run scripts/sync_media.go database-sync\n")
		fmt.Printf("    This will clean up %d entries with missing files\n", len(fileNotFound))
	}
	if len(missingBoth) == 0 && len(fileNotFound) == 0 {
		fmt.Println("  ✅ All media have preview clips! No action needed.")
	}

	fmt.Println()
}