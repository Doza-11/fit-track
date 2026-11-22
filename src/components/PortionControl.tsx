/**
 * Portion picker shared by "add food" and "edit a logged item": a slider for
 * quick, coarse changes, a stepper for exact values, one-tap common amounts,
 * and the nutrition updating live as you drag.
 */
import type { Nutrients } from '@/types'
import { round } from '@/utils/calculations'
import { Stepper } from './ui'

const QUICK = [0.5, 1, 1.5, 2, 3]
const STEP = 0.25
const MIN = 0.25

export function PortionControl({ quantity, onChange, servingLabel, grams, nutrients, hint }: {
  quantity: number
  onChange: (q: number) => void
  servingLabel: string
  /** Total weight; omitted when the serving was never weighed. */
  grams?: number
  nutrients: Nutrients
  /** e.g. "You usually have 2 × 1 roti". */
  hint?: string
}) {
  // The slider range grows with the value so large portions stay reachable
  // without making the common 0.5–3 range fiddly.
  const max = Math.min(50, Math.max(5, Math.ceil(quantity * 2)))
  const fmt = (q: number) => (Number.isInteger(q) ? String(q) : String(round(q, 2)))

  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between mb-1">
        <span className="label">Portion</span>
        {grams !== undefined && (
          <span className="text-[12px] text-faint tabular-nums">{round(grams, 0)} g total</span>
        )}
      </div>

      <p className="text-[22px] font-bold tabular-nums leading-tight">
        {fmt(quantity)} <span className="text-[14px] font-medium text-muted">× {servingLabel}</span>
      </p>
      {hint && <p className="text-[12px] text-brand mt-0.5">{hint}</p>}

      <input
        type="range"
        min={MIN} max={max} step={STEP}
        value={Math.min(quantity, max)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full my-3 accent-brand h-2 cursor-pointer"
        aria-label={`Portion, ${fmt(quantity)} times ${servingLabel}`}
      />

      <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onChange(q)}
            className={quantity === q ? 'chip-on' : 'chip-off'}
          >
            {q === 0.5 ? '½' : q === 1.5 ? '1½' : q}×
          </button>
        ))}
      </div>

      <Stepper value={quantity} onChange={onChange} step={STEP} min={MIN} max={50} />

      <div className="grid grid-cols-4 gap-2 mt-3 text-center">
        {([
          ['kcal', nutrients.calories, ''],
          ['Protein', nutrients.protein, 'g'],
          ['Carbs', nutrients.carbs, 'g'],
          ['Fat', nutrients.fat, 'g'],
        ] as const).map(([label, value, unit]) => (
          <div key={label} className="rounded-xl bg-raised py-2">
            <span className="block text-[15px] font-bold tabular-nums">{Math.round(value)}{unit}</span>
            <span className="block text-[10.5px] text-faint">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
