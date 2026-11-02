package services

import (
	"sort"
	"strings"
	"time"
)

// Interest is a person (actor / director) or genre a viewer keeps watching.
type Interest struct {
	Kind   string  `json:"kind"` // actor | director | genre
	Name   string  `json:"name"`
	Weight float64 `json:"weight"`
}

// TopInterests returns the people and genres that weigh most in the
// viewer's taste profile (watch history, ratings, My List).
func (s *TasteService) TopInterests(userID string, n int) ([]Interest, error) {
	idx, err := s.index()
	if err != nil {
		return nil, err
	}
	signals, err := s.loadSignals(idx, userID, time.Now())
	if err != nil {
		return nil, err
	}
	profile := map[string]float64{}
	labels := map[string]string{}
	for _, sg := range signals {
		if sg.unit.norm == 0 || sg.weight <= 0 {
			continue
		}
		for f, v := range sg.unit.vec {
			profile[f] += sg.weight * v / sg.unit.norm
			if _, ok := labels[f]; !ok {
				labels[f] = featureLabel(sg.unit, f)
			}
		}
	}
	kinds := map[string]string{"cast:": "actor", "dir:": "director", "gen:": "genre"}
	var out []Interest
	for f, v := range profile {
		for prefix, kind := range kinds {
			if strings.HasPrefix(f, prefix) && v > 0 {
				out = append(out, Interest{Kind: kind, Name: labels[f], Weight: v})
			}
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Weight > out[j].Weight })
	if n > 0 && len(out) > n {
		out = out[:n]
	}
	return out, nil
}
