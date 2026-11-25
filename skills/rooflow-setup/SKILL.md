---
name: rooflow-setup
description: Onboarding and settings for a RooFlow notebook. Creates the notebook from the plugin's templates when it does not exist, and asks one question at a time about name, language, where the projects are, calendar, scheduled morning, backup, team mode, permissions, models, categories, visibility of agents and the agent contract. Offers a quick mode that keeps the defaults for everything but backup and permissions. Can be run again at any time. Run when the owner types /rooflow-setup, or when /start finds no rooflow.json.
---

# /rooflow-setup

Ask ONE thing at a time and wait for the answer before the next. Keep every question to one or two lines, with the current value
(when there is one) and the default. Answer in the owner's language once it is known; before that, in the language the owner wrote in.
Nothing below is done without the owner's yes where it says so. This skill never overwrites a file that exists: it only creates
missing files, and in `rooflow.json` it only changes the keys the owner has just answered (and `claudeCli` when step 16 finds
the CLI by itself).

Keep a list as you go of the settings that were kept at their default without a question (quick mode, skipped steps, found by
itself). The end lines name them.

`<plugin>` below is the plugin's folder: the absolute path of `${CLAUDE_PLUGIN_ROOT}`. If the text still shows the variable, run
`echo "$CLAUDE_PLUGIN_ROOT"` with Bash; if that is empty too, take the folder that holds this skill's `skills/` folder. Use forward slashes.

## 0. Where

- Find the notebook: the current folder or a parent of it that holds `rooflow.json` (or the folder in `ROOFLOW_ROOT`).
- **Found:** this is a re-run. Say so, show the current settings in three lines, and go through the steps below, offering "keep" for each.
- **Not found:** ask "Create a RooFlow notebook in <current folder>?" The notebook is a folder of plain files that holds your decisions,
  promises, inbox and notes; the plugin's band and panel only appear in sessions that run inside it. If the owner wants another folder,
  take that path.

## 1. Name

"What should I call you? (Only used in the notebook's files. Leave empty and I say 'you'.)" Saved as `name` in `rooflow.json`.
Never guess or propose a name from other files, the git identity or the user folder: the answer comes from the owner. Ask it as a
plain chat question, not with the question tool: that tool needs at least two options, and a name has none to offer. An empty answer,
or "skip", saves `""`.

## 2. Language

"Which language: `en` or `sv`?" Saved as `language`. It decides the labels of the band and the panel, the language you answer in,
and the language of the notebook's files when they are created (`templates/sv/` on `sv`). The keys inside the files
(`State:`, `Id:`, `## Open` ...) stay English in every language: the scripts read them.

## 3. Create the notebook (only when it was missing)

Run `node <plugin>/scripts/init.js --root <folder> --name "<name>" --language <en|sv>`. It copies the templates from
`<plugin>/templates/` (on `sv` from `<plugin>/templates/sv/` where a Swedish file exists): `rooflow.json`, `decisions.md`,
`promises.md`, `inbox.md`, `today.md`, `handover.md`, `projects.md`, `commands.md`, `CLAUDE.md`, `status/_template.md`, and the
folders `status/`, `notes/`, `archive/`, `briefs/`. It skips every file that exists, prints "created" or "kept" per file, and runs
the overview once; the overview's own files (`radar.md`, `status/radar.json`, `status/radar-forra.json`) are listed apart as
"by the overview". `after-release.md` is created later, the first time the `ship` skill needs it. Tell the owner what was created in
one line. On a re-run, run it too: it only fills in what is missing.
When the notebook was created in this run, the band and the panel are not loaded in this session, since it started before
`rooflow.json` existed: they appear in a new session started in the notebook folder. The end lines say so.

## 4. Quick mode (only right after the notebook was created)

"Keep the defaults for the rest? Then I only ask about backup and permissions." On **yes**, run only steps 8, 10 and 16 (step 16
asks nothing when the CLI is found by itself), and keep every other setting as the template has it; the end lines list them. On **no**, go on
with step 5. On a re-run, skip this step: the owner is there to change things.

## 5. Where the projects are

"Where are your project folders? (default: <the folder that holds the notebook>)" A project's folder is found as
`<projectsDir>/<Folder>` (the Folder column of `projects.md`). Keeping the default leaves `projectsDir` out of `rooflow.json` (the
parent folder applies, also if the notebook moves); another answer is saved as `"projectsDir": "<path>"`. Check that the folder exists.

## 6. Calendar

"Should `/morning` show today's meetings? `outlook` (Windows, the Outlook desktop calendar through a PowerShell command) or `none`."
Saved as `addons.calendar`. Other values are not supported yet; say so.

## 7. Scheduled morning

Only if the owner wants it: "Run `/morning` automatically on weekdays at 07:30 (change the time if you like)?" After a yes, create the
job with the app's scheduled-tasks tool (`create_scheduled_task`): the name `rooflow-morning`, weekdays at the chosen time, the working
folder set to the notebook folder, and the prompt exactly `Run /morning.` Everything else is in the skill, so a plugin update updates
the job too. Tell the owner that scheduled tasks belong to the person, not to the notebook, and that a copy of the notebook on another
machine has none. If the tool does not exist in this app, say so and skip.

## 8. Backup of the whole notebook

"Where should the notebook be backed up? A git repository (give its url), a folder on disk (give its path), or none?"
Never propose a place yourself: the owner's organisation may have rules about where such files may be stored, and those belong in the
owner's own `CLAUDE.md`.

- **git:** warn that the notebook holds colleagues' first names and internal matters, so the repository must be **private**; if the url
  is on a public host, ask the owner to confirm it is private (`gh repo view --json isPrivate` may tell, if `gh` is installed).
  After a yes: `git init` if the notebook is not a repository, `git remote add origin <url>`, and the `.gitignore` below.
- **folder:** the notebook's files are copied there (see below). Check that the folder exists.
- **none:** saved as a deliberate choice. `/friday` mentions it once a week.

Only for **git** and **folder**, ask when: `commit` (after every handover commit) or `day` (once a day, in the morning job). Saved as
`"backup": { "type": "git" | "folder", "target": "<url or path>", "when": "commit" | "day" }`. For **none** nothing is asked about
when: save `"backup": { "type": "none", "target": "", "when": "" }`.

**Local history.** If the notebook is not a git repository after this (backup `folder` or `none`), ask: "Keep a local history of the
notebook with git? Nothing leaves this computer; it is not a backup." After a yes: `git init` and the `.gitignore` below. Without a
repository nothing in the notebook is committed: the `handover` skill commits only when the notebook is a repository.

The notebook's `.gitignore` holds `status/logg/` (run logs can hold secrets), `status/radar.json`, `status/radar-forra.json` and
`radar.md`. If a `.gitignore` exists, show the missing lines and add them only after a yes.

### Running the backup

Used by the `handover`, `friday` and `morning` skills when `backup.type` is not empty or `none` and `backup.when` fits.
- **git:** in the notebook, `git add -A`, `git commit -m "notebook <YYYY-MM-DD>"` (nothing to commit is fine) and `git push origin HEAD`.
  This push is the owner's chosen setting; it is the only push the notebook does by itself. If it fails, say so and do not retry in a loop.
- **folder:** copy the notebook to `backup.target` without deleting anything there (`cp -ru` in Git Bash), leaving out `.git/` and
  `status/logg/`.
Say in one line that the backup ran, or what failed.

## 9. Team mode

"Do you share this notebook's work with a team? Off by default: nothing is shared until you turn it on. (on / off)"
If **on**, ask one thing at a time: where the shared space is (`git` repository url, or a network `path`), and which projects' repositories
are shared (names from `projects.md`, comma-separated). Pull requests are the default for shared repositories (an agent works on a
branch and the owner opens the pull request); ask only whether to keep that. Saved as
`"team": { "enabled": true, "space": { "type": "git" | "path", "target": "..." }, "sharedRepos": ["slug", ...], "prRules": true }`.
Everything works as before; only what the owner or a skill sends to the space is shared. Never put the shared space's credentials in a file.
A project whose category has `private` (step 12) is never shared: do not offer it, and if the owner names one, leave it out of
`sharedRepos` and say why in one line. `node <plugin>/scripts/categories.js project <slug>` tells a project's category.

## 10. Permissions

Ask in one line: "Allow the plugin's scripts to run without asking each time?" Scripts are run with Bash, so the session asks for
permission each time unless the notebook allows them. After a yes, write or merge these lines in the notebook's
`.claude/settings.local.json` under `permissions.allow` (keep every entry that is there, add only the missing ones), with `<plugin>`
resolved as above, and then show the lines that were added:

```
Bash(node <plugin>/scripts/*)
Bash(bash <plugin>/scripts/agent.sh *)
Bash(bash <plugin>/scripts/agent-resume.sh *)
```

Say that they apply from the next session in this folder, not in the one running now. Mention that the lines hold the plugin's
folder as it is now: an install from a marketplace on the internet gets a new folder at each update, and then
running `/rooflow-setup` again fixes the lines. When the plugin comes from a local marketplace (a folder on disk), the path is that
source folder and stays the same across updates.

## 11. Models

"Which models should RooFlow use? It depends on your subscription. Defaults: routines `haiku`, project agents `sonnet`,
larger builds `sonnet`. Keep them, or name others (any alias or model id, for example `opus`)." Save as
`"models": { "routine": "...", "agents": "...", "build": "..." }`.

## 12. Categories

On the first run, ask only when `projects.md` has at least one project row. With no projects there is nothing to sort yet: keep the
template's set and say in the end lines that categories exist and are changed with `/rooflow-setup`. On a re-run, always ask.

The Category column in `projects.md` holds the owner's own names. `rooflow.json` `categories` ties each name to what RooFlow
should do with it. The keys are fixed English words (`work`, `private`, `home`, `archive`, or others the owner adds); `label` is the
owner's own word, matched with the key in `projects.md`, ignoring case. A label is the owner's name, not a translation: it stays
when the language changes. Three properties:

- `machine`: the project lives on another computer. No folder check in `/rooflow-doctor`, no agents from here (`agent.sh` refuses),
  not in Servers, and `/agent` says it is run from that computer.
- `private`: never goes to the team space or into anything that is shared.
- `hidden`: not shown in Radar and the panel.

1. Run `node <plugin>/scripts/categories.js suggest <language>`. It gives the ready set: on `sv` jobb, privat, hemma,
   arkiv; on `en` work, private, home, archive. `private` and `home` are private, `archive` is hidden.
2. Read the Category column of `projects.md` (skip empty cells and dashes). Each name that is not a key or a label in the
   set replaces the label of the category it most likely means; a name that fits none becomes a new category (key: a short English
   word) with no property. Say which names came from `projects.md`.
3. On a re-run with `categories` already in `rooflow.json`, show that instead, with "keep". A notebook created in step 3 already
   has the suggested set from the template: it is only a proposal until the owner has said yes here, so show and ask all the same.
4. Show the set in one line per category: `key: label (private, hidden)`. Ask: "OK, or change a name?" Change only what the owner names.
5. Only if the owner says a category lives on another computer, ask for that computer's name and save it as `machine` on that
   category. Never ask about `machine` otherwise.
6. Save `"categories"` in `rooflow.json` only after a yes. Without the key the default applies: only `archive` is known, and it is
   hidden.

## 13. Visibility

"Should RooFlow's work show in the app's session tree? Hidden (the default) runs it as a subagent or a background agent: cheapest
to follow, the report comes back to me. In the tree it is a session of its own in the sidebar group 'RooFlow-agenter' that you can
open and talk to; it costs the same. Per kind: routines, project agents, larger builds. Keep all hidden, or name the ones to show."
Save as `"visibility": { "routine": "hidden" | "tree", "agents": "hidden" | "tree", "build": "hidden" | "tree" }`. Mention that
`/agent <project> --tree <task>` or the words "in the tree" choose the tree for one agent whatever the setting.

## 14. Decisions in the panel

"When you decide an agent's question in the panel, the agent continues by itself after a few seconds, with Undo. Keep that, or send
the continue prompt by hand?" Saved as `"decisions": { "autoContinue": true, "undoSeconds": 4 }`, or with `"autoContinue": false`.

## 15. The agent contract in a project

"Should a project's own sessions follow the agent contract too? I can add it to one project's `CLAUDE.md`. Which project folder, or no?"
For each yes (one project at a time): append a section `## RooFlow agent contract` with the text of
`<plugin>/rules/agent-contract.md`, with `{{NOTEBOOK}}` and `{{PLUGIN}}` replaced by absolute paths, to that folder's
`CLAUDE.md` (create it if missing; never change the text already there). Agents that the notebook starts get the contract in their
brief anyway; this is only for sessions the owner starts by hand.

## 16. The Claude Code CLI (Windows)

Agents are started with the Claude Code CLI. On Windows `claude` on PATH is often the desktop app, and an agent started with it
dies at once. Run `node <plugin>/scripts/claude-cli.js --json` (it only looks at paths and starts nothing).

- `cli`: no question. Save its path as `claudeCli` in `rooflow.json` and name it in the end lines.
- `app` or `missing`: say that agents cannot start, and ask for the path to the CLI (for example the npm CLI in the npm folder
  under the roaming application data). Save `claudeCli` in `rooflow.json` only after a yes.
- On macOS and Linux skip this step unless the result is `app` or `missing`.

## End

Finish with at most eight lines:
- What was created or changed, and what was skipped.
- "Defaults you were not asked about: ..." with each setting kept without a question and its value (for example models, visibility,
  `decisions.autoContinue`, categories, calendar, and `addons.servers` off: the Servers tab of the panel, which no step asks about).
- Where projects are looked for: `<projectsDir>/<Folder>` with `projectsDir` written out (the parent folder when it is not set), or
  `rooflow.json` `projects.<slug>.folder` when the folder has another name or place (`<slug>` is the Folder column in lower case), and
  `projects.<slug>.run` when its `run.json` lies in another folder.
- The CLI, when step 16 found and saved it.
- When the notebook was created in this run (the session started without `rooflow.json`): "The band and the panel show up in a new
  session started in <notebook folder>, not in this one." Say it in so many words; the owner otherwise looks for them here.
- The first thing to try (`/morning`, then add projects to `projects.md`), and `/rooflow-doctor` as a last check: it warns about
  projects whose folder is not found.
