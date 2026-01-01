package music

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type YouTubeService struct {
	APIKey string
	Client *http.Client
}

type YouTubeSearchResponse struct {
	Items []YouTubeSearchResult `json:"items"`
}

type YouTubeSearchResult struct {
	ID      YouTubeVideoID `json:"id"`
	Snippet YouTubeSnippet `json:"snippet"`
}

type YouTubeVideoResponse struct {
	Items []YouTubeVideoDetail `json:"items"`
}

type YouTubeVideoDetail struct {
	ID      string `json:"id"`
	Snippet YouTubeSnippet `json:"snippet"`
	Statistics YouTubeStatistics `json:"statistics,omitempty"`
	ContentDetails YouTubeContentDetails `json:"contentDetails,omitempty"`
}

type YouTubeVideo struct {
	ID      interface{} `json:"id"` // Can be string or YouTubeVideoID object
	Snippet YouTubeSnippet `json:"snippet"`
	Statistics YouTubeStatistics `json:"statistics,omitempty"`
	ContentDetails YouTubeContentDetails `json:"contentDetails,omitempty"`
}

type YouTubeVideoID struct {
	VideoID string `json:"videoId"`
}

type YouTubeSnippet struct {
	Title        string    `json:"title"`
	Description  string    `json:"description"`
	ChannelTitle string    `json:"channelTitle"`
	PublishedAt  time.Time `json:"publishedAt"`
	Thumbnails   YouTubeThumbnails `json:"thumbnails"`
}

type YouTubeThumbnails struct {
	High YouTubeThumbnail `json:"high"`
	Medium YouTubeThumbnail `json:"medium"`
	Default YouTubeThumbnail `json:"default"`
}

type YouTubeThumbnail struct {
	URL    string `json:"url"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

type YouTubeStatistics struct {
	ViewCount string `json:"viewCount"`
	LikeCount string `json:"likeCount"`
}

type YouTubeContentDetails struct {
	Duration string `json:"duration"`
}

func NewYouTubeService(apiKey string) *YouTubeService {
	return &YouTubeService{
		APIKey: apiKey,
		Client: &http.Client{Timeout: 30 * time.Second},
	}
}

// SearchTracks searches for music tracks on YouTube
func (ys *YouTubeService) SearchTracks(query string, maxResults int) ([]Track, error) {
	if maxResults == 0 {
		maxResults = 25
	}

	// Build search URL
	baseURL := "https://www.googleapis.com/youtube/v3/search"
	params := url.Values{}
	params.Set("part", "snippet")
	params.Set("q", query+" music")
	params.Set("type", "video")
	params.Set("videoCategoryId", "10") // Music category
	params.Set("maxResults", strconv.Itoa(maxResults))
	params.Set("order", "relevance")
	params.Set("key", ys.APIKey)

	searchURL := fmt.Sprintf("%s?%s", baseURL, params.Encode())

	// Make request
	resp, err := ys.Client.Get(searchURL)
	if err != nil {
		return nil, fmt.Errorf("failed to search YouTube: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("YouTube API error: %d", resp.StatusCode)
	}

	var searchResp YouTubeSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Get video IDs for detailed info
	var videoIDs []string
	for _, item := range searchResp.Items {
		if item.ID.VideoID != "" {
			videoIDs = append(videoIDs, item.ID.VideoID)
		}
	}

	if len(videoIDs) == 0 {
		return []Track{}, nil
	}

	// Get detailed video information
	tracks, err := ys.getVideoDetails(videoIDs)
	if err != nil {
		// Fallback to basic info if detailed fetch fails
		return ys.convertBasicTracks(searchResp.Items), nil
	}

	return tracks, nil
}

// extractVideoID extracts video ID from either string or object format
func (ys *YouTubeService) extractVideoID(id interface{}) string {
	switch v := id.(type) {
	case string:
		return v
	case map[string]interface{}:
		if videoID, ok := v["videoId"].(string); ok {
			return videoID
		}
	}
	return ""
}

// GetTrendingTracks gets trending music tracks
func (ys *YouTubeService) GetTrendingTracks(maxResults int) ([]Track, error) {
	if maxResults == 0 {
		maxResults = 50
	}

	baseURL := "https://www.googleapis.com/youtube/v3/videos"
	params := url.Values{}
	params.Set("part", "snippet,statistics,contentDetails")
	params.Set("chart", "mostPopular")
	params.Set("videoCategoryId", "10") // Music category
	params.Set("regionCode", "US")
	params.Set("maxResults", strconv.Itoa(maxResults))
	params.Set("key", ys.APIKey)

	trendingURL := fmt.Sprintf("%s?%s", baseURL, params.Encode())

	resp, err := ys.Client.Get(trendingURL)
	if err != nil {
		return nil, fmt.Errorf("failed to get trending: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("YouTube API error: %d", resp.StatusCode)
	}

	var response YouTubeVideoResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return ys.convertVideoDetails(response.Items), nil
}

// convertVideoDetails converts YouTube video details to Track objects
func (ys *YouTubeService) convertVideoDetails(videos []YouTubeVideoDetail) []Track {
	var tracks []Track

	for _, video := range videos {
		if video.ID == "" {
			continue
		}

		track := Track{
			YouTubeID:    video.ID,
			Title:        video.Snippet.Title,
			Artist:       video.Snippet.ChannelTitle,
			Description:  video.Snippet.Description,
			PublishedAt:  video.Snippet.PublishedAt,
			ThumbnailURL: video.Snippet.Thumbnails.High.URL,
		}

		// Parse duration
		if video.ContentDetails.Duration != "" {
			track.Duration = ys.parseDuration(video.ContentDetails.Duration)
		}

		// Parse statistics
		if video.Statistics.ViewCount != "" {
			if viewCount, err := strconv.ParseInt(video.Statistics.ViewCount, 10, 64); err == nil {
				track.ViewCount = viewCount
			}
		}
		if video.Statistics.LikeCount != "" {
			if likeCount, err := strconv.ParseInt(video.Statistics.LikeCount, 10, 64); err == nil {
				track.LikeCount = likeCount
			}
		}

		tracks = append(tracks, track)
	}

	return tracks
}

// getVideoDetails fetches detailed information for video IDs
func (ys *YouTubeService) getVideoDetails(videoIDs []string) ([]Track, error) {
	baseURL := "https://www.googleapis.com/youtube/v3/videos"
	params := url.Values{}
	params.Set("part", "snippet,statistics,contentDetails")
	params.Set("id", strings.Join(videoIDs, ","))
	params.Set("key", ys.APIKey)

	detailURL := fmt.Sprintf("%s?%s", baseURL, params.Encode())

	resp, err := ys.Client.Get(detailURL)
	if err != nil {
		return nil, fmt.Errorf("failed to get video details: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("YouTube API error: %d", resp.StatusCode)
	}

	var response struct {
		Items []YouTubeVideo `json:"items"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return ys.convertDetailedTracks(response.Items), nil
}

// convertDetailedTracks converts YouTube videos with full details to Track objects
func (ys *YouTubeService) convertDetailedTracks(videos []YouTubeVideo) []Track {
	var tracks []Track

	for _, video := range videos {
		videoID := ys.extractVideoID(video.ID)
		if videoID == "" {
			continue
		}

		track := Track{
			YouTubeID:    videoID,
			Title:        video.Snippet.Title,
			Artist:       video.Snippet.ChannelTitle,
			Description:  video.Snippet.Description,
			PublishedAt:  video.Snippet.PublishedAt,
			ThumbnailURL: video.Snippet.Thumbnails.High.URL,
		}

		// Parse duration
		if video.ContentDetails.Duration != "" {
			track.Duration = ys.parseDuration(video.ContentDetails.Duration)
		}

		// Parse statistics
		if video.Statistics.ViewCount != "" {
			if viewCount, err := strconv.ParseInt(video.Statistics.ViewCount, 10, 64); err == nil {
				track.ViewCount = viewCount
			}
		}
		if video.Statistics.LikeCount != "" {
			if likeCount, err := strconv.ParseInt(video.Statistics.LikeCount, 10, 64); err == nil {
				track.LikeCount = likeCount
			}
		}

		tracks = append(tracks, track)
	}

	return tracks
}

// convertBasicTracks converts basic YouTube search results to Track objects
func (ys *YouTubeService) convertBasicTracks(videos []YouTubeSearchResult) []Track {
	var tracks []Track

	for _, video := range videos {
		track := Track{
			YouTubeID:    video.ID.VideoID,
			Title:        video.Snippet.Title,
			Artist:       video.Snippet.ChannelTitle,
			Description:  video.Snippet.Description,
			PublishedAt:  video.Snippet.PublishedAt,
			ThumbnailURL: video.Snippet.Thumbnails.High.URL,
		}

		tracks = append(tracks, track)
	}

	return tracks
}

// parseDuration converts YouTube duration format (PT4M13S) to seconds
func (ys *YouTubeService) parseDuration(duration string) int {
	// Remove PT prefix
	duration = strings.TrimPrefix(duration, "PT")
	
	var totalSeconds int
	var current string
	
	for _, char := range duration {
		switch char {
		case 'H':
			if hours, err := strconv.Atoi(current); err == nil {
				totalSeconds += hours * 3600
			}
			current = ""
		case 'M':
			if minutes, err := strconv.Atoi(current); err == nil {
				totalSeconds += minutes * 60
			}
			current = ""
		case 'S':
			if seconds, err := strconv.Atoi(current); err == nil {
				totalSeconds += seconds
			}
			current = ""
		default:
			current += string(char)
		}
	}
	
	return totalSeconds
}

// GetPlaylistTracks gets tracks from a YouTube playlist
func (ys *YouTubeService) GetPlaylistTracks(playlistID string, maxResults int) ([]Track, error) {
	if maxResults == 0 {
		maxResults = 50
	}

	baseURL := "https://www.googleapis.com/youtube/v3/playlistItems"
	params := url.Values{}
	params.Set("part", "snippet")
	params.Set("playlistId", playlistID)
	params.Set("maxResults", strconv.Itoa(maxResults))
	params.Set("key", ys.APIKey)

	playlistURL := fmt.Sprintf("%s?%s", baseURL, params.Encode())

	resp, err := ys.Client.Get(playlistURL)
	if err != nil {
		return nil, fmt.Errorf("failed to get playlist: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("YouTube API error: %d", resp.StatusCode)
	}

	var response struct {
		Items []struct {
			Snippet struct {
				ResourceID struct {
					VideoID string `json:"videoId"`
				} `json:"resourceId"`
			} `json:"snippet"`
		} `json:"items"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Extract video IDs
	var videoIDs []string
	for _, item := range response.Items {
		if item.Snippet.ResourceID.VideoID != "" {
			videoIDs = append(videoIDs, item.Snippet.ResourceID.VideoID)
		}
	}

	if len(videoIDs) == 0 {
		return []Track{}, nil
	}

	return ys.getVideoDetails(videoIDs)
}

// GetTopCharts gets top music charts
func (ys *YouTubeService) GetTopCharts(maxResults int) ([]Track, error) {
	if maxResults == 0 {
		maxResults = 50
	}

	// Search for popular music charts
	query := "top music charts 2024"
	return ys.SearchTracks(query, maxResults)
}

// GetNewReleases gets new music releases
func (ys *YouTubeService) GetNewReleases(maxResults int) ([]Track, error) {
	if maxResults == 0 {
		maxResults = 30
	}

	// Search for new music releases
	query := "new music releases 2024"
	return ys.SearchTracks(query, maxResults)
}

// GetGenreMusic gets music by genre
func (ys *YouTubeService) GetGenreMusic(genre string, maxResults int) ([]Track, error) {
	if maxResults == 0 {
		maxResults = 25
	}

	// Search for genre-specific music
	query := fmt.Sprintf("%s music hits", genre)
	return ys.SearchTracks(query, maxResults)
}

// GetMoodMusic gets music by mood
func (ys *YouTubeService) GetMoodMusic(mood string, maxResults int) ([]Track, error) {
	if maxResults == 0 {
		maxResults = 25
	}

	// Search for mood-specific music
	query := fmt.Sprintf("%s music playlist", mood)
	return ys.SearchTracks(query, maxResults)
}

// GetArtistTopTracks gets top tracks from a specific artist
func (ys *YouTubeService) GetArtistTopTracks(artist string, maxResults int) ([]Track, error) {
	if maxResults == 0 {
		maxResults = 20
	}

	// Search for artist's top tracks
	query := fmt.Sprintf("%s top songs hits", artist)
	return ys.SearchTracks(query, maxResults)
}