package api

import (
	"gorm.io/gorm"
)

// Handler contains all the handler functions and their dependencies
type Handler struct {
	db *gorm.DB
}

// NewHandler creates a new Handler instance
func NewHandler(db *gorm.DB) *Handler {
	return &Handler{
		db: db,
	}
}
