# Categories

The Category column in `projects.md` holds your own names. `categories` in `rooflow.json` says what RooFlow should do with
them. The framework only knows the properties, never the names.

```json
"categories": {
  "work":    { "label": "work" },
  "private": { "label": "private", "private": true },
  "home":    { "label": "home", "machine": "Home-PC", "private": true },
  "archive": { "label": "archive", "hidden": true }
}
```

- **The key** (`work`, `home` ...) is a fixed English word. You can add your own.
- **`label`** is your own name. It is not a translation and does not change when the language changes.
- The category in `projects.md` matches the key or the `label`, ignoring case. An empty cell or a dash means no category.

## The properties

| Property | What it does |
|---|---|
| `machine` | The project lives on another computer. No folder check in `/rooflow-doctor`, no agents from here (`agent.sh` refuses), not in Servers, `/agent` says it is run from that computer |
| `private` | Never goes to the team space or into anything that is shared. `/ship` and team mode leave it out, and `/rooflow-doctor` warns if it is in `team.sharedRepos` |
| `hidden` | Not shown in Radar and the panel |

## Without categories

Without the key a default applies: only `archive` is known (label `archive` in English, `arkiv` in Swedish), and it is hidden.
Doctor then does not warn about unknown categories. `/rooflow-setup` proposes a ready set: work, private, home, archive
(jobb, privat, hemma, arkiv in Swedish), with the names from your `projects.md` if it exists.

## Doctor

- Warns about projects without a folder, but only in state now and not for `machine` or `hidden`.
- Warns about a category in `projects.md` that is not in `categories`.
