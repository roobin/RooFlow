# Decisions

Questions only you can decide stand in `decisions.md` under `## Open`, each with an Id (B1, B2 ...). They show in the band
(Decisions N) and in the panel's Decisions tab.

## Answering

- In the panel: unfold the decision and press an option, or write a free answer. It costs no turn: `scripts/decide.js` writes
  the decision and moves the block to the archive.
- In the chat: `B14 a` or `B14: free text`.

## When the decision belongs to an agent

The agent continues by itself. The panel first shows "Continuing <task> in 4 s · Undo".

- **Undo:** the decision stands, but nothing is sent. The button "Continue the agent" shows in the Decisions tab and sends when
  you want.
- A free answer that starts with "wait", "not now", "stop" or "no" ("vänta", "inte nu", "stopp", "nej") sends nothing by itself;
  the button waits instead.

## When no agent is waiting

The session gets the answer the same way, as `B14 a` (or `B14: free text`), so it acts on it. The panel shows "Sending B14 to
the session in 4 s · Undo"; after Undo or a holding answer the button is "Send B14 to the session". The decision is already in
the archive, so the session does not decide it again.

Setting in `rooflow.json`:

```json
"decisions": { "autoContinue": true, "undoSeconds": 4 }
```

`"autoContinue": false` gives the old way: the panel fills in the prompt and you send it yourself. `undoSeconds` is a whole
number from 1 to 60.
