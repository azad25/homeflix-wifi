package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
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
// Ultra-optimized with multi-layer caching for sub-2s loading
func (h *WidgetHandler) GetWidgetsWithDataByPage(c *gin.Context) {
	page := c.Param("page")
	if page == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "page parameter is required"})
		return
	}

	startTime := time.Now()

	// Check handler-level cache first (fastest)
	h.cacheMutex.RLock()
	if cached, exists := h.cache[page]; exists {
		if time.Since(cached.Timestamp) < cached.TTL {
			h.cacheMutex.RUnlock()
			fmt.Printf("⚡ Handler cache hit for page %s (%.2fms)\n", page, float64(time.Since(startTime).Microseconds())/1000)

			// Set aggressive cache headers for instant loading
			// max-age=600 (10 min) allows browser to cache longer
			// stale-while-revalidate=86400 (24h) allows serving stale data while revalidating
			c.Header("Cache-Control", "public, max-age=600, stale-while-revalidate=86400") // 10min browser cache, 24h stale
			c.Header("ETag", fmt.Sprintf("\"%s-%d\"", page, cached.Timestamp.Unix()))

			c.JSON(http.StatusOK, cached.Data)
			return
		}
	}
	h.cacheMutex.RUnlock()

	fmt.Printf("🔧 Fetching widgets for page: %s (cache miss)\n", page)

	widgetsWithData, err := h.service.GetWidgetsWithDataByPage(page)
	if err != nil {
		fmt.Printf("❌ Error getting widgets with data: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Format logo and backdrop paths before caching/returning
	for i := range widgetsWithData {
		for j := range widgetsWithData[i].Data {
			item := &widgetsWithData[i].Data[j]
			
			// Format logo path
			if item.LogoPath != "" && !strings.HasPrefix(item.LogoPath, "http") && !strings.HasPrefix(item.LogoPath, "/api/") {
				if strings.HasPrefix(item.LogoPath, "logos/") {
					item.LogoPath = "/api/" + item.LogoPath
				} else if !strings.Contains(item.LogoPath, "/") {
					item.LogoPath = "/api/logos/" + item.LogoPath
				}
			}
			
			// Format backdrop path
			if item.BackdropPath != "" && !strings.HasPrefix(item.BackdropPath, "http") && !strings.HasPrefix(item.BackdropPath, "/api/") {
				if strings.HasPrefix(item.BackdropPath, "backdrops/") {
					item.BackdropPath = "/api/" + item.BackdropPath
				} else if !strings.Contains(item.BackdropPath, "/") {
					item.BackdropPath = "/api/backdrops/" + item.BackdropPath
				}
			}
		}
	}

	// Cache the result in handler cache
	h.cacheMutex.Lock()
	h.cache[page] = &WidgetCache{
		Data:      widgetsWithData,
		Timestamp: time.Now(),
		TTL:       2 * time.Minute, // Reduced TTL for faster updates
	}
	h.cacheMutex.Unlock()

	totalTime := time.Since(startTime)
	fmt.Printf("✅ Served %d widgets for page %s in %.2fms\n", len(widgetsWithData), page, float64(totalTime.Milliseconds()))

	// Set aggressive cache headers for client-side caching
	// max-age=600 (10 min) for browser cache
	// stale-while-revalidate=86400 (24h) allows serving stale data while revalidating in background
	c.Header("Cache-Control", "public, max-age=600, stale-while-revalidate=86400")
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

// InvalidateWidgetCache invalidates cache when widgets are modified
func (h *WidgetHandler) InvalidateWidgetCache(widgetPage string) {
	// Clear handler cache
	h.ClearWidgetCache(widgetPage)

	// Clear service cache
	h.service.InvalidatePageCache(widgetPage)

	fmt.Printf("🔄 Invalidated all caches for page: %s\n", widgetPage)
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

	fmt.Printf("🔧 Creating widget with input: %+v\n", input)

	// Build widget from input
	widget := models.Widget{
		Name:    getString(input, "name"),
		Type:    getString(input, "type"),
		Page:    getString(input, "page"),
		Enabled: getBool(input, "enabled", true),
		Config:  getString(input, "config"),
		Layout:  getString(input, "layout", "full"),
	}

	fmt.Printf("🔧 Widget config string: %s\n", widget.Config)

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

	fmt.Printf("🔧 Final widget before creation: %+v\n", widget)

	if err := h.service.CreateWidget(&widget); err != nil {
		fmt.Printf("❌ Error creating widget: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Clear cache only for the specific page where widget was added
	h.InvalidateWidgetCache(widget.Page)

	fmt.Printf("✅ Widget created successfully: ID=%d, Name=%s, Page=%s\n", widget.ID, widget.Name, widget.Page)
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

	// Get the updated widget to determine which page to invalidate
	widget, err := h.service.GetWidgetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get updated widget"})
		return
	}

	// Clear cache only for the specific page where widget was updated
	h.InvalidateWidgetCache(widget.Page)

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

	// Get widget info before deletion to know which page to invalidate
	widget, err := h.service.GetWidgetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "widget not found"})
		return
	}

	if err := h.service.DeleteWidget(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Clear cache only for the specific page where widget was deleted
	h.InvalidateWidgetCache(widget.Page)

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

	// Get the page of the first widget to invalidate cache
	var affectedPage string
	if len(request.Widgets) > 0 {
		widget, err := h.service.GetWidgetByID(request.Widgets[0].ID)
		if err == nil {
			affectedPage = widget.Page
		}
	}

	if err := h.service.ReorderWidgetsWithPositions(request.Widgets); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Invalidate cache for the affected page
	if affectedPage != "" {
		h.InvalidateWidgetCache(affectedPage)
		fmt.Printf("🔄 Cache invalidated for page %s after reordering\n", affectedPage)
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

	// Get widget info before toggling to know which page to invalidate
	widget, err := h.service.GetWidgetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "widget not found"})
		return
	}

	if err := h.service.ToggleWidget(uint(id), request.Enabled); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Clear cache for the specific page where widget was toggled
	h.InvalidateWidgetCache(widget.Page)

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

	// Clear cache for the specific page where widget was duplicated
	h.InvalidateWidgetCache(widget.Page)

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
		"home_widgets":  len(homeWidgets),
		"movie_widgets": len(movieWidgets),
		"tv_widgets":    len(tvWidgets),
		"widgets":       allWidgets,
	})
}

// ClearCache manually clears widget cache for debugging
func (h *WidgetHandler) ClearCache(c *gin.Context) {
	page := c.Query("page") // Optional page parameter
	h.ClearWidgetCache(page)

	message := "All widget cache cleared"
	if page != "" {
		message = fmt.Sprintf("Widget cache cleared for page: %s", page)
	}

	c.JSON(http.StatusOK, gin.H{"message": message})
}
