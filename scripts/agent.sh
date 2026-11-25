#!/usr/bin/env bash
# Starts a project agent headless (claude -p) in the project's folder, in auto mode, log to file.
# Usage: scripts/agent.sh <promptfile> <projectfolder> [model] [permission-mode]
#   promptfile      file in briefs/: everything under the first "---" is sent as the prompt
#   projectfolder   e.g. /path/to/project-a
#   model           sonnet (default) | opus | haiku
#   permission-mode auto (default) | acceptEdits
#
# Run it from the RooFlow session with the Bash tool and run_in_background: true. The log goes to
# <root>/status/logg/<name>.jsonl (stream-json). The last line is the result.
#
# Settings (rooflow.json): "claudeCli" (path to the claude CLI; without it scripts/claude-cli.js finds the CLI) and
# "trustAgentFolders" (true: mark the project folder as trusted in ~/.claude.json, default false).
#
# Why not `claude --bg`: it puts the session in its own worktree from the wrong base and asks questions
# in a terminal nobody sees. `-p` runs in the folder, without a worktree, and auto mode answers.
#
# Important: the prompt must come BEFORE the flags. --add-dir and --allowedTools take several
# values and would otherwise eat the prompt.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPTFILE="${1:?promptfile missing}"
FOLDER="${2:?project folder missing}"
MODEL="${3:-sonnet}"
MODE="${4:-auto}"

# A brief usually has a heading and a line "---" before the prompt. Without the line the whole file is the prompt
# (a brief without --- once started no agent, and the error was invisible behind a pipe).
if grep -q '^---$' "$PROMPTFILE"; then
  PROMPT="$(sed -n '/^---$/,$p' "$PROMPTFILE" | tail -n +2)"
else
  PROMPT="$(cat "$PROMPTFILE")"
  echo "Note: no '---' line in $PROMPTFILE, the whole file is used as the prompt." >&2
fi
if [ -z "$(printf '%s' "$PROMPT" | tr -d '[:space:]')" ]; then
  echo "ERROR: empty prompt in $PROMPTFILE, no agent started." >&2
  exit 1
fi
# AGENT_DRY=1 only prints the prompt (tests/test-agent-brief.sh).
if [ "${AGENT_DRY:-}" = "1" ]; then
  printf '%s\n' "$PROMPT"
  exit 0
fi

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

# Opt-in: the folder must be marked as trusted in ~/.claude.json, otherwise the CLI refuses.
if [ "$(node "$DIR/root.js" config trustAgentFolders)" = "true" ]; then
  node -e '
const fs=require("fs"),os=require("os"),path=require("path");const p=path.join(os.homedir(),".claude.json");
const j=JSON.parse(fs.readFileSync(p,"utf8"));j.projects=j.projects||{};
const k=process.argv[1].split(String.fromCharCode(92)).join("/");
if(!(j.projects[k]||{}).hasTrustDialogAccepted){
  j.projects[k]=Object.assign({},j.projects[k]||{},{hasTrustDialogAccepted:true});
  fs.writeFileSync(p,JSON.stringify(j,null,2));console.log("trust set for "+k);}
' "$FOLDER"
fi

NAME="$(basename "$PROMPTFILE" .md)"
LOG="$ROOT/status/logg/${NAME}.jsonl"
mkdir -p "$ROOT/status/logg"

cd "$FOLDER"
echo "Starting agent in $FOLDER ($MODEL, $MODE). Log: $LOG"
# A run that writes no "type":"result" line to the log gave no answer: the CLI died or was not the CLI.
# The log is written anew below (>), so a line from an earlier run with the same brief does not count.
RESULT_BEFORE=0
STATUS=0
"$CLAUDE" "$PROMPT" \
  -p --verbose --output-format stream-json \
  --model "$MODEL" \
  --permission-mode "$MODE" \
  --add-dir "$ROOT" \
  > "$LOG" 2>&1 || STATUS=$?
# The journal is written even when the run failed: without a REPORT in the final answer the row becomes "unreported".
ROOFLOW_ROOT="$ROOT" node "$DIR/journal.js" "$LOG" "$NAME" || true
RESULT_AFTER="$(grep -c '"type":"result"' "$LOG" 2>/dev/null || true)"
if [ "${RESULT_AFTER:-0}" -le "${RESULT_BEFORE:-0}" ]; then
  echo "ERROR: the agent gave no result (no new \"type\":\"result\" line in $LOG, exit code $STATUS). Is '$CLAUDE' the Claude Code CLI?" >&2
  exit 1
fi
echo "Agent done (exit code $STATUS). Result:"
grep -o '"result":"[^"]\{0,800\}' "$LOG" | tail -1
grep -o '"total_cost_usd":[0-9.]*\|"num_turns":[0-9]*\|"duration_ms":[0-9]*' "$LOG" | tail -3
