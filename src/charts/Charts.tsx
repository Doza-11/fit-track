/**
 * Charts, hand-built as inline SVG.
 *
 * A charting library would add ~100 kB gzipped for four chart shapes on a
 * mobile-first app. These render from real tracked data, scale to the
 * container, and inherit the theme through CSS variables.
 */
import { useMemo, useState, type ReactNode } from 'react'

export interface Point {
  label: string
  value: number
  /** Set when a day has no data, so we can render a gap rather than a zero. */
  empty?: boolean
}

const PAD = { top: 12, right: 8, bottom: 22, left: 34 }

/** Exported for unit tests only. */
export const __niceMaxForTest = (n: number) => niceMax(n)

/**
 * Round an axis maximum up to a readable value.
 *
 * The candidate steps are fine-grained on purpose: jumping straight from 2 to 5
 * would put a 2,400 kcal series on a 5,000 axis and squash every bar into the
 * bottom half of the chart.
 */
const AXIS_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]

function niceMax(max: number): number {
  if (max <= 0) return 10
  const mag = 10 ** Math.floor(Math.log10(max))
  const scaled = max / mag
  const step = AXIS_STEPS.find((s) => scaled <= s) ?? 10
  return step * mag
}

function useAxis(points: Point[], targetLine?: number) {
  return useMemo(() => {
    const values = points.filter((p) => !p.empty).map((p) => p.value)
    const rawMax = Math.max(...values, targetLine ?? 0, 1)
    return { max: niceMax(rawMax * 1.1) }
  }, [points, targetLine])
}

/** Compact axis labels: 2200 → "2.2k". */
function fmt(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

function Tooltip({ children }: { children: ReactNode }) {
  return (
    <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none
                    bg-ink text-bg text-[11px] font-semibold px-2 py-1 rounded-lg whitespace-nowrap z-10">
      {children}
    </div>
  )
}

// ── Bar chart ───────────────────────────────────────────────────────────────

export function BarChart({
  points, target, height = 172, color = 'brand', unit = '', showEveryNth,
}: {
  points: Point[]
  target?: number
  height?: number
  color?: string
  unit?: string
  /** Label thinning for long ranges; auto-derived when omitted. */
  showEveryNth?: number
}) {
  const [active, setActive] = useState<number | null>(null)
  const { max } = useAxis(points, target)
  const nth = showEveryNth ?? Math.max(1, Math.ceil(points.length / 8))

  if (points.length === 0) return <NoData height={height} />

  const gap = points.length > 20 ? 1 : points.length > 10 ? 2 : 4
  const plotH = height - PAD.top - PAD.bottom

  return (
    <div className="relative w-full select-none" style={{ height }}>
      {/* Y grid */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" aria-hidden="true">
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={PAD.left} x2="100%" y1={PAD.top + plotH * (1 - f)} y2={PAD.top + plotH * (1 - f)}
            stroke="rgb(var(--c-line))" strokeWidth={1}
          />
        ))}
        {target !== undefined && target > 0 && target <= max && (
          <line
            x1={PAD.left} x2="100%"
            y1={PAD.top + plotH * (1 - target / max)} y2={PAD.top + plotH * (1 - target / max)}
            stroke="rgb(var(--c-brand))" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.75}
          />
        )}
      </svg>

      {/* Y labels */}
      <div
        className="absolute left-0 flex flex-col justify-between text-[10px] text-faint tabular-nums"
        style={{ top: PAD.top - 5, height: plotH + 10, width: PAD.left - 4 }}
      >
        <span className="text-right">{fmt(max)}</span>
        <span className="text-right">{fmt(max / 2)}</span>
        <span className="text-right">0</span>
      </div>

      {/* Bars */}
      <div
        className="absolute flex items-end"
        style={{ left: PAD.left, right: PAD.right, top: PAD.top, height: plotH, gap }}
      >
        {points.map((p, i) => {
          const h = p.empty || p.value <= 0 ? 0 : Math.max(2, (p.value / max) * plotH)
          const isActive = active === i
          const over = target !== undefined && p.value > target
          return (
            <button
              key={`${p.label}-${i}`}
              className="relative flex-1 h-full flex items-end min-w-0 group focusable rounded"
              onClick={() => setActive(isActive ? null : i)}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              aria-label={`${p.label}: ${p.empty ? 'no data' : `${Math.round(p.value)}${unit}`}`}
            >
              {isActive && !p.empty && (
                <Tooltip>{p.label} · {Math.round(p.value).toLocaleString()}{unit}</Tooltip>
              )}
              <div
                className="w-full rounded-t-[3px] transition-all duration-500"
                style={{
                  height: h,
                  background: p.empty
                    ? 'rgb(var(--c-line))'
                    : `rgb(var(--c-${over && target ? 'burn' : color}))`,
                  opacity: active === null || isActive ? 1 : 0.55,
                }}
              />
            </button>
          )
        })}
      </div>

      {/* X labels, absolutely placed so a shown label is never clipped by
          the width of its own bar in a long range. */}
      <div
        className="absolute text-[10px] text-faint"
        style={{ left: PAD.left, right: PAD.right, bottom: 2, height: 14 }}
      >
        {points.map((p, i) => (
          i % nth === 0 ? (
            <span
              key={`${p.label}-x-${i}`}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${((i + 0.5) / points.length) * 100}%` }}
            >
              {p.label}
            </span>
          ) : null
        ))}
      </div>
    </div>
  )
}

// ── Line chart ──────────────────────────────────────────────────────────────

export function LineChart({
  points, height = 172, color = 'brand', unit = '', target, fillArea = true, decimals = 0,
}: {
  points: Point[]
  height?: number
  color?: string
  unit?: string
  target?: number
  fillArea?: boolean
  decimals?: number
}) {
  const [active, setActive] = useState<number | null>(null)
  const real = points.filter((p) => !p.empty)

  const { min, max } = useMemo(() => {
    const vals = real.map((p) => p.value)
    if (vals.length === 0) return { min: 0, max: 1 }
    // The domain follows the data only. Stretching it to reach a distant
    // target (a 70 kg goal against a 78-79 kg series) would flatten the trend
    // into a single line; the target is drawn only when it lands inside.
    const lo = Math.min(...vals)
    const hi = Math.max(...vals)
    // Pad relative to the *range*, not the absolute values: a 1.4 kg spread
    // around 79 kg needs ~0.2 kg of headroom, not 1.6 kg, or the series is
    // squashed into a sliver at the top of the plot.
    const range = hi - lo
    const pad = range > 0 ? range * 0.18 : Math.max(hi * 0.05, 0.5)
    return { min: lo - pad, max: hi + pad }
  }, [real])

  if (real.length === 0) return <NoData height={height} />

  const plotW = 100
  const plotH = height - PAD.top - PAD.bottom
  const span = max - min || 1

  const coords = points.map((p, i) => ({
    x: points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW,
    y: PAD.top + plotH * (1 - (p.value - min) / span),
    p, i,
  })).filter((c) => !c.p.empty)

  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ')
  const area = `${path} L${coords[coords.length - 1].x},${PAD.top + plotH} L${coords[0].x},${PAD.top + plotH} Z`
  const stroke = `rgb(var(--c-${color}))`
  const nth = Math.max(1, Math.ceil(points.length / 6))

  return (
    <div className="relative w-full select-none" style={{ height }}>
      <svg
        className="absolute inset-0 w-full h-full overflow-visible"
        viewBox={`0 0 ${plotW} ${height}`} preserveAspectRatio="none" aria-hidden="true"
      >
        {[0, 0.5, 1].map((f) => (
          <line
            key={f} x1={0} x2={plotW}
            y1={PAD.top + plotH * f} y2={PAD.top + plotH * f}
            stroke="rgb(var(--c-line))" strokeWidth={0.4} vectorEffect="non-scaling-stroke"
          />
        ))}
        {target !== undefined && target >= min && target <= max && (
          <line
            x1={0} x2={plotW}
            y1={PAD.top + plotH * (1 - (target - min) / span)}
            y2={PAD.top + plotH * (1 - (target - min) / span)}
            stroke="rgb(var(--c-brand))" strokeDasharray="3 3" strokeWidth={1}
            vectorEffect="non-scaling-stroke" opacity={0.7}
          />
        )}
        {fillArea && coords.length > 1 && (
          <path d={area} fill={stroke} opacity={0.12} />
        )}
        <path
          d={path} fill="none" stroke={stroke} strokeWidth={2.2}
          strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Points sit in an overlay so they stay circular despite the stretched viewBox. */}
      <div className="absolute inset-0">
        {coords.map((c) => (
          <button
            key={c.i}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center focusable rounded-full"
            style={{ left: `${c.x}%`, top: c.y }}
            onClick={() => setActive(active === c.i ? null : c.i)}
            onMouseEnter={() => setActive(c.i)}
            onMouseLeave={() => setActive(null)}
            aria-label={`${c.p.label}: ${c.p.value.toFixed(decimals)}${unit}`}
          >
            <span
              className="block rounded-full border-2 transition-all"
              style={{
                width: active === c.i ? 11 : 7,
                height: active === c.i ? 11 : 7,
                background: 'rgb(var(--c-surface))',
                borderColor: stroke,
              }}
            />
            {active === c.i && (
              <Tooltip>{c.p.label} · {c.p.value.toFixed(decimals)}{unit}</Tooltip>
            )}
          </button>
        ))}
      </div>

      <div className="absolute text-[10px] text-faint" style={{ left: 0, right: 0, bottom: 2, height: 14 }}>
        {points.map((p, i) => (
          i % nth === 0 ? (
            <span
              key={`${p.label}-${i}`}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{
                left: `${points.length === 1 ? 50 : (i / (points.length - 1)) * 100}%`,
                // Keep the first and last labels inside the plot area.
                transform: i === 0 ? 'none' : i === points.length - 1 ? 'translateX(-100%)' : undefined,
              }}
            >
              {p.label}
            </span>
          ) : null
        ))}
      </div>
    </div>
  )
}

// ── Donut ───────────────────────────────────────────────────────────────────

export function DonutChart({ slices, size = 128, thickness = 22, center }: {
  slices: Array<{ label: string; value: number; color: string }>
  size?: number
  thickness?: number
  center?: ReactNode
}) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let offset = 0

  if (total <= 0) {
    return (
      <div
        className="rounded-full border-[16px] border-line flex items-center justify-center text-[11px] text-faint"
        style={{ width: size, height: size }}
      >
        No data
      </div>
    )
  }

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {slices.map((s) => {
          const frac = s.value / total
          const dash = c * frac
          const el = (
            <circle
              key={s.label}
              cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
            />
          )
          offset += dash
          return el
        })}
      </svg>
      {center && <div className="absolute inset-0 flex flex-col items-center justify-center">{center}</div>}
    </div>
  )
}

function NoData({ height }: { height: number }) {
  return (
    <div
      className="w-full flex items-center justify-center text-[12.5px] text-faint bg-raised/50 rounded-xl"
      style={{ height }}
    >
      Not enough data yet
    </div>
  )
}

export function ChartLegend({ items }: { items: Array<{ label: string; color: string; value?: string }> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: i.color }} />
          <span className="text-[12px] text-muted">{i.label}</span>
          {i.value && <span className="text-[12px] font-semibold tabular-nums">{i.value}</span>}
        </div>
      ))}
    </div>
  )
}
