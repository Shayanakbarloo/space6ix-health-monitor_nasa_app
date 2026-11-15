import { useEffect, useState } from 'react'
import { WifiSlash } from '@phosphor-icons/react'
import Dropdown from './Dropdown'
import { LIVE_SCENARIOS, SCENARIO_ORDER, isScenario, type ScenarioId } from './live'

/** Demo control: which live scenario the feed is playing. */
export function ScenarioMenu({ value, onChange }: { value: ScenarioId; onChange: (s: ScenarioId) => void }) {
  return (
    <Dropdown
      caption="Scenario"
      label="Live scenario"
      value={value}
      onChange={(id) => isScenario(id) && onChange(id)}
      className="min-w-[10.5rem]"
      listWidth="w-[22rem]"
      options={SCENARIO_ORDER.map((id) => ({
        id,
        label: LIVE_SCENARIOS[id].name,
        detail: LIVE_SCENARIOS[id].summary,
        level: LIVE_SCENARIOS[id].level,
        group: LIVE_SCENARIOS[id].group === 'health' ? 'Crew health' : "NASA's five space hazards",
      }))}
      footer="A demo control. It switches the live feed for the whole crew. The hazard scenarios follow NASA's five hazards of human spaceflight."
    />
  )
}

/** "LIVE" with the time now, ticking every second. */
export function LiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-panel px-4">
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full rounded-full bg-ok opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ok" />
      </span>
      <span className="font-mono text-[11px] tracking-[0.08em] text-ok">LIVE</span>
      <time dateTime={now.toISOString()} className="font-mono text-sm tabular-nums">
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </time>
    </span>
  )
}

/** Shown in the header while a planned blackout is on: the time left, and a way back to the plan. */
export function BlackoutChip({ end, onOpen }: { end: number; onOpen: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])
  // One second plays one minute of the blackout.
  const left = Math.max(0, Math.ceil((end - now) / 1000))
  return (
    <button onClick={onOpen} className="press flex min-h-11 items-center gap-2 rounded-full border border-check/30 bg-check-bg px-4 text-sm font-medium text-check">
      <WifiSlash size={18} weight="bold" />
      No contact · {left} min left
    </button>
  )
}
