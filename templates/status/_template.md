State: running | asking | done | stuck
Doing: <one sentence>
Needs: restart | deploy | B<n> | <short free text>   (optional: only while the agent waits)
Task: <the task's slug = this file's name>
Project: <the project in projects.md>
Updated: YYYY-MM-DD HH:MM

# Status: <project>

Written by the project's agent at start, at every change of state and at the end. At most 15 lines.
The lines on top are the agent contract: the overview reads them, without bullets, always first in the file.
`asking` = a decision with a B-id waits in decisions.md (also write `Needs: B<n>`). `stuck` = cannot get further.
`Needs` is removed by whoever resolves the wait (the restart script, `scripts/decide.js` or the agent), who also sets State.

- Goal: ...
- Next step: ...
- Blocked: ...
- Branch: ...
- Model/effort: ...
- Context: about N % of the window used (a guess: files read and turns, or /context if it exists)
- Last report: (the final report, at most 15 lines, when the run is done)
