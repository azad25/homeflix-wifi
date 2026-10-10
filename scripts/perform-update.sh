#!/bin/bash
# HomeFlix safe self-update: pull -> build backend -> build frontend -> restart.
# Launched detached by POST /api/admin/update/apply (see update_handlers.go).
# Progress: .update-status.json (polled by Settings UI), details: update.log
# Usage: scripts/perform-update.sh [--dry-run]   (dry-run skips the restart)
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_DIR"

STATUS_FILE="$REPO_DIR/.update-status.json"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

set_phase() { # $1=phase $2=message [$3=state]
  local state="${3:-running}"
  python3 -c "import json; d={'state':'$state','phase':'$1','message':'''$2''','dry_run':$DRY_RUN}; open('$STATUS_FILE','w').write(json.dumps(d))" 2>/dev/null || \
    printf '{"state":"%s","phase":"%s","message":"%s","dry_run":%d}\n' "$state" "$1" "$2" "$DRY_RUN" > "$STATUS_FILE"
}
fail() { echo "❌ $1"; set_phase "failed" "$1" "error"; exit 1; }

echo "=============================================="
echo "🚀 HomeFlix system update started $(date '+%Y-%m-%d %H:%M:%S') (dry_run=$DRY_RUN)"
set_phase "preflight" "Checking repository state"

export GIT_TERMINAL_PROMPT=0
command -v git >/dev/null || fail "git is not installed"
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || fail "not a git repository"
[[ "$BRANCH" == "HEAD" ]] && fail "detached HEAD - checkout a branch first"
echo "📌 Branch: $BRANCH"
echo "📌 Current: $(git log -1 --format='%h %ci %s')"

# 1. Preflight: refuse on local modifications (tracked files only;
#    ignored DBs/binaries/logs can never block an update)
DIRTY=$(git status --porcelain | grep -v '^??' || true)
if [[ -n "$DIRTY" ]]; then
  echo "⚠️ Local modifications detected:"
  echo "$DIRTY"
  fail "local changes present - commit or stash them, then retry"
fi

# 2. Fetch + compare (auto-discover remote state)
git fetch origin "$BRANCH" 2>&1 | tail -n 3 || fail "cannot reach origin - check network"
BEHIND=$(git rev-list --count "HEAD..origin/$BRANCH")
AHEAD=$(git rev-list --count "origin/$BRANCH..HEAD")
echo "📌 Behind: $BEHIND, Ahead: $AHEAD"
[[ "$AHEAD" -gt 0 ]] && fail "local branch is $AHEAD commit(s) ahead - push or reset first"
[[ "$BEHIND" -eq 0 ]] && { echo "✅ Already up to date"; set_phase "done" "Already up to date" "done"; exit 0; }

# 3. Pull (fast-forward only - never merges, never touches ignored DBs)
set_phase "pull" "Pulling $BEHIND commit(s) from origin/$BRANCH"
git pull --ff-only origin "$BRANCH" 2>&1 | tail -n 5 || fail "pull failed (non fast-forward?)"
echo "📌 Now at: $(git log -1 --format='%h %s')"

# 4. Backend build
set_phase "build-backend" "Building Go backend"
cd "$REPO_DIR/backend"
go build -tags sqlite_fts5 -o homeflix-backend . 2>&1 | tail -n 5 || fail "backend build failed"
echo "✅ Backend built"
cd "$REPO_DIR"

# 5. Frontend build
set_phase "build-frontend" "Building Next.js frontend (takes a few minutes)"
cd "$REPO_DIR/frontend"
npm run build 2>&1 | tail -n 8 || fail "frontend build failed"
echo "✅ Frontend built"
cd "$REPO_DIR"

# 6. Restart (skipped in dry-run so the running server is untouched)
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "✅ Dry run complete - restart skipped"
  set_phase "done" "Dry run complete ($BEHIND commit(s) pulled and built, restart skipped)" "done"
  exit 0
fi
set_phase "restart" "Restarting services"
bash "$REPO_DIR/stop.sh" >/dev/null 2>&1
bash "$REPO_DIR/scripts/stop-service.sh" >/dev/null 2>&1
sleep 6
pkill -f "next-server" 2>/dev/null || true
sleep 2
bash "$REPO_DIR/start.sh" 2>&1 | tail -n 6
set_phase "done" "Update complete - services restarted on $(git log -1 --format='%h %s')" "done"
echo "🎉 Update complete"
