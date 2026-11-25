#!/usr/bin/env bash
# Test for how scripts/agent.sh reads a brief (AGENT_DRY=1 starts no agent), and that the trust write is opt-in.
set -uo pipefail
cd "$(dirname "$0")/.."
DIR="$(pwd)"
DIRROOT="tests/_tmp/brief"
rm -rf "$DIRROOT" && mkdir -p "$DIRROOT/root" "$DIRROOT/home" "$DIRROOT/project-a"
export ROOFLOW_ROOT="$DIR/$DIRROOT/root"
FAIL=0
ok() { if [ "$1" = "0" ]; then echo "OK   $2"; else echo "FAIL $2"; FAIL=1; fi; }

printf '# Heading\n\nProject: x.\n\n---\nDo this.\nLine two.\n' > "$DIRROOT/with.md"
OUT="$(AGENT_DRY=1 bash scripts/agent.sh "$DIRROOT/with.md" "$DIRROOT/project-a" sonnet auto 2>/dev/null)"
[ "$OUT" = "$(printf 'Do this.\nLine two.')" ]; ok $? "with ---: only the text under the line"

printf 'You are an agent.\nDo this.\n' > "$DIRROOT/without.md"
OUT="$(AGENT_DRY=1 bash scripts/agent.sh "$DIRROOT/without.md" "$DIRROOT/project-a" sonnet auto 2>/dev/null)"
[ "$OUT" = "$(printf 'You are an agent.\nDo this.')" ]; ok $? "without ---: the whole file"

printf '# Heading\n\n---\n\n   \n' > "$DIRROOT/empty.md"
AGENT_DRY=1 bash scripts/agent.sh "$DIRROOT/empty.md" "$DIRROOT/project-a" sonnet auto >/dev/null 2>&1
[ $? -ne 0 ]; ok $? "empty prompt: error code, no agent"

# Full path with a fake CLI: root and log come from ROOFLOW_ROOT, the trust write is skipped by default.
cat > "$DIRROOT/fake-claude.sh" <<'FAKE'
#!/usr/bin/env bash
echo '{"type":"result","result":"fake","session_id":"abc","total_cost_usd":0}'
FAKE
chmod +x "$DIRROOT/fake-claude.sh"
printf '{"format":1,"claudeCli":"%s"}\n' "$DIR/$DIRROOT/fake-claude.sh" > "$DIRROOT/root/rooflow.json"
HOME="$DIR/$DIRROOT/home" USERPROFILE="$DIR/$DIRROOT/home" bash scripts/agent.sh "$DIRROOT/with.md" "$DIR/$DIRROOT/project-a" sonnet auto >/dev/null 2>&1
[ -f "$DIRROOT/root/status/logg/with.jsonl" ]; ok $? "the log is written under <root>/status/logg"
[ ! -e "$DIRROOT/home/.claude.json" ]; ok $? "trust write is NOT performed by default"

printf '{"format":1,"claudeCli":"%s","trustAgentFolders":true}\n' "$DIR/$DIRROOT/fake-claude.sh" > "$DIRROOT/root/rooflow.json"
printf '{}' > "$DIRROOT/home/.claude.json"
HOME="$DIR/$DIRROOT/home" USERPROFILE="$DIR/$DIRROOT/home" bash scripts/agent.sh "$DIRROOT/with.md" "$DIR/$DIRROOT/project-a" sonnet auto >/dev/null 2>&1
ok $? "agent.sh: a second run of the same brief (its old log has a result line) succeeds"
grep -q hasTrustDialogAccepted "$DIRROOT/home/.claude.json"; ok $? "trustAgentFolders: true writes the trust entry (to the temporary HOME only)"

# A "claude" that answers nothing (the desktop app on PATH did that): ERROR and exit 1, not a silent success.
printf '#!/usr/bin/env bash\nexit 0\n' > "$DIRROOT/silent-claude.sh"
chmod +x "$DIRROOT/silent-claude.sh"
printf '{"format":1,"claudeCli":"%s"}\n' "$DIR/$DIRROOT/silent-claude.sh" > "$DIRROOT/root/rooflow.json"
ERR="$(HOME="$DIR/$DIRROOT/home" USERPROFILE="$DIR/$DIRROOT/home" bash scripts/agent.sh "$DIRROOT/with.md" "$DIR/$DIRROOT/project-a" sonnet auto 2>&1 >/dev/null)"
CODE=$?
[ "$CODE" -ne 0 ] && printf '%s' "$ERR" | grep -q 'ERROR: the agent gave no result'; ok $? "agent.sh: no new result line in the log is an ERROR with exit 1"
grep -q '"report":"unreported"' "$DIRROOT/root/status/journal.jsonl"; ok $? "agent.sh: the run is still written to the journal as unreported"
echo '{"type":"result","result":"earlier run","session_id":"abc"}' > "$DIRROOT/root/status/logg/with.jsonl"
ERR="$(bash scripts/agent-resume.sh "$DIRROOT/root/status/logg/with.jsonl" "$DIR/$DIRROOT/project-a" "go on" 2>&1 >/dev/null)"
CODE=$?
[ "$CODE" -ne 0 ] && printf '%s' "$ERR" | grep -q 'ERROR: the agent gave no result'; ok $? "agent-resume.sh: an old result line in the log does not count, only a new one"
printf '{"format":1,"claudeCli":"%s"}\n' "$DIR/$DIRROOT/fake-claude.sh" > "$DIRROOT/root/rooflow.json"
bash scripts/agent-resume.sh "$DIRROOT/root/status/logg/with.jsonl" "$DIR/$DIRROOT/project-a" "go on" >/dev/null 2>&1
ok $? "agent-resume.sh: a resume that adds a result line succeeds"

# A project whose category has machine lives on another computer: agent.sh and agent-resume.sh refuse it before the CLI runs.
mkdir -p "$DIRROOT/Far-Away"
printf '| Folder | Category | Own repo | Remote | State | Comment |\n|---|---|---|---|---|---|\n| Far-Away | Hemma | yes | no | now | |\n| project-a | jobb | yes | no | now | |\n' > "$DIRROOT/root/projects.md"
printf '{"format":1,"claudeCli":"%s","categories":{"work":{"label":"jobb"},"home":{"label":"hemma","machine":"Other-PC","private":true}}}\n' "$DIR/$DIRROOT/fake-claude.sh" > "$DIRROOT/root/rooflow.json"
rm -f "$DIRROOT/root/status/logg/with.jsonl"
ERR="$(bash scripts/agent.sh "$DIRROOT/with.md" "$DIR/$DIRROOT/Far-Away" sonnet auto 2>&1 >/dev/null)"
CODE=$?
[ "$CODE" = 3 ] && printf '%s' "$ERR" | grep -q 'lives on Other-PC'; ok $? "agent.sh: a machine project (label matched case-insensitively) is refused with exit 3"
[ ! -f "$DIRROOT/root/status/logg/with.jsonl" ]; ok $? "agent.sh: no log for a refused machine project"
echo '{"type":"result","result":"earlier run","session_id":"abc"}' > "$DIRROOT/root/status/logg/far.jsonl"
bash scripts/agent-resume.sh "$DIRROOT/root/status/logg/far.jsonl" "$DIR/$DIRROOT/Far-Away" "go on" >/dev/null 2>&1
[ $? = 3 ]; ok $? "agent-resume.sh: a machine project is refused with exit 3"
bash scripts/agent.sh "$DIRROOT/with.md" "$DIR/$DIRROOT/project-a" sonnet auto >/dev/null 2>&1
ok $? "agent.sh: a project in a category without machine still starts"

rm -rf "$DIRROOT"
[ $FAIL = 0 ] && echo "All OK" || { echo "Some test failed"; exit 1; }
