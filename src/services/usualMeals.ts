/**
 * Usual meals — spot what someone eats regularly so it can be logged in one tap.
 *
 * Most people eat the same breakfast most days. Rather than asking them to save
 * it as a named meal first, we look back over recent history: if the same set
 * of foods appears in a slot on several different days, that's their "usual".
 * Failing that, yesterday's meal in the same slot is the next best guess.
 *
 * Pure functions over `Meal[]`, so the rule is unit-tested and the UI only
 * renders what this returns.
 */
import type { LocalDate, Meal, MealItem, MealType } from '@/types'
import { addDays } from '@/utils/date'

export interface MealShortcut {
  /** 'usual' = repeated on several days; 'yesterday' = a one-off from yesterday. */
  kind: 'usual' | 'yesterday'
  type: MealType
  /** Portions exactly as most recently logged, ready for `addMealItems`. */
  items: Omit<MealItem, 'id'>[]
  calories: number
  /** Grams of protein in the shortcut, shown beside calories. */
  protein: number
  /** Distinct days this combination was logged in the look-back window. */
  days: number
  /** Short human summary, e.g. "Poha, Masala Chai". */
  label: string
}

export interface ShortcutOptions {
  /** How far back to look for a pattern. */
  lookbackDays?: number
  /** Distinct days a combination must appear on to count as "usual". */
  minDays?: number
}

/** Same foods in any order count as the same meal; portions may vary. */
function signature(meal: Meal): string {
  return [...new Set(meal.items.map((i) => i.foodId))].sort().join('|')
}

function toShortcut(kind: MealShortcut['kind'], meal: Meal, days: number): MealShortcut {
  const items = meal.items.map(({ id: _id, ...rest }) => rest)
  return {
    kind,
    type: meal.type,
    items,
    calories: Math.round(items.reduce((s, i) => s + i.nutrients.calories, 0)),
    protein: Math.round(items.reduce((s, i) => s + i.nutrients.protein, 0)),
    days,
    label: items.map((i) => i.foodName).join(', '),
  }
}

/**
 * The best one-tap suggestion for `type` on `date`, or null if history offers
 * nothing sensible. Only days strictly before `date` are considered, so what
 * the user logs today never feeds back into today's suggestion.
 */
export function suggestMealShortcut(
  meals: Meal[],
  type: MealType,
  date: LocalDate,
  { lookbackDays = 21, minDays = 2 }: ShortcutOptions = {},
): MealShortcut | null {
  const from = addDays(date, -lookbackDays)
  const candidates = meals.filter(
    (m) => m.type === type && m.items.length > 0 && m.date < date && m.date >= from,
  )
  if (candidates.length === 0) return null

  // Group by food combination, tracking distinct days and the latest instance.
  const groups = new Map<string, { dates: Set<LocalDate>; latest: Meal }>()
  for (const m of candidates) {
    const key = signature(m)
    const g = groups.get(key)
    if (!g) {
      groups.set(key, { dates: new Set([m.date]), latest: m })
    } else {
      g.dates.add(m.date)
      if (m.date > g.latest.date || (m.date === g.latest.date && m.loggedAt > g.latest.loggedAt)) {
        g.latest = m
      }
    }
  }

  let best: { dates: Set<LocalDate>; latest: Meal } | null = null
  for (const g of groups.values()) {
    if (g.dates.size < minDays) continue
    if (
      !best
      || g.dates.size > best.dates.size
      || (g.dates.size === best.dates.size && g.latest.date > best.latest.date)
    ) {
      best = g
    }
  }
  if (best) return toShortcut('usual', best.latest, best.dates.size)

  const yesterday = candidates.find((m) => m.date === addDays(date, -1))
  return yesterday ? toShortcut('yesterday', yesterday, 1) : null
}
