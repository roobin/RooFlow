# Kommandon

Skriv dem i en session som står i den här anteckningsboksmappen. Vanligt språk fungerar lika bra som kommandot; kommandot är bara en
garanti för att rätt fil uppdateras. Skillsen kommer från pluginet rooflow; en skill med samma namn i anteckningsbokens egen
`.claude/skills` vinner, och så anpassar du ett kommando lokalt. Kommandonamnen är engelska.

Överblicken heter **Radar**: bandet ovanför prompten, panelen `/rooflow` bredvid chatten och `/radar` i chatten.

| Skriv | Vad som händer | Fil |
|---|---|---|
| `/radar` | Visar överblicken: beslut, i dag, löften, väntar, agenter, det som står still | `radar.md` |
| `/rooflow` | Öppnar panelen: Beslut, I dag, Projekt, Agenter, Inkorg, Kommandon, Filer (Servrar om tillägget är på). Kostar inga tokens | läser `status/radar.json` |
| `/radar reset` | Förändringen räknas från nu i stället för från i morse | `status/radar-forra.json` |
| `today: X; Y; Z` | Dagens tre val (också `/radar today X; Y; Z`) | `today.md` |
| `/morning` | Möten (med kalendertillägget), i går, agenter, löften, beslut, fokus | läser allt |
| `/inbox <text>` | Lägger raden i inkorgen | `inbox.md` |
| `/inbox` | Sorterar inkorgen i nu / agent / vänta / senare | `inbox.md` med flera |
| `/promise <vad> to <vem> by <när>` | Registrerar ett löfte | `promises.md` |
| `/promise done <något>` | Bockar av det | `promises.md` |
| `/promise list` | Öppna löften, försenade markerade | `promises.md` |
| `/decisions` | Visar öppna beslut med sitt Id | `decisions.md` |
| `/decisions new: <fråga>` | Lägger till ett beslut med nästa Id | `decisions.md` |
| `B14 a` eller `B14: fritext` | Avgör B14 och flyttar det till arkivet | `decisions.md`, `archive/` |
| `/agent <projekt> <uppdrag>` | Startar en projektsession med en startprompt | `status/<projekt>.md` |
| `/agent` | Vad agenterna gör och frågar | läser |
| `/restart <projekt>` | Startar om projektets tjänst (kommando och url från `rooflow.json`), väntar tills url:en svarar och fortsätter agenterna som står på `Needs: restart` | `scripts/restart.js`, `rooflow.json` |
| `/ship <projekt>` | Checklista före en publicering: öppna B-id, vad rapporterna inte testade, opushade commits, efter publicering. Pushar bara efter ditt ja | `scripts/ship.js`, `after-release.md` |
| `/rooflow-doctor` | Kontrollerar installationen. Ändrar inget | `scripts/doctor.js` |
| `/friday` | Veckans slut: vad som hänt, löften, beslut, en tanke | flera |
| `/handover` | Skriver om överlämningen före en ny session | `handover.md` |
| `/cleanup` | Listar gamla avslutade saker, flyttar dem till `archive/cleaned-ÅÅÅÅ-MM` efter ditt ja. Ångra med `--restore <datum>` | `scripts/cleanup.js` |
| `/start` | Det första i en ny session: överlämningen, sessionsnamn, Radar | `handover.md` |
| `/rooflow-setup` | Introduktion och inställningar: namn, språk, kalender, schemalagd morgon, backup, teamläge, behörigheter. Kan köras igen | `rooflow.json` |

## Fritext som också fungerar

- "Jag lovade Anna att titta på formuläret före onsdag" -> ett löfte.
- "Jag väntar på IT om inloggningen" -> en rad i `promises.md` med `väntar på IT`, visas under VÄNTAR.
- "Kom ihåg att IT vill ha en lista över våra API:er", "idé: ..." -> inkorgen, inte ett beslut.
- "Vad behöver jag besluta?" -> beslut.
- "Vad händer i <projekt>?" -> projektets status.
- "Sessionen börjar bli tung" -> överlämning.

## Varje dag

- **Morgon:** `/morning`, sedan `today: X; Y; Z` (högst tre saker).
- **Titta:** bandet, `/rooflow` för mer, eller `/radar` i chatten.
- **Svara på beslut:** `B2 a` eller `B2: fritext`. Knappen i panelen gör samma sak.
- **Löfte:** "Jag lovade Sam X till fredag". **Väntar:** "Jag väntar på IT om Y". **Idé:** "idé: ..." (inkorgen).
- **Klar för dagen:** `today done 2`, bocka av löften med `/promise done ...`.
- **Agent:** `/agent <projekt> <uppdrag>`. Den syns under RÖR SIG med State och Doing. Frågor från agenter blir B-beslut.
- **Byt session:** `/handover`, en ny session i den här mappen, `/start`.
- **Fredag:** `/friday`.
