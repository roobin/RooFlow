import { alternativPaRader } from '../hooks/las'
import { describe, expect, test } from 'claude-code/testing'

import {
  arSparrad, beslutSignatur, filRad, hoppaOverProjekt, loftenInom, SPARR_MS, winSokvag,
  inkorgFil,
  filLank, filtreraFiler, kontrast, pil, projektFarg, raderFor, runasArgv, beslutEtikett, beslutKortRader, sammanfattning, slugFor, svarsPrompt, textPa, tolkaFarger,
  tolkaInboxSvar, arBekraftad, fastaFiler, senasteFiler, filMappar, hoppaOverFiler,
  arLeverans, beslutGrupper, beslutRad, FORMAT, formatVarning, gammalText, inkorgAntal, inkorgTotal, rapportFalt, rapportOrdning, senasteLeveranser, svarsEtikett,
  antalVantar, bandDelar, tolkaDecideSvar, hittaRot, tolkaKonfig, vsCodeArgv, oppnaUrlArgv, skiljetecken, relUnderRot,
  tolkaRadarJson, arTryckt, kortDatum, localhost, nyaBeslut, tolkaServrar, tolkaServrarSvar, TRYCK_MS,
  arUtfalld, tolkaOppet, tolkaMorgon, punktaRader,
} from '../hooks/las'
import { en, sv, stringsFor } from '../hooks/strings'
import { filnamn, FILER, oversattNycklar, JOURNAL, LAGEN, normaliseraHandelse, normaliseraLage, ORAPPORTERAD, RUBRIKER } from '../hooks/format'

const JSON_TEXT = JSON.stringify({
  genererad: '2026-10-21 17:00',
  antal: { behover: 1, idag: 1, lovat: 2, vantar: 0, rorsig: 1, starstill: 2, inkorg: 30 },
  usage: { femh: '3', vecka: '11' },
  beslut: [{ id: 'B3', rubrik: 'Panelen som mod', datum: '2026-10-20', alder: '1 d', fragar: 'RooFlow', blockerar: '', alternativ: [] }],
  idag: { datum: '2026-10-21', saker: [{ klar: true, text: 'a' }, { klar: false, text: 'b' }] },
  loften: [{ datum: '2026-10-22', vem: 'Pat', vad: 'x', nar: 'IMORGON' }, { datum: '2026-10-19', vem: 'Sam', vad: 'y', nar: 'FÖRSENAT' }],
  rorSig: [{ slug: 'rooflow', namn: 'RooFlow', vad: 'bygger', lage: 'kör 5 min', sedan: '', modell: 'opus' }],
  korNu: ['rooflow'],
  starStill: [{ mapp: 'XY' }, { mapp: 'Tools' }],
  projekt: [],
  skills: [],
})

describe('las', () => {
  test('radar.json tolkas, trasig json ger null', () => {
    expect(tolkaRadarJson(JSON_TEXT)?.beslut[0]?.id).toBe('B3')
    expect(tolkaRadarJson('{trasig')).toBe(null)
    expect(tolkaRadarJson('{"antal":{}}')).toBe(null)
  })

  test('rad 1: Idag N (kvar), Agenter N kör och Kontext X %; ingen förbrukning', () => {
    const d = tolkaRadarJson(JSON_TEXT)
    if (!d) throw new Error('ingen data')
    const rad = sammanfattning(d, 41.6, sv)
    expect(rad).toBe('Idag 1 · Agenter 1 kör · Kontext 42 %')
    expect(rad).not.toMatch(/Radar|försenat|står still|5h|vecka|v \d/i)
  })

  test('rad 1: utan kontextsiffra utelämnas Kontext; inga agenter och inga idag-val sägs rakt ut', () => {
    const d = tolkaRadarJson(JSON_TEXT)
    if (!d) throw new Error('ingen data')
    expect(sammanfattning(d, null, sv)).toBe('Idag 1 · Agenter 1 kör')
    expect(sammanfattning({ ...d, korNu: [], idag: { datum: '', saker: [] } }, 0, sv)).toBe('Idag – · Agenter 0 kör · Kontext 0 %')
  })

  test('korNu tolkas, saknas den (gammal radar.json) blir den tom', () => {
    expect(tolkaRadarJson(JSON_TEXT)?.korNu).toEqual(['rooflow'])
    const utan = JSON.parse(JSON_TEXT)
    delete utan.korNu
    expect(tolkaRadarJson(JSON.stringify(utan))?.korNu).toEqual([])
  })

  test('beslutsetiketten säger Beslut N', () => {
    expect(beslutEtikett(3, sv)).toBe('Beslut 3')
    expect(beslutEtikett(0, sv)).toBe('Beslut 0')
  })

  test('hovringskortet: Id, rubrik, ålder och förslag; högst fem och sedan "och N till"', () => {
    const d = tolkaRadarJson(JSON_TEXT)
    if (!d) throw new Error('ingen data')
    const b = { ...d.beslut[0], alternativ: [{ bokstav: 'a', text: 'Ja', forslag: false }, { bokstav: 'c', text: 'Kanske', forslag: true }] }
    const sju = Array.from({ length: 7 }, (_, i) => ({ ...b, id: `B${i + 1}` }))
    const rader = beslutKortRader(sju, 100, sv)
    expect(rader.length).toBe(6)
    expect(rader[0]).toMatch(/^B1 .+ · .+ · förslag: [a-z]\) /)
    expect(rader[5]).toBe('och 2 till')
    expect(beslutKortRader(sju.slice(0, 5), 100, sv).length).toBe(5)
    expect(beslutKortRader([{ ...b, alternativ: [] }], 100, sv)[0]).not.toMatch(/förslag/)
  })

  test('svarsprompten är bara id och bokstav; skillen beslut kan resten', () => {
    const p = svarsPrompt({ id: 'B14', rubrik: 'x', datum: '', alder: '', fragar: '', blockerar: '', alternativ: [] }, 'a')
    expect(p).toBe('B14 a')
  })

  test('fillänkar, filfilter och runas', () => {
    expect(filLank('C:\\work\\notes\\status\\in.md')).toBe('file:///C:/work/notes/status/in.md')
    expect(filLank('C:\\work\\Köket\\a b.md')).toBe('file:///C:/work/K%C3%B6ket/a%20b.md')
    const fil = (rel: string, mtimeMs: number) => ({ sokvag: `C:\\work\\notes\\${rel.replace('/', '\\')}`, rel, mtimeMs })
    const f = filtreraFiler([fil('a.md', 1), fil('tankar/b.md', 3), fil('c.md', 2)], '', 2)
    expect(f.map(x => x.rel).join(',')).toBe('tankar/b.md,c.md')
    expect(filtreraFiler([fil('tankar/b.md', 3), fil('c.md', 2)], 'TANK', 5).length).toBe(1)
    expect(filtreraFiler([fil('tankar/b.md', 3)], 'notes\\tankar', 5).length).toBe(1)
    expect(runasArgv('svc.admin', 'dotnet run', 'C:\\work\\beta').join(' ')).toBe('cmd /c start runas /user:svc.admin cmd /k cd /d C:\\work\\beta && dotnet run')
  })
})

describe('utseende (22/10)', () => {
  test('färgtabell, kontrast och textfärg', () => {
    const f = tolkaFarger('{"Alpha":"#FBCC3F","trasig":"röd","kort":"#fff"}')
    expect(JSON.stringify(f)).toBe('{"alpha":"#fbcc3f"}')
    expect(JSON.stringify(tolkaFarger('{trasig'))).toBe('{}')
    expect(projektFarg(f, 'Alpha')).toBe('#fbcc3f')
    expect(projektFarg(f, 'okänt')).toBe('subtle')
    expect(Math.round(kontrast('#000000', '#ffffff'))).toBe(21)
    expect(textPa('#fbcc3f')).toBe('#000000')
    expect(textPa('#5c2d91')).toBe('#ffffff')
    for (const hex of ['#777777', '#047bcc', '#e17c5a', '#8d66dc']) expect(kontrast(hex, textPa(hex)) >= 4.5).toBe(true)
  })

  test('morgonfilens första rad tas isär; utan rubrik är hela filen text', () => {
    const m = tolkaMorgon('Morgon tisdag 2026-11-24 07:58 (/morgon)\n\nInga möten i dag.\nIgår: mycket.\n')
    expect(m.rubrik).toEqual({ kommando: '/morgon', veckodag: 'tisdag', datum: '2026-11-24', tid: '07:58' })
    expect(m.text).toBe('Inga möten i dag.\nIgår: mycket.')
    expect(tolkaMorgon('﻿Morning Tuesday 2030-01-22 7:05 (/morning)\r\n- 09:00 X').rubrik?.tid).toBe('7:05')
    expect(tolkaMorgon('- 09:00 Möte om Gamma')).toEqual({ rubrik: null, text: '- 09:00 Möte om Gamma' })
    expect(tolkaMorgon('').rubrik).toBe(null)
  })

  test('punktaRader: vanliga rader blir listposter, tabeller, listor, rubriker och kod lämnas', () => {
    expect(punktaRader('Inga möten.\n\nIgår: x')).toBe('- Inga möten.\n- Igår: x')
    expect(punktaRader('- redan\n| a | b |\n|---|---|\n## R\n1. ett')).toBe('- redan\n| a | b |\n|---|---|\n## R\n1. ett')
    expect(punktaRader('```\nkod\n```')).toBe('```\nkod\n```')
  })

  test('hopfällt läge: standard utfällt, sparat läge vinner, bara true/false läses ur store', () => {
    expect(arUtfalld({}, 'servrar:alpha')).toBe(true)
    expect(arUtfalld({ 'servrar:alpha': false }, 'servrar:alpha')).toBe(false)
    expect(tolkaOppet({ a: false, b: true, c: 'x', d: 1 })).toEqual({ a: false, b: true })
    expect(tolkaOppet(null)).toEqual({})
    expect(tolkaOppet(['a'])).toEqual({})
  })

  test('pil, slug och radbrytning', () => {
    expect(pil(true)).toBe('▼')
    expect(pil(false)).toBe('▶')
    const p = [{ mapp: 'Alpha', slug: 'alpha' }, { mapp: 'Timekeepers', slug: 'timekeepers' }]
    expect(slugFor(p, ' timekeepers ')).toBe('timekeepers')
    expect(slugFor(p, 'okänt')).toBe('')
    expect(raderFor(130, 60)).toBe(3)
    expect(raderFor(0, 60)).toBe(1)
  })
})

describe('panelen (26/10)', () => {
  const b = { id: 'B7', rubrik: 'Gränssnitt v2', datum: '', alder: '1 h', fragar: 'RooFlow', blockerar: '', alternativ: [{ bokstav: 'a', text: 'ja', forslag: true }], text: '- Id: B7' }

  test('spärren: håller i två minuter, släpper när beslutet ändrats eller försvunnit', () => {
    const s = { tid: '14:05', ms: 1_000_000, bokstav: 'a', signatur: beslutSignatur(b) }
    expect(arSparrad(s, b, 1_000_000 + 60_000)).toBe(true)
    expect(arSparrad(s, { ...b, alder: '2 h' }, 1_000_000 + 60_000)).toBe(true)
    expect(arSparrad(s, b, 1_000_000 + SPARR_MS)).toBe(false)
    expect(arSparrad(s, { ...b, text: '- Id: B7\n- Beslut: a' }, 1_000_000 + 1000)).toBe(false)
    expect(arSparrad(s, undefined, 1_000_000 + 1000)).toBe(false)
    expect(arSparrad(undefined, b, 1_000_000)).toBe(false)
  })

  test('fillänk med full sökväg, löften inom tre dagar, projektmappar som hoppas över', () => {
    expect(filRad('C:\\work\\notes\\status\\_mall.md')).toBe('[C:\\\\work\\\\notes\\\\status\\\\_mall.md](file:///C:/work/notes/status/_mall.md)')
    expect(winSokvag('C:\\work\\alpha\\', 'docs/a.md')).toBe('C:\\work\\alpha\\docs\\a.md')
    const l = (datum: string) => ({ datum, vem: 'x', vad: 'y', nar: '' })
    expect(loftenInom([l('2026-10-20'), l('2026-10-24'), l('2026-10-25')], '2026-10-21', 3).map(x => x.datum).join(',')).toBe('2026-10-20,2026-10-24')
    expect(hoppaOverProjekt('bin/Debug')).toBe(true)
    expect(hoppaOverProjekt('src/App/obj')).toBe(true)
    expect(hoppaOverProjekt('docs/plan.md')).toBe(false)
  })
})

describe('etapp 2', () => {
  test('tolkaRadarJson fyller i inkorg och agenter när en äldre radar.json saknar dem', () => {
    const d = tolkaRadarJson(JSON.stringify({ antal: {}, beslut: [], projekt: [] }))
    expect(d?.inkorg).toEqual({ antal: 0, aldsta: '', rader: [], sektioner: [], angra: '' })
    expect(d?.format).toBe(0)
    expect(d?.agenter).toEqual({ underagenter: [], rapporter: [] })
    expect(d?.forbrukning).toBe(null)
  })

  test('kort datum', () => {
    expect(kortDatum('2026-10-03')).toBe('3/10')
  })

  test('arTryckt håller i TRYCK_MS', () => {
    expect(arTryckt(undefined, 0)).toBe(false)
    expect(arTryckt({ ms: 1000 }, 1000 + TRYCK_MS - 1)).toBe(true)
    expect(arTryckt({ ms: 1000 }, 1000 + TRYCK_MS)).toBe(false)
  })

  test('nyaBeslut: första läsningen är baslinje, sedan bara okända id', () => {
    const b = (id: string) => ({ id, rubrik: id, datum: '', alder: '', fragar: '', blockerar: '', alternativ: [] })
    expect(nyaBeslut(null, [b('B1')])).toEqual([])
    expect(nyaBeslut(['B1'], [b('B1'), b('B2')]).map(x => x.id)).toEqual(['B2'])
    expect(nyaBeslut([], [b('')])).toEqual([])
  })

  test('svaren från scripts/servers.js', () => {
    expect(tolkaServrarSvar('skräp\n{"fel":"nej"}\n')).toEqual({ fel: 'nej' })
    expect(tolkaServrarSvar('inte json')).toBe(null)
    expect(tolkaServrar('{"fel":"x"}')).toEqual({})
    const s = tolkaServrar('{"xy-kör":{"slug":"xy","namn":"kör","pid":12,"startad":"10:00","lever":true,"portar":[5000]},"trasig":{"pid":"x"}}')
    expect(Object.keys(s)).toEqual(['xy-kör'])
    expect(s['xy-kör']).toEqual({ nyckel: 'xy-kör', slug: 'xy', namn: 'kör', pid: 12, startad: '10:00', lever: true, portar: [5000] })
    expect(localhost(5000)).toBe('http://localhost:5000')
  })

  test('svenska och engelska filnamn och värden', () => {
    expect(filnamn('inkorg', rel => rel === 'inbox.md')).toBe('inbox.md')
    expect(filnamn('inkorg', () => false)).toBe('inkorg.md')
    expect(filnamn('underagenter', rel => rel === 'status/subagents.jsonl')).toBe('status/subagents.jsonl')
    expect(FILER.beslut.en).toBe('decisions.md')
    expect(normaliseraLage('running')).toBe('kör')
    expect(normaliseraLage('Asking (B3)')).toBe('frågar')
    expect(normaliseraLage('stuck')).toBe('fast')
    expect(normaliseraLage('klar')).toBe('klar')
    expect(Object.keys(LAGEN)).toEqual(['kör', 'frågar', 'klar', 'fast'])
    expect(normaliseraHandelse('done')).toBe('klar')
    expect(normaliseraHandelse('start')).toBe('start')
  })

  test('radar.json bär filnamn, inkorgFil väljer engelska om scripts/radar.js hittade den', () => {
    const d = tolkaRadarJson(JSON_TEXT)
    if (!d) throw new Error('ingen data')
    expect(inkorgFil(d)).toBe('inkorg.md')
    const en = tolkaRadarJson(JSON.stringify({ ...JSON.parse(JSON_TEXT), filnamn: { inkorg: 'inbox.md' } }))
    if (!en) throw new Error('ingen data')
    expect(inkorgFil(en)).toBe('inbox.md')
  })

  test('rubriker och journalnycklar finns på båda språken', () => {
    expect(RUBRIKER.klart).toEqual(['Klara', 'Klart', 'Done'])
    expect(RUBRIKER.idag).toEqual(['Idag', 'Today'])
    expect(JOURNAL.tid).toEqual(['tid', 'time'])
    expect(JOURNAL.projekt).toEqual(['projekt', 'project'])
    expect(JOURNAL.rapport).toEqual(['rapport', 'report'])
    expect(ORAPPORTERAD).toEqual(['orapporterad', 'unreported'])
  })
})

describe('inkorg och filer (24/11)', () => {
  test('svaret från scripts/inbox.js: ok, fel eller inget', () => {
    expect(tolkaInboxSvar('{"ok":true,"klar":"aaaa1111"}\n', sv, 'inbox.js')).toEqual({ ok: true })
    expect(tolkaInboxSvar('{"fel":"ingen post med hash x"}', sv, 'inbox.js')).toEqual({ fel: 'ingen post med hash x' })
    expect(tolkaInboxSvar('', sv, 'inbox.js')).toEqual({ fel: 'inget svar från scripts/inbox.js' })
  })

  test('bekräftelsen av Ta bort gäller för samma post i tio sekunder', () => {
    expect(arBekraftad({ hash: 'a', ms: 1000 }, 'a', 10_999)).toBe(true)
    expect(arBekraftad({ hash: 'a', ms: 1000 }, 'a', 11_000)).toBe(false)
    expect(arBekraftad({ hash: 'a', ms: 1000 }, 'b', 1500)).toBe(false)
    expect(arBekraftad(null, 'a', 1500)).toBe(false)
  })

  test('Filer: fästa i fast ordning, senaste utan arkiv, mappar med arkivet märkt', () => {
    const rot = 'C:\\work\\notes'
    const f = (rel: string, ms: number) => ({ sokvag: winSokvag(rot, rel), rel, mtimeMs: ms })
    const alla = [f('inbox.md', 1), f('decisions.md', 2), f('notes/a.md', 9), f('archive/x.md', 10), f('briefs/b.md', 8), f('status/logg/l.md', 7), f('status/s.md', 6)]
    expect(fastaFiler(alla, rot).map(x => x.rel)).toEqual(['decisions.md', 'inbox.md'])
    expect(senasteFiler(alla, rot, 3).map(x => x.rel)).toEqual(['notes/a.md', 'status/s.md', 'decisions.md'])
    const m = filMappar(alla, rot, sv)
    expect(m.map(x => `${x.namn}${x.arkiv ? '*' : ''}`)).toEqual(['(roten)', 'briefs', 'notes', 'status', 'archive*', 'status/logg*'])
    expect(hoppaOverFiler('archive/x.md')).toBe(false)
    expect(hoppaOverFiler('node_modules/y')).toBe(true)
  })
})

describe('Needs, decisions and report fields', () => {
  const B = (id: string, projekt: string | undefined, blockerar: string, forslag = false) => ({
    id, rubrik: `Rubrik ${id}`, datum: '', alder: '2 d', fragar: 'x', blockerar, projekt,
    alternativ: [{ bokstav: 'a', text: 'Gör det på det första sättet och sedan något mer som gör texten lång nog att kapas', forslag }],
  })

  test('svarsknappens etikett: bokstav, kort text och förslag, utan (1 tur)', () => {
    expect(svarsEtikett({ bokstav: 'b', text: 'Gör det på det första sättet', forslag: true }, sv)).toBe('B (förslag)')
    expect(svarsEtikett({ bokstav: 'a', text: 'kort', forslag: false }, sv)).toBe('A')
  })

  test('beslut grupperas per Project, de som blockerar en agent först', () => {
    const g = beslutGrupper([B('B0', 'zzz', ''), B('B1', 'gamma', ''), B('B2', undefined, ''), B('B3', 'xy', 'agent xy'), B('B4', 'gamma', 'agent gamma'), B('B5', 'gamma', '')], sv)
    expect(g.map(x => x.projekt)).toEqual(['gamma', 'xy', 'zzz', 'Utan projekt'])
    expect(g[0]?.lista.map(b => b.id)).toEqual(['B4', 'B1', 'B5'])
  })

  test('beslutsraden: Id, rubrik, ålder, blockerar, förslag och visa/dölj i text', () => {
    const r = beslutRad(B('B7', 'gamma', 'agent gamma', true), false, 80, sv)
    expect(r).toBe('▸ B7 · Rubrik B7 · 2 d · blockerar agent gamma · förslag a · visa')
    expect(beslutRad(B('B7', 'gamma', '', false), true, 80, sv)).toBe('▾ B7 · Rubrik B7 · 2 d · dölj')
  })

  test('formatet: rätt tal ger ingen varning, saknat eller okänt ger text', () => {
    const d = tolkaRadarJson(JSON.stringify({ antal: { x: 1 }, beslut: [], projekt: [], format: FORMAT }))!
    expect(formatVarning(d, sv)).toBe('')
    expect(formatVarning({ ...d, format: 0 }, sv)).toMatch(/saknar formatnummer/)
    expect(formatVarning({ ...d, format: 2 }, sv)).toMatch(/format 2/)
  })

  test('gammal data: över 15 minuter ger "Radar HH:MM gammal", annars inget', () => {
    const nu = new Date(2026, 10, 24, 14, 30).getTime()
    expect(gammalText('2026-11-24 14:20', nu, sv)).toBe('')
    expect(gammalText('2026-11-24 14:05', nu, sv)).toBe('Radar 14:05 gammal')
    expect(gammalText('2026-11-23 09:00', nu, sv)).toBe('Radar 09:00 gammal')
    expect(gammalText('', nu, sv)).toBe('')
  })

  test('inkorgens siffra räknar bara Now och poster utan rubrik', () => {
    const p = (n: number) => Array.from({ length: n }, (_, i) => ({ hash: `h${n}${i}`, text: 't' }))
    const d = tolkaRadarJson(JSON.stringify({
      antal: { x: 1 }, beslut: [], projekt: [],
      inkorg: { antal: 40, aldsta: '', rader: [], sektioner: [{ namn: '', poster: p(1) }, { namn: 'Now', poster: p(2) }, { namn: 'Agent', poster: p(5) }, { namn: 'Later', poster: p(30) }] },
    }))!
    expect(inkorgAntal(d)).toBe(3)
    expect(inkorgTotal(d)).toBe(38)
    expect(inkorgAntal({ ...d, inkorg: { ...d.inkorg, sektioner: [] } })).toBe(40)
  })

  test('rapporter: de orapporterade först, Ägare: och Blockerat: korta', () => {
    const o = rapportOrdning([{ id: 'a', orapporterad: false }, { id: 'b', orapporterad: true }, { id: 'c', orapporterad: false }, { id: 'd', orapporterad: true }])
    expect(o.map(x => x.id)).toEqual(['b', 'd', 'a', 'c'])
    expect(rapportFalt({ owner: 'B7', blockerat: '' }, sv)).toEqual(['Ägare: B7'])
    expect(rapportFalt({}, sv)).toEqual([])
    expect(rapportFalt({ owner: 'x'.repeat(300) }, sv)[0]?.length).toBeLessThan(120)
  })

  test('leveranser: bara html och pdf, nyast först', () => {
    expect(arLeverans('a.HTML')).toBe(true)
    expect(arLeverans('a.pdf')).toBe(true)
    expect(arLeverans('a.png')).toBe(false)
    const f = (rel: string, ms: number) => ({ sokvag: rel, rel, mtimeMs: ms })
    expect(senasteLeveranser([f('a', 1), f('b', 3), f('c', 2)], 2).map(x => x.rel)).toEqual(['b', 'c'])
  })
})

describe('Needs, beslut utan tur och svenska nycklar', () => {
  const D = (vantarPa?: object) => {
    const d = tolkaRadarJson(JSON_TEXT)
    if (!d) throw new Error('ingen data')
    return { ...d, ...(vantarPa ? { vantarPa } : {}) } as typeof d
  }
  const P = (n: string) => ({ slug: n, namn: n, behover: 'restart', sedan: '', gorNu: '' })

  test('äldre radar.json utan vantarPa ger tomma grupper och 0 väntar', () => {
    const d = D()
    expect(d.vantarPa).toEqual({ restart: [], deploy: [], beslut: [], annat: [] })
    expect(antalVantar(d)).toBe(0)
    expect(bandDelar(d, null, sv).agenter).toBe('Agenter 1 kör')
  })

  test('bandet: Agenter N kör · M väntar, kort, en rad', () => {
    const d = D({ restart: [P('a'), P('b')], deploy: [P('c')], beslut: [], annat: [P('d')] })
    expect(antalVantar(d)).toBe(4)
    expect(bandDelar(d, null, sv).agenter).toBe('Agenter 1 kör, 4 väntar')
    expect(sammanfattning(d, null, sv)).toBe('Idag 1 · Agenter 1 kör, 4 väntar')
  })

  test('data från en gammal atom (vantarPa saknas helt) kraschar inte antalVantar', () => {
    expect(antalVantar({ ...D(), vantarPa: undefined } as never)).toBe(0)
  })

  test('decide.js-svaret: ok med task, fel och skräp', () => {
    expect(tolkaDecideSvar('{"ok":true,"id":"B3","svar":"a","task":"alpha"}\n', sv)).toEqual({ ok: true, id: 'B3', svar: 'a', task: 'alpha' })
    expect(tolkaDecideSvar('{"ok":true,"id":"B3","svar":"a"}', sv)).toEqual({ ok: true, id: 'B3', svar: 'a', task: '' })
    expect(tolkaDecideSvar('{"fel":"inte öppen"}', sv)).toEqual({ fel: 'inte öppen' })
    expect('fel' in tolkaDecideSvar('skräp', sv)).toBe(true)
    expect(sv.continuePrompt('B3', 'a', 'gamma-cookies')).toBe('Fortsätt gamma-cookies: B3 är avgjort med svaret "a".')
    expect(en.continuePrompt('B3', 'a', 'gamma-cookies')).toBe('Continue gamma-cookies: B3 is decided with the answer "a".')
  })

  test('oversattNycklar: nycklarna på svenska, värden och löptext orörda, kodstaket och "en" lämnas', () => {
    const t = ['- Id: B1', '- Question: Är Date: viktig?', '- Why it matters: x', '- Options: a) b)', '- Blocks: y', '- Asked by: z', '- Date: 2026-11-24', '- Project: p', '- Task: t', '- Decision:', 'Se Question: i texten'].join('\n')
    expect(oversattNycklar(t, 'sv')).toBe(['- Id: B1', '- Fråga: Är Date: viktig?', '- Varför det spelar roll: x', '- Alternativ: a) b)', '- Blockerar: y', '- Frågar: z', '- Datum: 2026-11-24', '- Projekt: p', '- Uppdrag: t', '- Beslut:', 'Se Question: i texten'].join('\n'))
    expect(oversattNycklar('State: asking\nDoing: x\nUpdated: 2026-11-24\nNeeds: restart', 'sv')).toBe('Läge: frågar\nGör nu: x\nUppdaterad: 2026-11-24\nBehöver: restart')
    expect(oversattNycklar('**Question:** x\r\nState: running', 'sv')).toBe('**Fråga:** x\r\nLäge: kör')
    expect(oversattNycklar('```\nQuestion: x\n```\n- Question: y', 'sv')).toBe('```\nQuestion: x\n```\n- Fråga: y')
    expect(oversattNycklar('- Question: x', 'en')).toBe('- Question: x')
    expect(oversattNycklar('- Fråga: x\nLäge: kör\nGör nu: y', 'en')).toBe('- Question: x\nState: running\nDoing: y')
    expect(oversattNycklar('Läge: frågar\n```\nFråga: z\n```', 'en')).toBe('State: asking\n```\nFråga: z\n```')
    expect(oversattNycklar('', 'sv')).toBe('')
  })
})

test('alternativen får en rad var med fet versal', () => {
  const ut = alternativPaRader('- Fråga: x?\n- Alternativ: a) ja, gör det; b) nej (förslag); c) vänta.\n- Beslut:')
  expect(ut).toBe('- Fråga: x?\n- Alternativ:\n  - **A)** ja, gör det\n  - **B)** nej (förslag)\n  - **C)** vänta.\n- Beslut:')
  expect(alternativPaRader('- Options: just text')).toBe('- Options: just text')
})
