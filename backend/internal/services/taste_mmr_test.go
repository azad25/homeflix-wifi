package services

import (
	"fmt"
	"math"
	"math/rand"
	"testing"
)

// mmrNaive is the original O(n·k²) implementation, kept as the reference.
func mmrNaive(cands []scored, k int, lambda float64) []scored {
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
			if v := lambda*c.score - (1-lambda)*maxSim; v > bestV {
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

func randomCands(r *rand.Rand, n int) []scored {
	out := make([]scored, n)
	for i := range out {
		vec := map[string]float64{}
		for j := 0; j < 1+r.Intn(8); j++ {
			vec[fmt.Sprintf("g:%d", r.Intn(15))] = r.Float64()
		}
		norm := 0.0
		for _, v := range vec {
			norm += v * v
		}
		out[i] = scored{u: &tasteUnit{key: fmt.Sprint(i), vec: vec, norm: math.Sqrt(norm)}, score: r.Float64()}
	}
	return out
}

func TestMMRMatchesReference(t *testing.T) {
	r := rand.New(rand.NewSource(1))
	for trial := 0; trial < 50; trial++ {
		cands := randomCands(r, 5+r.Intn(300))
		k := 1 + r.Intn(25)
		lambda := 0.5 + r.Float64()*0.5
		a, b := mmr(cands, k, lambda), mmrNaive(cands, k, lambda)
		if len(a) != len(b) {
			t.Fatalf("trial %d: len %d vs %d", trial, len(a), len(b))
		}
		for i := range a {
			if a[i].u != b[i].u {
				t.Fatalf("trial %d: pick %d differs (%s vs %s)", trial, i, a[i].u.key, b[i].u.key)
			}
		}
	}
}

func BenchmarkMMR(b *testing.B) {
	cands := randomCands(rand.New(rand.NewSource(2)), 3000)
	for i := 0; i < b.N; i++ {
		mmr(cands, 20, 0.75)
	}
}

func BenchmarkMMRNaive(b *testing.B) {
	cands := randomCands(rand.New(rand.NewSource(2)), 3000)
	for i := 0; i < b.N; i++ {
		mmrNaive(cands, 20, 0.75)
	}
}
