/**
 * One-tap logging of a usual (or yesterday's) meal.
 *
 * Detection lives in `services/usualMeals`; this file only renders it and
 * wires up the add + undo.
 */
import { useMemo, useState } from 'react'
import type { LocalDate, MealType } from '@/types'
import { useStore } from '@/store/useStore'
import { suggestMealShortcut, type MealShortcut } from '@/services/usualMeals'
import { MEAL_LABELS } from '@/data/foods'
import { toast } from './ui'
import { PlusIcon, RepeatIcon } from './icons'

/** The shortcut for an *empty* slot; null once anything is logged there. */
export function useMealShortcut(type: MealType, date: LocalDate): MealShortcut | null {
  const meals = useStore((s) => s.meals)
  return useMemo(() => {
    const logged = meals.some((m) => m.date === date && m.type === type && m.items.length > 0)
    return logged ? null : suggestMealShortcut(meals, type, date)
  }, [meals, type, date])
}

function useLogShortcut() {
  const addMealItems = useStore((s) => s.addMealItems)
  const removeMeal = useStore((s) => s.removeMeal)
  const [busy, setBusy] = useState(false)

  const log = async (s: MealShortcut, date: LocalDate) => {
    if (busy) return
    setBusy(true)
    try {
      await addMealItems(date, s.type, s.items)
    } finally {
      setBusy(false)
    }
    toast(`${MEAL_LABELS[s.type]} logged · ${s.calories} kcal`, {
      label: 'Undo',
      run: () => {
        // The slot was empty before, so undo removes the whole meal.
        const added = useStore.getState().meals.find((m) => m.date === date && m.type === s.type)
        if (added) void removeMeal(added.id)
      },
    })
  }
  return { log, busy }
}

function shortcutTitle(s: MealShortcut): string {
  return s.kind === 'usual' ? `Your usual ${MEAL_LABELS[s.type].toLowerCase()}` : `Same as yesterday`
}

/** Compact strip shown under an unlogged meal row on the Dashboard. */
export function UsualMealStrip({ shortcut, date }: { shortcut: MealShortcut; date: LocalDate }) {
  const { log, busy } = useLogShortcut()
  return (
    <button
      onClick={() => void log(shortcut, date)}
      disabled={busy}
      className="w-full flex items-center gap-2.5 px-4 py-2.5 border-t border-line/60 text-left
        active:bg-raised transition focusable disabled:opacity-60"
      aria-label={`Log ${shortcutTitle(shortcut).toLowerCase()}: ${shortcut.label}, ${shortcut.calories} kcal, ${shortcut.protein} g protein`}
    >
      <RepeatIcon size={15} className="text-brand shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-[11.5px] text-faint leading-tight">{shortcutTitle(shortcut)}</span>
        <span className="block text-[13px] truncate">{shortcut.label}</span>
      </span>
      <span className="text-right shrink-0 tabular-nums">
        <span className="block text-[12.5px] text-muted">{shortcut.calories} kcal</span>
        <span className="block text-[11px] text-faint">P {shortcut.protein}g</span>
      </span>
      <span className="w-7 h-7 rounded-full bg-brand text-brand-ink flex items-center justify-center shrink-0">
        <PlusIcon size={16} />
      </span>
    </button>
  )
}

/** Larger card at the top of Add food, for whichever slot is selected. */
export function UsualMealCard({ type, date }: { type: MealType; date: LocalDate }) {
  const shortcut = useMealShortcut(type, date)
  const { log, busy } = useLogShortcut()
  if (!shortcut) return null

  return (
    <div className="card mb-4 flex items-center gap-3 py-3 border-brand/30 bg-brand/[0.06]">
      <span className="w-9 h-9 rounded-xl bg-brand/12 text-brand flex items-center justify-center shrink-0">
        <RepeatIcon size={18} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[12px] text-muted">
          {shortcutTitle(shortcut)}
          {shortcut.kind === 'usual' && <span className="text-faint"> · {shortcut.days} recent days</span>}
        </span>
        <span className="block text-[14px] font-medium truncate">{shortcut.label}</span>
        <span className="block text-[11.5px] text-faint tabular-nums">P {shortcut.protein}g protein</span>
      </span>
      <button
        onClick={() => void log(shortcut, date)}
        disabled={busy}
        className="btn-primary px-3.5 min-h-[44px] text-[13px] shrink-0"
      >
        Add · {shortcut.calories}
      </button>
    </div>
  )
}
