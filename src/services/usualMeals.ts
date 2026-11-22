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

// ── Usual portion of a single food ──────────────────────────────────────────

export interface UsualPortion {
  /** 'usual' = the same amount on 2+ recent logs; 'last' = only seen once. */
  kind: 'usual' | 'last'
  servingLabel: string
  quantity: number
  /** How many of the recent logs used exactly this amount. */
  times: number
}

/**
 * The amount someone normally logs of a food, so "2 rotis" is pre-selected
 * instead of the default "1 roti".
 *
 * Looks at the most recent `sample` logs of the food. If enough of them were
 * in the meal slot being logged, only those count — someone may have 1 roti at
 * lunch but 3 at dinner. The most common serving + quantity wins, ties going
 * to the most recent; a single previous log is offered as "last time".
 */
export function usualPortion(
  meals: Meal[],
  foodId: string,
  { mealType, sample = 10 }: { mealType?: MealType; sample?: number } = {},
): UsualPortion | null {
  const logs = meals
    .flatMap((m) => m.items
      .filter((i) => i.foodId === foodId && i.quantity > 0)
      .map((i) => ({ type: m.type, date: m.date, at: m.loggedAt, servingLabel: i.servingLabel, quantity: i.quantity })))
    .sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at)
    .slice(0, sample)
  if (logs.length === 0) return null

  const inSlot = mealType ? logs.filter((l) => l.type === mealType) : []
  const pool = inSlot.length >= 2 ? inSlot : logs

  const counts = new Map<string, { servingLabel: string; quantity: number; times: number; rank: number }>()
  pool.forEach((l, rank) => {
    const key = `${l.servingLabel}|${l.quantity}`
    const c = counts.get(key)
    if (c) c.times++
    else counts.set(key, { servingLabel: l.servingLabel, quantity: l.quantity, times: 1, rank })
  })
  const best = [...counts.values()].sort((a, b) => b.times - a.times || a.rank - b.rank)[0]
  return {
    kind: best.times >= 2 ? 'usual' : 'last',
    servingLabel: best.servingLabel,
    quantity: best.quantity,
    times: best.times,
  }
}

/** "You usually have 2 × 1 roti" / "Last time: 1.5 × 1 bowl". */
export function portionHint(p: UsualPortion): string {
  const q = Number.isInteger(p.quantity) ? p.quantity : Math.round(p.quantity * 100) / 100
  return p.kind === 'usual'
    ? `You usually have ${q} × ${p.servingLabel}`
    : `Last time: ${q} × ${p.servingLabel}`
}
