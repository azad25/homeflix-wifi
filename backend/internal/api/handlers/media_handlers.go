package handlers

import (
	"net/http"
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