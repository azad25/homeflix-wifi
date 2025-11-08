package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type SonarrService struct {
	baseURL    string
	apiKey     string
	username   string
	password   string
	httpClient *http.Client
}

type SonarrRelease struct {
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

type SonarrSearchRequest struct {
	SeriesId int `json:"seriesId,omitempty"`
	SeasonNumber int `json:"seasonNumber,omitempty"`
	EpisodeId int `json:"episodeId,omitempty"`
}

func NewSonarrService(baseURL, apiKey, username, password string) *SonarrService {
	return &SonarrService{
		baseURL:    strings.TrimSuffix(baseURL, "/"),
		apiKey:     apiKey,
		username:   username,
		password:   password,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func (s *SonarrService) SearchReleases(title string, year int, season int) ([]SonarrRelease, error) {
	// First, try to find the series
	series, err := s.lookupSeries(title, year)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup series: %v", err)
	}

	if len(series) == 0 {
		return []SonarrRelease{}, nil
	}

	// Use the first matching series
	seriesId := series[0]["id"].(float64)
	
	// Search for releases
	endpoint := fmt.Sprintf("%s/api/v3/release", s.baseURL)
	params := url.Values{}
	params.Set("apikey", s.apiKey)
	params.Set("seriesId", fmt.Sprintf("%.0f", seriesId))
	if season > 0 {
		params.Set("seasonNumber", fmt.Sprintf("%d", season))
	}

	fullURL := fmt.Sprintf("%s?%s", endpoint, params.Encode())
	
	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}

	// Add basic auth if username/password provided
	if s.username != "" && s.password != "" {
		req.SetBasicAuth(s.username, s.password)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sonarr request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("sonarr returned status %d", resp.StatusCode)
	}

	var releases []SonarrRelease
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return nil, fmt.Errorf("failed to decode sonarr response: %v", err)
	}

	return releases, nil
}

func (s *SonarrService) lookupSeries(title string, year int) ([]map[string]interface{}, error) {
	endpoint := fmt.Sprintf("%s/api/v3/series/lookup", s.baseURL)
	params := url.Values{}
	params.Set("apikey", s.apiKey)
	params.Set("term", title)

	fullURL := fmt.Sprintf("%s?%s", endpoint, params.Encode())
	
	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return nil, err
	}

	// Add basic auth if username/password provided
	if s.username != "" && s.password != "" {
		req.SetBasicAuth(s.username, s.password)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("sonarr lookup failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("sonarr lookup returned status %d", resp.StatusCode)
	}

	var series []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&series); err != nil {
		return nil, fmt.Errorf("failed to decode sonarr lookup response: %v", err)
	}

	return series, nil
}

func (s *SonarrService) TestConnection() error {
	endpoint := fmt.Sprintf("%s/api/v3/system/status", s.baseURL)
	params := url.Values{}
	params.Set("apikey", s.apiKey)

	fullURL := fmt.Sprintf("%s?%s", endpoint, params.Encode())
	
	req, err := http.NewRequest("GET", fullURL, nil)
	if err != nil {
		return err
	}

	// Add basic auth if username/password provided
	if s.username != "" && s.password != "" {
		req.SetBasicAuth(s.username, s.password)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("connection failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("connection failed with status %d", resp.StatusCode)
	}

	return nil
}