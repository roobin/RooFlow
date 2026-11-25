# The agent contract

Every agent Tower starts gets the contract in its brief. The whole text is the plugin's `rules/agent-contract.md`. In short:

- Work in the project's folder on the branch that is checked out. No worktree, no switching branch.
- Commit when something works, if the folder is a git repository. Never push unless the task says so.
- Never read secrets.
- The status file `status/<task>.md` in the notebook starts with:

```
State: running | asking | done | stuck
Doing: <one sentence>
Needs: restart | deploy | B<n> | <short text>   (optional, only while the agent waits)
Task: <the task's slug>
Project: <the project in projects.md>
Updated: <YYYY-MM-DD HH:MM>
```

- Questions for the owner become B-ids in `decisions.md` (with `scripts/new-decision.cjs`), never only in the chat.
- The final report starts with `REPORT <project> <date>` and has the lines Done, Owner, Promises, Blocked, Next, Branch and
  Tested, at most 15 lines. It is saved in `status/journal.jsonl`; without it the run is marked "unreported".
