package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"homeflix-backend/internal/interfaces"
	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// Media Handlers

// trimYearFromTitle removes year in parentheses from the end of titles for frontend display
func trimYearFromTitle(title string) string {
	// Remove year in parentheses at the end: "Movie Title (2019)" -> "Movie Title"
	yearPattern := regexp.MustCompile(`\s*\(\d{4}\)\s*$`)
	return strings.TrimSpace(yearPattern.ReplaceAllString(title, ""))
}

func normalizeGenreToken(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	normalized = strings.ReplaceAll(normalized, "&", " and ")
	normalized = strings.ReplaceAll(normalized, "-", " ")
	normalized = strings.ReplaceAll(normalized, "_", " ")
	normalized = regexp.MustCompile(`[^a-z0-9\s]+`).ReplaceAllString(normalized, "")
	normalized = strings.Join(strings.Fields(normalized), " ")
	return normalized
}

func genreAliasCandidates(value string) []string {
	normalized := normalizeGenreToken(value)
	if normalized == "" {
		return []string{}
	}

	aliases := map[string][]string{
		"scifi":              {"Science Fiction", "Sci-Fi & Fantasy"},
		"sci fi":             {"Science Fiction", "Sci-Fi & Fantasy"},
		"science fiction":    {"Science Fiction", "Sci-Fi & Fantasy"},
		"sci fi fantasy":     {"Sci-Fi & Fantasy", "Science Fiction"},
		"scifi fantasy":      {"Sci-Fi & Fantasy", "Science Fiction"},
		"sci fi and fantasy": {"Sci-Fi & Fantasy", "Science Fiction"},
	}

	if mapped, ok := aliases[normalized]; ok {
		return mapped
	}

	return []string{value}
}

func mediaMatchesAnyGenre(media models.Media, genreTerms []string) bool {
	if len(genreTerms) == 0 {
		return true
	}
	normalizedTerms := make([]string, 0, len(genreTerms))
	for _, term := range genreTerms {
		n := normalizeGenreToken(term)
		if n != "" {
			normalizedTerms = append(normalizedTerms, n)
		}
	}
	for _, genre := range media.Genres {
		genreNormalized := normalizeGenreToken(genre.Name)
		for _, term := range normalizedTerms {
			if genreNormalized == term {
				return true
			}
		}
	}
	for _, genreName := range media.GenreNames {
		genreNormalized := normalizeGenreToken(genreName)
		for _, term := range normalizedTerms {
			if genreNormalized == term {
				return true
			}
		}
	}
	return false
}

func paginateMedia(items []models.Media, offset, limit int) []models.Media {
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = 20
	}
	if offset >= len(items) {
		return []models.Media{}
	}
	end := offset + limit
	if end > len(items) {
		end = len(items)
	}
	return items[offset:end]
}

// prepareMediaForResponse modifies media titles for frontend display
func prepareMediaForResponse(media []models.Media) []models.Media {
	for i := range media {
		media[i].Title = trimYearFromTitle(media[i].Title)
	}
	return media
}

// prepareSingleMediaForResponse modifies a single media title for frontend display
func prepareSingleMediaForResponse(media *models.Media) *models.Media {
	mediaCopy := *media
	mediaCopy.Title = trimYearFromTitle(mediaCopy.Title)
	return &mediaCopy
}

type tvAppMediaResult struct {
	ID              uint           `json:"id"`
	UUID            string         `json:"uuid"`
	Title           string         `json:"title"`
	OriginalTitle   string         `json:"original_title,omitempty"`
	Type            string         `json:"type"`
	FilePath        string         `json:"file_path"`
	FileSize        int64          `json:"file_size"`
	Duration        int            `json:"duration"`
	Description     string         `json:"description,omitempty"`
	Year            int            `json:"year,omitempty"`
	ReleaseDate     time.Time      `json:"release_date,omitempty"`
	Rating          float64        `json:"rating,omitempty"`
	Certification   string         `json:"certification,omitempty"`
	Country         string         `json:"country,omitempty"`
	Language        string         `json:"language,omitempty"`
	Quality         string         `json:"quality,omitempty"`
	Genres          []models.Genre `json:"genres,omitempty"`
	GenreNames      []string       `json:"genre_names,omitempty"`
	ThumbnailPath   string         `json:"thumbnail_path,omitempty"`
	PreviewPath     string         `json:"preview_path,omitempty"`
	PreviewClipPath string         `json:"preview_clip_path,omitempty"`
	PosterPath      string         `json:"poster_path,omitempty"`
	LogoPath        string         `json:"logo_path,omitempty"`
	BannerPath      string         `json:"banner_path,omitempty"`
	TrailerPath     string         `json:"trailer_path,omitempty"`
	TMDBBackdropURL string         `json:"tmdb_backdrop_url,omitempty"`
	TMDBPosterURL   string         `json:"tmdb_poster_url,omitempty"`
	TMDBTrailerURL  string         `json:"tmdb_trailer_url,omitempty"`
	TMDBID          int            `json:"tmdb_id,omitempty"`
	SeriesID        *uint          `json:"series_id,omitempty"`
	ViewCount       int            `json:"view_count,omitempty"`
	LastUpdated     string         `json:"last_updated,omitempty"`
}

func toTVAppMediaResults(items []models.Media) []tvAppMediaResult {
	results := make([]tvAppMediaResult, 0, len(items))
	for _, item := range items {
		uuid := item.UUID
		if strings.TrimSpace(uuid) == "" {
			uuid = fmt.Sprintf("%d", item.ID)
		}
		filePath := item.FilePath
		if strings.TrimSpace(filePath) == "" {
			filePath = fmt.Sprintf("media-%d", item.ID)
		}

		results = append(results, tvAppMediaResult{
			ID:            item.ID,
			UUID:          uuid,
			Title:         trimYearFromTitle(item.Title),
			OriginalTitle: item.OriginalTitle,
			Type:          item.Type,
			FilePath:      filePath,
			FileSize:      item.FileSize,
			Duration:      item.Duration,
			Description:   item.Description,
			Year:          item.Year,
			ReleaseDate:   item.ReleaseDate,
			Rating:        item.Rating,
			Certification: func() string {
				if strings.TrimSpace(item.Certification) == "" {
					return "PG-13"
				}
				return item.Certification
			}(),
			Country:         item.Country,
			Language:        item.Language,
			Quality:         item.Quality,
			Genres:          item.Genres,
			GenreNames:      item.GenreNames,
			ThumbnailPath:   item.ThumbnailPath,
			PreviewPath:     item.PreviewPath,
			PreviewClipPath: item.PreviewClipPath,
			PosterPath:      item.PosterPath,
			LogoPath:        item.LogoPath,
			BannerPath:      item.BannerPath,
			TrailerPath:     item.TrailerPath,
			TMDBBackdropURL: item.TMDBBackdropURL,
			TMDBPosterURL:   item.PosterPath,
			TMDBTrailerURL:  item.TMDBTrailerURL,
			TMDBID:          item.TMDBID,
			SeriesID:        item.SeriesID,
			ViewCount:       item.ViewCount,
			LastUpdated:     item.LastUpdated,
		})
	}
	return results
}

func isTVAppClient(c *gin.Context) bool {
	userAgent := strings.ToLower(c.GetHeader("User-Agent"))
	return strings.Contains(userAgent, "okhttp") || strings.Contains(userAgent, "android") || strings.Contains(userAgent, "homeflix-tv")
}

func resolveUserID(c *gin.Context) string {
	userID := strings.TrimSpace(c.GetHeader("X-User-ID"))
	if userID == "" {
		userID = strings.TrimSpace(c.Query("user_id"))
	}
	if userID == "" {
		userID = "1"
	}
	return userID
}

func GetAllMedia(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		media, err := mediaService.GetAllMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, prepareMediaForResponse(media))
	}
}

func GetMediaByID(mediaService *services.MediaService) gin.HandlerFunc {
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

		c.JSON(http.StatusOK, prepareSingleMediaForResponse(media))
	}
}

func GetMovies(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 200 // Increased default limit for browse page
		if limitStr := c.Query("limit"); limitStr != "" {
			if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 && parsed <= 500 {
				limit = parsed
			}
		}
		offset := 0
		if offsetStr := c.Query("offset"); offsetStr != "" {
			if parsed, err := strconv.Atoi(offsetStr); err == nil && parsed >= 0 {
				offset = parsed
			}
		}

		movies, err := mediaService.GetMovies()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if isTVAppClient(c) {
			personalized := mediaService.PersonalizeMediaResults(resolveUserID(c), movies, "")

			recentPool := append([]models.Media{}, personalized...)
			sort.SliceStable(recentPool, func(i, j int) bool {
				if recentPool[i].Year == recentPool[j].Year {
					return recentPool[i].ID > recentPool[j].ID
				}
				return recentPool[i].Year > recentPool[j].Year
			})
			poolLimit := 80
			if len(recentPool) > poolLimit {
				recentPool = recentPool[:poolLimit]
			}
			rand.Seed(time.Now().UnixNano())
			rand.Shuffle(len(recentPool), func(i, j int) {
				recentPool[i], recentPool[j] = recentPool[j], recentPool[i]
			})

			sliced := paginateMedia(recentPool, offset, limit)
			c.JSON(http.StatusOK, toTVAppMediaResults(sliced))
			return
		}

		// For web clients, return all movies sorted by latest first
		c.JSON(http.StatusOK, prepareMediaForResponse(paginateMedia(movies, offset, limit)))
	}
}

func GetRecentMedia(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		media, err := mediaService.GetRecentMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, prepareMediaForResponse(media))
	}
}

func GetRecentlyAdded(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		media, err := mediaService.GetRecentlyAdded(20)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, prepareMediaForResponse(media))
	}
}

func GetMostWatched(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		media, err := mediaService.GetMostWatched(20)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, prepareMediaForResponse(media))
	}
}

func GetPopularMedia(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		media, err := mediaService.GetPopularMedia()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, prepareMediaForResponse(media))
	}
}

func GetTVShows(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		shows, err := mediaService.GetTVShows()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, prepareMediaForResponse(shows))
	}
}

// GetAllSeries returns all TV series
func GetAllSeries(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		series, err := mediaService.GetAllSeries()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, series)
	}
}

// GetSeriesByID returns a specific series by ID
func GetSeriesByID(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid series ID"})
			return
		}

		series, err := mediaService.GetSeriesByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Series not found"})
			return
		}
		c.JSON(http.StatusOK, series)
	}
}

// DeleteSeries removes a TV series and all its episodes from the database
func DeleteSeries(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid series ID"})
			return
		}

		// Check if series exists before attempting deletion
		series, err := mediaService.GetSeriesByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Series not found"})
			return
		}

		log.Printf("🗑️ API: Deleting TV series '%s' (ID: %d)", series.Title, id)

		// Delete the series and all associated episodes
		err = mediaService.DeleteSeries(uint(id))
		if err != nil {
			log.Printf("❌ Failed to delete series %d: %v", id, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "TV series and all episodes deleted successfully",
			"deleted_series": gin.H{
				"id":    series.ID,
				"title": series.Title,
			},
		})
	}
}

// UpdateSeriesMetadata updates a TV series with new metadata
func UpdateSeriesMetadata(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			log.Printf("❌ Invalid series ID: %s", c.Param("id"))
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid series ID"})
			return
		}

		// Use a typed struct to properly map snake_case JSON to CamelCase struct fields
		var metadata struct {
			Title          string   `json:"title"`
			Tagline        string   `json:"tagline"`
			Description    string   `json:"description"`
			Year           int      `json:"year"`
			Rating         float32  `json:"rating"`
			Country        string   `json:"country"`
			Language       string   `json:"language"`
			Quality        string   `json:"quality"`
			Certification  string   `json:"certification"`
			Status         string   `json:"status"`
			Network        string   `json:"network"`
			GenreNames     []string `json:"genre_names"`
			GenreIDs       []uint   `json:"genre_ids"`
			TMDBTrailerURL string   `json:"tmdb_trailer_url"`
			TrailerURL     string   `json:"trailer_url"`
		}
		if err := c.BindJSON(&metadata); err != nil {
			log.Printf("❌ Invalid request body for series %d: %v", id, err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
			return
		}

		updates := make(map[string]interface{})
		if metadata.Title != "" {
			updates["title"] = metadata.Title
		}
		if metadata.Tagline != "" {
			updates["tagline"] = metadata.Tagline
		}
		if metadata.Description != "" {
			updates["description"] = metadata.Description
		}
		if metadata.Year != 0 {
			updates["year"] = metadata.Year
		}
		if metadata.Rating != 0 {
			updates["rating"] = metadata.Rating
		}
		if metadata.Country != "" {
			updates["country"] = metadata.Country
		}
		if metadata.Language != "" {
			updates["language"] = metadata.Language
		}
		if metadata.Quality != "" {
			updates["quality"] = metadata.Quality
		}
		if metadata.Certification != "" {
			updates["certification"] = metadata.Certification
		}
		if metadata.Status != "" {
			updates["status"] = metadata.Status
		}
		if metadata.Network != "" {
			updates["network"] = metadata.Network
		}
		if metadata.TMDBTrailerURL != "" {
			updates["tmdb_trailer_url"] = metadata.TMDBTrailerURL
		}
		if metadata.TrailerURL != "" {
			updates["trailer_url"] = metadata.TrailerURL
		}
		if len(metadata.GenreNames) > 0 {
			updates["genre_names"] = metadata.GenreNames
		}
		if len(metadata.GenreIDs) > 0 {
			updates["genre_ids"] = metadata.GenreIDs
		}

		log.Printf("🔄 Updating series %d with data: %+v", id, updates)

		// Update the series
		series, err := mediaService.UpdateSeries(uint(id), updates)
		if err != nil {
			log.Printf("❌ Failed to update series %d: %v", id, err)
			if strings.Contains(err.Error(), "not found") {
				c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			} else {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			}
			return
		}

		log.Printf("✅ Successfully updated series %d: %s", id, series.Title)
		c.JSON(http.StatusOK, series)
	}
}

// UpdateSeriesWithTMDB automatically fetches and updates series metadata from TMDB
// Now includes automatic poster download and database storage
func UpdateSeriesWithTMDB(mediaService *services.MediaService, tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			log.Printf("❌ Invalid series ID: %s", c.Param("id"))
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid series ID"})
			return
		}

		// Parse request body for search parameters and TMDB data
		var requestBody struct {
			SearchTitle    string      `json:"searchTitle"`
			PreserveFields []string    `json:"preserveFields"`
			TMDBId         int         `json:"tmdbId"`
			MediaType      string      `json:"mediaType"`
			TMDBData       interface{} `json:"tmdbData"`
		}
		if err := c.BindJSON(&requestBody); err != nil {
			log.Printf("❌ Invalid request body for series %d: %v", id, err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
			return
		}

		log.Printf("📥 Received TMDB update request for series %d: TMDBId=%d, SearchTitle='%s', MediaType='%s'",
			id, requestBody.TMDBId, requestBody.SearchTitle, requestBody.MediaType)

		// Get existing series
		series, err := mediaService.GetSeriesByID(uint(id))
		if err != nil {
			log.Printf("❌ Series %d not found: %v", id, err)
			c.JSON(http.StatusNotFound, gin.H{"error": "Series not found"})
			return
		}

		// Use search title if provided, otherwise use existing title
		searchTitle := requestBody.SearchTitle
		if searchTitle == "" {
			searchTitle = series.Title
		}

		log.Printf("🎬 Fetching TMDB data for TV series: %s (ID: %d)", searchTitle, id)

		// Extract year from title for better search accuracy
		year := extractYearFromTitle(searchTitle)
		cleanTitle := removeYearFromTitle(searchTitle)

		// Search for TV series in TMDB
		var tvDetails *services.TMDBTVDetails
		if requestBody.TMDBId > 0 {
			log.Printf("🎯 Using provided TMDB ID: %d", requestBody.TMDBId)
			tvDetails, err = tmdbService.GetTVDetails(requestBody.TMDBId)
			if err != nil {
				log.Printf("❌ Failed to get TV details for TMDB ID %d: %v", requestBody.TMDBId, err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to fetch TMDB data: %v", err)})
				return
			}
		} else {
			// Search for TV series by title
			tv, err := tmdbService.SearchTV(cleanTitle, year)
			if err != nil {
				// Try without year
				tv, err = tmdbService.SearchTV(cleanTitle, 0)
				if err != nil {
					log.Printf("❌ Failed to find TV series in TMDB: %v", err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("TV series not found in TMDB: %v", err)})
					return
				}
			}

			// Get detailed information
			tvDetails, err = tmdbService.GetTVDetails(tv.ID)
			if err != nil {
				log.Printf("❌ Failed to get TV details: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get TV details: %v", err)})
				return
			}
		}

		// Prepare updates map
		updates := make(map[string]interface{})

		// Only update fields that aren't being preserved
		if !contains(requestBody.PreserveFields, "title") && tvDetails.Name != "" {
			updates["title"] = tvDetails.Name
		}
		if !contains(requestBody.PreserveFields, "description") && tvDetails.Overview != "" {
			updates["description"] = tvDetails.Overview
		}
		if !contains(requestBody.PreserveFields, "tagline") && tvDetails.Tagline != "" {
			updates["tagline"] = tvDetails.Tagline
		}
		if !contains(requestBody.PreserveFields, "year") && tvDetails.FirstAirDate != "" {
			if year, err := extractYearFromDate(tvDetails.FirstAirDate); err == nil && year > 0 {
				updates["release_date"] = tvDetails.FirstAirDate
			}
		}
		if !contains(requestBody.PreserveFields, "rating") && tvDetails.VoteAverage > 0 {
			updates["rating"] = tvDetails.VoteAverage
		}
		if !contains(requestBody.PreserveFields, "status") && tvDetails.Status != "" {
			updates["status"] = tvDetails.Status
		}
		if !contains(requestBody.PreserveFields, "seasons") && tvDetails.NumberOfSeasons > 0 {
			updates["total_seasons"] = tvDetails.NumberOfSeasons
		}
		if !contains(requestBody.PreserveFields, "episodes") && tvDetails.NumberOfEpisodes > 0 {
			updates["total_episodes"] = tvDetails.NumberOfEpisodes
		}
		if !contains(requestBody.PreserveFields, "network") && len(tvDetails.Networks) > 0 {
			updates["network"] = tvDetails.Networks[0].Name
		}

		// Always update backdrop and trailer URLs (these are enhancements, not user data)
		if tvDetails.BackdropPath != "" {
			backdropURL := tmdbService.GetPosterURL(tvDetails.BackdropPath, "w1280")
			updates["backdrop_path"] = backdropURL
			updates["tmdb_backdrop_url"] = backdropURL // Store TMDB URL separately
		}

		// ENHANCED: Download and save poster from TMDB (like GenerateSeriesPoster does)
		if tvDetails.PosterPath != "" {
			posterURL := tmdbService.GetPosterURL(tvDetails.PosterPath, "w500")
			log.Printf("🎨 TMDB poster URL found: %s", posterURL)
			log.Printf("📥 Downloading TV series poster from TMDB for: %s", series.Title)

			// Download poster using TMDB service for TV series
			posterPath, posterErr := tmdbService.DownloadTVPoster(series.Title, uint(id), "./backend/posters")
			if posterErr != nil {
				log.Printf("⚠️ Failed to download TV poster from TMDB: %v", posterErr)
				// Still update with TMDB URL as fallback
				updates["poster_path"] = posterURL
				updates["tmdb_poster_url"] = posterURL
			} else {
				log.Printf("✅ TV series poster downloaded and saved: %s", posterPath)
				// Use local downloaded poster path
				updates["poster_path"] = posterPath
				// Also store TMDB URL for reference
				updates["tmdb_poster_url"] = posterURL
			}
		}

		// Extract trailer URL from videos
		if len(tvDetails.Videos.Results) > 0 {
			for _, video := range tvDetails.Videos.Results {
				if video.Site == "YouTube" && video.Type == "Trailer" && video.Key != "" {
					trailerURL := fmt.Sprintf("https://www.youtube.com/watch?v=%s", video.Key)
					updates["trailer_url"] = trailerURL
					updates["tmdb_trailer_url"] = trailerURL // Store TMDB URL separately
					log.Printf("🎬 Found trailer for series %d: %s", id, trailerURL)
					break
				}
			}
		}

		// Update genres if available
		if len(tvDetails.Genres) > 0 {
			genreNames := make([]string, len(tvDetails.Genres))
			for i, genre := range tvDetails.Genres {
				genreNames[i] = genre.Name
			}
			updates["genre_names"] = genreNames
		}

		// Update the series with TMDB data
		updatedSeries, err := mediaService.UpdateSeries(uint(id), updates)
		if err != nil {
			log.Printf("❌ Failed to update series %d with TMDB data: %v", id, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		series = updatedSeries

		log.Printf("✅ Series TMDB update completed for: %s", series.Title)
		log.Printf("📊 Updated fields: %v", getMapKeys(updates))

		c.JSON(http.StatusOK, series)
	}
}

// Helper functions for TMDB updates
func extractYearFromTitle(title string) int {
	// Look for year in parentheses at the end
	if strings.Contains(title, "(") && strings.Contains(title, ")") {
		start := strings.LastIndex(title, "(")
		end := strings.LastIndex(title, ")")
		if start < end && end == len(title)-1 {
			yearStr := title[start+1 : end]
			if year, err := strconv.Atoi(yearStr); err == nil && year >= 1900 && year <= 2030 {
				return year
			}
		}
	}
	return 0
}

func removeYearFromTitle(title string) string {
	// Remove year in parentheses at the end
	if strings.Contains(title, "(") && strings.Contains(title, ")") {
		start := strings.LastIndex(title, "(")
		end := strings.LastIndex(title, ")")
		if start < end && end == len(title)-1 {
			yearStr := title[start+1 : end]
			if year, err := strconv.Atoi(yearStr); err == nil && year >= 1900 && year <= 2030 {
				return strings.TrimSpace(title[:start])
			}
		}
	}
	return title
}

func extractYearFromDate(dateStr string) (int, error) {
	if dateStr == "" {
		return 0, fmt.Errorf("empty date string")
	}

	// Parse date in format "2006-01-02"
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return 0, err
	}

	return t.Year(), nil
}

func getMapKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// GetSeasonsBySeriesID returns all seasons for a specific series
func GetSeasonsBySeriesID(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid series ID"})
			return
		}

		seasons, err := mediaService.GetSeasonsBySeriesID(uint(id))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, seasons)
	}
}

// GetEpisodesBySeriesAndSeason returns episodes for a specific series and season
func GetEpisodesBySeriesAndSeason(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		seasonStr := c.Param("season")

		id, err := strconv.ParseUint(idStr, 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid series ID"})
			return
		}

		season, err := strconv.Atoi(seasonStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid season number"})
			return
		}

		episodes, err := mediaService.GetEpisodesBySeriesAndSeason(uint(id), season)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, prepareMediaForResponse(episodes))
	}
}

func GetMediaByGenre(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		genre := c.Param("genre")
		genreTerms := genreAliasCandidates(genre)

		// Get page and limit from query parameters with defaults
		page := 1
		limit := 200 // Increased default limit for better browsing
		compact := isTVAppClient(c)
		if compactQuery := strings.TrimSpace(c.Query("compact")); compactQuery != "" {
			compact = strings.EqualFold(compactQuery, "true")
		}

		if pageStr := c.Query("page"); pageStr != "" {
			if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
				page = p
			}
		}

		maxLimit := 500 // Increased max limit
		if compact {
			maxLimit = 40
			limit = 24
		}

		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= maxLimit {
				limit = l
			}
		}

		media, err := mediaService.GetMediaByGenre(genre, page, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if len(media) == 0 && len(genreTerms) > 1 {
			collected := make([]models.Media, 0, limit)
			seen := make(map[uint]bool)
			for _, term := range genreTerms {
				termResults, termErr := mediaService.GetMediaByGenreName(term, limit)
				if termErr != nil {
					continue
				}
				for _, item := range termResults {
					if seen[item.ID] {
						continue
					}
					collected = append(collected, item)
					seen[item.ID] = true
					if len(collected) >= limit {
						break
					}
				}
				if len(collected) >= limit {
					break
				}
			}
			media = collected
		}
		if len(media) == 0 {
			allMedia, allErr := mediaService.GetMovies() // Changed from GetAllMedia to GetMovies
			if allErr == nil {
				filtered := make([]models.Media, 0, limit)
				for _, item := range allMedia {
					if mediaMatchesAnyGenre(item, genreTerms) {
						filtered = append(filtered, item)
						if len(filtered) >= limit {
							break
						}
					}
				}
				media = filtered
			}
		}
		if compact {
			personalized := mediaService.PersonalizeMediaResults(resolveUserID(c), media, genre)
			c.JSON(http.StatusOK, toTVAppMediaResults(personalized))
			return
		}
		c.JSON(http.StatusOK, prepareMediaForResponse(media))
	}
}

func SearchMedia(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := c.Query("q")
		if query == "" {
			// Return empty array instead of error for better UX
			c.JSON(http.StatusOK, []interface{}{})
			return
		}

		limit := 50
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}
		offset := 0
		if offsetStr := c.Query("offset"); offsetStr != "" {
			if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
				offset = o
			}
		}
		compact := isTVAppClient(c)
		if compactQuery := strings.TrimSpace(c.Query("compact")); compactQuery != "" {
			compact = strings.EqualFold(compactQuery, "true")
		}
		genre := strings.TrimSpace(c.Query("genre"))
		genreTerms := genreAliasCandidates(genre)
		queryGenreTerms := genreAliasCandidates(query)

		if compact {
			searchResults, err := mediaService.SearchMedia(query)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			filtered := make([]models.Media, 0, len(searchResults))
			for _, media := range searchResults {
				if genre != "" && !mediaMatchesAnyGenre(media, genreTerms) {
					continue
				}
				filtered = append(filtered, media)
			}
			if genre == "" && len(queryGenreTerms) > 1 {
				seen := make(map[uint]bool)
				for _, item := range filtered {
					seen[item.ID] = true
				}
				for _, term := range queryGenreTerms {
					termResults, termErr := mediaService.GetMediaByGenreName(term, limit*3)
					if termErr != nil {
						continue
					}
					for _, item := range termResults {
						if seen[item.ID] {
							continue
						}
						filtered = append(filtered, item)
						seen[item.ID] = true
					}
				}
			}
			if len(filtered) == 0 {
				lookupTerms := queryGenreTerms
				if genre != "" {
					lookupTerms = genreTerms
				}
				if len(lookupTerms) == 0 {
					lookupTerms = []string{query}
				}
				seen := make(map[uint]bool)
				for _, term := range lookupTerms {
					termResults, termErr := mediaService.GetMediaByGenreName(term, limit*2)
					if termErr != nil {
						continue
					}
					for _, item := range termResults {
						if seen[item.ID] {
							continue
						}
						filtered = append(filtered, item)
						seen[item.ID] = true
					}
				}
			}
			filtered = mediaService.PersonalizeMediaResults(resolveUserID(c), filtered, query)

			if offset >= len(filtered) {
				c.JSON(http.StatusOK, []tvAppMediaResult{})
				return
			}
			end := offset + limit
			if end > len(filtered) {
				end = len(filtered)
			}

			c.JSON(http.StatusOK, toTVAppMediaResults(filtered[offset:end]))
			return
		}

		results, err := performSmartSearch(mediaService, query)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if offset >= len(results) {
			c.JSON(http.StatusOK, []interface{}{})
			return
		}
		end := offset + limit
		if end > len(results) {
			end = len(results)
		}

		c.JSON(http.StatusOK, results[offset:end])
	}
}

func UpdateAllMediaGenres(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		err := mediaService.UpdateAllMediaGenres()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "All media genres updated successfully"})
	}
}

// DeleteMedia removes a media entry and all associated data
func DeleteMedia(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		// Check if media exists before attempting deletion
		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Delete the media and all associated data
		err = mediaService.DeleteMedia(uint(id))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Media deleted successfully",
			"deleted_media": gin.H{
				"id":    media.ID,
				"title": media.Title,
				"type":  media.Type,
			},
		})
	}
}

// SearchMediaAdvanced provides advanced search with filters
func SearchMediaAdvanced(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := c.Query("q")
		genreFilter := c.Query("genre")
		typeFilter := c.Query("type")
		minRatingStr := c.Query("min_rating")

		var minRating float32 = 0
		if minRatingStr != "" {
			if rating, err := strconv.ParseFloat(minRatingStr, 32); err == nil {
				minRating = float32(rating)
			}
		}

		results, err := mediaService.SearchMediaAdvanced(query, genreFilter, typeFilter, minRating)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, prepareMediaForResponse(results))
	}
}

// GetTrendingMedia returns trending media based on recent views and ratings
func GetTrendingMedia(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 20
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}

		media, err := mediaService.GetTrendingMedia(limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, prepareMediaForResponse(media))
	}
}

// performSmartSearch implements Netflix-like intelligent search
func performSmartSearch(mediaService *services.MediaService, query string) ([]interface{}, error) {
	// Get all media for comprehensive search
	allMedia, err := mediaService.GetAllMedia()
	if err != nil {
		return nil, err
	}

	// Get all series for TV show search
	allSeries, err := mediaService.GetAllSeries()
	if err != nil {
		log.Printf("Warning: Failed to get series: %v", err)
		allSeries = []models.Series{} // Continue with empty series list
	}

	type searchResult struct {
		media     interface{}
		score     float64
		matchType string
		isMovie   bool
		isSeries  bool
	}

	var results []searchResult
	queryLower := strings.ToLower(strings.TrimSpace(query))
	queryWords := strings.Fields(queryLower)

	// Track series we've already added to avoid duplicates
	addedSeriesIDs := make(map[uint]bool)

	// Search through series first (for TV shows)
	for _, series := range allSeries {
		score := 0.0
		matchTypes := []string{}

		// Title matching (highest priority)
		titleLower := strings.ToLower(series.Title)
		if titleLower == queryLower {
			score += 100.0 // Exact match
			matchTypes = append(matchTypes, "exact_title")
		} else if strings.Contains(titleLower, queryLower) {
			score += 80.0 // Contains query
			matchTypes = append(matchTypes, "title_contains")
		} else {
			// Word-by-word title matching
			titleWords := strings.Fields(titleLower)
			matchedWords := 0
			for _, queryWord := range queryWords {
				for _, titleWord := range titleWords {
					if strings.Contains(titleWord, queryWord) || strings.Contains(queryWord, titleWord) {
						matchedWords++
						break
					}
				}
			}
			if matchedWords > 0 {
				score += float64(matchedWords) / float64(len(queryWords)) * 60.0
				matchTypes = append(matchTypes, "title_partial")
			}
		}

		// Genre matching
		for _, genreName := range series.GenreNames {
			genreLower := strings.ToLower(genreName)
			if genreLower == queryLower {
				score += 70.0
				matchTypes = append(matchTypes, "exact_genre")
			} else if strings.Contains(genreLower, queryLower) {
				score += 50.0
				matchTypes = append(matchTypes, "genre_contains")
			}
		}

		// Description matching (lower priority)
		if series.Description != "" {
			descLower := strings.ToLower(series.Description)
			if strings.Contains(descLower, queryLower) {
				score += 30.0
				matchTypes = append(matchTypes, "description")
			}
		}

		// Type matching - boost TV series results
		for _, queryWord := range queryWords {
			if queryWord == "tv" || queryWord == "series" || queryWord == "show" {
				score += 40.0
				matchTypes = append(matchTypes, "type")
				break
			}
		}

		// Year matching (if query contains a year)
		for _, queryWord := range queryWords {
			if len(queryWord) == 4 {
				if year, err := strconv.Atoi(queryWord); err == nil && year >= 1900 && year <= 2030 {
					if strings.Contains(titleLower, queryWord) {
						score += 35.0
						matchTypes = append(matchTypes, "year")
					}
				}
			}
		}

		// Only include results with meaningful matches
		if score >= 10.0 {
			// Boost score based on series popularity
			if series.Rating > 0 {
				score += float64(series.Rating) * 2.0
			}

			// Convert series to media-like format for frontend
			seriesAsMedia := map[string]interface{}{
				"id":                series.ID,
				"title":             series.Title,
				"description":       series.Description,
				"type":              "tv", // Mark as TV series
				"year":              series.Year,
				"rating":            series.Rating,
				"genres":            series.Genres,
				"genre_names":       series.GenreNames,
				"poster_path":       series.PosterPath,
				"tmdb_poster_url":   series.TMDBPosterURL,
				"tmdb_backdrop_url": series.TMDBBackdropURL,
				"logo_path":         series.LogoPath,
				"series_id":         series.ID,
			}

			results = append(results, searchResult{
				media:     seriesAsMedia,
				score:     score,
				matchType: strings.Join(matchTypes, ","),
				isSeries:  true,
			})
			addedSeriesIDs[series.ID] = true
		}
	}

	// Search through movies (skip episodes to avoid duplicates with series)
	for _, media := range allMedia {
		// Skip episodes if their series is already in results
		if media.Type == "episode" || media.Type == "tv" {
			if media.SeriesID != nil && addedSeriesIDs[*media.SeriesID] {
				continue // Skip this episode, we already have the series
			}
		}

		// Only include movies in search results (episodes are represented by their series)
		if media.Type != "movie" {
			continue
		}

		score := 0.0
		matchTypes := []string{}

		// Title matching (highest priority)
		titleLower := strings.ToLower(media.Title)
		if titleLower == queryLower {
			score += 100.0 // Exact match
			matchTypes = append(matchTypes, "exact_title")
		} else if strings.Contains(titleLower, queryLower) {
			score += 80.0 // Contains query
			matchTypes = append(matchTypes, "title_contains")
		} else {
			// Word-by-word title matching
			titleWords := strings.Fields(titleLower)
			matchedWords := 0
			for _, queryWord := range queryWords {
				for _, titleWord := range titleWords {
					if strings.Contains(titleWord, queryWord) || strings.Contains(queryWord, titleWord) {
						matchedWords++
						break
					}
				}
			}
			if matchedWords > 0 {
				score += float64(matchedWords) / float64(len(queryWords)) * 60.0
				matchTypes = append(matchTypes, "title_partial")
			}
		}

		// Genre matching
		for _, genre := range media.Genres {
			genreLower := strings.ToLower(genre.Name)
			if genreLower == queryLower {
				score += 70.0
				matchTypes = append(matchTypes, "exact_genre")
			} else if strings.Contains(genreLower, queryLower) {
				score += 50.0
				matchTypes = append(matchTypes, "genre_contains")
			}
		}

		// Description matching (lower priority)
		if media.Description != "" {
			descLower := strings.ToLower(media.Description)
			if strings.Contains(descLower, queryLower) {
				score += 30.0
				matchTypes = append(matchTypes, "description")
			}

			// Word matching in description
			descWords := strings.Fields(descLower)
			matchedDescWords := 0
			for _, queryWord := range queryWords {
				for _, descWord := range descWords {
					if strings.Contains(descWord, queryWord) {
						matchedDescWords++
						break
					}
				}
			}
			if matchedDescWords > 0 {
				score += float64(matchedDescWords) / float64(len(queryWords)) * 20.0
			}
		}

		// Type matching
		typeLower := strings.ToLower(media.Type)
		if typeLower == queryLower || (queryLower == "movie" && typeLower == "movie") {
			score += 40.0
			matchTypes = append(matchTypes, "type")
		}

		// Quality matching
		if media.Quality != "" {
			qualityLower := strings.ToLower(media.Quality)
			for _, queryWord := range queryWords {
				if strings.Contains(qualityLower, queryWord) {
					score += 25.0
					matchTypes = append(matchTypes, "quality")
					break
				}
			}
		}

		// Year matching (if query contains a year)
		for _, queryWord := range queryWords {
			if len(queryWord) == 4 {
				if year, err := strconv.Atoi(queryWord); err == nil && year >= 1900 && year <= 2030 {
					if strings.Contains(titleLower, queryWord) {
						score += 35.0
						matchTypes = append(matchTypes, "year")
					}
				}
			}
		}

		// Only include results with meaningful matches (minimum score threshold)
		if score >= 10.0 {
			// Boost score based on media popularity and rating (only for actual matches)
			if media.Rating > 0 {
				score += float64(media.Rating) * 2.0 // Rating boost
			}
			if media.ViewCount > 0 {
				score += float64(media.ViewCount) * 0.01 // Popularity boost
			}
			results = append(results, searchResult{
				media:     media,
				score:     score,
				matchType: strings.Join(matchTypes, ","),
				isMovie:   true,
			})
		}
	}

	// Sort by score (highest first)
	for i := 0; i < len(results)-1; i++ {
		for j := i + 1; j < len(results); j++ {
			if results[i].score < results[j].score {
				results[i], results[j] = results[j], results[i]
			}
		}
	}

	// Extract media objects and limit results
	var finalResults []interface{}
	maxResults := 50 // Limit to top 50 results
	for i, result := range results {
		if i >= maxResults {
			break
		}
		// Prepare media with trimmed year for frontend
		if result.isSeries {
			// Series is already in map format
			finalResults = append(finalResults, result.media)
		} else if media, ok := result.media.(models.Media); ok {
			preparedMedia := prepareSingleMediaForResponse(&media)
			finalResults = append(finalResults, *preparedMedia)
		} else {
			finalResults = append(finalResults, result.media)
		}
	}

	return finalResults, nil
}

// GetSubtitleTracks returns all subtitle tracks for a media item
func GetSubtitleTracks(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		tracks, err := mediaService.GetSubtitleTracks(uint(id))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, tracks)
	}
}

// GetAudioTracks returns all audio tracks for a media item
func GetAudioTracks(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		tracks, err := mediaService.GetAudioTracks(uint(id))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, tracks)
	}
}

// GetSubtitleFile serves subtitle files (both internal and external)
func GetSubtitleFile(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		trackID, err := strconv.ParseUint(c.Param("trackId"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid track ID"})
			return
		}

		// Get the subtitle track
		track, err := mediaService.GetSubtitleTrack(uint(trackID))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Subtitle track not found"})
			return
		}

		// Verify the track belongs to the requested media
		if track.MediaID != uint(id) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Track does not belong to this media"})
			return
		}

		if track.TrackType == "external" && track.FilePath != "" {
			log.Printf("🔍 Looking for external subtitle file: %s", track.FilePath)

			// Verify external subtitle file exists
			if _, err := os.Stat(track.FilePath); err != nil {
				log.Printf("❌ External subtitle file not found: %s (error: %v)", track.FilePath, err)

				// Try to find the file in the same directory as the video
				media, err := mediaService.GetMediaByID(uint(id))
				if err == nil && media.FilePath != "" {
					videoDir := filepath.Dir(media.FilePath)
					subtitleFileName := filepath.Base(track.FilePath)
					alternativePath := filepath.Join(videoDir, subtitleFileName)

					log.Printf("🔍 Trying alternative path: %s", alternativePath)
					if _, err := os.Stat(alternativePath); err == nil {
						log.Printf("✅ Found subtitle at alternative path: %s", alternativePath)
						track.FilePath = alternativePath

						// Update the database with the correct path
						go func() {
							if err := mediaService.UpdateSubtitleTrackPath(track.ID, alternativePath); err != nil {
								log.Printf("⚠️ Failed to update subtitle track path: %v", err)
							}
						}()
					} else {
						log.Printf("❌ Subtitle file not found at alternative path either: %s", alternativePath)
						c.JSON(http.StatusNotFound, gin.H{
							"error":   "Subtitle file not found on disk",
							"details": fmt.Sprintf("Checked paths: %s, %s", track.FilePath, alternativePath),
						})
						return
					}
				} else {
					c.JSON(http.StatusNotFound, gin.H{
						"error": "Subtitle file not found on disk",
						"path":  track.FilePath,
					})
					return
				}
			}

			// Set appropriate headers for subtitle files
			contentType := getSubtitleContentType(track.Format)
			c.Header("Content-Type", contentType)
			c.Header("Content-Disposition", "inline")
			c.Header("Cache-Control", "public, max-age=3600") // Cache for 1 hour
			c.Header("Access-Control-Allow-Origin", "*")
			c.Header("Access-Control-Allow-Headers", "Range")

			log.Printf("📄 Serving external subtitle: %s (%s)", track.FilePath, contentType)

			// Serve external subtitle file
			c.File(track.FilePath)
		} else if track.TrackType == "internal" {
			// Extract internal subtitle using ffmpeg
			media, err := mediaService.GetMediaByID(uint(id))
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
				return
			}

			subtitleData, err := extractInternalSubtitle(media.FilePath, track.StreamIndex)
			if err != nil {
				log.Printf("❌ Failed to extract internal subtitle: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to extract subtitle"})
				return
			}

			// Set appropriate content type
			contentType := getSubtitleContentType(track.CodecName)
			c.Header("Content-Type", contentType)
			c.Header("Content-Disposition", "inline")
			c.Header("Cache-Control", "public, max-age=1800") // Cache for 30 minutes
			c.Header("Access-Control-Allow-Origin", "*")

			log.Printf("📄 Serving internal subtitle: stream %d (%s)", track.StreamIndex, contentType)
			c.Data(http.StatusOK, contentType, subtitleData)
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": "Subtitle file not available"})
		}
	}
}

// getSubtitleContentType returns the appropriate content type for subtitle formats
func getSubtitleContentType(format string) string {
	switch strings.ToLower(format) {
	case "srt", "subrip":
		return "text/srt; charset=utf-8"
	case "vtt", "webvtt":
		return "text/vtt; charset=utf-8"
	case "ass", "ssa":
		return "text/ass; charset=utf-8"
	case "sub":
		return "text/sub; charset=utf-8"
	case "sbv":
		return "text/sbv; charset=utf-8"
	case "ttml", "dfxp":
		return "application/ttml+xml; charset=utf-8"
	default:
		return "text/plain; charset=utf-8"
	}
}

// extractInternalSubtitle extracts internal subtitle track using ffmpeg with enhanced timing precision
func extractInternalSubtitle(videoPath string, streamIndex int) ([]byte, error) {
	log.Printf("🎬 Extracting internal subtitle: stream %d from %s", streamIndex, filepath.Base(videoPath))

	// First, get stream information to determine the correct mapping
	probeCmd := exec.Command("ffprobe",
		"-v", "quiet",
		"-print_format", "json",
		"-show_streams",
		"-select_streams", "s",
		videoPath)

	probeOutput, err := probeCmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to probe subtitle streams: %v", err)
	}

	var probeData struct {
		Streams []struct {
			Index     int    `json:"index"`
			CodecType string `json:"codec_type"`
			CodecName string `json:"codec_name"`
		} `json:"streams"`
	}

	if err := json.Unmarshal(probeOutput, &probeData); err != nil {
		return nil, fmt.Errorf("failed to parse probe output: %v", err)
	}

	// Find the actual stream index for subtitles
	var actualStreamIndex int = -1
	subtitleCount := 0

	for _, stream := range probeData.Streams {
		if stream.CodecType == "subtitle" {
			if subtitleCount == streamIndex {
				actualStreamIndex = stream.Index
				break
			}
			subtitleCount++
		}
	}

	// If not found using subtitle-specific index, try using the streamIndex as actual stream index
	if actualStreamIndex == -1 {
		// Check if the streamIndex itself is a valid subtitle stream
		for _, stream := range probeData.Streams {
			if stream.CodecType == "subtitle" && stream.Index == streamIndex {
				actualStreamIndex = streamIndex
				log.Printf("🎬 Using streamIndex %d directly as actual stream index", streamIndex)
				break
			}
		}
	}

	if actualStreamIndex == -1 {
		return nil, fmt.Errorf("subtitle stream %d not found (checked both subtitle-specific and actual indices)", streamIndex)
	}

	log.Printf("🎬 Using actual stream index %d for subtitle stream %d", actualStreamIndex, streamIndex)

	// Extract subtitle using the correct stream index with enhanced timing precision
	cmd := exec.Command("ffmpeg",
		"-v", "error", // Reduce verbosity but show errors
		"-i", videoPath,
		"-map", fmt.Sprintf("0:%d", actualStreamIndex), // Use absolute stream index
		"-c:s", "srt", // Convert to SRT format for web compatibility
		"-f", "srt",
		"-avoid_negative_ts", "make_zero", // Ensure no negative timestamps
		"-copyts",        // Copy timestamps precisely
		"-start_at_zero", // Start at zero for consistency
		"-")

	output, err := cmd.Output()
	if err != nil {
		// Try alternative extraction method for problematic codecs
		log.Printf("⚠️ Standard extraction failed, trying alternative method: %v", err)
		return extractInternalSubtitleAlternative(videoPath, actualStreamIndex)
	}

	if len(output) == 0 {
		return nil, fmt.Errorf("extracted subtitle is empty")
	}

	// Post-process the SRT to ensure proper timing format
	processedOutput := postProcessSRTTiming(output)

	log.Printf("✅ Successfully extracted internal subtitle: %d bytes", len(processedOutput))
	return processedOutput, nil
}

// extractInternalSubtitleAlternative tries alternative extraction methods
func extractInternalSubtitleAlternative(videoPath string, streamIndex int) ([]byte, error) {
	log.Printf("🔄 Trying alternative subtitle extraction for stream %d", streamIndex)

	// Method 1: Try without codec conversion (keep original format)
	cmd := exec.Command("ffmpeg",
		"-v", "error",
		"-i", videoPath,
		"-map", fmt.Sprintf("0:%d", streamIndex),
		"-c:s", "copy", // Keep original subtitle format
		"-f", "srt", // But force SRT container
		"-")

	output, err := cmd.Output()
	if err == nil && len(output) > 0 {
		log.Printf("✅ Alternative method 1 succeeded: %d bytes", len(output))
		return output, nil
	}

	// Method 2: Try with text output
	cmd = exec.Command("ffmpeg",
		"-v", "error",
		"-i", videoPath,
		"-map", fmt.Sprintf("0:%d", streamIndex),
		"-f", "srt",
		"-")

	output, err = cmd.Output()
	if err == nil && len(output) > 0 {
		log.Printf("✅ Alternative method 2 succeeded: %d bytes", len(output))
		return output, nil
	}

	// Method 3: Try extracting as WebVTT and convert
	cmd = exec.Command("ffmpeg",
		"-v", "error",
		"-i", videoPath,
		"-map", fmt.Sprintf("0:%d", streamIndex),
		"-f", "webvtt",
		"-")

	vttOutput, err := cmd.Output()
	if err == nil && len(vttOutput) > 0 {
		// Convert WebVTT to SRT
		srtOutput := convertWebVTTToSRT(string(vttOutput))
		if len(srtOutput) > 0 {
			log.Printf("✅ Alternative method 3 (WebVTT->SRT) succeeded: %d bytes", len(srtOutput))
			return []byte(srtOutput), nil
		}
	}

	return nil, fmt.Errorf("all subtitle extraction methods failed for stream %d", streamIndex)
}

// postProcessSRTTiming ensures proper SRT timing format and fixes common issues
func postProcessSRTTiming(srtData []byte) []byte {
	content := string(srtData)
	lines := strings.Split(content, "\n")
	var processedLines []string

	for _, line := range lines {
		line = strings.TrimSpace(line)

		// Fix timestamp format issues
		if strings.Contains(line, "-->") {
			// Ensure proper SRT timestamp format: HH:MM:SS,mmm --> HH:MM:SS,mmm
			timestampRegex := regexp.MustCompile(`(\d{1,2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[.,](\d{3})`)
			if timestampRegex.MatchString(line) {
				// Replace dots with commas and ensure proper formatting
				line = timestampRegex.ReplaceAllStringFunc(line, func(match string) string {
					parts := timestampRegex.FindStringSubmatch(match)
					if len(parts) == 9 {
						// Ensure hours are zero-padded
						startHour := fmt.Sprintf("%02s", parts[1])
						endHour := fmt.Sprintf("%02s", parts[5])
						return fmt.Sprintf("%s:%s:%s,%s --> %s:%s:%s,%s",
							startHour, parts[2], parts[3], parts[4],
							endHour, parts[6], parts[7], parts[8])
					}
					return match
				})
			}
		}

		processedLines = append(processedLines, line)
	}

	return []byte(strings.Join(processedLines, "\n"))
}

// convertWebVTTToSRT converts WebVTT format to SRT format with enhanced timing precision
func convertWebVTTToSRT(vttContent string) string {
	lines := strings.Split(vttContent, "\n")
	var srtLines []string
	var counter int = 1

	for i := 0; i < len(lines); i++ {
		line := strings.TrimSpace(lines[i])

		// Skip WebVTT header and empty lines
		if line == "WEBVTT" || line == "" {
			continue
		}

		// Look for timestamp lines (contain "-->")
		if strings.Contains(line, "-->") {
			// Add counter
			srtLines = append(srtLines, fmt.Sprintf("%d", counter))
			counter++

			// Convert WebVTT timestamp format to SRT format with proper formatting
			// WebVTT: 00:00:01.000 --> 00:00:04.000
			// SRT:    00:00:01,000 --> 00:00:04,000
			timestampRegex := regexp.MustCompile(`(\d{1,2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[.,](\d{3})`)
			if timestampRegex.MatchString(line) {
				srtTimestamp := timestampRegex.ReplaceAllStringFunc(line, func(match string) string {
					parts := timestampRegex.FindStringSubmatch(match)
					if len(parts) == 9 {
						// Ensure proper SRT format with zero-padded hours
						startHour := fmt.Sprintf("%02s", parts[1])
						endHour := fmt.Sprintf("%02s", parts[5])
						return fmt.Sprintf("%s:%s:%s,%s --> %s:%s:%s,%s",
							startHour, parts[2], parts[3], parts[4],
							endHour, parts[6], parts[7], parts[8])
					}
					return strings.ReplaceAll(match, ".", ",")
				})
				srtLines = append(srtLines, srtTimestamp)
			} else {
				// Fallback: simple dot to comma replacement
				srtTimestamp := strings.ReplaceAll(line, ".", ",")
				srtLines = append(srtLines, srtTimestamp)
			}

			// Collect subtitle text until next timestamp or end
			i++
			var textLines []string
			for i < len(lines) {
				textLine := strings.TrimSpace(lines[i])
				if textLine == "" {
					break
				}
				if strings.Contains(textLine, "-->") {
					i-- // Back up one line
					break
				}
				// Clean up WebVTT styling and notes
				if !strings.HasPrefix(textLine, "NOTE") &&
					!strings.Contains(textLine, "align:") &&
					!strings.Contains(textLine, "position:") {
					textLines = append(textLines, textLine)
				}
				i++
			}

			// Add text lines
			for _, textLine := range textLines {
				srtLines = append(srtLines, textLine)
			}

			// Add empty line between subtitles
			srtLines = append(srtLines, "")
		}
	}

	return strings.Join(srtLines, "\n")
}

// ExtractMediaTracks manually extracts subtitle and audio tracks for a media file
func ExtractMediaTracks(mediaService *services.MediaService, scanner interface{}) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid media ID"})
			return
		}

		// Get the media file
		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Check if file exists
		if _, err := os.Stat(media.FilePath); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media file not found on disk"})
			return
		}

		log.Printf("🎬 Manually extracting tracks for: %s", media.Title)

		// Extract tracks using ffprobe
		cmd := exec.Command("ffprobe",
			"-v", "quiet",
			"-print_format", "json",
			"-show_streams",
			media.FilePath)

		output, err := cmd.Output()
		if err != nil {
			log.Printf("⚠️ Failed to extract stream info for %s: %v", media.Title, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to analyze media file"})
			return
		}

		var probeData struct {
			Streams []struct {
				Index       int    `json:"index"`
				CodecType   string `json:"codec_type"`
				CodecName   string `json:"codec_name"`
				Language    string `json:"tags.language"`
				Title       string `json:"tags.title"`
				Disposition struct {
					Default int `json:"default"`
					Forced  int `json:"forced"`
					Hearing int `json:"hearing_impaired"`
				} `json:"disposition"`
				Tags struct {
					Language string `json:"language"`
					Title    string `json:"title"`
				} `json:"tags"`
			} `json:"streams"`
		}

		if err := json.Unmarshal(output, &probeData); err != nil {
			log.Printf("⚠️ Failed to parse stream info for %s: %v", media.Title, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse media information"})
			return
		}

		// Process subtitle streams
		var subtitleTracks []models.SubtitleTrack
		var audioTracks []models.AudioTrack

		for _, stream := range probeData.Streams {
			if stream.CodecType == "subtitle" {
				language := stream.Tags.Language
				if language == "" {
					language = stream.Language
				}
				if language == "" {
					language = "unknown"
				}

				title := stream.Tags.Title
				if title == "" {
					title = fmt.Sprintf("Subtitle Track %d", stream.Index)
				}

				subtitleTrack := models.SubtitleTrack{
					MediaID:     media.ID,
					StreamIndex: stream.Index,
					Language:    language,
					Title:       title,
					CodecName:   stream.CodecName,
					IsDefault:   stream.Disposition.Default == 1,
					IsForced:    stream.Disposition.Forced == 1,
					IsHearing:   stream.Disposition.Hearing == 1,
					TrackType:   "internal",
				}
				subtitleTracks = append(subtitleTracks, subtitleTrack)

				log.Printf("📝 Found internal subtitle: %s (%s) - %s", language, stream.CodecName, title)
			} else if stream.CodecType == "audio" {
				language := stream.Tags.Language
				if language == "" {
					language = stream.Language
				}
				if language == "" {
					language = "unknown"
				}

				title := stream.Tags.Title
				if title == "" {
					title = fmt.Sprintf("Audio Track %d", stream.Index)
				}

				audioTrack := models.AudioTrack{
					MediaID:     media.ID,
					StreamIndex: stream.Index,
					Language:    language,
					Title:       title,
					CodecName:   stream.CodecName,
					IsDefault:   stream.Disposition.Default == 1,
					TrackType:   "internal",
				}
				audioTracks = append(audioTracks, audioTrack)

				log.Printf("🎵 Found audio track: %s (%s) - %s", language, stream.CodecName, title)
			}
		}

		// Save tracks to database
		var results = gin.H{
			"media_id":        media.ID,
			"title":           media.Title,
			"subtitle_tracks": len(subtitleTracks),
			"audio_tracks":    len(audioTracks),
		}

		if len(subtitleTracks) > 0 {
			if err := mediaService.SaveSubtitleTracks(media.ID, subtitleTracks); err != nil {
				log.Printf("⚠️ Failed to save subtitle tracks for %s: %v", media.Title, err)
				results["subtitle_error"] = err.Error()
			} else {
				log.Printf("✅ Saved %d subtitle tracks for %s", len(subtitleTracks), media.Title)
				results["subtitle_success"] = true
			}
		}

		if len(audioTracks) > 0 {
			if err := mediaService.SaveAudioTracks(media.ID, audioTracks); err != nil {
				log.Printf("⚠️ Failed to save audio tracks for %s: %v", media.Title, err)
				results["audio_error"] = err.Error()
			} else {
				log.Printf("✅ Saved %d audio tracks for %s", len(audioTracks), media.Title)
				results["audio_success"] = true
			}
		}

		c.JSON(http.StatusOK, results)
	}
}

// GetCastImages returns cast and crew images for a media item using TMDB
func GetCastImages(mediaService *services.MediaService, tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
			return
		}

		// Get the media item to extract title and year
		media, err := mediaService.GetMediaByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
			return
		}

		// Clean the title for TMDB search
		cleanTitle := tmdbService.CleanTitle(media.Title)
		searchTitle := tmdbService.RemoveYearFromTitle(cleanTitle)

		log.Printf("🎭 Fetching cast images for: '%s' (original: '%s')", searchTitle, media.Title)

		// Try to get cast images from TMDB
		castMembers, crewMembers, err := tmdbService.GetCastImages(searchTitle, media.Year)
		if err != nil {
			// If that fails, try with the original title
			log.Printf("⚠️ First attempt failed, trying with original title: %v", err)
			castMembers, crewMembers, err = tmdbService.GetCastImages(media.Title, media.Year)
			if err != nil {
				log.Printf("❌ Failed to get cast images: %v", err)
				c.JSON(http.StatusNotFound, gin.H{
					"error": "Cast images not found",
					"cast":  []interface{}{},
					"crew":  []interface{}{},
				})
				return
			}
		}

		log.Printf("✅ Found %d cast members and %d crew members with images",
			len(castMembers), len(crewMembers))

		c.JSON(http.StatusOK, gin.H{
			"cast": castMembers,
			"crew": crewMembers,
		})
	}
}

// GetSeriesCastImages returns cast and crew images for a TV series using TMDB
func GetSeriesCastImages(mediaService *services.MediaService, tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid series ID"})
			return
		}

		// Get the series item to extract title and year
		series, err := mediaService.GetSeriesByID(uint(id))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Series not found"})
			return
		}

		// Clean the title for TMDB search
		cleanTitle := tmdbService.CleanTitle(series.Title)
		searchTitle := tmdbService.RemoveYearFromTitle(cleanTitle)

		log.Printf("🎭 Fetching cast images for TV series: '%s'", searchTitle)

		// Try to get cast images from TMDB
		castMembers, crewMembers, err := tmdbService.GetCastImages(searchTitle, series.Year)
		if err != nil {
			// If that fails, try with the original title
			castMembers, crewMembers, err = tmdbService.GetCastImages(series.Title, series.Year)
			if err != nil {
				log.Printf("❌ Failed to get series cast images: %v", err)
				c.JSON(http.StatusNotFound, gin.H{
					"error": "Cast images not found",
					"cast":  []interface{}{},
					"crew":  []interface{}{},
				})
				return
			}
		}

		log.Printf("✅ Found %d cast members and %d crew members with images for series",
			len(castMembers), len(crewMembers))

		c.JSON(http.StatusOK, gin.H{
			"cast": castMembers,
			"crew": crewMembers,
		})
	}
}

// Cache for upcoming movies (in-memory cache with 24-hour expiration)
var (
	upcomingMoviesCache     *services.UpcomingMoviesResponse
	upcomingMoviesCacheTime time.Time
)

// SearchTMDB searches TMDB for movies and TV shows
func SearchTMDB(tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := c.Query("q")
		if query == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Search query is required"})
			return
		}

		// Get page parameter (default to 1)
		page := 1
		if pageStr := c.Query("page"); pageStr != "" {
			if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
				page = p
			}
		}

		// Get type parameter (default to "multi" for both movies and TV)
		searchType := c.DefaultQuery("type", "multi")

		log.Printf("🔍 TMDB Search: query='%s', type='%s', page=%d", query, searchType, page)

		switch searchType {
		case "movie":
			results, err := tmdbService.SearchMoviesOnly(query, page)
			if err != nil {
				log.Printf("❌ TMDB movie search failed: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "Failed to search movies",
					"details": err.Error(),
				})
				return
			}
			c.JSON(http.StatusOK, results)

		case "tv":
			results, err := tmdbService.SearchTVOnly(query, page)
			if err != nil {
				log.Printf("❌ TMDB TV search failed: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "Failed to search TV shows",
					"details": err.Error(),
				})
				return
			}
			c.JSON(http.StatusOK, results)

		default: // "multi" or any other value
			results, err := tmdbService.SearchMulti(query, page)
			if err != nil {
				log.Printf("❌ TMDB multi search failed: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":   "Failed to search TMDB",
					"details": err.Error(),
				})
				return
			}
			c.JSON(http.StatusOK, results)
		}

		log.Printf("✅ TMDB search completed for query: '%s'", query)
	}
}

// SearchTMDBSuggestions provides quick search suggestions (limited results for autocomplete)
func SearchTMDBSuggestions(tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		query := c.Query("q")
		if query == "" {
			c.JSON(http.StatusOK, gin.H{
				"results":       []interface{}{},
				"total_results": 0,
			})
			return
		}

		// For suggestions, we only need the first page and limit results
		results, err := tmdbService.SearchMulti(query, 1)
		if err != nil {
			log.Printf("❌ TMDB suggestions search failed: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to get suggestions",
				"details": err.Error(),
			})
			return
		}

		// Limit to top 5 results for suggestions
		limitedResults := results.Results
		if len(limitedResults) > 5 {
			limitedResults = limitedResults[:5]
		}

		c.JSON(http.StatusOK, gin.H{
			"results":       limitedResults,
			"total_results": len(limitedResults),
		})

		log.Printf("✅ TMDB suggestions completed for query: '%s' (%d results)", query, len(limitedResults))
	}
}

// GetTMDBMovieDetails gets detailed information for a TMDB movie or TV series
func GetTMDBMovieDetails(tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid movie/TV ID",
			})
			return
		}

		// Get media type from query parameter (default to trying both)
		mediaType := c.Query("type")

		// If media type is specified, use it directly
		if mediaType == "movie" {
			movieDetails, err := tmdbService.GetMovieDetailsWithExtras(id)
			if err != nil {
				log.Printf("❌ TMDB movie details failed for ID %d: %v", id, err)
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "Movie not found",
					"details": err.Error(),
				})
				return
			}
			c.JSON(http.StatusOK, gin.H{
				"media_type": "movie",
				"data":       movieDetails,
			})
			log.Printf("✅ TMDB movie details retrieved for ID: %d", id)
			return
		}

		if mediaType == "tv" {
			tvDetails, err := tmdbService.GetTVDetails(id)
			if err != nil {
				log.Printf("❌ TMDB TV details failed for ID %d: %v", id, err)
				c.JSON(http.StatusNotFound, gin.H{
					"error":   "TV series not found",
					"details": err.Error(),
				})
				return
			}
			c.JSON(http.StatusOK, gin.H{
				"media_type": "tv",
				"data":       tvDetails,
			})
			log.Printf("✅ TMDB TV details retrieved for ID: %d", id)
			return
		}

		// If no media type specified, try both (fallback for backward compatibility)
		// First, try to get movie details
		movieDetails, movieErr := tmdbService.GetMovieDetailsWithExtras(id)
		if movieErr == nil {
			// Successfully got movie details
			c.JSON(http.StatusOK, gin.H{
				"media_type": "movie",
				"data":       movieDetails,
			})
			log.Printf("✅ TMDB movie details retrieved for ID: %d", id)
			return
		}

		// If movie failed, try TV series details
		tvDetails, tvErr := tmdbService.GetTVDetails(id)
		if tvErr == nil {
			// Successfully got TV details
			c.JSON(http.StatusOK, gin.H{
				"media_type": "tv",
				"data":       tvDetails,
			})
			log.Printf("✅ TMDB TV details retrieved for ID: %d", id)
			return
		}

		// Both failed
		log.Printf("❌ TMDB details failed for ID %d - Movie error: %v, TV error: %v", id, movieErr, tvErr)
		c.JSON(http.StatusNotFound, gin.H{
			"error":       "Movie or TV series not found",
			"movie_error": movieErr.Error(),
			"tv_error":    tvErr.Error(),
		})
	}
}

// GetUpcomingMovies gets upcoming movies from TMDB
func GetUpcomingMovies(tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		movies, err := tmdbService.GetUpcomingMovies()
		if err != nil {
			log.Printf("❌ Failed to get upcoming movies: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to get upcoming movies",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, movies)
		log.Printf("✅ Retrieved upcoming movies")
	}
}

// GetUpcomingTVSeries gets TV series (airing today, on the air, trending) from TMDB
func GetUpcomingTVSeries(tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		tvSeries, err := tmdbService.GetUpcomingTVSeries()
		if err != nil {
			log.Printf("❌ Failed to get TV series: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to get TV series",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, tvSeries)
		log.Printf("✅ Retrieved TV series: %d airing today, %d on the air, %d trending daily, %d trending weekly",
			len(tvSeries.AiringToday), len(tvSeries.OnTheAir), len(tvSeries.TrendingDaily), len(tvSeries.TrendingWeekly))
	}
}

// GetLatestMovie gets the most recently added movie from TMDB
func GetLatestMovie(tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		movie, err := tmdbService.GetLatestMovie()
		if err != nil {
			log.Printf("❌ Failed to get latest movie: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to get latest movie",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, movie)
		log.Printf("✅ Retrieved latest movie: %s (ID: %d)", movie.Title, movie.ID)
	}
}

// GetNowPlayingMoviesList gets movies currently in theaters from TMDB
func GetNowPlayingMoviesList(tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get page parameter (default to 1)
		page := 1
		if pageStr := c.Query("page"); pageStr != "" {
			if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
				page = p
			}
		}

		movies, err := tmdbService.GetNowPlayingMovies(page)
		if err != nil {
			log.Printf("❌ Failed to get now playing movies: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to get now playing movies",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"results":       movies,
			"page":          page,
			"total_results": len(movies),
		})
		log.Printf("✅ Retrieved %d now playing movies (page %d)", len(movies), page)
	}
}

// GetUpcomingMoviesList gets upcoming movie releases from TMDB
func GetUpcomingMoviesList(tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get page parameter (default to 1)
		page := 1
		if pageStr := c.Query("page"); pageStr != "" {
			if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
				page = p
			}
		}

		movies, err := tmdbService.GetUpcomingMoviesList(page)
		if err != nil {
			log.Printf("❌ Failed to get upcoming movies: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to get upcoming movies",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"results":       movies,
			"page":          page,
			"total_results": len(movies),
		})
		log.Printf("✅ Retrieved %d upcoming movies (page %d)", len(movies), page)
	}
}

// GetPopularMoviesList gets currently popular movies from TMDB
func GetPopularMoviesList(tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get page parameter (default to 1)
		page := 1
		if pageStr := c.Query("page"); pageStr != "" {
			if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
				page = p
			}
		}

		movies, err := tmdbService.GetPopularMovies(page)
		if err != nil {
			log.Printf("❌ Failed to get popular movies: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to get popular movies",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"results":       movies,
			"page":          page,
			"total_results": len(movies),
		})
		log.Printf("✅ Retrieved %d popular movies (page %d)", len(movies), page)
	}
}

// DiscoverMoviesByFilters provides advanced filtered/sorted movie discovery
func DiscoverMoviesByFilters(tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Extract all query parameters as a map
		params := make(map[string]string)
		for key, values := range c.Request.URL.Query() {
			if len(values) > 0 {
				params[key] = values[0]
			}
		}

		log.Printf("🔍 TMDB Discover: %d filter parameters", len(params))

		movies, err := tmdbService.DiscoverMovies(params)
		if err != nil {
			log.Printf("❌ Failed to discover movies: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to discover movies",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"results":       movies,
			"total_results": len(movies),
			"filters":       params,
		})
		log.Printf("✅ Discovered %d movies with filters", len(movies))
	}
}

// GetMovieImagesList gets posters, backdrops, and logos for a movie
func GetMovieImagesList(tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid movie ID",
			})
			return
		}

		images, err := tmdbService.GetMovieImages(id)
		if err != nil {
			log.Printf("❌ Failed to get movie images for ID %d: %v", id, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to get movie images",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, images)
		log.Printf("✅ Retrieved images for movie %d: %d backdrops, %d logos, %d posters",
			id, len(images.Backdrops), len(images.Logos), len(images.Posters))
	}
}

// GetRelatedMedia gets related movies or TV shows from TMDB
func GetRelatedMedia(tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid media ID",
			})
			return
		}

		// Get media type from query parameter (required)
		mediaType := c.Query("type")
		if mediaType == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Media type is required (movie or tv)",
			})
			return
		}

		if mediaType != "movie" && mediaType != "tv" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Media type must be 'movie' or 'tv'",
			})
			return
		}

		// Get limit from query parameter (default to 20)
		limit := 20
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 50 {
				limit = l
			}
		}

		// Get optional year parameter for year-based filtering
		releaseYear := 0
		if yearStr := c.Query("year"); yearStr != "" {
			if y, err := strconv.Atoi(yearStr); err == nil && y > 1800 && y <= 2100 {
				releaseYear = y
			}
		}

		if releaseYear > 0 {
			log.Printf("🔍 TMDB Related Media: ID=%d, type=%s, limit=%d, year=%d", id, mediaType, limit, releaseYear)
		} else {
			log.Printf("🔍 TMDB Related Media: ID=%d, type=%s, limit=%d", id, mediaType, limit)
		}

		relatedMedia, err := tmdbService.GetRelatedMedia(id, mediaType, limit, releaseYear)
		if err != nil {
			log.Printf("❌ TMDB related media failed for ID %d (%s): %v", id, mediaType, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to get related media",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"results":       relatedMedia,
			"total_results": len(relatedMedia),
			"media_type":    mediaType,
			"media_id":      id,
		})

		log.Printf("✅ TMDB related media retrieved: %d items for %s ID %d", len(relatedMedia), mediaType, id)
	}
}

// GetSimilarMovies gets similar movies from TMDB
func GetSimilarMovies(tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid movie ID",
			})
			return
		}

		// Get page parameter (default to 1)
		page := 1
		if pageStr := c.Query("page"); pageStr != "" {
			if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
				page = p
			}
		}

		similar, err := tmdbService.GetSimilarMovies(id, page)
		if err != nil {
			log.Printf("❌ TMDB similar movies failed for ID %d: %v", id, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to get similar movies",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, similar)
		log.Printf("✅ TMDB similar movies retrieved for ID: %d", id)
	}
}

// GetRecommendedMovies gets recommended movies from TMDB
func GetRecommendedMovies(tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid movie ID",
			})
			return
		}

		// Get page parameter (default to 1)
		page := 1
		if pageStr := c.Query("page"); pageStr != "" {
			if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
				page = p
			}
		}

		recommended, err := tmdbService.GetRecommendedMovies(id, page)
		if err != nil {
			log.Printf("❌ TMDB recommended movies failed for ID %d: %v", id, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to get recommended movies",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, recommended)
		log.Printf("✅ TMDB recommended movies retrieved for ID: %d", id)
	}
}

// GetSimilarTVShows gets similar TV shows from TMDB
func GetSimilarTVShows(tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid TV show ID",
			})
			return
		}

		// Get page parameter (default to 1)
		page := 1
		if pageStr := c.Query("page"); pageStr != "" {
			if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
				page = p
			}
		}

		similar, err := tmdbService.GetSimilarTVShows(id, page)
		if err != nil {
			log.Printf("❌ TMDB similar TV shows failed for ID %d: %v", id, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to get similar TV shows",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, similar)
		log.Printf("✅ TMDB similar TV shows retrieved for ID: %d", id)
	}
}

// GetRecommendedTVShows gets recommended TV shows from TMDB
func GetRecommendedTVShows(tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		idStr := c.Param("id")
		id, err := strconv.Atoi(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid TV show ID",
			})
			return
		}

		// Get page parameter (default to 1)
		page := 1
		if pageStr := c.Query("page"); pageStr != "" {
			if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
				page = p
			}
		}

		recommended, err := tmdbService.GetRecommendedTVShows(id, page)
		if err != nil {
			log.Printf("❌ TMDB recommended TV shows failed for ID %d: %v", id, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "Failed to get recommended TV shows",
				"details": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, recommended)
		log.Printf("✅ TMDB recommended TV shows retrieved for ID: %d", id)
	}
}

// UpdateLocalMediaWithTMDB updates local media items with TMDB backdrop and trailer URLs
func UpdateLocalMediaWithTMDB(mediaService *services.MediaService, tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		log.Printf("🎬 Starting TMDB update for local media...")

		// Check if this is a single media update request
		var requestBody struct {
			MediaID     uint   `json:"mediaId"`
			SearchTitle string `json:"searchTitle"`
			UpdateType  string `json:"updateType"`
		}

		// Try to parse request body for single media update
		if err := c.ShouldBindJSON(&requestBody); err == nil && requestBody.MediaID > 0 {
			// Single media update
			log.Printf("🎯 Single media update requested for ID: %d", requestBody.MediaID)

			media, err := mediaService.GetMediaByID(requestBody.MediaID)
			if err != nil {
				log.Printf("❌ Failed to get media by ID %d: %v", requestBody.MediaID, err)
				c.JSON(http.StatusNotFound, gin.H{"error": "Media not found"})
				return
			}

			// Use custom search title if provided
			searchTitle := requestBody.SearchTitle
			if searchTitle == "" {
				searchTitle = media.Title
			}

			// Update single media
			backdropURL, trailerURL, err := updateSingleMediaWithTMDB(media, searchTitle, tmdbService)
			if err != nil {
				log.Printf("❌ Failed to update media: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}

			// Save updates
			media.TMDBBackdropURL = backdropURL
			media.TMDBTrailerURL = trailerURL

			if err := mediaService.UpdateMedia(media); err != nil {
				log.Printf("❌ Failed to save media updates: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save updates"})
				return
			}

			log.Printf("✅ Updated single media '%s' - Backdrop: %t, Trailer: %t",
				media.Title, backdropURL != "", trailerURL != "")

			c.JSON(http.StatusOK, gin.H{
				"message":      "Media updated successfully",
				"backdrop_url": backdropURL,
				"trailer_url":  trailerURL,
				"updated":      1,
				"total":        1,
			})
			return
		}

		// Bulk update for all media
		log.Printf("📦 Bulk update requested for all media")

		// Get all movies and TV shows (not episodes)
		allMedia, err := mediaService.GetAllMedia()
		if err != nil {
			log.Printf("❌ Failed to get media: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get media"})
			return
		}

		// Filter for movies and TV shows only (not episodes)
		var mediaToUpdate []models.Media
		for _, media := range allMedia {
			if media.Type == "movie" || (media.Type == "episode" && media.SeriesID == nil) {
				// Include movies and standalone videos that might be movies/shows
				mediaToUpdate = append(mediaToUpdate, media)
			}
		}

		log.Printf("🔍 Found %d media items to potentially update with TMDB data", len(mediaToUpdate))

		var updated int
		var errors []string

		for _, media := range mediaToUpdate {
			// Skip if already has TMDB data
			if media.TMDBBackdropURL != "" && media.TMDBTrailerURL != "" {
				log.Printf("⏭️ Skipping %s - already has TMDB data", media.Title)
				continue
			}

			// Use the helper function to update this media
			backdropURL, trailerURL, err := updateSingleMediaWithTMDB(&media, media.Title, tmdbService)
			if err != nil {
				log.Printf("❌ Failed to update media '%s': %v", media.Title, err)
				errors = append(errors, fmt.Sprintf("Media '%s': %v", media.Title, err))
				continue
			}

			// Update media with TMDB data if we got any
			if backdropURL != "" || trailerURL != "" {
				media.TMDBBackdropURL = backdropURL
				media.TMDBTrailerURL = trailerURL

				if err := mediaService.UpdateMedia(&media); err != nil {
					log.Printf("❌ Failed to save media '%s': %v", media.Title, err)
					errors = append(errors, fmt.Sprintf("Save failed for '%s': %v", media.Title, err))
					continue
				}

				updated++
				log.Printf("✅ Updated '%s' - Backdrop: %t, Trailer: %t",
					media.Title, backdropURL != "", trailerURL != "")
			} else {
				log.Printf("⚠️ No TMDB data found for '%s'", media.Title)
			}
		}

		log.Printf("🎬 TMDB update completed: %d updated, %d errors", updated, len(errors))

		response := gin.H{
			"message": "TMDB update completed",
			"updated": updated,
			"total":   len(mediaToUpdate),
		}

		if len(errors) > 0 {
			response["errors"] = errors
		}

		c.JSON(http.StatusOK, response)
	}
}

// updateSingleMediaWithTMDB updates a single media item with TMDB data
func updateSingleMediaWithTMDB(media *models.Media, searchTitle string, tmdbService *services.TMDBService) (backdropURL, trailerURL string, err error) {
	log.Printf("🔍 Processing single media: %s", searchTitle)

	// Clean the title by removing year for better TMDB search
	cleanTitle := tmdbService.RemoveYearFromTitle(searchTitle)
	log.Printf("🧹 Cleaned title: '%s' -> '%s'", searchTitle, cleanTitle)

	if media.Type == "movie" {
		// Search for movie
		movie, err := tmdbService.SearchMovie(cleanTitle, media.Year)
		if err != nil {
			return "", "", fmt.Errorf("TMDB search failed for movie '%s': %v", searchTitle, err)
		}

		// Get backdrop URL
		if movie.BackdropPath != "" {
			backdropURL = "https://image.tmdb.org/t/p/w1280" + movie.BackdropPath
		}

		// Get detailed info with videos for trailer
		details, err := tmdbService.GetMovieDetailsWithExtras(movie.ID)
		if err != nil {
			log.Printf("⚠️ Failed to get movie details with videos for '%s': %v", searchTitle, err)
		} else {
			// Extract trailer URL
			trailerURL = extractMovieTrailerURL(details)
		}

		log.Printf("🎬 Movie TMDB data - Backdrop: %t, Trailer: %t", backdropURL != "", trailerURL != "")

	} else {
		// Try as TV show
		tv, err := tmdbService.SearchTV(cleanTitle, media.Year)
		if err != nil {
			return "", "", fmt.Errorf("TMDB search failed for TV show '%s': %v", searchTitle, err)
		}

		// Get backdrop URL
		if tv.BackdropPath != "" {
			backdropURL = "https://image.tmdb.org/t/p/w1280" + tv.BackdropPath
		}

		// Get detailed info with videos for trailer
		details, err := tmdbService.GetTVDetails(tv.ID)
		if err != nil {
			log.Printf("⚠️ Failed to get TV details for '%s': %v", searchTitle, err)
		} else {
			// Extract trailer URL
			trailerURL = extractTVTrailerURL(details)
		}

		log.Printf("📺 TV TMDB data - Backdrop: %t, Trailer: %t", backdropURL != "", trailerURL != "")
	}

	return backdropURL, trailerURL, nil
}

// extractMovieTrailerURL extracts trailer URL from movie details
func extractMovieTrailerURL(details *services.TMDBMovieDetailsWithExtras) string {
	if details == nil || len(details.Videos.Results) == 0 {
		return ""
	}

	// Look for official trailers first, then any trailers
	for _, video := range details.Videos.Results {
		if video.Site == "YouTube" && video.Key != "" {
			if video.Type == "Trailer" && video.Official {
				return fmt.Sprintf("https://www.youtube.com/watch?v=%s", video.Key)
			}
		}
	}

	// Fallback to any trailer
	for _, video := range details.Videos.Results {
		if video.Site == "YouTube" && video.Key != "" && video.Type == "Trailer" {
			return fmt.Sprintf("https://www.youtube.com/watch?v=%s", video.Key)
		}
	}

	return ""
}

// extractTVTrailerURL extracts trailer URL from TV show details
func extractTVTrailerURL(details *services.TMDBTVDetails) string {
	if details == nil || len(details.Videos.Results) == 0 {
		return ""
	}

	// Look for official trailers first, then any trailers
	for _, video := range details.Videos.Results {
		if video.Site == "YouTube" && video.Key != "" {
			if video.Type == "Trailer" && video.Official {
				return fmt.Sprintf("https://www.youtube.com/watch?v=%s", video.Key)
			}
		}
	}

	// Fallback to any trailer
	for _, video := range details.Videos.Results {
		if video.Site == "YouTube" && video.Key != "" && video.Type == "Trailer" {
			return fmt.Sprintf("https://www.youtube.com/watch?v=%s", video.Key)
		}
	}

	return ""
}

// convertMovieDetailsToMetadata converts TMDB movie details to MediaMetadata
func convertMovieDetailsToMetadata(movieDetails *services.TMDBMovieDetailsWithExtras) *interfaces.MediaMetadata {
	if movieDetails == nil {
		return nil
	}

	// Extract cast (stars) - top 5 for stars, more for full cast
	var stars []string
	var cast []string
	for i, castMember := range movieDetails.Credits.Cast {
		if i < 5 { // Top 5 stars
			stars = append(stars, castMember.Name)
		}
		if i < 15 { // Top 15 for full cast
			cast = append(cast, fmt.Sprintf("%s (%s)", castMember.Name, castMember.Character))
		}
	}

	// Extract crew by roles
	var directors []string
	var writers []string
	var producers []string
	var crew []string

	for _, crewMember := range movieDetails.Credits.Crew {
		switch crewMember.Job {
		case "Director":
			directors = append(directors, crewMember.Name)
		case "Writer", "Screenplay", "Story":
			writers = append(writers, crewMember.Name)
		case "Producer", "Executive Producer":
			producers = append(producers, crewMember.Name)
		case "Director of Photography", "Cinematography", "Music", "Editor":
			crew = append(crew, fmt.Sprintf("%s (%s)", crewMember.Name, crewMember.Job))
		}
	}

	// Extract genres
	var genres []string
	for _, genre := range movieDetails.Genres {
		genres = append(genres, genre.Name)
	}

	// Extract country
	var country string
	if len(movieDetails.ProductionCountries) > 0 {
		country = movieDetails.ProductionCountries[0].Name
	}

	// Extract language
	var language string
	if len(movieDetails.SpokenLanguages) > 0 {
		language = movieDetails.SpokenLanguages[0].Name
	}

	// Extract year from release date
	releaseYear := 0
	if movieDetails.ReleaseDate != "" {
		if parsedTime, err := time.Parse("2006-01-02", movieDetails.ReleaseDate); err == nil {
			releaseYear = parsedTime.Year()
		}
	}

	// Build poster and backdrop URLs
	posterURL := ""
	if movieDetails.PosterPath != "" {
		posterURL = "https://image.tmdb.org/t/p/w500" + movieDetails.PosterPath
	}

	backdropURL := ""
	if movieDetails.BackdropPath != "" {
		backdropURL = "https://image.tmdb.org/t/p/w1280" + movieDetails.BackdropPath
	}

	// Extract trailer URL from videos
	trailerURL := ""
	if len(movieDetails.Videos.Results) > 0 {
		// Look for official trailers first, then any trailers
		var foundTrailer *services.TMDBVideo
		var fallbackTrailer *services.TMDBVideo

		for _, video := range movieDetails.Videos.Results {
			if video.Site == "YouTube" && video.Key != "" {
				if video.Type == "Trailer" {
					if video.Official {
						// Official trailer is the best option
						foundTrailer = &video
						break
					} else if fallbackTrailer == nil {
						// Non-official trailer as fallback
						fallbackTrailer = &video
					}
				} else if video.Type == "Teaser" && fallbackTrailer == nil {
					// Teaser as last resort
					fallbackTrailer = &video
				}
			}
		}

		// Use the best trailer found
		if foundTrailer != nil {
			trailerURL = fmt.Sprintf("https://www.youtube.com/watch?v=%s", foundTrailer.Key)
		} else if fallbackTrailer != nil {
			trailerURL = fmt.Sprintf("https://www.youtube.com/watch?v=%s", fallbackTrailer.Key)
		}
	}

	// Format box office information
	boxOffice := ""
	if movieDetails.Revenue > 0 {
		if movieDetails.Revenue >= 1000000000 {
			boxOffice = fmt.Sprintf("$%.1fB", float64(movieDetails.Revenue)/1000000000)
		} else if movieDetails.Revenue >= 1000000 {
			boxOffice = fmt.Sprintf("$%.1fM", float64(movieDetails.Revenue)/1000000)
		} else if movieDetails.Revenue >= 1000 {
			boxOffice = fmt.Sprintf("$%.1fK", float64(movieDetails.Revenue)/1000)
		} else {
			boxOffice = fmt.Sprintf("$%d", movieDetails.Revenue)
		}
	}

	// Collection information
	collection := ""
	if movieDetails.BelongsToCollection != nil {
		collection = movieDetails.BelongsToCollection.Name
	}

	return &interfaces.MediaMetadata{
		Title:       movieDetails.Title,
		Tagline:     movieDetails.Tagline,
		ShortDesc:   truncateDescription(movieDetails.Overview, 150),
		LongDesc:    movieDetails.Overview,
		Description: movieDetails.Overview,
		Year:        releaseYear,
		Stars:       stars,
		Directors:   directors,
		Country:     country,
		Language:    language,
		Quality:     "HD", // Default quality
		Rating:      movieDetails.VoteAverage,
		Genres:      genres,
		PosterURL:   posterURL,
		BackdropURL: backdropURL,
		TrailerURL:  trailerURL,
		Runtime:     movieDetails.Runtime,
		// Enhanced metadata
		Budget:     movieDetails.Budget,
		Revenue:    movieDetails.Revenue,
		BoxOffice:  boxOffice,
		Status:     movieDetails.Status,
		IMDBID:     movieDetails.IMDBID,
		Homepage:   movieDetails.Homepage,
		Collection: collection,
		Cast:       cast,
		Crew:       crew,
		Writers:    writers,
		Producers:  producers,
		// Additional fields
		Popularity: movieDetails.Popularity,
		VoteCount:  movieDetails.VoteCount,
		Adult:      movieDetails.Adult,
	}
}

// convertTVDetailsToMetadata converts TMDB TV details to MediaMetadata
func convertTVDetailsToMetadata(tvDetails *services.TMDBTVDetails) *interfaces.MediaMetadata {
	if tvDetails == nil {
		return nil
	}

	// Extract cast (stars) - top 5 for stars, more for full cast
	var stars []string
	var cast []string
	for i, castMember := range tvDetails.Credits.Cast {
		if i < 5 { // Top 5 stars
			stars = append(stars, castMember.Name)
		}
		if i < 15 { // Top 15 for full cast
			cast = append(cast, fmt.Sprintf("%s (%s)", castMember.Name, castMember.Character))
		}
	}

	// Extract crew by roles
	var directors []string
	var writers []string
	var producers []string
	var crew []string

	for _, crewMember := range tvDetails.Credits.Crew {
		switch crewMember.Job {
		case "Director":
			directors = append(directors, crewMember.Name)
		case "Writer", "Screenplay", "Story":
			writers = append(writers, crewMember.Name)
		case "Producer", "Executive Producer":
			producers = append(producers, crewMember.Name)
		case "Director of Photography", "Cinematography", "Music", "Editor":
			crew = append(crew, fmt.Sprintf("%s (%s)", crewMember.Name, crewMember.Job))
		}
	}

	// Extract genres
	var genres []string
	for _, genre := range tvDetails.Genres {
		genres = append(genres, genre.Name)
	}

	// Extract country
	var country string
	if len(tvDetails.ProductionCountries) > 0 {
		country = tvDetails.ProductionCountries[0].Name
	}

	// Extract language
	var language string
	if len(tvDetails.SpokenLanguages) > 0 {
		language = tvDetails.SpokenLanguages[0].Name
	}

	// Extract year from first air date
	releaseYear := 0
	if tvDetails.FirstAirDate != "" {
		if parsedTime, err := time.Parse("2006-01-02", tvDetails.FirstAirDate); err == nil {
			releaseYear = parsedTime.Year()
		}
	}

	// Build poster and backdrop URLs
	posterURL := ""
	if tvDetails.PosterPath != "" {
		posterURL = "https://image.tmdb.org/t/p/w500" + tvDetails.PosterPath
	}

	backdropURL := ""
	if tvDetails.BackdropPath != "" {
		backdropURL = "https://image.tmdb.org/t/p/w1280" + tvDetails.BackdropPath
	}

	// Extract trailer URL from videos
	trailerURL := ""
	if len(tvDetails.Videos.Results) > 0 {
		// Look for official trailers first, then any trailers
		var foundTrailer *services.TMDBVideo
		var fallbackTrailer *services.TMDBVideo

		for _, video := range tvDetails.Videos.Results {
			if video.Site == "YouTube" && video.Key != "" {
				if video.Type == "Trailer" {
					if video.Official {
						// Official trailer is the best option
						foundTrailer = &video
						break
					} else if fallbackTrailer == nil {
						// Non-official trailer as fallback
						fallbackTrailer = &video
					}
				} else if video.Type == "Teaser" && fallbackTrailer == nil {
					// Teaser as last resort
					fallbackTrailer = &video
				}
			}
		}

		// Use the best trailer found
		if foundTrailer != nil {
			trailerURL = fmt.Sprintf("https://www.youtube.com/watch?v=%s", foundTrailer.Key)
		} else if fallbackTrailer != nil {
			trailerURL = fmt.Sprintf("https://www.youtube.com/watch?v=%s", fallbackTrailer.Key)
		}
	}

	// Calculate average runtime from episode run times
	runtime := 0
	if len(tvDetails.EpisodeRunTime) > 0 {
		total := 0
		for _, rt := range tvDetails.EpisodeRunTime {
			total += rt
		}
		runtime = total / len(tvDetails.EpisodeRunTime)
	}

	return &interfaces.MediaMetadata{
		Title:       tvDetails.Name,
		Tagline:     tvDetails.Tagline,
		ShortDesc:   truncateDescription(tvDetails.Overview, 150),
		LongDesc:    tvDetails.Overview,
		Description: tvDetails.Overview,
		Year:        releaseYear,
		Stars:       stars,
		Directors:   directors,
		Country:     country,
		Language:    language,
		Quality:     "HD", // Default quality
		Rating:      tvDetails.VoteAverage,
		Genres:      genres,
		PosterURL:   posterURL,
		BackdropURL: backdropURL,
		TrailerURL:  trailerURL,
		Runtime:     runtime,
		// TV-specific metadata
		Status:    tvDetails.Status,
		Homepage:  tvDetails.Homepage,
		Cast:      cast,
		Crew:      crew,
		Writers:   writers,
		Producers: producers,
		// Additional fields
		Popularity: tvDetails.Popularity,
		VoteCount:  tvDetails.VoteCount,
		Adult:      tvDetails.Adult,
	}
}

// truncateDescription truncates text to a specified length with ellipsis
func truncateDescription(text string, maxLength int) string {
	if len(text) <= maxLength {
		return text
	}

	// Find the last space before maxLength
	truncated := text[:maxLength]
	lastSpace := strings.LastIndex(truncated, " ")
	if lastSpace > 0 {
		truncated = truncated[:lastSpace]
	}

	return truncated + "..."
}
