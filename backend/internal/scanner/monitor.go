package scanner

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

// Monitor records what the scanner is doing, for Settings > Scanner:
//   - the run in progress (kind, phase, operation, counters, rate);
//   - a history of finished runs (kept on disk);
//   - the scanner's activity: the same lines the server log/terminal shows
//     while a scan runs (log output is teed into Write), plus the scanner's
//     own progress messages.
//
// Every scan entry point (Settings buttons, the file watcher, finished
// downloads, startup) goes through Run, so nothing is missed.
var Mon = newMonitor()

// Event is one line of scanner activity.
type Event struct {
	Seq   int64     `json:"seq"`
	At    time.Time `json:"at"`
	Level string    `json:"level"` // info | success | warn | error
	Text  string    `json:"text"`
	RunID int64     `json:"run_id,omitempty"`
}

// RunInfo is a scan run.
type RunInfo struct {
	ID          int64      `json:"id"`
	Kind        string     `json:"kind"`
	Status      string     `json:"status"` // running | completed | failed
	StartedAt   time.Time  `json:"started_at"`
	EndedAt     *time.Time `json:"ended_at,omitempty"`
	Seconds     float64    `json:"seconds"`
	Phase       string     `json:"phase,omitempty"`
	Operation   string     `json:"operation,omitempty"`
	Total       int        `json:"total"`
	Processed   int        `json:"processed"`
	Errors      int        `json:"errors"`
	Skipped     int        `json:"skipped"`
	New         int        `json:"new"`
	Updated     int        `json:"updated"`
	Workers     int        `json:"workers"`
	FilesPerSec float64    `json:"files_per_sec"`
	Error       string     `json:"error,omitempty"`
	Warnings    int        `json:"warnings"`
	ErrorLines  int        `json:"error_lines"`
}

// LiveMsg is pushed to subscribers.
type LiveMsg struct {
	Type  string   `json:"type"` // event | run
	Event *Event   `json:"event,omitempty"`
	Run   *RunInfo `json:"run,omitempty"`
}

type monitor struct {
	mu       sync.Mutex
	cur      *RunInfo
	depth    int // nested entry points (a sync that runs a scan) share one run
	trackers []*ProgressTracker
	stats    func() ScanStats
	base     ScanStats
	history  []RunInfo
	events   []Event
	seq      int64
	nextID   int64
	file     string
	partial  []byte
	subs     map[chan LiveMsg]struct{}
}

const (
	maxEvents  = 1500
	maxHistory = 30
)

func newMonitor() *monitor {
	m := &monitor{subs: map[chan LiveMsg]struct{}{}}
	dir := strings.TrimSpace(os.Getenv("HOMEFLIX_SCANNER_DIR"))
	if dir == "" {
		dir = "./data/scanner"
	}
	m.file = filepath.Join(dir, "history.json")
	if b, err := os.ReadFile(m.file); err == nil {
		_ = json.Unmarshal(b, &m.history)
	}
	for _, r := range m.history {
		if r.ID >= m.nextID {
			m.nextID = r.ID
		}
	}
	return m
}

// SetStatsSource gives the monitor the scanner's live counters (used by scans
// that don't drive a ProgressTracker).
func (m *monitor) SetStatsSource(f func() ScanStats) {
	m.mu.Lock()
	m.stats = f
	m.mu.Unlock()
}

// Run wraps a scan entry point. Nested calls join the outer run.
func (m *monitor) Run(kind string, fn func() error) error {
	m.begin(kind)
	err := fn()
	m.end(err)
	return err
}

func (m *monitor) begin(kind string) {
	m.mu.Lock()
	m.depth++
	if m.depth > 1 {
		m.mu.Unlock()
		return
	}
	m.nextID++
	m.cur = &RunInfo{ID: m.nextID, Kind: kind, Status: "running", StartedAt: time.Now()}
	if m.stats != nil {
		m.base = m.stats()
	}
	m.trackers = nil
	run := *m.cur
	m.mu.Unlock()
	m.emit("info", "▶ "+kind+" started")
	m.broadcast(LiveMsg{Type: "run", Run: &run})
}

func (m *monitor) end(err error) {
	m.mu.Lock()
	m.depth--
	if m.depth > 0 || m.cur == nil {
		m.mu.Unlock()
		return
	}
	m.refreshLocked()
	now := time.Now()
	r := *m.cur
	r.EndedAt = &now
	r.Seconds = now.Sub(r.StartedAt).Seconds()
	r.Status = "completed"
	if err != nil {
		r.Status, r.Error = "failed", err.Error()
	}
	m.cur = nil
	m.trackers = nil
	m.history = append([]RunInfo{r}, m.history...)
	if len(m.history) > maxHistory {
		m.history = m.history[:maxHistory]
	}
	m.saveLocked()
	m.mu.Unlock()
	if err != nil {
		m.emit("error", "■ "+r.Kind+" failed: "+err.Error())
	} else {
		m.emit("success", "■ "+r.Kind+" finished")
	}
	m.broadcast(LiveMsg{Type: "run", Run: &r})
}

func (m *monitor) saveLocked() {
	b, err := json.Marshal(m.history)
	if err != nil {
		return
	}
	_ = os.MkdirAll(filepath.Dir(m.file), 0o755)
	_ = os.WriteFile(m.file, b, 0o644)
}

// attach/detach: progress trackers feed the live counters.
func (m *monitor) attach(p *ProgressTracker) {
	m.mu.Lock()
	m.trackers = append(m.trackers, p)
	m.mu.Unlock()
}

func (m *monitor) detach(p *ProgressTracker) {
	m.mu.Lock()
	for i, t := range m.trackers {
		if t == p {
			m.trackers = append(m.trackers[:i], m.trackers[i+1:]...)
			break
		}
	}
	m.mu.Unlock()
}

// refreshLocked copies live counters into the current run: from the newest
// progress tracker if a scan drives one, otherwise from the scanner's
// counters since the run began.
func (m *monitor) refreshLocked() {
	r := m.cur
	if r == nil {
		return
	}
	if n := len(m.trackers); n > 0 {
		p := m.trackers[n-1]
		p.mutex.RLock()
		r.Phase, r.Operation = p.currentPhase, p.currentOperation
		r.Total, r.Processed, r.Errors, r.Skipped, r.Workers = p.totalFiles, p.processedFiles, p.errorFiles, p.skippedFiles, p.activeGoroutines
		p.mutex.RUnlock()
	} else if m.stats != nil {
		s := m.stats()
		r.Total = s.TotalFiles
		r.Processed = s.ProcessedFiles - m.base.ProcessedFiles
		r.Skipped = s.SkippedFiles - m.base.SkippedFiles
		r.Errors = s.ErrorFiles - m.base.ErrorFiles
		r.New = s.NewFiles - m.base.NewFiles
		r.Updated = s.UpdatedFiles - m.base.UpdatedFiles
		if r.Processed < 0 { // counters were reset by the scan itself
			r.Processed, r.Skipped, r.Errors, r.New, r.Updated = s.ProcessedFiles, s.SkippedFiles, s.ErrorFiles, s.NewFiles, s.UpdatedFiles
		}
	}
	r.Seconds = time.Since(r.StartedAt).Seconds()
	if r.Seconds > 0 {
		r.FilesPerSec = float64(r.Processed) / r.Seconds
	}
}

// Current returns the running scan (nil when idle).
func (m *monitor) Current() *RunInfo {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.cur == nil {
		return nil
	}
	m.refreshLocked()
	r := *m.cur
	return &r
}

// History returns finished runs, newest first.
func (m *monitor) History() []RunInfo {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]RunInfo{}, m.history...)
}

// Events returns activity after seq (at most limit, newest last).
func (m *monitor) Events(after int64, limit int) []Event {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []Event
	for _, e := range m.events {
		if e.Seq > after {
			out = append(out, e)
		}
	}
	if limit > 0 && len(out) > limit {
		out = out[len(out)-limit:]
	}
	return out
}

var (
	reANSI = regexp.MustCompile(`\x1b\[[0-9;?]*[A-Za-z]`)
	// While idle, only scanner-related lines are kept (the watcher noticing
	// files, imports, metadata and artwork work).
	reScannerLine = regexp.MustCompile(`(?i)scan|watcher|new file|detected|import|metadata|tmdb|poster|backdrop|thumbnail|preview|subtitle|episode|season|series|library|media path|sync`)
	reStdPrefix   = regexp.MustCompile(`^\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}(\.\d+)? `)
)

func level(text string) string {
	low := strings.ToLower(text)
	switch {
	case strings.Contains(text, "❌") || strings.Contains(low, "error") || strings.Contains(low, "failed") || strings.Contains(low, "panic"):
		return "error"
	case strings.Contains(text, "⚠") || strings.Contains(low, "warning") || strings.Contains(low, "skipp"):
		return "warn"
	case strings.Contains(text, "✅") || strings.Contains(text, "🎉") || strings.Contains(low, "complete") || strings.Contains(low, "success"):
		return "success"
	}
	return "info"
}

// emit adds an activity line.
func (m *monitor) emit(lvl, text string) {
	text = strings.TrimSpace(reANSI.ReplaceAllString(text, ""))
	if text == "" {
		return
	}
	if len(text) > 400 {
		text = text[:400] + "…"
	}
	m.mu.Lock()
	m.seq++
	e := Event{Seq: m.seq, At: time.Now(), Level: lvl, Text: text}
	if m.cur != nil {
		e.RunID = m.cur.ID
		switch lvl {
		case "warn":
			m.cur.Warnings++
		case "error":
			m.cur.ErrorLines++
		}
	}
	m.events = append(m.events, e)
	if len(m.events) > maxEvents {
		m.events = m.events[len(m.events)-maxEvents:]
	}
	m.mu.Unlock()
	m.broadcast(LiveMsg{Type: "event", Event: &e})
}

// Log records a scanner message (used by ProgressTracker.LogWithProgress,
// which prints straight to stdout).
func (m *monitor) Log(text string) { m.emit(level(text), text) }

// Write receives the server's log output (see server.go): every line logged
// during a scan, and scanner-related lines while idle, become activity.
func (m *monitor) Write(p []byte) (int, error) {
	m.mu.Lock()
	m.partial = append(m.partial, p...)
	var lines [][]byte
	for {
		i := bytes.IndexByte(m.partial, '\n')
		if i < 0 {
			break
		}
		lines = append(lines, append([]byte(nil), m.partial[:i]...))
		m.partial = m.partial[i+1:]
	}
	if len(m.partial) > 8192 {
		m.partial = m.partial[:0]
	}
	active := m.cur != nil
	m.mu.Unlock()
	for _, l := range lines {
		text := reStdPrefix.ReplaceAllString(string(l), "")
		if !active && !reScannerLine.MatchString(text) {
			continue
		}
		m.emit(level(text), text)
	}
	return len(p), nil
}

// Subscribe receives live messages until cancel is called.
func (m *monitor) Subscribe() (<-chan LiveMsg, func()) {
	ch := make(chan LiveMsg, 256)
	m.mu.Lock()
	m.subs[ch] = struct{}{}
	m.mu.Unlock()
	return ch, func() {
		m.mu.Lock()
		delete(m.subs, ch)
		m.mu.Unlock()
	}
}

func (m *monitor) broadcast(msg LiveMsg) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for ch := range m.subs {
		select {
		case ch <- msg:
		default: // slow client; it reloads the activity on reconnect
		}
	}
}
