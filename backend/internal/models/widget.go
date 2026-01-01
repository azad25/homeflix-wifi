package models

import (
	"time"

	"gorm.io/gorm"
)

// Widget represents a configurable UI widget that can be placed on pages
type Widget struct {
	ID        uint           `json:"id" gorm:"primarykey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	Name        string `json:"name" gorm:"not null"`                                       // Display name of the widget
	Type        string `json:"type" gorm:"not null"`                                       // Widget type: featured-banner, slideshow, grid, etc.
	Page        string `json:"page" gorm:"not null;index"`                                 // Target page: home, movies, tv-shows, browse, new-popular
	Position    int    `json:"position" gorm:"default:0"`                                  // Order position on the page
	Enabled     bool   `json:"enabled" gorm:"default:true"`                                // Whether widget is visible
	Config      string `json:"config" gorm:"type:text"`                                    // JSON configuration for widget-specific options
	ContentType string `json:"content_type" gorm:"default:'mixed'"`                        // Content filter: movies, tv-shows, mixed, tmdb
	DataSource  string `json:"data_source" gorm:"default:'local'"`                         // Data source: local, tmdb, trending, popular, recent
	MaxItems    int    `json:"max_items" gorm:"default:10"`                                // Maximum items to display
	Layout      string `json:"layout" gorm:"default:'full'"`                               // Layout: full, half, third
	ColorScheme string `json:"color_scheme" gorm:"default:'auto'"`                         // Color scheme: auto (from logo), dark, light, custom
}

// MediaItem represents a media item for widget data
type MediaItem struct {
	ID                uint     `json:"id"`
	Title             string   `json:"title"`
	Description       string   `json:"description,omitempty"`
	Type              string   `json:"type"` // movie, tv, episode, series
	Rating            float64  `json:"rating,omitempty"`
	Year              int      `json:"year,omitempty"`
	Duration          int      `json:"duration,omitempty"` // in seconds
	GenreNames        []string `json:"genre_names,omitempty"`
	ThumbnailPath     string   `json:"thumbnail_path,omitempty"`
	PosterPath        string   `json:"poster_path,omitempty"`
	BackdropPath      string   `json:"backdrop_path,omitempty"`
	LogoPath          string   `json:"logo_path,omitempty"`
	TMDBPosterURL     string   `json:"tmdb_poster_url,omitempty"`
	TMDBBackdropURL   string   `json:"tmdb_backdrop_url,omitempty"`
	TMDBTrailerURL    string   `json:"tmdb_trailer_url,omitempty"`
	TMDBID            int      `json:"tmdb_id,omitempty"`
	Popularity        float64  `json:"popularity,omitempty"`
	VoteCount         int      `json:"vote_count,omitempty"`
	Adult             bool     `json:"adult,omitempty"`
	OriginalLanguage  string   `json:"original_language,omitempty"`
	OriginalTitle     string   `json:"original_title,omitempty"`
	Video             bool     `json:"video,omitempty"`
	ViewCount         int      `json:"view_count,omitempty"`
	SeriesID          uint     `json:"series_id,omitempty"`
	ReleaseDate       string   `json:"release_date,omitempty"`
	FirstAirDate      string   `json:"first_air_date,omitempty"`
	Runtime           int      `json:"runtime,omitempty"` // in minutes
	Certification     string   `json:"certification,omitempty"`
	Tagline           string   `json:"tagline,omitempty"`
	Genres            []Genre  `json:"genres,omitempty"`
	// Notification data for notification widgets
	NotificationData  interface{} `json:"notification_data,omitempty"`
}

// WidgetWithData represents a widget with its populated data
type WidgetWithData struct {
	Widget `json:",inline"`
	Data   []MediaItem `json:"data"`
}

// WidgetConfig represents the JSON configuration for a widget
type WidgetConfig struct {
	Title           string                 `json:"title,omitempty"`
	Subtitle        string                 `json:"subtitle,omitempty"`
	ShowLogo        bool                   `json:"show_logo,omitempty"`
	ShowDescription bool                   `json:"show_description,omitempty"`
	ShowRating      bool                   `json:"show_rating,omitempty"`
	ShowYear        bool                   `json:"show_year,omitempty"`
	ShowGenres      bool                   `json:"show_genres,omitempty"`
	AutoPlay        bool                   `json:"auto_play,omitempty"`
	AutoScroll      bool                   `json:"auto_scroll,omitempty"`
	ScrollInterval  int                    `json:"scroll_interval,omitempty"` // in seconds
	GenreFilter     []string               `json:"genre_filter,omitempty"`
	YearFilter      int                    `json:"year_filter,omitempty"`
	RatingFilter    float64                `json:"rating_filter,omitempty"`
	CustomGradient  string                 `json:"custom_gradient,omitempty"`
	AnimationStyle  string                 `json:"animation_style,omitempty"` // fade, slide, parallax
	SelectedContent []interface{}          `json:"selectedContent,omitempty"` // TMDB search results
	SelectedGenres  []int                  `json:"selectedGenres,omitempty"`  // Genre IDs
	// Hero banner specific
	HeroHeight      string                 `json:"hero_height,omitempty"`     // small, medium, large, full
	ParallaxEffect  bool                   `json:"parallax_effect,omitempty"`
	VideoBackground bool                   `json:"video_background,omitempty"`
	ShowPoster      bool                   `json:"show_poster,omitempty"`
	EnhancedEffects bool                   `json:"enhanced_effects,omitempty"`
	// Notification widget specific
	NotificationTypes []string             `json:"notification_types,omitempty"` // Filter by notification types
	ShowTimestamp     bool                 `json:"show_timestamp,omitempty"`
	ShowNotificationIcon bool              `json:"show_notification_icon,omitempty"`
	HighlightStyle    string               `json:"highlight_style,omitempty"` // banner, card, minimal
}

// Widget types
const (
	WidgetTypeFeaturedBanner     = "featured-banner"
	WidgetTypeHeroBanner         = "hero-banner"
	WidgetTypeHalfBanner         = "half-banner"
	WidgetTypeBackdropSlideshow  = "backdrop-slideshow"
	WidgetTypeTrendingSlideshow  = "trending-slideshow"
	WidgetTypeMovieGrid          = "movie-grid"
	WidgetTypeHomeflixGrid       = "homeflix-grid"
	WidgetTypeGenreBased         = "genre-based"
	WidgetTypeComingSoon         = "coming-soon"
	WidgetTypeNewReleases        = "new-releases"
	WidgetTypePopular            = "popular"
	WidgetTypeRecentlyAdded      = "recently-added"
	WidgetTypeRecentlyWatched    = "recently-watched"
	WidgetTypeContinueWatching   = "continue-watching"
	WidgetTypeTrailer            = "trailer"
	WidgetTypeSpecificContent    = "specific-content"
	WidgetTypeNotifications      = "notifications"
)

// Widget pages
const (
	WidgetPageHome       = "home"
	WidgetPageMovies     = "movies"
	WidgetPageTVShows    = "tv-shows"
	WidgetPageBrowse     = "browse"
	WidgetPageNewPopular = "new-popular"
	WidgetPageMyList     = "my-list"
)

// Widget layouts
const (
	WidgetLayoutFull  = "full"
	WidgetLayoutHalf  = "half"
	WidgetLayoutThird = "third"
)

// Widget data sources
const (
	WidgetDataSourceLocal      = "local"
	WidgetDataSourceTMDB       = "tmdb"
	WidgetDataSourceTrending   = "trending"
	WidgetDataSourcePopular    = "popular"
	WidgetDataSourceRecent     = "recent"
	WidgetDataSourceNowPlaying = "now-playing"
	WidgetDataSourceUpcoming   = "upcoming"
	WidgetDataSourceTopRated   = "top-rated"
)

// Widget content types
const (
	WidgetContentTypeMixed   = "mixed"
	WidgetContentTypeMovies  = "movies"
	WidgetContentTypeTVShows = "tv-shows"
	WidgetContentTypeTMDB    = "tmdb"
)

// Widget color schemes
const (
	WidgetColorSchemeAuto   = "auto"
	WidgetColorSchemeDark   = "dark"
	WidgetColorSchemeLight  = "light"
	WidgetColorSchemeCustom = "custom"
)

// MigrateWidgetTables creates the widget tables
func MigrateWidgetTables(db *gorm.DB) error {
	return db.AutoMigrate(&Widget{})
}

// SeedDefaultWidgets creates default widget configurations
func SeedDefaultWidgets(db *gorm.DB) error {
	// Check if widgets already exist
	var count int64
	db.Model(&Widget{}).Count(&count)
	if count > 0 {
		return nil
	}

	defaultWidgets := []Widget{
		// Home page widgets
		{
			Name:        "Featured Movies",
			Type:        WidgetTypeFeaturedBanner,
			Page:        WidgetPageHome,
			Position:    1,
			Enabled:     true,
			ContentType: "movies",
			DataSource:  "trending",
			MaxItems:    5,
			Layout:      WidgetLayoutFull,
			Config:      `{"show_logo":true,"show_description":true,"show_rating":true,"auto_scroll":true,"scroll_interval":8}`,
		},
		{
			Name:        "Coming Soon",
			Type:        WidgetTypeComingSoon,
			Page:        WidgetPageHome,
			Position:    2,
			Enabled:     true,
			ContentType: "tmdb",
			DataSource:  "tmdb",
			MaxItems:    10,
			Layout:      WidgetLayoutHalf,
			Config:      `{"show_logo":true,"show_description":true}`,
		},
		{
			Name:        "Latest Trailers",
			Type:        WidgetTypeTrailer,
			Page:        WidgetPageHome,
			Position:    3,
			Enabled:     true,
			ContentType: "mixed",
			DataSource:  "tmdb",
			MaxItems:    6,
			Layout:      WidgetLayoutHalf,
			Config:      `{"show_description":true,"auto_play":false}`,
		},
		{
			Name:        "Trending Now",
			Type:        WidgetTypeTrendingSlideshow,
			Page:        WidgetPageHome,
			Position:    4,
			Enabled:     true,
			ContentType: "mixed",
			DataSource:  "trending",
			MaxItems:    15,
			Layout:      WidgetLayoutFull,
			Config:      `{"show_logo":true,"auto_scroll":true}`,
		},
		// Movies page widgets
		{
			Name:        "Popular Movies",
			Type:        WidgetTypeFeaturedBanner,
			Page:        WidgetPageMovies,
			Position:    1,
			Enabled:     true,
			ContentType: "movies",
			DataSource:  "popular",
			MaxItems:    8,
			Layout:      WidgetLayoutFull,
			Config:      `{"show_logo":true,"show_description":true,"show_rating":true}`,
		},
		{
			Name:        "Action Movies Grid",
			Type:        "homeflix-grid",
			Page:        WidgetPageMovies,
			Position:    2,
			Enabled:     true,
			ContentType: "movies",
			DataSource:  "local",
			MaxItems:    20,
			Layout:      WidgetLayoutFull,
			Config:      `{"genre_filter":["Action"],"show_rating":true,"show_year":true,"auto_scroll":true}`,
		},
		{
			Name:        "Action Movies",
			Type:        WidgetTypeGenreBased,
			Page:        WidgetPageMovies,
			Position:    3,
			Enabled:     true,
			ContentType: "movies",
			DataSource:  "local",
			MaxItems:    20,
			Layout:      WidgetLayoutFull,
			Config:      `{"genre_filter":["Action"],"show_rating":true}`,
		},
		{
			Name:        "Comedy Movies",
			Type:        WidgetTypeGenreBased,
			Page:        WidgetPageMovies,
			Position:    4,
			Enabled:     true,
			ContentType: "movies",
			DataSource:  "local",
			MaxItems:    15,
			Layout:      WidgetLayoutThird,
			Config:      `{"genre_filter":["Comedy"],"show_rating":true}`,
		},
		{
			Name:        "Drama Movies",
			Type:        WidgetTypeGenreBased,
			Page:        WidgetPageMovies,
			Position:    5,
			Enabled:     true,
			ContentType: "movies",
			DataSource:  "local",
			MaxItems:    15,
			Layout:      WidgetLayoutThird,
			Config:      `{"genre_filter":["Drama"],"show_rating":true}`,
		},
		{
			Name:        "Sci-Fi Movies",
			Type:        WidgetTypeGenreBased,
			Page:        WidgetPageMovies,
			Position:    6,
			Enabled:     true,
			ContentType: "movies",
			DataSource:  "local",
			MaxItems:    15,
			Layout:      WidgetLayoutThird,
			Config:      `{"genre_filter":["Science Fiction","Sci-Fi"],"show_rating":true}`,
		},
		// TV Shows page widgets
		{
			Name:        "Popular TV Shows",
			Type:        WidgetTypeFeaturedBanner,
			Page:        WidgetPageTVShows,
			Position:    1,
			Enabled:     true,
			ContentType: "tv-shows",
			DataSource:  "popular",
			MaxItems:    8,
			Layout:      WidgetLayoutFull,
			Config:      `{"show_logo":true,"show_description":true,"show_rating":true}`,
		},
		{
			Name:        "Trending TV Shows",
			Type:        WidgetTypeTrendingSlideshow,
			Page:        WidgetPageTVShows,
			Position:    2,
			Enabled:     true,
			ContentType: "tv-shows",
			DataSource:  "trending",
			MaxItems:    20,
			Layout:      WidgetLayoutFull,
			Config:      `{"show_rating":true,"auto_scroll":true}`,
		},
		// My List page widgets
		{
			Name:        "Featured Notifications",
			Type:        WidgetTypeNotifications,
			Page:        WidgetPageMyList,
			Position:    1,
			Enabled:     true,
			ContentType: "mixed",
			DataSource:  "local",
			MaxItems:    3,
			Layout:      WidgetLayoutFull,
			Config:      `{"show_logo":true,"show_description":true,"show_timestamp":true,"show_notification_icon":true,"highlight_style":"banner","auto_scroll":true,"scroll_interval":10}`,
		},
		{
			Name:        "Recent Notifications",
			Type:        WidgetTypeNotifications,
			Page:        WidgetPageMyList,
			Position:    2,
			Enabled:     true,
			ContentType: "mixed",
			DataSource:  "local",
			MaxItems:    5,
			Layout:      WidgetLayoutHalf,
			Config:      `{"show_timestamp":true,"show_notification_icon":true,"highlight_style":"card","notification_types":["movie_suggestion","watch_again","tmdb_upcoming"]}`,
		},
	}

	for _, widget := range defaultWidgets {
		if err := db.Create(&widget).Error; err != nil {
			return err
		}
	}

	return nil
}
