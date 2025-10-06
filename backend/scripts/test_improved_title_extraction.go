package main

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"homeflix-backend/internal/services"
)

func main() {
	// Test cases with problematic filenames
	testCases := []string{
		"Top Gun  1986 1080p WEB-RIP H265 HEVC AAC2.0-[Hasan].mkv",
		"Top Gun 1986- 2022 1080p WEB-RIP H265 HEVC AAC2.0-[Hasan]/Top Gun  1986 1080p WEB-RIP H265 HEVC AAC2.0-[Hasan].mkv",
		"The Matrix 1999 1080p BluRay x264-YIFY.mp4",
		"Avengers Endgame 2019 2160p 4K UHD BluRay x265-RARBG.mkv",
		"John Wick Chapter 4 2023 720p WEBRip x264-YTS.mp4",
		"Spider-Man No Way Home 2021 1080p WEB-DL H264 AAC-PSA.mkv",
		"The.Dark.Knight.2008.1080p.BluRay.x264.YIFY.mp4",
		"Inception.2010.720p.BRRip.x264-YIFY.avi",
		"Interstellar 2014 IMAX 1080p BluRay x265 HEVC 10bit AAC 7.1-RARBG.mkv",
		"Dune.Part.Two.2024.2160p.4K.UHD.BluRay.x265.HDR.Atmos-RARBG.mkv",
	}

	// Initialize TMDB service
	tmdbService := services.NewTMDBService()

	fmt.Println("🧪 Testing Improved Title Extraction")
	fmt.Println("=====================================")

	for i, testCase := range testCases {
		fmt.Printf("\n%d. Input: %s\n", i+1, testCase)
		
		// Test CleanTitle method
		cleanedTitle := tmdbService.CleanTitle(testCase)
		fmt.Printf("   Cleaned Title: '%s'\n", cleanedTitle)
		
		// Test RemoveYearFromTitle method
		titleWithoutYear := tmdbService.RemoveYearFromTitle(cleanedTitle)
		fmt.Printf("   Title for TMDB: '%s'\n", titleWithoutYear)
		
		// Test quality detection
		quality := detectQuality(testCase)
		fmt.Printf("   Detected Quality: %s\n", quality)
		
		// Test year extraction
		year := extractYear(testCase)
		fmt.Printf("   Extracted Year: %d\n", year)
	}

	fmt.Println("\n✅ Title extraction test completed!")
}

// Helper function to detect quality (copied from TMDB service)
func detectQuality(filePath string) string {
	filename := strings.ToLower(filepath.Base(filePath))
	
	// 4K/UHD detection
	if regexp.MustCompile(`\b(2160p|4K|UHD|4096x2160|3840x2160)\b`).MatchString(filename) {
		return "4K"
	}
	
	// 1440p/QHD detection
	if regexp.MustCompile(`\b(1440p|QHD|2560x1440)\b`).MatchString(filename) {
		return "QHD"
	}
	
	// 1080p/Full HD detection
	if regexp.MustCompile(`\b(1080p|FHD|1920x1080)\b`).MatchString(filename) {
		return "Full HD"
	}
	
	// 720p/HD detection
	if regexp.MustCompile(`\b(720p|HD|1280x720)\b`).MatchString(filename) {
		return "HD"
	}
	
	// 480p/SD detection
	if regexp.MustCompile(`\b(480p|SD|854x480|640x480)\b`).MatchString(filename) {
		return "SD"
	}
	
	// 360p detection
	if regexp.MustCompile(`\b(360p|640x360)\b`).MatchString(filename) {
		return "360p"
	}
	
	// Check for BluRay/high quality sources
	if regexp.MustCompile(`\b(BluRay|BRRip|BDRip)\b`).MatchString(filename) {
		return "HD"
	}
	
	// Check for WEB sources
	if regexp.MustCompile(`\b(WEBRip|WEB.DL|WEB)\b`).MatchString(filename) {
		return "HD"
	}
	
	return "HD"
}

// Helper function to extract year
func extractYear(title string) int {
	yearPattern := regexp.MustCompile(`\b(19|20)\d{2}\b`)
	matches := yearPattern.FindAllString(title, -1)
	
	if len(matches) > 0 {
		// Return the last year found
		if year, err := strconv.Atoi(matches[len(matches)-1]); err == nil {
			return year
		}
	}
	
	return 0
}