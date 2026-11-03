// Package telemetry sends one anonymous ping a day so the HomeFlix project
// can count installs across every server (tracker/ in the repository).
//
// Sent: a random install ID (made once, stored in data/telemetry.json) and
// the HomeFlix version. Nothing else. Turn it off in Settings → About, or with
// HOMEFLIX_TELEMETRY=off.
package telemetry

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// DefaultURL is the install counter (tracker/worker.js deployed on
// Cloudflare). Empty until it is deployed; HOMEFLIX_TELEMETRY_URL overrides.
const DefaultURL = ""

const file = "./data/telemetry.json"

type state struct {
	Enabled   bool   `json:"enabled"`
	InstallID string `json:"install_id"`
}

var (
	mu sync.Mutex
	st *state
)

func load() *state {
	if st != nil {
		return st
	}
	st = &state{Enabled: true}
	if b, err := os.ReadFile(file); err == nil {
		_ = json.Unmarshal(b, st)
	}
	if st.InstallID == "" {
		b := make([]byte, 16)
		_, _ = rand.Read(b)
		st.InstallID = hex.EncodeToString(b)
		save()
	}
	return st
}

func save() {
	_ = os.MkdirAll(filepath.Dir(file), 0o755)
	b, _ := json.Marshal(st)
	_ = os.WriteFile(file, b, 0o644)
}

// URL is the counter in use ("" = none configured).
func URL() string {
	if u := strings.TrimSpace(os.Getenv("HOMEFLIX_TELEMETRY_URL")); u != "" {
		return strings.TrimRight(u, "/")
	}
	return strings.TrimRight(DefaultURL, "/")
}

func envOff() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("HOMEFLIX_TELEMETRY")))
	return v == "off" || v == "0" || v == "false" || v == "no"
}

// Enabled reports whether this server sends its daily ping.
func Enabled() bool {
	mu.Lock()
	defer mu.Unlock()
	return load().Enabled && !envOff()
}

// SetEnabled turns the daily ping on or off (saved).
func SetEnabled(on bool) {
	mu.Lock()
	load().Enabled = on
	save()
	mu.Unlock()
}

// Version is the running release, from the git branch (release/v5.5 -> v5.5).
func Version() string {
	out, err := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD").Output()
	if err != nil {
		return "unknown"
	}
	v := strings.TrimPrefix(strings.TrimSpace(string(out)), "release/")
	if v == "" || v == "HEAD" {
		return "unknown"
	}
	return v
}

// Start pings once shortly after startup, then daily.
func Start() {
	go func() {
		time.Sleep(2 * time.Minute)
		for {
			ping()
			time.Sleep(24 * time.Hour)
		}
	}()
}

func ping() {
	u := URL()
	if u == "" || !Enabled() {
		return
	}
	mu.Lock()
	id := load().InstallID
	mu.Unlock()
	body, _ := json.Marshal(map[string]string{"id": id, "v": Version()})
	resp, err := (&http.Client{Timeout: 15 * time.Second}).Post(u+"/ping", "application/json", bytes.NewReader(body))
	if err != nil {
		return // offline: try again tomorrow
	}
	resp.Body.Close()
	if resp.StatusCode >= 300 {
		log.Printf("📊 Install counter answered %s", resp.Status)
	}
}

// Stats is the project-wide count.
type Stats struct {
	Installs  int            `json:"installs"`
	Active30d int            `json:"active_30d"`
	Active7d  int            `json:"active_7d"`
	Versions  map[string]int `json:"versions"`
	Updated   string         `json:"updated"`
}

var (
	statsMu sync.Mutex
	stats   *Stats
	statsAt time.Time
)

// GetStats returns the counter's totals (cached 10 minutes).
func GetStats() (*Stats, error) {
	u := URL()
	if u == "" {
		return nil, fmt.Errorf("install counter not configured")
	}
	statsMu.Lock()
	defer statsMu.Unlock()
	if stats != nil && time.Since(statsAt) < 10*time.Minute {
		return stats, nil
	}
	resp, err := (&http.Client{Timeout: 10 * time.Second}).Get(u + "/stats")
	if err != nil {
		return stats, err
	}
	defer resp.Body.Close()
	var s Stats
	if err := json.NewDecoder(resp.Body).Decode(&s); err != nil {
		return stats, err
	}
	stats, statsAt = &s, time.Now()
	return stats, nil
}
