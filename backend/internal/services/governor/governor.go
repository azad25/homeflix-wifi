// Package governor shares the host's CPU, memory and disk among HomeFlix's
// background work, with playback always first.
//
// Every heavy job (preview and thumbnail encodes, scanner probing, trailer
// encodes, torrent work) asks for a slot of its class before it starts:
//
//	release, err := governor.Default.Acquire(ctx, governor.Background)
//	if err != nil { return err }
//	defer release()
//
// The governor samples the host every couple of seconds (load average, Linux
// pressure stall information, available memory, how many people are
// streaming) and sizes each class from that. When someone is watching,
// background work shrinks to a trickle; when the box is overloaded or short
// of memory, only work a viewer is waiting on runs. Lower classes never
// starve: each one is guaranteed a slot at least every MaxWait.
package governor

import (
	"context"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// Class is the priority of a job. Lower values are more important.
type Class int

const (
	// Interactive: a viewer is waiting (hover preview, a poster being made).
	Interactive Class = iota
	// Scan: library scanning (probing new files, matching metadata).
	Scan
	// Background: preview/thumbnail generation nobody is waiting on.
	Background
	// Bulk: the least urgent work (trailer encodes, re-encodes, cleanup).
	Bulk
	numClasses
)

func (c Class) String() string {
	return [...]string{"interactive", "scan", "background", "bulk"}[c]
}

// Sample is one reading of the host.
type Sample struct {
	At          time.Time `json:"at"`
	Cores       int       `json:"cores"`
	Load1       float64   `json:"load1"`         // 1-minute load average
	LoadPerCore float64   `json:"load_per_core"` // Load1 / Cores
	CPUPressure float64   `json:"cpu_pressure"`  // % of time some task waited for CPU (avg10), -1 if unknown
	IOPressure  float64   `json:"io_pressure"`   // % of time some task waited for IO (avg10), -1 if unknown
	MemTotalMB  int64     `json:"mem_total_mb"`
	MemAvailMB  int64     `json:"mem_avail_mb"`
	MemAvailPct float64   `json:"mem_avail_pct"`
	Streams     int       `json:"streams"` // active playback sessions
}

// Mode summarises how much room background work has.
type Mode string

const (
	ModeIdle     Mode = "idle"     // nobody watching, plenty of headroom
	ModeWatching Mode = "watching" // someone is streaming: background yields
	ModeBusy     Mode = "busy"     // CPU or IO saturated
	ModeCritical Mode = "critical" // memory short or badly overloaded: only interactive work
)

// Status is what the admin page shows.
type Status struct {
	Mode    Mode                   `json:"mode"`
	Reason  string                 `json:"reason"`
	Sample  Sample                 `json:"sample"`
	Classes map[string]ClassStatus `json:"classes"`
	Paused  bool                   `json:"paused"` // background work paused by the admin
}

// ClassStatus is one class's slots.
type ClassStatus struct {
	Limit   int   `json:"limit"`
	Running int   `json:"running"`
	Waiting int   `json:"waiting"`
	Granted int64 `json:"granted"` // total since start
}

// MaxWait is the longest a queued job of any class waits while slots of its
// class are zero: then it may run anyway (one at a time per class), so
// nothing starves on a box that is always busy.
var MaxWait = 3 * time.Minute

// Governor hands out slots.
type Governor struct {
	mu       sync.Mutex
	cond     *sync.Cond
	limits   [numClasses]int
	running  [numClasses]int
	waiting  [numClasses]int
	granted  [numClasses]int64
	starving [numClasses]bool // a starved job of this class is running on borrowed time
	sample   Sample
	mode     Mode
	reason   string
	paused   bool

	streams   atomic.Int64 // direct-play streams counted by Track
	streamFns []func() int // other stream counters (HLS, transcodes)
	seenMu    sync.Mutex
	seen      map[string]time.Time // playback activity by session key (see Seen)
	read      func() Sample        // sampler (replaceable in tests)
	decide    func(Sample) (Mode, string, [numClasses]int)
	started   atomic.Bool
}

// Default is the process-wide governor.
var Default = New()

// New makes a governor with the default sampler and policy.
func New() *Governor {
	g := &Governor{mode: ModeIdle, reason: "starting"}
	g.cond = sync.NewCond(&g.mu)
	g.read = readHost
	g.decide = Decide
	// Until the first sample, allow a modest amount of everything.
	g.limits = [numClasses]int{4, 1, 1, 1}
	return g
}

// Start begins sampling every interval. Safe to call more than once.
func (g *Governor) Start(ctx context.Context, interval time.Duration) {
	if !g.started.CompareAndSwap(false, true) {
		return
	}
	g.Refresh()
	go func() {
		t := time.NewTicker(interval)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				g.Refresh()
			}
		}
	}()
}

// CountStreams adds a source of active playback sessions (e.g. HLS sessions).
func (g *Governor) CountStreams(f func() int) {
	g.mu.Lock()
	g.streamFns = append(g.streamFns, f)
	g.mu.Unlock()
}

// Track marks a direct-play stream as active until the returned func is called.
// Playback changes the mode straight away instead of waiting for the next sample.
func (g *Governor) Track() func() {
	if g.streams.Add(1) == 1 {
		go g.Refresh()
	}
	var once sync.Once
	return func() {
		once.Do(func() {
			if g.streams.Add(-1) == 0 {
				go g.Refresh()
			}
		})
	}
}

// SeenWindow is how long a playback session counts as active after its last
// request. Players fetch video in short range requests with gaps between
// them, so in-flight requests alone undercount viewers.
var SeenWindow = 45 * time.Second

// Seen records playback activity for a session (e.g. media id + client).
func (g *Governor) Seen(key string) {
	g.seenMu.Lock()
	if g.seen == nil {
		g.seen = map[string]time.Time{}
	}
	_, known := g.seen[key]
	g.seen[key] = time.Now()
	g.seenMu.Unlock()
	if !known {
		go g.Refresh() // a new viewer changes the mode straight away
	}
}

func (g *Governor) activeSeen() int {
	g.seenMu.Lock()
	defer g.seenMu.Unlock()
	n := 0
	for k, t := range g.seen {
		if time.Since(t) > SeenWindow {
			delete(g.seen, k)
			continue
		}
		n++
	}
	return n
}

// Pause stops background, bulk and scan work (interactive work continues).
func (g *Governor) Pause(on bool) {
	g.mu.Lock()
	g.paused = on
	g.mu.Unlock()
	g.Refresh()
}

// Refresh takes a new sample and recomputes the limits.
func (g *Governor) Refresh() {
	s := g.read()
	g.mu.Lock()
	fns := append([]func() int(nil), g.streamFns...)
	g.mu.Unlock()
	s.Streams = int(g.streams.Load())
	if seen := g.activeSeen(); seen > s.Streams {
		s.Streams = seen // in-flight and recently-seen sessions overlap; take the larger
	}
	for _, f := range fns {
		s.Streams += safeCount(f)
	}
	mode, reason, limits := g.decide(s)

	g.mu.Lock()
	if g.paused {
		limits[Scan], limits[Background], limits[Bulk] = 0, 0, 0
		reason = "paused by admin; " + reason
	}
	g.sample, g.mode, g.reason, g.limits = s, mode, reason, limits
	g.cond.Broadcast()
	g.mu.Unlock()
}

func safeCount(f func() int) (n int) {
	defer func() {
		if recover() != nil {
			n = 0
		}
	}()
	return f()
}

// Acquire waits for a slot of class c. The returned release must be called
// when the work is done. It returns ctx.Err() if ctx ends first.
func (g *Governor) Acquire(ctx context.Context, c Class) (func(), error) {
	if c < 0 || c >= numClasses {
		c = Bulk
	}
	stop := context.AfterFunc(ctx, func() {
		g.mu.Lock()
		g.cond.Broadcast()
		g.mu.Unlock()
	})
	defer stop()
	deadline := time.Now().Add(MaxWait)
	wake := time.AfterFunc(MaxWait, func() {
		g.mu.Lock()
		g.cond.Broadcast()
		g.mu.Unlock()
	})
	defer wake.Stop()

	g.mu.Lock()
	defer g.mu.Unlock()
	g.waiting[c]++
	defer func() { g.waiting[c]-- }()
	for {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if g.running[c] < g.limits[c] && !g.higherWaiting(c) {
			return g.grant(c, false), nil
		}
		// Starvation guard: one job per class may run after MaxWait, unless
		// memory is critical or the admin paused background work.
		if time.Now().After(deadline) && !g.starving[c] && g.mode != ModeCritical && !(g.paused && c != Interactive) {
			return g.grant(c, true), nil
		}
		g.cond.Wait()
	}
}

// higherWaiting: a more important class is queued for a slot it can get, so
// lower classes let it go first when they share the CPU.
func (g *Governor) higherWaiting(c Class) bool {
	for h := Interactive; h < c; h++ {
		if g.waiting[h] > 0 && g.running[h] < g.limits[h] {
			return true
		}
	}
	return false
}

func (g *Governor) grant(c Class, starved bool) func() {
	g.running[c]++
	g.granted[c]++
	if starved {
		g.starving[c] = true
	}
	var once sync.Once
	return func() {
		once.Do(func() {
			g.mu.Lock()
			g.running[c]--
			if starved {
				g.starving[c] = false
			}
			g.cond.Broadcast()
			g.mu.Unlock()
		})
	}
}

// Allowed reports whether class c could start now without waiting (for loops
// that would rather skip a round than block, e.g. "start another torrent?").
func (g *Governor) Allowed(c Class) bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.running[c] < g.limits[c]
}

// Mode returns the current mode.
func (g *Governor) Mode() Mode {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.mode
}

// Status returns the current state for the admin page.
func (g *Governor) Status() Status {
	g.mu.Lock()
	defer g.mu.Unlock()
	cs := map[string]ClassStatus{}
	for c := Interactive; c < numClasses; c++ {
		cs[c.String()] = ClassStatus{Limit: g.limits[c], Running: g.running[c], Waiting: g.waiting[c], Granted: g.granted[c]}
	}
	return Status{Mode: g.mode, Reason: g.reason, Sample: g.sample, Classes: cs, Paused: g.paused}
}

// Decide is the policy: how many slots each class gets for a sample.
//
//   - Cores sets the ceiling. ffmpeg encodes use several threads each, so
//     background classes get about a quarter of the cores at most.
//   - Someone streaming: transcodes need the CPU and disk, so scanning drops
//     to one worker, background encodes to one, bulk work stops.
//   - Busy (CPU or IO pressure, or load above the core count): one slot for
//     scanning and background work, none for bulk.
//   - Critical (under 8% memory free, or load at twice the cores): only
//     interactive work.
func Decide(s Sample) (Mode, string, [numClasses]int) {
	cores := s.Cores
	if cores < 1 {
		cores = 1
	}
	quarter := max(1, cores/4)
	half := max(1, cores/2)
	idle := [numClasses]int{half + 2, half, quarter, quarter}

	memLow := s.MemTotalMB > 0 && s.MemAvailPct < 8
	overloaded := s.LoadPerCore >= 2 || s.CPUPressure >= 80
	switch {
	case memLow || overloaded:
		why := "load " + f1(s.LoadPerCore) + "× cores"
		if memLow {
			why = "memory low (" + f1(s.MemAvailPct) + "% free)"
		}
		return ModeCritical, why, [numClasses]int{max(1, quarter), 0, 0, 0}
	case s.CPUPressure >= 40 || s.IOPressure >= 40 || s.LoadPerCore >= 1.1:
		why := "cpu pressure " + f1(s.CPUPressure) + "%, io pressure " + f1(s.IOPressure) + "%, load " + f1(s.LoadPerCore) + "× cores"
		l := [numClasses]int{half + 1, 1, 1, 0}
		if s.Streams > 0 {
			l[Background] = 0 // a viewer is competing: encodes wait
		}
		return ModeBusy, why, l
	case s.Streams > 0:
		return ModeWatching, strconv.Itoa(s.Streams) + " stream(s) playing", [numClasses]int{half + 1, 1, 1, 0}
	}
	return ModeIdle, "headroom available", idle
}

func f1(v float64) string {
	if v < 0 {
		return "n/a"
	}
	return strconv.FormatFloat(v, 'f', 1, 64)
}

// readHost reads Linux /proc. Missing files leave fields at "unknown".
func readHost() Sample {
	s := Sample{At: time.Now(), Cores: runtime.NumCPU(), CPUPressure: -1, IOPressure: -1}
	if b, err := os.ReadFile("/proc/loadavg"); err == nil {
		if f := strings.Fields(string(b)); len(f) > 0 {
			s.Load1, _ = strconv.ParseFloat(f[0], 64)
		}
	}
	s.LoadPerCore = s.Load1 / float64(s.Cores)
	s.CPUPressure = psiSome("/proc/pressure/cpu")
	s.IOPressure = psiSome("/proc/pressure/io")
	if b, err := os.ReadFile("/proc/meminfo"); err == nil {
		for _, line := range strings.Split(string(b), "\n") {
			f := strings.Fields(line)
			if len(f) < 2 {
				continue
			}
			kb, _ := strconv.ParseInt(f[1], 10, 64)
			switch f[0] {
			case "MemTotal:":
				s.MemTotalMB = kb / 1024
			case "MemAvailable:":
				s.MemAvailMB = kb / 1024
			}
		}
		if s.MemTotalMB > 0 {
			s.MemAvailPct = 100 * float64(s.MemAvailMB) / float64(s.MemTotalMB)
		}
	}
	return s
}

// psiSome returns "some avg10" from a pressure file, or -1.
func psiSome(path string) float64 {
	b, err := os.ReadFile(path)
	if err != nil {
		return -1
	}
	for _, line := range strings.Split(string(b), "\n") {
		if !strings.HasPrefix(line, "some ") {
			continue
		}
		for _, kv := range strings.Fields(line) {
			if v, ok := strings.CutPrefix(kv, "avg10="); ok {
				f, err := strconv.ParseFloat(v, 64)
				if err == nil {
					return f
				}
			}
		}
	}
	return -1
}
