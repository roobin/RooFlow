---
name: friday
description: End of the week for the notebook's owner. Run when the owner types /friday, says "the week in the rear mirror", "weekly wrap-up", or wants to round off the week.
---

# /friday

At most 25 lines in all. Answer in the owner's language (`language` in `rooflow.json`). Work from the notebook folder.

Points 1, 2, 3 (reading) and 8 (fetching) are mechanical: run them in ONE subagent through the Agent tool on the `routine` model (`models` in `rooflow.json`), which
answers with raw facts (log it in `status/subagents.jsonl`). You do the conversation (4, 5, 6) and the writing.

1. **The week:** `git log --since="7 days ago" --all --oneline` in the folder of every project in `projects.md` that is not
   parked (folders as in the `morning` skill). One line per project with the number of commits and the most important thing.
2. **Promises:** done this week, overdue, and what lies next week.
3. **Decisions:** decided this week (in `archive/decisions-YYYY-MM.md`), still open.
4. **Skills and instructions:** ask whether anything this week showed that a skill or a CLAUDE.md is missing, wrong or never used.
   Write the answer to `inbox.md`.
5. **One thought:** ask the owner for a theory or lesson about the work from the week. Write it to `notes/YYYY-MM-DD-<topic>.md`.
   If the owner has none: skip it.
6. **Radar:** one thing in Claude, Claude Code or the app that is new or unused and worth trying next week. One line, with why.
7. **Backup:** if `backup.type` in `rooflow.json` is empty, say once that the notebook has no backup choice and offer
   `/rooflow-setup`. If it is `none`, say in one line that the owner has chosen to have none. Otherwise run the backup as
   `rooflow-setup` describes under "Running the backup".
8. **Usage:** if the app offers `get_usage`, note this week's figure and compare with last Friday. Which agents drew most?
9. **The cleaner:** run `node ${CLAUDE_PLUGIN_ROOT}/scripts/cleanup.js` (dry run) and show the count: "The cleaner has N things to move, say /cleanup".
10. Update `handover.md`.

**The Done section:** move the lines under `## Done` in `inbox.md` to `archive/done-<YYYY>-w<week>.md` and empty the section.

**Reminders with today's date:** read lines in `inbox.md` and `promises.md` with today's date and take them up first.
