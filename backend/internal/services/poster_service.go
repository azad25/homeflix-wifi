package services

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"homeflix-backend/internal/interfaces"
)

type PosterService struct {
	posterDir   string
	tmdbService interfaces.TMDBServiceInterface
}

func NewPosterService(posterDir string) *PosterService {
	// Create poster directory if it doesn't exist
	if err := os.MkdirAll(posterDir, 0755); err != nil {
		log.Printf("Warning: Failed to create poster directory %s: %v", posterDir, err)
	}

	// Also create root-level poster directory for fallback
	if err := os.MkdirAll("./posters", 0755); err != nil {
		log.Printf("Warning: Failed to create root poster directory: %v", err)
	}

	return &PosterService{
		posterDir: posterDir,
	}
}

// SetTMDBService sets the TMDB service for poster downloads
func (s *PosterService) SetTMDBService(tmdbService interfaces.TMDBServiceInterface) {
	s.tmdbService = tmdbService
}

// DownloadPoster downloads and saves a poster for the given media using TMDB
func (s *PosterService) DownloadPoster(title string, mediaID uint) error {
	log.Printf("🎨 Downloading HD poster for: %s (ID: %d)", title, mediaID)

	// Check if poster already exists
	if existingPath := s.GetPosterPath(mediaID, title); existingPath != "" {
		log.Printf("✅ Poster already exists for %s: %s", title, existingPath)
		return nil
	}

	// Use TMDB service for poster download
	if s.tmdbService == nil {
		return fmt.Errorf("TMDB service not available for poster download")
	}

	log.Printf("🔍 Using TMDB service for poster download: %s", title)
	if err := s.downloadPosterFromTMDB(title, mediaID); err != nil {
		log.Printf("❌ TMDB poster download failed for %s: %v", title, err)
		return fmt.Errorf("failed to download TMDB poster for %s: %v", title, err)
	}

	log.Printf("✅ Successfully downloaded TMDB poster for %s", title)
	return nil
}

// DownloadPosterWithPath downloads and saves a poster for the given media using TMDB and returns the path
func (s *PosterService) DownloadPosterWithPath(title string, mediaID uint) (string, error) {
	log.Printf("🎨 Downloading HD poster for: %s (ID: %d)", title, mediaID)

	// Check if poster already exists
	if existingPath := s.GetPosterPath(mediaID, title); existingPath != "" {
		log.Printf("✅ Poster already exists for %s: %s", title, existingPath)
		return existingPath, nil
	}

	// Use TMDB service for poster download
	if s.tmdbService == nil {
		return "", fmt.Errorf("TMDB service not available for poster download")
	}

	log.Printf("🔍 Using TMDB service for poster download: %s", title)
	posterPath, err := s.tmdbService.DownloadPoster(title, mediaID, s.posterDir)
	if err != nil {
		log.Printf("❌ TMDB poster download failed for %s: %v", title, err)
		return "", fmt.Errorf("failed to download TMDB poster for %s: %v", title, err)
	}

	log.Printf("✅ Successfully downloaded TMDB poster for %s: %s", title, posterPath)
	return posterPath, nil
}

// downloadPosterFromTMDB downloads poster using TMDB service
func (s *PosterService) downloadPosterFromTMDB(title string, mediaID uint) error {
	log.Printf("🎬 Fetching TMDB poster for: %s", title)

	// Use TMDB service's direct poster download method
	posterPath, err := s.tmdbService.DownloadPoster(title, mediaID, s.posterDir)
	if err != nil {
		return fmt.Errorf("failed to download TMDB poster: %v", err)
	}

	log.Printf("✅ TMDB poster downloaded successfully: %s", posterPath)
	return nil
}

// downloadPosterFromTMDBWithPath downloads poster using TMDB service and returns the path
func (s *PosterService) downloadPosterFromTMDBWithPath(title string, mediaID uint) (string, error) {
	log.Printf("🎬 Fetching TMDB poster for: %s", title)

	// Use TMDB service's direct poster download method
	posterPath, err := s.tmdbService.DownloadPoster(title, mediaID, s.posterDir)
	if err != nil {
		return "", fmt.Errorf("failed to download TMDB poster: %v", err)
	}

	log.Printf("✅ TMDB poster downloaded successfully: %s", posterPath)
	return posterPath, nil
}



// GetPosterFromThumbnail returns thumbnail path as poster fallback
func (s *PosterService) GetPosterFromThumbnail(mediaID uint, title string) string {
	cleanTitle := s.cleanTitleForFilename(title)
	
	// Try common thumbnail locations as poster fallback
	thumbnailPaths := []string{
		fmt.Sprintf("./backend/thumbnails/thumb_%s.jpg", cleanTitle),
		fmt.Sprintf("./thumbnails/thumb_%s.jpg", cleanTitle),
		fmt.Sprintf("./backend/thumbnails/thumb_%d.jpg", mediaID),
		fmt.Sprintf("./thumbnails/thumb_%d.jpg", mediaID),
		fmt.Sprintf("./backend/thumbnails/thumb_%d_%s.jpg", mediaID, cleanTitle),
		fmt.Sprintf("./thumbnails/thumb_%d_%s.jpg", mediaID, cleanTitle),
	}

	for _, path := range thumbnailPaths {
		if _, err := os.Stat(path); err == nil {
			log.Printf("📸 Using thumbnail as poster fallback: %s", path)
			return path
		}
	}

	return ""
}



// GetPosterPath returns the path to a poster for the given media ID with thumbnail fallback
func (s *PosterService) GetPosterPath(mediaID uint, title string) string {
	cleanTitle := s.cleanTitleForFilename(title)
	
	// Priority 1: Check for actual poster files (TMDB format)
	posterPaths := []string{
		// TMDB saves with this exact format - check these first
		filepath.Join("./posters", fmt.Sprintf("poster_%s.jpg", cleanTitle)),
		filepath.Join(s.posterDir, fmt.Sprintf("poster_%s.jpg", cleanTitle)),
		// Legacy formats for backward compatibility
		filepath.Join("./posters", fmt.Sprintf("poster_%d.jpg", mediaID)),
		filepath.Join("./posters", fmt.Sprintf("poster_%d_%s.jpg", mediaID, cleanTitle)),
		filepath.Join(s.posterDir, fmt.Sprintf("poster_%d.jpg", mediaID)),
		filepath.Join(s.posterDir, fmt.Sprintf("poster_%d_%s.jpg", mediaID, cleanTitle)),
	}

	for _, path := range posterPaths {
		if _, err := os.Stat(path); err == nil {
			log.Printf("🎨 Found poster: %s", path)
			return path
		}
	}

	// Priority 2: Fallback to thumbnail as poster (this is what you requested)
	thumbnailFallback := s.GetPosterFromThumbnail(mediaID, title)
	if thumbnailFallback != "" {
		return thumbnailFallback
	}

	log.Printf("⚠️ No poster or thumbnail found for media %d (%s)", mediaID, title)
	return ""
}

// cleanTitleForFilename creates a safe filename from a title (matches TMDB service format)
func (s *PosterService) cleanTitleForFilename(title string) string {
	// Remove or replace characters that are not safe for filenames
	cleaned := strings.ReplaceAll(title, " ", "_")
	cleaned = strings.ReplaceAll(cleaned, ":", "")
	cleaned = strings.ReplaceAll(cleaned, "/", "_")
	cleaned = strings.ReplaceAll(cleaned, "\\", "_")
	cleaned = strings.ReplaceAll(cleaned, "?", "")
	cleaned = strings.ReplaceAll(cleaned, "*", "")
	cleaned = strings.ReplaceAll(cleaned, "<", "")
	cleaned = strings.ReplaceAll(cleaned, ">", "")
	cleaned = strings.ReplaceAll(cleaned, "|", "")
	cleaned = strings.ReplaceAll(cleaned, "\"", "")
	cleaned = strings.ReplaceAll(cleaned, "'", "")
	cleaned = strings.ReplaceAll(cleaned, "(", "")
	cleaned = strings.ReplaceAll(cleaned, ")", "")
	
	// Remove multiple underscores and trim
	cleaned = regexp.MustCompile(`_+`).ReplaceAllString(cleaned, "_")
	cleaned = strings.Trim(cleaned, "_")
	
	// Convert to lowercase for consistency (CRITICAL: matches TMDB service)
	cleaned = strings.ToLower(cleaned)
	
	// Limit length to avoid filesystem issues
	if len(cleaned) > 100 {
		cleaned = cleaned[:100]
	}
	
	// Ensure we have something if title was all special characters
	if cleaned == "" {
		cleaned = "untitled"
	}
	
	return cleaned
}
