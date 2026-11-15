import { describe, expect, it } from 'vitest'
import { CARE_STEPS } from './data/careSteps'
import { SOURCES } from './data/sources'
import { CREW } from './data/simulatedCrew'
import { CO2_FALL_MS, DIZZY_FALL_MS, FEVER_FALL_MS, FEVER_GONE_C, LIVE_SCENARIOS, SCENARIO_ORDER, STORM_FALL_MS, TICK_MS, buildLive, isFixed, isScenario, liveReading, liveSamples, type Care, type ScenarioId } from './live'
import type { MissionId } from './data/missions'
import { HAZARD_INFO } from './data/signalGuide'
import { CABIN_ID, keyOf, type CheckIns } from './model'

const T0 = Date.UTC(2026, 10, 14, 18, 0, 0)
const flaggedIds = (scenario: ScenarioId, at = T0, checkIns: CheckIns = {}, care: Care = {}) =>
  buildLive(scenario, at, checkIns, 'mars', care).subjects.filter((s) => s.findings.some((f) => f.level !== 'green'))
// Ten minutes of ticks, so the live wobble never pushes a value over a limit by chance.
const ticks = Array.from({ length: 300 }, (_, k) => T0 + k * TICK_MS)

describe('live scenarios', () => {
  it('normal: every astronaut and the cabin stay normal, tick after tick', () => {
    for (const at of ticks) expect(flaggedIds('normal', at).map((s) => s.id)).toEqual([])
  })

  it('flagged: only Roya Alizadeh, with a fever and a headache, nothing urgent', () => {
    for (const at of ticks) {
      const flagged = flaggedIds('flagged', at)
      expect(flagged.map((s) => s.id)).toEqual(['C3'])
      const levels = Object.fromEntries(flagged[0].findings.filter((f) => f.level !== 'green').map((f) => [f.id, f.level]))
      expect(levels).toEqual({ basics: 'amber', headache: 'amber' })
    }
  })

  it('flagged: after the pill the fever comes down and everyone is normal again', () => {
    const jenkins = CREW.find((c) => c.id === 'C3')!
    const care = { pill: T0 }
    expect(liveReading(jenkins, 'flagged', T0, 'mars', care).bodyTempC).toBeGreaterThanOrEqual(38)
    const half = liveReading(jenkins, 'flagged', T0 + FEVER_FALL_MS / 2, 'mars', care).bodyTempC
    expect(half).toBeLessThan(38.2)
    expect(half).toBeGreaterThan(36.9)
    expect(liveReading(jenkins, 'flagged', T0 + FEVER_FALL_MS, 'mars', care).bodyTempC).toBeLessThan(FEVER_GONE_C)
    expect(flaggedIds('flagged', T0 + FEVER_FALL_MS + TICK_MS, {}, care)).toEqual([])
  })

  it('emergency: Khamosh Mehta has an urgent finding (neck vein clot); everyone else is normal', () => {
    for (const at of ticks) {
      const flagged = flaggedIds('emergency', at)
      expect(flagged.map((s) => s.id)).toEqual(['C4'])
      const urgent = flagged[0].findings.filter((f) => f.level === 'red').map((f) => f.id)
      expect(urgent).toEqual(['ijv'])
    }
  })

  it('each scenario names its patient and has no day number on screen', () => {
    expect(LIVE_SCENARIOS.normal.patientId).toBeNull()
    expect(LIVE_SCENARIOS.flagged.patientId).toBe('C3')
    expect(LIVE_SCENARIOS.emergency.patientId).toBe('C4')
    const info = buildLive('flagged', T0, {}, 'mars', {}).subjects.flatMap((s) => Object.values(s.info))
    for (const p of info) {
      expect(p.when).toBeTruthy()
      expect(p.stale).toBe(false)
    }
  })

  it('live values move with the clock, and the same moment always gives the same reading', () => {
    const vance = CREW[0]
    const hr = ticks.slice(0, 30).map((at) => liveReading(vance, 'normal', at, 'mars').restingHrBpm)
    expect(new Set(hr).size).toBeGreaterThan(1)
    expect(liveReading(vance, 'normal', T0, 'mars')).toEqual(liveReading(vance, 'normal', T0, 'mars'))
    expect(liveSamples('C1', 30, 'normal', T0, {}, 'mars', {})).toHaveLength(30)
  })
})

describe('check-ins in the live view', () => {
  it('belong to one scenario, and the wearable keeps streaming after a check-in', () => {
    const vance = CREW[0]
    const flaggedDay = LIVE_SCENARIOS.flagged.day
    const checkIn = { ...liveReading(vance, 'flagged', T0, 'mars'), urineLitersDay: 1.2, restingHrBpm: 150 }
    const checkIns: CheckIns = { [keyOf('C1', flaggedDay)]: checkIn }
    const inFlagged = buildLive('flagged', T0, checkIns, 'mars', {})
    expect(inFlagged.subjects.find((s) => s.id === 'C1')!.manual).toBe(true)
    expect(inFlagged.readings.C1.urineLitersDay).toBe(1.2)
    // Heart rate keeps coming from the wearable, not from the form.
    expect(inFlagged.readings.C1.restingHrBpm).toBe(liveReading(vance, 'flagged', T0, 'mars').restingHrBpm)
    // The same check-in does not show up in the other scenarios.
    expect(buildLive('normal', T0, checkIns, 'mars', {}).subjects.find((s) => s.id === 'C1')!.manual).toBe(false)
    expect(buildLive('emergency', T0, checkIns, 'mars', {}).subjects.find((s) => s.id === 'C1')!.manual).toBe(false)
  })

  it('the cabin is part of every live view', () => {
    for (const s of ['normal', 'flagged', 'emergency'] as const) expect(buildLive(s, T0, {}, 'mars', {}).subjects.at(-1)!.id).toBe(CABIN_ID)
  })
})

describe('steps to fix', () => {
  it('flagged has the pill step; emergency alerts the flight surgeon, tells ground control and gets a second opinion', () => {
    expect(CARE_STEPS.normal).toEqual([])
    expect(CARE_STEPS.flagged.map((s) => s.action ?? s.auto).filter(Boolean)).toEqual(['pill', 'fever', 'checkin'])
    expect(CARE_STEPS.emergency.map((s) => s.action ?? s.auto).filter(Boolean)).toEqual(['alert', 'delivered', 'reply'])
  })
  it('every step has a unique id, and sources are real links', () => {
    for (const list of Object.values(CARE_STEPS)) {
      expect(new Set(list.map((s) => s.id)).size).toBe(list.length)
      for (const s of list) for (const x of s.source === undefined ? [] : Array.isArray(s.source) ? s.source : [s.source]) expect(x.url).toMatch(/^https:\/\//)
    }
    expect(Object.keys(SOURCES).length).toBeGreaterThan(0)
  })
})

describe('NASA space hazard scenarios', () => {
  const live = (s: ScenarioId, at: number, care: Care = {}, mission: MissionId = 'mars') => buildLive(s, at, {}, mission, care)
  const subject = (s: ScenarioId, id: string, at: number, care: Care = {}, mission: MissionId = 'mars') => live(s, at, care, mission).subjects.find((x) => x.id === id)!
  const level = (s: ScenarioId, id: string, finding: string, at: number, care: Care = {}, mission: MissionId = 'mars') => subject(s, id, at, care, mission).findings.find((f) => f.id === finding)?.level
  const flagged = (s: ScenarioId, at: number, care: Care = {}, mission: MissionId = 'mars') =>
    live(s, at, care, mission).subjects.filter((x) => x.findings.some((f) => f.level !== 'green')).map((x) => x.id)

  it('the menu has the three health scenarios and one scenario for each of NASA\'s five hazards', () => {
    expect(SCENARIO_ORDER).toHaveLength(8)
    const hazards = SCENARIO_ORDER.filter((id) => LIVE_SCENARIOS[id].group === 'hazard').map((id) => LIVE_SCENARIOS[id].hazard)
    expect(new Set(hazards)).toEqual(new Set(Object.keys(HAZARD_INFO)))
    for (const id of SCENARIO_ORDER) expect(isScenario(id)).toBe(true)
    expect(isScenario('toString')).toBe(false)
    expect(new Set(SCENARIO_ORDER.map((id) => LIVE_SCENARIOS[id].day)).size).toBe(8)
  })

  it('solar storm: radiation is urgent for the whole cabin until the crew shelters, then it passes', () => {
    for (const at of ticks.slice(0, 60)) {
      expect(level('radiation', CABIN_ID, 'doserate', at)).toBe('red')
      expect(flagged('radiation', at)).toEqual([CABIN_ID])
    }
    const care = { shelter: T0 }
    const inShelter = subject('radiation', CABIN_ID, T0 + TICK_MS, care).findings.find((f) => f.id === 'doserate')!
    expect(inShelter.measured).toContain('In the shelter')
    expect(isFixed('radiation', subject('radiation', CABIN_ID, T0 + TICK_MS, care))).toBe(false)
    const after = T0 + STORM_FALL_MS + TICK_MS
    expect(level('radiation', CABIN_ID, 'doserate', after, care)).toBe('green')
    expect(isFixed('radiation', subject('radiation', CABIN_ID, after, care))).toBe(true)
  })

  it('cabin CO2: above the limit with two headaches until the backup is on, then back under 3 mmHg', () => {
    const start = { start: T0 }
    for (const at of ticks.slice(0, 60)) {
      expect(level('co2', CABIN_ID, 'co2', at, start)).toBe('amber')
      expect(flagged('co2', at, start).sort()).toEqual(['C3', 'C4', CABIN_ID].sort())
    }
    const care = { start: T0, scrubber: T0 + 10_000 }
    const after = T0 + 10_000 + CO2_FALL_MS + TICK_MS
    expect(flagged('co2', after, care)).toEqual([])
    expect(isFixed('co2', subject('co2', CABIN_ID, after, care))).toBe(true)
  })

  it('isolation: only Khamosh Mehta, with low mood and short sleep, nothing urgent', () => {
    for (const at of ticks.slice(0, 60)) {
      expect(flagged('isolation', at)).toEqual(['C4'])
      const bad = subject('isolation', 'C4', at).findings.filter((f) => f.level !== 'green').map((f) => f.id)
      expect(bad.sort()).toEqual(['mood', 'sleep'])
    }
    expect(LIVE_SCENARIOS.isolation.clearWhen).toBeUndefined()
  })

  it('Earth out of reach: no contact, and Roya Alizadeh has side pain and low urine; the pain reliever eases the pain', () => {
    expect(LIVE_SCENARIOS.distance.blackout).toBe(true)
    expect(LIVE_SCENARIOS.distance.mission).toBe('mars')
    for (const at of ticks.slice(0, 60)) {
      expect(flagged('distance', at)).toEqual(['C3'])
      const bad = subject('distance', 'C3', at).findings.filter((f) => f.level !== 'green').map((f) => f.id)
      expect(bad.sort()).toEqual(['pain', 'urine'])
    }
    const later = T0 + FEVER_FALL_MS + TICK_MS
    expect(level('distance', 'C3', 'pain', later, { pill: T0 })).toBeUndefined()
    expect(level('distance', 'C3', 'urine', later, { pill: T0 })).toBe('amber')
  })

  it('landing day on the Moon: Tulsi Gandhi is dizzy, with a fast pulse and low blood pressure, until she lies down', () => {
    expect(LIVE_SCENARIOS.gravity.mission).toBe('moon')
    for (const at of ticks.slice(0, 60)) {
      expect(flagged('gravity', at, {}, 'moon')).toEqual(['C1'])
      const bad = subject('gravity', 'C1', at, {}, 'moon').findings.filter((f) => f.level !== 'green').map((f) => f.id)
      expect(bad.sort()).toEqual(['balance', 'basics', 'vitals'])
    }
    const later = T0 + DIZZY_FALL_MS + TICK_MS
    expect(flagged('gravity', later, { liedown: T0 }, 'moon')).toEqual([])
    expect(isFixed('gravity', subject('gravity', 'C1', later, { liedown: T0 }, 'moon'))).toBe(true)
  })

  it('the steps have the right buttons and self-ticking steps for each hazard', () => {
    const kinds = (s: ScenarioId) => CARE_STEPS[s].map((x) => x.action ?? x.auto).filter(Boolean)
    expect(kinds('radiation')).toEqual(['alert', 'reply', 'clear'])
    expect(kinds('co2')).toEqual(['alert', 'reply', 'clear'])
    expect(kinds('isolation')).toEqual(['alert', 'reply', 'checkin'])
    expect(kinds('distance')).toEqual(['pill', 'checkin'])
    expect(kinds('gravity')).toEqual(['clear', 'checkin'])
    // The steps that change the simulation keep the ids the live engine reads.
    expect(CARE_STEPS.radiation.some((x) => x.id === 'shelter')).toBe(true)
    expect(CARE_STEPS.co2.some((x) => x.id === 'scrubber')).toBe(true)
    expect(CARE_STEPS.gravity.some((x) => x.id === 'liedown')).toBe(true)
  })
})

