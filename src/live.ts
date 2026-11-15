// LIVE VIEW. The crew as they are right now, in one of the demo scenarios.
// Crew health:
//   normal     every astronaut is normal
//   flagged    one astronaut has a slight fever and a headache: a pill from the medical kit should fix it
//   emergency  one astronaut may have a blood clot in a neck vein: the flight surgeon and ground control are needed
// NASA space hazards (one per hazard on https://www.nasa.gov/hrp/hazards/):
//   radiation  a solar storm: radiation far above normal, everyone to the storm shelter
//   isolation  one astronaut's mood and sleep have been low all week
//   distance   Mars is behind the Sun, no contact with Earth, and one astronaut has side pain (possible kidney stone)
//   gravity    landing day on the Moon: one astronaut is dizzy and lightheaded on standing
//   co2        the main CO2 scrubber is failing: cabin CO2 above NASA's limit, two crew with headaches
// All readings are SIMULATED. Wearable values (heart rate, oxygen, temperature, blood pressure) move a
// little every couple of seconds, like a live feed. Everything here is a pure function of the clock and of
// what the crew has done (Care), so the same moment always gives the same reading.

import { CREW, cabinOn, readingOn, type CrewMember } from './data/simulatedCrew.ts'
import type { MissionId } from './data/missions.ts'
import type { Hazard } from './data/signalGuide.ts'
import { CABIN_ID, keyOf, type CheckIns, type Provenance, type Subject } from './model.ts'
import { assessCabin, assessCrew, type CabinReading, type CrewReading, type Finding, type Level } from './triage.ts'

export type ScenarioId = 'normal' | 'flagged' | 'emergency' | 'radiation' | 'isolation' | 'distance' | 'gravity' | 'co2'

export interface LiveScenario {
  id: ScenarioId
  name: string
  /** One line for the scenario menu. */
  summary: string
  /** Where it sits in the scenario menu: crew health, or one of NASA's five hazards. */
  group: 'health' | 'hazard'
  /** The NASA hazard behind a hazard scenario. */
  hazard?: Hazard
  /** The crew member with the problem, the cabin (CABIN_ID) for problems that affect everyone, or nobody. */
  patientId: string | null
  /** The problem in a few words. */
  problem: string | null
  level: Level
  /** Hidden mission day behind this scenario (radiation since launch, signal delay). Check-ins are
   *  stored per day, so each scenario keeps its own check-ins and switching never mixes them. */
  day: number
  /** The setting this scenario happens in. Choosing the scenario switches the setting to it. */
  mission?: MissionId
  /** The line across the top while the problem is there. */
  banner: string
  /** The line once the steps have fixed it. Scenarios without one are not fixed in minutes. */
  fixedBanner?: string
  /** Signals that must be back to normal for the problem to count as fixed ('all': every signal of the patient). */
  clearWhen?: string[] | 'all'
  /** No contact with Earth: nothing can be sent until contact returns. */
  blackout?: boolean
}

export const LIVE_SCENARIOS: Record<ScenarioId, LiveScenario> = {
  normal: { id: 'normal', name: 'Normal', group: 'health', summary: 'Every astronaut is normal.', patientId: null, problem: null, level: 'green', day: 61, banner: 'Every astronaut is normal right now.' },
  flagged: {
    id: 'flagged',
    name: 'Flagged',
    group: 'health',
    summary: 'S. Jenkins has a slight fever and a headache. A pill from the medical kit should fix it.',
    patientId: 'C3',
    problem: 'Slight fever and headache',
    level: 'amber',
    day: 62,
    banner: 'S. Jenkins has a slight fever and a headache. A pill from the medical kit should fix it.',
    fixedBanner: "S. Jenkins's fever and headache are gone.",
    clearWhen: 'all',
  },
  emergency: {
    id: 'emergency',
    name: 'Emergency',
    group: 'health',
    summary: 'A. Rivera may have a blood clot in a neck vein. The flight surgeon and ground control are needed.',
    patientId: 'C4',
    problem: 'Possible blood clot in a neck vein',
    level: 'red',
    day: 63,
    banner: 'A. Rivera may have a blood clot in a neck vein. Alert the flight surgeon and ground control.',
  },
  radiation: {
    id: 'radiation',
    name: 'Solar storm',
    group: 'hazard',
    hazard: 'Space radiation',
    summary: 'Space radiation. A solar storm sends radiation far above normal. Everyone to the storm shelter.',
    patientId: CABIN_ID,
    problem: 'Solar storm, radiation far above normal',
    level: 'red',
    day: 64,
    banner: 'A solar storm has sent radiation in the cabin far above normal. Everyone into the storm shelter.',
    fixedBanner: 'The solar storm has passed. Radiation is back to normal.',
    clearWhen: ['doserate'],
  },
  isolation: {
    id: 'isolation',
    name: 'Isolation',
    group: 'hazard',
    hazard: 'Isolation and confinement',
    summary: "Isolation and confinement. A. Rivera's mood and sleep have been low all week.",
    patientId: 'C4',
    problem: 'Low mood and poor sleep all week',
    level: 'amber',
    day: 65,
    banner: "A. Rivera's mood and sleep have been low all week. Months in a small space far from home are wearing on him.",
  },
  distance: {
    id: 'distance',
    name: 'Earth out of reach',
    group: 'hazard',
    hazard: 'Distance from Earth',
    summary: 'Distance from Earth. No contact with Earth for two weeks, and S. Jenkins has sharp side pain.',
    patientId: 'C3',
    problem: 'Side pain and low urine, possibly a kidney stone, with no contact with Earth',
    level: 'amber',
    day: 66,
    mission: 'mars',
    banner: 'Mars is behind the Sun, so there is no contact with Earth for about two weeks. S. Jenkins has sharp side pain and low urine output: possibly a kidney stone.',
    blackout: true,
  },
  gravity: {
    id: 'gravity',
    name: 'Landing day',
    group: 'hazard',
    hazard: 'Gravity changes',
    summary: 'Gravity fields. Just landed on the Moon: E. Vance is dizzy when she stands up.',
    patientId: 'C1',
    problem: 'Dizzy and lightheaded after landing',
    level: 'amber',
    day: 67,
    mission: 'moon',
    banner: 'Just landed on the Moon after days of weightlessness. E. Vance is dizzy and lightheaded when she stands up.',
    fixedBanner: "E. Vance's heart rate and blood pressure are back to normal and the dizziness has passed.",
    clearWhen: 'all',
  },
  co2: {
    id: 'co2',
    name: 'Cabin CO2',
    group: 'hazard',
    hazard: 'Closed environment',
    summary: 'Hostile and closed environments. The main CO2 scrubber is failing and two crew have headaches.',
    patientId: CABIN_ID,
    problem: 'CO2 above the limit and rising',
    level: 'amber',
    day: 68,
    banner: "Cabin CO2 is above NASA's limit and rising: the main CO2 scrubber is failing. Two crew members have headaches.",
    fixedBanner: "Cabin CO2 is back under NASA's limit and the headaches have passed.",
    clearWhen: ['co2'],
  },
}
export const SCENARIO_ORDER: ScenarioId[] = ['normal', 'flagged', 'emergency', 'radiation', 'isolation', 'distance', 'gravity', 'co2']
export const isScenario = (v: unknown): v is ScenarioId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(LIVE_SCENARIOS, v)

/** How often the live feed updates. */
export const TICK_MS = 2000
/** In the demo the fever falls over one minute after the pill (about an hour in real life). */
export const FEVER_FALL_MS = 60_000
/** Below this the fever counts as gone in the steps. */
export const FEVER_GONE_C = 37.5
/** Solar storm: the open cabin peaks at this many times the normal dose rate (demo value, STORM_DEMO). */
export const STORM_X = 30
/** In the demo the storm passes over about this long after the crew takes shelter (real storms: hours to days). */
export const STORM_FALL_MS = 75_000
/** The storm shelter gets about a quarter of the dose rate of the least shielded spot (Artemis I, ARTEMIS1_SHELTER). */
export const SHELTER_FACTOR = 0.25
/** Failing scrubber: CO2 climbs from about 4.4 to 5.2 mmHg over two minutes until the backup is on. */
const CO2_START = 4.4
const CO2_TOP = 5.2
const CO2_RISE_MS = 120_000
/** After the backup CO2 removal is switched on, CO2 falls to about 2.4 mmHg over this long (demo). */
export const CO2_FALL_MS = 75_000
/** At or above this many mmHg the two affected crew members report headaches (NASA brief TB-004: frontal headaches near 3.5). */
export const CO2_HEADACHE_SCENE = 3.5
/** In the demo the dizziness passes about a minute after lying down with fluids (in real life: hours to days). */
export const DIZZY_FALL_MS = 60_000

/** What the crew has done in this scenario: step id -> when it was done (ms since 1970). */
export type Care = Record<string, number>

/** Repeatable pseudo-random number in [-1, 1]. */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

/** Small live movement for one value, about -1 to 1: a smooth drift plus a little jitter every tick.
 *  `jitter` is the share of the quick part (0 = drift only). */
function wobble(person: number, field: number, at: number, jitter = 0.3): number {
  const k = Math.floor(at / TICK_MS)
  const knot = (j: number) => noise(j * 17 + field * 31 + person * 3)
  const t = (k % 6) / 6
  const drift = knot(Math.floor(k / 6)) * (1 - t) + knot(Math.floor(k / 6) + 1) * t
  return jitter * noise(k * 13 + field * 101 + person * 7) + (1 - jitter) * drift
}

const r1 = (n: number) => Math.round(n * 10) / 10
const smooth = (p: number) => p * p * (3 - 2 * p)

/** A healthy reading for this person right now: every rule says normal. */
function healthy(crew: CrewMember, day: number, mission: MissionId, at: number): CrewReading {
  const i = CREW.indexOf(crew)
  const b = crew.baseline
  const w = (field: number) => wobble(i, field, at)
  return {
    // Keeps the expected in-flight changes from the feed (hematocrit up about 11%, white cells up).
    ...readingOn(crew, day, mission),
    onsdMm: Math.round((b.onsdMm + 0.05) * 100) / 100,
    visionChange: false,
    ijvFlow: 'forward',
    ijvClotSeen: false,
    headache: false,
    sleepHours7d: r1(7 + noise(i * 5 + 1) * 0.3),
    spo2Pct: Math.round(97.6 + wobble(i, 1, at, 0) * 0.9),
    restingHrBpm: Math.round(63 + i * 2 + w(2) * 3),
    urineLitersDay: r1(2.4 + noise(i * 5 + 2) * 0.15),
    resistanceSessions7d: 6,
    moodAvg7d: r1(4 + noise(i * 5 + 3) * 0.3),
    bodyTempC: r1(36.7 + w(3) * 0.15),
    systolicBp: Math.round(116 + w(4) * 4),
    diastolicBp: Math.round(74 + w(5) * 3),
    glucoseMgDl: Math.round(92 + noise(i * 5 + 4) * 5),
    vitaminDNgMl: Math.max(30.4, r1(b.vitaminDNgMl * 0.97)),
    bodyMassKg: r1(b.bodyMassKg * 0.99),
  }
}

/** How far the fever has come down after the pill: 0 = not yet, 1 = gone. */
export function feverRecovery(at: number, care: Care): number {
  const pill = care.pill
  if (pill === undefined) return 0
  return smooth(Math.min(1, Math.max(0, (at - pill) / FEVER_FALL_MS)))
}

/** How far something has come since a step was done: 0 = not started, 1 = done. Smooth in between. */
function since(at: number, from: number | undefined, ms: number): number {
  if (from === undefined) return 0
  return smooth(Math.min(1, Math.max(0, (at - from) / ms)))
}

/** The reading the live feed sends for one person at one moment. */
export function liveReading(crew: CrewMember, scenario: ScenarioId, at: number, mission: MissionId, care: Care = {}): CrewReading {
  const s = LIVE_SCENARIOS[scenario]
  const r = healthy(crew, s.day, mission, at)
  const i = CREW.indexOf(crew)
  if (scenario === 'co2') {
    // Two crew members get headaches while CO2 is high. They pass as the air clears.
    if (crew.id !== 'C3' && crew.id !== 'C4') return r
    return { ...r, headache: liveCabin(scenario, at, mission, care).co2MmHg >= CO2_HEADACHE_SCENE }
  }
  if (crew.id !== s.patientId) return r
  if (scenario === 'isolation') {
    // Weekly averages: they do not change within minutes.
    return { ...r, moodAvg7d: 2.1, sleepHours7d: 5.2 }
  }
  if (scenario === 'distance') {
    // Possible kidney stone: pain in waves, a faster pulse, little urine. The pain reliever eases the pain.
    const p = feverRecovery(at, care)
    return {
      ...r,
      urineLitersDay: 1.2,
      sidePain: p < 0.75,
      restingHrBpm: Math.round(96 - 22 * p + wobble(i, 2, at) * 2),
      systolicBp: Math.round(134 - 16 * p + wobble(i, 4, at) * 2),
      diastolicBp: Math.round(84 - 8 * p + wobble(i, 5, at) * 2),
    }
  }
  if (scenario === 'gravity') {
    // Lightheaded on standing after landing: fast pulse, low blood pressure. Lying down with fluids brings both back.
    const p = since(at, care.liedown, DIZZY_FALL_MS)
    return {
      ...r,
      dizzy: p < 0.7,
      restingHrBpm: Math.round(114 - 44 * p + wobble(i, 2, at) * 3),
      systolicBp: Math.round(86 + 26 * p + wobble(i, 4, at) * 2),
      diastolicBp: Math.round(56 + 16 * p + wobble(i, 5, at) * 2),
    }
  }
  if (scenario === 'flagged') {
    // Slight fever with a headache, a little faster pulse. After the pill both settle.
    const p = feverRecovery(at, care)
    return {
      ...r,
      bodyTempC: r1(38.3 - 1.4 * p + wobble(i, 3, at) * 0.06),
      headache: p < 0.75,
      restingHrBpm: Math.round(88 - 20 * p + wobble(i, 2, at) * 2),
      sleepHours7d: 6.3,
    }
  }
  if (scenario !== 'emergency') return r
  // Emergency: a clot seen on the neck ultrasound, a headache and a fast pulse.
  return {
    ...r,
    ijvFlow: 'stagnant',
    ijvClotSeen: true,
    headache: true,
    restingHrBpm: Math.round(106 + wobble(i, 2, at) * 4),
    systolicBp: Math.round(134 + wobble(i, 4, at) * 3),
    diastolicBp: Math.round(86 + wobble(i, 5, at) * 2),
    bodyTempC: r1(37.1 + wobble(i, 3, at) * 0.08),
  }
}

/** CO2 before the backup is on: climbing slowly as the main scrubber fails. */
function co2Climbing(at: number, start: number | undefined): number {
  const climb = start === undefined ? 0.5 : Math.min(1, Math.max(0, (at - start) / CO2_RISE_MS))
  return CO2_START + (CO2_TOP - CO2_START) * climb
}

/** Cabin air and radiation right now. */
export function liveCabin(scenario: ScenarioId, at: number, mission: MissionId, care: Care = {}): CabinReading {
  const base = cabinOn(LIVE_SCENARIOS[scenario].day, mission)
  const normalH = base.doseRateMSvDay / 24
  let co2 = 2.3 + wobble(9, 1, at) * 0.1
  let rate = normalH * (1 + wobble(9, 2, at) * 0.04)
  let shelter: number | undefined
  if (scenario === 'radiation') {
    // The storm stays high until the crew shelters, then passes over about a minute (demo time).
    const p = since(at, care.shelter, STORM_FALL_MS)
    rate = normalH * (1 + (STORM_X - 1) * (1 - p)) * (1 + wobble(9, 2, at) * 0.06)
    if (care.shelter !== undefined && at >= care.shelter && p < 1) shelter = rate * SHELTER_FACTOR
  }
  if (scenario === 'co2') {
    const w = wobble(9, 1, at) * 0.06
    if (care.scrubber === undefined || at < care.scrubber) co2 = co2Climbing(at, care.start) + w
    else {
      const from = co2Climbing(care.scrubber, care.start)
      co2 = from + (2.4 - from) * since(at, care.scrubber, CO2_FALL_MS) + w
    }
  }
  return {
    ...base,
    co2MmHg: r1(co2),
    doseRateNowMSvH: Math.round(rate * 1000) / 1000,
    ...(shelter === undefined ? {} : { shelterMSvH: Math.round(shelter * 100) / 100 }),
  }
}

/** Values the wearable keeps sending even after a crew check-in. */
const STREAMING = ['restingHrBpm', 'spo2Pct', 'bodyTempC'] as const
/** Symptoms in the scenario that last until the steps ease them, check-in or not. */
const SYMPTOMS = ['dizzy', 'sidePain'] as const

/** One person's reading now. A check-in replaces the exam and log values; the wearable keeps streaming. */
export function currentReading(crew: CrewMember, scenario: ScenarioId, at: number, checkIns: CheckIns, mission: MissionId, care: Care): { reading: CrewReading; manual: boolean } {
  const live = liveReading(crew, scenario, at, mission, care)
  const checkIn = checkIns[keyOf(crew.id, LIVE_SCENARIOS[scenario].day)]
  if (!checkIn) return { reading: live, manual: false }
  const reading = { ...checkIn }
  for (const k of STREAMING) reading[k] = live[k]
  for (const k of SYMPTOMS) if (live[k] !== undefined) reading[k] = live[k]
  return { reading, manual: true }
}

const LIVE_SOURCE: Record<string, { source: string; when: string; auto: boolean }> = {
  vitals: { source: 'Wearable sensor', when: 'live', auto: true },
  basics: { source: 'Wearable and health kit', when: 'live', auto: true },
  sleep: { source: 'Wearable sensor', when: 'last night', auto: true },
  headache: { source: 'Crew report', when: 'today', auto: false },
  urine: { source: 'Crew log', when: 'last 24 hours', auto: false },
  mood: { source: 'Crew report', when: 'this week', auto: false },
  exercise: { source: 'Exercise device log', when: 'this week', auto: true },
  onsd: { source: 'Ultrasound exam', when: 'this week', auto: false },
  ijv: { source: 'Ultrasound exam', when: 'this week', auto: false },
  hematocrit: { source: 'Blood analyser', when: 'this week', auto: false },
  immune: { source: 'Blood analyser', when: 'this week', auto: false },
  vitd: { source: 'Blood sample (analysed on Earth)', when: 'this month', auto: false },
  bodymass: { source: 'Body mass device', when: 'this week', auto: false },
  co2: { source: 'Cabin sensor', when: 'live', auto: true },
  radiation: { source: 'Cabin dosimeter', when: 'live', auto: true },
  doserate: { source: 'Cabin radiation monitor', when: 'live', auto: true },
  balance: { source: 'Crew report', when: 'now', auto: false },
  pain: { source: 'Crew report', when: 'now', auto: false },
}

function liveInfo(id: string, manual: boolean, freshScan: boolean): Provenance {
  const base = { measuredDay: 0, ageDays: 0, stale: false, nextDue: null }
  if (manual && id !== 'vitals') {
    return { ...base, source: id === 'basics' ? 'Crew check-in, temperature from the wearable' : 'Crew check-in', when: 'today', auto: false }
  }
  const s = LIVE_SOURCE[id] ?? LIVE_SOURCE.vitals
  return { ...base, source: s.source, when: freshScan && (id === 'ijv' || id === 'onsd') ? '12 min ago' : s.when, auto: s.auto }
}

export interface LiveState {
  subjects: Subject[]
  /** Reading now for each crew member, by id. */
  readings: Record<string, CrewReading>
  cabin: CabinReading
}

/** Everyone's findings right now. Same shape as the day view, so every screen can use it. */
export function buildLive(scenario: ScenarioId, at: number, checkIns: CheckIns, mission: MissionId, care: Care): LiveState {
  const s = LIVE_SCENARIOS[scenario]
  const cabin = liveCabin(scenario, at, mission, care)
  const readings: Record<string, CrewReading> = {}
  const crew = CREW.map((c): Subject => {
    const { reading, manual } = currentReading(c, scenario, at, checkIns, mission, care)
    readings[c.id] = reading
    const findings = assessCrew(reading, c.baseline, cabin)
    const freshScan = scenario === 'emergency' && c.id === s.patientId
    return { id: c.id, name: c.name, role: c.role, manual, findings, info: Object.fromEntries(findings.map((f) => [f.id, liveInfo(f.id, manual, freshScan)])) }
  })
  const cabinFindings = assessCabin(cabin)
  const subjects = [
    ...crew,
    { id: CABIN_ID, name: 'Cabin', role: 'Air and radiation', manual: false, findings: cabinFindings, info: Object.fromEntries(cabinFindings.map((f) => [f.id, liveInfo(f.id, false, false)])) },
  ]
  return { subjects, readings, cabin }
}

/** The last `n` readings for one person, oldest first, one per tick. */
export function liveSamples(crewId: string, n: number, scenario: ScenarioId, at: number, checkIns: CheckIns, mission: MissionId, care: Care): CrewReading[] {
  const crew = CREW.find((c) => c.id === crewId)
  if (!crew) return []
  return Array.from({ length: n }, (_, k) => currentReading(crew, scenario, at - (n - 1 - k) * TICK_MS, checkIns, mission, care).reading)
}

/** The last `n` cabin readings, oldest first. */
export function liveCabinSamples(n: number, scenario: ScenarioId, at: number, mission: MissionId, care: Care = {}): CabinReading[] {
  return Array.from({ length: n }, (_, k) => liveCabin(scenario, at - (n - 1 - k) * TICK_MS, mission, care))
}

/** The number to chart for a signal. */
export function liveValue(findingId: string, r: CrewReading): number {
  switch (findingId) {
    case 'hematocrit':
      return r.hematocritPct
    case 'onsd':
      return r.onsdMm
    case 'ijv':
      return r.ijvFlow === 'forward' && !r.ijvClotSeen ? 1 : 0
    case 'headache':
      return r.headache ? 1 : 0
    case 'balance':
      return r.dizzy ? 1 : 0
    case 'pain':
      return r.sidePain ? 1 : 0
    case 'sleep':
      return r.sleepHours7d
    case 'urine':
      return r.urineLitersDay
    case 'mood':
      return r.moodAvg7d
    case 'exercise':
      return r.resistanceSessions7d
    case 'basics':
      return r.bodyTempC
    case 'vitals':
      return r.restingHrBpm
    case 'immune':
      return r.wbcK
    case 'vitd':
      return r.vitaminDNgMl
    case 'bodymass':
      return r.bodyMassKg
    default:
      return r.spo2Pct
  }
}

export const cabinValue = (findingId: string, c: CabinReading) => (findingId === 'co2' ? c.co2MmHg : findingId === 'doserate' ? c.doseRateNowMSvH : c.cumulativeDoseMSv)

/** Pre-flight value for a signal, drawn as a dashed line where there is one. */
export function baselineFor(crewId: string, findingId: string): number | undefined {
  const b = CREW.find((c) => c.id === crewId)?.baseline
  if (!b) return undefined
  return ({ hematocrit: b.hematocritPct, onsd: b.onsdMm, immune: b.wbcK, vitd: b.vitaminDNgMl, bodymass: b.bodyMassKg } as Record<string, number>)[findingId]
}

/** The signals that must be back to normal for the problem to count as fixed. */
export function watchedFindings(scenario: ScenarioId, patient: Subject): Finding[] {
  const ids = LIVE_SCENARIOS[scenario].clearWhen
  return ids === 'all' || ids === undefined ? patient.findings : patient.findings.filter((f) => ids.includes(f.id))
}

/** True once the steps have fixed the problem (only for scenarios that can be fixed in minutes). */
export function isFixed(scenario: ScenarioId, patient: Subject | undefined): boolean {
  if (!patient || LIVE_SCENARIOS[scenario].clearWhen === undefined) return false
  return watchedFindings(scenario, patient).every((f) => f.level === 'green')
}
