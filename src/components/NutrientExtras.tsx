/**
 * The nutrition figures beyond the big three macros: fibre against a target,
 * total sugar, and protein relative to body weight.
 *
 * Shared by the Dashboard and History day view so both read the same way.
 */
import type { Nutrients } from '@/types'
import { calculateFiberTarget, proteinPerKg, round } from '@/utils/calculations'
import { ProgressBar } from './ui'

export function NutrientExtras({ nutrients, calorieTarget, proteinTarget, weightKg, compact }: {
  nutrients: Nutrients
  calorieTarget: number
  proteinTarget: number
  weightKg: number
  /** Smaller type and left-aligned, for the History day card. */
  compact?: boolean
}) {
  const fiberTarget = calculateFiberTarget(calorieTarget)
  const fiber = Math.round(nutrients.fiber)
  const perKg = proteinPerKg(nutrients.protein, weightKg)
  const perKgTarget = proteinPerKg(proteinTarget, weightKg)

  const value = compact ? 'text-[13px]' : 'text-[15px]'
  const cell = compact ? '' : 'px-2 text-center'

  return (
    <div className="grid grid-cols-3 gap-3 w-full">
      <div className={cell}>
        <div className={`flex items-baseline gap-1 ${compact ? 'justify-between' : 'justify-center'}`}>
          <span className={compact ? 'text-[11.5px] text-muted' : `${value} font-bold tabular-nums`}>
            {compact ? 'Fiber' : fiber}
          </span>
          <span className={compact ? `${value} font-semibold tabular-nums` : 'text-[11px] text-faint'}>
            {compact ? `${fiber}g` : `/${fiberTarget}g`}
          </span>
        </div>
        {!compact && <p className="text-[11.5px] text-muted mb-1.5">Fiber</p>}
        <div className={compact ? 'mt-1' : ''}>
          <ProgressBar value={fiber / fiberTarget} color="success" height={compact ? 4 : 5} />
        </div>
      </div>

      <div className={cell}>
        {compact ? (
          <div className="flex items-baseline justify-between">
            <span className="text-[11.5px] text-muted">Sugar</span>
            <span className={`${value} font-semibold tabular-nums`}>{round(nutrients.sugar, 0)}g</span>
          </div>
        ) : (
          <>
            <span className={`${value} font-bold tabular-nums block`}>{round(nutrients.sugar, 0)}g</span>
            <p className="text-[11.5px] text-muted">Sugar</p>
            <p className="text-[10.5px] text-faint leading-tight">total sugars</p>
          </>
        )}
      </div>

      <div className={cell}>
        {compact ? (
          <div className="flex items-baseline justify-between">
            <span className="text-[11.5px] text-muted">Protein/kg</span>
            <span className={`${value} font-semibold tabular-nums`}>{perKg}</span>
          </div>
        ) : (
          <>
            <span className={`${value} font-bold tabular-nums block`}>
              {perKg}<span className="text-[11px] text-faint font-normal"> g/kg</span>
            </span>
            <p className="text-[11.5px] text-muted">Protein/kg</p>
            {perKgTarget > 0 && (
              <p className="text-[10.5px] text-faint leading-tight">target {perKgTarget}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
