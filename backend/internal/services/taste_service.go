package services

// TasteService: personalised recommendations learned from watch history.
//
// Every library title (movie, or TV series as a whole) becomes a sparse
// feature vector: directors, top-billed cast (weighted by billing order),
// writers, franchise/collection, genres, decade, language, country and TV
// network. Features are IDF-weighted, so a shared director or franchise
// counts for far more than a shared "Drama".
//
// A user's taste profile is the sum of the vectors of what they watched,
// weighted by engagement (finished > half-watched > sampled; abandoned early
// counts slightly negative), recency (half-life decay) and bingeing (more
// episodes of a series = stronger signal). Candidates are scored by cosine
// similarity to the profile plus small quality/freshness priors, re-ranked
// for diversity (MMR), and every pick carries a human-readable reason.
//
// With no history the service falls back to quality/recency rows, so the
// home screen is never empty.

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"

	"homeflix-backend/internal/models"
)

const (
	tasteIndexTTL        = 10 * time.Minute
	tasteRecencyHalfLife = 45.0 // days
	tasteMaxSignals      = 600
)

// Feature base weights (before IDF).
const (
	fwDirector   = 3.0
	fwCast       = 2.2
	fwWriter     = 1.2
	fwCollection = 4.0
	fwGenre      = 1.0
	fwDecade     = 0.6
	fwLanguage   = 0.7
	fwCountry    = 0.3
	fwNetwork    = 0.8
)

// TasteItem is a compact, UI-ready recommendation.
type TasteItem struct {
	ID              uint     `json:"id"`
	Type            string   `json:"type"` // "movie" | "series"
	Title           string   `json:"title"`
	Year            int      `json:"year,omitempty"`
	Rating          float64  `json:"rating,omitempty"`
	GenreNames      []string `json:"genre_names,omitempty"`
	Description     string   `json:"description,omitempty"`
	PosterPath      string   `json:"poster_path,omitempty"`
	BackdropPath    string   `json:"backdrop_path,omitempty"`
	TMDBPosterURL   string   `json:"tmdb_poster_url,omitempty"`
	TMDBBackdropURL string   `json:"tmdb_backdrop_url,omitempty"`
	TMDBTrailerURL  string   `json:"tmdb_trailer_url,omitempty"`
	LogoPath        string   `json:"logo_path,omitempty"`
	TMDBID          int      `json:"tmdb_id,omitempty"`
	FilePath        string   `json:"file_path,omitempty"`
	IsLocal         bool     `json:"is_local"`
	Score           float64  `json:"score"`
	Reason          string   `json:"reason,omitempty"`
}

// TasteRow is one shelf of recommendations.
type TasteRow struct {
	ID       string      `json:"id"`
	Title    string      `json:"title"`
	Subtitle string      `json:"subtitle,omitempty"`
	Kind     string      `json:"kind"` // top-picks, because, actor, director, collection, genre, fallback
	Items    []TasteItem `json:"items"`
}

// TasteResult is the response for a user's home screen.
type TasteResult struct {
	Personalized bool       `json:"personalized"`
	Signals      int        `json:"signals"`
	TopFeatures  []string   `json:"top_features,omitempty"`
	Rows         []TasteRow `json:"rows"`
}

type tasteUnit struct {
	key        string // "m:<id>" or "s:<id>"
	kind       string
	id         uint
	title      string
	year       int
	rating     float64
	popularity float64
	createdAt  time.Time
	collection string
	item       TasteItem
	raw        map[string]float64 // feature -> base weight
	vec        map[string]float64 // feature -> base*idf
	norm       float64
	labels     map[string]string // feature -> display label
}

type tasteIndex struct {
	units []*tasteUnit
	byKey map[string]*tasteUnit
	built time.Time
}

type tasteSignal struct {
	unit        *tasteUnit
	weight      float64
	engagement  float64
	lastWatched time.Time
}

// TasteService builds and caches the feature index and scores users.
type TasteService struct {
	db  *gorm.DB
	mu  sync.Mutex
	idx *tasteIndex
}

func NewTasteService(db *gorm.DB) *TasteService {
	return &TasteService{db: db}
}

// Invalidate forces the feature index to rebuild on next use (call after
// scans/metadata updates).
func (s *TasteService) Invalidate() {
	s.mu.Lock()
	s.idx = nil
	s.mu.Unlock()
}

func normToken(v string) string {
	return strings.ToLower(strings.Join(strings.Fields(strings.TrimSpace(v)), " "))
}

func addFeature(raw map[string]float64, labels map[string]string, prefix, value string, w float64) {
	n := normToken(value)
	if n == "" || n == "unknown" || n == "n/a" {
		return
	}
	k := prefix + n
	if w > raw[k] {
		raw[k] = w
	}
	if _, ok := labels[k]; !ok {
		labels[k] = strings.TrimSpace(value)
	}
}

// billing returns stars first then cast, de-duplicated, capped.
func billing(stars, cast []string, max int) []string {
	seen := map[string]bool{}
	out := make([]string, 0, max)
	for _, list := range [][]string{stars, cast} {
		for _, n := range list {
			k := normToken(n)
			if k == "" || seen[k] {
				continue
			}
			seen[k] = true
			out = append(out, strings.TrimSpace(n))
			if len(out) >= max {
				return out
			}
		}
	}
	return out
}

func mediaFeatures(raw map[string]float64, labels map[string]string, m *models.Media, castWeightScale float64) {
	for _, d := range m.Director {
		addFeature(raw, labels, "dir:", d, fwDirector)
	}
	for i, c := range billing(m.Stars, m.Cast, 6) {
		addFeature(raw, labels, "cast:", c, fwCast*castWeightScale*(1-0.1*float64(i)))
	}
	for i, w := range m.Writers {
		if i >= 3 {
			break
		}
		addFeature(raw, labels, "wri:", w, fwWriter)
	}
	addFeature(raw, labels, "col:", m.Collection, fwCollection)
	genres := m.GenreNames
	if len(genres) == 0 {
		for _, g := range m.Genres {
			genres = append(genres, g.Name)
		}
	}
	for _, g := range genres {
		addFeature(raw, labels, "gen:", g, fwGenre)
	}
	if m.Year > 1900 {
		addFeature(raw, labels, "dec:", fmt.Sprintf("%ds", m.Year/10*10), fwDecade)
	}
	addFeature(raw, labels, "lang:", m.Language, fwLanguage)
	addFeature(raw, labels, "ctry:", m.Country, fwCountry)
}

func (s *TasteService) index() (*tasteIndex, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.idx != nil && time.Since(s.idx.built) < tasteIndexTTL {
		return s.idx, nil
	}
	idx, err := s.buildIndex()
	if err != nil {
		return nil, err
	}
	s.idx = idx
	return idx, nil
}

func (s *TasteService) buildIndex() (*tasteIndex, error) {
	var movies []models.Media
	if err := s.db.Preload("Genres").Where("type = ?", "movie").Find(&movies).Error; err != nil {
		return nil, err
	}
	var series []models.Series
	if err := s.db.Find(&series).Error; err != nil {
		return nil, err
	}
	// Episodes contribute cast/crew to their series (Series rows have no crew).
	var episodes []models.Media
	if err := s.db.Select("id", "series_id", "stars", "cast", "director", "writers", "genre_names", "language", "country", "year").
		Where("series_id IS NOT NULL").Find(&episodes).Error; err != nil {
		return nil, err
	}

	idx := &tasteIndex{byKey: map[string]*tasteUnit{}, built: time.Now()}

	for i := range movies {
		m := &movies[i]
		u := &tasteUnit{
			key: fmt.Sprintf("m:%d", m.ID), kind: "movie", id: m.ID, title: m.Title, year: m.Year,
			rating: m.Rating, popularity: m.Popularity, createdAt: m.CreatedAt, collection: strings.TrimSpace(m.Collection),
			raw: map[string]float64{}, labels: map[string]string{},
		}
		mediaFeatures(u.raw, u.labels, m, 1)
		genres := m.GenreNames
		if len(genres) == 0 {
			for _, g := range m.Genres {
				genres = append(genres, g.Name)
			}
		}
		u.item = TasteItem{
			ID: m.ID, Type: "movie", Title: m.Title, Year: m.Year, Rating: m.Rating, GenreNames: genres,
			Description: firstNonEmpty(m.Description, m.ShortDesc, m.LongDesc), PosterPath: m.PosterPath,
			BackdropPath: m.BackdropPath, TMDBBackdropURL: m.TMDBBackdropURL, TMDBTrailerURL: m.TMDBTrailerURL,
			LogoPath: m.LogoPath, TMDBID: m.TMDBID, FilePath: m.FilePath, IsLocal: true,
		}
		idx.units = append(idx.units, u)
		idx.byKey[u.key] = u
	}

	seriesUnits := map[uint]*tasteUnit{}
	for i := range series {
		sr := &series[i]
		u := &tasteUnit{
			key: fmt.Sprintf("s:%d", sr.ID), kind: "series", id: sr.ID, title: sr.Title, year: sr.Year,
			rating: float64(sr.Rating), createdAt: sr.CreatedAt, raw: map[string]float64{}, labels: map[string]string{},
		}
		for _, g := range sr.GenreNames {
			addFeature(u.raw, u.labels, "gen:", g, fwGenre)
		}
		if sr.Year > 1900 {
			addFeature(u.raw, u.labels, "dec:", fmt.Sprintf("%ds", sr.Year/10*10), fwDecade)
		}
		addFeature(u.raw, u.labels, "lang:", sr.Language, fwLanguage)
		addFeature(u.raw, u.labels, "ctry:", sr.Country, fwCountry)
		addFeature(u.raw, u.labels, "net:", sr.Network, fwNetwork)
		u.item = TasteItem{
			ID: sr.ID, Type: "series", Title: sr.Title, Year: sr.Year, Rating: float64(sr.Rating), GenreNames: sr.GenreNames,
			Description: sr.Description, PosterPath: sr.PosterPath, BackdropPath: sr.BackdropPath,
			TMDBPosterURL: sr.TMDBPosterURL, TMDBBackdropURL: sr.TMDBBackdropURL, TMDBTrailerURL: sr.TMDBTrailerURL,
			LogoPath: sr.LogoPath, TMDBID: sr.TMDBID, IsLocal: true,
		}
		seriesUnits[sr.ID] = u
		idx.units = append(idx.units, u)
		idx.byKey[u.key] = u
	}
	for i := range episodes {
		ep := &episodes[i]
		if ep.SeriesID == nil {
			continue
		}
		if u := seriesUnits[*ep.SeriesID]; u != nil {
			// Recurring cast across episodes is what matters; guest-heavy
			// episode lists are damped slightly.
			mediaFeatures(u.raw, u.labels, ep, 0.9)
		}
	}

	// IDF over the whole library.
	df := map[string]int{}
	for _, u := range idx.units {
		for f := range u.raw {
			df[f]++
		}
	}
	n := float64(len(idx.units))
	for _, u := range idx.units {
		u.vec = make(map[string]float64, len(u.raw))
		sum := 0.0
		for f, w := range u.raw {
			idf := math.Log((n+1)/(float64(df[f])+1)) + 1
			v := w * idf
			u.vec[f] = v
			sum += v * v
		}
		u.norm = math.Sqrt(sum)
	}
	return idx, nil
}

// collectionPhrase avoids "Part of the The X Collection collection" for
// TMDB names that already include the word.
func collectionPhrase(label string) string {
	l := strings.ToLower(label)
	if strings.HasSuffix(l, "collection") {
		if strings.HasPrefix(l, "the ") {
			return "Part of " + label
		}
		return "Part of the " + label
	}
	return "Part of the " + label + " collection"
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

// engagementWeight maps watch progress to a signal strength. Abandoned
// samples are a weak negative so the profile can learn dislikes.
func engagementWeight(progress float64, completed bool, lastWatched time.Time, now time.Time) float64 {
	switch {
	case completed || progress >= 85:
		return 1.0
	case progress >= 40:
		return 0.75
	case progress >= 10:
		return 0.45
	default:
		if now.Sub(lastWatched) > 72*time.Hour {
			return -0.25 // tried it and walked away
		}
		return 0.12 // just started; mild interest
	}
}

func recencyDecay(lastWatched, now time.Time) float64 {
	days := now.Sub(lastWatched).Hours() / 24
	if days < 0 {
		days = 0
	}
	return math.Max(0.15, math.Pow(0.5, days/tasteRecencyHalfLife))
}

func (s *TasteService) loadSignals(idx *tasteIndex, userID string, now time.Time) ([]tasteSignal, error) {
	var progress []models.PlaybackProgress
	q := s.db.Model(&models.PlaybackProgress{}).Order("last_watched DESC").Limit(tasteMaxSignals)
	if err := q.Where("user_id = ?", userID).Find(&progress).Error; err != nil {
		return nil, err
	}
	if len(progress) == 0 {
		// Single-household installs often record history under other ids
		// (e.g. "anonymous"); learn from the household instead of nothing.
		if err := s.db.Model(&models.PlaybackProgress{}).Order("last_watched DESC").Limit(tasteMaxSignals).Find(&progress).Error; err != nil {
			return nil, err
		}
	}
	if len(progress) == 0 {
		return nil, nil
	}

	// Map media ids to units (episodes roll up into their series).
	ids := make([]uint, 0, len(progress))
	for _, p := range progress {
		ids = append(ids, p.MediaID)
	}
	type mediaRef struct {
		ID       uint
		Type     string
		SeriesID *uint
	}
	var refs []mediaRef
	if err := s.db.Model(&models.Media{}).Select("id", "type", "series_id").Where("id IN ?", ids).Scan(&refs).Error; err != nil {
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

	agg := map[string]*tasteSignal{}
	episodes := map[string]int{}
	for _, p := range progress {
		u := unitFor[p.MediaID]
		if u == nil {
			continue
		}
		e := engagementWeight(p.Progress, p.Completed, p.LastWatched, now)
		w := e * recencyDecay(p.LastWatched, now)
		sig := agg[u.key]
		if sig == nil {
			agg[u.key] = &tasteSignal{unit: u, weight: w, engagement: e, lastWatched: p.LastWatched}
			episodes[u.key] = 1
			continue
		}
		episodes[u.key]++
		// Keep the strongest single watch, track latest activity.
		if w > sig.weight {
			sig.weight = w
		}
		if e > sig.engagement {
			sig.engagement = e
		}
		if p.LastWatched.After(sig.lastWatched) {
			sig.lastWatched = p.LastWatched
		}
	}
	out := make([]tasteSignal, 0, len(agg))
	for k, sig := range agg {
		if sig.weight > 0 && episodes[k] > 1 {
			// Bingeing: several episodes of the same show is a strong signal.
			sig.weight *= math.Min(1.6, 1+0.06*float64(episodes[k]-1))
		}
		out = append(out, *sig)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].lastWatched.After(out[j].lastWatched) })
	return out, nil
}

func cosine(a map[string]float64, an float64, b map[string]float64, bn float64) float64 {
	if an == 0 || bn == 0 {
		return 0
	}
	if len(a) > len(b) {
		a, b = b, a
	}
	dot := 0.0
	for f, v := range a {
		dot += v * b[f]
	}
	return dot / (an * bn)
}

func featureLabel(u *tasteUnit, f string) string {
	if l, ok := u.labels[f]; ok {
		return l
	}
	if i := strings.Index(f, ":"); i >= 0 {
		return f[i+1:]
	}
	return f
}

// reasonFor explains a candidate via its strongest overlap with the profile.
func reasonFor(c *tasteUnit, profile map[string]float64) (string, string) {
	best, bestV := "", 0.0
	for f, v := range c.vec {
		p := profile[f] * v
		if strings.HasPrefix(f, "lang:") || strings.HasPrefix(f, "ctry:") || strings.HasPrefix(f, "dec:") {
			// Shared by most of a library ("en", "2010s"): only a tie-breaker,
			// never a convincing explanation on its own.
			p *= 0.25
		}
		if p > bestV {
			best, bestV = f, p
		}
	}
	if best == "" {
		return "", ""
	}
	label := featureLabel(c, best)
	switch {
	case strings.HasPrefix(best, "col:"):
		return best, collectionPhrase(label)
	case strings.HasPrefix(best, "dir:"):
		return best, "Directed by " + label
	case strings.HasPrefix(best, "cast:"):
		return best, "Starring " + label
	case strings.HasPrefix(best, "wri:"):
		return best, "Written by " + label
	case strings.HasPrefix(best, "net:"):
		return best, "From " + label
	case strings.HasPrefix(best, "gen:"):
		return best, "Because you like " + label
	}
	return best, ""
}

type scored struct {
	u      *tasteUnit
	score  float64
	reason string
	feat   string
	rel    float64 // taste relevance without quality/freshness priors
}

// mmr greedily picks items that are relevant but not redundant with what's
// already picked (same franchise/director/primary reason).
func mmr(cands []scored, k int, lambda float64) []scored {
	picked := make([]scored, 0, k)
	used := make([]bool, len(cands))
	for len(picked) < k {
		bestI, bestV := -1, math.Inf(-1)
		for i, c := range cands {
			if used[i] {
				continue
			}
			maxSim := 0.0
			for _, p := range picked {
				if sim := cosine(c.u.vec, c.u.norm, p.u.vec, p.u.norm); sim > maxSim {
					maxSim = sim
				}
			}
			v := lambda*c.score - (1-lambda)*maxSim
			if v > bestV {
				bestI, bestV = i, v
			}
		}
		if bestI < 0 {
			break
		}
		used[bestI] = true
		picked = append(picked, cands[bestI])
	}
	return picked
}

func toItems(list []scored) []TasteItem {
	out := make([]TasteItem, 0, len(list))
	for _, s := range list {
		it := s.u.item
		it.Score = math.Round(s.score*1000) / 1000
		it.Reason = s.reason
		out = append(out, it)
	}
	return out
}

// Recommend builds the personalised home rows for a user.
func (s *TasteService) Recommend(userID string, perRow int) (*TasteResult, error) {
	if perRow <= 0 || perRow > 40 {
		perRow = 20
	}
	idx, err := s.index()
	if err != nil {
		return nil, err
	}
	now := time.Now()
	signals, err := s.loadSignals(idx, userID, now)
	if err != nil {
		return nil, err
	}

	positives := 0
	for _, sg := range signals {
		if sg.weight > 0 {
			positives++
		}
	}
	if positives == 0 {
		return s.fallback(idx, perRow), nil
	}

	// Profile vector.
	profile := map[string]float64{}
	watched := map[string]bool{}
	for _, sg := range signals {
		watched[sg.unit.key] = sg.engagement >= 0.45 || sg.weight < 0
		if sg.unit.norm == 0 {
			continue
		}
		for f, v := range sg.unit.vec {
			profile[f] += sg.weight * v / sg.unit.norm
		}
	}
	pn := 0.0
	for _, v := range profile {
		pn += v * v
	}
	pn = math.Sqrt(pn)

	watchedCollections := map[string]bool{}
	for _, sg := range signals {
		if sg.weight > 0 && sg.unit.collection != "" {
			watchedCollections[normToken(sg.unit.collection)] = true
		}
	}

	// Score every unwatched candidate.
	maxPop := 1.0
	for _, u := range idx.units {
		if u.popularity > maxPop {
			maxPop = u.popularity
		}
	}
	var cands []scored
	for _, u := range idx.units {
		if watched[u.key] || u.norm == 0 {
			continue
		}
		sim := cosine(profile, pn, u.vec, u.norm)
		prior := 0.06*(u.rating/10) + 0.03*math.Log1p(u.popularity)/math.Log1p(maxPop)
		if now.Sub(u.createdAt) < 30*24*time.Hour {
			prior += 0.03
		}
		boost := 0.0
		if u.collection != "" && watchedCollections[normToken(u.collection)] {
			boost = 0.25 // next part of a franchise they're into
		}
		feat, reason := reasonFor(u, profile)
		cands = append(cands, scored{u: u, score: sim + prior + boost, reason: reason, feat: feat, rel: sim + boost})
	}
	sort.Slice(cands, func(i, j int) bool { return cands[i].score > cands[j].score })

	res := &TasteResult{Personalized: true, Signals: len(signals)}
	res.TopFeatures = topFeatures(profile, idx, 8)
	rowUse := map[string]int{} // an item may appear in at most 3 rows

	addRow := func(row TasteRow, list []scored, minItems int) {
		filtered := list[:0:0]
		for _, s := range list {
			if rowUse[s.u.key] >= 3 {
				continue
			}
			filtered = append(filtered, s)
		}
		if len(filtered) < minItems {
			return
		}
		if len(filtered) > perRow {
			filtered = filtered[:perRow]
		}
		for _, s := range filtered {
			rowUse[s.u.key]++
		}
		row.Items = toItems(filtered)
		res.Rows = append(res.Rows, row)
	}

	// 1. Top picks (diversified).
	var pool []scored
	for _, c := range cands {
		if c.rel >= 0.04 {
			pool = append(pool, c)
		}
	}
	if len(pool) < 6 {
		// Small libraries / thin profiles: pad with the best remaining titles.
		for _, c := range cands {
			if len(pool) >= 6 {
				break
			}
			if c.rel < 0.04 {
				pool = append(pool, c)
			}
		}
	}
	if len(pool) > perRow*4 {
		pool = pool[:perRow*4]
	}
	addRow(TasteRow{ID: "top-picks", Title: "Top Picks for You", Kind: "top-picks"}, mmr(pool, perRow, 0.75), 1)

	// 2. Continue a franchise.
	for col := range watchedCollections {
		var parts []scored
		for _, c := range cands {
			if c.u.collection != "" && normToken(c.u.collection) == col {
				parts = append(parts, scored{u: c.u, score: c.score, reason: "Next in the collection"})
			}
		}
		if len(parts) == 0 {
			continue
		}
		sort.Slice(parts, func(i, j int) bool { return parts[i].u.year < parts[j].u.year })
		label := parts[0].u.collection
		addRow(TasteRow{ID: "collection-" + col, Title: "Continue " + label, Kind: "collection"}, parts, 1)
	}

	// 3. Because you watched <recent strong seeds> (item-to-item).
	seeds := 0
	for _, sg := range signals {
		if seeds >= 3 {
			break
		}
		if sg.engagement < 0.45 || sg.unit.norm == 0 {
			continue
		}
		var near []scored
		for _, c := range cands {
			sim := cosine(sg.unit.vec, sg.unit.norm, c.u.vec, c.u.norm)
			if sim < 0.08 {
				continue
			}
			feat, _ := reasonFor(c.u, sg.unit.vec)
			reason := "Similar to " + sg.unit.title
			if feat != "" {
				if l := featureLabel(c.u, feat); l != "" && !strings.HasPrefix(feat, "gen:") && !strings.HasPrefix(feat, "dec:") {
					reason = "Shares " + l + " with " + sg.unit.title
				}
			}
			near = append(near, scored{u: c.u, score: sim + 0.25*c.score, reason: reason})
		}
		sort.Slice(near, func(i, j int) bool { return near[i].score > near[j].score })
		before := len(res.Rows)
		addRow(TasteRow{ID: "because-" + sg.unit.key, Title: "Because You Watched " + sg.unit.title, Kind: "because"}, mmr(near, perRow, 0.8), 2)
		if len(res.Rows) > before {
			seeds++
		}
	}

	// 4/5. People they keep coming back to.
	addPersonRows := func(prefix, kind, titleFmt string, max, minItems int) {
		type fv struct {
			f string
			v float64
		}
		var top []fv
		for f, v := range profile {
			if strings.HasPrefix(f, prefix) && v > 0 {
				top = append(top, fv{f, v})
			}
		}
		sort.Slice(top, func(i, j int) bool { return top[i].v > top[j].v })
		made := 0
		for _, t := range top {
			if made >= max {
				break
			}
			var with []scored
			var label string
			for _, c := range cands {
				if _, ok := c.u.vec[t.f]; ok {
					label = featureLabel(c.u, t.f)
					with = append(with, scored{u: c.u, score: c.score, reason: c.reason})
				}
			}
			if label == "" {
				continue
			}
			before := len(res.Rows)
			addRow(TasteRow{ID: kind + "-" + strings.TrimPrefix(t.f, prefix), Title: fmt.Sprintf(titleFmt, label), Kind: kind}, with, minItems)
			if len(res.Rows) > before {
				made++
			}
		}
	}
	addPersonRows("cast:", "actor", "More with %s", 2, 3)
	addPersonRows("dir:", "director", "From Director %s", 1, 2)

	// 6. Favourite genre.
	addPersonRows("gen:", "genre", "More %s for You", 2, 5)

	if len(res.Rows) == 0 {
		return s.fallback(idx, perRow), nil
	}
	return res, nil
}

func topFeatures(profile map[string]float64, idx *tasteIndex, n int) []string {
	type fv struct {
		f string
		v float64
	}
	var all []fv
	for f, v := range profile {
		if v > 0 && !strings.HasPrefix(f, "dec:") && !strings.HasPrefix(f, "lang:") && !strings.HasPrefix(f, "ctry:") {
			all = append(all, fv{f, v})
		}
	}
	sort.Slice(all, func(i, j int) bool { return all[i].v > all[j].v })
	out := []string{}
	for _, x := range all {
		if len(out) >= n {
			break
		}
		label := x.f
		for _, u := range idx.units {
			if l, ok := u.labels[x.f]; ok {
				label = strings.SplitN(x.f, ":", 2)[0] + ":" + l
				break
			}
		}
		out = append(out, label)
	}
	return out
}

// fallback rows for users with no history yet.
func (s *TasteService) fallback(idx *tasteIndex, perRow int) *TasteResult {
	res := &TasteResult{Personalized: false}
	units := append([]*tasteUnit(nil), idx.units...)

	byRating := append([]*tasteUnit(nil), units...)
	sort.Slice(byRating, func(i, j int) bool {
		if byRating[i].rating != byRating[j].rating {
			return byRating[i].rating > byRating[j].rating
		}
		return byRating[i].popularity > byRating[j].popularity
	})
	byNew := append([]*tasteUnit(nil), units...)
	sort.Slice(byNew, func(i, j int) bool { return byNew[i].createdAt.After(byNew[j].createdAt) })

	mk := func(list []*tasteUnit, reason string) []scored {
		out := []scored{}
		for _, u := range list {
			if len(out) >= perRow {
				break
			}
			out = append(out, scored{u: u, score: u.rating / 10, reason: reason})
		}
		return out
	}
	if rows := mk(byRating, "Highly rated"); len(rows) > 0 {
		res.Rows = append(res.Rows, TasteRow{ID: "highly-rated", Title: "Highly Rated in Your Library", Kind: "fallback", Items: toItems(rows)})
	}
	if rows := mk(byNew, "Recently added"); len(rows) > 0 {
		res.Rows = append(res.Rows, TasteRow{ID: "recently-added", Title: "Recently Added", Kind: "fallback", Items: toItems(rows)})
	}
	return res
}

// Similar returns titles like the given one ("More Like This").
func (s *TasteService) Similar(kind string, id uint, limit int) ([]TasteItem, error) {
	if limit <= 0 || limit > 40 {
		limit = 15
	}
	idx, err := s.index()
	if err != nil {
		return nil, err
	}
	key := fmt.Sprintf("m:%d", id)
	if kind == "series" || kind == "tv" {
		key = fmt.Sprintf("s:%d", id)
	}
	seed := idx.byKey[key]
	if seed == nil || seed.norm == 0 {
		return []TasteItem{}, nil
	}
	var near []scored
	for _, u := range idx.units {
		if u.key == seed.key || u.norm == 0 {
			continue
		}
		sim := cosine(seed.vec, seed.norm, u.vec, u.norm)
		if sim < 0.05 {
			continue
		}
		feat, reason := reasonFor(u, seed.vec)
		if feat != "" && strings.HasPrefix(feat, "gen:") {
			reason = "Similar genre"
		}
		near = append(near, scored{u: u, score: sim + 0.02*(u.rating/10), reason: reason})
	}
	sort.Slice(near, func(i, j int) bool { return near[i].score > near[j].score })
	return toItems(mmr(near, limit, 0.85)), nil
}
