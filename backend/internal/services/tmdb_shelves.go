package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"
)

// TMDB shelves: ready-made rows (trending, popular, top rated, ...) for the
// Home, Movies and TV Shows pages, and on-demand trailer lookup for hover
// previews. Lists are cached for 3 hours, trailers for a day.

// ShelfItem is one title in a TMDB shelf.
type ShelfItem struct {
	ID           int     `json:"id"`
	MediaType    string  `json:"media_type"` // movie | tv
	Title        string  `json:"title"`
	Overview     string  `json:"overview,omitempty"`
	PosterPath   string  `json:"poster_path,omitempty"`
	BackdropPath string  `json:"backdrop_path,omitempty"`
	Date         string  `json:"date,omitempty"` // release / first air date
	Rating       float64 `json:"rating,omitempty"`
	GenreIDs     []int   `json:"genre_ids,omitempty"`
	// Set by the handler when the title is already in the library.
	LocalID int `json:"local_id,omitempty"`
}

type shelfDef struct {
	Path  string
	Media string // "" = mixed (trending/all)
	Title string
}

// Shelves are the lists the frontend can ask for.
var Shelves = map[string]shelfDef{
	"trending":         {"/trending/all/week", "", "Trending This Week"},
	"trending-movies":  {"/trending/movie/week", "movie", "Trending Movies"},
	"popular-movies":   {"/movie/popular", "movie", "Popular Movies"},
	"top-rated-movies": {"/movie/top_rated", "movie", "Top Rated Movies"},
	"now-playing":      {"/movie/now_playing", "movie", "In Theaters Now"},
	"upcoming":         {"/movie/upcoming", "movie", "Coming to Theaters"},
	"trending-tv":      {"/trending/tv/week", "tv", "Trending Shows"},
	"popular-tv":       {"/tv/popular", "tv", "Popular Shows"},
	"top-rated-tv":     {"/tv/top_rated", "tv", "Top Rated Shows"},
	"airing-today":     {"/tv/airing_today", "tv", "Airing Today"},
	"on-the-air":       {"/tv/on_the_air", "tv", "New Episodes This Week"},
}

type shelfCacheEntry struct {
	at    time.Time
	items []ShelfItem
	key   string
}

var shelfCache sync.Map

func (t *TMDBService) tmdbGet(path string, q url.Values, out interface{}) error {
	if t == nil || t.apiKey == "" {
		return fmt.Errorf("TMDB is not configured")
	}
	if q == nil {
		q = url.Values{}
	}
	req, err := http.NewRequest("GET", t.baseURL+path+"?"+q.Encode(), nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+t.apiKey)
	req.Header.Set("Accept", "application/json")
	resp, err := t.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("TMDB API error: %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

// Shelf returns a named list (see Shelves), without adult or artless titles.
func (t *TMDBService) Shelf(name string, page int) ([]ShelfItem, string, error) {
	def, ok := Shelves[name]
	if !ok {
		return nil, "", fmt.Errorf("unknown shelf %q", name)
	}
	if page < 1 {
		page = 1
	}
	key := name + ":" + strconv.Itoa(page)
	if v, ok := shelfCache.Load(key); ok {
		if e := v.(shelfCacheEntry); time.Since(e.at) < 3*time.Hour {
			return e.items, def.Title, nil
		}
	}
	var resp struct {
		Results []struct {
			ID           int     `json:"id"`
			MediaType    string  `json:"media_type"`
			Title        string  `json:"title"`
			Name         string  `json:"name"`
			Overview     string  `json:"overview"`
			PosterPath   string  `json:"poster_path"`
			BackdropPath string  `json:"backdrop_path"`
			ReleaseDate  string  `json:"release_date"`
			FirstAirDate string  `json:"first_air_date"`
			VoteAverage  float64 `json:"vote_average"`
			GenreIDs     []int   `json:"genre_ids"`
			Adult        bool    `json:"adult"`
		} `json:"results"`
	}
	if err := t.tmdbGet(def.Path, url.Values{"page": {strconv.Itoa(page)}}, &resp); err != nil {
		return nil, def.Title, err
	}
	items := make([]ShelfItem, 0, len(resp.Results))
	for _, r := range resp.Results {
		mt := def.Media
		if mt == "" {
			mt = r.MediaType
		}
		if r.Adult || (mt != "movie" && mt != "tv") || r.BackdropPath == "" {
			continue // people in trending/all, or no artwork to show
		}
		it := ShelfItem{ID: r.ID, MediaType: mt, Title: r.Title, Overview: r.Overview, PosterPath: r.PosterPath,
			BackdropPath: r.BackdropPath, Date: r.ReleaseDate, Rating: r.VoteAverage, GenreIDs: r.GenreIDs}
		if mt == "tv" {
			it.Title, it.Date = r.Name, r.FirstAirDate
		}
		items = append(items, it)
	}
	shelfCache.Store(key, shelfCacheEntry{at: time.Now(), items: items})
	return items, def.Title, nil
}

// Trailer returns the YouTube key of a title's best trailer ("" if none):
// an official trailer, else any trailer, else a teaser.
func (t *TMDBService) Trailer(mediaType string, id int) (string, error) {
	if mediaType != "movie" && mediaType != "tv" {
		return "", fmt.Errorf("bad media type")
	}
	key := fmt.Sprintf("trailer:%s:%d", mediaType, id)
	if v, ok := shelfCache.Load(key); ok {
		if e := v.(shelfCacheEntry); time.Since(e.at) < 24*time.Hour {
			return e.key, nil
		}
	}
	var resp struct {
		Results []struct {
			Key      string `json:"key"`
			Site     string `json:"site"`
			Type     string `json:"type"`
			Official bool   `json:"official"`
		} `json:"results"`
	}
	if err := t.tmdbGet(fmt.Sprintf("/%s/%d/videos", mediaType, id), nil, &resp); err != nil {
		return "", err
	}
	best, bestScore := "", 0
	for _, v := range resp.Results {
		if v.Site != "YouTube" || v.Key == "" {
			continue
		}
		score := 0
		switch v.Type {
		case "Trailer":
			score = 3
		case "Teaser":
			score = 1
		}
		if score > 0 && v.Official {
			score++
		}
		if score > bestScore {
			best, bestScore = v.Key, score
		}
	}
	shelfCache.Store(key, shelfCacheEntry{at: time.Now(), key: best})
	return best, nil
}
