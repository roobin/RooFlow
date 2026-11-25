State: running | asking | done | stuck
Doing: <en mening>
Needs: restart | deploy | B<n> | <kort fritext>   (valfri: bara medan agenten väntar)
Task: <uppdragets slug = den här filens namn>
Project: <projektet i projects.md>
Updated: ÅÅÅÅ-MM-DD HH:MM

# Status: <projekt>

Skrivs av projektets agent vid start, vid varje byte av läge och vid avslut. Högst 15 rader.
Raderna överst är agentkontraktet: överblicken läser dem, utan punkt, alltid först i filen. Nycklarna och värdena är engelska.
`asking` = ett beslut med B-id väntar i decisions.md (skriv också `Needs: B<n>`). `stuck` = kommer inte vidare.
`Needs` tas bort av den som löser väntan (omstartsskriptet, `scripts/decide.js` eller agenten), som också sätter State.

- Mål: ...
- Nästa steg: ...
- Blockerat: ...
- Gren: ...
- Modell/ansträngning: ...
- Kontext: ungefär N % av fönstret använt (en gissning: lästa filer och turer, eller /context om det finns)
- Senaste rapport: (slutrapporten, högst 15 rader, när körningen är klar)
