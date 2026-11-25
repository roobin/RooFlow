---
name: promise
description: Register a promise the owner has made to someone. Run when the owner types /promise, says "I promised", "I told X that", "I will fix it by Friday" or similar. Also to check off a promise as done, or to list the open ones.
---

# /promise

Answer in the owner's language (`language` in `rooflow.json`). Work from the notebook folder.

## New promise

Read the text as: **what**, **to whom** (first name only), **when** (a deadline as a date). If the deadline is missing, suggest one,
write it in, and say which you chose. If the person is missing, write "-".

Add a line under `## Open` in `promises.md`:
`- [ ] YYYY-MM-DD · to <first name> · <what> · <source if mentioned>`

The words `to` and `waiting for` are keywords of the file format (the Swedish `till` and `väntar på` also work). When the owner
waits for someone else, write `- [ ] YYYY-MM-DD · waiting for <whom> · <what> · <source>` instead; it shows under WAITING.

Confirm in one line. Ask nothing more.

## Done

`/promise done <something>` or "that thing about X is done": find the line, set `[x]`, move it to `## Done` with the date. The panel
does the same without a model turn through `scripts/promise.js done <hash>`. Confirm in one line.

## List

`/promise list` or "what have I promised": show the open promises sorted by deadline. Mark passed ones "OVERDUE".
