---
name: inbox
description: Add to or sort the owner's inbox. Run when the owner types /inbox, says "put it in the inbox", "remember that", "note that", or dumps a thought, a request or something that came in by mail, chat, phone or in the corridor.
---

# /inbox

Answer in the owner's language (`language` in `rooflow.json`). Work from the notebook folder.

## With text after the command: add

Write a line in `inbox.md` under `## Now`: `- YYYY-MM-DD · <source if mentioned> · <what>`. Confirm in one line. Ask nothing.

If the text holds a promise ("I promised", "I will fix", "I told X that"), put it in `promises.md` instead, see the `promise` skill.

If it is something to be done after a release ("add it to the release document", "after deploy we must ..."), the line does not
belong in the inbox: put it in `after-release.md` as the `ship` skill says.

## Without text: sort

Go through every line under `## Now` in `inbox.md` and suggest a pile per line:

- **now**: the owner, today or tomorrow.
- **agent**: can be delegated to a project session. Say which project.
- **wait**: needs something from someone else. Say what.
- **later / no**: not to be done now. Say why.

Show the suggestion as a list and ask for an "ok" or changes. When the owner has approved:
- now: stays in `inbox.md` under `## Now`.
- agent: a line in `status/<project>.md` under "Next step", or start it with `/agent`; or move it to `## Agent`.
- wait: `promises.md` if it is a promise, otherwise `inbox.md` under `## Waiting`.
- later / no: `## Later`, or a file in `notes/` if it is an idea worth keeping. Nothing is deleted.

Remove the sorted lines from where they were. Update `handover.md` if something bigger came up.

## The panel (Radar, the Inbox tab)

The owner can press Done, Remove and Move on each entry in the panel. That runs `scripts/inbox.js` without a model turn, so
`inbox.md` may have changed between two of your reads: read the file again before you edit it. Remove moves the entry to
`archive/inbox-YYYY-MM.md`, it is never deleted. The buttons Agent, Promise and Decision only fill in the prompt, so you get
`/agent <text>`, `/promise <text>` or `/decisions new: <text>` from the owner; treat the text as the task.
