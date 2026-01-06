package handlers

import (
	"net/http"
	"strconv"

	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// WidgetDataHandlers contains handlers for widget data endpoints
type WidgetDataHandlers struct {
	db          *gorm.DB
	tmdbService *services.TMDBService
}

// NewWidgetDataHandlers creates a new widget data handlers instance
func NewWidgetDataHandlers(db *gorm.DB, tmdbService *services.TMDBService) *WidgetDataHandlers {
	return &WidgetDataHandlers{
		db:          db,
		tmdbService: tmdbService,
	}
}

// GetWidgetData retrieves data for a specific widget
func (h *WidgetDataHandlers) GetWidgetData(c *gin.Context) {
	widgetID := c.Param("id")
	if widgetID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Widget ID is required",
		})
		return
	}

	// Parse widget ID
	id, err := strconv.Atoi(widgetID)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid widget ID",
		})
		return
	}

	// Fetch widget data from database
	var widgetData interface{}
	err = h.db.Raw("SELECT * FROM widgets WHERE id = ?", id).Scan(&widgetData).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch widget data",
		})
		return
	}

	// Return widget data
	c.JSON(http.StatusOK, gin.H{
		"data": widgetData,
	})
}