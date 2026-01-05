package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"regexp"
	"strings"
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
		maxNotifications: 50,                 // Maximum notifications to keep
		stopChan:         make(chan bool),
	}

	return service, nil
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

// generateInitialNotificationBatch creates a diverse set of notifications on startup
func (ns *NotificationService) generateInitialNotificationBatch() {
	// Generate diverse notifications in parallel for fast startup
	go ns.CreateContinueWatchingNotification()
	go ns.CreateRecentlyAddedNotification()
	go ns.CreateLocalTrendingNotification()
	
	time.Sleep(500 * time.Millisecond)
	
	go ns.CreateTMDBComingSoonNotification()
	go ns.CreateGenreBasedNotification()
}

// generateOptimizedNotifications runs every minute with diverse notification types
func (ns *NotificationService) generateOptimizedNotifications() {
	rand.Seed(time.Now().UnixNano())
	
	// Notification type rotation - 16 different types for variety
	notificationTypes := []func() error{
		ns.CreateContinueWatchingNotification,    // 0: Continue watching with progress
		ns.CreateRecentlyAddedNotification,       // 1: Recently added local content
		ns.CreateLocalTrendingNotification,       // 2: Trending in local library
		ns.CreateGenreBasedNotification,          // 3: Genre-based recommendations
		ns.CreateTMDBComingSoonNotification,      // 4: Real coming soon (future dates)
		ns.CreateTMDBTrendingMoviesNotification,  // 5: TMDB trending
		ns.CreateSingleMovieSuggestion,           // 6: Single local movie
		ns.CreateTMDBNowPlayingNotification,      // 7: Now in theaters
		ns.CreateWatchAgainSuggestion,            // 8: Watch again
		ns.CreateTMDBUpcomingTVNotification,      // 9: Upcoming TV
		ns.CreateRandomMovieSuggestion,           // 10: Multiple local movies
		ns.CreateTMDBNowAiringTVNotification,     // 11: Now airing TV
		ns.CreateSingleTMDBMovieNotification,     // 12: Single TMDB movie
		ns.CreateSingleTMDBTVNotification,        // 13: Single TMDB TV
		ns.CreateLocalGenreHighlightNotification, // 14: Local genre highlight
		ns.CreateTMDBUpcomingMoviesNotification,  // 15: TMDB upcoming movies
	}
	
	notificationCounter := 0
	
	for {
		// Generate notification every 1 minute
		waitDuration := 1 * time.Minute
		
		select {
		case <-ns.stopChan:
			log.Printf("🔕 Notification service stopped")
			return
		case <-time.After(waitDuration):
			// Rotate through notification types
			typeIndex := notificationCounter % len(notificationTypes)
			notificationFunc := notificationTypes[typeIndex]
			
			if err := notificationFunc(); err != nil {
				log.Printf("⚠️ Notification type %d failed: %v", typeIndex, err)
			}
			
			notificationCounter++
			
			// Trim to 50 notifications max
			ns.trimNotifications()
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

// CreateContinueWatchingNotification creates notification for partially watched content with progress
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
	}
	
	var results []ProgressResult
	err := ns.db.Raw(`
		SELECT p.media_id, m.title, p.progress, m.duration, 
		       CAST(strftime('%s', p.last_watched_at) AS INTEGER) as last_watched,
		       m.type, m.series_id, m.rating, m.year, m.genre_names,
		       m.poster_path, m.tmdb_poster_url, m.tmdb_backdrop_url, m.tmdb_trailer_url,
		       m.description, m.season_number, m.episode_number
		FROM playback_progress p
		INNER JOIN media m ON p.media_id = m.id
		WHERE p.progress BETWEEN 5 AND 90
		AND m.poster_path IS NOT NULL
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
		
		// Set poster URL
		if result.TMDBPosterURL != "" {
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
	result := results[0]
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
	
	notification := Notification{
		ID:           fmt.Sprintf("continue_%d_%d", result.MediaID, time.Now().Unix()),
		Type:         NotificationTypeContinueWatching,
		Title:        "Continue Watching",
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
		PosterURL:    result.TMDBPosterURL,
		TrailerKey:   trailerKey,
		Rating:       result.Rating,
		Genres:       genres,
		Overview:     result.Description,
		MediaDetails: mediaDetails,
	}
	
	// Set poster URL fallback
	if notification.PosterURL == "" {
		notification.PosterURL = fmt.Sprintf("/api/posters/%d", result.MediaID)
	}
	
	return ns.AddNotification(notification)
}

// CreateRecentlyAddedNotification creates notification for recently added content
func (ns *NotificationService) CreateRecentlyAddedNotification() error {
	type MediaResult struct {
		ID    uint   `gorm:"column:id"`
		Title string `gorm:"column:title"`
		Type  string `gorm:"column:type"`
	}
	
	var results []MediaResult
	err := ns.db.Raw(`
		SELECT id, title, type FROM media
		WHERE created_at > datetime('now', '-24 hours')
		AND poster_path IS NOT NULL
		AND file_path IS NOT NULL AND file_path != ''
		ORDER BY created_at DESC
		LIMIT 3
	`).Scan(&results).Error
	
	if err != nil || len(results) == 0 {
		return fmt.Errorf("no recently added content")
	}
	
	var movieIDs []uint
	for _, r := range results {
		movieIDs = append(movieIDs, r.ID)
	}
	
	message := fmt.Sprintf("%s was just added to your library!", results[0].Title)
	if len(results) > 1 {
		message = fmt.Sprintf("%d new titles added to your library!", len(results))
	}
	
	notification := Notification{
		ID:        fmt.Sprintf("recent_%d", time.Now().Unix()),
		Type:      NotificationTypeRecentlyAdded,
		Title:     "Recently Added",
		Message:   message,
		MovieIDs:  movieIDs,
		Timestamp: time.Now().Unix(),
		Read:      false,
		Priority:  "high",
		Category:  "new",
	}
	
	return ns.AddNotification(notification)
}

// CreateLocalTrendingNotification creates notification for trending local content
func (ns *NotificationService) CreateLocalTrendingNotification() error {
	type MediaResult struct {
		ID        uint   `gorm:"column:id"`
		Title     string `gorm:"column:title"`
		ViewCount int    `gorm:"column:view_count"`
	}
	
	var results []MediaResult
	err := ns.db.Raw(`
		SELECT id, title, view_count FROM media
		WHERE view_count > 0
		AND poster_path IS NOT NULL
		AND file_path IS NOT NULL AND file_path != ''
		ORDER BY view_count DESC, rating DESC
		LIMIT 1
	`).Scan(&results).Error
	
	if err != nil || len(results) == 0 {
		return fmt.Errorf("no trending local content")
	}
	
	result := results[0]
	notification := Notification{
		ID:        fmt.Sprintf("local_trend_%d_%d", result.ID, time.Now().Unix()),
		Type:      NotificationTypeLocalTrending,
		Title:     "Trending in Your Library",
		Message:   fmt.Sprintf("%s is popular - watched %d times!", result.Title, result.ViewCount),
		MovieIDs:  []uint{result.ID},
		Timestamp: time.Now().Unix(),
		Read:      false,
		Priority:  "medium",
		Category:  "trending",
	}
	
	return ns.AddNotification(notification)
}

// CreateGenreBasedNotification creates notification based on user's favorite genres
func (ns *NotificationService) CreateGenreBasedNotification() error {
	// Get most watched genre
	var topGenre string
	err := ns.db.Raw(`
		SELECT m.genre_names FROM media m
		INNER JOIN playback_progress p ON m.id = p.media_id
		WHERE m.genre_names IS NOT NULL AND m.genre_names != ''
		GROUP BY m.genre_names
		ORDER BY COUNT(*) DESC
		LIMIT 1
	`).Scan(&topGenre).Error
	
	if err != nil || topGenre == "" {
		// Fallback to random popular genre
		genres := []string{"Action", "Comedy", "Drama", "Thriller", "Sci-Fi", "Horror"}
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
		ID    uint   `gorm:"column:id"`
		Title string `gorm:"column:title"`
	}
	
	var results []MediaResult
	err = ns.db.Raw(`
		SELECT id, title FROM media
		WHERE genre_names LIKE ?
		AND poster_path IS NOT NULL
		AND file_path IS NOT NULL AND file_path != ''
		ORDER BY RANDOM()
		LIMIT 1
	`, "%"+genreName+"%").Scan(&results).Error
	
	if err != nil || len(results) == 0 {
		return fmt.Errorf("no genre-based content found")
	}
	
	notification := Notification{
		ID:             fmt.Sprintf("genre_%s_%d", genreName, time.Now().Unix()),
		Type:           NotificationTypeGenreBased,
		Title:          fmt.Sprintf("Because You Like %s", genreName),
		Message:        fmt.Sprintf("Check out %s - a great %s pick!", results[0].Title, genreName),
		MovieIDs:       []uint{results[0].ID},
		Timestamp:      time.Now().Unix(),
		Read:           false,
		Priority:       "medium",
		Category:       "recommended",
		GenreHighlight: genreName,
	}
	
	return ns.AddNotification(notification)
}

// CreateTMDBComingSoonNotification creates notification for movies coming soon (future release dates)
func (ns *NotificationService) CreateTMDBComingSoonNotification() error {
	if ns.tmdbService == nil {
		return fmt.Errorf("TMDB service not available")
	}
	
	movies, err := ns.tmdbService.GetUpcomingMoviesList(1)
	if err != nil || len(movies) == 0 {
		return fmt.Errorf("no upcoming movies from TMDB")
	}
	
	now := time.Now()
	var comingSoon *TMDBMovieWithVideos
	var daysUntil int
	
	for _, movie := range movies {
		if movie.ReleaseDate == "" {
			continue
		}
		
		releaseTime, err := time.Parse("2006-01-02", movie.ReleaseDate)
		if err != nil {
			continue
		}
		
		// Only include movies releasing in the future (1-60 days)
		diff := releaseTime.Sub(now)
		days := int(diff.Hours() / 24)
		
		if days > 0 && days <= 60 && movie.VoteAverage >= 6.0 && movie.Popularity >= 50 {
			comingSoon = &movie
			daysUntil = days
			break
		}
	}
	
	if comingSoon == nil {
		return fmt.Errorf("no suitable coming soon movies")
	}
	
	message := fmt.Sprintf("%s releases in %d days!", comingSoon.Title, daysUntil)
	if daysUntil == 1 {
		message = fmt.Sprintf("%s releases tomorrow!", comingSoon.Title)
	} else if daysUntil <= 7 {
		message = fmt.Sprintf("%s releases this week!", comingSoon.Title)
	}
	
	notification := Notification{
		ID:          fmt.Sprintf("coming_%d_%d", comingSoon.ID, time.Now().Unix()),
		Type:        NotificationTypeTMDBComingSoon,
		Title:       "Coming Soon",
		Message:     message,
		TMDBIDs:     []int{comingSoon.ID},
		TMDBTitles:  []string{comingSoon.Title},
		Timestamp:   time.Now().Unix(),
		Read:        false,
		Priority:    "high",
		Category:    "new",
		DaysUntil:   daysUntil,
		ReleaseDate: comingSoon.ReleaseDate,
	}
	
	return ns.AddNotification(notification)
}

// CreateSingleTMDBMovieNotification creates notification for a single TMDB movie
func (ns *NotificationService) CreateSingleTMDBMovieNotification() error {
	if ns.tmdbService == nil {
		return fmt.Errorf("TMDB service not available")
	}
	
	movies, err := ns.tmdbService.GetPopularMovies(1)
	if err != nil || len(movies) == 0 {
		return fmt.Errorf("no popular movies from TMDB")
	}
	
	// Pick a random high-quality movie
	var selected *TMDBMovie
	for _, movie := range movies {
		if movie.VoteAverage >= 7.0 && movie.Popularity >= 100 && !movie.Adult {
			selected = &movie
			break
		}
	}
	
	if selected == nil && len(movies) > 0 {
		selected = &movies[0]
	}
	
	if selected == nil {
		return fmt.Errorf("no suitable TMDB movie")
	}
	
	notification := Notification{
		ID:         fmt.Sprintf("tmdb_movie_%d_%d", selected.ID, time.Now().Unix()),
		Type:       NotificationTypeTMDBNowPlaying,
		Title:      "Popular Right Now",
		Message:    fmt.Sprintf("%s is getting great reviews! ⭐ %.1f", selected.Title, selected.VoteAverage),
		TMDBIDs:    []int{selected.ID},
		TMDBTitles: []string{selected.Title},
		Timestamp:  time.Now().Unix(),
		Read:       false,
		Priority:   "medium",
		Category:   "trending",
	}
	
	return ns.AddNotification(notification)
}

// CreateSingleTMDBTVNotification creates notification for a single TMDB TV show
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
	
	notification := Notification{
		ID:         fmt.Sprintf("tmdb_tv_%d_%d", selected.ID, time.Now().Unix()),
		Type:       NotificationTypeTMDBNowAiringTV,
		Title:      "Now Airing",
		Message:    fmt.Sprintf("%s has new episodes! ⭐ %.1f", selected.Name, selected.VoteAverage),
		TMDBIDs:    []int{selected.ID},
		TMDBTitles: []string{selected.Name},
		Timestamp:  time.Now().Unix(),
		Read:       false,
		Priority:   "medium",
		Category:   "trending",
	}
	
	return ns.AddNotification(notification)
}

// CreateLocalGenreHighlightNotification highlights a specific genre from local library
func (ns *NotificationService) CreateLocalGenreHighlightNotification() error {
	genres := []string{"Action", "Comedy", "Drama", "Thriller", "Sci-Fi", "Horror", "Romance", "Adventure"}
	selectedGenre := genres[rand.Intn(len(genres))]
	
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
		AND poster_path IS NOT NULL
		AND rating >= 7.0
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

// CreateRandomMovieSuggestion creates a notification suggesting movies based on watch history and preferences
func (ns *NotificationService) CreateRandomMovieSuggestion() error {
	type MediaResult struct {
		ID    uint   `json:"id"`
		Title string `json:"title"`
	}
	
	var movies []MediaResult
	
	// Step 1: Get user's most watched genres from playback history
	var topGenres []string
	err := ns.db.Raw(`
		SELECT DISTINCT genre_names
		FROM media m
		INNER JOIN playback_progress p ON m.id = p.media_id
		WHERE m.type = 'movie' AND m.genre_names IS NOT NULL AND m.genre_names != ''
		ORDER BY p.last_watched_at DESC
		LIMIT 20
	`).Scan(&topGenres).Error
	
	// Build genre preference list (fallback to all genres if no history)
	genrePreference := ""
	if err == nil && len(topGenres) > 0 {
		// Extract unique genres from JSON arrays
		genreMap := make(map[string]bool)
		for _, genreJSON := range topGenres {
			// Simple parsing - extract words between quotes
			genres := strings.Split(genreJSON, `"`)
			for _, g := range genres {
				cleaned := strings.TrimSpace(g)
				if len(cleaned) > 2 && cleaned != "[" && cleaned != "]" && cleaned != "," {
					genreMap[cleaned] = true
				}
			}
		}
		
		// Use top 3 most common genres
		count := 0
		for genre := range genreMap {
			if count > 0 {
				genrePreference += " OR "
			}
			genrePreference += fmt.Sprintf("m.genre_names LIKE '%%%s%%'", genre)
			count++
			if count >= 3 {
				break
			}
		}
	}
	
	// Step 2: Get watched movie IDs to exclude
	var watchedIDs []uint
	ns.db.Raw(`
		SELECT DISTINCT media_id 
		FROM playback_progress 
		WHERE progress > 10
	`).Scan(&watchedIDs)
	
	// Step 3: Build smart query with preferences
	query := `
		SELECT m.id, m.title 
		FROM media m
		WHERE m.type = 'movie' 
		AND m.poster_path IS NOT NULL
		AND m.rating >= 6.0
		AND m.file_path IS NOT NULL AND m.file_path != ''
		AND m.duration > 3600
	`
	
	// Exclude watched movies
	if len(watchedIDs) > 0 {
		watchedIDsStr := ""
		for i, id := range watchedIDs {
			if i > 0 {
				watchedIDsStr += ","
			}
			watchedIDsStr += fmt.Sprintf("%d", id)
		}
		query += fmt.Sprintf(" AND m.id NOT IN (%s)", watchedIDsStr)
	}
	
	// Add genre preference filter
	if genrePreference != "" {
		query += fmt.Sprintf(" AND (%s)", genrePreference)
	}
	
	// Order by randomness first for variety, with slight rating boost
	query += `
		ORDER BY 
			RANDOM(),
			m.rating DESC
		LIMIT 5
	`
	
	err = ns.db.Raw(query).Scan(&movies).Error
	if err != nil {
		return fmt.Errorf("failed to fetch recommended movies: %w", err)
	}

	// Fallback: if no movies match preferences, get top-rated unwatched movies
	if len(movies) == 0 {
		log.Printf("⚠️ No movies match preferences, using top-rated fallback")
		fallbackQuery := `
			SELECT m.id, m.title 
			FROM media m
			WHERE m.type = 'movie' 
			AND m.poster_path IS NOT NULL
			AND m.rating >= 7.0
			AND m.file_path IS NOT NULL AND m.file_path != ''
			AND m.duration > 3600
		`
		
		if len(watchedIDs) > 0 {
			watchedIDsStr := ""
			for i, id := range watchedIDs {
				if i > 0 {
					watchedIDsStr += ","
				}
				watchedIDsStr += fmt.Sprintf("%d", id)
			}
			fallbackQuery += fmt.Sprintf(" AND m.id NOT IN (%s)", watchedIDsStr)
		}
		
		fallbackQuery += " ORDER BY RANDOM(), m.rating DESC LIMIT 5"
		err = ns.db.Raw(fallbackQuery).Scan(&movies).Error
		if err != nil {
			return fmt.Errorf("failed to fetch fallback movies: %w", err)
		}
	}

	if len(movies) == 0 {
		log.Printf("⚠️ No movies available for suggestion")
		return nil
	}

	// Validate each movie ID exists and has required data
	var validMovieIDs []uint
	for _, movie := range movies {
		// Verify the movie still exists and has valid paths
		var validCount int64
		ns.db.Raw(`
			SELECT COUNT(*) FROM media 
			WHERE id = ? 
			AND file_path IS NOT NULL AND file_path != '' 
			AND poster_path IS NOT NULL AND poster_path != ''
		`, movie.ID).Scan(&validCount)
		
		if validCount > 0 {
			validMovieIDs = append(validMovieIDs, movie.ID)
		} else {
			log.Printf("⚠️ Skipping invalid media ID %d (%s) from recommendations", movie.ID, movie.Title)
		}
	}
	
	if len(validMovieIDs) == 0 {
		log.Printf("⚠️ All recommended movies were invalid, skipping notification")
		return nil
	}

	// Create notification
	notification := Notification{
		ID:        fmt.Sprintf("notif_%d", time.Now().UnixNano()),
		Type:      NotificationTypeMovieSuggestion,
		Title:     "Recommended Movies for You",
		Message:   "Based on your watch history, you might enjoy these!",
		MovieIDs:  validMovieIDs,
		Timestamp: time.Now().Unix(),
		Read:      false,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("🎬 Created intelligent movie suggestion with %d valid movies (based on watch history & ratings)", len(validMovieIDs))
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

// AddNotification adds a notification to Redis
func (ns *NotificationService) AddNotification(notification Notification) error {
	// Serialize notification to JSON
	data, err := json.Marshal(notification)
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %w", err)
	}

	// Store in Redis sorted set (sorted by timestamp)
	key := ns.keyPrefix + "global"
	err = ns.client.ZAdd(ns.ctx, key, &redis.Z{
		Score:  float64(notification.Timestamp),
		Member: string(data),
	}).Err()

	if err != nil {
		return fmt.Errorf("failed to add notification to Redis: %w", err)
	}

	// Set TTL on the sorted set
	ns.client.Expire(ns.ctx, key, ns.ttl)

	// Trim to keep only the latest maxNotifications
	ns.client.ZRemRangeByRank(ns.ctx, key, 0, -int64(ns.maxNotifications+1))

	log.Printf("🔔 Added notification: %s - %s", notification.Type, notification.Title)
	return nil
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

// CreateSingleMovieSuggestion creates a notification suggesting a single movie based on watch history and preferences
func (ns *NotificationService) CreateSingleMovieSuggestion() error {
	type MediaResult struct {
		ID    uint   `json:"id"`
		Title string `json:"title"`
	}
	
	var movies []MediaResult
	
	// Step 1: Get user's most watched genres from playback history
	var topGenres []string
	err := ns.db.Raw(`
		SELECT DISTINCT genre_names
		FROM media m
		INNER JOIN playback_progress p ON m.id = p.media_id
		WHERE m.type = 'movie' AND m.genre_names IS NOT NULL AND m.genre_names != ''
		ORDER BY p.last_watched_at DESC
		LIMIT 10
	`).Scan(&topGenres).Error
	
	// Build genre preference list
	genrePreference := ""
	if err == nil && len(topGenres) > 0 {
		// Extract unique genres from JSON arrays
		genreMap := make(map[string]bool)
		for _, genreJSON := range topGenres {
			genres := strings.Split(genreJSON, `"`)
			for _, g := range genres {
				cleaned := strings.TrimSpace(g)
				if len(cleaned) > 2 && cleaned != "[" && cleaned != "]" && cleaned != "," {
					genreMap[cleaned] = true
				}
			}
		}
		
		// Use top 2 most common genres for single movie
		count := 0
		for genre := range genreMap {
			if count > 0 {
				genrePreference += " OR "
			}
			genrePreference += fmt.Sprintf("m.genre_names LIKE '%%%s%%'", genre)
			count++
			if count >= 2 {
				break
			}
		}
	}
	
	// Step 2: Get watched movie IDs to exclude
	var watchedIDs []uint
	ns.db.Raw(`
		SELECT DISTINCT media_id 
		FROM playback_progress 
		WHERE progress > 10
	`).Scan(&watchedIDs)
	
	// Step 3: Build smart query for single high-quality movie
	query := `
		SELECT m.id, m.title 
		FROM media m
		WHERE m.type = 'movie' 
		AND m.poster_path IS NOT NULL
		AND m.rating >= 7.5
		AND m.file_path IS NOT NULL AND m.file_path != ''
		AND m.duration > 5400
	`
	
	// Exclude watched movies
	if len(watchedIDs) > 0 {
		watchedIDsStr := ""
		for i, id := range watchedIDs {
			if i > 0 {
				watchedIDsStr += ","
			}
			watchedIDsStr += fmt.Sprintf("%d", id)
		}
		query += fmt.Sprintf(" AND m.id NOT IN (%s)", watchedIDsStr)
	}
	
	// Add genre preference filter
	if genrePreference != "" {
		query += fmt.Sprintf(" AND (%s)", genrePreference)
	}
	
	// Order by rating and randomness for single best pick
	query += `
		ORDER BY 
			m.rating DESC,
			RANDOM()
		LIMIT 1
	`
	
	err = ns.db.Raw(query).Scan(&movies).Error
	if err != nil {
		return fmt.Errorf("failed to fetch single movie recommendation: %w", err)
	}

	// Fallback: if no movies match preferences, get top-rated unwatched movie
	if len(movies) == 0 {
		log.Printf("⚠️ No movies match preferences for single suggestion, using top-rated fallback")
		fallbackQuery := `
			SELECT m.id, m.title 
			FROM media m
			WHERE m.type = 'movie' 
			AND m.poster_path IS NOT NULL
			AND m.rating >= 8.0
			AND m.file_path IS NOT NULL AND m.file_path != ''
			AND m.duration > 5400
		`
		
		if len(watchedIDs) > 0 {
			watchedIDsStr := ""
			for i, id := range watchedIDs {
				if i > 0 {
					watchedIDsStr += ","
				}
				watchedIDsStr += fmt.Sprintf("%d", id)
			}
			fallbackQuery += fmt.Sprintf(" AND m.id NOT IN (%s)", watchedIDsStr)
		}
		
		fallbackQuery += " ORDER BY m.rating DESC, RANDOM() LIMIT 1"
		err = ns.db.Raw(fallbackQuery).Scan(&movies).Error
		if err != nil {
			return fmt.Errorf("failed to fetch fallback single movie: %w", err)
		}
	}

	if len(movies) == 0 {
		log.Printf("⚠️ No movies available for single suggestion")
		return nil
	}

	// Validate the movie
	movie := movies[0]
	var validCount int64
	ns.db.Raw(`
		SELECT COUNT(*) FROM media 
		WHERE id = ? 
		AND file_path IS NOT NULL AND file_path != '' 
		AND poster_path IS NOT NULL AND poster_path != ''
	`, movie.ID).Scan(&validCount)
	
	if validCount == 0 {
		log.Printf("⚠️ Single movie recommendation invalid, skipping notification")
		return nil
	}

	// Create notification
	notification := Notification{
		ID:        fmt.Sprintf("notif_%d", time.Now().UnixNano()),
		Type:      NotificationTypeSingleMovie,
		Title:     "Perfect Match for You",
		Message:   fmt.Sprintf("We found the perfect movie for your taste: %s", movie.Title),
		MovieIDs:  []uint{movie.ID},
		Timestamp: time.Now().Unix(),
		Read:      false,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("🎯 Created single movie suggestion: %s (ID: %d)", movie.Title, movie.ID)
	return nil
}

// CreateTMDBUpcomingMoviesNotification creates a notification for curated upcoming movies from TMDB
func (ns *NotificationService) CreateTMDBUpcomingMoviesNotification() error {
	if ns.tmdbService == nil {
		log.Printf("⚠️ TMDB service not available for upcoming movies notification")
		return nil
	}

	// Fetch upcoming movies from TMDB (first 2 pages for better selection)
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

	// Smart curation: filter for high-quality upcoming movies
	var curatedMovies []TMDBMovieWithVideos
	var tmdbIDs []int
	var tmdbTitles []string

	for _, movie := range allMovies {
		// Quality filters
		if movie.VoteAverage >= 6.5 && movie.Popularity >= 50 && !movie.Adult && movie.Title != "" && movie.ReleaseDate != "" {
			// Check if release date is actually upcoming (within next 6 months)
			if releaseTime, err := time.Parse("2006-01-02", movie.ReleaseDate); err == nil {
				now := time.Now()
				sixMonthsFromNow := now.AddDate(0, 6, 0)
				
				if releaseTime.After(now) && releaseTime.Before(sixMonthsFromNow) {
					curatedMovies = append(curatedMovies, movie)
					tmdbIDs = append(tmdbIDs, movie.ID)
					tmdbTitles = append(tmdbTitles, movie.Title)
					
					// Limit to 3-5 high-quality upcoming movies
					if len(curatedMovies) >= 5 {
						break
					}
				}
			}
		}
	}

	if len(curatedMovies) == 0 {
		log.Printf("⚠️ No high-quality upcoming movies found")
		return nil
	}

	// Create notification with curated selection
	var message string
	if len(curatedMovies) == 1 {
		message = fmt.Sprintf("%s is coming soon to theaters!", tmdbTitles[0])
	} else {
		message = fmt.Sprintf("%d highly anticipated movies are coming soon!", len(curatedMovies))
	}

	notification := Notification{
		ID:         fmt.Sprintf("notif_%d", time.Now().UnixNano()),
		Type:       NotificationTypeTMDBUpcoming,
		Title:      "Coming Soon to Theaters",
		Message:    message,
		TMDBIDs:    tmdbIDs,
		TMDBTitles: tmdbTitles,
		Timestamp:  time.Now().Unix(),
		Read:       false,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("🎬 Created TMDB upcoming movies notification with %d movies", len(curatedMovies))
	return nil
}

// CreateTMDBTrendingMoviesNotification creates a notification for trending movies with full media details
func (ns *NotificationService) CreateTMDBTrendingMoviesNotification() error {
	if ns.tmdbService == nil {
		log.Printf("⚠️ TMDB service not available for trending movies notification")
		return nil
	}

	// Fetch popular movies (which are essentially trending)
	movies, err := ns.tmdbService.GetPopularMovies(1)
	if err != nil {
		return fmt.Errorf("failed to fetch trending movies from TMDB: %w", err)
	}

	if len(movies) == 0 {
		log.Printf("⚠️ No trending movies found from TMDB")
		return nil
	}

	// Smart curation: select top trending movies with high ratings
	var curatedMovies []TMDBMovie
	var tmdbIDs []int
	var tmdbTitles []string
	var mediaDetails []NotificationMedia

	for _, movie := range movies {
		// High-quality trending criteria
		if movie.VoteAverage >= 7.0 && movie.Popularity >= 100 && !movie.Adult && movie.Title != "" {
			curatedMovies = append(curatedMovies, movie)
			tmdbIDs = append(tmdbIDs, movie.ID)
			tmdbTitles = append(tmdbTitles, movie.Title)
			
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
		log.Printf("⚠️ No high-quality trending movies found")
		return nil
	}

	var message string
	if len(curatedMovies) == 1 {
		message = fmt.Sprintf("%s is trending worldwide!", tmdbTitles[0])
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
		ID:           fmt.Sprintf("notif_%d", time.Now().UnixNano()),
		Type:         NotificationTypeTMDBTrending,
		Title:        "Trending Worldwide",
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

	log.Printf("🔥 Created TMDB trending movies notification with %d movies (trailer: %s)", len(curatedMovies), trailerKey != "")
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

// CreateTMDBNowPlayingNotification creates a notification for the first now playing movie from TMDB (enhanced)
func (ns *NotificationService) CreateTMDBNowPlayingNotification() error {
	if ns.tmdbService == nil {
		log.Printf("⚠️ TMDB service not available for now playing notification")
		return nil
	}

	// Fetch now playing movies from TMDB (first page)
	movies, err := ns.tmdbService.GetNowPlayingMovies(1)
	if err != nil {
		return fmt.Errorf("failed to fetch now playing movies from TMDB: %w", err)
	}

	if len(movies) == 0 {
		log.Printf("⚠️ No now playing movies found from TMDB")
		return nil
	}

	// Smart selection: get a high-quality now playing movie
	var selectedMovie TMDBMovieWithVideos
	found := false
	for _, movie := range movies {
		if movie.VoteAverage >= 7.0 && movie.Popularity >= 100 && !movie.Adult {
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
		Type:       NotificationTypeTMDBNowPlaying,
		Title:      "Now Playing in Theaters",
		Message:    fmt.Sprintf("%s is now playing and getting great reviews!", selectedMovie.Title),
		TMDBIDs:    []int{selectedMovie.ID},
		TMDBTitles: []string{selectedMovie.Title},
		Timestamp:  time.Now().Unix(),
		Read:       false,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("🎥 Created TMDB now playing notification: %s", selectedMovie.Title)
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

// enhanceWithTMDBData adds TMDB details to notification
func (ns *NotificationService) enhanceWithTMDBData(notification *Notification) {
	if len(notification.TMDBIDs) == 0 || ns.tmdbService == nil {
		return
	}

	// Get details for the first/primary movie
	primaryTMDBID := notification.TMDBIDs[0]
	
	// Determine if it's TV or movie
	isTV := notification.Type == NotificationTypeTMDBUpcomingTV || notification.Type == NotificationTypeTMDBNowAiringTV
	
	if isTV {
		tvDetails, err := ns.tmdbService.GetTVDetails(primaryTMDBID)
		if err != nil {
			log.Printf("⚠️ Failed to fetch TMDB TV details for %d: %v", primaryTMDBID, err)
			return
		}

		if tvDetails.BackdropPath != "" {
			notification.BackdropURL = fmt.Sprintf("https://image.tmdb.org/t/p/w1280%s", tvDetails.BackdropPath)
		}
		
		if tvDetails.PosterPath != "" {
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

		// Get trailer key from videos
		if len(tvDetails.Videos.Results) > 0 {
			for _, video := range tvDetails.Videos.Results {
				if video.Type == "Trailer" && video.Site == "YouTube" {
					notification.TrailerKey = video.Key
					break
				}
			}
		}
	} else {
		movieDetails, err := ns.tmdbService.GetMovieDetails(primaryTMDBID)
		if err != nil {
			log.Printf("⚠️ Failed to fetch TMDB movie details for %d: %v", primaryTMDBID, err)
			return
		}

		if movieDetails.BackdropPath != "" {
			notification.BackdropURL = fmt.Sprintf("https://image.tmdb.org/t/p/w1280%s", movieDetails.BackdropPath)
		}
		
		if movieDetails.PosterPath != "" {
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
	}

	// For multi-movie notifications, get details for all movies
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
				if tvDetails.PosterPath != "" {
					media.PosterURL = fmt.Sprintf("https://image.tmdb.org/t/p/w500%s", tvDetails.PosterPath)
				}
				if tvDetails.BackdropPath != "" {
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
				if movieDetails.PosterPath != "" {
					media.PosterURL = fmt.Sprintf("https://image.tmdb.org/t/p/w500%s", movieDetails.PosterPath)
				}
				if movieDetails.BackdropPath != "" {
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
			
			mediaDetails = append(mediaDetails, media)
		}
		notification.MediaDetails = mediaDetails
	}
}

// enhanceWithLocalMediaData adds local media details to notification
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
	}
	
	var media MediaResult
	err := ns.db.Table("media").Where("id = ?", primaryMovieID).First(&media).Error
	if err != nil {
		log.Printf("⚠️ Failed to fetch local media details for %d: %v", primaryMovieID, err)
		return
	}

	// Set primary notification data
	notification.BackdropURL = media.TMDBBackdropURL
	if notification.BackdropURL == "" && media.BackdropPath != "" {
		notification.BackdropURL = fmt.Sprintf("/api/admin/assets/%s", media.BackdropPath)
	}
	
	notification.PosterURL = media.TMDBPosterURL
	if notification.PosterURL == "" {
		notification.PosterURL = fmt.Sprintf("/api/posters/%d", media.ID)
	}
	
	if media.LogoPath != "" {
		notification.LogoURL = fmt.Sprintf("/api/%s", media.LogoPath)
	}
	
	if media.TMDBTrailerURL != "" {
		// Extract YouTube key from URL
		notification.TrailerKey = ns.extractYouTubeKey(media.TMDBTrailerURL)
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
	if media.GenreNames != "" {
		var genres []string
		if err := json.Unmarshal([]byte(media.GenreNames), &genres); err == nil {
			notification.Genres = genres
		}
	}

	// For multi-movie notifications, get details for all movies
	if len(notification.MovieIDs) > 1 {
		var mediaDetails []NotificationMedia
		for _, movieID := range notification.MovieIDs {
			var movieMedia MediaResult
			if err := ns.db.Table("media").Where("id = ?", movieID).First(&movieMedia).Error; err != nil {
				log.Printf("⚠️ Failed to fetch local media details for %d: %v", movieID, err)
				continue
			}

			media := NotificationMedia{
				ID:         int(movieMedia.ID),
				Title:      movieMedia.Title,
				SourceType: "local",
				SourceID:   fmt.Sprintf("%d", movieMedia.ID),
				Rating:     movieMedia.Rating,
				Year:       movieMedia.Year,
				Overview:   movieMedia.Description,
			}
			
			media.PosterURL = movieMedia.TMDBPosterURL
			if media.PosterURL == "" {
				media.PosterURL = fmt.Sprintf("/api/posters/%d", movieMedia.ID)
			}
			
			media.BackdropURL = movieMedia.TMDBBackdropURL
			if media.BackdropURL == "" && movieMedia.BackdropPath != "" {
				media.BackdropURL = fmt.Sprintf("/api/admin/assets/%s", movieMedia.BackdropPath)
			}
			
			if movieMedia.Duration > 0 {
				media.Runtime = movieMedia.Duration / 60
			}

			// Parse genres
			if movieMedia.GenreNames != "" {
				var genres []string
				if err := json.Unmarshal([]byte(movieMedia.GenreNames), &genres); err == nil {
					media.Genres = genres
				}
			}
			
			mediaDetails = append(mediaDetails, media)
		}
		notification.MediaDetails = mediaDetails
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
