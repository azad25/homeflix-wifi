package handlers

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"
)

func TestReleaseVersionsAndUpgradeTarget(t *testing.T) {
	branches := []string{"release/v5", "release/v5.5", "release/v5.10", "release/v4.9", "release/v6.0"}
	cases := []struct{ current, want string }{
		{"release/v5", "release/v6.0"},
		{"release/v5.5", "release/v6.0"},
		{"release/v6", ""},   // v6 == v6.0, nothing newer
		{"release/v6.0", ""}, // already newest
		{"main", ""},         // non-release branches are never auto-switched
		{"app/v4.6", ""},
	}
	for _, c := range cases {
		if got := newerRelease(c.current, branches); got != c.want {
			t.Errorf("newerRelease(%q) = %q, want %q", c.current, got, c.want)
		}
	}
	// numeric, not lexical: v5.10 > v5.5
	if compareVersions(releaseVersion("release/v5.10"), releaseVersion("release/v5.5")) != 1 {
		t.Error("v5.10 should be newer than v5.5")
	}
	if newerRelease("release/v5.5", []string{"release/v5", "release/v5.5", "release/v5.10"}) != "release/v5.10" {
		t.Error("expected v5.10 as upgrade from v5.5")
	}
	for _, bad := range []string{"release/v5;rm -rf /", "release/5.5", "release/v5..5", "feature/x"} {
		if releaseVersion(bad) != nil {
			t.Errorf("%q should not parse as a release branch", bad)
		}
	}
}

func TestUpdateJobRunningIgnoresDeadJobs(t *testing.T) {
	dir := t.TempDir()
	f := dir + "/.update-status.json"
	write := func(s string) {
		if err := os.WriteFile(f, []byte(s), 0644); err != nil {
			t.Fatal(err)
		}
	}
	write(fmt.Sprintf(`{"state":"running","phase":"build-frontend","pid":%d}`, os.Getpid()))
	if _, running := updateJobRunning(f); !running {
		t.Error("live pid should count as running")
	}
	write(`{"state":"running","phase":"switch","pid":999999999}`)
	if _, running := updateJobRunning(f); running {
		t.Error("dead pid must not block updates")
	}
	write(`{"state":"done","pid":1}`)
	if _, running := updateJobRunning(f); running {
		t.Error("finished job is not running")
	}
}

func TestFinalizeUpdateAfterRestart(t *testing.T) {
	f := t.TempDir() + "/.update-status.json"
	read := func() map[string]interface{} {
		var st map[string]interface{}
		data, _ := os.ReadFile(f)
		_ = json.Unmarshal(data, &st)
		return st
	}
	// Job killed by systemd mid-restart -> finalized as done on startup.
	_ = os.WriteFile(f, []byte(`{"state":"running","phase":"restart","message":"Restarting services - switched to release/v5.5 on release/v5.5 abc123 feat: x","pid":999999999}`), 0644)
	finalizeUpdateStatusFile(f)
	st := read()
	if st["state"] != "done" || st["phase"] != "done" {
		t.Fatalf("not finalized: %v", st)
	}
	if msg, _ := st["message"].(string); msg != "Update complete - services restarted (switched to release/v5.5 on release/v5.5 abc123 feat: x)" {
		t.Errorf("message: %q", msg)
	}
	// A job still building must be left alone.
	_ = os.WriteFile(f, []byte(`{"state":"running","phase":"build-frontend"}`), 0644)
	finalizeUpdateStatusFile(f)
	if read()["state"] != "running" {
		t.Error("in-progress build must not be finalized")
	}
	// Old-script message without details.
	_ = os.WriteFile(f, []byte(`{"state":"running","phase":"restart","message":"Restarting services"}`), 0644)
	finalizeUpdateStatusFile(f)
	if m, _ := read()["message"].(string); m != "Update complete - services restarted" {
		t.Errorf("message: %q", m)
	}
}
