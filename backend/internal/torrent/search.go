package torrent

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	
	"homeflix-backend/internal/services"
)

type SearchResult struct {
	Title          string   `json:"title"`
	MagnetURI      string   `json:"magnet_uri"`
	Seeders        int      `json:"seeders"`
	Leechers       int      `json:"leechers"`
	Size           string   `json:"size"`
	Quality        string   `json:"quality"`
	Source         string   `json:"source"`
	Category       string   `json:"category"`
	Verified       bool     `json:"verified"`
	// New fields for Arr integration
	ReleaseGroup   string   `json:"release_group"`
	Languages      []string `json:"languages"`
	ArrScore       float64  `json:"arr_score"`    // Sonarr/Radarr quality score
	IsPreferred    bool     `json:"is_preferred"` // Based on Arr preferences
	SourceType     string   `json:"source_type"`  // "jackett", "sonarr", "radarr"
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
	// Arr services
	sonarrService *services.SonarrService
	radarrService *services.RadarrService
	useArrSearch  bool
}

func NewTorrentSearcher(jackettURL, apiKey string, minSeeders int) *TorrentSearcher {
	return &TorrentSearcher{
		jackettURL:    jackettURL,
		jackettAPIKey: apiKey,
		minSeeders:    minSeeders,
		useArrSearch:  false,
	}
}

func NewTorrentSearcherWithArr(jackettURL, apiKey string, minSeeders int, sonarrService *services.SonarrService, radarrService *services.RadarrService, useArrSearch bool) *TorrentSearcher {
	return &TorrentSearcher{
		jackettURL:    jackettURL,
		jackettAPIKey: apiKey,
		minSeeders:    minSeeders,
		sonarrService: sonarrService,
		radarrService: radarrService,
		useArrSearch:  useArrSearch,
	}
}

func (ts *TorrentSearcher) SearchMovie(title string, year int, quality string) ([]SearchResult, error) {
	var allResults []SearchResult
	
	// 1. Search via Jackett (existing)
	var query string
	if year > 0 {
		query = fmt.Sprintf("%s %d", title, year)
	} else {
		query = title
	}
	
	if quality != "" {
		query += " " + quality
	}
	
	jackettResults, err := ts.search(query, "movie")
	if err == nil {
		// Mark Jackett results
		for i := range jackettResults {
			jackettResults[i].SourceType = "jackett"
		}
		allResults = append(allResults, jackettResults...)
	}
	
	// 2. Search via Radarr (if enabled)
	if ts.useArrSearch && ts.radarrService != nil {
		radarrResults, err := ts.searchRadarr(title, year, quality)
		if err == nil {
			allResults = append(allResults, radarrResults...)
		}
	}
	
	// 3. Merge, deduplicate, and rank results
	return ts.mergeAndRankResults(allResults), nil
}

func (ts *TorrentSearcher) SearchTVShow(title string, season, episode int, quality string) ([]SearchResult, error) {
	var allResults []SearchResult
	
	// 1. Search via Jackett (existing)
	var query string
	
	if episode > 0 {
		// Search for specific episode
		query = fmt.Sprintf("%s S%02dE%02d", title, season, episode)
	} else if season > 0 {
		// Search for specific season
		query = fmt.Sprintf("%s S%02d", title, season)
	} else {
		// Search for entire series - just use title like movies
		query = title
	}
	
	if quality != "" {
		query += " " + quality
	}
	
	jackettResults, err := ts.search(query, "tv")
	if err == nil {
		// Mark Jackett results
		for i := range jackettResults {
			jackettResults[i].SourceType = "jackett"
		}
		allResults = append(allResults, jackettResults...)
	}
	
	// 2. Search via Sonarr (if enabled)
	if ts.useArrSearch && ts.sonarrService != nil {
		sonarrResults, err := ts.searchSonarr(title, 0, season, quality) // year=0 for TV shows
		if err == nil {
			allResults = append(allResults, sonarrResults...)
		}
	}
	
	// 3. Merge, deduplicate, and rank results
	return ts.mergeAndRankResults(allResults), nil
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

// searchRadarr searches for movie releases via Radarr
func (ts *TorrentSearcher) searchRadarr(title string, year int, quality string) ([]SearchResult, error) {
	releases, err := ts.radarrService.SearchReleases(title, year)
	if err != nil {
		return nil, err
	}
	
	var results []SearchResult
	for _, release := range releases {
		if release.MagnetUrl == "" {
			continue
		}
		
		// Apply minimum seeders filter
		if release.Seeders < ts.minSeeders {
			continue
		}
		
		result := SearchResult{
			Title:          release.Title,
			MagnetURI:      release.MagnetUrl,
			Seeders:        release.Seeders,
			Leechers:       release.Leechers,
			Size:           formatSize(release.Size),
			Quality:        extractQualityFromTitle(release.Title),
			Source:         release.Indexer,
			Category:       "Movies",
			Verified:       release.Seeders > 10,
			ReleaseGroup:   release.ReleaseGroup,
			Languages:      release.Languages,
			ArrScore:       float64(release.QualityWeight + release.PreferredWordScore),
			IsPreferred:    release.PreferredWordScore > 0,
			SourceType:     "radarr",
		}
		results = append(results, result)
	}
	
	return results, nil
}

// searchSonarr searches for TV show releases via Sonarr
func (ts *TorrentSearcher) searchSonarr(title string, year, season int, quality string) ([]SearchResult, error) {
	releases, err := ts.sonarrService.SearchReleases(title, year, season)
	if err != nil {
		return nil, err
	}
	
	var results []SearchResult
	for _, release := range releases {
		if release.MagnetUrl == "" {
			continue
		}
		
		// Apply minimum seeders filter
		if release.Seeders < ts.minSeeders {
			continue
		}
		
		result := SearchResult{
			Title:          release.Title,
			MagnetURI:      release.MagnetUrl,
			Seeders:        release.Seeders,
			Leechers:       release.Leechers,
			Size:           formatSize(release.Size),
			Quality:        extractQualityFromTitle(release.Title),
			Source:         release.Indexer,
			Category:       "TV Shows",
			Verified:       release.Seeders > 10,
			ReleaseGroup:   release.ReleaseGroup,
			Languages:      release.Languages,
			ArrScore:       float64(release.QualityWeight + release.PreferredWordScore),
			IsPreferred:    release.PreferredWordScore > 0,
			SourceType:     "sonarr",
		}
		results = append(results, result)
	}
	
	return results, nil
}

// mergeAndRankResults combines results from different sources and ranks them
func (ts *TorrentSearcher) mergeAndRankResults(results []SearchResult) []SearchResult {
	// Deduplicate by magnet URI
	seen := make(map[string]bool)
	var unique []SearchResult
	
	for _, result := range results {
		if !seen[result.MagnetURI] {
			seen[result.MagnetURI] = true
			unique = append(unique, result)
		}
	}
	
	// Sort by: 1. Arr score (if available), 2. Seeders, 3. Preferred status
	sort.Slice(unique, func(i, j int) bool {
		a, b := unique[i], unique[j]
		
		// Prioritize preferred releases
		if a.IsPreferred != b.IsPreferred {
			return a.IsPreferred
		}
		
		// Then by Arr score (higher is better)
		if a.ArrScore != b.ArrScore {
			return a.ArrScore > b.ArrScore
		}
		
		// Finally by seeders (higher is better)
		return a.Seeders > b.Seeders
	})
	
	return unique
}

// extractQualityFromTitle extracts quality from title (enhanced version)
func extractQualityFromTitle(title string) string {
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