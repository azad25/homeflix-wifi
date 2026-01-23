package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"gorm.io/gorm"
)

// NotificationType represents the type of notification
type NotificationType string

const (
	NotificationTypeNewMovies        NotificationType = "new_movies"
	NotificationTypeNewEpisodes      NotificationType = "new_episodes"
	NotificationTypeMovieSuggestion  NotificationType = "movie_suggestion"
	NotificationTypeSingleMovie      NotificationType = "single_movie_suggestion"
	NotificationTypeWatchAgain       NotificationType = "watch_again"
	NotificationTypeDownload         NotificationType = "download_complete"
	NotificationTypeTMDBUpcoming     NotificationType = "tmdb_upcoming"
	NotificationTypeTMDBNowPlaying   NotificationType = "tmdb_now_playing"
	NotificationTypeTMDBTrending     NotificationType = "tmdb_trending"
	NotificationTypeTMDBUpcomingTV   NotificationType = "tmdb_upcoming_tv"
	NotificationTypeTMDBNowAiringTV  NotificationType = "tmdb_now_airing_tv"
	NotificationTypeContinueWatching NotificationType = "continue_watching"
	NotificationTypeRecentlyAdded    NotificationType = "recently_added"
	NotificationTypeComingSoon       NotificationType = "coming_soon"
	NotificationTypeGenreBased       NotificationType = "genre_based"
	NotificationTypeTMDBComingSoon   NotificationType = "tmdb_coming_soon"
	NotificationTypeLocalTrending    NotificationType = "local_trending"
)

// Notification represents a notification message with enhanced data
type Notification struct {
	ID         string           `json:"id"`
	Type       NotificationType `json:"type"`
	Title      string           `json:"title"`
	Message    string           `json:"message"`
	MovieIDs   []uint           `json:"movie_ids,omitempty"`
	SeriesID   uint             `json:"series_id,omitempty"`
	SeriesName string           `json:"series_name,omitempty"`
	EpisodeIDs []uint           `json:"episode_ids,omitempty"`
	TMDBIDs    []int            `json:"tmdb_ids,omitempty"`
	TMDBTitles []string         `json:"tmdb_titles,omitempty"`
	Timestamp  int64            `json:"timestamp"`
	Read       bool             `json:"read"`
	
	// Enhanced data fields - populated by backend
	BackdropURL    string              `json:"backdrop_url,omitempty"`
	PosterURL      string              `json:"poster_url,omitempty"`
	LogoURL        string              `json:"logo_url,omitempty"`
	TrailerKey     string              `json:"trailer_key,omitempty"`
	Rating         float64             `json:"rating,omitempty"`
	ReleaseDate    string              `json:"release_date,omitempty"`
	Runtime        int                 `json:"runtime,omitempty"`
	Genres         []string            `json:"genres,omitempty"`
	Overview       string              `json:"overview,omitempty"`
	Tagline        string              `json:"tagline,omitempty"`
	Language       string              `json:"language,omitempty"`
	Popularity     float64             `json:"popularity,omitempty"`
	Companies      []string            `json:"companies,omitempty"`
	Priority       string              `json:"priority,omitempty"`
	Category       string              `json:"category,omitempty"`
	MediaDetails   []NotificationMedia `json:"media_details,omitempty"`
	
	// Continue watching specific fields
	Progress       float64 `json:"progress,omitempty"`
	RemainingMin   int     `json:"remaining_min,omitempty"`
	DaysUntil      int     `json:"days_until,omitempty"` // For coming soon
	GenreHighlight string  `json:"genre_highlight,omitempty"`
}

// NotificationMedia represents individual media items in notifications
type NotificationMedia struct {
	ID          int      `json:"id"`
	Title       string   `json:"title"`
	PosterURL   string   `json:"poster_url"`
	BackdropURL string   `json:"backdrop_url"`
	Rating      float64  `json:"rating"`
	Year        int      `json:"year"`
	Runtime     int      `json:"runtime"`
	Genres      []string `json:"genres"`
	Overview    string   `json:"overview"`
	SourceType  string   `json:"source_type"` // "local" or "tmdb"
	SourceID    string   `json:"source_id"`
}

// NotificationService handles notification generation and management
type NotificationService struct {
	client           *redis.Client
	ctx              context.Context
	db               *gorm.DB
	tmdbService      *TMDBService
	keyPrefix        string
	ttl              time.Duration
	maxNotifications int
	stopChan         chan bool
	failedPosters    map[string]bool // Track failed poster URLs
	usedContent      map[string]time.Time // Track used content to prevent duplicates
	contentMutex     sync.RWMutex // Protect usedContent map
}

// NewNotificationService creates a new notification service
func NewNotificationService(redisURL string, db *gorm.DB, tmdbService *TMDBService) (*NotificationService, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URL: %w", err)
	}

	client := redis.NewClient(opts)
	ctx := context.Background()

	// Test connection
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Printf("✅ Notification Service connected to Redis successfully")

	service := &NotificationService{
		client:           client,
		ctx:              ctx,
		db:               db,
		tmdbService:      tmdbService,
		keyPrefix:        "homeflix:notifications:",
		ttl:              7 * 24 * time.Hour, // 1 week TTL
		maxNotifications: 100,                // Maximum notifications to keep (increased for variety)
		stopChan:         make(chan bool),
		failedPosters:    make(map[string]bool),
		usedContent:      make(map[string]time.Time),
		contentMutex:     sync.RWMutex{},
	}

	return service, nil
}

// generateContentKey creates a unique key for tracking content usage
func (ns *NotificationService) generateContentKey(notification Notification) []string {
	var keys []string
	
	// For local content (movies/series)
	for _, movieID := range notification.MovieIDs {
		keys = append(keys, fmt.Sprintf("local_%d", movieID))
	}
	
	// For TMDB content
	for _, tmdbID := range notification.TMDBIDs {
		keys = append(keys, fmt.Sprintf("tmdb_%d", tmdbID))
	}
	
	// For series content
	if notification.SeriesID > 0 {
		keys = append(keys, fmt.Sprintf("series_%d", notification.SeriesID))
	}
	
	return keys
}

// isContentRecentlyUsed checks if content was used in recent notifications
func (ns *NotificationService) isContentRecentlyUsed(contentKeys []string) bool {
	ns.contentMutex.RLock()
	defer ns.contentMutex.RUnlock()
	
	now := time.Now()
	cooldownPeriod := 2 * time.Hour // Content can't be reused for 2 hours
	
	for _, key := range contentKeys {
		if lastUsed, exists := ns.usedContent[key]; exists {
			if now.Sub(lastUsed) < cooldownPeriod {
				log.Printf("🚫 Content recently used: %s (%.1f minutes ago)", key, now.Sub(lastUsed).Minutes())
				return true
			}
		}
	}
	
	return false
}

// markContentAsUsed marks content as recently used
func (ns *NotificationService) markContentAsUsed(contentKeys []string) {
	ns.contentMutex.Lock()
	defer ns.contentMutex.Unlock()
	
	now := time.Now()
	for _, key := range contentKeys {
		ns.usedContent[key] = now
		log.Printf("✅ Marked content as used: %s", key)
	}
}

// cleanupOldUsedContent removes old entries from usedContent map
func (ns *NotificationService) cleanupOldUsedContent() {
	ns.contentMutex.Lock()
	defer ns.contentMutex.Unlock()
	
	now := time.Now()
	maxAge := 6 * time.Hour // Keep track for 6 hours
	
	for key, lastUsed := range ns.usedContent {
		if now.Sub(lastUsed) > maxAge {
			delete(ns.usedContent, key)
		}
	}
}

// Start begins the background notification generation
func (ns *NotificationService) Start() {
	log.Printf("🔔 Starting notification service background job...")
	go ns.generateOptimizedNotifications()
	
	// Generate initial batch of notifications immediately for better UX
	go func() {
		log.Printf("🔔 Generating initial notification batch...")
		ns.generateInitialNotificationBatch()
	}()
}

// Stop stops the background notification generation
func (ns *NotificationService) Stop() {
	log.Printf("🔕 Stopping notification service...")
	close(ns.stopChan)
}

// generateInitialNotificationBatch creates a diverse set of notifications on startup with local focus
func (ns *NotificationService) generateInitialNotificationBatch() {
	// Generate diverse local-focused notifications in parallel for fast startup
	go ns.CreateSingleMovieSuggestion()      // Perfect match
	go ns.CreateRecentlyAddedNotification()  // Recent additions
	
	time.Sleep(300 * time.Millisecond)
	
	go ns.CreateGenreBasedNotification()     // Genre recommendations
	go ns.CreateContinueWatchingNotification() // Continue watching
	
	time.Sleep(300 * time.Millisecond)
	
	go ns.CreateLocalTrendingNotification()  // Local trending
	go ns.CreateTMDBComingSoonNotification() // One TMDB notification
}

// generateOptimizedNotifications runs every 20 seconds with smart notification rotation and duplicate prevention
func (ns *NotificationService) generateOptimizedNotifications() {
	rand.Seed(time.Now().UnixNano())
	
	// Smart notification rotation with weights - prioritize local content and recent additions
	localNotifications := []func() error{
		ns.CreateSingleMovieSuggestion,           // Perfect match single movie
		ns.CreateRecentlyAddedNotification,       // Recently added content
		ns.CreateGenreBasedNotification,          // Genre recommendations
		ns.CreateLocalGenreHighlightNotification, // Local genre collections
		ns.CreateRandomMovieSuggestion,           // Multiple local movies
		ns.CreateContinueWatchingNotification,    // Continue watching
		ns.CreateLocalTrendingNotification,       // Local trending
		ns.CreateWatchAgainSuggestion,            // Watch again
	}
	
	tmdbNotifications := []func() error{
		ns.CreateTMDBComingSoonNotification,      // Coming soon movies
		ns.CreateTMDBTrendingMoviesNotification,  // TMDB trending
		ns.CreateSingleTMDBMovieNotification,     // Single TMDB movie
		ns.CreateTMDBNowPlayingNotification,      // Now in theaters
		ns.CreateTMDBUpcomingTVNotification,      // Upcoming TV
		ns.CreateTMDBNowAiringTVNotification,     // Now airing TV
		ns.CreateSingleTMDBTVNotification,        // Single TMDB TV
		ns.CreateTMDBUpcomingMoviesNotification,  // TMDB upcoming movies
	}
	
	notificationCounter := 0
	
	for {
		// Generate notification every 20 seconds for better pacing
		waitDuration := 20 * time.Second
		
		select {
		case <-ns.stopChan:
			log.Printf("🔕 Notification service stopped")
			return
		case <-time.After(waitDuration):
			// Cleanup old used content every 10 iterations (200 seconds)
			if notificationCounter%10 == 0 {
				ns.cleanupOldUsedContent()
			}
			
			// Smart rotation: 70% local content, 30% TMDB content
			var notificationFunc func() error
			
			if rand.Float32() < 0.7 {
				// Local content (70% chance)
				notificationFunc = localNotifications[rand.Intn(len(localNotifications))]
			} else {
				// TMDB content (30% chance)
				notificationFunc = tmdbNotifications[rand.Intn(len(tmdbNotifications))]
			}
			
			if err := notificationFunc(); err != nil {
				log.Printf("⚠️ Notification generation failed: %v", err)
				// Try a fallback local notification
				if fallbackErr := ns.CreateSingleMovieSuggestion(); fallbackErr != nil {
					log.Printf("⚠️ Fallback notification also failed: %v", fallbackErr)
				}
			}
			
			notificationCounter++
			
			// Trim notifications every 10 generations
			if notificationCounter%10 == 0 {
				ns.trimNotifications()
			}
		}
	}
}

// trimNotifications ensures only 50 notifications are kept (FIFO)
func (ns *NotificationService) trimNotifications() {
	key := ns.keyPrefix + "global"
	count, err := ns.client.ZCard(ns.ctx, key).Result()
	if err != nil {
		return
	}
	
	if count > int64(ns.maxNotifications) {
		// Remove oldest notifications (lowest scores = oldest timestamps)
		toRemove := count - int64(ns.maxNotifications)
		ns.client.ZRemRangeByRank(ns.ctx, key, 0, toRemove-1)
		log.Printf("🗑️ Trimmed %d old notifications, keeping %d", toRemove, ns.maxNotifications)
	}
}

// CreateContinueWatchingNotification creates notification for partially watched content with progress and complete media info
func (ns *NotificationService) CreateContinueWatchingNotification() error {
	type ProgressResult struct {
		MediaID          uint    `gorm:"column:media_id"`
		Title            string  `gorm:"column:title"`
		Progress         float64 `gorm:"column:progress"`
		Duration         int     `gorm:"column:duration"`
		LastWatched      int64   `gorm:"column:last_watched"`
		Type             string  `gorm:"column:type"`
		SeriesID         uint    `gorm:"column:series_id"`
		Rating           float64 `gorm:"column:rating"`
		Year             int     `gorm:"column:year"`
		GenreNames       string  `gorm:"column:genre_names"`
		PosterPath       string  `gorm:"column:poster_path"`
		TMDBPosterURL    string  `gorm:"column:tmdb_poster_url"`
		TMDBBackdropURL  string  `gorm:"column:tmdb_backdrop_url"`
		TMDBTrailerURL   string  `gorm:"column:tmdb_trailer_url"`
		Description      string  `gorm:"column:description"`
		SeasonNumber     int     `gorm:"column:season_number"`
		EpisodeNumber    int     `gorm:"column:episode_number"`
		LogoPath         string  `gorm:"column:logo_path"`
	}
	
	var results []ProgressResult
	err := ns.db.Raw(`
		SELECT p.media_id, m.title, p.progress, m.duration, 
		       CAST(strftime('%s', p.last_watched_at) AS INTEGER) as last_watched,
		       m.type, m.series_id, m.rating, m.year, m.genre_names,
		       m.poster_path, m.tmdb_poster_url, m.tmdb_backdrop_url, m.tmdb_trailer_url,
		       m.description, m.season_number, m.episode_number, m.logo_path
		FROM playback_progress p
		INNER JOIN media m ON p.media_id = m.id
		WHERE p.progress BETWEEN 5 AND 90
		AND m.file_path IS NOT NULL AND m.file_path != ''
		AND (m.tmdb_poster_url IS NOT NULL AND m.tmdb_poster_url LIKE 'https://image.tmdb.org/t/p/%')
		AND p.last_watched_at > datetime('now', '-7 days')
		ORDER BY p.last_watched_at DESC
		LIMIT 5
	`).Scan(&results).Error
	
	if err != nil || len(results) == 0 {
		return fmt.Errorf("no continue watching content found")
	}
	
	// Build media details for all continue watching items
	var mediaDetails []NotificationMedia
	var movieIDs []uint
	primaryResult := results[0] // Use first result as primary
	
	for _, result := range results {
		media := NotificationMedia{
			ID:         int(result.MediaID),
			Title:      result.Title,
			Rating:     result.Rating,
			Year:       result.Year,
			Overview:   result.Description,
			SourceType: "local",
			SourceID:   fmt.Sprintf("%d", result.MediaID),
		}
		
		// Set poster URL - prioritize TMDB
		if result.TMDBPosterURL != "" && strings.HasPrefix(result.TMDBPosterURL, "https://image.tmdb.org/t/p/") {
			media.PosterURL = result.TMDBPosterURL
		} else {
			media.PosterURL = fmt.Sprintf("/api/posters/%d", result.MediaID)
		}
		
		// Set backdrop URL
		if result.TMDBBackdropURL != "" {
			media.BackdropURL = result.TMDBBackdropURL
		}
		
		// Set runtime in minutes
		if result.Duration > 0 {
			media.Runtime = result.Duration / 60
		}
		
		// Parse genres
		if result.GenreNames != "" {
			var genres []string
			if err := json.Unmarshal([]byte(result.GenreNames), &genres); err == nil {
				media.Genres = genres
			}
		}
		
		mediaDetails = append(mediaDetails, media)
		movieIDs = append(movieIDs, result.MediaID)
	}
	
	// Use first result for primary notification data
	result := primaryResult
	remainingMin := 0
	if result.Duration > 0 {
		remainingSeconds := float64(result.Duration) * (100 - result.Progress) / 100
		remainingMin = int(remainingSeconds / 60)
	}
	
	// Build message
	var message string
	if len(results) == 1 {
		message = fmt.Sprintf("You're %.0f%% through %s - %d min left", result.Progress, result.Title, remainingMin)
	} else {
		message = fmt.Sprintf("Continue %s and %d more titles", result.Title, len(results)-1)
	}
	
	// Get trailer key if available
	trailerKey := ""
	if result.TMDBTrailerURL != "" {
		trailerKey = ns.extractYouTubeKey(result.TMDBTrailerURL)
	}
	
	// Parse genres for theme colors
	var genres []string
	if result.GenreNames != "" {
		json.Unmarshal([]byte(result.GenreNames), &genres)
	}

	// Build logo URL
	logoURL := ""
	if result.LogoPath != "" && result.LogoPath != "null" {
		logoURL = fmt.Sprintf("/api/%s", result.LogoPath)
	} else {
		logoURL = fmt.Sprintf("/api/admin/assets/logo_%d.png", result.MediaID)
	}

	// Set poster URL - prioritize TMDB
	posterURL := ""
	if result.TMDBPosterURL != "" && strings.HasPrefix(result.TMDBPosterURL, "https://image.tmdb.org/t/p/") {
		posterURL = result.TMDBPosterURL
	} else {
		posterURL = fmt.Sprintf("/api/posters/%d", result.MediaID)
	}
	
	notification := Notification{
		ID:           fmt.Sprintf("continue_%d_%d", result.MediaID, time.Now().Unix()),
		Type:         NotificationTypeContinueWatching,
		Title:        result.Title, // ENSURE PROPER TITLE FROM MEDIA
		Message:      message,
		MovieIDs:     movieIDs,
		Timestamp:    time.Now().Unix(),
		Read:         false,
		Progress:     result.Progress,
		RemainingMin: remainingMin,
		Priority:     "high",
		Category:     "watchlist",
		// Enhanced data
		BackdropURL:  result.TMDBBackdropURL,
		PosterURL:    posterURL,
		LogoURL:      logoURL,
		TrailerKey:   trailerKey,
		Rating:       result.Rating,
		Genres:       genres,
		Overview:     result.Description,
		MediaDetails: mediaDetails,
	}
	
	return ns.AddNotification(notification)
}

// CreateRecentlyAddedNotification creates notification for recently added content with complete media info
func (ns *NotificationService) CreateRecentlyAddedNotification() error {
	type MediaResult struct {
		ID              uint    `gorm:"column:id"`
		Title           string  `gorm:"column:title"`
		Type            string  `gorm:"column:type"`
		Rating          float64 `gorm:"column:rating"`
		Year            int     `gorm:"column:year"`
		TMDBPosterURL   string  `gorm:"column:tmdb_poster_url"`
		TMDBBackdropURL string  `gorm:"column:tmdb_backdrop_url"`
		TMDBTrailerURL  string  `gorm:"column:tmdb_trailer_url"`
		CreatedAt       string  `gorm:"column:created_at"`
		Description     string  `gorm:"column:description"`
		GenreNames      string  `gorm:"column:genre_names"`
		LogoPath        string  `gorm:"column:logo_path"`
		Duration        int     `gorm:"column:duration"`
	}
	
	var results []MediaResult
	err := ns.db.Raw(`
		SELECT id, title, type, rating, year, tmdb_poster_url, tmdb_backdrop_url, tmdb_trailer_url,
		       datetime(created_at) as created_at, description, genre_names, logo_path, duration
		FROM media
		WHERE created_at > datetime('now', '-48 hours')
		AND file_path IS NOT NULL AND file_path != ''
		AND (tmdb_poster_url IS NOT NULL AND tmdb_poster_url LIKE 'https://image.tmdb.org/t/p/%')
		AND rating >= 6.0
		ORDER BY created_at DESC, rating DESC
		LIMIT 5
	`).Scan(&results).Error
	
	if err != nil || len(results) == 0 {
		return fmt.Errorf("no recently added content with valid posters")
	}
	
	var movieIDs []uint
	var mediaDetails []NotificationMedia
	primaryMedia := results[0] // Use first result as primary
	
	for _, r := range results {
		movieIDs = append(movieIDs, r.ID)
		
		media := NotificationMedia{
			ID:         int(r.ID),
			Title:      r.Title,
			Rating:     r.Rating,
			Year:       r.Year,
			PosterURL:  r.TMDBPosterURL,
			SourceType: "local",
			SourceID:   fmt.Sprintf("%d", r.ID),
			Overview:   r.Description,
		}
		
		if r.TMDBBackdropURL != "" {
			media.BackdropURL = r.TMDBBackdropURL
		}
		
		if r.Duration > 0 {
			media.Runtime = r.Duration / 60
		}
		
		// Parse genres
		if r.GenreNames != "" {
			var genres []string
			if err := json.Unmarshal([]byte(r.GenreNames), &genres); err == nil {
				media.Genres = genres
			}
		}
		
		mediaDetails = append(mediaDetails, media)
	}
	
	message := fmt.Sprintf("%s was just added to your library!", primaryMedia.Title)
	if len(results) > 1 {
		message = fmt.Sprintf("%d new high-quality titles added recently!", len(results))
	}

	// Extract trailer key from primary media
	trailerKey := ""
	if primaryMedia.TMDBTrailerURL != "" {
		trailerKey = ns.extractYouTubeKey(primaryMedia.TMDBTrailerURL)
	}

	// Build logo URL for primary media
	logoURL := ""
	if primaryMedia.LogoPath != "" && primaryMedia.LogoPath != "null" {
		logoURL = fmt.Sprintf("/api/%s", primaryMedia.LogoPath)
	} else {
		logoURL = fmt.Sprintf("/api/admin/assets/logo_%d.png", primaryMedia.ID)
	}

	// Parse genres for primary media
	var genres []string
	if primaryMedia.GenreNames != "" {
		json.Unmarshal([]byte(primaryMedia.GenreNames), &genres)
	}
	
	notification := Notification{
		ID:           fmt.Sprintf("recent_%d_%d", primaryMedia.ID, time.Now().Unix()),
		Type:         NotificationTypeRecentlyAdded,
		Title:        primaryMedia.Title, // ENSURE PROPER TITLE FROM PRIMARY MEDIA
		Message:      message,
		MovieIDs:     movieIDs,
		Timestamp:    time.Now().Unix(),
		Read:         false,
		Priority:     "high",
		Category:     "new",
		MediaDetails: mediaDetails,
		PosterURL:    primaryMedia.TMDBPosterURL,
		BackdropURL:  primaryMedia.TMDBBackdropURL,
		LogoURL:      logoURL,
		TrailerKey:   trailerKey,
		Rating:       primaryMedia.Rating,
		Overview:     primaryMedia.Description,
		Genres:       genres,
	}
	
	return ns.AddNotification(notification)
}

// CreateLocalTrendingNotification creates notification for trending local content with complete media info
func (ns *NotificationService) CreateLocalTrendingNotification() error {
	type MediaResult struct {
		ID              uint    `gorm:"column:id"`
		Title           string  `gorm:"column:title"`
		ViewCount       int     `gorm:"column:view_count"`
		Rating          float64 `gorm:"column:rating"`
		Year            int     `gorm:"column:year"`
		TMDBPosterURL   string  `gorm:"column:tmdb_poster_url"`
		TMDBBackdropURL string  `gorm:"column:tmdb_backdrop_url"`
		TMDBTrailerURL  string  `gorm:"column:tmdb_trailer_url"`
		Description     string  `gorm:"column:description"`
		GenreNames      string  `gorm:"column:genre_names"`
		LogoPath        string  `gorm:"column:logo_path"`
		Duration        int     `gorm:"column:duration"`
	}
	
	var results []MediaResult
	err := ns.db.Raw(`
		SELECT id, title, view_count, rating, year, tmdb_poster_url, tmdb_backdrop_url, tmdb_trailer_url,
		       description, genre_names, logo_path, duration
		FROM media
		WHERE view_count > 0
		AND file_path IS NOT NULL AND file_path != ''
		AND (tmdb_poster_url IS NOT NULL AND tmdb_poster_url LIKE 'https://image.tmdb.org/t/p/%')
		ORDER BY view_count DESC, rating DESC
		LIMIT 1
	`).Scan(&results).Error
	
	if err != nil || len(results) == 0 {
		return fmt.Errorf("no trending local content")
	}
	
	result := results[0]

	// Extract trailer key
	trailerKey := ""
	if result.TMDBTrailerURL != "" {
		trailerKey = ns.extractYouTubeKey(result.TMDBTrailerURL)
	}

	// Build logo URL
	logoURL := ""
	if result.LogoPath != "" && result.LogoPath != "null" {
		logoURL = fmt.Sprintf("/api/%s", result.LogoPath)
	} else {
		logoURL = fmt.Sprintf("/api/admin/assets/logo_%d.png", result.ID)
	}

	// Parse genres
	var genres []string
	if result.GenreNames != "" {
		json.Unmarshal([]byte(result.GenreNames), &genres)
	}

	notification := Notification{
		ID:          fmt.Sprintf("local_trend_%d_%d", result.ID, time.Now().Unix()),
		Type:        NotificationTypeLocalTrending,
		Title:       result.Title, // ENSURE PROPER TITLE FROM MEDIA
		Message:     fmt.Sprintf("%s is popular - watched %d times! (⭐ %.1f)", result.Title, result.ViewCount, result.Rating),
		MovieIDs:    []uint{result.ID},
		Timestamp:   time.Now().Unix(),
		Read:        false,
		Priority:    "medium",
		Category:    "trending",
		PosterURL:   result.TMDBPosterURL,
		BackdropURL: result.TMDBBackdropURL,
		LogoURL:     logoURL,
		TrailerKey:  trailerKey,
		Rating:      result.Rating,
		Overview:    result.Description,
		Genres:      genres,
		Runtime:     result.Duration / 60,
	}
	
	return ns.AddNotification(notification)
}

// CreateGenreBasedNotification creates notification based on user's favorite genres with recent content focus
func (ns *NotificationService) CreateGenreBasedNotification() error {
	// Get most watched genre from recent activity
	var topGenre string
	err := ns.db.Raw(`
		SELECT m.genre_names FROM media m
		INNER JOIN playback_progress p ON m.id = p.media_id
		WHERE m.genre_names IS NOT NULL AND m.genre_names != ''
		AND p.last_watched_at > datetime('now', '-30 days')
		AND m.file_path IS NOT NULL AND m.file_path != ''
		GROUP BY m.genre_names
		ORDER BY COUNT(*) DESC, MAX(p.last_watched_at) DESC
		LIMIT 1
	`).Scan(&topGenre).Error
	
	if err != nil || topGenre == "" {
		// Fallback to popular genres with recent content
		genres := []string{"Action", "Comedy", "Drama", "Thriller", "Sci-Fi", "Horror", "Romance", "Adventure"}
		topGenre = genres[rand.Intn(len(genres))]
	}
	
	// Extract first genre from JSON array
	genreName := topGenre
	if strings.Contains(topGenre, "[") {
		parts := strings.Split(topGenre, `"`)
		for _, p := range parts {
			if len(p) > 2 && p != "[" && p != "]" && p != "," {
				genreName = p
				break
			}
		}
	}
	
	type MediaResult struct {
		ID              uint    `gorm:"column:id"`
		Title           string  `gorm:"column:title"`
		Rating          float64 `gorm:"column:rating"`
		Year            int     `gorm:"column:year"`
		TMDBPosterURL   string  `gorm:"column:tmdb_poster_url"`
		TMDBBackdropURL string  `gorm:"column:tmdb_backdrop_url"`
		Description     string  `gorm:"column:description"`
		GenreNames      string  `gorm:"column:genre_names"`
	}
	
	var results []MediaResult
	err = ns.db.Raw(`
		SELECT id, title, rating, year, tmdb_poster_url, tmdb_backdrop_url, description, genre_names
		FROM media
		WHERE genre_names LIKE ?
		AND file_path IS NOT NULL AND file_path != ''
		AND (tmdb_poster_url IS NOT NULL AND tmdb_poster_url LIKE 'https://image.tmdb.org/t/p/%')
		AND rating >= 7.0
		AND created_at > datetime('now', '-90 days')
		ORDER BY rating DESC, RANDOM()
		LIMIT 3
	`, "%"+genreName+"%").Scan(&results).Error
	
	if err != nil || len(results) == 0 {
		// Fallback without date restriction
		err = ns.db.Raw(`
			SELECT id, title, rating, year, tmdb_poster_url, tmdb_backdrop_url, description, genre_names
			FROM media
			WHERE genre_names LIKE ?
			AND file_path IS NOT NULL AND file_path != ''
			AND (tmdb_poster_url IS NOT NULL AND tmdb_poster_url LIKE 'https://image.tmdb.org/t/p/%')
			AND rating >= 6.5
			ORDER BY rating DESC, RANDOM()
			LIMIT 1
		`, "%"+genreName+"%").Scan(&results).Error
		
		if err != nil || len(results) == 0 {
			return fmt.Errorf("no genre-based content found for %s", genreName)
		}
	}
	
	var movieIDs []uint
	var mediaDetails []NotificationMedia
	
	for _, r := range results {
		movieIDs = append(movieIDs, r.ID)
		
		media := NotificationMedia{
			ID:          int(r.ID),
			Title:       r.Title,
			Rating:      r.Rating,
			Year:        r.Year,
			PosterURL:   r.TMDBPosterURL,
			BackdropURL: r.TMDBBackdropURL,
			Overview:    r.Description,
			SourceType:  "local",
			SourceID:    fmt.Sprintf("%d", r.ID),
		}
		
		// Parse genres
		if r.GenreNames != "" {
			var genres []string
			if err := json.Unmarshal([]byte(r.GenreNames), &genres); err == nil {
				media.Genres = genres
			}
		}
		
		mediaDetails = append(mediaDetails, media)
	}
	
	var message string
	if len(results) == 1 {
		message = fmt.Sprintf("Perfect %s pick: %s (⭐ %.1f)", genreName, results[0].Title, results[0].Rating)
	} else {
		message = fmt.Sprintf("%d great %s titles you'll love!", len(results), genreName)
	}
	
	notification := Notification{
		ID:             fmt.Sprintf("genre_%s_%d_%d", genreName, results[0].ID, time.Now().Unix()),
		Type:           NotificationTypeGenreBased,
		Title:          fmt.Sprintf("Because You Like %s", genreName),
		Message:        message,
		MovieIDs:       movieIDs,
		Timestamp:      time.Now().Unix(),
		Read:           false,
		Priority:       "high",
		Category:       "recommended",
		GenreHighlight: genreName,
		MediaDetails:   mediaDetails,
		PosterURL:      results[0].TMDBPosterURL,
		BackdropURL:    results[0].TMDBBackdropURL,
		Rating:         results[0].Rating,
	}
	
	return ns.AddNotification(notification)
}

// CreateTMDBComingSoonNotification creates notification for movies coming soon with duplicate prevention
func (ns *NotificationService) CreateTMDBComingSoonNotification() error {
	if ns.tmdbService == nil {
		return fmt.Errorf("TMDB service not available")
	}

	// Get list of recently used TMDB content to exclude
	ns.contentMutex.RLock()
	excludeTMDBIDs := make([]int, 0)
	for key, lastUsed := range ns.usedContent {
		if strings.HasPrefix(key, "tmdb_") && time.Since(lastUsed) < 2*time.Hour {
			if id := strings.TrimPrefix(key, "tmdb_"); id != "" {
				if tmdbID, err := strconv.Atoi(id); err == nil {
					excludeTMDBIDs = append(excludeTMDBIDs, tmdbID)
				}
			}
		}
	}
	ns.contentMutex.RUnlock()
	
	// Fetch upcoming movies from multiple pages for better selection
	var allUpcomingMovies []TMDBMovieWithVideos
	for page := 1; page <= 3; page++ {
		movies, err := ns.tmdbService.GetUpcomingMoviesList(page)
		if err != nil {
			log.Printf("⚠️ Failed to fetch upcoming movies page %d: %v", page, err)
			continue
		}
		allUpcomingMovies = append(allUpcomingMovies, movies...)
	}
	
	if len(allUpcomingMovies) == 0 {
		return fmt.Errorf("no upcoming movies from TMDB")
	}

	// Create exclusion map for faster lookup
	excludeMap := make(map[int]bool)
	for _, id := range excludeTMDBIDs {
		excludeMap[id] = true
	}
	
	now := time.Now()
	var comingSoonMovies []struct {
		movie    TMDBMovieWithVideos
		daysUntil int
	}
	
	// Filter movies with future release dates, excluding recently used
	for _, movie := range allUpcomingMovies {
		// Skip if recently used
		if excludeMap[movie.ID] {
			continue
		}

		if movie.ReleaseDate == "" {
			continue
		}
		
		releaseTime, err := time.Parse("2006-01-02", movie.ReleaseDate)
		if err != nil {
			log.Printf("⚠️ Failed to parse release date '%s' for movie '%s'", movie.ReleaseDate, movie.Title)
			continue
		}
		
		// Calculate days until release
		diff := releaseTime.Sub(now)
		days := int(diff.Hours() / 24)
		
		// Only include movies releasing in the future (1-90 days) with good ratings
		if days > 0 && days <= 90 && movie.VoteAverage >= 6.0 && movie.Popularity >= 30 && !movie.Adult {
			comingSoonMovies = append(comingSoonMovies, struct {
				movie    TMDBMovieWithVideos
				daysUntil int
			}{movie, days})
		}
	}
	
	if len(comingSoonMovies) == 0 {
		return fmt.Errorf("no suitable coming soon movies with future release dates (excluded %d recently used)", len(excludeTMDBIDs))
	}
	
	// Sort by days until release (closest first) and then by rating
	sort.Slice(comingSoonMovies, func(i, j int) bool {
		if comingSoonMovies[i].daysUntil == comingSoonMovies[j].daysUntil {
			return comingSoonMovies[i].movie.VoteAverage > comingSoonMovies[j].movie.VoteAverage
		}
		return comingSoonMovies[i].daysUntil < comingSoonMovies[j].daysUntil
	})
	
	// Select the best coming soon movie
	selected := comingSoonMovies[0]
	comingSoon := selected.movie
	daysUntil := selected.daysUntil
	
	// Create compelling message based on release timing
	var message string
	var priority string
	
	if daysUntil == 1 {
		message = fmt.Sprintf("🎬 %s releases TOMORROW! Don't miss it!", comingSoon.Title)
		priority = "high"
	} else if daysUntil <= 3 {
		message = fmt.Sprintf("🎬 %s releases in just %d days!", comingSoon.Title, daysUntil)
		priority = "high"
	} else if daysUntil <= 7 {
		message = fmt.Sprintf("🎬 %s releases this week (%d days)!", comingSoon.Title, daysUntil)
		priority = "high"
	} else if daysUntil <= 14 {
		message = fmt.Sprintf("🎬 %s releases in %d days - mark your calendar!", comingSoon.Title, daysUntil)
		priority = "medium"
	} else if daysUntil <= 30 {
		message = fmt.Sprintf("🎬 %s releases in %d days (⭐ %.1f)", comingSoon.Title, daysUntil, comingSoon.VoteAverage)
		priority = "medium"
	} else {
		message = fmt.Sprintf("🎬 %s coming in %d days - highly anticipated!", comingSoon.Title, daysUntil)
		priority = "low"
	}
	
	// Get trailer key if available
	trailerKey := ""
	if len(comingSoon.Videos.Results) > 0 {
		for _, video := range comingSoon.Videos.Results {
			if video.Site == "YouTube" && (video.Type == "Trailer" || video.Type == "Teaser") && video.Key != "" {
				trailerKey = video.Key
				break
			}
		}
	}
	
	// Build enhanced notification with media details
	mediaDetails := []NotificationMedia{
		{
			ID:         comingSoon.ID,
			Title:      comingSoon.Title,
			Rating:     comingSoon.VoteAverage,
			Overview:   comingSoon.Overview,
			SourceType: "tmdb",
			SourceID:   fmt.Sprintf("%d", comingSoon.ID),
		},
	}
	
	// Set poster and backdrop URLs
	if comingSoon.PosterPath != "" {
		mediaDetails[0].PosterURL = fmt.Sprintf("https://image.tmdb.org/t/p/w500%s", comingSoon.PosterPath)
	}
	if comingSoon.BackdropPath != "" {
		mediaDetails[0].BackdropURL = fmt.Sprintf("https://image.tmdb.org/t/p/w1280%s", comingSoon.BackdropPath)
	}
	
	// Parse release year
	releaseYear := 0
	if releaseTime, err := time.Parse("2006-01-02", comingSoon.ReleaseDate); err == nil {
		releaseYear = releaseTime.Year()
		mediaDetails[0].Year = releaseYear
	}
	
	notification := Notification{
		ID:          fmt.Sprintf("coming_%d_%d", comingSoon.ID, time.Now().Unix()),
		Type:        NotificationTypeTMDBComingSoon,
		Title:       comingSoon.Title, // ENSURE PROPER TITLE FROM TMDB MOVIE
		Message:     message,
		TMDBIDs:     []int{comingSoon.ID},
		TMDBTitles:  []string{comingSoon.Title},
		Timestamp:   time.Now().Unix(),
		Read:        false,
		Priority:    priority,
		Category:    "new",
		DaysUntil:   daysUntil,
		ReleaseDate: comingSoon.ReleaseDate,
		// Enhanced data
		PosterURL:    mediaDetails[0].PosterURL,
		BackdropURL:  mediaDetails[0].BackdropURL,
		TrailerKey:   trailerKey,
		Rating:       comingSoon.VoteAverage,
		Overview:     comingSoon.Overview,
		Popularity:   comingSoon.Popularity,
		MediaDetails: mediaDetails,
	}
	
	log.Printf("🎬 Created coming soon notification: %s releases in %d days (excluded %d recently used)", 
		comingSoon.Title, daysUntil, len(excludeTMDBIDs))
	
	return ns.AddNotification(notification)
}

// CreateSingleTMDBMovieNotification creates notification for a single TMDB movie with duplicate prevention
func (ns *NotificationService) CreateSingleTMDBMovieNotification() error {
	if ns.tmdbService == nil {
		return fmt.Errorf("TMDB service not available")
	}

	// Get list of recently used TMDB content to exclude
	ns.contentMutex.RLock()
	excludeTMDBIDs := make([]int, 0)
	for key, lastUsed := range ns.usedContent {
		if strings.HasPrefix(key, "tmdb_") && time.Since(lastUsed) < 2*time.Hour {
			if id := strings.TrimPrefix(key, "tmdb_"); id != "" {
				if tmdbID, err := strconv.Atoi(id); err == nil {
					excludeTMDBIDs = append(excludeTMDBIDs, tmdbID)
				}
			}
		}
	}
	ns.contentMutex.RUnlock()
	
	movies, err := ns.tmdbService.GetPopularMovies(1)
	if err != nil || len(movies) == 0 {
		return fmt.Errorf("no popular movies from TMDB")
	}

	// Create exclusion map for faster lookup
	excludeMap := make(map[int]bool)
	for _, id := range excludeTMDBIDs {
		excludeMap[id] = true
	}
	
	// Pick a random high-quality movie that hasn't been used recently
	var selected *TMDBMovie
	for _, movie := range movies {
		// Skip if recently used
		if excludeMap[movie.ID] {
			continue
		}

		if movie.VoteAverage >= 7.0 && movie.Popularity >= 100 && !movie.Adult {
			selected = &movie
			break
		}
	}
	
	if selected == nil && len(movies) > 0 {
		// Fallback: find any unused movie
		for _, movie := range movies {
			if !excludeMap[movie.ID] {
				selected = &movie
				break
			}
		}
	}
	
	if selected == nil {
		return fmt.Errorf("no suitable TMDB movie found (excluded %d recently used)", len(excludeTMDBIDs))
	}

	// Get detailed movie info with trailer
	var trailerKey string
	var genres []string
	if details, err := ns.tmdbService.GetMovieDetailsWithExtras(selected.ID); err == nil && details != nil {
		for _, video := range details.Videos.Results {
			if video.Site == "YouTube" && (video.Type == "Trailer" || video.Type == "Teaser") && video.Key != "" {
				trailerKey = video.Key
				break
			}
		}
		// Get genres
		for _, genre := range details.Genres {
			genres = append(genres, genre.Name)
		}
	}

	// Build poster and backdrop URLs
	posterURL := ""
	backdropURL := ""
	if selected.PosterPath != "" {
		posterURL = fmt.Sprintf("https://image.tmdb.org/t/p/w500%s", selected.PosterPath)
	}
	if selected.BackdropPath != "" {
		backdropURL = fmt.Sprintf("https://image.tmdb.org/t/p/w1280%s", selected.BackdropPath)
	}
	
	notification := Notification{
		ID:          fmt.Sprintf("tmdb_movie_%d_%d", selected.ID, time.Now().Unix()),
		Type:        NotificationTypeTMDBNowPlaying,
		Title:       selected.Title, // ENSURE PROPER TITLE FROM TMDB MOVIE
		Message:     fmt.Sprintf("%s is getting great reviews! ⭐ %.1f", selected.Title, selected.VoteAverage),
		TMDBIDs:     []int{selected.ID},
		TMDBTitles:  []string{selected.Title},
		Timestamp:   time.Now().Unix(),
		Read:        false,
		Priority:    "medium",
		Category:    "trending",
		PosterURL:   posterURL,
		BackdropURL: backdropURL,
		TrailerKey:  trailerKey,
		Rating:      selected.VoteAverage,
		Overview:    selected.Overview,
		Genres:      genres,
	}

	log.Printf("🎬 Created single TMDB movie notification: %s (excluded %d recently used)", selected.Title, len(excludeTMDBIDs))
	return ns.AddNotification(notification)
}

// CreateSingleTMDBTVNotification creates notification for a single TMDB TV show with complete info
func (ns *NotificationService) CreateSingleTMDBTVNotification() error {
	if ns.tmdbService == nil {
		return fmt.Errorf("TMDB service not available")
	}
	
	tvResponse, err := ns.tmdbService.GetUpcomingTVSeries()
	if err != nil || tvResponse == nil {
		return fmt.Errorf("no TV series from TMDB")
	}
	
	var selected *TMDBTV
	for _, tv := range tvResponse.OnTheAir {
		if tv.VoteAverage >= 7.0 && tv.Popularity >= 50 {
			selected = &tv
			break
		}
	}
	
	if selected == nil && len(tvResponse.OnTheAir) > 0 {
		selected = &tvResponse.OnTheAir[0]
	}
	
	if selected == nil {
		return fmt.Errorf("no suitable TMDB TV show")
	}

	// Get detailed TV info with trailer
	var trailerKey string
	var genres []string
	if details, err := ns.tmdbService.GetTVDetails(selected.ID); err == nil && details != nil {
		for _, video := range details.Videos.Results {
			if video.Site == "YouTube" && (video.Type == "Trailer" || video.Type == "Teaser") && video.Key != "" {
				trailerKey = video.Key
				break
			}
		}
		// Get genres
		for _, genre := range details.Genres {
			genres = append(genres, genre.Name)
		}
	}

	// Build poster and backdrop URLs
	posterURL := ""
	backdropURL := ""
	if selected.PosterPath != "" {
		posterURL = fmt.Sprintf("https://image.tmdb.org/t/p/w500%s", selected.PosterPath)
	}
	if selected.BackdropPath != "" {
		backdropURL = fmt.Sprintf("https://image.tmdb.org/t/p/w1280%s", selected.BackdropPath)
	}
	
	notification := Notification{
		ID:          fmt.Sprintf("tmdb_tv_%d_%d", selected.ID, time.Now().Unix()),
		Type:        NotificationTypeTMDBNowAiringTV,
		Title:       selected.Name, // ENSURE PROPER TITLE FROM TMDB TV SHOW
		Message:     fmt.Sprintf("%s has new episodes! ⭐ %.1f", selected.Name, selected.VoteAverage),
		TMDBIDs:     []int{selected.ID},
		TMDBTitles:  []string{selected.Name},
		Timestamp:   time.Now().Unix(),
		Read:        false,
		Priority:    "medium",
		Category:    "trending",
		PosterURL:   posterURL,
		BackdropURL: backdropURL,
		TrailerKey:  trailerKey,
		Rating:      selected.VoteAverage,
		Overview:    selected.Overview,
		Genres:      genres,
	}
	
	return ns.AddNotification(notification)
}

// CreateLocalGenreHighlightNotification highlights a specific genre from local library with recent focus
func (ns *NotificationService) CreateLocalGenreHighlightNotification() error {
	// Get genres that have recent content or high ratings
	type GenreStats struct {
		Genre       string  `gorm:"column:genre"`
		Count       int     `gorm:"column:count"`
		AvgRating   float64 `gorm:"column:avg_rating"`
		RecentCount int     `gorm:"column:recent_count"`
	}
	
	var genreStats []GenreStats
	err := ns.db.Raw(`
		WITH genre_data AS (
			SELECT 
				TRIM(REPLACE(REPLACE(REPLACE(genre_names, '[', ''), ']', ''), '"', '')) as clean_genres,
				rating,
				CASE WHEN created_at > datetime('now', '-60 days') THEN 1 ELSE 0 END as is_recent
			FROM media 
			WHERE genre_names IS NOT NULL 
			AND genre_names != '' 
			AND genre_names != '[]'
			AND file_path IS NOT NULL 
			AND file_path != ''
			AND tmdb_poster_url IS NOT NULL 
			AND tmdb_poster_url LIKE 'https://image.tmdb.org/t/p/%'
			AND rating >= 6.0
		)
		SELECT 
			clean_genres as genre,
			COUNT(*) as count,
			AVG(rating) as avg_rating,
			SUM(is_recent) as recent_count
		FROM genre_data
		WHERE clean_genres NOT LIKE '%,%'
		AND LENGTH(clean_genres) > 2
		GROUP BY clean_genres
		HAVING count >= 2
		ORDER BY recent_count DESC, avg_rating DESC, count DESC
		LIMIT 5
	`).Scan(&genreStats).Error
	
	if err != nil || len(genreStats) == 0 {
		// Fallback to popular genres
		genres := []string{"Action", "Comedy", "Drama", "Thriller", "Sci-Fi", "Horror", "Romance", "Adventure"}
		selectedGenre := genres[rand.Intn(len(genres))]
		return ns.createGenreHighlightFallback(selectedGenre)
	}
	
	selectedGenreStats := genreStats[0]
	selectedGenre := selectedGenreStats.Genre
	
	type MediaResult struct {
		ID              uint    `gorm:"column:id"`
		Title           string  `gorm:"column:title"`
		Rating          float64 `gorm:"column:rating"`
		Year            int     `gorm:"column:year"`
		TMDBPosterURL   string  `gorm:"column:tmdb_poster_url"`
		TMDBBackdropURL string  `gorm:"column:tmdb_backdrop_url"`
		Description     string  `gorm:"column:description"`
		CreatedAt       string  `gorm:"column:created_at"`
	}
	
	var results []MediaResult
	err = ns.db.Raw(`
		SELECT id, title, rating, year, tmdb_poster_url, tmdb_backdrop_url, description,
		       datetime(created_at) as created_at
		FROM media
		WHERE genre_names LIKE ?
		AND file_path IS NOT NULL AND file_path != ''
		AND tmdb_poster_url IS NOT NULL AND tmdb_poster_url LIKE 'https://image.tmdb.org/t/p/%'
		AND rating >= 6.5
		ORDER BY 
			CASE WHEN created_at > datetime('now', '-30 days') THEN 2 ELSE 1 END DESC,
			rating DESC,
			RANDOM()
		LIMIT 3
	`, "%"+selectedGenre+"%").Scan(&results).Error
	
	if err != nil || len(results) == 0 {
		return fmt.Errorf("no genre highlight content for %s", selectedGenre)
	}
	
	var movieIDs []uint
	var mediaDetails []NotificationMedia
	
	for _, r := range results {
		movieIDs = append(movieIDs, r.ID)
		
		media := NotificationMedia{
			ID:          int(r.ID),
			Title:       r.Title,
			Rating:      r.Rating,
			Year:        r.Year,
			PosterURL:   r.TMDBPosterURL,
			BackdropURL: r.TMDBBackdropURL,
			Overview:    r.Description,
			SourceType:  "local",
			SourceID:    fmt.Sprintf("%d", r.ID),
		}
		
		mediaDetails = append(mediaDetails, media)
	}
	
	// Create compelling message
	var message string
	if selectedGenreStats.RecentCount > 0 {
		message = fmt.Sprintf("Your %s collection: %d titles (⭐ %.1f avg) - %d added recently!", 
			selectedGenre, selectedGenreStats.Count, selectedGenreStats.AvgRating, selectedGenreStats.RecentCount)
	} else {
		message = fmt.Sprintf("Explore your %s collection: %d quality titles (⭐ %.1f avg)", 
			selectedGenre, selectedGenreStats.Count, selectedGenreStats.AvgRating)
	}
	
	notification := Notification{
		ID:             fmt.Sprintf("genre_hl_%s_%d_%d", selectedGenre, selectedGenreStats.Count, time.Now().Unix()),
		Type:           NotificationTypeGenreBased,
		Title:          fmt.Sprintf("%s Collection", selectedGenre),
		Message:        message,
		MovieIDs:       movieIDs,
		Timestamp:      time.Now().Unix(),
		Read:           false,
		Priority:       "medium",
		Category:       "recommended",
		GenreHighlight: selectedGenre,
		MediaDetails:   mediaDetails,
		PosterURL:      results[0].TMDBPosterURL,
		BackdropURL:    results[0].TMDBBackdropURL,
		Rating:         selectedGenreStats.AvgRating,
	}
	
	return ns.AddNotification(notification)
}

// createGenreHighlightFallback creates a fallback genre highlight notification
func (ns *NotificationService) createGenreHighlightFallback(selectedGenre string) error {
	type MediaResult struct {
		ID    uint   `gorm:"column:id"`
		Title string `gorm:"column:title"`
		Count int    `gorm:"column:count"`
	}
	
	var results []MediaResult
	err := ns.db.Raw(`
		SELECT id, title, 
		       (SELECT COUNT(*) FROM media WHERE genre_names LIKE ?) as count
		FROM media
		WHERE genre_names LIKE ?
		AND file_path IS NOT NULL AND file_path != ''
		AND tmdb_poster_url IS NOT NULL AND tmdb_poster_url LIKE 'https://image.tmdb.org/t/p/%'
		AND rating >= 6.0
		ORDER BY rating DESC
		LIMIT 1
	`, "%"+selectedGenre+"%", "%"+selectedGenre+"%").Scan(&results).Error
	
	if err != nil || len(results) == 0 {
		return fmt.Errorf("no genre highlight content")
	}
	
	notification := Notification{
		ID:             fmt.Sprintf("genre_hl_%s_%d", selectedGenre, time.Now().Unix()),
		Type:           NotificationTypeGenreBased,
		Title:          fmt.Sprintf("%s Collection", selectedGenre),
		Message:        fmt.Sprintf("Explore %d %s titles - starting with %s!", results[0].Count, selectedGenre, results[0].Title),
		MovieIDs:       []uint{results[0].ID},
		Timestamp:      time.Now().Unix(),
		Read:           false,
		Priority:       "low",
		Category:       "recommended",
		GenreHighlight: selectedGenre,
	}
	
	return ns.AddNotification(notification)
}

// generateRandomNotifications - kept for backward compatibility but redirects to optimized version
func (ns *NotificationService) generateRandomNotifications() {
	ns.generateOptimizedNotifications()
}

// CreateRandomMovieSuggestion creates a notification suggesting multiple movies - ENHANCED WITH COMPLETE MEDIA INFO FOR LOCAL/TMDB
func (ns *NotificationService) CreateRandomMovieSuggestion() error {
	type MediaResult struct {
		ID              uint    `json:"id"`
		Title           string  `json:"title"`
		Rating          float64 `gorm:"column:rating"`
		Year            int     `gorm:"column:year"`
		Duration        int     `gorm:"column:duration"`
		ViewCount       int     `gorm:"column:view_count"`
		TMDBPosterURL   string  `gorm:"column:tmdb_poster_url"`
		TMDBBackdropURL string  `gorm:"column:tmdb_backdrop_url"`
		TMDBTrailerURL  string  `gorm:"column:tmdb_trailer_url"`
		Description     string  `gorm:"column:description"`
		GenreNames      string  `gorm:"column:genre_names"`
		CreatedAt       string  `gorm:"column:created_at"`
		LogoPath        string  `gorm:"column:logo_path"`
	}
	
	var movies []MediaResult
	
	// Smart curation: mix of recent additions, high-rated, and diverse genres
	query := `
		SELECT m.id, m.title, m.rating, m.year, m.duration, m.view_count,
		       m.tmdb_poster_url, m.tmdb_backdrop_url, m.tmdb_trailer_url, m.description, m.genre_names,
		       datetime(m.created_at) as created_at, m.logo_path
		FROM media m
		LEFT JOIN playback_progress p ON m.id = p.media_id
		WHERE m.type = 'movie' 
		AND m.tmdb_poster_url IS NOT NULL 
		AND m.tmdb_poster_url != ''
		AND m.tmdb_poster_url LIKE 'https://image.tmdb.org/t/p/%'
		AND m.file_path IS NOT NULL 
		AND m.file_path != ''
		AND m.rating >= 6.5
		AND m.duration > 3600
		AND (p.progress IS NULL OR p.progress < 15)
		ORDER BY 
			CASE 
				WHEN m.created_at > datetime('now', '-14 days') THEN 4
				WHEN m.created_at > datetime('now', '-30 days') THEN 3
				WHEN m.view_count = 0 THEN 2
				ELSE 1
			END DESC,
			m.rating DESC,
			RANDOM()
		LIMIT 8
	`
	
	err := ns.db.Raw(query).Scan(&movies).Error
	if err != nil || len(movies) == 0 {
		return fmt.Errorf("no valid movies with TMDB posters found")
	}

	// Validate each movie has valid TMDB poster and curate selection
	var validMovieIDs []uint
	var mediaDetails []NotificationMedia
	var totalRating float64
	recentCount := 0
	var primaryMovie MediaResult
	
	for i, movie := range movies {
		if strings.HasPrefix(movie.TMDBPosterURL, "https://image.tmdb.org/t/p/") {
			validMovieIDs = append(validMovieIDs, movie.ID)
			totalRating += movie.Rating
			
			if i == 0 {
				primaryMovie = movie // Use first movie as primary for notification title
			}
			
			// Check if recent
			if movie.CreatedAt != "" {
				if createdTime, err := time.Parse("2006-01-02 15:04:05", movie.CreatedAt); err == nil {
					if time.Since(createdTime).Hours() <= 30*24 { // 30 days
						recentCount++
					}
				}
			}
			
			// Build media details with complete info
			media := NotificationMedia{
				ID:          int(movie.ID),
				Title:       movie.Title,
				Rating:      movie.Rating,
				Year:        movie.Year,
				PosterURL:   movie.TMDBPosterURL,
				BackdropURL: movie.TMDBBackdropURL,
				Overview:    movie.Description,
				SourceType:  "local",
				SourceID:    fmt.Sprintf("%d", movie.ID),
			}
			
			if movie.Duration > 0 {
				media.Runtime = movie.Duration / 60
			}
			
			// Parse genres
			if movie.GenreNames != "" {
				var genres []string
				if err := json.Unmarshal([]byte(movie.GenreNames), &genres); err == nil {
					media.Genres = genres
				}
			}
			
			mediaDetails = append(mediaDetails, media)
			
			// Limit to 5 movies for better UX
			if len(validMovieIDs) >= 5 {
				break
			}
		}
	}
	
	if len(validMovieIDs) == 0 {
		return fmt.Errorf("no movies with valid TMDB posters")
	}

	// Create compelling message based on curation
	avgRating := totalRating / float64(len(validMovieIDs))
	var message string
	
	if recentCount > 0 && len(validMovieIDs) > 1 {
		message = fmt.Sprintf("%d handpicked movies for you - including %d recent additions! (Avg ⭐ %.1f)", len(validMovieIDs), recentCount, avgRating)
	} else if len(validMovieIDs) == 1 {
		message = fmt.Sprintf("Curated just for you: %s (⭐ %.1f)", primaryMovie.Title, primaryMovie.Rating)
	} else {
		message = fmt.Sprintf("%d carefully selected movies you'll love! (Avg ⭐ %.1f)", len(validMovieIDs), avgRating)
	}

	// Extract trailer key from primary movie
	trailerKey := ""
	if primaryMovie.TMDBTrailerURL != "" {
		trailerKey = ns.extractYouTubeKey(primaryMovie.TMDBTrailerURL)
	}

	// Build logo URL for primary movie
	logoURL := ""
	if primaryMovie.LogoPath != "" && primaryMovie.LogoPath != "null" {
		logoURL = fmt.Sprintf("/api/%s", primaryMovie.LogoPath)
	} else {
		logoURL = fmt.Sprintf("/api/admin/assets/logo_%d.png", primaryMovie.ID)
	}

	// Parse genres for primary movie
	var genres []string
	if primaryMovie.GenreNames != "" {
		json.Unmarshal([]byte(primaryMovie.GenreNames), &genres)
	}

	notification := Notification{
		ID:           fmt.Sprintf("curated_%d_%d", len(validMovieIDs), time.Now().Unix()),
		Type:         NotificationTypeMovieSuggestion,
		Title:        primaryMovie.Title, // ENSURE PROPER TITLE FROM PRIMARY MOVIE
		Message:      message,
		MovieIDs:     validMovieIDs,
		Timestamp:    time.Now().Unix(),
		Read:         false,
		Priority:     "high",
		Category:     "recommended",
		MediaDetails: mediaDetails,
		Rating:       avgRating,
		PosterURL:    primaryMovie.TMDBPosterURL,
		BackdropURL:  primaryMovie.TMDBBackdropURL,
		LogoURL:      logoURL,
		TrailerKey:   trailerKey,
		Overview:     primaryMovie.Description,
		Genres:       genres,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("🎬 Created curated movie collection: %s with %d movies (avg rating: %.1f, recent: %d)", primaryMovie.Title, len(validMovieIDs), avgRating, recentCount)
	return nil
}

// CreateNewMoviesNotification creates a notification for newly added movies
func (ns *NotificationService) CreateNewMoviesNotification(movieIDs []uint, count int) error {
	notification := Notification{
		ID:        fmt.Sprintf("notif_%d", time.Now().UnixNano()),
		Type:      NotificationTypeNewMovies,
		Title:     "New Movies Added",
		Message:   fmt.Sprintf("%d new movies have been added to the library!", count),
		MovieIDs:  movieIDs,
		Timestamp: time.Now().Unix(),
		Read:      false,
	}

	return ns.AddNotification(notification)
}

// AddNotification adds a notification to Redis with comprehensive duplicate prevention
func (ns *NotificationService) AddNotification(notification Notification) error {
	// Generate content keys for this notification
	contentKeys := ns.generateContentKey(notification)
	
	// Check if any of the content was recently used
	if len(contentKeys) > 0 && ns.isContentRecentlyUsed(contentKeys) {
		log.Printf("🔄 Skipping notification - content recently used: %s", notification.Title)
		return nil // Don't create notification, but don't return error
	}
	
	// Check for recent duplicates based on type and primary content
	key := ns.keyPrefix + "global"
	
	// Get recent notifications to check for duplicates
	recentResults, err := ns.client.ZRevRangeByScore(ns.ctx, key, &redis.ZRangeBy{
		Min: fmt.Sprintf("%d", time.Now().Unix()-3600), // Last hour
		Max: "+inf",
	}).Result()
	
	if err == nil {
		for _, result := range recentResults {
			var existingNotif Notification
			if err := json.Unmarshal([]byte(result), &existingNotif); err == nil {
				// Check for duplicates based on type and content
				if ns.isDuplicateNotification(notification, existingNotif) {
					log.Printf("🔄 Skipping duplicate notification: %s - %s", notification.Type, notification.Title)
					return nil
				}
			}
		}
	}

	// Serialize notification to JSON
	data, err := json.Marshal(notification)
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %w", err)
	}

	// Store in Redis sorted set (sorted by timestamp)
	err = ns.client.ZAdd(ns.ctx, key, &redis.Z{
		Score:  float64(notification.Timestamp),
		Member: string(data),
	}).Err()

	if err != nil {
		return fmt.Errorf("failed to add notification to Redis: %w", err)
	}

	// Mark content as used to prevent future duplicates
	if len(contentKeys) > 0 {
		ns.markContentAsUsed(contentKeys)
	}

	// Set TTL on the sorted set
	ns.client.Expire(ns.ctx, key, ns.ttl)

	// Trim to keep only the latest maxNotifications
	ns.client.ZRemRangeByRank(ns.ctx, key, 0, -int64(ns.maxNotifications+1))

	log.Printf("🔔 Added notification: %s - %s (Content: %v)", notification.Type, notification.Title, contentKeys)
	return nil
}

// isDuplicateNotification checks if two notifications are duplicates with enhanced content checking
func (ns *NotificationService) isDuplicateNotification(new, existing Notification) bool {
	// Same type check
	if new.Type != existing.Type {
		return false
	}
	
	// Check for exact content overlap (same movie/series/TMDB IDs)
	if ns.hasContentOverlap(new, existing) {
		log.Printf("🔍 Content overlap detected: %s vs %s", new.Title, existing.Title)
		return true
	}
	
	// Time-based duplicate prevention (within 30 minutes for same type)
	timeDiff := new.Timestamp - existing.Timestamp
	if timeDiff < 1800 { // 30 minutes
		switch new.Type {
		case NotificationTypeSingleMovie:
			// Same movie
			return len(new.MovieIDs) > 0 && len(existing.MovieIDs) > 0 && new.MovieIDs[0] == existing.MovieIDs[0]
		case NotificationTypeGenreBased:
			// Same genre
			return new.GenreHighlight == existing.GenreHighlight
		case NotificationTypeMovieSuggestion:
			// Similar movie collections (overlap > 50%)
			return ns.hasSignificantOverlap(new.MovieIDs, existing.MovieIDs)
		case NotificationTypeRecentlyAdded:
			// Same primary movie
			return len(new.MovieIDs) > 0 && len(existing.MovieIDs) > 0 && new.MovieIDs[0] == existing.MovieIDs[0]
		case NotificationTypeTMDBTrending, NotificationTypeTMDBNowPlaying:
			// Same TMDB movie
			return len(new.TMDBIDs) > 0 && len(existing.TMDBIDs) > 0 && new.TMDBIDs[0] == existing.TMDBIDs[0]
		case NotificationTypeContinueWatching:
			// Same primary movie
			return len(new.MovieIDs) > 0 && len(existing.MovieIDs) > 0 && new.MovieIDs[0] == existing.MovieIDs[0]
		}
	}
	
	return false
}

// hasContentOverlap checks if two notifications share any content
func (ns *NotificationService) hasContentOverlap(new, existing Notification) bool {
	// Check local movie IDs
	for _, newID := range new.MovieIDs {
		for _, existingID := range existing.MovieIDs {
			if newID == existingID {
				return true
			}
		}
	}
	
	// Check TMDB IDs
	for _, newID := range new.TMDBIDs {
		for _, existingID := range existing.TMDBIDs {
			if newID == existingID {
				return true
			}
		}
	}
	
	// Check series IDs
	if new.SeriesID > 0 && existing.SeriesID > 0 && new.SeriesID == existing.SeriesID {
		return true
	}
	
	return false
}

// hasSignificantOverlap checks if two movie ID slices have significant overlap
func (ns *NotificationService) hasSignificantOverlap(ids1, ids2 []uint) bool {
	if len(ids1) == 0 || len(ids2) == 0 {
		return false
	}
	
	overlap := 0
	for _, id1 := range ids1 {
		for _, id2 := range ids2 {
			if id1 == id2 {
				overlap++
				break
			}
		}
	}
	
	// Consider significant if overlap is > 50%
	minLength := len(ids1)
	if len(ids2) < minLength {
		minLength = len(ids2)
	}
	
	return float64(overlap)/float64(minLength) > 0.5
}

// GetNotifications retrieves the latest notifications with enhanced data
func (ns *NotificationService) GetNotifications(limit int) ([]Notification, error) {
	if limit <= 0 || limit > ns.maxNotifications {
		limit = ns.maxNotifications
	}

	key := ns.keyPrefix + "global"

	// Get notifications in reverse chronological order (newest first)
	results, err := ns.client.ZRevRange(ns.ctx, key, 0, int64(limit-1)).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch notifications from Redis: %w", err)
	}

	notifications := make([]Notification, 0, len(results))
	for _, result := range results {
		var notification Notification
		if err := json.Unmarshal([]byte(result), &notification); err != nil {
			log.Printf("⚠️ Failed to unmarshal notification: %v", err)
			continue
		}
		
		// Enhance notification with detailed data
		enhancedNotification := ns.enhanceNotificationWithData(notification)
		notifications = append(notifications, enhancedNotification)
	}

	return notifications, nil
}

// GetNotificationCount returns the total count of notifications
func (ns *NotificationService) GetNotificationCount() (int64, error) {
	key := ns.keyPrefix + "global"
	count, err := ns.client.ZCard(ns.ctx, key).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to get notification count: %w", err)
	}
	return count, nil
}

// MarkAsRead marks a notification as read (optional feature)
func (ns *NotificationService) MarkAsRead(notificationID string) error {
	// For now, we don't implement read/unread tracking in Redis
	// This can be added later if needed
	log.Printf("📖 Marked notification as read: %s", notificationID)
	return nil
}

// CreateNewEpisodesNotification creates a notification for newly added TV episodes
func (ns *NotificationService) CreateNewEpisodesNotification(seriesID uint, seriesName string, episodeIDs []uint, episodeCount int) error {
	notification := Notification{
		ID:         fmt.Sprintf("notif_%d", time.Now().UnixNano()),
		Type:       NotificationTypeNewEpisodes,
		Title:      "New Episodes Available",
		Message:    fmt.Sprintf("%d new episodes of %s are now available!", episodeCount, seriesName),
		SeriesID:   seriesID,
		SeriesName: seriesName,
		EpisodeIDs: episodeIDs,
		Timestamp:  time.Now().Unix(),
		Read:       false,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("📺 Created new episodes notification for %s (%d episodes)", seriesName, episodeCount)
	return nil
}

// CreateWatchAgainSuggestion creates a notification suggesting partially watched content
func (ns *NotificationService) CreateWatchAgainSuggestion() error {
	type PartiallyWatchedResult struct {
		ID       uint    `json:"id"`
		Title    string  `json:"title"`
		Type     string  `json:"type"`
		Progress float64 `json:"progress"`
	}

	var content []PartiallyWatchedResult

	// Find content that was started but not finished (10-90% watched)
	query := `
		SELECT m.id, m.title, m.type, p.progress
		FROM media m
		INNER JOIN playback_progress p ON m.id = p.media_id
		WHERE p.progress BETWEEN 10 AND 90
		AND m.poster_path IS NOT NULL
		AND p.last_watched_at < datetime('now', '-3 days')
		ORDER BY p.last_watched_at DESC
		LIMIT 5
	`

	err := ns.db.Raw(query).Scan(&content).Error
	if err != nil {
		return fmt.Errorf("failed to fetch partially watched content: %w", err)
	}

	if len(content) == 0 {
		log.Printf("⚠️ No partially watched content found for watch again suggestion")
		return nil
	}

	// Extract IDs
	mediaIDs := make([]uint, len(content))
	for i, item := range content {
		mediaIDs[i] = item.ID
	}

	notification := Notification{
		ID:        fmt.Sprintf("notif_%d", time.Now().UnixNano()),
		Type:      NotificationTypeWatchAgain,
		Title:     "Continue Watching",
		Message:   "Pick up where you left off!",
		MovieIDs:  mediaIDs,
		Timestamp: time.Now().Unix(),
		Read:      false,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("▶️ Created watch again suggestion with %d items", len(content))
	return nil
}

// CreateDownloadCompleteNotification creates a notification when a download finishes
func (ns *NotificationService) CreateDownloadCompleteNotification(title string, mediaID uint) error {
	// Skip creating notification if mediaID is 0 (media not scanned yet)
	// This prevents showing invalid/broken links in the notification dropdown
	if mediaID == 0 {
		log.Printf("⚠️ Skipping download notification for %s - media not scanned yet (ID: 0)", title)
		return nil
	}

	notification := Notification{
		ID:        fmt.Sprintf("notif_%d", time.Now().UnixNano()),
		Type:      NotificationTypeDownload,
		Title:     "Download Complete",
		Message:   fmt.Sprintf("%s is ready to watch!", title),
		MovieIDs:  []uint{mediaID},
		Timestamp: time.Now().Unix(),
		Read:      false,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("⬇️ Created download complete notification for %s (ID: %d)", title, mediaID)
	return nil
}

// CreateSingleMovieSuggestion creates a notification suggesting a single perfect match movie - ENHANCED WITH DUPLICATE PREVENTION
func (ns *NotificationService) CreateSingleMovieSuggestion() error {
	// Get list of recently used content to exclude
	ns.contentMutex.RLock()
	excludeIDs := make([]uint, 0)
	for key, lastUsed := range ns.usedContent {
		if strings.HasPrefix(key, "local_") && time.Since(lastUsed) < 2*time.Hour {
			if id := strings.TrimPrefix(key, "local_"); id != "" {
				if movieID, err := strconv.ParseUint(id, 10, 32); err == nil {
					excludeIDs = append(excludeIDs, uint(movieID))
				}
			}
		}
	}
	ns.contentMutex.RUnlock()
	
	type MediaResult struct {
		ID              uint    `json:"id"`
		Title           string  `json:"title"`
		Rating          float64 `gorm:"column:rating"`
		Year            int     `gorm:"column:year"`
		Duration        int     `gorm:"column:duration"`
		ViewCount       int     `gorm:"column:view_count"`
		TMDBPosterURL   string  `gorm:"column:tmdb_poster_url"`
		TMDBBackdropURL string  `gorm:"column:tmdb_backdrop_url"`
		TMDBTrailerURL  string  `gorm:"column:tmdb_trailer_url"`
		Description     string  `gorm:"column:description"`
		GenreNames      string  `gorm:"column:genre_names"`
		CreatedAt       string  `gorm:"column:created_at"`
		LogoPath        string  `gorm:"column:logo_path"`
	}
	
	var movies []MediaResult
	
	// Build exclusion clause
	excludeClause := ""
	if len(excludeIDs) > 0 {
		excludeIDsStr := make([]string, len(excludeIDs))
		for i, id := range excludeIDs {
			excludeIDsStr[i] = fmt.Sprintf("%d", id)
		}
		excludeClause = fmt.Sprintf("AND m.id NOT IN (%s)", strings.Join(excludeIDsStr, ","))
	}
	
	// Smart selection: prioritize recent, high-rated, unwatched movies, exclude recently used
	query := fmt.Sprintf(`
		SELECT m.id, m.title, m.rating, m.year, m.duration, m.view_count,
		       m.tmdb_poster_url, m.tmdb_backdrop_url, m.tmdb_trailer_url, m.description, m.genre_names,
		       datetime(m.created_at) as created_at, m.logo_path
		FROM media m
		LEFT JOIN playback_progress p ON m.id = p.media_id
		WHERE m.type = 'movie' 
		AND m.tmdb_poster_url IS NOT NULL 
		AND m.tmdb_poster_url != ''
		AND m.tmdb_poster_url LIKE 'https://image.tmdb.org/t/p/%%'
		AND m.file_path IS NOT NULL 
		AND m.file_path != ''
		AND m.rating >= 7.0
		AND m.duration > 5400
		AND (p.progress IS NULL OR p.progress < 10)
		%s
		ORDER BY 
			CASE 
				WHEN m.created_at > datetime('now', '-30 days') THEN 3
				WHEN m.created_at > datetime('now', '-90 days') THEN 2
				ELSE 1
			END DESC,
			(m.rating * 0.7 + (CASE WHEN m.view_count = 0 THEN 2 ELSE 0 END)) DESC,
			RANDOM()
		LIMIT 5
	`, excludeClause)
	
	err := ns.db.Raw(query).Scan(&movies).Error
	if err != nil || len(movies) == 0 {
		// Fallback to any high-quality movie, still excluding recently used
		fallbackQuery := fmt.Sprintf(`
			SELECT m.id, m.title, m.rating, m.year, m.duration, m.view_count,
			       m.tmdb_poster_url, m.tmdb_backdrop_url, m.tmdb_trailer_url, m.description, m.genre_names,
			       datetime(m.created_at) as created_at, m.logo_path
			FROM media m
			WHERE m.type = 'movie' 
			AND m.tmdb_poster_url IS NOT NULL 
			AND m.tmdb_poster_url LIKE 'https://image.tmdb.org/t/p/%%'
			AND m.file_path IS NOT NULL 
			AND m.file_path != ''
			AND m.rating >= 6.5
			%s
			ORDER BY m.rating DESC, RANDOM()
			LIMIT 1
		`, excludeClause)
		
		err = ns.db.Raw(fallbackQuery).Scan(&movies).Error
		if err != nil || len(movies) == 0 {
			return fmt.Errorf("no valid single movie with TMDB poster found (excluding %d recently used)", len(excludeIDs))
		}
	}

	movie := movies[0]
	
	// Validate TMDB poster URL
	if !strings.HasPrefix(movie.TMDBPosterURL, "https://image.tmdb.org/t/p/") {
		return fmt.Errorf("invalid TMDB poster URL")
	}

	// Create compelling message based on movie attributes
	var message string
	if movie.ViewCount == 0 {
		message = fmt.Sprintf("Hidden gem alert! %s (⭐ %.1f) - unwatched and highly rated", movie.Title, movie.Rating)
	} else if movie.CreatedAt != "" {
		if createdTime, err := time.Parse("2006-01-02 15:04:05", movie.CreatedAt); err == nil {
			daysSince := int(time.Since(createdTime).Hours() / 24)
			if daysSince <= 30 {
				message = fmt.Sprintf("Recently added gem: %s (⭐ %.1f) - added %d days ago", movie.Title, movie.Rating, daysSince)
			} else {
				message = fmt.Sprintf("Perfect match for you: %s (⭐ %.1f) - %d", movie.Title, movie.Rating, movie.Year)
			}
		} else {
			message = fmt.Sprintf("Perfect match for you: %s (⭐ %.1f)", movie.Title, movie.Rating)
		}
	} else {
		message = fmt.Sprintf("Perfect match for you: %s (⭐ %.1f)", movie.Title, movie.Rating)
	}

	// Parse genres for enhanced data
	var genres []string
	if movie.GenreNames != "" {
		json.Unmarshal([]byte(movie.GenreNames), &genres)
	}

	// Extract trailer key
	trailerKey := ""
	if movie.TMDBTrailerURL != "" {
		trailerKey = ns.extractYouTubeKey(movie.TMDBTrailerURL)
	}

	// Build logo URL
	logoURL := ""
	if movie.LogoPath != "" && movie.LogoPath != "null" {
		logoURL = fmt.Sprintf("/api/%s", movie.LogoPath)
	} else {
		// Try standard logo formats
		logoURL = fmt.Sprintf("/api/admin/assets/logo_%d.png", movie.ID)
	}

	notification := Notification{
		ID:          fmt.Sprintf("perfect_%d_%d", movie.ID, time.Now().Unix()),
		Type:        NotificationTypeSingleMovie,
		Title:       movie.Title, // ENSURE PROPER TITLE
		Message:     message,
		MovieIDs:    []uint{movie.ID},
		Timestamp:   time.Now().Unix(),
		Read:        false,
		Priority:    "high",
		Category:    "recommended",
		PosterURL:   movie.TMDBPosterURL,
		BackdropURL: movie.TMDBBackdropURL,
		LogoURL:     logoURL,
		TrailerKey:  trailerKey,
		Rating:      movie.Rating,
		Overview:    movie.Description,
		Genres:      genres,
		Runtime:     movie.Duration / 60,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("🎯 Created perfect match suggestion: %s (ID: %d, Rating: %.1f, Excluded: %d)", movie.Title, movie.ID, movie.Rating, len(excludeIDs))
	return nil
}

// CreateTMDBUpcomingMoviesNotification creates a notification for curated upcoming movies from TMDB with future release dates
func (ns *NotificationService) CreateTMDBUpcomingMoviesNotification() error {
	if ns.tmdbService == nil {
		log.Printf("⚠️ TMDB service not available for upcoming movies notification")
		return nil
	}

	// Fetch upcoming movies from multiple pages for better selection
	var allMovies []TMDBMovieWithVideos
	for page := 1; page <= 2; page++ {
		movies, err := ns.tmdbService.GetUpcomingMoviesList(page)
		if err != nil {
			log.Printf("⚠️ Failed to fetch upcoming movies page %d: %v", page, err)
			continue
		}
		allMovies = append(allMovies, movies...)
	}

	if len(allMovies) == 0 {
		log.Printf("⚠️ No upcoming movies found from TMDB")
		return nil
	}

	// Filter for movies with future release dates and good quality
	now := time.Now()
	var futureMovies []struct {
		movie     TMDBMovieWithVideos
		daysUntil int
	}

	for _, movie := range allMovies {
		// Quality filters
		if movie.VoteAverage < 6.0 || movie.Popularity < 40 || movie.Adult || movie.Title == "" || movie.ReleaseDate == "" {
			continue
		}

		// Check if release date is actually in the future
		if releaseTime, err := time.Parse("2006-01-02", movie.ReleaseDate); err == nil {
			diff := releaseTime.Sub(now)
			days := int(diff.Hours() / 24)
			
			// Only include movies releasing 1-180 days in the future
			if days > 0 && days <= 180 {
				futureMovies = append(futureMovies, struct {
					movie     TMDBMovieWithVideos
					daysUntil int
				}{movie, days})
			}
		}
	}

	if len(futureMovies) == 0 {
		log.Printf("⚠️ No high-quality upcoming movies with future release dates found")
		return nil
	}

	// Sort by rating and popularity, then limit to top selections
	sort.Slice(futureMovies, func(i, j int) bool {
		scoreI := futureMovies[i].movie.VoteAverage + (futureMovies[i].movie.Popularity / 100)
		scoreJ := futureMovies[j].movie.VoteAverage + (futureMovies[j].movie.Popularity / 100)
		return scoreI > scoreJ
	})

	// Select top 3-5 upcoming movies
	selectedCount := 5
	if len(futureMovies) < selectedCount {
		selectedCount = len(futureMovies)
	}

	var tmdbIDs []int
	var tmdbTitles []string
	var mediaDetails []NotificationMedia
	var totalDays int

	for i := 0; i < selectedCount; i++ {
		selected := futureMovies[i]
		movie := selected.movie
		
		tmdbIDs = append(tmdbIDs, movie.ID)
		tmdbTitles = append(tmdbTitles, movie.Title)
		totalDays += selected.daysUntil
		
		// Build media details
		media := NotificationMedia{
			ID:         movie.ID,
			Title:      movie.Title,
			Rating:     movie.VoteAverage,
			Overview:   movie.Overview,
			SourceType: "tmdb",
			SourceID:   fmt.Sprintf("%d", movie.ID),
		}
		
		if movie.PosterPath != "" {
			media.PosterURL = fmt.Sprintf("https://image.tmdb.org/t/p/w500%s", movie.PosterPath)
		}
		if movie.BackdropPath != "" {
			media.BackdropURL = fmt.Sprintf("https://image.tmdb.org/t/p/w1280%s", movie.BackdropPath)
		}
		if movie.ReleaseDate != "" {
			if year, err := time.Parse("2006-01-02", movie.ReleaseDate); err == nil {
				media.Year = year.Year()
			}
		}
		
		mediaDetails = append(mediaDetails, media)
	}

	// Create notification message
	avgDays := totalDays / selectedCount
	var message string
	if selectedCount == 1 {
		message = fmt.Sprintf("%s releases in %d days - highly anticipated!", tmdbTitles[0], futureMovies[0].daysUntil)
	} else {
		message = fmt.Sprintf("%d highly anticipated movies coming soon! (avg %d days)", selectedCount, avgDays)
	}

	// Get detailed info for the first movie (for backdrop, trailer, etc.)
	firstMovie := futureMovies[0].movie
	var backdropURL, posterURL, trailerKey string
	var rating float64
	var overview string
	
	if firstMovie.BackdropPath != "" {
		backdropURL = fmt.Sprintf("https://image.tmdb.org/t/p/w1280%s", firstMovie.BackdropPath)
	}
	if firstMovie.PosterPath != "" {
		posterURL = fmt.Sprintf("https://image.tmdb.org/t/p/w500%s", firstMovie.PosterPath)
	}
	rating = firstMovie.VoteAverage
	overview = firstMovie.Overview
	
	// Get trailer for the first movie
	if len(firstMovie.Videos.Results) > 0 {
		for _, video := range firstMovie.Videos.Results {
			if video.Site == "YouTube" && (video.Type == "Trailer" || video.Type == "Teaser") && video.Key != "" {
				trailerKey = video.Key
				break
			}
		}
	}

	notification := Notification{
		ID:           fmt.Sprintf("upcoming_%d_%d", selectedCount, time.Now().Unix()),
		Type:         NotificationTypeTMDBUpcoming,
		Title:        "Coming Soon to Theaters",
		Message:      message,
		TMDBIDs:      tmdbIDs,
		TMDBTitles:   tmdbTitles,
		Timestamp:    time.Now().Unix(),
		Read:         false,
		BackdropURL:  backdropURL,
		PosterURL:    posterURL,
		TrailerKey:   trailerKey,
		Rating:       rating,
		Overview:     overview,
		Priority:     "medium",
		Category:     "new",
		MediaDetails: mediaDetails,
		DaysUntil:    avgDays,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("🎬 Created upcoming movies notification with %d movies (avg %d days until release)", selectedCount, avgDays)
	return nil
}

// CreateTMDBTrendingMoviesNotification creates a notification for trending movies with duplicate prevention
func (ns *NotificationService) CreateTMDBTrendingMoviesNotification() error {
	if ns.tmdbService == nil {
		log.Printf("⚠️ TMDB service not available for trending movies notification")
		return nil
	}

	// Get list of recently used TMDB content to exclude
	ns.contentMutex.RLock()
	excludeTMDBIDs := make([]int, 0)
	for key, lastUsed := range ns.usedContent {
		if strings.HasPrefix(key, "tmdb_") && time.Since(lastUsed) < 2*time.Hour {
			if id := strings.TrimPrefix(key, "tmdb_"); id != "" {
				if tmdbID, err := strconv.Atoi(id); err == nil {
					excludeTMDBIDs = append(excludeTMDBIDs, tmdbID)
				}
			}
		}
	}
	ns.contentMutex.RUnlock()

	// Fetch popular movies (which are essentially trending)
	movies, err := ns.tmdbService.GetPopularMovies(1)
	if err != nil {
		return fmt.Errorf("failed to fetch trending movies from TMDB: %w", err)
	}

	if len(movies) == 0 {
		log.Printf("⚠️ No trending movies found from TMDB")
		return nil
	}

	// Smart curation: select top trending movies with high ratings, excluding recently used
	var curatedMovies []TMDBMovie
	var tmdbIDs []int
	var tmdbTitles []string
	var mediaDetails []NotificationMedia
	var primaryMovie TMDBMovie

	excludeMap := make(map[int]bool)
	for _, id := range excludeTMDBIDs {
		excludeMap[id] = true
	}

	for _, movie := range movies {
		// Skip if recently used
		if excludeMap[movie.ID] {
			continue
		}

		// High-quality trending criteria
		if movie.VoteAverage >= 7.0 && movie.Popularity >= 100 && !movie.Adult && movie.Title != "" {
			curatedMovies = append(curatedMovies, movie)
			tmdbIDs = append(tmdbIDs, movie.ID)
			tmdbTitles = append(tmdbTitles, movie.Title)
			
			if len(curatedMovies) == 1 {
				primaryMovie = movie // Use first movie as primary for notification title
			}
			
			// Build media details with poster URLs
			media := NotificationMedia{
				ID:         movie.ID,
				Title:      movie.Title,
				Rating:     movie.VoteAverage,
				Overview:   movie.Overview,
				SourceType: "tmdb",
				SourceID:   fmt.Sprintf("%d", movie.ID),
			}
			
			if movie.PosterPath != "" {
				media.PosterURL = fmt.Sprintf("https://image.tmdb.org/t/p/w500%s", movie.PosterPath)
			}
			if movie.BackdropPath != "" {
				media.BackdropURL = fmt.Sprintf("https://image.tmdb.org/t/p/w1280%s", movie.BackdropPath)
			}
			if movie.ReleaseDate != "" {
				if year, err := time.Parse("2006-01-02", movie.ReleaseDate); err == nil {
					media.Year = year.Year()
				}
			}
			
			mediaDetails = append(mediaDetails, media)
			
			// Limit to 4 top trending movies
			if len(curatedMovies) >= 4 {
				break
			}
		}
	}

	if len(curatedMovies) == 0 {
		log.Printf("⚠️ No high-quality trending movies found (excluded %d recently used)", len(excludeTMDBIDs))
		return nil
	}

	var message string
	if len(curatedMovies) == 1 {
		message = fmt.Sprintf("%s is trending worldwide! (⭐ %.1f)", tmdbTitles[0], primaryMovie.VoteAverage)
	} else {
		message = fmt.Sprintf("%d movies are trending worldwide right now!", len(curatedMovies))
	}

	// Get detailed info for the first movie (for backdrop, trailer, etc.)
	var backdropURL, posterURL, trailerKey string
	var rating float64
	var genres []string
	var overview string
	
	if len(curatedMovies) > 0 {
		firstMovie := curatedMovies[0]
		if firstMovie.BackdropPath != "" {
			backdropURL = fmt.Sprintf("https://image.tmdb.org/t/p/w1280%s", firstMovie.BackdropPath)
		}
		if firstMovie.PosterPath != "" {
			posterURL = fmt.Sprintf("https://image.tmdb.org/t/p/w500%s", firstMovie.PosterPath)
		}
		rating = firstMovie.VoteAverage
		overview = firstMovie.Overview
		
		// Fetch trailer for the first movie
		if details, err := ns.tmdbService.GetMovieDetailsWithExtras(firstMovie.ID); err == nil && details != nil {
			for _, video := range details.Videos.Results {
				if video.Site == "YouTube" && (video.Type == "Trailer" || video.Type == "Teaser") {
					trailerKey = video.Key
					break
				}
			}
			// Get genres
			for _, genre := range details.Genres {
				genres = append(genres, genre.Name)
			}
		}
	}

	notification := Notification{
		ID:           fmt.Sprintf("trending_%d_%d", len(curatedMovies), time.Now().Unix()),
		Type:         NotificationTypeTMDBTrending,
		Title:        primaryMovie.Title, // ENSURE PROPER TITLE FROM PRIMARY MOVIE
		Message:      message,
		TMDBIDs:      tmdbIDs,
		TMDBTitles:   tmdbTitles,
		Timestamp:    time.Now().Unix(),
		Read:         false,
		BackdropURL:  backdropURL,
		PosterURL:    posterURL,
		TrailerKey:   trailerKey,
		Rating:       rating,
		Genres:       genres,
		Overview:     overview,
		Priority:     "high",
		Category:     "trending",
		MediaDetails: mediaDetails,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("🔥 Created TMDB trending movies notification: %s with %d movies (excluded %d recently used)", primaryMovie.Title, len(curatedMovies), len(excludeTMDBIDs))
	return nil
}

// CreateTMDBUpcomingTVNotification creates a notification for upcoming TV series with full media details
func (ns *NotificationService) CreateTMDBUpcomingTVNotification() error {
	if ns.tmdbService == nil {
		log.Printf("⚠️ TMDB service not available for upcoming TV notification")
		return nil
	}

	// Fetch upcoming TV series (airing today and on the air)
	tvResponse, err := ns.tmdbService.GetUpcomingTVSeries()
	if err != nil {
		log.Printf("⚠️ Failed to fetch upcoming TV series: %v", err)
		return nil
	}

	if len(tvResponse.AiringToday) == 0 {
		log.Printf("⚠️ No upcoming TV series found from TMDB")
		return nil
	}

	// Smart curation for TV series
	var curatedSeries []TMDBTV
	var tmdbIDs []int
	var tmdbTitles []string
	var mediaDetails []NotificationMedia

	for _, series := range tvResponse.AiringToday {
		// Quality filters for TV series
		if series.VoteAverage >= 6.0 && series.Popularity >= 30 && series.Name != "" && series.FirstAirDate != "" {
			curatedSeries = append(curatedSeries, series)
			tmdbIDs = append(tmdbIDs, series.ID)
			tmdbTitles = append(tmdbTitles, series.Name)
			
			// Build media details with poster URLs
			media := NotificationMedia{
				ID:         series.ID,
				Title:      series.Name,
				Rating:     series.VoteAverage,
				Overview:   series.Overview,
				SourceType: "tmdb",
				SourceID:   fmt.Sprintf("%d", series.ID),
			}
			
			if series.PosterPath != "" {
				media.PosterURL = fmt.Sprintf("https://image.tmdb.org/t/p/w500%s", series.PosterPath)
			}
			if series.BackdropPath != "" {
				media.BackdropURL = fmt.Sprintf("https://image.tmdb.org/t/p/w1280%s", series.BackdropPath)
			}
			if series.FirstAirDate != "" {
				if year, err := time.Parse("2006-01-02", series.FirstAirDate); err == nil {
					media.Year = year.Year()
				}
			}
			
			mediaDetails = append(mediaDetails, media)
			
			// Limit to 3 high-quality TV series
			if len(curatedSeries) >= 3 {
				break
			}
		}
	}

	if len(curatedSeries) == 0 {
		log.Printf("⚠️ No high-quality upcoming TV series found")
		return nil
	}

	var message string
	if len(curatedSeries) == 1 {
		message = fmt.Sprintf("New episodes of %s are coming soon!", tmdbTitles[0])
	} else {
		message = fmt.Sprintf("%d exciting TV series have new episodes coming!", len(curatedSeries))
	}

	// Get detailed info for the first series (for backdrop, trailer, etc.)
	var backdropURL, posterURL, trailerKey string
	var rating float64
	var genres []string
	var overview string
	
	if len(curatedSeries) > 0 {
		firstSeries := curatedSeries[0]
		if firstSeries.BackdropPath != "" {
			backdropURL = fmt.Sprintf("https://image.tmdb.org/t/p/w1280%s", firstSeries.BackdropPath)
		}
		if firstSeries.PosterPath != "" {
			posterURL = fmt.Sprintf("https://image.tmdb.org/t/p/w500%s", firstSeries.PosterPath)
		}
		rating = firstSeries.VoteAverage
		overview = firstSeries.Overview
		
		// Fetch trailer for the first series
		if details, err := ns.tmdbService.GetTVDetails(firstSeries.ID); err == nil && details != nil {
			for _, video := range details.Videos.Results {
				if video.Site == "YouTube" && (video.Type == "Trailer" || video.Type == "Teaser") {
					trailerKey = video.Key
					break
				}
			}
			// Get genres
			for _, genre := range details.Genres {
				genres = append(genres, genre.Name)
			}
		}
	}

	notification := Notification{
		ID:           fmt.Sprintf("notif_%d", time.Now().UnixNano()),
		Type:         NotificationTypeTMDBUpcomingTV,
		Title:        "New Episodes Coming",
		Message:      message,
		TMDBIDs:      tmdbIDs,
		TMDBTitles:   tmdbTitles,
		Timestamp:    time.Now().Unix(),
		Read:         false,
		BackdropURL:  backdropURL,
		PosterURL:    posterURL,
		TrailerKey:   trailerKey,
		Rating:       rating,
		Genres:       genres,
		Overview:     overview,
		Priority:     "medium",
		Category:     "new",
		MediaDetails: mediaDetails,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("📺 Created TMDB upcoming TV notification with %d series (trailer: %s)", len(curatedSeries), trailerKey != "")
	return nil
}

// CreateTMDBNowAiringTVNotification creates a notification for currently airing TV series with full media details
func (ns *NotificationService) CreateTMDBNowAiringTVNotification() error {
	if ns.tmdbService == nil {
		log.Printf("⚠️ TMDB service not available for now airing TV notification")
		return nil
	}

	// Fetch currently airing TV series
	tvResponse, err := ns.tmdbService.GetUpcomingTVSeries()
	if err != nil {
		log.Printf("⚠️ Failed to fetch on-the-air TV series: %v", err)
		return nil
	}

	if len(tvResponse.OnTheAir) == 0 {
		log.Printf("⚠️ No currently airing TV series found from TMDB")
		return nil
	}

	// Smart curation for currently airing series
	var curatedSeries []TMDBTV
	var tmdbIDs []int
	var tmdbTitles []string
	var mediaDetails []NotificationMedia

	for _, series := range tvResponse.OnTheAir {
		// Quality filters for currently airing series
		if series.VoteAverage >= 7.0 && series.Popularity >= 50 && series.Name != "" {
			curatedSeries = append(curatedSeries, series)
			tmdbIDs = append(tmdbIDs, series.ID)
			tmdbTitles = append(tmdbTitles, series.Name)
			
			// Build media details with poster URLs
			media := NotificationMedia{
				ID:         series.ID,
				Title:      series.Name,
				Rating:     series.VoteAverage,
				Overview:   series.Overview,
				SourceType: "tmdb",
				SourceID:   fmt.Sprintf("%d", series.ID),
			}
			
			if series.PosterPath != "" {
				media.PosterURL = fmt.Sprintf("https://image.tmdb.org/t/p/w500%s", series.PosterPath)
			}
			if series.BackdropPath != "" {
				media.BackdropURL = fmt.Sprintf("https://image.tmdb.org/t/p/w1280%s", series.BackdropPath)
			}
			if series.FirstAirDate != "" {
				if year, err := time.Parse("2006-01-02", series.FirstAirDate); err == nil {
					media.Year = year.Year()
				}
			}
			
			mediaDetails = append(mediaDetails, media)
			
			// Limit to 3 top airing series
			if len(curatedSeries) >= 3 {
				break
			}
		}
	}

	if len(curatedSeries) == 0 {
		log.Printf("⚠️ No high-quality currently airing TV series found")
		return nil
	}

	var message string
	if len(curatedSeries) == 1 {
		message = fmt.Sprintf("%s has new episodes airing now!", tmdbTitles[0])
	} else {
		message = fmt.Sprintf("%d popular series are currently airing new episodes!", len(curatedSeries))
	}

	// Get detailed info for the first series (for backdrop, trailer, etc.)
	var backdropURL, posterURL, trailerKey string
	var rating float64
	var genres []string
	var overview string
	
	if len(curatedSeries) > 0 {
		firstSeries := curatedSeries[0]
		if firstSeries.BackdropPath != "" {
			backdropURL = fmt.Sprintf("https://image.tmdb.org/t/p/w1280%s", firstSeries.BackdropPath)
		}
		if firstSeries.PosterPath != "" {
			posterURL = fmt.Sprintf("https://image.tmdb.org/t/p/w500%s", firstSeries.PosterPath)
		}
		rating = firstSeries.VoteAverage
		overview = firstSeries.Overview
		
		// Fetch trailer for the first series
		if details, err := ns.tmdbService.GetTVDetails(firstSeries.ID); err == nil && details != nil {
			for _, video := range details.Videos.Results {
				if video.Site == "YouTube" && (video.Type == "Trailer" || video.Type == "Teaser") {
					trailerKey = video.Key
					break
				}
			}
			// Get genres
			for _, genre := range details.Genres {
				genres = append(genres, genre.Name)
			}
		}
	}

	notification := Notification{
		ID:           fmt.Sprintf("notif_%d", time.Now().UnixNano()),
		Type:         NotificationTypeTMDBNowAiringTV,
		Title:        "Now Airing",
		Message:      message,
		TMDBIDs:      tmdbIDs,
		TMDBTitles:   tmdbTitles,
		Timestamp:    time.Now().Unix(),
		Read:         false,
		BackdropURL:  backdropURL,
		PosterURL:    posterURL,
		TrailerKey:   trailerKey,
		Rating:       rating,
		Genres:       genres,
		Overview:     overview,
		Priority:     "high",
		Category:     "trending",
		MediaDetails: mediaDetails,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("📺 Created TMDB now airing TV notification with %d series (trailer: %s)", len(curatedSeries), trailerKey != "")
	return nil
}

// CreateTMDBUpcomingMovieNotification creates a notification for the first upcoming movie from TMDB (legacy method - kept for compatibility)
func (ns *NotificationService) CreateTMDBUpcomingMovieNotification() error {
	if ns.tmdbService == nil {
		log.Printf("⚠️ TMDB service not available for upcoming movie notification")
		return nil
	}

	// Fetch upcoming movies from TMDB (first page)
	movies, err := ns.tmdbService.GetUpcomingMoviesList(1)
	if err != nil {
		return fmt.Errorf("failed to fetch upcoming movies from TMDB: %w", err)
	}

	if len(movies) == 0 {
		log.Printf("⚠️ No upcoming movies found from TMDB")
		return nil
	}

	// Get a high-quality upcoming movie (not just the first one)
	var selectedMovie TMDBMovieWithVideos
	found := false
	for _, movie := range movies {
		if movie.VoteAverage >= 6.5 && movie.Popularity >= 50 && !movie.Adult {
			selectedMovie = movie
			found = true
			break
		}
	}

	// Fallback to first movie if no high-quality one found
	if !found {
		selectedMovie = movies[0]
	}

	notification := Notification{
		ID:         fmt.Sprintf("notif_%d", time.Now().UnixNano()),
		Type:       NotificationTypeTMDBUpcoming,
		Title:      "Upcoming Movie",
		Message:    fmt.Sprintf("%s is coming soon!", selectedMovie.Title),
		TMDBIDs:    []int{selectedMovie.ID},
		TMDBTitles: []string{selectedMovie.Title},
		Timestamp:  time.Now().Unix(),
		Read:       false,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("🎬 Created TMDB upcoming movie notification: %s", selectedMovie.Title)
	return nil
}

// CreateTMDBNowPlayingNotification creates a notification for now playing movies with duplicate prevention
func (ns *NotificationService) CreateTMDBNowPlayingNotification() error {
	if ns.tmdbService == nil {
		log.Printf("⚠️ TMDB service not available for now playing notification")
		return nil
	}

	// Get list of recently used TMDB content to exclude
	ns.contentMutex.RLock()
	excludeTMDBIDs := make([]int, 0)
	for key, lastUsed := range ns.usedContent {
		if strings.HasPrefix(key, "tmdb_") && time.Since(lastUsed) < 2*time.Hour {
			if id := strings.TrimPrefix(key, "tmdb_"); id != "" {
				if tmdbID, err := strconv.Atoi(id); err == nil {
					excludeTMDBIDs = append(excludeTMDBIDs, tmdbID)
				}
			}
		}
	}
	ns.contentMutex.RUnlock()

	// Fetch now playing movies from TMDB (first page)
	movies, err := ns.tmdbService.GetNowPlayingMovies(1)
	if err != nil {
		return fmt.Errorf("failed to fetch now playing movies from TMDB: %w", err)
	}

	if len(movies) == 0 {
		log.Printf("⚠️ No now playing movies found from TMDB")
		return nil
	}

	// Create exclusion map for faster lookup
	excludeMap := make(map[int]bool)
	for _, id := range excludeTMDBIDs {
		excludeMap[id] = true
	}

	// Smart selection: get a high-quality now playing movie that hasn't been used recently
	var selectedMovie TMDBMovieWithVideos
	found := false
	for _, movie := range movies {
		// Skip if recently used
		if excludeMap[movie.ID] {
			continue
		}

		if movie.VoteAverage >= 7.0 && movie.Popularity >= 100 && !movie.Adult {
			selectedMovie = movie
			found = true
			break
		}
	}

	// Fallback to first unused movie if no high-quality one found
	if !found {
		for _, movie := range movies {
			if !excludeMap[movie.ID] {
				selectedMovie = movie
				found = true
				break
			}
		}
	}

	if !found {
		return fmt.Errorf("no suitable now playing movie found (excluded %d recently used)", len(excludeTMDBIDs))
	}

	// Get trailer key from videos
	trailerKey := ""
	if len(selectedMovie.Videos.Results) > 0 {
		for _, video := range selectedMovie.Videos.Results {
			if video.Site == "YouTube" && (video.Type == "Trailer" || video.Type == "Teaser") && video.Key != "" {
				trailerKey = video.Key
				break
			}
		}
	}

	// Build poster and backdrop URLs
	posterURL := ""
	backdropURL := ""
	if selectedMovie.PosterPath != "" {
		posterURL = fmt.Sprintf("https://image.tmdb.org/t/p/w500%s", selectedMovie.PosterPath)
	}
	if selectedMovie.BackdropPath != "" {
		backdropURL = fmt.Sprintf("https://image.tmdb.org/t/p/w1280%s", selectedMovie.BackdropPath)
	}

	notification := Notification{
		ID:          fmt.Sprintf("now_playing_%d_%d", selectedMovie.ID, time.Now().Unix()),
		Type:        NotificationTypeTMDBNowPlaying,
		Title:       selectedMovie.Title, // ENSURE PROPER TITLE FROM TMDB MOVIE
		Message:     fmt.Sprintf("%s is now playing and getting great reviews! (⭐ %.1f)", selectedMovie.Title, selectedMovie.VoteAverage),
		TMDBIDs:     []int{selectedMovie.ID},
		TMDBTitles:  []string{selectedMovie.Title},
		Timestamp:   time.Now().Unix(),
		Read:        false,
		Priority:    "high",
		Category:    "trending",
		PosterURL:   posterURL,
		BackdropURL: backdropURL,
		TrailerKey:  trailerKey,
		Rating:      selectedMovie.VoteAverage,
		Overview:    selectedMovie.Overview,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("🎥 Created TMDB now playing notification: %s (excluded %d recently used)", selectedMovie.Title, len(excludeTMDBIDs))
	return nil
}

// Close closes the Redis connection
func (ns *NotificationService) Close() error {
	ns.Stop()
	return ns.client.Close()
}

// enhanceNotificationWithData adds detailed information to notifications
func (ns *NotificationService) enhanceNotificationWithData(notification Notification) Notification {
	// Set priority and category based on type and age
	hoursSinceCreated := float64(time.Now().Unix()-notification.Timestamp) / 3600.0
	
	switch notification.Type {
	case NotificationTypeTMDBNowPlaying, NotificationTypeTMDBTrending:
		if hoursSinceCreated < 24 {
			notification.Priority = "high"
		} else {
			notification.Priority = "medium"
		}
		notification.Category = "trending"
	case NotificationTypeTMDBUpcoming, NotificationTypeTMDBUpcomingTV:
		notification.Priority = "medium"
		notification.Category = "new"
	case NotificationTypeTMDBNowAiringTV:
		if hoursSinceCreated < 12 {
			notification.Priority = "high"
		} else {
			notification.Priority = "medium"
		}
		notification.Category = "trending"
	case NotificationTypeMovieSuggestion, NotificationTypeSingleMovie:
		notification.Priority = "medium"
		notification.Category = "recommended"
	case NotificationTypeWatchAgain:
		notification.Priority = "low"
		notification.Category = "watchlist"
	case NotificationTypeNewEpisodes, NotificationTypeNewMovies:
		if hoursSinceCreated < 12 {
			notification.Priority = "high"
		} else {
			notification.Priority = "medium"
		}
		notification.Category = "new"
	default:
		notification.Priority = "medium"
		notification.Category = "new"
	}

	// Enhance with TMDB data if available
	if len(notification.TMDBIDs) > 0 && ns.tmdbService != nil {
		ns.enhanceWithTMDBData(&notification)
	}

	// Enhance with local media data if available
	if len(notification.MovieIDs) > 0 {
		ns.enhanceWithLocalMediaData(&notification)
	}

	return notification
}

// enhanceWithTMDBData adds TMDB details to notification - USES TMDB SERVICE CACHE WITH COMPLETE MEDIA INFO
func (ns *NotificationService) enhanceWithTMDBData(notification *Notification) {
	if len(notification.TMDBIDs) == 0 || ns.tmdbService == nil {
		return
	}

	// Get details for the first/primary movie
	primaryTMDBID := notification.TMDBIDs[0]
	
	// Determine if it's TV or movie
	isTV := notification.Type == NotificationTypeTMDBUpcomingTV || notification.Type == NotificationTypeTMDBNowAiringTV
	
	if isTV {
		// Use TMDB service which has caching
		tvDetails, err := ns.tmdbService.GetTVDetails(primaryTMDBID)
		if err != nil {
			log.Printf("⚠️ Failed to fetch TMDB TV details for %d: %v", primaryTMDBID, err)
			return
		}

		// ENSURE NOTIFICATION HAS PROPER TITLE - use TMDB title if notification title is generic
		if notification.Title == "" || strings.Contains(strings.ToLower(notification.Title), "notification") {
			notification.Title = tvDetails.Name
			log.Printf("🏷️ Set notification title from TMDB TV: %s", tvDetails.Name)
		}

		// STRICT VALIDATION - only set if valid
		if tvDetails.BackdropPath != "" && !strings.Contains(tvDetails.BackdropPath, "null") {
			notification.BackdropURL = fmt.Sprintf("https://image.tmdb.org/t/p/w1280%s", tvDetails.BackdropPath)
		}
		
		if tvDetails.PosterPath != "" && !strings.Contains(tvDetails.PosterPath, "null") {
			notification.PosterURL = fmt.Sprintf("https://image.tmdb.org/t/p/w500%s", tvDetails.PosterPath)
		}
		
		notification.Overview = tvDetails.Overview
		notification.Rating = tvDetails.VoteAverage
		notification.ReleaseDate = tvDetails.FirstAirDate
		if len(tvDetails.EpisodeRunTime) > 0 {
			notification.Runtime = tvDetails.EpisodeRunTime[0]
		}
		notification.Language = tvDetails.OriginalLanguage
		notification.Popularity = tvDetails.Popularity

		// Extract genre names
		var genres []string
		for _, genre := range tvDetails.Genres {
			genres = append(genres, genre.Name)
		}
		notification.Genres = genres

		// Extract production company names
		var companies []string
		for _, company := range tvDetails.ProductionCompanies {
			companies = append(companies, company.Name)
		}
		notification.Companies = companies

		// Get trailer key from videos - VALIDATED
		if len(tvDetails.Videos.Results) > 0 {
			for _, video := range tvDetails.Videos.Results {
				if video.Type == "Trailer" && video.Site == "YouTube" && video.Key != "" {
					notification.TrailerKey = video.Key
					log.Printf("🎬 TMDB TV trailer found: %s", video.Key)
					break
				}
			}
		}
	} else {
		// Use TMDB service which has caching
		movieDetails, err := ns.tmdbService.GetMovieDetails(primaryTMDBID)
		if err != nil {
			log.Printf("⚠️ Failed to fetch TMDB movie details for %d: %v", primaryTMDBID, err)
			return
		}

		// ENSURE NOTIFICATION HAS PROPER TITLE - use TMDB title if notification title is generic
		if notification.Title == "" || strings.Contains(strings.ToLower(notification.Title), "notification") {
			notification.Title = movieDetails.Title
			log.Printf("🏷️ Set notification title from TMDB movie: %s", movieDetails.Title)
		}

		// STRICT VALIDATION - only set if valid
		if movieDetails.BackdropPath != "" && !strings.Contains(movieDetails.BackdropPath, "null") {
			notification.BackdropURL = fmt.Sprintf("https://image.tmdb.org/t/p/w1280%s", movieDetails.BackdropPath)
		}
		
		if movieDetails.PosterPath != "" && !strings.Contains(movieDetails.PosterPath, "null") {
			notification.PosterURL = fmt.Sprintf("https://image.tmdb.org/t/p/w500%s", movieDetails.PosterPath)
		}
		
		notification.Overview = movieDetails.Overview
		notification.Rating = movieDetails.VoteAverage
		notification.ReleaseDate = movieDetails.ReleaseDate
		notification.Runtime = movieDetails.Runtime
		notification.Tagline = movieDetails.Tagline
		notification.Language = movieDetails.OriginalLanguage
		notification.Popularity = movieDetails.Popularity

		// Extract genre names
		var genres []string
		for _, genre := range movieDetails.Genres {
			genres = append(genres, genre.Name)
		}
		notification.Genres = genres

		// Extract production company names
		var companies []string
		for _, company := range movieDetails.ProductionCompanies {
			companies = append(companies, company.Name)
		}
		notification.Companies = companies
		
		// Fetch trailer separately with validation - uses TMDB service cache
		if detailsWithVideos, err := ns.tmdbService.GetMovieDetailsWithExtras(primaryTMDBID); err == nil && detailsWithVideos != nil {
			for _, video := range detailsWithVideos.Videos.Results {
				if video.Site == "YouTube" && (video.Type == "Trailer" || video.Type == "Teaser") && video.Key != "" {
					notification.TrailerKey = video.Key
					log.Printf("🎬 TMDB movie trailer found: %s", video.Key)
					break
				}
			}
		}
	}

	// For multi-movie notifications, get details for all movies - uses TMDB service cache WITH COMPLETE INFO
	if len(notification.TMDBIDs) > 1 {
		var mediaDetails []NotificationMedia
		for _, tmdbID := range notification.TMDBIDs {
			media := NotificationMedia{
				ID:         tmdbID,
				SourceType: "tmdb",
				SourceID:   fmt.Sprintf("%d", tmdbID),
			}

			if isTV {
				tvDetails, err := ns.tmdbService.GetTVDetails(tmdbID)
				if err != nil {
					log.Printf("⚠️ Failed to fetch TMDB TV details for %d: %v", tmdbID, err)
					continue
				}

				media.Title = tvDetails.Name
				// STRICT VALIDATION
				if tvDetails.PosterPath != "" && !strings.Contains(tvDetails.PosterPath, "null") {
					media.PosterURL = fmt.Sprintf("https://image.tmdb.org/t/p/w500%s", tvDetails.PosterPath)
				}
				if tvDetails.BackdropPath != "" && !strings.Contains(tvDetails.BackdropPath, "null") {
					media.BackdropURL = fmt.Sprintf("https://image.tmdb.org/t/p/w1280%s", tvDetails.BackdropPath)
				}
				media.Rating = tvDetails.VoteAverage
				if tvDetails.FirstAirDate != "" {
					if year, err := time.Parse("2006-01-02", tvDetails.FirstAirDate); err == nil {
						media.Year = year.Year()
					}
				}
				if len(tvDetails.EpisodeRunTime) > 0 {
					media.Runtime = tvDetails.EpisodeRunTime[0]
				}
				media.Overview = tvDetails.Overview

				// Extract genres
				var genres []string
				for _, genre := range tvDetails.Genres {
					genres = append(genres, genre.Name)
				}
				media.Genres = genres
			} else {
				movieDetails, err := ns.tmdbService.GetMovieDetails(tmdbID)
				if err != nil {
					log.Printf("⚠️ Failed to fetch TMDB movie details for %d: %v", tmdbID, err)
					continue
				}

				media.Title = movieDetails.Title
				// STRICT VALIDATION
				if movieDetails.PosterPath != "" && !strings.Contains(movieDetails.PosterPath, "null") {
					media.PosterURL = fmt.Sprintf("https://image.tmdb.org/t/p/w500%s", movieDetails.PosterPath)
				}
				if movieDetails.BackdropPath != "" && !strings.Contains(movieDetails.BackdropPath, "null") {
					media.BackdropURL = fmt.Sprintf("https://image.tmdb.org/t/p/w1280%s", movieDetails.BackdropPath)
				}
				media.Rating = movieDetails.VoteAverage
				if movieDetails.ReleaseDate != "" {
					if year, err := time.Parse("2006-01-02", movieDetails.ReleaseDate); err == nil {
						media.Year = year.Year()
					}
				}
				media.Runtime = movieDetails.Runtime
				media.Overview = movieDetails.Overview

				// Extract genres
				var genres []string
				for _, genre := range movieDetails.Genres {
					genres = append(genres, genre.Name)
				}
				media.Genres = genres
			}
			
			// Only add if has valid poster URL AND title
			if media.PosterURL != "" && media.Title != "" {
				mediaDetails = append(mediaDetails, media)
			}
		}
		notification.MediaDetails = mediaDetails
		
		log.Printf("📊 Enhanced TMDB notification with %d media items for: %s", len(mediaDetails), notification.Title)
	} else {
		log.Printf("🎬 Enhanced single TMDB notification: %s (ID: %d)", notification.Title, primaryTMDBID)
	}
}

// enhanceWithLocalMediaData adds local media details to notification - STRICT VALIDATION WITH COMPLETE MEDIA INFO
func (ns *NotificationService) enhanceWithLocalMediaData(notification *Notification) {
	if len(notification.MovieIDs) == 0 {
		return
	}

	// Get details for the first/primary movie
	primaryMovieID := notification.MovieIDs[0]
	
	type MediaResult struct {
		ID                uint    `gorm:"column:id"`
		Title             string  `gorm:"column:title"`
		Description       string  `gorm:"column:description"`
		PosterPath        string  `gorm:"column:poster_path"`
		BackdropPath      string  `gorm:"column:backdrop_path"`
		TMDBBackdropURL   string  `gorm:"column:tmdb_backdrop_url"`
		TMDBPosterURL     string  `gorm:"column:tmdb_poster_url"`
		TMDBTrailerURL    string  `gorm:"column:tmdb_trailer_url"`
		LogoPath          string  `gorm:"column:logo_path"`
		Rating            float64 `gorm:"column:rating"`
		Year              int     `gorm:"column:year"`
		Duration          int     `gorm:"column:duration"`
		GenreNames        string  `gorm:"column:genre_names"`
		ReleaseDate       string  `gorm:"column:release_date"`
		Tagline           string  `gorm:"column:tagline"`
		ViewCount         int     `gorm:"column:view_count"`
		FilePath          string  `gorm:"column:file_path"`
		Type              string  `gorm:"column:type"`
		SeriesID          uint    `gorm:"column:series_id"`
		SeasonNumber      int     `gorm:"column:season_number"`
		EpisodeNumber     int     `gorm:"column:episode_number"`
	}
	
	var media MediaResult
	err := ns.db.Table("media").Where("id = ? AND file_path IS NOT NULL AND file_path != ''", primaryMovieID).First(&media).Error
	if err != nil {
		log.Printf("⚠️ Failed to fetch local media details for %d: %v", primaryMovieID, err)
		return
	}

	// ENSURE NOTIFICATION HAS PROPER TITLE - use media title if notification title is generic
	if notification.Title == "" || strings.Contains(strings.ToLower(notification.Title), "notification") {
		notification.Title = media.Title
		log.Printf("🏷️ Set notification title from media: %s", media.Title)
	}

	// STRICT VALIDATION - only use TMDB URLs that are complete and valid
	if media.TMDBBackdropURL != "" && 
	   strings.HasPrefix(media.TMDBBackdropURL, "https://image.tmdb.org/t/p/") &&
	   !strings.Contains(media.TMDBBackdropURL, "null") {
		notification.BackdropURL = media.TMDBBackdropURL
	}
	
	// STRICT POSTER VALIDATION - only use valid TMDB poster URLs
	if media.TMDBPosterURL != "" && 
	   strings.HasPrefix(media.TMDBPosterURL, "https://image.tmdb.org/t/p/") &&
	   !strings.Contains(media.TMDBPosterURL, "null") &&
	   !ns.failedPosters[media.TMDBPosterURL] {
		notification.PosterURL = media.TMDBPosterURL
	} else if media.PosterPath != "" && media.PosterPath != "null" {
		posterURL := fmt.Sprintf("/api/posters/%d", media.ID)
		if !ns.failedPosters[posterURL] {
			notification.PosterURL = posterURL
		}
	}
	
	// LOGO URL CONSTRUCTION - try multiple formats for better logo discovery
	if media.LogoPath != "" && media.LogoPath != "null" && !strings.Contains(media.LogoPath, "null") {
		// Use existing logo path
		notification.LogoURL = fmt.Sprintf("/api/%s", media.LogoPath)
	} else {
		// Try standard logo formats
		logoFormats := []string{
			fmt.Sprintf("/api/admin/assets/logo_%d.png", media.ID),
			fmt.Sprintf("/api/admin/assets/logo_%d.jpg", media.ID),
			fmt.Sprintf("/api/admin/assets/logo_%d.svg", media.ID),
			fmt.Sprintf("/api/logo_path/%d", media.ID),
		}
		
		// Use first format as default - frontend will handle fallbacks
		notification.LogoURL = logoFormats[0]
	}
	
	// Extract trailer key from URL for local media
	if media.TMDBTrailerURL != "" && media.TMDBTrailerURL != "null" && !strings.Contains(media.TMDBTrailerURL, "null") {
		notification.TrailerKey = ns.extractYouTubeKey(media.TMDBTrailerURL)
		if notification.TrailerKey != "" {
			log.Printf("🎬 Local media trailer found for '%s': %s", media.Title, notification.TrailerKey)
		}
	}
	
	notification.Rating = media.Rating
	notification.ReleaseDate = media.ReleaseDate
	if notification.ReleaseDate == "" && media.Year > 0 {
		notification.ReleaseDate = fmt.Sprintf("%d-01-01", media.Year)
	}
	
	if media.Duration > 0 {
		notification.Runtime = media.Duration / 60 // Convert seconds to minutes
	}
	
	notification.Overview = media.Description
	notification.Tagline = media.Tagline
	notification.Language = "en"
	notification.Popularity = float64(media.ViewCount)

	// Parse genres from JSON string
	if media.GenreNames != "" && media.GenreNames != "null" && media.GenreNames != "[]" {
		var genres []string
		if err := json.Unmarshal([]byte(media.GenreNames), &genres); err == nil {
			notification.Genres = genres
		}
	}

	// For multi-movie notifications, get details for all movies - STRICT VALIDATION WITH COMPLETE INFO
	if len(notification.MovieIDs) > 1 {
		var mediaDetails []NotificationMedia
		for _, movieID := range notification.MovieIDs {
			var movieMedia MediaResult
			if err := ns.db.Table("media").Where("id = ? AND file_path IS NOT NULL AND file_path != ''", movieID).First(&movieMedia).Error; err != nil {
				log.Printf("⚠️ Skipping invalid media %d: %v", movieID, err)
				continue
			}

			mediaItem := NotificationMedia{
				ID:         int(movieMedia.ID),
				Title:      movieMedia.Title,
				SourceType: "local",
				SourceID:   fmt.Sprintf("%d", movieMedia.ID),
				Rating:     movieMedia.Rating,
				Year:       movieMedia.Year,
				Overview:   movieMedia.Description,
			}
			
			// STRICT POSTER VALIDATION
			if movieMedia.TMDBPosterURL != "" && 
			   strings.HasPrefix(movieMedia.TMDBPosterURL, "https://image.tmdb.org/t/p/") &&
			   !strings.Contains(movieMedia.TMDBPosterURL, "null") &&
			   !ns.failedPosters[movieMedia.TMDBPosterURL] {
				mediaItem.PosterURL = movieMedia.TMDBPosterURL
			} else if movieMedia.PosterPath != "" && movieMedia.PosterPath != "null" {
				posterURL := fmt.Sprintf("/api/posters/%d", movieMedia.ID)
				if !ns.failedPosters[posterURL] {
					mediaItem.PosterURL = posterURL
				}
			}
			
			// STRICT BACKDROP VALIDATION
			if movieMedia.TMDBBackdropURL != "" && 
			   strings.HasPrefix(movieMedia.TMDBBackdropURL, "https://image.tmdb.org/t/p/") &&
			   !strings.Contains(movieMedia.TMDBBackdropURL, "null") {
				mediaItem.BackdropURL = movieMedia.TMDBBackdropURL
			}
			
			if movieMedia.Duration > 0 {
				mediaItem.Runtime = movieMedia.Duration / 60
			}

			// Parse genres
			if movieMedia.GenreNames != "" && movieMedia.GenreNames != "null" && movieMedia.GenreNames != "[]" {
				var genres []string
				if err := json.Unmarshal([]byte(movieMedia.GenreNames), &genres); err == nil {
					mediaItem.Genres = genres
				}
			}
			
			// Only add if has valid poster OR is the primary media
			if mediaItem.PosterURL != "" || movieMedia.ID == primaryMovieID {
				mediaDetails = append(mediaDetails, mediaItem)
			}
		}
		notification.MediaDetails = mediaDetails
		
		log.Printf("📊 Enhanced notification with %d media items for: %s", len(mediaDetails), notification.Title)
	} else {
		log.Printf("🎬 Enhanced single media notification: %s (ID: %d)", notification.Title, media.ID)
	}
}

// extractYouTubeKey extracts YouTube video key from URL
func (ns *NotificationService) extractYouTubeKey(url string) string {
	if url == "" {
		return ""
	}
	
	// Common YouTube URL patterns
	patterns := []string{
		`(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)`,
		`^([a-zA-Z0-9_-]{11})$`,
	}
	
	for _, pattern := range patterns {
		if match := regexp.MustCompile(pattern).FindStringSubmatch(url); len(match) > 1 {
			return match[1]
		}
	}
	
	return ""
}
