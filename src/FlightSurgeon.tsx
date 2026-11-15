import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowCounterClockwise, Check, CheckCircle, Clock, FastForward, Heartbeat, NotePencil, PaperPlaneTilt, Siren, WifiSlash } from '@phosphor-icons/react'
import type { Message } from './api'
import {
  BLACKOUT_MIN, MAX_LOG, MAX_LOG_TEXT, blackoutEnd, blackoutMinute, blackoutReport, buildPlan, dueStep, planMessage, planRules, readApproval, startMessage, upcomingStep,
  type ApprovedBy, type BlackoutPlan, type LogEntry, type PlanStep,
} from './data/blackoutPlan'
import { REVIEW_MS } from './data/careSteps'
import type { LinkDelay } from './data/missions'
import { CABIN_ID, type Subject } from './model'
import { Button, CAPS, EASE } from './ui'

// The Flight surgeon page: plan a 90-minute blackout with the flight surgeon, follow it while there is
// no contact with Earth, then report back. Saved in this browser, so a reload does not lose the blackout.

type Phase = 'plan' | 'sent' | 'blackout' | 'report'

interface Saved {
  phase: Phase
  plan: BlackoutPlan | null
  /** When the automatic answer arrives if no flight surgeon answers first. */
  answerAt: number | null
  startedAt: number | null
  skipMin: number
  /** Step id to the minute it was done. */
  done: Record<string, number>
  log: LogEntry[]
  /** Who had approved the plan when contact was lost. */
  approved: ApprovedBy
  /** The minute contact returned. */
  endedAt: number | null
  reportSent: boolean
}

const KEY = 'chm.blackout.v1'
const FRESH: Saved = { phase: 'plan', plan: null, answerAt: null, startedAt: null, skipMin: 0, done: {}, log: [], approved: { by: 'none' }, endedAt: null, reportSent: false }

function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null
    if (!s || !['plan', 'sent', 'blackout', 'report'].includes(s.phase)) return FRESH
    if (s.phase !== 'plan' && !s.plan) return FRESH
    if (s.phase === 'blackout' && typeof s.startedAt !== 'number') return FRESH
    return { ...FRESH, ...s }
  } catch {
    return FRESH
  }
}

interface Props {
  subjects: Subject[]
  messages: Message[]
  link: LinkDelay
  /** Earth is already out of reach (Mars behind the Sun), so nothing can be sent. */
  contactLost: boolean
  send: (body: string, kind: 'message' | 'report', okMessage?: string) => Promise<boolean>
  /** Tells the app when contact is lost, so nothing is sent to Earth until it returns. */
  onBlackout: (window: { start: number; end: number } | null) => void
  onEmergency: () => void
  onOpenLive: (crewId?: string) => void
}

const CARD = 'rounded-2xl border border-line bg-panel p-5 sm:p-6'
const secs = (ms: number) => Math.max(0, Math.ceil(ms / 1000))

export default function FlightSurgeon({ subjects, messages, link, contactLost, send, onBlackout, onEmergency, onOpenLive }: Props) {
  const [s, setS] = useState<Saved>(load)
  const [question, setQuestion] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // Keep it in this browser.
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
    } catch {
      // Storage blocked: the plan lasts until the tab reloads.
    }
  }, [s])

  // The clock only needs to move while waiting for an answer or during the blackout.
  useEffect(() => {
    if (s.phase !== 'sent' && s.phase !== 'blackout') return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [s.phase])

  const minute = s.phase === 'blackout' && s.startedAt !== null ? blackoutMinute(s.startedAt, s.skipMin, now) : 0

  // Contact returns after 90 minutes.
  useEffect(() => {
    if (s.phase === 'blackout' && minute >= BLACKOUT_MIN) setS((x) => ({ ...x, phase: 'report', endedAt: BLACKOUT_MIN }))
  }, [s.phase, minute])

  // Tell the app while contact is lost.
  useEffect(() => {
    onBlackout(s.phase === 'blackout' && s.startedAt !== null ? { start: s.startedAt, end: blackoutEnd(s.startedAt, s.skipMin) } : null)
  }, [s.phase, s.startedAt, s.skipMin, onBlackout])

  const preview = useMemo(() => buildPlan(subjects, 'preview', question), [subjects, question])

  // The flight surgeon's answer to this plan, if one has arrived. Messages are newest first.
  const answer = useMemo(() => {
    if (!s.plan) return null
    for (const m of messages) {
      const a = m.side === 'earth' ? readApproval(m.body) : null
      if (a && a.planId === s.plan.id) return { name: m.from_name, note: a.note }
    }
    return null
  }, [messages, s.plan])
  const approvedNow: ApprovedBy = answer ? { by: 'surgeon', ...answer } : s.answerAt !== null && now >= s.answerAt ? { by: 'auto' } : { by: 'none' }

  const sendPlan = async () => {
    const plan = buildPlan(subjects, `bp-${Date.now().toString(36)}`, question)
    setBusy(true)
    const ok = await send(planMessage(plan), 'report', 'Plan sent to the flight surgeon.')
    setBusy(false)
    if (!ok) return
    setNow(Date.now())
    setS({ ...FRESH, phase: 'sent', plan, answerAt: Date.now() + 2 * link.demoMs + REVIEW_MS })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const start = async (plan: BlackoutPlan, approved: ApprovedBy) => {
    setBusy(true)
    // The last message before contact is lost.
    if (!contactLost) await send(startMessage(approved.by !== 'none'), 'message')
    setBusy(false)
    const t = Date.now()
    setNow(t)
    setS({ ...FRESH, phase: 'blackout', plan, startedAt: t, approved })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const report = s.plan ? blackoutReport(s.plan, s.done, s.log, s.approved, s.endedAt ?? BLACKOUT_MIN) : ''
  const sendReport = async () => {
    setBusy(true)
    const ok = await send(report, 'report', 'Report sent. See Contact home for when it arrives.')
    setBusy(false)
    if (ok) setS((x) => ({ ...x, reportSent: true }))
  }

  const reset = () => {
    setS(FRESH)
    setQuestion('')
    setNote('')
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Flight surgeon</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
          Plan a {BLACKOUT_MIN}-minute blackout, when there is no contact with Earth. Agree the steps with the flight surgeon first, and this page tells you what to do next while you are on your own.
        </p>
      </div>

      <Stepper phase={s.phase} />

      {s.phase === 'plan' && (
        <section className={CARD} aria-labelledby="plan-title">
          <h2 id="plan-title" className="text-lg font-semibold tracking-tight">
            Your plan
          </h2>
          <p className="mt-1 text-sm text-muted">Made from Live monitor right now. Send it before contact is lost.</p>
          <PlanView plan={preview} />
          <div className="mt-5 border-t border-line pt-5">
            {contactLost ? (
              <>
                <p className="flex items-start gap-2 rounded-xl bg-check-bg px-4 py-3 text-sm text-check">
                  <WifiSlash size={18} className="mt-0.5 shrink-0" />
                  <span className="text-ink">There is no contact with Earth right now (Mars is behind the Sun), so the plan cannot be sent. You can still follow it.</span>
                </p>
                <Button kind="primary" className="mt-3" disabled={busy} onClick={() => void start(buildPlan(subjects, `bp-${Date.now().toString(36)}`, question), { by: 'none' })}>
                  <WifiSlash size={18} />
                  Start the blackout
                </Button>
              </>
            ) : (
              <>
                <label className="block text-sm">
                  <span className="font-medium">Question or note for the flight surgeon</span> <span className="text-dim">(optional)</span>
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    maxLength={500}
                    rows={2}
                    placeholder="For example: can we give a second dose at 60 minutes if the fever is still high?"
                    className="mt-1.5 w-full resize-none rounded-xl border border-line-strong bg-ground px-3 py-2 text-sm text-ink placeholder:text-dim focus:border-ink"
                  />
                </label>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Button kind="primary" disabled={busy} onClick={() => void sendPlan()}>
                    <PaperPlaneTilt size={18} />
                    Send plan to the flight surgeon
                  </Button>
                  <p className="text-sm text-muted">
                    It reaches Earth in {link.text}
                    {link.compressed ? ` (${secs(link.demoMs)} s here)` : ''}.
                  </p>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {s.phase === 'sent' && s.plan && (
        <>
          <section className={CARD} aria-labelledby="answer-title">
            <h2 id="answer-title" className="text-lg font-semibold tracking-tight">
              {approvedNow.by === 'none' ? 'Waiting for the flight surgeon' : 'The plan is approved'}
            </h2>
            {approvedNow.by === 'none' ? (
              <p role="status" className="mt-2 flex items-center gap-2 text-sm text-check">
                <Clock size={16} className="shrink-0" />
                The answer takes at least {link.compressed ? `${link.minutes * 2} minutes` : 'a few seconds'}. Expected in about {secs((s.answerAt ?? now) - now)} s.
              </p>
            ) : (
              <div role="status" className="mt-3 rounded-xl bg-ok-bg px-4 py-3 text-sm">
                <p className="flex items-center gap-2 font-medium text-ok">
                  <CheckCircle size={18} weight="fill" className="shrink-0" />
                  {approvedNow.by === 'surgeon' ? 'Approved by the flight surgeon' : 'Approved, no changes'}
                </p>
                {approvedNow.by === 'surgeon' && approvedNow.note && <p className="mt-1.5 text-ink">Instructions: {approvedNow.note}</p>}
                {approvedNow.by === 'auto' && <p className="mt-1 text-xs text-muted">Automatic answer. A flight surgeon signed in on Earth can approve it and add instructions instead.</p>}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button kind="primary" disabled={busy} onClick={() => s.plan && void start(s.plan, approvedNow)}>
                <WifiSlash size={18} />
                Start the blackout
              </Button>
              <Button kind="ghost" onClick={reset}>
                <ArrowCounterClockwise size={18} />
                Change the plan
              </Button>
            </div>
            <p className="mt-2 text-xs text-dim">
              {approvedNow.by === 'none' ? 'You can start before the answer arrives. ' : ''}One second here plays one minute of the blackout.
            </p>
          </section>
          <section className={CARD} aria-label="The plan">
            <h2 className="text-lg font-semibold tracking-tight">The plan</h2>
            <PlanView plan={s.plan} />
          </section>
        </>
      )}

      {s.phase === 'blackout' && s.plan && (
        <Blackout
          plan={s.plan}
          minute={minute}
          done={s.done}
          log={s.log}
          approved={s.approved}
          note={note}
          setNote={setNote}
          onDone={(id) => setS((x) => ({ ...x, done: { ...x.done, [id]: Math.round(minute * 10) / 10 } }))}
          onLog={() => {
            const text = note.trim()
            if (!text) return
            setS((x) => ({ ...x, log: [...x.log, { at: Math.round(minute * 10) / 10, text: text.slice(0, MAX_LOG_TEXT) }].slice(0, MAX_LOG) }))
            setNote('')
          }}
          onSkip={() => setS((x) => ({ ...x, skipMin: x.skipMin + Math.min(15, BLACKOUT_MIN - minute) }))}
          onEnd={() => setS((x) => ({ ...x, phase: 'report', endedAt: Math.round(minute) }))}
          onEmergency={onEmergency}
          onOpenLive={onOpenLive}
        />
      )}

      {s.phase === 'report' && s.plan && (
        <section className={CARD} aria-labelledby="report-title">
          <h2 id="report-title" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <CheckCircle size={22} weight="fill" className="text-ok" />
            Contact with Earth is back
          </h2>
          <p className="mt-1 text-sm text-muted">
            {s.plan.steps.filter((x) => s.done[x.id] !== undefined).length} of {s.plan.steps.length} steps done, {s.log.length} {s.log.length === 1 ? 'note' : 'notes'} in the log. Send the report so the flight surgeon knows what happened.
          </p>
          <p className="mt-4 max-h-[42dvh] overflow-y-auto rounded-xl bg-ground p-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-muted">{report}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {s.reportSent ? (
              <p role="status" className="flex items-center gap-2 text-sm text-ok">
                <CheckCircle size={16} weight="fill" />
                Report sent. See Contact home for when it arrives.
              </p>
            ) : (
              <Button kind="primary" disabled={busy} onClick={() => void sendReport()}>
                <PaperPlaneTilt size={18} />
                Send report to the flight surgeon
              </Button>
            )}
            <Button kind={s.reportSent ? 'primary' : 'ghost'} onClick={reset}>
              <ArrowCounterClockwise size={18} />
              Plan the next blackout
            </Button>
          </div>
        </section>
      )}
    </main>
  )
}

const STEPS: { label: string; short: string; phases: Phase[] }[] = [
  { label: 'Plan with the flight surgeon', short: 'Plan', phases: ['plan', 'sent'] },
  { label: `Blackout: ${BLACKOUT_MIN} minutes`, short: 'Blackout', phases: ['blackout'] },
  { label: 'Report back', short: 'Report', phases: ['report'] },
]

function Stepper({ phase }: { phase: Phase }) {
  const at = STEPS.findIndex((x) => x.phases.includes(phase))
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Blackout steps">
      {STEPS.map((x, i) => (
        <li
          key={x.label}
          aria-current={i === at ? 'step' : undefined}
          className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-sm sm:gap-3 sm:px-4 sm:py-3 ${i === at ? 'border-ink bg-panel font-medium text-ink' : i < at ? 'border-line bg-panel text-muted' : 'border-line text-dim'}`}
        >
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[12px] sm:h-7 sm:w-7 sm:text-[13px] ${i < at ? 'bg-ok text-white' : i === at ? 'bg-ink text-white' : 'border border-line-strong'}`} aria-hidden="true">
            {i < at ? <Check size={14} weight="bold" /> : i + 1}
          </span>
          <span className="sm:hidden">{x.short}</span>
          <span className="hidden sm:inline">{x.label}</span>
        </li>
      ))}
    </ol>
  )
}

/** The plan: who to watch, the steps, and what to do if something happens. */
function PlanView({ plan }: { plan: BlackoutPlan }) {
  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div>
        <p className={CAPS}>Steps</p>
        <ol className="mt-2 space-y-2">
          {plan.steps.map((x) => (
            <li key={x.id} className="flex gap-3 rounded-xl border border-line px-3 py-2.5 text-sm">
              <span className="w-14 shrink-0 font-mono text-muted">{x.at} min</span>
              <span className="leading-relaxed">{x.text}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="space-y-5">
        <div>
          <p className={CAPS}>To watch</p>
          {plan.watch.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Everyone is normal.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm">
              {plan.watch.map((w) => (
                <li key={w.id}>
                  <span className="font-medium">{w.name}</span> <span className="text-muted">· {w.issue}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Rules plan={plan} />
        {plan.question && (
          <div>
            <p className={CAPS}>Question for the flight surgeon</p>
            <p className="mt-2 text-sm leading-relaxed">{plan.question}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Rules({ plan, onEmergency }: { plan: BlackoutPlan; onEmergency?: () => void }) {
  return (
    <div>
      <p className={CAPS}>If this happens</p>
      <ul className="mt-2 space-y-2.5 text-sm">
        {planRules(plan).map((r) => (
          <li key={r.id} className={r.emergency ? 'rounded-xl bg-urgent-bg/60 p-3' : ''}>
            <p className="font-medium">{r.when}</p>
            <p className="mt-0.5 leading-relaxed text-muted">{r.then}</p>
            {r.emergency && onEmergency && (
              <Button kind="danger" className="mt-2" onClick={onEmergency}>
                <Siren size={18} weight="fill" />
                Open Emergency mode
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

interface BlackoutProps {
  plan: BlackoutPlan
  minute: number
  done: Record<string, number>
  log: LogEntry[]
  approved: ApprovedBy
  note: string
  setNote: (v: string) => void
  onDone: (stepId: string) => void
  onLog: () => void
  onSkip: () => void
  onEnd: () => void
  onEmergency: () => void
  onOpenLive: (crewId?: string) => void
}

/** During the blackout: the time left, the one step to do now, what to do if, and a log. */
function Blackout({ plan, minute, done, log, approved, note, setNote, onDone, onLog, onSkip, onEnd, onEmergency, onOpenLive }: BlackoutProps) {
  const due = dueStep(plan, done, minute)
  const next = upcomingStep(plan, done, minute)
  const left = Math.max(0, Math.ceil(BLACKOUT_MIN - minute))
  // A step about a person opens that person on Live monitor.
  const personFor = (step: PlanStep) => plan.watch.find((w) => w.id !== CABIN_ID && step.text.includes(w.name))?.id
  const opensLive = (step: PlanStep) => personFor(step) !== undefined || step.text.includes('Live monitor')
  return (
    <>
      <section className="rounded-2xl border border-check/25 bg-check-bg p-5 sm:p-6" aria-label="Blackout time">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-panel text-check">
              <WifiSlash size={22} weight="bold" />
            </span>
            <div>
              <p className="font-semibold">No contact with Earth</p>
              <p className="text-sm text-ink/75">Nothing can be sent or received. One second here plays one minute.</p>
            </div>
          </div>
          <p className="flex items-baseline gap-1.5" role="timer" aria-live="off">
            <span className="font-mono text-4xl font-medium tabular-nums">{left}</span>
            <span className="text-sm text-ink/75">min left</span>
          </p>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-panel">
          <div className="h-full origin-left rounded-full bg-check transition-transform duration-500 ease-linear" style={{ transform: `scaleX(${minute / BLACKOUT_MIN})` }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs text-ink/70">
            {Math.floor(minute)} of {BLACKOUT_MIN} min
          </span>
          <span className="flex flex-wrap gap-1">
            <Button kind="ghost" className="min-h-9 text-ink/80" onClick={onSkip}>
              <FastForward size={16} />
              Skip ahead 15 min
            </Button>
            <Button kind="ghost" className="min-h-9 text-ink/80" onClick={onEnd}>
              Contact is back
            </Button>
          </span>
        </div>
      </section>

      <section className="rounded-2xl border-2 border-ink bg-panel p-5 sm:p-6" aria-labelledby="do-now" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={due?.id ?? 'none'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25, ease: EASE }}>
            <p id="do-now" className={CAPS}>
              {due ? `Do now · ${due.at} min` : 'Do now'}
            </p>
            {due ? (
              <>
                <p className="mt-2 text-xl leading-snug font-semibold tracking-tight">{due.text}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button kind="primary" onClick={() => onDone(due.id)}>
                    <Check size={18} weight="bold" />
                    Done
                  </Button>
                  {opensLive(due) && (
                    <Button onClick={() => onOpenLive(personFor(due))}>
                      <Heartbeat size={18} />
                      Open Live monitor
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-xl font-semibold tracking-tight">Nothing to do right now.</p>
                <p className="mt-1 text-sm text-muted">{next ? `Next, at ${next.at} min: ${next.text}` : 'Every step is done. Wait for contact to return.'}</p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
        {approved.by === 'surgeon' && approved.note && (
          <blockquote className="mt-4 rounded-lg border-l-2 border-ink/60 bg-ground p-3 text-sm leading-relaxed">
            <span className="font-medium">{approved.name}:</span> {approved.note}
          </blockquote>
        )}
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className={CARD} aria-label="If this happens">
          <Rules plan={plan} onEmergency={onEmergency} />
        </section>

        <section className={CARD} aria-labelledby="log-title">
          <p id="log-title" className={CAPS}>
            Log
          </p>
          <p className="mt-1 text-sm text-muted">Write down anything that happens, with what was given and when. It goes in the report.</p>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              onLog()
            }}
          >
            <label className="flex-1">
              <span className="sr-only">What happened</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={MAX_LOG_TEXT}
                disabled={log.length >= MAX_LOG}
                placeholder={log.length >= MAX_LOG ? 'The log is full' : 'For example: Roya Alizadeh took a pain reliever'}
                className="min-h-11 w-full rounded-xl border border-line-strong bg-ground px-3 text-sm text-ink placeholder:text-dim focus:border-ink disabled:opacity-60"
              />
            </label>
            <Button type="submit" disabled={!note.trim() || log.length >= MAX_LOG}>
              <NotePencil size={18} />
              Add
            </Button>
          </form>
          {log.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {[...log].reverse().map((l, i) => (
                <li key={`${l.at}-${i}`} className="flex gap-3">
                  <span className="w-14 shrink-0 font-mono text-muted">{Math.round(l.at)} min</span>
                  <span className="leading-relaxed">{l.text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={CARD} aria-label="All steps">
        <p className={CAPS}>All steps</p>
        <ol className="mt-2 space-y-2">
          {plan.steps.map((x) => {
            const at = done[x.id]
            const isDue = x.id === due?.id
            return (
              <li key={x.id} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${isDue ? 'border-ink' : 'border-line'} ${at !== undefined ? 'bg-ground/50' : ''}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${at !== undefined ? 'bg-ok text-white' : isDue ? 'bg-ink text-white' : 'border border-line-strong'}`} aria-hidden="true">
                  {at !== undefined ? <Check size={12} weight="bold" /> : null}
                </span>
                <span className="w-14 shrink-0 font-mono text-muted">{x.at} min</span>
                <span className={`flex-1 leading-relaxed ${at !== undefined ? 'text-muted' : ''}`}>{x.text}</span>
                <span className="shrink-0 text-xs text-muted">{at !== undefined ? `Done at ${Math.round(at)} min` : isDue ? 'Now' : x.at > minute ? '' : 'Due'}</span>
              </li>
            )
          })}
        </ol>
      </section>
    </>
  )
}
