import { useEffect, useId, type ReactNode } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import type { Level } from './triage'

export const CAPS = 'text-[11px] font-medium tracking-[0.08em] text-dim uppercase'
export const SPRING = { type: 'spring', stiffness: 420, damping: 34 } as const
export const EASE = [0.16, 1, 0.3, 1] as const

const LEVEL_LABEL: Record<Level, string> = { green: 'Normal', amber: 'Check', red: 'Urgent' }
const LEVEL_CHIP: Record<Level, string> = {
  green: 'border-transparent bg-ok-bg text-ok',
  amber: 'border-transparent bg-check-bg text-check',
  red: 'border-transparent bg-urgent-bg text-urgent',
}
export const LEVEL_LINE: Record<Level, string> = { green: '#22B35E', amber: '#EE9A12', red: '#EC4253' }

/** The SOMA logo: a planet with an orbit ring and a pin. Drawn in the text colour. */
export const LOGO_PATH =
  'M14.2 62.8C-3.9 61.9 -2.7 46.8 16.9 30.1C19 28.3 18.9 28.3 18.9 30.3C18.8 32 19 31.7 17.2 33.5C7.9 42.8 5.5 50.9 11 54.6C16.3 58 28.1 56.8 42.3 51.4C44.2 50.7 44.1 50.7 44.3 49.9C45.3 46.5 48.6 45 51.8 46.5C52.5 46.9 52.5 46.9 54 46.1C76.7 34.5 92.4 18 88.9 9.4C87.3 5.4 81.4 4 72.4 5.4C71.7 5.4 71 5.6 70.7 5.6C69.2 5.9 67.9 6.2 67.7 6.2C67.4 6.2 67.3 6.1 65.3 4.8C64.7 4.4 64.9 4.3 67.5 3.6C75.2 1.7 80.4 1.1 85.3 1.3C94.1 1.9 98.3 5.8 97.2 12.4C96.1 19.2 88.9 28.5 78 37.1C76.3 38.4 74.9 39.5 74 40.1C73.5 40.5 72.7 41.1 72.2 41.4C67.3 44.9 62.3 47.9 55.2 51.6C54.6 51.9 54.6 51.9 54.3 52.7C54.1 53.4 53.7 54.1 53.1 55.1C52.5 56 51 58.4 50.4 59.4C49.4 61.2 49.4 61.2 48.1 58.9C47.3 57.6 46.4 56.2 46.2 56.1C45.9 55.9 45.8 55.9 44.2 56.5C42.1 57.4 38.7 58.5 36.2 59.3C34.5 59.9 30.9 60.8 29.1 61.2C28.7 61.3 28 61.5 27.7 61.5C26.3 61.8 24.4 62.2 22 62.5C20.1 62.8 16.1 62.9 14.2 62.8ZM64.2 54.6C64.2 54.5 64.6 54.1 65 53.7C67.1 51.4 68.2 49.8 69.3 47.7C70 46.4 70.2 46.2 70.7 45.9C70.9 45.7 71.5 45.3 72.1 44.9C73.9 43.6 74 43.7 73.1 45.3C71.5 48.1 68.9 51 66.1 53.3C65 54.2 64 54.9 64.2 54.6ZM31 51.8C29.9 51.2 26.8 47.3 25.3 44.6C17.2 30.1 23.6 11.7 38.8 5.3C50.4 0.4 63.8 4.1 71.5 14.2C73.9 17.4 76.7 24.1 76.7 26.9C76.7 27.3 75.9 28.1 73.1 30.4C71.6 31.6 71.7 31.6 71.4 30.1C69.7 23.3 64.4 17.1 58 14.6C44.6 9.2 30 17.1 27.2 31.2C25.7 38.1 27.5 46.1 31.6 50.9C32 51.4 32.1 51.6 31.9 51.7C31.7 51.9 31.2 51.9 31 51.8ZM48.3 36.6C44.1 35.7 42.2 30.9 44.8 27.5C48.1 23.1 55.1 25.4 55.1 30.9C55.1 34.6 51.8 37.4 48.3 36.6Z'

export function Logo({ size = 34, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 98.5 64" height={size} width={(size * 98.5) / 64} role="img" aria-label="SOMA" className={`shrink-0 ${className}`}>
      <path fill="currentColor" fillRule="evenodd" d={LOGO_PATH} />
    </svg>
  )
}

/** On a box that is already tinted with the status colour, the chip is white so it still stands out. */
const LEVEL_CHIP_ON_TINT: Record<Level, string> = {
  green: 'border-transparent bg-panel text-ok',
  amber: 'border-transparent bg-panel text-check',
  red: 'border-transparent bg-panel text-urgent',
}

/** The whole box in the status colour: soft green, yellow or red. */
export const LEVEL_TINT: Record<Level, string> = {
  green: 'border-ok/15 bg-ok-bg/70',
  amber: 'border-check/25 bg-check-bg',
  red: 'border-urgent/25 bg-urgent-bg',
}

export function Chip({ level, className = '', tag, onTint = false }: { level: Level; className?: string; tag?: string; onTint?: boolean }) {
  return (
    <span className={`inline-flex h-6 min-w-[58px] items-center justify-center gap-1 rounded-md border px-2 text-xs font-medium ${(onTint ? LEVEL_CHIP_ON_TINT : LEVEL_CHIP)[level]} ${className}`}>
      {tag && <span className="text-[10px] font-normal opacity-70">{tag}</span>}
      {LEVEL_LABEL[level]}
    </span>
  )
}

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'ghost'
const BUTTON: Record<ButtonKind, string> = {
  primary: 'bg-ink text-white hover:bg-ink/85',
  secondary: 'border border-line bg-panel text-ink shadow-[0_1px_2px_rgba(30,64,130,0.06)] hover:border-line-strong hover:bg-raised',
  danger: 'bg-[#E5484D] text-white hover:bg-[#D93D43]',
  ghost: 'text-muted hover:bg-raised hover:text-ink',
}

export function Button({ kind = 'secondary', className = '', children, ...rest }: { kind?: ButtonKind; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`press inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap disabled:opacity-40 ${BUTTON[kind]} ${className}`}>
      {children}
    </button>
  )
}

/** A number that counts to its new value, so a change is seen, not missed. */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(value)
  const text = useTransform(mv, (v) => Math.round(v).toString())
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.5, ease: EASE })
    return () => controls.stop()
  }, [mv, value])
  return <motion.span className={className}>{text}</motion.span>
}

export function Sparkline({ values, baseline, color, width = 120 }: { values: number[]; baseline?: number; color: string; width?: number }) {
  const all = baseline === undefined ? values : [...values, baseline]
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const flat = hi === lo
  const y = (v: number) => (flat ? 14 : 24 - ((v - lo) / (hi - lo)) * 20)
  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${(values.length === 1 ? width / 2 : (i * width) / (values.length - 1)).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const gid = `spark${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg viewBox={`0 0 ${width} 28`} width={width} height="28" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {values.length > 1 && <path d={`${d} L${width} 28 L0 28 Z`} fill={`url(#${gid})`} />}
      {baseline !== undefined && <line x1="0" x2={width} y1={y(baseline)} y2={y(baseline)} stroke="#C5CCD8" strokeDasharray="3 3" />}
      <motion.path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, ease: EASE }} />
    </svg>
  )
}

/** Ring gauge for cabin values. */
export function Gauge({ label, value, unit, fraction, level, note }: { label: string; value: string; unit: string; fraction: number; level: Level; note: string }) {
  const r = 54
  const c = 2 * Math.PI * r
  const f = Math.max(0, Math.min(1, fraction))
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="64" cy="64" r={r} fill="none" stroke="#E6EAF1" strokeWidth="5" />
          <motion.circle cx="64" cy="64" r={r} fill="none" stroke={LEVEL_LINE[level]} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - f) }} transition={{ duration: 0.9, ease: EASE }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-medium tabular-nums">{value}</span>
          <span className="text-xs text-muted">{unit}</span>
        </div>
      </div>
      <div>
        <p className="font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted">{note}</p>
      </div>
    </div>
  )
}
/** Black round badge with a white icon, used beside card titles. */
export function IconBadge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white ${className}`}>{children}</span>
}
