import { describe, expect, test } from 'claude-code/testing'

import {
  arStoppSvar, bandDelar, beslutEtikett, visaLage, filMappar, formatVarning, gammalText, hittaRot, oppnaUrlArgv, relUnderRot, rapportFalt, skiljetecken, svarsEtikett, tolkaKonfig, tolkaRadarJson, vsCodeArgv, winSokvag,
} from '../hooks/las'
import { oversattNycklar } from '../hooks/format'
import { COMMANDS_FIRST, en, PROMPTS, stringsFor, sv } from '../hooks/strings'

// A finder over a set of existing files, as $.fs.exists would answer.
const finns = (filer: string[]) => async (p: string) => filer.includes(p)

describe('the notebook root: hittaRot', () => {
  test('Windows paths: the nearest folder at or above cwd with rooflow.json', async () => {
    const f = finns(['C:\\work\\notes\\rooflow.json'])
    expect(await hittaRot('C:\\work\\notes', f)).toBe('C:\\work\\notes')
    expect(await hittaRot('C:\\work\\notes\\status\\deep', f)).toBe('C:\\work\\notes')
    expect(await hittaRot('C:\\work\\other', f)).toBe(null)
    expect(await hittaRot('C:\\work\\notes\\', f)).toBe('C:\\work\\notes')
  })

  test('POSIX paths', async () => {
    const f = finns(['/home/ada/notes/rooflow.json'])
    expect(await hittaRot('/home/ada/notes', f)).toBe('/home/ada/notes')
    expect(await hittaRot('/home/ada/notes/a/b', f)).toBe('/home/ada/notes')
    expect(await hittaRot('/home/ada', f)).toBe(null)
    expect(await hittaRot('/', f)).toBe(null)
  })

  test('forward slashes on Windows, and a notebook at a drive root', async () => {
    expect(await hittaRot('C:/work/notes/x', finns(['C:/work/notes/rooflow.json']))).toBe('C:/work/notes')
    expect(await hittaRot('D:\\a\\b', finns(['D:\\rooflow.json']))).toBe('D:\\')
    expect(await hittaRot('/a', finns(['/rooflow.json']))).toBe('/')
  })
})

describe('paths that follow the root\'s own style', () => {
  test('skiljetecken, winSokvag and relUnderRot', () => {
    expect(skiljetecken('C:\\work\\notes')).toBe('\\')
    expect(skiljetecken('/home/ada/notes')).toBe('/')
    expect(winSokvag('C:\\work\\notes', 'status/a.md')).toBe('C:\\work\\notes\\status\\a.md')
    expect(winSokvag('/home/ada/notes/', 'status/a.md')).toBe('/home/ada/notes/status/a.md')
    expect(relUnderRot('/home/ada/notes/status/a.md', '/home/ada/notes')).toBe('status/a.md')
    expect(relUnderRot('C:\\work\\notes\\status\\a.md', 'C:\\work\\notes')).toBe('status/a.md')
    expect(relUnderRot('/elsewhere/a.md', '/home/ada/notes')).toBe('')
    const alla = [{ sokvag: '/home/ada/notes/inbox.md', rel: 'inbox.md', mtimeMs: 1 }, { sokvag: '/home/ada/notes/notes/a.md', rel: 'notes/a.md', mtimeMs: 2 }]
    expect(filMappar(alla, '/home/ada/notes', en).map(m => m.namn)).toEqual(['(root)', 'notes'])
  })
})

describe('rooflow.json: language and addons', () => {
  test('defaults to English, no addons; sv and the older sprak key are read', () => {
    expect(tolkaKonfig('{}')).toEqual({ language: 'en', servers: false, autoContinue: true, undoSeconds: 4 })
    expect(tolkaKonfig('{"language":"sv","addons":{"servers":true}}')).toEqual({ language: 'sv', servers: true, autoContinue: true, undoSeconds: 4 })
    expect(tolkaKonfig('{"sprak":"sv"}')).toEqual({ language: 'sv', servers: false, autoContinue: true, undoSeconds: 4 })
    expect(tolkaKonfig('{"language":"de"}')).toEqual({ language: 'en', servers: false, autoContinue: true, undoSeconds: 4 })
    expect(tolkaKonfig('{"addons":{"servers":"yes"}}').servers).toBe(false)
    expect(tolkaKonfig('not json')).toEqual({ language: 'en', servers: false, autoContinue: true, undoSeconds: 4 })
    expect(tolkaKonfig('')).toEqual({ language: 'en', servers: false, autoContinue: true, undoSeconds: 4 })
  })

  test('decisions: autoContinue on unless false, undoSeconds a whole number from 1 to 60, otherwise 4', () => {
    expect(tolkaKonfig('{"decisions":{"autoContinue":false}}').autoContinue).toBe(false)
    expect(tolkaKonfig('{"decisions":{"autoContinue":"no"}}').autoContinue).toBe(true)
    expect(tolkaKonfig('{"decisions":{"undoSeconds":8}}').undoSeconds).toBe(8)
    expect(tolkaKonfig('{"decisions":{"undoSeconds":0}}').undoSeconds).toBe(4)
    expect(tolkaKonfig('{"decisions":{"undoSeconds":2.5}}').undoSeconds).toBe(4)
    expect(arStoppSvar('vänta till fredag') && arStoppSvar('Not now') && arStoppSvar('no') && arStoppSvar('Stopp, fel spår')).toBe(true)
    expect(arStoppSvar('nog bra') || arStoppSvar('a') || arStoppSvar('kör') || arStoppSvar('nothing more')).toBe(false)
  })
})

describe('platform: VS Code and the browser', () => {
  test('Windows uses cmd and rundll32, the others code, open and xdg-open', () => {
    expect(vsCodeArgv('windows', 'C:\\a.md')).toEqual(['cmd', '/c', 'code', 'C:\\a.md'])
    expect(vsCodeArgv('macos', '/a.md')).toEqual(['code', '/a.md'])
    expect(vsCodeArgv('linux', '/a.md')).toEqual(['code', '/a.md'])
    expect(oppnaUrlArgv('windows', 'http://localhost:1')).toEqual(['rundll32', 'url.dll,FileProtocolHandler', 'http://localhost:1'])
    expect(oppnaUrlArgv('macos', 'http://localhost:1')).toEqual(['open', 'http://localhost:1'])
    expect(oppnaUrlArgv('linux', 'http://localhost:1')).toEqual(['xdg-open', 'http://localhost:1'])
    expect(oppnaUrlArgv('wsl', 'http://localhost:1')).toEqual(['xdg-open', 'http://localhost:1'])
  })
})

describe('the string table: sv and en', () => {
  test('the same keys in both languages, and the helpers use the table they are given', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(sv).sort())
    expect(stringsFor('sv')).toBe(sv)
    expect(stringsFor('EN')).toBe(en)
    expect(stringsFor('fr')).toBe(en)
    expect(beslutEtikett(2, sv)).toBe('Beslut 2')
    expect(beslutEtikett(2, en)).toBe('Decisions 2')
    expect(svarsEtikett({ bokstav: 'a', text: 'x', forslag: true }, en)).toBe('A (suggestion)')
    expect(gammalText('2026-11-23 09:00', new Date(2026, 10, 24, 12, 0).getTime(), en)).toBe('Radar 09:00 stale')
    expect(formatVarning({ format: 0 } as never, en)).toMatch(/no format number/)
    expect(rapportFalt({ owner: 'B1', blockerat: 'x' }, en)).toEqual(['Owner: B1', 'Blocked: x'])
  })

  test('the band parts in English', () => {
    const d = { idag: { datum: '', saker: [{ klar: false, text: 'a' }] }, korNu: ['x'], vantarPa: { restart: [], deploy: [], beslut: [{}], annat: [] } } as never
    expect(bandDelar(d, 42, en)).toEqual({ idag: 'Today 1', agenter: 'Agents 1 running, 1 waiting', kontext: 'Context 42 %' })
  })

  test('the prompts and first commands use the plugin\'s skill names', () => {
    expect(PROMPTS.agent).toBe('/agent ')
    expect(COMMANDS_FIRST[0]).toBe('/morning')
  })

  test('keys of files are translated for display in both directions', () => {
    expect(oversattNycklar('- Question: x', 'sv')).toBe('- Fråga: x')
    expect(oversattNycklar('- Fråga: x', 'en')).toBe('- Question: x')
  })
})

describe('state words of radar.json', () => {
  test('visaLage: the internal Swedish state word in English, Swedish unchanged', () => {
    expect(visaLage('kör 10 min', 'en')).toBe('running 10 min')
    expect(visaLage('klar', 'en')).toBe('done')
    expect(visaLage('frågar (B3)', 'en')).toBe('asking (B3)')
    expect(visaLage('fast', 'en')).toBe('stuck')
    expect(visaLage('kör 10 min', 'sv')).toBe('kör 10 min')
    expect(visaLage('something else', 'en')).toBe('something else')
    expect(visaLage('', 'en')).toBe('')
  })
})
