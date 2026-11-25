# The commands

Typed in a session that stands in the notebook. Ordinary language works as well; the command guarantees the right file changes.

| Command | What happens |
|---|---|
| `/radar` | The overview: decisions, today, promises, waiting, agents, what stands still |
| `/rooflow <tab>` | Opens the panel on a tab. Costs no tokens |
| `/morning` | Meetings, yesterday, agents, promises, decisions and a suggested focus |
| `/inbox <text>` | Adds the line to the inbox; `/inbox` without text sorts it |
| `/promise <what> to <whom> by <when>` | Registers a promise |
| `/decisions` | Shows open decisions; `B14 a` or `B14: free text` decides |
| `/agent <project> <task>` | Starts a project agent; `--tree` or "in the tree" makes it a session in the sidebar |
| `/restart <project>` | Restarts the project's service and continues the agents that wait for a restart |
| `/ship <project>` | Checklist before a release; pushes only after your yes |
| `/rooflow-doctor` | Checks the installation. Changes nothing |
| `/cleanup` | Moves old things to the archive |
| `/friday` | The week in the rear mirror |
| `/handover` | Rewrites the handover |
| `/rooflow-setup` | The settings, one question at a time |

The panel's Commands tab has a button per command. Each press costs a turn.

## Updating a locally developed plugin

For someone who develops the plugin and installs it from a local marketplace (a folder with a git repo).

- `claude plugin update rooflow@<marketplace>` only fetches something when the version in `plugin.json` has been raised.
  Otherwise it says "already at the latest version", even when the source repo has new commits.
- Without a raised version: in the notebook run `claude plugin uninstall rooflow@<marketplace> --scope local --keep-data` and then
  `claude plugin install rooflow@<marketplace> --scope local` (use `user` instead of `local` if the plugin is installed for the user).
- Check: the plugin's entry in `~/.claude/plugins/installed_plugins.json` has `gitCommitSha`, which should equal
  `git rev-parse HEAD` in the source repo. `/rooflow-doctor` compares them and warns when the install is older.
- The change shows only in a new session.
