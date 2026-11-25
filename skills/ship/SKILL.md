---
name: ship
description: Checklist before and after publishing a project: open decisions, what the reports did not test, unpushed commits and the after-release list. Pushes only after the owner's yes. Run when the owner types /ship <project>, "should we push", "deployed to int/prod" or "add it to the release document". Also when an agent report says something must be done after release.
---

# /ship <project>

Answer in the owner's language (`language` in `rooflow.json`). Work from the notebook folder.

## Before publishing

1. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/ship.js <project>` (zero tokens, read-only, never pushes).
   The first line names the project's category. A **private** category (`private` in `rooflow.json` `categories`) never goes
   to the team space or anything shared: never push it to the team space, and if the script warns that it is in
   `team.sharedRepos`, say so first. A category with **machine** lives on another computer: say that it is shipped from there
   and stop after the decisions and the after-release list.
2. Show a checklist in this order, short:
   1. **Open B-ids** for the project (the ones that block publishing first).
   2. **Not tested** according to the reports (the last 14 days): one line per report. Propose what can be tested locally now.
   3. **Push:** unpushed commits, branch, upstream, origin. Uncommitted changes are mentioned, they do not come along.
      A push needs the owner's yes every time: one yes covers one push, not the next.
   4. **After release:** the lines from `after-release.md` that are done when it is out.
3. Push **only** when the owner writes an explicit yes in the chat, to exactly the repo and branch the list showed:
   `git -C <folder> push` (the first time `git push -u origin <branch>`). Never force. The script never pushes.

## After publishing: "deployed <environment>"

When the owner writes `deployed int` (or `prod`): go through the reports' "not tested" lines and the after-release lines that apply
to that environment and propose follow-up agents, one line per agent (what it should try, against which address, whether it writes
data). The owner says yes to those that should start (the `agent` skill, or `agent-resume.sh` if an old agent has the context).
Start none without a yes. Check off the line in `after-release.md` (`[x]`) when something is done.

## The release document: `after-release.md`

The owner says "add it to the release document/after-release: ...", or an agent report says something is to be done after release:

1. If `after-release.md` is missing in the notebook: create it from `${CLAUDE_PLUGIN_ROOT}/templates/after-release.md` (remove the
   example section `## <project>`).
2. Add the line `- [ ] <what> (<why>)` under `## <project>`. If the section does not exist, create it last in the file.
   (A file with a single project may have its heading on top instead of sections; then the line goes last in the list.)
3. Confirm in one line. No questions. Do not add the same thing twice (search for the line first).

If the file or the project's section is missing, `/ship` says "no after-release list for <project> yet". That is not an error.
