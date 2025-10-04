package services

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"homeflix-backend/internal/models"

	"gorm.io/gorm"
)

type MediaService struct {
	db *gorm.DB
}

func NewMediaService(db *gorm.DB) *MediaService {
	return &MediaService{db: db}
}

func (s *MediaService) CreateMedia(media *models.Media) error {
	return s.db.Create(media).Error
}

func (s *MediaService) GetAllMedia() ([]models.Media, error) {
	var media []models.Media
	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
		Order("created_at DESC").Find(&media).Error
	
	// Add fallback thumbnail paths for media without thumbnails
	for i := range media {
		s.ensureThumbnailFallback(&media[i])
	}
	
	return media, err
}

func (s *MediaService) GetMediaByID(id uint) (*models.Media, error) {
	var media models.Media
	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").First(&media, id).Error
	return &media, err
}

func (s *MediaService) GetMediaByPath(path string) (*models.Media, error) {
	var media models.Media
	err := s.db.Where("file_path = ?", path).First(&media).Error
	return &media, err
}

func (s *MediaService) MediaExists(path string) (bool, error) {
	var count int64
	err := s.db.Model(&models.Media{}).Where("file_path = ?", path).Count(&count).Error
	return count > 0, err
}

func (s *MediaService) GetMovies() ([]models.Media, error) {
	var movies []models.Media
	err := s.db.Preload("Genres").Preload("Subtitles").Where("type = ?", "movie").Find(&movies).Error
	return movies, err
}

func (s *MediaService) GetSeries() ([]models.Series, error) {
	var series []models.Series
	err := s.db.Preload("Episodes").Preload("Episodes.Subtitles").Preload("Genres").Find(&series).Error
	return series, err
}

func (s *MediaService) GetSeriesByID(id uint) (*models.Series, error) {
	var series models.Series
	err := s.db.Preload("Episodes").Preload("Episodes.Subtitles").Preload("Genres").First(&series, id).Error
	return &series, err
}

func (s *MediaService) FindOrCreateSeries(title string) (*models.Series, error) {
	var series models.Series
	err := s.db.Where("title = ?", title).First(&series).Error
	
	if err == gorm.ErrRecordNotFound {
		series = models.Series{
			Title:  title,
			Status: "ongoing",
		}
		err = s.db.Create(&series).Error
	}
	
	return &series, err
}

func (s *MediaService) CreateSubtitle(subtitle *models.Subtitle) error {
	return s.db.Create(subtitle).Error
}

func (s *MediaService) SearchMedia(query string) ([]models.Media, error) {
	var media []models.Media
	
	// Enhanced search with multiple fields and better ranking (SQL injection safe)
	searchPattern := "%" + query + "%"
	titlePattern := query + "%"
	
	// Build the query step by step to avoid parameter binding issues
	dbQuery := s.db.Preload("Genres").Preload("Series").Preload("Subtitles")
	
	// Add search conditions
	dbQuery = dbQuery.Where("title ILIKE ? OR description ILIKE ? OR EXISTS (SELECT 1 FROM media_genres mg JOIN genres g ON mg.genre_id = g.id WHERE mg.media_id = media.id AND g.name ILIKE ?)", searchPattern, searchPattern, searchPattern)
	
	// Add ordering with title preference
	dbQuery = dbQuery.Order("CASE WHEN title ILIKE '" + titlePattern + "' THEN 1 WHEN description ILIKE '" + searchPattern + "' THEN 2 ELSE 3 END, view_count DESC, rating DESC")
	
	err := dbQuery.Find(&media).Error
	
	// Add fallback thumbnail paths for search results
	for i := range media {
		s.ensureThumbnailFallback(&media[i])
	}
	
	return media, err
}

func (s *MediaService) GetMediaByGenre(genreName string, page int, limit int) ([]models.Media, error) {
	var media []models.Media
	offset := (page - 1) * limit
	
	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
		Joins("JOIN media_genres ON media.id = media_genres.media_id").
		Joins("JOIN genres ON media_genres.genre_id = genres.id").
		Where("genres.name ILIKE ?", genreName).
		Order("view_count DESC, rating DESC").
		Offset(offset).Limit(limit).
		Find(&media).Error
	
	// Add fallback thumbnail paths
	for i := range media {
		s.ensureThumbnailFallback(&media[i])
	}
	
	return media, err
}

// GetMediaByGenreSimple returns all media for a genre without pagination
func (s *MediaService) GetMediaByGenreSimple(genreName string) ([]models.Media, error) {
	var media []models.Media
	
	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
		Joins("JOIN media_genres ON media.id = media_genres.media_id").
		Joins("JOIN genres ON media_genres.genre_id = genres.id").
		Where("genres.name ILIKE ?", genreName).
		Order("view_count DESC, rating DESC").
		Find(&media).Error
	
	// Add fallback thumbnail paths
	for i := range media {
		s.ensureThumbnailFallback(&media[i])
	}
	
	return media, err
}

func (s *MediaService) GetAllGenres() ([]models.Genre, error) {
	var genres []models.Genre
	err := s.db.Find(&genres).Error
	return genres, err
}

func (s *MediaService) GetGenreByID(id uint) (*models.Genre, error) {
	var genre models.Genre
	err := s.db.First(&genre, id).Error
	return &genre, err
}

func (s *MediaService) CreateGenre(name, description string) (*models.Genre, error) {
	genre := &models.Genre{
		Name:        name,
		Description: description,
	}
	err := s.db.Create(genre).Error
	return genre, err
}

func (s *MediaService) UpdateGenre(id uint, name, description string) (*models.Genre, error) {
	var genre models.Genre
	if err := s.db.First(&genre, id).Error; err != nil {
		return nil, err
	}
	
	if name != "" {
		genre.Name = name
	}
	if description != "" {
		genre.Description = description
	}
	
	err := s.db.Save(&genre).Error
	return &genre, err
}

func (s *MediaService) DeleteGenre(id uint) error {
	// First remove associations with media
	if err := s.db.Exec("DELETE FROM media_genres WHERE genre_id = ?", id).Error; err != nil {
		return err
	}
	
	// Then delete the genre
	return s.db.Delete(&models.Genre{}, id).Error
}

func (s *MediaService) GetGenreStats() (map[string]interface{}, error) {
	var stats []struct {
		GenreName  string `json:"genre_name"`
		MediaCount int    `json:"media_count"`
	}
	
	err := s.db.Table("genres").
		Select("genres.name as genre_name, COUNT(media_genres.media_id) as media_count").
		Joins("LEFT JOIN media_genres ON genres.id = media_genres.genre_id").
		Group("genres.id, genres.name").
		Order("media_count DESC").
		Scan(&stats).Error
	
	if err != nil {
		return nil, err
	}
	
	var totalGenres int64
	s.db.Model(&models.Genre{}).Count(&totalGenres)
	
	var totalMedia int64
	s.db.Model(&models.Media{}).Count(&totalMedia)
	
	return map[string]interface{}{
		"total_genres": totalGenres,
		"total_media":  totalMedia,
		"genre_stats":  stats,
	}, nil
}

func (s *MediaService) UpdateMediaViewCount(id uint) error {
	return s.db.Model(&models.Media{}).Where("id = ?", id).
		UpdateColumn("view_count", gorm.Expr("view_count + 1")).Error
}

func (s *MediaService) GetRecentlyAdded(limit int) ([]models.Media, error) {
	var media []models.Media
	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
		Order("created_at DESC").Limit(limit).Find(&media).Error
	return media, err
}

func (s *MediaService) GetMostWatched(limit int) ([]models.Media, error) {
	var media []models.Media
	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
		Order("view_count DESC").Limit(limit).Find(&media).Error
	return media, err
}

func (s *MediaService) UpdateMedia(media *models.Media) error {
	return s.db.Save(media).Error
}

func (s *MediaService) GetAllSeries() ([]models.Series, error) {
	var series []models.Series
	err := s.db.Preload("Episodes").Find(&series).Error
	return series, err
}

func (s *MediaService) AssignGenresToMedia(mediaID uint, genreNames []string) error {
	// Get the media
	var media models.Media
	if err := s.db.First(&media, mediaID).Error; err != nil {
		return err
	}

	// Find or create genres
	var genres []models.Genre
	for _, genreName := range genreNames {
		var genre models.Genre
		err := s.db.Where("name = ?", genreName).First(&genre).Error
		if err != nil {
			// Genre doesn't exist, create it
			genre = models.Genre{
				Name:        genreName,
				Description: genreName + " genre",
			}
			if err := s.db.Create(&genre).Error; err != nil {
				return err
			}
		}
		genres = append(genres, genre)
	}

	// Associate genres with media
	return s.db.Model(&media).Association("Genres").Replace(genres)
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

// ensureThumbnailFallback checks if media has thumbnails and creates fallback paths
func (s *MediaService) ensureThumbnailFallback(media *models.Media) {
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
				// Update in database
				s.db.Model(media).Update("thumbnail_path", thumbnailPath)
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
				s.db.Model(media).Update("poster_path", posterPath)
				break
			}
		}
	}
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

// GetTVShows returns media of type "series"
func (s *MediaService) GetTVShows() ([]models.Media, error) {
	var media []models.Media
	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
		Where("type = ?", "series").Order("created_at DESC").Find(&media).Error
	
	// Add fallback thumbnail paths for media without thumbnails
	for i := range media {
		s.ensureThumbnailFallback(&media[i])
	}
	
	return media, err
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
