package autodl

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"

	"homeflix-backend/internal/torrent"
)

// Candidate is a release that passed the profile's rules.
type Candidate struct {
	Result  torrent.SearchResult
	Quality string // 2160p | 1080p | 720p | 480p
	Source  string // webrip | web-dl | bluray | hdtv | ...
	Bytes   int64
	Score   float64
}

var (
	reQuality = regexp.MustCompile(`(?i)\b(2160p|4k|uhd|1080p|720p|480p)\b`)
	reSources = []struct {
		re  *regexp.Regexp
		key string
	}{
		{regexp.MustCompile(`(?i)\bweb[ ._-]?rip\b`), "webrip"},
		{regexp.MustCompile(`(?i)\bweb[ ._-]?dl\b`), "web-dl"},
		{regexp.MustCompile(`(?i)\b(blu[ ._-]?ray|bdrip|brrip|bd)\b`), "bluray"},
		{regexp.MustCompile(`(?i)\bhdtv\b`), "hdtv"},
		{regexp.MustCompile(`(?i)\bdvd[ ._-]?rip\b`), "dvdrip"},
		{regexp.MustCompile(`(?i)\bweb\b`), "web-dl"},
	}
	reSize    = regexp.MustCompile(`(?i)([\d.,]+)\s*(tb|tib|gb|gib|mb|mib|kb|kib)`)
	reNonWord = regexp.MustCompile(`[^a-z0-9]+`)
	reEpisode = regexp.MustCompile(`(?i)\bs\d{1,2}[ ._-]?e\d{1,3}\b|\b\d{1,2}x\d{2}\b`)
)

func normalize(s string) string {
	return strings.TrimSpace(reNonWord.ReplaceAllString(strings.ToLower(s), " "))
}

func parseQuality(r torrent.SearchResult) string {
	for _, s := range []string{r.Title, r.Quality} {
		if m := reQuality.FindString(s); m != "" {
			switch strings.ToLower(m) {
			case "4k", "uhd", "2160p":
				return "2160p"
			default:
				return strings.ToLower(m)
			}
		}
	}
	return ""
}

func parseSource(title string) string {
	for _, s := range reSources {
		if s.re.MatchString(title) {
			return s.key
		}
	}
	if strings.Contains(strings.ToUpper(title), "[YTS]") {
		return "web-dl" // YTS encodes are WEB or BluRay sources
	}
	return ""
}

// ParseSize turns "1.97 GB" / "700 MiB" into bytes (0 if unknown).
func ParseSize(s string) int64 {
	m := reSize.FindStringSubmatch(s)
	if m == nil {
		return 0
	}
	v, err := strconv.ParseFloat(strings.ReplaceAll(m[1], ",", ""), 64)
	if err != nil {
		return 0
	}
	mult := map[string]float64{"kb": 1 << 10, "kib": 1 << 10, "mb": 1 << 20, "mib": 1 << 20, "gb": 1 << 30, "gib": 1 << 30, "tb": 1 << 40, "tib": 1 << 40}[strings.ToLower(m[2])]
	return int64(v * mult)
}

// matchesTitle: the release is for this movie/season (not a sequel with a
// longer name, not a single episode when we want a season pack).
func matchesTitle(releaseTitle string, it Item) bool {
	rel := " " + normalize(releaseTitle) + " "
	want := normalize(it.Title)
	if want == "" {
		return false
	}
	i := strings.Index(rel, " "+want+" ")
	if i < 0 {
		return false
	}
	after := strings.Fields(rel[i+len(want)+2:])
	if it.MediaType == "tv" {
		if reEpisode.MatchString(releaseTitle) && !regexp.MustCompile(`(?i)e\d{1,3}\s*-\s*e?\d{1,3}`).MatchString(releaseTitle) {
			return false // single episode
		}
		season := it.Season
		packRe := regexp.MustCompile(fmt.Sprintf(`(?i)\b(s%02d|s%d|season[ ._-]?%d)\b`, season, season, season))
		return packRe.MatchString(releaseTitle)
	}
	// Movies: the next word should be the year (allow +-1 for release-date
	// differences) or a quality/source tag, not more title ("Dune Part Two").
	if it.Year > 0 {
		for _, w := range after[:min(len(after), 3)] {
			if y, err := strconv.Atoi(w); err == nil && y >= 1900 && y <= 2100 {
				return int(math.Abs(float64(y-it.Year))) <= 1
			}
		}
		return false
	}
	return true
}

// Pick returns the best release for the item under the settings, or nil.
func Pick(results []torrent.SearchResult, it Item, st Settings, rejected map[string]bool) *Candidate {
	blocked := make([]*regexp.Regexp, 0, len(st.BlockedTerms))
	for _, t := range st.BlockedTerms {
		t = strings.TrimSpace(t)
		if t != "" {
			blocked = append(blocked, regexp.MustCompile(`(?i)(^|[^a-z0-9])`+regexp.QuoteMeta(t)+`([^a-z0-9]|$)`))
		}
	}
	qualityRank := map[string]int{}
	for i, q := range st.Qualities {
		qualityRank[strings.ToLower(q)] = i
	}
	sourceRank := map[string]int{}
	for i, s := range st.PreferredSources {
		sourceRank[strings.ToLower(s)] = i
	}
	maxBytes := int64(st.MaxMovieGB * float64(1<<30))
	if it.MediaType == "tv" {
		maxBytes = int64(st.MaxSeasonGB * float64(1<<30))
	}

	var best *Candidate
	for _, r := range results {
		if r.MagnetURI == "" || rejected[r.MagnetURI] || r.Seeders < st.MinSeeders {
			continue
		}
		bad := false
		for _, b := range blocked {
			if b.MatchString(r.Title) {
				bad = true
				break
			}
		}
		if bad || !matchesTitle(r.Title, it) {
			continue
		}
		q := parseQuality(r)
		qi, ok := qualityRank[q]
		if !ok {
			continue
		}
		size := r.SizeBytes
		if size == 0 {
			size = ParseSize(r.Size)
		}
		if size <= 0 || (maxBytes > 0 && size > maxBytes) {
			continue // unknown size: can't check space or the limit
		}
		src := parseSource(r.Title)
		score := float64((len(st.Qualities)-qi)*1000) +
			math.Min(float64(r.Seeders), 400) -
			float64(size)/float64(1<<30)*15
		if si, ok := sourceRank[src]; ok {
			score += float64(300 - 60*si)
		}
		c := &Candidate{Result: r, Quality: q, Source: src, Bytes: size, Score: score}
		if best == nil || c.Score > best.Score {
			best = c
		}
	}
	return best
}
