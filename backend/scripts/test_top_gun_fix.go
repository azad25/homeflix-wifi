package main

import (
	"fmt"

	"homeflix-backend/internal/services"
)

func main() {
	// Test the specific problematic case
	testCases := []string{
		"Top Gun Maverick 2022 1080p WEB-RIP H265 HEVC AAC2.0-[Hasan].mkv",
		"Top Gun  1986 1080p WEB-RIP H265 HEVC AAC2.0-[Hasan].mkv",
		"Unknown Movie - Top Gun Maverick 2022 1080p WEB-RIP H265 HEVC AAC2.0-[Hasan]", // Bad title case
	}

	// Initialize TMDB service
	tmdbService := services.NewTMDBService()

	fmt.Println("🧪 Testing Top Gun Title Fix")
	fmt.Println("=============================")

	for i, testCase := range testCases {
		fmt.Printf("\n%d. Input: %s\n", i+1, testCase)
		
		// Test CleanTitle method
		cleanedTitle := tmdbService.CleanTitle(testCase)
		fmt.Printf("   Cleaned Title: '%s'\n", cleanedTitle)
		
		// Test RemoveYearFromTitle method
		titleWithoutYear := tmdbService.RemoveYearFromTitle(cleanedTitle)
		fmt.Printf("   Title for TMDB Search: '%s'\n", titleWithoutYear)
		
		// Test the GenerateMediaMetadata function (without API call)
		fmt.Printf("   Would search TMDB for: '%s' with year: %d\n", 
			titleWithoutYear, extractYear(testCase))
	}

	fmt.Println("\n✅ Top Gun title fix test completed!")
}

// Helper function to extract year
func extractYear(title string) int {
	// This is a simplified version of the year extraction logic
	if len(title) >= 4 {
		for i := 0; i <= len(title)-4; i++ {
			yearStr := title[i : i+4]
			if yearStr >= "1900" && yearStr <= "2030" {
				if year := parseInt(yearStr); year > 0 {
					return year
				}
			}
		}
	}
	return 0
}

func parseInt(s string) int {
	result := 0
	for _, r := range s {
		if r < '0' || r > '9' {
			return 0
		}
		result = result*10 + int(r-'0')
	}
	return result
}