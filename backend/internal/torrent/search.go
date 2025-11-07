package torrent

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
)

type SearchResult struct {
	Title     string `json:"title"`
	MagnetURI string `json:"magnet_uri"`
	Seeders   int    `json:"seeders"`
	Leechers  int    `json:"leechers"`
	Size      string `json:"size"`
	Quality   string `json:"quality"`
	Source    string `json:"source"`
	Category  string `json:"category"`
	Verified  bool   `json:"verified"`
}

type JackettResult struct {
	Title       string `json:"Title"`
	MagnetUri   string `json:"MagnetUri"`
	Seeders     int    `json:"Seeders"`
	Peers       int    `json:"Peers"`
	Size        int64  `json:"Size"`
	CategoryDesc string `json:"CategoryDesc"`
	Tracker     string `json:"Tracker"`
}

type JackettResponse struct {
	Results []JackettResult `json:"Results"`
}

type TorrentSearcher struct {
	jackettURL    string
	jackettAPIKey string
	minSeeders    int
}

func NewTorrentSearcher(jackettURL, apiKey string, minSeeders int) *TorrentSearcher {
	return &TorrentSearcher{
		jackettURL:    jackettURL,
		jackettAPIKey: apiKey,
		minSeeders:    minSeeders,
	}
}

func (ts *TorrentSearcher) SearchMovie(title string, year int, quality string) ([]SearchResult, error) {
	query := fmt.Sprintf("%s %d", title, year)
	if quality != "" {
		query += " " + quality
	}
	
	return ts.search(query, "movie")
}

func (ts *TorrentSearcher) SearchTVShow(title string, season, episode int, quality string) ([]SearchResult, error) {
	var query string
	if episode > 0 {
		query = fmt.Sprintf("%s S%02dE%02d", title, season, episode)
	} else {
		query = fmt.Sprintf("%s Season %d", title, season)
	}
	
	if quality != "" {
		query += " " + quality
	}
	
	return ts.search(query, "tv")
}

func (ts *TorrentSearcher) search(query, category string) ([]SearchResult, error) {
	// Use Jackett if configured, otherwise fallback to demo
	return ts.searchJackett(query)
}

func (ts *TorrentSearcher) searchJackett(query string) ([]SearchResult, error) {
	// Check if Jackett is configured
	if ts.jackettURL == "" || ts.jackettAPIKey == "" {
		fmt.Printf("Jackett not configured, using demo results for query: %s\n", query)
		return ts.getMockResults(query), nil
	}

	// Build Jackett API URL
	u := fmt.Sprintf("%s/api/v2.0/indexers/all/results", strings.TrimSuffix(ts.jackettURL, "/"))
	params := url.Values{}
	params.Set("apikey", ts.jackettAPIKey)
	params.Set("Query", query)
	params.Set("Category[]", "2000") // Movies category
	params.Set("Limit", "100") // Increase result limit
	
	fullURL := fmt.Sprintf("%s?%s", u, params.Encode())
	fmt.Printf("Searching Jackett: %s\n", fullURL)
	
	resp, err := http.Get(fullURL)
	if err != nil {
		fmt.Printf("Jackett request failed: %v, falling back to demo results\n", err)
		return ts.getMockResults(query), nil
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		fmt.Printf("Jackett returned status %d, falling back to demo results\n", resp.StatusCode)
		return ts.getMockResults(query), nil
	}
	
	var jackettResp JackettResponse
	if err := json.NewDecoder(resp.Body).Decode(&jackettResp); err != nil {
		fmt.Printf("Failed to decode Jackett response: %v, falling back to demo results\n", err)
		return ts.getMockResults(query), nil
	}

	fmt.Printf("Jackett returned %d results\n", len(jackettResp.Results))

	var results []SearchResult
	for _, jr := range jackettResp.Results {
		// Only skip if seeders is 0 (dead torrents)
		if jr.Seeders == 0 {
			continue
		}

		// Handle missing magnet URI
		if jr.MagnetUri == "" {
			continue
		}

		result := SearchResult{
			Title:     jr.Title,
			MagnetURI: jr.MagnetUri,
			Seeders:   jr.Seeders,
			Leechers:  jr.Peers - jr.Seeders,
			Size:      formatSize(jr.Size),
			Quality:   extractQuality(jr.Title),
			Source:    jr.Tracker,
			Category:  jr.CategoryDesc,
			Verified:  jr.Seeders > 10, // Lower threshold for verified
		}
		results = append(results, result)
	}

	// Sort by seeders (highest first)
	sort.Slice(results, func(i, j int) bool {
		return results[i].Seeders > results[j].Seeders
	})

	fmt.Printf("Filtered to %d results (excluding dead torrents)\n", len(results))

	// If no real results, fallback to demo
	if len(results) == 0 {
		fmt.Printf("No results found, using demo results\n")
		return ts.getMockResults(query), nil
	}

	return results, nil
}

func (ts *TorrentSearcher) getMockResults(query string) []SearchResult {
	// Generate mock search results for demo purposes
	mockResults := []SearchResult{
		{
			Title:     fmt.Sprintf("%s (2023) 1080p BluRay x264-DEMO", query),
			MagnetURI: "magnet:?xt=urn:btih:demo1234567890abcdef&dn=" + url.QueryEscape(query),
			Seeders:   156,
			Leechers:  23,
			Size:      "2.1 GB",
			Quality:   "1080p",
			Source:    "Demo Tracker",
			Category:  "Movies",
			Verified:  true,
		},
		{
			Title:     fmt.Sprintf("%s (2023) 720p WEB-DL x264-DEMO", query),
			MagnetURI: "magnet:?xt=urn:btih:demo2345678901bcdef&dn=" + url.QueryEscape(query),
			Seeders:   89,
			Leechers:  15,
			Size:      "1.4 GB",
			Quality:   "720p",
			Source:    "Demo Tracker",
			Category:  "Movies",
			Verified:  true,
		},
		{
			Title:     fmt.Sprintf("%s (2023) 4K UHD BluRay x265-DEMO", query),
			MagnetURI: "magnet:?xt=urn:btih:demo3456789012cdef&dn=" + url.QueryEscape(query),
			Seeders:   67,
			Leechers:  8,
			Size:      "8.2 GB",
			Quality:   "2160p",
			Source:    "Demo Tracker",
			Category:  "Movies",
			Verified:  true,
		},
		{
			Title:     fmt.Sprintf("%s (2023) 480p WEB-DL x264-DEMO", query),
			MagnetURI: "magnet:?xt=urn:btih:demo4567890123def&dn=" + url.QueryEscape(query),
			Seeders:   34,
			Leechers:  12,
			Size:      "800 MB",
			Quality:   "480p",
			Source:    "Demo Tracker",
			Category:  "Movies",
			Verified:  false,
		},
	}

	// Filter by minimum seeders
	var filtered []SearchResult
	for _, result := range mockResults {
		if result.Seeders >= ts.minSeeders {
			filtered = append(filtered, result)
		}
	}

	return filtered
}

func (ts *TorrentSearcher) directSearch(query, category string) ([]SearchResult, error) {
	// Try Jackett first if available
	if ts.jackettURL != "" && ts.jackettAPIKey != "" {
		results, err := ts.searchJackett(query)
		if err == nil && len(results) > 0 {
			return results, nil
		}
	}
	
	// Fallback to mock results for demo
	return ts.getMockResults(query), nil
}

func extractQuality(title string) string {
	title = strings.ToUpper(title)
	
	qualities := []string{"2160P", "4K", "1080P", "720P", "480P", "360P"}
	for _, quality := range qualities {
		if strings.Contains(title, quality) {
			return quality
		}
	}
	
	// Check for common quality indicators
	if strings.Contains(title, "BLURAY") || strings.Contains(title, "BDR") {
		return "BluRay"
	}
	if strings.Contains(title, "WEBRIP") || strings.Contains(title, "WEB-DL") {
		return "WebRip"
	}
	if strings.Contains(title, "HDTV") {
		return "HDTV"
	}
	if strings.Contains(title, "CAM") || strings.Contains(title, "TS") {
		return "CAM"
	}
	
	return "Unknown"
}

func formatSize(bytes int64) string {
	if bytes == 0 {
		return "Unknown"
	}
	
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}