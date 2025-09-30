package models

import (
	"time"
	"gorm.io/gorm"
)

// PlaybackProgress represents user's playback progress for a media item
type PlaybackProgress struct {
	ID          uint           `json:"id" gorm:"primaryKey"`
	UserID      string         `json:"user_id" gorm:"index;not null"`
	MediaID     uint           `json:"media_id" gorm:"index;not null"`
	Media       Media          `json:"media" gorm:"foreignKey:MediaID"`
	Position    float64        `json:"position"`    // Current playback position in seconds
	Duration    float64        `json:"duration"`    // Total duration in seconds
	Progress    float64        `json:"progress"`    // Progress percentage (0-100)
	Completed   bool           `json:"completed"`   // Whether the media was fully watched
	LastWatched time.Time      `json:"last_watched" gorm:"index"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// WatchHistory represents the watch history for analytics
type WatchHistory struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	UserID    string         `json:"user_id" gorm:"index;not null"`
	MediaID   uint           `json:"media_id" gorm:"index;not null"`
	Media     Media          `json:"media" gorm:"foreignKey:MediaID"`
	WatchedAt time.Time      `json:"watched_at" gorm:"index"`
	Duration  float64        `json:"duration"` // How long they watched in this session
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// RecentlyWatched represents recently watched items for quick access
type RecentlyWatched struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	UserID    string         `json:"user_id" gorm:"index;not null"`
	MediaID   uint           `json:"media_id" gorm:"index;not null"`
	Media     Media          `json:"media" gorm:"foreignKey:MediaID"`
	WatchedAt time.Time      `json:"watched_at" gorm:"index"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

// MyList represents user's personal watchlist
type MyList struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	UserID    string         `json:"user_id" gorm:"index;not null"`
	MediaID   uint           `json:"media_id" gorm:"index;not null"`
	Media     Media          `json:"media" gorm:"foreignKey:MediaID"`
	AddedAt   time.Time      `json:"added_at" gorm:"index"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}
