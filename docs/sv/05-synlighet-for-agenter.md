# Synlighet för agenter

RooFlow kan köra arbete på två sätt:

- **Dold** (standard): en underagent (rutiner och större byggen) eller `scripts/agent.sh` (projektagenter). Syns inte i
  sessionsträdet. Svaret kommer tillbaka till Tower, rapporten hamnar i `status/journal.jsonl`. Billigast att följa.
- **I trädet:** en egen session i sidofältet, i gruppen "RooFlow-agenter". Du kan öppna den, läsa hur den tänker och prata
  med den. Tower får ett kort besked när den stannar och läser statusfilen och rapporten därifrån. Kostar lika mycket.

## Inställning

I `rooflow.json`, per sort:

```json
"visibility": { "routine": "hidden", "agents": "hidden", "build": "hidden" }
```

Värdet `tree` gör trädet till standard för den sorten. Dina ord vinner: `/agent <projekt> --tree <uppdrag>` eller orden
"i trädet" i uppdraget startar en session i trädet den här gången.

## Städning

`/morning` döper om Towers egen session till "RooFlow", arkiverar andra Tower-sessioner som inte arbetar och flyttar
klara sessioner i gruppen "RooFlow-agenter" till arkivet. Aldrig en session som arbetar eller väntar på ditt svar.
Morgonrapporten har en rad om vad som arkiverades. Appen kan fråga dig innan en session arkiveras.
