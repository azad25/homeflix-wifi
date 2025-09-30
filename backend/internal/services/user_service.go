package services

import (
	"time"

	"gorm.io/gorm"
	"homeflix-backend/internal/models"
)

type UserService struct {
	db *gorm.DB
}

func NewUserService(db *gorm.DB) *UserService {
	return &UserService{db: db}
}

// GetOrCreateDefaultUser gets the default user or creates one if it doesn't exist
func (s *UserService) GetOrCreateDefaultUser() (*models.User, error) {
	var user models.User
	err := s.db.Where("username = ?", "default").First(&user).Error
	
	if err == gorm.ErrRecordNotFound {
		// Create default user
		user = models.User{
			Username:          "default",
			Email:             "user@homeflix.local",
			PreferredLanguage: "en",
			PreferredQuality:  "1080p",
		}
		err = s.db.Create(&user).Error
	}
	
	return &user, err
}

// TrackView records a view in the user's history
func (s *UserService) TrackView(userID uint, mediaID uint, progress int, completed bool) error {
	// Check if view history already exists
	var viewHistory models.ViewHistory
	err := s.db.Where("user_id = ? AND media_id = ?", userID, mediaID).First(&viewHistory).Error
	
	if err == gorm.ErrRecordNotFound {
		// Create new view history
		viewHistory = models.ViewHistory{
			UserID:    userID,
			MediaID:   mediaID,
			Progress:  progress,
			Completed: completed,
			WatchedAt: time.Now(),
		}
		return s.db.Create(&viewHistory).Error
	} else {
		// Update existing view history
		viewHistory.Progress = progress
		viewHistory.Completed = completed
		viewHistory.WatchedAt = time.Now()
		return s.db.Save(&viewHistory).Error
	}
}

// RateMedia allows user to rate media
func (s *UserService) RateMedia(userID uint, mediaID uint, rating float32, review string) error {
	// Validate rating range
	if rating < 0 || rating > 10 {
		return gorm.ErrInvalidValue
	}
	
	var userRating models.UserRating
	err := s.db.Where("user_id = ? AND media_id = ?", userID, mediaID).First(&userRating).Error
	
	if err == gorm.ErrRecordNotFound {
		// Create new rating
		userRating = models.UserRating{
			UserID:  userID,
			MediaID: mediaID,
			Rating:  rating,
			Review:  review,
		}
		return s.db.Create(&userRating).Error
	} else {
		// Update existing rating
		userRating.Rating = rating
		userRating.Review = review
		return s.db.Save(&userRating).Error
	}
}

// GetUserRating gets user's rating for specific media
func (s *UserService) GetUserRating(userID uint, mediaID uint) (*models.UserRating, error) {
	var userRating models.UserRating
	err := s.db.Where("user_id = ? AND media_id = ?", userID, mediaID).First(&userRating).Error
	if err != nil {
		return nil, err
	}
	return &userRating, nil
}

// AddToWatchlist adds media to user's watchlist
func (s *UserService) AddToWatchlist(userID uint, mediaID uint) error {
	// Check if already in watchlist
	var existing models.WatchlistItem
	err := s.db.Where("user_id = ? AND media_id = ?", userID, mediaID).First(&existing).Error
	
	if err == gorm.ErrRecordNotFound {
		watchlistItem := models.WatchlistItem{
			UserID:  userID,
			MediaID: mediaID,
		}
		return s.db.Create(&watchlistItem).Error
	}
	
	return nil // Already in watchlist
}

// RemoveFromWatchlist removes media from user's watchlist
func (s *UserService) RemoveFromWatchlist(userID uint, mediaID uint) error {
	return s.db.Where("user_id = ? AND media_id = ?", userID, mediaID).Delete(&models.WatchlistItem{}).Error
}

// GetWatchlist gets user's watchlist
func (s *UserService) GetWatchlist(userID uint) ([]models.Media, error) {
	var watchlistItems []models.WatchlistItem
	err := s.db.Preload("Media").Preload("Media.Genres").Where("user_id = ?", userID).Find(&watchlistItems).Error
	
	var media []models.Media
	for _, item := range watchlistItems {
		media = append(media, item.Media)
	}
	
	return media, err
}

// GetViewHistory gets user's viewing history
func (s *UserService) GetViewHistory(userID uint, limit int) ([]models.ViewHistory, error) {
	var viewHistory []models.ViewHistory
	err := s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ?", userID).
		Order("watched_at DESC").
		Limit(limit).
		Find(&viewHistory).Error
	
	return viewHistory, err
}

// GetUserRatings gets all user ratings
func (s *UserService) GetUserRatings(userID uint) ([]models.UserRating, error) {
	var ratings []models.UserRating
	err := s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&ratings).Error
	
	return ratings, err
}

// UpdateMediaProgress updates the progress for a specific media
func (s *UserService) UpdateMediaProgress(userID uint, mediaID uint, progress int) error {
	var viewHistory models.ViewHistory
	err := s.db.Where("user_id = ? AND media_id = ?", userID, mediaID).First(&viewHistory).Error
	
	if err == gorm.ErrRecordNotFound {
		// Create new view history
		viewHistory = models.ViewHistory{
			UserID:    userID,
			MediaID:   mediaID,
			Progress:  progress,
			Completed: false,
			WatchedAt: time.Now(),
		}
		return s.db.Create(&viewHistory).Error
	} else {
		// Update existing progress
		viewHistory.Progress = progress
		viewHistory.WatchedAt = time.Now()
		return s.db.Save(&viewHistory).Error
	}
}
