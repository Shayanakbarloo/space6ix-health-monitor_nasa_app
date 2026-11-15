import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChatCircleText, Check, FirstAid, Heartbeat, NotePencil, Planet, SignOut, Siren } from '@phosphor-icons/react'
import Ask from './Ask'
import CareSteps from './CareSteps'
import CheckIn from './CheckIn'
import EarthLink from './EarthLink'
import FlightSurgeon from './FlightSurgeon'
import { BlackoutChip, LiveClock, ScenarioMenu } from './LiveHeader'
import SignIn from './SignIn'
import { clearCheckIns, fetchState, getToken, logout, postEmergency, postMessage, putCheckIn, type Result, type ServerState } from './api'
import MissionMenu from './MissionMenu'
import { CARE_STEPS } from './data/careSteps'
import { linkDelay, type MissionId } from './data/missions'
import { canSee } from './data/users'
import { LIVE_SCENARIOS, TICK_MS, buildLive, isScenario, liveCabinSamples, liveSamples, type Care, type ScenarioId } from './live'
import { CABIN_ID, reportText } from './model'
import type { CrewReading } from './triage'
import { Button, Logo, SPRING } from './ui'

// The 3D body is the heaviest part of the app, so it loads only when it is opened.
const Overview = lazy(() => import('./Overview'))
const Emergency = lazy(() => import('./Emergency'))
const Loading = <p className="flex min-h-[50dvh] items-center justify-center text-muted">Loading...</p>

// Live monitor is the first page after sign-in: it opens on the signed-in person's own health.
type Tab = 'health' | 'earth' | 'ask' | 'surgeon-drill'
const TABS: { id: Tab; label: string; icon: typeof Planet }[] = [
  { id: 'health', label: 'Live monitor', icon: Heartbeat },
  { id: 'earth', label: 'Contact home', icon: Planet },
  { id: 'ask', label: 'Ask', icon: ChatCircleText },
  { id: 'surgeon-drill', label: 'Flight surgeon', icon: FirstAid },
]

// The chosen live scenario is remembered in this browser.
const SCENARIO_KEY = 'chm.scenario'
function savedScenario(): ScenarioId {
  try {
    const v = localStorage.getItem(SCENARIO_KEY)
    return isScenario(v) ? v : 'normal'
  } catch {
    return 'normal'
  }
}

export default function App() {
  const [signedIn, setSignedIn] = useState(() => getToken() !== null)
  const [state, setState] = useState<ServerState | null>(null)
  const [skew, setSkew] = useState(0)
  const [tab, setTab] = useState<Tab>('health')
  const [scenario, setScenario] = useState<ScenarioId>(savedScenario)
  // A scenario that happens in one place (landing day on the Moon) opens in that setting.
  const [mission, setMission] = useState<MissionId>(() => LIVE_SCENARIOS[savedScenario()].mission ?? 'mars')
  // What the crew has done so far to fix this scenario's problem. "start" is when the scenario began.
  const [care, setCare] = useState<Care>(() => ({ start: Date.now() }))
  // The live feed moves on every couple of seconds.
  const [now, setNow] = useState(() => Date.now())
  const [selected, setSelected] = useState('')
  const [emergency, setEmergency] = useState(false)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  // A planned blackout from the Flight surgeon page: no contact with Earth from start to end.
  const [blackoutWindow, setBlackoutWindow] = useState<{ start: number; end: number } | null>(null)
  const lastState = useRef('')
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(t)
  }, [])
  // Hidden mission day behind the live view: radiation since launch, signal delay, where check-ins are kept.
  const day = LIVE_SCENARIOS[scenario].day

  const signOut = useCallback(async () => {
    await logout()
    lastState.current = ''
    setState(null)
    setSignedIn(false)
    setTab('health')
    setSelected('')
    setCare({ start: Date.now() })
    setBlackoutWindow(null)
  }, [])

  /** Take a server answer: keep the new state, or explain what went wrong. */
  const apply = useCallback(
    (r: Result<ServerState>, okMessage?: string): boolean => {
      if (r.ok) {
        const fresh = JSON.stringify({ ...r.data, now: 0 })
        if (fresh !== lastState.current) {
          lastState.current = fresh
          setState(r.data)
          setSkew(r.data.now - Date.now())
        }
        if (okMessage) setToast(okMessage)
        return true
      }
      if (r.status === 401) void signOut()
      else setToast(r.error)
      return false
    },
    [signOut],
  )

  // Keep in step with the server. This is also how messages from the other side arrive.
  useEffect(() => {
    if (!signedIn) return
    let alive = true
    const load = async () => {
      const r = await fetchState()
      if (alive && (r.ok || r.status === 401)) apply(r)
    }
    void load()
    const t = setInterval(load, 2000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [signedIn, apply])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3400)
    return () => clearTimeout(t)
  }, [toast])

  const user = state?.user
  const visible = useCallback((id: string) => id === CABIN_ID || (user !== undefined && canSee(user, id)), [user])
  const live = useMemo(() => (state ? buildLive(scenario, now, state.checkIns, mission, care) : null), [scenario, now, state, mission, care])
  const samples = useCallback((id: string, n: number) => (state ? liveSamples(id, n, scenario, now, state.checkIns, mission, care) : []), [state, scenario, now, mission, care])
  const cabinSamples = useCallback((n: number) => liveCabinSamples(n, scenario, now, mission, care), [scenario, now, mission, care])
  const exitEmergency = useCallback(() => setEmergency(false), [])
  // An emergency record made while there is no contact with Earth goes out when contact returns.
  const [heldRecord, setHeldRecord] = useState<Parameters<typeof postEmergency>[0] | null>(null)
  // The planned blackout ends on time even if the Flight surgeon page is not open (Emergency mode).
  const plannedWindow = blackoutWindow !== null && now < blackoutWindow.end ? blackoutWindow : null
  const offline = state?.user.role !== 'surgeon' && (LIVE_SCENARIOS[scenario].blackout === true || plannedWindow !== null)
  useEffect(() => {
    if (!heldRecord || offline) return
    setHeldRecord(null)
    void postEmergency(heldRecord).then((r) => apply(r, 'Contact is back. The emergency record was sent to Earth.'))
  }, [heldRecord, offline, apply])

  if (!signedIn)
    return (
      <SignIn
        onDone={() => {
          setTab('health')
          setSelected('')
          setSignedIn(true)
        }}
      />
    )
  if (!state || !user || !live) return <p className="flex min-h-[100dvh] items-center justify-center text-muted">Loading...</p>

  const subjects = live.subjects
  const isEarth = user.role === 'surgeon'
  const mySelected = selected && visible(selected) ? selected : user.id
  // Earth out of reach (Mars behind the Sun) or a planned blackout: nothing can be sent until contact returns.
  const contactLost = !isEarth && LIVE_SCENARIOS[scenario].blackout === true
  const planned = !isEarth ? plannedWindow : null
  const blackout = contactLost || planned !== null
  const blockedText = planned ? 'No contact with Earth during the blackout. Nothing can be sent until contact returns.' : 'No contact with Earth right now. Nothing can be sent until contact returns.'
  // During a planned blackout, nothing from Earth gets through either: it arrives when contact returns.
  const inbox = planned ? state.messages.filter((m) => !(m.side === 'earth' && m.deliver_at - skew >= planned.start)) : state.messages
  const send = async (body: string, kind: 'message' | 'report' = 'message', okMessage?: string) => {
    if (blackout) {
      setToast(blockedText)
      return false
    }
    return apply(await postMessage(day, body, kind, mission), okMessage ?? (kind === 'report' ? 'Report sent. See Contact home for when it arrives.' : undefined))
  }
  const saveCheckIn = async (crewId: string, r: CrewReading) => {
    setCheckInOpen(false)
    // Show the person the check-in was for, on Live monitor.
    setSelected(crewId)
    setTab('health')
    apply(await putCheckIn(crewId, day, r), 'Check-in saved.')
  }

  // Switching scenario starts the live feed again and opens the person with the problem.
  const changeScenario = (s: ScenarioId) => {
    setScenario(s)
    try {
      localStorage.setItem(SCENARIO_KEY, s)
    } catch {
      // Storage blocked: the choice lasts until the tab reloads.
    }
    setCare({ start: Date.now() })
    setTab('health')
    // Some hazard scenarios happen in one setting: landing day on the Moon, Earth out of reach on the way to Mars.
    const place = LIVE_SCENARIOS[s].mission
    if (place) setMission(place)
    const p = LIVE_SCENARIOS[s].patientId
    if (p && visible(p)) setSelected(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // The person with the problem in this scenario, and what has been done for them.
  const sc = LIVE_SCENARIOS[scenario]
  const patient = sc.patientId ? subjects.find((s) => s.id === sc.patientId) : undefined
  const patientReading = sc.patientId ? live.readings[sc.patientId] : undefined
  const alertAt = care.alert
  const replies = alertAt === undefined ? [] : inbox.filter((m) => m.side === 'earth' && m.delivered && m.sent_at >= alertAt + skew)
  const showPatient = () => {
    if (patient) setSelected(patient.id)
  }
  const sendAlert = async () => {
    if (!patient) return
    const done = CARE_STEPS[scenario].filter((s) => care[s.id] !== undefined).map((s) => s.title)
    const doneLine = `Done on board: ${done.length > 0 ? done.join('; ') : 'nothing yet'}.`
    const findings = (id: string) => patient.findings.find((f) => f.id === id)?.measured ?? ''
    let body = ''
    let toastText = 'Sent to Earth. See Contact home for when it arrives.'
    if (scenario === 'radiation') {
      body = [`SOLAR STORM: radiation in the cabin is far above normal. Request: space weather update and the all-clear time.`, `Radiation now: ${findings('doserate')}.`, `Crew in the storm shelter: ${care.shelter !== undefined ? 'yes' : 'not yet'}.`, doneLine].join('\n')
      toastText = "Sent to Earth's radiation team. See Contact home for when it arrives."
    } else if (scenario === 'co2') {
      const sick = subjects.filter((x) => x.findings.some((f) => f.id === 'headache')).length
      body = [`CABIN CO2: the main CO2 scrubber is failing. Request: repair procedure.`, `CO2 now: ${findings('co2')}. Crew with headaches: ${sick}.`, `Backup CO2 removal on: ${care.scrubber !== undefined ? 'yes' : 'not yet'}.`, doneLine].join('\n')
      toastText = 'Sent to flight controllers. See Contact home for when it arrives.'
    } else if (scenario === 'isolation') {
      body = [`PRIVATE REQUEST: ${patient.name} asks for a private session with the behavioral health team and a family call.`, reportText([patient], `Mood and sleep this week for ${patient.name}:`), doneLine].join('\n')
      toastText = 'Request sent to Earth. See Contact home for when it arrives.'
    } else {
      if (!patientReading) return
      body = [
        reportText([patient], `EMERGENCY ALERT: ${patient.name} needs the flight surgeon. Second opinion requested from the ground medical team.`),
        `Live vitals: heart rate ${patientReading.restingHrBpm} bpm, oxygen ${patientReading.spo2Pct}%, blood pressure ${patientReading.systolicBp}/${patientReading.diastolicBp} mmHg, temperature ${patientReading.bodyTempC.toFixed(1)} C.`,
        doneLine,
      ].join('\n')
      toastText = 'Alert sent to the flight surgeon. See Contact home for when it arrives.'
    }
    if (blackout) return void setToast(blockedText)
    if (apply(await postMessage(day, body, 'report', mission), toastText)) setCare((c) => ({ ...c, alert: Date.now() }))
  }
  const steps = (
    <CareSteps
      scenario={scenario}
      patient={patient}
      canSee={patient !== undefined && visible(patient.id)}
      reading={patientReading}
      care={care}
      now={now}
      link={linkDelay(mission, day)}
      replies={replies}
      showingPatient={patient !== undefined && mySelected === patient.id}
      onToggle={(id) =>
        setCare((c) => {
          const next = { ...c }
          if (next[id] === undefined) next[id] = Date.now()
          else delete next[id]
          return next
        })
      }
      onPill={() => setCare((c) => ({ ...c, pill: c.pill ?? Date.now() }))}
      onAlert={() => void sendAlert()}
      onCheckIn={() => {
        showPatient()
        setCheckInOpen(true)
      }}
      onEmergency={() => {
        showPatient()
        setEmergency(true)
      }}
      onShowPatient={() => {
        showPatient()
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }}
    />
  )

  if (emergency && !isEarth) {
    return (
      <Suspense fallback={Loading}>
        <Emergency
          day={day}
          mission={mission}
          subjects={subjects}
          readings={live.readings}
          defaultPatient={mySelected}
          offline={blackout}
          onSave={async (rec) => {
            if (!blackout) return apply(await postEmergency({ ...rec, mission }))
            setHeldRecord({ ...rec, mission })
            return true
          }}
          onExit={exitEmergency}
        />
      </Suspense>
    )
  }

  return (
    <div className="min-h-[100dvh]">
      <header className="relative z-10 border-b border-line bg-bar/95 px-4 py-2.5 backdrop-blur-md sm:px-6 lg:sticky lg:top-0">
        {/* Top row: the signed-in person left, the page menu in the middle, the logo and name right.
            On smaller screens the menu gets its own centered row under them. */}
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 min-[1140px]:grid-cols-[1fr_auto_1fr]">
          <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 justify-self-start">
            <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-bg font-semibold text-accent">
              {user.name.replace(/[^A-Z]/g, '').slice(0, 2) || user.name.slice(0, 1)}
            </span>
            <p className="min-w-0 text-xs leading-tight">
              <span className="block text-dim">Welcome</span>
              <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
              <span className="block truncate text-muted">{user.title}</span>
            </p>
            <Button kind="ghost" onClick={() => void signOut()} aria-label="Sign out" className="px-2.5">
              <SignOut size={18} />
            </Button>
          </div>

          {!isEarth ? (
            <nav className="col-span-2 col-start-1 row-start-2 flex flex-wrap justify-center gap-1 justify-self-center rounded-full bg-panel p-1 shadow-[0_8px_24px_-14px_rgba(30,64,130,0.3)] min-[1140px]:col-span-1 min-[1140px]:col-start-2 min-[1140px]:row-start-1" aria-label="Sections">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined} className="press relative flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium">
                  {tab === t.id && <motion.span layoutId="tab-active" transition={SPRING} className="absolute inset-0 rounded-full bg-raised" />}
                  <t.icon size={18} className={`relative ${tab === t.id ? 'text-ink' : 'text-muted'}`} />
                  <span className={`relative ${tab === t.id ? 'text-ink' : 'text-muted'}`}>{t.label}</span>
                </button>
              ))}
            </nav>
          ) : (
            <span className="hidden min-[1140px]:col-start-2 min-[1140px]:row-start-1 min-[1140px]:block" />
          )}

          <div className="col-start-2 row-start-1 flex items-center gap-3 justify-self-end min-[1140px]:col-start-3">
            <Logo size={36} />
            <p className="hidden leading-tight sm:block" title="SOMA: Spaceflight Organ Monitoring Application">
              <span className="block text-[18px] font-semibold tracking-[0.06em]">SOMA</span>
              <span className="block text-[11px] text-muted min-[1140px]:hidden min-[1280px]:block">Spaceflight Organ Monitoring Application</span>
            </p>
          </div>
        </div>

        {/* Second row: the controls, centered under the menu. */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          <MissionMenu value={mission} day={day} onChange={setMission} />
          {!isEarth && <ScenarioMenu value={scenario} onChange={changeScenario} />}
          <LiveClock />
          {planned && <BlackoutChip end={planned.end} onOpen={() => setTab('surgeon-drill')} />}
          {!isEarth && (
            <>
              <Button onClick={() => setCheckInOpen(true)}>
                <NotePencil size={18} />
                Log check-in
              </Button>
              <Button kind="danger" onClick={() => setEmergency(true)}>
                <Siren size={18} weight="fill" />
                Emergency
              </Button>
            </>
          )}
        </div>
      </header>

      <Suspense fallback={Loading}>
      {!isEarth && (
        <div hidden={tab !== 'surgeon-drill'}>
          <FlightSurgeon
            key={user.id}
            subjects={subjects.filter((s) => visible(s.id))}
            messages={inbox}
            link={linkDelay(mission, day)}
            contactLost={contactLost}
            send={send}
            onBlackout={setBlackoutWindow}
            onEmergency={() => setEmergency(true)}
            onOpenLive={(id) => {
              if (id && visible(id)) setSelected(id)
              setTab('health')
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
          />
        </div>
      )}
      {tab === 'surgeon-drill' && !isEarth ? null : isEarth ? (
        <EarthLink side="earth" day={day} mission={mission} messages={state.messages} skew={skew} onSend={(b) => send(b)} />
      ) : tab === 'health' ? (
        <Overview
          user={user}
          day={day}
          mission={mission}
          scenario={scenario}
          subjects={subjects}
          readings={live.readings}
          cabin={live.cabin}
          samples={samples}
          cabinSamples={cabinSamples}
          checkIns={state.checkIns}
          events={state.events}
          visible={visible}
          selected={mySelected}
          setSelected={setSelected}
          steps={steps}
          blackout={blackout}
          onSendReport={() => void send(reportText(subjects.filter((s) => visible(s.id))), 'report')}
          onClear={async () => void apply(await clearCheckIns(), 'Check-ins cleared. Showing the live feed again.')}
          onCheckIn={() => setCheckInOpen(true)}
          onEmergency={() => setEmergency(true)}
        />
      ) : tab === 'ask' ? (
        <Ask subjects={subjects.filter((s) => visible(s.id))} meId={user.id} day={day} mission={mission} scenario={scenario} />
      ) : (
        <EarthLink side="ship" day={day} mission={mission} messages={inbox} skew={skew} onSend={(b) => send(b)} blackout={planned ? { until: planned.end } : contactLost ? 'conjunction' : undefined} />
      )}
      </Suspense>

      <AnimatePresence>
        {checkInOpen && (
          <CheckIn
            key="checkin"
            crewIds={subjects.filter((s) => s.id !== CABIN_ID && visible(s.id)).map((s) => s.id)}
            initialCrewId={mySelected}
            readingFor={(id) => live.readings[id]}
            onSave={saveCheckIn}
            onClose={() => setCheckInOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4" aria-live="polite">
        <AnimatePresence>
          {toast && (
            <motion.p key={toast} initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={SPRING} className="flex items-center gap-2 rounded-xl border border-line-strong bg-raised px-4 py-3 text-sm shadow-[0_18px_44px_-16px_rgba(30,64,130,0.3)]">
              <Check size={16} weight="bold" />
              {toast}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
