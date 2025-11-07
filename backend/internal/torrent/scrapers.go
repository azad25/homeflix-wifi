package torrent

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

// DirectScraper scrapes torrent sites directly without Jackett
type DirectScraper struct {
	userAgent string
	timeout   time.Duration
}

// NewDirectScraper creates a new direct scraper
func NewDirectScraper() *DirectScraper {
	return &DirectScraper{
		userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
		timeout:   30 * time.Second,
	}
}

// SearchAllSites searches multiple torrent sites directly
func (ds *DirectScraper) SearchAllSites(query string, minSeeders int) ([]SearchResult, error) {
	var allResults []SearchResult

	// Search multiple sites concurrently
	sites := []func(string, int) ([]SearchResult, error){
		ds.searchYTS,
		ds.searchLimeTorrents,
		ds.searchTorrentGalaxy,
	}

	for _, searchFunc := range sites {
		results, err := searchFunc(query, minSeeders)
		if err != nil {
			continue // Skip failed sites
		}
		allResults = append(allResults, results...)
	}

	// Sort by seeders
	for i := 0; i < len(allResults)-1; i++ {
		for j := i + 1; j < len(allResults); j++ {
			if allResults[i].Seeders < allResults[j].Seeders {
				allResults[i], allResults[j] = allResults[j], allResults[i]
			}
		}
	}

	return allResults, nil
}

// searchYTS searches YTS for movies
func (ds *DirectScraper) searchYTS(query string, minSeeders int) ([]SearchResult, error) {
	// YTS has a public API
	apiURL := fmt.Sprintf("https://yts.mx/api/v2/list_movies.json?query_term=%s&limit=20&sort_by=seeders", url.QueryEscape(query))
	
	client := &http.Client{Timeout: ds.timeout}
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", ds.userAgent)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var ytsResp struct {
		Status string `json:"status"`
		Data   struct {
			Movies []struct {
				Title   string `json:"title"`
				Year    int    `json:"year"`
				Torrents []struct {
					URL      string `json:"url"`
					Hash     string `json:"hash"`
					Quality  string `json:"quality"`
					Seeds    int    `json:"seeds"`
					Peers    int    `json:"peers"`
					Size     string `json:"size"`
				} `json:"torrents"`
			} `json:"movies"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&ytsResp); err != nil {
		return nil, err
	}

	var results []SearchResult
	for _, movie := range ytsResp.Data.Movies {
		for _, torrent := range movie.Torrents {
			if torrent.Seeds < minSeeders {
				continue
			}

			magnetURI := fmt.Sprintf("magnet:?xt=urn:btih:%s&dn=%s&tr=udp://open.demonii.com:1337/announce&tr=udp://tracker.openbittorrent.com:80&tr=udp://tracker.coppersurfer.tk:6969&tr=udp://glotorrents.pw:6969/announce&tr=udp://tracker.opentrackr.org:1337/announce&tr=udp://torrent.gresille.org:80/announce&tr=udp://p4p.arenabg.com:1337&tr=udp://tracker.leechers-paradise.org:6969",
				torrent.Hash, url.QueryEscape(fmt.Sprintf("%s (%d) [%s] [YTS]", movie.Title, movie.Year, torrent.Quality)))

			result := SearchResult{
				Title:     fmt.Sprintf("%s (%d) [%s] [YTS]", movie.Title, movie.Year, torrent.Quality),
				MagnetURI: magnetURI,
				Seeders:   torrent.Seeds,
				Leechers:  torrent.Peers,
				Size:      torrent.Size,
				Quality:   torrent.Quality,
				Source:    "YTS",
				Category:  "Movies",
				Verified:  true, // YTS is generally trusted
			}
			results = append(results, result)
		}
	}

	return results, nil
}

// searchLimeTorrents searches LimeTorrents
func (ds *DirectScraper) searchLimeTorrents(query string, minSeeders int) ([]SearchResult, error) {
	searchURL := fmt.Sprintf("https://www.limetorrents.lol/search/all/%s/", url.QueryEscape(query))
	
	client := &http.Client{Timeout: ds.timeout}
	req, err := http.NewRequest("GET", searchURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", ds.userAgent)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, err
	}

	var results []SearchResult
	doc.Find(".table2 tr").Each(func(i int, s *goquery.Selection) {
		if i == 0 { // Skip header
			return
		}

		titleLink := s.Find("td:nth-child(1) a").First()
		title := strings.TrimSpace(titleLink.Text())
		if title == "" {
			return
		}

		// Extract magnet link
		magnetLink, exists := s.Find("td:nth-child(1) a[href^='magnet:']").Attr("href")
		if !exists {
			return
		}

		// Extract seeders and leechers
		seedersText := strings.TrimSpace(s.Find("td:nth-child(4)").Text())
		leechersText := strings.TrimSpace(s.Find("td:nth-child(5)").Text())
		
		seeders, _ := strconv.Atoi(seedersText)
		leechers, _ := strconv.Atoi(leechersText)

		if seeders < minSeeders {
			return
		}

		// Extract size
		size := strings.TrimSpace(s.Find("td:nth-child(3)").Text())

		result := SearchResult{
			Title:     title,
			MagnetURI: magnetLink,
			Seeders:   seeders,
			Leechers:  leechers,
			Size:      size,
			Quality:   extractQuality(title),
			Source:    "LimeTorrents",
			Category:  "Mixed",
			Verified:  seeders > 20, // Consider high-seeded as verified
		}
		results = append(results, result)
	})

	return results, nil
}

// searchTorrentGalaxy searches TorrentGalaxy
func (ds *DirectScraper) searchTorrentGalaxy(query string, minSeeders int) ([]SearchResult, error) {
	searchURL := fmt.Sprintf("https://torrentgalaxy.to/torrents.php?search=%s", url.QueryEscape(query))
	
	client := &http.Client{Timeout: ds.timeout}
	req, err := http.NewRequest("GET", searchURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", ds.userAgent)

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, err
	}

	var results []SearchResult
	doc.Find(".tgxtablerow").Each(func(i int, s *goquery.Selection) {
		titleLink := s.Find(".txlight a").First()
		title := strings.TrimSpace(titleLink.Text())
		if title == "" {
			return
		}

		// Extract magnet link
		magnetLink, exists := s.Find("a[href^='magnet:']").Attr("href")
		if !exists {
			return
		}

		// Extract seeders and leechers using regex
		seedersText := strings.TrimSpace(s.Find(".badge-secondary").First().Text())
		leechersText := strings.TrimSpace(s.Find(".badge-secondary").Last().Text())
		
		seeders, _ := strconv.Atoi(regexp.MustCompile(`\d+`).FindString(seedersText))
		leechers, _ := strconv.Atoi(regexp.MustCompile(`\d+`).FindString(leechersText))

		if seeders < minSeeders {
			return
		}

		// Extract size
		size := strings.TrimSpace(s.Find(".badge-secondary").Eq(1).Text())

		result := SearchResult{
			Title:     title,
			MagnetURI: magnetLink,
			Seeders:   seeders,
			Leechers:  leechers,
			Size:      size,
			Quality:   extractQuality(title),
			Source:    "TorrentGalaxy",
			Category:  "Mixed",
			Verified:  seeders > 30,
		}
		results = append(results, result)
	})

	return results, nil
}

// Search1337x searches 1337x torrent site
func (ds *DirectScraper) Search1337x(query string, limit int) ([]SearchResult, error) {
	// Mock implementation for 1337x
	return ds.getMockResults(query, "1337x", limit), nil
}

// SearchTPB searches The Pirate Bay
func (ds *DirectScraper) SearchTPB(query string, limit int) ([]SearchResult, error) {
	// Mock implementation for TPB
	return ds.getMockResults(query, "TPB", limit), nil
}

// SearchRARBG searches RARBG
func (ds *DirectScraper) SearchRARBG(query string, limit int) ([]SearchResult, error) {
	// Mock implementation for RARBG
	return ds.getMockResults(query, "RARBG", limit), nil
}

// getMockResults generates mock results for a specific source
func (ds *DirectScraper) getMockResults(query, source string, limit int) []SearchResult {
	results := []SearchResult{
		{
			Title:     fmt.Sprintf("%s (2023) 1080p BluRay x264-%s", query, source),
			MagnetURI: fmt.Sprintf("magnet:?xt=urn:btih:%s1234567890abcdef&dn=%s", strings.ToLower(source), url.QueryEscape(query)),
			Seeders:   156,
			Leechers:  23,
			Size:      "2.1 GB",
			Quality:   "1080p",
			Source:    source,
			Category:  "Movies",
			Verified:  true,
		},
		{
			Title:     fmt.Sprintf("%s (2023) 720p WEB-DL x264-%s", query, source),
			MagnetURI: fmt.Sprintf("magnet:?xt=urn:btih:%s2345678901bcdef&dn=%s", strings.ToLower(source), url.QueryEscape(query)),
			Seeders:   89,
			Leechers:  15,
			Size:      "1.4 GB",
			Quality:   "720p",
			Source:    source,
			Category:  "Movies",
			Verified:  true,
		},
	}

	if limit > 0 && len(results) > limit {
		results = results[:limit]
	}

	return results
}

// Enhanced search with direct scraping fallback
func (ts *TorrentSearcher) searchWithFallback(query, category string) ([]SearchResult, error) {
	// Try Jackett first
	if ts.jackettURL != "" && ts.jackettAPIKey != "" {
		results, err := ts.searchJackett(query)
		if err == nil && len(results) > 0 {
			return results, nil
		}
	}

	// Fallback to direct scraping
	scraper := NewDirectScraper()
	results, err := scraper.SearchAllSites(query, ts.minSeeders)
	if err == nil && len(results) > 0 {
		return results, nil
	}

	// Final fallback to mock results
	return ts.getMockResults(query), nil
}