# Visibility of agents

RooFlow can run work in two ways:

- **Hidden** (the default): a subagent (routines and larger builds) or `scripts/agent.sh` (project agents). Not shown in the
  session tree. The answer comes back to Tower, the report lands in `status/journal.jsonl`. The cheapest to follow.
- **In the tree:** a session of its own in the sidebar, in the group "RooFlow-agenter". You can open it, read how it reasons
  and talk to it. Tower gets a short notice when it stops and reads the status file and the report from there. It costs the same.

## Setting

In `rooflow.json`, per kind:

```json
"visibility": { "routine": "hidden", "agents": "hidden", "build": "hidden" }
```

The value `tree` makes the tree the default for that kind. Your words win: `/agent <project> --tree <task>` or the words
"in the tree" in the task start a session in the tree this time.

## Tidying

`/morning` renames Tower's own session to "RooFlow", archives other Tower sessions that are not working, and moves finished
sessions in the group "RooFlow-agenter" to the archive. Never a session that is working or waits for your answer. The morning
report has a line about what was archived. The app may ask you before a session is archived.
