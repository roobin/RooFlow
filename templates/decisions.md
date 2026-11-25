# Decisions waiting for you

One block per decision. Format:

```
## <short heading>
- Id: B<n>
- Date: YYYY-MM-DD (with the time if you like: YYYY-MM-DD HH:MM)
- Project: <project slug, if an agent asks>
- Task: <the agent's status file slug, if an agent asks>
- Blocks: <what stands still until it is decided>
- Asked by: <agent, project or person>
- Question: ...
- Why it matters: ...
- Options: a) ... b) **(suggestion)** ...
- Decision:
```

Ids are running numbers B1, B2 ... and are never reused. Take the next free one below and count the line up in the same change
(`scripts/new-decision.cjs` does both under a lock). Answer in the chat with `B3 a` or `B3: free text` (the `decisions` skill).
Decided blocks move to `archive/decisions-YYYY-MM.md` by their Date, so this file only holds what waits.

Next Id: B1

## Open

## Decided

Decided blocks are archived by `scripts/decide.js`; this heading only keeps older notebooks readable.
