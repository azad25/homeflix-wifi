package services

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// FallbackMetadata represents the structure for fallback metadata
type FallbackMetadata struct {
	Title         string   `json:"title"`
	OriginalTitle string   `json:"original_title,omitempty"`
	Type          string   `json:"type"` // "movie", "episode", "series"
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
	Rating        float64  `json:"rating,omitempty"`
	Duration      int      `json:"duration,omitempty"`
	Resolution    string   `json:"resolution,omitempty"`
	Quality       string   `json:"quality"`
	Codec         string   `json:"codec,omitempty"`
	SeriesName    string   `json:"series_name,omitempty"`
	FilePath      string   `json:"file_path"`
	FileSize      int64    `json:"file_size"`
	LastUpdated   string   `json:"last_updated"`
}

// MetadataFallbackService handles local metadata generation and storage
type MetadataFallbackService struct {
	metadataFile string
	cache        map[string]*FallbackMetadata
}

// NewMetadataFallbackService creates a new fallback service
func NewMetadataFallbackService(metadataFile string) *MetadataFallbackService {
	return &MetadataFallbackService{
		metadataFile: metadataFile,
		cache:        make(map[string]*FallbackMetadata),
	}
}

// LoadMetadata loads existing metadata from media.json
func (mfs *MetadataFallbackService) LoadMetadata() error {
	if _, err := os.Stat(mfs.metadataFile); os.IsNotExist(err) {
		// File doesn't exist, start with empty cache
		return nil
	}

	data, err := ioutil.ReadFile(mfs.metadataFile)
	if err != nil {
		return fmt.Errorf("failed to read metadata file: %v", err)
	}

	var metadata map[string]*FallbackMetadata
	if err := json.Unmarshal(data, &metadata); err != nil {
		return fmt.Errorf("failed to parse metadata file: %v", err)
	}

	mfs.cache = metadata
	return nil
}

// SaveMetadata saves current metadata cache to media.json
func (mfs *MetadataFallbackService) SaveMetadata() error {
	data, err := json.MarshalIndent(mfs.cache, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %v", err)
	}

	if err := ioutil.WriteFile(mfs.metadataFile, data, 0644); err != nil {
		return fmt.Errorf("failed to write metadata file: %v", err)
	}

	return nil
}

// ExtractMetadataFromFilename extracts metadata from filename using patterns
func (mfs *MetadataFallbackService) ExtractMetadataFromFilename(filePath string) *FallbackMetadata {
	filename := filepath.Base(filePath)
	fileInfo, _ := os.Stat(filePath)
	
	metadata := &FallbackMetadata{
		FilePath:    filePath,
		FileSize:    fileInfo.Size(),
		LastUpdated: time.Now().Format("2006-01-02 15:04:05"),
		Genres:      []string{"Unknown"},
		Description: "Metadata extracted from filename",
	}

	// Extract resolution
	if resMatch := regexp.MustCompile(`(\d{3,4}p)`).FindString(filename); resMatch != "" {
		metadata.Resolution = resMatch
	}

	// Extract codec
	if strings.Contains(strings.ToLower(filename), "x265") || strings.Contains(strings.ToLower(filename), "hevc") {
		metadata.Codec = "hevc"
	} else if strings.Contains(strings.ToLower(filename), "x264") || strings.Contains(strings.ToLower(filename), "h264") {
		metadata.Codec = "h264"
	}

	// TV Show patterns
	tvPatterns := []*regexp.Regexp{
		regexp.MustCompile(`(?i)(.+?)\s+S(\d{1,2})E(\d{1,2})`),                    // Show S01E01
		regexp.MustCompile(`(?i)(.+?)\s+Season\s+(\d{1,2})\s+.*E(\d{1,2})`),       // Show Season 1 E01
		regexp.MustCompile(`(?i)(.+?)\s+(\d{1,2})x(\d{1,2})`),                     // Show 1x01
		regexp.MustCompile(`(?i)(.+?)\s+S(\d{1,2})\s+E(\d{1,2})`),                 // Show S1 E01
	}

	for _, pattern := range tvPatterns {
		if matches := pattern.FindStringSubmatch(filename); len(matches) >= 4 {
			metadata.Type = "episode"
			metadata.SeriesName = strings.TrimSpace(matches[1])
			metadata.Title = metadata.SeriesName
			
			if season, err := strconv.Atoi(matches[2]); err == nil {
				metadata.Season = season
			}
			if episode, err := strconv.Atoi(matches[3]); err == nil {
				metadata.Episode = episode
			}

			// Try to extract episode title
			if episodeTitleMatch := regexp.MustCompile(`(?i)E\d{1,2}\s+(.+?)\s+\(`).FindStringSubmatch(filename); len(episodeTitleMatch) > 1 {
				metadata.Title = fmt.Sprintf("%s S%dE%d: %s", metadata.SeriesName, metadata.Season, metadata.Episode, episodeTitleMatch[1])
			} else {
				metadata.Title = fmt.Sprintf("%s S%dE%d", metadata.SeriesName, metadata.Season, metadata.Episode)
			}

			// Set genres based on series name
			metadata.Genres = mfs.guessGenresFromTitle(metadata.SeriesName)
			return metadata
		}
	}

	// Movie patterns
	moviePatterns := []*regexp.Regexp{
		regexp.MustCompile(`(?i)(.+?)\s+\((\d{4})\)`),           // Movie (2020)
		regexp.MustCompile(`(?i)(.+?)\.(\d{4})\.`),              // Movie.2020.
		regexp.MustCompile(`(?i)(.+?)\s+(\d{4})\s+`),            // Movie 2020 
	}

	for _, pattern := range moviePatterns {
		if matches := pattern.FindStringSubmatch(filename); len(matches) >= 3 {
			metadata.Type = "movie"
			metadata.Title = strings.TrimSpace(matches[1])
			metadata.Title = strings.ReplaceAll(metadata.Title, ".", " ")
			
			if year, err := strconv.Atoi(matches[2]); err == nil {
				metadata.Year = year
			}

			metadata.Genres = mfs.guessGenresFromTitle(metadata.Title)
			return metadata
		}
	}

	// Fallback: treat as movie with basic title extraction
	metadata.Type = "movie"
	metadata.Title = strings.TrimSuffix(filename, filepath.Ext(filename))
	metadata.Title = regexp.MustCompile(`\s+\d{3,4}p`).ReplaceAllString(metadata.Title, "")
	metadata.Title = regexp.MustCompile(`\s+x26[45]`).ReplaceAllString(metadata.Title, "")
	metadata.Title = strings.ReplaceAll(metadata.Title, ".", " ")
	metadata.Genres = mfs.guessGenresFromTitle(metadata.Title)

	return metadata
}

// guessGenresFromTitle attempts to guess genres based on title keywords
func (mfs *MetadataFallbackService) guessGenresFromTitle(title string) []string {
	titleLower := strings.ToLower(title)
	
	genreKeywords := map[string][]string{
		"Action":    {"action", "fight", "war", "battle", "combat", "mission", "agent", "spy"},
		"Comedy":    {"comedy", "funny", "laugh", "humor", "comic"},
		"Drama":     {"drama", "life", "story", "family", "love", "heart"},
		"Horror":    {"horror", "scary", "fear", "dead", "zombie", "ghost", "evil", "dark"},
		"Sci-Fi":    {"space", "future", "alien", "robot", "cyber", "matrix", "star", "galaxy"},
		"Fantasy":   {"magic", "wizard", "dragon", "fantasy", "lord", "rings", "throne", "game"},
		"Thriller":  {"thriller", "mystery", "crime", "detective", "murder", "killer"},
		"Romance":   {"love", "romance", "heart", "wedding", "kiss", "romantic"},
		"Adventure": {"adventure", "journey", "quest", "treasure", "island", "jungle"},
		"Animation": {"animated", "cartoon", "anime", "pixar", "disney"},
	}

	var genres []string
	for genre, keywords := range genreKeywords {
		for _, keyword := range keywords {
			if strings.Contains(titleLower, keyword) {
				genres = append(genres, genre)
				break
			}
		}
	}

	if len(genres) == 0 {
		genres = []string{"Unknown"}
	}

	return genres
}

// GetMetadata retrieves metadata for a file path
func (mfs *MetadataFallbackService) GetMetadata(filePath string) *FallbackMetadata {
	if metadata, exists := mfs.cache[filePath]; exists {
		return metadata
	}
	return nil
}

// AddMetadata adds or updates metadata for a file
func (mfs *MetadataFallbackService) AddMetadata(filePath string, metadata *FallbackMetadata) {
	mfs.cache[filePath] = metadata
}

// GenerateMetadataForDirectory scans a directory and generates metadata for all video files
func (mfs *MetadataFallbackService) GenerateMetadataForDirectory(rootDir string) error {
	videoExtensions := map[string]bool{
		".mp4": true, ".mkv": true, ".avi": true, ".mov": true,
		".wmv": true, ".flv": true, ".webm": true, ".m4v": true,
	}

	return filepath.Walk(rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Continue on errors
		}

		if info.IsDir() {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		if !videoExtensions[ext] {
			return nil
		}

		// Check if we already have metadata for this file
		if _, exists := mfs.cache[path]; exists {
			return nil
		}

		// Generate metadata from filename
		metadata := mfs.ExtractMetadataFromFilename(path)
		mfs.cache[path] = metadata

		fmt.Printf("Generated metadata for: %s -> %s (%s)\n", filepath.Base(path), metadata.Title, metadata.Type)
		return nil
	})
}

// GetFallbackMetadata returns metadata with fallback logic
func (mfs *MetadataFallbackService) GetFallbackMetadata(filePath string) *FallbackMetadata {
	// First check cache
	if metadata := mfs.GetMetadata(filePath); metadata != nil {
		return metadata
	}

	// Generate from filename
	metadata := mfs.ExtractMetadataFromFilename(filePath)
	mfs.AddMetadata(filePath, metadata)
	
	// Save to file
	mfs.SaveMetadata()
	
	return metadata
}

// GetCache returns the internal cache for statistics
func (mfs *MetadataFallbackService) GetCache() map[string]*FallbackMetadata {
	return mfs.cache
}
