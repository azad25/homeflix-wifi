package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

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

	fmt.Printf("API Key: %s\n", apiKey)
	fmt.Printf("Username: %s\n", username)
	fmt.Printf("Password: %s\n", password)

	if apiKey == "" {
		log.Fatal("OPENSUB_API_KEY is required")
	}

	// Test the search endpoint
	testURL := "http://localhost:8252/api/opensubtitles/search?query=Inception&language=en"
	
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(testURL)
	if err != nil {
		log.Fatalf("Request failed: %v", err)
	}
	defer resp.Body.Close()

	fmt.Printf("Status Code: %d\n", resp.StatusCode)
	
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Fatalf("Failed to decode response: %v", err)
	}

	jsonData, _ := json.MarshalIndent(result, "", "  ")
	fmt.Printf("Response: %s\n", string(jsonData))
}