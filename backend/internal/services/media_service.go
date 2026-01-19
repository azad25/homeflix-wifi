package services

import (
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"homeflix-backend/internal/models"

	"gorm.io/gorm"
)

type DBManager struct {
	db      *gorm.DB
	mu      sync.Mutex
	inTx    bool
	retries int
}

func NewDBManager(db *gorm.DB) *DBManager {
	return &DBManager{
		db:      db,
		retries: 3,
	}
}

// WithTx executes a function within a transaction with retry logic
func (m *DBManager) WithTx(fn func(tx *gorm.DB) error) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	var lastErr error
	for i := 0; i < m.retries; i++ {
		tx := m.db.Begin()
		if tx.Error != nil {
			lastErr = tx.Error
			time.Sleep(time.Duration(i+1) * 100 * time.Millisecond)
			continue
		}

		err := fn(tx)
		if err != nil {
			tx.Rollback()
			if isRetryableError(err) {
				lastErr = err
				time.Sleep(time.Duration(i+1) * 100 * time.Millisecond)
				continue
			}
			return err
		}

		if err := tx.Commit().Error; err != nil {
			lastErr = err
			time.Sleep(time.Duration(i+1) * 100 * time.Millisecond)
			continue
		}

		return nil
	}

	return fmt.Errorf("max retries reached, last error: %v", lastErr)
}

func isRetryableError(err error) bool {
	if err == nil {
		return false
	}
	
	// Don't retry for record not found errors
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false
	}
	
	// Don't retry for validation errors
	errStr := err.Error()
	if strings.Contains(errStr, "UNIQUE constraint failed") ||
	   strings.Contains(errStr, "NOT NULL constraint failed") ||
	   strings.Contains(errStr, "CHECK constraint failed") {
		return false
	}
	
	// Retry for database lock and connection errors
	if strings.Contains(errStr, "database is locked") ||
	   strings.Contains(errStr, "database is busy") ||
	   strings.Contains(errStr, "connection") {
		return true
	}
	
	// Don't retry other errors by default
	return false
}

// WithReadOnly executes a read-only operation with retry logic
func (m *DBManager) WithReadOnly(fn func(db *gorm.DB) error) error {
	var lastErr error
	for i := 0; i < m.retries; i++ {
		err := fn(m.db)
		if err == nil {
			return nil
		}
		if !isRetryableError(err) {
			return err
		}
		lastErr = err
		time.Sleep(time.Duration(i+1) * 50 * time.Millisecond)
	}
	return fmt.Errorf("max retries reached, last error: %v", lastErr)
}

type MediaService struct {
	db        *gorm.DB
	DBManager *DBManager
}

func NewMediaService(db *gorm.DB) *MediaService {
	return &MediaService{
		db:        db,
		DBManager: NewDBManager(db),
	}
}

func (s *MediaService) CreateMedia(media *models.Media) error {
	return s.DBManager.WithTx(func(tx *gorm.DB) error {
		// Check for existing media with same path
		var existing models.Media
		if err := tx.Where("file_path = ?", media.FilePath).First(&existing).Error; err == nil {
			return fmt.Errorf("media with path %s already exists", media.FilePath)
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("error checking for existing media: %w", err)
		}

		// Set timestamps
		now := time.Now()
		media.CreatedAt = now
		media.UpdatedAt = now

		// Create the media record
		if err := tx.Create(media).Error; err != nil {
			return fmt.Errorf("failed to create media: %w", err)
		}

		return nil
	})
}

func (s *MediaService) GetMediaByID(id uint) (*models.Media, error) {
	var media models.Media
	err := s.DBManager.WithReadOnly(func(db *gorm.DB) error {
		return db.Preload("Genres").Preload("Series").Preload("Subtitles").First(&media, id).Error
	})
	return &media, err
}

func (s *MediaService) GetMediaByPath(path string) (*models.Media, error) {
	var media models.Media
	
	// Normalize path for consistent comparison
	normalizedPath := filepath.Clean(path)
	
	err := s.DBManager.WithReadOnly(func(db *gorm.DB) error {
		// Try exact path match first
		err := db.Where("file_path = ?", normalizedPath).First(&media).Error
		if err == nil {
			return nil
		}
		
		// If exact match fails, try original path
		if normalizedPath != path {
			err = db.Where("file_path = ?", path).First(&media).Error
			if err == nil {
				return nil
			}
		}
		
		return err
	})

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return &media, nil
}

func (s *MediaService) MediaExists(path string) (bool, error) {
	var count int64
	err := s.DBManager.WithReadOnly(func(db *gorm.DB) error {
		return db.Model(&models.Media{}).Where("file_path = ?", path).Count(&count).Error
	})
	return count > 0, err
}

// UpsertMedia creates or updates media atomically to prevent UNIQUE constraint violations
func (s *MediaService) UpsertMedia(media *models.Media) error {
	return s.DBManager.WithTx(func(tx *gorm.DB) error {
		// Normalize path for consistent comparison
		normalizedPath := filepath.Clean(media.FilePath)
		
		// Try multiple path variations to find existing media
		var existingMedia models.Media
		pathVariations := []string{
			normalizedPath,
			media.FilePath,
			strings.ReplaceAll(normalizedPath, "\\", "/"),
			strings.ReplaceAll(media.FilePath, "\\", "/"),
		}
		
		// Remove duplicates from path variations
		uniquePaths := make(map[string]bool)
		var searchPaths []string
		for _, path := range pathVariations {
			if !uniquePaths[path] {
				uniquePaths[path] = true
				searchPaths = append(searchPaths, path)
			}
		}
		
		// Try to find existing media with any of the path variations
		var err error
		for _, searchPath := range searchPaths {
			err = tx.Where("file_path = ?", searchPath).First(&existingMedia).Error
			if err == nil {
				// Found existing media, update it
				log.Printf("🔍 Found existing media with path: %s", searchPath)
				existingMedia.Title = media.Title
				existingMedia.Description = media.Description
				existingMedia.Year = media.Year
				existingMedia.Type = media.Type
				existingMedia.FileSize = media.FileSize
				existingMedia.Quality = media.Quality
				existingMedia.FilePath = normalizedPath // Use normalized path
				
				updateErr := tx.Save(&existingMedia).Error
				if updateErr == nil {
					// Copy the updated media back to the original pointer
					*media = existingMedia
					log.Printf("🔄 Updated existing media ID=%d: %s", existingMedia.ID, existingMedia.Title)
				}
				return updateErr
			}
		}
		
		// No existing media found, create new one
		if errors.Is(err, gorm.ErrRecordNotFound) {
			media.FilePath = normalizedPath // Use normalized path
			createErr := tx.Create(media).Error
			if createErr != nil {
				// If create fails with UNIQUE constraint, implement comprehensive recovery
				if strings.Contains(createErr.Error(), "UNIQUE constraint failed") {
					log.Printf("⚠️ UNIQUE constraint violation for path: %s", normalizedPath)
					
					// Strategy 1: Try exact path search with different casing
					var allMedia []models.Media
					tx.Find(&allMedia)
					
					for _, existing := range allMedia {
						if strings.EqualFold(existing.FilePath, normalizedPath) ||
						   strings.EqualFold(existing.FilePath, media.FilePath) {
							log.Printf("🔍 Found case-insensitive match: %s", existing.FilePath)
							// Update the existing media
							existing.Title = media.Title
							existing.Description = media.Description
							existing.Year = media.Year
							existing.Type = media.Type
							existing.FileSize = media.FileSize
							existing.Quality = media.Quality
							
							updateErr := tx.Save(&existing).Error
							if updateErr == nil {
								*media = existing
								log.Printf("🔄 Updated case-insensitive match ID=%d: %s", existing.ID, existing.Title)
							}
							return updateErr
						}
					}
					
					// Strategy 2: Try basename matching
					baseName := filepath.Base(normalizedPath)
					for _, existing := range allMedia {
						existingBaseName := filepath.Base(existing.FilePath)
						if strings.EqualFold(existingBaseName, baseName) {
							log.Printf("🔍 Found basename match: %s -> %s", existingBaseName, existing.FilePath)
							// Update the existing media with new path
							existing.Title = media.Title
							existing.Description = media.Description
							existing.Year = media.Year
							existing.Type = media.Type
							existing.FileSize = media.FileSize
							existing.Quality = media.Quality
							existing.FilePath = normalizedPath // Update to new path
							
							updateErr := tx.Save(&existing).Error
							if updateErr == nil {
								*media = existing
								log.Printf("🔄 Updated basename match ID=%d: %s", existing.ID, existing.Title)
							}
							return updateErr
						}
					}
					
					// Strategy 3: If all else fails, skip this entry to prevent crash
					log.Printf("🚨 Could not resolve UNIQUE constraint for: %s - skipping to prevent crash", normalizedPath)
					return fmt.Errorf("UNIQUE constraint could not be resolved for path: %s", normalizedPath)
				}
				log.Printf("❌ Failed to create media: %v", createErr)
				return createErr
			}
			log.Printf("✅ Created new media ID=%d: %s", media.ID, media.Title)
			return nil
		}
		
		// Database error
		log.Printf("❌ Database error during upsert: %v", err)
		return err
	})
}

func (s *MediaService) GetAllMedia() ([]models.Media, error) {
	var media []models.Media
	err := s.DBManager.WithReadOnly(func(db *gorm.DB) error {
		return db.Preload("Genres").Preload("Series").Preload("Subtitles").Find(&media).Error
	})
	
	if err != nil {
		return nil, err
	}
	
	// Add fallback thumbnail paths for all media
	for i := range media {
		if err := s.EnsureThumbnailFallback(&media[i]); err != nil {
			log.Printf("Warning: Failed to ensure thumbnail fallback for media %d: %v", media[i].ID, err)
		}
	}
	
	return media, nil
}

func (s *MediaService) GetMovies() ([]models.Media, error) {
	var movies []models.Media
	err := s.DBManager.WithReadOnly(func(db *gorm.DB) error {
		return db.Preload("Genres").Preload("Subtitles").Where("type = ?", "movie").Find(&movies).Error
	})
	return movies, err
}

func (s *MediaService) GetSeries() ([]models.Series, error) {
	var series []models.Series
	err := s.DBManager.WithReadOnly(func(db *gorm.DB) error {
		return db.Preload("Episodes").Preload("Episodes.Subtitles").Preload("Genres").Find(&series).Error
	})
	return series, err
}

func (s *MediaService) GetSeriesByID(id uint) (*models.Series, error) {
	var series models.Series
	err := s.DBManager.WithReadOnly(func(db *gorm.DB) error {
		return db.Preload("Episodes").Preload("Episodes.Subtitles").Preload("Genres").First(&series, id).Error
	})
	return &series, err
}

// UpdateSeries updates a TV series with new metadata
func (s *MediaService) UpdateSeries(id uint, updates map[string]interface{}) (*models.Series, error) {
	var series models.Series
	
	// Use direct database access instead of DBManager transaction for now
	// First get the existing series
	if err := s.db.Preload("Genres").First(&series, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("series with ID %d not found", id)
		}
		return nil, fmt.Errorf("failed to fetch series: %v", err)
	}

	// Start a transaction manually
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Handle genre updates if provided (do this first to update both relationship and field)
	if genreNames, ok := updates["genre_names"].([]string); ok && len(genreNames) > 0 {
		// Update the GenreNames field directly
		series.GenreNames = genreNames
		// Clear existing genres
		if err := tx.Model(&series).Association("Genres").Clear(); err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to clear existing genres: %v", err)
		}

		// Add new genres
		for _, genreName := range genreNames {
			var genre models.Genre
			if err := tx.Where("name = ?", genreName).First(&genre).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					// Create new genre if it doesn't exist
					genre = models.Genre{Name: genreName}
					if err := tx.Create(&genre).Error; err != nil {
						tx.Rollback()
						return nil, fmt.Errorf("failed to create genre %s: %v", genreName, err)
					}
				} else {
					tx.Rollback()
					return nil, fmt.Errorf("failed to find genre %s: %v", genreName, err)
				}
			}
			if err := tx.Model(&series).Association("Genres").Append(&genre); err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("failed to append genre %s: %v", genreName, err)
			}
		}
		
		// Remove genre_names from updates map since we handled it separately
		delete(updates, "genre_names")
	}

	// Update the series with remaining fields
	if len(updates) > 0 {
		if err := tx.Model(&series).Updates(updates).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to update series: %v", err)
		}
	}
	
	// Save the series to persist GenreNames field
	if err := tx.Save(&series).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to save series: %v", err)
	}

	// Commit the transaction
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %v", err)
	}

	// Reload the series with updated data
	if err := s.db.Preload("Genres").First(&series, id).Error; err != nil {
		return nil, fmt.Errorf("failed to reload series: %v", err)
	}

	return &series, nil
}

func (s *MediaService) FindOrCreateSeries(title string) (*models.Series, error) {
	var series models.Series
	err := s.DBManager.WithTx(func(tx *gorm.DB) error {
		// Strategy 1: Exact title match (fastest)
		if err := tx.Where("title = ?", title).First(&series).Error; err == nil {
			log.Printf("✅ Found series by exact match: %s (ID: %d)", series.Title, series.ID)
			return nil
		}

		// Strategy 2: Fuzzy match for renamed series (prevents duplicates)
		// This handles cases where user renamed "Breaking Bad" to "Breaking Bad (2008)"
		var allSeries []models.Series
		if err := tx.Find(&allSeries).Error; err != nil {
			return fmt.Errorf("failed to load series for fuzzy matching: %v", err)
		}

		// Find best match using similarity scoring
		bestMatch := s.findBestSeriesMatch(title, allSeries)
		if bestMatch != nil {
			series = *bestMatch
			log.Printf("🔍 Found series by fuzzy match: '%s' matched to '%s' (ID: %d)", title, series.Title, series.ID)
			return nil
		}

		// Strategy 3: Create new series only if no match found
		log.Printf("🆕 Creating new series: %s (no existing match found)", title)
		series = models.Series{
			Title:  title,
			Status: "ongoing",
		}
		return tx.Create(&series).Error
	})
	return &series, err
}

// findBestSeriesMatch finds the best matching series using fuzzy title comparison
// This prevents duplicate series when titles are renamed (e.g., "Breaking Bad" vs "Breaking Bad (2008)")
func (s *MediaService) findBestSeriesMatch(searchTitle string, allSeries []models.Series) *models.Series {
	if len(allSeries) == 0 {
		return nil
	}

	// Normalize search title for comparison
	normalizedSearch := s.normalizeSeriesTitle(searchTitle)
	if normalizedSearch == "" {
		return nil
	}

	var bestMatch *models.Series
	var bestScore float64 = 0.0
	const matchThreshold = 0.75 // 75% similarity required

	for i := range allSeries {
		normalizedExisting := s.normalizeSeriesTitle(allSeries[i].Title)
		if normalizedExisting == "" {
			continue
		}

		// Calculate similarity score
		score := s.calculateSeriesSimilarity(normalizedSearch, normalizedExisting)

		// Check if this is the best match so far
		if score > bestScore && score >= matchThreshold {
			bestScore = score
			bestMatch = &allSeries[i]
		}
	}

	if bestMatch != nil {
		log.Printf("📊 Best match score: %.2f for '%s' -> '%s'", bestScore, searchTitle, bestMatch.Title)
	}

	return bestMatch
}

// normalizeSeriesTitle normalizes a series title for fuzzy matching
// Removes years, special characters, and extra whitespace
func (s *MediaService) normalizeSeriesTitle(title string) string {
	// Convert to lowercase
	normalized := strings.ToLower(title)

	// Remove year patterns: (2008), [2008], 2008
	normalized = regexp.MustCompile(`[\(\[\{]?\d{4}[\)\]\}]?`).ReplaceAllString(normalized, "")

	// Remove special characters but keep spaces
	normalized = regexp.MustCompile(`[^\p{L}\p{N}\s]`).ReplaceAllString(normalized, " ")

	// Remove extra whitespace
	normalized = regexp.MustCompile(`\s+`).ReplaceAllString(normalized, " ")

	// Trim
	normalized = strings.TrimSpace(normalized)

	return normalized
}

// calculateSeriesSimilarity calculates similarity between two normalized titles
// Returns a score between 0.0 (no match) and 1.0 (perfect match)
func (s *MediaService) calculateSeriesSimilarity(title1, title2 string) float64 {
	// Exact match after normalization
	if title1 == title2 {
		return 1.0
	}

	// Check if one title contains the other (handles "Breaking Bad" vs "Breaking Bad Season 1")
	if strings.Contains(title1, title2) || strings.Contains(title2, title1) {
		shorter := title1
		longer := title2
		if len(title1) > len(title2) {
			shorter = title2
			longer = title1
		}
		// Score based on length ratio
		return float64(len(shorter)) / float64(len(longer))
	}

	// Calculate Levenshtein distance for more complex cases
	distance := s.levenshteinDistance(title1, title2)
	maxLen := len(title1)
	if len(title2) > maxLen {
		maxLen = len(title2)
	}

	if maxLen == 0 {
		return 0.0
	}

	// Convert distance to similarity score
	similarity := 1.0 - (float64(distance) / float64(maxLen))
	return similarity
}

// levenshteinDistance calculates the Levenshtein distance between two strings
func (s *MediaService) levenshteinDistance(s1, s2 string) int {
	if len(s1) == 0 {
		return len(s2)
	}
	if len(s2) == 0 {
		return len(s1)
	}

	// Create matrix
	matrix := make([][]int, len(s1)+1)
	for i := range matrix {
		matrix[i] = make([]int, len(s2)+1)
		matrix[i][0] = i
	}
	for j := range matrix[0] {
		matrix[0][j] = j
	}

	// Fill matrix
	for i := 1; i <= len(s1); i++ {
		for j := 1; j <= len(s2); j++ {
			cost := 1
			if s1[i-1] == s2[j-1] {
				cost = 0
			}

			matrix[i][j] = minInt3(
				matrix[i-1][j]+1,      // deletion
				matrix[i][j-1]+1,      // insertion
				matrix[i-1][j-1]+cost, // substitution
			)
		}
	}

	return matrix[len(s1)][len(s2)]
}

// minInt3 returns the minimum of three integers
func minInt3(a, b, c int) int {
	if a < b {
		if a < c {
			return a
		}
		return c
	}
	if b < c {
		return b
	}
	return c
}

func (s *MediaService) CreateSubtitle(subtitle *models.Subtitle) error {
	return s.DBManager.WithTx(func(tx *gorm.DB) error {
		return tx.Create(subtitle).Error
	})
}

func (s *MediaService) SearchMedia(query string) ([]models.Media, error) {
	var media []models.Media

	if query == "" {
		// Return all media if query is empty
		return s.GetAllMedia()
	}

	// Enhanced search with multiple fields and better ranking (SQL injection safe)
	searchPattern := "%" + query + "%"

	err := s.DBManager.WithReadOnly(func(db *gorm.DB) error {
		// Use LIKE instead of ILIKE for SQLite compatibility
		return db.Preload("Genres").Preload("Series").Preload("Subtitles").
			Where("title LIKE ? OR description LIKE ? OR EXISTS (SELECT 1 FROM media_genres mg JOIN genres g ON mg.genre_id = g.id WHERE mg.media_id = media.id AND g.name LIKE ?)", 
				searchPattern, searchPattern, searchPattern).
			Order("view_count DESC, rating DESC").
			Find(&media).Error
	})

	// Add fallback thumbnail paths for search results
	for i := range media {
		if err := s.EnsureThumbnailFallback(&media[i]); err != nil {
			return media, err
		}
	}

	return media, err
}

func (s *MediaService) GetMediaByGenre(genreName string, page int, limit int) ([]models.Media, error) {
	var media []models.Media
	offset := (page - 1) * limit

	err := s.DBManager.WithReadOnly(func(db *gorm.DB) error {
		return db.Preload("Genres").Preload("Series").Preload("Subtitles").
			Joins("JOIN media_genres ON media.id = media_genres.media_id").
			Joins("JOIN genres ON media_genres.genre_id = genres.id").
			Where("genres.name ILIKE ?", genreName).
			Order("view_count DESC, rating DESC").
			Offset(offset).Limit(limit).
			Find(&media).Error
	})

	// Add fallback thumbnail paths
	for i := range media {
		if err := s.EnsureThumbnailFallback(&media[i]); err != nil {
			return media, err
		}
	}

	return media, err
}

// GetMediaByGenreSimple returns all media for a genre without pagination
func (s *MediaService) GetMediaByGenreSimple(genreName string) ([]models.Media, error) {
	var media []models.Media

	err := s.DBManager.WithReadOnly(func(db *gorm.DB) error {
		return db.Preload("Genres").Preload("Series").Preload("Subtitles").
			Joins("JOIN media_genres ON media.id = media_genres.media_id").
			Joins("JOIN genres ON media_genres.genre_id = genres.id").
			Where("genres.name ILIKE ?", genreName).
			Order("view_count DESC, rating DESC").
			Find(&media).Error
	})

	// Add fallback thumbnail paths
	for i := range media {
		if err := s.EnsureThumbnailFallback(&media[i]); err != nil {
			return media, err
		}
	}

	return media, err
}

func (s *MediaService) UpdateMediaViewCount(id uint) error {
	return s.DBManager.WithTx(func(tx *gorm.DB) error {
		return s.db.Model(&models.Media{}).Where("id = ?", id).UpdateColumn("view_count", gorm.Expr("view_count + 1")).Error
	})
}

func (s *MediaService) UpdateMedia(media *models.Media) error {
	return s.DBManager.WithTx(func(tx *gorm.DB) error {
		// First check if media exists
		existing := &models.Media{}
		if err := tx.First(existing, media.ID).Error; err != nil {
			return fmt.Errorf("media not found: %w", err)
		}

		// Set the updated timestamp
		media.UpdatedAt = time.Now()

		// Use Save() instead of Updates() to properly handle JSON fields
		if err := tx.Save(media).Error; err != nil {
			return fmt.Errorf("failed to update media: %w", err)
		}

		return nil
	})
}

func (s *MediaService) GetAllSeries() ([]models.Series, error) {
	var series []models.Series
	err := s.DBManager.WithReadOnly(func(db *gorm.DB) error {
		return db.Preload("Episodes").Find(&series).Error
	})
	return series, err
}

// GetGenreIDsByNames returns the IDs of genres matching the given names, creating any that don't exist
func (s *MediaService) GetGenreIDsByNames(genreNames []string) ([]uint, error) {
	var genreIDs []uint
	for _, name := range genreNames {
		var genre models.Genre
		result := s.db.Where("name = ?", name).First(&genre)
		if result.Error != nil {
			if errors.Is(result.Error, gorm.ErrRecordNotFound) {
				// Create new genre if it doesn't exist
				newGenre := models.Genre{Name: name}
				if err := s.db.Create(&newGenre).Error; err != nil {
					return nil, fmt.Errorf("failed to create genre %s: %v", name, err)
				}
				genreIDs = append(genreIDs, newGenre.ID)
			} else {
				return nil, fmt.Errorf("failed to find genre %s: %v", name, result.Error)
			}
		} else {
			genreIDs = append(genreIDs, genre.ID)
		}
	}
	return genreIDs, nil
}

func (s *MediaService) AssignGenresToMedia(mediaID uint, genreIDs []uint) error {
	return s.DBManager.WithTx(func(tx *gorm.DB) error {
		// Remove existing genre associations
		if err := tx.Exec("DELETE FROM media_genres WHERE media_id = ?", mediaID).Error; err != nil {
			return fmt.Errorf("failed to clear existing genres: %w", err)
		}

		// Add new genre associations
		for _, genreID := range genreIDs {
			var genre models.Genre
			if err := tx.First(&genre, genreID).Error; err != nil {
				return fmt.Errorf("genre not found: %w", err)
			}

			// Add association
			if err := tx.Exec("INSERT OR IGNORE INTO media_genres (media_id, genre_id) VALUES (?, ?)", mediaID, genre.ID).Error; err != nil {
				return fmt.Errorf("failed to add genre association: %w", err)
			}
		}

		return nil
	})
}

// GetRecommendedMedia returns personalized recommendations
func (s *MediaService) GetRecommendedMedia(userID uint, limit int) ([]models.Media, error) {
	var media []models.Media

	// Get user's genre preferences from ratings and watch history
	subquery := s.db.Table("("+
		"SELECT mg.media_id, COUNT(*) as genre_score "+
		"FROM media_genres mg "+
		"JOIN ("+
		"SELECT DISTINCT g.id "+
		"FROM genres g "+
		"JOIN media_genres mg2 ON g.id = mg2.genre_id "+
		"JOIN view_histories vh ON mg2.media_id = vh.media_id "+
		"WHERE vh.user_id = ? "+
		"UNION "+
		"SELECT DISTINCT g.id "+
		"FROM genres g "+
		"JOIN media_genres mg3 ON g.id = mg3.genre_id "+
		"JOIN user_ratings ur ON mg3.media_id = ur.media_id "+
		"WHERE ur.user_id = ? AND ur.rating >= 7"+
		") user_genres ON mg.genre_id = user_genres.id "+
		"GROUP BY mg.media_id"+
		") genre_matches ON media.id = genre_matches.media_id", userID, userID)

	// Exclude already watched content
	watchedSubquery := s.db.Table("view_histories").Select("media_id").Where("user_id = ?", userID)

	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
		Joins("LEFT JOIN (?) AS gm ON media.id = gm.media_id", subquery).
		Where("media.id NOT IN (?)", watchedSubquery).
		Order("COALESCE(gm.genre_score, 0) DESC, media.view_count DESC, media.rating DESC").
		Limit(limit).
		Find(&media).Error

	return media, err
}

// EnsureThumbnailFallback checks if media has thumbnails and creates fallback paths (exported for external use)
func (s *MediaService) EnsureThumbnailFallback(media *models.Media) error {
	return s.ensureThumbnailFallback(media)
}

// ensureThumbnailFallback checks if media has thumbnails and creates fallback paths
func (s *MediaService) ensureThumbnailFallback(media *models.Media) error {
	// Check if thumbnail exists, if not try to find one based on file path
	if media.ThumbnailPath == "" {
		// Try to find existing thumbnail files
		baseDir := filepath.Dir(media.FilePath)
		baseName := strings.TrimSuffix(filepath.Base(media.FilePath), filepath.Ext(media.FilePath))

		// Common thumbnail extensions and patterns
		thumbnailPatterns := []string{
			fmt.Sprintf("%s.jpg", baseName),
			fmt.Sprintf("%s.jpeg", baseName),
			fmt.Sprintf("%s.png", baseName),
			fmt.Sprintf("%s-thumb.jpg", baseName),
			fmt.Sprintf("%s_thumb.jpg", baseName),
			"folder.jpg",
			"poster.jpg",
			"cover.jpg",
		}

		for _, pattern := range thumbnailPatterns {
			thumbnailPath := filepath.Join(baseDir, pattern)
			if _, err := os.Stat(thumbnailPath); err == nil {
				media.ThumbnailPath = thumbnailPath
				// Update in database using DBManager
				s.DBManager.WithTx(func(tx *gorm.DB) error {
					return tx.Model(media).Update("thumbnail_path", thumbnailPath).Error
				})
				break
			}
		}
	}

	// Similar logic for poster paths
	if media.PosterPath == "" {
		baseDir := filepath.Dir(media.FilePath)
		baseName := strings.TrimSuffix(filepath.Base(media.FilePath), filepath.Ext(media.FilePath))

		posterPatterns := []string{
			fmt.Sprintf("%s-poster.jpg", baseName),
			fmt.Sprintf("%s_poster.jpg", baseName),
			"poster.jpg",
			"cover.jpg",
		}

		for _, pattern := range posterPatterns {
			posterPath := filepath.Join(baseDir, pattern)
			if _, err := os.Stat(posterPath); err == nil {
				media.PosterPath = posterPath
				s.DBManager.WithTx(func(tx *gorm.DB) error {
					return tx.Model(media).Update("poster_path", posterPath).Error
				})
				break
			}
		}
	}
	return nil
}

// SearchMediaAdvanced provides advanced search with filters
func (s *MediaService) SearchMediaAdvanced(query string, genreFilter string, typeFilter string, minRating float32) ([]models.Media, error) {
	var media []models.Media

	tx := s.db.Preload("Genres").Preload("Series").Preload("Subtitles")

	// Text search
	if query != "" {
		tx = tx.Where("title ILIKE ? OR description ILIKE ?", "%"+query+"%", "%"+query+"%")
	}

	// Genre filter
	if genreFilter != "" {
		tx = tx.Joins("JOIN media_genres ON media.id = media_genres.media_id").
			Joins("JOIN genres ON media_genres.genre_id = genres.id").
			Where("genres.name ILIKE ?", genreFilter)
	}

	// Type filter
	if typeFilter != "" {
		tx = tx.Where("type = ?", typeFilter)
	}

	// Rating filter
	if minRating > 0 {
		tx = tx.Where("rating >= ?", minRating)
	}

	err := tx.Order("view_count DESC, rating DESC").Find(&media).Error
	return media, err
}

// GetRecentMedia returns recently added media
func (s *MediaService) GetRecentMedia() ([]models.Media, error) {
	var media []models.Media
	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
		Order("created_at DESC").Limit(20).Find(&media).Error

	// Add fallback thumbnail paths for media without thumbnails
	for i := range media {
		s.ensureThumbnailFallback(&media[i])
	}

	return media, err
}

// GetPopularMedia returns popular media based on view count
func (s *MediaService) GetPopularMedia() ([]models.Media, error) {
	var media []models.Media
	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
		Order("view_count DESC").Limit(20).Find(&media).Error

	// Add fallback thumbnail paths for media without thumbnails
	for i := range media {
		s.ensureThumbnailFallback(&media[i])
	}

	return media, err
}

// GetTVShows returns media of type "episode", "tv", or "series" (TV show content)
func (s *MediaService) GetTVShows() ([]models.Media, error) {
	var media []models.Media
	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
		Where("type IN (?)", []string{"tv", "series", "episode"}).Order("created_at DESC").Find(&media).Error

	// Add fallback thumbnail paths for media without thumbnails
	for i := range media {
		s.ensureThumbnailFallback(&media[i])
	}

	return media, err
}


// GetSeasonsBySeriesID returns all seasons for a specific series
func (s *MediaService) GetSeasonsBySeriesID(seriesID uint) ([]map[string]interface{}, error) {
	var episodes []models.Media
	err := s.db.Preload("Genres").Preload("Subtitles").
		Where("series_id = ? OR id = ?", seriesID, seriesID).
		Where("type = ?", "episode").
		Order("COALESCE(season_number, season, 1), COALESCE(episode_number, episode, 1)").
		Find(&episodes).Error
	
	if err != nil {
		return nil, err
	}
	
	// Group episodes by season
	seasonMap := make(map[int][]models.Media)
	for _, ep := range episodes {
		season := 1
		if ep.SeasonNumber != nil {
			season = *ep.SeasonNumber
		} else if ep.Season != nil {
			season = *ep.Season
		}
		seasonMap[season] = append(seasonMap[season], ep)
	}
	
	// Convert to season objects
	var seasons []map[string]interface{}
	for seasonNum, seasonEpisodes := range seasonMap {
		season := map[string]interface{}{
			"season_number": seasonNum,
			"name":         fmt.Sprintf("Season %d", seasonNum),
			"episode_count": len(seasonEpisodes),
			"episodes":     seasonEpisodes,
		}
		seasons = append(seasons, season)
	}
	
	return seasons, nil
}

// GetEpisodesBySeriesAndSeason returns episodes for a specific series and season
func (s *MediaService) GetEpisodesBySeriesAndSeason(seriesID uint, seasonNumber int) ([]models.Media, error) {
	var episodes []models.Media
	err := s.db.Preload("Genres").Preload("Subtitles").
		Where("series_id = ? OR id = ?", seriesID, seriesID).
		Where("type = ?", "episode").
		Where("COALESCE(season_number, season, 1) = ?", seasonNumber).
		Order("COALESCE(episode_number, episode, 1)").
		Find(&episodes).Error
	
	// Add fallback thumbnail paths
	for i := range episodes {
		s.ensureThumbnailFallback(&episodes[i])
	}
	
	return episodes, err
}

// UpdateAllMediaGenres updates genres for all media (placeholder implementation)
func (s *MediaService) UpdateAllMediaGenres() error {
	// This would typically involve analyzing media files and updating genres
	// For now, return nil as a placeholder
	return nil
}

// GetTrendingMedia returns trending media based on recent activity and ratings
func (s *MediaService) GetTrendingMedia(limit int) ([]models.Media, error) {
	var media []models.Media

	// Get trending media based on view count and rating with recent bias
	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
		Where("view_count > 0 OR rating > 0").
		Order("(view_count * 0.7 + COALESCE(rating, 0) * 30) DESC, created_at DESC").
		Limit(limit).
		Find(&media).Error

	// Add fallback thumbnail paths
	for i := range media {
		s.ensureThumbnailFallback(&media[i])
	}

	return media, err
}

// GetSubtitles returns subtitles for a media item
func (s *MediaService) GetSubtitles(mediaID uint) ([]models.Subtitle, error) {
	var subtitles []models.Subtitle
	err := s.db.Where("media_id = ?", mediaID).Find(&subtitles).Error
	return subtitles, err
}

// GetSubtitleTracks returns all subtitle tracks (internal and external) for a media item
func (s *MediaService) GetSubtitleTracks(mediaID uint) ([]models.SubtitleTrack, error) {
	var tracks []models.SubtitleTrack
	err := s.DBManager.WithReadOnly(func(db *gorm.DB) error {
		return db.Where("media_id = ?", mediaID).Order("is_default DESC, stream_index ASC").Find(&tracks).Error
	})
	return tracks, err
}

// GetAudioTracks returns all audio tracks for a media item
func (s *MediaService) GetAudioTracks(mediaID uint) ([]models.AudioTrack, error) {
	var tracks []models.AudioTrack
	err := s.DBManager.WithReadOnly(func(db *gorm.DB) error {
		return db.Where("media_id = ?", mediaID).Order("is_default DESC, stream_index ASC").Find(&tracks).Error
	})
	return tracks, err
}

// GetSubtitleTrack returns a specific subtitle track by ID
func (s *MediaService) GetSubtitleTrack(trackID uint) (*models.SubtitleTrack, error) {
	var track models.SubtitleTrack
	err := s.DBManager.WithReadOnly(func(db *gorm.DB) error {
		return db.First(&track, trackID).Error
	})
	return &track, err
}

// CreateSubtitleTrack creates a new subtitle track entry
func (s *MediaService) CreateSubtitleTrack(track *models.SubtitleTrack) error {
	return s.DBManager.WithTx(func(tx *gorm.DB) error {
		return tx.Create(track).Error
	})
}

// CreateAudioTrack creates a new audio track entry
func (s *MediaService) CreateAudioTrack(track *models.AudioTrack) error {
	return s.DBManager.WithTx(func(tx *gorm.DB) error {
		return tx.Create(track).Error
	})
}

// SaveSubtitleTracks saves multiple subtitle tracks for a media item
func (s *MediaService) SaveSubtitleTracks(mediaID uint, tracks []models.SubtitleTrack) error {
	log.Printf("🎬 Saving %d subtitle tracks for media ID %d", len(tracks), mediaID)
	
	return s.DBManager.WithTx(func(tx *gorm.DB) error {
		// First, delete existing internal tracks for this media
		result := tx.Where("media_id = ? AND track_type = ?", mediaID, "internal").Delete(&models.SubtitleTrack{})
		if result.Error != nil {
			log.Printf("❌ Failed to delete existing internal subtitle tracks: %v", result.Error)
			return fmt.Errorf("failed to delete existing internal subtitle tracks: %w", result.Error)
		}
		log.Printf("🗑️ Deleted %d existing internal subtitle tracks for media ID %d", result.RowsAffected, mediaID)
		
		// Create new tracks
		for i, track := range tracks {
			track.MediaID = mediaID
			if err := tx.Create(&track).Error; err != nil {
				log.Printf("❌ Failed to create subtitle track %d (%s): %v", i, track.Language, err)
				return fmt.Errorf("failed to create subtitle track: %w", err)
			}
			log.Printf("✅ Created subtitle track: %s (%s) - stream %d", track.Language, track.TrackType, track.StreamIndex)
		}
		
		log.Printf("✅ Successfully saved %d subtitle tracks for media ID %d", len(tracks), mediaID)
		return nil
	})
}

// SaveAudioTracks saves multiple audio tracks for a media item
func (s *MediaService) SaveAudioTracks(mediaID uint, tracks []models.AudioTrack) error {
	log.Printf("🎵 Saving %d audio tracks for media ID %d", len(tracks), mediaID)
	
	return s.DBManager.WithTx(func(tx *gorm.DB) error {
		// First, delete existing tracks for this media
		result := tx.Where("media_id = ?", mediaID).Delete(&models.AudioTrack{})
		if result.Error != nil {
			log.Printf("❌ Failed to delete existing audio tracks: %v", result.Error)
			return fmt.Errorf("failed to delete existing audio tracks: %w", result.Error)
		}
		log.Printf("🗑️ Deleted %d existing audio tracks for media ID %d", result.RowsAffected, mediaID)
		
		// Create new tracks
		for i, track := range tracks {
			track.MediaID = mediaID
			if err := tx.Create(&track).Error; err != nil {
				log.Printf("❌ Failed to create audio track %d (%s): %v", i, track.Language, err)
				return fmt.Errorf("failed to create audio track: %w", err)
			}
			log.Printf("✅ Created audio track: %s (%s) - stream %d, %dch", track.Language, track.CodecName, track.StreamIndex, track.Channels)
		}
		
		log.Printf("✅ Successfully saved %d audio tracks for media ID %d", len(tracks), mediaID)
		return nil
	})
}

// UpdateSubtitleTrackPath updates the file path for a subtitle track
func (s *MediaService) UpdateSubtitleTrackPath(trackID uint, newPath string) error {
	return s.DBManager.WithTx(func(tx *gorm.DB) error {
		return tx.Model(&models.SubtitleTrack{}).Where("id = ?", trackID).Update("file_path", newPath).Error
	})
}

// DeleteSubtitleTrack deletes a subtitle track by ID
func (s *MediaService) DeleteSubtitleTrack(trackID uint) error {
	return s.DBManager.WithTx(func(tx *gorm.DB) error {
		// First delete any associated legacy subtitle entries
		tx.Where("id = ?", trackID).Delete(&models.Subtitle{})
		
		// Then delete the subtitle track
		return tx.Where("id = ?", trackID).Delete(&models.SubtitleTrack{}).Error
	})
}

// GetMediaByRating returns media sorted by rating (highest first)
func (s *MediaService) GetMediaByRating(limit int) ([]models.Media, error) {
	var media []models.Media
	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
		Where("rating > 0").
		Order("rating DESC, view_count DESC").
		Limit(limit).
		Find(&media).Error

	// Add fallback thumbnail paths
	for i := range media {
		s.ensureThumbnailFallback(&media[i])
	}

	return media, err
}

// GetMediaByGenreName returns media filtered by genre name
func (s *MediaService) GetMediaByGenreName(genreName string, limit int) ([]models.Media, error) {
	var media []models.Media
	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
		Joins("JOIN media_genres ON media.id = media_genres.media_id").
		Joins("JOIN genres ON media_genres.genre_id = genres.id").
		Where("LOWER(genres.name) = LOWER(?)", genreName).
		Order("rating DESC, view_count DESC, created_at DESC").
		Limit(limit).
		Find(&media).Error

	// Add fallback thumbnail paths
	for i := range media {
		s.ensureThumbnailFallback(&media[i])
	}

	return media, err
}

// Genre management methods
func (s *MediaService) GetAllGenres() ([]models.Genre, error) {
	var genres []models.Genre
	result := s.db.Find(&genres)
	return genres, result.Error
}

func (s *MediaService) GetGenreByID(id uint) (*models.Genre, error) {
	var genre models.Genre
	result := s.db.First(&genre, id)
	if result.Error != nil {
		return nil, result.Error
	}
	return &genre, nil
}

func (s *MediaService) CreateGenre(name, description string) (*models.Genre, error) {
	genre := &models.Genre{
		Name:        name,
		Description: description,
	}
	
	err := s.DBManager.WithTx(func(tx *gorm.DB) error {
		return tx.Create(genre).Error
	})
	
	return genre, err
}

func (s *MediaService) UpdateGenre(id uint, name, description string) (*models.Genre, error) {
	genre := &models.Genre{
		ID:          id,
		Name:        name,
		Description: description,
	}
	
	err := s.DBManager.WithTx(func(tx *gorm.DB) error {
		return tx.Save(genre).Error
	})
	
	return genre, err
}

func (s *MediaService) DeleteGenre(id uint) error {
	return s.db.Delete(&models.Genre{}, id).Error
}

// DeleteMedia removes a media entry from the database
func (s *MediaService) DeleteMedia(id uint) error {
	return s.DBManager.WithTx(func(tx *gorm.DB) error {
		// First, get the media record to access file paths
		var media models.Media
		if err := tx.First(&media, id).Error; err != nil {
			return fmt.Errorf("media not found: %w", err)
		}
		
		log.Printf("🗑️ Deleting media: %s (ID: %d)", media.Title, id)
		log.Printf("📁 Media file path: %s", media.FilePath)
		
		// Safely delete the media file BEFORE database cleanup
		if media.FilePath != "" {
			if err := s.safeDeleteMediaFile(media.FilePath, media.Title, "movie"); err != nil {
				log.Printf("⚠️ Failed to delete media file %s: %v", media.FilePath, err)
				// Continue with database cleanup even if file deletion fails
			}
		}
		
		// Remove all related associations
		if err := tx.Exec("DELETE FROM media_genres WHERE media_id = ?", id).Error; err != nil {
			return fmt.Errorf("failed to delete media-genre associations: %w", err)
		}
		
		// Delete subtitles associated with this media
		if err := tx.Where("media_id = ?", id).Delete(&models.Subtitle{}).Error; err != nil {
			return fmt.Errorf("failed to delete subtitles: %w", err)
		}
		
		// Delete playback progress records
		if err := tx.Exec("DELETE FROM playback_progress WHERE media_id = ?", id).Error; err != nil {
			// Log but don't fail if playback_progress table doesn't exist
			log.Printf("Warning: Could not delete playback progress for media %d: %v", id, err)
		}
		
		// Delete the media entry itself
		if err := tx.Delete(&models.Media{}, id).Error; err != nil {
			return fmt.Errorf("failed to delete media: %w", err)
		}
		
		log.Printf("✅ Successfully deleted media '%s' (ID: %d) and all related data", media.Title, id)
		return nil
	})
}

// DeleteSeries removes a TV series and all its episodes from the database
func (s *MediaService) DeleteSeries(id uint) error {
	return s.DBManager.WithTx(func(tx *gorm.DB) error {
		// Get the series to verify it exists
		var series models.Series
		if err := tx.First(&series, id).Error; err != nil {
			return fmt.Errorf("series not found: %w", err)
		}
		
		log.Printf("🗑️ Deleting TV series: %s (ID: %d)", series.Title, id)
		
		// Find all episodes (media items) associated with this series
		var episodes []models.Media
		if err := tx.Where("series_id = ?", id).Find(&episodes).Error; err != nil {
			return fmt.Errorf("failed to find episodes: %w", err)
		}
		
		log.Printf("📺 Found %d episodes to delete for series: %s", len(episodes), series.Title)
		
		// Safely delete each episode file BEFORE database cleanup
		for _, episode := range episodes {
			if episode.FilePath != "" {
				if err := s.safeDeleteMediaFile(episode.FilePath, episode.Title, "episode"); err != nil {
					log.Printf("⚠️ Failed to delete episode file %s: %v", episode.FilePath, err)
					// Continue with other episodes even if one fails
				}
			}
		}
		
		// Try to delete the series folder if it exists and is safe
		if len(episodes) > 0 {
			// Use the first episode's path to determine series folder
			firstEpisodePath := episodes[0].FilePath
			if firstEpisodePath != "" {
				seriesFolder := s.getSeriesFolderFromEpisodePath(firstEpisodePath, series.Title)
				if seriesFolder != "" {
					if err := s.safeDeleteSeriesFolder(seriesFolder, series.Title); err != nil {
						log.Printf("⚠️ Failed to delete series folder %s: %v", seriesFolder, err)
						// Continue with database cleanup even if folder deletion fails
					}
				}
			}
		}
		
		// Delete each episode and its associations
		for _, episode := range episodes {
			// Delete media-genre associations for this episode
			if err := tx.Exec("DELETE FROM media_genres WHERE media_id = ?", episode.ID).Error; err != nil {
				log.Printf("⚠️ Warning: Failed to delete genre associations for episode %d: %v", episode.ID, err)
			}
			
			// Delete subtitles for this episode
			if err := tx.Where("media_id = ?", episode.ID).Delete(&models.Subtitle{}).Error; err != nil {
				log.Printf("⚠️ Warning: Failed to delete subtitles for episode %d: %v", episode.ID, err)
			}
			
			// Delete playback progress for this episode
			if err := tx.Exec("DELETE FROM playback_progress WHERE media_id = ?", episode.ID).Error; err != nil {
				log.Printf("⚠️ Warning: Failed to delete playback progress for episode %d: %v", episode.ID, err)
			}
			
			// Delete the episode itself
			if err := tx.Delete(&models.Media{}, episode.ID).Error; err != nil {
				log.Printf("❌ Error deleting episode %d: %v", episode.ID, err)
				return fmt.Errorf("failed to delete episode %d: %w", episode.ID, err)
			}
		}
		
		// Delete series-genre associations
		if err := tx.Exec("DELETE FROM series_genres WHERE series_id = ?", id).Error; err != nil {
			log.Printf("⚠️ Warning: Failed to delete series genre associations: %v", err)
		}
		
		// Delete the series itself
		if err := tx.Delete(&models.Series{}, id).Error; err != nil {
			return fmt.Errorf("failed to delete series: %w", err)
		}
		
		log.Printf("✅ Successfully deleted series '%s' (ID: %d) with %d episodes and all related data", series.Title, id, len(episodes))
		return nil
	})
}

func (s *MediaService) GetGenreStats() (map[string]interface{}, error) {
	var totalGenres int64
	s.db.Model(&models.Genre{}).Count(&totalGenres)
	
	var topGenre struct {
		GenreName  string `json:"genre_name"`
		MediaCount int    `json:"media_count"`
	}
	
	s.db.Model(&models.Genre{}).
		Select("genres.name as genre_name, COUNT(media_genres.media_id) as media_count").
		Joins("LEFT JOIN media_genres ON genres.id = media_genres.genre_id").
		Group("genres.id, genres.name").
		Order("media_count DESC").
		Limit(1).
		Scan(&topGenre)
	
	return map[string]interface{}{
		"total_genres":     totalGenres,
		"top_genre":        topGenre.GenreName,
		"top_genre_count":  topGenre.MediaCount,
	}, nil
}

// GetRecentlyAdded returns recently added media
func (s *MediaService) GetRecentlyAdded(limit int) ([]models.Media, error) {
	var media []models.Media
	err := s.DBManager.WithReadOnly(func(db *gorm.DB) error {
		return db.Preload("Genres").Preload("Series").Preload("Subtitles").
			Order("created_at DESC").
			Limit(limit).
			Find(&media).Error
	})
	
	// Add fallback thumbnail paths
	for i := range media {
		s.ensureThumbnailFallback(&media[i])
	}
	
	return media, err
}

// GetMostWatched returns most watched media
func (s *MediaService) GetMostWatched(limit int) ([]models.Media, error) {
	var media []models.Media
	err := s.DBManager.WithReadOnly(func(db *gorm.DB) error {
		return db.Preload("Genres").Preload("Series").Preload("Subtitles").
			Where("view_count > 0").
			Order("view_count DESC").
			Limit(limit).
			Find(&media).Error
	})
	
	// Add fallback thumbnail paths
	for i := range media {
		s.ensureThumbnailFallback(&media[i])
	}
	
	return media, err
}

// GetHighestRated returns highest rated media
func (s *MediaService) GetHighestRated(limit int) ([]models.Media, error) {
	var media []models.Media
	err := s.DBManager.WithReadOnly(func(db *gorm.DB) error {
		return db.Preload("Genres").Preload("Series").Preload("Subtitles").
			Where("rating > 0").
			Order("rating DESC, view_count DESC").
			Limit(limit).
			Find(&media).Error
	})
	
	// Add fallback thumbnail paths
	for i := range media {
		s.ensureThumbnailFallback(&media[i])
	}
	
	return media, err
}

// safeDeleteMediaFile safely deletes a media file with extensive safety checks
func (s *MediaService) safeDeleteMediaFile(filePath, title, mediaType string) error {
	if filePath == "" {
		return fmt.Errorf("empty file path")
	}
	
	// Convert to absolute path for safety checks
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return fmt.Errorf("failed to get absolute path: %v", err)
	}
	
	log.Printf("🔍 Attempting to delete %s file: %s", mediaType, absPath)
	
	// CRITICAL SAFETY CHECKS - Never delete system paths
	if !s.isSafePathToDelete(absPath) {
		return fmt.Errorf("refusing to delete unsafe path: %s", absPath)
	}
	
	// Check if file exists
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		log.Printf("⚠️ File already doesn't exist: %s", absPath)
		return nil // Not an error if file doesn't exist
	}
	
	// Verify it's a media file by extension
	if !s.isMediaFile(absPath) {
		return fmt.Errorf("refusing to delete non-media file: %s", absPath)
	}
	
	// Check if this file is referenced by other media entries
	if s.isFileReferencedByOtherMedia(filePath, title) {
		return fmt.Errorf("file is referenced by other media entries, refusing to delete: %s", absPath)
	}
	
	// Perform the deletion
	if err := os.Remove(absPath); err != nil {
		return fmt.Errorf("failed to delete file: %v", err)
	}
	
	log.Printf("🗑️ Successfully deleted %s file: %s", mediaType, absPath)
	
	// Try to clean up empty parent directory if it's safe
	parentDir := filepath.Dir(absPath)
	s.tryCleanupEmptyDirectory(parentDir, title)
	
	return nil
}

// safeDeleteSeriesFolder safely deletes a TV series folder after all episodes are removed
func (s *MediaService) safeDeleteSeriesFolder(folderPath, seriesTitle string) error {
	if folderPath == "" {
		return fmt.Errorf("empty folder path")
	}
	
	// Convert to absolute path for safety checks
	absPath, err := filepath.Abs(folderPath)
	if err != nil {
		return fmt.Errorf("failed to get absolute path: %v", err)
	}
	
	log.Printf("🔍 Attempting to delete series folder: %s", absPath)
	
	// CRITICAL SAFETY CHECKS
	if !s.isSafePathToDelete(absPath) {
		return fmt.Errorf("refusing to delete unsafe path: %s", absPath)
	}
	
	// Check if directory exists
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		log.Printf("⚠️ Directory already doesn't exist: %s", absPath)
		return nil // Not an error if directory doesn't exist
	}
	
	// Verify it's a directory
	if info, err := os.Stat(absPath); err != nil || !info.IsDir() {
		return fmt.Errorf("path is not a directory: %s", absPath)
	}
	
	// Check if folder name matches series title (safety check)
	if !s.isFolderNameMatchingSeries(absPath, seriesTitle) {
		return fmt.Errorf("folder name doesn't match series title, refusing to delete: %s", absPath)
	}
	
	// Check if folder is empty or only contains safe files
	if !s.isFolderSafeToDelete(absPath) {
		return fmt.Errorf("folder contains unsafe files or other media, refusing to delete: %s", absPath)
	}
	
	// Perform the deletion
	if err := os.RemoveAll(absPath); err != nil {
		return fmt.Errorf("failed to delete folder: %v", err)
	}
	
	log.Printf("🗑️ Successfully deleted series folder: %s", absPath)
	
	// Try to clean up empty parent directory if it's safe
	parentDir := filepath.Dir(absPath)
	s.tryCleanupEmptyDirectory(parentDir, seriesTitle)
	
	return nil
}

// getSeriesFolderFromEpisodePath determines the series folder from an episode path
func (s *MediaService) getSeriesFolderFromEpisodePath(episodePath, seriesTitle string) string {
	if episodePath == "" {
		return ""
	}
	
	// Get the directory containing the episode file
	episodeDir := filepath.Dir(episodePath)
	
	// Check if this directory name matches the series title
	dirName := filepath.Base(episodeDir)
	if s.isNameSimilar(dirName, seriesTitle, 0.7) {
		return episodeDir
	}
	
	// Check parent directory (in case episodes are in season folders)
	parentDir := filepath.Dir(episodeDir)
	parentName := filepath.Base(parentDir)
	if s.isNameSimilar(parentName, seriesTitle, 0.7) {
		return parentDir
	}
	
	return ""
}

// isSafePathToDelete performs critical safety checks on paths
func (s *MediaService) isSafePathToDelete(absPath string) bool {
	// List of paths that should NEVER be deleted
	unsafePaths := []string{
		"/",
		"/home",
		"/usr",
		"/var",
		"/etc",
		"/bin",
		"/sbin",
		"/lib",
		"/opt",
		"/root",
		"/boot",
		"/dev",
		"/proc",
		"/sys",
		"/tmp",
		"/mnt",
		"/media",
		"C:\\",
		"C:\\Windows",
		"C:\\Program Files",
		"C:\\Users",
		"C:\\System32",
	}
	
	// Check against unsafe paths
	for _, unsafePath := range unsafePaths {
		if absPath == unsafePath || strings.HasPrefix(absPath, unsafePath+string(filepath.Separator)) {
			log.Printf("🛡️ Blocked deletion of system path: %s", absPath)
			return false
		}
	}
	
	// Must be at least 3 levels deep to be considered safe
	pathParts := strings.Split(strings.Trim(absPath, string(filepath.Separator)), string(filepath.Separator))
	if len(pathParts) < 3 {
		log.Printf("🛡️ Path too shallow, refusing to delete: %s (parts: %d)", absPath, len(pathParts))
		return false
	}
	
	// Check if it's in a media/downloads directory (safer)
	pathLower := strings.ToLower(absPath)
	safeKeywords := []string{"media", "movies", "tv", "shows", "series", "download", "torrent"}
	for _, keyword := range safeKeywords {
		if strings.Contains(pathLower, keyword) {
			log.Printf("✅ Path contains safe keyword '%s': %s", keyword, absPath)
			return true
		}
	}
	
	// If no safe keywords found, be more cautious
	log.Printf("⚠️ Path doesn't contain safe keywords, being cautious: %s", absPath)
	return false
}

// isMediaFile checks if a file is a media file by extension
func (s *MediaService) isMediaFile(filePath string) bool {
	ext := strings.ToLower(filepath.Ext(filePath))
	mediaExtensions := []string{
		".mkv", ".mp4", ".avi", ".mov", ".wmv", ".m4v", ".flv", ".webm",
		".mpg", ".mpeg", ".3gp", ".asf", ".rm", ".rmvb", ".vob", ".ts",
	}
	
	for _, mediaExt := range mediaExtensions {
		if ext == mediaExt {
			return true
		}
	}
	
	log.Printf("🛡️ File is not a recognized media file: %s", filePath)
	return false
}

// isFileReferencedByOtherMedia checks if the file is referenced by other media entries
func (s *MediaService) isFileReferencedByOtherMedia(filePath, currentTitle string) bool {
	var count int64
	
	// Check if any other media entries reference this file path
	s.db.Model(&models.Media{}).
		Where("file_path = ? AND title != ?", filePath, currentTitle).
		Count(&count)
	
	if count > 0 {
		log.Printf("🛡️ File is referenced by %d other media entries: %s", count, filePath)
		return true
	}
	
	return false
}

// isFolderNameMatchingSeries checks if folder name matches series title
func (s *MediaService) isFolderNameMatchingSeries(folderPath, seriesTitle string) bool {
	folderName := filepath.Base(folderPath)
	return s.isNameSimilar(folderName, seriesTitle, 0.6) // 60% similarity threshold
}

// isFolderSafeToDelete checks if a folder is safe to delete (empty or contains only safe files)
func (s *MediaService) isFolderSafeToDelete(folderPath string) bool {
	isEmpty := true
	hasUnsafeFiles := false
	
	err := filepath.Walk(folderPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Continue on errors
		}
		
		// Skip the root folder itself
		if path == folderPath {
			return nil
		}
		
		isEmpty = false
		
		// If it's a file, check if it's safe to delete
		if !info.IsDir() {
			if !s.isSafeFileToDelete(path) {
				hasUnsafeFiles = true
				return filepath.SkipDir // Stop walking
			}
		}
		
		return nil
	})
	
	if err != nil {
		log.Printf("⚠️ Error walking folder %s: %v", folderPath, err)
		return false
	}
	
	if hasUnsafeFiles {
		log.Printf("🛡️ Folder contains unsafe files: %s", folderPath)
		return false
	}
	
	if isEmpty {
		log.Printf("✅ Folder is empty and safe to delete: %s", folderPath)
	} else {
		log.Printf("✅ Folder contains only safe files: %s", folderPath)
	}
	
	return true
}

// isSafeFileToDelete checks if an individual file is safe to delete
func (s *MediaService) isSafeFileToDelete(filePath string) bool {
	fileName := strings.ToLower(filepath.Base(filePath))
	
	// Never delete system or important files
	dangerousFiles := []string{
		"desktop.ini", "thumbs.db", ".ds_store",
		"autorun.inf", "boot.ini", "config.sys",
		"system.ini", "win.ini", "msdos.sys",
		"io.sys", "pagefile.sys", "hiberfil.sys",
	}
	
	for _, dangerous := range dangerousFiles {
		if fileName == dangerous {
			log.Printf("🛡️ Refusing to delete system file: %s", fileName)
			return false
		}
	}
	
	// Only delete media files and related safe files
	safeExtensions := []string{
		".mkv", ".mp4", ".avi", ".mov", ".wmv", ".m4v", ".flv", ".webm",
		".mpg", ".mpeg", ".3gp", ".asf", ".rm", ".rmvb", ".vob", ".ts",
		".srt", ".vtt", ".ass", ".ssa", ".sub", ".idx",
		".nfo", ".txt", ".jpg", ".jpeg", ".png", ".bmp",
	}
	
	ext := strings.ToLower(filepath.Ext(fileName))
	for _, safeExt := range safeExtensions {
		if ext == safeExt {
			return true
		}
	}
	
	log.Printf("🛡️ Refusing to delete file with unknown extension: %s", fileName)
	return false
}

// tryCleanupEmptyDirectory attempts to remove empty parent directories
func (s *MediaService) tryCleanupEmptyDirectory(dirPath, mediaTitle string) {
	if dirPath == "" || dirPath == "/" || dirPath == "." {
		return
	}
	
	// Don't clean up if path is too shallow
	pathParts := strings.Split(strings.Trim(dirPath, string(filepath.Separator)), string(filepath.Separator))
	if len(pathParts) < 3 {
		return
	}
	
	// Check if directory is empty
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return // Can't read directory, skip cleanup
	}
	
	if len(entries) == 0 {
		// Directory is empty, safe to remove
		if err := os.Remove(dirPath); err == nil {
			log.Printf("🧹 Cleaned up empty directory: %s", dirPath)
			
			// Recursively try to clean up parent directory
			parentDir := filepath.Dir(dirPath)
			if parentDir != dirPath { // Avoid infinite recursion
				s.tryCleanupEmptyDirectory(parentDir, mediaTitle)
			}
		}
	}
}

// isNameSimilar checks if two names are similar using fuzzy matching
func (s *MediaService) isNameSimilar(name1, name2 string, threshold float64) bool {
	if name1 == "" || name2 == "" {
		return false
	}
	
	// Normalize names for comparison
	norm1 := s.normalizeName(name1)
	norm2 := s.normalizeName(name2)
	
	// Calculate similarity
	similarity := s.calculateNameSimilarity(norm1, norm2)
	
	return similarity >= threshold
}

// normalizeName normalizes a name for comparison
func (s *MediaService) normalizeName(name string) string {
	// Convert to lowercase
	normalized := strings.ToLower(name)
	
	// Remove common words and characters
	replacements := []string{
		".", " ", "_", "-", "(", ")", "[", "]", "{", "}",
		"the", "a", "an", "and", "or", "of", "in", "on", "at", "to", "for",
		"2160p", "1080p", "720p", "480p", "4k", "hd", "bluray", "webrip", "hdtv",
	}
	
	for _, replacement := range replacements {
		normalized = strings.ReplaceAll(normalized, replacement, "")
	}
	
	// Remove extra spaces
	normalized = strings.TrimSpace(normalized)
	normalized = regexp.MustCompile(`\s+`).ReplaceAllString(normalized, "")
	
	return normalized
}

// calculateNameSimilarity calculates similarity between two normalized names
func (s *MediaService) calculateNameSimilarity(name1, name2 string) float64 {
	if name1 == name2 {
		return 1.0
	}
	
	if name1 == "" || name2 == "" {
		return 0.0
	}
	
	// Simple word-based similarity
	words1 := strings.Fields(name1)
	words2 := strings.Fields(name2)
	
	if len(words1) == 0 || len(words2) == 0 {
		return 0.0
	}
	
	matchingWords := 0
	totalWords := len(words1)
	
	for _, word1 := range words1 {
		for _, word2 := range words2 {
			if len(word1) < 3 || len(word2) < 3 {
				continue
			}
			
			if word1 == word2 || 
			   (len(word1) > 4 && strings.Contains(word1, word2)) || 
			   (len(word2) > 4 && strings.Contains(word2, word1)) {
				matchingWords++
				break
			}
		}
	}
	
	if totalWords == 0 {
		return 0.0
	}
	
	return float64(matchingWords) / float64(totalWords)
}