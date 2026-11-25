#!/usr/bin/env bash
# Continues an earlier headless agent with a new instruction, with its whole context kept.
# Usage: scripts/agent-resume.sh <logfile-or-session-id> <projectfolder> "<instruction>" [model] [extra-dir]
#   logfile         status/logg/<name>.jsonl: the session id is read from the file
#   session-id      alternatively a uuid directly
#
# Cheaper and better than a new agent when the follow-up touches the same code: the files are already read.
# The log is written on in the same file (append) when a logfile was given.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="${1:?logfile or session id missing}"
FOLDER="${2:?project folder missing}"
INSTRUCTION="${3:?instruction missing}"
MODEL="${4:-sonnet}"
EXTRADIR="${5:-}"

ROOT="$(node "$DIR/root.js")" || exit 1
# A project whose category has machine in rooflow.json lives on another computer: its agents are started there, not here.
node "$DIR/categories.js" check-folder "$FOLDER" || exit $?
# The CLI, not the desktop app: scripts/claude-cli.js finds it from rooflow.json claudeCli, the npm CLI, ~/.local/bin or PATH.
CLAUDE="$(node "$DIR/claude-cli.js")" || { echo "ERROR: no Claude Code CLI found. Install it (npm) or set claudeCli in rooflow.json." >&2; exit 1; }
KIND="$(node "$DIR/claude-cli.js" --kind)"
if [ "$KIND" = "app" ]; then
  if [ -n "$(node "$DIR/root.js" config claudeCli)" ]; then
    echo "WARNING: claudeCli '$CLAUDE' looks like the desktop app, not the CLI. Used because rooflow.json names it." >&2
  else
    echo "ERROR: '$CLAUDE' is the desktop app, not the Claude Code CLI. Install the CLI or set claudeCli in rooflow.json." >&2
    exit 1
  fi
fi
case "$CLAUDE" in
  */*) [ -x "$CLAUDE" ] || { echo "ERROR: claudeCli '$CLAUDE' is not executable." >&2; exit 1; } ;;
  *) command -v "$CLAUDE" >/dev/null 2>&1 || { echo "ERROR: '$CLAUDE' not found on PATH. Install the Claude Code CLI or set claudeCli in rooflow.json." >&2; exit 1; } ;;
esac

# A log the cleaner moved to archive/cleaned-*/ is brought back first.
if [ ! -f "$SOURCE" ] && [[ "$SOURCE" == *.jsonl ]]; then
  node "$DIR/cleanup.js" --bring-back "$(basename "$SOURCE" .jsonl)" --commit || true
fi

if [ -f "$SOURCE" ]; then
  SID="$(grep -m1 -o '"session_id":"[^"]*"' "$SOURCE" | head -1 | cut -d'"' -f4 || true)"
  LOG="$(cd "$(dirname "$SOURCE")" && pwd)/$(basename "$SOURCE")"
else
  SID="$SOURCE"
  LOG="$ROOT/status/logg/resumed-${SID:0:8}.jsonl"
  mkdir -p "$ROOT/status/logg"
fi
[ -n "$SID" ] || { echo "Found no session_id" >&2; exit 1; }

cd "$FOLDER"
echo "Continuing session $SID in $FOLDER ($MODEL). Log: $LOG"
EXTRA=()
[ -n "$EXTRADIR" ] && EXTRA=(--add-dir "$EXTRADIR")
# A run that adds no "type":"result" line to the log gave no answer: the CLI died or was not the CLI.
RESULT_BEFORE="$(grep -c '"type":"result"' "$LOG" 2>/dev/null || true)"
STATUS=0
"$CLAUDE" "$INSTRUCTION" \
  -p --verbose --output-format stream-json \
  --resume "$SID" \
  --model "$MODEL" \
  --permission-mode auto \
  --add-dir "$ROOT" \
  "${EXTRA[@]}" \
  >> "$LOG" 2>&1 || STATUS=$?
# The same journal row agent.sh writes: without a REPORT in the final answer it becomes "unreported", so Radar sees the run.
ROOFLOW_ROOT="$ROOT" node "$DIR/journal.js" "$LOG" "$(basename "$LOG" .jsonl)" || true
RESULT_AFTER="$(grep -c '"type":"result"' "$LOG" 2>/dev/null || true)"
if [ "${RESULT_AFTER:-0}" -le "${RESULT_BEFORE:-0}" ]; then
  echo "ERROR: the agent gave no result (no new \"type\":\"result\" line in $LOG, exit code $STATUS). Is '$CLAUDE' the Claude Code CLI?" >&2
  exit 1
fi
echo "Agent done (exit code $STATUS). Result:"
grep -o '"result":"[^"]\{0,800\}' "$LOG" | tail -1
grep -o '"total_cost_usd":[0-9.]*\|"num_turns":[0-9]*\|"duration_ms":[0-9]*' "$LOG" | tail -3
