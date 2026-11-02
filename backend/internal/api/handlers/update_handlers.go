package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// updateStatusFile tracks an in-progress or finished system update.
func updatePaths() (repoRoot, statusFile, logFile string, err error) {
	out, e := exec.Command("git", "rev-parse", "--show-toplevel").Output()
	if e != nil {
		return "", "", "", fmt.Errorf("not a git repository: %v", e)
	}
	repoRoot = strings.TrimSpace(string(out))
	statusFile = filepath.Join(repoRoot, ".update-status.json")
	// Not *.log: start.sh deletes *.log in the repo root during the restart
	// step, which would wipe the update's own log mid-run.
	logFile = filepath.Join(repoRoot, "update-log.txt")
	return repoRoot, statusFile, logFile, nil
}

func runGitCmd(dir string, timeout time.Duration, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	// Never prompt for credentials; fail fast instead.
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
	var out strings.Builder
	var errOut strings.Builder
	cmd.Stdout = &out
	cmd.Stderr = &errOut
	timer := time.AfterFunc(timeout, func() {
		if cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
	})
	defer timer.Stop()
	if err := cmd.Run(); err != nil {
		return strings.TrimSpace(out.String()), fmt.Errorf("%v: %s", err, strings.TrimSpace(errOut.String()))
	}
	return strings.TrimSpace(out.String()), nil
}

func gitCommitInfo(dir, rev string) map[string]string {
	info := map[string]string{"hash": "", "date": "", "subject": ""}
	if out, err := runGitCmd(dir, 10*time.Second, "log", "-1", "--format=%H|%ci|%s", rev); err == nil && out != "" {
		parts := strings.SplitN(out, "|", 3)
		if len(parts) == 3 {
			info["hash"] = parts[0]
			if len(info["hash"]) > 12 {
				info["short"] = info["hash"][:12]
			} else {
				info["short"] = info["hash"]
			}
			info["date"] = parts[1]
			info["subject"] = parts[2]
		}
	}
	return info
}

// Release branches look like release/v5, release/v5.5, release/v6.0.1.
var releaseBranchRe = regexp.MustCompile(`^release/v(\d+(?:\.\d+)*)$`)

// releaseVersion parses "release/v5.5" into [5 5]; nil if not a release branch.
func releaseVersion(branch string) []int {
	m := releaseBranchRe.FindStringSubmatch(branch)
	if m == nil {
		return nil
	}
	parts := strings.Split(m[1], ".")
	out := make([]int, len(parts))
	for i, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil {
			return nil
		}
		out[i] = n
	}
	return out
}

// compareVersions returns -1, 0 or 1 (missing parts count as 0: v5 == v5.0).
func compareVersions(a, b []int) int {
	for i := 0; i < len(a) || i < len(b); i++ {
		var x, y int
		if i < len(a) {
			x = a[i]
		}
		if i < len(b) {
			y = b[i]
		}
		if x != y {
			if x < y {
				return -1
			}
			return 1
		}
	}
	return 0
}

// remoteReleaseBranches lists release/* branches on origin, oldest first.
func remoteReleaseBranches(repoRoot string) ([]string, error) {
	out, err := runGitCmd(repoRoot, 20*time.Second, "ls-remote", "--heads", "origin", "refs/heads/release/*")
	if err != nil {
		return nil, err
	}
	var branches []string
	for _, line := range strings.Split(out, "\n") {
		fields := strings.Fields(line)
		if len(fields) != 2 {
			continue
		}
		name := strings.TrimPrefix(fields[1], "refs/heads/")
		if releaseVersion(name) != nil {
			branches = append(branches, name)
		}
	}
	sort.Slice(branches, func(i, j int) bool {
		return compareVersions(releaseVersion(branches[i]), releaseVersion(branches[j])) < 0
	})
	return branches, nil
}

// newerRelease returns the highest release branch newer than current ("" if none).
func newerRelease(current string, branches []string) string {
	cur := releaseVersion(current)
	if cur == nil {
		return "" // not on a release branch: don't suggest switching
	}
	best := ""
	for _, b := range branches {
		v := releaseVersion(b)
		if compareVersions(v, cur) > 0 && (best == "" || compareVersions(v, releaseVersion(best)) > 0) {
			best = b
		}
	}
	return best
}

// CheckUpdate compares the local checkout with the remote branch.
// Auto-discovers the current branch and its origin counterpart.
func CheckUpdate() gin.HandlerFunc {
	return func(c *gin.Context) { c.JSON(http.StatusOK, ComputeUpdateCheck()) }
}

// ComputeUpdateCheck fetches the remote and reports what an update would
// do (also used by the background update notifier).
func ComputeUpdateCheck() gin.H {
	{
		repoRoot, _, _, err := updatePaths()
		if err != nil {
			return gin.H{"ok": false, "error": err.Error()}
		}

		branch, err := runGitCmd(repoRoot, 10*time.Second, "rev-parse", "--abbrev-ref", "HEAD")
		if err != nil || branch == "" || branch == "HEAD" {
			return gin.H{"ok": false, "error": "detached HEAD or unknown branch; update requires a tracking branch"}
		}

		// Refresh remote refs (tolerate offline: fall back to last fetched state).
		fetchErr := ""
		if _, err := runGitCmd(repoRoot, 30*time.Second, "fetch", "origin", "+refs/heads/"+branch+":refs/remotes/origin/"+branch); err != nil {
			fetchErr = err.Error()
			log.Printf("⚠️ Update check: fetch failed (%v), using last known remote state", err)
		}

		remoteRef := "origin/" + branch
		if _, err := runGitCmd(repoRoot, 10*time.Second, "rev-parse", "--verify", remoteRef); err != nil {
			return gin.H{"ok": false, "error": fmt.Sprintf("no remote branch %s (fetch error: %s)", remoteRef, fetchErr)}
		}

		behind := 0
		if out, err := runGitCmd(repoRoot, 10*time.Second, "rev-list", "--count", "HEAD.."+remoteRef); err == nil {
			_, _ = fmt.Sscan(out, &behind)
		}
		ahead := 0
		if out, err := runGitCmd(repoRoot, 10*time.Second, "rev-list", "--count", remoteRef+"..HEAD"); err == nil {
			_, _ = fmt.Sscan(out, &ahead)
		}

		dirtyOut, _ := runGitCmd(repoRoot, 10*time.Second, "status", "--porcelain")
		dirtyFiles := []string{}
		for _, line := range strings.Split(dirtyOut, "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "??") {
				continue // untracked scratch files never block updates
			}
			dirtyFiles = append(dirtyFiles, line)
		}

		// Newer release branches (e.g. on release/v5, offer release/v5.5).
		var releases []string
		var upgrade gin.H
		if list, err := remoteReleaseBranches(repoRoot); err == nil {
			releases = list
			if target := newerRelease(branch, list); target != "" {
				if _, err := runGitCmd(repoRoot, 30*time.Second, "fetch", "origin", "+refs/heads/"+target+":refs/remotes/origin/"+target); err == nil {
					upgrade = gin.H{
						"branch":  target,
						"version": strings.TrimPrefix(target, "release/"),
						"remote":  gitCommitInfo(repoRoot, "origin/"+target),
					}
				}
			}
		}

		return gin.H{
			"ok":               true,
			"branch":           branch,
			"releases":         releases,
			"upgrade":          upgrade,
			"current":          gitCommitInfo(repoRoot, "HEAD"),
			"remote":           gitCommitInfo(repoRoot, remoteRef),
			"behind":           behind,
			"ahead":            ahead,
			"update_available": behind > 0 && ahead == 0,
			"dirty":            len(dirtyFiles) > 0,
			"dirty_files":      dirtyFiles,
			"fetch_error":      fetchErr,
		}
	}
}

// A full pull + Go build + Next.js build comfortably finishes well within this.
const updateStaleAfter = 45 * time.Minute

func updateStatusStale(statusFile string) bool {
	fi, err := os.Stat(statusFile)
	return err == nil && time.Since(fi.ModTime()) > updateStaleAfter
}

// updateJobRunning reports whether the status file describes a live job.
// The script records its pid; if that process is gone (crash, reboot, kill)
// the leftover "running" state must not block new updates.
func updateJobRunning(statusFile string) (map[string]interface{}, bool) {
	data, err := os.ReadFile(statusFile)
	if err != nil {
		return nil, false
	}
	var st map[string]interface{}
	if json.Unmarshal(data, &st) != nil || st["state"] != "running" {
		return st, false
	}
	if updateStatusStale(statusFile) {
		return st, false
	}
	if pid, ok := st["pid"].(float64); ok && pid > 0 && !processAlive(int(pid)) {
		return st, false
	}
	return st, true
}

func writeUpdateStatus(statusFile string, v map[string]interface{}) {
	v["updated_at"] = time.Now().Format(time.RFC3339)
	data, _ := json.MarshalIndent(v, "", "  ")
	_ = os.WriteFile(statusFile, data, 0644)
}

// ApplyUpdate launches scripts/perform-update.sh detached and returns immediately.
// The script performs: preflight, pull --ff-only, backend+frontend builds, restart.
func ApplyUpdate() gin.HandlerFunc {
	return func(c *gin.Context) {
		repoRoot, statusFile, logFile, err := updatePaths()
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"ok": false, "error": err.Error()})
			return
		}

		// Refuse concurrent runs (but not a dead job's leftover status).
		if st, running := updateJobRunning(statusFile); running {
			c.JSON(http.StatusOK, gin.H{"ok": false, "already_running": true, "status": st,
				"error": fmt.Sprintf("an update is already running (%v)", st["phase"])})
			return
		}

		dryRun := c.Query("dry_run") == "1"

		// Optional switch to another release branch (validated against origin).
		targetBranch := strings.TrimSpace(c.Query("branch"))
		if targetBranch != "" {
			if releaseVersion(targetBranch) == nil {
				c.JSON(http.StatusOK, gin.H{"ok": false, "error": "invalid release branch"})
				return
			}
			list, err := remoteReleaseBranches(repoRoot)
			if err != nil {
				c.JSON(http.StatusOK, gin.H{"ok": false, "error": "cannot reach origin: " + err.Error()})
				return
			}
			found := false
			for _, b := range list {
				found = found || b == targetBranch
			}
			if !found {
				c.JSON(http.StatusOK, gin.H{"ok": false, "error": "branch " + targetBranch + " not found on origin"})
				return
			}
		}
		script := filepath.Join(repoRoot, "scripts", "perform-update.sh")
		if _, err := os.Stat(script); err != nil {
			c.JSON(http.StatusOK, gin.H{"ok": false, "error": "updater script missing: scripts/perform-update.sh"})
			return
		}

		writeUpdateStatus(statusFile, map[string]interface{}{
			"state":   "running",
			"phase":   "starting",
			"dry_run": dryRun,
			"branch":  targetBranch,
			"message": "update job launched",
		})

		// Detach fully so the job survives this backend process being
		// stopped/restarted at the end of the update.
		real := exec.Command("setsid", "bash", script)
		if dryRun {
			real.Args = append(real.Args, "--dry-run")
		}
		if targetBranch != "" {
			real.Args = append(real.Args, "--branch", targetBranch)
		}
		real.Dir = repoRoot
		lf, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			writeUpdateStatus(statusFile, map[string]interface{}{"state": "error", "message": "cannot open update log"})
			c.JSON(http.StatusOK, gin.H{"ok": false, "error": "cannot open update log"})
			return
		}
		defer lf.Close()
		real.Stdout = lf
		real.Stderr = lf
		if err := real.Start(); err != nil {
			writeUpdateStatus(statusFile, map[string]interface{}{"state": "error", "message": fmt.Sprintf("failed to launch updater: %v", err)})
			c.JSON(http.StatusOK, gin.H{"ok": false, "error": fmt.Sprintf("failed to launch updater: %v", err)})
			return
		}
		// Record the job's pid right away (the script keeps it via exec).
		writeUpdateStatus(statusFile, map[string]interface{}{
			"state": "running", "phase": "starting", "dry_run": dryRun, "branch": targetBranch,
			"message": "update job launched", "pid": real.Process.Pid,
		})
		_ = real.Process.Release()
		log.Printf("🚀 System update job started (dry_run=%v, branch=%q)", dryRun, targetBranch)
		c.JSON(http.StatusOK, gin.H{"ok": true, "started": true, "dry_run": dryRun, "branch": targetBranch})
	}
}

// FinalizeUpdateAfterRestart completes an update whose job was killed while
// restarting services. Under systemd (homeflix.service, Restart=always),
// stopping the app ends the service's main process, so systemd kills every
// process in the service - including the update job - before it can write
// "done", then restarts HomeFlix on the new code. The new server reaching
// startup proves the build and restart worked, so it records the outcome.
// Call once at startup.
func FinalizeUpdateAfterRestart() {
	_, statusFile, _, err := updatePaths()
	if err != nil {
		return
	}
	finalizeUpdateStatusFile(statusFile)
}

var (
	finalizedMu      sync.Mutex
	finalizedMessage string
)

// TakeFinalizedUpdate returns (once) what the update that just finished
// installed, e.g. "12 commit(s) pulled on release/v5.5 abc123 ...".
func TakeFinalizedUpdate() (string, bool) {
	finalizedMu.Lock()
	defer finalizedMu.Unlock()
	m := finalizedMessage
	finalizedMessage = ""
	return m, m != ""
}

func finalizeUpdateStatusFile(statusFile string) {
	data, err := os.ReadFile(statusFile)
	if err != nil {
		return
	}
	var st map[string]interface{}
	if json.Unmarshal(data, &st) != nil || st["state"] != "running" || st["phase"] != "restart" {
		return
	}
	msg, _ := st["message"].(string)
	msg = strings.TrimPrefix(msg, "Restarting services")
	msg = strings.TrimLeft(msg, " -:")
	done := "Update complete - services restarted"
	if msg != "" {
		done += " (" + msg + ")"
	}
	st["state"] = "done"
	st["phase"] = "done"
	st["message"] = done
	writeUpdateStatus(statusFile, st)
	finalizedMu.Lock()
	finalizedMessage = msg
	finalizedMu.Unlock()
	log.Printf("✅ Update finalized after restart: %s", done)
}

// UpdateStatus reports the current/last update job state for polling.
func UpdateStatus() gin.HandlerFunc {
	return func(c *gin.Context) {
		_, statusFile, _, err := updatePaths()
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"ok": false, "error": err.Error()})
			return
		}
		data, err := os.ReadFile(statusFile)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"ok": true, "state": "idle"})
			return
		}
		var st map[string]interface{}
		if json.Unmarshal(data, &st) != nil {
			c.JSON(http.StatusOK, gin.H{"ok": true, "state": "idle"})
			return
		}
		if st["state"] == "running" {
			if _, alive := updateJobRunning(statusFile); !alive {
				if st["phase"] == "restart" {
					// Killed while restarting (systemd): the restart itself is
					// the success signal; the new server finalizes on startup.
					st["state"] = "done"
					st["message"] = "Update complete - services restarted"
					writeUpdateStatus(statusFile, st)
					st["ok"] = true
					c.JSON(http.StatusOK, st)
					return
				}
				st["state"] = "error"
				st["message"] = "the update job stopped unexpectedly - see update-log.txt on the server"
			}
		}
		st["ok"] = true
		c.JSON(http.StatusOK, st)
	}
}
