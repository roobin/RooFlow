# Kategorier

Kolumnen Kategori i `projects.md` innehåller dina egna namn. `categories` i `rooflow.json` säger vad RooFlow ska göra
med dem. Ramverket känner bara egenskaperna, aldrig namnen.

```json
"categories": {
  "work":    { "label": "jobb" },
  "private": { "label": "privat", "private": true },
  "home":    { "label": "hemma", "machine": "Hemdatorn", "private": true },
  "archive": { "label": "arkiv", "hidden": true }
}
```

- **Nyckeln** (`work`, `home` ...) är ett fast engelskt ord. Du kan lägga till egna.
- **`label`** är ditt eget namn. Det är ingen översättning och byts inte när språket byts.
- Kategorin i `projects.md` matchas mot nyckeln eller `label`, utan hänsyn till stora och små bokstäver.
  En tom ruta eller ett streck betyder ingen kategori.

## Egenskaperna

| Egenskap | Vad den gör |
|---|---|
| `machine` | Projektet bor på en annan dator. Ingen mappkontroll i `/rooflow-doctor`, inga agenter härifrån (`agent.sh` vägrar), syns inte i Servrar, `/agent` säger att det sköts från den datorn |
| `private` | Hamnar aldrig i team-ytan eller i något som delas. `/ship` och team-läget hoppar över det, och `/rooflow-doctor` varnar om det står i `team.sharedRepos` |
| `hidden` | Visas inte i Radar och panelen |

## Utan categories

Saknas nyckeln gäller en standard: bara `archive` är känd (label `arkiv` på svenska, `archive` på engelska), och den är dold.
Då varnar doctor inte för okända kategorier. `/rooflow-setup` föreslår en färdig uppsättning: jobb, privat, hemma, arkiv
(work, private, home, archive på engelska), med namnen från din `projects.md` om den finns.

## Doctor

- Varnar för projekt utan mapp, men bara i läge now och inte för `machine` eller `hidden`.
- Varnar för en kategori i `projects.md` som inte finns i `categories`.
