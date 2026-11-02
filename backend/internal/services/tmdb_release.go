package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Release information used by Auto Download to schedule future titles.

// ReleaseInfo: when a title can realistically be downloaded.
type ReleaseInfo struct {
	// Zero = unknown (no dates announced yet).
	AvailableAt time.Time
	// Human label, e.g. "Digital release" or "Season finale".
	Label string
}

func (t *TMDBService) getJSON(path string, v interface{}) error {
	if t.apiKey == "" {
		return fmt.Errorf("TMDB API key not configured")
	}
	req, err := http.NewRequest(http.MethodGet, t.baseURL+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+t.apiKey)
	resp, err := t.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return errNotFound
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("TMDB API error: %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(v)
}

var errNotFound = fmt.Errorf("not found on TMDB")

func parseTMDBDate(s string) (time.Time, bool) {
	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04:05.000Z", "2006-01-02"} {
		if d, err := time.Parse(layout, s); err == nil {
			return d.UTC(), true
		}
	}
	return time.Time{}, false
}

// MovieAvailability: the earliest digital / physical / TV release anywhere
// (when good WEB releases appear), else theatrical + 45 days.
func (t *TMDBService) MovieAvailability(tmdbID int) (ReleaseInfo, error) {
	var r struct {
		Results []struct {
			ReleaseDates []struct {
				Type        int    `json:"type"`
				ReleaseDate string `json:"release_date"`
			} `json:"release_dates"`
		} `json:"results"`
	}
	if err := t.getJSON(fmt.Sprintf("/movie/%d/release_dates", tmdbID), &r); err != nil {
		return ReleaseInfo{}, err
	}
	var home, theatrical time.Time
	homeType := 0
	for _, c := range r.Results {
		for _, d := range c.ReleaseDates {
			at, ok := parseTMDBDate(d.ReleaseDate)
			if !ok {
				continue
			}
			switch d.Type {
			case 4, 5, 6: // digital, physical, TV
				if home.IsZero() || at.Before(home) {
					home, homeType = at, d.Type
				}
			case 2, 3: // theatrical (limited)
				if theatrical.IsZero() || at.Before(theatrical) {
					theatrical = at
				}
			}
		}
	}
	switch {
	case !home.IsZero():
		label := map[int]string{4: "Digital release", 5: "Blu-ray release", 6: "TV premiere"}[homeType]
		return ReleaseInfo{AvailableAt: home, Label: label}, nil
	case !theatrical.IsZero():
		return ReleaseInfo{AvailableAt: theatrical.AddDate(0, 0, 45), Label: "Expected after cinema run"}, nil
	}
	return ReleaseInfo{}, nil
}

// SeasonAvailability: the day after the season's last episode airs (a full
// season pack exists then).
func (t *TMDBService) SeasonAvailability(tmdbID, season int) (ReleaseInfo, error) {
	var r struct {
		AirDate  string `json:"air_date"`
		Episodes []struct {
			AirDate string `json:"air_date"`
		} `json:"episodes"`
	}
	if err := t.getJSON(fmt.Sprintf("/tv/%d/season/%d", tmdbID, season), &r); err != nil {
		if err == errNotFound {
			return ReleaseInfo{Label: "Not announced yet"}, nil
		}
		return ReleaseInfo{}, err
	}
	var last time.Time
	for _, e := range r.Episodes {
		at, ok := parseTMDBDate(e.AirDate)
		if !ok {
			// An episode without a date: the finale isn't scheduled yet.
			return ReleaseInfo{Label: "Finale date not announced"}, nil
		}
		if at.After(last) {
			last = at
		}
	}
	if last.IsZero() {
		if at, ok := parseTMDBDate(r.AirDate); ok {
			return ReleaseInfo{AvailableAt: at.AddDate(0, 0, 1), Label: "Season premiere"}, nil
		}
		return ReleaseInfo{Label: "Not announced yet"}, nil
	}
	return ReleaseInfo{AvailableAt: last.AddDate(0, 0, 1), Label: "After the season finale"}, nil
}

// ShowSeasons lists the season numbers TMDB knows (specials excluded).
func (t *TMDBService) ShowSeasons(tmdbID int) ([]int, error) {
	var r struct {
		Seasons []struct {
			SeasonNumber int `json:"season_number"`
		} `json:"seasons"`
	}
	if err := t.getJSON(fmt.Sprintf("/tv/%d", tmdbID), &r); err != nil {
		return nil, err
	}
	var out []int
	for _, s := range r.Seasons {
		if s.SeasonNumber > 0 {
			out = append(out, s.SeasonNumber)
		}
	}
	return out, nil
}

// AutoDownloadReleases adapts TMDBService to autodl.Releases.
type AutoDownloadReleases struct{ TMDB *TMDBService }

func (a AutoDownloadReleases) Movie(id int) (time.Time, string, error) {
	r, err := a.TMDB.MovieAvailability(id)
	return r.AvailableAt, r.Label, err
}

func (a AutoDownloadReleases) Season(id, n int) (time.Time, string, error) {
	r, err := a.TMDB.SeasonAvailability(id, n)
	return r.AvailableAt, r.Label, err
}

func (a AutoDownloadReleases) Seasons(id int) ([]int, error) { return a.TMDB.ShowSeasons(id) }
