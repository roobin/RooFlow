// The contract for the rooflow plugin: what lives in $.state. The shape mirrors status/radar.json (scripts/radar.js).

export type RadarAlternativ = { bokstav: string; text: string; forslag: boolean }

export type RadarBeslut = {
  id: string
  rubrik: string
  datum: string
  alder: string
  fragar: string
  blockerar: string
  // Project: in the decision block; missing in older radar.json.
  projekt?: string
  // Task: in the decision block (the status file's slug); missing in older radar.json and in blocks without Task.
  uppdrag?: string
  alternativ: RadarAlternativ[]
  text?: string
}

// hash: scripts/promise.js done <hash>. Missing in older radar.json (then no Klar button is shown).
export type RadarLofte = { datum: string; vem: string; vad: string; nar: string; hash?: string }
export type RadarVantar = { datum: string; vem: string; vad: string; hash?: string }

export type RadarAgent = {
  slug: string
  namn: string
  vad: string
  lage: string
  sedan: string
  modell: string
  // Needs: in the status header (restart, deploy, B<n>, annat) and the group it belongs to; missing when the agent is not waiting.
  behover?: string
  vantarPa?: 'restart' | 'deploy' | 'beslut' | 'annat'
  // The project key (rooflow.json) the agent belongs to; missing in older radar.json and for subagents.
  projekt?: string
}

// An agent that is waiting (scripts/radar.js, vantarPa in radar.json).
export type RadarVantaPost = { slug: string; namn: string; projekt?: string; behover: string; sedan: string; gorNu: string }
export type RadarVantarPa = { restart: RadarVantaPost[]; deploy: RadarVantaPost[]; beslut: RadarVantaPost[]; annat: RadarVantaPost[] }

export type RadarSkill = { namn: string; besk: string }

export type RadarKommando = { namn: string; cmd: string; cwd: string; konto: string }

export type RadarProjekt = {
  mapp: string
  slug: string
  lage: string
  dir: string
  statusFil: string
  agentLage: string
  lageText: string
  gorNu: string
  nastaSteg: string
  uppdaterad: string
  sistRort: string
  beslut: string[]
  loften: string[]
  kor: RadarKommando[]
  rapporter?: RadarRapport[]
  docs?: string[]
  gitLogg?: RadarCommit[]
}

export type RadarCommit = { hash: string; tid: string; text: string }

// The last row in usage.md regardless of date. Not live: written by /morgon and /fredag.
export type RadarForbrukning = { datum: string; tid: string; femh: string; vecka: string; weekModel: string; kommentar: string }

export type RadarInkorgRad = { datum: string; rubrik: string; text: string }

// An entry in inbox.md: hash of the text (scripts/inbox.js), text = the first line without "- " plus continuation lines, truncated.
export type RadarInkorgPost = { hash: string; text: string }
export type RadarInkorgSektion = { namn: string; poster: RadarInkorgPost[] }

export type RadarUnderagent = { id: string; projekt: string; uppdrag: string; modell: string; start: string; klar: string; resultat: string }

export type RadarJournalRad = RadarRapport & { projekt: string }

// owner/blockerat: the Owner: and Blocked: lines of the final report (scripts/journal.js); older radar.json files used another key for owner, which the mod maps.
export type RadarRapport = { tid: string; id: string; rapport: string; orapporterad: boolean; owner?: string; blockerat?: string }

export type RadarData = {
  // The format version scripts/radar.js wrote (FORMAT). 0 = missing.
  format: number
  genererad: string
  antal: { behover: number; idag: number; lovat: number; vantar: number; rorsig: number; starstill: number; inkorg: number }
  usage: { femh: string; vecka: string } | null
  forbrukning: RadarForbrukning | null
  beslut: RadarBeslut[]
  bordlagda: string[]
  idag: { datum: string; saker: { klar: boolean; text: string; hash?: string }[] }
  loften: RadarLofte[]
  vantar: RadarVantar[]
  rorSig: RadarAgent[]
  // Agents with Needs: per group. Missing in older radar.json (the mod fills in empty lists).
  vantarPa: RadarVantarPa
  // Projects whose status file says Läge: kör and was updated in the last 2 hours (scripts/radar.js).
  korNu: string[]
  starStill: { mapp: string; slug?: string }[]
  projekt: RadarProjekt[]
  skills: RadarSkill[]
  // angra: the name of the action that Ångra undoes (done, move, remove), '' when nothing can be undone.
  inkorg: { antal: number; aldsta: string; rader: RadarInkorgRad[]; sektioner: RadarInkorgSektion[]; angra: string }
  // File names scripts/radar.js found (English if they exist, otherwise Swedish). Missing in older radar.json.
  filnamn?: { inkorg?: string }
  agenter: { underagenter: RadarUnderagent[]; rapporter: RadarJournalRad[] }
}

// sokvag: full path (the root's own separator). rel: the path under the root, for the search field.
export type RadarFil = { sokvag: string; rel: string; mtimeMs: number }

export type PanelFlik = 'beslut' | 'idag' | 'projekt' | 'servrar' | 'agenter' | 'inkorg' | 'kommandon' | 'filer' | 'hjalp'

// A page of the plugin's docs/ folder, shown in the Help tab: the file name, its first heading and its text.
export type HjalpSida = { fil: string; titel: string; text: string }

// The guard against double presses: when the answer was sent and what the decision looked like then.
export type RadarSkickat = { tid: string; ms: number; bokstav: string; signatur: string }

// An entry from `node scripts/servers.js status`: a window the panel started, and whether it is alive.
export type RadarServer = { nyckel: string; slug: string; namn: string; pid: number; startad: string; lever: boolean; portar: number[] }

// A sent command or a requested measurement: when, so the button can show "Skickat" for a while.
export type RadarTryck = { tid: string; ms: number }

declare module 'claude-code' {
  interface PluginState {
    'rooflow': {
      data: RadarData | null
      fel: string
      lageOppet: string
      projektOppet: string
      filter: string
      filer: RadarFil[]
      servrar: Record<string, RadarServer>
      servrarLast: string
      plan: { femh: number; vecka: number } | null
      // How full the context window is (percent), from $.session.usage().context; null when the app has no figure.
      kontext: number | null
      farger: Record<string, string>
      flik: PanelFlik
      skickat: Record<string, RadarSkickat>
      statusText: string
      moten: string
      tryck: Record<string, RadarTryck>
      kandaBeslut: string[] | null
      rapportOppen: string
      // Inbox: sections and entries the user has expanded or collapsed (key = section name or hash); if the key is missing the default applies.
      inkorgOppen: Record<string, boolean>
      // Ta bort is waiting for a second press: which entry and when the first press was made.
      bekrafta: { hash: string; ms: number } | null
      // Hash of the entry whose Flytta… row is expanded.
      flyttaVal: string
      // Filer: folders that are expanded, and whether the archive (archive/, status/logg) is shown.
      mapparOppna: Record<string, boolean>
      visaArkivet: boolean
      // Filer: leveranser/*.html and *.pdf.
      leveranser: RadarFil[]
      // Beslut tab: Id of the expanded decision (one at a time), '' = none.
      beslutOppen: string
      // Beslut tab: the text in the free-text field (Svara fritt), one decision at a time.
      svarFritt: string
      // Mobile: tabs 6–8 are only shown after Mer. Inbox: hash of the entry whose Mer row is expanded.
      merFlikar: boolean
      inkorgMer: string
      // The week's usage (percent, all models) from $.session.usage().rateLimits; null without a subscription window.
      vecka: number | null
      // The notebook: the root (empty = none, the mod does nothing), the language and addons from rooflow.json, and the operating system.
      // autoContinue and undoSeconds: rooflow.json decisions.autoContinue (default true) and decisions.undoSeconds (default 4).
      miljo: { rot: string; language: string; servers: boolean; platform: string; autoContinue: boolean; undoSeconds: number }
      // Decided decisions whose prompt is sent when the undo window ends (ms: when it was decided). task "": no agent, the prompt is "B14 a".
      fortsatt: { id: string; task: string; text: string; ms: number }[]
      // Continue prompts that were not sent (Undo, a holding answer, or autoContinue off): a "Continue the agent" (or "Send" without task) button each.
      fortsattVantar: { id: string; task: string; text: string }[]
      // Headings that fold (Servers per project, Agents per group): key -> open. Kept in $.store between sessions.
      oppet: Record<string, boolean>
      // Raised when the panel opens or closes, so that the band's Panel toggle is drawn again with the new state.
      panelVersion: number
      // Help tab: the pages of docs/<language>/ and the one that is shown ('' = the list).
      hjalpSidor: HjalpSida[]
      hjalpVald: string
    }
  }
}
