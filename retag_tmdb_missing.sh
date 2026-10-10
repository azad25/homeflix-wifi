#!/bin/bash
# Retag movies missing TMDB info using exact title + year matching.
# Uses existing backend routes only:
#   GET  /api/tmdb/search?q=<title>&type=movie   (search)
#   POST /api/admin/media/<id>/update-with-tmdb  (apply, body {"tmdbId": N})
#
# Usage:
#   ./retag_tmdb_missing.sh [--live] [--loose] [--limit N] [--id ID] [--api URL] [--db PATH]
#   Default is DRY-RUN (search + match, no changes). Pass --live to apply.
#   --loose allows same-year non-exact title matches (still skipped in strict mode).
#   Results appended to retag_tmdb_missing.<timestamp>.csv
set -u
cd "$(dirname "${BASH_SOURCE[0]}")"

API="http://localhost:8252"
DB="backend/homeflix.db"
LIVE=0
LOOSE=0
LIMIT=0
ONLY_ID=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --live) LIVE=1; shift;;
    --loose) LOOSE=1; shift;;
    --limit) LIMIT="$2"; shift 2;;
    --id) ONLY_ID="$2"; shift 2;;
    --api) API="$2"; shift 2;;
    --db) DB="$2"; shift 2;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

command -v sqlite3 >/dev/null || { echo "sqlite3 required"; exit 1; }
command -v python3 >/dev/null || { echo "python3 required"; exit 1; }
command -v curl >/dev/null || { echo "curl required"; exit 1; }

LOG="retag_tmdb_missing.$(date +%Y%m%d_%H%M%S).csv"
echo "media_id,title,year,query,matched_tmdb_id,matched_title,matched_year,mode,status" > "$LOG"

WHERE="type='movie' AND deleted_at IS NULL AND (tmdb_id IS NULL OR tmdb_id=0)"
[[ -n "$ONLY_ID" ]] && WHERE="$WHERE AND id=$ONLY_ID"
# Exclude ids already applied by previous --live runs (backend route doesn't
# stamp tmdb_id, so track them here until that gap is fixed)
APPLIED_LOG="retag_tmdb_missing.applied.log"
if [[ -f "$APPLIED_LOG" ]]; then
  DONE=$(grep -o '^[0-9]*' "$APPLIED_LOG" 2>/dev/null | paste -sd, -)
  [[ -n "$DONE" ]] && WHERE="$WHERE AND id NOT IN ($DONE)"
fi
Q="SELECT id, title, IFNULL(year,0) FROM media WHERE $WHERE ORDER BY id;"
# NOTE: LIMIT 0 means no limit
if [[ "$LIMIT" -gt 0 ]]; then
  Q="SELECT id, title, IFNULL(year,0) FROM media WHERE $WHERE ORDER BY id LIMIT $LIMIT;"
else
  Q="SELECT id, title, IFNULL(year,0) FROM media WHERE $WHERE ORDER BY id;"
fi

TOTAL=$(sqlite3 "file:$DB?mode=ro" "SELECT COUNT(*) FROM media WHERE $WHERE;")
echo "Candidates (movies, active, no tmdb_id): $TOTAL | mode: $([[ $LIVE -eq 1 ]] && echo LIVE || echo DRY-RUN) | loose: $LOOSE"
[[ $LIVE -eq 0 ]] && echo "(pass --live to apply updates)"

n=0; auto=0; review=0; applied=0; failed=0
while IFS='|' read -r mid mtitle myear; do
  [[ -z "$mid" ]] && continue
  n=$((n+1))
  # --- search + match in python (title cleaning, exact+year scoring) ---
  out=$(MTITLE="$mtitle" MYEAR="$myear" API="$API" LOOSE="$LOOSE" python3 - <<'EOF'
import difflib
import json, os, re, urllib.parse, urllib.request
title = os.environ.get("MTITLE", "")
try: year = int(os.environ.get("MYEAR", "0") or 0)
except Exception: year = 0
api = os.environ.get("API", "http://localhost:8252")
loose = os.environ.get("LOOSE", "0") == "1"

def norm(s):
    return re.sub(r'[^a-z0-9]', '', (s or '').lower())

def to_int(v):
    try: return int(v)
    except Exception: return 0

def to_year(v):
    s = str(v or "")[:4]
    return int(s) if s.isdigit() else 0

# clean query: drop trailing "(YYYY)" / " YYYY" / quality-ish suffixes
q = re.sub(r'[\(\[]?\b(19|20)\d{2}\b[\)\]]?\s*$', '', title).strip()
if not q:
    q = title
if year <= 1900 or year > 2030:
    m = re.search(r'\b((?:19|20)\d{2})\b', title)
    year = int(m.group(1)) if m else 0

url = api + "/api/tmdb/search?q=" + urllib.parse.quote(q) + "&type=movie"
try:
    with urllib.request.urlopen(url, timeout=20) as r:
        data = json.load(r)
except Exception:
    print("|||0||review|%s" % q)
    raise SystemExit
raw = data.get("results", []) or []
results = [x for x in raw if isinstance(x, dict)]
nt, nq = norm(title), norm(q)
cands = []  # (res, ry) exact title matches
for res in results:
    rt = norm(res.get("title", "")) or norm(res.get("original_title", ""))
    ry = to_year(res.get("release_date", ""))
    if rt and (rt == nt or rt == nq):
        cands.append((res, ry))
pick, mode = None, "review"
if cands:
    # prefer exact year, tie-break by vote_count (avoids wrong-language dupes)
    scored = []
    for res, ry in cands:
        try: votes = float(res.get("vote_count", 0) or 0)
        except Exception: votes = 0
        scored.append(((ry == year) if year else False, votes, res, ry))
    scored.sort(key=lambda t: (t[0], t[1]), reverse=True)
    best_year, _, res, ry = scored[0][0], scored[0][1], scored[0][2], scored[0][3]
    if best_year:
        pick, mode = (res, ry), "exact+year"
    elif not year or (ry and abs(ry - year) <= 1):
        pick, mode = (res, ry), "exact-title"
if pick is None and results:
    # fuzzy title tier (typos like "Hollows" vs "Hallows"), year must match
    names = {}
    for res in results:
        for key in (res.get("title", ""), res.get("original_title", "")):
            if key and norm(key) not in names:
                names[norm(key)] = res
    close = difflib.get_close_matches(nq or nt, list(names.keys()), n=1, cutoff=0.85)
    if close and year:
        res = names[close[0]]
        if to_year(res.get("release_date", "")) == year:
            pick, mode = (res, year), "fuzzy-title"
if pick is None and loose and year:
    for res in results:
        if to_year(res.get("release_date", "")) == year:
            pick, mode = (res, year), "loose-year"
            break
if pick:
    res, ry = pick
    tid = to_int(res.get("id", 0))
    ttitle = (str(res.get("title", "") or "").replace("|", " "))
    print("%d|%s|%d|%s|%s" % (tid, ttitle, to_int(ry), mode, q))
else:
    print("|||0|review|%s" % q)
EOF
)
  tmdb_id=$(echo "$out" | cut -d'|' -f1)
  tmdb_title=$(echo "$out" | cut -d'|' -f2)
  tmdb_year=$(echo "$out" | cut -d'|' -f3)
  mode=$(echo "$out" | cut -d'|' -f4)
  clean_q=$(echo "$out" | cut -d'|' -f5)
  [[ -z "$clean_q" || "$clean_q" == "$out" ]] && clean_q="$mtitle"
  safe_title=$(echo "$mtitle" | tr '|' ' ' | tr ',' ' ')
  safe_tmdb=$(echo "$tmdb_title" | tr '|' ' ' | tr ',' ' ')

  if [[ "$mode" == "review" || -z "$tmdb_id" ]]; then
    echo "[$n] REVIEW  id=$mid year=$myear :: $safe_title"
    echo "$mid,\"$safe_title\",$myear,\"$clean_q\",,,,$mode,needs-review" >> "$LOG"
    review=$((review+1))
  else
    auto=$((auto+1))
    if [[ $LIVE -eq 1 ]]; then
      resp=$(curl -s --max-time 30 -X POST "$API/api/admin/media/$mid/update-with-tmdb" \
        -H 'Content-Type: application/json' -d "{\"tmdbId\": $tmdb_id}" 2>&1 | head -c 300)
      if echo "$resp" | grep -q "Media updated successfully"; then
        echo "[$n] APPLIED id=$mid -> TMDB $tmdb_id ($safe_tmdb, $tmdb_year)"
        echo "$mid,\"$safe_title\",$myear,\"$clean_q\",$tmdb_id,\"$safe_tmdb\",$tmdb_year,$mode,applied" >> "$LOG"
        echo "$mid:$tmdb_id" >> "retag_tmdb_missing.applied.log"
        applied=$((applied+1))
      else
        echo "[$n] FAILED id=$mid -> TMDB $tmdb_id ($safe_tmdb) :: $resp"
        echo "$mid,\"$safe_title\",$myear,\"$clean_q\",$tmdb_id,\"$safe_tmdb\",$tmdb_year,$mode,apply-failed" >> "$LOG"
        failed=$((failed+1))
      fi
      sleep 0.3
    else
      echo "[$n] MATCH  id=$mid -> TMDB $tmdb_id ($safe_tmdb, $tmdb_year) [$mode]"
      echo "$mid,\"$safe_title\",$myear,\"$clean_q\",$tmdb_id,\"$safe_tmdb\",$tmdb_year,$mode,dry-run" >> "$LOG"
    fi
  fi
  sleep 0.4  # be nice to TMDB rate limits
done < <(sqlite3 -separator '|' "file:$DB?mode=ro" "$Q")

echo "---- done: checked=$n auto-matched=$auto needs-review=$review applied=$applied failed=$failed | log=$LOG"
