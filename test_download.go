package main

import (
	"fmt"
	"log"

	"homeflix-backend/internal/services"

	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Initialize OpenSubtitles service
	openSubService := services.NewOpenSubtitlesService()
	
	if !openSubService.IsConfigured() {
		log.Fatal("❌ OpenSubtitles service not configured")
	}

	// Test download with a known file ID
	fileID := 4982777 // From the search result above
	
	fmt.Printf("📥 Testing download for file ID: %d\n", fileID)
	
	downloadResp, subtitleData, err := openSubService.DownloadSubtitle(fileID)
	if err != nil {
		log.Fatalf("❌ Download failed: %v", err)
	}

	fmt.Printf("✅ Download successful!\n")
	fmt.Printf("📁 File name: %s\n", downloadResp.FileName)
	fmt.Printf("📊 Data size: %d bytes\n", len(subtitleData))
	fmt.Printf("📊 Remaining downloads: %d\n", downloadResp.Remaining)
	
	// Show first 200 characters of subtitle content
	if len(subtitleData) > 200 {
		fmt.Printf("📝 Content preview: %s...\n", string(subtitleData[:200]))
	} else {
		fmt.Printf("📝 Full content: %s\n", string(subtitleData))
	}
}