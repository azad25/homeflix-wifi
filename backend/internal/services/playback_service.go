package services

import (
	"fmt"
	"time"

	"gorm.io/gorm"
	"homeflix-backend/internal/models"
)

type PlaybackService struct {
	db *gorm.DB
}

func NewPlaybackService(db *gorm.DB) *PlaybackService {
	return &PlaybackService{db: db}
}

// UpdatePlaybackProgress updates or creates playback progress for a user
func (s *PlaybackService) UpdatePlaybackProgress(userID string, mediaID uint, position, duration float64) error {
	// Ensure duration is valid
	if duration <= 0 {
		return fmt.Errorf("invalid duration: %f", duration)
	}
	
	progress := (position / duration) * 100
	completed := progress >= 90 // Consider 90%+ as completed

	var playbackProgress models.PlaybackProgress
	result := s.db.Where("user_id = ? AND media_id = ?", userID, mediaID).First(&playbackProgress)

	if result.Error == gorm.ErrRecordNotFound {
		// Create new progress record
		playbackProgress = models.PlaybackProgress{
			UserID:      userID,
			MediaID:     mediaID,
			Position:    position,
			Duration:    duration,
			Progress:    progress,
			Completed:   completed,
			LastWatched: time.Now(),
		}
		return s.db.Create(&playbackProgress).Error
	}

	// Update existing record
	playbackProgress.Position = position
	playbackProgress.Duration = duration
	playbackProgress.Progress = progress
	playbackProgress.Completed = completed
	playbackProgress.LastWatched = time.Now()

	return s.db.Save(&playbackProgress).Error
}

// EnsurePlaybackProgress ensures a progress record exists for a user and media
func (s *PlaybackService) EnsurePlaybackProgress(userID string, mediaID uint) error {
	var count int64
	s.db.Model(&models.PlaybackProgress{}).Where("user_id = ? AND media_id = ?", userID, mediaID).Count(&count)
	
	if count == 0 {
		// Create initial progress record
		progress := models.PlaybackProgress{
			UserID:      userID,
			MediaID:     mediaID,
			Position:    0,
			Duration:    0,
			Progress:    0,
			Completed:   false,
			LastWatched: time.Now(),
		}
		return s.db.Create(&progress).Error
	}
	
	return nil
}

// GetPlaybackProgress gets playback progress for a specific media item, creates if not found
func (s *PlaybackService) GetPlaybackProgress(userID string, mediaID uint) (*models.PlaybackProgress, error) {
	var progress models.PlaybackProgress
	err := s.db.Preload("Media").Where("user_id = ? AND media_id = ?", userID, mediaID).First(&progress).Error
	
	if err == gorm.ErrRecordNotFound {
		// Create a new progress record with 0 progress
		progress = models.PlaybackProgress{
			UserID:      userID,
			MediaID:     mediaID,
			Position:    0,
			Duration:    0,
			Progress:    0,
			Completed:   false,
			LastWatched: time.Now(),
		}
		
		// Save the new progress record
		if createErr := s.db.Create(&progress).Error; createErr != nil {
			return nil, createErr
		}
		
		// Reload with Media preloaded
		err = s.db.Preload("Media").Where("user_id = ? AND media_id = ?", userID, mediaID).First(&progress).Error
		if err != nil {
			return nil, err
		}
		
		return &progress, nil
	}
	
	return &progress, err
}

// GetUserPlaybackProgress gets all playback progress for a user
func (s *PlaybackService) GetUserPlaybackProgress(userID string) ([]models.PlaybackProgress, error) {
	var progress []models.PlaybackProgress
	err := s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ?", userID).
		Order("last_watched DESC").
		Find(&progress).Error
	return progress, err
}

// AddToRecentlyWatched adds or updates recently watched item
func (s *PlaybackService) AddToRecentlyWatched(userID string, mediaID uint) error {
	var recent models.RecentlyWatched
	result := s.db.Where("user_id = ? AND media_id = ?", userID, mediaID).First(&recent)

	if result.Error == gorm.ErrRecordNotFound {
		// Create new recently watched record
		recent = models.RecentlyWatched{
			UserID:    userID,
			MediaID:   mediaID,
			WatchedAt: time.Now(),
		}
		return s.db.Create(&recent).Error
	}

	// Update existing record
	recent.WatchedAt = time.Now()
	return s.db.Save(&recent).Error
}

// GetRecentlyWatched gets recently watched items for a user
func (s *PlaybackService) GetRecentlyWatched(userID string, limit int) ([]models.RecentlyWatched, error) {
	var recent []models.RecentlyWatched
	err := s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ?", userID).
		Order("watched_at DESC").
		Limit(limit).
		Find(&recent).Error
	return recent, err
}

// AddToWatchHistory records watch session
func (s *PlaybackService) AddToWatchHistory(userID string, mediaID uint, duration float64) error {
	history := models.WatchHistory{
		UserID:    userID,
		MediaID:   mediaID,
		WatchedAt: time.Now(),
		Duration:  duration,
	}
	return s.db.Create(&history).Error
}

// GetWatchHistory gets watch history for a user
func (s *PlaybackService) GetWatchHistory(userID string, limit int) ([]models.WatchHistory, error) {
	var history []models.WatchHistory
	err := s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ?", userID).
		Order("watched_at DESC").
		Limit(limit).
		Find(&history).Error
	return history, err
}

// AddToMyList adds media to user's personal list
func (s *PlaybackService) AddToMyList(userID string, mediaID uint) error {
	var myList models.MyList
	result := s.db.Where("user_id = ? AND media_id = ?", userID, mediaID).First(&myList)

	if result.Error == gorm.ErrRecordNotFound {
		myList = models.MyList{
			UserID:  userID,
			MediaID: mediaID,
			AddedAt: time.Now(),
		}
		return s.db.Create(&myList).Error
	}

	return fmt.Errorf("media already in list")
}

// RemoveFromMyList removes media from user's personal list
func (s *PlaybackService) RemoveFromMyList(userID string, mediaID uint) error {
	return s.db.Where("user_id = ? AND media_id = ?", userID, mediaID).Delete(&models.MyList{}).Error
}

// GetMyList gets user's personal watchlist
func (s *PlaybackService) GetMyList(userID string) ([]models.MyList, error) {
	var myList []models.MyList
	err := s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ?", userID).
		Order("added_at DESC").
		Find(&myList).Error
	return myList, err
}

// IsInMyList checks if media is in user's list
func (s *PlaybackService) IsInMyList(userID string, mediaID uint) (bool, error) {
	var count int64
	err := s.db.Model(&models.MyList{}).
		Where("user_id = ? AND media_id = ?", userID, mediaID).
		Count(&count).Error
	return count > 0, err
}

// GetContinueWatching gets items with progress but not completed
func (s *PlaybackService) GetContinueWatching(userID string, limit int) ([]models.PlaybackProgress, error) {
	var progress []models.PlaybackProgress
	err := s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ? AND completed = ? AND progress > ?", userID, false, 5).
		Order("last_watched DESC").
		Limit(limit).
		Find(&progress).Error
	return progress, err
}

// GetRecentlyWatchedWithProgress gets recently watched items with playback progress
func (s *PlaybackService) GetRecentlyWatchedWithProgress(userID string, limit int) ([]models.PlaybackProgress, error) {
	var progress []models.PlaybackProgress
	err := s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ? AND progress > ? AND progress < ?", userID, 5, 95).
		Order("last_watched DESC").
		Limit(limit).
		Find(&progress).Error
	return progress, err
}

// CleanupOldProgress removes old progress records (older than 1 year)
func (s *PlaybackService) CleanupOldProgress() error {
	oneYearAgo := time.Now().AddDate(-1, 0, 0)
	return s.db.Where("last_watched < ?", oneYearAgo).Delete(&models.PlaybackProgress{}).Error
}

// GetWatchStats gets watch statistics for a user
func (s *PlaybackService) GetWatchStats(userID string) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Total watch time
	var totalWatchTime float64
	s.db.Model(&models.WatchHistory{}).
		Where("user_id = ?", userID).
		Select("COALESCE(SUM(duration), 0)").
		Scan(&totalWatchTime)

	// Total items watched
	var totalItems int64
	s.db.Model(&models.RecentlyWatched{}).
		Where("user_id = ?", userID).
		Count(&totalItems)

	// Completed items
	var completedItems int64
	s.db.Model(&models.PlaybackProgress{}).
		Where("user_id = ? AND completed = ?", userID, true).
		Count(&completedItems)

	// Items in progress
	var inProgressItems int64
	s.db.Model(&models.PlaybackProgress{}).
		Where("user_id = ? AND completed = ? AND progress > ?", userID, false, 5).
		Count(&inProgressItems)

	// My list count
	var myListCount int64
	s.db.Model(&models.MyList{}).
		Where("user_id = ?", userID).
		Count(&myListCount)

	stats["total_watch_time"] = totalWatchTime
	stats["total_items"] = totalItems
	stats["completed_items"] = completedItems
	stats["in_progress_items"] = inProgressItems
	stats["my_list_count"] = myListCount

	return stats, nil
}
