// "Ask": the onboard guide. It needs no AI model and no connection to Earth. It answers from what the
// app knows right now (every crew member's live readings, the cabin, the scenario being played) and
// from a knowledge base built from NASA's Human Research Program pages, Canadian Space Agency pages
// and the published sources behind each rule. Every answer links to where it comes from, and it never
// makes up a number: when nothing matches, it says so and suggests what it can answer.

import { CARE_STEPS, ROUTINE, SCENARIO_CONTEXT, type StepSource } from './data/careSteps.ts'
import { SCENARIOS } from './data/emergency.ts'
import { MISSIONS, linkDelay, type MissionId } from './data/missions.ts'
import { GUIDE, HAZARD_INFO, NASA_RISK, NASA_STUDY, PARTNER_WORK, type Hazard } from './data/signalGuide.ts'
import { SOURCES } from './data/sources.ts'
import { USERS } from './data/users.ts'
import { LIVE_SCENARIOS, SCENARIO_ORDER, isFixed, type ScenarioId } from './live.ts'
import { CABIN_ID, type Subject } from './model.ts'
import type { Finding, Level } from './triage.ts'

export interface Link {
  label: string
  url?: string
}

export interface Answer {
  /** What the answer is about, so a follow-up ("and why?", "what should she do?") can refer back to it. */
  topic: string
  /** The crew member the answer is about, if any. */
  person?: string
  title: string
  /** The answer in a sentence or two. */
  lead: string
  lines: string[]
  sources: Link[]
}

export interface AskContext {
  subjects: Subject[]
  /** The person asking. */
  meId: string
  day: number
  mission: MissionId
  scenario: ScenarioId
  /** The last answer's person and topic, for follow-up questions. */
  last?: { person?: string; topic?: string }
}

// ---------------------------------------------------------------------------------------------
// Words

const STOP = new Set(
  'a an the is are was were am be been being it its of to in on at for and or do does did what whats why how hows when where which who whose whom should shall can could would will about with this that these those have has had not no any there here please tell me you your yours we our ours us they them their i my mine myself im ive id he him his she her hers let lets know want need get got just much many some so if then than too very really also there their it into from up out by as but like now right today currently current please kind sort way thing things okay ok until after before down dont cant wont isnt doesnt didnt arent youre theyre shes hes hi hello hey hiya yo thanks thank thx cheers good morning afternoon evening'.split(
    ' ',
  ),
)

/** Words that say "how is it going" without naming a topic. */
const GENERIC = new Set(['take', 'use', 'give', 'try', 'put', 'keep', 'come', 'last', 'long', 'safe', 'safety', 'see', 'nasa', 'normal', 'astronaut', 'person', 'step', 'someone', 'somebody', 'anyone', 'anybody', 'crewmate', 'member', 'people', 'happen', 'get', 'go', 'make', 'health', 'healthy', 'status', 'condition', 'alright', 'fine', 'doing', 'feel', 'feeling', 'well', 'wrong', 'going', 'happening', 'overall', 'everything', 'look', 'state', 'situation', 'update', 'news'].map(stem))

/** Everyday words mapped to the word the guide uses. */
const SYNONYMS: Record<string, string> = {
  doc: 'doctor', physician: 'doctor', medic: 'doctor', temp: 'temperature', bp: 'pressure', o2: 'oxygen', sat: 'oxygen', sats: 'oxygen', hr: 'pulse',
  rad: 'radiation', rads: 'radiation', ill: 'sick', unwell: 'sick', nauseous: 'nausea', nauseated: 'nausea', puke: 'vomit', throwing: 'vomit',
  hurt: 'pain', hurts: 'pain', hurting: 'pain', ache: 'pain', aches: 'pain', aching: 'pain', sore: 'pain', lunar: 'moon', martian: 'mars', sun: 'solar',
  sunlight: 'sunlight', lonely: 'lonely', homesick: 'lonely', insomnia: 'sleep', asleep: 'sleep', sleepy: 'tired', exhausted: 'tired', fatigued: 'tired',
  home: 'earth', ground: 'earth', houston: 'earth', fainted: 'faint', passed: 'faint', dizzie: 'dizzy', woozy: 'dizzy', giddy: 'dizzy',
  peeing: 'urine', pee: 'urine', drink: 'water', drinking: 'water', hydrated: 'water', dehydrated: 'water', meds: 'medicine', medication: 'medicine',
  painkiller: 'medicine', pills: 'medicine', paracetamol: 'medicine', acetaminophen: 'medicine', tylenol: 'medicine', ibuprofen: 'medicine',
  workout: 'exercise', gym: 'exercise', training: 'exercise', sad: 'mood', depressed: 'mood', depression: 'mood', anxious: 'stress', anxiety: 'stress',
  scrubber: 'scrubber', airflow: 'fan', ventilation: 'fan', shield: 'shelter', shielding: 'shelter', bunker: 'shelter', flare: 'solar', cme: 'solar',
  outage: 'blackout', los: 'blackout', cpr: 'collapse', unconscious: 'collapse', collapsed: 'collapse', unresponsive: 'collapse',
  thrombosis: 'clot', dvt: 'clot', eyesight: 'vision', blurry: 'vision', blurred: 'vision', sight: 'vision', kg: 'mass', weight: 'mass',
}

/** Phrases folded into one word before anything else. */
const PHRASES: [RegExp, string][] = [
  [/carbon\s*dioxide/g, 'co2'],
  [/co₂/g, 'co2'],
  [/check[\s-]?ins?/g, 'checkin'],
  [/heart\s*rate/g, 'pulse'],
  [/blood\s*pressure/g, 'pressure'],
  [/blood\s*sugar|glucose/g, 'sugar'],
  [/mission\s*control/g, 'earth'],
  [/pre[\s-]?plan/g, 'preplan'],
  [/home\s*screen/g, 'homescreen'],
  [/loss\s*of\s*signal/g, 'blackout'],
  [/flight\s*surgeons?/g, 'surgeon'],
  [/contact\s*home/g, 'contacthome'],
  [/live\s*monitor/g, 'livemonitor'],
  [/light[\s-]?headed(ness)?/g, 'lightheaded'],
  [/kidney\s*stones?/g, 'kidney stone'],
  [/spacewalks?|eva\b|moonwalks?/g, 'spacewalk'],
  [/medical\s*officer|\bcmo\b/g, 'officer'],
  [/science\s*specialist|scientist/g, 'scientist'],
  [/flight\s*engineer|\bengineer\b/g, 'engineer'],
  [/(neuro[\s-]?ocular|\bsans\b)/g, 'sans'],
  [/can'?t\s*sleep|cannot\s*sleep|trouble\s*sleeping/g, 'sleep'],
  [/canadian\s*space\s*agency|\bcsa\b/g, 'csa'],
  [/who can see|can (others|other people|everyone|the crew) see|see my (data|health)/g, 'privacy'],
  [/\bfly(ing)?\b|\bpilot(ing)?\b|\blander\b|\bdriv(e|ing)\b|\brover\b/g, 'pilot'],
  [/colou?rs?|green|yellow|amber/g, 'colour'],
]

export function stem(w: string): string {
  if (w.length > 5 && w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (w.length > 6 && w.endsWith('ing')) return w.slice(0, -3)
  if (w.length > 5 && w.endsWith('ed') && !w.endsWith('eed')) return w.slice(0, -2)
  if (w.length > 4 && /(sses|shes|xes|zes)$/.test(w)) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1)
  return w
}

function normalize(text: string): string {
  let s = text.toLowerCase().replace(/[’']/g, "'")
  for (const [re, to] of PHRASES) s = s.replace(re, ` ${to} `)
  s = s.replace(/\b(what|how|who|where|it|that|there|she|he|here)'s\b/g, '$1 is').replace(/\b(i)'m\b/g, 'i am')
  return s.replace(/'s\b/g, '').replace(/'/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Distance between two words, counting a swap of two letters as one edit. */
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

/** Keys for an entry: words, stemmed. */
const keyset = (...groups: (string | string[])[]) => new Set(groups.flat().flatMap((g) => normalize(g).split(' ')).filter((w) => w && !STOP.has(w)).map((w) => stem(SYNONYMS[w] ?? w)))

// ---------------------------------------------------------------------------------------------
// What the guide knows

type Intent = 'greet' | 'thanks' | 'help' | 'feel' | 'situation' | 'overview' | 'todo' | 'status' | 'explain' | 'who'

const INTENTS: [Intent, RegExp][] = [
  ['greet', /^(hi|hello|hey|hiya|good (morning|afternoon|evening)|yo)\b/],
  ['thanks', /\b(thanks|thank you|thx|cheers|great job)\b/],
  ['help', /^(help|what can you do|what do you know|how do you work|who are you|how are you)\b/],
  ['feel', /\b(i feel|i am feeling|i have|i got|ive got|i keep|i cant|i am)\b/],
  ['situation', /\b(what is (happening|going on|the situation|the scenario|wrong)|what happened|situation|scenario|any (problem|problems|issue|issues|alert|alerts)|anything wrong)\b/],
  ['overview', /\b(who needs|who is (sick|ill|unwell|flagged|not ok|in trouble)|is (everyone|everybody|anyone|anybody)|everyone (ok|okay|alright|fine|well)|whole crew|all (the )?crew|crew (status|health|ok|okay)|how (is|are) (the )?(crew|team|everyone|everybody))\b/],
  ['who', /^(who|which (crew|astronaut|person|people))\b|\b(anyone|anybody) (with|has|have)\b/],
  ['todo', /\b(what (should|do|can|must) (i|we|she|he|they|you)|what to do|what now|next step|steps|how (do|can|should) (i|we|you) (fix|treat|help|handle|stop|deal|protect|prevent|lower|reduce|get)|fix|treat|treatment|help (him|her|them|me|us)|deal with|handle|protect|prevent)\b/],
  ['status', /\b(how (is|are|am)|am i|is (she|he|my|her|his|their|the|it)|are (my|her|his|their)|status|doing|condition|ok|okay|alright|normal|fine|level|levels|reading|readings)\b/],
  ['explain', /\b(what (is|are|does|do|happens)|why|explain|tell me about|meaning|mean|define|cause|causes|how does|how do)\b/],
]

const LEVEL_WORD: Record<Level, string> = { green: 'Normal', amber: 'Needs a check', red: 'Urgent' }
const lc = (t: string) => (/^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t)
const firstSentence = (t: string) => t.match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? t
const src = (id: string): Link[] => (SOURCES[id] && SOURCES[id].status !== 'demo' && SOURCES[id].url ? [{ label: SOURCES[id].title, url: SOURCES[id].url }] : [])
const link = (s: StepSource): Link => ({ label: s.label, url: s.url })
const MEDS_ISS: Link = { label: 'Medication use on the ISS (Wotring, FASEB J 2015, NASA report)', url: 'https://ntrs.nasa.gov/api/citations/20140017010/downloads/20140017010.pdf' }
const RISKS_PAGE: Link = { label: 'NASA Human Research Program: Risks of human spaceflight', url: 'https://www.nasa.gov/hrp/risks/' }
const RESEARCH_PAGE: Link = { label: 'NASA Human Research Program: Ongoing research', url: 'https://www.nasa.gov/hrp/ongoing-hrp-research/' }
const SCENARIO_OF: Record<Hazard, ScenarioId> = {
  'Space radiation': 'radiation',
  'Isolation and confinement': 'isolation',
  'Distance from Earth': 'distance',
  'Gravity changes': 'gravity',
  'Closed environment': 'co2',
}

function dedupe(list: Link[]): Link[] {
  const seen = new Set<string>()
  return list.filter((l) => {
    const k = l.url ?? l.label
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

interface Entry {
  topic: string
  /** A signal that is not normal right now. */
  flagged?: boolean
  /** Entries about the same thing for different people share a family. */
  family: string
  person?: string
  keys: Set<string>
  /** Intents this entry answers best. */
  serves?: Intent[]
  /** Topic that answers "what should we do?" after this one. */
  todo?: string
  /** Topic that answers "why?" after this one. */
  why?: string
  build: () => Answer
}

/** Everyday words for each signal. */
const WORDS: Record<string, string[]> = {
  hematocrit: ['hematocrit', 'haematocrit', 'blood', 'red cells', 'plasma', 'thick'],
  onsd: ['eye', 'vision', 'optic nerve', 'sans', 'ultrasound'],
  ijv: ['neck', 'vein', 'jugular', 'clot', 'flow', 'stagnant'],
  headache: ['headache', 'head', 'migraine'],
  sleep: ['sleep', 'tired', 'rest', 'night'],
  vitals: ['pulse', 'heart', 'oxygen', 'spo2', 'breathing'],
  urine: ['urine', 'kidney', 'stone', 'water'],
  exercise: ['exercise', 'bone', 'muscle', 'resistance', 'strength'],
  mood: ['mood', 'lonely', 'stress', 'mental', 'happy', 'morale'],
  basics: ['pressure', 'temperature', 'fever', 'sugar', 'basic'],
  immune: ['immune', 'white cells', 'lymphocytes', 'infection', 'rash'],
  vitd: ['vitamin', 'sunlight', 'supplement'],
  bodymass: ['mass', 'eating', 'food', 'appetite', 'nutrition'],
  co2: ['co2', 'air', 'cabin air', 'scrubber', 'stuffy'],
  radiation: ['radiation', 'dose', 'since launch', 'cosmic', 'msv', 'total'],
  doserate: ['radiation', 'solar', 'storm', 'shelter', 'dosimeter', 'dose rate', 'now'],
  balance: ['dizzy', 'dizziness', 'lightheaded', 'faint', 'balance', 'unsteady'],
  pain: ['pain', 'side', 'back', 'flank', 'kidney'],
}

function personOf(raw: string, ctx: AskContext): { persons: string[]; firstPerson: boolean; namedTokens: Set<string> } {
  const crew = USERS.filter((u) => u.role !== 'surgeon')
  const persons: string[] = []
  const namedTokens = new Set<string>()
  const words = raw.split(' ')
  const roleWord: Record<string, string> = { commander: 'C1', officer: 'C2', scientist: 'C3', engineer: 'C4' }
  for (const w of words) {
    const byRole = roleWord[w]
    // First or last name, with one typo allowed in longer words.
    const byName = crew.find((u) =>
      u.name
        .toLowerCase()
        .split(' ')
        .filter((n) => n.length > 2)
        .some((n) => w === n || (w.length >= 5 && distance(w, n) <= 1)),
    )
    const id = byRole ?? byName?.id
    if (id && !persons.includes(id)) persons.push(id)
    if (id) namedTokens.add(w)
    if (w === 'cabin' && !persons.includes(CABIN_ID)) persons.push(CABIN_ID)
  }
  const firstPerson = /\b(i|me|my|mine|myself|im|am i)\b/.test(raw.replace(/\b(tell|show|give|let|explain to|remind) me\b/g, ''))
  if (persons.length === 0 && ctx.last?.person && /\b(she|shes|her|hers|he|hes|him|his|they|them|their)\b/.test(raw)) persons.push(ctx.last.person)
  return { persons, firstPerson, namedTokens }
}

function buildEntries(ctx: AskContext): Entry[] {
  const { subjects, meId, mission, scenario } = ctx
  const list: Entry[] = []
  const nameOf = (id: string) => (id === meId ? 'you' : id === CABIN_ID ? 'the cabin' : (subjects.find((s) => s.id === id)?.name ?? id))
  const titleOf = new Map<string, string>()
  for (const s of subjects) for (const f of s.findings) titleOf.set(f.id, f.title)
  const sc = LIVE_SCENARIOS[scenario]
  const patient = sc.patientId ? subjects.find((s) => s.id === sc.patientId) : undefined
  const flagged = (s: Subject) => s.findings.filter((f) => f.level !== 'green')
  const worst = (fs: Finding[]): Level => (fs.some((f) => f.level === 'red') ? 'red' : fs.some((f) => f.level === 'amber') ? 'amber' : 'green')
  const findingSources = (f: Finding): Link[] =>
    dedupe([
      ...f.sourceIds.flatMap(src),
      ...(NASA_RISK[f.id] ? [{ label: `NASA risk: ${NASA_RISK[f.id].name}`, url: NASA_RISK[f.id].url }] : []),
      ...(NASA_STUDY[f.id] ? [{ label: `NASA study: ${NASA_STUDY[f.id].name}`, url: NASA_STUDY[f.id].url }] : []),
      ...(PARTNER_WORK[f.id] ? [{ label: `${PARTNER_WORK[f.id].agency}: ${PARTNER_WORK[f.id].name}`, url: PARTNER_WORK[f.id].url }] : []),
    ])
  const stepsTopic = (id: ScenarioId) => (id === 'normal' ? 'routine' : `steps:${id}`)

  // 1. Every signal of every crew member and of the cabin, live.
  for (const s of subjects) {
    for (const f of s.findings) {
      const who = nameOf(s.id)
      const isPatient = patient?.id === s.id && f.level !== 'green'
      list.push({
        topic: `signal:${s.id}:${f.id}`,
        family: `signal:${f.id}`,
        person: s.id,
        flagged: f.level !== 'green',
        keys: keyset(WORDS[f.id] ?? [], f.title.replace(/\brisk\b/gi, '')),
        serves: ['status', 'explain'],
        todo: isPatient ? stepsTopic(scenario) : `signal:${s.id}:${f.id}`,
        why: `signal:${s.id}:${f.id}`,
        build: () => ({
          topic: `signal:${s.id}:${f.id}`,
          person: s.id === CABIN_ID ? undefined : s.id,
          title: `${f.title}: ${s.id === meId ? 'yours' : s.name}`,
          lead: `${LEVEL_WORD[f.level]} for ${who}: ${f.measured}.`,
          lines: [
            f.why,
            `What to do: ${f.next}`,
            ...(GUIDE[f.id] ? [`What it is: ${GUIDE[f.id].what}`, `How it is measured: ${GUIDE[f.id].how}`] : []),
            ...(NASA_RISK[f.id] ? [`NASA lists it under the risk of ${NASA_RISK[f.id].name}.`] : []),
            ...(NASA_STUDY[f.id] ? [`NASA is studying it now: ${NASA_STUDY[f.id].name} (${NASA_STUDY[f.id].about}).`] : []),
            ...(isPatient ? [`This is part of the current scenario (${sc.name}). The steps are under Steps to fix on Live monitor.`] : []),
          ],
          sources: findingSources(f),
        }),
      })
    }
  }

  // 2. Each crew member as a whole.
  for (const s of subjects) {
    const bad = flagged(s)
    const level = worst(s.findings)
    const who = s.id === meId ? 'You' : s.id === CABIN_ID ? 'The cabin' : s.name
    const verb = s.id === meId ? 'are' : 'is'
    list.push({
      topic: `person:${s.id}`,
      family: 'person',
      person: s.id,
      keys: keyset(s.id === CABIN_ID ? ['cabin'] : []),
      serves: ['status'],
      todo: patient?.id === s.id && bad.length > 0 ? stepsTopic(scenario) : bad.length > 0 ? `person:${s.id}` : 'routine',
      why: bad[0] ? `signal:${s.id}:${bad[0].id}` : undefined,
      build: () => ({
        topic: `person:${s.id}`,
        person: s.id === CABIN_ID ? undefined : s.id,
        title: s.id === CABIN_ID ? 'The cabin now' : `${s.name}, ${s.role.replace(/\s*\(.*\)/, '').toLowerCase()}`,
        lead:
          level === 'green'
            ? `${who} ${verb} normal: all ${s.findings.length} signals are in range.`
            : `${who} ${level === 'red' ? `${verb} urgent` : `${s.id === meId ? 'need' : 'needs'} a check`}: ${bad.map((f) => lc(f.title)).join('; ')}.`,
        lines: [
          ...bad.map((f) => `${f.title} (${LEVEL_WORD[f.level].toLowerCase()}): ${f.measured}. ${f.next}`),
          ...(bad.length > 0 && bad.length < s.findings.length ? [`The other ${s.findings.length - bad.length} signals are normal.`] : []),
          ...(patient?.id === s.id && sc.id !== 'normal' && level !== 'green' ? [`This is the current scenario (${sc.name}). Follow Steps to fix on Live monitor.`] : []),
        ],
        sources: dedupe(bad.flatMap(findingSources)),
      }),
    })
  }

  // 3. The whole crew.
  list.push({
    topic: 'crew',
    family: 'crew',
    keys: keyset(['crew', 'everyone', 'everybody', 'anyone', 'team', 'all', 'attention', 'flagged', 'sick', 'overview', 'summary']),
    serves: ['overview', 'status'],
    todo: stepsTopic(scenario),
    build: () => {
      const people = subjects.filter((s) => s.id !== CABIN_ID)
      const needy = subjects.filter((s) => flagged(s).length > 0)
      return {
        topic: 'crew',
        title: 'The crew now',
        lead:
          needy.length === 0
            ? `Everyone is normal: all ${people.length} crew members and the cabin.`
            : `${needy.length === 1 ? `${needy[0].id === CABIN_ID ? 'The cabin' : needy[0].name} needs attention` : `${needy.length} need attention: ${needy.map((s) => (s.id === CABIN_ID ? 'the cabin' : s.name)).join(', ')}`}.`,
        lines: subjects.map((s) => {
          const bad = flagged(s)
          return `${s.id === CABIN_ID ? 'Cabin' : s.name}: ${LEVEL_WORD[worst(s.findings)].toLowerCase()}${bad.length > 0 ? ` (${bad.map((f) => lc(f.title)).join(', ')})` : ''}.`
        }),
        sources: [],
      }
    },
  })

  // 4. What is happening right now.
  list.push({
    topic: 'situation',
    family: 'situation',
    keys: keyset(['happening', 'situation', 'scenario', 'alert', 'problem', 'issue', 'emergency', 'wrong']),
    serves: ['situation'],
    todo: stepsTopic(scenario),
    why: sc.hazard ? `hazard:${sc.hazard}` : patient ? (flagged(patient)[0] ? `signal:${patient.id}:${flagged(patient)[0].id}` : `person:${patient.id}`) : undefined,
    build: () => {
      const fixed = isFixed(scenario, patient)
      const hz = sc.hazard ? HAZARD_INFO[sc.hazard] : undefined
      return {
        topic: 'situation',
        person: patient && patient.id !== CABIN_ID ? patient.id : undefined,
        title: `Right now: ${sc.name}`,
        lead: scenario === 'normal' ? 'Nothing is wrong: every astronaut and the cabin are normal.' : fixed && sc.fixedBanner ? `Fixed. ${sc.fixedBanner}` : sc.banner,
        lines: [
          ...(hz ? [`NASA hazard: ${hz.nasaName}. ${hz.line}`] : []),
          ...(scenario !== 'normal' && !fixed ? [`What to do: ${CARE_STEPS[scenario].slice(0, 3).map((x) => lc(x.title)).join('; ')}. All the steps are under Steps to fix on Live monitor.`] : []),
          ...(scenario === 'normal' ? ['Keep the routine going: ' + ROUTINE.map(lc).join(' ')] : []),
        ],
        sources: hz ? [{ label: `NASA hazard: ${hz.nasaName}`, url: hz.url }] : [],
      }
    },
  })

  // 5. The steps for each scenario, and the routine when nothing is wrong.
  const STEP_WORDS: Partial<Record<ScenarioId, string[]>> = {
    flagged: ['fever', 'temperature', 'headache', 'pill', 'medicine', 'sick', 'cold', 'flu'],
    emergency: ['clot', 'neck', 'vein', 'jugular', 'swelling', 'emergency'],
    radiation: ['solar', 'storm', 'radiation', 'shelter', 'particle', 'dosimeter', 'spacewalk', 'proton'],
    isolation: ['isolation', 'confinement', 'lonely', 'mood', 'stress', 'sleep', 'tired', 'private', 'call', 'family', 'journal', 'morale'],
    distance: ['earth', 'contact', 'reach', 'conjunction', 'behind', 'alone', 'kidney', 'stone', 'side', 'pain', 'urine', 'delay', 'help', 'autonomy'],
    gravity: ['landing', 'land', 'dizzy', 'dizziness', 'lightheaded', 'faint', 'gravity', 'moon', 'balance', 'stand', 'orthostatic', 'pilot'],
    co2: ['co2', 'scrubber', 'air', 'stuffy', 'headache', 'fan', 'breathe'],
  }
  for (const id of SCENARIO_ORDER) {
    if (id === 'normal') continue
    const s = LIVE_SCENARIOS[id]
    const steps = CARE_STEPS[id]
    list.push({
      topic: `steps:${id}`,
      family: `steps:${id}`,
      keys: keyset(STEP_WORDS[id] ?? [], s.name, s.hazard ?? ''),
      serves: ['todo'],
      todo: `steps:${id}`,
      why: s.hazard ? `hazard:${s.hazard}` : undefined,
      build: () => ({
        topic: `steps:${id}`,
        person: s.patientId && s.patientId !== CABIN_ID && id === scenario ? s.patientId : undefined,
        title: `What to do: ${s.name.toLowerCase()}`,
        lead: `${s.problem ?? s.name}. Start with: ${lc(steps[0].title)}.`,
        lines: [
          ...steps.map((x, i) => `${i + 1}. ${x.title}. ${firstSentence(x.detail)}`),
          id === scenario ? 'This is happening now: tick the steps off under Steps to fix on Live monitor.' : `To practise it, pick "${s.name}" in the Scenario menu.`,
        ],
        sources: dedupe([
          ...steps.flatMap((x) => (x.source === undefined ? [] : Array.isArray(x.source) ? x.source : [x.source]).map(link)),
          ...(s.hazard ? [{ label: `NASA hazard: ${HAZARD_INFO[s.hazard].nasaName}`, url: HAZARD_INFO[s.hazard].url }] : []),
        ]),
      }),
    })
  }
  list.push({
    topic: 'routine',
    family: 'routine',
    keys: keyset(['routine', 'daily', 'every day', 'habit', 'prevent', 'stay healthy']),
    serves: ['todo'],
    build: () => ({
      topic: 'routine',
      title: 'The daily routine',
      lead: scenario === 'normal' ? 'Nothing needs fixing right now. Keep the routine going.' : 'The daily routine that keeps the crew well:',
      lines: [...ROUTINE, 'Wear the wearable: heart rate, oxygen and temperature arrive by themselves.'],
      sources: [...src('URINE_TARGET'), ...src('BONE_LOSS')],
    }),
  })

  // 6. The timed emergency walkthroughs.
  for (const e of SCENARIOS) {
    list.push({
      topic: `emergency:${e.id}`,
      family: `emergency:${e.id}`,
      keys: keyset(e.title, e.summary, ['emergency', 'walkthrough'], e.id === 'collapse' ? ['collapse', 'breathing', 'resuscitation', 'heart attack', 'defibrillator', 'compressions'] : []),
      serves: ['todo'],
      build: () => ({
        topic: `emergency:${e.id}`,
        title: `Emergency steps: ${e.title}`,
        lead: `${e.summary} Start with: ${lc(e.steps[0].title)}.`,
        lines: [...e.steps.map((st, i) => `${i + 1}. ${st.title}. ${firstSentence(st.detail)}`), 'Press Emergency at the top for the timed walkthrough.'],
        sources: dedupe(e.steps.flatMap((st) => (st.source ? [link(st.source)] : []))),
      }),
    })
  }

  // 7. NASA's five hazards.
  for (const h of Object.keys(HAZARD_INFO) as Hazard[]) {
    const info = HAZARD_INFO[h]
    const sid = SCENARIO_OF[h]
    const signals = Object.entries(GUIDE).filter(([, g]) => g.hazard === h).map(([id]) => titleOf.get(id)).filter((t): t is string => Boolean(t))
    const risks = [...new Set(Object.entries(GUIDE).filter(([id, g]) => g.hazard === h && NASA_RISK[id]).map(([id]) => NASA_RISK[id].name))]
    const extra: Record<Hazard, string[]> = {
      'Space radiation': ['radiation', 'cosmic', 'solar', 'particle', 'cancer', 'neutron'],
      'Isolation and confinement': ['isolation', 'confinement', 'lonely', 'small', 'space', 'mood', 'behavior', 'mental'],
      'Distance from Earth': ['distance', 'far', 'delay', 'earth', 'self sufficient', 'autonomy', 'supplies'],
      'Gravity changes': ['gravity', 'weightless', 'weightlessness', 'microgravity', 'zero g', 'gravity field', 'float', 'adapt', 'change'],
      'Closed environment': ['closed', 'hostile', 'environment', 'habitat', 'air', 'microbe', 'noise', 'temperature', 'spacecraft'],
    }
    list.push({
      topic: `hazard:${h}`,
      family: `hazard:${h}`,
      keys: keyset(extra[h], info.nasaName, ['hazard', 'danger']),
      serves: ['explain'],
      todo: `steps:${sid}`,
      why: `hazard:${h}`,
      build: () => ({
        topic: `hazard:${h}`,
        title: `NASA hazard: ${info.nasaName}`,
        lead: info.line,
        lines: [
          ...(signals.length > 0 ? [`What this app watches for it: ${signals.map(lc).join(', ')}.`] : []),
          ...(risks.length > 0 ? [`NASA risks linked to it: ${risks.join('; ')}.`] : []),
          `See it happen: pick "${LIVE_SCENARIOS[sid].name}" in the Scenario menu.`,
        ],
        sources: dedupe([{ label: `NASA hazard: ${info.nasaName}`, url: info.url }, ...(SCENARIO_CONTEXT[sid] ?? []).flatMap(src)]),
      }),
    })
  }
  list.push({
    topic: 'hazards',
    family: 'hazards',
    keys: keyset(['hazard', 'five', 'danger', 'threat', 'dangerous', 'space travel', 'spaceflight']),
    serves: ['explain'],
    build: () => ({
      topic: 'hazards',
      title: "NASA's five hazards of human spaceflight",
      lead: 'NASA groups the dangers of human spaceflight into five hazards: space radiation, isolation and confinement, distance from Earth, gravity fields, and hostile and closed environments.',
      lines: (Object.keys(HAZARD_INFO) as Hazard[]).map((h) => `${HAZARD_INFO[h].nasaName}: ${HAZARD_INFO[h].line}`),
      sources: src('HAZARDS'),
    }),
  })
  list.push({
    topic: 'risks',
    family: 'risks',
    keys: keyset(['risk', 'list', 'seventeen', '17', 'human research program', 'hrp']),
    serves: ['explain'],
    build: () => ({
      topic: 'risks',
      title: "NASA's risks of human spaceflight",
      lead: "NASA's Human Research Program lists 17 risks in three groups: 11 about the body, 5 about behavior and teamwork, and 1 about radiation.",
      lines: [
        `This app links its signals to: ${[...new Set(Object.values(NASA_RISK).map((r) => r.name))].join('; ')}.`,
        'Not covered by a signal here: decompression sickness, low oxygen (hypoxia), microbes, spacewalk injuries, landing injuries, fitness, teamwork and systems support.',
      ],
      sources: [RISKS_PAGE],
    }),
  })
  list.push({
    topic: 'research',
    family: 'research',
    keys: keyset(['research', 'study', 'studies', 'experiment', 'ongoing', 'archer', 'cipher', 'thigh cuff', 'venous', 'haemostasis', 'hemostasis', 'zero t2', 'biomarker', 'piloting']),
    serves: ['explain'],
    build: () => ({
      topic: 'research',
      title: 'What NASA is studying now',
      lead: 'NASA lists 13 ongoing studies on its Human Research Program page. This app points to the ones closest to its signals:',
      lines: Object.values(NASA_STUDY)
        .filter((s, i, all) => all.findIndex((x) => x.name === s.name) === i)
        .map((s) => `${s.name}: ${s.about}.`),
      sources: [RESEARCH_PAGE],
    }),
  })

  // 8. Facts from NASA, CSA and the rule sources.
  const m = MISSIONS[mission]
  const delay = linkDelay(mission, ctx.day)
  const fact = (topic: string, keys: string[], title: string, lead: string, lines: string[], sources: Link[], todo?: string) =>
    list.push({ topic: `fact:${topic}`, family: `fact:${topic}`, keys: keyset(keys), serves: ['explain'], todo, why: `fact:${topic}`, build: () => ({ topic: `fact:${topic}`, title, lead, lines, sources: dedupe(sources) }) })

  fact('bone', ['bone', 'density', 'osteoporosis', 'calcium', 'fracture', 'mineral', 'loss', 'skeleton'], 'Bones in space',
    'In weightlessness, weight-bearing bones lose 1% to 1.5% of their mineral density every month.',
    ['That is why crews do resistance exercise most days. This app expects 5 or more sessions a week.', 'The lost calcium leaves through the urine, which raises the risk of kidney stones.'],
    [...src('HRP_GRAVITY'), ...src('BONE_LOSS')], 'routine')
  fact('sans', ['sans', 'eye', 'vision', 'optic', 'swelling', 'glasses', 'pressure', 'brain'], 'Eyes in space (SANS)',
    'About 70 percent of station astronauts get some swelling at the back of the eye. NASA calls it SANS, spaceflight associated neuro-ocular syndrome.',
    ['Fluid moving toward the head is the leading explanation.', 'This app watches the optic nerve sheath on the eye ultrasound.', 'NASA is testing tight thigh cuffs that keep fluid in the legs, and a daily B vitamin.'],
    [{ label: `NASA risk: ${NASA_RISK.onsd.name}`, url: NASA_RISK.onsd.url }, ...src('ONSD_REVIEW'), { label: 'NASA study: Thigh Cuff', url: NASA_STUDY.onsd.url }, RESEARCH_PAGE])
  fact('fluid', ['fluid', 'shift', 'puffy', 'face', 'legs', 'liter', 'litre', 'head'], 'Fluid shift',
    'When astronauts reach weightlessness, about 2 litres of fluid move from the legs toward the head.',
    ['It gives a full, puffy face, and is linked to the eye changes (SANS) and slow blood flow in the neck veins.', 'Back in gravity, the fluid moves down again, and many astronauts feel faint when they stand.'],
    [...src('ORTHO_NASA'), ...src('IJV_STUDY')])
  fact('orthostatic', ['faint', 'dizzy', 'dizziness', 'lightheaded', 'orthostatic', 'landing', 'return', 'stand', 'pass out', 'pilot'], 'Feeling faint after landing',
    'Back in gravity, more than 60% of astronauts can feel faint on standing if no countermeasures are used, and women more often.',
    ['NASA countermeasures: fluid loading before landing, and compression garments worn for up to several days after.', 'Gravity changes also upset balance and coordination, so no piloting or driving until it passes.'],
    [...src('ORTHO_NASA'), ...src('ORTHO_COUNTER'), ...src('SENSORIMOTOR'), ...src('PILOTING')], 'steps:gravity')
  fact('mars', ['mars', 'far', 'distance', 'mile', 'trip', 'journey', 'travel', 'year'], 'How far Mars is',
    'Mars is on average 140 million miles from Earth. A Mars mission would take about three years, against three days to reach the Moon.',
    ['Messages take up to 20 minutes each way, so the crew has to act on its own first.'],
    src('HRP_DISTANCE'), 'steps:distance')
  fact('conjunction', ['conjunction', 'behind', 'solar conjunction', 'no contact', 'lose contact', 'silence'], 'When Mars is behind the Sun',
    'Every two years Mars passes behind the Sun as seen from Earth, and NASA stops sending commands to its Mars spacecraft for about two weeks.',
    ['Pending data is sent once contact returns. A crew on the way to Mars would have to manage on its own during that time.'],
    src('MARS_CONJUNCTION'), 'steps:distance')
  fact('neutron', ['neutron', 'csa', 'canada', 'canadian', 'agency', 'bubble', 'detector', 'cans', 'spectrometer', 'saint jacques'], 'Neutrons and Canadian radiation monitors',
    'Neutrons make up about 30% of the radiation on the space station.',
    ['Canada measured them with bubble detectors, used by astronaut David Saint-Jacques, and other station experiments.', 'The Canadian Space Agency is now developing CANS, a compact neutron spectrometer that measures on its own.'],
    src('CSA_RADIATION'))
  fact('dose', ['dose', 'msv', 'sievert', 'limit', 'career', 'how much radiation', 'exposure', 'cancer'], 'Radiation dose',
    `In this setting (${m.name}) the crew gets about ${m.radiationMSvDay} mSv of radiation a day. NASA's career limit is 600 mSv.`,
    ['Outside Earth\'s magnetic field the dose is much higher than on Earth. Radiation raises cancer risk over a lifetime.', 'The cabin radiation monitor shows the dose since launch and the dose rate right now.'],
    [...src(m.radSourceId), ...src('RAD_LIMIT'), ...src('HRP_RADIATION')], 'steps:radiation')
  fact('shelter', ['shelter', 'storm', 'protect', 'artemis', 'orion', 'stowage', 'solar'], 'The storm shelter',
    'During a solar storm the crew builds a shelter: they move stowed equipment against the least shielded wall to add mass around them.',
    ['On Artemis I the best-shielded spot got about a quarter of the dose of the least shielded one.', 'NASA sets a caution level and a higher level at which it recommends the crew take shelter.', 'A storm can last from hours to days, and the crew stays sheltered until the dose rate falls.'],
    [...src('ARTEMIS_SHELTER'), ...src('ARTEMIS1_SHELTER')], 'steps:radiation')
  fact('co2', ['co2', 'air', 'limit', 'scrubber', 'symptom', 'mmhg', 'stuffy', 'breathe', 'headache'], 'Cabin CO2',
    'NASA keeps the 24-hour average CO2 at or below 3 mmHg. Under 2.5 mmHg over a week keeps the risk of headaches under 1%.',
    ['From about 2.8 to 4.5 mmHg crews report headaches, tiredness and flushing; above 4.5, also poor sleep and nausea.', 'Hard exercise makes a person breathe out about seven times more CO2.', 'On the station the main scrubber has a second system and lithium hydroxide canisters as backups.'],
    src('CO2_LIMIT'), 'steps:co2')
  const co2Now = subjects.find((x) => x.id === CABIN_ID)?.findings.find((f) => f.id === 'co2')?.measured
  fact('headache', ['headache', 'head', 'migraine', 'head pain'], 'Headaches in space',
    'Headaches are common in space. In a sealed cabin, CO2 from breathing can build up and cause them: on the station, each extra 1 mmHg of CO2 doubled the odds of a headache.',
    [...(co2Now ? [`Cabin CO2 right now: ${co2Now}. Above 2.5 mmHg, CO2 is the likely cause.`] : []), 'Also think of short sleep, too little water, and the fluid shift toward the head.', 'Log it in your check-in. If it is sudden and severe, or comes with vision changes, tell the medical officer at once.'],
    [...src('CO2_HEADACHE'), ...src('CO2_LIMIT')], 'steps:co2')
  fact('sleep', ['sleep', 'sunrise', 'sunset', 'light', 'led', 'clock', 'circadian', 'night', 'tired'], 'Sleep in space',
    'On the station the crew sees 16 sunrises and sunsets a day, which upsets sleep.',
    ['Station LEDs copy Earth\'s day and night to help crews sleep, and schedules include set time for rest and self-care.', 'Light in the right amount at the right time keeps the body clock in line.', 'This app flags a weekly average under 6 hours.'],
    [...src('SLEEP_RISK'), ...src('HRP_ISOLATION')], 'steps:isolation')
  fact('mood', ['mood', 'lonely', 'stress', 'mental', 'morale', 'journal', 'family', 'psychology', 'homesick'], 'Mood and mental health',
    'Months in a small space far from home can lower mood, sleep and teamwork.',
    ['NASA encourages a regular journal, and crews can talk with family and medical professionals for support.', 'Windows and growing plants help against monotony and the feeling of being shut in.', 'If someone\'s mood keeps falling, or you are worried about their safety, contact Earth\'s medical team at once.'],
    [...src('BEHAVIOR_RISK'), ...src('HRP_ISOLATION')], 'steps:isolation')
  fact('analog', ['hera', 'chapea', 'analog', 'habitat', 'simulation', 'earth based'], 'Practising isolation on Earth',
    'NASA studies isolation on Earth in analogs: HERA is a 650-square-foot habitat where crews stay 45 days, and CHAPEA houses four people in 1,700 square feet for year-long simulated Mars stays.',
    [], src('HRP_ISOLATION'))
  fact('science', ['science', 'experiment', 'why space', 'aging', 'ageing', 'benefit', 'iss', 'station', 'csa', 'canada', 'agency', 'body', 'change', 'adapt'], 'Why do science in space',
    'Weightlessness changes the body in ways that look like faster aging, so research in orbit helps both future missions and health on Earth.',
    ['About 200 experiments run on the station at any time, and six months in orbit give data that would take years on Earth.', 'Moon and Mars missions add more weightlessness, more radiation, longer isolation, delays and less help from Earth.'],
    src('CSA_WHY'))
  fact('kidney', ['kidney', 'stone', 'urine', 'calcium', 'water', 'side', 'flank'], 'Kidney stones in space',
    'Kidney stones are more likely in space: bones release calcium into the urine, and crews often drink too little.',
    ['NASA\'s target is at least 2 litres of urine a day.', 'With side pain, fever, vomiting or no urine at all can mean the kidney is blocked or infected: open Emergency mode.'],
    [...src('HRP_GRAVITY'), ...src('URINE_TARGET'), ...src('URINE_RISK')], 'steps:distance')
  fact('gravity', ['gravity', 'moon', 'mars', 'sixth', 'weight', 'weightless', 'microgravity', 'g'], 'Gravity on the Moon and Mars',
    'The Moon has about one sixth of Earth\'s gravity and Mars about three eighths.',
    ['A trip to Mars means about six months of weightlessness, then up to two years in Mars gravity, then readapting to Earth.', 'Each change upsets balance, blood pressure and coordination for a while.'],
    [...src('HAZARDS'), ...src('HRP_GRAVITY')], 'steps:gravity')
  fact('immune', ['immune', 'infection', 'virus', 'white cells', 'rash', 'cold', 'germs', 'microbe'], 'The immune system in space',
    'Spaceflight stress can change the immune system and wake viruses that were lying dormant in the body.',
    ['Microbes spread more easily between people in a closed habitat.', 'This app watches white cells and lymphocytes from the blood analyser.'],
    [{ label: `NASA risk: ${NASA_RISK.immune.name}`, url: NASA_RISK.immune.url }, ...src('IMMUNE_WBC'), ...src('HRP_CLOSED')])
  fact('food', ['food', 'eat', 'nutrition', 'diet', 'meal', 'menu', 'vitamin', 'mass', 'appetite'], 'Food in space',
    'Food is limited to what was packed, so meals have to be nutritious and appealing. Falling body mass is an early sign of eating too little.',
    ['Without sunlight the skin makes no vitamin D, so it has to come from food and supplements.'],
    [{ label: `NASA risk: ${NASA_RISK.bodymass.name}`, url: NASA_RISK.bodymass.url }, ...src('VITD_FLIGHT')])
  fact('medicine', ['medicine', 'pill', 'drug', 'kit', 'dose', 'allergy'], 'Medicines on board',
    'Pain relievers are among the medicines ISS crews use most. Use the dose on the kit label, and the medical officer checks allergies and other medicines first.',
    ['Do not start a new medicine for a serious problem without the flight surgeon, unless an emergency walkthrough says so.'],
    [MEDS_ISS])
  fact('exercise', ['exercise', 'muscle', 'strength', 'treadmill', 'resistance', 'fitness', 'ared'], 'Exercise in space',
    'Bones and muscles weaken when they carry no load, so crews exercise most days. This app expects 5 or more resistance sessions a week.',
    ['NASA\'s Zero T2 study looks at exercising without a treadmill before deep-space missions.'],
    [...src('BONE_LOSS'), { label: 'NASA study: Zero T2', url: NASA_STUDY.exercise.url }], 'routine')
  fact('heart', ['heart', 'cardiovascular', 'circulation', 'pressure', 'pulse', 'blood vessel'], 'The heart and blood in space',
    'Weightlessness changes circulation and how the heart and blood vessels work.',
    ['About 2 litres of fluid shift toward the head, blood flow in the neck veins can slow or even stall, and back in gravity many astronauts feel faint.'],
    [{ label: `NASA risk: ${NASA_RISK.vitals.name}`, url: NASA_RISK.vitals.url }, ...src('ORTHO_NASA'), ...src('IJV_STUDY')])

  // 9. The app itself.
  const app = (topic: string, keys: string[], title: string, lead: string, lines: string[], sources: Link[] = []) =>
    list.push({ topic: `app:${topic}`, family: `app:${topic}`, keys: keyset(keys), serves: ['explain'], build: () => ({ topic: `app:${topic}`, title, lead, lines, sources }) })

  app('install', ['install', 'homescreen', 'download', 'iphone', 'android', 'phone app'], 'Putting SOMA on a phone',
    'SOMA can sit on your phone like an app, with its own icon.',
    ['iPhone: open the SOMA link in Safari, tap Share, then Add to Home Screen.', 'Android: open the link in Chrome, tap the menu, then Install app (or Add to Home screen).', 'Computer: in Chrome or Edge, click the install icon in the address bar.', 'Once it has been opened, it also starts without a connection.'])
  app('soma', ['soma', 'acronym'], 'About SOMA',
    'SOMA stands for Spaceflight Organ Monitoring Application.',
    ['It watches the health of a crew far from Earth: live readings, the body and its organs, what to do next, and contact with the flight surgeon.', 'It runs on board and keeps working without a connection to Earth.'])
  app('pages', ['page', 'tab', 'app', 'menu', 'navigate', 'livemonitor', 'contacthome', 'ask', 'surgeon', 'use'], 'The pages in this app',
    'The app has four pages: Live monitor, Contact home, Ask and Flight surgeon.',
    ['Live monitor: every crew member\'s health right now, the 3D body, live trends and the steps to fix a problem.', 'Contact home: messages and health reports to Earth, with the real signal delay.', 'Ask: questions about the crew, readings, NASA\'s hazards and what to do.', 'Flight surgeon: plan a 90-minute blackout with the flight surgeon, then follow the next step while there is no contact.'])
  app('earth', ['earth', 'contacthome', 'message', 'send', 'reply', 'delay', 'wait', 'answer', 'surgeon', 'doctor', 'talk', 'call', 'long'], 'Talking to Earth',
    LIVE_SCENARIOS[scenario].blackout ? 'There is no contact with Earth right now: Mars is behind the Sun for about two weeks.' : `A message takes ${delay.text} to reach Earth in this setting (${m.name}), and the same again for the answer.`,
    ['Use Contact home to write to Earth or send a health report.', m.note, 'In an emergency, act first and report after.'],
    [...(m.delaySource.url ? [{ label: m.delaySource.label, url: m.delaySource.url }] : []), ...src('HRP_DISTANCE')])
  app('blackout', ['blackout', 'plan', 'planned', 'preplan', 'coordinate', 'signal', 'lose signal', 'no signal', 'cut off', 'minute', 'minutes', 'surgeon', 'during', 'next', 'offline'], 'Planning a blackout',
    'Sometimes there is no contact with Earth for 90 minutes. On the Flight surgeon page, plan it with the flight surgeon first, then follow it step by step.',
    ['1. Plan: the app makes a plan from how the crew is right now. Add a question, send it, and the flight surgeon approves it and can add instructions.', '2. Blackout: the page shows the one step to do now, what to do if something happens, and a log. Nothing can be sent or received until contact returns.', '3. Report: when contact is back, send the report so the flight surgeon knows what happened.', 'If someone collapses or cannot breathe, open Emergency mode at once. Do not wait for Earth.'])
  app('checkin', ['checkin', 'log', 'record', 'enter', 'measure', 'form', 'add'], 'Logging a check-in',
    'Press "Log check-in" at the top to record blood pressure, symptoms, urine, mood and exams for any crew member.',
    ['The wearable keeps sending heart rate, oxygen and temperature by itself.', 'A check-in replaces the exam values for today, and the medical officer can clear check-ins.'])
  app('emergencymode', ['emergency', 'mode', 'button', 'timed', 'walkthrough', 'red button'], 'Emergency mode',
    'Press the red Emergency button at the top for timed, step-by-step help.',
    ['It suggests the walkthrough that fits the readings, times each step, and saves the record and sends it to Earth.'])
  app('scenarios', ['scenario', 'demo', 'simulate', 'play', 'switch', 'situation', 'menu'], 'Scenarios',
    'Pick a situation in the Scenario menu at the top: three about crew health and one for each of NASA\'s five hazards.',
    SCENARIO_ORDER.map((id) => `${LIVE_SCENARIOS[id].name}: ${LIVE_SCENARIOS[id].summary}`))
  app('privacy', ['private', 'privacy', 'access', 'share', 'visible'], 'Who can see health data',
    "Everyone on board can see the whole crew's health. The flight surgeon on Earth sees only what the crew sends.", [])
  app('real', ['real', 'simulated', 'fake', 'true', 'trust', 'actual', 'made up', 'data'], 'Is this data real?',
    'The crew and their readings are made up for this prototype. The rules, numbers and advice come from published NASA, CSA and medical sources, linked under each answer.', [])
  app('rules', ['rule', 'threshold', 'limit', 'baseline', 'flag', 'alarm', 'range', 'colour', 'red', 'chip', 'meaning'], 'How the app decides what is normal',
    'Each reading is compared with the person\'s own pre-flight value and with what is known from past missions, because some changes are expected in space.',
    ['Blood pressure, temperature and blood sugar use ordinary Earth limits.', 'Green means normal, yellow means check it, red means urgent.'])
  app('about', ['ask', 'guide', 'ai', 'smart', 'chatbot', 'bot', 'internet', 'offline', 'work'], 'About Ask',
    'I answer from the crew\'s live readings, the scenario being played, and a guide built from NASA and Canadian Space Agency pages. I work without a connection to Earth.',
    ['Each answer links to where it comes from. If I do not know something, I say so instead of guessing.'])

  return list
}

// ---------------------------------------------------------------------------------------------
// Answering

/** Rule texts written for the screen can carry "(demo)" markers; the guide speaks plainly. */
const clean = (t: string) => t.replace(/\s*\((demo|demo only|demo wording|demo parameter|demo value|demo limit)\)/gi, '').replace(/\s{2,}/g, ' ')
const tidy = (a: Answer): Answer => ({ ...a, lead: clean(a.lead), lines: a.lines.map(clean) })

const greet = (meId: string): Answer => ({
  topic: 'greet',
  title: 'Hello',
  lead: `Hi${USERS.find((u) => u.id === meId) ? ` ${USERS.find((u) => u.id === meId)!.name}` : ''}! Ask me about the crew, a reading, NASA's space hazards or what to do.`,
  lines: ['For example: "How is the crew?", "What should we do now?" or "Why do astronauts get dizzy after landing?"'],
  sources: [],
})

function unknown(near: Answer[]): Answer {
  return {
    topic: 'unknown',
    title: "I don't have that",
    lead: "I couldn't find that in the onboard guide, so I won't guess.",
    lines: [
      ...(near.length > 0 ? [`Did you mean: ${near.map((a) => a.title.toLowerCase()).join('; ')}?`] : []),
      'I can answer about a crew member ("How is Roya Alizadeh?"), a reading ("Is my oxygen normal?"), a NASA hazard ("What is space radiation?") or what to do ("What should we do now?").',
      'For anything else, ask the medical officer or write to Earth in Contact home.',
    ],
    sources: [],
  }
}

/** Answers for a question: the best one or two. Always returns at least one answer. */
export function ask(question: string, ctx: AskContext): Answer[] {
  const raw = normalize(question)
  if (!raw) return [unknown([])]
  const entries = buildEntries(ctx)
  const byTopic = new Map(entries.map((e) => [e.topic, e]))
  const intents = new Set(INTENTS.filter(([, re]) => re.test(raw)).map(([i]) => i))
  const { persons: named, firstPerson, namedTokens } = personOf(raw, ctx)
  let persons = named

  // Vocabulary of everything the guide knows, for spelling mistakes.
  const vocab = new Set(entries.flatMap((e) => [...e.keys]))
  const canon = (w: string): string => {
    const s = stem(SYNONYMS[w] ?? w)
    if (vocab.has(s) || s.length < 5) return s
    let best = s
    let bestD = 9
    for (const v of vocab) {
      if (Math.abs(v.length - s.length) > 2 || v[0] !== s[0]) continue
      const d = distance(s, v)
      if (d < bestD) {
        best = v
        bestD = d
      }
    }
    return bestD <= (s.length >= 8 ? 2 : 1) ? best : s
  }
  const words = [...new Set(raw.split(' ').filter((w) => w.length > 1 && !STOP.has(w) && !namedTokens.has(w)).map(canon))].filter((w) => w !== 'cabin' || !persons.includes(CABIN_ID))
  const topical = words.filter((w) => !GENERIC.has(w))

  const build = (topic: string | undefined): Answer[] => {
    const e = topic ? byTopic.get(topic) : undefined
    return e ? [tidy(e.build())] : []
  }
  const sc = LIVE_SCENARIOS[ctx.scenario]
  const current = ctx.scenario === 'normal' ? 'routine' : `steps:${ctx.scenario}`
  const patientId = sc.patientId && sc.patientId !== CABIN_ID ? sc.patientId : undefined

  if ((intents.has('greet') || intents.has('thanks')) && topical.length === 0 && persons.length === 0) {
    return intents.has('thanks') ? [{ topic: 'thanks', title: "You're welcome", lead: "You're welcome. Ask again any time.", lines: [], sources: [] }] : [greet(ctx.meId)]
  }

  if (intents.has('help') && topical.length === 0 && persons.length === 0) return [greet(ctx.meId), ...build('app:about')]

  // Follow-ups with no new topic: "why?", "what should we do?", "and her?".
  if (topical.length === 0 && persons.length === 0 && ctx.last?.topic && !intents.has('overview') && !intents.has('situation')) {
    const last = byTopic.get(ctx.last.topic)
    if (last && intents.has('todo') && last.todo) return build(last.todo)
    if (last && intents.has('explain') && last.why) return build(last.why)
  }
  if (topical.length === 0 && persons.length === 0 && intents.has('explain') && !ctx.last?.topic && ctx.scenario !== 'normal' && /\bwhy\b/.test(raw)) {
    return build(sc.hazard ? `hazard:${sc.hazard}` : (byTopic.get('situation')?.why ?? 'situation'))
  }

  if (intents.has('overview') && persons.length === 0 && topical.length <= 1) return build('crew')
  if (intents.has('situation') && persons.length === 0 && topical.filter((w) => !['scenario', 'situation', 'problem', 'issue', 'alert', 'happen'].includes(w)).length === 0) return build('situation')
  if (intents.has('todo') && topical.length === 0 && persons.length === 0) return build(current)
  if (persons.length === 0 && firstPerson && topical.length === 0 && (intents.has('status') || intents.has('explain'))) persons = [ctx.meId]

  // A person with no topic: how they are, or what to do for them.
  if (persons.length > 0 && topical.length === 0) {
    if (intents.has('todo')) return build(byTopic.get(`person:${persons[0]}`)?.todo)
    if (intents.has('who') && persons[0] !== CABIN_ID) {
      const u = USERS.find((x) => x.id === persons[0])
      return build(`person:${persons[0]}`).map((a) => ({ ...a, lead: `${u?.name ?? ''} is the ${(u?.title ?? '').toLowerCase()}${persons[0] === ctx.meId ? ' (that is you)' : ''}. ${a.lead}` }))
    }
    return persons.slice(0, 2).flatMap((p) => build(`person:${p}`))
  }

  // "Who has a headache?": everyone whose matching signal needs attention.
  if (intents.has('who') && persons.length === 0 && topical.length > 0) {
    const fam = new Map<string, { title: string; who: string[]; all: number }>()
    for (const e of entries) {
      if (!e.topic.startsWith('signal:') || !topical.some((w) => e.keys.has(w))) continue
      const [, sid, fid] = e.topic.split(':')
      const s = ctx.subjects.find((x) => x.id === sid)
      const f = s?.findings.find((x) => x.id === fid)
      if (!s || !f) continue
      const row = fam.get(fid) ?? { title: f.title, who: [], all: 0 }
      row.all++
      if (f.level !== 'green') row.who.push(s.id === CABIN_ID ? 'the cabin' : s.name)
      fam.set(fid, row)
    }
    const rows = [...fam.values()]
    const symptom = Object.entries(WORDS).find(([id]) => ['headache', 'balance', 'pain'].includes(id) && !fam.has(id) && topical.some((w) => keyset(WORDS[id]).has(w)))
    if (rows.length === 0 && symptom) {
      return [{ topic: 'who', title: `Who: ${topical.join(' ')}`, lead: `Nobody has reported ${symptom[0] === 'balance' ? 'dizziness' : symptom[0] === 'pain' ? 'side pain' : 'a headache'} right now.`, lines: [], sources: [] }]
    }
    if (rows.length > 0) {
      const hit = rows.filter((r) => r.who.length > 0)
      return [
        {
          topic: 'who',
          title: `Who: ${topical.join(' ')}`,
          lead: hit.length === 0 ? `Nobody right now: ${rows.map((r) => lc(r.title)).join(', ')} ${rows.length === 1 ? 'is' : 'are'} normal for everyone.` : hit.map((r) => `${r.title}: ${r.who.join(', ')}.`).join(' '),
          lines: hit.length > 0 ? ['Ask "How is <name>?" for the details and what to do.'] : [],
          sources: [],
        },
      ]
    }
  }

  // Score every entry. Rare words count more than common ones.
  const families = new Map<string, Set<string>>()
  for (const e of entries) {
    const f = families.get(e.family) ?? new Set<string>()
    for (const k of e.keys) f.add(k)
    families.set(e.family, f)
  }
  const df = new Map<string, number>()
  for (const keys of families.values()) for (const k of keys) df.set(k, (df.get(k) ?? 0) + 1)
  const F = families.size
  const idf = (w: string) => 1 + Math.log(F / (df.get(w) ?? F))

  const scored = entries
    .map((e) => {
      let score = 0
      for (const w of topical) if (e.keys.has(w)) score += idf(w)
      if (score === 0) return { e, score }
      if (e.person) {
        if (persons.length > 0) score = persons.includes(e.person) ? score + 2 : -1
        else if (e.person === CABIN_ID) score += 0
        else if (e.person === patientId && e.flagged && !firstPerson) score += 1.2
        else if (e.person === ctx.meId) score += firstPerson ? 1.5 : 0.6
        else score -= 0.8
      } else if (persons.length > 0 && e.topic.startsWith('signal:')) score -= 1
      if (e.serves?.some((i) => intents.has(i))) score += 0.8
      if (intents.has('todo') && e.topic.startsWith('steps:') && e.topic === current) score += 1
      if (!intents.has('todo') && e.topic.startsWith('steps:') && e.topic !== current) score -= 0.5
      // "What is ...?" and "why ...?" without "my": explanations before someone's reading.
      const explaining = intents.has('explain') && !intents.has('status') && !firstPerson && persons.length === 0
      if (explaining && e.topic.startsWith('signal:')) score -= 0.6
      if (explaining && /^(fact|hazard|hazards|risks|research):/.test(e.topic + ':')) score += 0.4
      // "I feel ...": support and what to do, next to their own reading.
      if (intents.has('feel') && e.topic.startsWith('fact:')) score += 1
      return { e, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  const outside = topical.filter((w) => !vocab.has(w) && w.length >= 4)
  const matched = scored.length > 0 ? topical.filter((w) => scored[0].e.keys.has(w)).length : 0
  if (scored.length === 0 || scored[0].score < 1.2 || (outside.length > 0 && topical.length >= 2 && matched <= topical.length / 2)) return [unknown(scored.slice(0, 3).map((x) => x.e.build()))]
  const top = scored[0].score
  const picked: Entry[] = []
  for (const x of scored) {
    if (x.score < top * 0.8 || picked.length >= 2) break
    if (picked.some((p) => p.family === x.e.family && (persons.length === 0 || p.person === x.e.person))) continue
    picked.push(x.e)
  }
  return picked.map((e) => tidy(e.build()))
}

/** Questions to try, matched to what is happening. */
export function suggestions(ctx: Pick<AskContext, 'scenario' | 'subjects'>): string[] {
  const sc = LIVE_SCENARIOS[ctx.scenario]
  const patient = sc.patientId && sc.patientId !== CABIN_ID ? ctx.subjects.find((s) => s.id === sc.patientId)?.name : undefined
  const now = ctx.scenario === 'normal' ? [] : ["What's happening right now?", 'What should we do now?', ...(patient ? [`How is ${patient}?`] : []), 'Why does this happen?']
  return [...now, 'How is the crew?', "What are NASA's five space hazards?", 'Is my oxygen normal?', 'How long until Earth answers?'].slice(0, 6)
}

export const SUGGESTED = ['How is the crew?', 'What should we do now?', 'Is my oxygen normal?', "What are NASA's five space hazards?", 'How long until Earth answers?']
