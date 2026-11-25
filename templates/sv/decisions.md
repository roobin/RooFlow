# Beslut som väntar på dig

Ett block per beslut. Nycklarna (`Id:`, `Date:` …) är engelska, skripten läser dem. Format:

```
## <kort rubrik>
- Id: B<n>
- Date: ÅÅÅÅ-MM-DD (med klockslag om du vill: ÅÅÅÅ-MM-DD HH:MM)
- Project: <projektets slug, om en agent frågar>
- Task: <agentens statusfils slug, om en agent frågar>
- Blocks: <vad som står still tills det är avgjort>
- Asked by: <agent, projekt eller person>
- Question: ...
- Why it matters: ...
- Options: a) ... b) **(förslag)** ...
- Decision:
```

Id är löpnummer B1, B2 … och återanvänds aldrig. Ta nästa lediga nedan och räkna upp raden i samma ändring
(`scripts/new-decision.cjs` gör båda under ett lås). Svara i chatten med `B3 a` eller `B3: fritext` (skillen `decisions`).
Avgjorda block flyttas till `archive/decisions-ÅÅÅÅ-MM.md` efter sitt datum, så filen innehåller bara det som väntar.

Next Id: B1

## Open

## Decided

Avgjorda block arkiveras av `scripts/decide.js`; rubriken finns bara kvar så att äldre anteckningsböcker går att läsa.
