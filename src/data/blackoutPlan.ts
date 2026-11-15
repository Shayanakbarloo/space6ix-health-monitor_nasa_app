// A planned blackout: 90 minutes with no contact with Earth.
//   1. Plan: before contact is lost, the crew sends a plan and the flight surgeon approves it.
//   2. Blackout: the app shows the next step when it is due, and what to do if something happens.
//   3. Report: when contact returns, the crew sends what happened.
// The plan, the approval and the report travel as messages through Contact home.

import { CABIN_ID, type Subject } from '../model.ts'

export const BLACKOUT_MIN = 90
/** The demo plays one minute of the blackout as one second. */
export const DEMO_MS_PER_MIN = 1000

export interface Watch {
  id: string
  name: string
  issue: string
}

export interface PlanStep {
  id: string
  /** Minutes into the blackout. */
  at: number
  text: string
}

export interface IfRule {
  id: string
  when: string
  then: string
  /** Offer the Emergency button with this rule. */
  emergency?: boolean
}

export interface BlackoutPlan {
  id: string
  /** Crew members (and the cabin) with something flagged when the plan was made. */
  watch: Watch[]
  steps: PlanStep[]
  /** The crew's question or note for the flight surgeon. */
  question: string
}

export interface LogEntry {
  /** Minutes into the blackout. */
  at: number
  text: string
}

export const PLAN_PREFIX = 'BLACKOUT PLAN v1'
export const APPROVAL_PREFIX = 'BLACKOUT PLAN APPROVED v1'
export const START_PREFIX = 'BLACKOUT STARTED'
export const REPORT_PREFIX = 'BLACKOUT REPORT'

const MAX_ISSUE = 120
const MAX_QUESTION = 500
const MAX_NOTE = 600
/** Log limits, so the report fits in one message. */
export const MAX_LOG = 10
export const MAX_LOG_TEXT = 240

const lower = (t: string) => (/^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t)
const cut = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 3).trimEnd()}...` : t)
/** A finding's title, short enough for a step: "Sleep (7-day average)" becomes "sleep", "Cabin CO2" becomes "CO2". */
const short = (title: string) => lower(title.replace(/\s*\([^)]*\)/g, '').replace(/^Cabin /, '').replace(/ now$/, '').trim())
/** "A", "A and B", "A, B and C". */
const and = (list: string[]) => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`)

/** The rules every plan has, agreed with the flight surgeon with the plan. */
export const STANDARD_RULES: IfRule[] = [
  { id: 'collapse', when: 'Someone collapses, has chest pain or cannot breathe normally', then: 'Open Emergency mode now and follow it. Do not wait for Earth.', emergency: true },
  { id: 'headache', when: 'Someone has a headache', then: 'Check cabin CO2 on Live monitor. Above 2.5 mmHg, turn up the airflow. A pain reliever from the medical kit, at the dose on the label.' },
  { id: 'fever', when: 'A temperature of 38 C or more', then: 'A fever reliever from the medical kit at the label dose, water and rest. Check the temperature again after 30 minutes.' },
  { id: 'dizzy', when: 'Someone is dizzy or feels faint', then: 'Sit or lie down with the legs up and drink water with salt. Check heart rate and blood pressure again.' },
  { id: 'radiation', when: 'The radiation alarm sounds', then: 'Everyone into the storm shelter. Stay until the dose rate is back under the caution level.' },
  { id: 'other', when: 'Anything else', then: 'The medical officer decides, using Ask and Emergency mode. Write it in the log so the flight surgeon sees it later.' },
]

/** The people (not the cabin) being watched. */
const people = (p: BlackoutPlan) => p.watch.filter((w) => w.id !== CABIN_ID)

/** The plan's rules: one for each person being watched, then the standard rules. */
export function planRules(p: BlackoutPlan): IfRule[] {
  return [
    ...people(p)
      .slice(0, 2)
      .map((w): IfRule => ({ id: `worse-${w.id}`, when: `${w.name} gets worse`, then: 'Follow their steps on Live monitor. If it becomes urgent, open Emergency mode.' })),
    ...STANDARD_RULES,
  ]
}

/** A plan made from how the crew is right now. */
export function buildPlan(subjects: Subject[], id: string, question = ''): BlackoutPlan {
  const watch: Watch[] = subjects
    .filter((s) => s.findings.some((f) => f.level !== 'green'))
    .slice(0, 4)
    .map((s) => ({
      id: s.id,
      name: s.id === CABIN_ID ? 'Cabin' : s.name,
      issue: cut(
        s.findings
          .filter((f) => f.level !== 'green')
          .map((f) => short(f.title))
          .join(', '),
        MAX_ISSUE,
      ),
    }))
  const crew = watch.filter((w) => w.id !== CABIN_ID)
  const names = and(crew.map((w) => w.name))
  const cabin = watch.some((w) => w.id === CABIN_ID)
  const steps: PlanStep[] = [
    { id: 's0', at: 0, text: 'Contact is lost. The medical officer is in charge. Everyone does a quick check-in.' },
    { id: 's15', at: 15, text: crew.length > 0 ? `Check ${and(crew.map((w) => `${w.name} (${w.issue})`))} again.` : 'Quick look at everyone: is anyone unwell?' },
    { id: 's30', at: 30, text: cabin ? 'Check the cabin on Live monitor and follow its steps.' : 'Check the cabin on Live monitor: air and radiation.' },
    { id: 's45', at: 45, text: crew.length > 0 ? `Check ${names} again. Write any change in the log.` : 'Everyone: drink water and keep to the plan for the day.' },
    { id: 's60', at: 60, text: 'Everyone: a short check-in. Write anything new in the log.' },
    { id: 's80', at: 80, text: 'Get the report ready: what happened, what was given and when.' },
  ]
  return { id, watch, steps, question: question.trim().slice(0, MAX_QUESTION) }
}

/** The step to do now: the earliest step that is due and not done. */
export function dueStep(p: BlackoutPlan, done: Record<string, number>, minute: number): PlanStep | undefined {
  return p.steps.filter((s) => s.at <= minute && done[s.id] === undefined).sort((a, b) => a.at - b.at)[0]
}

/** The next step that is not due yet. */
export function upcomingStep(p: BlackoutPlan, done: Record<string, number>, minute: number): PlanStep | undefined {
  return p.steps.filter((s) => s.at > minute && done[s.id] === undefined).sort((a, b) => a.at - b.at)[0]
}

/** Minutes into the blackout, from when it started and any time skipped ahead. */
export function blackoutMinute(startedAt: number, skipMin: number, now: number): number {
  return Math.min(BLACKOUT_MIN, Math.max(0, (now - startedAt) / DEMO_MS_PER_MIN + skipMin))
}

/** When the blackout ends, on this device's clock. */
export const blackoutEnd = (startedAt: number, skipMin: number) => startedAt + (BLACKOUT_MIN - skipMin) * DEMO_MS_PER_MIN

/** One line about who is being watched. */
export function watchLine(p: BlackoutPlan): string {
  return p.watch.length > 0 ? `To watch: ${p.watch.map((w) => `${w.name} (${w.issue})`).join('; ')}.` : 'Everyone is normal.'
}

/** The plan as people read it. */
export function planText(p: BlackoutPlan): string {
  return [
    `Blackout plan: ${BLACKOUT_MIN} minutes without contact with Earth. Please approve, and add any instructions.`,
    watchLine(p),
    'Steps:',
    ...p.steps.map((s) => `  ${s.at} min: ${s.text}`),
    'If this happens:',
    ...planRules(p).map((r) => `  ${r.when}: ${r.then}`),
    ...(p.question ? [`Question from the crew: ${p.question}`] : []),
  ].join('\n')
}

/** The plan as a message: a line the app reads, then the text for people. */
export function planMessage(p: BlackoutPlan): string {
  return `${PLAN_PREFIX}\n${JSON.stringify(p)}\n\n${planText(p)}`
}

const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max

export function readPlan(body: string): BlackoutPlan | null {
  if (!body.startsWith(`${PLAN_PREFIX}\n`)) return null
  try {
    const p = JSON.parse(body.split('\n')[1]) as BlackoutPlan
    const ok =
      isText(p.id, 40) &&
      isText(p.question, MAX_QUESTION) &&
      Array.isArray(p.watch) &&
      p.watch.length <= 4 &&
      p.watch.every((w) => isText(w.id, 20) && isText(w.name, 40) && isText(w.issue, MAX_ISSUE)) &&
      Array.isArray(p.steps) &&
      p.steps.length <= 12 &&
      p.steps.every((s) => isText(s.id, 20) && typeof s.at === 'number' && s.at >= 0 && s.at <= BLACKOUT_MIN && isText(s.text, 400))
    return ok ? { id: p.id, watch: p.watch, steps: p.steps, question: p.question } : null
  } catch {
    return null
  }
}

export interface Approval {
  planId: string
  /** The flight surgeon's instructions, if any. */
  note: string
}

export function approvalMessage(planId: string, note: string): string {
  const clean = note.trim().slice(0, MAX_NOTE)
  return `${APPROVAL_PREFIX}\n${JSON.stringify({ planId, note: clean })}\n\nBlackout plan approved.${clean ? ` Instructions: ${clean}` : ' No changes.'}`
}

export function readApproval(body: string): Approval | null {
  if (!body.startsWith(`${APPROVAL_PREFIX}\n`)) return null
  try {
    const a = JSON.parse(body.split('\n')[1]) as Approval
    return isText(a.planId, 40) && isText(a.note, MAX_NOTE) ? { planId: a.planId, note: a.note } : null
  } catch {
    return null
  }
}

/** The last message before contact is lost. */
export function startMessage(approved: boolean): string {
  return `${START_PREFIX}: this is our last message before the blackout. No contact for ${BLACKOUT_MIN} minutes. We follow the ${approved ? 'plan you approved' : 'plan we sent'} and report when contact returns.`
}

export const isStartMessage = (body: string) => body.startsWith(`${START_PREFIX}:`)
export const isBlackoutReport = (body: string) => body.startsWith(`${REPORT_PREFIX}:`)

/** Who approved the plan before the blackout: the flight surgeon, the automatic answer, or no one yet. */
export type ApprovedBy = { by: 'surgeon'; name: string; note: string } | { by: 'auto' } | { by: 'none' }

/** The report sent when contact returns. */
export function blackoutReport(p: BlackoutPlan, done: Record<string, number>, log: LogEntry[], approved: ApprovedBy, endedAt: number): string {
  const doneSteps = p.steps.filter((s) => done[s.id] !== undefined)
  const missed = p.steps.filter((s) => done[s.id] === undefined)
  const approval = approved.by === 'surgeon' ? `approved by the flight surgeon${approved.note ? ` (instructions: ${approved.note})` : ''}` : approved.by === 'auto' ? 'approved (automatic answer)' : 'not approved before contact was lost'
  const text = [
    `${REPORT_PREFIX}: contact is back after ${Math.round(endedAt)} of ${BLACKOUT_MIN} minutes.`,
    `Plan: ${approval}.`,
    watchLine(p).replace('To watch:', 'Watched:'),
    `Steps done: ${doneSteps.length} of ${p.steps.length}.`,
    ...doneSteps.map((s) => `  Done at ${Math.round(done[s.id])} min: ${s.text}`),
    ...missed.map((s) => `  Not done: ${s.text}`),
    log.length > 0 ? 'What happened:' : 'Nothing else happened.',
    ...log.slice(0, MAX_LOG).map((l) => `  ${Math.round(l.at)} min: ${cut(l.text, MAX_LOG_TEXT)}`),
  ].join('\n')
  return cut(text, 3990)
}
