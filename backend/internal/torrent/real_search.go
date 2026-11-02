package torrent

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ErrNoIndexer: Jackett isn't set up (Downloads > Settings).
var ErrNoIndexer = errors.New("no torrent indexer configured")

// SearchReal queries Jackett and never falls back to demo results, so it is
// safe for unattended downloads.
func (ts *TorrentSearcher) SearchReal(query string) ([]SearchResult, error) {
	if ts.jackettURL == "" || ts.jackettAPIKey == "" {
		return nil, ErrNoIndexer
	}
	params := url.Values{}
	params.Set("apikey", ts.jackettAPIKey)
	params.Set("Query", query)
	params.Add("Category[]", "2000")
	params.Add("Category[]", "5000")
	params.Set("Limit", "100")
	u := fmt.Sprintf("%s/api/v2.0/indexers/all/results?%s", strings.TrimSuffix(ts.jackettURL, "/"), params.Encode())
	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Get(u)
	if err != nil {
		return nil, fmt.Errorf("jackett: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("jackett: HTTP %d", resp.StatusCode)
	}
	var jr JackettResponse
	if err := json.NewDecoder(resp.Body).Decode(&jr); err != nil {
		return nil, fmt.Errorf("jackett: %w", err)
	}
	out := make([]SearchResult, 0, len(jr.Results))
	for _, r := range jr.Results {
		if r.Seeders == 0 || r.MagnetUri == "" {
			continue
		}
		out = append(out, SearchResult{
			Title: r.Title, MagnetURI: r.MagnetUri, Seeders: r.Seeders, Leechers: r.Peers - r.Seeders,
			Size: formatSize(r.Size), SizeBytes: r.Size, Quality: extractQuality(r.Title),
			Source: r.Tracker, Category: r.CategoryDesc, Verified: r.Seeders > 10,
		})
	}
	return out, nil
}

// SearchYTSMovies searches the YTS movie API (no indexer needed).
func SearchYTSMovies(query string) ([]SearchResult, error) {
	return NewDirectScraper().searchYTS(query, 1)
}
