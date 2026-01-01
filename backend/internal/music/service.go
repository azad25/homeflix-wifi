package music

import (
	"fmt"
	"gorm.io/gorm"
)

type Service struct {
	db      *gorm.DB
	youtube *YouTubeService
}

func NewService(db *gorm.DB, youtubeAPIKey string) *Service {
	return &Service{
		db:      db,
		youtube: NewYouTubeService(youtubeAPIKey),
	}
}

// SearchTracks searches for tracks and saves them to database
func (s *Service) SearchTracks(query string, maxResults int) ([]Track, error) {
	// Search YouTube
	tracks, err := s.youtube.SearchTracks(query, maxResults)
	if err != nil {
		return nil, err
	}

	// Save tracks to database (upsert)
	for i := range tracks {
		var existingTrack Track
		result := s.db.Where("youtube_id = ?", tracks[i].YouTubeID).First(&existingTrack)
		
		if result.Error == gorm.ErrRecordNotFound {
			// Create new track
			if err := s.db.Create(&tracks[i]).Error; err != nil {
				continue // Skip on error, don't fail entire search
			}
		} else if result.Error == nil {
			// Update existing track
			tracks[i].ID = existingTrack.ID
			s.db.Model(&existingTrack).Updates(tracks[i])
			tracks[i] = existingTrack
		}
	}

	return tracks, nil
}

// GetTrendingTracks gets trending tracks
func (s *Service) GetTrendingTracks(maxResults int) ([]Track, error) {
	tracks, err := s.youtube.GetTrendingTracks(maxResults)
	if err != nil {
		return nil, err
	}

	// Save to database
	for i := range tracks {
		var existingTrack Track
		result := s.db.Where("youtube_id = ?", tracks[i].YouTubeID).First(&existingTrack)
		
		if result.Error == gorm.ErrRecordNotFound {
			s.db.Create(&tracks[i])
		} else if result.Error == nil {
			tracks[i].ID = existingTrack.ID
			s.db.Model(&existingTrack).Updates(tracks[i])
			tracks[i] = existingTrack
		}
	}

	return tracks, nil
}

// CreatePlaylist creates a new playlist
func (s *Service) CreatePlaylist(name, description, userID string) (*Playlist, error) {
	playlist := &Playlist{
		Name:        name,
		Description: description,
		UserID:      userID,
		IsPublic:    true,
	}

	if err := s.db.Create(playlist).Error; err != nil {
		return nil, err
	}

	return playlist, nil
}

// GetPlaylists gets user playlists
func (s *Service) GetPlaylists(userID string) ([]Playlist, error) {
	var playlists []Playlist
	err := s.db.Where("user_id = ? OR is_public = ?", userID, true).
		Preload("Tracks").
		Find(&playlists).Error
	
	return playlists, err
}

// AddTrackToPlaylist adds a track to playlist
func (s *Service) AddTrackToPlaylist(playlistID, trackID uint, userID string) error {
	// Verify playlist ownership or public
	var playlist Playlist
	if err := s.db.First(&playlist, playlistID).Error; err != nil {
		return err
	}

	if playlist.UserID != userID && !playlist.IsPublic {
		return fmt.Errorf("access denied")
	}

	// Get current max position
	var maxPos int
	s.db.Table("playlist_tracks").
		Where("playlist_id = ?", playlistID).
		Select("COALESCE(MAX(position), 0)").
		Scan(&maxPos)

	// Add track
	playlistTrack := PlaylistTrack{
		PlaylistID: playlistID,
		TrackID:    trackID,
		Position:   maxPos + 1,
	}

	return s.db.Create(&playlistTrack).Error
}

// LikeTrack likes/unlikes a track
func (s *Service) LikeTrack(trackID uint, userID string) error {
	var like UserLike
	result := s.db.Where("user_id = ? AND track_id = ?", userID, trackID).First(&like)

	if result.Error == gorm.ErrRecordNotFound {
		// Create like
		like = UserLike{
			UserID:  userID,
			TrackID: trackID,
		}
		return s.db.Create(&like).Error
	} else if result.Error == nil {
		// Remove like
		return s.db.Delete(&like).Error
	}

	return result.Error
}

// GetLikedTracks gets user's liked tracks
func (s *Service) GetLikedTracks(userID string) ([]Track, error) {
	var tracks []Track
	err := s.db.Table("tracks").
		Joins("JOIN user_likes ON tracks.id = user_likes.track_id").
		Where("user_likes.user_id = ?", userID).
		Find(&tracks).Error

	return tracks, err
}

// AddToRecentlyPlayed adds track to recently played
func (s *Service) AddToRecentlyPlayed(trackID uint, userID string) error {
	recent := RecentlyPlayed{
		UserID:  userID,
		TrackID: trackID,
	}

	// Remove old entry if exists
	s.db.Where("user_id = ? AND track_id = ?", userID, trackID).Delete(&RecentlyPlayed{})
	
	// Add new entry
	return s.db.Create(&recent).Error
}

// GetRecentlyPlayed gets recently played tracks
func (s *Service) GetRecentlyPlayed(userID string, limit int) ([]RecentlyPlayed, error) {
	if limit == 0 {
		limit = 50
	}

	var recent []RecentlyPlayed
	err := s.db.Where("user_id = ?", userID).
		Preload("Track").
		Order("played_at DESC").
		Limit(limit).
		Find(&recent).Error

	return recent, err
}

// GetTrackByYouTubeID gets track by YouTube ID
func (s *Service) GetTrackByYouTubeID(youtubeID string) (*Track, error) {
	var track Track
	err := s.db.Where("youtube_id = ?", youtubeID).First(&track).Error
	if err != nil {
		return nil, err
	}
	return &track, nil
}

// GetPlaylistWithTracks gets playlist with tracks
func (s *Service) GetPlaylistWithTracks(playlistID uint) (*Playlist, error) {
	var playlist Playlist
	err := s.db.Preload("Tracks").First(&playlist, playlistID).Error
	if err != nil {
		return nil, err
	}
	return &playlist, nil
}

// GetTopCharts gets top music charts
func (s *Service) GetTopCharts(maxResults int) ([]Track, error) {
	tracks, err := s.youtube.GetTopCharts(maxResults)
	if err != nil {
		return nil, err
	}

	// Save to database
	for i := range tracks {
		var existingTrack Track
		result := s.db.Where("youtube_id = ?", tracks[i].YouTubeID).First(&existingTrack)
		
		if result.Error == gorm.ErrRecordNotFound {
			s.db.Create(&tracks[i])
		} else if result.Error == nil {
			tracks[i].ID = existingTrack.ID
			s.db.Model(&existingTrack).Updates(tracks[i])
			tracks[i] = existingTrack
		}
	}

	return tracks, nil
}

// GetNewReleases gets new music releases
func (s *Service) GetNewReleases(maxResults int) ([]Track, error) {
	tracks, err := s.youtube.GetNewReleases(maxResults)
	if err != nil {
		return nil, err
	}

	// Save to database
	for i := range tracks {
		var existingTrack Track
		result := s.db.Where("youtube_id = ?", tracks[i].YouTubeID).First(&existingTrack)
		
		if result.Error == gorm.ErrRecordNotFound {
			s.db.Create(&tracks[i])
		} else if result.Error == nil {
			tracks[i].ID = existingTrack.ID
			s.db.Model(&existingTrack).Updates(tracks[i])
			tracks[i] = existingTrack
		}
	}

	return tracks, nil
}

// GetGenreMusic gets music by genre
func (s *Service) GetGenreMusic(genre string, maxResults int) ([]Track, error) {
	tracks, err := s.youtube.GetGenreMusic(genre, maxResults)
	if err != nil {
		return nil, err
	}

	// Save to database
	for i := range tracks {
		var existingTrack Track
		result := s.db.Where("youtube_id = ?", tracks[i].YouTubeID).First(&existingTrack)
		
		if result.Error == gorm.ErrRecordNotFound {
			s.db.Create(&tracks[i])
		} else if result.Error == nil {
			tracks[i].ID = existingTrack.ID
			s.db.Model(&existingTrack).Updates(tracks[i])
			tracks[i] = existingTrack
		}
	}

	return tracks, nil
}

// GetMoodMusic gets music by mood
func (s *Service) GetMoodMusic(mood string, maxResults int) ([]Track, error) {
	tracks, err := s.youtube.GetMoodMusic(mood, maxResults)
	if err != nil {
		return nil, err
	}

	// Save to database
	for i := range tracks {
		var existingTrack Track
		result := s.db.Where("youtube_id = ?", tracks[i].YouTubeID).First(&existingTrack)
		
		if result.Error == gorm.ErrRecordNotFound {
			s.db.Create(&tracks[i])
		} else if result.Error == nil {
			tracks[i].ID = existingTrack.ID
			s.db.Model(&existingTrack).Updates(tracks[i])
			tracks[i] = existingTrack
		}
	}

	return tracks, nil
}