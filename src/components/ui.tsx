/** Shared presentational primitives used across every screen. */
import {
  useEffect, useMemo, useRef, useState, type ReactNode, type InputHTMLAttributes,
} from 'react'
import { CloseIcon } from './icons'

// ── Layout ──────────────────────────────────────────────────────────────────

export function Card({ className = '', children, ...rest }: {
  className?: string; children: ReactNode
} & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...rest}>{children}</div>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-2.5 px-1">
      <h2 className="text-[15px] font-semibold text-ink">{children}</h2>
      {action}
    </div>
  )
}

export function Screen({ title, subtitle, right, children }: {
  title?: string; subtitle?: string; right?: ReactNode; children: ReactNode
}) {
  return (
    <div className="px-4 pt-3">
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            {title && <h1 className="text-[26px] font-bold tracking-tight leading-tight">{title}</h1>}
            {subtitle && <p className="text-[13px] text-muted mt-0.5">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </div>
  )
}

// ── Progress ────────────────────────────────────────────────────────────────

export function ProgressBar({ value, color = 'brand', height = 8, track = true }: {
  /** 0-1; values above 1 are shown as a full bar tinted to signal overflow. */
  value: number
  /** A semantic token name: brand | protein | carbs | fat | burn | water. */
  color?: 'brand' | 'protein' | 'carbs' | 'fat' | 'burn' | 'water' | 'danger'
    | 'success' | 'insight' | 'achievement'
  height?: number
  track?: boolean
}) {
  const pct = Math.min(100, Math.max(0, value * 100))
  const over = value > 1.02
  // The colour is applied via a CSS variable rather than an interpolated class
  // name, which Tailwind's compiler cannot see at build time.
  const fill = `rgb(var(--c-${over ? 'danger' : color}))`
  return (
    <div
      className={`w-full rounded-full overflow-hidden ${track ? 'bg-raised' : ''}`}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%`, background: fill }}
      />
    </div>
  )
}

/**
 * Circular progress ring used for the dashboard's calorie headline.
 *
 * Pass `gradient` to sweep the arc through several hues; a solid `color` is
 * used otherwise. Each instance needs its own gradient id, or two rings on one
 * screen would share (and fight over) the same SVG definition.
 */
let ringSeq = 0

export function ProgressRing({
  value, size = 168, stroke = 13, children, color = 'rgb(var(--c-brand))', gradient,
}: {
  value: number
  size?: number
  stroke?: number
  children?: ReactNode
  color?: string
  /** Two or more CSS colours swept along the arc. */
  gradient?: string[]
}) {
  const gradientId = useMemo(() => `ring-grad-${++ringSeq}`, [])
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const clamped = Math.min(1, Math.max(0, value))
  const over = value > 1.02

  const strokeColor = over
    ? 'rgb(var(--c-danger))'
    : gradient && gradient.length > 1 ? `url(#${gradientId})` : color

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        {gradient && gradient.length > 1 && (
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              {gradient.map((c, i) => (
                <stop key={i} offset={`${(i / (gradient.length - 1)) * 100}%`} stopColor={c} />
              ))}
            </linearGradient>
          </defs>
        )}
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="rgb(var(--c-raised))" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={strokeColor}
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.32,.72,0,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        {children}
      </div>
    </div>
  )
}

/** The calorie ring's hue sweep, shared so other screens can match it. */
export const CALORIE_RING_GRADIENT = [
  'rgb(var(--c-brand))',
  'rgb(var(--g-to))',
  'rgb(var(--c-fat))',
  'rgb(var(--c-carbs))',
]

export function StatTile({ icon, label, value, sub, onClick, accent }: {
  icon?: ReactNode; label: string; value: ReactNode; sub?: string
  onClick?: () => void; accent?: string
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`card flex-1 min-w-0 text-left p-3 focusable ${onClick ? 'active:scale-[0.98] transition' : ''}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span style={{ color: accent }}>{icon}</span>}
        <span className="text-[12px] text-muted font-medium truncate">{label}</span>
      </div>
      <div className="text-[19px] font-bold leading-tight tabular-nums truncate">{value}</div>
      {sub && <div className="text-[11px] text-faint mt-0.5 truncate">{sub}</div>}
    </Tag>
  )
}

// ── Bottom sheet ────────────────────────────────────────────────────────────

/**
 * Modal bottom sheet — the primary surface for every add/edit flow, since it
 * keeps controls within thumb reach on a phone.
 */
export function Sheet({ open, onClose, title, children, footer, fullHeight }: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  fullHeight?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    // Lock background scroll while the sheet owns the screen.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button
        className="absolute inset-0 bg-black/55 animate-fade-in"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        ref={panelRef}
        className={`relative bg-surface rounded-t-3xl shadow-2xl animate-slide-up flex flex-col
                    ${fullHeight ? 'h-[92vh]' : 'max-h-[88vh]'}`}
      >
        <div className="shrink-0 pt-2.5 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-line" />
        </div>
        {title && (
          <div className="shrink-0 flex items-center justify-between px-4 pb-3 pt-1">
            <h2 className="text-[17px] font-semibold">{title}</h2>
            <button onClick={onClose} className="tap -mr-2 text-muted focusable rounded-lg" aria-label="Close">
              <CloseIcon size={22} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-2">{children}</div>
        {footer && (
          <div
            className="shrink-0 px-4 pt-3 border-t border-line bg-surface rounded-b-none"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Inputs ──────────────────────────────────────────────────────────────────

export function Field({ label, hint, error, children }: {
  label: string; hint?: string; error?: string; children: ReactNode
}) {
  return (
    <label className="block mb-3.5">
      <span className="label block mb-1.5">{label}</span>
      {children}
      {error
        ? <span className="block text-[12px] text-danger mt-1">{error}</span>
        : hint ? <span className="block text-[12px] text-faint mt-1">{hint}</span> : null}
    </label>
  )
}

/**
 * Numeric input that keeps an editable string internally so intermediate
 * states ("", "1.") don't get clobbered while the user types.
 */
export function NumberField({
  value, onChange, suffix, min, max, step = 1, ...rest
}: {
  value: number
  onChange: (n: number) => void
  suffix?: string
  min?: number
  max?: number
  step?: number
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max' | 'step'>) {
  const [text, setText] = useState(String(value))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setText(String(value))
  }, [value])

  return (
    <div className="relative">
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        className="field pr-14"
        value={text}
        onFocus={() => { focused.current = true }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, '')
          setText(raw)
          const n = parseFloat(raw)
          if (!Number.isNaN(n)) onChange(n)
        }}
        onBlur={() => {
          focused.current = false
          let n = parseFloat(text)
          if (Number.isNaN(n)) n = min ?? 0
          if (min !== undefined) n = Math.max(min, n)
          if (max !== undefined) n = Math.min(max, n)
          n = Math.round(n / step) * step
          n = Math.round(n * 100) / 100
          setText(String(n))
          onChange(n)
        }}
      />
      {suffix && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-faint pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  )
}

export function Stepper({ value, onChange, step = 1, min = 0, max, suffix }: {
  value: number; onChange: (n: number) => void
  step?: number; min?: number; max?: number; suffix?: string
}) {
  const set = (n: number) => {
    let next = Math.round(n * 100) / 100
    next = Math.max(min, next)
    if (max !== undefined) next = Math.min(max, next)
    onChange(next)
  }
  return (
    <div className="flex items-center gap-2">
      <button
        type="button" onClick={() => set(value - step)}
        className="tap rounded-xl bg-raised text-xl font-semibold focusable" aria-label="Decrease"
      >−</button>
      <div className="flex-1"><NumberField value={value} onChange={set} min={min} max={max} step={step} suffix={suffix} /></div>
      <button
        type="button" onClick={() => set(value + step)}
        className="tap rounded-xl bg-raised text-xl font-semibold focusable" aria-label="Increase"
      >+</button>
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange, className = '' }: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={`flex gap-1 p-1 bg-raised rounded-xl ${className}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 min-h-[38px] rounded-lg text-[13px] font-semibold transition focusable
            ${value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label?: string
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-[50px] h-[30px] rounded-full transition-colors shrink-0 focusable
        ${checked ? 'bg-brand' : 'bg-line'}`}
    >
      <span
        className={`absolute top-[3px] left-[3px] w-6 h-6 rounded-full bg-white shadow transition-transform
          ${checked ? 'translate-x-5' : ''}`}
      />
    </button>
  )
}

export function Row({ label, sub, value, onClick, icon, danger, right }: {
  label: string; sub?: string; value?: ReactNode; onClick?: () => void
  icon?: ReactNode; danger?: boolean; right?: ReactNode
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left transition focusable
        ${onClick ? 'active:bg-raised' : ''} ${danger ? 'text-danger' : ''}`}
    >
      {icon && <span className={danger ? 'text-danger' : 'text-muted'}>{icon}</span>}
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-medium truncate">{label}</span>
        {sub && <span className="block text-[12px] text-faint truncate">{sub}</span>}
      </span>
      {value !== undefined && <span className="text-[14px] text-muted shrink-0">{value}</span>}
      {right}
    </Tag>
  )
}

export function List({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-surface rounded-2xl border border-line/70 overflow-hidden divide-y divide-line/70 ${className}`}>
      {children}
    </div>
  )
}

// ── States ──────────────────────────────────────────────────────────────────

export function EmptyState({ icon, title, body, action }: {
  icon: string; title: string; body: string; action?: ReactNode
}) {
  return (
    <div className="text-center py-10 px-6 animate-pop-in">
      <div className="text-4xl mb-3" aria-hidden="true">{icon}</div>
      <h3 className="text-[16px] font-semibold mb-1.5">{title}</h3>
      <p className="text-[13.5px] text-muted leading-relaxed max-w-[300px] mx-auto">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3" role="status">
      <div className="w-8 h-8 rounded-full border-[3px] border-line border-t-brand animate-spin" />
      <span className="text-[13px] text-muted">{label}</span>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-14 px-6">
      <div className="text-4xl mb-3" aria-hidden="true">⚠️</div>
      <h3 className="text-[16px] font-semibold mb-1.5">Something went wrong</h3>
      <p className="text-[13.5px] text-muted mb-5">{message}</p>
      {onRetry && <button className="btn-ghost" onClick={onRetry}>Try again</button>}
    </div>
  )
}

/** Small print for anything derived from an estimate rather than measured. */
export function EstimateNote({ children }: { children: ReactNode }) {
  return <p className="text-[11.5px] text-faint leading-snug">{children}</p>
}

// ── Toast ───────────────────────────────────────────────────────────────────

let toastSeq = 0
type ToastItem = { id: number; message: string; action?: { label: string; run: () => void } }
const toastListeners = new Set<(t: ToastItem) => void>()

export function toast(message: string, action?: ToastItem['action']): void {
  const item = { id: ++toastSeq, message, action }
  toastListeners.forEach((l) => l(item))
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    const add = (t: ToastItem) => {
      setItems((prev) => [...prev.slice(-2), t])
      window.setTimeout(() => setItems((prev) => prev.filter((p) => p.id !== t.id)), 3600)
    }
    toastListeners.add(add)
    return () => { toastListeners.delete(add) }
  }, [])

  if (items.length === 0) return null

  return (
    <div
      className="fixed left-0 right-0 z-[60] px-4 flex flex-col items-center gap-2 pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5.5rem)' }}
      role="status"
      aria-live="polite"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto max-w-[420px] w-full bg-ink text-bg rounded-xl px-4 py-3
                     text-[13.5px] font-medium shadow-xl flex items-center gap-3 animate-pop-in"
        >
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              className="font-bold text-brand shrink-0"
              onClick={() => { t.action!.run(); setItems((p) => p.filter((x) => x.id !== t.id)) }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Confirm dialog ──────────────────────────────────────────────────────────

export function ConfirmDialog({ open, title, body, confirmLabel = 'Delete', onConfirm, onCancel, destructive = true }: {
  open: boolean; title: string; body?: string; confirmLabel?: string
  onConfirm: () => void; onCancel: () => void; destructive?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-6" role="alertdialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/60 animate-fade-in" onClick={onCancel} aria-label="Cancel" />
      <div className="relative bg-surface rounded-2xl p-5 w-full max-w-[340px] animate-pop-in">
        <h3 className="text-[17px] font-semibold mb-1.5">{title}</h3>
        {body && <p className="text-[13.5px] text-muted leading-relaxed mb-5">{body}</p>}
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onCancel}>Cancel</button>
          <button
            className={destructive ? 'btn flex-1 bg-danger text-white' : 'btn-primary flex-1'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
