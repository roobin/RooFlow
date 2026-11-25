# run.json

`run.json` lists the commands the Servers tab can start for a project. It lives locally in the project's folder (or in the
folder `projects.<slug>.run` names) and is read by `scripts/radar.js`. The addon is turned on with
`"addons": { "servers": true }` in `rooflow.json`. Windows only.

## Format

A list, one object per command:

```json
[
  { "namn": "run", "cmd": "dotnet run", "cwd": "src/App" },
  { "namn": "css", "cmd": "npm run css" },
  { "namn": "admin", "cmd": "App.exe", "konto": "svc.admin" }
]
```

- `namn`: letters, digits, `-` and `_`, at most 40 characters.
- `cmd`: the command, at most 400 characters.
- `cwd` (optional): the folder the command runs in, relative to the folder that holds `run.json`.
- `konto` (optional): run as another account with `runas`; Windows asks for the password in the window.

## Where it lives

The project's folder is `rooflow.json` `projects.<slug>.folder`, otherwise `<projectsDir>/<Folder>`. `<slug>` is the Folder
column of `projects.md` in lower case. When `run.json` lives elsewhere, for example at the root of a larger repository:

```json
"projects": {
  "sub.project": { "folder": "../Repo/Sub.Project", "run": "../Repo" }
}
```

`/rooflow-doctor` warns about a project whose folder is not found and about a `run` folder without `run.json`.
