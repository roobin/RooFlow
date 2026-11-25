---
name: agent
description: Start or follow up a project agent, that is a Claude Code session in a project's folder. Run when the owner types /agent, says "start an agent on X", "set a session going in Y", or wants to know what the agents are doing.
---

# /agent

Answer in the owner's language (`language` in `rooflow.json`). Work from the notebook folder. Scripts are called as
`node ${CLAUDE_PLUGIN_ROOT}/scripts/<x>.js` and `bash ${CLAUDE_PLUGIN_ROOT}/scripts/<x>.sh`.

## Principle: think expensive, do cheap

Tower (the session in the notebook) only does what needs judgement: understand the task, write the prompt, assess the result, talk to the owner.
Everything mechanical is delegated to a subagent through the Agent tool on the `routine` model from `models` in `rooflow.json`
(the `build` model if the step needs to understand code). The subagent gets only its task text, not the notebook's context, and answers in at most five lines. Log it in
`status/subagents.jsonl`, one line at start and one at the end:
`{"time","event":"start|done","id","project","task","model"}`.

## `/agent <project> <task>`: start

0. **Bring back the archive first:** run `node ${CLAUDE_PLUGIN_ROOT}/scripts/cleanup.js --bring-back <project> --commit`. If the
   cleaner has moved the project's status file or run logs, they come back, so the agent finds where the last run ended.
1. **You:** look the project up in `projects.md` and find its folder (`rooflow.json` `projects.<slug>.folder`, otherwise
   `<projectsDir>/<Folder>`). Write the brief from the template below and save it as `briefs/<date>-<project>-<topic>.md`.
   If `rooflow.json` has `team.enabled` and the project's repo is in `team.sharedRepos` with `team.prRules` on, add to the task:
   "Commit to a feature branch and do not touch the default branch; the owner opens the pull request."
2. **One routine subagent, one call.** Resolve `${CLAUDE_PLUGIN_ROOT}` to its absolute path first (run `echo "$CLAUDE_PLUGIN_ROOT"` with Bash if
   the text still shows the variable): the subagent does not see this skill. Task text: "Run `bash ${CLAUDE_PLUGIN_ROOT}/scripts/agent.sh briefs/<file>.md <folder> <agents model> auto` in
   the notebook folder (wait until it finishes, up to 15 minutes). Never put it behind a pipe such as `| tail`: a pipe hides the
   script's exit code, and an agent that never started looks like one that went fine. Afterwards read the last `"result"` in
   `status/logg/<file>.jsonl`, `num_turns`, and `git log --oneline -3` in <folder>. Answer with: the agent's final answer word for
   word, the commit id, the turns." If the app offers `get_usage`, the subagent may note the percentage points used before and after.
3. **You:** read the subagent's answer and `status/<task>.md`. Report to the owner with the agent's final answer quoted as it is,
   and your own assessment clearly apart.
   **Question check (always, also when an app session reports):** read the agent's deliverables for headings such as "Decision",
   "Question", "Open", "waiting for the owner", "build nothing until". Every question and every go-ahead the agent waits for
   must exist as a B-id in `decisions.md`. If something is missing, add the block yourself (the `decisions` skill) before you report.
   The owner should never have to enter an agent session to see what waits.

**A project on another computer is not started from here.** Before step 0, run
`node ${CLAUDE_PLUGIN_ROOT}/scripts/categories.js project <project>`. If its `machine` is set, tell the owner in one line that
<project> is run from <machine> (category <label>) and start nothing; `agent.sh` and `agent-resume.sh` refuse it too. The owner's
own notebook can have a local skill for sending the task there.

**A private project** (`private` in its category) never goes to the team space: leave out the team line above even if the
project is in `team.sharedRepos`.

## Hidden or in the tree

`visibility` in `rooflow.json` says where work runs, per kind (`routine`, `agents`, `build`): `hidden` (the default) or `tree`.
**Hidden** is what is described above: a subagent, or `agent.sh` for a project agent. It does not show in the app's session
tree. **In the tree** is a session of its own in the sidebar, which the owner can open, follow and talk to. It costs the same.

Use the tree for a project agent when `visibility.agents` is `tree`, or when the owner's words ask for it this time:
`/agent <project> --tree <task>`, or "in the tree" or "so I can follow" in the task, in any language (drop `--tree` from the
task text). The owner's words win over the setting, both ways ("hidden" keeps it hidden).

Start it like this, instead of step 2:

1. Steps 0 and 1 as above: bring back the archive, write the brief to `briefs/<date>-<project>-<topic>.md` with the agent
   contract pasted in.
2. If the app offers `start_session` (`mcp__ccd_session__start_session`), call it with `initiation: "user_asked"`,
   `context: "fresh"`, `cwd` = the project folder (absolute), `use_worktree: false` (the contract forbids a worktree),
   `model` = the `agents` model, `title` = `[RUN] <Project> · <topic>`, `prompt` = the brief's text under `---`, word for word,
   `background` = two sentences (at least 80 characters): which project and notebook this is, that the task and the agent
   contract are in the prompt and that the status file in the notebook is its only channel, and `wake_when_done: true`.
   If the app does not offer it, say so in one line and start the agent hidden instead.
3. Put the session in the sidebar group "RooFlow-agenter" if the app offers the sidebar tools: `list_groups`, `create_group`
   with that name if it is missing, then `move_sessions` with the new session's id. In the default permission mode the app
   asks the owner before a move; a no is fine, the session stays where it is.
4. Log it in `status/subagents.jsonl` (start) with the session's id, as for a subagent.
5. **When it stops** (the app wakes you): read `status/<task>.md`. If the app offers `list_events`, read the session's last
   answer, save it as `status/logg/<brief name>.txt` and run `node ${CLAUDE_PLUGIN_ROOT}/scripts/journal.js --text
   status/logg/<brief name>.txt <brief name>`: the `REPORT` lands in `status/journal.jsonl` as for a hidden run (without one,
   "unreported"). Log the end in `status/subagents.jsonl`, then report to the owner as in step 3 above, the question check included.

`visibility.build` or `visibility.routine` set to `tree` works the same way for a larger build or a routine: the session's
`cwd` is the notebook, its model the `build` or `routine` model, and its prompt the task you would have given the subagent.
`/morning` moves finished sessions in "RooFlow-agenter" to the archive.

## Follow-up on the same code: do not start a new agent

Same as above, but the subagent runs
`bash ${CLAUDE_PLUGIN_ROOT}/scripts/agent-resume.sh status/logg/<file>.jsonl <folder> "<instruction>"`. It resumes the session with
`--resume`, so the reading of the code base is already done. A new agent only when the task touches other code or the log shows
that the session went off the rails.

## Measure one at a time

A before-and-after usage figure is only right if no other agent runs at the same time. If the owner wants parallel runs, say the
measurement will be lumped.

## The brief

A brief is a heading, a line about project, folder and model, a line `---`, and then the prompt. `agent.sh` sends only what stands under
`---` (without that line the whole file is sent, with a note). An empty prompt is refused.

Build the prompt from this template. Paste the whole of `${CLAUDE_PLUGIN_ROOT}/rules/agent-contract.md` where it says so, with
`{{NOTEBOOK}}` replaced by the notebook's absolute path and `{{PLUGIN}}` by the absolute path of `${CLAUDE_PLUGIN_ROOT}`.

```
# <Project>: <topic>

Project: <slug>. Folder: <folder>. Model: <model>, auto. Written by the RooFlow notebook <date>.

---
You are an agent in the project <project>, folder <folder>, branch <branch>. Work directly in that folder on that branch.
Do not create a worktree and do not switch branch. Read the project's CLAUDE.md first.

Task: <the task>

Answer in <the owner's language>.

<the agent contract, pasted from rules/agent-contract.md>
```

**Session title.** When the notebook starts an app session and when the status file's `State` changes, set the title with
`set_session_title` (if the app offers it) to `[RUN] <Project> · <thing>`, `[ASK] ...` or `[DONE] ...`. Do it in the same cheap routine
that follows up the agents, not every minute. There is no limit on the number of agents that run at once.

## `/agent` without text: follow up

**A subagent on the routine model:** run `node ${CLAUDE_PLUGIN_ROOT}/scripts/radar.js --quiet`, read `status/radar.json` and every `status/*.md`
changed in the last day, and the new blocks under `## Open` in `decisions.md`. Answer with one line per agent and one per
decision. **You:** pass it on, at most ten lines.

## `/agent rename`: tidy names

For sessions without a descriptive name: read the session's first messages (`list_events` or `search_session_transcripts`, if the
app offers them), suggest the name `<project>: <three words>`, and set it with `set_session_title` after the owner's ok.
