package main

import (
	"fmt"
	"log"
	"os"

	"homeflix-backend/internal/services"

	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	apiKey := os.Getenv("OPENSUB_API_KEY")
	username := os.Getenv("OPENSUB_USERNAME")
	password := os.Getenv("OPENSUB_PASSWORD")

	fmt.Printf("🔑 API Key: %s\n", apiKey)
	fmt.Printf("👤 Username: %s\n", username)
	fmt.Printf("🔒 Password: %s\n", password)

	if apiKey == "" {
		log.Fatal("❌ OPENSUB_API_KEY is required")
	}

	// Initialize OpenSubtitles service
	openSubService := services.NewOpenSubtitlesService()
	
	if !openSubService.IsConfigured() {
		log.Fatal("❌ OpenSubtitles service not configured")
	}

	fmt.Println("✅ OpenSubtitles service initialized")

	// Test search
	searchReq := services.SubtitleSearchRequest{
		Query:    "Inception",
		Language: "en",
	}

	fmt.Println("🔍 Testing search...")
	result, err := openSubService.SearchSubtitles(searchReq)
	if err != nil {
		log.Fatalf("❌ Search failed: %v", err)
	}

	fmt.Printf("✅ Search successful: found %d results\n", len(result.Data))
	
	if len(result.Data) > 0 {
		first := result.Data[0]
		fmt.Printf("📝 First result: %+v\n", first.Attributes.FeatureDetails.Title)
		if len(first.Attributes.Files) > 0 {
			fmt.Printf("📁 File ID: %d\n", first.Attributes.Files[0].FileID)
		}
	}
}