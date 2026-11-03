package governor

import (
	"context"
	"sync"
	"testing"
	"time"
)

func fixed(s Sample) func() Sample { return func() Sample { return s } }

func TestDecideModes(t *testing.T) {
	base := Sample{Cores: 8, MemTotalMB: 16000, MemAvailPct: 50, CPUPressure: 2, IOPressure: 1, LoadPerCore: 0.2}
	cases := []struct {
		name string
		mod  func(*Sample)
		mode Mode
		bg   int
		bulk int
	}{
		{"idle", func(*Sample) {}, ModeIdle, 2, 2},
		{"watching", func(s *Sample) { s.Streams = 1 }, ModeWatching, 1, 0},
		{"busy", func(s *Sample) { s.CPUPressure = 55 }, ModeBusy, 1, 0},
		{"busy+watching", func(s *Sample) { s.IOPressure = 60; s.Streams = 2 }, ModeBusy, 0, 0},
		{"memory low", func(s *Sample) { s.MemAvailPct = 5 }, ModeCritical, 0, 0},
		{"overloaded", func(s *Sample) { s.LoadPerCore = 2.5 }, ModeCritical, 0, 0},
		{"unknown psi", func(s *Sample) { s.CPUPressure, s.IOPressure = -1, -1 }, ModeIdle, 2, 2},
	}
	for _, c := range cases {
		s := base
		c.mod(&s)
		mode, _, l := Decide(s)
		if mode != c.mode || l[Background] != c.bg || l[Bulk] != c.bulk {
			t.Errorf("%s: got %s bg=%d bulk=%d, want %s bg=%d bulk=%d", c.name, mode, l[Background], l[Bulk], c.mode, c.bg, c.bulk)
		}
		if l[Interactive] < 1 {
			t.Errorf("%s: interactive must always have a slot", c.name)
		}
	}
}

func TestAcquireRespectsLimitsAndWakes(t *testing.T) {
	g := New()
	g.read = fixed(Sample{Cores: 4, MemTotalMB: 8000, MemAvailPct: 50})
	g.Refresh() // idle: background = 1 on 4 cores
	r1, err := g.Acquire(context.Background(), Background)
	if err != nil {
		t.Fatal(err)
	}
	got := make(chan struct{})
	go func() {
		r2, _ := g.Acquire(context.Background(), Background)
		close(got)
		r2()
	}()
	select {
	case <-got:
		t.Fatal("second background slot granted over the limit")
	case <-time.After(50 * time.Millisecond):
	}
	r1()
	select {
	case <-got:
	case <-time.After(time.Second):
		t.Fatal("waiter not woken on release")
	}
}

func TestStreamingPausesBulkAndResumes(t *testing.T) {
	g := New()
	g.read = fixed(Sample{Cores: 8, MemTotalMB: 8000, MemAvailPct: 50})
	g.Refresh()
	if !g.Allowed(Bulk) {
		t.Fatal("bulk should run when idle")
	}
	done := g.Track()
	g.Refresh()
	if g.Mode() != ModeWatching || g.Allowed(Bulk) {
		t.Fatalf("while streaming: mode %s, bulk allowed %v", g.Mode(), g.Allowed(Bulk))
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	if _, err := g.Acquire(ctx, Bulk); err == nil {
		t.Fatal("bulk acquired while streaming")
	}
	done()
	done() // idempotent
	g.Refresh()
	if g.Mode() != ModeIdle || !g.Allowed(Bulk) {
		t.Fatalf("after stream: mode %s", g.Mode())
	}
}

func TestStarvationGuard(t *testing.T) {
	old := MaxWait
	MaxWait = 40 * time.Millisecond
	defer func() { MaxWait = old }()
	g := New()
	g.read = fixed(Sample{Cores: 8, MemTotalMB: 8000, MemAvailPct: 50})
	defer g.Track()() // someone watching: bulk limit 0
	g.Refresh()
	start := time.Now()
	r, err := g.Acquire(context.Background(), Bulk)
	if err != nil {
		t.Fatal(err)
	}
	if time.Since(start) < MaxWait {
		t.Fatal("granted before MaxWait")
	}
	// only one starved job at a time
	ctx, cancel := context.WithTimeout(context.Background(), 3*MaxWait)
	defer cancel()
	if _, err := g.Acquire(ctx, Bulk); err == nil {
		t.Fatal("second starved bulk job granted")
	}
	r()
}

func TestPauseAndCriticalBlockBackground(t *testing.T) {
	old := MaxWait
	MaxWait = 20 * time.Millisecond
	defer func() { MaxWait = old }()
	g := New()
	g.read = fixed(Sample{Cores: 8, MemTotalMB: 8000, MemAvailPct: 3}) // critical
	g.Refresh()
	ctx, cancel := context.WithTimeout(context.Background(), 80*time.Millisecond)
	defer cancel()
	if _, err := g.Acquire(ctx, Background); err == nil {
		t.Fatal("background ran with memory critical")
	}
	r, err := g.Acquire(context.Background(), Interactive)
	if err != nil {
		t.Fatal("interactive blocked:", err)
	}
	r()

	g.read = fixed(Sample{Cores: 8, MemTotalMB: 8000, MemAvailPct: 50})
	g.Pause(true)
	ctx2, cancel2 := context.WithTimeout(context.Background(), 80*time.Millisecond)
	defer cancel2()
	if _, err := g.Acquire(ctx2, Scan); err == nil {
		t.Fatal("scan ran while paused")
	}
	g.Pause(false)
	r, err = g.Acquire(context.Background(), Scan)
	if err != nil {
		t.Fatal(err)
	}
	r()
}

func TestPriorityOrder(t *testing.T) {
	g := New()
	g.read = fixed(Sample{Cores: 8, MemTotalMB: 8000, MemAvailPct: 50})
	g.Refresh()
	// Hold every interactive slot, then queue an interactive and a bulk job.
	var held []func()
	for g.Allowed(Interactive) {
		r, _ := g.Acquire(context.Background(), Interactive)
		held = append(held, r)
	}
	var mu sync.Mutex
	var order []string
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		r, _ := g.Acquire(context.Background(), Interactive)
		mu.Lock()
		order = append(order, "interactive")
		mu.Unlock()
		r()
	}()
	time.Sleep(20 * time.Millisecond)
	// Bulk has its own free slots, so it isn't blocked by a waiting interactive
	// job that can't run either.
	r, err := g.Acquire(context.Background(), Bulk)
	if err != nil {
		t.Fatal(err)
	}
	r()
	for _, h := range held {
		h()
	}
	wg.Wait()
	if len(order) != 1 {
		t.Fatal("interactive waiter never ran")
	}
}

func TestPSIParse(t *testing.T) {
	if v := psiSome("/nonexistent"); v != -1 {
		t.Fatal(v)
	}
	s := readHost()
	if s.Cores < 1 {
		t.Fatal("cores")
	}
}
