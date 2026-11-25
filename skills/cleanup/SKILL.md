---
name: cleanup
description: Tidy the notebook: move old finished status files, run logs, briefs, sketches and finished inbox lines to archive/cleaned-YYYY-MM. Run when the owner types /cleanup, "tidy up" or "clean the notebook".
---

# /cleanup

Nothing is deleted. Everything is moved to `archive/cleaned-YYYY-MM/` and logged in `archive/cleanup-log.jsonl`. Answer in the owner's
language (`language` in `rooflow.json`). Work from the notebook folder.

1. Run the dry run with Bash (one run, no subagent needed): `node ${CLAUDE_PLUGIN_ROOT}/scripts/cleanup.js`
2. Show the list to the owner word for word. Ask ONCE: move everything? (yes / no / yes except ...)
3. On yes: `node ${CLAUDE_PLUGIN_ROOT}/scripts/cleanup.js --run --commit`. If the owner names exceptions, add `--except <path>` for
   each (file or folder). On no: stop.
4. Report the count from the output and how to undo:
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/cleanup.js --restore <YYYY-MM-DD> --commit` (today's date), or `git revert <commit>`.

The rules (how many days before something is moved) are at the top of `scripts/cleanup.js`. `--all` lists all paths. The cleaner
never touches `promises.md`, `decisions.md`, `notes/`, `archive/` or the notebook's own `.claude/`.
