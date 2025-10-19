package services

import (
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
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

func (s *MediaService) FindOrCreateSeries(title string) (*models.Series, error) {
	var series models.Series
	err := s.DBManager.WithTx(func(tx *gorm.DB) error {
		if err := tx.Where("title = ?", title).First(&series).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				series = models.Series{
					Title:  title,
					Status: "ongoing",
				}
				return tx.Create(&series).Error
			}
			return err
		}
		return nil
	})
	return &series, err
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

// GetTVShows returns media of type "episode" (TV show episodes)
func (s *MediaService) GetTVShows() ([]models.Media, error) {
	var media []models.Media
	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
		Where("type = ?", "episode").Order("created_at DESC").Find(&media).Error

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
		// First, remove all related associations
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
		
		log.Printf("Successfully deleted media with ID %d and all related data", id)
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

