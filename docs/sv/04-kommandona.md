# Kommandona

Skrivs i en session som står i anteckningsboken. Vanligt språk fungerar lika bra; kommandot är en garanti för att rätt fil ändras.

| Kommando | Vad som händer |
|---|---|
| `/radar` | Överblicken: beslut, idag, löften, väntar, agenter, det som står still |
| `/rooflow <flik>` | Öppnar panelen på en flik. Kostar inga tokens |
| `/morning` | Möten, igår, agenter, löften, beslut och förslag på fokus |
| `/inbox <text>` | Lägger raden i inkorgen; `/inbox` utan text sorterar |
| `/promise <vad> till <vem> senast <när>` | Registrerar ett löfte |
| `/decisions` | Visar öppna beslut; `B14 a` eller `B14: fri text` avgör |
| `/agent <projekt> <uppdrag>` | Startar en projektagent; `--tree` eller "i trädet" gör den till en session i sidofältet |
| `/restart <projekt>` | Startar om projektets tjänst och fortsätter agenterna som väntar på omstart |
| `/ship <projekt>` | Checklista före en release; pushar bara efter ditt ja |
| `/rooflow-doctor` | Kontrollerar installationen. Ändrar inget |
| `/cleanup` | Flyttar gammalt till arkivet |
| `/friday` | Veckan i backspegeln |
| `/handover` | Skriver om överlämningen |
| `/rooflow-setup` | Inställningarna, en fråga i taget |

Panelens flik Kommandon har en knapp per kommando. Varje tryck kostar en tur.

## Uppdatera ett lokalt utvecklat plugin

Gäller den som utvecklar pluginet själv och installerar det från en lokal marketplace (en mapp med git-repo).

- `claude plugin update rooflow@<marketplace>` hämtar bara något när versionen i `plugin.json` har höjts. Annars säger den
  "already at the latest version", även om källrepot har nya commits.
- Utan höjd version: kör i anteckningsboken `claude plugin uninstall rooflow@<marketplace> --scope local --keep-data` och sedan
  `claude plugin install rooflow@<marketplace> --scope local` (byt `local` mot `user` om pluginet är installerat för användaren).
- Kontrollera: posten för pluginet i `~/.claude/plugins/installed_plugins.json` har `gitCommitSha`, som ska vara samma som
  `git rev-parse HEAD` i källrepot. `/rooflow-doctor` jämför dem och varnar när installationen är äldre.
- Ändringen syns först i en ny session.
