---
name: start
description: Start routine for a new Tower session (the session in the notebook) after a session change. Run when the owner types /start, or as the first thing in a new session in the notebook folder when handover.md says an earlier session handed over.
---

# /start

The opposite of /handover. At most 12 lines of answer, in the owner's language (`language` in `rooflow.json`). Work from the notebook
folder.

0. **No `rooflow.json` here?** Then this is not a notebook yet: run the `rooflow-setup` skill and stop.
1. **Read** `handover.md`, `promises.md` and `decisions.md` (only the Ids and headings under Open).
2. **Session names** (only if the app offers the session tools): `get_session self`; write the id under `## Tower session` in
   `handover.md` and name the session "RooFlow" with `set_session_title`. If the previous Tower session (its id is in the
   handover) is still active: rename it to `RooFlow · archive <from>–<to> (<model>)` and archive it (`archive_session`, reversible);
   turn Remote Control off for it first, or the archiving is refused. Only one active session is called RooFlow.
   Mention files as clickable links with their full path, never `docs/x.md`.
3. **Agents:** run `node ${CLAUDE_PLUGIN_ROOT}/scripts/radar.js --quiet` and read `status/*.md` changed in the last day. If the
   handover mentions subagents from the last session: check that their report files exist.
4. **Radar:** show `radar.md` word for word (the `radar` skill). The band and the panel come with the plugin; nothing needs to
   be copied. If they do not show, the session was not started inside the notebook folder (the folder with `rooflow.json`).
5. **Say** what is closest in time, like `/morning` but without collecting data. Propose, do not ask.

If `handover.md` is older than a day: say so and run `/morning` straight afterwards.

**Session picture** (only if the app offers `list_sessions`): write `status/sessions.json`
(`{"generated","sessions":[{"id","title","folder","project","running","latest"}]}`). Only sessions started from the notebook: a
title that starts with `[RUN] `, `[ASK] `, `[DONE] ` or `Agent · `, or `startedBy` Tower. Never Tower itself
or the owner's own conversations in other folders.
