---
name: morning
description: Morning overview for the notebook's owner. Run when the owner types /morning or asks what is on today, which meetings there are, what was done yesterday or what to focus on.
---

# /morning

Give a morning overview of at most 15 lines. No introduction, no closing remarks. Answer in the owner's language
(`language` in `rooflow.json`, `sv` or `en`); use `name` from the same file if the owner has given one, otherwise say "you".
Work from the notebook folder; the scripts find it from there.

## Fetch

Everything under "Fetch" is done by ONE subagent through the Agent tool on the `routine` model (`models` in `rooflow.json`). Give it the numbered points below as its
task, word for word, and ask for raw facts in the same points, at most 20 lines. The expensive model only does "Show" and the
suggestion for focus. Before a command goes into a subagent's task, resolve `${CLAUDE_PLUGIN_ROOT}` to its absolute path (run `echo "$CLAUDE_PLUGIN_ROOT"` with Bash if
the text still shows the variable): the subagent does not see this skill. Log the subagent in `status/subagents.jsonl` (start and done, see the rules).
When `visibility.routine` in `rooflow.json` is `tree`, the same task goes to a session in the tree instead (the `agent` skill,
"Hidden or in the tree"), with the notebook as its folder; wait for it and read its answer.

1. **Calendar today.** Only if `addons.calendar` in `rooflow.json` is not `none`. Read
   `${CLAUDE_PLUGIN_ROOT}/skills/morning/calendar-outlook.md` when it is `outlook`. If the addon is off or the fetch fails, say so
   in one line and go on.
2. **Yesterday.** For every project in `projects.md` whose state is now, next or waiting: find its folder (`rooflow.json`
   `projects.<slug>.folder`, otherwise `<projectsDir>/<Folder>`, where `projectsDir` defaults to the folder that holds the
   notebook) and run `git log --since=yesterday --all --oneline` there. Skip folders that are not git repositories. Group per
   project, one line per project.
3. **Agents.** `node ${CLAUDE_PLUGIN_ROOT}/scripts/radar.js --quiet`, then read `status/radar.json`: agents that run, ask or
   wait, and the open decisions.
4. **Promises** in `promises.md` with a deadline within three days or passed.
5. **Open decisions** in `decisions.md` (under `## Open`).
6. **Inbox:** the number of unsorted lines in `inbox.md` (under `## Now`).

## Show

Meetings are always shown as a markdown table with the columns Time, Meeting, Where, With whom. No meetings (or no calendar
addon): one line "No meetings today".

```
Meetings: (table, see above)
Yesterday: ...
Agents: ...
Promises: ...
Decisions: ...
Inbox: N unsorted
Suggested focus: one line
```

End with a suggestion for today's focus, not a question.

**Backup:** if `backup.when` in `rooflow.json` is `day` and `backup.type` is `git` or `folder`, run the backup as `rooflow-setup`
describes under "Running the backup", after the overview is written, and add one line to the answer.

**Tidy the session tree.** Your own step after the overview, not the subagent's (a subagent cannot rename the session it runs in).
Only with the tools the app offers; skip what it does not offer without a word. Never retry a call the app or the owner declined:
write it in the line below and go on.

1. **Your own name.** When the owner started this run (not the scheduled job), rename this session to "RooFlow" with
   `set_session_title` (`session_id: "self"`), unless it already has that title.
2. **Other Tower sessions.** `list_sessions` (not archived). A Tower session is one whose `cwd` is the notebook folder. Archive
   (`archive_session`, with a short `reason`) each one that is not this session and where all of this holds: `isRunning` is false,
   it is not pinned, `remoteControlActive` is not true, its `lastActivityAt` is more than two hours ago, and it does not wait for
   the owner: if the app offers `list_events`, its last answer does not end in a question or a choice for the owner. When anything
   is unclear, leave the session.
3. **Finished agents in the tree.** `list_sessions` with `group: "RooFlow-agenter"`. Archive each one that is not running, is
   not pinned and whose status file `status/<task>.md` says `State: done` (or `stuck` with a final `REPORT` in
   `status/journal.jsonl`) with no `Needs:` line and no open B-id for its task. A session asking a question is never archived.
4. Add one line to the answer and to `status/morning.md`: "Archived: <titles>" (or "Archived: nothing"), and what was declined.

The app may ask the owner to approve each archive; in a scheduled run nobody may answer, and then the line says so.

**For the panel:** write the same overview to `status/morning.md`: the first line `Morning <weekday> <YYYY-MM-DD HH:MM> (/morning)`,
the meeting table, then the lines above. The panel's Today tab reads it; if it is not written, old meetings stay on show.

**Reminders with today's date:** lines in `inbox.md` and `promises.md` with today's date are shown first, before Meetings.

## Scheduled

This skill is also what a scheduled morning runs (the prompt is just "Run /morning."). Everything else lives here, so an update
of the plugin updates the scheduled job too. `/rooflow-setup` creates the schedule.
