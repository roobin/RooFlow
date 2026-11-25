# run.json

`run.json` säger vilka kommandon fliken Servrar kan starta för ett projekt. Den ligger lokalt i projektets mapp
(eller i mappen som `projects.<slug>.run` pekar ut) och läses av `scripts/radar.js`. Tillägget slås på med
`"addons": { "servers": true }` i `rooflow.json`. Bara Windows.

## Format

En lista, ett objekt per kommando:

```json
[
  { "namn": "kör", "cmd": "dotnet run", "cwd": "src/App" },
  { "namn": "css", "cmd": "npm run css" },
  { "namn": "admin", "cmd": "App.exe", "konto": "svc.admin" }
]
```

- `namn`: bokstäver, siffror, `-` och `_`, högst 40 tecken.
- `cmd`: kommandot, högst 400 tecken.
- `cwd` (valfri): mappen kommandot körs i, relativ till mappen där `run.json` ligger.
- `konto` (valfri): kör som ett annat konto med `runas`; Windows frågar efter lösenordet i fönstret.

## Var den ligger

Projektets mapp är `rooflow.json` `projects.<slug>.folder`, annars `<projectsDir>/<Mapp>`. `<slug>` är kolumnen Folder i
`projects.md` med små bokstäver. Ligger `run.json` någon annanstans, till exempel i roten av ett större repo:

```json
"projects": {
  "sub.project": { "folder": "../Repo/Sub.Project", "run": "../Repo" }
}
```

`/rooflow-doctor` varnar för projekt vars mapp inte hittas och för en `run`-mapp utan `run.json`.
