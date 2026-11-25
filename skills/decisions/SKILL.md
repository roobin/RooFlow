---
name: decisions
description: Show, add or decide the decisions that wait for the owner. Run when the owner types /decisions, answers "B14 a" or "B14: free text", asks "what do I need to decide", or when an agent or a conversation lands in a question only the owner can decide.
---

# /decisions

`decisions.md` holds only what waits. Every block has `- Id: B<n>`. Decided blocks live in `archive/decisions-YYYY-MM.md` (the month
of the block's `Date`). Answer in the owner's language (`language` in `rooflow.json`); the keys of a block are the English ones, the
text you write in them is in the owner's language. Scripts: `node ${CLAUDE_PLUGIN_ROOT}/scripts/<x>`, run from the notebook folder.

## No text: show

List everything under `## Open` in `decisions.md`, oldest first. Per decision: Id, heading, who asks, what it blocks, the question
in one line, the options with the suggestion marked. If there are more than five: suggest which two are most important to take
today. Parked ones (`Decision: parked ...`) go on a line of their own, last.

## With text (`/decisions new: <question>`): add

1. Write the block to a temporary file outside the notebook, in the format at the top of `decisions.md`, with `- Id: B?`.
   Fill in `Date` (with the time), `Project`, `Task` (the status file's slug) and `Blocks` if an agent is involved, `Asked by`,
   `Question`, `Why it matters`, `Options` as `a) ... b) **(suggestion)** ...`, and an empty `Decision:`.
2. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/new-decision.cjs <blockfile>`. It puts the block first under `## Open`, takes the next Id
   under a lock, counts the `Next Id` line up and prints the Id. Never pick or edit an Id by hand; Ids are never reused.
3. Confirm in one line: "B<n> added".

## Answers: `B14 a`, `B14: free text`, the button in the panel and `Continue <task>: B14 is decided with the answer "a".`

**The panel archives by itself.** Its answer button and free-text field run `node scripts/decide.js B14 a` (no model turn): it writes
`Decision: a, <name> <date>`, moves the block to `archive/decisions-YYYY-MM.md`, adds `B14 a <date>` under the `## Beslut` heading in
`status/<task>.md` (the Task of the block, otherwise the Project if that file exists), removes `Needs: B14` from the status header
and runs `scripts/radar.js`. If the decision is already decided the script refuses and nothing changes. When the decision belongs to
an agent, the panel then sends the continue prompt by itself (`decisions.autoContinue` in `rooflow.json`, on by default):

- It shows "Continuing <task> in 4 s · Undo" first (`decisions.undoSeconds`, default 4). Undo leaves the decision decided but
  sends nothing; a "Continue the agent" button then waits in the Decisions tab and sends the same prompt when pressed.
- A free-text answer that starts with "wait", "not now", "stop" or "no" (or the same words in Swedish)
  sends nothing by itself; the button waits instead.
- With `"autoContinue": false` the panel only fills in the prompt, and the owner sends it when ready.

The prompt that arrives:

- **`Continue <task>: B14 is decided with the answer "a".`** (from the panel; with `language` `sv` the same sentence comes in Swedish, and the older form `B14 a: continue <task>` may still arrive: treat them the same): the decision is already archived. Do not do it again. Continue the agent with
  `bash ${CLAUDE_PLUGIN_ROOT}/scripts/agent-resume.sh <logfile> <folder> "B14 decided: a"` for `<task>` (see the `agent` skill for
  the call). If the agent still runs (a SendMessage name in ListAgents), send the message there instead. Say in one line what
  was done.

**If the owner types `B14 a` or `B14: free text` in the chat,** the same holds, but then you run the script:
`node ${CLAUDE_PLUGIN_ROOT}/scripts/decide.js B14 a` (or `... B14 "the free text"`). If B14 is already decided: do nothing, say in one
line that it is decided. If the block is not under `## Open`: say so, do not guess. If the decision belongs to an agent (the script
answers with `task`): offer to continue it, or do it at once if the owner said so. Confirm in one line.

`park B14` writes `- Decision: parked <date>` and leaves the block under `## Open`.

## Questions you have yourself

Every question for the owner goes here as a block, in the same answer it is asked, with context, why it matters and a suggestion.
In the chat, refer to the heading.
