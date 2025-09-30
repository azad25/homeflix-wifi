package services

import (
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
	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").Find(&media).Error
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
	
	// Enhanced search with multiple fields and better ranking
	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
		Where("title ILIKE ? OR description ILIKE ?", "%"+query+"%", "%"+query+"%").
		Or("EXISTS (SELECT 1 FROM media_genres mg JOIN genres g ON mg.genre_id = g.id WHERE mg.media_id = media.id AND g.name ILIKE ?)", "%"+query+"%").
		Order("CASE WHEN title ILIKE '" + query + "%' THEN 1 WHEN description ILIKE '%" + query + "%' THEN 2 ELSE 3 END, view_count DESC").
		Find(&media).Error
	
	return media, err
}

func (s *MediaService) GetMediaByGenre(genreName string) ([]models.Media, error) {
	var media []models.Media
	err := s.db.Preload("Genres").Preload("Series").Preload("Subtitles").
		Joins("JOIN media_genres ON media.id = media_genres.media_id").
		Joins("JOIN genres ON media_genres.genre_id = genres.id").
		Where("genres.name = ?", genreName).
		Find(&media).Error
	return media, err
}

func (s *MediaService) GetAllGenres() ([]models.Genre, error) {
	var genres []models.Genre
	err := s.db.Find(&genres).Error
	return genres, err
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
