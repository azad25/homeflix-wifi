package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"

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

	// Test direct OpenSubtitles API call
	fmt.Println("\n🧪 Testing direct OpenSubtitles API...")
	
	params := url.Values{}
	params.Set("query", "Inception")
	params.Set("languages", "en")
	
	searchURL := fmt.Sprintf("https://api.opensubtitles.com/api/v1/subtitles?%s", params.Encode())
	fmt.Printf("🌐 URL: %s\n", searchURL)
	
	req, err := http.NewRequest("GET", searchURL, nil)
	if err != nil {
		log.Fatalf("❌ Failed to create request: %v", err)
	}
	
	req.Header.Set("Api-Key", apiKey)
	req.Header.Set("User-Agent", "HomeFlix v1.0")
	
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Fatalf("❌ Request failed: %v", err)
	}
	defer resp.Body.Close()
	
	fmt.Printf("📊 Status Code: %d\n", resp.StatusCode)
	
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Fatalf("❌ Failed to decode response: %v", err)
	}
	
	if data, ok := result["data"].([]interface{}); ok {
		fmt.Printf("✅ Found %d results\n", len(data))
		if len(data) > 0 {
			fmt.Println("📝 First result:")
			if firstResult, ok := data[0].(map[string]interface{}); ok {
				if attrs, ok := firstResult["attributes"].(map[string]interface{}); ok {
					if featureDetails, ok := attrs["feature_details"].(map[string]interface{}); ok {
						fmt.Printf("   Title: %v\n", featureDetails["title"])
						fmt.Printf("   Year: %v\n", featureDetails["year"])
					}
					fmt.Printf("   Language: %v\n", attrs["language"])
					fmt.Printf("   Downloads: %v\n", attrs["download_count"])
				}
			}
		}
	} else {
		fmt.Printf("❌ No data field in response\n")
	}
	
	// Test local API endpoint
	fmt.Println("\n🏠 Testing local API endpoint...")
	localURL := "http://localhost:8252/api/opensubtitles/search?query=Inception&language=en"
	fmt.Printf("🌐 URL: %s\n", localURL)
	
	localResp, err := http.Get(localURL)
	if err != nil {
		log.Printf("❌ Local API request failed: %v", err)
		return
	}
	defer localResp.Body.Close()
	
	fmt.Printf("📊 Local API Status Code: %d\n", localResp.StatusCode)
	
	var localResult map[string]interface{}
	if err := json.NewDecoder(localResp.Body).Decode(&localResult); err != nil {
		log.Printf("❌ Failed to decode local response: %v", err)
		return
	}
	
	if localData, ok := localResult["data"].([]interface{}); ok {
		fmt.Printf("✅ Local API found %d results\n", len(localData))
	} else {
		fmt.Printf("❌ Local API: No data field in response\n")
		jsonData, _ := json.MarshalIndent(localResult, "", "  ")
		fmt.Printf("Response: %s\n", string(jsonData))
	}
}