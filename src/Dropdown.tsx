import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CaretDown, Check, Lock } from '@phosphor-icons/react'
import type { Level } from './triage'
import { EASE, LEVEL_LINE, LEVEL_TINT, SPRING } from './ui'

export interface DropdownOption {
  id: string
  label: string
  /** Second line under the label. */
  detail?: string
  /** Coloured status dot. */
  level?: Level
  /** Short word on the right, for example a status. */
  note?: string
  disabled?: boolean
  /** Heading of the group this option belongs to. A heading shows wherever the group changes. */
  group?: string
}

interface Props {
  /** Small caption above the chosen value, for example "Scenario". */
  caption: string
  /** Name of the list for screen readers. */
  label: string
  value: string
  options: DropdownOption[]
  onChange: (id: string) => void
  align?: 'left' | 'right'
  /** Width of the open list (a Tailwind class). */
  listWidth?: string
  className?: string
  footer?: ReactNode
  /** Colour the whole button with the chosen option's status, instead of a status word. */
  tint?: boolean
}

export const Dot = ({ level, className = '' }: { level: Level; className?: string }) => (
  <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${className}`} style={{ background: LEVEL_LINE[level] }} />
)

/** A button that opens a list to pick one option. Closes on a click outside or Escape; arrow keys move. */
export default function Dropdown({ caption, label, value, options, onChange, align = 'right', listWidth = 'w-[20rem]', className = '', footer, tint = false }: Props) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const chosen = options.find((o) => o.id === value)
  const tinted = tint && chosen?.level ? LEVEL_TINT[chosen.level] : null

  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        box.current?.querySelector('button')?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', key)
    list.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus()
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  const arrows = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(list.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])]
    const at = items.indexOf(document.activeElement as HTMLButtonElement)
    items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
  }

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`press flex min-h-11 w-full items-center gap-2.5 rounded-full border px-4 text-left leading-tight ${tinted ?? `bg-panel ${open ? 'border-muted' : 'border-line-strong hover:border-muted'}`}`}
      >
        {chosen?.level && <Dot level={chosen.level} />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] text-muted">{caption}</span>
          <span className="block truncate text-sm font-medium">{chosen?.label}</span>
        </span>
        {chosen?.note && !tinted && <span className="shrink-0 text-xs text-muted">{chosen.note}</span>}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={SPRING} className="flex shrink-0 text-muted">
          <CaretDown size={14} weight="bold" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            ref={list}
            role="listbox"
            aria-label={label}
            onKeyDown={arrows}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: EASE }}
            className={`absolute z-30 mt-2 ${listWidth} max-h-[min(36rem,calc(100dvh-7rem))] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-line bg-panel p-1.5 shadow-[0_24px_60px_-20px_rgba(30,64,130,0.35)] ${align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'}`}
          >
            {options.map((o, i) => {
              const picked = o.id === value
              const heading = o.group && o.group !== options[i - 1]?.group ? o.group : null
              return (
                <li key={o.id} role="presentation">
                  {heading && <p className={`px-3 pb-1 text-[11px] font-medium tracking-wide text-dim uppercase ${i > 0 ? 'mt-1.5 border-t border-line-soft pt-2.5' : 'pt-1.5'}`}>{heading}</p>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={picked}
                    aria-disabled={o.disabled || undefined}
                    disabled={o.disabled}
                    onClick={() => {
                      onChange(o.id)
                      setOpen(false)
                    }}
                    className={`press flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50 ${picked ? 'bg-ground' : 'hover:bg-ground/60 focus-visible:bg-ground/60'}`}
                  >
                    {o.level ? <Dot level={o.level} className="mt-1.5" /> : o.disabled ? <Lock size={14} className="mt-1 shrink-0 text-dim" /> : null}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{o.label}</span>
                      {o.detail && <span className="mt-0.5 block text-xs leading-snug text-muted">{o.detail}</span>}
                    </span>
                    {o.note && <span className="mt-0.5 shrink-0 text-xs text-muted">{o.note}</span>}
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${picked ? 'bg-ink text-ground' : ''}`}>{picked && <Check size={12} weight="bold" />}</span>
                  </button>
                </li>
              )
            })}
            {footer && <li className="px-3 pt-2 pb-1.5 text-[11px] leading-snug text-dim">{footer}</li>}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
