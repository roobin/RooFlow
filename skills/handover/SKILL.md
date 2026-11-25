---
name: handover
description: Rewrite handover.md before Tower (the session in the notebook) is replaced. Run when the owner types /handover, says the session is getting too big, or when the context approaches its limit.
---

# /handover

Answer in the owner's language (`language` in `rooflow.json`). Work from the notebook folder. Rewrite `handover.md` completely,
in this order:

1. **Where things stand**: three to five lines about where the notebook and the work stand.
2. **Done**: since the last handover, dated, one line per thing.
3. **Threads in progress**: everything half finished, with what remains.
4. **Next steps**: numbered, the first one must be possible to start at once.
5. **Decisions taken**: short, so that the next session does not open them again.
6. **What the next session must know**: traps, locked files, things that do not show in the code.

Remove everything that is done and no longer needed. The file should be readable in two minutes.

Then check that `promises.md`, `decisions.md` and `inbox.md` are current. If the notebook is a git repository, commit it with the
message `docs: handover YYYY-MM-DD` (only the notebook's own files); if it is not, skip the commit without a word (`/rooflow-setup`
offers a local repository). If `backup.type` in `rooflow.json` is `git` and `backup.when`
is `commit`, run the backup as `rooflow-setup` describes under "Running the backup".

Finish with one line to the owner: "Handover done. Start a new session in this folder and type /start."
