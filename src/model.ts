// Data layer between the readings and the screens. Pure functions.
// Readings come from a SIMULATED DEVICE FEED: wearables report every day, ultrasound exams
// and blood tests only on their scheduled days. Each value carries where it came from and
// how old it is. A crew check-in replaces the feed for that person and day.

import type { MissionId } from './data/missions.ts'
import { CREW, cabinOn, readingOn, type CrewMember } from './data/simulatedCrew.ts'
import { SOURCES } from './data/sources.ts'
import { assessCabin, assessCrew, type CrewReading, type Finding } from './triage.ts'

export const CABIN_ID = 'cabin'

export type CheckIns = Record<string, CrewReading>
export const keyOf = (crewId: string, day: number) => `${crewId}:${day}`

interface Feed {
  source: string
  /** A new measurement arrives every this many days. */
  every: number
  /** Older than this many days = stale. Demo values, not a NASA schedule. */
  staleAfter: number
  /** true = arrives by itself. false = a crew member has to do the exam. */
  auto: boolean
}

export const FEEDS: Record<string, Feed> = {
  vitals: { source: 'Wearable sensor', every: 1, staleAfter: 1, auto: true },
  sleep: { source: 'Wearable sensor', every: 1, staleAfter: 1, auto: true },
  headache: { source: 'Crew report', every: 1, staleAfter: 1, auto: false },
  urine: { source: 'Crew log', every: 1, staleAfter: 1, auto: false },
  mood: { source: 'Crew report', every: 1, staleAfter: 1, auto: false },
  basics: { source: 'Health kit', every: 1, staleAfter: 1, auto: false },
  exercise: { source: 'Exercise device log', every: 1, staleAfter: 1, auto: true },
  onsd: { source: 'Ultrasound exam', every: 14, staleAfter: 10, auto: false },
  ijv: { source: 'Ultrasound exam', every: 14, staleAfter: 10, auto: false },
  hematocrit: { source: 'Blood analyser', every: 30, staleAfter: 21, auto: false },
  immune: { source: 'Blood analyser', every: 30, staleAfter: 21, auto: false },
  vitd: { source: 'Blood sample (analysed on Earth)', every: 60, staleAfter: 75, auto: false },
  bodymass: { source: 'Body mass device', every: 7, staleAfter: 10, auto: false },
  co2: { source: 'Cabin sensor', every: 1, staleAfter: 1, auto: true },
  radiation: { source: 'Cabin dosimeter', every: 1, staleAfter: 1, auto: true },
}

export function lastMeasured(id: string, day: number): number {
  const every = FEEDS[id]?.every ?? 1
  return day - ((day - 1) % every)
}

export interface Provenance {
  source: string
  measuredDay: number
  ageDays: number
  stale: boolean
  nextDue: number | null
  auto: boolean
  /** Live view: when it was measured, in words ("live", "this week"). Replaces the day numbers. */
  when?: string
}

function provenance(id: string, day: number, manual: boolean): Provenance {
  if (manual) return { source: 'Crew check-in', measuredDay: day, ageDays: 0, stale: false, nextDue: null, auto: false }
  const feed = FEEDS[id] ?? FEEDS.vitals
  const measuredDay = lastMeasured(id, day)
  const ageDays = day - measuredDay
  return { source: feed.source, measuredDay, ageDays, stale: ageDays > feed.staleAfter, nextDue: feed.every > 1 ? measuredDay + feed.every : null, auto: feed.auto }
}

/** What the system knows about one crew member on a day: each value from its latest measurement. */
export function getReading(checkIns: CheckIns, crew: CrewMember, day: number, mission: MissionId = 'mars'): CrewReading {
  const manual = checkIns[keyOf(crew.id, day)]
  const today = readingOn(crew, day, mission)
  if (manual) return { ...today, ...manual }
  const eye = readingOn(crew, lastMeasured('onsd', day), mission)
  const vein = readingOn(crew, lastMeasured('ijv', day))
  const blood = readingOn(crew, lastMeasured('hematocrit', day), mission)
  const cells = readingOn(crew, lastMeasured('immune', day))
  const vitD = readingOn(crew, lastMeasured('vitd', day))
  const mass = readingOn(crew, lastMeasured('bodymass', day))
  return {
    ...today,
    hematocritPct: blood.hematocritPct,
    onsdMm: eye.onsdMm,
    ijvFlow: vein.ijvFlow,
    ijvClotSeen: vein.ijvClotSeen,
    wbcK: cells.wbcK,
    lymphK: cells.lymphK,
    vitaminDNgMl: vitD.vitaminDNgMl,
    bodyMassKg: mass.bodyMassKg,
  }
}

export interface Subject {
  id: string
  name: string
  role: string
  manual: boolean
  /** Findings from the space-adapted rules, most serious first. */
  findings: Finding[]
  info: Record<string, Provenance>
}

export function buildDay(day: number, checkIns: CheckIns, mission: MissionId = 'mars'): Subject[] {
  const cabin = cabinOn(day, mission)
  const crew = CREW.map((c): Subject => {
    const manual = keyOf(c.id, day) in checkIns
    const findings = assessCrew(getReading(checkIns, c, day, mission), c.baseline, cabin)
    return {
      id: c.id,
      name: c.name,
      role: c.role,
      manual,
      findings,
      info: Object.fromEntries(findings.map((f) => [f.id, provenance(f.id, day, manual)])),
    }
  })
  const cabinFindings = assessCabin(cabin)
  return [
    ...crew,
    {
      id: CABIN_ID,
      name: 'Cabin',
      role: 'Air and radiation',
      manual: false,
      findings: cabinFindings,
      info: Object.fromEntries(cabinFindings.map((f) => [f.id, provenance(f.id, day, false)])),
    },
  ]
}

export const flagged = (list: Finding[]) => list.filter((f) => f.level !== 'green').length

/** Plain-text summary to send to Earth. Only includes the people passed in. */
export function reportText(subjects: Subject[], heading = 'CREW HEALTH REPORT'): string {
  const lines = [heading, '']
  for (const s of subjects) {
    const list = s.findings.filter((f) => f.level !== 'green')
    if (list.length === 0) continue
    lines.push(`${s.name} (${s.role})`)
    for (const f of list) {
      const p = s.info[f.id]
      lines.push(`  ${f.level === 'red' ? 'URGENT' : 'CHECK'}: ${f.title}: ${f.measured}`)
      if (p) lines.push(`    Data from: ${p.source}, measured day ${p.measuredDay}${p.stale ? ' (STALE)' : ''}`)
      lines.push(`    ${f.why}`)
      lines.push(`    Rule source: ${f.sourceIds.map((id) => SOURCES[id].title).join('; ')}`)
    }
    lines.push('')
  }
  if (lines.length === 2) lines.push('Nothing flagged.')
  return lines.join('\n')
}
