import { expect, mock, test } from 'claude-code/testing'
import type { On, RenderInput, SessionStartInput, UiPane } from 'claude-code'

const PLUGIN = 'rooflow'
const ROT = 'C:\\work\\notes'
const IDAG = new Date(2030, 0, 23, 17, 0).getTime()

const B3 = {
  id: 'B3',
  rubrik: 'Panelen som mod: vilket förslag?',
  datum: '2030-01-22',
  alder: '1 d',
  fragar: 'RooFlow',
  blockerar: 'bygget av panelen',
  projekt: 'rooflow',
  alternativ: [
    { bokstav: 'a', text: 'A, bara bandet', forslag: false },
    { bokstav: 'c', text: 'C, band plus panel', forslag: true },
  ],
  text: '- Id: B3\n- Fråga: Vilket förslag?\n- Alternativ: a) A. c) **(förslag)** C.',
}

const RADAR_JSON = {
  format: 1,
  genererad: '2030-01-23 17:00',
  antal: { behover: 1, idag: 2, lovat: 2, vantar: 1, rorsig: 1, starstill: 1, inkorg: 36 },
  usage: null,
  beslut: [B3],
  bordlagda: ['B1'],
  idag: { datum: '2030-01-23', saker: [{ klar: true, text: 'Svara Sam', hash: 'i1111111' }, { klar: false, text: 'Möte om Gamma', hash: 'i2222222' }] },
  loften: [
    { datum: '2030-01-24', vem: 'Pat (ACME)', vad: 'fixa rapporten', nar: 'IMORGON', hash: 'l1111111' },
    { datum: '2030-03-03', vem: 'teamet', vad: 'RSS i Gamma', nar: '' },
  ],
  vantar: [{ datum: '2030-01-17', vem: 'IT', vad: 'svar om testdata', hash: 'v1111111' }],
  rorSig: [{ slug: 'rooflow', namn: 'RooFlow', vad: 'bygger Radar', lage: 'kör 10 min', sedan: '2030-01-23T16:50:00', modell: 'opus' }],
  korNu: ['rooflow'],
  starStill: [{ mapp: 'XY' }],
  projekt: [
    {
      mapp: 'Alpha', slug: 'alpha', lage: 'nu', dir: 'C:\\work\\alpha', statusFil: 'C:\\work\\notes\\status\\alpha.md',
      agentLage: 'klar', lageText: '', gorNu: 'första versionen klar', nastaSteg: 'prova på servern', uppdaterad: '2030-01-18 10:00',
      sistRort: '2030-01-18', beslut: ['B3'], loften: [],
      kor: [
        { namn: 'publicera', cmd: 'dotnet publish src/Alpha', cwd: 'C:\\work\\alpha', konto: '' },
        { namn: 'admin', cmd: 'Alpha.exe', cwd: 'C:\\work\\alpha', konto: 'svc.admin' },
        { namn: 'trasig', cmd: 'finnsinte.exe', cwd: 'C:\\work\\alpha', konto: '' },
      ],
      rapporter: [
        { tid: '2030-01-18 10:00', id: '2030-01-18-alpha-forsta', rapport: 'RAPPORT alpha 2030-01-18\nGjort:      första versionen', orapporterad: false },
        { tid: '2030-01-17 09:00', id: '2030-01-17-alpha-start', rapport: '', orapporterad: true },
      ],
      docs: ['C:\\work\\alpha\\CLAUDE.md', 'C:\\work\\alpha\\docs\\driftnoteringar.md'],
      gitLogg: [
        { hash: 'a1b2c3d', tid: '2030-01-18 09:55', text: 'feat(alpha): första versionen' },
        { hash: 'e4f5a6b', tid: '2030-01-17 17:00', text: 'chore: start' },
      ],
    },
    {
      mapp: 'Beta', slug: 'beta', lage: 'parkerat', dir: 'C:\\work\\beta', statusFil: '', agentLage: '', lageText: 'vilar',
      gorNu: '', nastaSteg: '', uppdaterad: '', sistRort: '2030-01-18', beslut: [], loften: [], kor: [], rapporter: [], docs: [],
    },
  ],
  skills: [
    { namn: '/radar', besk: 'Visar Radar' },
    { namn: '/morning', besk: 'Möten, igår, agenter' },
    { namn: '/promise', besk: 'Registrerar ett löfte' },
  ],
  forbrukning: { datum: '2030-01-22', tid: '08:40', femh: '1', vecka: '13', weekModel: '11', kommentar: '/morning' },
  inkorg: {
    antal: 3,
    angra: '',
    aldsta: '2030-01-01',
    rader: [
      { datum: '2030-01-01', rubrik: 'Gör nu', text: '2030-01-01 · Ada · Mata in arkivexempel' },
      { datum: '2030-01-10', rubrik: 'Agent', text: '2030-01-10 · Ada · Exempelpost för api/demo' },
      { datum: '', rubrik: 'Agent', text: 'Exempelfilen in i mallen' },
    ],
    sektioner: [
      { namn: 'Now', poster: [{ hash: 'aaaa1111', text: '2030-01-01 · Ada · Mata in arkivexempel' }, { hash: 'bbbb2222', text: '2030-01-10 · Ada · Exempelpost\nfortsättning rad två' }] },
      { namn: 'Agent', poster: [{ hash: 'cccc3333', text: 'Exempelfilen in i mallen' }, { hash: 'dddd4444', text: 'Post som någon hunnit ändra' }] },
      { namn: 'Expensive review', poster: [] },
      { namn: 'Later', poster: [] },
    ],
  },
  agenter: {
    underagenter: [
      { id: 'radar-utseende', projekt: 'rooflow', uppdrag: 'Radar utseende', modell: 'sonnet', start: '2030-01-23T15:00:00+02:00', klar: '', resultat: '' },
      { id: 'gamma-rss', projekt: 'gamma', uppdrag: 'RSS i Gamma', modell: 'haiku', start: '2030-01-22 09:00', klar: '2030-01-22 09:40', resultat: 'Klar, abc1234' },
    ],
    rapporter: [
      { tid: '2030-01-23 16:00', id: '2030-01-23-rooflow-radar', projekt: 'rooflow', rapport: 'RAPPORT rooflow 2030-01-23\nGjort:      radar.js', orapporterad: false, owner: 'B7; omstart', blockerat: 'Gamma behöver startas om' },
      { tid: '2030-01-22 12:00', id: '2030-01-22-gamma', projekt: 'gamma', rapport: '', orapporterad: true },
    ],
  },
}

// Filerna svaras ur minnet. Under RooFlow är nyckeln relativ, annars hela sökvägen med snedstreck.
function varld(on: On, kontextProcent: number | null = 42) {
  const rotSnedstreck = ROT.replace(/\\/g, '/')
  const rel = (p: string) => {
    const s = p.replace(/\\/g, '/')
    return s === rotSnedstreck ? '' : s.replace(`${rotSnedstreck}/`, '')
  }
  const prompts: string[] = []
  const fyllda: string[] = []
  const korda: string[][] = []
  const cwdn: string[] = []
  const skriptRotter: string[] = []
  const miljo = { platform: 'windows' as string, cwd: ROT, envRoot: undefined as string | undefined }
  const exists = (p: string) => p === '/Applications' ? miljo.platform === 'macos' : filer[rel(p)] !== undefined
  const kommandon: string[] = []
  const registrerade: string[] = []
  const paneler: string[] = []
  const filer: Record<string, string> = {
    'radar.md': 'RADAR ons 21/10 17:00\n\nBEHÖVER DIG (1)\n',
    'status/radar.json': JSON.stringify(RADAR_JSON),
    'status/alpha.md': 'Läge: klar\nGör nu: första versionen klar\n\n# Status: Alpha\n\n- Mål: nycklar på servern',
    'status/morning.md': '- 09:00 Möte om Gamma',
    'rooflow.json': JSON.stringify({ format: 1, language: 'sv', addons: { servers: true } }),
    'commands.md': '',
    'tankar/idé.md': '',
    'tankar/status_mall.md': '',
    'arkiv/gammal.md': '',
    'decisions.md': '',
    'inbox.md': '',
    'handover.md': '',
    'briefs/uppdrag.md': '',
    'archive/inbox-2030-01.md': '',
    'status/logg/körning.md': '',
    'leveranser/lathund.html': '',
    'leveranser/lathund.pdf': '',
    'leveranser/bild.png': '',
    'C:/work/alpha/README.md': '',
    'C:/work/alpha/bin/Debug/skräp.md': '',
  }
  on('fs.read', ($, e) => {
    const t = filer[rel(e.path)]
    return t === undefined ? { deny: `ENOENT: ${e.path}` } : { value: t }
  })
  on('fs.write', ($, e) => {
    filer[rel(e.path)] = e.text
    return { value: undefined }
  })
  on('fs.list', ($, e) => {
    const dir = rel(e.path)
    const nycklar = Object.keys(filer).filter(f => (dir ? f.startsWith(`${dir}/`) : !f.startsWith('C:/')))
    const under = nycklar.map(f => (dir ? f.slice(dir.length + 1) : f))
    const namn = [...new Set(under.map(f => f.split('/')[0] ?? ''))]
    return {
      value: namn.map(name => ({
        name,
        kind: under.some(f => f.startsWith(`${name}/`)) ? ('dir' as const) : ('file' as const),
        size: 1,
        mtimeMs: name === 'idé.md' ? 5 : 1,
        isLink: false,
      })),
    }
  })
  // scripts/servers.js is faked: start adds a live entry, stop removes it, status answers with the entries.
  const servrar: Record<string, unknown> = {}
  const svara = (stdout: string, exitCode = 0) => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
  on('process.run', ($, e) => {
    // The plugin's scripts are recorded as "scripts/<name>.js": where the plugin lives is checked in its own test.
    const argv = e.argv.map(a => a.replace(/^.*[\\/]scripts[\\/]/, 'scripts/'))
    korda.push(argv)
    cwdn.push(e.init?.cwd ?? '')
    skriptRotter.push(...e.argv.filter(a => /[\\/]scripts[\\/]/.test(a)))
    const [prog, skript, handling, slug, namn] = argv
    if (prog === 'node' && skript === 'scripts/servers.js') {
      if (handling === 'status') return svara(`${JSON.stringify(servrar)}\n`)
      const nyckel = `${slug}-${namn}`
      if (handling === 'start') {
        if (namn === 'trasig') return svara(JSON.stringify({ fel: 'finns inte i status/radar.json' }), 1)
        servrar[nyckel] = { nyckel, slug, namn, pid: 4242, startad: '2030-01-23 17:00', startMs: IDAG, lever: true, portar: [5000] }
        return svara(JSON.stringify(servrar[nyckel]))
      }
      if (handling === 'stop') {
        delete servrar[nyckel]
        return svara(JSON.stringify({ nyckel, stoppad: true, skal: '' }))
      }
    }
    if (prog === 'node' && skript === 'scripts/decide.js') {
      // B3 frågades av agenten alpha, B4 av beta; B9 av ingen. B13 vägras som om blocket redan var avgjort.
      if (handling === 'B13') return svara(JSON.stringify({ fel: 'inte öppen' }), 1)
      return svara(JSON.stringify({ ok: true, id: handling, svar: slug, task: handling === 'B3' ? 'alpha' : handling === 'B4' ? 'beta' : '' }))
    }
    if (prog === 'node' && (skript === 'scripts/today.js' || skript === 'scripts/promise.js')) return svara(JSON.stringify({ ok: true }))
    if (prog === 'node' && skript === 'scripts/inbox.js') {
      return slug?.startsWith('dddd') ? svara(JSON.stringify({ fel: `ingen post med hash ${slug}` }), 1) : svara(JSON.stringify({ ok: true }))
    }
    return svara('')
  })
  // ui.notify går inte att haka i testmotorn (CLI 2.1.286). Utan terminal går ingen notis fram,
  // så moden faller tillbaka på en toast: det är den som syns här.
  const toasts: string[] = []
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { tokens: 0, window: 1, percent: kontextProcent ?? undefined } as never,
      rateLimits: [{ kind: 'five_hour', percentUsed: 3 }, { kind: 'seven_day', percentUsed: 11.4 }],
    },
  }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: miljo.cwd }))
  on('fs.exists', ($, e) => ({ value: exists(e.path) }))
  on('env.get', ($, e) => ({ value: e.name === 'ROOFLOW_ROOT' ? miljo.envRoot : e.name === 'OS' && miljo.platform === 'windows' ? 'Windows_NT' : undefined }))
  on('command.register', ($, e) => {
    registrerade.push(e.name)
    return { value: { command: e.name } }
  })
  on('command.run', ($, e) => {
    kommandon.push(e.command)
    return { text: '' }
  })
  on('ui.open', ($, e) => {
    if (!paneler.includes(e.id)) paneler.push(e.id)
    return { value: { isPlaced: true as const } }
  })
  on('ui.close', ($, e) => {
    paneler.splice(paneler.indexOf(e.id), 1)
    return { value: undefined }
  })
  on('ui.panes', () => ({
    value: paneler.map((id): UiPane => ({ id, title: 'RooFlow', isShown: true, isFocused: false, isPlaced: true })),
  }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('prompt.submit', ($, e) => {
    prompts.push(e.text)
    return { text: e.text }
  })
  on('prompt.fill', ($, e) => {
    fyllda.push(e.text)
    return { isFilled: true }
  })
  // Pluginets store ($.store), i minnet.
  const lagrat: Record<string, unknown> = {}
  on('store.get', ($, e) => ({ value: lagrat[e.key] }))
  on('store.set', ($, e) => {
    lagrat[e.key] = e.value
    return { value: undefined }
  })
  return { prompts, fyllda, korda, cwdn, skriptRotter, miljo, kommandon, registrerade, paneler, filer, servrar, toasts, lagrat }
}

const SESSION: SessionStartInput = { surface: 'desktop', isInteractive: true, cwd: ROT }

const BAND: RenderInput<'AbovePrompt'> = {
  component: 'AbovePrompt',
  surface: 'desktop',
  requestId: 'band',
  viewport: { columns: 160, rows: 48, isFullscreen: true },
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 19 }, view: {} },
}

const PANE: RenderInput<'Pane'> = {
  component: 'Pane',
  surface: 'desktop',
  requestId: 'rooflow',
  viewport: { columns: 160, rows: 48, isFullscreen: true },
  props: { title: 'RooFlow', isFocused: false, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 44 }, view: {} },
}

type Ytan = { find: (q: object) => Promise<unknown>; press: (q: object) => Promise<unknown> }

// På mobilen ligger flik 6–8 bakom Mer.
async function valjFlik(ui: Ytan, key: string) {
  if (!(await ui.find({ key }))) await ui.press({ key: 'flik-mer' })
  await ui.press({ key })
}

async function starta(on: On, $: Parameters<Parameters<typeof test>[1]>[0], kontextProcent: number | null = 42) {
  const v = varld(on, kontextProcent)
  const klocka = mock.clock(on)
  await klocka.set(IDAG)
  await $.session.start(SESSION)
  return { ...v, klocka }
}

test('bandet: en rad med Beslut, Idag, Agenter, Kontext och Panel; besluten, Projekt och Filer finns inte i bandet', async ($, on) => {
  const { korda } = await starta(on, $)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface, plugin: PLUGIN })
    expect((await ui.find({ key: 'band-idag' }))?.props.label).toBe('Idag 1')
    expect((await ui.find({ key: 'band-agenter' }))?.props.label).toBe('Agenter 1 kör')
    expect(await ui.find({ type: 'Text', text: /^Kontext 42 %$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Radar|RADAR|försenat|står still|5h|vecka/i })).toBeUndefined()
    expect(await ui.find({ key: 'mat-nu' })).toBeUndefined()
    expect(await ui.find({ key: 'panel' })).toBeDefined()
    expect(await ui.find({ key: 'b-0-a' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /Panelen som mod/ })).toBeUndefined()
    expect(await ui.find({ key: 'del-projekt' })).toBeUndefined()
    expect(await ui.find({ key: 'del-filer' })).toBeUndefined()
    expect(await ui.find({ key: 'del-behover' })).toBeUndefined()
    await ui.unmount()
  }
  expect(korda.some(a => a.join(' ') === 'node scripts/radar.js --tyst')).toBe(true)
})

test('beslutsetiketten är en knapp som öppnar Beslut-fliken, också när panelen står på en annan flik', async ($, on) => {
  const { paneler } = await starta(on, $)
  const band = await $.ui.mount({ ...BAND, plugin: PLUGIN })
  expect(await band.find({ key: 'beslut-etikett', label: 'Beslut 1' })).toBeDefined()
  await $.command.run({ command: 'rooflow', args: 'idag' })
  const panel = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  expect((await panel.find({ key: 'flik-idag', label: 'Idag' }))?.props.variant).toBe('primary')
  await band.press({ key: 'beslut-etikett' })
  expect(paneler).toContain('rooflow')
  expect((await panel.find({ key: 'flik-beslut', label: 'Beslut 1' }))?.props.variant).toBe('primary')
  await panel.unmount()
  await band.unmount()
})

test('inga beslut ger ingen knapp i bandet', async ($, on) => {
  const { filer } = await starta(on, $)
  filer['status/radar.json'] = JSON.stringify({ ...RADAR_JSON, beslut: [] })
  await $.command.run({ command: 'radar', args: '' })
  const tomt = await $.ui.mount({ ...BAND, plugin: PLUGIN })
  expect(await tomt.find({ type: 'Text', text: 'Beslut 0' })).toBeDefined()
  expect(await tomt.find({ key: 'beslut-etikett' })).toBeUndefined()
  await tomt.unmount()
})

test('/rooflow och knappen Panel öppnar panelen; /rooflow idag väljer fliken', async ($, on) => {
  const { registrerade, paneler } = await starta(on, $)
  expect(registrerade).toContain('rooflow')
  // Panelen öppnas av sig själv vid sessionsstart (utan fokus): knappen stänger den, och nästa tryck öppnar den igen.
  expect(paneler).toContain('rooflow')
  const band = await $.ui.mount({ ...BAND, plugin: PLUGIN })
  await band.press({ key: 'panel' })
  expect(paneler.length).toBe(0)
  await band.press({ key: 'panel' })
  expect(paneler).toContain('rooflow')
  await band.press({ key: 'panel' })
  expect(paneler.length).toBe(0)
  await band.unmount()

  await $.command.run({ command: 'rooflow', args: 'idag' })
  expect(paneler).toContain('rooflow')
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  expect((await ui.find({ key: 'flik-idag', label: 'Idag' }))?.props.variant).toBe('primary')
  await ui.unmount()
})

test('spärren: ett svar skickas en gång, knappen visar Skickat HH:MM tills två minuter gått', async ($, on) => {
  const { korda, fyllda, prompts, klocka } = await starta(on, $)
  const decide = () => korda.filter(a => a[1] === 'scripts/decide.js')
  const pane = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await pane.press({ key: 'pb-rad-0' })
  await pane.press({ key: 'pb-0-c' })
  // Ingen tur: skriptet körs. Beslutet hör till agenten alpha: fortsättningen skickas efter ångerfönstret på 4 s.
  expect(decide()).toEqual([['node', 'scripts/decide.js', 'B3', 'c']])
  expect(prompts.length).toBe(0)
  expect(fyllda.length).toBe(0)
  expect(await pane.find({ type: 'Text', text: 'Fortsätter alpha om 4 s' })).toBeDefined()
  expect(await pane.find({ key: 'fortsatt-angra-B3', label: 'Ångra: fortsätt inte alpha nu' })).toBeDefined()
  expect(await pane.find({ key: 'pb-0-c' })).toBeUndefined()
  expect(await pane.find({ key: 'pb-0-skickat' })).toBeDefined()
  await pane.press({ key: 'pb-0-skickat' })
  expect(decide().length).toBe(1)

  await klocka.advance(60_000)
  expect(prompts).toEqual(['Fortsätt alpha: B3 är avgjort med svaret "c".'])
  expect(await pane.find({ key: 'fortsatt-angra-B3' })).toBeUndefined()
  expect(await pane.find({ key: 'pb-0-c' })).toBeUndefined()
  await klocka.advance(61_000)
  expect(await pane.find({ key: 'pb-0-c' })).toBeDefined()
  await pane.unmount()
})

test('spärren släpper när radar.json visar att beslutet ändrats', async ($, on) => {
  const { korda, filer } = await starta(on, $)
  const pane = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await pane.press({ key: 'pb-rad-0' })
  await pane.press({ key: 'pb-0-a' })
  expect(korda.filter(a => a[1] === 'scripts/decide.js').length).toBe(1)
  expect(await pane.find({ key: 'pb-0-skickat' })).toBeDefined()
  filer['status/radar.json'] = JSON.stringify({ ...RADAR_JSON, beslut: [{ ...B3, text: `${B3.text}\n- Beslut: a, Ada 2030-01-23` }] })
  await $.command.run({ command: 'radar', args: '' })
  expect(await pane.find({ key: 'pb-0-a' })).toBeDefined()
  await pane.unmount()
})

test('Beslut-fliken: blocket som Markdown, ålder, vad det blockerar, svara fritt och bordlagda', async ($, on) => {
  const { fyllda, korda, klocka, prompts } = await starta(on, $)
  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface, plugin: PLUGIN })
    expect((await ui.find({ key: 'flik-beslut', label: 'Beslut 1' }))?.props.variant).toBe('primary')
    // Hopfälld rad: Id, rubrik, ålder, blockerar och förslag; blocket och knapparna syns först när raden fälls ut.
    expect(await ui.find({ type: 'Text', text: /^rooflow \(1\)$/ })).toBeDefined()
    expect(await ui.find({ key: 'pb-rad-0', label: '▸ B3 · Panelen som mod: vilket förslag? · 1 d · blockerar bygget av panelen · förslag c · visa' })).toBeDefined()
    expect(await ui.find({ type: 'Markdown', text: /- Fråga/ })).toBeUndefined()
    expect(await ui.find({ key: 'pb-0-c' })).toBeUndefined()
    await ui.press({ key: 'pb-rad-0' })
    expect(await ui.find({ key: 'pb-rad-0', label: /^▾ B3/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^B3 · Panelen som mod: vilket förslag\?$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /väntat 1 d · frågar RooFlow · blockerar bygget av panelen/ })).toBeDefined()
    expect(await ui.find({ type: 'Markdown', text: /- Fråga: Vilket förslag\?/ })).toBeDefined()
    expect(await ui.find({ key: 'pb-0-c', label: 'c: C, band plus panel (förslag)' })).toBeDefined()
    expect(await ui.find({ key: 'pb-0-a', label: 'a: A, bara bandet' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Bordlagda: B1/ })).toBeDefined()
    if (surface === 'mobile') {
      // Inget Input på mobilen: prompten fylls i som förut.
      await ui.press({ key: 'pb-0-fritt' })
      expect(fyllda).toContain('B3: ')
    } else {
      expect(await ui.find({ key: 'pb-0-fritt' })).toBeUndefined()
      expect(await ui.find({ key: 'pb-0-fritt-in' })).toBeDefined()
    }
    await ui.press({ key: 'pb-rad-0' })
    await ui.unmount()
  }
  // Fritt svar går till decide.js som en enda parameter, och prompten fylls i med agentens uppdrag. Spärren från ett tidigare svar har gått ut.
  await klocka.advance(130_000)
  const skriv = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await skriv.press({ key: 'pb-rad-0' })
  await skriv.input({ key: 'pb-0-fritt-in', text: 'vänta till fredag' })
  expect(korda.filter(a => a[1] === 'scripts/decide.js')).toEqual([['node', 'scripts/decide.js', 'B3', 'vänta till fredag']])
  // "vänta" håller agenten kvar: inget skickas av sig självt, knappen Fortsätt agenten väntar i stället.
  await klocka.advance(20_000)
  expect(prompts.length).toBe(0)
  expect(fyllda).not.toContain('Fortsätt alpha: B3 är avgjort med svaret "vänta till fredag".')
  expect(await skriv.find({ key: 'fortsatt-nu-B3', label: 'Fortsätt agenten alpha (B3)' })).toBeDefined()
  await skriv.press({ key: 'fortsatt-nu-B3' })
  expect(prompts).toEqual(['Fortsätt alpha: B3 är avgjort med svaret "vänta till fredag".'])
  expect(await skriv.find({ key: 'fortsatt-nu-B3' })).toBeUndefined()
  await skriv.unmount()
})

test('Ångra inom 4 s: beslutet står kvar men inget skickas; Fortsätt agenten skickar sedan', async ($, on) => {
  const { korda, prompts, klocka } = await starta(on, $)
  const pane = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await pane.press({ key: 'pb-rad-0' })
  await pane.press({ key: 'pb-0-c' })
  await klocka.advance(3_000)
  await pane.press({ key: 'fortsatt-angra-B3' })
  await klocka.advance(30_000)
  expect(korda.filter(a => a[1] === 'scripts/decide.js').length).toBe(1)
  expect(prompts.length).toBe(0)
  expect(await pane.find({ key: 'fortsatt-angra-B3' })).toBeUndefined()
  await pane.press({ key: 'fortsatt-nu-B3' })
  expect(prompts).toEqual(['Fortsätt alpha: B3 är avgjort med svaret "c".'])
  await pane.unmount()
})

test('två agentbeslut inom ångerfönstret: båda skickas, inget skrivs över', async ($, on) => {
  const { filer, prompts, klocka } = await starta(on, $)
  filer['status/radar.json'] = JSON.stringify({ ...RADAR_JSON, beslut: [B3, { ...B3, id: 'B4', rubrik: 'Ett till' }] })
  await $.command.run({ command: 'radar', args: '' })
  const pane = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await pane.press({ key: 'pb-rad-0' })
  await pane.press({ key: 'pb-0-c' })
  await pane.press({ key: 'pb-rad-1' })
  await pane.press({ key: 'pb-1-c' })
  expect(await pane.find({ key: 'fortsatt-angra-B3' })).toBeDefined()
  expect(await pane.find({ key: 'fortsatt-angra-B4' })).toBeDefined()
  await klocka.advance(10_000)
  expect(prompts).toEqual(['Fortsätt alpha: B3 är avgjort med svaret "c".', 'Fortsätt beta: B4 är avgjort med svaret "c".'])
  await pane.unmount()
})

test('decisions.autoContinue false: prompten fylls bara i, som förut', async ($, on) => {
  const { filer, fyllda, prompts, klocka } = await starta(on, $)
  filer['rooflow.json'] = JSON.stringify({ format: 1, language: 'sv', addons: { servers: true }, decisions: { autoContinue: false } })
  await $.command.run({ command: 'radar', args: '' })
  const pane = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await pane.press({ key: 'pb-rad-0' })
  await pane.press({ key: 'pb-0-c' })
  await klocka.advance(30_000)
  expect(fyllda).toContain('Fortsätt alpha: B3 är avgjort med svaret "c".')
  expect(prompts.length).toBe(0)
  expect(await pane.find({ key: 'fortsatt-angra-B3' })).toBeUndefined()
  await pane.unmount()
})

test('Idag-fliken: valen med klar/kvar i text, löften inom tre dagar, väntar och möten', async ($, on) => {
  const { fyllda } = await starta(on, $)
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'flik-idag' })
  expect(await ui.find({ type: 'Text', text: /^\[x\] klar: Svara Sam$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^\[ \] kvar: Möte om Gamma$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Löften inom 3 dagar \(1\)$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /2030-01-24 IMORGON · till Pat \(ACME\): fixa rapporten/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /RSS i Gamma/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /2030-01-17 · väntar på IT: svar om testdata/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /09:00 Möte om Gamma/ })).toBeDefined()
  await ui.press({ key: 'idag-skriv' })
  expect(fyllda).toContain('today: ')
  await ui.unmount()
})

test('Idag-fliken: varje post har en punkt, morgonfilens rubrik visas i ord och Möten heter bara Möten', async ($, on) => {
  const { filer } = await starta(on, $)
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'flik-idag' })
  expect(await ui.find({ type: 'Text', text: /^Möten$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^• $/ })).toBeDefined()
  expect(await ui.find({ key: 'lofte-klar-0' })).toBeDefined()
  // Morgonfilen utan rubrikrad: ingen extra rad, texten som förut.
  expect(await ui.find({ type: 'Text', text: /Hämtat av|Från [/]morgon/ })).toBeUndefined()
  await ui.unmount()

  filer['status/morning.md'] = ['Morgon onsdag 2030-01-23 07:58 (/morgon)', '', 'Inga möten i dag.', 'Igår: mycket.'].join('\n')
  await $.command.run({ command: 'radar', args: '' })
  const idag = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  expect(await idag.find({ type: 'Text', text: 'Hämtat av /morgon onsdag 07:58' })).toBeDefined()
  expect(await idag.find({ type: 'Markdown', text: ['- Inga möten i dag.', '- Igår: mycket.'].join('\n') })).toBeDefined()
  expect(await idag.find({ type: 'Markdown', text: /Morgon onsdag/ })).toBeUndefined()
  await idag.unmount()

  filer['status/morning.md'] = ['Morgon tisdag 2030-01-22 07:58 (/morgon)', '', 'Inga möten.'].join('\n')
  await $.command.run({ command: 'radar', args: '' })
  const gammal = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  expect(await gammal.find({ type: 'Text', text: 'Från /morgon tisdag 22/1, inte uppdaterat i dag' })).toBeDefined()
  await gammal.unmount()
})

test('Projekt-fliken: lista per läge, projektrummet med status, rapporter, docs med full sökväg och knappar', async ($, on) => {
  const { korda, fyllda } = await starta(on, $)
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'flik-projekt' })
  expect(await ui.find({ key: 'proj-alpha' })).toBeDefined()
  expect(await ui.find({ key: 'proj-beta' })).toBeUndefined()
  await ui.press({ key: 'lage-parkerat' })
  expect(await ui.find({ key: 'proj-beta' })).toBeDefined()

  await ui.press({ key: 'proj-alpha' })
  expect(await ui.find({ type: 'Text', text: /^Gör nu: första versionen klar$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Beslut som väntar: B3$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Gjort: {6}första versionen/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Orapporterad: körningen slutade utan slutrapport\.$/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /\[C:\\\\work\\\\notes\\\\status\\\\alpha\.md\]\(file:\/\/\/C:\/work\/notes\/status\/alpha\.md\)/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /\[C:\\\\work\\\\alpha\\\\docs\\\\driftnoteringar\.md\]/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /Mål: nycklar på servern/ })).toBeDefined()
  await ui.press({ key: 'vs-alpha' })
  expect(korda.some(a => a.join(' ') === 'cmd /c code C:\\work\\alpha')).toBe(true)
  await ui.press({ key: 'agent-alpha' })
  expect(fyllda).toContain('/agent alpha ')
  await ui.press({ key: 'proj-tillbaka' })
  expect(await ui.find({ key: 'proj-alpha' })).toBeDefined()
  await ui.unmount()
})

test('Filer-fliken: fästa, senaste och hopfällda mappar med antal; arkivet dolt tills knappen trycks', async ($, on) => {
  await starta(on, $)
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'flik-filer' })
  expect((await ui.find({ key: 'flik-filer', label: 'Filer' }))?.props.variant).toBe('primary')
  // Fästa: engelska namnen som finns, i fast ordning
  expect(await ui.find({ type: 'Text', text: 'Fästa' })).toBeDefined()
  expect(await ui.find({ key: 'fil-fast-0' })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /\[C:\\\\work\\\\notes\\\\decisions\.md\]/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /\[C:\\\\work\\\\notes\\\\handover\.md\]/ })).toBeDefined()
  // Senaste: nyast först, utan arkivet, loggen och briefs
  expect(await ui.find({ type: 'Text', text: /^Senaste \(10 ändrade\)$/ })).toBeDefined()
  expect(await ui.find({ key: 'fil-sen-0' })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /tankar\\\\idé\.md/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /briefs|arkiv|archive|logg/ })).toBeUndefined()
  // Mappar hopfällda med antal; arkivet och loggen finns inte förrän knappen trycks
  expect(await ui.find({ key: 'fil-mapp-0' })).toBeDefined()
  expect(await ui.find({ type: 'Button', text: '▸ tankar (2)' })).toBeDefined()
  expect(await ui.find({ type: 'Button', text: '▸ briefs (1)' })).toBeDefined()
  expect(await ui.find({ type: 'Button', text: '▸ status (2)' })).toBeDefined()
  expect(await ui.find({ type: 'Button', text: /^▸ (archive|arkiv)/ })).toBeUndefined()
  expect(await ui.find({ type: 'Button', text: /status\/logg/ })).toBeUndefined()
  expect(await ui.find({ key: 'filer-arkivet', label: 'Visa arkivet (3)' })).toBeDefined()
  await ui.press({ key: 'filer-arkivet' })
  expect(await ui.find({ key: 'filer-arkivet', label: 'Dölj arkivet' })).toBeDefined()
  expect(await ui.find({ type: 'Button', text: '▸ archive (1)' })).toBeDefined()
  expect(await ui.find({ type: 'Button', text: '▸ status/logg (1)' })).toBeDefined()
  await ui.press({ key: 'filer-arkivet' })
  expect(await ui.find({ type: 'Button', text: '▸ archive (1)' })).toBeUndefined()
  // en mapp fälls ut och in
  const tankar = await ui.find({ type: 'Button', text: '▸ tankar (2)' })
  await ui.press({ key: tankar?.props.key as string })
  expect(await ui.find({ type: 'Button', text: '▾ tankar (2)' })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /tankar\\\\status_mall\.md/ })).toBeDefined()
  await ui.unmount()
})

test('Filer: sökningen täcker också arkivet och visar en platt lista; VS Code per fil och projektets filer utan bin', async ($, on) => {
  const { korda } = await starta(on, $)
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'flik-projekt' })
  await ui.press({ key: 'proj-alpha' })
  await ui.press({ key: 'filer-alpha' })
  expect(await ui.find({ type: 'Markdown', text: /\[C:\\\\work\\\\alpha\\\\README\.md\]/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /skräp/ })).toBeUndefined()
  await ui.press({ key: 'fil-sen-vs-0' })
  expect(korda.some(a => a.join(' ') === 'cmd /c code C:\\work\\notes\\tankar\\idé.md')).toBe(true)
  await ui.input({ key: 'filter', text: 'inbox-2030' })
  expect(await ui.find({ type: 'Markdown', text: /archive\\\\inbox-2030-01\.md/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Fästa' })).toBeUndefined()
  expect(await ui.find({ type: 'Button', text: /^▸ / })).toBeUndefined()
  await ui.input({ key: 'filter', text: 'alpha' })
  expect(await ui.find({ type: 'Markdown', text: /idé\.md/ })).toBeUndefined()
  expect(await ui.find({ type: 'Markdown', text: /alpha\\\\README\.md/ })).toBeDefined()
  await ui.unmount()
})

test('Filer på mobilen: inget sökfält, inga VS Code-knappar, listan ritas ändå', async ($, on) => {
  await starta(on, $)
  const ui = await $.ui.mount({ ...PANE, surface: 'mobile', plugin: PLUGIN })
  await valjFlik(ui, 'flik-filer')
  expect(await ui.find({ key: 'filter' })).toBeUndefined()
  expect(await ui.find({ type: 'Markdown', text: /idé\.md/ })).toBeDefined()
  expect(await ui.find({ key: 'fil-sen-vs-0' })).toBeUndefined()
  expect(await ui.find({ key: 'fil-fast-vs-0' })).toBeUndefined()
  await ui.unmount()
})

test('bandet har Panel och ↻; Tyst, Mät nu, Radar-knappen, Kör, Skills och Agenter-delen är borta', async ($, on) => {
  await starta(on, $)
  const ui = await $.ui.mount({ ...BAND, plugin: PLUGIN })
  for (const key of ['panel', 'uppdatera']) expect(await ui.find({ key })).toBeDefined()
  for (const key of ['tyst', 'mat-nu', 'mat-nu-skickat', 'del-radar', 'del-kor', 'del-skills', 'del-agenter']) expect(await ui.find({ key })).toBeUndefined()
  await ui.unmount()
})

test('bandet: veckans förbrukning ur appen (ändrat 24/11), inte 5h; klick fyller i /usage i prompten', async ($, on) => {
  const { fyllda } = await starta(on, $)
  const ui = await $.ui.mount({ ...BAND, plugin: PLUGIN })
  expect((await ui.find({ key: 'vecka' }))?.props.label).toBe('Vecka 11 %')
  expect(await ui.find({ type: 'Text', text: /5h|Mät/i })).toBeUndefined()
  await ui.press({ key: 'vecka' })
  expect(fyllda).toContain('/usage')
  await ui.unmount()
})

test('bandet: Idag och Agenter öppnar sin flik i panelen, som Beslut', async ($, on) => {
  const { paneler } = await starta(on, $)
  const ui = await $.ui.mount({ ...BAND, plugin: PLUGIN })
  await ui.press({ key: 'band-agenter' })
  expect(paneler).toContain('rooflow')
  const pane = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  expect((await pane.find({ key: 'flik-agenter', label: 'Agenter' }))?.props.variant).toBe('primary')
  await ui.press({ key: 'band-idag' })
  expect((await pane.find({ key: 'flik-idag', label: 'Idag' }))?.props.variant).toBe('primary')
  await pane.unmount()
  await ui.unmount()
})

test('kontext: procent ur sessionen, avrundad', async ($, on) => {
  await starta(on, $, 41.6)
  const ui = await $.ui.mount({ ...BAND, plugin: PLUGIN })
  expect(await ui.find({ type: 'Text', text: /Kontext 42 %$/ })).toBeDefined()
  await ui.unmount()
})

test('kontext utelämnas när sessionen inte har någon siffra än', async ($, on) => {
  await starta(on, $, null)
  const ui = await $.ui.mount({ ...BAND, plugin: PLUGIN })
  expect(await ui.find({ key: 'band-agenter' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Kontext/ })).toBeUndefined()
  await ui.unmount()
})

test('agentantalet i bandet kommer från korNu i radar.json, och Agenter-fliken nämner namnen', async ($, on) => {
  const { filer } = await starta(on, $)
  filer['status/radar.json'] = JSON.stringify({ ...RADAR_JSON, korNu: ['gamma-cookies', 'rooflow-radar', 'alpha'] })
  await $.command.run({ command: 'radar', args: '' })
  const band = await $.ui.mount({ ...BAND, plugin: PLUGIN })
  expect((await band.find({ key: 'band-agenter' }))?.props.label).toBe('Agenter 3 kör')
  await band.unmount()
  const panel = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await panel.press({ key: 'flik-agenter' })
  expect(await panel.find({ type: 'Text', text: /gamma-cookies, rooflow-radar, alpha/ })).toBeDefined()
  await panel.unmount()
  filer['status/radar.json'] = JSON.stringify({ ...RADAR_JSON, korNu: [] })
  await $.command.run({ command: 'radar', args: '' })
  const tomt = await $.ui.mount({ ...BAND, plugin: PLUGIN })
  expect((await tomt.find({ key: 'band-agenter' }))?.props.label).toBe('Agenter 0 kör')
  await tomt.unmount()
})

test('Agenter räknas som bandet: Kör nu visar bara korNu, de som väntar räknas bara som väntande', async ($, on) => {
  const { filer } = await starta(on, $)
  const vantande = (slug: string, behover: string, vantarPa: 'deploy' | 'beslut') => ({ slug, namn: slug, vad: 'klart, väntar', lage: `väntar: ${behover}`, sedan: '', modell: '', behover, vantarPa })
  filer['status/radar.json'] = JSON.stringify({
    ...RADAR_JSON,
    rorSig: [vantande('alpha-a', 'deploy', 'deploy'), vantande('alpha-b', 'B3', 'beslut'), { slug: 'gamma', namn: 'Gamma', vad: 'fast', lage: 'fast', sedan: '', modell: '' }],
    vantarPa: {
      restart: [], annat: [],
      deploy: [{ slug: 'alpha-a', namn: 'alpha-a', behover: 'deploy', sedan: '', gorNu: '' }],
      beslut: [{ slug: 'alpha-b', namn: 'alpha-b', behover: 'B3', sedan: '', gorNu: '' }],
    },
    korNu: [],
  })
  await $.command.run({ command: 'radar', args: '' })
  const band = await $.ui.mount({ ...BAND, plugin: PLUGIN })
  expect((await band.find({ key: 'band-agenter' }))?.props.label).toBe('Agenter 0 kör, 2 väntar')
  await band.unmount()
  const panel = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await panel.press({ key: 'flik-agenter' })
  expect(await panel.find({ key: 'flik-agenter', label: /^Agenter 0 · 2 väntar/ })).toBeDefined()
  expect(await panel.find({ key: 'ag-rubrik-kor', label: '▾ Kör nu (0)' })).toBeDefined()
  expect(await panel.find({ key: 'ag-rubrik-ovriga', label: '▾ Övriga i rörelse (1)' })).toBeDefined()
  expect(await panel.find({ key: 'ag-rubrik-vantar-deploy', label: '▾ Väntar på deploy (1)' })).toBeDefined()
  await panel.unmount()
})

test('band och flikar: Panel visar läget med ● och ○ i samma längd, vald flik är primary och har samma text som de andra', async ($, on) => {
  await starta(on, $)
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ ...BAND, surface, plugin: PLUGIN })
    // Panelen öppnas av sig själv vid sessionsstart.
    const oppen = (await band.find({ key: 'panel' }))?.props.label
    expect(oppen).toBe('● Panel')
    await band.press({ key: 'panel' })
    const stangd = (await band.find({ key: 'panel' }))?.props.label
    expect(stangd).toBe('○ Panel')
    expect(String(stangd).length).toBe(String(oppen).length)
    await band.press({ key: 'panel' })
    await band.unmount()
  }
  const panel = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  const vald = await panel.find({ key: 'flik-beslut' })
  expect(vald?.props.label).toBe('Beslut 1')
  expect(vald?.props.variant).toBe('primary')
  expect(vald?.props.plain).toBeUndefined()
  const annan = await panel.find({ key: 'flik-idag' })
  expect(annan?.props.label).toBe('Idag')
  expect(annan?.props.variant).toBe('secondary')
  await panel.press({ key: 'flik-idag' })
  expect((await panel.find({ key: 'flik-idag' }))?.props.label).toBe('Idag')
  expect((await panel.find({ key: 'flik-idag' }))?.props.variant).toBe('primary')
  expect((await panel.find({ key: 'flik-beslut' }))?.props.variant).toBe('secondary')
  await panel.unmount()
})

test('Servrar och Agenter: rubrikerna fälls ihop och ut, och läget sparas i pluginets store', async ($, on) => {
  const { lagrat } = await starta(on, $)
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'flik-servrar' })
  expect(await ui.find({ key: 'sv-rubrik-alpha', label: '▾ Alpha (3)' })).toBeDefined()
  expect(await ui.find({ key: 'start-alpha-publicera' })).toBeDefined()
  await ui.press({ key: 'sv-rubrik-alpha' })
  expect(await ui.find({ key: 'sv-rubrik-alpha', label: '▸ Alpha (3)' })).toBeDefined()
  expect(await ui.find({ key: 'start-alpha-publicera' })).toBeUndefined()
  expect(lagrat['oppet']).toEqual({ 'servrar:alpha': false })
  await ui.press({ key: 'flik-agenter' })
  expect(await ui.find({ key: 'ag-rubrik-underagenter', label: '▾ Underagenter, senaste (2)' })).toBeDefined()
  await ui.press({ key: 'ag-rubrik-underagenter' })
  expect(await ui.find({ type: 'Text', text: /Radar utseende/ })).toBeUndefined()
  expect(lagrat['oppet']).toEqual({ 'servrar:alpha': false, 'agenter:underagenter': false })
  await ui.unmount()
})

test('panelen visar ingen förbrukning och ingen Mät nu', async ($, on) => {
  const { prompts } = await starta(on, $)
  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface, plugin: PLUGIN })
    for (const flik of ['flik-beslut', 'flik-servrar', 'flik-kommandon']) {
      await valjFlik(ui, flik)
      expect(await ui.find({ key: 'mat-nu' })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: /Förbrukning|Mät nu|\$|USD|dollar/ })).toBeUndefined()
    }
    await ui.unmount()
  }
  expect(prompts.length).toBe(0)
})

test('Servrar: alla run.json, Starta i eget fönster via scripts/servers.js, Kör nu med pid och port, Öppna och Stoppa', async ($, on) => {
  const { korda, toasts } = await starta(on, $)
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'flik-servrar' })
  expect(korda.some(a => a.join(' ') === 'node scripts/servers.js status')).toBe(true)
  expect(await ui.find({ type: 'Text', text: /^Kör nu \(0\)$/ })).toBeDefined()
  expect(await ui.find({ key: 'start-alpha-publicera', label: 'Starta' })).toBeDefined()
  expect(await ui.find({ key: 'start-alpha-admin', label: 'Starta som svc.admin' })).toBeDefined()

  await ui.press({ key: 'start-alpha-publicera' })
  expect(korda.some(a => a.join(' ') === 'node scripts/servers.js start alpha publicera')).toBe(true)
  expect(toasts.some(t => t.includes('eget fönster "RooFlow Alpha publicera"'))).toBe(true)
  expect(await ui.find({ type: 'Text', text: /^Kör nu \(1\)$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Alpha publicera · sedan 2030-01-23 17:00 · pid 4242 · port 5000/ })).toBeDefined()
  expect(await ui.find({ key: 'start-alpha-publicera' })).toBeUndefined()
  expect(await ui.find({ key: 'stopp-alpha-publicera' })).toBeDefined()

  await ui.press({ key: 'oppna-kor-alpha-publicera-5000' })
  expect(korda.some(a => a.join(' ') === 'rundll32 url.dll,FileProtocolHandler http://localhost:5000')).toBe(true)

  // Stoppa kräver ett andra tryck, som Ta bort i Inkorg.
  await ui.press({ key: 'stopp-alpha-publicera' })
  expect(korda.some(a => a.join(' ') === 'node scripts/servers.js stop alpha publicera')).toBe(false)
  expect(await ui.find({ key: 'stopp-alpha-publicera-ja', label: 'Stoppa? Ja' })).toBeDefined()
  await ui.press({ key: 'stopp-alpha-publicera-ja' })
  expect(korda.some(a => a.join(' ') === 'node scripts/servers.js stop alpha publicera')).toBe(true)
  expect(await ui.find({ type: 'Text', text: /^Kör nu \(0\)$/ })).toBeDefined()
  expect(await ui.find({ key: 'start-alpha-publicera' })).toBeDefined()

  // Med konto: runas i eget fönster, lösenordet frågas av Windows och passerar aldrig moden.
  await ui.press({ key: 'start-alpha-admin' })
  expect(korda.find(a => a.includes('runas'))?.join(' ')).toBe('cmd /c start runas /user:svc.admin cmd /k cd /d C:\\work\\alpha && Alpha.exe')
  expect(korda.some(a => a.join(' ') === 'node scripts/servers.js start alpha admin')).toBe(false)
  await ui.unmount()
})

test('Servrar: ett startfel från skriptet blir en toast, och servrar som redan kör syns efter en omladdning', async ($, on) => {
  const { toasts, servrar } = await starta(on, $)
  servrar['alpha-publicera'] = { nyckel: 'alpha-publicera', slug: 'alpha', namn: 'publicera', pid: 77, startad: '2030-01-23 08:00', lever: true, portar: [] }
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'flik-servrar' })
  expect(await ui.find({ type: 'Text', text: /Alpha publicera · sedan 2030-01-23 08:00 · pid 77 · ingen port än/ })).toBeDefined()
  expect(await ui.find({ key: 'kor-stopp-alpha-publicera' })).toBeDefined()
  expect(toasts.length).toBe(0)

  await ui.press({ key: 'start-alpha-trasig' })
  expect(toasts).toContain('Alpha trasig startade inte: finns inte i status/radar.json')
  expect(await ui.find({ key: 'start-alpha-trasig' })).toBeDefined()
  await ui.unmount()
})

test('Servrar på mobilen: ingen Öppna-knapp (localhost är datorns)', async ($, on) => {
  const { servrar } = await starta(on, $)
  servrar['alpha-publicera'] = { nyckel: 'alpha-publicera', slug: 'alpha', namn: 'publicera', pid: 77, startad: '2030-01-23 08:00', lever: true, portar: [5000] }
  const ui = await $.ui.mount({ ...PANE, surface: 'mobile', plugin: PLUGIN })
  await ui.press({ key: 'flik-servrar' })
  expect(await ui.find({ key: 'kor-stopp-alpha-publicera' })).toBeDefined()
  expect(await ui.find({ key: 'oppna-kor-alpha-publicera-5000' })).toBeUndefined()
  await ui.unmount()
})

test('Agenter: kör nu med statusfil, underagenter med och utan klar, rapporter som fälls ut, orapporterad i text', async ($, on) => {
  await starta(on, $)
  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface, plugin: PLUGIN })
    await ui.press({ key: 'flik-agenter' })
    expect((await ui.find({ key: 'flik-agenter', label: 'Agenter 1' }))?.props.variant).toBe('primary')
    expect(await ui.find({ type: 'Text', text: /^RooFlow · kör 10 min · sedan 2030-01-23 16:50 · opus$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^bygger Radar$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /2030-01-23 15:00 · rooflow · sonnet Radar utseende · ingen klar-rad/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /RSS i Gamma · klar 2030-01-22 09:40: Klar, abc1234/ })).toBeDefined()
    // De orapporterade överst; Ägare: och Blockerat: syns på den hopfällda raden.
    expect(await ui.find({ key: 'rapport-0', label: '▸ 2030-01-22 12:00 · gamma · 2030-01-22-gamma · ORAPPORTERAD · visa' })).toBeDefined()
    expect(await ui.find({ key: 'rapport-1', label: '▸ 2030-01-23 16:00 · rooflow · 2030-01-23-rooflow-radar · visa' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^ {4}Ägare: B7; omstart$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^ {4}Blockerat: Gamma behöver startas om$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Gjort: {6}radar\.js/ })).toBeUndefined()
    await ui.press({ key: 'rapport-1' })
    expect(await ui.find({ type: 'Text', text: /Gjort: {6}radar\.js/ })).toBeDefined()
    expect(await ui.find({ key: 'rapport-1', label: /dölj$/ })).toBeDefined()
    await ui.press({ key: 'rapport-1' })
    await ui.unmount()
  }
})

test('Inkorg: sektioner med antal, Now öppen, posterna fälls ut, Sortera skickar /inbox en gång, Ny rad fyller i', async ($, on) => {
  const { kommandon, fyllda } = await starta(on, $)
  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface, plugin: PLUGIN })
    await valjFlik(ui, 'flik-inkorg')
    expect((await ui.find({ key: 'flik-inkorg', label: 'Inkorg 2' }))?.props.variant).toBe('primary')
    expect(await ui.find({ type: 'Text', text: /^Inkorg: 2 osorterade \(4 i alla sektioner\), äldsta 2030-01-01$/ })).toBeDefined()
    expect(await ui.find({ key: 'ink-sek-0', label: '▾ Now (2)' })).toBeDefined()
    expect(await ui.find({ key: 'ink-sek-1', label: '▸ Agent (2)' })).toBeDefined()
    expect(await ui.find({ key: 'ink-sek-2', label: '▸ Expensive review (0)' })).toBeDefined()
    expect(await ui.find({ type: 'Button', text: /Done/ })).toBeUndefined()
    // Now är öppen: första raden syns, fortsättningsraden inte förrän posten fälls ut
    expect(await ui.find({ key: 'ink-post-aaaa1111', label: '▸ 2030-01-01 · Ada · Mata in arkivexempel · visa' })).toBeDefined()
    expect(await ui.find({ key: 'ink-post-cccc3333' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /fortsättning rad två/ })).toBeUndefined()
    await ui.press({ key: 'ink-post-bbbb2222' })
    expect(await ui.find({ type: 'Text', text: /fortsättning rad två/ })).toBeDefined()
    await ui.press({ key: 'ink-sek-1' })
    expect(await ui.find({ key: 'ink-post-cccc3333' })).toBeDefined()
    await ui.press({ key: 'ink-sek-0' })
    expect(await ui.find({ key: 'ink-post-aaaa1111' })).toBeUndefined()
    await ui.press({ key: 'ink-sek-0' })
    await ui.press({ key: 'ink-sek-1' })
    await ui.press({ key: 'ink-post-bbbb2222' })
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'inkorg-sortera' })
  await ui.press({ key: 'inkorg-sortera-skickat' })
  expect(kommandon.filter(k => k === 'inbox').length).toBe(1)
  await ui.press({ key: 'inkorg-ny' })
  expect(fyllda).toContain('/inbox ')
  await ui.unmount()
})

test('Inkorg: Klar kör scripts/inbox.js med hashen, utan tur i RooFlow, och läser om radar.json efteråt', async ($, on) => {
  const { korda, prompts, kommandon } = await starta(on, $)
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'flik-inkorg' })
  korda.length = 0
  await ui.press({ key: 'ink-klar-aaaa1111' })
  expect(korda.map(a => a.join(' '))).toEqual(['node scripts/inbox.js done aaaa1111', 'node scripts/radar.js --tyst'])
  expect(prompts.length).toBe(0)
  expect(kommandon.length).toBe(0)
  // utfälld post: Klar finns kvar (en knapp, inte två)
  await ui.press({ key: 'ink-post-aaaa1111' })
  korda.length = 0
  await ui.press({ key: 'ink-klar-aaaa1111' })
  expect(korda[0]?.join(' ')).toBe('node scripts/inbox.js done aaaa1111')
  await ui.unmount()
})

test('Inkorg: ett fel från scripts/inbox.js (hashen finns inte längre) blir en toast', async ($, on) => {
  const { toasts } = await starta(on, $)
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'flik-inkorg' })
  await ui.press({ key: 'ink-sek-1' })
  await ui.press({ key: 'ink-klar-dddd4444' })
  expect(toasts).toContain('Inkorgen: ingen post med hash dddd4444')
  await ui.unmount()
})

test('Inkorg: Ta bort kräver ett andra tryck inom 10 sekunder; Nej och utebliven bekräftelse tar inte bort', async ($, on) => {
  const { korda, klocka } = await starta(on, $)
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'flik-inkorg' })
  await ui.press({ key: 'ink-post-aaaa1111' })
  korda.length = 0
  await ui.press({ key: 'ink-tabort-aaaa1111' })
  expect(korda.length).toBe(0)
  expect(await ui.find({ key: 'ink-bekrafta-aaaa1111', label: 'Ta bort? Ja' })).toBeDefined()
  // Nej
  await ui.press({ key: 'ink-nej-aaaa1111' })
  expect(await ui.find({ key: 'ink-tabort-aaaa1111' })).toBeDefined()
  expect(korda.length).toBe(0)
  // utebliven bekräftelse
  await ui.press({ key: 'ink-tabort-aaaa1111' })
  await klocka.advance(11_000)
  expect(await ui.find({ key: 'ink-bekrafta-aaaa1111' })).toBeUndefined()
  expect(await ui.find({ key: 'ink-tabort-aaaa1111' })).toBeDefined()
  expect(korda.length).toBe(0)
  // bekräftad
  await ui.press({ key: 'ink-tabort-aaaa1111' })
  await ui.press({ key: 'ink-bekrafta-aaaa1111' })
  expect(korda.map(a => a.join(' '))).toEqual(['node scripts/inbox.js remove aaaa1111', 'node scripts/radar.js --tyst'])
  await ui.unmount()
})

test('Inkorg: Flytta… ger en knapp per annan sektion; Agent, Löfte och Beslut fyller bara i prompten', async ($, on) => {
  const { korda, fyllda, prompts, kommandon } = await starta(on, $)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop', plugin: PLUGIN })
  await ui.press({ key: 'flik-inkorg' })
  await ui.press({ key: 'ink-post-bbbb2222' })
  await ui.press({ key: 'ink-agent-bbbb2222' })
  await ui.press({ key: 'ink-lofte-bbbb2222' })
  await ui.press({ key: 'ink-beslut-bbbb2222' })
  expect(fyllda).toEqual([
    '/agent 2030-01-10 · Ada · Exempelpost fortsättning rad två',
    '/promise 2030-01-10 · Ada · Exempelpost fortsättning rad två',
    '/decisions new: 2030-01-10 · Ada · Exempelpost fortsättning rad två',
  ])
  expect(prompts.length).toBe(0)
  expect(kommandon.length).toBe(0)
  await ui.press({ key: 'ink-flytta-bbbb2222' })
  expect(await ui.find({ key: 'ink-till-bbbb2222-0', label: 'Agent' })).toBeDefined()
  expect(await ui.find({ key: 'ink-till-bbbb2222-2', label: 'Later' })).toBeDefined()
  expect(await ui.find({ key: 'ink-till-bbbb2222-3' })).toBeUndefined()
  korda.length = 0
  await ui.press({ key: 'ink-till-bbbb2222-2' })
  expect(korda.map(a => a.join(' '))).toEqual(['node scripts/inbox.js move bbbb2222 Later', 'node scripts/radar.js --tyst'])
  await ui.unmount()
})

test('Kommandon: morgon, inkorg, fredag, radar, överlämning först, sedan resten; ett tryck ger ett kommando', async ($, on) => {
  const { kommandon, korda } = await starta(on, $)
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'flik-kommandon' })
  for (const n of ['/morning', '/inbox', '/friday', '/radar', '/handover', '/promise']) expect(await ui.find({ key: `kommando-${n}` })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Möten, igår, agenter$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /kostar en tur/ })).toBeDefined()
  await ui.press({ key: 'kommando-/morning' })
  expect(await ui.find({ key: 'kommando-/morning' })).toBeUndefined()
  await ui.press({ key: 'kommando-/morning-skickat' })
  expect(kommandon.filter(k => k === 'morning').length).toBe(1)
  expect(await ui.find({ key: 'kommando-/radar', label: '/radar (1 tur)' })).toBeDefined()
  await ui.press({ key: 'kommando-/radar' })
  expect(kommandon).toContain('radar')
  expect(korda.some(a => a[0] === 'claude')).toBe(false)
  await ui.unmount()
})

test('projektrummet: senaste commits ur radar.json, utan att köra git', async ($, on) => {
  const { korda } = await starta(on, $)
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'flik-projekt' })
  await ui.press({ key: 'proj-alpha' })
  expect(await ui.find({ type: 'Text', text: /^Senaste commits \(2\)$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^a1b2c3d 2030-01-18 09:55 feat\(alpha\): första versionen$/ })).toBeDefined()
  expect(korda.some(a => a[0] === 'git')).toBe(false)
  await ui.unmount()
})

test('avisering: inget för det som väntade vid start, en per nytt B-id, inte två gånger', async ($, on) => {
  const { filer, toasts } = await starta(on, $)
  expect(toasts.filter(t => t.startsWith('Nytt beslut')).length).toBe(0)
  const B9 = { ...B3, id: 'B9', rubrik: 'Ny fråga från Gamma', blockerar: 'Gamma-agenten' }
  filer['status/radar.json'] = JSON.stringify({ ...RADAR_JSON, beslut: [B3, B9] })
  await $.command.run({ command: 'radar', args: '' })
  expect(toasts.filter(t => t.startsWith('Nytt beslut'))).toEqual(['Nytt beslut B9: Ny fråga från Gamma (blockerar Gamma-agenten)'])
  await $.command.run({ command: 'radar', args: '' })
  filer['status/radar.json'] = JSON.stringify({ ...RADAR_JSON, beslut: [B9, { ...B3, id: 'B10', rubrik: 'Annan', blockerar: '' }] })
  await $.command.run({ command: 'radar', args: '' })
  expect(toasts.filter(t => t.startsWith('Nytt beslut'))).toEqual(['Nytt beslut B9: Ny fråga från Gamma (blockerar Gamma-agenten)', 'Nytt beslut B10: Annan'])
})

test('/radar kör skriptet först', async ($, on) => {
  const { korda } = await starta(on, $)
  const fore = korda.length
  await $.command.run({ command: 'radar', args: '' })
  expect(korda.slice(fore).some(a => a.join(' ') === 'node scripts/radar.js --tyst')).toBe(true)
})


test('Idag: Klar per rad kör scripts/today.js och scripts/promise.js med hash, utan tur, och läser om radar.json', async ($, on) => {
  const { korda, prompts, kommandon } = await starta(on, $)
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'flik-idag' })
  expect(await ui.find({ key: 'idag-klar-0' })).toBeUndefined()
  expect(await ui.find({ key: 'idag-klar-1', label: 'Klar: Möte om Gamma' })).toBeDefined()
  expect((await ui.find({ key: 'idag-klar-1' }))?.props.autoFocus).toBe(true)
  korda.length = 0
  await ui.press({ key: 'idag-klar-1' })
  expect(korda.map(a => a.join(' '))).toEqual(['node scripts/today.js done i2222222', 'node scripts/radar.js --tyst'])
  korda.length = 0
  await ui.press({ key: 'lofte-klar-0' })
  expect(korda.map(a => a.join(' '))).toEqual(['node scripts/promise.js done l1111111', 'node scripts/radar.js --tyst'])
  korda.length = 0
  await ui.press({ key: 'vantar-klar-0' })
  expect(korda.map(a => a.join(' '))).toEqual(['node scripts/promise.js done v1111111', 'node scripts/radar.js --tyst'])
  expect(prompts.length + kommandon.length).toBe(0)
  await ui.unmount()
})

test('Idag: äldre radar.json utan hash ger ingen Klar-knapp', async ($, on) => {
  const { filer } = await starta(on, $)
  const utan = { ...RADAR_JSON, idag: { datum: '2030-01-23', saker: [{ klar: false, text: 'Möte' }] }, loften: [{ ...RADAR_JSON.loften[0], hash: undefined }] }
  filer['status/radar.json'] = JSON.stringify(utan)
  await $.command.run({ command: 'radar', args: '' })
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'flik-idag' })
  expect(await ui.find({ type: 'Text', text: /^\[ \] kvar: Möte$/ })).toBeDefined()
  expect(await ui.find({ key: 'idag-klar-0' })).toBeUndefined()
  expect(await ui.find({ key: 'lofte-klar-0' })).toBeUndefined()
  await ui.unmount()
})

test('gammal data: över 15 minuter står "Radar HH:MM gammal" i bandet och överst i panelen, annars inget', async ($, on) => {
  const { klocka } = await starta(on, $)
  const band = await $.ui.mount({ ...BAND, plugin: PLUGIN })
  const pane = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  expect(await band.find({ type: 'Text', text: /gammal/ })).toBeUndefined()
  expect(await pane.find({ type: 'Text', text: /gammal/ })).toBeUndefined()
  await klocka.advance(16 * 60_000)
  expect(await band.find({ type: 'Text', text: 'Radar 17:00 gammal' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: 'Radar 17:00 gammal' })).toBeDefined()
  await pane.unmount()
  await band.unmount()
})

test('okänt format i radar.json varnar i text, rätt format gör det inte', async ($, on) => {
  const { filer } = await starta(on, $)
  filer['status/radar.json'] = JSON.stringify({ ...RADAR_JSON, format: 2 })
  await $.command.run({ command: 'radar', args: '' })
  const pane = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  expect(await pane.find({ type: 'Text', text: /format 2 men moden läser format 1/ })).toBeDefined()
  filer['status/radar.json'] = JSON.stringify(RADAR_JSON)
  await $.command.run({ command: 'radar', args: '' })
  expect(await pane.find({ type: 'Text', text: /format/ })).toBeUndefined()
  await pane.unmount()
})

test('mobilen: sammanfattningen är panelens första rad, flik 1–5 och Mer; Mer visar resten och Färre döljer dem', async ($, on) => {
  await starta(on, $)
  const m = await $.ui.mount({ ...PANE, surface: 'mobile', plugin: PLUGIN })
  expect(await m.find({ type: 'Text', text: 'Idag 1 · Agenter 1 kör · Kontext 42 %' })).toBeDefined()
  for (const f of ['beslut', 'idag', 'projekt', 'servrar', 'agenter']) expect(await m.find({ key: `flik-${f}` })).toBeDefined()
  for (const f of ['inkorg', 'kommandon', 'filer']) expect(await m.find({ key: `flik-${f}` })).toBeUndefined()
  await m.press({ key: 'flik-mer' })
  for (const f of ['inkorg', 'kommandon', 'filer']) expect(await m.find({ key: `flik-${f}` })).toBeDefined()
  expect(await m.find({ key: 'flik-mer', label: 'Färre' })).toBeDefined()
  await m.press({ key: 'flik-mer' })
  expect(await m.find({ key: 'flik-filer' })).toBeUndefined()
  await m.unmount()
  const d = await $.ui.mount({ ...PANE, surface: 'desktop', plugin: PLUGIN })
  expect(await d.find({ type: 'Text', text: /^Idag 1 · / })).toBeUndefined()
  expect(await d.find({ key: 'flik-mer' })).toBeUndefined()
  expect(await d.find({ key: 'flik-filer' })).toBeDefined()
  await d.unmount()
})

test('flikarna: de ovalda är inte dimColor, den valda är ifylld', async ($, on) => {
  await starta(on, $)
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  expect(await ui.find({ key: 'flik-idag', label: 'Idag' })).toBeDefined()
  expect((await ui.find({ key: 'flik-idag' }))?.props.dimColor).toBeUndefined()
  expect((await ui.find({ key: 'las-om' }))?.props.dimColor).toBeUndefined()
  await ui.unmount()
})

test('Filer: Leveranser (html och pdf) efter Fästa, inte bilder', async ($, on) => {
  await starta(on, $)
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'flik-filer' })
  expect(await ui.find({ type: 'Text', text: /^Leveranser \(html och pdf, 10 nyaste\)$/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /lathund\.html/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /lathund\.pdf/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /bild\.png/ })).toBeUndefined()
  await ui.unmount()
})

test('Inkorg: Ångra senaste syns när skriptet har något att ångra och kör scripts/inbox.js undo', async ($, on) => {
  const { filer, korda } = await starta(on, $)
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'flik-inkorg' })
  expect(await ui.find({ key: 'inkorg-angra' })).toBeUndefined()
  filer['status/radar.json'] = JSON.stringify({ ...RADAR_JSON, inkorg: { ...RADAR_JSON.inkorg, angra: 'ta-bort' } })
  await $.command.run({ command: 'radar', args: '' })
  expect(await ui.find({ key: 'inkorg-angra', label: 'Ångra senaste (ta-bort)' })).toBeDefined()
  korda.length = 0
  await ui.press({ key: 'inkorg-angra' })
  expect(korda.map(a => a.join(' '))).toEqual(['node scripts/inbox.js undo', 'node scripts/radar.js --tyst'])
  expect(await ui.find({ key: 'inkorg-sortera', label: 'Sortera /inbox (1 tur)' })).toBeDefined()
  await ui.unmount()
})

test('Inkorg på mobilen: utfälld post har Klar, Flytta och Mer; resten bakom Mer', async ($, on) => {
  await starta(on, $)
  const ui = await $.ui.mount({ ...PANE, surface: 'mobile', plugin: PLUGIN })
  await valjFlik(ui, 'flik-inkorg')
  await ui.press({ key: 'ink-post-bbbb2222' })
  expect(await ui.find({ key: 'ink-klar-bbbb2222' })).toBeDefined()
  expect(await ui.find({ key: 'ink-flytta-bbbb2222' })).toBeDefined()
  expect(await ui.find({ key: 'ink-mer-bbbb2222', label: 'Mer' })).toBeDefined()
  for (const k of ['tabort', 'agent', 'lofte', 'beslut']) expect(await ui.find({ key: `ink-${k}-bbbb2222` })).toBeUndefined()
  await ui.press({ key: 'ink-mer-bbbb2222' })
  for (const k of ['tabort', 'agent', 'lofte', 'beslut']) expect(await ui.find({ key: `ink-${k}-bbbb2222` })).toBeDefined()
  await ui.press({ key: 'ink-mer-bbbb2222' })
  await ui.press({ key: 'ink-post-bbbb2222' })
  await ui.unmount()
})

const VANTA = (slug: string, behover: string) => ({ slug, namn: slug, behover, sedan: '2030-02-25 10:00', gorNu: `${slug} gör något` })

test('Väntar-grupper i Agenter-fliken och "M väntar" i bandet; restart-knappen fyller i /restart', async ($, on) => {
  const { filer, fyllda, prompts } = await starta(on, $)
  filer['status/radar.json'] = JSON.stringify({
    ...RADAR_JSON,
    vantarPa: {
      restart: [VANTA('gamma-cookies', 'restart'), { ...VANTA('gamma-sok', 'restart'), projekt: 'gamma' }],
      deploy: [VANTA('gamma-guide', 'deploy')],
      beslut: [VANTA('gamma', 'B9')],
      annat: [],
    },
  })
  await $.command.run({ command: 'radar', args: '' })
  const band = await $.ui.mount({ ...BAND, plugin: PLUGIN })
  expect((await band.find({ key: 'band-agenter' }))?.props.label).toBe('Agenter 1 kör, 4 väntar')
  await band.unmount()
  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface, plugin: PLUGIN })
    await ui.press({ key: 'flik-agenter' })
    expect(await ui.find({ label: /^▾ Väntar på omstart \(2\)$/ })).toBeDefined()
    expect(await ui.find({ label: /^▾ Väntar på deploy \(1\)$/ })).toBeDefined()
    expect(await ui.find({ label: /^▾ Väntar på beslut \(1\)$/ })).toBeDefined()
    expect(await ui.find({ key: 'ag-rubrik-vantar-annat' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /gamma-cookies/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /gamma · B9 · sedan 2030-02-25 10:00/ })).toBeDefined()
    expect(await ui.find({ key: 'vantar-restart-gamma', label: 'Starta om gamma och fortsätt (1 tur)' })).toBeDefined()
    await ui.press({ key: 'vantar-restart-gamma' })
    await ui.unmount()
  }
  expect(fyllda).toContain('/restart gamma')
  expect(prompts.length).toBe(0)
})

test('äldre radar.json utan vantarPa: inga grupper och inget "väntar" i bandet', async ($, on) => {
  await starta(on, $)
  const band = await $.ui.mount({ ...BAND, plugin: PLUGIN })
  expect((await band.find({ key: 'band-agenter' }))?.props.label).toBe('Agenter 1 kör')
  await band.unmount()
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'flik-agenter' })
  expect(await ui.find({ type: 'Text', text: /^Väntar på/ })).toBeUndefined()
  await ui.unmount()
})

test('svar på beslut utan agent: bara en toast, ingen prompt; ett fel från skriptet blir en toast och knapparna kommer tillbaka', async ($, on) => {
  const { filer, korda, fyllda, toasts } = await starta(on, $)
  const b9 = { ...B3, id: 'B9', text: '- Id: B9' }
  const b13 = { ...B3, id: 'B13', text: '- Id: B13', alternativ: [{ bokstav: 'a', text: 'ja', forslag: false }] }
  filer['status/radar.json'] = JSON.stringify({ ...RADAR_JSON, beslut: [b9, b13] })
  await $.command.run({ command: 'radar', args: '' })
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'pb-rad-0' })
  await ui.press({ key: 'pb-0-a' })
  expect(korda.some(a => a.join(' ') === 'node scripts/decide.js B9 a')).toBe(true)
  expect(fyllda.some(t => t.startsWith('B9'))).toBe(false)
  expect(toasts).toContain('B9 avgjort')
  await ui.press({ key: 'pb-rad-1' })
  await ui.press({ key: 'pb-1-a' })
  expect(toasts.some(t => t.startsWith('B13: inte öppen'))).toBe(true)
  expect(await ui.find({ key: 'pb-1-a' })).toBeDefined()
  await ui.unmount()
})

test('nycklar på svenska i panelen: beslutsblocket, utan att filen ändras', async ($, on) => {
  const { filer } = await starta(on, $)
  filer['status/radar.json'] = JSON.stringify({
    ...RADAR_JSON,
    beslut: [{ ...B3, text: '- Id: B3\n- Question: Vilket förslag?\n- Why it matters: det styr bygget\n- Options: a) A. c) C.\n- Asked by: x\n- Decision:' }],
  })
  await $.command.run({ command: 'radar', args: '' })
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'pb-rad-0' })
  expect(await ui.find({ type: 'Markdown', text: /- Fråga: Vilket förslag\?/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /- Varför det spelar roll: det styr bygget/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /- Alternativ:\n {2}- \*\*A\)\*\* A/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /- Frågar: x/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /- Beslut:/ })).toBeDefined()
  expect(await ui.find({ type: 'Markdown', text: /Question|Decision|Asked by/ })).toBeUndefined()
  await ui.unmount()
})

test('bandet ryms på en rad: summan av etiketterna, hotkeys och mellanrum är högst 100 tecken (Beslut 10, Idag 2, Agenter 1 kör 1 väntar, Kontext 46 %, Vecka 10 %)', async ($, on) => {
  const { filer } = await starta(on, $, 46)
  const beslut = Array.from({ length: 10 }, (_, i) => ({ ...RADAR_JSON.beslut[0], id: `B${i + 1}` }))
  filer['status/radar.json'] = JSON.stringify({
    ...RADAR_JSON,
    beslut,
    idag: { ...RADAR_JSON.idag, saker: [{ klar: false, text: 'a', hash: 'a' }, { klar: false, text: 'b', hash: 'b' }] },
    vantarPa: { restart: [VANTA('gamma-cookies', 'restart')], deploy: [], beslut: [], annat: [] },
  })
  await $.command.run({ command: 'radar', args: '' })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop', plugin: PLUGIN })
  const etiketter: string[] = []
  for (const key of ['beslut-etikett', 'band-idag', 'band-agenter', 'vecka', 'panel', 'uppdatera']) {
    const el = await ui.find({ key })
    expect(el).toBeDefined()
    etiketter.push(String(el?.props.label))
  }
  const kontext = await ui.find({ type: 'Text', text: /^Kontext 46 %$/ })
  expect(kontext).toBeDefined()
  etiketter.push('Kontext 46 %')
  expect(etiketter).toContain('Beslut 10')
  expect(etiketter).toContain('Agenter 1 kör, 1 väntar')
  expect(etiketter).toContain('Vecka 11 %')
  const HOTKEYS = 2 * 4 // "[P] " och "[U] " framför Panel och ↻
  const GAP = 2
  const bredd = etiketter.reduce((summa, e) => summa + [...e].length, 0) + HOTKEYS + GAP * (etiketter.length - 1)
  expect(bredd).toBeLessThanOrEqual(100)
  await ui.unmount()
})

// --- Notebook gate, language, addons, platform, plugin root (the framework's own cases) ---

async function startaMed(on: On, $: Parameters<Parameters<typeof test>[1]>[0], justera: (v: ReturnType<typeof varld>) => void) {
  const v = varld(on, 42)
  justera(v)
  const klocka = mock.clock(on)
  await klocka.set(IDAG)
  await $.session.start(SESSION)
  return { ...v, klocka }
}

test('no rooflow.json at or above the session folder: no command, no panel, no process, no band, no panel drawing', async ($, on) => {
  const { registrerade, paneler, korda, filer } = await startaMed(on, $, v => {
    delete v.filer['rooflow.json']
  })
  expect(registrerade).toEqual([])
  expect(paneler).toEqual([])
  expect(korda).toEqual([])
  expect(filer['status/radar.json']).toBeDefined()
  // The mod passes both draws on (next): nothing beneath the plugin answers, so the mount is refused.
  for (const bas of [BAND, PANE]) {
    let fel = ''
    let ui: Awaited<ReturnType<typeof $.ui.mount>> | undefined
    try {
      ui = await $.ui.mount({ ...bas, plugin: PLUGIN })
    } catch (e) {
      fel = String(e)
    }
    // Older hosts refuse the mount; newer ones let it through with nothing drawn. Either way the mod draws nothing.
    if (fel) expect(fel).toMatch(/no implementation for ui\.render/)
    else {
      for (const key of ['panel', 'uppdatera', 'flik-beslut']) expect(await ui?.find({ key })).toBeUndefined()
      await ui?.unmount()
    }
  }
  // /radar and /rooflow go through untouched.
  await $.command.run({ command: 'radar', args: '' })
  expect(korda).toEqual([])
  expect(paneler).toEqual([])
})

test('a session folder inside a notebook (a subfolder) works, the scripts still run in the notebook', async ($, on) => {
  const { registrerade, korda, cwdn } = await startaMed(on, $, v => {
    v.miljo.cwd = `${ROT}\\status\\deeper`
  })
  expect(registrerade).toContain('rooflow')
  // Let the background read that session.start began finish before the test ends.
  await $.command.run({ command: 'radar', args: '' })
  expect(korda.length).toBeGreaterThan(0)
  expect(cwdn.every(c => c === ROT)).toBe(true)
})

test('the scripts run from the plugin root with the notebook as cwd', async ($, on) => {
  const { skriptRotter, cwdn, korda } = await starta(on, $)
  await $.command.run({ command: 'radar', args: '' })
  expect(skriptRotter.length).toBeGreaterThan(0)
  // The engine gives the plugin its own folder as $.plugin.root: every script path is <that folder>/scripts/<name>.js.
  const rot = (skriptRotter[0] ?? '').replace(/\\/g, '/').replace(/\/scripts\/.*$/, '')
  expect(rot).toMatch(/^([A-Za-z]:)?\//)
  for (const a of skriptRotter) expect(a.replace(/\\/g, '/').startsWith(`${rot}/scripts/`)).toBe(true)
  expect(cwdn.length).toBe(skriptRotter.length)
  expect(cwdn.every(c => c === ROT)).toBe(true)
  expect(cwdn.length).toBe(skriptRotter.length)
  expect(korda.some(a => a.join(' ') === 'node scripts/radar.js --tyst')).toBe(true)
})

test('language en (the default): labels in English, files untouched; Servers is not shown without the addon', async ($, on) => {
  const { filer, paneler } = await startaMed(on, $, v => {
    v.filer['rooflow.json'] = JSON.stringify({ format: 1 })
  })
  expect(paneler).toContain('rooflow')
  const band = await $.ui.mount({ ...BAND, plugin: PLUGIN })
  expect((await band.find({ key: 'beslut-etikett' }))?.props.label).toBe('Decisions 1')
  expect((await band.find({ key: 'band-idag' }))?.props.label).toBe('Today 1')
  expect((await band.find({ key: 'band-agenter' }))?.props.label).toBe('Agents 1 running')
  expect(await band.find({ type: 'Text', text: /^Context 42 %$/ })).toBeDefined()
  await band.unmount()
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  expect(await ui.find({ key: 'flik-beslut', label: 'Decisions 1, selected tab' })).toBeDefined()
  expect(await ui.find({ key: 'flik-idag', label: 'Today' })).toBeDefined()
  expect(await ui.find({ key: 'flik-servrar' })).toBeUndefined()
  // The hotkeys follow the visible tabs: 1-7 without Servers.
  expect((await ui.find({ key: 'flik-agenter' }))?.props.hotkey).toBe('4')
  await ui.press({ key: 'flik-idag' })
  expect(await ui.find({ type: 'Text', text: /^\[ \] open: Möte om Gamma$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Promises within 3 days \(1\)$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /2030-01-24 TOMORROW · to Pat \(ACME\): fixa rapporten/ })).toBeDefined()
  await ui.press({ key: 'flik-beslut' })
  await ui.press({ key: 'pb-rad-0' })
  // The block keys are shown in English whatever language the file is in.
  expect(await ui.find({ type: 'Markdown', text: /Question: Vilket förslag\?/ })).toBeDefined()
  expect(await ui.find({ key: 'pb-0-c', label: 'c: C, band plus panel (suggestion)' })).toBeDefined()
  expect(filer['rooflow.json']).toBe(JSON.stringify({ format: 1 }))
  await ui.unmount()
})

test('language en: the Servers tab appears with the addon, and /rooflow servers opens it', async ($, on) => {
  const { paneler } = await startaMed(on, $, v => {
    v.filer['rooflow.json'] = JSON.stringify({ language: 'en', addons: { servers: true } })
  })
  await $.command.run({ command: 'rooflow', args: 'servers' })
  expect(paneler).toContain('rooflow')
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  expect(await ui.find({ key: 'flik-servrar', label: 'Servers, selected tab' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Running \(0\)$/ })).toBeDefined()
  await ui.unmount()
})

test('platform: VS Code and the browser use the commands of the operating system', async ($, on) => {
  const { korda } = await startaMed(on, $, v => {
    v.miljo.platform = 'macos'
  })
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'flik-filer' })
  await ui.press({ key: 'fil-sen-vs-0' })
  expect(korda.some(a => a.join(' ') === 'code C:\\work\\notes\\tankar\\idé.md')).toBe(true)
  expect(korda.some(a => a[0] === 'cmd')).toBe(false)
  await ui.unmount()
})

test('ROOFLOW_ROOT names the notebook once the session is inside one; outside one it switches nothing on', async ($, on) => {
  const { korda, cwdn, registrerade } = await startaMed(on, $, v => {
    v.miljo.envRoot = 'C:\work\elsewhere'
  })
  expect(registrerade).toContain('rooflow')
  await $.command.run({ command: 'radar', args: '' })
  expect(korda.length).toBeGreaterThan(0)
  expect(cwdn.every(c => c === 'C:\work\elsewhere')).toBe(true)
})

test('ROOFLOW_ROOT alone does not switch the mod on outside a notebook', async ($, on) => {
  const { korda, registrerade } = await startaMed(on, $, v => {
    delete v.filer['rooflow.json']
    v.miljo.envRoot = 'C:\work\elsewhere'
  })
  expect(registrerade).toEqual([])
  expect(korda).toEqual([])
})

test('language en: the state words of radar.json are shown in English, in Projects and Agents', async ($, on) => {
  const { paneler } = await startaMed(on, $, v => {
    v.filer['rooflow.json'] = JSON.stringify({ format: 1 })
  })
  expect(paneler).toContain('rooflow')
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  await ui.press({ key: 'flik-agenter' })
  expect(await ui.find({ type: 'Text', text: /RooFlow · running 10 min · since 2030-01-23 16:50 · opus/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /kör 10 min/ })).toBeUndefined()
  await ui.press({ key: 'flik-projekt' })
  await ui.press({ key: 'proj-alpha' })
  expect(await ui.find({ type: 'Text', text: /^State: done \(updated 2030-01-18 10:00\)$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Doing: första versionen klar$/ })).toBeDefined()
  await ui.unmount()
})

test('Hjälp: sidorna i pluginets docs/<språk>/ läses som filer, utan tur; en sida i taget, Markdown utan HTML', async ($, on) => {
  const { filer, skriptRotter, prompts, kommandon } = await starta(on, $)
  const rot = (skriptRotter[0] ?? '').replace(/\\/g, '/').replace(/\/scripts\/.*$/, '')
  filer[`${rot}/docs/sv/02-run-json.md`] = '# run.json\n\nKommandona för Servrar.'
  filer[`${rot}/docs/sv/01-bandet.md`] = '# Bandet och panelen\n\nEn rad ovanför prompten.'
  filer[`${rot}/docs/en/01-band.md`] = '# The band\n'
  await $.command.run({ command: 'rooflow', args: 'hjälp' })
  const ui = await $.ui.mount({ ...PANE, plugin: PLUGIN })
  expect((await ui.find({ key: 'flik-hjalp', label: '? Hjälp' }))?.props.variant).toBe('primary')
  expect(await ui.find({ key: 'hjalp-01-bandet.md', label: 'Bandet och panelen' })).toBeDefined()
  expect(await ui.find({ key: 'hjalp-02-run-json.md', label: 'run.json' })).toBeDefined()
  expect(await ui.find({ key: 'hjalp-01-band.md' })).toBeUndefined()
  await ui.press({ key: 'hjalp-02-run-json.md' })
  expect(await ui.find({ type: 'Markdown', text: /Kommandona för Servrar/ })).toBeDefined()
  await ui.press({ key: 'hjalp-tillbaka' })
  expect(await ui.find({ key: 'hjalp-01-bandet.md' })).toBeDefined()
  await ui.unmount()
  expect(prompts.length).toBe(0)
  expect(kommandon.length).toBe(0)
})
