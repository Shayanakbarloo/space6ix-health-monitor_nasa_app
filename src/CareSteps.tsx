import { motion } from 'motion/react'
import { ArrowSquareOut, Check, CheckCircle, Clock, ListChecks, NotePencil, PaperPlaneTilt, Pill, Siren, User, WifiSlash } from '@phosphor-icons/react'
import type { Message } from './api'
import { ALERT_BUTTON, CARE_STEPS, REVIEW_MS, ROUTINE, SCENARIO_CONTEXT, SIMULATED_REPLY, type CareStep, type StepSource } from './data/careSteps'
import type { LinkDelay } from './data/missions'
import { HAZARD_INFO } from './data/signalGuide'
import { SOURCES } from './data/sources'
import { FEVER_GONE_C, LIVE_SCENARIOS, isFixed, watchedFindings, type Care, type ScenarioId } from './live'
import { CABIN_ID, type Subject } from './model'
import type { CrewReading } from './triage'
import { Button, EASE, IconBadge } from './ui'

interface Props {
  scenario: ScenarioId
  /** The crew member with the problem, or the cabin for problems that affect everyone. */
  patient: Subject | undefined
  /** May this user see the patient's health data? */
  canSee: boolean
  reading: CrewReading | undefined
  care: Care
  now: number
  link: LinkDelay
  /** Messages from Earth that arrived after the alert. */
  replies: Message[]
  showingPatient: boolean
  onToggle: (stepId: string) => void
  onPill: () => void
  onAlert: () => void
  onCheckIn: () => void
  onEmergency: () => void
  onShowPatient: () => void
}

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const PANEL = 'mt-4 scroll-mt-24 rounded-2xl border border-line bg-panel px-6 py-6'
const LINK = 'text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink'
/** Lower-case the first letter, unless the word is an acronym such as CO2. */
const lc = (t: string) => (/^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t)

function Sources({ source }: { source?: StepSource | StepSource[] }) {
  const list = source === undefined ? [] : Array.isArray(source) ? source : [source]
  if (list.length === 0) return <p className="mt-1.5 text-xs text-dim">Demo wording, not medical guidance.</p>
  return (
    <p className="mt-1.5 text-xs text-dim">
      {list.length === 1 ? 'Source: ' : 'Sources: '}
      {list.map((s, i) => (
        <span key={s.url}>
          {i > 0 && '; '}
          <a href={s.url} target="_blank" rel="noreferrer" className={LINK}>
            {s.label}
          </a>
        </span>
      ))}
    </p>
  )
}

/** Why this happens: the NASA hazard behind the scenario, in plain words, with links to read more. */
function HazardWhy({ scenario }: { scenario: ScenarioId }) {
  const hazard = LIVE_SCENARIOS[scenario].hazard
  if (!hazard) return null
  const info = HAZARD_INFO[hazard]
  const more = (SCENARIO_CONTEXT[scenario] ?? []).map((id) => SOURCES[id]).filter((s) => s?.url)
  return (
    <div className="mt-4 rounded-xl border border-line bg-ground/60 p-4 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Why this happens</span>
        <a href={info.url} target="_blank" rel="noreferrer" className="press inline-flex items-center gap-1 rounded-full bg-accent-bg px-2.5 py-0.5 text-xs font-medium text-accent hover:underline">
          NASA hazard: {info.nasaName}
          <ArrowSquareOut size={12} />
        </a>
      </p>
      <p className="mt-2 leading-relaxed">{info.line}</p>
      {more.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-muted">
          {more.map((s) => (
            <li key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer" className={LINK}>
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The section under Live monitor: what to do, step by step, to fix the problem in this scenario. */
export default function CareSteps(props: Props) {
  const { scenario, patient, canSee, reading, care, now, link, replies, showingPatient } = props
  const sc = LIVE_SCENARIOS[scenario]
  const title = (
    <h2 id="steps-title" className="flex flex-wrap items-center gap-2.5 text-lg font-semibold">
      <IconBadge>
        <ListChecks size={18} weight="bold" />
      </IconBadge>
      Steps to fix
    </h2>
  )

  if (scenario === 'normal' || !patient) {
    return (
      <section id="steps" aria-labelledby="steps-title" className={PANEL}>
        {title}
        <div className="mt-3 rounded-xl bg-ok-bg p-4">
          <p className="flex items-center gap-2 font-semibold text-ok">
            <CheckCircle size={18} weight="fill" />
            Nothing to fix
          </p>
          <p className="mt-1 text-sm">Every astronaut is normal right now.</p>
        </div>
        <p className="mt-4 text-sm text-muted">Keep the routine going:</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
          {ROUTINE.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>
    )
  }

  if (!canSee) {
    return (
      <section id="steps" aria-labelledby="steps-title" className={PANEL}>
        {title}
        <p className={`mt-3 rounded-xl p-4 text-sm ${sc.level === 'red' ? 'bg-urgent-bg text-urgent' : 'bg-check-bg text-check'}`}>
          A crew member needs help. Their health data is private, so the medical officer sees who it is and has the steps.
        </p>
        <HazardWhy scenario={scenario} />
      </section>
    )
  }

  // Where each step stands right now.
  const isCabin = patient.id === CABIN_ID
  const who = isCabin ? 'Whole crew' : patient.name
  const alertAt = care.alert
  const deliveredAt = alertAt === undefined ? undefined : alertAt + link.demoMs
  const realReply = replies[replies.length - 1]
  const replyAt = alertAt === undefined ? undefined : alertAt + 2 * link.demoMs + REVIEW_MS
  const feverNow = reading?.bodyTempC
  const fixable = sc.clearWhen !== undefined
  const fixed = isFixed(scenario, patient)
  const state = (s: CareStep): { done: boolean; note?: string } => {
    switch (s.auto) {
      case 'fever':
        if (care.pill === undefined) return { done: false, note: feverNow === undefined ? undefined : `Now ${feverNow.toFixed(1)} C. Give the pill first.` }
        return feverNow !== undefined && feverNow < FEVER_GONE_C ? { done: true, note: `Back to ${feverNow.toFixed(1)} C.` } : { done: false, note: `Coming down: now ${feverNow?.toFixed(1)} C.` }
      case 'delivered':
        if (deliveredAt === undefined) return { done: false, note: 'Waiting for the alert.' }
        return now >= deliveredAt ? { done: true, note: `Reached Earth at ${time(deliveredAt)}. Ground control knows.` } : { done: false, note: `On its way: reaches Earth in ${Math.ceil((deliveredAt - now) / 1000)} s${link.compressed ? ` (${link.text} in real time)` : ''}.` }
      case 'reply':
        if (realReply) return { done: true, note: `Answer from ${realReply.from_name}.` }
        if (replyAt === undefined) return { done: false, note: 'Waiting for the message to Earth.' }
        return now >= replyAt ? { done: true, note: `Answer arrived at ${time(replyAt)}.` } : { done: false, note: `Earth is looking at it. Answer expected in about ${Math.ceil((replyAt - now) / 1000)} s.` }
      case 'clear': {
        const bad = watchedFindings(scenario, patient).filter((f) => f.level !== 'green')
        const nowText = !isCabin && reading ? `heart rate ${reading.restingHrBpm} bpm, blood pressure ${reading.systolicBp}/${reading.diastolicBp} mmHg` : bad.map((f) => f.measured).join('; ')
        if (bad.length === 0) return { done: true, note: isCabin ? `Back to normal: ${watchedFindings(scenario, patient).map((f) => f.measured).join('; ')}.` : `Back to normal: ${nowText}.` }
        return { done: false, note: `Now: ${nowText}.` }
      }
    }
    switch (s.action) {
      case 'pill':
        return care.pill === undefined ? { done: false } : { done: true, note: `Taken at ${time(care.pill)}.` }
      case 'alert':
        return alertAt === undefined ? { done: false } : { done: true, note: `Sent at ${time(alertAt)}.` }
      case 'checkin':
        return patient.manual ? { done: true, note: 'Check-in saved for today.' } : { done: care[s.id] !== undefined }
    }
    const at = care[s.id]
    return at === undefined ? { done: false } : { done: true, note: s.doneNote ?? `Done at ${time(at)}.` }
  }

  const steps = CARE_STEPS[scenario]
  const states = steps.map(state)
  const doneCount = states.filter((s) => s.done).length
  const replied = states.some((st, i) => steps[i].auto === 'reply' && st.done)
  const red = sc.level === 'red'
  const status = fixed
    ? { text: 'Fixed', tone: 'bg-ok-bg text-ok' }
    : scenario === 'emergency'
      ? replied
        ? { text: "Earth's answer received", tone: 'bg-check-bg text-check' }
        : alertAt !== undefined
          ? { text: 'Waiting for Earth', tone: 'bg-urgent-bg text-urgent' }
          : { text: 'Act now', tone: 'bg-urgent-bg text-urgent' }
      : !fixable && doneCount === steps.length
        ? { text: 'Plan in place', tone: 'bg-ok-bg text-ok' }
        : doneCount === 0
          ? { text: red ? 'Act now' : 'To do', tone: red ? 'bg-urgent-bg text-urgent' : 'bg-check-bg text-check' }
          : { text: 'In progress', tone: red ? 'bg-urgent-bg text-urgent' : 'bg-check-bg text-check' }

  return (
    <section id="steps" aria-labelledby="steps-title" className={PANEL}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            {title}
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${status.tone}`}>{status.text}</span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {who}: {sc.problem ? lc(sc.problem) : ''}. {doneCount} of {steps.length} done.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!showingPatient && (
            <Button onClick={props.onShowPatient}>
              <User size={18} />
              {isCabin ? 'Show the cabin' : `Show ${patient.name}`}
            </Button>
          )}
          {scenario === 'emergency' && (
            <Button kind="danger" onClick={props.onEmergency}>
              <Siren size={18} weight="fill" />
              Timed emergency steps
            </Button>
          )}
        </div>
      </div>

      {sc.blackout && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-check-bg px-4 py-3 text-sm text-check">
          <WifiSlash size={18} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold">No contact with Earth.</span> <span className="text-ink">Contact home is paused for about two weeks. Messages and reports wait on board until contact returns.</span>
          </span>
        </p>
      )}

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-line">
        <motion.div className={`h-full origin-left rounded-full ${fixed ? 'bg-ok' : red ? 'bg-urgent' : 'bg-check'}`} animate={{ scaleX: doneCount / steps.length }} transition={{ duration: 0.4, ease: EASE }} />
      </div>

      <HazardWhy scenario={scenario} />

      <ol className="mt-4 space-y-2">
        {steps.map((s, i) => {
          const st = states[i]
          return (
            <li key={s.id} className={`flex flex-wrap items-start gap-x-4 gap-y-3 rounded-xl border p-4 transition-colors sm:flex-nowrap ${st.done ? 'border-line bg-ground/40' : 'border-line-strong'}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-sm ${st.done ? 'bg-ok text-ground' : 'border border-line-strong text-muted'}`} aria-hidden="true">
                {st.done ? <Check size={14} weight="bold" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1 basis-60">
                <p className={`font-medium ${st.done ? 'text-muted' : ''}`}>
                  {s.title}
                  <span className="sr-only">{st.done ? ' (done)' : ' (not done yet)'}</span>
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.detail}</p>
                {st.note && (
                  <p className={`mt-1.5 flex items-center gap-1.5 text-sm ${st.done ? 'text-ok' : 'text-check'}`}>
                    {st.done ? <CheckCircle size={15} weight="fill" className="shrink-0" /> : <Clock size={15} className="shrink-0" />}
                    {st.note}
                  </p>
                )}
                {s.auto === 'reply' && st.done && (
                  <blockquote className="mt-2 rounded-lg border-l-2 border-ink/60 bg-ground p-3 text-sm leading-relaxed">
                    {realReply ? realReply.body : SIMULATED_REPLY[scenario]}
                    {!realReply && <span className="mt-1 block text-xs text-dim">Automatic answer. A reply typed by the flight surgeon shows here instead.</span>}
                  </blockquote>
                )}
                <Sources source={s.source} />
              </div>
              <div className="flex shrink-0 sm:pl-2">
                {s.action === 'pill' && !st.done && (
                  <Button kind="primary" onClick={props.onPill}>
                    <Pill size={18} />
                    Mark as taken
                  </Button>
                )}
                {s.action === 'alert' && !st.done && (
                  <Button kind={red ? 'danger' : 'primary'} onClick={props.onAlert}>
                    <PaperPlaneTilt size={18} />
                    {ALERT_BUTTON[scenario] ?? 'Send to Earth'}
                  </Button>
                )}
                {s.action === 'checkin' && (
                  <Button onClick={props.onCheckIn}>
                    <NotePencil size={18} />
                    {st.done ? 'Update check-in' : 'Log check-in'}
                  </Button>
                )}
                {!s.action && !s.auto && (
                  <Button onClick={() => props.onToggle(s.id)} aria-pressed={st.done}>
                    {st.done ? 'Undo' : 'Mark done'}
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
