# Beslut

Frågor som bara du kan avgöra står i `decisions.md` under `## Open`, var och en med ett Id (B1, B2 ...). De syns i bandet
(Beslut N) och i panelens flik Beslut.

## Svara

- I panelen: fäll ut beslutet och tryck på ett alternativ, eller skriv ett fritt svar. Det kostar ingen tur:
  `scripts/decide.js` skriver beslutet och flyttar blocket till arkivet.
- I chatten: `B14 a` eller `B14: fri text`.

## När beslutet hör till en agent

Agenten fortsätter av sig själv. Panelen visar först "Fortsätter <uppdrag> om 4 s · Ångra".

- **Ångra:** beslutet står kvar, men inget skickas. Knappen "Fortsätt agenten" visas i fliken Beslut och skickar när du vill.
- Ett fritt svar som börjar med "vänta", "inte nu", "stopp" eller "nej" ("wait", "not now", "stop", "no") skickar inget av
  sig självt; knappen väntar i stället.

Inställning i `rooflow.json`:

```json
"decisions": { "autoContinue": true, "undoSeconds": 4 }
```

`"autoContinue": false` ger det gamla sättet: panelen fyller i prompten och du skickar den själv. `undoSeconds` är ett heltal
från 1 till 60.
