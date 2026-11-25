# Bandet och panelen

Radar visar anteckningsboken på två ställen. Båda läser `status/radar.json`, som `scripts/radar.js` skriver var femte minut.
Att titta kostar inga tokens.

## Bandet

En rad ovanför prompten: Beslut, Idag, Agenter (som kör och som väntar), Kontext, Vecka, Panel och ↻.

- Beslut, Idag och Agenter öppnar sin flik i panelen.
- **Panel** (tangent `p`) öppnar och stänger panelen. Öppen: ifylld `● Panel`. Stängd: `○ Panel`.
- **↻** (tangent `u`) läser om allt.

## Panelen

Öppnas med Panel i bandet eller `/rooflow <flik>`. Flikarna har siffertangenter i ordning. Den valda fliken är ifylld.

- **Beslut:** frågor som väntar på dig, med svarsknappar.
- **Idag:** dagens tre, löften som förfaller och vad du väntar på.
- **Projekt:** projekten i `projects.md`, per läge. Ett klick öppnar projektrummet.
- **Servrar** (tillägg): kommandona i projektens `run.json`. Rubriken per projekt fälls ihop med ett klick.
- **Agenter:** väntar på omstart, deploy, beslut; Kör nu; övriga i rörelse; rapporter; underagenter. Varje rubrik fälls ihop.
- **Inkorg, Kommandon, Filer** och **? Hjälp** (de här sidorna).

Hopfällda rubriker minns pluginet till nästa session. Siffrorna i fliken Agenter är desamma som i bandet:
Kör nu är bara agenter vars statusfil säger `State: running` och som uppdaterats de senaste två timmarna.
En agent med `Needs:` räknas som väntande, inte som körande.
