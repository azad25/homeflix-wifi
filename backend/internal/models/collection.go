package models

import (
	"time"
	"gorm.io/gorm"
)

// Collection represents a user-created collection of media items
type Collection struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name" gorm:"not null"`
	Description string    `json:"description"`
	UserID      uint      `json:"user_id" gorm:"not null;index"`
	IsPublic    bool      `json:"is_public" gorm:"default:false"`
	CoverImage  string    `json:"cover_image"`
	Tags        string    `json:"tags"` // JSON array of tags
	ItemCount   int       `json:"item_count" gorm:"default:0"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	
	// Relationships
	Items []CollectionItem `json:"items,omitempty" gorm:"foreignKey:CollectionID;constraint:OnDelete:CASCADE"`
}

// CollectionItem represents a media item within a collection
type CollectionItem struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	CollectionID uint      `json:"collection_id" gorm:"not null;index"`
	MediaID      uint      `json:"media_id" gorm:"not null;index"`
	Position     int       `json:"position" gorm:"default:0"` // For ordering items
	Notes        string    `json:"notes"`
	AddedAt      time.Time `json:"added_at" gorm:"autoCreateTime"`
	
	// Relationships
	Collection Collection `json:"collection,omitempty" gorm:"foreignKey:CollectionID"`
	Media      Media      `json:"media,omitempty" gorm:"foreignKey:MediaID"`
}

// MyListItem represents items in user's personal "My List"
type MyListItem struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	UserID    uint      `json:"user_id" gorm:"not null;index"`
	MediaID   uint      `json:"media_id" gorm:"not null;index"`
	MediaType string    `json:"media_type"` // movie, tv, episode
	Notes     string    `json:"notes"`
	Priority  int       `json:"priority" gorm:"default:0"` // For user prioritization
	AddedAt   time.Time `json:"added_at" gorm:"autoCreateTime"`
	
	// Relationships
	Media Media `json:"media,omitempty" gorm:"foreignKey:MediaID"`
}

// CollectionStats represents statistics for a collection
type CollectionStats struct {
	TotalItems    int     `json:"total_items"`
	MovieCount    int     `json:"movie_count"`
	TVShowCount   int     `json:"tv_show_count"`
	EpisodeCount  int     `json:"episode_count"`
	TotalDuration int64   `json:"total_duration"` // in seconds
	AvgRating     float64 `json:"avg_rating"`
}

// MigrateCollectionTables migrates all collection-related tables
func MigrateCollectionTables(db *gorm.DB) error {
	return db.AutoMigrate(&Collection{}, &CollectionItem{}, &MyListItem{})
}

// BeforeCreate hook for Collection
func (c *Collection) BeforeCreate(tx *gorm.DB) error {
	// Set default user ID if not provided
	if c.UserID == 0 {
		c.UserID = 1 // Default user
	}
	return nil
}

// BeforeCreate hook for MyListItem
func (m *MyListItem) BeforeCreate(tx *gorm.DB) error {
	// Set default user ID if not provided
	if m.UserID == 0 {
		m.UserID = 1 // Default user
	}
	return nil
}

// AfterCreate hook for CollectionItem to update collection item count
func (ci *CollectionItem) AfterCreate(tx *gorm.DB) error {
	return tx.Model(&Collection{}).Where("id = ?", ci.CollectionID).
		Update("item_count", gorm.Expr("item_count + 1")).Error
}

// AfterDelete hook for CollectionItem to update collection item count
func (ci *CollectionItem) AfterDelete(tx *gorm.DB) error {
	return tx.Model(&Collection{}).Where("id = ?", ci.CollectionID).
		Update("item_count", gorm.Expr("GREATEST(item_count - 1, 0)")).Error
}