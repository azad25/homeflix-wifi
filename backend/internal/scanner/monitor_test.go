package scanner

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
)

func TestMonitorRunsEventsAndHistory(t *testing.T) {
	t.Setenv("HOMEFLIX_SCANNER_DIR", t.TempDir())
	m := newMonitor()
	ch, cancel := m.Subscribe()
	defer cancel()

	// Idle: only scanner-related log lines are kept.
	fmt.Fprint(m, "2026/11/03 10:00:00 GET /api/health 200\n2026/11/03 10:00:01 👀 Watcher: new file detected Movie.mkv\n")
	if ev := m.Events(0, 0); len(ev) != 1 || !strings.Contains(ev[0].Text, "Watcher") || strings.HasPrefix(ev[0].Text, "2026") {
		t.Fatalf("idle events %+v", ev)
	}

	err := m.Run("Scan & sync", func() error {
		// nested entry point joins the outer run
		return m.Run("Full scan", func() error {
			p := &ProgressTracker{}
			m.attach(p)
			p.SetTotalFiles(10)
			for i := 0; i < 4; i++ {
				p.IncrementProcessed()
			}
			p.IncrementError()
			cur := m.Current()
			if cur == nil || cur.Kind != "Scan & sync" || cur.Total != 10 || cur.Processed != 4 || cur.Errors != 1 {
				t.Fatalf("live %+v", cur)
			}
			// While a scan runs, every log line is activity (split writes too).
			fmt.Fprint(m, "2026/11/03 10:00:02 \x1b[32m✅ Added Heat (1995)\x1b[0m\n2026/11/03 10:00:03 ❌ ffprobe fa")
			fmt.Fprint(m, "iled: bad file\nGET /x 200\n")
			m.detach(p)
			return errors.New("disk vanished")
		})
	})
	if err == nil || m.Current() != nil {
		t.Fatal("run not finished")
	}
	h := m.History()
	if len(h) != 1 || h[0].Status != "failed" || h[0].Error != "disk vanished" || h[0].Processed != 4 || h[0].ErrorLines < 1 {
		t.Fatalf("history %+v", h)
	}
	var texts []string
	for _, e := range m.Events(0, 0) {
		texts = append(texts, e.Level+":"+e.Text)
	}
	joined := strings.Join(texts, "\n")
	for _, want := range []string{"success:✅ Added Heat (1995)", "error:❌ ffprobe failed: bad file", "info:GET /x 200", "info:▶ Scan & sync started", "error:■ Scan & sync failed: disk vanished"} {
		if !strings.Contains(joined, want) {
			t.Fatalf("missing %q in\n%s", want, joined)
		}
	}
	if strings.Contains(joined, "\x1b") {
		t.Fatal("ANSI codes kept")
	}
	// live messages were pushed
	got := 0
	for len(ch) > 0 {
		<-ch
		got++
	}
	if got < 5 {
		t.Fatalf("only %d live messages", got)
	}
	// history survives a restart
	m2 := newMonitor()
	if len(m2.History()) != 1 || m2.nextID != h[0].ID {
		t.Fatalf("history not persisted: %+v", m2.History())
	}
	_ = filepath.Join
}

func TestMonitorUsesScannerCountersWithoutTracker(t *testing.T) {
	t.Setenv("HOMEFLIX_SCANNER_DIR", t.TempDir())
	m := newMonitor()
	stats := ScanStats{TotalFiles: 50, ProcessedFiles: 100, NewFiles: 3}
	m.SetStatsSource(func() ScanStats { return stats })
	m.Run("Incremental scan", func() error {
		stats.ProcessedFiles, stats.NewFiles = 112, 5
		if c := m.Current(); c.Processed != 12 || c.New != 2 {
			t.Fatalf("delta %+v", c)
		}
		return nil
	})
	if h := m.History(); h[0].Status != "completed" || h[0].Processed != 12 {
		t.Fatalf("history %+v", h[0])
	}
}
