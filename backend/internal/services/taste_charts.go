package services

import (
	"fmt"
	"math"
	"sort"
	"time"

	"homeflix-backend/internal/models"
)

// ChartItem is one entry of a Top 10 chart.
type ChartItem struct {
	TasteItem
	Rank int `json:"rank"`
	// Plays: distinct titles/episodes watched in the window (0 for catalog fill).
	Plays int `json:"plays"`
}

// ChartResult is a Top 10 chart ("Top 10 Movies on HomeFlix Today").
type ChartResult struct {
	Kind       string      `json:"kind"`        // movie | series | all
	WindowDays int         `json:"window_days"` // how far back plays were counted
	Source     string      `json:"source"`      // plays | mixed | catalog
	Items      []ChartItem `json:"items"`
}

// Chart ranks what the household is actually watching: every title (shows
// roll up from their episodes) scores by how far each viewer got, how recently,
// and how many episodes they binged. The window starts at 7 days and widens
// (30 days, then all time) until it can fill the chart; any remaining places
// go to the best-rated, most popular and newest titles, so the chart is never
// half empty on a quiet server.
func (s *TasteService) Chart(kind string, limit int, now time.Time) (*ChartResult, error) {
	if kind != "movie" && kind != "series" {
		kind = "all"
	}
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	idx, err := s.index()
	if err != nil {
		return nil, err
	}
	match := func(u *tasteUnit) bool { return kind == "all" || u.kind == kind }

	type entry = chartEntry
	// Tiers: this week's plays rank first, then this month's, then all time.
	var ranked []entry
	seenTier := map[string]bool{}
	window := 7
	for _, days := range []int{7, 30, 0} {
		if len(ranked) >= limit {
			break
		}
		entries, err := s.chartFromPlays(idx, match, days, now)
		if err != nil {
			return nil, err
		}
		sort.Slice(entries, func(i, j int) bool {
			if entries[i].score != entries[j].score {
				return entries[i].score > entries[j].score
			}
			return entries[i].last.After(entries[j].last)
		})
		for _, e := range entries {
			if len(ranked) >= limit || seenTier[e.u.key] {
				continue
			}
			seenTier[e.u.key] = true
			ranked = append(ranked, e)
			window = days
		}
	}

	res := &ChartResult{Kind: kind, WindowDays: window, Source: "plays"}
	seen := map[string]bool{}
	for _, e := range ranked {
		seen[e.u.key] = true
		res.Items = append(res.Items, ChartItem{TasteItem: e.u.item, Plays: e.plays})
	}

	if len(res.Items) < limit {
		// Catalog fill: rating, popularity and freshness.
		maxPop := 1.0
		for _, u := range idx.units {
			if u.popularity > maxPop {
				maxPop = u.popularity
			}
		}
		var fill []entry
		for _, u := range idx.units {
			if !match(u) || seen[u.key] {
				continue
			}
			sc := 0.5*u.rating/10 + 0.3*math.Log1p(u.popularity)/math.Log1p(maxPop)
			if now.Sub(u.createdAt) < 30*24*time.Hour {
				sc += 0.2
			}
			fill = append(fill, entry{u: u, score: sc, last: u.createdAt})
		}
		sort.Slice(fill, func(i, j int) bool {
			if fill[i].score != fill[j].score {
				return fill[i].score > fill[j].score
			}
			return fill[i].last.After(fill[j].last)
		})
		for _, e := range fill {
			if len(res.Items) >= limit {
				break
			}
			res.Items = append(res.Items, ChartItem{TasteItem: e.u.item})
		}
		if len(ranked) == 0 {
			res.Source = "catalog"
		} else {
			res.Source = "mixed"
		}
	}
	for i := range res.Items {
		res.Items[i].Rank = i + 1
	}
	return res, nil
}

type chartEntry struct {
	u     *tasteUnit
	score float64
	plays int
	last  time.Time
}

// chartFromPlays scores titles from playback in the last [days] (0 = all time).
func (s *TasteService) chartFromPlays(idx *tasteIndex, match func(*tasteUnit) bool, days int, now time.Time) ([]chartEntry, error) {
	var progress []models.PlaybackProgress
	q := s.db.Model(&models.PlaybackProgress{})
	if days > 0 {
		q = q.Where("last_watched >= ?", now.Add(-time.Duration(days)*24*time.Hour))
	}
	if err := q.Find(&progress).Error; err != nil {
		return nil, err
	}
	if len(progress) == 0 {
		return nil, nil
	}
	ids := make([]uint, 0, len(progress))
	for _, p := range progress {
		ids = append(ids, p.MediaID)
	}
	var refs []struct {
		ID       uint
		SeriesID *uint
	}
	if err := s.db.Model(&models.Media{}).Select("id", "series_id").Where("id IN ?", ids).Scan(&refs).Error; err != nil {
		return nil, err
	}
	unitFor := map[uint]*tasteUnit{}
	for _, r := range refs {
		if r.SeriesID != nil {
			unitFor[r.ID] = idx.byKey[fmt.Sprintf("s:%d", *r.SeriesID)]
		} else {
			unitFor[r.ID] = idx.byKey[fmt.Sprintf("m:%d", r.ID)]
		}
	}

	// Half-life: a few days for "today/this week", longer for wider windows.
	halfLife := 3.5
	if days == 0 || days > 7 {
		halfLife = 14
	}
	type viewer struct {
		best  float64
		plays int
		last  time.Time
	}
	perViewer := map[string]*viewer{} // user|unit
	units := map[string]*tasteUnit{}
	for _, p := range progress {
		u := unitFor[p.MediaID]
		if u == nil || !match(u) {
			continue
		}
		e := 0.25 // pressed play
		switch {
		case p.Completed || p.Progress >= 85:
			e = 1.0
		case p.Progress >= 40:
			e = 0.8
		case p.Progress >= 10:
			e = 0.55
		}
		k := p.UserID + "|" + u.key
		v := perViewer[k]
		if v == nil {
			v = &viewer{}
			perViewer[k] = v
			units[k] = u
		}
		if e > v.best {
			v.best = e
		}
		v.plays++
		if p.LastWatched.After(v.last) {
			v.last = p.LastWatched
		}
	}
	agg := map[string]*chartEntry{}
	for k, v := range perViewer {
		u := units[k]
		age := now.Sub(v.last).Hours() / 24
		if age < 0 {
			age = 0
		}
		// Bingeing several episodes counts more, but one viewer can't own the chart.
		sc := math.Min(1.8, v.best+0.15*float64(v.plays-1)) * math.Pow(0.5, age/halfLife)
		e := agg[u.key]
		if e == nil {
			e = &chartEntry{u: u}
			agg[u.key] = e
		}
		e.score += sc
		e.plays += v.plays
		if v.last.After(e.last) {
			e.last = v.last
		}
	}
	out := make([]chartEntry, 0, len(agg))
	for _, e := range agg {
		out = append(out, *e)
	}
	return out, nil
}
