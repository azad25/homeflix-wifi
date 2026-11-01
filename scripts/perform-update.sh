#!/bin/bash
# HomeFlix safe self-update: pull (or switch release branch) -> build backend
# -> build frontend -> restart.
# Launched detached by POST /api/admin/update/apply (see update_handlers.go).
# Progress: .update-status.json (polled by Settings UI), details: update-log.txt
# (not *.log: start.sh wipes *.log in the repo root during the restart step)
#
# Usage: scripts/perform-update.sh [--dry-run] [--branch release/vX.Y]
#   --dry-run          build but skip the restart
#   --branch <name>    switch to another release branch (e.g. release/v5.5)
set -u
# Without pipefail, `cmd | tail || fail` only sees tail's exit status, so a
# failed fetch/pull/build would silently continue on to the restart.
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Run from a private copy: `git pull` / `git checkout` rewrite this file, and
# bash reads scripts incrementally, so editing it mid-run corrupts execution.
if [[ -z "${HOMEFLIX_UPDATE_COPY:-}" ]]; then
  COPY="$(mktemp "${TMPDIR:-/tmp}/homeflix-update.XXXXXX")" || exit 1
  cp "$0" "$COPY"
  export HOMEFLIX_UPDATE_COPY="$COPY" HOMEFLIX_REPO_DIR="$REPO_DIR"
  exec bash "$COPY" "$@"
fi
REPO_DIR="${HOMEFLIX_REPO_DIR:-$REPO_DIR}"
trap 'rm -f "$HOMEFLIX_UPDATE_COPY"' EXIT
cd "$REPO_DIR" || exit 1

STATUS_FILE="$REPO_DIR/.update-status.json"
DRY_RUN=0
TARGET_BRANCH=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --branch) TARGET_BRANCH="${2:-}"; shift ;;
    *) echo "unknown argument: $1" ;;
  esac
  shift
done

set_phase() { # $1=phase $2=message [$3=state]
  local state="${3:-running}"
  # Values go through argv (never interpolated into code) so quotes or
  # backslashes in commit subjects can't break or inject into the JSON.
  # pid lets the server tell a live job from one that died mid-run.
  python3 -c 'import json, sys
state, phase, msg, dry, path, pid, branch = sys.argv[1:8]
with open(path, "w") as f:
    json.dump({"state": state, "phase": phase, "message": msg, "dry_run": dry == "1", "pid": int(pid), "branch": branch}, f)' \
    "$state" "$1" "$2" "$DRY_RUN" "$STATUS_FILE" "$$" "$TARGET_BRANCH" 2>/dev/null || {
    local esc=${2//\\/\\\\}; esc=${esc//\"/\\\"}
    printf '{"state":"%s","phase":"%s","message":"%s","dry_run":%s,"pid":%d}\n' \
      "$state" "$1" "$esc" "$([[ $DRY_RUN -eq 1 ]] && echo true || echo false)" "$$" > "$STATUS_FILE"
  }
}

# Set once the checkout has moved; failures after that roll back.
OLD_BRANCH=""
OLD_HEAD=""
CODE_CHANGED=0

rollback() {
  [[ "$CODE_CHANGED" -eq 1 ]] || return 0
  echo "↩️ Rolling back to $OLD_BRANCH @ ${OLD_HEAD:0:12}"
  set_phase "rollback" "Update failed - restoring $OLD_BRANCH (rebuilding, a few minutes)"
  git checkout -q "$OLD_BRANCH" 2>/dev/null && git reset -q --hard "$OLD_HEAD" 2>/dev/null || {
    echo "⚠️ Automatic rollback failed - run: git checkout $OLD_BRANCH && git reset --hard $OLD_HEAD"
    return 1
  }
  # The frontend build output may be half-written: rebuild the old version so
  # the next restart (or the running server) has a consistent build.
  (cd "$REPO_DIR/frontend" && npm run build 2>&1 | tail -n 3) || echo "⚠️ Rebuilding the previous frontend failed"
  CODE_CHANGED=0
}

fail() {
  echo "❌ $1"
  if [[ "$CODE_CHANGED" -eq 1 ]]; then
    rollback && set_phase "failed" "$1 - rolled back to $OLD_BRANCH, nothing was restarted" "error" && exit 1
  fi
  set_phase "failed" "$1" "error"
  exit 1
}

echo "=============================================="
echo "🚀 HomeFlix system update started $(date '+%Y-%m-%d %H:%M:%S') (dry_run=$DRY_RUN${TARGET_BRANCH:+, switch to $TARGET_BRANCH})"
set_phase "preflight" "Checking repository state"

export GIT_TERMINAL_PROMPT=0
command -v git >/dev/null || fail "git is not installed"
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || fail "not a git repository"
[[ "$BRANCH" == "HEAD" ]] && fail "detached HEAD - checkout a branch first"
OLD_BRANCH="$BRANCH"
OLD_HEAD=$(git rev-parse HEAD)
echo "📌 Branch: $BRANCH"
echo "📌 Current: $(git log -1 --format='%h %ci %s')"

if [[ -n "$TARGET_BRANCH" ]]; then
  [[ "$TARGET_BRANCH" =~ ^release/v[0-9]+(\.[0-9]+)*$ ]] || fail "invalid release branch: $TARGET_BRANCH"
fi

# 1. Preflight: refuse on local modifications (tracked files only;
#    ignored DBs/binaries/logs can never block an update)
DIRTY=$(git status --porcelain | grep -v '^??' || true)
if [[ -n "$DIRTY" ]]; then
  echo "⚠️ Local modifications detected:"
  echo "$DIRTY"
  fail "local changes present - commit or stash them, then retry"
fi

if [[ -n "$TARGET_BRANCH" && "$TARGET_BRANCH" != "$BRANCH" ]]; then
  # 2a. Switch to another release branch
  set_phase "switch" "Switching from $BRANCH to $TARGET_BRANCH"
  # Single-branch / shallow clones (`git clone --depth 1 -b release/v5`) only
  # know about their own branch: register the target in the fetch config so
  # it can be tracked and pulled by later updates, then fetch it explicitly.
  FETCH_SPEC="+refs/heads/$TARGET_BRANCH:refs/remotes/origin/$TARGET_BRANCH"
  if ! git config --get-all remote.origin.fetch | grep -qxF -e "$FETCH_SPEC" -e "+refs/heads/*:refs/remotes/origin/*"; then
    git config --add remote.origin.fetch "$FETCH_SPEC"
    echo "📌 Added $TARGET_BRANCH to this clone's fetch config (single-branch clone)"
  fi
  git fetch origin "+refs/heads/$TARGET_BRANCH:refs/remotes/origin/$TARGET_BRANCH" 2>&1 | tail -n 3 || fail "cannot fetch $TARGET_BRANCH from origin"
  git rev-parse --verify -q "origin/$TARGET_BRANCH" >/dev/null || fail "origin/$TARGET_BRANCH not found after fetch"
  if git show-ref --verify --quiet "refs/heads/$TARGET_BRANCH"; then
    AHEAD=$(git rev-list --count "origin/$TARGET_BRANCH..$TARGET_BRANCH")
    [[ "$AHEAD" -gt 0 ]] && fail "local $TARGET_BRANCH has $AHEAD unpushed commit(s) - resolve manually"
    CODE_CHANGED=1
    git checkout -q "$TARGET_BRANCH" 2>&1 | tail -n 3 || fail "checkout $TARGET_BRANCH failed"
    git merge -q --ff-only "origin/$TARGET_BRANCH" 2>&1 | tail -n 3 || fail "could not fast-forward $TARGET_BRANCH"
  else
    CODE_CHANGED=1
    git checkout -q -b "$TARGET_BRANCH" --track "origin/$TARGET_BRANCH" 2>&1 | tail -n 3 || fail "checkout $TARGET_BRANCH failed"
  fi
  BRANCH="$TARGET_BRANCH"
  SUMMARY="switched to $TARGET_BRANCH"
else
  # 2b. Fetch + compare (auto-discover remote state)
  git fetch origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH" 2>&1 | tail -n 3 || fail "cannot reach origin - check network"
  BEHIND=$(git rev-list --count "HEAD..origin/$BRANCH")
  AHEAD=$(git rev-list --count "origin/$BRANCH..HEAD")
  echo "📌 Behind: $BEHIND, Ahead: $AHEAD"
  [[ "$AHEAD" -gt 0 ]] && fail "local branch is $AHEAD commit(s) ahead - push or reset first"
  [[ "$BEHIND" -eq 0 ]] && { echo "✅ Already up to date"; set_phase "done" "Already up to date" "done"; exit 0; }

  # 3. Pull (fast-forward only - never merges, never touches ignored DBs)
  set_phase "pull" "Pulling $BEHIND commit(s) from origin/$BRANCH"
  CODE_CHANGED=1
  git merge -q --ff-only "origin/$BRANCH" 2>&1 | tail -n 5 || fail "pull failed (non fast-forward?)"
  SUMMARY="$BEHIND commit(s) pulled"
fi
echo "📌 Now at: $BRANCH $(git log -1 --format='%h %s')"

# 4. Dependencies: reinstall frontend packages only when they changed
if ! git diff --quiet "$OLD_HEAD" HEAD -- frontend/package.json frontend/package-lock.json; then
  set_phase "dependencies" "Installing frontend dependencies"
  (cd "$REPO_DIR/frontend" && npm install --no-audit --no-fund 2>&1 | tail -n 5) || fail "npm install failed"
  echo "✅ Dependencies installed"
fi

# 5. Backend build
set_phase "build-backend" "Building Go backend"
cd "$REPO_DIR/backend"
go build -tags sqlite_fts5 -o homeflix-backend . 2>&1 | tail -n 5 || fail "backend build failed"
echo "✅ Backend built"
cd "$REPO_DIR"

# 6. Frontend build
set_phase "build-frontend" "Building Next.js frontend (takes a few minutes)"
cd "$REPO_DIR/frontend"
npm run build 2>&1 | tail -n 8 || fail "frontend build failed"
echo "✅ Frontend built"
cd "$REPO_DIR"
CODE_CHANGED=0 # builds succeeded: keep the new code from here on

# 7. Restart (skipped in dry-run so the running server is untouched)
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "✅ Dry run complete - restart skipped"
  set_phase "done" "Dry run complete ($SUMMARY and built, restart skipped)" "done"
  exit 0
fi
set_phase "restart" "Restarting services"
bash "$REPO_DIR/stop.sh" >/dev/null 2>&1
bash "$REPO_DIR/scripts/stop-service.sh" >/dev/null 2>&1
sleep 6
pkill -f "next-server" 2>/dev/null || true
sleep 2
bash "$REPO_DIR/start.sh" 2>&1 | tail -n 6
set_phase "done" "Update complete ($SUMMARY) - services restarted on $BRANCH $(git log -1 --format='%h %s')" "done"
echo "🎉 Update complete"
