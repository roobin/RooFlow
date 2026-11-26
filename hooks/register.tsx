// Radar: the overview of a RooFlow notebook as a band above the prompt and a panel (id rooflow) beside the chat.
// scripts/radar.js is the truth: the mod reads status/radar.json and runs the script every 5 minutes.
// The mod does nothing at all unless the session's folder is inside a notebook (a folder with rooflow.json).
// It never writes the notebook's files itself: the scripts in the plugin's scripts/ folder do, with the notebook as cwd.
// An answer to a decision becomes a prompt to the session, which writes as it always does.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { HjalpSida, PanelFlik, RadarAgent, RadarBeslut, RadarData, RadarFil, RadarInkorgPost, RadarKommando, RadarProjekt, RadarSkickat } from '../types'
import {
  agentDelning, antalVantar, arStoppSvar, arUtfalld, tolkaOppet, arBekraftad, arLeverans, BEKRAFTA_MS, arSparrad, beslutEtikett, beslutGrupper, beslutRad, arTryckt, beslutSignatur, fastaFiler, filMappar, filRad, filtreraFiler, formatVarning, gammalText,
  hittaRot, hjalpTitel, hoppaOverFiler, hoppaOverProjekt, inkorgAntal, inkorgFil, inkorgTotal, isoDatum,
  klockslag, kort, MOBIL_FLIKAR, visaLage, oppnaUrlArgv, postForsta, postPrompt, rapportFalt, rapportOrdning, sammanfattning, senasteFiler, senasteLeveranser, sektionOppenStandard, skiljetecken, svarsEtikett, TOM_MILJO, tolkaInboxSvar,
  korNyckel, localhost, loftenInom, nyaBeslut, projektFarg, runasArgv, bandDelar, textPa, tolkaFarger, tolkaKonfig,
  tolkaDecideSvar, tolkaRadarJson, tolkaServrar, tolkaServrarSvar, vsCodeArgv, winSokvag, kortDatum, tolkaMorgon, punktaRader,
} from './las'
import { oversattNycklar } from './format'
import { alternativPaRader } from './las'
import { COMMANDS_FIRST, en, PROMPTS, stringsFor, sv } from './strings'
import type { Strings } from './strings'

const LAS_MS = 30_000
const SKRIPT_MS = 5 * 60_000
const MAX_FILER = 25
// The search goes over the whole notebook, the archive included, and shows more hits.
const MAX_SOK = 40
const MAX_SENASTE = 10
const MAX_LEVERANSER = 10
const MAX_I_MAPP = 50
const LOFTE_DAGAR = 3
const STATUS_MAX = 4000
const LAGEN = ['nu', 'nästa', 'väntar', 'parkerat']
// States shown unfolded in the project list; the others unfold with a button.
const LAGEN_OPPNA = ['nu', 'nästa']
const PANE = 'rooflow'
const FLIKAR: { flik: PanelFlik; namn: (S: Strings) => string }[] = [
  { flik: 'beslut', namn: S => S.tabDecisions },
  { flik: 'idag', namn: S => S.tabToday },
  { flik: 'projekt', namn: S => S.tabProjects },
  { flik: 'servrar', namn: S => S.tabServers },
  { flik: 'agenter', namn: S => S.tabAgents },
  { flik: 'inkorg', namn: S => S.tabInbox },
  { flik: 'kommandon', namn: S => S.tabCommands },
  { flik: 'filer', namn: S => S.tabFiles },
  { flik: 'hjalp', namn: S => S.tabHelp },
]

// The tabs that are shown: Servers is an addon (rooflow.json "addons": { "servers": true }). The hotkeys follow the order.
function synligaTabbar(inst: Inst): { flik: PanelFlik; namn: string; hotkey: string }[] {
  return FLIKAR.filter(f => f.flik !== 'servrar' || inst.servers).map((f, i) => ({ flik: f.flik, namn: f.namn(inst.S), hotkey: String(i + 1) }))
}

const data = atom({ plugin: 'rooflow', key: 'data' } as const, null)
const fel = atom({ plugin: 'rooflow', key: 'fel' } as const, '')
const lageOppet = atom({ plugin: 'rooflow', key: 'lageOppet' } as const, '')
const projektOppet = atom({ plugin: 'rooflow', key: 'projektOppet' } as const, '')
const filter = atom({ plugin: 'rooflow', key: 'filter' } as const, '')
const filer = atom({ plugin: 'rooflow', key: 'filer' } as const, [])
const servrar = atom({ plugin: 'rooflow', key: 'servrar' } as const, {})
const servrarLast = atom({ plugin: 'rooflow', key: 'servrarLast' } as const, '')
const kontext = atom({ plugin: 'rooflow', key: 'kontext' } as const, null)
const vecka = atom({ plugin: 'rooflow', key: 'vecka' } as const, null)
const farger = atom({ plugin: 'rooflow', key: 'farger' } as const, {})
const flik = atom({ plugin: 'rooflow', key: 'flik' } as const, 'beslut')
const skickat = atom({ plugin: 'rooflow', key: 'skickat' } as const, {})
const statusText = atom({ plugin: 'rooflow', key: 'statusText' } as const, '')
const moten = atom({ plugin: 'rooflow', key: 'moten' } as const, '')
const tryck = atom({ plugin: 'rooflow', key: 'tryck' } as const, {})
const kandaBeslut = atom({ plugin: 'rooflow', key: 'kandaBeslut' } as const, null)
const rapportOppen = atom({ plugin: 'rooflow', key: 'rapportOppen' } as const, '')
const inkorgOppen = atom({ plugin: 'rooflow', key: 'inkorgOppen' } as const, {})
const bekrafta = atom({ plugin: 'rooflow', key: 'bekrafta' } as const, null)
const flyttaVal = atom({ plugin: 'rooflow', key: 'flyttaVal' } as const, '')
const mapparOppna = atom({ plugin: 'rooflow', key: 'mapparOppna' } as const, {})
const visaArkivet = atom({ plugin: 'rooflow', key: 'visaArkivet' } as const, false)
const leveranser = atom({ plugin: 'rooflow', key: 'leveranser' } as const, [])
const beslutOppen = atom({ plugin: 'rooflow', key: 'beslutOppen' } as const, '')
const svarFritt = atom({ plugin: 'rooflow', key: 'svarFritt' } as const, '')
const merFlikar = atom({ plugin: 'rooflow', key: 'merFlikar' } as const, false)
const inkorgMer = atom({ plugin: 'rooflow', key: 'inkorgMer' } as const, '')
const miljo = atom({ plugin: 'rooflow', key: 'miljo' } as const, TOM_MILJO)
const oppet = atom({ plugin: 'rooflow', key: 'oppet' } as const, {})
const hjalpSidor = atom({ plugin: 'rooflow', key: 'hjalpSidor' } as const, [])
const hjalpVald = atom({ plugin: 'rooflow', key: 'hjalpVald' } as const, '')
const panelVersion = atom({ plugin: 'rooflow', key: 'panelVersion' } as const, 0)
const fortsatt = atom({ plugin: 'rooflow', key: 'fortsatt' } as const, [])
const fortsattVantar = atom({ plugin: 'rooflow', key: 'fortsattVantar' } as const, [])
// The fold state is kept in the plugin's store, so a heading stays folded in the next session.
const OPPET_NYCKEL = 'oppet'

// What a hook needs to know about the notebook it works for. null from instans() means "not in a notebook: do nothing".
type Inst = { rot: string; S: Strings; lang: string; plugin: string; servers: boolean; platform: string; autoContinue: boolean; undoSeconds: number }

async function instans($: EngineInterface): Promise<Inst | null> {
  const m = await read($, miljo)
  if (!m.rot) return null
  return { rot: m.rot, S: stringsFor(m.language), lang: m.language, plugin: $.plugin.root.replace(/\\/g, '/'), servers: m.servers, platform: m.platform, autoContinue: m.autoContinue !== false, undoSeconds: m.undoSeconds }
}

// The notebook the session works in: the nearest folder above the session's cwd with rooflow.json (ROOFLOW_ROOT, if set,
// names the notebook's folder once the session is inside one). null when the session is not inside a notebook.
async function bestamRot($: EngineInterface): Promise<string | null> {
  let funnen: string | null = null
  try {
    funnen = await hittaRot(await $.session.cwd(), p => $.fs.exists(p))
  } catch {
    return null
  }
  if (!funnen) return null
  try {
    const miljovariabel = await $.env.get('ROOFLOW_ROOT')
    if (miljovariabel) return miljovariabel.replace(/[\\/]+$/, '')
  } catch {
    // The variable is only an override.
  }
  return funnen.replace(/(.)[\\/]+$/, '$1')
}

// The first of the files that can be read: a file keeps its older (Swedish) name in a notebook that is not renamed.
async function lasForsta($: EngineInterface, rot: string, rels: string[]): Promise<string | null> {
  for (const rel of rels) {
    try {
      return await $.fs.read(`${rot}/${rel}`)
    } catch {
      // Try the next name.
    }
  }
  return null
}

// windows, macos or linux, from what every engine version can tell: Windows sets OS=Windows_NT; macOS has /Applications.
async function bestamPlattform($: EngineInterface): Promise<string> {
  try {
    if ((await $.env.get('OS')) === 'Windows_NT') return 'windows'
    if (await $.fs.exists('/Applications')) return 'macos'
  } catch {
    // Unknown: the Linux commands are used.
  }
  return 'linux'
}

async function lasKonfig($: EngineInterface, rot: string): Promise<void> {
  let text = ''
  try {
    text = await $.fs.read(`${rot}${skiljetecken(rot)}rooflow.json`)
  } catch {
    // No readable rooflow.json: the defaults.
  }
  const k = tolkaKonfig(text)
  await update($, miljo, m => ({ ...m, rot, language: k.language, servers: k.servers, autoContinue: k.autoContinue, undoSeconds: k.undoSeconds }))
}

// The plugin's script, run by node with the notebook as cwd (the scripts find the notebook from there).
function skript(inst: Inst, namn: string): string {
  return `${inst.plugin}/scripts/${namn}`
}

// Buttons and decisions whose press is being handled. Stops a second press before the guard has reached $.state.
const skickas = new Set<string>()

async function lasRadar($: EngineInterface, inst: Inst): Promise<void> {
  const S = inst.S
  await lasKonfig($, inst.rot)
  try {
    const d = tolkaRadarJson(await $.fs.read(`${inst.rot}/status/radar.json`))
    await update($, data, () => d)
    await update($, fel, () => (d ? formatVarning(d, S) : S.radarJsonUnparsable))
    if (d) await aviseraNyaBeslut($, inst, d)
  } catch {
    await update($, fel, () => S.radarJsonMissing)
  }
  // No colour table: every project gets the theme's subtle colour.
  const fargText = await lasForsta($, inst.rot, ['projectcolors.json', 'projektfarger.json'])
  if (fargText !== null) await update($, farger, () => tolkaFarger(fargText))
  const motenText = await lasForsta($, inst.rot, ['status/morning.md', 'status/morgon.md'])
  await update($, moten, () => motenText ?? '')
  try {
    // Free: without a breakdown the app counts nothing. percent is missing in a new or just compacted session; Context is then left out.
    const u = await $.session.usage()
    await update($, kontext, () => u.context.percent ?? null)
    // The week's use for all models. Without the window (no subscription) the band shows what radar.json says.
    await update($, vecka, () => u.rateLimits.find(r => r.kind === 'seven_day')?.percentUsed ?? null)
  } catch {
    await update($, kontext, () => null)
    await update($, vecka, () => null)
  }
  // The process list costs a PowerShell run, so it is only read while someone looks at Servers.
  if (inst.servers && (await read($, flik)) === 'servrar' && (await panelOppen($))) await lasServrar($, inst)
}

// One notice per new B-id. The first read in a session is the baseline: what already waited is not announced.
// The comparison is made inside update, and known ids are never forgotten (B-ids are not reused): two reads that cross
// (the timer and /radar) then do not announce the same decision twice.
async function aviseraNyaBeslut($: EngineInterface, inst: Inst, d: RadarData): Promise<void> {
  const S = inst.S
  let nya: RadarBeslut[] = []
  await update($, kandaBeslut, kanda => {
    nya = nyaBeslut(kanda, d.beslut)
    return [...new Set([...(kanda ?? []), ...d.beslut.map(b => b.id).filter(Boolean)])]
  })
  for (const b of nya) {
    const rad = `${b.id}: ${b.rubrik}${b.blockerar ? ` (${S.blocks(b.blockerar)})` : ''}`
    try {
      const r = await $.ui.notify(rad, { title: S.newDecisionTitle })
      if (!r.isSent) $.ui.toast(S.newDecision(rad))
    } catch {
      $.ui.toast(S.newDecision(rad))
    }
  }
}

async function koraSkriptet($: EngineInterface, inst: Inst): Promise<void> {
  try {
    await $.process.run(['node', skript(inst, 'radar.js'), '--tyst'], { cwd: inst.rot, timeoutMs: 60_000 })
  } catch (err) {
    await update($, fel, () => inst.S.scriptFailed('radar.js', String(err).slice(0, 120)))
  }
  await lasRadar($, inst)
}

// Changes a file with one of the scripts (inbox.js, today.js, promise.js): no turn in the session. An error from the script
// becomes a toast; the panel is read again afterwards. The scripts refuse if the hash no longer exists, so a changed file
// never hits the wrong line. One script at a time: a second press while the first runs does nothing.
async function radSkript($: EngineInterface, inst: Inst, namn: string, etikett: string, args: string[]): Promise<void> {
  if (skickas.has('radskript')) return
  skickas.add('radskript')
  try {
    const r = await $.process.run(['node', skript(inst, namn), ...args], { cwd: inst.rot, timeoutMs: 30_000 })
    const svar = tolkaInboxSvar(r.stdout, inst.S, namn)
    if ('fel' in svar) $.ui.toast(`${etikett}: ${svar.fel}`)
  } catch (err) {
    $.ui.toast(`${etikett}: ${String(err).slice(0, 100)}`)
  } finally {
    skickas.delete('radskript')
  }
  await koraSkriptet($, inst)
}

async function inkorgSkript($: EngineInterface, inst: Inst, args: string[]): Promise<void> {
  await radSkript($, inst, 'inbox.js', inst.S.inboxName, args)
}

// Remove and Stop need a second press within BEKRAFTA_MS. `hash` is the entry or server it concerns.
async function begarBekraftelse($: EngineInterface, hash: string, text: string): Promise<void> {
  const ms = await $.clock.now()
  await update($, bekrafta, () => ({ hash, ms }))
  // Otherwise the panel is only redrawn at the next read of radar.json, and "Yes" stays although it has expired.
  $.clock.after(BEKRAFTA_MS + 200, () => void update($, bekrafta, b => (b && b.ms === ms ? null : b)))
  $.ui.toast(text)
}

// .md files under a root, at most three folders down. rel uses slashes, sokvag is the whole path in the root's own style.
async function listaMd($: EngineInterface, rot: string, hoppa: (rel: string) => boolean): Promise<RadarFil[]> {
  const ut: RadarFil[] = []
  const ga = async (rel: string, djup: number) => {
    let lista
    try {
      lista = await $.fs.list(rel ? `${rot}/${rel}` : rot)
    } catch {
      return
    }
    for (const f of lista) {
      const r = rel ? `${rel}/${f.name}` : f.name
      if (hoppa(r) || f.name.startsWith('.')) continue
      if (f.kind === 'dir' && djup < 3) await ga(r, djup + 1)
      else if (f.kind === 'file' && f.name.endsWith('.md')) ut.push({ sokvag: winSokvag(rot, r), rel: r, mtimeMs: f.mtimeMs })
    }
  }
  await ga('', 0)
  return ut
}

// deliveries/*.html and *.pdf: what is sent on. Only the folder's own files, not subfolders.
async function listaLeveranser($: EngineInterface, rot: string): Promise<RadarFil[]> {
  const ut: RadarFil[] = []
  for (const mapp of ['deliveries', 'leveranser']) {
    try {
      const lista = await $.fs.list(`${rot}/${mapp}`)
      for (const f of lista) {
        if (f.kind === 'file' && arLeverans(f.name)) ut.push({ sokvag: winSokvag(rot, `${mapp}/${f.name}`), rel: `${mapp}/${f.name}`, mtimeMs: f.mtimeMs })
      }
    } catch {
      // The folder does not exist.
    }
  }
  return ut
}

async function lasFiler($: EngineInterface, inst: Inst): Promise<void> {
  const d = await read($, data)
  const slug = await read($, projektOppet)
  const valt = d?.projekt.find(p => p.slug === slug)
  const egna = await listaMd($, inst.rot, hoppaOverFiler)
  const projekt = valt?.dir && valt.dir !== inst.rot ? await listaMd($, valt.dir, hoppaOverProjekt) : []
  const lev = await listaLeveranser($, inst.rot)
  await update($, filer, () => [...egna, ...projekt])
  await update($, leveranser, () => lev)
}

async function oppnaProjekt($: EngineInterface, p: RadarProjekt | null): Promise<void> {
  await update($, projektOppet, () => p?.slug ?? '')
  if (!p?.statusFil) {
    await update($, statusText, () => '')
    return
  }
  try {
    const t = await $.fs.read(p.statusFil)
    await update($, statusText, () => (t.length > STATUS_MAX ? `${t.slice(0, STATUS_MAX)}\n\n…` : t))
  } catch {
    await update($, statusText, () => '')
  }
}

// The Help tab: the plugin's docs/<language>/*.md, read as files (no turn, no tokens), English when the language has none.
async function lasHjalp($: EngineInterface, inst: Inst): Promise<void> {
  const sidor: HjalpSida[] = []
  for (const sprak of [inst.lang, 'en']) {
    const mapp = `${inst.plugin}/docs/${sprak}`
    let lista
    try {
      lista = await $.fs.list(mapp)
    } catch {
      continue
    }
    const namn = lista.filter(x => x.kind === 'file' && x.name.endsWith('.md')).map(x => x.name).sort()
    for (const fil of namn) {
      try {
        const text = await $.fs.read(`${mapp}/${fil}`)
        sidor.push({ fil, titel: hjalpTitel(text, fil), text })
      } catch {
        // An unreadable page is left out.
      }
    }
    if (sidor.length) break
  }
  await update($, hjalpSidor, () => sidor)
}

async function valjFlik($: EngineInterface, inst: Inst, ny: PanelFlik): Promise<void> {
  await update($, flik, () => ny)
  if (ny === 'hjalp') await lasHjalp($, inst)
  if (ny === 'filer') await lasFiler($, inst)
  if (ny === 'servrar' && inst.servers) await lasServrar($, inst)
}

async function panelOppen($: EngineInterface): Promise<boolean> {
  try {
    return (await $.ui.panes()).some(p => p.id === PANE)
  } catch {
    return false
  }
}

// fokus=false when the panel opens by itself (session start, /radar): the prompt keeps the focus.
// The engine only takes `focus: true`, so without focus the field is left out.
async function oppnaPanel($: EngineInterface, inst: Inst, ny?: PanelFlik, fokus = true): Promise<string> {
  if (ny) await valjFlik($, inst, ny)
  const r = await $.ui.open(fokus ? { id: PANE, title: 'RooFlow', focus: true } : { id: PANE, title: 'RooFlow' })
  await update($, panelVersion, v => v + 1)
  return r.isPlaced ? inst.S.panelOpen : inst.S.panelNotDrawn(r.reason)
}

// Opens the panel without focus and without stopping anything if the surface cannot draw it.
async function oppnaPanelTyst($: EngineInterface, inst: Inst): Promise<void> {
  try {
    if (!(await panelOppen($))) await oppnaPanel($, inst, undefined, false)
  } catch {
    // The panel is a convenience; the Panel button in the band is still there.
  }
}

async function lasOppet($: EngineInterface): Promise<void> {
  try {
    const sparat = tolkaOppet(await $.store.get(OPPET_NYCKEL))
    await update($, oppet, o => ({ ...sparat, ...o }))
  } catch {
    // No store: the headings start open and are remembered for this session only.
  }
}

async function vaxlaOppet($: EngineInterface, nyckel: string): Promise<void> {
  let nytt: Record<string, boolean> = {}
  await update($, oppet, o => {
    nytt = { ...o, [nyckel]: !arUtfalld(o, nyckel) }
    return nytt
  })
  try {
    await $.store.set(OPPET_NYCKEL, nytt)
  } catch {
    // Not saved: the state still holds for this session.
  }
}

async function vaxlaPanel($: EngineInterface, inst: Inst): Promise<void> {
  if (await panelOppen($)) {
    await $.ui.close({ id: PANE })
    await update($, panelVersion, v => v + 1)
  } else {
    await oppnaPanel($, inst)
  }
}

// A press on an answer button runs scripts/decide.js (no turn): the decision is archived and the agent's status file gets a line.
// Then the session gets the answer (efterBeslut): "Continue <task>: B14 is decided ..." when the decision belongs to an agent,
// otherwise "B14 a" as the owner would have typed it, so the session acts on it; the decisions skill knows it is already
// archived. The guard is set before the script: a second press while it runs, in the band or the panel, does nothing.
async function svara($: EngineInterface, inst: Inst, b: RadarBeslut, svar: string): Promise<void> {
  const S = inst.S
  if (skickas.has(b.id)) return
  skickas.add(b.id)
  const ta_bort = async () =>
    update($, skickat, s => {
      const { [b.id]: _bort, ...rest } = s
      return rest
    })
  try {
    const nu = await $.clock.now()
    if (arSparrad((await read($, skickat))[b.id], b, nu)) return
    await update($, skickat, s => ({ ...s, [b.id]: { tid: klockslag(nu), ms: nu, bokstav: svar, signatur: beslutSignatur(b) } }))
    try {
      const r = await $.process.run(['node', skript(inst, 'decide.js'), b.id, svar], { cwd: inst.rot, timeoutMs: 90_000 })
      const ut = tolkaDecideSvar(r.stdout, S)
      if ('fel' in ut) {
        await ta_bort()
        $.ui.toast(`${b.id}: ${ut.fel.slice(0, 100)}`)
      } else {
        await efterBeslut($, inst, b.id, ut.task, ut.svar)
      }
    } catch (err) {
      await ta_bort()
      $.ui.toast(S.answerNotSent(b.id, String(err).slice(0, 80)))
    }
  } finally {
    skickas.delete(b.id)
  }
  await koraSkriptet($, inst)
}

// A decision is decided. With an agent (task) the prompt continues it; without one (task "") the prompt is "B14 a" for the
// session itself. autoContinue (the default): the prompt is sent after undoSeconds (rooflow.json, default 4), unless Undo is
// pressed in the panel or the answer holds back ("wait", "not now" ...); then a "Continue the agent" or "Send" button waits.
// autoContinue false: the prompt is filled in and the owner sends it, as before.
async function efterBeslut($: EngineInterface, inst: Inst, id: string, task: string, svar: string): Promise<void> {
  const S = inst.S
  const text = task ? S.continuePrompt(id, svar, task) : S.decisionPrompt(id, svar)
  if (!inst.autoContinue) {
    await $.prompt.fill({ text, mode: 'replace' })
    $.ui.toast(task ? S.decidedContinue(id, task) : S.decidedFill(id))
    return
  }
  if (arStoppSvar(svar)) {
    await update($, fortsattVantar, v => [...v.filter(x => x.id !== id), { id, task, text }])
    $.ui.toast(task ? S.continueHeld(id, task) : S.decidedHeld(id))
    return
  }
  if (inst.undoSeconds === 0) {
    await skickaFortsattning($, inst, id, task, text)
    return
  }
  // Several decisions can be in their undo window at once: one entry and one timer per decision.
  const ms = await $.clock.now()
  await update($, fortsatt, f => [...f.filter(x => x.id !== id), { id, task, text, ms }])
  $.ui.toast(task ? S.decidedAutoContinue(id, task, inst.undoSeconds) : S.decidedSend(id, inst.undoSeconds))
  $.clock.after(inst.undoSeconds * 1000, async () => {
    let skicka = false
    await update($, fortsatt, f => {
      skicka = f.some(x => x.id === id && x.ms === ms)
      return f.filter(x => !(x.id === id && x.ms === ms))
    })
    if (skicka) await skickaFortsattning($, inst, id, task, text)
  })
}

// After a reload the timers are gone but the state stays: what was waiting to be sent gets the button instead.
async function fortsattEfterOmladdning($: EngineInterface): Promise<void> {
  let kvar: { id: string; task: string; text: string }[] = []
  await update($, fortsatt, f => {
    kvar = f.map(x => ({ id: x.id, task: x.task, text: x.text }))
    return []
  })
  if (kvar.length) await update($, fortsattVantar, v => [...v.filter(x => !kvar.some(k => k.id === x.id)), ...kvar])
}

// task "" is a decision without an agent: the toasts name the decision instead.
async function skickaFortsattning($: EngineInterface, inst: Inst, id: string, task: string, text: string): Promise<void> {
  try {
    await $.prompt.submit({ text, asUser: true })
    $.ui.toast(task ? inst.S.continueSent(task) : inst.S.decisionSent(id))
  } catch (err) {
    // Not sent: the owner can still send it from the prompt.
    await $.prompt.fill({ text, mode: 'replace' })
    $.ui.toast(inst.S.notSent(task || id, String(err).slice(0, 80)))
  }
}

// Undo: the decision stands, nothing is sent, and the "Continue the agent" button takes its place.
async function angraFortsattning($: EngineInterface, id: string): Promise<void> {
  let angrad: { id: string; task: string; text: string } | undefined
  await update($, fortsatt, f => {
    const x = f.find(y => y.id === id)
    angrad = x ? { id: x.id, task: x.task, text: x.text } : undefined
    return f.filter(y => y.id !== id)
  })
  const a = angrad as { id: string; task: string; text: string } | undefined
  if (a) await update($, fortsattVantar, v => [...v.filter(x => x.id !== a.id), a])
}

async function fortsattNu($: EngineInterface, inst: Inst, id: string): Promise<void> {
  let vald: { id: string; task: string; text: string } | undefined
  await update($, fortsattVantar, v => {
    vald = v.find(x => x.id === id)
    return v.filter(x => x.id !== id)
  })
  const x = vald as { id: string; task: string; text: string } | undefined
  if (x) await skickaFortsattning($, inst, x.id, x.task, x.text)
}

// Buttons that cost a turn (the commands, Sort): blocked for two minutes after a press, so that an impatient
// second press does not become a second turn.
async function tryckEnGang($: EngineInterface, inst: Inst, nyckel: string, gor: () => Promise<unknown>): Promise<void> {
  if (skickas.has(nyckel)) return
  skickas.add(nyckel)
  try {
    const nu = await $.clock.now()
    if (arTryckt((await read($, tryck))[nyckel], nu)) return
    await update($, tryck, t => ({ ...t, [nyckel]: { tid: klockslag(nu), ms: nu } }))
    try {
      await gor()
    } catch (err) {
      await update($, tryck, t => {
        const { [nyckel]: _bort, ...rest } = t
        return rest
      })
      $.ui.toast(inst.S.notSent(nyckel, String(err).slice(0, 80)))
    }
  } finally {
    skickas.delete(nyckel)
  }
}

async function koraKommando($: EngineInterface, inst: Inst, namn: string): Promise<void> {
  await tryckEnGang($, inst, namn, async () => {
    try {
      await $.command.run({ command: namn.slice(1), args: '' })
    } catch {
      // The app refuses prompt.submit for text that starts with /. The command is filled in and Enter sends it.
      await $.prompt.fill({ text: namn, mode: 'replace' })
      $.ui.toast(inst.S.commandInPrompt(namn))
      await update($, tryck, t => {
        const { [namn]: _bort, ...rest } = t
        return rest
      })
    }
  })
}

function vsCode($: EngineInterface, inst: Inst, sokvag: string): void {
  void $.process.run(vsCodeArgv(inst.platform, sokvag)).catch(() => $.ui.toast(inst.S.vsCodeFailed(sokvag)))
}

// Opens the address in the system's default browser.
function oppnaUrl($: EngineInterface, inst: Inst, url: string): void {
  void $.process.run(oppnaUrlArgv(inst.platform, url)).catch(() => $.ui.toast(inst.S.urlFailed(url)))
}

async function servrarSkript($: EngineInterface, inst: Inst, args: string[]): Promise<string> {
  const r = await $.process.run(['node', skript(inst, 'servers.js'), ...args], { cwd: inst.rot, timeoutMs: 60_000 })
  return r.stdout
}

async function lasServrar($: EngineInterface, inst: Inst): Promise<void> {
  try {
    const s = tolkaServrar(await servrarSkript($, inst, ['status']))
    const nu = klockslag(await $.clock.now())
    await update($, servrar, () => s)
    await update($, servrarLast, () => nu)
  } catch (err) {
    $.ui.toast(inst.S.serversUnreadable(String(err).slice(0, 80)))
  }
}

// Start in a console window of its own through scripts/servers.js: the window is not the mod's child and survives a reload.
// With an account: runas, so that Windows asks for the password in the window. That window is not followed (no pid).
async function startaServer($: EngineInterface, inst: Inst, p: RadarProjekt, k: RadarKommando): Promise<void> {
  const S = inst.S
  if (k.konto) {
    try {
      await $.process.run(runasArgv(k.konto, k.cmd, k.cwd))
      $.ui.toast(S.startedAs(k.namn, k.konto))
    } catch (err) {
      $.ui.toast(S.notStarted(k.namn, String(err).slice(0, 80)))
    }
    return
  }
  const nyckel = korNyckel(p.slug, k.namn)
  if (skickas.has(nyckel)) return
  skickas.add(nyckel)
  try {
    const svar = tolkaServrarSvar(await servrarSkript($, inst, ['start', p.slug, k.namn]))
    if (!svar || 'fel' in svar) $.ui.toast(S.notStarted(`${p.mapp} ${k.namn}`, String(svar?.['fel'] ?? S.notStartedFile(k.namn))))
    else $.ui.toast(S.ownWindow(p.mapp, k.namn, !!svar['redan']))
  } catch (err) {
    $.ui.toast(S.notStarted(`${p.mapp} ${k.namn}`, String(err).slice(0, 80)))
  } finally {
    skickas.delete(nyckel)
  }
  await lasServrar($, inst)
}

async function stoppaServer($: EngineInterface, inst: Inst, slug: string, namn: string): Promise<void> {
  try {
    const svar = tolkaServrarSvar(await servrarSkript($, inst, ['stop', slug, namn]))
    if (svar && svar['skal']) $.ui.toast(`${namn}: ${String(svar['skal'])}`)
  } catch (err) {
    $.ui.toast(inst.S.notStopped(namn, String(err).slice(0, 80)))
  }
  await lasServrar($, inst)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const svar = await next(e)
    const rot = await bestamRot($)
    // Not inside a notebook: no command, no band, no panel, no timers, no processes.
    if (!rot) {
      await update($, miljo, () => TOM_MILJO)
      return svar
    }
    const platform = await bestamPlattform($)
    await update($, miljo, () => ({ ...TOM_MILJO, rot, platform }))
    await lasKonfig($, rot)
    const inst = await instans($)
    if (!inst) return svar
    const S = inst.S
    try {
      await $.command.register({
        name: 'rooflow',
        description: S.rooflowCommandDescription(synligaTabbar(inst).map(f => f.namn).join(', ')),
        argumentHint: `[${synligaTabbar(inst).map(f => f.namn.toLowerCase()).join('|')}]`,
        immediate: true,
      })
    } catch (err) {
      // Without /rooflow the panel can still be opened with the Panel button in the band.
      $.ui.toast(S.commandNotRegistered(String(err).slice(0, 80)))
    }
    await lasOppet($)
    if ((await read($, flik)) === 'hjalp') await lasHjalp($, inst)
    await fortsattEfterOmladdning($)
    // What is already on disk is shown at once; the script (a few seconds, git per project) runs in the background.
    await lasRadar($, inst)
    // The panel is the overview, so it is up from the start.
    await oppnaPanelTyst($, inst)
    void koraSkriptet($, inst)
    const nu = async (gor: (i: Inst) => Promise<void>) => {
      const i = await instans($)
      if (i) await gor(i)
    }
    $.clock.every(LAS_MS, () => nu(i => lasRadar($, i)))
    $.clock.every(SKRIPT_MS, () => nu(i => koraSkriptet($, i)))
    return svar
  })

  // The person can close the panel with its own close control: the band's toggle is drawn again.
  on('ui.close', async ($, e, next) => {
    const svar = await next(e)
    if (e.id === PANE) await update($, panelVersion, v => v + 1)
    return svar
  })

  // /radar is a skill of the plugin. The mod runs the script first so that the band and the answer show the same, then lets the skill go on.
  on('command.run', { command: 'radar' }, async ($, e, next) => {
    const inst = await instans($)
    if (!inst) return next(e)
    await koraSkriptet($, inst)
    await oppnaPanelTyst($, inst)
    return next(e)
  })

  on('command.run', { command: 'rooflow' }, async ($, e, next) => {
    const inst = await instans($)
    if (!inst) return next(e)
    const arg = (e.args ?? '').trim().toLowerCase()
    const ny = FLIKAR.filter(f => f.flik !== 'servrar' || inst.servers).find(
      f =>
        f.flik === arg ||
        f.namn(sv).toLowerCase() === arg ||
        f.namn(en).toLowerCase() === arg ||
        (f.flik === 'hjalp' && ['?', 'hjälp', 'help'].includes(arg)),
    )?.flik
    return { text: await oppnaPanel($, inst, ny) }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const inst = await instans($)
    if (!inst) return next(e)
    const S = inst.S
    const d = await read($, data)
    const feltext = await read($, fel)
    if (e.props.hasSurvey || (d === null && !feltext)) return next(e)
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    await read($, panelVersion)
    // One toggle that opens and closes the panel: "● Panel" open, "○ Panel" closed. The label is what is drawn (a Text child
    // is not), and both labels have the same length so that the band does not move when it is pressed.
    const arOppen = await panelOppen($)
    const panelKnapp = <Button key="panel" plain hotkey="p" label={`${arOppen ? '●' : '○'} ${S.panelButton}`} onPress={() => void vaxlaPanel($, inst)} />

    if (d === null) {
      return (
        <Box flexDirection="row" gap={1}>
          <Text color="warning">{feltext}</Text>
          <Button key="uppdatera" plain dimColor label={S.refresh} onPress={() => void koraSkriptet($, inst)} />
          {panelKnapp}
        </Box>
      )
    }

    const v = await read($, vecka)
    const delar = bandDelar(d, await read($, kontext), S)
    const veckaText = v !== null ? S.week(Math.round(v)) : d.usage?.vecka && d.usage.vecka !== '?' ? S.week(d.usage.vecka) : ''
    // If scripts/radar.js stops, yesterday's numbers stay: a short warning in text, so that the band stays on one row.
    const gammal = gammalText(d.genererad, await $.clock.now(), S)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={0} flexWrap="wrap">
          {d.beslut.length ? (
            // The label opens the Decisions tab in the panel, where the decisions are in full text.
            <Button key="beslut-etikett" plain label={beslutEtikett(d.beslut.length, S)} onPress={() => void oppnaPanel($, inst, 'beslut')} />
          ) : (
            <Text>{beslutEtikett(0, S)}</Text>
          )}
          <Button key="band-idag" plain label={delar.idag} onPress={() => void oppnaPanel($, inst, 'idag')} />
          <Button key="band-agenter" plain label={delar.agenter} onPress={() => void oppnaPanel($, inst, 'agenter')} />
          {delar.kontext ? <Text>{delar.kontext}</Text> : null}
          {gammal ? <Text color="warning">{gammal}</Text> : null}
          {veckaText ? (
            // A click should give the app's usage box. It is only drawn when you send /usage yourself: $.command.run gives the
            // mod only the heading row, and prompt.submit refuses text that starts with /. So the prompt is filled in and Enter shows the box.
            <Button key="vecka" plain label={veckaText} onPress={() => void $.prompt.fill({ text: PROMPTS.usage, mode: 'replace' })} />
          ) : null}
          {panelKnapp}
          <Button key="uppdatera" plain dimColor hotkey="u" label="↻" onPress={() => void koraSkriptet($, inst)} />
        </Box>
        {feltext ? <Text color="warning">{feltext}</Text> : null}
        {/* The decisions are shown and decided only in the panel: the band clipped the text so that it was impossible to decide. */}
      </Box>
    )
  })

  // The panel is drawn on every connected surface, mobile too: there is no Input there, and buttons that
  // open something on the computer (VS Code, the browser) are not shown.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    const inst = await instans($)
    if (!inst) return next(e)
    const S = inst.S
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const d = await read($, data)
    const feltext = await read($, fel)
    const lagrad = await read($, flik)
    const tabbar = synligaTabbar(inst)
    const vald = tabbar.some(f => f.flik === lagrad) ? lagrad : 'beslut'
    const bredd = Math.max(30, e.props.bodyColumns)
    const mobil = e.surface === 'mobile'
    const mer = await read($, merFlikar)

    // A Button draws its label, not a Text child, and `plain` cancels `variant`. So the tabs are ordinary buttons with the
    // same label as always: the chosen one is "primary" (filled), the others "secondary". Same chrome and same text means
    // that nothing changes width when a tab is chosen. On mobile tabs 1–5 and the chosen one are shown, the rest behind "More".
    const synligaFlikar = mobil && !mer ? tabbar.filter((f, i) => i < MOBIL_FLIKAR || f.flik === vald) : tabbar
    const flikrad = (
      <Box flexDirection="row" gap={1} flexWrap="wrap">
        {synligaFlikar.map(f => {
          const namn = d ? flikNamn(f.flik, f.namn, d, inst) : f.namn
          return (
            <Button
              key={`flik-${f.flik}`}
              hotkey={f.hotkey}
              variant={vald === f.flik ? 'primary' : 'secondary'}
              label={namn}
              onPress={() => void valjFlik($, inst, f.flik)}
            />
          )
        })}
        {mobil ? <Button key="flik-mer" plain label={mer ? S.fewer : S.more} onPress={() => void update($, merFlikar, x => !x)} /> : null}
        <Button key="las-om" plain hotkey="u" label={S.reload} onPress={() => void koraSkriptet($, inst)} />
      </Box>
    )

    if (d === null) {
      return (
        <Box flexDirection="column" gap={1}>
          {flikrad}
          <Text color={feltext ? 'warning' : undefined}>{feltext || S.readingRadar}</Text>
        </Box>
      )
    }

    const nu = await $.clock.now()
    const gammal = gammalText(d.genererad, nu, S)
    let innehall
    if (vald === 'idag') innehall = await idagFlik($, inst, d, els)
    else if (vald === 'projekt') innehall = await projektFlik($, inst, d, bredd, mobil, els)
    else if (vald === 'servrar') innehall = await servrarFlik($, inst, d, mobil, els)
    else if (vald === 'agenter') innehall = await agentFlik($, inst, d, els)
    else if (vald === 'inkorg') innehall = await inkorgFlik($, inst, d, (await read($, tryck))['/inbox'], nu, mobil, els)
    else if (vald === 'kommandon') innehall = kommandoFlik($, inst, d, await read($, tryck), nu, els)
    else if (vald === 'filer') innehall = await filFlik($, inst, d, mobil, els)
    else if (vald === 'hjalp') innehall = await hjalpFlik($, inst, els)
    else innehall = await beslutFlik($, inst, d, await read($, skickat), nu, bredd, mobil, els)

    return (
      <Box flexDirection="column" gap={1}>
        {/* The band is not shown on mobile: the panel's first row is then the same summary. */}
        {mobil ? <Text key="sammanfattning">{sammanfattning(d, await read($, kontext), S)}</Text> : null}
        {gammal ? <Text color="warning">{gammal}</Text> : null}
        {flikrad}
        {feltext ? <Text color="warning">{feltext}</Text> : null}
        {innehall}
        <Text dimColor>{S.radarFrom(d.genererad)}</Text>
      </Box>
    )
  })
}

function flikNamn(f: PanelFlik, namn: string, d: RadarData, inst: Inst): string {
  if (f === 'beslut') return `${namn} ${d.beslut.length}`
  // The same two numbers as the band's "Agents 0 running, 2 waiting".
  if (f === 'agenter') return inst.S.tabAgentsCount((d.korNu ?? []).length, antalVantar(d))
  if (f === 'inkorg') return `${namn} ${inkorgAntal(d)}`
  return namn
}

// The element constructors are passed in as any: the table is a union per surface and the JSX tags only need to be callable.
/* eslint-disable @typescript-eslint/no-explicit-any */

// The answer buttons of a decision. Blocked: an inactive button with the time instead.
// The label carries the alternative's text (about 40 characters) so that the button can be understood without the block.
function svarsknappar($: EngineInterface, inst: Inst, b: RadarBeslut, prefix: string, s: RadarSkickat | undefined, nu: number, mobil: boolean, fritt: string, els: any) {
  const S = inst.S
  const { Box, Button, Input } = els
  if (s && arSparrad(s, b, nu)) {
    return (
      <Box flexDirection="row" gap={1} flexWrap="wrap">
        <Button
          key={`${prefix}-skickat`}
          plain
          dimColor
          label={S.answered(s.tid, kort(s.bokstav, 30))}
          onPress={() => $.ui.toast(S.answeredToast(b.id, s.tid))}
        />
      </Box>
    )
  }
  return (
    <Box flexDirection="row" gap={1} flexWrap="wrap">
      {b.alternativ.map(alt => (
        <Button
          key={`${prefix}-${alt.bokstav}`}
          variant={alt.forslag ? 'primary' : 'secondary'}
          label={svarsEtikett(alt, S)}
          onPress={() => void svara($, inst, b, alt.bokstav)}
        />
      ))}
      {Input && !mobil ? (
        <Input
          key={`${prefix}-fritt-in`}
          label={S.answerFreely}
          placeholder={S.answerPlaceholder}
          value={fritt}
          onInput={(v: string) => void update($, svarFritt, () => v)}
          onSubmit={(v: string) => {
            if (v.trim()) void svara($, inst, b, v.trim()).then(() => update($, svarFritt, () => ''))
          }}
        />
      ) : (
        <Button key={`${prefix}-fritt`} plain dimColor label={S.answerFreely} onPress={() => void $.prompt.fill({ text: `${b.id}: `, mode: 'replace' })} />
      )}
    </Box>
  )
}

// Decisions as a list: one row per decision (Id · title · age · blocks · suggestion), grouped per Project with what
// blocks an agent first. One decision is unfolded at a time: the block and the answer buttons.
async function beslutFlik($: EngineInterface, inst: Inst, d: RadarData, sk: Record<string, RadarSkickat>, nu: number, bredd: number, mobil: boolean, els: any) {
  const S = inst.S
  const { Box, Text, Button, Markdown } = els
  const oppet = await read($, beslutOppen)
  const fritt = await read($, svarFritt)
  const grupper = beslutGrupper(d.beslut, S)
  let n = 0
  const pagar = await read($, fortsatt)
  const vantande = await read($, fortsattVantar)
  return (
    <Box flexDirection="column" gap={1}>
      {pagar.map((x, i) => (
        <Box key={`fortsatt-${x.id}`} flexDirection="row" gap={1} flexWrap="wrap">
          <Text color="warning">{x.task ? S.continuingIn(x.task, inst.undoSeconds) : S.sendingIn(x.id, inst.undoSeconds)}</Text>
          <Button key={`fortsatt-angra-${x.id}`} autoFocus={i === 0 ? true : undefined} label={x.task ? S.undoContinueLabel(x.task) : S.undoSendLabel(x.id)} onPress={() => void angraFortsattning($, x.id)} />
        </Box>
      ))}
      {vantande.map(x => (
        <Box key={`fortsatt-v-${x.id}`} flexDirection="row" gap={1}>
          <Button key={`fortsatt-nu-${x.id}`} variant="primary" label={x.task ? S.continueAgent(x.id, x.task) : S.sendDecision(x.id)} onPress={() => void fortsattNu($, inst, x.id)} />
        </Box>
      ))}
      {d.beslut.length === 0 ? <Text>{S.noDecisions}</Text> : null}
      {grupper.map(g => (
        <Box key={`bg-${g.projekt}`} flexDirection="column">
          <Text bold>
            {g.projekt} ({g.lista.length})
          </Text>
          {g.lista.map(b => {
            const i = n++
            const nyckel = b.id || `rad${i}`
            const ar = oppet === nyckel
            return (
              <Box key={`pb-${i}`} flexDirection="column">
                <Button
                  key={`pb-rad-${i}`}
                  plain
                  autoFocus={i === 0 ? true : undefined}
                  label={beslutRad(b, ar, bredd, S)}
                  onPress={() => void update($, beslutOppen, x => (x === nyckel ? '' : nyckel))}
                />
                {ar ? (
                  <Box flexDirection="column">
                    <Text bold>
                      {b.id || 'B?'} · {b.rubrik}
                    </Text>
                    <Text dimColor>
                      {S.waited(b.alder, b.fragar)}
                      {b.blockerar ? ` · ${S.blocks(b.blockerar)}` : ''}
                    </Text>
                    {b.text ? <Markdown text={alternativPaRader(oversattNycklar(b.text, inst.lang))} /> : null}
                    {svarsknappar($, inst, b, `pb-${i}`, sk[b.id], nu, mobil, fritt, els)}
                  </Box>
                ) : null}
              </Box>
            )
          })}
        </Box>
      ))}
      {d.bordlagda.length ? <Text dimColor>{S.parked(d.bordlagda.join(', '))}</Text> : null}
    </Box>
  )
}

async function idagFlik($: EngineInterface, inst: Inst, d: RadarData, els: any) {
  const S = inst.S
  const { Box, Text, Button, Markdown } = els
  const idag = isoDatum(await $.clock.now())
  const loften = loftenInom(d.loften, idag, LOFTE_DAGAR)
  const morgon = tolkaMorgon((await read($, moten)) ?? '')
  const saker = d.idag.saker
  const forstaKvar = saker.findIndex(s => !s.klar && s.hash)
  // Done runs scripts/today.js and scripts/promise.js directly (no turn). Without the hash (older radar.json) there is no button.
  const klarKnapp = (nyckel: string, hash: string | undefined, text: string, skriptNamn: string, etikett: string, fokus = false) =>
    hash ? (
      <Button
        key={nyckel}
        autoFocus={fokus ? true : undefined}
        label={S.doneButton(kort(text, 30))}
        onPress={() => void radSkript($, inst, skriptNamn, etikett, ['done', hash])}
      />
    ) : null
  // An entry and its button are one group without gap, and the gap is between the groups, so that a button is seen to belong
  // to the line above it. The bullet stands in its own column: a wrapped line and the button get a hanging indent.
  const punkt = (key: string, rad: unknown, knapp: unknown) => (
    <Box key={key} flexDirection="row">
      <Box flexShrink={0}>
        <Text>{'• '}</Text>
      </Box>
      <Box flexDirection="column" flexShrink={1}>
        {rad}
        {knapp}
      </Box>
    </Box>
  )
  const morgonRad = morgon.rubrik
    ? morgon.rubrik.datum === idag
      ? S.morningFetched(morgon.rubrik.kommando, morgon.rubrik.veckodag, morgon.rubrik.tid)
      : S.morningOld(morgon.rubrik.kommando, morgon.rubrik.veckodag, kortDatum(morgon.rubrik.datum))
    : ''
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold>{S.todayHeading}</Text>
        {d.idag.datum && d.idag.datum !== idag ? <Text dimColor>{S.todayWritten(d.idag.datum)}</Text> : null}
        {saker.length === 0 ? <Text dimColor>{S.todayNothing}</Text> : null}
        <Box flexDirection="column" gap={1}>
          {saker.map((s, i) => (
            <Box key={`idag-${i}`} flexDirection="column">
              <Text wrap="wrap">
                {s.klar ? S.doneLine : S.openLine}
                {s.text}
              </Text>
              {s.klar ? null : klarKnapp(`idag-klar-${i}`, s.hash, s.text, 'today.js', S.todayName, i === forstaKvar)}
            </Box>
          ))}
          {/* In the gapped list, so that it is not read as belonging to the last entry. */}
          <Box flexDirection="row" gap={1}>
            <Button key="idag-skriv" plain dimColor label={S.writeToday} onPress={() => void $.prompt.fill({ text: PROMPTS.today, mode: 'replace' })} />
          </Box>
        </Box>
      </Box>
      <Box flexDirection="column">
        <Text bold>{S.promisesWithin(LOFTE_DAGAR, loften.length)}</Text>
        {loften.length === 0 ? <Text dimColor>{S.noPromisesSoon}</Text> : null}
        <Box flexDirection="column" gap={1}>
          {loften.map((l, i) =>
            punkt(
              `lofte-${i}`,
              <Text wrap="wrap">
                {l.datum} <Text color={l.nar === 'FÖRSENAT' ? 'error' : l.nar ? 'warning' : undefined}>{S.due[l.nar] || l.nar || S.soon}</Text> · {S.toWhom(l.vem, l.vad)}
              </Text>,
              klarKnapp(`lofte-klar-${i}`, l.hash, l.vad, 'promise.js', S.promisesName),
            ),
          )}
        </Box>
      </Box>
      <Box flexDirection="column">
        <Text bold>{S.waitingOnOthers(d.vantar.length)}</Text>
        {d.vantar.length === 0 ? <Text dimColor>{S.notWaiting}</Text> : null}
        <Box flexDirection="column" gap={1}>
          {d.vantar.map((v, i) =>
            punkt(
              `vantar-${i}`,
              <Text wrap="wrap">
                {v.datum} · {S.waitingFor(v.vem, v.vad)}
              </Text>,
              klarKnapp(`vantar-klar-${i}`, v.hash, v.vad, 'promise.js', S.promisesName),
            ),
          )}
        </Box>
      </Box>
      {morgon.rubrik || morgon.text ? (
        <Box flexDirection="column">
          <Text bold>{S.meetings}</Text>
          {morgonRad ? <Text dimColor>{morgonRad}</Text> : null}
          {morgon.text ? <Markdown text={punktaRader(morgon.text)} /> : null}
        </Box>
      ) : null}
    </Box>
  )
}

function lageRad(p: RadarProjekt, S: Strings, lang: string): string {
  if (p.agentLage) return `${visaLage(p.agentLage, lang)}: ${p.gorNu || S.noDoingNow}`
  return p.lageText || S.noStatus
}

async function projektFlik($: EngineInterface, inst: Inst, d: RadarData, bredd: number, mobil: boolean, els: any) {
  const S = inst.S
  const slug = await read($, projektOppet)
  const valt = d.projekt.find(p => p.slug === slug) ?? null
  const f = await read($, farger)
  if (valt) return projektRum($, inst, valt, await read($, statusText), f, mobil, els)
  const { Box, Text, Button } = els
  const utfallt = await read($, lageOppet)
  const grupper = LAGEN.map(l => ({ lage: l, lista: d.projekt.filter(p => p.lage === l) })).filter(g => g.lista.length)
  const lageNamn = (l: string) => S.projectStates[l] ?? l
  return (
    <Box flexDirection="column" gap={1}>
      {grupper.map(g => {
        const visas = LAGEN_OPPNA.includes(g.lage) || utfallt === g.lage
        return (
          <Box key={`pl-${g.lage}`} flexDirection="column">
            {LAGEN_OPPNA.includes(g.lage) ? (
              <Text bold>
                {lageNamn(g.lage)} ({g.lista.length})
              </Text>
            ) : (
              <Button
                key={`lage-${g.lage}`}
                plain
                label={`${visas ? '▾' : '▸'} ${lageNamn(g.lage)} (${g.lista.length})`}
                onPress={() => void update($, lageOppet, x => (x === g.lage ? '' : g.lage))}
              />
            )}
            {visas &&
              g.lista.map(p => (
                <Box key={`rad-${p.slug}`} flexDirection="row" gap={1}>
                  {farg(f, p.slug, Text)}
                  <Button
                    key={`proj-${p.slug}`}
                    plain
                    label={`${p.mapp} · ${kort(lageRad(p, S, inst.lang), bredd - p.mapp.length - 20)}${p.beslut.length ? ` · ${p.beslut.join(' ')}` : ''}`}
                    onPress={() => void oppnaProjekt($, p)}
                  />
                </Box>
              ))}
          </Box>
        )
      })}
    </Box>
  )
}

// The project's colour as a small label. The colour is only decoration: the name is always beside it in text.
function farg(f: Record<string, string>, slug: string, Text: any) {
  const bg = projektFarg(f, slug)
  return <Text backgroundColor={bg} color={bg.startsWith('#') ? textPa(bg) : undefined}>{'  '}</Text>
}

// A heading that folds and unfolds on a press. The arrow shows the state, as the folders in Filer: ▾ expanded, ▸ collapsed.
// No state word in the label: it changed the width on every press (the owner's choice, 2026-11-25). The state is kept per key in $.store.
function fallRubrik($: EngineInterface, Button: any, key: string, nyckel: string, text: string, utfalld: boolean) {
  return <Button key={key} plain label={`${utfalld ? '▾' : '▸'} ${text}`} onPress={() => void vaxlaOppet($, nyckel)} />
}

// The project key an agent row belongs to, for its colour: the Project: line, otherwise the slug's first part.
function agentProjekt(slug: string, projekt?: string): string {
  return (projekt || slug.split(/[\s-]/)[0] || '').toLowerCase()
}

function projektRum($: EngineInterface, inst: Inst, p: RadarProjekt, status: string, f: Record<string, string>, mobil: boolean, els: any) {
  const S = inst.S
  const { Box, Text, Button, Markdown } = els
  const lankar = [p.statusFil, ...(p.docs ?? [])].filter(Boolean)
  const rapporter = p.rapporter ?? []
  const logg = p.gitLogg ?? []
  return (
    <Box flexDirection="column" gap={1}>
      <Button key="proj-tillbaka" plain dimColor label={S.backToProjects} onPress={() => void oppnaProjekt($, null)} />
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          {farg(f, p.slug, Text)}
          <Text bold>{p.mapp}</Text>
        </Box>
        <Text>{S.stateLine(visaLage(p.agentLage, inst.lang) || kort(p.lageText, 200) || S.noStatus, p.uppdaterad)}</Text>
        {p.gorNu ? <Text>{S.doingLine(p.gorNu)}</Text> : null}
        {p.nastaSteg ? <Text>{S.nextStepLine(kort(p.nastaSteg, 300))}</Text> : null}
        <Text dimColor>{S.registryLine(S.projectStates[p.lage] ?? p.lage, p.sistRort, p.dir)}</Text>
        {p.beslut.length ? <Text>{S.decisionsWaiting(p.beslut.join(', '))}</Text> : null}
        {p.loften.map((l, i) => (
          <Text key={`rum-lofte-${i}`}>{S.promiseLine(l)}</Text>
        ))}
      </Box>
      <Box flexDirection="row" gap={1} flexWrap="wrap">
        {p.dir && !mobil ? <Button key={`vs-${p.slug}`} label={S.openInVsCode} onPress={() => vsCode($, inst, p.dir)} /> : null}
        <Button key={`agent-${p.slug}`} label={S.agentHere} onPress={() => void $.prompt.fill({ text: `${PROMPTS.agent}${p.slug} `, mode: 'replace' })} />
        {inst.servers && p.kor.length ? <Button key={`servrar-${p.slug}`} plain dimColor label={S.serversButton} onPress={() => void valjFlik($, inst, 'servrar')} /> : null}
        <Button key={`filer-${p.slug}`} plain dimColor label={S.filesInProject} onPress={() => void valjFlik($, inst, 'filer')} />
      </Box>
      {lankar.length ? <Markdown text={lankar.map(s => `- ${filRad(s)}`).join('\n')} /> : <Text dimColor>{S.noStatusFile}</Text>}
      <Box flexDirection="column">
        <Text bold>{S.lastCommits(logg.length)}</Text>
        {logg.length === 0 ? <Text dimColor>{S.noGit}</Text> : null}
        {logg.map((c, i) => (
          <Text key={`git-${i}`} wrap="truncate-end">
            <Text dimColor>
              {c.hash} {c.tid}
            </Text>{' '}
            {c.text}
          </Text>
        ))}
      </Box>
      <Box flexDirection="column">
        <Text bold>{S.lastReports(rapporter.length)}</Text>
        {rapporter.length === 0 ? <Text dimColor>{S.noReports}</Text> : null}
        {rapporter.map((r, i) => (
          <Box key={`rapport-${i}`} flexDirection="column">
            <Text dimColor>
              {r.tid} · {r.id}
            </Text>
            {r.orapporterad ? <Text color="warning">{S.unreported}</Text> : <Text>{r.rapport}</Text>}
          </Box>
        ))}
      </Box>
      {status ? (
        <Box flexDirection="column">
          <Text bold>{S.statusFile}</Text>
          <Markdown text={oversattNycklar(status, inst.lang)} />
        </Box>
      ) : null}
    </Box>
  )
}

async function servrarFlik($: EngineInterface, inst: Inst, d: RadarData, mobil: boolean, els: any) {
  const S = inst.S
  const { Box, Text, Button } = els
  const s = await read($, servrar)
  const last = await read($, servrarLast)
  const f = await read($, farger)
  const op = await read($, oppet)
  const projekt = d.projekt.filter(p => p.kor.length)
  const korande = Object.values(s).filter(x => x.lever)
  const mappFor = (slug: string) => d.projekt.find(p => p.slug === slug)?.mapp ?? slug
  const bek = await read($, bekrafta)
  const nu = await $.clock.now()
  const windows = inst.platform === 'windows'
  // Stop kills a whole process tree: the same two-step confirmation as Remove in the inbox.
  const stoppKnapp = (nyckel: string, slug: string, namn: string, prefix: string) => {
    const hash = `stopp:${nyckel}`
    if (arBekraftad(bek, hash, nu)) {
      return (
        <Box key={`${prefix}-bek`} flexDirection="row" gap={1}>
          <Button
            key={`${prefix}-ja`}
            label={S.stopYes}
            onPress={async () => {
              if (!arBekraftad(await read($, bekrafta), hash, await $.clock.now())) return
              await update($, bekrafta, () => null)
              await stoppaServer($, inst, slug, namn)
            }}
          />
          <Button key={`${prefix}-nej`} plain dimColor label={S.no} onPress={() => void update($, bekrafta, () => null)} />
        </Box>
      )
    }
    return <Button key={prefix} label={S.stop} onPress={() => void begarBekraftelse($, hash, S.stopConfirm(namn))} />
  }
  const oppnaKnappar = (nyckel: string, portar: number[]) =>
    mobil ? null : portar.map(port => <Button key={`oppna-${nyckel}-${port}`} plain label={S.open(localhost(port))} onPress={() => oppnaUrl($, inst, localhost(port))} />)
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold>{S.runningNow(korande.length)}</Text>
        {korande.length === 0 ? <Text dimColor>{S.noWindowOpen}</Text> : null}
        {korande.map(x => (
          <Box key={`kor-${x.nyckel}`} flexDirection="row" gap={1} flexWrap="wrap">
            <Text>
              {mappFor(x.slug)} {x.namn} <Text dimColor>· {S.since(x.startad)} · pid {x.pid} · {x.portar.length ? S.port(x.portar.join(', ')) : S.noPortYet}</Text>
            </Text>
            {stoppKnapp(x.nyckel, x.slug, x.namn, `kor-stopp-${x.nyckel}`)}
            {oppnaKnappar(`kor-${x.nyckel}`, x.portar)}
          </Box>
        ))}
      </Box>
      {projekt.length === 0 ? <Text dimColor>{S.noRunJson}</Text> : null}
      {projekt.map(p => {
        const utfalld = arUtfalld(op, `servrar:${p.slug}`)
        return (
          <Box key={`sv-${p.slug}`} flexDirection="column">
            <Box flexDirection="row" gap={1}>
              {farg(f, p.slug, Text)}
              {fallRubrik($, Button, `sv-rubrik-${p.slug}`, `servrar:${p.slug}`, `${p.mapp} (${p.kor.length})`, utfalld)}
            </Box>
            {utfalld && p.kor.map(k => {
              const nyckel = korNyckel(p.slug, k.namn)
              const st = s[nyckel]
              const lever = !!st?.lever
              // Starting as another account uses runas, which only exists on Windows.
              const kanStarta = windows || !k.konto
              return (
                <Box key={`sv-${nyckel}`} flexDirection="row" gap={1} paddingLeft={2} flexWrap="wrap">
                  {lever ? (
                    stoppKnapp(nyckel, p.slug, k.namn, `stopp-${nyckel}`)
                  ) : kanStarta ? (
                    <Button key={`start-${nyckel}`} label={k.konto ? S.startAs(k.konto) : S.start} onPress={() => void startaServer($, inst, p, k)} />
                  ) : null}
                  <Text wrap="truncate-end">
                    {k.namn} <Text dimColor>{kort(k.cmd, 60)}</Text>
                    {lever ? <Text color="success">{S.runningSince(st?.startad ?? '')}{st?.portar.length ? ` · ${S.port(st.portar.join(', '))}` : ''}</Text> : null}
                    {st && !lever ? <Text dimColor>{S.windowClosed}</Text> : null}
                    {k.konto ? <Text dimColor>{S.ownWindowNoPid}</Text> : null}
                  </Text>
                </Box>
              )
            })}
          </Box>
        )
      })}
      <Text dimColor>
        {S.serversNote}
        {last ? S.readAt(last) : ''}
      </Text>
      <Button key="servrar-las" plain dimColor label={S.reloadServers} onPress={() => void lasServrar($, inst)} />
    </Box>
  )
}

function tidKort(s: string): string {
  return String(s || '').replace('T', ' ').slice(0, 16)
}

async function agentFlik($: EngineInterface, inst: Inst, d: RadarData, els: any) {
  const S = inst.S
  const { Box, Text, Button, Markdown } = els
  const opp = await read($, rapportOppen)
  const statusFil = (slug: string) => d.projekt.find(p => p.slug === slug)?.statusFil || ''
  // The reports are what the owner needs to read; the subagents are routine jobs and come last.
  const rapporter = rapportOrdning(d.agenter.rapporter)
  // Agents that wait (Needs: in the status header), grouped at the top. An older radar.json has no vantarPa: then no groups.
  const vantar = d.vantarPa ?? { restart: [], deploy: [], beslut: [], annat: [] }
  const vantarGrupper: { nyckel: 'restart' | 'deploy' | 'beslut' | 'annat'; rubrik: string }[] = [
    { nyckel: 'restart', rubrik: S.waitingForRestart },
    { nyckel: 'deploy', rubrik: S.waitingForDeploy },
    { nyckel: 'beslut', rubrik: S.waitingForDecision },
    { nyckel: 'annat', rubrik: S.waitingForOther },
  ]
  const delning = agentDelning(d)
  const f = await read($, farger)
  const op = await read($, oppet)
  // Every heading folds; each row carries its project's colour, as in Projects and Servers, beside its name in text.
  const sektion = (nyckel: string, rubrik: string, innehall: () => unknown) => {
    const utfalld = arUtfalld(op, `agenter:${nyckel}`)
    return (
      <Box key={`as-${nyckel}`} flexDirection="column">
        {fallRubrik($, Button, `ag-rubrik-${nyckel}`, `agenter:${nyckel}`, rubrik, utfalld)}
        {utfalld ? innehall() : null}
      </Box>
    )
  }
  const agentRad = (a: RadarAgent) => {
    const fil = statusFil(a.slug)
    return (
      <Box key={`ag-${a.slug}`} flexDirection="column">
        <Box flexDirection="row" gap={1}>
          {farg(f, agentProjekt(a.slug, a.projekt), Text)}
          <Text>
            <Text bold>{a.namn}</Text> · {visaLage(a.lage, inst.lang)}
            {a.sedan ? S.sinceTime(tidKort(a.sedan)) : ''}
            {a.modell ? ` · ${a.modell}` : ''}
          </Text>
        </Box>
        {a.vad ? <Text dimColor>{a.vad}</Text> : null}
        {fil ? <Markdown text={filRad(fil)} /> : null}
      </Box>
    )
  }
  return (
    <Box flexDirection="column" gap={1}>
      {vantarGrupper.map(g => {
        const lista = vantar[g.nyckel] ?? []
        if (!lista.length) return null
        return sektion(`vantar-${g.nyckel}`, `${g.rubrik} (${lista.length})`, () => (
          <Box flexDirection="column">
            {lista.map(v => (
              <Box key={`vg-${g.nyckel}-${v.slug}`} flexDirection="column">
                <Box flexDirection="row" gap={1}>
                  {farg(f, agentProjekt(v.slug, v.projekt), Text)}
                  <Text>
                    <Text bold>{v.slug}</Text>
                    {g.nyckel === 'beslut' || g.nyckel === 'annat' ? ` · ${v.behover}` : ''}
                    {v.sedan ? S.sinceTime(tidKort(v.sedan)) : ''}
                  </Text>
                </Box>
                {v.gorNu ? <Text dimColor>{v.gorNu}</Text> : null}
              </Box>
            ))}
            {g.nyckel === 'restart'
              ? projektNycklar(lista).map(p => (
                  <Button key={`vantar-restart-${p}`} label={S.restartButton(p)} onPress={() => void $.prompt.fill({ text: `${PROMPTS.restart}${p}`, mode: 'replace' })} />
                ))
              : null}
          </Box>
        ))
      })}
      {sektion('kor', S.runningHeading(delning.kor.length), () => (
        <Box flexDirection="column">
          {delning.kor.length === 0 ? <Text dimColor>{S.noAgentRunning}</Text> : null}
          {/* Data saved by an earlier version of the mod has no korNu until radar.json is read again. */}
          {d.korNu?.length ? <Text>{S.bandAgents(d.korNu.length, d.korNu.join(', '))}</Text> : null}
          {delning.kor.map(agentRad)}
        </Box>
      ))}
      {delning.ovriga.length
        ? sektion('ovriga', S.otherInMotion(delning.ovriga.length), () => <Box flexDirection="column">{delning.ovriga.map(agentRad)}</Box>)
        : null}
      {sektion('rapporter', S.lastReports(rapporter.length), () => (
        <Box flexDirection="column">
          {rapporter.length === 0 ? <Text dimColor>{S.noReports}</Text> : null}
          {rapporter.map((r, i) => {
            const nyckel = `${r.tid}|${r.id}`
            const ar = opp === nyckel
            return (
              <Box key={`jr-${i}`} flexDirection="column">
                <Box flexDirection="row" gap={1}>
                  {farg(f, agentProjekt(r.projekt), Text)}
                  <Button
                    key={`rapport-${i}`}
                    plain
                    label={`${ar ? '▾' : '▸'} ${tidKort(r.tid)} · ${r.projekt} · ${r.id}${r.orapporterad ? S.unreportedTag : ''} · ${ar ? S.hide : S.show}`}
                    onPress={() => void update($, rapportOppen, x => (x === nyckel ? '' : nyckel))}
                  />
                </Box>
                {/* What the owner must do and what stands in the way are shown also when the row is folded. */}
                {rapportFalt(r, S).map((rad, j) => (
                  <Text key={`jr-${i}-f${j}`}>{`    ${rad}`}</Text>
                ))}
                {ar ? r.orapporterad ? <Text color="warning">{S.unreported}</Text> : <Text>{r.rapport}</Text> : null}
              </Box>
            )
          })}
        </Box>
      ))}
      {sektion('underagenter', S.subagents(d.agenter.underagenter.length), () => (
        <Box flexDirection="column">
          {d.agenter.underagenter.length === 0 ? <Text dimColor>{S.noSubagents}</Text> : null}
          {d.agenter.underagenter.map((u, i) => (
            <Box key={`ua-rad-${i}`} flexDirection="row" gap={1}>
              {farg(f, agentProjekt(u.projekt), Text)}
              <Text key={`ua-${i}`} wrap="truncate-end">
                <Text dimColor>
                  {tidKort(u.start)} · {u.projekt}
                  {u.modell ? ` · ${u.modell}` : ''}
                </Text>{' '}
                {u.uppdrag}
                {u.klar ? <Text dimColor>{S.doneAt(tidKort(u.klar), u.resultat)}</Text> : <Text color="warning">{S.noDoneRow}</Text>}
              </Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}

async function inkorgFlik($: EngineInterface, inst: Inst, d: RadarData, t: { tid: string; ms: number } | undefined, nu: number, mobil: boolean, els: any) {
  const S = inst.S
  const { Box, Text, Button, Markdown } = els
  const ink = d.inkorg
  const tryckt = arTryckt(t, nu)
  const oppen = await read($, inkorgOppen)
  const bek = await read($, bekrafta)
  const flyttar = await read($, flyttaVal)
  const merPost = await read($, inkorgMer)
  // Data saved by an earlier version of the mod has no sections until radar.json is read again.
  const sektioner = ink.sektioner ?? []
  const fyll = (prefix: string, p: RadarInkorgPost) => void $.prompt.fill({ text: postPrompt(prefix, p), mode: 'replace' })
  const vaxla = (nyckel: string, standard: boolean) => void update($, inkorgOppen, o => ({ ...o, [nyckel]: !(o[nyckel] ?? standard) }))
  let forsta = true

  const post = (p: RadarInkorgPost, sek: string) => {
    const utfalld = oppen[p.hash] ?? false
    const text = postForsta(p)
    const fokus = forsta
    forsta = false
    const taBort = arBekraftad(bek, p.hash, nu) ? (
      <Box key={`ink-bek-${p.hash}`} flexDirection="row" gap={1}>
        <Button
          key={`ink-bekrafta-${p.hash}`}
          label={S.removeYes}
          onPress={async () => {
            if (!arBekraftad(await read($, bekrafta), p.hash, await $.clock.now())) return
            await update($, bekrafta, () => null)
            await inkorgSkript($, inst, ['remove', p.hash])
          }}
        />
        <Button key={`ink-nej-${p.hash}`} plain dimColor label={S.no} onPress={() => void update($, bekrafta, () => null)} />
      </Box>
    ) : (
      <Button key={`ink-tabort-${p.hash}`} plain dimColor label={S.remove} onPress={() => void begarBekraftelse($, p.hash, S.removeConfirm)} />
    )
    const flytta = (
      <Button key={`ink-flytta-${p.hash}`} plain dimColor label={flyttar === p.hash ? S.moveOpen : S.move} onPress={() => void update($, flyttaVal, v => (v === p.hash ? '' : p.hash))} />
    )
    const klar = <Button key={`ink-klar-${p.hash}`} label={S.doneButtonShort} onPress={() => void inkorgSkript($, inst, ['done', p.hash])} />
    const resten = [
      taBort,
      <Button key={`ink-agent-${p.hash}`} plain dimColor label={S.agentButton} onPress={() => fyll(PROMPTS.agent, p)} />,
      <Button key={`ink-lofte-${p.hash}`} plain dimColor label={S.promiseButton} onPress={() => fyll(PROMPTS.promise, p)} />,
      <Button key={`ink-beslut-${p.hash}`} plain dimColor label={S.decisionButton} onPress={() => fyll(PROMPTS.decisionNew, p)} />,
    ]
    return (
      <Box key={`ink-p-${p.hash}`} flexDirection="column">
        <Box flexDirection="row" gap={1}>
          {/* Button labels do not wrap (the panel had to be dragged wider); the whole text is therefore a Text when the entry is unfolded. */}
          <Button
            key={`ink-post-${p.hash}`}
            plain
            autoFocus={fokus ? true : undefined}
            label={`${utfalld ? '▾' : '▸'} ${kort(text, 50)} · ${utfalld ? S.hide : S.show}`}
            onPress={() => vaxla(p.hash, false)}
          />
          {utfalld ? null : klar}
        </Box>
        {utfalld ? (
          <Box flexDirection="column" gap={1}>
            <Text wrap="wrap">{p.text.split('\n').map(r => r.trim()).join(' ')}</Text>
            {/* Mobile: Done, Move and More; the rest behind More. */}
            <Box flexDirection="row" gap={1} flexWrap="wrap">
              {klar}
              {flytta}
              {mobil ? (
                <Button key={`ink-mer-${p.hash}`} plain dimColor label={merPost === p.hash ? S.less : S.more} onPress={() => void update($, inkorgMer, v => (v === p.hash ? '' : p.hash))} />
              ) : (
                resten
              )}
            </Box>
            {mobil && merPost === p.hash ? (
              <Box flexDirection="row" gap={1} flexWrap="wrap">
                {resten}
              </Box>
            ) : null}
            {flyttar === p.hash ? (
              <Box flexDirection="row" gap={1} flexWrap="wrap">
                <Text dimColor>{S.toSection}</Text>
                {sektioner.filter(s => s.namn && s.namn !== sek).map((s, j) => (
                  <Button
                    key={`ink-till-${p.hash}-${j}`}
                    label={s.namn}
                    onPress={async () => {
                      await update($, flyttaVal, () => '')
                      await inkorgSkript($, inst, ['move', p.hash, s.namn])
                    }}
                  />
                ))}
              </Box>
            ) : null}
          </Box>
        ) : null}
      </Box>
    )
  }

  const total = inkorgTotal(d)
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold>{S.inboxSummary(inkorgAntal(d), total, ink.aldsta)}</Text>
      <Box flexDirection="row" gap={1} flexWrap="wrap">
        {tryckt && t ? (
          <Button key="inkorg-sortera-skickat" plain dimColor label={S.sorted(t.tid)} onPress={() => $.ui.toast(S.sortedToast(t.tid))} />
        ) : (
          <Button key="inkorg-sortera" label={S.sort} onPress={() => void koraKommando($, inst, PROMPTS.inbox.trim())} />
        )}
        <Button key="inkorg-ny" plain dimColor label={S.newLine} onPress={() => void $.prompt.fill({ text: PROMPTS.inbox, mode: 'replace' })} />
        {/* Remove only moves to the archive; Undo takes back the latest change from the log in status/kor/. */}
        {ink.angra ? <Button key="inkorg-angra" plain label={S.undoLast(S.undoNames[ink.angra] ?? ink.angra)} onPress={() => void inkorgSkript($, inst, ['undo'])} /> : null}
      </Box>
      <Text dimColor>{S.inboxHelp}</Text>
      {sektioner.length === 0 ? <Text dimColor>{ink.antal ? S.sectionsMissing : S.inboxEmpty}</Text> : null}
      {sektioner.map((s, i) => {
        const namn = s.namn || S.noHeading
        const utfalld = oppen[namn] ?? sektionOppenStandard(s.namn)
        return (
          <Box key={`ink-s-${i}`} flexDirection="column">
            <Button key={`ink-sek-${i}`} plain label={`${utfalld ? '▾' : '▸'} ${namn} (${s.poster.length})`} onPress={() => vaxla(namn, sektionOppenStandard(s.namn))} />
            {utfalld ? (s.poster.length === 0 ? <Text dimColor>{S.empty}</Text> : s.poster.map(p => post(p, s.namn))) : null}
          </Box>
        )
      })}
      <Markdown text={filRad(winSokvag(inst.rot, inkorgFil(d)))} />
    </Box>
  )
}

// The project keys (rooflow.json) for the agents that wait for a restart. An older radar.json has no project: the slug's first part.
function projektNycklar(lista: { slug: string; projekt?: string }[]): string[] {
  const alla = lista.map(v => (v.projekt || v.slug.split(/[\s-]/)[0] || '').toLowerCase()).filter(Boolean)
  return [...new Set(alla)]
}

function kommandoFlik($: EngineInterface, inst: Inst, d: RadarData, tr: Record<string, { tid: string; ms: number }>, nu: number, els: any) {
  const S = inst.S
  const { Box, Text, Button } = els
  const besk = new Map(d.skills.map(s => [s.namn, s.besk]))
  const namn = [...COMMANDS_FIRST, ...d.skills.map(s => s.namn).filter(n => !COMMANDS_FIRST.includes(n))]
  return (
    <Box flexDirection="column" gap={1}>
      <Text dimColor>{S.commandsHelp}</Text>
      {namn.map(n => {
        const t = tr[n]
        const tryckt = arTryckt(t, nu)
        return (
          <Box key={`k-${n}`} flexDirection="row" gap={1}>
            {tryckt && t ? (
              <Button key={`kommando-${n}-skickat`} plain dimColor label={S.commandSent(n, t.tid)} onPress={() => $.ui.toast(S.commandSentToast(n, t.tid))} />
            ) : (
              <Button key={`kommando-${n}`} label={S.commandButton(n)} onPress={() => void koraKommando($, inst, n)} />
            )}
            <Text dimColor wrap="truncate-end">{besk.get(n) || ''}</Text>
          </Box>
        )
      })}
    </Box>
  )
}

async function filFlik($: EngineInterface, inst: Inst, d: RadarData, mobil: boolean, els: any) {
  const S = inst.S
  const { Box, Text, Button, Markdown, Input } = els
  const fl = await read($, filter)
  const alla = await read($, filer)
  const slug = await read($, projektOppet)
  const oppna = await read($, mapparOppna)
  const arkivet = await read($, visaArkivet)
  const lev = await read($, leveranser)
  const valt = d.projekt.find(p => p.slug === slug) ?? null
  const sep = skiljetecken(inst.rot)
  const egnaRot = `${inst.rot.replace(/[\\/]+$/, '')}${sep}`
  const egnaAlla = alla.filter(x => x.sokvag.startsWith(egnaRot))
  const fil = (nyckel: string, x: RadarFil, i: number) => (
    <Box key={`${nyckel}-${i}`} flexDirection="row" gap={1}>
      {mobil ? null : <Button key={`${nyckel}-vs-${i}`} plain dimColor label={S.openInVsCode} onPress={() => vsCode($, inst, x.sokvag)} />}
      <Markdown text={filRad(x.sokvag)} />
    </Box>
  )
  const lista = (rubrik: string, nyckel: string, rader: RadarFil[], slag = S.mdFiles) => (
    <Box flexDirection="column">
      <Text bold>{rubrik}</Text>
      {rader.length === 0 ? <Text dimColor>{S.noFiles(slag, fl)}</Text> : null}
      {rader.map((x, i) => fil(nyckel, x, i))}
    </Box>
  )
  const projektLista =
    valt?.dir && valt.dir !== inst.rot ? (
      lista(`${valt.mapp} (${valt.dir})`, 'fil-pr', filtreraFiler(alla.filter(x => !x.sokvag.startsWith(egnaRot)), fl, MAX_FILER))
    ) : (
      <Text dimColor>{S.chooseProject}</Text>
    )
  const sok = Input && !mobil ? (
    <Input key="filter" label={S.searchLabel} placeholder={S.searchPlaceholder} value={fl} onInput={(v: string) => void update($, filter, () => v)} onSubmit={(v: string) => void update($, filter, () => v)} />
  ) : null
  const lasOm = <Button key="filer-las" plain dimColor label={S.reloadFiles} onPress={() => void lasFiler($, inst)} />

  if (fl.trim() !== '') {
    return (
      <Box flexDirection="column" gap={1}>
        {sok}
        <Text dimColor>{S.searchCovers}</Text>
        {lista(S.notebookHeading(inst.rot), 'fil-rf', filtreraFiler(egnaAlla, fl, MAX_SOK))}
        {lista(S.deliveriesPlain, 'fil-lev', filtreraFiler(lev, fl, MAX_SOK), S.deliveriesKind)}
        {projektLista}
        {lasOm}
      </Box>
    )
  }

  const fasta = fastaFiler(egnaAlla, inst.rot)
  const senaste = senasteFiler(egnaAlla, inst.rot, MAX_SENASTE)
  const mappar = filMappar(egnaAlla, inst.rot, S)
  const synliga = mappar.filter(m => arkivet || !m.arkiv)
  const doldaAntal = mappar.filter(m => m.arkiv).reduce((n, m) => n + m.filer.length, 0)
  return (
    <Box flexDirection="column" gap={1}>
      {sok}
      <Text dimColor>{S.filesHelp(mobil)}</Text>
      {lista(S.pinned, 'fil-fast', fasta)}
      {lista(S.deliveries(MAX_LEVERANSER), 'fil-lev', senasteLeveranser(lev, MAX_LEVERANSER), S.deliveriesKind)}
      {lista(S.latest(MAX_SENASTE), 'fil-sen', senaste)}
      <Box flexDirection="column">
        <Text bold>{S.folders}</Text>
        {synliga.map((m, mi) => {
          const utfalld = oppna[m.namn] ?? false
          return (
            <Box key={`fil-m-${mi}`} flexDirection="column">
              <Button
                key={`fil-mapp-${mi}`}
                plain
                label={`${utfalld ? '▾' : '▸'} ${m.namn} (${m.filer.length})`}
                onPress={() => void update($, mapparOppna, o => ({ ...o, [m.namn]: !(o[m.namn] ?? false) }))}
              />
              {utfalld ? (
                <Box flexDirection="column">
                  {m.filer.slice(0, MAX_I_MAPP).map((x, i) => fil(`fil-m${mi}`, x, i))}
                  {m.filer.length > MAX_I_MAPP ? <Text dimColor>{S.andMore(m.filer.length - MAX_I_MAPP)}</Text> : null}
                </Box>
              ) : null}
            </Box>
          )
        })}
        {doldaAntal ? (
          <Button key="filer-arkivet" plain dimColor label={arkivet ? S.hideArchive : S.showArchive(doldaAntal)} onPress={() => void update($, visaArkivet, v => !v)} />
        ) : null}
      </Box>
      {projektLista}
      {lasOm}
    </Box>
  )
}

// The Help tab: a list of the pages, one open at a time. The text is drawn by the surface's own Markdown element,
// which never takes HTML from the file: nothing is inserted as markup.
async function hjalpFlik($: EngineInterface, inst: Inst, els: any) {
  const S = inst.S
  const { Box, Text, Button, Markdown } = els
  const sidor = await read($, hjalpSidor)
  const vald = await read($, hjalpVald)
  const sida = sidor.find(s => s.fil === vald)
  if (sida) {
    return (
      <Box flexDirection="column" gap={1}>
        <Button key="hjalp-tillbaka" plain dimColor label={S.helpBack} onPress={() => void update($, hjalpVald, () => '')} />
        <Markdown text={sida.text} />
      </Box>
    )
  }
  return (
    <Box flexDirection="column" gap={1}>
      <Text dimColor>{S.helpIntro}</Text>
      {sidor.length === 0 ? <Text dimColor>{S.helpEmpty}</Text> : null}
      <Box flexDirection="column">
        {sidor.map(s => (
          <Button key={`hjalp-${s.fil}`} plain label={s.titel} onPress={() => void update($, hjalpVald, () => s.fil)} />
        ))}
      </Box>
    </Box>
  )
}
