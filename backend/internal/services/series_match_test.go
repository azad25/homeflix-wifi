package services

import "testing"

func TestSeriesFuzzyMatching(t *testing.T) {
	s := &MediaService{}
	match := func(a, b string) bool {
		return s.calculateSeriesSimilarity(s.normalizeSeriesTitle(a), s.normalizeSeriesTitle(b)) >= 0.75
	}
	same := [][2]string{
		{"Breaking Bad", "Breaking Bad (2008)"},
		{"Grey's Anatomy", "Greys Anatomy"},
		{"Shōgun", "Shogun"},
		{"The Mandalorian", "The Mandalorain"}, // typo
		{"Doctor Who", "Doctor.Who"},
	}
	for _, p := range same {
		if !match(p[0], p[1]) {
			t.Errorf("%q and %q should be the same show", p[0], p[1])
		}
	}
	different := [][2]string{
		{"Show Number 1", "Show Number 0"},
		{"Station 19", "Station 11"},
		{"Fargo", "Cargo"},
		{"Lost", "Lust"},
		{"Star Trek Discovery", "Star Trek Picard"},
		{"Dexter", "Dexter New Blood"},
		{"Room 104", "Room 105"},
	}
	for _, p := range different {
		if match(p[0], p[1]) {
			t.Errorf("%q and %q must stay separate shows", p[0], p[1])
		}
	}
}
