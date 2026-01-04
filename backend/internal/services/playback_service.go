package services

import (
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	"homeflix-backend/internal/models"
)

type PlaybackService struct {
	db *gorm.DB
}

func NewPlaybackService(db *gorm.DB) *PlaybackService {
	return &PlaybackService{db: db}
}

// UpdatePlaybackProgress updates or creates playback progress for a user
func (s *PlaybackService) UpdatePlaybackProgress(userID string, mediaID uint, position, duration float64) error {
	// Ensure duration is valid
	if duration <= 0 {
		return fmt.Errorf("invalid duration: %f", duration)
	}

	progress := (position / duration) * 100
	completed := progress >= 90 // Consider 90%+ as completed

	var playbackProgress models.PlaybackProgress
	result := s.db.Where("user_id = ? AND media_id = ?", userID, mediaID).First(&playbackProgress)

	if result.Error == gorm.ErrRecordNotFound {
		// Create new progress record
		playbackProgress = models.PlaybackProgress{
			UserID:      userID,
			MediaID:     mediaID,
			Position:    position,
			Duration:    duration,
			Progress:    progress,
			Completed:   completed,
			LastWatched: time.Now(),
		}
		return s.db.Create(&playbackProgress).Error
	}

	// Update existing record
	playbackProgress.Position = position
	playbackProgress.Duration = duration
	playbackProgress.Progress = progress
	playbackProgress.Completed = completed
	playbackProgress.LastWatched = time.Now()

	return s.db.Save(&playbackProgress).Error
}

// EnsurePlaybackProgress ensures a progress record exists for a user and media
func (s *PlaybackService) EnsurePlaybackProgress(userID string, mediaID uint) error {
	var count int64
	s.db.Model(&models.PlaybackProgress{}).Where("user_id = ? AND media_id = ?", userID, mediaID).Count(&count)

	if count == 0 {
		// Create initial progress record
		progress := models.PlaybackProgress{
			UserID:      userID,
			MediaID:     mediaID,
			Position:    0,
			Duration:    0,
			Progress:    0,
			Completed:   false,
			LastWatched: time.Now(),
		}
		return s.db.Create(&progress).Error
	}

	return nil
}

// GetPlaybackProgress gets playback progress for a specific media item, creates if not found
func (s *PlaybackService) GetPlaybackProgress(userID string, mediaID uint) (*models.PlaybackProgress, error) {
	var progress models.PlaybackProgress
	err := s.db.Preload("Media").Where("user_id = ? AND media_id = ?", userID, mediaID).First(&progress).Error

	if err == gorm.ErrRecordNotFound {
		// Create a new progress record with 0 progress
		progress = models.PlaybackProgress{
			UserID:      userID,
			MediaID:     mediaID,
			Position:    0,
			Duration:    0,
			Progress:    0,
			Completed:   false,
			LastWatched: time.Now(),
		}

		// Save the new progress record
		if createErr := s.db.Create(&progress).Error; createErr != nil {
			return nil, createErr
		}

		// Reload with Media preloaded
		err = s.db.Preload("Media").Where("user_id = ? AND media_id = ?", userID, mediaID).First(&progress).Error
		if err != nil {
			return nil, err
		}

		return &progress, nil
	}

	return &progress, err
}

// GetUserPlaybackProgress gets all playback progress for a user
func (s *PlaybackService) GetUserPlaybackProgress(userID string) ([]models.PlaybackProgress, error) {
	var progress []models.PlaybackProgress
	err := s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ?", userID).
		Order("last_watched DESC").
		Find(&progress).Error
	return progress, err
}

// AddToRecentlyWatched adds or updates recently watched item
func (s *PlaybackService) AddToRecentlyWatched(userID string, mediaID uint) error {
	var recent models.RecentlyWatched
	result := s.db.Where("user_id = ? AND media_id = ?", userID, mediaID).First(&recent)

	if result.Error == gorm.ErrRecordNotFound {
		// Create new recently watched record
		recent = models.RecentlyWatched{
			UserID:    userID,
			MediaID:   mediaID,
			WatchedAt: time.Now(),
		}
		return s.db.Create(&recent).Error
	}

	// Update existing record
	recent.WatchedAt = time.Now()
	return s.db.Save(&recent).Error
}

// GetRecentlyWatched gets recently watched items for a user
func (s *PlaybackService) GetRecentlyWatched(userID string, limit int) ([]models.RecentlyWatched, error) {
	var recent []models.RecentlyWatched
	err := s.db.Preload("Media").Preload("Media.Genres").Preload("Media.Series").Preload("Media.Series.Genres").
		Where("user_id = ?", userID).
		Order("watched_at DESC").
		Limit(limit).
		Find(&recent).Error
	if err != nil {
		return recent, err
	}

	for i := range recent {
		recent[i].Media = s.enrichMediaWithSeries(recent[i].Media)
	}

	return dedupeRecentlyWatched(recent), nil
}

// AddToWatchHistory records watch session
func (s *PlaybackService) AddToWatchHistory(userID string, mediaID uint, duration float64) error {
	history := models.WatchHistory{
		UserID:    userID,
		MediaID:   mediaID,
		WatchedAt: time.Now(),
		Duration:  duration,
	}
	return s.db.Create(&history).Error
}

// GetWatchHistory gets watch history for a user
func (s *PlaybackService) GetWatchHistory(userID string, limit int) ([]models.WatchHistory, error) {
	var history []models.WatchHistory
	err := s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ?", userID).
		Order("watched_at DESC").
		Limit(limit).
		Find(&history).Error
	return history, err
}

// AddToMyList adds media to user's personal list
func (s *PlaybackService) AddToMyList(userID string, mediaID uint) error {
	var myList models.MyList
	result := s.db.Where("user_id = ? AND media_id = ?", userID, mediaID).First(&myList)

	if result.Error == gorm.ErrRecordNotFound {
		myList = models.MyList{
			UserID:  userID,
			MediaID: mediaID,
			AddedAt: time.Now(),
		}
		return s.db.Create(&myList).Error
	}

	return fmt.Errorf("media already in list")
}

// RemoveFromMyList removes media from user's personal list
func (s *PlaybackService) RemoveFromMyList(userID string, mediaID uint) error {
	return s.db.Where("user_id = ? AND media_id = ?", userID, mediaID).Delete(&models.MyList{}).Error
}

// GetMyList gets user's personal watchlist
func (s *PlaybackService) GetMyList(userID string) ([]models.MyList, error) {
	var myList []models.MyList
	err := s.db.Preload("Media").Preload("Media.Genres").
		Where("user_id = ?", userID).
		Order("added_at DESC").
		Find(&myList).Error
	return myList, err
}

// IsInMyList checks if media is in user's list
func (s *PlaybackService) IsInMyList(userID string, mediaID uint) (bool, error) {
	var count int64
	err := s.db.Model(&models.MyList{}).
		Where("user_id = ? AND media_id = ?", userID, mediaID).
		Count(&count).Error
	return count > 0, err
}

// GetContinueWatching gets items with progress but not completed
func (s *PlaybackService) GetContinueWatching(userID string, limit int) ([]models.PlaybackProgress, error) {
	var progress []models.PlaybackProgress
	err := s.db.Preload("Media").Preload("Media.Genres").Preload("Media.Series").Preload("Media.Series.Genres").
		Where("user_id = ? AND completed = ? AND progress > ?", userID, false, 5).
		Order("last_watched DESC").
		Limit(limit).
		Find(&progress).Error
	if err != nil {
		return progress, err
	}

	for i := range progress {
		progress[i].Media = s.enrichMediaWithSeries(progress[i].Media)
	}

	return dedupePlaybackProgress(progress), nil
}

// GetRecentlyWatchedWithProgress gets recently watched items with playback progress
func (s *PlaybackService) GetRecentlyWatchedWithProgress(userID string, limit int) ([]models.PlaybackProgress, error) {
	var progress []models.PlaybackProgress
	err := s.db.Preload("Media").Preload("Media.Genres").Preload("Media.Series").Preload("Media.Series.Genres").
		Where("user_id = ? AND progress > ? AND progress < ?", userID, 5, 95).
		Order("last_watched DESC").
		Limit(limit).
		Find(&progress).Error
	if err != nil {
		return progress, err
	}

	for i := range progress {
		progress[i].Media = s.enrichMediaWithSeries(progress[i].Media)
	}

	return dedupePlaybackProgress(progress), nil
}

// CleanupOldProgress removes old progress records (older than 1 year)
func (s *PlaybackService) CleanupOldProgress() error {
	oneYearAgo := time.Now().AddDate(-1, 0, 0)
	return s.db.Where("last_watched < ?", oneYearAgo).Delete(&models.PlaybackProgress{}).Error
}

// GetWatchStats gets watch statistics for a user
func (s *PlaybackService) GetWatchStats(userID string) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Total watch time
	var totalWatchTime float64
	s.db.Model(&models.WatchHistory{}).
		Where("user_id = ?", userID).
		Select("COALESCE(SUM(duration), 0)").
		Scan(&totalWatchTime)

	// Total items watched
	var totalItems int64
	s.db.Model(&models.RecentlyWatched{}).
		Where("user_id = ?", userID).
		Count(&totalItems)

	// Completed items
	var completedItems int64
	s.db.Model(&models.PlaybackProgress{}).
		Where("user_id = ? AND completed = ?", userID, true).
		Count(&completedItems)

	// Items in progress
	var inProgressItems int64
	s.db.Model(&models.PlaybackProgress{}).
		Where("user_id = ? AND completed = ? AND progress > ?", userID, false, 5).
		Count(&inProgressItems)

	// My list count
	var myListCount int64
	s.db.Model(&models.MyList{}).
		Where("user_id = ?", userID).
		Count(&myListCount)

	stats["total_watch_time"] = totalWatchTime
	stats["total_items"] = totalItems
	stats["completed_items"] = completedItems
	stats["in_progress_items"] = inProgressItems
	stats["my_list_count"] = myListCount

	return stats, nil
}

func (s *PlaybackService) enrichMediaWithSeries(media models.Media) models.Media {
	if media.Type != "episode" && media.Type != "tv" {
		return media
	}

	if media.Series == nil {
		return media
	}

	series := media.Series
	media.ID = series.ID
	media.Title = buildSeriesTitle(series.Title, media)
	media.Description = coalesce(series.Description, media.Description)
	media.Type = "tv"
	media.Year = series.Year
	media.Rating = float64(series.Rating)
	media.SeriesID = &series.ID

	if series.PosterPath != "" {
		media.PosterPath = series.PosterPath
		media.ThumbnailPath = series.PosterPath
	}
	if series.BackdropPath != "" {
		media.BackdropPath = series.BackdropPath
	}
	if series.LogoPath != "" {
		media.LogoPath = series.LogoPath
	}

	if series.TMDBBackdropURL != "" {
		media.TMDBBackdropURL = series.TMDBBackdropURL
	}
	if series.TMDBTrailerURL != "" {
		media.TMDBTrailerURL = series.TMDBTrailerURL
	}
	if series.TMDBID != 0 {
		media.TMDBID = series.TMDBID
	}

	if len(series.GenreNames) > 0 {
		media.GenreNames = append([]string{}, series.GenreNames...)
	}

	return media
}

func buildSeriesTitle(seriesTitle string, media models.Media) string {
	season := extractSeason(media)
	episode := extractEpisode(media)

	if season > 0 && episode > 0 {
		return fmt.Sprintf("%s S%02dE%02d", seriesTitle, season, episode)
	}

	if media.Title != "" && !strings.HasPrefix(strings.ToLower(media.Title), strings.ToLower(seriesTitle)) {
		return fmt.Sprintf("%s - %s", seriesTitle, media.Title)
	}

	if media.Title != "" {
		return media.Title
	}

	return seriesTitle
}

func extractSeason(media models.Media) int {
	if media.SeasonNumber != nil {
		return *media.SeasonNumber
	}
	if media.Season != nil {
		return *media.Season
	}
	if media.Title != "" {
		if season, _ := parseSeasonEpisode(media.Title); season > 0 {
			return season
		}
	}
	return 0
}

func extractEpisode(media models.Media) int {
	if media.EpisodeNumber != nil {
		return *media.EpisodeNumber
	}
	if media.Episode != nil {
		return *media.Episode
	}
	if media.Title != "" {
		if _, episode := parseSeasonEpisode(media.Title); episode > 0 {
			return episode
		}
	}
	return 0
}

func parseSeasonEpisode(title string) (int, int) {
	if season, episode, ok := parseSeasonEpisodeSegment(strings.ToUpper(title)); ok {
		return season, episode
	}

	delimiterFunc := func(r rune) bool {
		return r == ' ' || r == '-' || r == '_' || r == '.'
	}

	for _, segment := range strings.FieldsFunc(title, delimiterFunc) {
		if season, episode, ok := parseSeasonEpisodeSegment(strings.ToUpper(segment)); ok {
			return season, episode
		}
	}

	return 0, 0
}

func parseSeasonEpisodeSegment(segment string) (int, int, bool) {
	var season, episode int
	if _, err := fmt.Sscanf(segment, "S%02dE%02d", &season, &episode); err == nil && season > 0 && episode > 0 {
		return season, episode, true
	}
	return 0, 0, false
}

func coalesce(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func dedupePlaybackProgress(items []models.PlaybackProgress) []models.PlaybackProgress {
	if len(items) == 0 {
		return items
	}

	seen := make(map[string]bool)
	var result []models.PlaybackProgress

	for _, item := range items {
		key := playbackKey(item.Media)
		if seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, item)
	}

	return result
}

func dedupeRecentlyWatched(items []models.RecentlyWatched) []models.RecentlyWatched {
	if len(items) == 0 {
		return items
	}

	seen := make(map[string]bool)
	var result []models.RecentlyWatched

	for _, item := range items {
		key := playbackKey(item.Media)
		if seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, item)
	}

	return result
}

func playbackKey(media models.Media) string {
	if media.SeriesID != nil && *media.SeriesID != 0 {
		return fmt.Sprintf("series:%d", *media.SeriesID)
	}
	if media.TMDBID != 0 {
		return fmt.Sprintf("tmdb:%d", media.TMDBID)
	}
	if media.Title != "" {
		return fmt.Sprintf("title:%s", strings.ToLower(media.Title))
	}
	return fmt.Sprintf("media:%d", media.ID)
}
