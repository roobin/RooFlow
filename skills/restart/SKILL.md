---
name: restart
description: Restart a project's local service, wait until its address answers, and continue the agents that wait for a restart. Run when the owner types /restart <project>, "restart the service", or presses "Restart and continue" in the panel.
---

# /restart <project>

Command, address and folder are in `rooflow.json` under `projects.<project>` (`restart`, `url`, `folder`). The script
`scripts/restart.js` does the mechanical part; this skill continues the agents. Without a project name and with exactly one project
in `rooflow.json`: take it. Otherwise ask which (one question). Answer in the owner's language (`language` in `rooflow.json`).
Work from the notebook folder.

1. Preview without side effects: `node ${CLAUDE_PLUGIN_ROOT}/scripts/restart.js <project> --dry`. It shows the command and which
   agents stand on `Needs: restart`. If it says nothing is set for restart: tell the owner and do nothing more.
   The restart command comes from the owner's own `rooflow.json`, but show it and ask for a yes first the first time in a session.
2. Run for real: `node ${CLAUDE_PLUGIN_ROOT}/scripts/restart.js <project>` (up to 5 minutes; set the Bash timeout to 600000). The
   script stops with an error if the command fails or the address does not answer; then continue no agent and show the error.
3. The output ends with `AGENT <slug>`, the log file and the folder (tab-separated) per waiting agent, and `NO_LOG <slug>` where no log
   was found. For every NO_LOG: run `node ${CLAUDE_PLUGIN_ROOT}/scripts/cleanup.js --bring-back <slug> --commit` (the cleaner may
   have archived the log) and then `restart.js <project> --dry` again; if it is still missing, tell the owner and do not continue
   that agent. Report the time to answer.
4. Continue every AGENT in the background (`run_in_background`, one Bash per agent):
   `bash ${CLAUDE_PLUGIN_ROOT}/scripts/agent-resume.sh <logfile> <folder> "<instruction>" <agents model>`
   Instruction: `<project> was restarted <time> and answers on <url>. Try your change. Remove the line Needs: restart, set State, end with REPORT.`
   If more than one agent is continued, add: `Only try and report, do not commit: several agents try at the same time in the same repo.`
5. Log in `status/subagents.jsonl`, one line at start and one at the end per agent
   (`{"time","event":"start|done","id","project","task","model"}`).
6. When an agent finishes: tell the owner, with the agent's final report quoted as it is and your own assessment apart.

Cost: one turn per continued agent (say "(1 turn)" in proposals).
