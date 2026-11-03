package scanner

import "testing"

func TestTidyMovieTitle(t *testing.T) {
	for in, want := range map[string]string{
		"Alien 2017":                   "Alien",
		"Arrival 103 (1990) [":         "Arrival 103",
		"Heat":                         "Heat",
		"1917":                         "1917",
		"2001 A Space Odyssey":         "2001 A Space Odyssey",
		"Blade Runner 2049 2017":       "Blade Runner 2049",
		"Wonder Woman 1984 2020 1080p": "Wonder Woman 1984",
		"Dune Part Two 2024 IMAX":      "Dune Part Two",
		"The Dark Knight":              "The Dark Knight",
	} {
		if got := tidyMovieTitle(in); got != want {
			t.Errorf("%q -> %q, want %q", in, got, want)
		}
	}
}
