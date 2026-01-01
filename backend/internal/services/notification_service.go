package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	"gorm.io/gorm"
)

// NotificationType represents the type of notification
type NotificationType string

const (
	NotificationTypeNewMovies      NotificationType = "new_movies"
	NotificationTypeNewEpisodes    NotificationType = "new_episodes"
	NotificationTypeMovieSuggestion NotificationType = "movie_suggestion"
	NotificationTypeSingleMovie    NotificationType = "single_movie_suggestion"
	NotificationTypeWatchAgain     NotificationType = "watch_again"
	NotificationTypeDownload       NotificationType = "download_complete"
	NotificationTypeTMDBUpcoming   NotificationType = "tmdb_upcoming"
	NotificationTypeTMDBNowPlaying NotificationType = "tmdb_now_playing"
	NotificationTypeTMDBTrending   NotificationType = "tmdb_trending"
	NotificationTypeTMDBUpcomingTV NotificationType = "tmdb_upcoming_tv"
	NotificationTypeTMDBNowAiringTV NotificationType = "tmdb_now_airing_tv"
)

// Notification represents a notification message
type Notification struct {
	ID         string           `json:"id"`
	Type       NotificationType `json:"type"`
	Title      string           `json:"title"`
	Message    string           `json:"message"`
	MovieIDs   []uint           `json:"movie_ids,omitempty"`
	SeriesID   uint             `json:"series_id,omitempty"`
	SeriesName string           `json:"series_name,omitempty"`
	EpisodeIDs []uint           `json:"episode_ids,omitempty"`
	TMDBIDs    []int            `json:"tmdb_ids,omitempty"`     // For TMDB movie IDs
	TMDBTitles []string         `json:"tmdb_titles,omitempty"` // For TMDB movie titles
	Timestamp  int64            `json:"timestamp"`
	Read       bool             `json:"read"`
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
	go ns.generateRandomNotifications()
	
	// Generate first notification immediately for better UX
	go func() {
		log.Printf("🔔 Generating initial notification...")
		if err := ns.CreateRandomMovieSuggestion(); err != nil {
			log.Printf("❌ Failed to create initial notification: %v", err)
		}
	}()
}

// Stop stops the background notification generation
func (ns *NotificationService) Stop() {
	log.Printf("🔕 Stopping notification service...")
	close(ns.stopChan)
}

// generateRandomNotifications runs in the background and generates notifications at random intervals
func (ns *NotificationService) generateRandomNotifications() {
	// Seed random number generator
	rand.Seed(time.Now().UnixNano())

	notificationCounter := 0
	for {
		// Generate random wait time between 30 minutes to 3 hours for more frequent notifications
		minMinutes := 30
		maxMinutes := 180
		waitMinutes := minMinutes + rand.Intn(maxMinutes-minMinutes+1)
		waitDuration := time.Duration(waitMinutes) * time.Minute

		log.Printf("🔔 Next notification will be generated in %d minutes", waitMinutes)

		select {
		case <-ns.stopChan:
			log.Printf("🔕 Notification service stopped")
			return
		case <-time.After(waitDuration):
			// Rotate between different notification types with more variety
			notificationCounter++
			switch notificationCounter % 8 {
			case 0:
				// Watch again suggestions
				if err := ns.CreateWatchAgainSuggestion(); err != nil {
					log.Printf("❌ Failed to create watch again suggestion: %v", err)
				}
			case 1:
				// Single movie suggestion (local library)
				if err := ns.CreateSingleMovieSuggestion(); err != nil {
					log.Printf("❌ Failed to create single movie suggestion: %v", err)
				}
			case 2:
				// Multiple movie suggestions (local library)
				if err := ns.CreateRandomMovieSuggestion(); err != nil {
					log.Printf("❌ Failed to create movie suggestion: %v", err)
				}
			case 3:
				// TMDB upcoming movies (curated selection)
				if err := ns.CreateTMDBUpcomingMoviesNotification(); err != nil {
					log.Printf("❌ Failed to create TMDB upcoming notification: %v", err)
				}
			case 4:
				// TMDB now playing movies (curated selection)
				if err := ns.CreateTMDBNowPlayingNotification(); err != nil {
					log.Printf("❌ Failed to create TMDB now playing notification: %v", err)
				}
			case 5:
				// TMDB trending movies
				if err := ns.CreateTMDBTrendingMoviesNotification(); err != nil {
					log.Printf("❌ Failed to create TMDB trending notification: %v", err)
				}
			case 6:
				// TMDB upcoming TV series
				if err := ns.CreateTMDBUpcomingTVNotification(); err != nil {
					log.Printf("❌ Failed to create TMDB upcoming TV notification: %v", err)
				}
			case 7:
				// TMDB now airing TV series
				if err := ns.CreateTMDBNowAiringTVNotification(); err != nil {
					log.Printf("❌ Failed to create TMDB now airing TV notification: %v", err)
				}
			}
		}
	}
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

// GetNotifications retrieves the latest notifications
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
		notifications = append(notifications, notification)
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

// CreateTMDBTrendingMoviesNotification creates a notification for trending movies
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

	for _, movie := range movies {
		// High-quality trending criteria
		if movie.VoteAverage >= 7.0 && movie.Popularity >= 100 && !movie.Adult && movie.Title != "" {
			curatedMovies = append(curatedMovies, movie)
			tmdbIDs = append(tmdbIDs, movie.ID)
			tmdbTitles = append(tmdbTitles, movie.Title)
			
			// Limit to 3-4 top trending movies
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

	notification := Notification{
		ID:         fmt.Sprintf("notif_%d", time.Now().UnixNano()),
		Type:       NotificationTypeTMDBTrending,
		Title:      "Trending Worldwide",
		Message:    message,
		TMDBIDs:    tmdbIDs,
		TMDBTitles: tmdbTitles,
		Timestamp:  time.Now().Unix(),
		Read:       false,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("🔥 Created TMDB trending movies notification with %d movies", len(curatedMovies))
	return nil
}

// CreateTMDBUpcomingTVNotification creates a notification for upcoming TV series
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

	for _, series := range tvResponse.AiringToday {
		// Quality filters for TV series
		if series.VoteAverage >= 6.0 && series.Popularity >= 30 && series.Name != "" && series.FirstAirDate != "" {
			curatedSeries = append(curatedSeries, series)
			tmdbIDs = append(tmdbIDs, series.ID)
			tmdbTitles = append(tmdbTitles, series.Name)
			
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

	notification := Notification{
		ID:         fmt.Sprintf("notif_%d", time.Now().UnixNano()),
		Type:       NotificationTypeTMDBUpcomingTV,
		Title:      "New Episodes Coming",
		Message:    message,
		TMDBIDs:    tmdbIDs,
		TMDBTitles: tmdbTitles,
		Timestamp:  time.Now().Unix(),
		Read:       false,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("📺 Created TMDB upcoming TV notification with %d series", len(curatedSeries))
	return nil
}

// CreateTMDBNowAiringTVNotification creates a notification for currently airing TV series
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

	for _, series := range tvResponse.OnTheAir {
		// Quality filters for currently airing series
		if series.VoteAverage >= 7.0 && series.Popularity >= 50 && series.Name != "" {
			curatedSeries = append(curatedSeries, series)
			tmdbIDs = append(tmdbIDs, series.ID)
			tmdbTitles = append(tmdbTitles, series.Name)
			
			// Limit to 2-3 top airing series
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

	notification := Notification{
		ID:         fmt.Sprintf("notif_%d", time.Now().UnixNano()),
		Type:       NotificationTypeTMDBNowAiringTV,
		Title:      "Now Airing",
		Message:    message,
		TMDBIDs:    tmdbIDs,
		TMDBTitles: tmdbTitles,
		Timestamp:  time.Now().Unix(),
		Read:       false,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("📺 Created TMDB now airing TV notification with %d series", len(curatedSeries))
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
