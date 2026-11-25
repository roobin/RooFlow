# Agentkontraktet

Varje agent som Tower startar får kontraktet i sin brief. Hela texten står i pluginets `rules/agent-contract.md`.
Kort:

- Arbeta i projektets mapp på den gren som är utcheckad. Ingen worktree, inget grenbyte.
- Committa när något fungerar, om mappen är ett git-repo. Pusha aldrig om uppdraget inte säger det.
- Läs aldrig hemligheter.
- Statusfilen `status/<uppdrag>.md` i anteckningsboken börjar med:

```
State: running | asking | done | stuck
Doing: <en mening>
Needs: restart | deploy | B<n> | <kort text>   (valfri, bara medan agenten väntar)
Task: <uppdragets slug>
Project: <projektet i projects.md>
Updated: <ÅÅÅÅ-MM-DD HH:MM>
```

- Frågor till ägaren blir B-id i `decisions.md` (med `scripts/new-decision.cjs`), aldrig bara i chatten.
- Slutrapporten börjar med `REPORT <projekt> <datum>` och har raderna Done, Owner, Promises, Blocked, Next, Branch och Tested,
  högst 15 rader. Den sparas i `status/journal.jsonl`; saknas den märks körningen "orapporterad".
