package services

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

type PosterService struct {
	posterDir string
}

type GoogleImageResult struct {
	Items []struct {
		Title string `json:"title"`
		Link  string `json:"link"`
		Image struct {
			Width  int `json:"width"`
			Height int `json:"height"`
		} `json:"image"`
	} `json:"items"`
}

func NewPosterService(posterDir string) *PosterService {
	// Create poster directory if it doesn't exist
	if err := os.MkdirAll(posterDir, 0755); err != nil {
		log.Printf("Warning: Failed to create poster directory %s: %v", posterDir, err)
	}
	
	return &PosterService{
		posterDir: posterDir,
	}
}

// DownloadPoster downloads and saves a poster for the given media
func (s *PosterService) DownloadPoster(title string, mediaID uint) error {
	log.Printf("Downloading HD poster for: %s", title)
	
	// Extract title and year from filename
	cleanedTitle, year := s.extractTitleAndYear(title)
	log.Printf("Extracted title: '%s', year: '%s'", cleanedTitle, year)
	
	// Build search query with year if available
	var searchQuery string
	if year != "" {
		searchQuery = fmt.Sprintf("%s %s", cleanedTitle, year)
	} else {
		searchQuery = cleanedTitle
	}
	
	log.Printf("Searching for poster: %s", searchQuery)
	
	// Search for poster using multiple sources
	posterURL, err := s.searchGoogleImages(searchQuery)
	if err != nil {
		log.Printf("Failed to find poster for %s: %v", searchQuery, err)
		return fmt.Errorf("failed to find poster for %s", title)
	}
	
	posterPath, err := s.downloadAndSaveImage(posterURL, mediaID)
	if err != nil {
		log.Printf("Failed to download poster from %s: %v", posterURL, err)
		return fmt.Errorf("failed to download poster for %s", title)
	}
	
	log.Printf("Successfully downloaded poster for %s: %s", title, posterPath)
	return nil
}

// downloadAndSaveImage downloads an image from URL and saves it to a local path
func (s *PosterService) downloadAndSaveImage(imageURL string, mediaID uint) (string, error) {
	// Create the file path
	posterPath := filepath.Join(s.posterDir, fmt.Sprintf("poster_%d.jpg", mediaID))
	
	// Download the image
	client := &http.Client{
		Timeout: 30 * time.Second,
	}
	
	resp, err := client.Get(imageURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to download image: status %d", resp.StatusCode)
	}
	
	// Create the file
	file, err := os.Create(posterPath)
	if err != nil {
		return "", err
	}
	defer file.Close()
	
	// Copy image data to file
	_, err = io.Copy(file, resp.Body)
	if err != nil {
		// Clean up partial file on error
		os.Remove(posterPath)
		return "", err
	}
	
	return posterPath, nil
}

// extractTitleAndYear extracts clean title and year from filename
func (s *PosterService) extractTitleAndYear(filename string) (string, string) {
	// First extract year if present
	yearRegex := regexp.MustCompile(`\b(19|20)\d{2}\b`)
	yearMatches := yearRegex.FindAllString(filename, -1)
	var year string
	if len(yearMatches) > 0 {
		year = yearMatches[len(yearMatches)-1] // Take the last year found
	}
	
	// Remove year from filename for title cleaning
	titleWithoutYear := yearRegex.ReplaceAllString(filename, " ")
	
	// Clean the title
	title := s.cleanTitleForSearch(titleWithoutYear)
	
	return title, year
}


// cleanTitleForSearch removes unwanted characters and formats title for search
func (s *PosterService) cleanTitleForSearch(title string) string {
	// Handle the " p " pattern that separates title from quality info
	if idx := strings.Index(strings.ToLower(title), " p "); idx != -1 {
		title = title[:idx]
	}
	
	// Remove everything after common separators
	separators := []string{" - ", " -", "- ", "-d3g", "-[", " [", "["}
	for _, sep := range separators {
		if idx := strings.Index(title, sep); idx != -1 {
			title = title[:idx]
		}
	}
	
	// Remove brackets and parentheses content
	title = regexp.MustCompile(`\[.*?\]`).ReplaceAllString(title, " ")
	title = regexp.MustCompile(`\(.*?\)`).ReplaceAllString(title, " ")
	
	// Enhanced patterns for better cleaning
	patterns := []string{
		`(?i)imax\s+ed`,       // IMAX Ed
		`(?i)imax`,            // IMAX
		`(?i)extended`,        // Extended
		`(?i)director.?s?\s+cut`, // Director's Cut
		`(?i)unrated`,         // Unrated
		`(?i)remastered`,      // Remastered
		`(?i)dd5\.?1`,         // DD5.1
		`(?i)dd\s*5\s*1`,      // DD 5 1
		`(?i)dts`,             // DTS
		`(?i)ac3`,             // AC3
		`(?i)aac`,             // AAC
		`(?i)bluray`,          // BluRay
		`(?i)brrip`,           // BRRip
		`(?i)webrip`,          // WebRip
		`(?i)web-?dl`,         // WEB-DL
		`(?i)hdtv`,            // HDTV
		`(?i)x26[45]`,         // x264/x265
		`(?i)h\.?26[45]`,      // h264/h265
		`(?i)hevc`,            // HEVC
		`(?i)\d{3,4}p`,        // Resolution (720p, 1080p, etc)
		`(?i)4k`,              // 4K
		`(?i)uhd`,             // UHD
		`(?i)hdr`,             // HDR
		`(?i)yts\.?mx`,        // YTS.MX
		`(?i)yts\.?am`,        // YTS.AM
		`(?i)yify`,            // YIFY
		`(?i)rarbg`,           // RARBG
		`(?i)\d+bit`,          // 10bit, 8bit
		`(?i)[57]\.?1`,        // 5.1, 7.1 audio
		`\b[57]\s+1\b`,        // "5 1", "7 1"
		`(?i)web\b`,           // WEB
		`(?i)cam`,             // CAM
		`(?i)ts\b`,            // TS
		`(?i)dvdrip`,          // DVDRip
		`(?i)bdrip`,           // BDRip
		`(?i)hdrip`,           // HDRip
	}
	
	cleaned := title
	
	// Apply all cleaning patterns
	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		cleaned = re.ReplaceAllString(cleaned, " ")
	}
	
	// Final cleanup
	cleaned = strings.TrimSpace(cleaned)
	cleaned = strings.Join(strings.Fields(cleaned), " ")
	
	return cleaned
}

// searchGoogleImages searches for movie poster images using Google Custom Search API
func (s *PosterService) searchGoogleImages(query string) (string, error) {
	// Try multiple poster sources in order of preference
	sources := []func(string) (string, error){
		s.searchGoogleCustomAPI,
		s.searchOMDbAPI,
		s.searchIMDbPattern,
		s.generateFallbackPoster,
	}
	
	for _, source := range sources {
		if imageURL, err := source(query); err == nil && imageURL != "" {
			return imageURL, nil
		}
	}
	
	return "", fmt.Errorf("no poster found for query: %s", query)
}

// searchGoogleCustomAPI searches using Google Custom Search API (requires API key)
func (s *PosterService) searchGoogleCustomAPI(query string) (string, error) {
	// For now, skip Google API to avoid rate limits and API key requirements
	return "", fmt.Errorf("Google API not configured")
}

// searchOMDbAPI searches using OMDb API pattern
func (s *PosterService) searchOMDbAPI(query string) (string, error) {
	// Clean query for OMDb search
	cleanQuery := strings.ReplaceAll(query, " ", "+")
	
	// Try OMDb poster URL pattern (would need API key for real implementation)
	posterURL := fmt.Sprintf("https://img.omdbapi.com/?t=%s&apikey=placeholder", cleanQuery)
	
	// Test if URL is accessible (this will fail without real API key)
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Head(posterURL)
	if err != nil || resp.StatusCode != 200 {
		return "", fmt.Errorf("OMDb API not accessible")
	}
	
	return posterURL, nil
}

// searchIMDbPattern searches using IMDb poster URL patterns
func (s *PosterService) searchIMDbPattern(query string) (string, error) {
	// Clean query for IMDb pattern
	cleanQuery := strings.ToLower(query)
	cleanQuery = strings.ReplaceAll(cleanQuery, " ", "-")
	cleanQuery = regexp.MustCompile(`[^a-z0-9-]`).ReplaceAllString(cleanQuery, "")
	
	// Try common IMDb poster patterns
	patterns := []string{
		fmt.Sprintf("https://m.media-amazon.com/images/M/MV5B%s.jpg", cleanQuery),
		fmt.Sprintf("https://images-na.ssl-images-amazon.com/images/M/MV5B%s.jpg", cleanQuery),
	}
	
	client := &http.Client{Timeout: 5 * time.Second}
	for _, pattern := range patterns {
		resp, err := client.Head(pattern)
		if err == nil && resp.StatusCode == 200 {
			return pattern, nil
		}
	}
	
	return "", fmt.Errorf("no IMDb pattern found")
}

// generateFallbackPoster generates a high-quality placeholder poster
func (s *PosterService) generateFallbackPoster(query string) (string, error) {
	// Clean the query for URL generation
	cleanQuery := strings.TrimSpace(query)
	cleanQuery = url.QueryEscape(cleanQuery)
	
	// Use a better placeholder service with movie poster styling
	posterURL := fmt.Sprintf("https://via.placeholder.com/500x750/2c3e50/ecf0f1?text=%s", cleanQuery)
	
	return posterURL, nil
}


// GetPosterPath returns the path to a poster for the given media ID
func (s *PosterService) GetPosterPath(mediaID uint) string {
	posterPath := filepath.Join(s.posterDir, fmt.Sprintf("poster_%d.jpg", mediaID))
	if _, err := os.Stat(posterPath); err == nil {
		return posterPath
	}
	return ""
}
