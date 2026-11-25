# The band and the panel

Radar shows the notebook in two places. Both read `status/radar.json`, which `scripts/radar.js` writes every five minutes.
Looking costs no tokens.

## The band

One row above the prompt: Decisions, Today, Agents (running and waiting), Context, Week, Panel and ↻.

- Decisions, Today and Agents open their tab in the panel.
- **Panel** (key `p`) opens and closes the panel. Open: a filled `● Panel`. Closed: `○ Panel`.
- **↻** (key `u`) reads everything again.

## The panel

Opened with Panel in the band or `/rooflow <tab>`. The tabs have digit keys in order. The chosen tab is filled.

- **Decisions:** questions that wait for you, with answer buttons.
- **Today:** today's three, promises that fall due and what you wait for.
- **Projects:** the projects in `projects.md`, per state. A click opens the project room.
- **Servers** (addon): the commands in the projects' `run.json`. The heading per project folds with a click.
- **Agents:** waiting for a restart, a deploy, a decision; Running; other agents in motion; reports; subagents. Every heading folds.
- **Inbox, Commands, Files** and **? Help** (these pages).

The plugin remembers folded headings until the next session. The numbers in the Agents tab are the band's: Running only
holds agents whose status file says `State: running` and that were updated in the last two hours. An agent with `Needs:`
counts as waiting, not as running.
