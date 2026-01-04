package services

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"homeflix-backend/internal/models"

	"gorm.io/gorm"
)

// WidgetService handles widget-related operations
type WidgetService struct {
	db                  *gorm.DB
	mediaService        *MediaService
	tmdbService         *TMDBService
	notificationService *NotificationService
	playbackService     *PlaybackService
	trailerCache        sync.Map
	widgetsCache        sync.Map
	widgetsCacheLocks   sync.Map
}

const trailerCacheTTL = 30 * time.Minute
const widgetsCacheTTL = 30 * time.Second

type trailerCacheEntry struct {
	url       string
	fetchedAt time.Time
}

type widgetsCacheEntry struct {
	data      []models.WidgetWithData
	fetchedAt time.Time
}

// NewWidgetService creates a new widget service instance
func NewWidgetService(db *gorm.DB, mediaService *MediaService, tmdbService *TMDBService, notificationService *NotificationService, playbackService *PlaybackService) *WidgetService {
	return &WidgetService{
		db:                  db,
		mediaService:        mediaService,
		tmdbService:         tmdbService,
		notificationService: notificationService,
		playbackService:     playbackService,
	}
}

func (s *WidgetService) getWidgetsCacheLock(page string) *sync.Mutex {
	lock, _ := s.widgetsCacheLocks.LoadOrStore(page, &sync.Mutex{})
	return lock.(*sync.Mutex)
}

func (s *WidgetService) getCachedWidgets(page string) ([]models.WidgetWithData, bool) {
	if cached, ok := s.widgetsCache.Load(page); ok {
		entry := cached.(widgetsCacheEntry)
		if time.Since(entry.fetchedAt) < widgetsCacheTTL {
			return cloneWidgetsWithData(entry.data), true
		}
		s.widgetsCache.Delete(page)
	}
	return nil, false
}

// GetAllWidgets returns all widgets
func (s *WidgetService) GetAllWidgets() ([]models.Widget, error) {
	var widgets []models.Widget
	err := s.db.Order("page, position").Find(&widgets).Error
	return widgets, err
}

// GetWidgetsByPage returns widgets for a specific page, ordered by position
func (s *WidgetService) GetWidgetsByPage(page string) ([]models.Widget, error) {
	var widgets []models.Widget
	err := s.db.Where("page = ? AND enabled = ?", page, true).
		Order("position").
		Find(&widgets).Error
	return widgets, err
}

// GetWidgetsWithDataByPage returns widgets with their populated data for a specific page
// Optimized for fast loading with concurrent data fetching and caching
func (s *WidgetService) GetWidgetsWithDataByPage(page string) ([]models.WidgetWithData, error) {
	if cached, ok := s.getCachedWidgets(page); ok {
		fmt.Printf("⚡ Serving %d widgets for page %s from cache\n", len(cached), page)
		return cached, nil
	}

	lock := s.getWidgetsCacheLock(page)
	lock.Lock()
	defer lock.Unlock()

	if cached, ok := s.getCachedWidgets(page); ok {
		fmt.Printf("⚡ Serving %d widgets for page %s from cache after refresh check\n", len(cached), page)
		return cached, nil
	}

	widgets, err := s.GetWidgetsByPage(page)
	if err != nil {
		return nil, err
	}

	if len(widgets) == 0 {
		return []models.WidgetWithData{}, nil
	}

	// Pre-fetch all required data in parallel to avoid sequential loading
	dataCache := s.prefetchWidgetData(widgets)

	// Process widgets concurrently for faster loading
	widgetsWithData := make([]models.WidgetWithData, len(widgets))

	// Use a channel to collect results while maintaining order
	type widgetResult struct {
		index int
		data  models.WidgetWithData
	}

	resultChan := make(chan widgetResult, len(widgets))

	// Process widgets concurrently
	for i, widget := range widgets {
		go func(index int, w models.Widget) {
			widgetData := s.getWidgetDataFromCache(w, dataCache)

			resultChan <- widgetResult{
				index: index,
				data: models.WidgetWithData{
					Widget: w,
					Data:   widgetData,
				},
			}
		}(i, widget)
	}

	// Collect results
	for i := 0; i < len(widgets); i++ {
		result := <-resultChan
		widgetsWithData[result.index] = result.data
	}

	fmt.Printf("✅ Loaded %d widgets for page %s with optimized concurrent processing\n", len(widgetsWithData), page)
	cloneForCache := cloneWidgetsWithData(widgetsWithData)
	s.widgetsCache.Store(page, widgetsCacheEntry{data: cloneForCache, fetchedAt: time.Now()})
	fmt.Printf("💾 Cached %d widgets for page %s\n", len(cloneForCache), page)
	return widgetsWithData, nil
}

// GetWidgetByID returns a widget by ID
func (s *WidgetService) GetWidgetByID(id uint) (*models.Widget, error) {
	var widget models.Widget
	err := s.db.First(&widget, id).Error
	if err != nil {
		return nil, err
	}
	return &widget, nil
}

// CreateWidget creates a new widget
func (s *WidgetService) CreateWidget(widget *models.Widget) error {
	// Get the highest position for this page and add 1
	var maxPosition int
	s.db.Model(&models.Widget{}).
		Where("page = ?", widget.Page).
		Select("COALESCE(MAX(position), 0)").
		Scan(&maxPosition)
	widget.Position = maxPosition + 1

	return s.db.Create(widget).Error
}

// UpdateWidget updates an existing widget
func (s *WidgetService) UpdateWidget(id uint, updates map[string]interface{}) error {
	return s.db.Model(&models.Widget{}).Where("id = ?", id).Updates(updates).Error
}

// DeleteWidget soft deletes a widget
func (s *WidgetService) DeleteWidget(id uint) error {
	return s.db.Delete(&models.Widget{}, id).Error
}

// ReorderWidgets updates the position of multiple widgets
func (s *WidgetService) ReorderWidgets(page string, widgetIDs []uint) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		for i, id := range widgetIDs {
			if err := tx.Model(&models.Widget{}).
				Where("id = ? AND page = ?", id, page).
				Update("position", i+1).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// ReorderWidgetsWithPositions updates widgets with specific positions
func (s *WidgetService) ReorderWidgetsWithPositions(widgets []struct {
	ID       uint `json:"id"`
	Position int  `json:"position"`
}) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		for _, widget := range widgets {
			if err := tx.Model(&models.Widget{}).
				Where("id = ?", widget.ID).
				Update("position", widget.Position).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// ToggleWidget enables or disables a widget
func (s *WidgetService) ToggleWidget(id uint, enabled bool) error {
	return s.db.Model(&models.Widget{}).Where("id = ?", id).Update("enabled", enabled).Error
}

// GetWidgetConfig parses the JSON config string into a WidgetConfig struct
func (s *WidgetService) GetWidgetConfig(widget *models.Widget) (*models.WidgetConfig, error) {
	var config models.WidgetConfig
	if widget.Config == "" {
		fmt.Printf("🔧 Widget %s has empty config, using defaults\n", widget.Name)
		return &config, nil
	}

	fmt.Printf("🔧 Parsing config for widget %s: %s\n", widget.Name, widget.Config)

	// First unmarshal to get the raw config
	var rawConfig map[string]interface{}
	if err := json.Unmarshal([]byte(widget.Config), &rawConfig); err != nil {
		fmt.Printf("❌ Error parsing raw config for widget %s: %v\n", widget.Name, err)
		return &config, err
	}

	fmt.Printf("🔧 Raw config for widget %s: %+v\n", widget.Name, rawConfig)

	// Now unmarshal to the proper struct
	if err := json.Unmarshal([]byte(widget.Config), &config); err != nil {
		fmt.Printf("❌ Error parsing structured config for widget %s: %v\n", widget.Name, err)
		return &config, err
	}

	fmt.Printf("🔧 Structured config for widget %s: GenreFilter=%v, SelectedGenres=%v\n",
		widget.Name, config.GenreFilter, rawConfig["selectedGenres"])

	// Handle conversion from selectedGenres (IDs) to genreFilter (names) if needed
	if len(config.GenreFilter) == 0 {
		if selectedGenres, ok := rawConfig["selectedGenres"].([]interface{}); ok && len(selectedGenres) > 0 {
			fmt.Printf("🔧 Converting selectedGenres to genreFilter for widget %s\n", widget.Name)

			// Convert interface{} slice to int slice
			var genreIDs []int
			for _, id := range selectedGenres {
				if idFloat, ok := id.(float64); ok {
					genreIDs = append(genreIDs, int(idFloat))
				}
			}

			fmt.Printf("🔧 Extracted genre IDs: %v\n", genreIDs)

			// Convert genre IDs to names using TMDB service
			if len(genreIDs) > 0 && s.tmdbService != nil {
				genreNames := s.convertGenreIDsToNames(genreIDs)
				config.GenreFilter = genreNames
				fmt.Printf("🔧 Converted genre IDs %v to names %v\n", genreIDs, genreNames)
			}
		}
	}

	fmt.Printf("🔧 Final config for widget %s: GenreFilter=%v\n", widget.Name, config.GenreFilter)

	return &config, nil
}

// convertGenreIDsToNames converts TMDB genre IDs to genre names
func (s *WidgetService) convertGenreIDsToNames(genreIDs []int) []string {
	// TMDB genre mapping - this should ideally come from TMDB API but we'll use a static map for now
	genreMap := map[int]string{
		28:    "Action",
		12:    "Adventure",
		16:    "Animation",
		35:    "Comedy",
		80:    "Crime",
		99:    "Documentary",
		18:    "Drama",
		10751: "Family",
		14:    "Fantasy",
		36:    "History",
		27:    "Horror",
		10402: "Music",
		9648:  "Mystery",
		10749: "Romance",
		878:   "Science Fiction",
		10770: "TV Movie",
		53:    "Thriller",
		10752: "War",
		37:    "Western",
		// TV genres
		10759: "Action & Adventure",
		10762: "Kids",
		10763: "News",
		10764: "Reality",
		10765: "Sci-Fi & Fantasy",
		10766: "Soap",
		10767: "Talk",
		10768: "War & Politics",
	}

	var genreNames []string
	for _, id := range genreIDs {
		if name, exists := genreMap[id]; exists {
			genreNames = append(genreNames, name)
		}
	}

	return genreNames
}

// SetWidgetConfig serializes a WidgetConfig to JSON and stores it
func (s *WidgetService) SetWidgetConfig(widget *models.Widget, config *models.WidgetConfig) error {
	configJSON, err := json.Marshal(config)
	if err != nil {
		return err
	}
	widget.Config = string(configJSON)
	return nil
}

// GetWidgetTypes returns available widget types
func (s *WidgetService) GetWidgetTypes() []map[string]string {
	return []map[string]string{
		{"type": models.WidgetTypeFeaturedBanner, "name": "Featured Banner", "description": "Full-width hero banner with movie backdrop and logo"},
		{"type": models.WidgetTypeHalfBanner, "name": "Half Banner", "description": "Half-width banner for side-by-side layouts"},
		{"type": models.WidgetTypeBackdropSlideshow, "name": "Backdrop Slideshow", "description": "Auto-rotating backdrop slideshow"},
		{"type": models.WidgetTypeTrendingSlideshow, "name": "Trending Slideshow", "description": "Trending content carousel"},
		{"type": models.WidgetTypeMovieGrid, "name": "Movie Grid", "description": "Grid of movie posters"},
		{"type": models.WidgetTypeHomeflixGrid, "name": "Homeflix Grid", "description": "Netflix-style grid with backdrop and logo"},
		{"type": models.WidgetTypeGenreBased, "name": "Genre Based", "description": "Genre-specific movie collection"},
		{"type": models.WidgetTypeComingSoon, "name": "Coming Soon", "description": "Upcoming movies with release dates"},
		{"type": models.WidgetTypeNewReleases, "name": "New Releases", "description": "Recently released movies"},
		{"type": models.WidgetTypePopular, "name": "Popular", "description": "Most popular content"},
		{"type": models.WidgetTypeRecentlyAdded, "name": "Recently Added", "description": "Recently added to library"},
		{"type": models.WidgetTypeTrailer, "name": "Trailer Widget", "description": "YouTube trailers and video content"},
		{"type": "recently-watched", "name": "Recently Watched", "description": "User's viewing history"},
		{"type": "continue-watching", "name": "Continue Watching", "description": "Resume watching progress"},
		{"type": models.WidgetTypeNotifications, "name": "Notifications", "description": "Featured content from notifications with TMDB theming"},
	}
}

// GetWidgetPages returns available pages for widgets
func (s *WidgetService) GetWidgetPages() []map[string]string {
	return []map[string]string{
		{"page": models.WidgetPageHome, "name": "Home"},
		{"page": models.WidgetPageMovies, "name": "Movies"},
		{"page": models.WidgetPageTVShows, "name": "TV Shows"},
		{"page": models.WidgetPageBrowse, "name": "Browse"},
		{"page": models.WidgetPageNewPopular, "name": "New & Popular"},
		{"page": models.WidgetPageMyList, "name": "My List"},
	}
}

// GetWidgetLayouts returns available layouts
func (s *WidgetService) GetWidgetLayouts() []map[string]string {
	return []map[string]string{
		{"layout": models.WidgetLayoutFull, "name": "Full Width", "description": "100% viewport width"},
		{"layout": models.WidgetLayoutHalf, "name": "Half Width", "description": "50% viewport width"},
		{"layout": models.WidgetLayoutThird, "name": "Third Width", "description": "33% viewport width"},
	}
}

// GetWidgetDataSources returns available data sources
func (s *WidgetService) GetWidgetDataSources() []map[string]string {
	return []map[string]string{
		{"source": models.WidgetDataSourceLocal, "name": "Local Media", "description": "Use local media library"},
		{"source": models.WidgetDataSourceTMDB, "name": "TMDB API", "description": "The Movie Database API"},
		{"source": models.WidgetDataSourceTrending, "name": "Trending", "description": "Trending content"},
		{"source": models.WidgetDataSourcePopular, "name": "Popular", "description": "Popular content"},
		{"source": models.WidgetDataSourceRecent, "name": "Recent", "description": "Recently added content"},
		{"source": models.WidgetDataSourceRecentlyPlayed, "name": "Recently Played", "description": "Continue watching / recently played content"},
		{"source": models.WidgetDataSourceNowPlaying, "name": "Now Playing", "description": "Currently in theaters"},
		{"source": models.WidgetDataSourceUpcoming, "name": "Upcoming", "description": "Coming soon releases"},
		{"source": models.WidgetDataSourceTopRated, "name": "Top Rated", "description": "Highest rated content"},
	}
}

// GetWidgetContentTypes returns available content types
func (s *WidgetService) GetWidgetContentTypes() []map[string]string {
	return []map[string]string{
		{"type": models.WidgetContentTypeMixed, "name": "Mixed Content", "description": "Movies and TV shows"},
		{"type": models.WidgetContentTypeMovies, "name": "Movies Only", "description": "Movies only"},
		{"type": models.WidgetContentTypeTVShows, "name": "TV Shows Only", "description": "TV shows only"},
		{"type": models.WidgetContentTypeTMDB, "name": "TMDB Content", "description": "TMDB API content"},
	}
}

// DuplicateWidget creates a copy of an existing widget
func (s *WidgetService) DuplicateWidget(id uint) (*models.Widget, error) {
	original, err := s.GetWidgetByID(id)
	if err != nil {
		return nil, err
	}

	duplicate := &models.Widget{
		Name:        fmt.Sprintf("%s (Copy)", original.Name),
		Type:        original.Type,
		Page:        original.Page,
		Enabled:     false, // Disabled by default
		Config:      original.Config,
		ContentType: original.ContentType,
		DataSource:  original.DataSource,
		MaxItems:    original.MaxItems,
		Layout:      original.Layout,
		ColorScheme: original.ColorScheme,
	}

	if err := s.CreateWidget(duplicate); err != nil {
		return nil, err
	}

	return duplicate, nil
}

// InitializeWidgets runs migration and seeding
func (s *WidgetService) InitializeWidgets() error {
	if err := models.MigrateWidgetTables(s.db); err != nil {
		fmt.Printf("Widget migration error: %v\n", err)
		return err
	}

	if err := models.SeedDefaultWidgets(s.db); err != nil {
		fmt.Printf("Widget seeding error: %v\n", err)
		return err
	}

	fmt.Println("Widget system initialized successfully")
	return nil
}

// DataCache holds pre-fetched data for widgets
type DataCache struct {
	LocalMovies    []models.Media
	LocalTVShows   []models.Media
	LocalAllMedia  []models.Media
	TMDBPopular    []models.MediaItem
	TMDBTrending   []models.MediaItem
	TMDBUpcoming   []models.MediaItem
	TMDBNowPlaying []models.MediaItem
	TMDBTVPopular  []models.MediaItem
	TMDBTVTrending []models.MediaItem
	TMDBTVTopRated []models.MediaItem
	Notifications  []models.MediaItem
}

// prefetchWidgetData pre-fetches all data that widgets might need
func (s *WidgetService) prefetchWidgetData(widgets []models.Widget) *DataCache {
	cache := &DataCache{}

	// Determine what data we need based on widget configurations
	needsLocal := false
	needsTMDB := false
	needsNotifications := false

	needPopularMovies := false
	needTrendingMovies := false
	needUpcomingMovies := false
	needNowPlayingMovies := false

	needPopularTV := false
	needTrendingTV := false
	needUpcomingTV := false
	needTopRatedTV := false

	for _, widget := range widgets {
		switch widget.DataSource {
		case models.WidgetDataSourceLocal, models.WidgetDataSourceRecent, models.WidgetDataSourceRecentlyPlayed:
			needsLocal = true
		case models.WidgetDataSourceTMDB, models.WidgetDataSourceTrending,
			models.WidgetDataSourcePopular, models.WidgetDataSourceNowPlaying,
			models.WidgetDataSourceUpcoming, models.WidgetDataSourceTopRated:
			needsTMDB = true
		}

		if widget.Type == "notifications" {
			needsNotifications = true
		}

		if widget.DataSource == models.WidgetDataSourceTMDB || widget.DataSource == models.WidgetDataSourcePopular {
			// Default TMDB source maps to "popular"
			switch widget.ContentType {
			case models.WidgetContentTypeTVShows:
				needPopularTV = true
			case models.WidgetContentTypeMixed:
				needPopularMovies = true
				needPopularTV = true
			default:
				needPopularMovies = true
			}
		}

		switch widget.DataSource {
		case models.WidgetDataSourceTrending:
			switch widget.ContentType {
			case models.WidgetContentTypeTVShows:
				needTrendingTV = true
			case models.WidgetContentTypeMixed:
				needTrendingMovies = true
				needTrendingTV = true
			default:
				needTrendingMovies = true
			}
		case models.WidgetDataSourceUpcoming:
			switch widget.ContentType {
			case models.WidgetContentTypeTVShows:
				needUpcomingTV = true
			case models.WidgetContentTypeMixed:
				needUpcomingMovies = true
				needUpcomingTV = true
			default:
				needUpcomingMovies = true
			}
		case models.WidgetDataSourceNowPlaying:
			switch widget.ContentType {
			case models.WidgetContentTypeTVShows:
				needTrendingTV = true
			case models.WidgetContentTypeMixed:
				needNowPlayingMovies = true
				needTrendingTV = true
			default:
				needNowPlayingMovies = true
			}
		case models.WidgetDataSourceTopRated:
			if widget.ContentType == models.WidgetContentTypeTVShows {
				needTopRatedTV = true
			}
		}

		// If explicit popular flags were not set via TMDB/default case
		if widget.DataSource == models.WidgetDataSourcePopular {
			continue
		}
	}

	// Use channels for concurrent data fetching
	var wg sync.WaitGroup

	// Fetch local data if needed
	if needsLocal && s.mediaService != nil {
		wg.Add(3)

		go func() {
			defer wg.Done()
			if movies, err := s.mediaService.GetMovies(); err == nil {
				cache.LocalMovies = movies
			}
		}()

		go func() {
			defer wg.Done()
			if tvShows, err := s.mediaService.GetTVShows(); err == nil {
				cache.LocalTVShows = tvShows
			}
		}()

		go func() {
			defer wg.Done()
			if allMedia, err := s.mediaService.GetAllMedia(); err == nil {
				cache.LocalAllMedia = allMedia
			}
		}()
	}

	// Fetch TMDB data if needed
	if needsTMDB && s.tmdbService != nil {
		if needPopularMovies {
			wg.Add(1)
			go func() {
				defer wg.Done()
				if popularMovies, err := s.tmdbService.GetPopularMovies(1); err == nil {
					for _, movie := range popularMovies {
						cache.TMDBPopular = append(cache.TMDBPopular, s.convertTMDBMovieToMediaItem(movie))
					}
				}
			}()
		}

		if needTrendingMovies {
			wg.Add(1)
			go func() {
				defer wg.Done()
				if upcomingMovies, err := s.tmdbService.GetUpcomingMovies(); err == nil && upcomingMovies != nil {
					for _, movie := range upcomingMovies.TrendingDaily {
						cache.TMDBTrending = append(cache.TMDBTrending, s.convertTMDBMovieToMediaItem(movie))
					}
				}
			}()
		}

		if needUpcomingMovies {
			wg.Add(1)
			go func() {
				defer wg.Done()
				if upcomingMovies, err := s.tmdbService.GetUpcomingMoviesList(1); err == nil {
					for _, movie := range upcomingMovies {
						cache.TMDBUpcoming = append(cache.TMDBUpcoming, s.convertTMDBMovieWithVideosToMediaItem(movie))
					}
				}
			}()
		}

		if needNowPlayingMovies {
			wg.Add(1)
			go func() {
				defer wg.Done()
				if nowPlayingMovies, err := s.tmdbService.GetNowPlayingMovies(1); err == nil {
					for _, movie := range nowPlayingMovies {
						cache.TMDBNowPlaying = append(cache.TMDBNowPlaying, s.convertTMDBMovieWithVideosToMediaItem(movie))
					}
				}
			}()
		}

		if needPopularTV || needTrendingTV || needUpcomingTV || needTopRatedTV {
			wg.Add(1)
			go func(popular, trending, upcoming, topRated bool) {
				defer wg.Done()
				if tvSeries, err := s.tmdbService.GetUpcomingTVSeries(); err == nil && tvSeries != nil {
					if popular {
						for _, tv := range tvSeries.OnTheAir {
							cache.TMDBTVPopular = append(cache.TMDBTVPopular, s.convertTMDBTVToMediaItem(tv))
						}
					}
					if trending {
						for _, tv := range tvSeries.TrendingWeekly {
							cache.TMDBTVTrending = append(cache.TMDBTVTrending, s.convertTMDBTVToMediaItem(tv))
						}
						for _, tv := range tvSeries.AiringToday {
							cache.TMDBTVTrending = append(cache.TMDBTVTrending, s.convertTMDBTVToMediaItem(tv))
						}
					}
					if upcoming {
						for _, tv := range tvSeries.AiringToday {
							cache.TMDBTVPopular = append(cache.TMDBTVPopular, s.convertTMDBTVToMediaItem(tv))
						}
					}
					if topRated {
						for _, tv := range tvSeries.OnTheAir {
							cache.TMDBTVTopRated = append(cache.TMDBTVTopRated, s.convertTMDBTVToMediaItem(tv))
						}
					}
				}
			}(needPopularTV, needTrendingTV, needUpcomingTV, needTopRatedTV)
		}
	}

	// Fetch notifications if needed
	if needsNotifications && s.notificationService != nil {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if notifications, err := s.notificationService.GetNotifications(20); err == nil {
				for i, notification := range notifications {
					mediaItem := models.MediaItem{
						ID:               uint(i + 1),
						Title:            notification.Title,
						Description:      notification.Message,
						Type:             "notification",
						NotificationData: &notification,
					}
					cache.Notifications = append(cache.Notifications, mediaItem)
				}
			}
		}()
	}

	// Wait for all data fetching to complete
	wg.Wait()

	fmt.Printf("✅ Pre-fetched data cache: local_movies=%d, local_tv=%d, local_all=%d, tmdb_popular=%d, tmdb_trending=%d, tmdb_upcoming=%d, tmdb_now_playing=%d, tmdb_tv_popular=%d, tmdb_tv_trending=%d, tmdb_tv_top_rated=%d, notifications=%d\n",
		len(cache.LocalMovies), len(cache.LocalTVShows), len(cache.LocalAllMedia),
		len(cache.TMDBPopular), len(cache.TMDBTrending), len(cache.TMDBUpcoming), len(cache.TMDBNowPlaying),
		len(cache.TMDBTVPopular), len(cache.TMDBTVTrending), len(cache.TMDBTVTopRated),
		len(cache.Notifications))

	return cache
}

// getWidgetDataFromCache gets widget data from the pre-fetched cache
func (s *WidgetService) getWidgetDataFromCache(widget models.Widget, cache *DataCache) []models.MediaItem {
	// Handle notification widgets specially
	if widget.Type == "notifications" {
		if len(cache.Notifications) > 0 {
			limit := widget.MaxItems
			if limit > len(cache.Notifications) {
				limit = len(cache.Notifications)
			}
			return cache.Notifications[:limit]
		}
		return []models.MediaItem{}
	}

	// For trailer widgets, bypass cache and use direct data fetching to ensure trailer URLs are populated
	if widget.Type == models.WidgetTypeTrailer {
		fmt.Printf("🎬 Trailer widget %s: bypassing cache for real-time trailer URL enrichment\n", widget.Name)

		config, err := s.GetWidgetConfig(&widget)
		if err != nil {
			fmt.Printf("⚠️ Error parsing widget config for %s: %v\n", widget.Name, err)
			config = &models.WidgetConfig{}
		}

		// Use direct data fetching instead of cache
		if widget.DataSource == models.WidgetDataSourceLocal ||
			widget.DataSource == models.WidgetDataSourceRecent ||
			widget.DataSource == models.WidgetDataSourceRecentlyPlayed {
			if data, err := s.getLocalMediaData(&widget, config); err == nil {
				return data
			}
		} else {
			if data, err := s.getTMDBData(&widget, config); err == nil {
				return data
			}
		}

		// Fallback to empty if direct fetching fails
		return []models.MediaItem{}
	}

	config, err := s.GetWidgetConfig(&widget)
	if err != nil {
		fmt.Printf("⚠️ Error parsing widget config for %s: %v\n", widget.Name, err)
		config = &models.WidgetConfig{}
	}

	// Handle specific content widgets
	if widget.Type == models.WidgetTypeSpecificContent || len(config.SelectedContent) > 0 {
		if len(config.SelectedContent) > 0 {
			return s.convertSelectedContentToMediaItems(config.SelectedContent)
		}
		return []models.MediaItem{}
	}

	var sourceData []models.MediaItem

	// Get data from cache based on data source
	switch widget.DataSource {
	case models.WidgetDataSourceLocal, models.WidgetDataSourceRecent, models.WidgetDataSourceRecentlyPlayed:
		fmt.Printf("🔧 Widget %s using local data source: %s\n", widget.Name, widget.DataSource)
		sourceData = s.getLocalDataFromCache(widget, cache)
	case models.WidgetDataSourceTMDB, models.WidgetDataSourceTrending,
		models.WidgetDataSourcePopular, models.WidgetDataSourceNowPlaying,
		models.WidgetDataSourceUpcoming:
		fmt.Printf("🔧 Widget %s using TMDB data source: %s\n", widget.Name, widget.DataSource)
		sourceData = s.getTMDBDataFromCache(widget, cache)
	default:
		fmt.Printf("🔧 Widget %s using default local data source (fallback)\n", widget.Name)
		sourceData = s.getLocalDataFromCache(widget, cache)
	}

	// Apply filters
	filteredData := s.applyWidgetFilters(sourceData, widget, config)

	// Sort data
	sortedData := s.sortWidgetData(filteredData, widget)

	// Limit results
	if len(sortedData) > widget.MaxItems {
		sortedData = sortedData[:widget.MaxItems]
	}

	return sortedData
}

// getLocalDataFromCache gets local media data from cache
func (s *WidgetService) getLocalDataFromCache(widget models.Widget, cache *DataCache) []models.MediaItem {
	var sourceMedia []models.Media

	fmt.Printf("🔧 Getting local data for widget %s (content_type: %s, data_source: %s)\n",
		widget.Name, widget.ContentType, widget.DataSource)

	// Handle recently-played data source specially
	if widget.DataSource == models.WidgetDataSourceRecentlyPlayed {
		fmt.Printf("🔧 Using playback service for recently played items in cache method for widget %s\n", widget.Name)
		if s.playbackService != nil {
			recentlyWatched, err := s.playbackService.GetRecentlyWatchedWithProgress("1", widget.MaxItems)
			if err != nil {
				fmt.Printf("⚠️ Error getting recently watched from playback service: %v\n", err)
				return []models.MediaItem{}
			}

			// Convert playback progress items to media items directly
			var mediaItems []models.MediaItem
			for _, progress := range recentlyWatched {
				item := models.MediaItem{
					ID:              progress.Media.ID,
					Title:           progress.Media.Title,
					Description:     progress.Media.Description,
					Type:            progress.Media.Type,
					Rating:          progress.Media.Rating,
					Year:            progress.Media.Year,
					Duration:        progress.Media.Duration,
					ThumbnailPath:   progress.Media.ThumbnailPath,
					PosterPath:      progress.Media.PosterPath,
					BackdropPath:    progress.Media.BackdropPath,
					LogoPath:        progress.Media.LogoPath,
					TMDBBackdropURL: progress.Media.TMDBBackdropURL,
					TMDBID:          progress.Media.TMDBID,
					ViewCount:       progress.Media.ViewCount,
					LastViewed:      &progress.LastWatched,
				}

				// Handle SeriesID pointer
				if progress.Media.SeriesID != nil {
					item.SeriesID = *progress.Media.SeriesID
				}

				// Convert genres
				for _, genre := range progress.Media.Genres {
					item.GenreNames = append(item.GenreNames, genre.Name)
				}

				mediaItems = append(mediaItems, item)
			}

			fmt.Printf("🔧 Found %d recently played items from playback service for widget %s\n", len(mediaItems), widget.Name)
			return mediaItems
		} else {
			fmt.Printf("⚠️ Playback service not available for widget %s\n", widget.Name)
			return []models.MediaItem{}
		}
	}

	switch widget.ContentType {
	case models.WidgetContentTypeMovies:
		sourceMedia = cache.LocalMovies
		fmt.Printf("   Using LocalMovies cache: %d items\n", len(sourceMedia))
	case models.WidgetContentTypeTVShows:
		sourceMedia = cache.LocalTVShows
		fmt.Printf("   Using LocalTVShows cache: %d items\n", len(sourceMedia))
	default:
		sourceMedia = cache.LocalAllMedia
		fmt.Printf("   Using LocalAllMedia cache: %d items\n", len(sourceMedia))
	}

	preferSeries := widget.ContentType == models.WidgetContentTypeTVShows
	var mediaItems []models.MediaItem
	for _, media := range sourceMedia {
		mediaItems = append(mediaItems, s.convertMediaToWidgetItem(media, preferSeries))
	}

	if preferSeries {
		mediaItems = dedupeSeriesItems(mediaItems)
	}

	if widget.Type == models.WidgetTypeTrailer && s.tmdbService != nil {
		fmt.Printf("🎬 Enriching local media with trailer URLs for trailer widget %s\n", widget.Name)

		enrichedItems := s.enrichMediaItemsWithTrailers(mediaItems)

		fmt.Printf("🎬 Trailer widget %s: %d items with trailers out of %d local items\n",
			widget.Name, len(enrichedItems), len(mediaItems))

		return enrichedItems
	}

	return mediaItems
}

// getTMDBDataFromCache gets TMDB data from cache
func (s *WidgetService) getTMDBDataFromCache(widget models.Widget, cache *DataCache) []models.MediaItem {
	var sourceData []models.MediaItem

	// For TV shows content type, use TV shows data
	if widget.ContentType == models.WidgetContentTypeTVShows {
		switch widget.DataSource {
		case models.WidgetDataSourceTrending:
			sourceData = cache.TMDBTVTrending
		case models.WidgetDataSourcePopular, models.WidgetDataSourceTMDB:
			sourceData = cache.TMDBTVPopular
		case models.WidgetDataSourceTopRated:
			sourceData = cache.TMDBTVTopRated
		default:
			sourceData = cache.TMDBTVPopular
		}
	} else {
		// For movies or mixed content, use movie data
		switch widget.DataSource {
		case models.WidgetDataSourceTrending:
			sourceData = cache.TMDBTrending
		case models.WidgetDataSourcePopular:
			sourceData = cache.TMDBPopular
		case models.WidgetDataSourceUpcoming:
			sourceData = cache.TMDBUpcoming
		case models.WidgetDataSourceNowPlaying:
			sourceData = cache.TMDBNowPlaying
		default:
			sourceData = cache.TMDBPopular
		}
	}

	// For trailer widgets, enrich the data with trailer URLs efficiently
	if widget.Type == models.WidgetTypeTrailer && len(sourceData) > 0 {
		fmt.Printf("🎬 Enriching cached data with trailer URLs for widget %s\n", widget.Name)

		// Limit to widget.MaxItems to avoid unnecessary API calls
		itemsToEnrich := sourceData
		if len(sourceData) > widget.MaxItems {
			itemsToEnrich = sourceData[:widget.MaxItems]
		}

		enrichedData := s.enrichMediaItemsWithTrailers(itemsToEnrich)

		fmt.Printf("🎬 Found %d items with trailers out of %d processed for widget %s\n",
			len(enrichedData), len(itemsToEnrich), widget.Name)

		return enrichedData
	}

	return sourceData
}

// applyWidgetFilters applies filters to widget data
func (s *WidgetService) applyWidgetFilters(data []models.MediaItem, widget models.Widget, config *models.WidgetConfig) []models.MediaItem {
	filteredData := data

	// Filter by content type
	if widget.ContentType == models.WidgetContentTypeMovies {
		var filtered []models.MediaItem
		for _, item := range filteredData {
			if item.Type == "movie" {
				filtered = append(filtered, item)
			}
		}
		filteredData = filtered
	} else if widget.ContentType == models.WidgetContentTypeTVShows {
		var filtered []models.MediaItem
		for _, item := range filteredData {
			if item.Type == "tv" || item.Type == "episode" || item.Type == "series" {
				filtered = append(filtered, item)
			}
		}
		filteredData = filtered
	}

	// Apply genre filter - handle both genreFilter (names) and selectedGenres (IDs)
	if len(config.GenreFilter) > 0 {
		fmt.Printf("🔧 Applying genre filter for widget %s: %v\n", widget.Name, config.GenreFilter)
		var filtered []models.MediaItem
		for _, item := range filteredData {
			// Check if item has any of the filtered genres
			hasMatchingGenre := false
			for _, genre := range item.GenreNames {
				for _, filterGenre := range config.GenreFilter {
					if strings.EqualFold(genre, filterGenre) {
						hasMatchingGenre = true
						break
					}
				}
				if hasMatchingGenre {
					break
				}
			}
			if hasMatchingGenre {
				filtered = append(filtered, item)
			}
		}
		filteredData = filtered
		fmt.Printf("🔧 Genre filter applied: %d items remaining\n", len(filteredData))
	}

	// Apply year filter
	if config.YearFilter > 0 {
		var filtered []models.MediaItem
		for _, item := range filteredData {
			if item.Year == config.YearFilter {
				filtered = append(filtered, item)
			}
		}
		filteredData = filtered
	}

	// Apply rating filter
	if config.RatingFilter > 0 {
		var filtered []models.MediaItem
		for _, item := range filteredData {
			if item.Rating >= config.RatingFilter {
				filtered = append(filtered, item)
			}
		}
		filteredData = filtered
	}

	return filteredData
}

// sortWidgetData sorts widget data based on data source and widget type
func (s *WidgetService) sortWidgetData(data []models.MediaItem, widget models.Widget) []models.MediaItem {
	sortedData := make([]models.MediaItem, len(data))
	copy(sortedData, data)

	// Special handling for genre-based widgets - sort by latest content (year and added date)
	if widget.Type == models.WidgetTypeGenreBased {
		fmt.Printf("🔧 Sorting genre-based widget %s data by latest content (ID DESC, Year DESC)\n", widget.Name)
		sort.Slice(sortedData, func(i, j int) bool {
			// First sort by ID (higher ID = more recently added to database)
			if sortedData[i].ID != sortedData[j].ID {
				return sortedData[i].ID > sortedData[j].ID
			}
			// Then by year (newer content first)
			if sortedData[i].Year != sortedData[j].Year {
				return sortedData[i].Year > sortedData[j].Year
			}
			// Finally by rating as tiebreaker
			return sortedData[i].Rating > sortedData[j].Rating
		})
		return sortedData
	}

	switch widget.DataSource {
	case models.WidgetDataSourceTrending:
		sort.Slice(sortedData, func(i, j int) bool {
			if sortedData[i].ViewCount != sortedData[j].ViewCount {
				return sortedData[i].ViewCount > sortedData[j].ViewCount
			}
			return sortedData[i].Rating > sortedData[j].Rating
		})
	case models.WidgetDataSourcePopular:
		sort.Slice(sortedData, func(i, j int) bool {
			if sortedData[i].Rating != sortedData[j].Rating {
				return sortedData[i].Rating > sortedData[j].Rating
			}
			return sortedData[i].ViewCount > sortedData[j].ViewCount
		})
	case models.WidgetDataSourceRecent:
		// Sort by ID (higher ID = more recently added) and then by year
		fmt.Printf("🔧 Sorting widget %s data by recent (ID DESC, Year DESC)\n", widget.Name)
		sort.Slice(sortedData, func(i, j int) bool {
			if sortedData[i].ID != sortedData[j].ID {
				return sortedData[i].ID > sortedData[j].ID
			}
			return sortedData[i].Year > sortedData[j].Year
		})
	case models.WidgetDataSourceRecentlyPlayed:
		// Sort by last viewed time (most recently played first)
		fmt.Printf("🔧 Sorting widget %s data by recently played (LastViewed DESC)\n", widget.Name)
		sort.Slice(sortedData, func(i, j int) bool {
			// If both have last viewed times, compare them
			if sortedData[i].LastViewed != nil && sortedData[j].LastViewed != nil {
				return sortedData[i].LastViewed.After(*sortedData[j].LastViewed)
			}
			// If only one has last viewed time, it comes first
			if sortedData[i].LastViewed != nil {
				return true
			}
			if sortedData[j].LastViewed != nil {
				return false
			}
			// If neither has last viewed time, sort by view count
			return sortedData[i].ViewCount > sortedData[j].ViewCount
		})
	default:
		sort.Slice(sortedData, func(i, j int) bool {
			if sortedData[i].Year != sortedData[j].Year {
				return sortedData[i].Year > sortedData[j].Year
			}
			return sortedData[i].Rating > sortedData[j].Rating
		})
	}

	return sortedData
}
func (s *WidgetService) GetWidgetData(widget *models.Widget) ([]models.MediaItem, error) {
	// Handle notification widgets specially
	if widget.Type == "notifications" {
		// For notification widgets, fetch actual notifications and convert to media items
		if s.notificationService != nil {
			notifications, err := s.notificationService.GetNotifications(widget.MaxItems)
			if err != nil {
				fmt.Printf("⚠️ Failed to fetch notifications for widget %s: %v\n", widget.Name, err)
				return []models.MediaItem{}, nil // Return empty instead of error to prevent widget failure
			}

			// Convert notifications to media items for display
			mediaItems := make([]models.MediaItem, 0, len(notifications))
			for i, notification := range notifications {
				// Create a media item from notification data
				mediaItem := models.MediaItem{
					ID:          uint(i + 1), // Use index as ID since notification IDs are strings
					Title:       notification.Title,
					Description: notification.Message,
					Type:        "notification",
					// Add notification-specific data
					NotificationData: &notification,
				}
				mediaItems = append(mediaItems, mediaItem)
			}

			fmt.Printf("✅ Fetched %d notifications for widget %s\n", len(mediaItems), widget.Name)
			return mediaItems, nil
		}

		// If notification service is not available, return empty
		fmt.Printf("⚠️ Notification service not available for widget %s\n", widget.Name)
		return []models.MediaItem{}, nil
	}

	config, err := s.GetWidgetConfig(widget)
	if err != nil {
		return nil, fmt.Errorf("failed to parse widget config: %v", err)
	}

	fmt.Printf("🔧 Widget %s (type: %s) config: selectedContent=%d items\n",
		widget.Name, widget.Type, len(config.SelectedContent))

	// Handle specific content widgets - check both widget type and selected content
	if widget.Type == models.WidgetTypeSpecificContent || len(config.SelectedContent) > 0 {
		fmt.Printf("✅ Widget %s has selected content, using convertSelectedContentToMediaItems\n", widget.Name)
		if len(config.SelectedContent) > 0 {
			return s.convertSelectedContentToMediaItems(config.SelectedContent), nil
		}
		// If no selected content but it's a specific content widget, return empty
		return []models.MediaItem{}, nil
	}

	// Determine data source and fetch accordingly
	switch widget.DataSource {
	case models.WidgetDataSourceLocal, models.WidgetDataSourceRecent, models.WidgetDataSourceRecentlyPlayed:
		return s.getLocalMediaData(widget, config)
	case models.WidgetDataSourceTMDB, models.WidgetDataSourceTrending, models.WidgetDataSourcePopular,
		models.WidgetDataSourceNowPlaying, models.WidgetDataSourceUpcoming, models.WidgetDataSourceTopRated:
		return s.getTMDBData(widget, config)
	default:
		// Default to local data
		return s.getLocalMediaData(widget, config)
	}
}

// convertSelectedContentToMediaItems converts selected content to MediaItem format
func (s *WidgetService) convertSelectedContentToMediaItems(selectedContent []interface{}) []models.MediaItem {
	var items []models.MediaItem

	for _, content := range selectedContent {
		if contentMap, ok := content.(map[string]interface{}); ok {
			item := models.MediaItem{}

			// Handle ID (could be float64 from JSON)
			if id, ok := contentMap["id"].(float64); ok {
				item.ID = uint(id)
				item.TMDBID = int(id)
			} else if id, ok := contentMap["id"].(int); ok {
				item.ID = uint(id)
				item.TMDBID = id
			}

			// Handle TMDB ID specifically
			if tmdbId, ok := contentMap["tmdb_id"].(float64); ok {
				item.TMDBID = int(tmdbId)
			} else if tmdbId, ok := contentMap["tmdb_id"].(int); ok {
				item.TMDBID = tmdbId
			}

			// Handle title (could be title or name for TV shows)
			if title, ok := contentMap["title"].(string); ok {
				item.Title = title
			} else if name, ok := contentMap["name"].(string); ok {
				item.Title = name
			}

			// Handle original title
			if originalTitle, ok := contentMap["original_title"].(string); ok {
				item.OriginalTitle = originalTitle
			} else if originalName, ok := contentMap["original_name"].(string); ok {
				item.OriginalTitle = originalName
			}

			// Handle description/overview
			if overview, ok := contentMap["overview"].(string); ok {
				item.Description = overview
			} else if description, ok := contentMap["description"].(string); ok {
				item.Description = description
			}

			// Handle poster path
			if posterPath, ok := contentMap["poster_path"].(string); ok {
				if posterPath != "" {
					item.TMDBPosterURL = "https://image.tmdb.org/t/p/w500" + posterPath
					item.PosterPath = posterPath
				}
			}

			// Handle backdrop path
			if backdropPath, ok := contentMap["backdrop_path"].(string); ok {
				if backdropPath != "" {
					item.TMDBBackdropURL = "https://image.tmdb.org/t/p/original" + backdropPath
					item.BackdropPath = backdropPath
				}
			}

			// Handle logo path
			if logoPath, ok := contentMap["logo_path"].(string); ok {
				if logoPath != "" {
					item.LogoPath = "https://image.tmdb.org/t/p/w500" + logoPath
				}
			}

			// Handle rating/vote average
			if voteAverage, ok := contentMap["vote_average"].(float64); ok {
				item.Rating = voteAverage
			} else if rating, ok := contentMap["rating"].(float64); ok {
				item.Rating = rating
			}

			// Handle popularity
			if popularity, ok := contentMap["popularity"].(float64); ok {
				item.Popularity = popularity
			}

			// Handle vote count
			if voteCount, ok := contentMap["vote_count"].(float64); ok {
				item.VoteCount = int(voteCount)
			}

			// Handle adult flag
			if adult, ok := contentMap["adult"].(bool); ok {
				item.Adult = adult
			}

			// Handle original language
			if originalLanguage, ok := contentMap["original_language"].(string); ok {
				item.OriginalLanguage = originalLanguage
			}

			// Handle video flag
			if video, ok := contentMap["video"].(bool); ok {
				item.Video = video
			}

			// Handle release date
			if releaseDate, ok := contentMap["release_date"].(string); ok {
				item.ReleaseDate = releaseDate
				if len(releaseDate) >= 4 {
					if year, err := strconv.Atoi(releaseDate[:4]); err == nil {
						item.Year = year
					}
				}
			} else if firstAirDate, ok := contentMap["first_air_date"].(string); ok {
				item.FirstAirDate = firstAirDate
				if len(firstAirDate) >= 4 {
					if year, err := strconv.Atoi(firstAirDate[:4]); err == nil {
						item.Year = year
					}
				}
			}

			// Handle runtime
			if runtime, ok := contentMap["runtime"].(float64); ok {
				item.Runtime = int(runtime)
				item.Duration = int(runtime) * 60 // Convert minutes to seconds
			}

			// Handle media type
			if mediaType, ok := contentMap["media_type"].(string); ok {
				item.Type = mediaType
			} else if contentType, ok := contentMap["type"].(string); ok {
				item.Type = contentType
			} else {
				// Default based on presence of certain fields
				if _, hasFirstAirDate := contentMap["first_air_date"]; hasFirstAirDate {
					item.Type = "tv"
				} else {
					item.Type = "movie"
				}
			}

			// Handle genres
			if genres, ok := contentMap["genres"].([]interface{}); ok {
				for _, genreInterface := range genres {
					if genreMap, ok := genreInterface.(map[string]interface{}); ok {
						if genreName, ok := genreMap["name"].(string); ok {
							item.GenreNames = append(item.GenreNames, genreName)
							// Also add to Genres slice
							if genreId, ok := genreMap["id"].(float64); ok {
								item.Genres = append(item.Genres, models.Genre{
									ID:   uint(genreId),
									Name: genreName,
								})
							}
						}
					}
				}
			} else if genreNames, ok := contentMap["genre_names"].([]interface{}); ok {
				for _, genreInterface := range genreNames {
					if genreName, ok := genreInterface.(string); ok {
						item.GenreNames = append(item.GenreNames, genreName)
					}
				}
			}

			// Handle tagline
			if tagline, ok := contentMap["tagline"].(string); ok {
				item.Tagline = tagline
			}

			// Handle certification
			if certification, ok := contentMap["certification"].(string); ok {
				item.Certification = certification
			}

			items = append(items, item)
		}
	}

	fmt.Printf("✅ Converted %d selected content items to MediaItems\n", len(items))
	return items
}

// getLocalMediaData fetches data from local media database
func (s *WidgetService) getLocalMediaData(widget *models.Widget, config *models.WidgetConfig) ([]models.MediaItem, error) {
	var mediaItems []models.MediaItem

	// Use the media service to get media data
	if s.mediaService == nil {
		fmt.Printf("⚠️ MediaService not available for widget %s, using direct DB query\n", widget.Name)
		return s.getLocalMediaDataDirect(widget, config)
	}

	// Get media based on content type
	var allMedia []models.Media
	var err error

	switch widget.ContentType {
	case models.WidgetContentTypeMovies:
		allMedia, err = s.mediaService.GetMovies()
	case models.WidgetContentTypeTVShows:
		allMedia, err = s.mediaService.GetTVShows()
	default:
		allMedia, err = s.mediaService.GetAllMedia()
	}

	if err != nil {
		fmt.Printf("⚠️ Error fetching media for widget %s: %v\n", widget.Name, err)
		return []models.MediaItem{}, nil
	}

	// Filter by genre if specified
	if len(config.GenreFilter) > 0 {
		fmt.Printf("🔧 Applying genre filter for widget %s: %v\n", widget.Name, config.GenreFilter)
		var filteredMedia []models.Media
		for _, media := range allMedia {
			// Check if media has any of the filtered genres
			hasMatchingGenre := false
			for _, genre := range media.Genres {
				for _, filterGenre := range config.GenreFilter {
					if strings.EqualFold(genre.Name, filterGenre) {
						hasMatchingGenre = true
						break
					}
				}
				if hasMatchingGenre {
					break
				}
			}
			if hasMatchingGenre {
				filteredMedia = append(filteredMedia, media)
			}
		}
		allMedia = filteredMedia
		fmt.Printf("🔧 Genre filter applied: %d items remaining\n", len(allMedia))
	}

	// Apply other filters
	if config.YearFilter > 0 {
		var filteredMedia []models.Media
		for _, media := range allMedia {
			if media.Year == config.YearFilter {
				filteredMedia = append(filteredMedia, media)
			}
		}
		allMedia = filteredMedia
	}

	if config.RatingFilter > 0 {
		var filteredMedia []models.Media
		for _, media := range allMedia {
			if media.Rating >= config.RatingFilter {
				filteredMedia = append(filteredMedia, media)
			}
		}
		allMedia = filteredMedia
	}

	// Filter for recently played items if using recently-played data source
	if widget.DataSource == models.WidgetDataSourceRecentlyPlayed {
		fmt.Printf("🔧 Using playback service for recently played items for widget %s\n", widget.Name)
		// Use the playback service to get recently watched items
		if s.playbackService != nil {
			recentlyWatched, err := s.playbackService.GetRecentlyWatchedWithProgress("1", widget.MaxItems)
			if err != nil {
				fmt.Printf("⚠️ Error getting recently watched from playback service: %v\n", err)
				// Fall back to empty list if playback service fails
				allMedia = []models.Media{}
			} else {
				// Convert playback progress items to media items
				var recentlyPlayedMedia []models.Media
				for _, progress := range recentlyWatched {
					// Update the media with playback info
					media := progress.Media
					media.ViewCount = int(progress.Position) // Store position as view count for sorting
					media.LastViewed = &progress.LastWatched
					recentlyPlayedMedia = append(recentlyPlayedMedia, media)
				}
				allMedia = recentlyPlayedMedia
				fmt.Printf("🔧 Found %d recently played items from playback service for widget %s\n", len(allMedia), widget.Name)
			}
		} else {
			fmt.Printf("⚠️ Playback service not available for widget %s, using fallback filtering\n", widget.Name)
			// Fallback to the previous filtering logic if playback service is not available
			var recentlyPlayedMedia []models.Media
			for _, media := range allMedia {
				if media.LastViewed != nil && media.ViewCount > 0 {
					recentlyPlayedMedia = append(recentlyPlayedMedia, media)
				}
			}
			allMedia = recentlyPlayedMedia
			fmt.Printf("🔧 Found %d recently played items using fallback for widget %s\n", len(allMedia), widget.Name)
		}
	}

	// Sort based on data source
	switch widget.DataSource {
	case models.WidgetDataSourceTrending:
		// Sort by view count and rating
		sort.Slice(allMedia, func(i, j int) bool {
			if allMedia[i].ViewCount != allMedia[j].ViewCount {
				return allMedia[i].ViewCount > allMedia[j].ViewCount
			}
			return allMedia[i].Rating > allMedia[j].Rating
		})
	case models.WidgetDataSourcePopular:
		// Sort by rating and view count
		sort.Slice(allMedia, func(i, j int) bool {
			if allMedia[i].Rating != allMedia[j].Rating {
				return allMedia[i].Rating > allMedia[j].Rating
			}
			return allMedia[i].ViewCount > allMedia[j].ViewCount
		})
	case models.WidgetDataSourceRecent:
		// Sort by creation date (most recent first)
		sort.Slice(allMedia, func(i, j int) bool {
			return allMedia[i].CreatedAt.After(allMedia[j].CreatedAt)
		})
	case models.WidgetDataSourceRecentlyPlayed:
		// Sort by last viewed time (most recently played first)
		sort.Slice(allMedia, func(i, j int) bool {
			// If both have last viewed times, compare them
			if allMedia[i].LastViewed != nil && allMedia[j].LastViewed != nil {
				return allMedia[i].LastViewed.After(*allMedia[j].LastViewed)
			}
			// If only one has last viewed time, it comes first
			if allMedia[i].LastViewed != nil {
				return true
			}
			if allMedia[j].LastViewed != nil {
				return false
			}
			// If neither has last viewed time, sort by view count
			return allMedia[i].ViewCount > allMedia[j].ViewCount
		})
	default:
		// Default: sort by year desc, then rating desc
		sort.Slice(allMedia, func(i, j int) bool {
			if allMedia[i].Year != allMedia[j].Year {
				return allMedia[i].Year > allMedia[j].Year
			}
			return allMedia[i].Rating > allMedia[j].Rating
		})
	}

	// Limit results
	if len(allMedia) > widget.MaxItems {
		allMedia = allMedia[:widget.MaxItems]
	}

	// Convert to MediaItem format
	preferSeries := widget.ContentType == models.WidgetContentTypeTVShows
	for _, media := range allMedia {
		mediaItems = append(mediaItems, s.convertMediaToWidgetItem(media, preferSeries))
	}

	if preferSeries {
		mediaItems = dedupeSeriesItems(mediaItems)
	}

	if widget.Type == models.WidgetTypeTrailer && s.tmdbService != nil {
		fmt.Printf("🎬 Enriching local media with trailer URLs for trailer widget %s\n", widget.Name)

		enrichedItems := s.enrichMediaItemsWithTrailers(mediaItems)

		fmt.Printf("🎬 Trailer widget %s: %d items with trailers out of %d local items\n",
			widget.Name, len(enrichedItems), len(mediaItems))

		return enrichedItems, nil
	}

	fmt.Printf("✅ Widget %s: Found %d media items (content_type: %s, data_source: %s)\n",
		widget.Name, len(mediaItems), widget.ContentType, widget.DataSource)

	return mediaItems, nil
}

// getLocalMediaDataDirect is a fallback method for direct database queries
func (s *WidgetService) getLocalMediaDataDirect(widget *models.Widget, config *models.WidgetConfig) ([]models.MediaItem, error) {
	var mediaItems []models.MediaItem

	// Build query based on content type
	query := s.db.Table("media").Preload("Genres").Preload("Series").Preload("Series.Genres")

	// Filter by content type
	switch widget.ContentType {
	case models.WidgetContentTypeMovies:
		query = query.Where("type = ?", "movie")
	case models.WidgetContentTypeTVShows:
		query = query.Where("type IN (?)", []string{"tv", "series", "episode"})
	}

	// Apply filters from config
	if len(config.GenreFilter) > 0 {
		// Join with genres table for proper filtering
		query = query.Joins("JOIN media_genres ON media.id = media_genres.media_id").
			Joins("JOIN genres ON media_genres.genre_id = genres.id").
			Where("genres.name IN (?)", config.GenreFilter).
			Group("media.id")
	}

	if config.YearFilter > 0 {
		query = query.Where("year = ?", config.YearFilter)
	}

	if config.RatingFilter > 0 {
		query = query.Where("rating >= ?", config.RatingFilter)
	}

	// Filter for recently played items if using recently-played data source
	if widget.DataSource == models.WidgetDataSourceRecentlyPlayed {
		if s.playbackService != nil {
			// Use playback service to get recently watched items instead of database query
			fmt.Printf("🔧 Using playback service for recently played items in direct query for widget %s\n", widget.Name)
			recentlyWatched, err := s.playbackService.GetRecentlyWatchedWithProgress("1", widget.MaxItems)
			if err != nil {
				fmt.Printf("⚠️ Error getting recently watched from playback service: %v\n", err)
				return []models.MediaItem{}, err
			}

			// Convert playback progress items to media items
			for _, progress := range recentlyWatched {
				item := models.MediaItem{
					ID:              progress.Media.ID,
					Title:           progress.Media.Title,
					Description:     progress.Media.Description,
					Type:            progress.Media.Type,
					Rating:          progress.Media.Rating,
					Year:            progress.Media.Year,
					Duration:        progress.Media.Duration,
					ThumbnailPath:   progress.Media.ThumbnailPath,
					PosterPath:      progress.Media.PosterPath,
					BackdropPath:    progress.Media.BackdropPath,
					LogoPath:        progress.Media.LogoPath,
					TMDBBackdropURL: progress.Media.TMDBBackdropURL,
					TMDBID:          progress.Media.TMDBID,
					ViewCount:       progress.Media.ViewCount,
					LastViewed:      &progress.LastWatched,
				}

				// Handle SeriesID pointer
				if progress.Media.SeriesID != nil {
					item.SeriesID = *progress.Media.SeriesID
				}

				// Convert genres
				for _, genre := range progress.Media.Genres {
					item.GenreNames = append(item.GenreNames, genre.Name)
				}

				mediaItems = append(mediaItems, item)
			}

			fmt.Printf("✅ Widget %s (direct): Found %d recently played items from playback service\n", widget.Name, len(mediaItems))
			return mediaItems, nil
		} else {
			// Fallback to database query if playback service is not available
			query = query.Where("last_viewed IS NOT NULL AND view_count > 0")
		}
	}

	// Order based on data source
	switch widget.DataSource {
	case models.WidgetDataSourceTrending:
		query = query.Order("view_count DESC, rating DESC, year DESC")
	case models.WidgetDataSourcePopular:
		query = query.Order("rating DESC, view_count DESC, year DESC")
	case models.WidgetDataSourceRecent:
		// Sort by ID (higher ID = more recently added) and creation date
		query = query.Order("id DESC, created_at DESC")
	case models.WidgetDataSourceRecentlyPlayed:
		// Sort by last viewed time (most recently played first), then by view count
		query = query.Order("last_viewed DESC, view_count DESC")
	default:
		query = query.Order("year DESC, rating DESC, created_at DESC")
	}

	// Limit results
	query = query.Limit(widget.MaxItems)

	// Execute query
	var dbResults []models.Media
	if err := query.Find(&dbResults).Error; err != nil {
		return nil, err
	}

	// Convert to MediaItem format
	preferSeries := widget.ContentType == models.WidgetContentTypeTVShows
	for _, result := range dbResults {
		mediaItems = append(mediaItems, s.convertMediaToWidgetItem(result, preferSeries))
	}

	if preferSeries {
		mediaItems = dedupeSeriesItems(mediaItems)
	}

	if widget.Type == models.WidgetTypeTrailer && s.tmdbService != nil {
		fmt.Printf("🎬 Enriching local media with trailer URLs for trailer widget %s (direct)\n", widget.Name)

		enrichedItems := s.enrichMediaItemsWithTrailers(mediaItems)

		fmt.Printf("🎬 Trailer widget %s (direct): %d items with trailers out of %d local items\n",
			widget.Name, len(enrichedItems), len(mediaItems))

		return enrichedItems, nil
	}

	fmt.Printf("✅ Widget %s (direct): Found %d media items\n", widget.Name, len(mediaItems))

	return mediaItems, nil
}

func (s *WidgetService) enrichMediaItemsWithTrailers(items []models.MediaItem) []models.MediaItem {
	if len(items) == 0 {
		return []models.MediaItem{}
	}

	if s.tmdbService == nil {
		var withTrailers []models.MediaItem
		for _, item := range items {
			if item.TMDBTrailerURL != "" {
				withTrailers = append(withTrailers, item)
			}
		}
		return withTrailers
	}

	maxWorkers := 4
	if len(items) < maxWorkers {
		maxWorkers = len(items)
	}

	type result struct {
		index   int
		item    models.MediaItem
		include bool
	}

	jobs := make(chan int, len(items))
	results := make(chan result, len(items))

	var wg sync.WaitGroup
	for w := 0; w < maxWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for idx := range jobs {
				item := items[idx]
				if item.TMDBTrailerURL != "" {
					results <- result{index: idx, item: item, include: true}
					continue
				}
				if item.TMDBID == 0 {
					results <- result{index: idx, include: false}
					continue
				}
				mediaType := "movie"
				if item.Type == "tv" || item.Type == "episode" || item.Type == "series" {
					mediaType = "tv"
				}
				enriched := s.enrichMediaItemWithTrailer(item, mediaType)
				results <- result{index: idx, item: enriched, include: enriched.TMDBTrailerURL != ""}
			}
		}()
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	for idx := range items {
		jobs <- idx
	}
	close(jobs)

	enriched := make([]models.MediaItem, len(items))
	include := make([]bool, len(items))
	for res := range results {
		if res.include {
			enriched[res.index] = res.item
			include[res.index] = true
		}
	}

	ordered := make([]models.MediaItem, 0, len(items))
	for i := range items {
		if include[i] {
			ordered = append(ordered, enriched[i])
		}
	}

	return ordered
}

// getTMDBData fetches data from TMDB API
func (s *WidgetService) getTMDBData(widget *models.Widget, config *models.WidgetConfig) ([]models.MediaItem, error) {
	if s.tmdbService == nil {
		fmt.Printf("⚠️ TMDB service not available for widget %s, falling back to local data\n", widget.Name)
		return s.getLocalMediaData(widget, config)
	}

	var mediaItems []models.MediaItem

	fmt.Printf("🎬 Fetching TMDB data for widget %s (data_source: %s, content_type: %s)\n",
		widget.Name, widget.DataSource, widget.ContentType)

	// For trailer widgets, we need to fetch data with video information
	isTrailerWidget := widget.Type == models.WidgetTypeTrailer

	switch widget.DataSource {
	case models.WidgetDataSourceTrending:
		// Get trending content based on content type
		if widget.ContentType == models.WidgetContentTypeTVShows {
			// Get trending TV shows
			if upcomingTVSeries, err := s.tmdbService.GetUpcomingTVSeries(); err == nil && upcomingTVSeries != nil {
				fmt.Printf("📈 Found %d trending TV shows from TMDB\n", len(upcomingTVSeries.AiringToday))
				// Use airing today as trending TV shows
				for i, tvShow := range upcomingTVSeries.AiringToday {
					if i >= widget.MaxItems {
						break
					}
					item := s.convertTMDBTVToMediaItem(tvShow)
					// For trailer widgets, try to fetch video data
					if isTrailerWidget {
						item = s.enrichMediaItemWithTrailer(item, "tv")
					}
					mediaItems = append(mediaItems, item)
				}
			} else {
				fmt.Printf("⚠️ Failed to get trending TV shows: %v\n", err)
			}
		} else if widget.ContentType == models.WidgetContentTypeMixed {
			// Get both trending movies and TV shows for mixed content
			halfItems := widget.MaxItems / 2

			// Get trending movies
			if upcomingMovies, err := s.tmdbService.GetUpcomingMovies(); err == nil && upcomingMovies != nil {
				fmt.Printf("📈 Found %d trending movies from TMDB\n", len(upcomingMovies.TrendingDaily))
				for i, movie := range upcomingMovies.TrendingDaily {
					if i >= halfItems {
						break
					}
					item := s.convertTMDBMovieToMediaItem(movie)
					// For trailer widgets, try to fetch video data
					if isTrailerWidget {
						item = s.enrichMediaItemWithTrailer(item, "movie")
					}
					mediaItems = append(mediaItems, item)
				}
			}

			// Get trending TV shows
			if upcomingTVSeries, err := s.tmdbService.GetUpcomingTVSeries(); err == nil && upcomingTVSeries != nil {
				fmt.Printf("📈 Found %d trending TV shows from TMDB\n", len(upcomingTVSeries.AiringToday))
				for i, tvShow := range upcomingTVSeries.AiringToday {
					if i >= halfItems {
						break
					}
					item := s.convertTMDBTVToMediaItem(tvShow)
					// For trailer widgets, try to fetch video data
					if isTrailerWidget {
						item = s.enrichMediaItemWithTrailer(item, "tv")
					}
					mediaItems = append(mediaItems, item)
				}
			}
		} else {
			// Get trending movies from TMDB (default for movies only)
			if upcomingMovies, err := s.tmdbService.GetUpcomingMovies(); err == nil && upcomingMovies != nil {
				fmt.Printf("📈 Found %d trending movies from TMDB\n", len(upcomingMovies.TrendingDaily))
				// Convert trending daily to MediaItem
				for i, movie := range upcomingMovies.TrendingDaily {
					if i >= widget.MaxItems {
						break
					}
					item := s.convertTMDBMovieToMediaItem(movie)
					// For trailer widgets, try to fetch video data
					if isTrailerWidget {
						item = s.enrichMediaItemWithTrailer(item, "movie")
					}
					mediaItems = append(mediaItems, item)
				}
			} else {
				fmt.Printf("⚠️ Failed to get trending movies: %v\n", err)
			}
		}
	case models.WidgetDataSourcePopular:
		// Get popular content based on content type
		if widget.ContentType == models.WidgetContentTypeTVShows {
			// Get on the air TV shows as popular TV content
			if upcomingTVSeries, err := s.tmdbService.GetUpcomingTVSeries(); err == nil && upcomingTVSeries != nil {
				fmt.Printf("🔥 Found %d popular TV shows from TMDB\n", len(upcomingTVSeries.OnTheAir))
				for i, tvShow := range upcomingTVSeries.OnTheAir {
					if i >= widget.MaxItems {
						break
					}
					item := s.convertTMDBTVToMediaItem(tvShow)
					// For trailer widgets, try to fetch video data
					if isTrailerWidget {
						item = s.enrichMediaItemWithTrailer(item, "tv")
					}
					mediaItems = append(mediaItems, item)
				}
			} else {
				fmt.Printf("⚠️ Failed to get popular TV shows: %v\n", err)
			}
		} else if widget.ContentType == models.WidgetContentTypeMixed {
			// Get both popular movies and TV shows for mixed content
			halfItems := widget.MaxItems / 2

			// Get popular movies
			if popularMovies, err := s.tmdbService.GetPopularMovies(1); err == nil {
				fmt.Printf("🔥 Found %d popular movies from TMDB\n", len(popularMovies))
				for i, movie := range popularMovies {
					if i >= halfItems {
						break
					}
					item := s.convertTMDBMovieToMediaItem(movie)
					// For trailer widgets, try to fetch video data
					if isTrailerWidget {
						item = s.enrichMediaItemWithTrailer(item, "movie")
					}
					mediaItems = append(mediaItems, item)
				}
			}

			// Get popular TV shows
			if upcomingTVSeries, err := s.tmdbService.GetUpcomingTVSeries(); err == nil && upcomingTVSeries != nil {
				fmt.Printf("🔥 Found %d popular TV shows from TMDB\n", len(upcomingTVSeries.OnTheAir))
				for i, tvShow := range upcomingTVSeries.OnTheAir {
					if i >= halfItems {
						break
					}
					item := s.convertTMDBTVToMediaItem(tvShow)
					// For trailer widgets, try to fetch video data
					if isTrailerWidget {
						item = s.enrichMediaItemWithTrailer(item, "tv")
					}
					mediaItems = append(mediaItems, item)
				}
			}
		} else {
			// Get popular movies from TMDB (default for movies only)
			if popularMovies, err := s.tmdbService.GetPopularMovies(1); err == nil {
				fmt.Printf("🔥 Found %d popular movies from TMDB\n", len(popularMovies))
				for i, movie := range popularMovies {
					if i >= widget.MaxItems {
						break
					}
					item := s.convertTMDBMovieToMediaItem(movie)
					// For trailer widgets, try to fetch video data
					if isTrailerWidget {
						item = s.enrichMediaItemWithTrailer(item, "movie")
					}
					mediaItems = append(mediaItems, item)
				}
			} else {
				fmt.Printf("⚠️ Failed to get popular movies: %v\n", err)
			}
		}
	case models.WidgetDataSourceNowPlaying:
		// Handle content type for now playing
		if widget.ContentType == models.WidgetContentTypeTVShows {
			// For TV shows, use "airing today" as equivalent to "now playing"
			if upcomingTVSeries, err := s.tmdbService.GetUpcomingTVSeries(); err == nil && upcomingTVSeries != nil {
				fmt.Printf("🎭 Found %d airing today TV shows from TMDB (as now playing equivalent)\n", len(upcomingTVSeries.AiringToday))
				for i, tvShow := range upcomingTVSeries.AiringToday {
					if i >= widget.MaxItems {
						break
					}
					item := s.convertTMDBTVToMediaItem(tvShow)
					// For trailer widgets, try to fetch video data
					if isTrailerWidget {
						item = s.enrichMediaItemWithTrailer(item, "tv")
					}
					mediaItems = append(mediaItems, item)
				}
			} else {
				fmt.Printf("⚠️ Failed to get airing today TV shows, falling back to local TV shows: %v\n", err)
				// Fall back to local TV show data
				return s.getLocalMediaData(widget, config)
			}
		} else if widget.ContentType == models.WidgetContentTypeMixed {
			// For mixed content, get both now playing movies and airing today TV shows
			halfItems := widget.MaxItems / 2

			// Get now playing movies
			if nowPlayingMovies, err := s.tmdbService.GetNowPlayingMovies(1); err == nil {
				fmt.Printf("🎭 Found %d now playing movies from TMDB\n", len(nowPlayingMovies))
				for i, movie := range nowPlayingMovies {
					if i >= halfItems {
						break
					}
					item := s.convertTMDBMovieWithVideosToMediaItem(movie)
					// For trailer widgets, try to fetch video data
					if isTrailerWidget {
						item = s.enrichMediaItemWithTrailer(item, "movie")
					}
					mediaItems = append(mediaItems, item)
				}
			}

			// Get airing today TV shows
			if upcomingTVSeries, err := s.tmdbService.GetUpcomingTVSeries(); err == nil && upcomingTVSeries != nil {
				fmt.Printf("🎭 Found %d airing today TV shows from TMDB\n", len(upcomingTVSeries.AiringToday))
				for i, tvShow := range upcomingTVSeries.AiringToday {
					if i >= halfItems {
						break
					}
					item := s.convertTMDBTVToMediaItem(tvShow)
					// For trailer widgets, try to fetch video data
					if isTrailerWidget {
						item = s.enrichMediaItemWithTrailer(item, "tv")
					}
					mediaItems = append(mediaItems, item)
				}
			}
		} else {
			// Get now playing movies from TMDB (default for movies only)
			if nowPlayingMovies, err := s.tmdbService.GetNowPlayingMovies(1); err == nil {
				fmt.Printf("🎭 Found %d now playing movies from TMDB\n", len(nowPlayingMovies))
				for i, movie := range nowPlayingMovies {
					if i >= widget.MaxItems {
						break
					}
					item := s.convertTMDBMovieWithVideosToMediaItem(movie)
					// For trailer widgets, try to fetch video data
					if isTrailerWidget {
						item = s.enrichMediaItemWithTrailer(item, "movie")
					}
					mediaItems = append(mediaItems, item)
				}
			} else {
				fmt.Printf("⚠️ Failed to get now playing movies: %v\n", err)
			}
		}
	case models.WidgetDataSourceUpcoming:
		// Get upcoming content based on content type
		if widget.ContentType == models.WidgetContentTypeTVShows {
			// Get airing today TV shows as upcoming TV content
			if upcomingTVSeries, err := s.tmdbService.GetUpcomingTVSeries(); err == nil && upcomingTVSeries != nil {
				fmt.Printf("🔮 Found %d upcoming TV shows from TMDB\n", len(upcomingTVSeries.AiringToday))
				for i, tvShow := range upcomingTVSeries.AiringToday {
					if i >= widget.MaxItems {
						break
					}
					item := s.convertTMDBTVToMediaItem(tvShow)
					// For trailer widgets, try to fetch video data
					if isTrailerWidget {
						item = s.enrichMediaItemWithTrailer(item, "tv")
					}
					mediaItems = append(mediaItems, item)
				}
			} else {
				fmt.Printf("⚠️ Failed to get upcoming TV shows: %v\n", err)
			}
		} else if widget.ContentType == models.WidgetContentTypeMixed {
			// Get both upcoming movies and TV shows for mixed content
			halfItems := widget.MaxItems / 2

			// Get upcoming movies
			if upcomingMovies, err := s.tmdbService.GetUpcomingMoviesList(1); err == nil {
				fmt.Printf("🔮 Found %d upcoming movies from TMDB\n", len(upcomingMovies))
				for i, movie := range upcomingMovies {
					if i >= halfItems {
						break
					}
					item := s.convertTMDBMovieWithVideosToMediaItem(movie)
					// For trailer widgets, try to fetch video data
					if isTrailerWidget {
						item = s.enrichMediaItemWithTrailer(item, "movie")
					}
					mediaItems = append(mediaItems, item)
				}
			}

			// Get upcoming TV shows
			if upcomingTVSeries, err := s.tmdbService.GetUpcomingTVSeries(); err == nil && upcomingTVSeries != nil {
				fmt.Printf("🔮 Found %d upcoming TV shows from TMDB\n", len(upcomingTVSeries.AiringToday))
				for i, tvShow := range upcomingTVSeries.AiringToday {
					if i >= halfItems {
						break
					}
					item := s.convertTMDBTVToMediaItem(tvShow)
					// For trailer widgets, try to fetch video data
					if isTrailerWidget {
						item = s.enrichMediaItemWithTrailer(item, "tv")
					}
					mediaItems = append(mediaItems, item)
				}
			}
		} else {
			// Get upcoming movies from TMDB (default for movies only)
			if upcomingMovies, err := s.tmdbService.GetUpcomingMoviesList(1); err == nil {
				fmt.Printf("🔮 Found %d upcoming movies from TMDB\n", len(upcomingMovies))
				for i, movie := range upcomingMovies {
					if i >= widget.MaxItems {
						break
					}
					item := s.convertTMDBMovieWithVideosToMediaItem(movie)
					// For trailer widgets, try to fetch video data
					if isTrailerWidget {
						item = s.enrichMediaItemWithTrailer(item, "movie")
					}
					mediaItems = append(mediaItems, item)
				}
			} else {
				fmt.Printf("⚠️ Failed to get upcoming movies: %v\n", err)
			}
		}
	default:
		// For other TMDB sources, fall back to popular movies/TV shows
		fmt.Printf("🔄 Using default TMDB data source (popular) for widget %s\n", widget.Name)
		if widget.ContentType == models.WidgetContentTypeTVShows {
			// Get on the air TV shows as default TV content
			if upcomingTVSeries, err := s.tmdbService.GetUpcomingTVSeries(); err == nil && upcomingTVSeries != nil {
				fmt.Printf("🔥 Found %d default TV shows from TMDB\n", len(upcomingTVSeries.OnTheAir))
				for i, tvShow := range upcomingTVSeries.OnTheAir {
					if i >= widget.MaxItems {
						break
					}
					item := s.convertTMDBTVToMediaItem(tvShow)
					// For trailer widgets, try to fetch video data
					if isTrailerWidget {
						item = s.enrichMediaItemWithTrailer(item, "tv")
					}
					mediaItems = append(mediaItems, item)
				}
			}
		} else if widget.ContentType == models.WidgetContentTypeMixed {
			// Get both popular movies and TV shows for mixed content
			halfItems := widget.MaxItems / 2

			// Get popular movies
			if popularMovies, err := s.tmdbService.GetPopularMovies(1); err == nil {
				fmt.Printf("🔥 Found %d default movies from TMDB\n", len(popularMovies))
				for i, movie := range popularMovies {
					if i >= halfItems {
						break
					}
					item := s.convertTMDBMovieToMediaItem(movie)
					// For trailer widgets, try to fetch video data
					if isTrailerWidget {
						item = s.enrichMediaItemWithTrailer(item, "movie")
					}
					mediaItems = append(mediaItems, item)
				}
			}

			// Get popular TV shows
			if upcomingTVSeries, err := s.tmdbService.GetUpcomingTVSeries(); err == nil && upcomingTVSeries != nil {
				fmt.Printf("🔥 Found %d default TV shows from TMDB\n", len(upcomingTVSeries.OnTheAir))
				for i, tvShow := range upcomingTVSeries.OnTheAir {
					if i >= halfItems {
						break
					}
					item := s.convertTMDBTVToMediaItem(tvShow)
					// For trailer widgets, try to fetch video data
					if isTrailerWidget {
						item = s.enrichMediaItemWithTrailer(item, "tv")
					}
					mediaItems = append(mediaItems, item)
				}
			}
		} else {
			// Get popular movies from TMDB (default for movies only)
			if popularMovies, err := s.tmdbService.GetPopularMovies(1); err == nil {
				fmt.Printf("🔥 Found %d default movies from TMDB\n", len(popularMovies))
				for i, movie := range popularMovies {
					if i >= widget.MaxItems {
						break
					}
					item := s.convertTMDBMovieToMediaItem(movie)
					// For trailer widgets, try to fetch video data
					if isTrailerWidget {
						item = s.enrichMediaItemWithTrailer(item, "movie")
					}
					mediaItems = append(mediaItems, item)
				}
			}
		}
	}

	// If no TMDB data found, fall back to local data
	if len(mediaItems) == 0 {
		fmt.Printf("⚠️ No TMDB data found for widget %s, falling back to local data\n", widget.Name)
		return s.getLocalMediaData(widget, config)
	}

	fmt.Printf("✅ Widget %s: Found %d TMDB items (data_source: %s)\n",
		widget.Name, len(mediaItems), widget.DataSource)

	return mediaItems, nil
}

// convertTMDBMovieToMediaItem converts a TMDB movie to MediaItem
func (s *WidgetService) convertTMDBMovieToMediaItem(movie TMDBMovie) models.MediaItem {
	item := models.MediaItem{
		ID:               uint(movie.ID), // Use TMDB ID as the main ID for frontend
		TMDBID:           movie.ID,
		Title:            movie.Title,
		OriginalTitle:    movie.OriginalTitle,
		Description:      movie.Overview,
		Type:             "movie",
		Rating:           movie.VoteAverage,
		Popularity:       movie.Popularity,
		VoteCount:        movie.VoteCount,
		Adult:            movie.Adult,
		OriginalLanguage: movie.OriginalLanguage,
		Video:            movie.Video,
		ReleaseDate:      movie.ReleaseDate,
		TMDBPosterURL:    s.buildTMDBImageURL(movie.PosterPath, "w500"),
		TMDBBackdropURL:  s.buildTMDBImageURL(movie.BackdropPath, "original"),
		PosterPath:       movie.PosterPath,
		BackdropPath:     movie.BackdropPath,
	}

	// Extract year from release date
	if movie.ReleaseDate != "" && len(movie.ReleaseDate) >= 4 {
		if year, err := strconv.Atoi(movie.ReleaseDate[:4]); err == nil {
			item.Year = year
		}
	}

	return item
}

// convertTMDBMovieWithVideosToMediaItem converts a TMDB movie with videos to MediaItem
func (s *WidgetService) convertTMDBMovieWithVideosToMediaItem(movie TMDBMovieWithVideos) models.MediaItem {
	item := s.convertTMDBMovieToMediaItem(movie.TMDBMovie)

	// Extract trailer URL from videos
	for _, video := range movie.Videos.Results {
		if video.Site == "YouTube" && video.Type == "Trailer" && video.Key != "" {
			// Build full YouTube URL and store in TMDBTrailerURL field
			item.TMDBTrailerURL = fmt.Sprintf("https://www.youtube.com/watch?v=%s", video.Key)
			break
		}
	}

	return item
}

// convertTMDBTVToMediaItem converts a TMDB TV show to MediaItem
func (s *WidgetService) convertTMDBTVToMediaItem(tvShow TMDBTV) models.MediaItem {
	item := models.MediaItem{
		ID:               uint(tvShow.ID), // Use TMDB ID as the main ID for frontend
		TMDBID:           tvShow.ID,
		Title:            tvShow.Name,
		OriginalTitle:    tvShow.OriginalName,
		Description:      tvShow.Overview,
		Type:             "tv",
		Rating:           tvShow.VoteAverage,
		Popularity:       tvShow.Popularity,
		VoteCount:        tvShow.VoteCount,
		Adult:            tvShow.Adult,
		OriginalLanguage: tvShow.OriginalLanguage,
		FirstAirDate:     tvShow.FirstAirDate,
		TMDBPosterURL:    s.buildTMDBImageURL(tvShow.PosterPath, "w500"),
		TMDBBackdropURL:  s.buildTMDBImageURL(tvShow.BackdropPath, "original"),
		PosterPath:       tvShow.PosterPath,
		BackdropPath:     tvShow.BackdropPath,
	}

	// Extract year from first air date
	if tvShow.FirstAirDate != "" && len(tvShow.FirstAirDate) >= 4 {
		if year, err := strconv.Atoi(tvShow.FirstAirDate[:4]); err == nil {
			item.Year = year
		}
	}

	return item
}

// buildTMDBImageURL builds a full TMDB image URL
func (s *WidgetService) buildTMDBImageURL(path, size string) string {
	if path == "" {
		return ""
	}
	return fmt.Sprintf("https://image.tmdb.org/t/p/%s%s", size, path)
}

func cloneWidgetsWithData(src []models.WidgetWithData) []models.WidgetWithData {
	if len(src) == 0 {
		return []models.WidgetWithData{}
	}
	dst := make([]models.WidgetWithData, len(src))
	for i, item := range src {
		dst[i].Widget = item.Widget
		if len(item.Data) > 0 {
			dst[i].Data = make([]models.MediaItem, len(item.Data))
			copy(dst[i].Data, item.Data)
		}
	}
	return dst
}

func (s *WidgetService) convertMediaToWidgetItem(media models.Media, preferSeries bool) models.MediaItem {
	item := models.MediaItem{
		ID:              media.ID,
		Title:           media.Title,
		Description:     media.Description,
		Type:            media.Type,
		Rating:          media.Rating,
		Year:            media.Year,
		Duration:        media.Duration,
		ThumbnailPath:   media.ThumbnailPath,
		PosterPath:      media.PosterPath,
		BackdropPath:    media.BackdropPath,
		LogoPath:        media.LogoPath,
		TMDBBackdropURL: media.TMDBBackdropURL,
		TMDBTrailerURL:  media.TMDBTrailerURL,
		TMDBID:          media.TMDBID,
		ViewCount:       media.ViewCount,
		LastViewed:      media.LastViewed,
	}

	if media.SeriesID != nil {
		item.SeriesID = *media.SeriesID
	}

	for _, genre := range media.Genres {
		item.GenreNames = append(item.GenreNames, genre.Name)
	}

	if preferSeries && media.Series != nil {
		series := media.Series
		item.ID = series.ID
		item.Title = series.Title
		if series.Description != "" {
			item.Description = series.Description
		}
		item.Type = "tv"
		item.Year = series.Year
		item.Rating = float64(series.Rating)
		item.SeriesID = series.ID

		if series.PosterPath != "" {
			item.PosterPath = series.PosterPath
			item.ThumbnailPath = series.PosterPath
		}
		if series.BackdropPath != "" {
			item.BackdropPath = series.BackdropPath
		}
		if series.LogoPath != "" {
			item.LogoPath = series.LogoPath
		}

		if series.TMDBPosterURL != "" {
			item.TMDBPosterURL = series.TMDBPosterURL
		}
		if series.TMDBBackdropURL != "" {
			item.TMDBBackdropURL = series.TMDBBackdropURL
		}
		if series.TMDBTrailerURL != "" {
			item.TMDBTrailerURL = series.TMDBTrailerURL
		}
		if series.TMDBID != 0 {
			item.TMDBID = series.TMDBID
		}

		if len(series.GenreNames) > 0 {
			item.GenreNames = append([]string{}, series.GenreNames...)
		} else if len(series.Genres) > 0 {
			item.GenreNames = item.GenreNames[:0]
			for _, genre := range series.Genres {
				item.GenreNames = append(item.GenreNames, genre.Name)
			}
		}
	}

	if item.Type == "episode" {
		item.Type = "tv"
	}

	return item
}

func dedupeSeriesItems(items []models.MediaItem) []models.MediaItem {
	if len(items) == 0 {
		return items
	}

	seen := make(map[string]bool)
	var deduped []models.MediaItem

	for _, item := range items {
		var key string
		if item.SeriesID != 0 {
			key = fmt.Sprintf("series:%d", item.SeriesID)
		} else if item.TMDBID != 0 {
			key = fmt.Sprintf("tmdb:%d", item.TMDBID)
		} else if item.Title != "" {
			key = fmt.Sprintf("title:%s", strings.ToLower(item.Title))
		} else {
			key = fmt.Sprintf("id:%d", item.ID)
		}

		if seen[key] {
			continue
		}
		seen[key] = true
		deduped = append(deduped, item)
	}

	return deduped
}

// enrichMediaItemWithTrailer fetches video data for a media item and adds trailer URL
func (s *WidgetService) enrichMediaItemWithTrailer(item models.MediaItem, mediaType string) models.MediaItem {
	if s.tmdbService == nil || item.TMDBID == 0 {
		return item
	}

	if item.TMDBTrailerURL != "" {
		return item
	}

	cacheKey := fmt.Sprintf("%s:%d", mediaType, item.TMDBID)
	if cached, ok := s.trailerCache.Load(cacheKey); ok {
		entry := cached.(trailerCacheEntry)
		if time.Since(entry.fetchedAt) < trailerCacheTTL {
			if entry.url != "" {
				item.TMDBTrailerURL = entry.url
			}
			return item
		}
		s.trailerCache.Delete(cacheKey)
	}

	// Try to get video data from TMDB
	var trailerURL string

	if mediaType == "movie" {
		if movieDetails, err := s.tmdbService.GetMovieDetailsWithExtras(item.TMDBID); err == nil {
			// Look for YouTube trailers (prioritize official trailers)
			for _, video := range movieDetails.Videos.Results {
				if video.Site == "YouTube" && video.Type == "Trailer" && video.Key != "" {
					// Prefer official trailers
					if video.Official {
						trailerURL = fmt.Sprintf("https://www.youtube.com/watch?v=%s", video.Key)
						break
					} else if trailerURL == "" {
						// Use non-official as fallback
						trailerURL = fmt.Sprintf("https://www.youtube.com/watch?v=%s", video.Key)
					}
				}
			}
			// If no trailer found, try teasers
			if trailerURL == "" {
				for _, video := range movieDetails.Videos.Results {
					if video.Site == "YouTube" && video.Type == "Teaser" && video.Key != "" {
						trailerURL = fmt.Sprintf("https://www.youtube.com/watch?v=%s", video.Key)
						break
					}
				}
			}
		} else {
			fmt.Printf("⚠️ Failed to get movie details for TMDB ID %d: %v\n", item.TMDBID, err)
		}
	} else if mediaType == "tv" {
		if tvDetails, err := s.tmdbService.GetTVDetails(item.TMDBID); err == nil {
			// Look for YouTube trailers (prioritize official trailers)
			for _, video := range tvDetails.Videos.Results {
				if video.Site == "YouTube" && video.Type == "Trailer" && video.Key != "" {
					// Prefer official trailers
					if video.Official {
						trailerURL = fmt.Sprintf("https://www.youtube.com/watch?v=%s", video.Key)
						break
					} else if trailerURL == "" {
						// Use non-official as fallback
						trailerURL = fmt.Sprintf("https://www.youtube.com/watch?v=%s", video.Key)
					}
				}
			}
			// If no trailer found, try teasers
			if trailerURL == "" {
				for _, video := range tvDetails.Videos.Results {
					if video.Site == "YouTube" && video.Type == "Teaser" && video.Key != "" {
						trailerURL = fmt.Sprintf("https://www.youtube.com/watch?v=%s", video.Key)
						break
					}
				}
			}
		} else {
			fmt.Printf("⚠️ Failed to get TV details for TMDB ID %d: %v\n", item.TMDBID, err)
		}
	}

	if trailerURL != "" {
		item.TMDBTrailerURL = trailerURL
		fmt.Printf("🎬 Found trailer for %s (ID: %d): %s\n", item.Title, item.TMDBID, trailerURL)
	} else {
		fmt.Printf("⚠️ No trailer found for %s (ID: %d)\n", item.Title, item.TMDBID)
	}

	s.trailerCache.Store(cacheKey, trailerCacheEntry{url: trailerURL, fetchedAt: time.Now()})

	return item
}
