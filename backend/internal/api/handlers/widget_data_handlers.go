package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// WidgetDataHandlers handles widget data endpoints
type WidgetDataHandlers struct {
	db          *gorm.DB
	tmdbService *services.TMDBService
}

// MediaResult represents a media item from the database
type MediaResult struct {
	ID              uint
	Title           string
	Type            string
	Description     string
	PosterPath      string
	BackdropPath    string
	TMDBBackdropURL string
	TMDBPosterURL   string
	TMDBTrailerURL  string
	LogoPath        string
	TrailerPath     string
	Rating          float64
	Year            int
	Duration        int
	GenreNames      string
	ReleaseDate     string
	Tagline         string
	ViewCount       int
	Quality         string
	Popularity      float64
	VoteCount       int
	SeriesID        *uint
	FilePath        string
	PreviewPath     string
	PreviewClipPath string
	TMDBID          int
	Language        string
	Country         string
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
	ID               int     `json:"id"`
	Title            string  `json:"title,omitempty"`
	Name             string  `json:"name,omitempty"`
	Type             string  `json:"type,omitempty"`
	MediaType        string  `json:"media_type,omitempty"`
	Source           string  `json:"_source,omitempty"`
	Overview         string  `json:"overview,omitempty"`
	Description      string  `json:"description,omitempty"`
	PosterPath       string  `json:"poster_path,omitempty"`
	BackdropPath     string  `json:"backdrop_path,omitempty"`
	LogoPath         string  `json:"logo_path,omitempty"`
	TrailerPath      string  `json:"trailer_path,omitempty"`
	TMDBTrailerURL   string  `json:"tmdb_trailer_url,omitempty"`
	TMDBPosterURL    string  `json:"tmdb_poster_url,omitempty"`
	TMDBBackdropURL  string  `json:"tmdb_backdrop_url,omitempty"`
	Rating           float64 `json:"rating,omitempty"`
	VoteAverage      float64 `json:"vote_average,omitempty"`
	Year             int     `json:"year,omitempty"`
	ReleaseDate      string  `json:"release_date,omitempty"`
	FirstAirDate     string  `json:"first_air_date,omitempty"`
	TMDBID           int     `json:"tmdb_id,omitempty"`
	OriginalTitle    string  `json:"original_title,omitempty"`
	OriginalLanguage string  `json:"original_language,omitempty"`
	Popularity       float64 `json:"popularity,omitempty"`
	VoteCount        int     `json:"vote_count,omitempty"`
	Video            bool    `json:"video,omitempty"`
	Adult            bool    `json:"adult,omitempty"`
}

// WidgetConfigData represents the parsed widget config
type WidgetConfigData struct {
	SelectedContent   []WidgetContent `json:"selectedContent"`
	SelectedGenres    []int           `json:"selectedGenres"`
	GenreFilter       []string        `json:"genreFilter"`
	SelectedLanguages []string        `json:"selectedLanguages"`
	LanguageFilter    []string        `json:"languageFilter"`
	SelectedCountries []string        `json:"selectedCountries"`
	CountryFilter     []string        `json:"countryFilter"`
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

	// Fetch content
	var results []map[string]interface{}
	languageFilter := configData.LanguageFilter
	if len(languageFilter) == 0 && len(configData.SelectedLanguages) > 0 {
		languageFilter = configData.SelectedLanguages
	}
	countryFilter := configData.CountryFilter
	if len(countryFilter) == 0 && len(configData.SelectedCountries) > 0 {
		countryFilter = configData.SelectedCountries
	}

	if len(configData.SelectedContent) > 0 {
		results = h.getMixedContent(configData.SelectedContent)
		results = applyLocalLanguageFilter(results, languageFilter)
		results = applyLocalCountryFilter(results, countryFilter)
	} else if len(configData.SelectedGenres) > 0 {
		results = h.getContentByGenres(configData.SelectedGenres, "local", languageFilter, countryFilter)
	} else if len(configData.GenreFilter) > 0 {
		results = h.getContentByGenreNames(configData.GenreFilter, languageFilter, countryFilter)
	} else if len(languageFilter) > 0 || len(countryFilter) > 0 {
		results = h.getContentByLanguagesAndCountries(languageFilter, countryFilter)
	} else {
		results = []map[string]interface{}{}
	}

	c.JSON(http.StatusOK, gin.H{
		"data":   results,
		"count":  len(results),
		"config": configData,
	})
}

// getMixedContent handles a mix of Local and TMDB content from SelectedContent
func (h *WidgetDataHandlers) getMixedContent(selectedContent []WidgetContent) []map[string]interface{} {
	if len(selectedContent) == 0 {
		return []map[string]interface{}{}
	}

	// 1. Identify Local items to fetch from DB
	var localIDs []int
	for i, content := range selectedContent {
		if content.Source == "" {
			if isLikelyLocalWidgetContent(content) {
				content.Source = "local"
			} else {
				content.Source = "tmdb"
			}
		}

		if content.Source == "local" && content.ID > 0 {
			localIDs = append(localIDs, content.ID)
		}

		selectedContent[i].Source = content.Source
	}

	// 2. Fetch Local items from DB
	dbResults := make(map[int]MediaResult)
	if len(localIDs) > 0 {
		var results []MediaResult
		if err := h.db.Table("media").
			Select("id, title, type, description, language, country, poster_path, backdrop_path, tmdb_backdrop_url, tmdb_poster_url, tmdb_trailer_url, logo_path, trailer_path, rating, year, duration, genre_names, release_date, tagline, view_count, quality, popularity, vote_count, series_id, file_path, preview_path, preview_clip_path, tmdb_id").
			Where("id IN ?", localIDs).
			Find(&results).Error; err == nil {
			for _, r := range results {
				dbResults[int(r.ID)] = r
			}
		}
	}

	// 3. Construct final list maintaining order from selectedContent
	var finalResults []map[string]interface{}

	for _, content := range selectedContent {
		var item map[string]interface{}

		if content.Source == "local" {
			// Try to find in DB results
			if dbItem, exists := dbResults[content.ID]; exists {
				// Use DB item as base
				item = h.formatMediaResult(dbItem)
			} else {
				// Fallback to config data if valid
				// This handles cases where local item might be deleted but still in config?
				// Or we can skip it. For now let's skip if not in DB to avoid broken links
				continue
			}
		} else {
			// TMDB Item - Use data from config
			tmdbID := content.TMDBID
			if tmdbID == 0 {
				tmdbID = content.ID
			}

			item = map[string]interface{}{
				"id":                content.ID,
				"title":             content.Title,
				"name":              content.Name,
				"type":              content.Type,
				"media_type":        content.MediaType,
				"description":       content.Overview, // TMDB uses overview
				"overview":          content.Overview,
				"poster_path":       content.PosterPath,
				"backdrop_path":     content.BackdropPath,
				"tmdb_poster_url":   content.TMDBPosterURL,
				"tmdb_backdrop_url": content.TMDBBackdropURL,
				"tmdb_trailer_url":  content.TMDBTrailerURL,
				"logo_path":         content.LogoPath,
				"trailer_path":      content.TrailerPath,
				"rating":            content.VoteAverage, // TMDB uses vote_average
				"vote_average":      content.VoteAverage,
				"year":              content.Year,
				"release_date":      content.ReleaseDate,
				"first_air_date":    content.FirstAirDate,
				"tmdb_id":           tmdbID,
				"original_title":    content.OriginalTitle,
				"original_language": content.OriginalLanguage,
				"popularity":        content.Popularity,
				"vote_count":        content.VoteCount,
				"video":             content.Video,
				"_source":           "tmdb",
			}

			// Ensure title is set
			if item["title"] == "" && content.Name != "" {
				item["title"] = content.Name
			}
			// Ensure description is set
			if item["description"] == "" && content.Description != "" {
				item["description"] = content.Description
			}
			// Ensure rating is set
			if content.Rating > 0 {
				item["rating"] = content.Rating
			}
		}

		finalResults = append(finalResults, item)
	}

	return finalResults
}

// getContentByGenres retrieves content filtered by genre IDs
func (h *WidgetDataHandlers) getContentByGenres(genreIDs []int, source string, languages []string, countries []string) []map[string]interface{} {
	if len(genreIDs) == 0 {
		return []map[string]interface{}{}
	}

	var results []MediaResult
	query := h.db.Table("media").
		Select("id, title, type, description, language, country, poster_path, backdrop_path, tmdb_backdrop_url, tmdb_poster_url, tmdb_trailer_url, logo_path, trailer_path, rating, year, duration, genre_names, release_date, tagline, view_count, quality, popularity, vote_count, series_id, file_path, preview_path, preview_clip_path, tmdb_id")

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

	if len(languages) > 0 {
		query = query.Where("LOWER(language) IN ?", toLowerStrings(languages))
	}
	if len(countries) > 0 {
		query = query.Where("LOWER(country) IN ?", toLowerStrings(countries))
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
func (h *WidgetDataHandlers) getContentByGenreNames(genreNames []string, languages []string, countries []string) []map[string]interface{} {
	if len(genreNames) == 0 {
		return []map[string]interface{}{}
	}

	var results []MediaResult
	query := h.db.Table("media").
		Select("id, title, type, description, language, country, poster_path, backdrop_path, tmdb_backdrop_url, tmdb_poster_url, tmdb_trailer_url, logo_path, trailer_path, rating, year, duration, genre_names, release_date, tagline, view_count, quality, popularity, vote_count, series_id, file_path, preview_path, preview_clip_path, tmdb_id")

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
	if len(languages) > 0 {
		query = query.Where("LOWER(language) IN ?", toLowerStrings(languages))
	}
	if len(countries) > 0 {
		query = query.Where("LOWER(country) IN ?", toLowerStrings(countries))
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

func (h *WidgetDataHandlers) getContentByLanguagesAndCountries(languages []string, countries []string) []map[string]interface{} {
	if len(languages) == 0 && len(countries) == 0 {
		return []map[string]interface{}{}
	}

	query := h.db.Table("media").
		Select("id, title, type, description, language, country, poster_path, backdrop_path, tmdb_backdrop_url, tmdb_poster_url, tmdb_trailer_url, logo_path, trailer_path, rating, year, duration, genre_names, release_date, tagline, view_count, quality, popularity, vote_count, series_id, file_path, preview_path, preview_clip_path, tmdb_id").
		Where("file_path IS NOT NULL AND file_path != ''")
	if len(languages) > 0 {
		query = query.Where("LOWER(language) IN ?", toLowerStrings(languages))
	}
	if len(countries) > 0 {
		query = query.Where("LOWER(country) IN ?", toLowerStrings(countries))
	}

	var results []MediaResult
	if err := query.
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
		formatted = append(formatted, h.formatMediaResult(result))
	}
	return formatted
}

// formatMediaResult converts a single media result to map
func (h *WidgetDataHandlers) formatMediaResult(result MediaResult) map[string]interface{} {
	return map[string]interface{}{
		"id":                result.ID,
		"title":             result.Title,
		"type":              result.Type,
		"description":       result.Description,
		"poster_path":       result.PosterPath,
		"backdrop_path":     result.BackdropPath,
		"tmdb_backdrop_url": result.TMDBBackdropURL,
		"tmdb_poster_url":   result.TMDBPosterURL,
		"tmdb_trailer_url":  result.TMDBTrailerURL,
		"logo_path":         result.LogoPath,
		"trailer_path":      result.TrailerPath,
		"rating":            result.Rating,
		"year":              result.Year,
		"duration":          result.Duration,
		"genre_names":       result.GenreNames,
		"release_date":      result.ReleaseDate,
		"tagline":           result.Tagline,
		"view_count":        result.ViewCount,
		"quality":           result.Quality,
		"popularity":        result.Popularity,
		"vote_count":        result.VoteCount,
		"series_id":         result.SeriesID,
		"file_path":         result.FilePath,
		"preview_path":      result.PreviewPath,
		"preview_clip_path": result.PreviewClipPath,
		"tmdb_id":           result.TMDBID,
		"original_language": result.Language,
		"country":           result.Country,
		"_source":           "local",
	}
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

func isLikelyLocalWidgetContent(content WidgetContent) bool {
	if strings.EqualFold(content.Source, "local") {
		return true
	}
	pathFields := []string{
		content.PosterPath,
		content.BackdropPath,
		content.LogoPath,
		content.TrailerPath,
	}
	for _, path := range pathFields {
		if strings.HasPrefix(path, "/api/") {
			return true
		}
	}
	return content.TMDBID == 0
}

func toLowerStrings(values []string) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			result = append(result, strings.ToLower(trimmed))
		}
	}
	return result
}

func applyLocalLanguageFilter(items []map[string]interface{}, languages []string) []map[string]interface{} {
	if len(languages) == 0 {
		return items
	}
	allowed := make(map[string]bool)
	for _, language := range languages {
		normalized := strings.ToLower(strings.TrimSpace(language))
		if normalized != "" {
			allowed[normalized] = true
		}
	}
	filtered := make([]map[string]interface{}, 0, len(items))
	for _, item := range items {
		language, _ := item["original_language"].(string)
		if allowed[strings.ToLower(strings.TrimSpace(language))] {
			filtered = append(filtered, item)
		}
	}
	return filtered
}

func applyLocalCountryFilter(items []map[string]interface{}, countries []string) []map[string]interface{} {
	if len(countries) == 0 {
		return items
	}
	allowed := make(map[string]bool)
	for _, country := range countries {
		normalized := strings.ToLower(strings.TrimSpace(country))
		if normalized != "" {
			allowed[normalized] = true
		}
	}
	filtered := make([]map[string]interface{}, 0, len(items))
	for _, item := range items {
		country, _ := item["country"].(string)
		if allowed[strings.ToLower(strings.TrimSpace(country))] {
			filtered = append(filtered, item)
		}
	}
	return filtered
}
