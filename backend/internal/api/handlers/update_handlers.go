package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
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
	logFile = filepath.Join(repoRoot, "update.log")
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

// CheckUpdate compares the local checkout with the remote branch.
// Auto-discovers the current branch and its origin counterpart.
func CheckUpdate() gin.HandlerFunc {
	return func(c *gin.Context) {
		repoRoot, _, _, err := updatePaths()
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"ok": false, "error": err.Error()})
			return
		}

		branch, err := runGitCmd(repoRoot, 10*time.Second, "rev-parse", "--abbrev-ref", "HEAD")
		if err != nil || branch == "" || branch == "HEAD" {
			c.JSON(http.StatusOK, gin.H{"ok": false, "error": "detached HEAD or unknown branch; update requires a tracking branch"})
			return
		}

		// Refresh remote refs (tolerate offline: fall back to last fetched state).
		fetchErr := ""
		if _, err := runGitCmd(repoRoot, 30*time.Second, "fetch", "origin", branch); err != nil {
			fetchErr = err.Error()
			log.Printf("⚠️ Update check: fetch failed (%v), using last known remote state", err)
		}

		remoteRef := "origin/" + branch
		if _, err := runGitCmd(repoRoot, 10*time.Second, "rev-parse", "--verify", remoteRef); err != nil {
			c.JSON(http.StatusOK, gin.H{"ok": false, "error": fmt.Sprintf("no remote branch %s (fetch error: %s)", remoteRef, fetchErr)})
			return
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

		c.JSON(http.StatusOK, gin.H{
			"ok":               true,
			"branch":           branch,
			"current":          gitCommitInfo(repoRoot, "HEAD"),
			"remote":           gitCommitInfo(repoRoot, remoteRef),
			"behind":           behind,
			"ahead":            ahead,
			"update_available": behind > 0 && ahead == 0,
			"dirty":            len(dirtyFiles) > 0,
			"dirty_files":      dirtyFiles,
			"fetch_error":      fetchErr,
		})
	}
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

		// Refuse concurrent runs.
		if data, err := os.ReadFile(statusFile); err == nil {
			var st map[string]interface{}
			if json.Unmarshal(data, &st) == nil && st["state"] == "running" {
				c.JSON(http.StatusOK, gin.H{"ok": false, "error": "an update is already running"})
				return
			}
		}

		dryRun := c.Query("dry_run") == "1"
		script := filepath.Join(repoRoot, "scripts", "perform-update.sh")
		if _, err := os.Stat(script); err != nil {
			c.JSON(http.StatusOK, gin.H{"ok": false, "error": "updater script missing: scripts/perform-update.sh"})
			return
		}

		writeUpdateStatus(statusFile, map[string]interface{}{
			"state":   "running",
			"phase":   "starting",
			"dry_run": dryRun,
			"message": "update job launched",
		})

		// Detach fully so the job survives this backend process being
		// stopped/restarted at the end of the update.
		real := exec.Command("setsid", "bash", script)
		if dryRun {
			real.Args = append(real.Args, "--dry-run")
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
		_ = real.Process.Release()
		log.Printf("🚀 System update job started (dry_run=%v)", dryRun)
		c.JSON(http.StatusOK, gin.H{"ok": true, "started": true, "dry_run": dryRun})
	}
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
		st["ok"] = true
		c.JSON(http.StatusOK, st)
	}
}
