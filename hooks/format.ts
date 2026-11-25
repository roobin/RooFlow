// RooFlows filformat på svenska och engelska. Moden körs i Claude Codes motor och får inte importera
// från scripts/, så tabellen finns som kopia här. HÅLL DEN LIK scripts/format.js (samma begrepp, samma nycklar och värden).
// Internt används de svenska värdena (kör, frågar, klar, fast), som scripts/radar.js också skriver i status/radar.json.

export const FILER = {
  beslut: { sv: 'beslut.md', en: 'decisions.md' },
  loften: { sv: 'loften.md', en: 'promises.md' },
  inkorg: { sv: 'inkorg.md', en: 'inbox.md' },
  idag: { sv: 'idag.md', en: 'today.md' },
  overlamning: { sv: 'overlamning.md', en: 'handover.md' },
  projektregister: { sv: 'projektregister.md', en: 'projects.md' },
  tankar: { sv: 'tankar', en: 'notes' },
  arkiv: { sv: 'arkiv', en: 'archive' },
  agenter: { sv: 'agenter', en: 'briefs' },
  underagenter: { sv: 'status/underagenter.jsonl', en: 'status/subagents.jsonl' },
} as const

export type FilBegrepp = keyof typeof FILER

export const STATUS = {
  lage: ['Läge', 'State'],
  gorNu: ['Gör nu', 'Doing'],
  uppdaterad: ['Uppdaterad', 'Updated'],
  behover: ['Behöver', 'Needs'],
  uppdrag: ['Uppdrag', 'Task'],
  projekt: ['Projekt', 'Project'],
} as const

export const REGISTER = {
  mapp: ['Mapp', 'Folder'],
  kategori: ['Kategori', 'Category'],
  lage: ['Läge', 'State'],
  eget: ['Eget repo', 'Own repo'],
  remote: ['Remote'],
  kommentar: ['Kommentar', 'Comment'],
} as const

export const PROJEKTLAGEN = {
  nu: ['nu', 'now'],
  nästa: ['nästa', 'next'],
  väntar: ['väntar', 'waiting'],
  parkerat: ['parkerat', 'parked'],
} as const

export const LAGEN = {
  kör: ['kör', 'running'],
  frågar: ['frågar', 'asking'],
  klar: ['klar', 'done'],
  fast: ['fast', 'stuck'],
} as const

export const BESLUT = {
  datum: ['Datum', 'Date'],
  projekt: ['Projekt', 'Project'],
  uppdrag: ['Uppdrag', 'Task'],
  blockerar: ['Blockerar', 'Blocks'],
  fragar: ['Frågar', 'Asked by'],
  fraga: ['Fråga', 'Question'],
  varfor: ['Varför det spelar roll', 'Why it matters'],
  alternativ: ['Alternativ', 'Options'],
  beslut: ['Beslut', 'Decision'],
} as const

export const RUBRIKER = {
  oppna: ['Öppna', 'Open'],
  tagna: ['Tagna', 'Taken', 'Decided'],
  nastaId: ['Nästa Id', 'Next Id'],
  klart: ['Klara', 'Klart', 'Done'],
  idag: ['Idag', 'Today'],
} as const

export const JOURNAL = {
  tid: ['tid', 'time'],
  id: ['id'],
  projekt: ['projekt', 'project'],
  rapport: ['rapport', 'report'],
} as const

export const ORAPPORTERAD = ['orapporterad', 'unreported'] as const

export const RAPPORT = {
  rapport: ['RAPPORT', 'REPORT'],
  gjort: ['Gjort', 'Done'],
  owner: ['Owner'],
  loften: ['Löften', 'Promises'],
  blockerat: ['Blockerat', 'Blocked'],
  nasta: ['Nästa', 'Next'],
  lage: ['Läge', 'Branch'],
  provat: ['Prövat', 'Tested'],
} as const

export const UNDERAGENT = {
  handelse: ['handelse', 'event'],
  uppdrag: ['uppdrag', 'task'],
  modell: ['modell', 'model'],
  tid: ['tid', 'time'],
  projekt: ['projekt', 'project'],
} as const

export const HANDELSER = { start: ['start'], klar: ['klar', 'done'] } as const

// Engelska filen om finns(rel) säger att den finns, annars den svenska. finns är mods fs, inte node:fs.
export function filnamn(begrepp: FilBegrepp, finns: (rel: string) => boolean): string {
  const f = FILER[begrepp]
  return finns(f.en) ? f.en : f.sv
}

// "kör", "running", "Running (del 2)" -> "kör". Okänt värde blir det gemena första ordet.
export function normaliseraLage(v: string): string {
  const ord = (v || '').trim().toLowerCase().split(/[\s,.(]/)[0] ?? ''
  for (const [internt, par] of Object.entries(LAGEN)) {
    if ((par as readonly string[]).includes(ord)) return internt
  }
  return ord
}

export function normaliseraProjektlage(v: string): string {
  const s = (v || '').trim().toLowerCase()
  for (const [internt, par] of Object.entries(PROJEKTLAGEN)) {
    if ((par as readonly string[]).includes(s)) return internt
  }
  return s
}

export function normaliseraHandelse(v: string): string {
  const h = (v || '').trim().toLowerCase()
  for (const [internt, par] of Object.entries(HANDELSER)) {
    if ((par as readonly string[]).includes(h)) return internt
  }
  return h
}

// Mappar som Filer-fliken hoppar över: arkivet heter archive efter migreringen.
export function arkivRegex(): string {
  return `${FILER.arkiv.sv}|${FILER.arkiv.en}`
}

// Key names in decision blocks and status headers, in both directions, built from the tables above so that they cannot drift apart.
const PAR = [...Object.values(BESLUT), ...Object.values(STATUS)].filter(par => par.length > 1)
const NYCKLAR_SV: Record<string, string> = Object.fromEntries(PAR.map(par => [par[1], par[0]]))
const NYCKLAR_EN: Record<string, string> = Object.fromEntries(PAR.map(par => [par[0], par[1]]))

// The value of the state key in the target language ("asking" -> "frågar", "frågar" -> "asking"). Other values are left alone.
function oversattLage(v: string, till: 'sv' | 'en'): string {
  const ord = v.trim().toLowerCase().split(/[\s,.(]/)[0] ?? ''
  const fran = till === 'sv' ? 1 : 0
  const mot = till === 'sv' ? 0 : 1
  for (const par of Object.values(LAGEN)) {
    if (ord === par[fran]) return v.replace(new RegExp(`^(\\s*)${par[fran]}`, 'i'), `$1${par[mot]}`)
  }
  return v
}

// Display translation of the keys at the start of a line: "- Question: x" -> "- Fråga: x" for "sv", the other way for "en".
// Only keys first on the line (after a bullet or bold), not in code fences and not in running text. The files never change.
export function oversattNycklar(text: string, sprak: string): string {
  if ((sprak !== 'sv' && sprak !== 'en') || !text) return text
  const tabell = sprak === 'sv' ? NYCKLAR_SV : NYCKLAR_EN
  const lageNyckel = sprak === 'sv' ? 'State' : 'Läge'
  let iKod = false
  return text
    .split('\n')
    .map(rad => {
      if (/^\s*```/.test(rad)) {
        iKod = !iKod
        return rad
      }
      if (iKod) return rad
      const m = rad.match(/^(\s*(?:[-*]\s+)?\**)([A-Za-zÅÄÖåäö][A-Za-zÅÄÖåäö ]*?)(\**:\**\s*)([\s\S]*)$/)
      const ny = m ? tabell[m[2] ?? ''] : undefined
      if (!m || !ny) return rad
      return `${m[1]}${ny}${m[3]}${m[2] === lageNyckel ? oversattLage(m[4] ?? '', sprak) : m[4]}`
    })
    .join('\n')
}
