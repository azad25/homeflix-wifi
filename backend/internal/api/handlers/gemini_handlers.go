package handlers

import (
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/interfaces"
	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"
)

func GenerateMediaMetadata(mediaService *services.MediaService, tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Try TMDB first
		metadata, err := tmdbService.GenerateMediaMetadata(media.FilePath, media.Title)
		if err != nil {
			// Fallback: return basic metadata from existing media data
			fallbackMetadata := &interfaces.MediaMetadata{
				Title:       media.Title,
				Tagline:     media.Tagline,
				ShortDesc:   media.ShortDesc,
				LongDesc:    media.LongDesc,
				Description: media.Description,
				Year:        media.Year,
				Stars:       media.Stars,
				Directors:   media.Director,
				Country:     media.Country,
				Language:    media.Language,
				Quality:     media.Quality,
				Rating:      media.Rating,
				Genres:      media.GenreNames,
			}
			
			c.JSON(http.StatusOK, gin.H{
				"metadata": fallbackMetadata,
				"source": "fallback",
				"tmdb_error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"metadata": metadata,
			"source": "tmdb",
		})
	}
}

func GenerateRecommendations(geminiService *services.GeminiService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var request struct {
			Title        string   `json:"title"`
			Genres       []string `json:"genres"`
			WatchHistory []string `json:"watch_history"`
		}

		if err := c.BindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		recommendations, err := geminiService.GenerateRecommendations(
			request.Title,
			request.Genres,
			request.WatchHistory,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate recommendations", "details": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"recommendations": recommendations})
	}
}

func UpdateMediaMetadata(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		var metadata struct {
			Title       string   `json:"title"`
			Tagline     string   `json:"tagline"`
			ShortDesc   string   `json:"short_desc"`
			LongDesc    string   `json:"long_desc"`
			Description string   `json:"description"`
			Year        int      `json:"year"`
			Stars       []string `json:"stars"`
			Directors   []string `json:"directors"`
			Country     string   `json:"country"`
			Language    string   `json:"language"`
			Quality     string   `json:"quality"`
			Rating      float64  `json:"rating"`
			GenreNames  []string `json:"genre_names"`
			GenreIDs    []uint   `json:"genre_ids"`
		}

		if err := c.BindJSON(&metadata); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Update media fields
		media.Title = metadata.Title
		media.Tagline = metadata.Tagline
		media.ShortDesc = metadata.ShortDesc
		media.LongDesc = metadata.LongDesc
		media.Description = metadata.Description
		media.Year = metadata.Year
		media.Country = metadata.Country
		media.Language = metadata.Language
		media.Quality = metadata.Quality
		media.Rating = metadata.Rating
		if len(metadata.Stars) > 0 {
			media.Stars = metadata.Stars
		}
		if len(metadata.Directors) > 0 {
			media.Director = metadata.Directors
		}
		if len(metadata.GenreNames) > 0 {
			media.GenreNames = metadata.GenreNames
		}
		// Update genres if provided
		if len(metadata.GenreIDs) > 0 {
			// Clear existing genres and set new ones
			media.Genres = []models.Genre{}
			for _, genreID := range metadata.GenreIDs {
				genre := models.Genre{}
				genre.ID = genreID
				media.Genres = append(media.Genres, genre)
			}
		}

		if err := mediaService.UpdateMedia(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update media"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Metadata updated successfully"})
	}
}

// UpdateMediaWithTMDB automatically fetches and updates media metadata from TMDB
// Now includes automatic poster download and database storage
func UpdateMediaWithTMDB(mediaService *services.MediaService, tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Parse request body for enhanced options
		var requestBody struct {
			SearchTitle    string   `json:"searchTitle"`
			PreserveFields []string `json:"preserveFields"`
			TMDBId         int      `json:"tmdbId"`
			MediaType      string   `json:"mediaType"`
			TMDBData       interface{} `json:"tmdbData"`
		}
		
		// Try to parse JSON body, but don't fail if it's empty (for backward compatibility)
		if err := c.ShouldBindJSON(&requestBody); err != nil {
			// If JSON parsing fails, use default behavior
			log.Printf("⚠️ Failed to parse request body for media %d: %v", id, err)
			requestBody.SearchTitle = media.Title
			requestBody.PreserveFields = []string{}
		} else {
			log.Printf("📥 Received TMDB update request for media %d: TMDBId=%d, SearchTitle='%s', MediaType='%s'", 
				id, requestBody.TMDBId, requestBody.SearchTitle, requestBody.MediaType)
		}

		// Use custom search title if provided, otherwise use media title
		searchTitle := media.Title
		if requestBody.SearchTitle != "" {
			searchTitle = requestBody.SearchTitle
		}

		log.Printf("🎬 Fetching TMDB data for movie: %s (ID: %d)", searchTitle, id)

		var metadata *interfaces.MediaMetadata

		// If TMDB ID is provided, use it directly for more accurate results
		if requestBody.TMDBId > 0 {
			log.Printf("🎯 Using provided TMDB ID: %d for movie update", requestBody.TMDBId)
			
			// Get movie details directly by TMDB ID
			movieDetails, tmdbErr := tmdbService.GetMovieDetailsWithExtras(requestBody.TMDBId)
			if tmdbErr != nil {
				log.Printf("❌ Failed to get movie details for TMDB ID %d: %v", requestBody.TMDBId, tmdbErr)
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to fetch TMDB data: %v", tmdbErr)})
				return
			}

			// Convert TMDB details to metadata format
			metadata = tmdbService.ConvertMovieDetailsToMetadata(movieDetails)
		} else {
			// Create metadata options
			options := &services.MetadataOptions{
				SearchTitle:    searchTitle,
				PreserveFields: requestBody.PreserveFields,
			}

			// Try TMDB search, fallback to filename parsing if it fails
			metadata, err = tmdbService.GenerateMediaMetadataWithOptions(media.FilePath, media.Title, options)
			if err != nil {
				// Fallback: create metadata from filename
				metadata = createFallbackMetadata(media.FilePath, media.Title)
			}
		}

		// Update media with TMDB data, respecting preserved fields
		if !contains(requestBody.PreserveFields, "title") {
			media.Title = metadata.Title
		}
		if !contains(requestBody.PreserveFields, "tagline") {
			media.Tagline = metadata.Tagline
		}
		if !contains(requestBody.PreserveFields, "description") {
			media.ShortDesc = metadata.ShortDesc
			media.LongDesc = metadata.LongDesc
			media.Description = metadata.Description
		}
		if !contains(requestBody.PreserveFields, "year") {
			media.Year = metadata.Year
		}
		if !contains(requestBody.PreserveFields, "country") {
			media.Country = metadata.Country
		}
		if !contains(requestBody.PreserveFields, "language") {
			media.Language = metadata.Language
		}
		if !contains(requestBody.PreserveFields, "rating") {
			media.Rating = metadata.Rating
		}
		if !contains(requestBody.PreserveFields, "genre_names") {
			media.Stars = metadata.Stars
			media.Director = metadata.Directors
			media.GenreNames = metadata.Genres
		}
		
		// Update cast and crew information
		media.Cast = metadata.Cast
		media.Writers = metadata.Writers
		media.Producers = metadata.Producers
		
		// Update box office and additional metadata
		media.Budget = metadata.Budget
		media.Revenue = metadata.Revenue
		media.BoxOffice = metadata.BoxOffice
		media.Status = metadata.Status
		media.IMDBID = metadata.IMDBID
		media.Homepage = metadata.Homepage
		media.Collection = metadata.Collection
		
		// Update backdrop and trailer URLs
		if metadata.BackdropURL != "" {
			log.Printf("🖼️ Updating backdrop URL: %s", metadata.BackdropURL)
			media.BannerPath = metadata.BackdropURL
		}
		if metadata.TrailerURL != "" {
			log.Printf("🎬 Updating trailer URL: %s", metadata.TrailerURL)
			media.TMDBTrailerURL = metadata.TrailerURL
		}
		
		// ENHANCED: Download and save poster from TMDB (like GeneratePoster does)
		if metadata.PosterURL != "" {
			log.Printf("🎨 TMDB poster URL found: %s", metadata.PosterURL)
			log.Printf("📥 Downloading poster from TMDB for: %s", media.Title)
			
			// Download poster using TMDB service (same as GeneratePoster)
			posterPath, posterErr := tmdbService.DownloadPoster(media.Title, media.ID, "./backend/posters")
			if posterErr != nil {
				log.Printf("⚠️ Failed to download poster from TMDB: %v", posterErr)
				// Still update with TMDB URL as fallback
				media.PosterPath = metadata.PosterURL
			} else {
				log.Printf("✅ Poster downloaded and saved: %s", posterPath)
				// Use local downloaded poster path
				media.PosterPath = posterPath
			}
		}
		
		// ENHANCED: Download and save logo from TMDB
		if requestBody.TMDBId > 0 {
			log.Printf("🏷️ Downloading logo from TMDB for: %s (TMDB ID: %d)", media.Title, requestBody.TMDBId)
			logoPath, logoErr := tmdbService.DownloadMovieLogo(requestBody.TMDBId, media.ID, "./logos")
			if logoErr != nil {
				log.Printf("⚠️ Failed to download logo from TMDB: %v", logoErr)
			} else if logoPath != "" {
				log.Printf("✅ Logo downloaded and saved: %s", logoPath)
				media.LogoPath = logoPath
			}
		}
		
		// Update runtime if available
		if metadata.Runtime > 0 {
			media.Duration = metadata.Runtime * 60 // Convert minutes to seconds
		}

		if err := mediaService.UpdateMedia(media); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update media"})
			return
		}

		source := "tmdb"
		if err != nil {
			source = "filename_fallback"
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Media updated successfully",
			"source": source,
			"metadata": metadata,
			"tmdb_error": func() string {
				if err != nil {
					return err.Error()
				}
				return ""
			}(),
		})
	}
}

// createFallbackMetadata creates metadata from filename when TMDB fails
func createFallbackMetadata(filePath, currentTitle string) *interfaces.MediaMetadata {
	filename := filepath.Base(filePath)
	
	// Remove file extension
	nameWithoutExt := strings.TrimSuffix(filename, filepath.Ext(filename))
	
	// Extract title and year from filename
	title, year := extractTitleAndYear(nameWithoutExt)
	
	// If we couldn't extract a good title, use the current title
	if title == "" || len(title) < 2 {
		title = currentTitle
	}
	
	// Extract quality from filename
	quality := extractQuality(nameWithoutExt)
	
	// Generate basic description
	description := generateBasicDescription(title, year)
	
	return &interfaces.MediaMetadata{
		Title:       title,
		Tagline:     "",
		ShortDesc:   description,
		LongDesc:    description,
		Description: description,
		Year:        year,
		Stars:       []string{},
		Directors:   []string{},
		Country:     "",
		Language:    "English", // Default assumption
		Quality:     quality,
		Rating:      0.0,
		Genres:      []string{},
		PosterURL:   "",
		BackdropURL: "",
		Runtime:     0,
	}
}

// extractTitleAndYear extracts movie title and year from filename
func extractTitleAndYear(filename string) (string, int) {
	// Common patterns for movie filenames
	patterns := []string{
		`^(.+?)[\.\s]+\((\d{4})\)`,           // Title (2019)
		`^(.+?)[\.\s]+(\d{4})[\.\s]`,         // Title 2019.
		`^(.+?)[\.\s]+(\d{4})$`,              // Title 2019
		`^(.+?)[\.\s]+\[(\d{4})\]`,           // Title [2019]
	}
	
	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindStringSubmatch(filename)
		if len(matches) >= 3 {
			title := cleanTitle(matches[1])
			if year, err := strconv.Atoi(matches[2]); err == nil {
				// Validate year range
				currentYear := time.Now().Year()
				if year >= 1900 && year <= currentYear+2 {
					return title, year
				}
			}
		}
	}
	
	// Fallback: look for any 4-digit year in the filename
	yearRegex := regexp.MustCompile(`(\d{4})`)
	yearMatches := yearRegex.FindAllString(filename, -1)
	
	var year int
	currentYear := time.Now().Year()
	for _, yearStr := range yearMatches {
		if y, err := strconv.Atoi(yearStr); err == nil {
			if y >= 1900 && y <= currentYear+2 {
				year = y
				break
			}
		}
	}
	
	// Extract title by removing common patterns
	title := cleanTitle(filename)
	
	return title, year
}

// cleanTitle removes common filename artifacts and cleans up the title
func cleanTitle(title string) string {
	// Replace dots and underscores with spaces
	title = strings.ReplaceAll(title, ".", " ")
	title = strings.ReplaceAll(title, "_", " ")
	title = strings.ReplaceAll(title, "-", " ")
	
	// Remove common quality/format indicators
	qualityPatterns := []string{
		`(?i)\b(1080p|720p|480p|4k|uhd|hd|sd)\b`,
		`(?i)\b(bluray|blu-ray|brrip|dvdrip|webrip|hdtv|hdcam)\b`,
		`(?i)\b(x264|x265|h264|h265|hevc|avc)\b`,
		`(?i)\b(aac|ac3|dts|mp3|flac)\b`,
		`(?i)\b(5\.1|7\.1|stereo|mono)\b`,
		`(?i)\b(extended|directors?\.cut|unrated|remastered)\b`,
		`(?i)\b(dvd|bd|web|tv|cam|ts|tc)\b`,
		`(?i)\b\d{4}\b`, // Remove years
		`\([^)]*\)`,     // Remove anything in parentheses
		`\[[^\]]*\]`,    // Remove anything in brackets
	}
	
	for _, pattern := range qualityPatterns {
		re := regexp.MustCompile(pattern)
		title = re.ReplaceAllString(title, " ")
	}
	
	// Clean up extra spaces and capitalize
	words := strings.Fields(title)
	var cleanWords []string
	
	for _, word := range words {
		word = strings.TrimSpace(word)
		if len(word) > 0 {
			// Capitalize first letter of each word
			cleanWords = append(cleanWords, strings.Title(strings.ToLower(word)))
		}
	}
	
	return strings.Join(cleanWords, " ")
}

// extractQuality determines video quality from filename
func extractQuality(filename string) string {
	filename = strings.ToLower(filename)
	
	if strings.Contains(filename, "4k") || strings.Contains(filename, "uhd") {
		return "4K"
	}
	if strings.Contains(filename, "1080p") {
		return "1080p"
	}
	if strings.Contains(filename, "720p") {
		return "720p"
	}
	if strings.Contains(filename, "480p") {
		return "480p"
	}
	if strings.Contains(filename, "hd") {
		return "HD"
	}
	
	return "SD" // Default fallback
}

// generateBasicDescription creates a basic description for the movie
func generateBasicDescription(title string, year int) string {
	if year > 0 {
		return title + " (" + strconv.Itoa(year) + ")"
	}
	return title
}

// contains checks if a slice contains a string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
