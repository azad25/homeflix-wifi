package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"homeflix-backend/internal/models"
	"homeflix-backend/internal/services"

	"github.com/gin-gonic/gin"
)

// WidgetCache holds cached widget data with TTL
type WidgetCache struct {
	Data      []models.WidgetWithData
	Timestamp time.Time
	TTL       time.Duration
}

// WidgetHandler handles widget-related HTTP requests
type WidgetHandler struct {
	service      *services.WidgetService
	mediaService *services.MediaService
	tmdbService  *services.TMDBService
	cache        map[string]*WidgetCache
	cacheMutex   sync.RWMutex
}

// NewWidgetHandler creates a new widget handler
func NewWidgetHandler(service *services.WidgetService, mediaService *services.MediaService, tmdbService *services.TMDBService) *WidgetHandler {
	return &WidgetHandler{
		service:      service,
		mediaService: mediaService,
		tmdbService:  tmdbService,
		cache:        make(map[string]*WidgetCache),
		cacheMutex:   sync.RWMutex{},
	}
}

// GetAllWidgets returns all widgets
func (h *WidgetHandler) GetAllWidgets(c *gin.Context) {
	widgets, err := h.service.GetAllWidgets()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, widgets)
}

// GetWidgetsByPage returns widgets for a specific page
func (h *WidgetHandler) GetWidgetsByPage(c *gin.Context) {
	page := c.Param("page")
	if page == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "page parameter is required"})
		return
	}

	widgets, err := h.service.GetWidgetsByPage(page)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, widgets)
}

// GetWidgetsWithDataByPage returns widgets with their populated data for a specific page
// Optimized with caching for fast loading
func (h *WidgetHandler) GetWidgetsWithDataByPage(c *gin.Context) {
	page := c.Param("page")
	if page == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "page parameter is required"})
		return
	}

	// Check cache first
	h.cacheMutex.RLock()
	if cached, exists := h.cache[page]; exists {
		if time.Since(cached.Timestamp) < cached.TTL {
			h.cacheMutex.RUnlock()
			fmt.Printf("✅ Serving cached widgets for page %s (%d widgets)\n", page, len(cached.Data))
			
			// Set cache headers for client-side caching
			c.Header("Cache-Control", "public, max-age=300") // 5 minutes
			c.Header("ETag", fmt.Sprintf("\"%s-%d\"", page, cached.Timestamp.Unix()))
			
			c.JSON(http.StatusOK, cached.Data)
			return
		}
	}
	h.cacheMutex.RUnlock()

	fmt.Printf("🔧 Getting widgets with data for page: %s (cache miss or expired)\n", page)

	widgetsWithData, err := h.service.GetWidgetsWithDataByPage(page)
	if err != nil {
		fmt.Printf("❌ Error getting widgets with data: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Cache the result
	h.cacheMutex.Lock()
	h.cache[page] = &WidgetCache{
		Data:      widgetsWithData,
		Timestamp: time.Now(),
		TTL:       5 * time.Minute, // Cache for 5 minutes
	}
	h.cacheMutex.Unlock()

	fmt.Printf("✅ Found %d widgets for page %s (cached for 5 minutes)\n", len(widgetsWithData), page)
	for _, widget := range widgetsWithData {
		fmt.Printf("  - Widget: %s (type: %s, data_count: %d)\n", 
			widget.Name, widget.Type, len(widget.Data))
	}

	// Set cache headers for client-side caching
	c.Header("Cache-Control", "public, max-age=300") // 5 minutes
	c.Header("ETag", fmt.Sprintf("\"%s-%d\"", page, time.Now().Unix()))

	c.JSON(http.StatusOK, widgetsWithData)
}

// ClearWidgetCache clears the widget cache for a specific page or all pages
func (h *WidgetHandler) ClearWidgetCache(page string) {
	h.cacheMutex.Lock()
	defer h.cacheMutex.Unlock()
	
	if page == "" {
		// Clear all cache
		h.cache = make(map[string]*WidgetCache)
		fmt.Printf("🗑️ Cleared all widget cache\n")
	} else {
		// Clear specific page cache
		delete(h.cache, page)
		fmt.Printf("🗑️ Cleared widget cache for page: %s\n", page)
	}
}

// GetWidgetByID returns a single widget by ID
func (h *WidgetHandler) GetWidgetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid widget ID"})
		return
	}

	widget, err := h.service.GetWidgetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "widget not found"})
		return
	}
	c.JSON(http.StatusOK, widget)
}

// CreateWidget creates a new widget
func (h *WidgetHandler) CreateWidget(c *gin.Context) {
	var input map[string]interface{}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Build widget from input
	widget := models.Widget{
		Name:    getString(input, "name"),
		Type:    getString(input, "type"),
		Page:    getString(input, "page"),
		Enabled: getBool(input, "enabled", true),
		Config:  getString(input, "config"),
		Layout:  getString(input, "layout", "full"),
	}

	// Handle camelCase fields
	if v, ok := input["contentType"]; ok {
		widget.ContentType = v.(string)
	} else if v, ok := input["content_type"]; ok {
		widget.ContentType = v.(string)
	} else {
		widget.ContentType = "mixed"
	}

	if v, ok := input["dataSource"]; ok {
		widget.DataSource = v.(string)
	} else if v, ok := input["data_source"]; ok {
		widget.DataSource = v.(string)
	} else {
		widget.DataSource = "local"
	}

	if v, ok := input["maxItems"]; ok {
		widget.MaxItems = int(v.(float64))
	} else if v, ok := input["max_items"]; ok {
		widget.MaxItems = int(v.(float64))
	} else {
		widget.MaxItems = 10
	}

	if v, ok := input["colorScheme"]; ok {
		widget.ColorScheme = v.(string)
	} else if v, ok := input["color_scheme"]; ok {
		widget.ColorScheme = v.(string)
	} else {
		widget.ColorScheme = "auto"
	}

	if v, ok := input["position"]; ok {
		widget.Position = int(v.(float64))
	}

	if err := h.service.CreateWidget(&widget); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Clear cache after widget creation
	h.ClearWidgetCache("")

	c.JSON(http.StatusCreated, widget)
}

// Helper functions for type conversion
func getString(m map[string]interface{}, key string, defaultVal ...string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	if len(defaultVal) > 0 {
		return defaultVal[0]
	}
	return ""
}

func getBool(m map[string]interface{}, key string, defaultVal ...bool) bool {
	if v, ok := m[key]; ok {
		if b, ok := v.(bool); ok {
			return b
		}
	}
	if len(defaultVal) > 0 {
		return defaultVal[0]
	}
	return false
}

// UpdateWidget updates an existing widget
func (h *WidgetHandler) UpdateWidget(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid widget ID"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Convert camelCase to snake_case for database fields
	convertedUpdates := make(map[string]interface{})
	fieldMapping := map[string]string{
		"contentType": "content_type",
		"dataSource":  "data_source",
		"maxItems":    "max_items",
		"colorScheme": "color_scheme",
	}

	for key, value := range updates {
		if snakeKey, exists := fieldMapping[key]; exists {
			convertedUpdates[snakeKey] = value
		} else {
			convertedUpdates[key] = value
		}
	}

	if err := h.service.UpdateWidget(uint(id), convertedUpdates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Clear cache after widget update
	h.ClearWidgetCache("")

	// Return the updated widget
	widget, _ := h.service.GetWidgetByID(uint(id))
	c.JSON(http.StatusOK, widget)
}

// DeleteWidget deletes a widget
func (h *WidgetHandler) DeleteWidget(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid widget ID"})
		return
	}

	if err := h.service.DeleteWidget(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Clear cache after widget deletion
	h.ClearWidgetCache("")

	c.JSON(http.StatusOK, gin.H{"message": "widget deleted successfully"})
}

// ReorderWidgets updates widget positions
func (h *WidgetHandler) ReorderWidgets(c *gin.Context) {
	var request struct {
		Widgets []struct {
			ID       uint `json:"id"`
			Position int  `json:"position"`
		} `json:"widgets" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.ReorderWidgetsWithPositions(request.Widgets); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "widgets reordered successfully"})
}

// ToggleWidget enables or disables a widget
func (h *WidgetHandler) ToggleWidget(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid widget ID"})
		return
	}

	var request struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.ToggleWidget(uint(id), request.Enabled); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "widget toggled successfully", "enabled": request.Enabled})
}

// DuplicateWidget creates a copy of a widget
func (h *WidgetHandler) DuplicateWidget(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid widget ID"})
		return
	}

	widget, err := h.service.DuplicateWidget(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, widget)
}

// GetWidgetTypes returns available widget types
func (h *WidgetHandler) GetWidgetTypes(c *gin.Context) {
	c.JSON(http.StatusOK, h.service.GetWidgetTypes())
}

// GetWidgetPages returns available pages for widgets
func (h *WidgetHandler) GetWidgetPages(c *gin.Context) {
	c.JSON(http.StatusOK, h.service.GetWidgetPages())
}

// GetWidgetLayouts returns available layouts
func (h *WidgetHandler) GetWidgetLayouts(c *gin.Context) {
	c.JSON(http.StatusOK, h.service.GetWidgetLayouts())
}

// GetWidgetDataSources returns available data sources
func (h *WidgetHandler) GetWidgetDataSources(c *gin.Context) {
	c.JSON(http.StatusOK, h.service.GetWidgetDataSources())
}

// GetWidgetContentTypes returns available content types
func (h *WidgetHandler) GetWidgetContentTypes(c *gin.Context) {
	c.JSON(http.StatusOK, h.service.GetWidgetContentTypes())
}

// GetTMDBGenres returns TMDB genres for movies and TV shows
func (h *WidgetHandler) GetTMDBGenres(c *gin.Context) {
	mediaType := c.Query("type") // "movie" or "tv"
	if mediaType == "" {
		mediaType = "movie"
	}

	// Mock TMDB genres for now - in a real implementation, you'd call TMDB API
	var genres []map[string]interface{}
	
	if mediaType == "movie" {
		genres = []map[string]interface{}{
			{"id": 28, "name": "Action"},
			{"id": 12, "name": "Adventure"},
			{"id": 16, "name": "Animation"},
			{"id": 35, "name": "Comedy"},
			{"id": 80, "name": "Crime"},
			{"id": 99, "name": "Documentary"},
			{"id": 18, "name": "Drama"},
			{"id": 10751, "name": "Family"},
			{"id": 14, "name": "Fantasy"},
			{"id": 36, "name": "History"},
			{"id": 27, "name": "Horror"},
			{"id": 10402, "name": "Music"},
			{"id": 9648, "name": "Mystery"},
			{"id": 10749, "name": "Romance"},
			{"id": 878, "name": "Science Fiction"},
			{"id": 10770, "name": "TV Movie"},
			{"id": 53, "name": "Thriller"},
			{"id": 10752, "name": "War"},
			{"id": 37, "name": "Western"},
		}
	} else {
		genres = []map[string]interface{}{
			{"id": 10759, "name": "Action & Adventure"},
			{"id": 16, "name": "Animation"},
			{"id": 35, "name": "Comedy"},
			{"id": 80, "name": "Crime"},
			{"id": 99, "name": "Documentary"},
			{"id": 18, "name": "Drama"},
			{"id": 10751, "name": "Family"},
			{"id": 10762, "name": "Kids"},
			{"id": 9648, "name": "Mystery"},
			{"id": 10763, "name": "News"},
			{"id": 10764, "name": "Reality"},
			{"id": 10765, "name": "Sci-Fi & Fantasy"},
			{"id": 10766, "name": "Soap"},
			{"id": 10767, "name": "Talk"},
			{"id": 10768, "name": "War & Politics"},
			{"id": 37, "name": "Western"},
		}
	}

	c.JSON(http.StatusOK, gin.H{"genres": genres})
}

// GetWidgetMeta returns widget types, pages, and layouts
func (h *WidgetHandler) GetWidgetMeta(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"types":         h.service.GetWidgetTypes(),
		"pages":         h.service.GetWidgetPages(),
		"layouts":       h.service.GetWidgetLayouts(),
		"data_sources":  h.service.GetWidgetDataSources(),
		"content_types": h.service.GetWidgetContentTypes(),
	})
}

// GetWidgetStatus returns widget system status for debugging
func (h *WidgetHandler) GetWidgetStatus(c *gin.Context) {
	// Get total widget count
	allWidgets, err := h.service.GetAllWidgets()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get widgets by page
	homeWidgets, _ := h.service.GetWidgetsByPage("home")
	movieWidgets, _ := h.service.GetWidgetsByPage("movies")
	tvWidgets, _ := h.service.GetWidgetsByPage("tv-shows")

	c.JSON(http.StatusOK, gin.H{
		"total_widgets": len(allWidgets),
		"home_widgets": len(homeWidgets),
		"movie_widgets": len(movieWidgets),
		"tv_widgets": len(tvWidgets),
		"widgets": allWidgets,
	})
}
