package models

import (
	"time"

	"gorm.io/gorm"
)

// Page represents a dynamic page that can host widgets and appear in navigation.
type Page struct {
	ID           uint           `json:"id" gorm:"primarykey"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	Slug         string         `json:"slug" gorm:"uniqueIndex;not null"`
	Title        string         `json:"title" gorm:"not null"`
	Description  string         `json:"description" gorm:"type:text"`
	IsDefault    bool           `json:"is_default" gorm:"default:false"`
	IsHomePage   bool           `json:"is_home_page" gorm:"default:false"`
	IsNavVisible bool           `json:"is_nav_visible" gorm:"default:true"`
	NavOrder     int            `json:"nav_order" gorm:"default:0"`
	LayoutConfig string         `json:"layout_config" gorm:"type:text"`
	WidgetLayout string         `json:"widget_layout" gorm:"type:text"`
	Widgets      []Widget       `json:"widgets" gorm:"foreignKey:Page;references:Slug"`
}

// PageWidgetPosition stores custom widget ordering for a page blueprint.
type PageWidgetPosition struct {
	ID        uint      `json:"id" gorm:"primarykey"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	PageSlug  string    `json:"page_slug" gorm:"index;not null"`
	WidgetID  uint      `json:"widget_id" gorm:"index;not null"`
	Position  int       `json:"position" gorm:"default:0"`
}

// MigratePageTables ensures page-related tables are created.
func MigratePageTables(db *gorm.DB) error {
	return db.AutoMigrate(&Page{}, &PageWidgetPosition{})
}
