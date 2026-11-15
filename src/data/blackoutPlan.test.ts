import { describe, expect, it } from 'vitest'
import { LIVE_SCENARIOS, SCENARIO_ORDER, buildLive, type ScenarioId } from '../live'
import { CABIN_ID } from '../model'
import {
  BLACKOUT_MIN, MAX_LOG_TEXT, STANDARD_RULES, approvalMessage, blackoutEnd, blackoutMinute, blackoutReport, buildPlan, dueStep,
  isBlackoutReport, isStartMessage, planMessage, planRules, planText, readApproval, readPlan, startMessage, upcomingStep, type LogEntry,
} from './blackoutPlan'

const T0 = Date.UTC(2026, 10, 14, 18, 0, 0)
const planFor = (scenario: ScenarioId, question = '') =>
  buildPlan(buildLive(scenario, T0, {}, LIVE_SCENARIOS[scenario].mission ?? 'mars', { start: T0 }).subjects, `bp-${scenario}`, question)

describe('blackout plan', () => {
  it('a calm day: nobody to watch, six steps across the 90 minutes, the standard rules', () => {
    const p = planFor('normal')
    expect(p.watch).toEqual([])
    expect(p.steps.map((s) => s.at)).toEqual([0, 15, 30, 45, 60, 80])
    expect(p.steps.every((s) => s.at <= BLACKOUT_MIN)).toBe(true)
    expect(planRules(p)).toEqual(STANDARD_RULES)
    expect(planText(p)).toContain('Everyone is normal.')
  })

  it('names the people with something flagged in the steps and the rules', () => {
    const p = planFor('co2')
    expect(p.watch.map((w) => w.id)).toEqual(['C3', 'C4', CABIN_ID])
    expect(p.watch.find((w) => w.id === CABIN_ID)?.issue).toBe('CO2')
    expect(p.steps.find((s) => s.at === 15)?.text).toBe('Check Roya Alizadeh (headache) and Khamosh Mehta (headache) again.')
    expect(p.steps.find((s) => s.at === 30)?.text).toContain('follow its steps')
    expect(planRules(p).slice(0, 2).map((r) => r.when)).toEqual(['Roya Alizadeh gets worse', 'Khamosh Mehta gets worse'])
    // Titles are shortened for a step: no brackets.
    expect(planFor('isolation').watch[0].issue).toBe('sleep, mood')
  })

  it('one rule opens Emergency mode, and it says not to wait for Earth', () => {
    const urgent = STANDARD_RULES.filter((r) => r.emergency)
    expect(urgent.map((r) => r.id)).toEqual(['collapse'])
    expect(urgent[0].then).toContain('Do not wait for Earth')
  })

  it('travels as a message and reads back the same, for every scenario', () => {
    for (const id of SCENARIO_ORDER) {
      const p = planFor(id, 'Can we give a second dose at 60 min?')
      const body = planMessage(p)
      expect(body.length).toBeLessThan(4000)
      expect(readPlan(body)).toEqual(p)
    }
  })

  it('ignores other messages and broken plans', () => {
    expect(readPlan('Hello Earth')).toBeNull()
    expect(readPlan('BLACKOUT PLAN v1\nnot json')).toBeNull()
    const p = planFor('flagged')
    expect(readPlan(planMessage({ ...p, question: 'x'.repeat(501) }))).toBeNull()
    expect(readPlan(planMessage({ ...p, steps: [{ id: 'late', at: 200, text: 'After the blackout' }] }))).toBeNull()
  })

  it('the approval names the plan and carries the instructions', () => {
    const a = readApproval(approvalMessage('bp-1', '  Second dose at 60 min if still above 38 C.  '))
    expect(a).toEqual({ planId: 'bp-1', note: 'Second dose at 60 min if still above 38 C.' })
    expect(approvalMessage('bp-1', '')).toContain('No changes.')
    expect(readApproval(approvalMessage('bp-1', 'y'.repeat(900)))?.note).toHaveLength(600)
    expect(readApproval('Blackout plan approved.')).toBeNull()
  })
})

describe('during the blackout', () => {
  const p = planFor('flagged')

  it('shows one step at a time: the earliest step due and not done', () => {
    expect(dueStep(p, {}, 0)?.id).toBe('s0')
    expect(dueStep(p, { s0: 1 }, 5)).toBeUndefined()
    expect(upcomingStep(p, { s0: 1 }, 5)?.id).toBe('s15')
    // Skipped ahead: the missed steps come first, in order.
    expect(dueStep(p, { s0: 1 }, 47)?.id).toBe('s15')
    expect(dueStep(p, { s0: 1, s15: 47, s30: 48 }, 48)?.id).toBe('s45')
    expect(upcomingStep(p, { s0: 1, s15: 47, s30: 48 }, 48)?.id).toBe('s60')
  })

  it('counts minutes at one second each, with time skipped ahead, from 0 to 90', () => {
    expect(blackoutMinute(T0, 0, T0 - 5000)).toBe(0)
    expect(blackoutMinute(T0, 0, T0 + 30_000)).toBe(30)
    expect(blackoutMinute(T0, 15, T0 + 30_000)).toBe(45)
    expect(blackoutMinute(T0, 15, T0 + 500_000)).toBe(BLACKOUT_MIN)
    expect(blackoutEnd(T0, 15)).toBe(T0 + 75_000)
  })

  it('the last message before contact is lost, and the report when it returns', () => {
    expect(isStartMessage(startMessage(true))).toBe(true)
    expect(startMessage(true)).toContain('plan you approved')
    const log: LogEntry[] = [{ at: 22, text: 'Roya Alizadeh took a pain reliever.' }]
    const r = blackoutReport(p, { s0: 1, s15: 16 }, log, { by: 'surgeon', name: 'Flight surgeon', note: 'Recheck at 30 min.' }, 90)
    expect(isBlackoutReport(r)).toBe(true)
    expect(r).toContain('approved by the flight surgeon (instructions: Recheck at 30 min.)')
    expect(r).toContain('Steps done: 2 of 6.')
    expect(r).toContain('Done at 16 min: Check Roya Alizadeh')
    expect(r).toContain('Not done: Get the report ready')
    expect(r).toContain('22 min: Roya Alizadeh took a pain reliever.')
    expect(blackoutReport(p, {}, [], { by: 'none' }, 40)).toContain('contact is back after 40 of 90 minutes')
    expect(blackoutReport(p, {}, [], { by: 'none' }, 90)).toContain('not approved before contact was lost')
    expect(blackoutReport(p, {}, [], { by: 'auto' }, 90)).toContain('automatic answer')
  })

  it('a long log still fits in one message', () => {
    const log = Array.from({ length: 30 }, (_, k) => ({ at: k * 3, text: 'z'.repeat(MAX_LOG_TEXT + 100) }))
    expect(blackoutReport(p, {}, log, { by: 'auto' }, 90).length).toBeLessThan(4000)
  })
})
