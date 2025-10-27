package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"
)

// Media Handlers

// trimYearFromTitle removes year in parentheses from the end of titles for frontend display
func trimYearFromTitle(title string) string {
	// Remove year in parentheses at the end: "Movie Title (2019)" -> "Movie Title"
	yearPattern := regexp.MustCompile(`\s*\(\d{4}\)\s*$`)
	return strings.TrimSpace(yearPattern.ReplaceAllString(title, ""))
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
		movies, err := mediaService.GetMovies()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, prepareMediaForResponse(movies))
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

// UpdateSeriesMetadata updates a TV series with new metadata
func UpdateSeriesMetadata(mediaService *services.MediaService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			log.Printf("❌ Invalid series ID: %s", c.Param("id"))
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid series ID"})
			return
		}

		var updates map[string]interface{}
		if err := c.BindJSON(&updates); err != nil {
			log.Printf("❌ Invalid request body for series %d: %v", id, err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
			return
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
func UpdateSeriesWithTMDB(mediaService *services.MediaService, tmdbService *services.TMDBService) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseUint(c.Param("id"), 10, 32)
		if err != nil {
			log.Printf("❌ Invalid series ID: %s", c.Param("id"))
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid series ID"})
			return
		}

		// Parse request body for search parameters
		var requestBody struct {
			SearchTitle    string   `json:"searchTitle"`
			PreserveFields []string `json:"preserveFields"`
		}
		if err := c.BindJSON(&requestBody); err != nil {
			log.Printf("❌ Invalid request body for series %d: %v", id, err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
			return
		}

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

		// For now, we'll create a simple TMDB update that preserves manual edits
		// In the future, we can implement full TMDB TV series metadata fetching
		updates := make(map[string]interface{})

		// Only update fields that aren't being preserved
		if !contains(requestBody.PreserveFields, "title") && requestBody.SearchTitle != "" {
			updates["title"] = requestBody.SearchTitle
		}

		// Add a note that this was updated via TMDB (for future full implementation)
		log.Printf("📝 TMDB update requested for series %s - preserving fields: %v", series.Title, requestBody.PreserveFields)

		// Update the series with any changes
		if len(updates) > 0 {
			updatedSeries, err := mediaService.UpdateSeries(uint(id), updates)
			if err != nil {
				log.Printf("❌ Failed to update series %d with TMDB data: %v", id, err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			series = updatedSeries
		}

		log.Printf("✅ Series TMDB update completed for: %s", series.Title)
		c.JSON(http.StatusOK, series)
	}
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
		
		// Get page and limit from query parameters with defaults
		page := 1
		limit := 50
		
		if pageStr := c.Query("page"); pageStr != "" {
			if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
				page = p
			}
		}
		
		if limitStr := c.Query("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
				limit = l
			}
		}
		
		media, err := mediaService.GetMediaByGenre(genre, page, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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

		// Use enhanced smart search
		results, err := performSmartSearch(mediaService, query)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Return results directly as array for frontend compatibility
		c.JSON(http.StatusOK, results)
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
				"id": media.ID,
				"title": media.Title,
				"type": media.Type,
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

	type searchResult struct {
		media interface{}
		score float64
		matchType string
	}

	var results []searchResult
	queryLower := strings.ToLower(strings.TrimSpace(query))
	queryWords := strings.Fields(queryLower)

	for _, media := range allMedia {
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
		if typeLower == queryLower || 
		   (queryLower == "movie" && typeLower == "movie") ||
		   (queryLower == "tv" && typeLower == "episode") ||
		   (queryLower == "series" && typeLower == "episode") ||
		   (queryLower == "show" && typeLower == "episode") {
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
					// Check if title contains this year
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
				media: media,
				score: score,
				matchType: strings.Join(matchTypes, ","),
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
		if media, ok := result.media.(models.Media); ok {
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
							"error": "Subtitle file not found on disk",
							"details": fmt.Sprintf("Checked paths: %s, %s", track.FilePath, alternativePath),
						})
						return
					}
				} else {
					c.JSON(http.StatusNotFound, gin.H{
						"error": "Subtitle file not found on disk",
						"path": track.FilePath,
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

// extractInternalSubtitle extracts internal subtitle track using ffmpeg
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
	
	// Extract subtitle using the correct stream index
	cmd := exec.Command("ffmpeg",
		"-v", "error", // Reduce verbosity but show errors
		"-i", videoPath,
		"-map", fmt.Sprintf("0:%d", actualStreamIndex), // Use absolute stream index
		"-c:s", "srt", // Convert to SRT format for web compatibility
		"-f", "srt",
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

	log.Printf("✅ Successfully extracted internal subtitle: %d bytes", len(output))
	return output, nil
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
		"-f", "srt",    // But force SRT container
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

// convertWebVTTToSRT converts WebVTT format to SRT format
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
			
			// Convert WebVTT timestamp format to SRT format
			// WebVTT: 00:00:01.000 --> 00:00:04.000
			// SRT:    00:00:01,000 --> 00:00:04,000
			srtTimestamp := strings.ReplaceAll(line, ".", ",")
			srtLines = append(srtLines, srtTimestamp)
			
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
				textLines = append(textLines, textLine)
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
					Default  int `json:"default"`
					Forced   int `json:"forced"`
					Hearing  int `json:"hearing_impaired"`
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
			"media_id": media.ID,
			"title": media.Title,
			"subtitle_tracks": len(subtitleTracks),
			"audio_tracks": len(audioTracks),
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

