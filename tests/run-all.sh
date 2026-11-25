#!/usr/bin/env bash
# Runs every test. Ends with "All OK" or exits non-zero.
#
# The mod's tests and the manifest check need the Claude Code CLI: `claude plugin test` and `claude plugin validate`.
# It is found as $CLAUDE_CLI, otherwise the newest CLI the desktop app has downloaded (Windows), otherwise `claude` on the PATH.
# The `claude` the desktop app puts on the PATH is not the CLI: it prints nothing for plugin commands. The run therefore also
# fails when the output holds no pass line, so a CLI that does nothing can never give "All OK".
set -uo pipefail
cd "$(dirname "$0")/.."
FAILED=0
for t in tests/test-*.js; do
  echo "== $t"
  node "$t" || { echo "FAILED: $t"; FAILED=1; }
done
for t in tests/test-*.sh; do
  echo "== $t"
  bash "$t" || { echo "FAILED: $t"; FAILED=1; }
done

CLI="${CLAUDE_CLI:-}"
if [ -z "$CLI" ] && [ -n "${APPDATA:-}" ]; then
  for c in "$(cygpath -u "$APPDATA" 2>/dev/null)"/Claude/claude-code/*/*/claude.exe; do [ -x "$c" ] && CLI="$c"; done
fi
CLI="${CLI:-claude}"
# The CLI wants a drive-letter path on Windows (C:/...), which pwd -W gives in Git Bash.
HERE="$(pwd -W 2>/dev/null || pwd)"
if ! command -v "$CLI" >/dev/null 2>&1 && [ ! -x "$CLI" ]; then
  echo "FAILED: the Claude Code CLI was not found (looked for '$CLI'). Put it on the PATH or set CLAUDE_CLI to its full path."
  FAILED=1
else
  echo "== $CLI plugin test (the mod: hooks/ and tests/*.test.ts*)"
  OUT="$("$CLI" plugin test "$HERE" 2>&1)"; CODE=$?
  printf '%s\n' "$OUT" | grep -v 'ERROR:\(net\|gpu\)' | tail -n 4
  if [ "$CODE" = 0 ] && printf '%s\n' "$OUT" | grep -q ' 0 fail'; then :; else
    echo "FAILED: plugin test (exit $CODE, or no '0 fail' line: is '$CLI' the Claude Code CLI?)"; FAILED=1
  fi
  echo "== $CLI plugin validate"
  OUT="$("$CLI" plugin validate "$HERE" 2>&1)"; CODE=$?
  printf '%s\n' "$OUT" | grep -v 'ERROR:\(net\|gpu\)' | grep -i 'validation' | head -n 3
  if [ "$CODE" = 0 ] && printf '%s\n' "$OUT" | grep -q 'Validation passed'; then :; else
    echo "FAILED: plugin validate (exit $CODE, or no 'Validation passed' line)"; FAILED=1
  fi
fi

rm -rf tests/_tmp
if [ "$FAILED" = 0 ]; then echo "All OK"; else echo "Some tests failed"; exit 1; fi
