// Pure helpers for the Radar mod. No $, no file I/O: register.tsx does that.
// The source files are not parsed here. scripts/radar.js is the source of truth; only its status/radar.json is read here.

import type { RadarAgent, RadarAlternativ, RadarBeslut, RadarData, RadarFil, RadarInkorgPost, RadarLofte, RadarServer, RadarSkickat } from '../types'
import { arkivRegex, filnamn, FILER, LAGEN } from './format'
import type { FilBegrepp } from './format'
import type { Strings } from './strings'

// status/radar.json -> RadarData, or null if the file is broken or lacks the fields the mod needs.
export function tolkaRadarJson(text: string): RadarData | null {
  let o: unknown
  try {
    o = JSON.parse(text)
  } catch {
    return null
  }
  if (!o || typeof o !== 'object') return null
  const d = o as Partial<RadarData>
  if (!d.antal || !Array.isArray(d.beslut) || !Array.isArray(d.projekt)) return null
  const agenter = d.agenter ?? { underagenter: [], rapporter: [] }
  return {
    format: typeof d.format === 'number' ? d.format : 0,
    genererad: d.genererad ?? '',
    antal: d.antal,
    usage: d.usage ?? null,
    forbrukning: d.forbrukning ?? null,
    beslut: d.beslut,
    bordlagda: d.bordlagda ?? [],
    idag: d.idag ?? { datum: '', saker: [] },
    loften: d.loften ?? [],
    vantar: d.vantar ?? [],
    rorSig: d.rorSig ?? [],
    vantarPa: {
      restart: d.vantarPa?.restart ?? [],
      deploy: d.vantarPa?.deploy ?? [],
      beslut: d.vantarPa?.beslut ?? [],
      annat: d.vantarPa?.annat ?? [],
    },
    korNu: Array.isArray(d.korNu) ? d.korNu.filter(n => typeof n === 'string') : [],
    starStill: d.starStill ?? [],
    projekt: d.projekt,
    skills: d.skills ?? [],
    inkorg: {
      antal: d.inkorg?.antal ?? 0,
      aldsta: d.inkorg?.aldsta ?? '',
      rader: d.inkorg?.rader ?? [],
      sektioner: d.inkorg?.sektioner ?? [],
      angra: d.inkorg?.angra ?? '',
    },
    filnamn: d.filnamn ?? {},
    agenter: { underagenter: agenter.underagenter ?? [], rapporter: agenter.rapporter ?? [] },
  }
}

// The format version the mod can read (scripts/radar.js, FORMAT). A different number means the script and the mod do not belong together.
export const FORMAT = 1

export function formatVarning(d: RadarData, S: Strings): string {
  if (d.format === FORMAT) return ''
  if (!d.format) return S.noFormat
  return S.wrongFormat(d.format, FORMAT)
}

// radar.json older than this counts as stale: the script has not run (60 s timeout, git per project).
export const GAMMAL_MS = 15 * 60_000

// "Radar 14:05 gammal" when genererad ("YYYY-MM-DD HH:MM", local time) is older than GAMMAL_MS, otherwise ''. An unknown time gives '' (the error is shown another way).
export function gammalText(genererad: string, nu: number, S: Strings): string {
  const m = genererad.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/)
  if (!m) return ''
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])).getTime()
  return nu - t > GAMMAL_MS ? S.stale(`${m[4]}:${m[5]}`) : ''
}

export function kort(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, Math.max(1, n - 1))}…` : t
}

export function isoDatum(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function klockslag(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

// The band's row after the decision label: Idag, Agenter and Kontext. The label is a button (beslutEtikett). No headings beyond the words themselves;
// the state is given in text, color is only support. Idag N is the number remaining. Kontext is omitted when the app has no figure (fresh session).
// The band's parts separately: Idag and Agenter become buttons that open their tab, Kontext is text.
export function bandDelar(d: RadarData, kontext: number | null, S: Strings): { idag: string; agenter: string; kontext: string | null } {
  const saker = d.idag.saker
  const vantar = antalVantar(d)
  return {
    idag: saker.length ? S.today(saker.filter(s => !s.klar).length) : S.todayNone,
    agenter: S.agents((d.korNu ?? []).length, vantar),
    kontext: kontext !== null ? S.context(Math.round(kontext)) : null,
  }
}

// Agents waiting for something (Needs), all groups. Data from an older radar.json has no groups: 0.
export function antalVantar(d: RadarData): number {
  const v = d.vantarPa
  return v ? (v.restart?.length ?? 0) + (v.deploy?.length ?? 0) + (v.beslut?.length ?? 0) + (v.annat?.length ?? 0) : 0
}

// The Agents tab counts as the band does: running = korNu (State: running, updated within 2 h, not waiting),
// waiting = the Needs groups. The rest of IN MOTION (asking, stuck, quiet, unreported, subagents) is listed apart.
export function agentDelning(d: RadarData): { kor: RadarAgent[]; ovriga: RadarAgent[] } {
  const korNu = new Set(d.korNu ?? [])
  return {
    kor: d.rorSig.filter(a => korNu.has(a.slug)),
    ovriga: d.rorSig.filter(a => !korNu.has(a.slug) && !a.behover),
  }
}

export function sammanfattning(d: RadarData, kontext: number | null, S: Strings): string {
  const b = bandDelar(d, kontext, S)
  return [b.idag, b.agenter, ...(b.kontext ? [b.kontext] : [])].join(' · ')
}

export function beslutEtikett(antal: number, S: Strings): string {
  return S.decisions(antal)
}

export const KORT_MAX = 5

// The rows in the hover card: Id, title, age and the suggestion; at most KORT_MAX, then "and N more".
export function beslutKortRader(beslut: RadarBeslut[], bredd: number, S: Strings): string[] {
  const rader = beslut.slice(0, KORT_MAX).map(b => {
    const forslag = b.alternativ.find(a => a.forslag)
    const f = forslag ? ` · ${S.suggestionColon} ${forslag.bokstav}) ${kort(forslag.text, 30)}` : ''
    return `${b.id || 'B?'} ${kort(b.rubrik, Math.max(10, bredd - 50))} · ${b.alder}${f}`
  })
  if (beslut.length > KORT_MAX) rader.push(S.andNMore(beslut.length - KORT_MAX))
  return rader
}

// Just "B14 a": the beslut skill (the Svar section) handles the rest, including doing nothing if the decision is already settled.
export function svarsPrompt(b: RadarBeslut, bokstav: string): string {
  return `${b.id} ${bokstav}`
}

// The answer button's label: the letter and the option's text, so the button can be understood without the block.
export const SVAR_TEXT_MAX = 40

export function svarsEtikett(alt: RadarAlternativ, S: Strings): string {
  return `${alt.bokstav.toUpperCase()}${alt.forslag ? ` ${S.suggestionBracket}` : ''}`
}

export type BeslutGrupp = { projekt: string; lista: RadarBeslut[] }

// The decisions per Project, those blocking an agent first: groups with at least one blocking decision before those without,
// and within each group the blocking ones before the others. The order is otherwise the file's.
export function beslutGrupper(beslut: RadarBeslut[], S: Strings): BeslutGrupp[] {
  const per = new Map<string, RadarBeslut[]>()
  for (const b of beslut) {
    const p = (b.projekt ?? '').trim() || S.withoutProject
    per.set(p, [...(per.get(p) ?? []), b])
  }
  const blockerar = (b: RadarBeslut) => (b.blockerar.trim() ? 0 : 1)
  return [...per.entries()]
    .map(([projekt, lista]) => ({ projekt, lista: lista.map((b, i) => ({ b, i })).sort((x, y) => blockerar(x.b) - blockerar(y.b) || x.i - y.i).map(x => x.b) }))
    .map((g, i) => ({ g, i }))
    .sort((x, y) => Number(!x.g.lista.some(b => b.blockerar.trim())) - Number(!y.g.lista.some(b => b.blockerar.trim())) || x.i - y.i)
    .map(x => x.g)
}

// The decision row in collapsed mode: Id · title · age · blocks · suggestion. The show/hide text exists so the arrow is not the only cue.
export function beslutRad(b: RadarBeslut, oppen: boolean, bredd: number, S: Strings): string {
  const forslag = b.alternativ.find(a => a.forslag)
  const delar = [
    `${b.id || 'B?'}`,
    kort(b.rubrik, Math.max(20, bredd - 40)),
    b.alder || '',
    b.blockerar ? S.blocks(kort(b.blockerar, 24)) : '',
    forslag ? `${S.suggestion} ${forslag.bokstav}` : '',
  ].filter(Boolean)
  return `${oppen ? '▾' : '▸'} ${delar.join(' · ')} · ${oppen ? S.hide : S.show}`
}

// Reports with the unreported ones first (otherwise in the given order), as the Agenter tab shows them.
export function rapportOrdning<T extends { orapporterad: boolean }>(rader: T[]): T[] {
  return rader.map((r, i) => ({ r, i })).sort((a, b) => Number(b.r.orapporterad) - Number(a.r.orapporterad) || a.i - b.i).map(x => x.r)
}

// The owner and blocked lines of a report, short, for the folded row. Empty fields give no lines.
export function rapportFalt(r: { owner?: string; blockerat?: string }, S: Strings): string[] {
  const ut: string[] = []
  if (r.owner) ut.push(`${S.ownerLabel}: ${kort(r.owner, 100)}`)
  if (r.blockerat) ut.push(`${S.blockedLabel}: ${kort(r.blockerat, 100)}`)
  return ut
}

// leveranser/*.html and *.pdf, newest first. The rest of the folder (images, scripts) is not something to open.
export function arLeverans(namn: string): boolean {
  return /\.(html|pdf)$/i.test(namn)
}

export function senasteLeveranser(filer: RadarFil[], antal: number): RadarFil[] {
  return [...filer].sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, antal)
}

// The tabs shown on a narrow surface: 1–5, the selected one, and "Mer" for the rest.
export const MOBIL_FLIKAR = 5

// file: link for Markdown. Backslashes become forward slashes, spaces and åäö are encoded.
export function filLank(sokvag: string): string {
  const s = sokvag.replace(/\\/g, '/')
  return `file:///${encodeURI(s.replace(/^\/+/, ''))}`
}

// The inbox's file name from radar.json (scripts/radar.js finds the right language), the Swedish name if the field is missing.
export function inkorgFil(d: RadarData): string {
  return d.filnamn?.inkorg || FILER.inkorg.sv
}

export function filtreraFiler(filer: RadarFil[], filter: string, max: number): RadarFil[] {
  const f = filter.trim().toLowerCase()
  return filer
    .filter(x => !f || x.sokvag.toLowerCase().includes(f))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, max)
}

// The command with an account is started in its own console window with runas, so that Windows asks for the password there.
// The password never passes through the mod. No window title: start takes the first quoted argument as the title,
// and "runas" comes first unquoted, so it is treated as the program.
// runas does not keep the working directory, so the new window changes it itself (cmd /k: the window stays open with the output).
export function runasArgv(konto: string, cmd: string, cwd: string): string[] {
  return ['cmd', '/c', 'start', 'runas', `/user:${konto}`, `cmd /k cd /d ${cwd} && ${cmd}`]
}

export function korNyckel(slug: string, namn: string): string {
  return `${slug}-${namn}`
}

// projektfarger.json -> { slug: "#rrggbb" }. Anything other than six-digit hex is skipped, a broken file gives an empty table.
export function tolkaFarger(text: string): Record<string, string> {
  let o: unknown
  try {
    o = JSON.parse(text)
  } catch {
    return {}
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return {}
  const ut: Record<string, string> = {}
  for (const [slug, farg] of Object.entries(o as Record<string, unknown>)) {
    if (typeof farg === 'string' && /^#[0-9a-fA-F]{6}$/.test(farg)) ut[slug.toLowerCase()] = farg.toLowerCase()
  }
  return ut
}

// Projects without their own color get the theme's subtle: follows the light and dark theme.
export function projektFarg(farger: Record<string, string>, slug: string): string {
  return farger[slug.toLowerCase()] ?? 'subtle'
}

// WCAG 2.2: relative luminance and contrast ratio.
export function luminans(hex: string): number {
  const kanal = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * kanal(1) + 0.7152 * kanal(3) + 0.0722 * kanal(5)
}

export function kontrast(a: string, b: string): number {
  const [ljus, mork] = [luminans(a), luminans(b)].sort((x, y) => y - x) as [number, number]
  return (ljus + 0.05) / (mork + 0.05)
}

// Text color on a colored background: black or white, whichever gives the highest contrast.
// The better of the two always gives at least 4.58:1, so AA (4.5:1) holds for every background.
export function textPa(bakgrund: string): '#000000' | '#ffffff' {
  return kontrast(bakgrund, '#000000') >= kontrast(bakgrund, '#ffffff') ? '#000000' : '#ffffff'
}

// A help page's title: its first "# " heading, otherwise the file name without the number and .md.
export function hjalpTitel(text: string, fil: string): string {
  const m = text.match(/^#\s+(.+)$/m)
  if (m && m[1]) return m[1].trim()
  return fil.replace(/\.md$/, '').replace(/^\d+-/, '').replace(/-/g, ' ')
}

export function pil(oppen: boolean): string {
  return oppen ? '▼' : '▶'
}

// A heading that folds: the key in the saved fold state, and whether it is open. Headings are open until folded.
export function arUtfalld(oppet: Record<string, boolean>, nyckel: string, standard = true): boolean {
  return oppet[nyckel] ?? standard
}

// The fold state as it is read back from $.store: only true/false values under string keys.
export function tolkaOppet(v: unknown): Record<string, boolean> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const ut: Record<string, boolean> = {}
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (typeof x === 'boolean') ut[k] = x
  return ut
}

// The project a name refers to (folder or slug, case does not matter), or '' if none matches.
export function slugFor(projekt: { mapp: string; slug: string }[], namn: string): string {
  const n = namn.trim().toLowerCase()
  if (!n) return ''
  return projekt.find(p => p.mapp.toLowerCase() === n || p.slug === n)?.slug ?? ''
}

// Lines that a row of text and buttons takes at a given width, when it wraps.
export function raderFor(tecken: number, bredd: number): number {
  return Math.max(1, Math.ceil(tecken / Math.max(1, bredd)))
}

// Folders in a project that the Filer tab does not enter: build output, dependencies and publishing.
export function hoppaOverProjekt(rel: string): boolean {
  return /(^|\/)(bin|obj|node_modules|\.git|\.vs|publish|wwwroot|dist|packages|artifacts)(\/|$)/i.test(rel)
}

// The separator in a root: backslash if the root is written with them (Windows), otherwise forward slash.
export function skiljetecken(rot: string): '\\' | '/' {
  return rot.includes('\\') ? '\\' : '/'
}

// rel with forward slashes under the root -> full path with the root's own separator.
export function winSokvag(rot: string, rel: string): string {
  const sep = skiljetecken(rot)
  const bas = rot.replace(/[\\/]+$/, '')
  return `${bas}${sep}${rel.replace(/\//g, sep)}`
}

// Markdown link with the whole path as text. Backslashes are doubled, otherwise Markdown eats them before _ and *.
export function filRad(sokvag: string): string {
  const text = sokvag.replace(/\\/g, '\\\\').replace(/([[\]])/g, '\\$1')
  return `[${text}](${filLank(sokvag)})`
}

// Promises due within n days, overdue ones included.
export function loftenInom(loften: RadarLofte[], idag: string, dagar: number): RadarLofte[] {
  const grans = new Date(`${idag}T12:00:00`)
  grans.setDate(grans.getDate() + dagar)
  const g = isoDatum(grans.getTime())
  return loften.filter(l => l.datum <= g)
}

// The guard against double presses. A sent answer locks the decision's buttons until radar.json shows the decision
// has changed (gone from the list or different text) or SPARR_MS has passed. Age is not counted: it changes by itself.
export const SPARR_MS = 2 * 60_000

export function beslutSignatur(b: RadarBeslut): string {
  return JSON.stringify([b.id, b.rubrik, b.blockerar, b.alternativ, b.text ?? ''])
}

export function arSparrad(s: RadarSkickat | undefined, b: RadarBeslut | undefined, nu: number): boolean {
  if (!s || !b) return false
  if (nu - s.ms >= SPARR_MS) return false
  return beslutSignatur(b) === s.signatur
}

// "2026-10-23" -> "23/10"
export function kortDatum(iso: string): string {
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})/)
  return m ? `${Number(m[2])}/${Number(m[1])}` : iso
}

// A press on a command button locks the button for this long, or until the answer shows.
export const TRYCK_MS = 2 * 60_000

export function arTryckt(t: { ms: number } | undefined, nu: number): boolean {
  return !!t && nu - t.ms < TRYCK_MS
}

// B-ids that are in beslut but not in kanda. kanda null = first read: nothing counts as new.
export function nyaBeslut(kanda: string[] | null, beslut: RadarBeslut[]): RadarBeslut[] {
  if (kanda === null) return []
  return beslut.filter(b => b.id && !kanda.includes(b.id))
}

// Last JSON line from scripts/servers.js. status gives { key: entry }, start gives one entry, an error gives { fel }.
export function tolkaServrarSvar(stdout: string): Record<string, unknown> | null {
  const rad = stdout.trim().split(/\r?\n/).pop() ?? ''
  try {
    const o: unknown = JSON.parse(rad)
    return o && typeof o === 'object' && !Array.isArray(o) ? (o as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function tolkaServrar(stdout: string): Record<string, RadarServer> {
  const o = tolkaServrarSvar(stdout)
  if (!o || 'fel' in o) return {}
  const ut: Record<string, RadarServer> = {}
  for (const [n, v] of Object.entries(o)) {
    const p = v as Partial<RadarServer>
    if (p && typeof p.pid === 'number') {
      ut[n] = { nyckel: n, slug: p.slug ?? '', namn: p.namn ?? '', pid: p.pid, startad: p.startad ?? '', lever: !!p.lever, portar: p.portar ?? [] }
    }
  }
  return ut
}

export function localhost(port: number): string {
  return `http://localhost:${port}`
}

// --- Inbox: entries from scripts/inbox.js ---

// Unsorted entries: the Now (Nu) section and entries without a heading. Agent, Expensive review, Waiting and Later are backlog
// and are not counted: a number that never goes down teaches you to stop looking. Older radar.json without sections: the old rows.
export function inkorgAntal(d: RadarData): number {
  const s = d.inkorg.sektioner ?? []
  if (!s.length) return d.inkorg.antal
  return s.filter(x => !x.namn || sektionOppenStandard(x.namn)).reduce((n, x) => n + x.poster.length, 0)
}

// All entries in all sections except Done, for the row "(N i alla sektioner)".
export function inkorgTotal(d: RadarData): number {
  const s = d.inkorg.sektioner ?? []
  return s.length ? s.reduce((n, x) => n + x.poster.length, 0) : d.inkorg.antal
}

// The Now (or Nu) section is open by default, the others collapsed.
export function sektionOppenStandard(namn: string): boolean {
  return /^(now|nu)$/i.test(namn.trim())
}

export function postForsta(p: RadarInkorgPost): string {
  return p.text.split('\n')[0] ?? ''
}

// The entry's text on one line, for /agent, /lova and /beslut ny: in the prompt.
export function postPrompt(prefix: string, p: RadarInkorgPost): string {
  return `${prefix}${kort(p.text, 600)}`
}

// The confirmation of Ta bort is valid this long after the first press.
export const BEKRAFTA_MS = 10_000

export function arBekraftad(b: { hash: string; ms: number } | null, hash: string, nu: number): boolean {
  return !!b && b.hash === hash && nu - b.ms < BEKRAFTA_MS
}

// Last JSON line from scripts/decide.js: { ok, id, svar, task } or { fel }. task is the status file's slug if an agent asked, otherwise ''.
export function tolkaDecideSvar(stdout: string, S: Strings): { ok: true; id: string; svar: string; task: string } | { fel: string } {
  const rad = stdout.trim().split(/\r?\n/).pop() ?? ''
  try {
    const o: unknown = JSON.parse(rad)
    if (o && typeof o === 'object') {
      const r = o as { ok?: unknown; fel?: unknown; id?: unknown; svar?: unknown; task?: unknown }
      if (r.ok === true) return { ok: true, id: String(r.id ?? ''), svar: String(r.svar ?? ''), task: typeof r.task === 'string' ? r.task : '' }
      if (typeof r.fel === 'string') return { fel: r.fel }
    }
  } catch {
    // falls through
  }
  return { fel: S.noAnswerFrom('decide.js') }
}

// Last JSON line from a row script: { ok: true, ... } or { fel }. Anything else (no answer, broken line) becomes an error.
export function tolkaInboxSvar(stdout: string, S: Strings, skript: string): { ok: true } | { fel: string } {
  const rad = stdout.trim().split(/\r?\n/).pop() ?? ''
  try {
    const o: unknown = JSON.parse(rad)
    if (o && typeof o === 'object') {
      const r = o as { ok?: unknown; fel?: unknown }
      if (r.ok === true) return { ok: true }
      if (typeof r.fel === 'string') return { fel: r.fel }
    }
  } catch {
    // falls through
  }
  return { fel: S.noAnswerFrom(skript) }
}

// --- Files: pinned, latest and folders ---

// The files that always come first, in this order. The English name if it exists.
export const FASTA_FILER: FilBegrepp[] = ['beslut', 'loften', 'inkorg', 'idag', 'overlamning', 'projektregister']

// The root is read in full for the search (including the archive and the log), but not build output and dependencies.
export function hoppaOverFiler(rel: string): boolean {
  return /^(\.git|node_modules|status\/kor)(\/|$)/.test(rel)
}

// The archive and the log: hidden in Filer until the "Visa arkivet" button is pressed, but included in the search.
export function arArkiv(rel: string): boolean {
  return new RegExp(`^(${arkivRegex()}|status/logg)(/|$)`).test(rel)
}

// Full Windows path -> path under the root with forward slashes, or '' if the file is outside the root.
export function relUnderRot(sokvag: string, rot: string): string {
  const sep = skiljetecken(rot)
  const r = `${rot.replace(/[\\/]+$/, '')}${sep}`
  return sokvag.startsWith(r) ? sokvag.slice(r.length).replace(/\\/g, '/') : ''
}

export function fastaFiler(egna: RadarFil[], rot: string): RadarFil[] {
  const rels = new Map(egna.map(f => [relUnderRot(f.sokvag, rot), f]))
  const ut: RadarFil[] = []
  for (const b of FASTA_FILER) {
    const f = rels.get(filnamn(b, rel => rels.has(rel)))
    if (f) ut.push(f)
  }
  return ut
}

const SENASTE_UTOM = new RegExp(`^(${arkivRegex()}|status/logg|${FILER.agenter.en}|${FILER.agenter.sv})(/|$)`)

export function senasteFiler(egna: RadarFil[], rot: string, antal: number): RadarFil[] {
  return egna
    .filter(f => !SENASTE_UTOM.test(relUnderRot(f.sokvag, rot)))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, antal)
}

export type FilMapp = { namn: string; filer: RadarFil[]; arkiv: boolean }

// The folders under the root with their files (newest first). Files in the root itself go in the folder S.rootFolder.
// status/logg is its own folder so it can be hidden separately. The archive folders are marked arkiv and sorted last.
export function filMappar(egna: RadarFil[], rot: string, S: Strings): FilMapp[] {
  const per = new Map<string, RadarFil[]>()
  for (const f of egna) {
    const rel = relUnderRot(f.sokvag, rot)
    if (!rel) continue
    const delar = rel.split('/')
    const namn = delar.length === 1 ? S.rootFolder : rel.startsWith('status/logg/') ? 'status/logg' : (delar[0] ?? '')
    per.set(namn, [...(per.get(namn) ?? []), f])
  }
  return [...per.entries()]
    .map(([namn, filer]) => ({ namn, filer: filer.sort((a, b) => b.mtimeMs - a.mtimeMs), arkiv: arArkiv(namn) }))
    .sort((a, b) => Number(a.arkiv) - Number(b.arkiv) || a.namn.localeCompare(b.namn, 'sv'))
}

// --- The notebook: the root and rooflow.json ---

// The notebook's root: the nearest folder upward from cwd (cwd itself included) that has rooflow.json, or null.
// Same rule as scripts/root.js, without ROOFLOW_ROOT: that only decides which root applies once cwd is inside a notebook.
// Handles both C:\a\b and /a/b. `finns` is the mod's $.fs.exists.
export async function hittaRot(cwd: string, finns: (sokvag: string) => Promise<boolean>): Promise<string | null> {
  const sep = skiljetecken(cwd)
  const delar = cwd.split(/[\\/]+/).filter(Boolean)
  const prefix = /^[A-Za-z]:$/.test(delar[0] ?? '') ? '' : sep === '/' ? '/' : ''
  for (let n = delar.length; n >= 0; n--) {
    const dir = prefix + delar.slice(0, n).join(sep)
    // The root itself ("/" or "C:"): check it, and stop.
    const mapp = n === 0 ? (prefix === '/' ? '/' : '') : dir
    if (mapp === '') return null
    const kandidat = mapp.endsWith(sep) ? `${mapp}rooflow.json` : `${mapp}${sep}rooflow.json`
    if (await finns(kandidat)) return n === 1 && /^[A-Za-z]:$/.test(mapp) ? `${mapp}${sep}` : mapp
  }
  return null
}

// How long the panel waits before it sends the continue prompt for an agent's decision; Undo stops it meanwhile.
// rooflow.json decisions.undoSeconds overrides it: a whole number from 0 to 60, anything else gives the default.
// 0 sends at once, with no undo window.
export const ANGRA_SEKUNDER = 4

export function angraSekunder(v: unknown): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 60 ? v : ANGRA_SEKUNDER
}

export type Miljo = { rot: string; language: string; servers: boolean; platform: string; autoContinue: boolean; undoSeconds: number }

export const TOM_MILJO: Miljo = { rot: '', language: 'en', servers: false, platform: 'unknown', autoContinue: true, undoSeconds: ANGRA_SEKUNDER }

// rooflow.json -> what the mod needs: the language ("language", older "sprak"; default en), the addons and
// "decisions": { "autoContinue" (default true), "undoSeconds" (default ANGRA_SEKUNDER, 0 to 60) }. Broken file: defaults.
export function tolkaKonfig(text: string): { language: string; servers: boolean; autoContinue: boolean; undoSeconds: number } {
  let o: unknown
  try {
    o = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    return { language: 'en', servers: false, autoContinue: true, undoSeconds: ANGRA_SEKUNDER }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { language: 'en', servers: false, autoContinue: true, undoSeconds: ANGRA_SEKUNDER }
  const r = o as { language?: unknown; sprak?: unknown; addons?: unknown; decisions?: unknown }
  const sprak = typeof r.language === 'string' ? r.language : typeof r.sprak === 'string' ? r.sprak : 'en'
  const tillagg = r.addons && typeof r.addons === 'object' && !Array.isArray(r.addons) ? (r.addons as { servers?: unknown }) : {}
  const beslut = r.decisions && typeof r.decisions === 'object' && !Array.isArray(r.decisions) ? (r.decisions as { autoContinue?: unknown; undoSeconds?: unknown }) : {}
  return { language: sprak.trim().toLowerCase() === 'sv' ? 'sv' : 'en', servers: tillagg.servers === true, autoContinue: beslut.autoContinue !== false, undoSeconds: angraSekunder(beslut.undoSeconds) }
}

// A free-text answer that holds the agent back: nothing is sent by itself. Swedish and English, at the start of the answer.
export function arStoppSvar(svar: string): boolean {
  return /^\s*(vänta|inte nu|stopp|nej|wait|not now|stop|no)(?![\p{L}\p{N}])/iu.test(svar)
}

// How a path is opened on the operating system: VS Code and the browser. platform is $.session.info().platform.
export function vsCodeArgv(platform: string, sokvag: string): string[] {
  return platform === 'windows' ? ['cmd', '/c', 'code', sokvag] : ['code', sokvag]
}

export function oppnaUrlArgv(platform: string, url: string): string[] {
  if (platform === 'windows') return ['rundll32', 'url.dll,FileProtocolHandler', url]
  if (platform === 'macos') return ['open', url]
  return ['xdg-open', url]
}

// The state word radar.json carries (always the internal Swedish one: kör, frågar, klar, fast, maybe followed by "10 min")
// as the panel shows it in the language: "kör 10 min" -> "running 10 min" in English, unchanged in Swedish.
export function visaLage(v: string, language: string): string {
  if (language === 'sv' || !v) return v
  const m = v.match(/^(\s*)(\S+?)([\s,.(].*)?$/)
  if (!m) return v
  for (const par of Object.values(LAGEN)) {
    if (par[0] === (m[2] ?? '').toLowerCase()) return `${m[1]}${par[1]}${m[3] ?? ''}`
  }
  return v
}

// "- Options: a) x; b) y" becomes one line per option with the letter in bold, which is easier to read in the panel.
export function alternativPaRader(text: string): string {
  return text.replace(/^([-*] (?:Alternativ|Options):)[ \t]*(.+)$/gm, (hel: string, rubrik: string, rest: string) => {
    const delar = [...rest.matchAll(/(?:^|[;,.]?\s+)([a-hA-H])\)\s+/g)]
    if (delar.length < 2 || delar[0].index !== 0) return hel
    const rader = delar.map((m, i) => {
      const start = (m.index ?? 0) + m[0].length
      const slut = i + 1 < delar.length ? delar[i + 1].index ?? rest.length : rest.length
      return `  - **${m[1].toUpperCase()})** ${rest.slice(start, slut).trim().replace(/[;,]$/, '')}`
    })
    return [rubrik, ...rader].join('\n')
  })
}

// The first line of status/morning.md, "Morning Tuesday 2026-11-24 07:58 (/morning)" (Swedish: Morgon … (/morgon)), taken apart,
// so that the panel can say it in words. rubrik is null when the file has no such line (older files); text is the rest.
export type MorgonFil = {
  rubrik: { kommando: string; veckodag: string; datum: string; tid: string } | null
  text: string
}

export function tolkaMorgon(fil: string): MorgonFil {
  const rader = fil.replace(/^﻿/, '').split(/\r?\n/)
  const forsta = rader[0] ?? ''
  const m = forsta.match(/^\s*(?:Morgon|Morning)\s+(\S+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s*\((\/\S+)\)\s*$/i)
  if (!m) return { rubrik: null, text: fil }
  return {
    rubrik: { veckodag: m[1] ?? '', datum: m[2] ?? '', tid: m[3] ?? '', kommando: m[4] ?? '' },
    text: rader.slice(1).join('\n').trim(),
  }
}

// Every plain line becomes a list entry ("- "), so that each entry in Meetings starts with a bullet. Lines that already are
// Markdown structure (lists, tables, headings, quotes, code) are left as they are: the morning file may hold a meeting table.
export function punktaRader(text: string): string {
  let iKod = false
  return text
    .split(/\r?\n/)
    .map(rad => {
      const t = rad.trim()
      if (t.startsWith('```')) {
        iKod = !iKod
        return rad
      }
      if (iKod || t === '') return rad
      if (/^([-*+•|#>]|\d+[.)]\s)/.test(t)) return rad
      return `- ${t}`
    })
    .join('\n')
    // A blank line between two entries makes Markdown draw a loose list, with space between all bullets.
    .replace(/^(- .*)\n\s*\n(?=- )/gm, '$1\n')
}
