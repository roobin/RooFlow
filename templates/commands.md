# Commands

Type these in a session that stands in this notebook folder. Ordinary language works as well as the command; the command is just a
guarantee that the right file is updated. The skills come from the rooflow plugin; a skill of the same name in this notebook's
own `.claude/skills` wins, which is how you adapt a command locally.

The overview is called **Radar**: the band above the prompt, the panel `/rooflow` beside the chat, and `/radar` in the chat.

| Type | What happens | File |
|---|---|---|
| `/radar` | Shows the overview: decisions, today, promises, waiting, agents, what stands still | `radar.md` |
| `/rooflow` | Opens the panel: Decisions, Today, Projects, Agents, Inbox, Commands, Files (Servers if the addon is on). Costs no tokens | reads `status/radar.json` |
| `/radar reset` | The delta counts from now instead of from this morning | `status/radar-forra.json` |
| `today: X; Y; Z` | Today's three picks (also `/radar today X; Y; Z`) | `today.md` |
| `/morning` | Meetings (with the calendar addon), yesterday, agents, promises, decisions, focus | reads all |
| `/inbox <text>` | Adds the line to the inbox | `inbox.md` |
| `/inbox` | Sorts the inbox into now / agent / wait / later | `inbox.md` and others |
| `/promise <what> to <whom> by <when>` | Registers a promise | `promises.md` |
| `/promise done <something>` | Checks it off | `promises.md` |
| `/promise list` | Open promises, overdue ones marked | `promises.md` |
| `/decisions` | Shows open decisions with their Id | `decisions.md` |
| `/decisions new: <question>` | Adds a decision with the next Id | `decisions.md` |
| `B14 a` or `B14: free text` | Decides B14 and moves it to the archive | `decisions.md`, `archive/` |
| `/agent <project> <task>` | Starts a project session with a start prompt | `status/<project>.md` |
| `/agent` | What the agents are doing and asking | reads |
| `/restart <project>` | Restarts the project's service (command and url from `rooflow.json`), waits until the url answers and continues the agents that stand on `Needs: restart` | `scripts/restart.js`, `rooflow.json` |
| `/ship <project>` | Checklist before a release: open B-ids, what the reports did not test, unpushed commits, after-release. Pushes only after your yes | `scripts/ship.js`, `after-release.md` |
| `/rooflow-doctor` | Checks the installation. Changes nothing | `scripts/doctor.js` |
| `/friday` | End of week: what happened, promises, decisions, a thought | several |
| `/handover` | Rewrites the handover before a new session | `handover.md` |
| `/cleanup` | Lists old finished things, moves them to `archive/cleaned-YYYY-MM` after your yes. Undo with `--restore <date>` | `scripts/cleanup.js` |
| `/start` | First thing in a new session: the handover, session names, Radar | `handover.md` |
| `/rooflow-setup` | Onboarding and settings: name, language, calendar, scheduled morning, backup, team mode, permissions. Can be run again | `rooflow.json` |

## Free text that also works

- "I promised Anna to look at the form before Wednesday" -> a promise.
- "I am waiting for IT about the login" -> a line in `promises.md` with `waiting for IT`, shown under WAITING.
- "Remember that IT wants a list of our APIs", "idea: ..." -> the inbox, not a decision.
- "What do I need to decide?" -> decisions.
- "What is happening in <project>?" -> the project's status.
- "The session is getting heavy" -> handover.

## Every day

- **Morning:** `/morning`, then `today: X; Y; Z` (at most three things).
- **Look:** the band, `/rooflow` for more, or `/radar` in the chat.
- **Answer decisions:** `B2 a` or `B2: free text`. The button in the panel does the same.
- **Promise:** "I promised Sam X by Friday". **Waiting:** "I am waiting for IT about Y". **Idea:** "idea: ..." (inbox).
- **Done for the day:** `today done 2`, check off promises with `/promise done ...`.
- **Agent:** `/agent <project> <task>`. It shows under IN MOTION with State and Doing. Questions from agents become B-decisions.
- **Change session:** `/handover`, a new session in this folder, `/start`.
- **Friday:** `/friday`.
