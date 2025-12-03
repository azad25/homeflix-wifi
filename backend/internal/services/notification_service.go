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
	NotificationTypeWatchAgain     NotificationType = "watch_again"
	NotificationTypeDownload       NotificationType = "download_complete"
	NotificationTypeTMDBUpcoming   NotificationType = "tmdb_upcoming"
	NotificationTypeTMDBNowPlaying NotificationType = "tmdb_now_playing"
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
		// Generate random wait time between 1-6 hours
		minHours := 1
		maxHours := 6
		waitHours := minHours + rand.Intn(maxHours-minHours+1)
		waitDuration := time.Duration(waitHours) * time.Hour

		log.Printf("🔔 Next notification will be generated in %d hours", waitHours)

		select {
		case <-ns.stopChan:
			log.Printf("🔕 Notification service stopped")
			return
		case <-time.After(waitDuration):
			// Rotate between different notification types
			notificationCounter++
			switch notificationCounter % 4 {
			case 0:
				// Watch again suggestions
				if err := ns.CreateWatchAgainSuggestion(); err != nil {
					log.Printf("❌ Failed to create watch again suggestion: %v", err)
				}
			case 1:
				// Movie suggestions (based on watch history)
				if err := ns.CreateRandomMovieSuggestion(); err != nil {
					log.Printf("❌ Failed to create movie suggestion: %v", err)
				}
			case 2:
				// TMDB upcoming movie
				if err := ns.CreateTMDBUpcomingMovieNotification(); err != nil {
					log.Printf("❌ Failed to create TMDB upcoming notification: %v", err)
				}
			case 3:
				//  TMDB now playing movie
				if err := ns.CreateTMDBNowPlayingNotification(); err != nil {
					log.Printf("❌ Failed to create TMDB now playing notification: %v", err)
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

	// Extract movie IDs
	movieIDs := make([]uint, len(movies))
	for i, movie := range movies {
		movieIDs[i] = movie.ID
	}

	// Create notification
	notification := Notification{
		ID:        fmt.Sprintf("notif_%d", time.Now().UnixNano()),
		Type:      NotificationTypeMovieSuggestion,
		Title:     "Recommended Movies for You",
		Message:   "Based on your watch history, you might enjoy these!",
		MovieIDs:  movieIDs,
		Timestamp: time.Now().Unix(),
		Read:      false,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("🎬 Created intelligent movie suggestion with %d movies (based on watch history & ratings)", len(movies))
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

	log.Printf("⬇️ Created download complete notification for %s", title)
	return nil
}

// CreateTMDBUpcomingMovieNotification creates a notification for the first upcoming movie from TMDB
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

	// Get the first upcoming movie
	movie := movies[0]

	notification := Notification{
		ID:         fmt.Sprintf("notif_%d", time.Now().UnixNano()),
		Type:       NotificationTypeTMDBUpcoming,
		Title:      "Upcoming Movie",
		Message:    fmt.Sprintf("%s is coming soon!", movie.Title),
		TMDBIDs:    []int{movie.ID},
		TMDBTitles: []string{movie.Title},
		Timestamp:  time.Now().Unix(),
		Read:       false,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("🎬 Created TMDB upcoming movie notification: %s", movie.Title)
	return nil
}

// CreateTMDBNowPlayingNotification creates a notification for the first now playing movie from TMDB
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

	// Get the first now playing movie
	movie := movies[0]

	notification := Notification{
		ID:         fmt.Sprintf("notif_%d", time.Now().UnixNano()),
		Type:       NotificationTypeTMDBNowPlaying,
		Title:      "Now Playing in Theaters",
		Message:    fmt.Sprintf("%s is now playing!", movie.Title),
		TMDBIDs:    []int{movie.ID},
		TMDBTitles: []string{movie.Title},
		Timestamp:  time.Now().Unix(),
		Read:       false,
	}

	if err := ns.AddNotification(notification); err != nil {
		return err
	}

	log.Printf("🎥 Created TMDB now playing notification: %s", movie.Title)
	return nil
}

// Close closes the Redis connection
func (ns *NotificationService) Close() error {
	ns.Stop()
	return ns.client.Close()
}
