package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"homeflix-backend/internal/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// WidgetDataHandlers handles widget data endpoints
type WidgetDataHandlers struct {
	db           *gorm.DB
	tmdbService  *services.TMDBService
}

// MediaResult represents a media item from the database
type MediaResult struct {
	ID                uint
	Title             string
	Type              string
	Description       string
	PosterPath        string
	BackdropPath      string
	TMDBBackdropURL   string
	TMDBPosterURL     string
	TMDBTrailerURL    string
	LogoPath          string
	TrailerPath       string
	Rating            float64
	Year              int
	Duration          int
	GenreNames        string
	ReleaseDate       string
	Tagline           string
	ViewCount         int
	Quality           string
	Popularity        float64
	VoteCount         int
	SeriesID          *uint
	FilePath          string
	PreviewPath       string
	PreviewClipPath   string
	TMDBID            int
}

// NewWidgetDataHandlers creates a new widget data handlers instance
func NewWidgetDataHandlers(db *gorm.DB, tmdbService *services.TMDBService) *WidgetDataHandlers {
	return &WidgetDataHandlers{
		db:          db,
		tmdbService: tmdbService,
	}
}

// WidgetContent represents content saved in widget config
type WidgetContent struct {
	ID        int    `json:"id"`
	Title     string `json:"title,omitempty"`
	Name      string `json:"name,omitempty"`
	Type      string `json:"type,omitempty"`
	MediaType string `json:"media_type,omitempty"`
	Source    string `json:"_source,omitempty"`
}

// WidgetConfigData represents the parsed widget config
type WidgetConfigData struct {
	SelectedContent []WidgetContent `json:"selectedContent"`
	SelectedGenres  []int           `json:"selectedGenres"`
	GenreFilter     []string        `json:"genreFilter"`
	// ...other config fields
}

// GetWidgetData retrieves data for a specific widget
func (h *WidgetDataHandlers) GetWidgetData(c *gin.Context) {
	widgetIDStr := c.Param("id")
	widgetID, err := strconv.ParseUint(widgetIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid widget ID"})
		return
	}

	// Get widget from database
	type Widget struct {
		ID     uint
		Config string
	}

	var widget Widget
	if err := h.db.Table("widgets").Where("id = ?", widgetID).First(&widget).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Widget not found"})
		return
	}

	// Parse widget config
	var configData WidgetConfigData
	if widget.Config != "" {
		if err := json.Unmarshal([]byte(widget.Config), &configData); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse widget config"})
			return
		}
	}

	// Fetch local content if selectedContent is present
	var results []map[string]interface{}

	if len(configData.SelectedContent) > 0 {
		results = h.getLocalContentByIDs(configData.SelectedContent)
	} else if len(configData.SelectedGenres) > 0 {
		results = h.getContentByGenres(configData.SelectedGenres, "local")
	} else if len(configData.GenreFilter) > 0 {
		results = h.getContentByGenreNames(configData.GenreFilter)
	} else {
		results = []map[string]interface{}{}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":   results,
		"count":  len(results),
		"config": configData,
	})
}

// getLocalContentByIDs retrieves specific local media items by their IDs
func (h *WidgetDataHandlers) getLocalContentByIDs(selectedContent []WidgetContent) []map[string]interface{} {
	if len(selectedContent) == 0 {
		return []map[string]interface{}{}
	}

	// Build list of IDs to query
	var mediaIDs []int
	for _, content := range selectedContent {
		if content.ID > 0 && content.Source == "local" {
			mediaIDs = append(mediaIDs, content.ID)
		}
	}

	if len(mediaIDs) == 0 {
		return []map[string]interface{}{}
	}

	var results []MediaResult
	if err := h.db.Table("media").
		Select("id, title, type, description, poster_path, backdrop_path, tmdb_backdrop_url, tmdb_poster_url, tmdb_trailer_url, logo_path, trailer_path, rating, year, duration, genre_names, release_date, tagline, view_count, quality, popularity, vote_count, series_id, file_path, preview_path, preview_clip_path, tmdb_id").
		Where("id IN ?", mediaIDs).
		Order("FIELD(id, " + h.buildIDList(mediaIDs) + ")").
		Find(&results).Error; err != nil {
		return []map[string]interface{}{}
	}

	// Convert to map format for response
	return h.formatMediaResults(results)
}

// getContentByGenres retrieves content filtered by genre IDs
func (h *WidgetDataHandlers) getContentByGenres(genreIDs []int, source string) []map[string]interface{} {
	if len(genreIDs) == 0 {
		return []map[string]interface{}{}
	}

	var results []MediaResult
	query := h.db.Table("media").
		Select("id, title, type, description, poster_path, backdrop_path, tmdb_backdrop_url, tmdb_poster_url, tmdb_trailer_url, logo_path, trailer_path, rating, year, duration, genre_names, release_date, tagline, view_count, quality, popularity, vote_count, series_id, file_path, preview_path, preview_clip_path, tmdb_id")

	if source == "local" {
		// For local content, check genre_names field (JSON array)
		genreFilter := ""
		for i, genreID := range genreIDs {
			if i > 0 {
				genreFilter += " OR "
			}
			genreFilter += fmt.Sprintf("m.genre_names LIKE '%%%d%%'", genreID)
		}

		if genreFilter != "" {
			query = query.Where(genreFilter)
		}
	}

	if err := query.
		Where("file_path IS NOT NULL AND file_path != ''").
		Order("rating DESC, popularity DESC").
		Limit(20).
		Find(&results).Error; err != nil {
		return []map[string]interface{}{}
	}

	return h.formatMediaResults(results)
}

// getContentByGenreNames retrieves content filtered by genre names
func (h *WidgetDataHandlers) getContentByGenreNames(genreNames []string) []map[string]interface{} {
	if len(genreNames) == 0 {
		return []map[string]interface{}{}
	}

	var results []MediaResult
	query := h.db.Table("media").
		Select("id, title, type, description, poster_path, backdrop_path, tmdb_backdrop_url, tmdb_poster_url, tmdb_trailer_url, logo_path, trailer_path, rating, year, duration, genre_names, release_date, tagline, view_count, quality, popularity, vote_count, series_id, file_path, preview_path, preview_clip_path, tmdb_id")

	// Filter by genre names
	genreFilter := ""
	for i, genreName := range genreNames {
		if i > 0 {
			genreFilter += " OR "
		}
		genreFilter += fmt.Sprintf("m.genre_names LIKE '%%%s%%'", genreName)
	}

	if genreFilter != "" {
		query = query.Where(genreFilter)
	}

	if err := query.
		Where("file_path IS NOT NULL AND file_path != ''").
		Order("rating DESC, popularity DESC").
		Limit(20).
		Find(&results).Error; err != nil {
		return []map[string]interface{}{}
	}

	return h.formatMediaResults(results)
}

// formatMediaResults converts media database results to response format
func (h *WidgetDataHandlers) formatMediaResults(results []MediaResult) []map[string]interface{} {
	var formatted []map[string]interface{}

	for _, result := range results {
		formatted = append(formatted, map[string]interface{}{
			"id":                  result.ID,
			"title":               result.Title,
			"type":                result.Type,
			"description":         result.Description,
			"poster_path":         result.PosterPath,
			"backdrop_path":       result.BackdropPath,
			"tmdb_backdrop_url":   result.TMDBBackdropURL,
			"tmdb_poster_url":     result.TMDBPosterURL,
			"tmdb_trailer_url":    result.TMDBTrailerURL,
			"logo_path":           result.LogoPath,
			"trailer_path":        result.TrailerPath,
			"rating":              result.Rating,
			"year":                result.Year,
			"duration":            result.Duration,
			"genre_names":         result.GenreNames,
			"release_date":        result.ReleaseDate,
			"tagline":             result.Tagline,
			"view_count":          result.ViewCount,
			"quality":             result.Quality,
			"popularity":          result.Popularity,
			"vote_count":          result.VoteCount,
			"series_id":           result.SeriesID,
			"file_path":           result.FilePath,
			"preview_path":        result.PreviewPath,
			"preview_clip_path":   result.PreviewClipPath,
			"tmdb_id":             result.TMDBID,
		})
	}

	return formatted
}

// Helper function to build ID list for ORDER BY FIELD
func (h *WidgetDataHandlers) buildIDList(ids []int) string {
	idStr := ""
	for i, id := range ids {
		if i > 0 {
			idStr += ", "
		}
		idStr += fmt.Sprintf("%d", id)
	}
	return idStr
}
