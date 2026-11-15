import { useEffect, useState } from 'react'
import type { Finding } from './triage'
import { ChartLineUp } from '@phosphor-icons/react'
import { IconBadge, LEVEL_LINE } from './ui'

interface Props {
  subjectId: string
  subjectName: string
  rows: Finding[]
  /** Live values for a signal over the last two minutes, oldest first. */
  seriesFor: (findingId: string) => { values: number[]; baseline?: number }
}

const W = 900
const H = 96
const MAX = 3

/** One signal over the last two minutes of the live feed. */
function Strip({ title, values, baseline, color }: { title: string; values: number[]; baseline?: number; color: string }) {
  const all = baseline === undefined ? values : [...values, baseline]
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const flat = hi === lo
  const x = (i: number) => (values.length <= 1 ? W : (i / (values.length - 1)) * W)
  const y = (v: number) => (flat ? H / 2 : H - 10 - ((v - lo) / (hi - lo)) * (H - 20))
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const area = values.length > 1 ? `${path} L${x(values.length - 1).toFixed(1)} ${H} L0 ${H} Z` : ''
  const fillId = `fill-${title.replace(/[^a-z0-9]/gi, '')}`
  const now = values[values.length - 1]
  const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1))
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-t border-line-soft py-3 first:border-t-0">
      <div className="min-w-0">
        <p className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
          <span className="font-medium">{title}</span>
          <span className="text-xs text-dim">
            lowest {fmt(lo)}, highest {fmt(hi)}
            {baseline !== undefined ? `, pre-flight ${fmt(baseline)}` : ''}
          </span>
        </p>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-24 w-full" role="img" aria-label={`${title} over the last two minutes, now ${fmt(now)}`}>
          <defs>
            <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {area && <path d={area} fill={`url(#${fillId})`} />}
          {[W / 2].map((gx) => (
            <line key={gx} x1={gx} x2={gx} y1="0" y2={H} stroke="#EEF1F6" vectorEffect="non-scaling-stroke" />
          ))}
          {baseline !== undefined && <line x1="0" x2={W} y1={y(baseline)} y2={y(baseline)} stroke="#C5CCD8" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
          <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <circle cx={x(values.length - 1)} cy={y(now)} r="3.5" fill={color} />
        </svg>
      </div>
      <p className="w-16 text-right">
        <span className="block text-xl tabular-nums">{fmt(now)}</span>
        <span className="block text-[11px] text-dim">now</span>
      </p>
    </div>
  )
}

export default function TrendChart({ subjectId, subjectName, rows: allRows, seriesFor }: Props) {
  const rows = allRows.filter((f) => f.id !== 'ijv' && f.id !== 'headache')
  const flaggedIds = rows.filter((f) => f.level !== 'green').map((f) => f.id)
  const liveFirst = ['vitals', 'basics', 'co2'].filter((id) => rows.some((f) => f.id === id))
  const defaults = [...new Set([...flaggedIds, ...liveFirst])].slice(0, 2)
  const [picked, setPicked] = useState<string[]>(defaults)
  // A different person or cabin: start again from what is flagged for them.
  useEffect(() => setPicked(defaults), [subjectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = picked.filter((id) => rows.some((f) => f.id === id))
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-MAX)))

  return (
    <section className="mt-4 rounded-2xl border border-line bg-panel px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2.5 font-semibold">
          <IconBadge>
            <ChartLineUp size={18} weight="bold" />
          </IconBadge>
          Live trends: {subjectName}
        </h2>
        <p className="text-xs text-muted">Last two minutes. Pick up to {MAX} signals. Dashed line is the pre-flight value.</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Signals to chart">
        {rows.map((f) => (
          <button
            key={f.id}
            onClick={() => toggle(f.id)}
            aria-pressed={shown.includes(f.id)}
            className={`press min-h-9 rounded-full border px-3 text-xs font-medium ${shown.includes(f.id) ? 'border-ink bg-ink text-ground' : 'border-line-strong text-muted hover:text-ink'}`}
          >
            {f.title.replace(/ \(.*\)$/, '')}
          </button>
        ))}
      </div>
      <div className="mt-2">
        {shown.length === 0 && <p className="py-6 text-center text-sm text-muted">Pick a signal above to chart it.</p>}
        {shown.map((id) => {
          const f = rows.find((x) => x.id === id)!
          const s = seriesFor(id)
          return <Strip key={id} title={f.title} values={s.values} baseline={s.baseline} color={LEVEL_LINE[f.level]} />
        })}
      </div>
      <div className="mt-1 flex justify-between pr-20 font-mono text-[11px] text-dim" aria-hidden="true">
        <span>2 min ago</span>
        <span>1 min ago</span>
        <span>now</span>
      </div>
    </section>
  )
}
