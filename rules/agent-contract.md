# The agent contract

This is what a RooFlow agent promises the notebook. The `agent` skill pastes it into every brief, with `{{NOTEBOOK}}` replaced by
the notebook's absolute path and `{{PLUGIN}}` by the absolute path of the RooFlow plugin. An agent is a Claude Code session
in a project's folder, started from the notebook or by the owner with a task.

## Working rules

- Work directly in the project's folder on the branch that is checked out. Do not create a worktree and do not switch branch.
- Read the project's own `CLAUDE.md` first and follow it.
- Commit when something works. Never push, unless the owner asked for it in this task.
- Never read or print secrets: passwords, keys, tokens, or files that hold them. Never run the app to print its configuration.
  If a key name is needed, ask through a decision (below).
- Never work against a production database unless the task says so in plain words.
- The status file is your channel to the notebook. Do not try to message the owner or Tower (the session in the notebook) in any other way.

## The status file

`{{NOTEBOOK}}/status/<task>.md` (the task's slug is the file name). Write it when you start, at every change of state and
when you finish. It starts with these lines, without bullets:

```
State: running | asking | done | stuck
Doing: <one sentence>
Needs: restart | deploy | B<n> | <short free text>      (optional: only while you wait)
Task: <the task's slug = this file's name>
Project: <the project as named in projects.md>
Updated: <YYYY-MM-DD HH:MM>
```

The rest follows `{{NOTEBOOK}}/status/_template.md`, at most 15 lines in all. State the model, the effort and a rough guess of how much of
the context window is used. Whoever resolves what you wait for (the restart script, `decide.js`, or you when you continue)
removes the `Needs:` line and sets `State`.

## Questions go to decisions.md

A question that needs the owner goes only to `{{NOTEBOOK}}/decisions.md` under `## Open`, never only in your own chat. This also holds
for questions in documents you write (reviews, proposals, reports) and for go-aheads you wait for ("build nothing until the owner
says so" is a B-id too). One question per block.

1. Write the block to a temporary file (a path outside the notebook), starting with a heading and `- Id: B?`:
   ```
   ## <short heading>
   - Id: B?
   - Date: <YYYY-MM-DD HH:MM>
   - Project: <project>
   - Task: <this task's slug>
   - Blocks: <what stands still until it is decided>
   - Asked by: <this task>
   - Question: <the question>
   - Why it matters: <why>
   - Options: a) ... b) **(suggestion)** ...
   - Decision:
   ```
2. Run `ROOFLOW_ROOT={{NOTEBOOK}} node {{PLUGIN}}/scripts/new-decision.cjs <blockfile>`. It takes the next Id under a lock, counts the
   `Next Id` line up and prints the Id. Never edit the Id by hand.
3. Set `State: asking` and `Needs: B<n>` in your status file. Do not guess. Continue with what does not depend on the decision.

## The final report

End with the report, at most 15 lines, as your last answer and under "Last report" in the status file. The runner saves it in
`status/journal.jsonl`; a run without a report is marked unreported.

```
REPORT <project> <date>
Done:       one line per thing, with commit hash or path
Owner:      decisions needed, as B-ids, or "none"
Promises:   only if something is new
Blocked:    what, and what would solve it
Next:       the first step of the next run
Branch:     branch (checked out in which folder), published where
Tested:     what was tested and what was NOT tested
```
