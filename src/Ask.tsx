import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Microphone, PaperPlaneTilt, Sparkle, Stop } from '@phosphor-icons/react'
import { ask, suggestions, type Answer } from './handbook'
import { useDictation } from './speech'
import type { MissionId } from './data/missions'
import type { ScenarioId } from './live'
import type { Subject } from './model'
import { Button, EASE, IconBadge } from './ui'

interface Turn {
  id: number
  question: string
  answers: Answer[]
  /** Gemini's rewording: 'wait' while loading, 'failed' if it did not work, else the text. */
  reworded?: string
}

const LINK = 'text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink'

export default function Ask({ subjects, meId, day, mission, scenario }: { subjects: Subject[]; meId: string; day: number; mission: MissionId; scenario: ScenarioId }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const end = useRef<HTMLDivElement>(null)
  // The last answer's person and topic, so "what should she do?" or "why?" can follow on.
  const last = useRef<{ person?: string; topic?: string }>({})

  // Optional Gemini rewording. Only offered when the server says it has a key.
  const [canReword, setCanReword] = useState(false)
  const [natural, setNatural] = useState(false)
  useEffect(() => {
    fetch('/api/reword')
      .then((r) => ((r.headers.get('content-type') ?? '').includes('json') ? r.json() : { enabled: false }))
      .then((d: { enabled?: boolean }) => setCanReword(d.enabled === true))
      .catch(() => setCanReword(false))
  }, [])

  const submit = (question: string) => {
    const q = question.trim()
    if (!q) return
    const answers = ask(q, { subjects, meId, day, mission, scenario, last: last.current })
    const main = answers[0]
    if (main && main.topic !== 'unknown') last.current = { person: main.person ?? last.current.person, topic: main.topic }
    const id = Date.now()
    const known = answers.some((a) => a.topic !== 'unknown')
    setTurns((t) => [...t, { id, question: q, answers, reworded: natural && canReword && known ? 'wait' : undefined }])
    setDraft('')
    setTimeout(() => end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50)
    if (!(natural && canReword) || !known) return
    // The guide picks the facts. Gemini only rewrites them.
    const text = answers.map((a) => `${a.title}\n${a.lead}\n${a.lines.join('\n')}`).join('\n\n')
    fetch('/api/reword', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, text }), signal: AbortSignal.timeout(20000) })
      .then((r) => r.json())
      .then((d: { text?: string }) => setTurns((t) => t.map((x) => (x.id === id ? { ...x, reworded: d.text ?? 'failed' } : x))))
      .catch(() => setTurns((t) => t.map((x) => (x.id === id ? { ...x, reworded: 'failed' } : x))))
  }

  const ideas = suggestions({ scenario, subjects })
  // Speak a question: the words show in the box, and it is asked when you stop talking.
  const voice = useDictation((text) => submit(text))

  return (
    <div className="mx-auto max-w-[860px] px-4 py-4 sm:px-6">
      <section className="flex h-[calc(100dvh-156px)] min-h-[420px] flex-col rounded-2xl border border-line bg-panel">
        <div className="border-b border-line px-5 py-4">
          <h1 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <IconBadge>
              <Sparkle size={18} weight="fill" />
            </IconBadge>
            Ask
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Ask about the crew, a reading, NASA's space hazards or what to do. It knows everyone's live readings and the situation right now, works without a connection to Earth, and shows where each answer comes from. Type a question, or tap the microphone and say it.
          </p>
          {canReword && (
            <label className="mt-3 flex min-h-11 w-fit items-center gap-2 rounded-xl border border-line-strong px-3 text-sm">
              <input type="checkbox" checked={natural} onChange={(e) => setNatural(e.target.checked)} className="h-4 w-4 accent-accent" />
              Reword answers with Gemini (needs internet)
            </label>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          {turns.length === 0 && (
            <div className="m-auto w-full max-w-md">
              <p className="mb-3 text-center text-sm text-muted">Try one of these</p>
              <div className="grid gap-2">
                {ideas.map((s) => (
                  <button key={s} onClick={() => submit(s)} className="press min-h-11 rounded-xl border border-line bg-panel px-4 text-left text-sm shadow-[0_6px_18px_-14px_rgba(30,64,130,0.35)] hover:border-line-strong">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <AnimatePresence initial={false}>
            {turns.map((t) => (
              <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE }} className="flex flex-col gap-3">
                <p className="max-w-[85%] self-end rounded-2xl bg-ink px-4 py-2.5 text-sm text-white">{t.question}</p>
                {t.reworded && (
                  <div className="max-w-[92%] rounded-2xl border border-line-strong bg-raised px-4 py-3">
                    <p className="text-sm leading-relaxed">{t.reworded === 'wait' ? 'Rewording...' : t.reworded === 'failed' ? 'Rewording did not work. The answer is below.' : t.reworded}</p>
                    {t.reworded !== 'wait' && t.reworded !== 'failed' && <p className="mt-2 text-xs text-muted">Reworded by Gemini from the answer below; check it if anything looks different.</p>}
                  </div>
                )}
                {t.answers.map((a) => (
                  <article key={a.topic + a.title} className={`max-w-[92%] rounded-2xl border px-4 py-3 ${a.topic === 'unknown' ? 'border-line bg-ground text-muted' : 'border-line bg-ground'}`}>
                    <p className="text-xs font-medium tracking-wide text-dim uppercase">{a.title}</p>
                    <p className={`mt-1 text-[15px] leading-relaxed ${a.topic === 'unknown' ? '' : 'font-medium text-ink'}`}>{a.lead}</p>
                    {a.lines.length > 0 && (
                      <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
                        {a.lines.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    )}
                    {a.sources.length > 0 && (
                      <p className="mt-3 border-t border-line-soft pt-2 text-xs leading-relaxed text-muted">
                        From:{' '}
                        {a.sources.map((s, i) => (
                          <span key={s.url ?? s.label}>
                            {i > 0 && '; '}
                            {s.url ? (
                              <a href={s.url} target="_blank" rel="noreferrer" className={LINK}>
                                {s.label}
                              </a>
                            ) : (
                              s.label
                            )}
                          </span>
                        ))}
                      </p>
                    )}
                  </article>
                ))}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={end} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit(draft)
          }}
          className="border-t border-line p-4"
        >
          <div className="flex gap-2 sm:gap-3">
            <label className="flex-1">
              <span className="sr-only">Your question</span>
              <input
                value={voice.listening ? voice.heard : draft}
                onChange={(e) => setDraft(e.target.value)}
                readOnly={voice.listening}
                placeholder={voice.listening ? 'Listening... ask your question' : 'Ask about the crew, a reading, a hazard or what to do'}
                className={`min-h-11 w-full rounded-xl border bg-ground px-3 text-sm text-ink placeholder:text-dim focus:border-ink ${voice.listening ? 'border-urgent/50' : 'border-line-strong'}`}
              />
            </label>
            <button
              type="button"
              onClick={voice.listening ? voice.stop : voice.start}
              aria-pressed={voice.listening}
              aria-label={voice.listening ? 'Stop listening' : 'Speak your question'}
              title={voice.listening ? 'Stop listening' : 'Speak your question'}
              className={`press relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${voice.listening ? 'border-urgent bg-urgent text-white' : 'border-line-strong bg-panel text-ink hover:border-muted'}`}
            >
              {voice.listening && <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-urgent/40" />}
              {voice.listening ? <Stop size={18} weight="fill" className="relative" /> : <Microphone size={20} className="relative" />}
            </button>
            <Button kind="primary" type="submit" disabled={voice.listening || !draft.trim()}>
              <PaperPlaneTilt size={18} />
              Ask
            </Button>
          </div>
          {(voice.listening || voice.error) && (
            <p role="status" className={`mt-2 text-xs ${voice.error ? 'text-check' : 'text-muted'}`}>
              {voice.error ?? 'Listening. Speak, then stop talking and the question is asked. Tap the red button to stop.'}
            </p>
          )}
        </form>
      </section>
    </div>
  )
}