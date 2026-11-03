package comingsoon

import (
	"fmt"
	"math"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

// TMDB is the slice of the TMDB client the picker needs.
type TMDB interface {
	Get(path string, q url.Values, out interface{}) error
}

// Candidate is an upcoming title with everything the UI and the downloader need.
type Candidate struct {
	TMDBID       int      `json:"tmdb_id"`
	MediaType    string   `json:"media_type"` // movie | tv
	Title        string   `json:"title"`
	Overview     string   `json:"overview"`
	Tagline      string   `json:"tagline,omitempty"`
	ReleaseDate  string   `json:"release_date"`            // YYYY-MM-DD (US theatrical / season premiere)
	Season       int      `json:"season,omitempty"`        // tv: the season that premieres
	ReleaseLabel string   `json:"release_label,omitempty"` // "Season 2" for returning shows
	PosterPath   string   `json:"poster_path,omitempty"`
	BackdropPath string   `json:"backdrop_path,omitempty"`
	Genres       []string `json:"genres,omitempty"`
	Cast         []string `json:"cast,omitempty"`
	Studio       string   `json:"studio,omitempty"`
	Popularity   float64  `json:"popularity"`
	StarPower    float64  `json:"star_power"`
	Score        float64  `json:"score"`
	YouTubeID    string   `json:"youtube_id"`
	TrailerName  string   `json:"trailer_name,omitempty"`
}

func (c Candidate) Key() string { return fmt.Sprintf("%s-%d", c.MediaType, c.TMDBID) }

// Window: upcoming releases this year and next.
func window(now time.Time) (from, to time.Time) {
	from = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, 1)
	to = time.Date(now.Year()+1, 12, 31, 0, 0, 0, 0, time.UTC)
	return
}

const day = "2006-01-02"

type video struct {
	Key         string `json:"key"`
	Name        string `json:"name"`
	Site        string `json:"site"`
	Type        string `json:"type"`
	Official    bool   `json:"official"`
	Language    string `json:"iso_639_1"`
	PublishedAt string `json:"published_at"`
}

// bestTrailer: official English YouTube trailer, newest first; then any
// trailer; then a teaser.
func bestTrailer(vs []video) (video, bool) {
	best, bestScore := video{}, -1
	for _, v := range vs {
		if v.Site != "YouTube" || v.Key == "" {
			continue
		}
		s := 0
		switch v.Type {
		case "Trailer":
			s = 40
		case "Teaser":
			s = 20
		default:
			continue
		}
		if v.Official {
			s += 10
		}
		if v.Language == "" || v.Language == "en" {
			s += 5
		}
		low := strings.ToLower(v.Name)
		if strings.Contains(low, "official trailer") || strings.Contains(low, "final trailer") {
			s += 4
		}
		if strings.Contains(low, "reaction") || strings.Contains(low, "breakdown") || strings.Contains(low, "behind the scenes") {
			continue
		}
		if t, err := time.Parse(time.RFC3339, v.PublishedAt); err == nil {
			s += int(t.Unix() / (86400 * 30) % 1000 / 100) // newer wins ties
		}
		if s > bestScore {
			best, bestScore = v, s
		}
	}
	return best, bestScore >= 0
}

type castMember struct {
	Name       string  `json:"name"`
	Popularity float64 `json:"popularity"`
	Order      int     `json:"order"`
}

// starPower: how well-known the top-billed cast is (mean popularity of the
// three most popular of the first eight billed).
func starPower(cast []castMember) (float64, []string) {
	if len(cast) > 8 {
		cast = cast[:8]
	}
	cs := append([]castMember{}, cast...)
	sort.Slice(cs, func(i, j int) bool { return cs[i].Popularity > cs[j].Popularity })
	var sum float64
	var names []string
	for i, c := range cs {
		if i < 3 {
			sum += c.Popularity
		}
	}
	for i, c := range cast {
		if i < 4 {
			names = append(names, c.Name)
		}
	}
	n := math.Min(3, float64(len(cs)))
	if n == 0 {
		return 0, nil
	}
	return sum / n, names
}

// score: popularity matters most, a famous cast lifts a title, and a
// release far away counts a little less than one coming soon.
func score(pop, stars float64, release time.Time, now time.Time) float64 {
	days := release.Sub(now).Hours() / 24
	soon := 1.0
	if days > 120 {
		soon = math.Max(0.6, 1-(days-120)/900)
	}
	return (math.Log1p(pop)*1.0 + math.Log1p(stars)*0.8) * soon
}

// Minimum bar: no obscure titles.
const (
	minPopularity = 4.0
	minStarPower  = 3.0
)

type page struct {
	Results []struct {
		ID         int     `json:"id"`
		Popularity float64 `json:"popularity"`
	} `json:"results"`
}

func collectIDs(t TMDB, path string, q url.Values, pages int, seen map[int]float64) error {
	for p := 1; p <= pages; p++ {
		q.Set("page", strconv.Itoa(p))
		var pg page
		if err := t.Get(path, q, &pg); err != nil {
			return err
		}
		for _, r := range pg.Results {
			if r.Popularity > seen[r.ID] {
				seen[r.ID] = r.Popularity
			}
		}
	}
	return nil
}

func topIDs(m map[int]float64, n int) []int {
	ids := make([]int, 0, len(m))
	for id := range m {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return m[ids[i]] > m[ids[j]] })
	if len(ids) > n {
		ids = ids[:n]
	}
	return ids
}

// Skip reports titles to leave out (e.g. already in the library).
type Skip func(c Candidate) bool

// PickMovies: upcoming US-produced films with a trailer, best first. Films
// that have already opened in theaters anywhere are left out.
func PickMovies(t TMDB, now time.Time, want int, skip Skip) ([]Candidate, error) {
	from, to := window(now)
	ids := map[int]float64{}
	err := collectIDs(t, "/discover/movie", url.Values{
		"primary_release_date.gte": {from.Format(day)}, "primary_release_date.lte": {to.Format(day)},
		"sort_by": {"popularity.desc"}, "with_original_language": {"en"}, "include_adult": {"false"}, "region": {"US"},
	}, 3, ids)
	_ = collectIDs(t, "/movie/upcoming", url.Values{"region": {"US"}}, 2, ids)
	if len(ids) == 0 {
		if err != nil {
			return nil, fmt.Errorf("TMDB: %v", err)
		}
		return nil, fmt.Errorf("TMDB returned no upcoming movies")
	}
	var out []Candidate
	for _, id := range topIDs(ids, 45) {
		var d struct {
			ID               int     `json:"id"`
			Title            string  `json:"title"`
			OriginalLanguage string  `json:"original_language"`
			Overview         string  `json:"overview"`
			Tagline          string  `json:"tagline"`
			ReleaseDate      string  `json:"release_date"`
			Status           string  `json:"status"`
			Popularity       float64 `json:"popularity"`
			PosterPath       string  `json:"poster_path"`
			BackdropPath     string  `json:"backdrop_path"`
			Adult            bool    `json:"adult"`
			Genres           []struct {
				ID   int
				Name string
			} `json:"genres"`
			ProductionCountries []struct {
				ISO string `json:"iso_3166_1"`
			} `json:"production_countries"`
			ProductionCompanies []struct{ Name string }     `json:"production_companies"`
			Credits             struct{ Cast []castMember } `json:"credits"`
			Videos              struct{ Results []video }   `json:"videos"`
			ReleaseDates        struct {
				Results []struct {
					ISO   string `json:"iso_3166_1"`
					Dates []struct {
						Date string `json:"release_date"`
						Type int    `json:"type"`
					} `json:"release_dates"`
				} `json:"results"`
			} `json:"release_dates"`
		}
		if t.Get(fmt.Sprintf("/movie/%d", id), url.Values{"append_to_response": {"credits,videos,release_dates"}}, &d) != nil {
			continue
		}
		if d.Adult || d.OriginalLanguage != "en" || d.Status == "Released" || d.PosterPath == "" || d.BackdropPath == "" {
			continue
		}
		us := false
		for _, c := range d.ProductionCountries {
			us = us || c.ISO == "US"
		}
		if !us {
			continue // "Hollywood": produced in the US
		}
		doc := false
		for _, g := range d.Genres {
			doc = doc || g.ID == 99
		}
		if doc {
			continue
		}
		today := now.Format(day)
		if d.ReleaseDate != "" && d.ReleaseDate <= today {
			continue // already out
		}
		inTheaters := false
		for _, r := range d.ReleaseDates.Results {
			for _, x := range r.Dates {
				if (x.Type == 2 || x.Type == 3) && len(x.Date) >= 10 && x.Date[:10] <= today {
					inTheaters = true // limited or wide theatrical release anywhere
				}
			}
		}
		if inTheaters {
			continue
		}
		// US theatrical (type 3) or digital (4) date, else the primary date.
		release := d.ReleaseDate
		for _, r := range d.ReleaseDates.Results {
			if r.ISO != "US" {
				continue
			}
			for _, x := range r.Dates {
				if (x.Type == 3 || x.Type == 2 || x.Type == 4) && len(x.Date) >= 10 {
					if release == "" || x.Date[:10] < release || x.Type == 3 {
						release = x.Date[:10]
					}
				}
			}
		}
		rt, err := time.Parse(day, release)
		if err != nil || rt.Before(from) || rt.After(to) {
			continue
		}
		tr, ok := bestTrailer(d.Videos.Results)
		if !ok {
			continue
		}
		stars, cast := starPower(d.Credits.Cast)
		if d.Popularity < minPopularity || stars < minStarPower {
			continue
		}
		c := Candidate{TMDBID: d.ID, MediaType: "movie", Title: d.Title, Overview: d.Overview, Tagline: d.Tagline,
			ReleaseDate: release, PosterPath: d.PosterPath, BackdropPath: d.BackdropPath, Cast: cast,
			Popularity: d.Popularity, StarPower: stars, YouTubeID: tr.Key, TrailerName: tr.Name}
		for _, g := range d.Genres {
			c.Genres = append(c.Genres, g.Name)
		}
		if len(d.ProductionCompanies) > 0 {
			c.Studio = d.ProductionCompanies[0].Name
		}
		c.Score = score(c.Popularity, c.StarPower, rt, now)
		if skip != nil && skip(c) {
			continue
		}
		out = append(out, c)
	}
	return pickTop(out, want), nil
}

// PickSeries: new US/UK series and new seasons of popular shows premiering
// in the window, with a trailer.
func PickSeries(t TMDB, now time.Time, want int, skip Skip) ([]Candidate, error) {
	from, to := window(now)
	ids := map[int]float64{}
	err := collectIDs(t, "/discover/tv", url.Values{
		"first_air_date.gte": {from.Format(day)}, "first_air_date.lte": {to.Format(day)},
		"sort_by": {"popularity.desc"}, "with_original_language": {"en"}, "include_adult": {"false"},
	}, 2, ids)
	// Returning shows: popular ones whose next episode starts a new season.
	_ = collectIDs(t, "/tv/popular", url.Values{"language": {"en-US"}}, 3, ids)
	_ = collectIDs(t, "/tv/on_the_air", url.Values{"language": {"en-US"}}, 1, ids)
	if len(ids) == 0 {
		if err != nil {
			return nil, fmt.Errorf("TMDB: %v", err)
		}
		return nil, fmt.Errorf("TMDB returned no shows")
	}
	var out []Candidate
	for _, id := range topIDs(ids, 70) {
		var d struct {
			ID               int      `json:"id"`
			Name             string   `json:"name"`
			OriginalLanguage string   `json:"original_language"`
			OriginCountry    []string `json:"origin_country"`
			Overview         string   `json:"overview"`
			Tagline          string   `json:"tagline"`
			FirstAirDate     string   `json:"first_air_date"`
			Popularity       float64  `json:"popularity"`
			PosterPath       string   `json:"poster_path"`
			BackdropPath     string   `json:"backdrop_path"`
			Adult            bool     `json:"adult"`
			Genres           []struct {
				ID   int
				Name string
			} `json:"genres"`
			Networks    []struct{ Name string } `json:"networks"`
			NextEpisode *struct {
				AirDate       string `json:"air_date"`
				SeasonNumber  int    `json:"season_number"`
				EpisodeNumber int    `json:"episode_number"`
			} `json:"next_episode_to_air"`
			Credits struct {
				Cast []castMember `json:"cast"`
			} `json:"aggregate_credits"`
			Videos struct{ Results []video } `json:"videos"`
		}
		if t.Get(fmt.Sprintf("/tv/%d", id), url.Values{"append_to_response": {"aggregate_credits,videos"}}, &d) != nil {
			continue
		}
		if d.Adult || d.OriginalLanguage != "en" || d.PosterPath == "" || d.BackdropPath == "" {
			continue
		}
		west := false
		for _, c := range d.OriginCountry {
			west = west || c == "US" || c == "GB"
		}
		if !west {
			continue
		}
		badGenre := false
		for _, g := range d.Genres {
			// talk shows, news, reality, soaps, kids: not "coming soon" material
			badGenre = badGenre || g.ID == 10767 || g.ID == 10763 || g.ID == 10764 || g.ID == 10766 || g.ID == 10762
		}
		if badGenre {
			continue
		}
		c := Candidate{TMDBID: d.ID, MediaType: "tv", Title: d.Name, Overview: d.Overview, Tagline: d.Tagline,
			PosterPath: d.PosterPath, BackdropPath: d.BackdropPath, Popularity: d.Popularity}
		switch {
		case d.FirstAirDate != "" && d.FirstAirDate >= from.Format(day):
			c.ReleaseDate, c.Season, c.ReleaseLabel = d.FirstAirDate, 1, "New Series"
		case d.NextEpisode != nil && d.NextEpisode.EpisodeNumber == 1 && d.NextEpisode.SeasonNumber > 1 && d.NextEpisode.AirDate != "":
			c.ReleaseDate, c.Season = d.NextEpisode.AirDate, d.NextEpisode.SeasonNumber
			c.ReleaseLabel = fmt.Sprintf("Season %d", c.Season)
		default:
			continue // already airing, nothing new to announce
		}
		rt, err := time.Parse(day, c.ReleaseDate)
		if err != nil || rt.Before(from) || rt.After(to) {
			continue
		}
		// Season trailer first, then the show's.
		var sv struct{ Results []video }
		if c.Season > 1 {
			_ = t.Get(fmt.Sprintf("/tv/%d/season/%d/videos", d.ID, c.Season), nil, &sv)
		}
		tr, ok := bestTrailer(sv.Results)
		if !ok {
			tr, ok = bestTrailer(d.Videos.Results)
		}
		if !ok {
			continue
		}
		c.YouTubeID, c.TrailerName = tr.Key, tr.Name
		c.StarPower, c.Cast = starPower(d.Credits.Cast)
		if c.Popularity < minPopularity || c.StarPower < minStarPower {
			continue
		}
		for _, g := range d.Genres {
			c.Genres = append(c.Genres, g.Name)
		}
		if len(d.Networks) > 0 {
			c.Studio = d.Networks[0].Name
		}
		c.Score = score(c.Popularity, c.StarPower, rt, now)
		if skip != nil && skip(c) {
			continue
		}
		out = append(out, c)
	}
	return pickTop(out, want), nil
}

// pickTop: highest score first; one entry per title and per trailer.
func pickTop(cs []Candidate, want int) []Candidate {
	sort.SliceStable(cs, func(i, j int) bool { return cs[i].Score > cs[j].Score })
	seenTitle, seenVideo := map[string]bool{}, map[string]bool{}
	var out []Candidate
	for _, c := range cs {
		k := strings.ToLower(strings.TrimSpace(c.Title))
		if seenTitle[k] || seenVideo[c.YouTubeID] {
			continue
		}
		seenTitle[k], seenVideo[c.YouTubeID] = true, true
		out = append(out, c)
		if len(out) == want {
			break
		}
	}
	return out
}
