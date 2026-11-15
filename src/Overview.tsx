import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowSquareOut, CaretDown, CheckCircle, ClockCounterClockwise, Heartbeat, NotePencil, PaperPlaneTilt, Pulse, Siren, Trash, UsersThree, Warning, WifiSlash, Wind } from '@phosphor-icons/react'
import BodyScan, { type Hotspot } from './BodyScan'
import CardiovascularPanel from './CardiovascularPanel'
import Dropdown from './Dropdown'
import TrendChart from './TrendChart'
import type { ActivityEvent } from './api'
import { regionOf } from './body/sdf'
import { CREW } from './data/simulatedCrew'
import { GUIDE, HAZARD_INFO, NASA_RISK, NASA_STUDY, PARTNER_WORK } from './data/signalGuide'
import { SOURCES } from './data/sources'
import { MISSIONS, type MissionId } from './data/missions'
import type { User } from './data/users'
import { ATTACHMENT_LABEL } from './imageAttach'
import { LIVE_SCENARIOS, baselineFor, cabinValue, isFixed, liveValue, type ScenarioId } from './live'
import { keyOf, type CheckIns, type Provenance, type Subject } from './model'
import { THRESHOLDS, type CabinReading, type CrewReading, type Finding, type ImageAttachment, type Level } from './triage'
import { Button, Chip, EASE, Gauge, IconBadge, LEVEL_LINE, LEVEL_TINT, SPRING, Sparkline } from './ui'

const PANEL = 'rounded-2xl border border-line bg-panel'
const worst = (list: Finding[]): Level => (list.some((f) => f.level === 'red') ? 'red' : list.some((f) => f.level === 'amber') ? 'amber' : 'green')
const LEVEL_WORD: Record<Level, string> = { green: 'Normal', amber: 'Check', red: 'Urgent' }
/** Samples in each small trend line: the last minute of the live feed. */
const SPARK = 30

interface Props {
  user: User
  day: number
  mission: MissionId
  scenario: ScenarioId
  subjects: Subject[]
  /** Reading now for each crew member. */
  readings: Record<string, CrewReading>
  cabin: CabinReading
  /** The last n readings for a person, oldest first. */
  samples: (id: string, n: number) => CrewReading[]
  cabinSamples: (n: number) => CabinReading[]
  checkIns: CheckIns
  events: ActivityEvent[]
  visible: (id: string) => boolean
  selected: string
  setSelected: (id: string) => void
  /** The "Steps to fix" section, shown under the body view. */
  steps: ReactNode
  /** No contact with Earth: reports cannot be sent. */
  blackout?: boolean
  onSendReport: () => void
  onClear: () => void
  onCheckIn: () => void
  onEmergency: () => void
}

export default function Overview({ user, day, mission, scenario, subjects, readings, cabin, samples, cabinSamples, checkIns, events, visible, selected, setSelected, steps, blackout = false, onSendReport, onClear, onCheckIn, onEmergency }: Props) {
  const [cardiovascularOpen, setCardiovascularOpen] = useState(false)
  const [openRow, setOpenRow] = useState<string | null>(null)
  const [hoverRow, setHoverRow] = useState<string | null>(null)
  const mine = subjects.filter((s) => visible(s.id))
  const current = mine.find((s) => s.id === selected) ?? mine[0]
  const rows = current.findings
  const crew = CREW.find((c) => c.id === current.id)
  const reading = crew ? readings[crew.id] : undefined
  const recent = crew ? samples(crew.id, SPARK) : []
  const cabinRecent = crew ? [] : cabinSamples(SPARK)
  const manualCount = Object.keys(checkIns).length
  const attention = rows.filter((f) => f.level !== 'green')
  const normal = rows.filter((f) => f.level === 'green')
  const attachment = checkIns[keyOf(current.id, day)]?.attachment ?? null

  // Markers only change when a level changes, not on every tick of the live feed.
  const hotKey = rows.map((f) => f.id + f.level).join(',')
  const hotspots = useMemo<Hotspot[]>(() => {
    if (!crew) return []
    return rows.flatMap((f) => {
      const region = regionOf(f.id, crew.build)
      return region ? [{ id: f.id, label: region.label, pos: region.pos, level: f.level }] : []
    })
  }, [hotKey, crew]) // eslint-disable-line react-hooks/exhaustive-deps

  const trend = (findingId: string, list: CrewReading[] | CabinReading[], isCabin: boolean) =>
    isCabin ? { values: (list as CabinReading[]).map((c) => cabinValue(findingId, c)) } : { values: (list as CrewReading[]).map((r) => liveValue(findingId, r)), baseline: baselineFor(current.id, findingId) }

  const pick = (id: string) => {
    setSelected(id)
    setOpenRow(null)
    setHoverRow(null)
  }

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-4 sm:px-6">
      <ScenarioBanner scenario={scenario} subjects={subjects} visible={visible} />

      {/* The three columns share one fixed height, so nothing slides over anything else. Long columns scroll inside. */}
      <div className="grid gap-4 lg:h-[calc(100dvh-96px)] lg:min-h-[600px] lg:grid-cols-[272px_minmax(0,1fr)_minmax(0,440px)]">
        <div className="flex flex-col gap-4 lg:overflow-y-auto">
          <section className={`${PANEL} shrink-0 p-4`}>
            <h2 className="mb-3 flex items-center gap-2.5 font-semibold">
              <IconBadge>
                <UsersThree size={18} weight="fill" />
              </IconBadge>
              Crew
            </h2>
            <Dropdown
              caption="Crew member"
              label="Crew member"
              value={current.id}
              onChange={pick}
              align="left"
              listWidth="w-full"
              tint
              options={mine.map((s) => ({ id: s.id, label: s.name, detail: s.role, level: worst(s.findings), note: LEVEL_WORD[worst(s.findings)] }))}
            />
            <p className="mt-2 text-xs text-muted">Pick a crew member or the cabin to see their health now.</p>
          </section>

          {crew && reading ? <LiveVitals reading={reading} recent={recent} manual={current.manual} /> : <CabinNow cabin={cabin} recent={cabinRecent} />}

          {events.length > 0 && (
            <section className={`${PANEL} shrink-0 p-4`}>
              <h2 className="flex items-center gap-2.5 font-semibold">
                <IconBadge>
                  <ClockCounterClockwise size={18} weight="bold" />
                </IconBadge>
                Recent activity
              </h2>
              <ul className="mt-2 space-y-2.5">
                {events.slice(0, 4).map((e) => (
                  <li key={e.id} className="text-xs">
                    <p className="text-ink">{e.detail}</p>
                    <p className="font-mono text-dim">{new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <section className="relative flex h-[600px] flex-col overflow-hidden rounded-2xl lg:h-auto" style={{ background: 'radial-gradient(ellipse 55% 50% at 50% 44%, rgba(176, 202, 247, 0.6) 0%, rgba(176, 202, 247, 0) 72%)' }}>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[3] flex items-start justify-between gap-3 p-5">
            <AnimatePresence mode="wait">
              <motion.div key={current.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: EASE }}>
                <h2 className="text-2xl font-semibold tracking-tight">{current.name}</h2>
                <p className="text-sm text-muted">{current.role}</p>
                {current.manual && <p className="mt-2 w-fit rounded-md border border-line-strong px-2 py-0.5 text-xs text-ink">Crew check-in today</p>}
              </motion.div>
            </AnimatePresence>
            <Chip level={worst(rows)} className="h-7" />
          </div>
          {crew ? (
            <div className="min-h-0 flex-1">
              <BodyScan build={crew.build} hotspots={hotspots} activeId={hoverRow ?? openRow} focusId={openRow} onSystemChange={(system) => setCardiovascularOpen(system === 'blood')}
                onPick={(id) => {
                  setOpenRow(openRow === id ? null : id)
                  if (id === 'hematocrit') setCardiovascularOpen(true)
                }} />
            </div>
          ) : (
            <div className="flex flex-1 flex-wrap items-center justify-center gap-x-10 gap-y-10 px-6 pt-24 pb-10">
              <Gauge label="Cabin CO2" value={cabin.co2MmHg.toFixed(1)} unit="mmHg" fraction={Math.min(1, cabin.co2MmHg / 6)} level={rows.find((f) => f.id === 'co2')?.level ?? 'green'} note={`NASA limit ${THRESHOLDS.co2SpaceLimitMmHg.toFixed(1)} mmHg`} />
              <Gauge
                label="Radiation now"
                value={cabin.doseRateNowMSvH.toFixed(2)}
                unit="mSv per hour"
                fraction={Math.min(1, cabin.doseRateNowMSvH / ((cabin.doseRateMSvDay / 24) * THRESHOLDS.stormShelterX))}
                level={rows.find((f) => f.id === 'doserate')?.level ?? 'green'}
                note={cabin.shelterMSvH !== undefined ? `In the storm shelter: ${cabin.shelterMSvH.toFixed(2)} mSv/h` : `Full ring: shelter level, ${THRESHOLDS.stormShelterX} times normal`}
              />
              <Gauge label="Radiation dose" value={cabin.cumulativeDoseMSv.toFixed(0)} unit="mSv since launch" fraction={cabin.cumulativeDoseMSv / THRESHOLDS.radCareerMSv} level={rows.find((f) => f.id === 'radiation')?.level ?? 'green'} note={`Ring shows share of the ${THRESHOLDS.radCareerMSv} mSv career limit`} />
            </div>
          )}
        </section>

        <section className={`${PANEL} flex flex-col overflow-hidden`}>
          <div className="flex shrink-0 items-baseline justify-between gap-3 px-5 pt-4 pb-3">
            <h2 className="flex items-center gap-2.5 font-semibold">
              <IconBadge>
                <Pulse size={18} weight="bold" />
              </IconBadge>
              {attention.length === 0 ? 'Nothing needs attention' : `${attention.length} need${attention.length === 1 ? 's' : ''} attention`}
            </h2>
          </div>
          <div className="min-h-0 flex-1 lg:overflow-y-auto">
            {crew && reading && cardiovascularOpen && <CardiovascularPanel crewName={crew.name} mission={mission} reading={reading} manual={current.manual} onCheckIn={onCheckIn} />}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={current.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                {[...attention, ...normal].map((f, i) => (
                  <div key={f.id}>
                    {i === attention.length && normal.length > 0 && <p className="px-5 pt-3 pb-0.5 text-xs text-muted">Normal now</p>}
                    <SignalRow
                      index={i}
                      f={f}
                      compact={f.level === 'green'}
                      info={current.info[f.id]}
                      trend={trend(f.id, crew ? recent : cabinRecent, !crew)}
                      attachment={f.id === 'onsd' && attachment ? attachment : null}
                      open={openRow === f.id}
                      onToggle={() => setOpenRow(openRow === f.id ? null : f.id)}
                      onHover={(on) => setHoverRow(on ? f.id : null)}
                      onCheckIn={crew ? onCheckIn : undefined}
                      mission={mission}
                      onEmergency={onEmergency}
                    />
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
            <p className="px-5 py-3 text-xs text-dim">Small lines show the last minute of the live feed. Dashed line is the pre-flight value.</p>
          </div>
        </section>
      </div>

      {steps}

      <TrendChart key={current.id} subjectId={current.id} subjectName={current.name} rows={rows} seriesFor={(id) => trend(id, crew ? samples(crew.id, 60) : cabinSamples(60), !crew)} />

      <section className={`${PANEL} mt-4 flex flex-wrap items-center justify-between gap-3 px-5 py-4`}>
        <div>
          <h2 className="flex items-center gap-2.5 font-semibold">
            <IconBadge>
              <PaperPlaneTilt size={18} weight="fill" />
            </IconBadge>
            Report to Earth
          </h2>
          <p className="mt-1 text-xs text-muted">
            {blackout ? 'No contact with Earth right now. Reports wait until contact returns.' : `Sends what is flagged right now, for the people you can see. Setting: ${MISSIONS[mission].name}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onSendReport} disabled={blackout}>
            <PaperPlaneTilt size={18} />
            Send report to Earth
          </Button>
          {user.role === 'cmo' && manualCount > 0 && (
            <Button kind="ghost" onClick={onClear}>
              <Trash size={18} />
              Clear {manualCount} check-in{manualCount === 1 ? '' : 's'}
            </Button>
          )}
        </div>
      </section>
      <p className="py-4 text-center text-xs text-muted">Educational prototype using simulated data. Not a medical device.</p>
    </div>
  )
}

/** A line across the top that says what the live scenario is and points to the steps. */
function ScenarioBanner({ scenario, subjects, visible }: { scenario: ScenarioId; subjects: Subject[]; visible: (id: string) => boolean }) {
  const sc = LIVE_SCENARIOS[scenario]
  const patient = sc.patientId ? subjects.find((s) => s.id === sc.patientId) : undefined
  const fixed = isFixed(scenario, patient)
  const calm = scenario === 'normal' || fixed
  const tone = calm ? 'bg-ok-bg text-ok' : sc.level === 'red' ? 'bg-urgent-bg text-urgent' : 'bg-check-bg text-check'
  const text = scenario === 'normal' ? sc.banner : !patient || !visible(patient.id) ? 'A crew member needs help. The medical officer has the details.' : fixed && sc.fixedBanner ? sc.fixedBanner : sc.banner
  const hazard = sc.hazard ? HAZARD_INFO[sc.hazard] : undefined
  return (
    <div role={sc.level === 'red' && !fixed ? 'alert' : 'status'} className={`mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl px-4 py-3 ${tone}`}>
      <p className="flex min-w-0 flex-1 basis-[28rem] items-start gap-2 text-sm">
        <span className="mt-0.5 shrink-0">
          {calm ? <CheckCircle size={18} weight="fill" /> : sc.blackout ? <WifiSlash size={18} weight="bold" /> : sc.level === 'red' ? <Siren size={18} weight="fill" /> : <Warning size={18} weight="fill" />}
        </span>
        <span>
          <span className="font-semibold">{fixed ? 'Fixed' : sc.name}.</span> <span className="text-ink">{text}</span>
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {hazard && (
          <a href={hazard.url} target="_blank" rel="noreferrer" className="press flex min-h-9 items-center gap-1.5 rounded-full bg-panel/70 px-3 text-xs font-medium text-ink hover:bg-panel">
            NASA hazard: {hazard.nasaName}
            <ArrowSquareOut size={13} />
          </a>
        )}
        {scenario !== 'normal' && (
          <a href="#steps" className="press flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current">
            <ArrowDown size={16} />
            See the steps
          </a>
        )}
      </div>
    </div>
  )
}

function vitalLevel(key: 'hr' | 'spo2' | 'temp' | 'bp', r: CrewReading): Level {
  const T = THRESHOLDS
  if (key === 'hr') return r.restingHrBpm > T.restingHrMax ? 'amber' : 'green'
  if (key === 'spo2') return r.spo2Pct < T.spo2Red ? 'red' : r.spo2Pct < T.spo2Amber ? 'amber' : 'green'
  if (key === 'temp') return r.bodyTempC >= T.feverC ? 'amber' : 'green'
  return r.systolicBp >= T.bpHighSys || r.diastolicBp >= T.bpHighDia || r.systolicBp < T.bpLowSys ? 'amber' : 'green'
}

/** Heart rate, oxygen, temperature and blood pressure now, with the last minute as a line. */
function LiveVitals({ reading, recent, manual }: { reading: CrewReading; recent: CrewReading[]; manual: boolean }) {
  const rows = [
    { key: 'hr' as const, label: 'Heart rate', value: String(reading.restingHrBpm), unit: 'bpm', line: recent.map((r) => r.restingHrBpm) },
    { key: 'spo2' as const, label: 'Oxygen', value: String(reading.spo2Pct), unit: '%', line: recent.map((r) => r.spo2Pct) },
    { key: 'temp' as const, label: 'Temperature', value: reading.bodyTempC.toFixed(1), unit: 'C', line: recent.map((r) => r.bodyTempC) },
    { key: 'bp' as const, label: 'Blood pressure', value: `${reading.systolicBp}/${reading.diastolicBp}`, unit: 'mmHg', line: recent.map((r) => r.systolicBp) },
  ]
  return (
    <section className={`${PANEL} shrink-0 p-4`} aria-label="Live vitals">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2.5 font-semibold">
          <IconBadge>
            <Heartbeat size={18} weight="fill" />
          </IconBadge>
          Live vitals
        </h2>
        <span className="text-[11px] text-dim">updates every 2 s</span>
      </div>
      <dl className="mt-3 space-y-2.5">
        {rows.map((v) => {
          const level = vitalLevel(v.key, reading)
          return (
            <div key={v.key} className="flex items-center justify-between gap-3">
              <div>
                <dt className="text-xs text-muted">{v.label}</dt>
                <dd className={`text-2xl leading-tight tabular-nums ${level === 'green' ? 'text-ink' : level === 'amber' ? 'text-check' : 'text-urgent'}`}>
                  {v.value} <span className="text-xs text-muted">{v.unit}</span>
                </dd>
              </div>
              <Sparkline values={v.line} color={LEVEL_LINE[level]} width={96} />
            </div>
          )
        })}
      </dl>
      <p className="mt-3 text-[11px] leading-snug text-dim">{manual ? "Blood pressure from today's check-in. Heart rate, oxygen and temperature from the wearable." : 'From the wearable and the health kit.'}</p>
    </section>
  )
}

/** Cabin air and radiation now. */
function CabinNow({ cabin, recent }: { cabin: CabinReading; recent: CabinReading[] }) {
  const co2Level: Level = cabin.co2MmHg > THRESHOLDS.co2SpaceLimitMmHg ? 'amber' : 'green'
  const times = cabin.doseRateNowMSvH / (cabin.doseRateMSvDay / 24)
  const rateLevel: Level = times >= THRESHOLDS.stormShelterX ? 'red' : times >= THRESHOLDS.stormCautionX ? 'amber' : 'green'
  return (
    <section className={`${PANEL} shrink-0 p-4`} aria-label="Cabin now">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2.5 font-semibold">
          <IconBadge>
            <Wind size={18} weight="bold" />
          </IconBadge>
          Cabin now
        </h2>
        <span className="text-[11px] text-dim">updates every 2 s</span>
      </div>
      <dl className="mt-3 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <dt className="text-xs text-muted">CO2</dt>
            <dd className="text-xl leading-tight tabular-nums">
              {cabin.co2MmHg.toFixed(1)} <span className="text-xs text-muted">mmHg</span>
            </dd>
          </div>
          <Sparkline values={recent.map((c) => c.co2MmHg)} color={LEVEL_LINE[co2Level]} width={96} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <dt className="text-xs text-muted">Radiation now</dt>
            <dd className={`text-xl leading-tight tabular-nums ${rateLevel === 'green' ? 'text-ink' : rateLevel === 'amber' ? 'text-check' : 'text-urgent'}`}>
              {cabin.doseRateNowMSvH.toFixed(2)} <span className="text-xs text-muted">mSv/h</span>
            </dd>
            {cabin.shelterMSvH !== undefined && <p className="text-[11px] text-dim">In the shelter: {cabin.shelterMSvH.toFixed(2)} mSv/h</p>}
          </div>
          <Sparkline values={recent.map((c) => c.doseRateNowMSvH)} color={LEVEL_LINE[rateLevel]} width={96} />
        </div>
        <div>
          <dt className="text-xs text-muted">Radiation since launch</dt>
          <dd className="text-xl leading-tight tabular-nums">
            {cabin.cumulativeDoseMSv.toFixed(0)} <span className="text-xs text-muted">mSv</span>
          </dd>
        </div>
      </dl>
    </section>
  )
}

function age(p: Provenance): string {
  if (p.when) return p.when
  if (p.ageDays === 0) return p.auto ? 'live' : 'today'
  return p.ageDays === 1 ? 'yesterday' : `${p.ageDays} days ago`
}

interface RowProps {
  index: number
  f: Finding
  compact: boolean
  info?: Provenance
  trend: { values: number[]; baseline?: number }
  attachment?: ImageAttachment | null
  open: boolean
  onToggle: () => void
  onHover: (on: boolean) => void
  onCheckIn?: () => void
  onEmergency: () => void
  mission: MissionId
}

const ACTION_TEXT: Record<Level, string> = { green: 'text-ok', amber: 'text-check', red: 'text-urgent' }

function SignalRow({ index, f, compact, info, trend, attachment, open, onToggle, onHover, onCheckIn, onEmergency, mission }: RowProps) {
  const ref = useRef<HTMLDivElement>(null)
  // When a row opens (for example from a marker on the body), bring it into view.
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [open])
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.035, ease: EASE }}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      className={`mx-3 mb-2 overflow-hidden rounded-xl border transition-colors duration-200 ${LEVEL_TINT[f.level]} ${open ? 'shadow-[0_6px_18px_-12px_rgba(30,64,130,0.35)]' : ''}`}
    >
      <button onClick={onToggle} aria-expanded={open} className={`flex w-full flex-col px-4 text-left hover:bg-white/35 ${compact ? 'gap-0.5 py-2.5' : 'gap-2 py-3.5'}`}>
        <span className="flex w-full items-center gap-2">
          <span className={`min-w-0 flex-1 ${compact ? 'text-muted' : 'text-[15px] font-semibold'}`}>{f.title}</span>
          <Chip level={f.level} onTint />
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={SPRING} className="text-dim">
            <CaretDown size={16} />
          </motion.span>
        </span>
        <span className="flex w-full items-center justify-between gap-3">
          <span className="min-w-0">
            <span className={`block text-[13px] tabular-nums ${compact ? 'text-dim' : 'text-ink'}`}>{f.measured}</span>
            {info && (!compact || info.stale || open) && (
              <span className={`mt-0.5 flex items-center gap-1 text-xs ${info.stale ? 'text-check' : 'text-dim'}`}>
                {info.stale && <Warning size={13} weight="fill" />}
                {info.source}, {age(info)}
                {info.stale ? '. Getting old, re-measure.' : ''}
              </span>
            )}
          </span>
          {(!compact || open) && <Sparkline values={trend.values} baseline={trend.baseline} color={LEVEL_LINE[f.level]} />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: EASE }} className="overflow-hidden">
            <div className="space-y-4 px-4 pt-1 pb-4">
              {/* First thing to read: what to do. White, so it stands out on the coloured box. */}
              <div className="rounded-xl bg-panel p-4">
                <p className={`text-xs font-semibold ${ACTION_TEXT[f.level]}`}>{f.level === 'green' ? 'Nothing to do' : 'Do this next'}</p>
                <p className="mt-1 text-[15px] leading-snug font-medium">{f.next}</p>
                {(f.level !== 'green' || info?.stale) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {onCheckIn && (
                      <Button onClick={onCheckIn} className="min-h-10 bg-ground/60">
                        <NotePencil size={16} />
                        Log a new measurement
                      </Button>
                    )}
                    {f.level === 'red' && (
                      <Button kind="danger" onClick={onEmergency} className="min-h-10">
                        <Siren size={16} weight="fill" />
                        Open emergency steps
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <p className="leading-relaxed">{f.why}</p>

              {attachment && (
                <figure className="rounded-xl border border-line bg-panel/70 p-3 text-[13px]">
                  <img src={attachment.dataUrl} alt={attachment.caption ?? 'Attached eye ultrasound'} className="max-h-72 w-auto max-w-full rounded-lg border border-line-strong" />
                  <figcaption className="mt-2 leading-relaxed text-muted">
                    <span className="text-ink">Image attached to today's check-in.</span> {attachment.caption ? `${attachment.caption}. ` : ''}
                    {ATTACHMENT_LABEL}
                  </figcaption>
                </figure>
              )}

              {GUIDE[f.id] && (
                <div className="rounded-xl border border-line bg-panel/70 p-3 text-[13px] leading-relaxed">
                  <p className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                    About this measurement
                    <span className="rounded-md border border-line-strong px-1.5 py-0.5 text-ink">Hazard: {GUIDE[f.id].hazard}</span>
                  </p>
                  <p>{GUIDE[f.id].what}</p>
                  <p className="mt-1.5 text-muted">
                    <span className="text-ink">How to measure:</span> {GUIDE[f.id].how}
                  </p>
                  {NASA_RISK[f.id] && (
                    <p className="mt-1.5 text-muted">
                      <span className="text-ink">NASA risk:</span>{' '}
                      <a href={NASA_RISK[f.id].url} target="_blank" rel="noreferrer" className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                        {NASA_RISK[f.id].name}
                      </a>
                      {NASA_STUDY[f.id] && (
                        <>
                          . NASA is studying this now:{' '}
                          <a href={NASA_STUDY[f.id].url} target="_blank" rel="noreferrer" className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                            {NASA_STUDY[f.id].name}
                          </a>{' '}
                          ({NASA_STUDY[f.id].about})
                        </>
                      )}
                      .
                    </p>
                  )}
                  {PARTNER_WORK[f.id] && (
                    <p className="mt-1.5 text-muted">
                      <span className="text-ink">{PARTNER_WORK[f.id].agency}:</span>{' '}
                      <a href={PARTNER_WORK[f.id].url} target="_blank" rel="noreferrer" className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                        {PARTNER_WORK[f.id].name}
                      </a>{' '}
                      ({PARTNER_WORK[f.id].about}).
                    </p>
                  )}
                  {GUIDE[f.id].hazard === 'Gravity changes' && f.id !== 'balance' && f.id !== 'pain' && MISSIONS[mission].gravity > 0 && (
                    <p className="mt-2 rounded-lg bg-check-bg px-3 py-2 text-check">
                      On the Moon: gravity is one sixth of Earth's. These rules come from weightless missions. Fluid should move toward the head less than in weightlessness, but nobody has measured a long stay in Moon gravity.{' '}
                      <a href={SOURCES.GRAVITY_PARTIAL.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                        Short-flight study
                      </a>
                      . The simulation assumes 60% of the weightless change (demo parameter).
                    </p>
                  )}
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
