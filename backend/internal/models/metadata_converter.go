package models

import (
	"fmt"
	"strings"
	"time"
)

// MediaMetadataJSON represents the structure used in media.json file
type MediaMetadataJSON struct {
	Title         string   `json:"title"`
	OriginalTitle string   `json:"original_title,omitempty"`
	Type          string   `json:"type"`
	Year          int      `json:"year,omitempty"`
	Season        int      `json:"season,omitempty"`
	Episode       int      `json:"episode,omitempty"`
	Tagline       string   `json:"tagline"`
	ShortDesc     string   `json:"short_desc"`
	LongDesc      string   `json:"long_desc"`
	Description   string   `json:"description"`
	Genres        []string `json:"genres"`
	Stars         []string `json:"stars"`
	Director      []string `json:"director"`
	Country       string   `json:"country"`
	Language      string   `json:"language"`
	Rating        float64  `json:"rating"`
	Quality       string   `json:"quality"`
	FilePath      string   `json:"file_path"`
	FileSize      int64    `json:"file_size"`
	LastUpdated   string   `json:"last_updated"`
}

// ToMedia converts MediaMetadataJSON to Media model
func (m *MediaMetadataJSON) ToMedia() *Media {
	media := &Media{
		Title:         m.Title,
		OriginalTitle: m.OriginalTitle,
		Type:          m.Type,
		FilePath:      m.FilePath,
		FileSize:      m.FileSize,
		Year:          m.Year,
		Tagline:       m.Tagline,
		ShortDesc:     m.ShortDesc,
		LongDesc:      m.LongDesc,
		Description:   m.Description,
		Rating:        m.Rating,
		Country:       m.Country,
		Language:      m.Language,
		Quality:       m.Quality,
		Stars:         m.Stars,
		Director:      m.Director,
		GenreNames:    m.Genres,
		LastUpdated:   m.LastUpdated,
	}

	// Handle series info
	if m.Season > 0 {
		media.Season = &m.Season
	}
	if m.Episode > 0 {
		media.Episode = &m.Episode
	}

	// Set release date from year if available
	if m.Year > 0 {
		media.ReleaseDate = time.Date(m.Year, 1, 1, 0, 0, 0, 0, time.UTC)
	}

	return media
}

// FromMedia converts Media model to MediaMetadataJSON
func (m *Media) ToMediaMetadataJSON() *MediaMetadataJSON {
	json := &MediaMetadataJSON{
		Title:         m.Title,
		OriginalTitle: m.OriginalTitle,
		Type:          m.Type,
		FilePath:      m.FilePath,
		FileSize:      m.FileSize,
		Year:          m.Year,
		Tagline:       m.Tagline,
		ShortDesc:     m.ShortDesc,
		LongDesc:      m.LongDesc,
		Description:   m.Description,
		Rating:        m.Rating,
		Country:       m.Country,
		Language:      m.Language,
		Quality:       m.Quality,
		Stars:         m.Stars,
		Director:      m.Director,
		Genres:        m.GenreNames,
		LastUpdated:   m.LastUpdated,
	}

	// Handle series info
	if m.Season != nil {
		json.Season = *m.Season
	}
	if m.Episode != nil {
		json.Episode = *m.Episode
	}

	// Extract year from release date if not set
	if json.Year == 0 && !m.ReleaseDate.IsZero() {
		json.Year = m.ReleaseDate.Year()
	}

	return json
}

// SyncGenres synchronizes genre names with Genre relationships
func (m *Media) SyncGenres() {
	// Update GenreNames from Genres relationship
	if len(m.Genres) > 0 {
		m.GenreNames = make([]string, len(m.Genres))
		for i, genre := range m.Genres {
			m.GenreNames[i] = genre.Name
		}
	}
}

// GetDisplayTitle returns a formatted title for display
func (m *Media) GetDisplayTitle() string {
	if m.Type == "episode" && m.Season != nil && m.Episode != nil {
		if m.OriginalTitle != "" {
			return fmt.Sprintf("%s S%dE%d", m.OriginalTitle, *m.Season, *m.Episode)
		}
		return fmt.Sprintf("%s S%dE%d", m.Title, *m.Season, *m.Episode)
	}
	return m.Title
}

// GetQualityBadge returns a quality badge for UI display
func (m *Media) GetQualityBadge() string {
	quality := strings.ToUpper(m.Quality)
	switch quality {
	case "4K", "2160P":
		return "4K"
	case "HDR":
		return "HDR"
	case "HD", "1080P":
		return "HD"
	case "720P":
		return "HD"
	case "SD", "480P":
		return "SD"
	default:
		return "HD" // Default fallback
	}
}

// IsMovie returns true if the media is a movie
func (m *Media) IsMovie() bool {
	return m.Type == "movie"
}

// IsEpisode returns true if the media is an episode
func (m *Media) IsEpisode() bool {
	return m.Type == "episode"
}

// GetGenreString returns genres as a comma-separated string
func (m *Media) GetGenreString() string {
	if len(m.GenreNames) > 0 {
		return strings.Join(m.GenreNames, ", ")
	}
	if len(m.Genres) > 0 {
		names := make([]string, len(m.Genres))
		for i, genre := range m.Genres {
			names[i] = genre.Name
		}
		return strings.Join(names, ", ")
	}
	return "Unknown"
}

// GetStarsString returns stars as a comma-separated string
func (m *Media) GetStarsString() string {
	if len(m.Stars) > 0 {
		return strings.Join(m.Stars, ", ")
	}
	return "Cast information not available"
}

// GetDirectorString returns directors as a comma-separated string
func (m *Media) GetDirectorString() string {
	if len(m.Director) > 0 {
		return strings.Join(m.Director, ", ")
	}
	return "Director information not available"
}
