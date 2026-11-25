---
name: rooflow-doctor
description: Check the RooFlow installation (fresh radar.json, stuck states, unreported runs, Next Id, BOM and mojibake, passwords in tracked logs, rooflow.json, project folders, the Claude Code CLI, lock files, an installed plugin older than its local source repo, the scheduled morning job). Run when the owner types /rooflow-doctor, "is everything healthy" or "check the installation". Read-only.
---

# /rooflow-doctor

Nothing is changed. The script checks, this skill explains and proposes. Answer in the owner's language (`language` in
`rooflow.json`). Work from the notebook folder.

1. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js` (zero tokens). Show the lines word for word in a code block.
   The script writes in `language` too (en or sv); the level words `OK`, `WARNING` and `ERROR` stay English in every language.
2. The scheduled morning job cannot be read by a script: if the app can list scheduled tasks (`list_scheduled_tasks`), check that
   `rooflow-morning` exists and is on. If the owner has not set up a schedule, say nothing about it. If it exists but is off, or is
   missing although `/rooflow-setup` was told to create it: write it as a line of its own, WARNING.
3. Per WARNING or ERROR: one line with a proposed action, without doing it:
   - radar.json old: the mod is not loaded in the session, or run `node ${CLAUDE_PLUGIN_ROOT}/scripts/radar.js --quiet`.
   - running for over 24 h: ask the agent (or the owner) to set State: done/stuck, or archive the file with `/cleanup`.
   - asking without a B-id: put the question in `decisions.md` (the `decisions` skill) or set State right.
   - unreported runs: read the log in `status/logg/` and write the report, or continue the agent.
   - Next Id: raise the line to the highest Id + 1 (a person, with the lock in `scripts/lock.cjs`); duplicates: change the Id of the newer.
   - BOM/mojibake: save the file again as UTF-8 without BOM and fix the broken characters by hand.
   - password-like lines: open the file at the line number and judge. If it is a real secret it must go out of the git history,
     and the owner changes the key. Never read anything under a secrets folder.
   - rooflow.json invalid: fix the JSON (the script says where). Lock file: removed by the next writer after 60 s.
   - project without a folder: set `projects.<slug>.folder` in `rooflow.json` (and `run` when `run.json` lies elsewhere), or
     give the project's category `machine` in `rooflow.json` `categories` if it lives on another computer. Only projects in
     state now are checked.
   - a category in `projects.md` that is not in `categories`: add it (`/rooflow-setup` step Categories) or rename it in `projects.md`.
   - a private project in `team.sharedRepos`: remove it from `sharedRepos`; a private category is never shared.
   - Claude Code CLI missing or the desktop app: agents cannot start. Install the CLI or set `claudeCli` in `rooflow.json`
     (`/rooflow-setup` shows what was found).
   - plugin older than its local source repo (only for someone who develops the plugin from a local folder): `claude plugin update`
     does nothing while the version is unchanged. Propose the two commands in the warning (uninstall with `--keep-data`, then install),
     run by the owner, and a new session. Never run them yourself.
4. End with "N OK, M warnings, K errors". An error the owner must decide goes to `decisions.md`, not only to the chat.
