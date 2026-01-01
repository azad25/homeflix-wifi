package music

import (
	"time"
)

// Track represents a music track from YouTube
type Track struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	YouTubeID   string    `json:"youtube_id" gorm:"uniqueIndex;not null"`
	Title       string    `json:"title" gorm:"not null"`
	Artist      string    `json:"artist"`
	Duration    int       `json:"duration"` // in seconds
	ThumbnailURL string   `json:"thumbnail_url"`
	ViewCount   int64     `json:"view_count"`
	LikeCount   int64     `json:"like_count"`
	Description string    `json:"description"`
	PublishedAt time.Time `json:"published_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Playlist represents a user playlist
type Playlist struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name" gorm:"not null"`
	Description string    `json:"description"`
	CoverURL    string    `json:"cover_url"`
	IsPublic    bool      `json:"is_public" gorm:"default:true"`
	UserID      string    `json:"user_id"` // For future user system
	Tracks      []Track   `json:"tracks" gorm:"many2many:playlist_tracks;"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// PlaylistTrack represents the many-to-many relationship
type PlaylistTrack struct {
	PlaylistID uint      `json:"playlist_id"`
	TrackID    uint      `json:"track_id"`
	Position   int       `json:"position"`
	AddedAt    time.Time `json:"added_at"`
}

// UserLike represents user likes for tracks
type UserLike struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"user_id"`
	TrackID   uint      `json:"track_id"`
	CreatedAt time.Time `json:"created_at"`
}

// RecentlyPlayed tracks user's listening history
type RecentlyPlayed struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"user_id"`
	TrackID   uint      `json:"track_id"`
	Track     Track     `json:"track"`
	PlayedAt  time.Time `json:"played_at"`
}

// SearchHistory stores user search queries
type SearchHistory struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"user_id"`
	Query     string    `json:"query"`
	CreatedAt time.Time `json:"created_at"`
}