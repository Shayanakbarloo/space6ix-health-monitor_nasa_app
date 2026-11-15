import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle, Clock, PaperPlaneTilt, WifiSlash } from '@phosphor-icons/react'
import type { Message } from './api'
import {
  BLACKOUT_MIN, DEMO_MS_PER_MIN, START_PREFIX, approvalMessage, isBlackoutReport, isStartMessage, planRules, readApproval, readPlan, watchLine, REPORT_PREFIX, type BlackoutPlan,
} from './data/blackoutPlan'
import { MISSIONS, linkDelay, sayDelay, type MissionId } from './data/missions'
import { Button, CAPS, EASE } from './ui'

interface Props {
  side: 'ship' | 'earth'
  day: number
  mission: MissionId
  messages: Message[]
  /** Server clock minus this device's clock, in ms. */
  skew: number
  onSend: (body: string) => Promise<boolean>
  /** No contact with Earth: Mars is behind the Sun, or a planned blackout that ends at `until`. Sending is paused. */
  blackout?: 'conjunction' | { until: number }
}

const KIND_LABEL: Record<Message['kind'], string> = { message: 'Message', report: 'Health report', emergency: 'Emergency record' }

/** Blackout plans, approvals and reports have their own label. */
function labelOf(m: Message): string {
  if (readPlan(m.body)) return 'Blackout plan'
  if (readApproval(m.body)) return 'Plan approved'
  if (isStartMessage(m.body)) return 'Last message before the blackout'
  if (isBlackoutReport(m.body)) return 'Blackout report'
  return KIND_LABEL[m.kind]
}

const TOGGLE = 'press mt-2 min-h-9 text-xs text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink'

interface BodyProps {
  m: Message
  open: boolean
  onToggle: () => void
  /** The flight surgeon can approve a plan from the crew. */
  canApprove: boolean
  approved: boolean
  onApprove: (planId: string, note: string) => Promise<boolean>
}

/** Long reports show a short summary first, so the thread stays readable. */
function Body({ m, open, onToggle, canApprove, approved, onApprove }: BodyProps) {
  const plan = readPlan(m.body)
  if (plan) return <PlanBody plan={plan} open={open} onToggle={onToggle} canApprove={canApprove} approved={approved} onApprove={onApprove} />
  const approval = readApproval(m.body)
  if (approval) return <p className="mt-1.5 text-sm leading-relaxed">{approval.note ? `Approved. Instructions: ${approval.note}` : 'Approved, no changes.'}</p>
  if (isStartMessage(m.body)) return <p className="mt-1.5 text-sm leading-relaxed">{m.body.slice(START_PREFIX.length + 2).replace(/^t/, 'T')}</p>
  if (m.kind === 'message') return <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">{m.body}</p>
  const lines = m.body.split('\n').filter((l) => l.trim())
  const flags = lines.filter((l) => /^\s*(CHECK|URGENT):/.test(l)).length
  const summary = isBlackoutReport(m.body)
    ? [lines[0].slice(REPORT_PREFIX.length + 2).replace(/^c/, 'C'), lines.find((l) => l.startsWith('Steps done'))].filter(Boolean).join(' ')
    : m.kind === 'report'
      ? flags === 0
        ? 'Nothing flagged.'
        : `${flags} flagged signal${flags === 1 ? '' : 's'}.`
      : lines.slice(1, 3).join(' ')
  return (
    <div className="mt-1.5">
      <p className="text-sm leading-relaxed">{summary}</p>
      {open && <p className="mt-2 max-h-[40dvh] overflow-y-auto rounded-lg bg-panel p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-muted">{m.body}</p>}
      <button onClick={onToggle} aria-expanded={open} className={TOGGLE}>
        {open ? 'Hide details' : 'Show full text'}
      </button>
    </div>
  )
}

/** A blackout plan from the crew. The flight surgeon approves it here, with any instructions. */
function PlanBody({ plan, open, onToggle, canApprove, approved, onApprove }: { plan: BlackoutPlan } & Omit<BodyProps, 'm'>) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="mt-1.5">
      <p className="text-sm leading-relaxed">
        {BLACKOUT_MIN} minutes without contact. {watchLine(plan)}
      </p>
      {plan.question && <p className="mt-1 text-sm leading-relaxed">Question: {plan.question}</p>}
      {open && (
        <div className="mt-2 space-y-3 rounded-lg bg-panel p-3 text-[13px] leading-relaxed">
          <div>
            <p className={CAPS}>Steps</p>
            <ul className="mt-1 space-y-1">
              {plan.steps.map((x) => (
                <li key={x.id} className="flex gap-2">
                  <span className="w-12 shrink-0 font-mono text-muted">{x.at} min</span>
                  <span>{x.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className={CAPS}>If this happens</p>
            <ul className="mt-1 space-y-1">
              {planRules(plan).map((r) => (
                <li key={r.id}>
                  <span className="font-medium">{r.when}:</span> <span className="text-muted">{r.then}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <button onClick={onToggle} aria-expanded={open} className={TOGGLE}>
        {open ? 'Hide the plan' : 'Show the full plan'}
      </button>
      {canApprove &&
        (approved ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-ok">
            <CheckCircle size={16} weight="fill" />
            You approved this plan.
          </p>
        ) : (
          <form
            className="mt-3 border-t border-line pt-3"
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              await onApprove(plan.id, note)
              setBusy(false)
            }}
          >
            <label className="block text-sm">
              <span className="font-medium">Instructions for the crew</span> <span className="text-dim">(optional)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={600}
                placeholder="For example: if the fever is still above 38 C at 60 minutes, give a second dose."
                className="mt-1.5 w-full resize-none rounded-xl border border-line-strong bg-panel px-3 py-2 text-sm text-ink placeholder:text-dim focus:border-ink"
              />
            </label>
            <Button kind="primary" type="submit" disabled={busy} className="mt-2">
              <CheckCircle size={18} />
              Approve plan
            </Button>
          </form>
        ))}
    </div>
  )
}

export default function EarthLink({ side, day, mission, messages, skew, onSend, blackout }: Props) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [, tick] = useState(0)
  const link = linkDelay(mission, day)
  const other = side === 'ship' ? 'Earth' : 'the ship'

  // Re-draw twice a second so the countdowns move.
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 500)
    return () => clearInterval(t)
  }, [])

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    setBusy(true)
    if (await onSend(draft.trim())) setDraft('')
    setBusy(false)
  }

  const [openId, setOpenId] = useState<number | null>(null)
  const thread = [...messages].reverse()
  // Plans the flight surgeon has already approved.
  const approvedPlans = new Set(messages.filter((m) => m.side === 'earth').map((m) => readApproval(m.body)?.planId).filter(Boolean))
  // On Earth: is the crew in a planned blackout? Their last message before it says when it began.
  const lastStart = side === 'earth' ? messages.find((m) => m.side === 'ship' && isStartMessage(m.body)) : undefined
  const back = lastStart !== undefined && messages.some((m) => m.side === 'ship' && m.id > lastStart.id && isBlackoutReport(m.body))
  const crewDarkUntil = lastStart && !back ? lastStart.sent_at - skew + BLACKOUT_MIN * DEMO_MS_PER_MIN : 0
  const crewDark = Date.now() < crewDarkUntil
  const paused = blackout !== undefined
  const plannedLeft = typeof blackout === 'object' ? Math.max(0, Math.ceil((blackout.until - Date.now()) / DEMO_MS_PER_MIN)) : 0
  const end = useRef<HTMLDivElement>(null)
  const newest = messages[0]?.id
  // Keep the newest message in view, like any chat.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [newest])

  return (
    <div className="mx-auto grid max-w-[1100px] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="h-fit rounded-2xl border border-line bg-panel p-5">
        <p className="text-sm text-muted">One-way signal delay today</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="font-mono text-4xl font-medium tabular-nums">{link.text.replace(/ (minutes|seconds|second)$/, '')}</span>
          <span className="text-muted">{link.text.match(/(minutes|seconds|second)$/)?.[0]}</span>
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {link.compressed ? (
            <>
              A question and its answer take at least <span className="text-ink">{link.minutes * 2} minutes</span>. The demo plays one minute of delay as one second.
            </>
          ) : (
            'Shown at its real speed.'
          )}{' '}
          {MISSIONS[mission].note}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-dim">
          Delay from:{' '}
          {MISSIONS[mission].delaySource.url ? (
            <a href={MISSIONS[mission].delaySource.url} target="_blank" rel="noreferrer" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
              {MISSIONS[mission].delaySource.label}
            </a>
          ) : (
            MISSIONS[mission].delaySource.label
          )}
          .
        </p>
        {side === 'ship' ? (
          <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed">
            While you wait, keep following the onboard steps. In an emergency, act first and report after.
          </p>
        ) : (
          <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed">
            You see only what the crew chose to send. By the time you read it, it is already {link.text} old.
          </p>
        )}
      </aside>

      <section className="flex h-[calc(100dvh-156px)] min-h-[420px] flex-col rounded-2xl border border-line bg-panel">
        <h2 className="border-b border-line px-5 py-4 text-lg font-semibold tracking-tight">{side === 'ship' ? 'Link to Earth' : 'Link to the ship'}</h2>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          {thread.length === 0 && <p className="m-auto max-w-xs text-center text-sm text-muted">Nothing sent yet. Write to {other} below, or send a health report from Live monitor.</p>}
          <AnimatePresence initial={false}>
            {thread.map((m) => {
              const mine = m.side === side
              const left = Math.max(0, Math.ceil((m.deliver_at - (Date.now() + skew)) / 1000))
              const arrived = left === 0
              return (
                <motion.article
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  className={`max-w-[85%] rounded-2xl border px-4 py-3 ${mine ? 'self-end border-line-strong bg-raised' : 'self-start border-line bg-ground'}`}
                >
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    <span className="font-medium text-ink">{m.from_name}</span>
                    <span>{labelOf(m)}</span>
                    <span className="font-mono">{new Date(m.sent_at - skew).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </p>
                  <Body
                    m={m}
                    open={openId === m.id}
                    onToggle={() => setOpenId(openId === m.id ? null : m.id)}
                    canApprove={side === 'earth' && !mine}
                    approved={approvedPlans.has(readPlan(m.body)?.id)}
                    onApprove={(planId, note) => onSend(approvalMessage(planId, note))}
                  />
                  {mine && (
                    <p className={`mt-2 flex items-center gap-1.5 text-xs ${arrived ? 'text-muted' : 'text-check'}`}>
                      {arrived ? <CheckCircle size={14} weight="fill" /> : <Clock size={14} />}
                      {arrived ? `Arrived at ${side === 'ship' ? 'Earth' : 'the ship'}` : `On its way. Arrives in ${left} s${m.delay_min >= 1 ? ` (${sayDelay(m.delay_min)} in real time)` : ''}`}
                    </p>
                  )}
                </motion.article>
              )
            })}
          </AnimatePresence>
          <div ref={end} />
        </div>
        {paused && (
          <p role="status" className="flex items-start gap-2 border-t border-line bg-check-bg px-4 py-3 text-sm text-check">
            <WifiSlash size={18} className="mt-0.5 shrink-0" />
            <span>
              <span className="font-semibold">No contact with Earth.</span>{' '}
              <span className="text-ink">
                {blackout === 'conjunction'
                  ? 'Mars is behind the Sun for about two weeks, so the link is paused. Write your report in the steps; it goes out when contact returns.'
                  : `Planned blackout: ${plannedLeft} min left. Nothing can be sent or received until contact returns. Follow the plan on the Flight surgeon page.`}
              </span>
            </span>
          </p>
        )}
        {crewDark && (
          <p role="status" className="flex items-start gap-2 border-t border-line bg-check-bg px-4 py-3 text-sm text-check">
            <WifiSlash size={18} className="mt-0.5 shrink-0" />
            <span>
              <span className="font-semibold">The crew is in a planned blackout.</span>{' '}
              <span className="text-ink">About {Math.max(0, Math.ceil((crewDarkUntil - Date.now()) / DEMO_MS_PER_MIN))} min left. What you send now reaches them when contact returns.</span>
            </span>
          </p>
        )}
        <form onSubmit={send} className="flex gap-3 border-t border-line p-4">
          <label className="flex-1">
            <span className="sr-only">Message to {other}</span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder={paused ? 'No contact with Earth right now' : `Write to ${other}`}
              disabled={paused}
              className="w-full resize-none rounded-xl border border-line-strong bg-ground px-3 py-2 text-sm text-ink placeholder:text-dim focus:border-ink disabled:cursor-not-allowed disabled:opacity-60"
            />
          </label>
          <Button kind="primary" type="submit" disabled={busy || paused || !draft.trim()} className="self-end">
            <PaperPlaneTilt size={18} />
            Send
          </Button>
        </form>
      </section>
    </div>
  )
}
