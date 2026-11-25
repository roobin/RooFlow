---
name: radar
description: Show Radar, the owner's overview (decisions that wait, today, promises, waiting, agents on the move, projects that stand still). Run when the owner types /radar, "radar", "what is the situation", "today: X; Y; Z", or presses a button in the Radar band that sends a prompt.
---

# /radar

Radar is a node script, zero tokens: `scripts/radar.js` reads the files and writes `radar.md` and `status/radar.json`. The model
interprets nothing itself: it runs the script and shows the result. Work from the notebook folder; answer in the owner's
language (`language` in `rooflow.json`).

## `/radar` or `/radar refresh`

1. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/radar.js --quiet`.
2. Show `radar.md` word for word in a code block. No addition, no summary. At most one line afterwards if something needs the owner
   at once (for example a promise that is OVERDUE).

`/radar reset` runs `node ${CLAUDE_PLUGIN_ROOT}/scripts/radar.js --reset --quiet`: the delta counts from now instead of from the
first run of the day.

## `/radar today X; Y; Z` or free "today: X, Y, Z" in the chat

Rewrite `today.md` completely:

```
# Today YYYY-MM-DD

- [ ] X
- [ ] Y
- [ ] Z
```

At most three lines. More than three: ask which three. `done X` or `today done 2` checks one with `- [x]`.
Then run `node ${CLAUDE_PLUGIN_ROOT}/scripts/radar.js --quiet` and confirm in one line.

## Answers through Radar

The buttons in the band and the panel send ready-made prompts:

- `B14 a` (the panel's answer button) -> follow the `decisions` skill (the section Answers).
- `Open <path>` -> answer with the path as a clickable link (full path), nothing else.
- `/morning`, `/inbox` and so on -> the skill of that name.

## Free capture

"remember ...", "idea: ..." and the like go to `inbox.md` (the `inbox` skill), not to `decisions.md` or `today.md`.
