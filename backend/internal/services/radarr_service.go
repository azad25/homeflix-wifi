package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type RadarrService struct {
	baseURL    string
	apiKey     string
	username   string
	password   string
	httpClient *http.Client
}

type RadarrRelease struct {
	Title          string  `json:"title"`
	MagnetUrl      string  `json:"magnetUrl"`
	Seeders        int     `json:"seeders"`
	Leechers       int     `json:"leechers"`
	Size           int64   `json:"size"`
	Quality        string  `json:"quality"`
	Indexer        string  `json:"indexer"`
	ReleaseGroup   string  `json:"releaseGroup"`
	Languages      []string `json:"languages"`
	QualityWeight  int     `json:"qualityWeight"`
	PreferredWordScore int `json:"preferredWordScore"`
}

func NewRadarrService(baseURL, apiKey, username, password string) *RadarrService {
	return &RadarrService{
		baseURL:    strings.TrimSuffix(baseURL, "/"),
		apiKey:     apiKey,
		username:   username,
		password:   password,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (r *RadarrService) SearchReleases(title string, year int) ([]RadarrRelease, error) {
	// First, try to find the movie
	movies, err := r.lookupMovie(title, year)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup movie: %v", err)
	}

	if len(movies) == 0 {
		return []RadarrRelease{}, nil
	}

	// Use the first matching movie
	movieId := movies[0]["id"].(float64)
	
	// Search for releases
	endpoint := fmt.Sprintf("%s/api/v3/release", r.baseURL)
	params := url.Values{}
	params.Set("apikey", r.apiKey)
	params.Set("movieId", fmt.Sprintf("%.0f", movieId))

	fullURL := fmt.Sprintf("%s?%s", endpoint, params.Encode())
	
	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}

	// Add basic auth if username/password provided
	if r.username != "" && r.password != "" {
		req.SetBasicAuth(r.username, r.password)
	}

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("radarr request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("radarr returned status %d", resp.StatusCode)
	}

	var releases []RadarrRelease
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return nil, fmt.Errorf("failed to decode radarr response: %v", err)
	}

	return releases, nil
}

func (r *RadarrService) lookupMovie(title string, year int) ([]map[string]interface{}, error) {
	endpoint := fmt.Sprintf("%s/api/v3/movie/lookup", r.baseURL)
	params := url.Values{}
	params.Set("apikey", r.apiKey)
	
	searchTerm := title
	if year > 0 {
		searchTerm = fmt.Sprintf("%s %d", title, year)
	}
	params.Set("term", searchTerm)

	fullURL := fmt.Sprintf("%s?%s", endpoint, params.Encode())
	
	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}

	// Add basic auth if username/password provided
	if r.username != "" && r.password != "" {
		req.SetBasicAuth(r.username, r.password)
	}

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("radarr lookup failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("radarr lookup returned status %d", resp.StatusCode)
	}

	var movies []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&movies); err != nil {
		return nil, fmt.Errorf("failed to decode radarr lookup response: %v", err)
	}

	return movies, nil
}

func (r *RadarrService) TestConnection() error {
	endpoint := fmt.Sprintf("%s/api/v3/system/status", r.baseURL)
	params := url.Values{}
	params.Set("apikey", r.apiKey)

	fullURL := fmt.Sprintf("%s?%s", endpoint, params.Encode())
	
	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return err
	}

	// Add basic auth if username/password provided
	if r.username != "" && r.password != "" {
		req.SetBasicAuth(r.username, r.password)
	}

	resp, err := r.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("connection failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("connection failed with status %d", resp.StatusCode)
	}

	return nil
}