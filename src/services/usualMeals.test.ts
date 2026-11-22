import { describe, it, expect } from 'vitest'
import { portionHint, suggestMealShortcut, usualPortion } from './usualMeals'
import type { Meal, MealType } from '@/types'
import { EMPTY_NUTRIENTS } from '@/utils/calculations'

let seq = 0
function meal(date: string, type: MealType, foods: Array<[id: string, kcal: number]>, loggedAt = 0): Meal {
  return {
    id: `m${++seq}`, date, type, loggedAt,
    items: foods.map(([foodId, calories]) => ({
      id: `i${++seq}`, foodId, foodName: foodId, servingLabel: '1', quantity: 1, grams: 100,
      nutrients: { ...EMPTY_NUTRIENTS, calories },
    })),
  }
}

const TODAY = '2026-11-22'

describe('suggestMealShortcut', () => {
  it('returns null with no history', () => {
    expect(suggestMealShortcut([], 'breakfast', TODAY)).toBeNull()
  })

  it('finds a combination eaten on several days, regardless of item order', () => {
    const meals = [
      meal('2026-11-19', 'breakfast', [['poha', 250], ['chai', 80]]),
      meal('2026-11-20', 'breakfast', [['chai', 80], ['poha', 250]]),
      meal('2026-11-21', 'breakfast', [['oats', 300]]),
    ]
    const s = suggestMealShortcut(meals, 'breakfast', TODAY)
    expect(s?.kind).toBe('usual')
    expect(s?.days).toBe(2)
    expect(s?.calories).toBe(330)
    expect(s?.protein).toBe(0)
  })

  it('uses the most recent portions of the usual meal', () => {
    const meals = [
      meal('2026-11-18', 'lunch', [['rice', 200], ['dal', 150]]),
      meal('2026-11-21', 'lunch', [['rice', 260], ['dal', 150]]),
    ]
    expect(suggestMealShortcut(meals, 'lunch', TODAY)?.calories).toBe(410)
  })

  it('prefers the most frequent combination, then the most recent', () => {
    const meals = [
      meal('2026-11-15', 'dinner', [['roti', 200]]),
      meal('2026-11-16', 'dinner', [['roti', 200]]),
      meal('2026-11-17', 'dinner', [['roti', 200]]),
      meal('2026-11-20', 'dinner', [['khichdi', 350]]),
      meal('2026-11-21', 'dinner', [['khichdi', 350]]),
    ]
    expect(suggestMealShortcut(meals, 'dinner', TODAY)?.label).toBe('roti')
  })

  it('counts the same combination twice in one day as one day', () => {
    const meals = [
      meal('2026-11-21', 'snack', [['banana', 100]], 1),
      meal('2026-11-21', 'snack', [['banana', 100]], 2),
    ]
    const s = suggestMealShortcut(meals, 'snack', TODAY)
    expect(s?.kind).toBe('yesterday')
  })

  it("falls back to yesterday's meal when nothing repeats", () => {
    const meals = [meal('2026-11-21', 'lunch', [['biryani', 540]])]
    const s = suggestMealShortcut(meals, 'lunch', TODAY)
    expect(s).toMatchObject({ kind: 'yesterday', calories: 540, days: 1 })
  })

  it('ignores other slots, today, the future and old history', () => {
    const meals = [
      meal('2026-11-20', 'dinner', [['poha', 250]]),
      meal('2026-11-21', 'dinner', [['poha', 250]]),
      meal(TODAY, 'breakfast', [['poha', 250]]),
      meal('2026-11-23', 'breakfast', [['poha', 250]]),
      meal('2026-10-01', 'breakfast', [['poha', 250]]),
      meal('2026-10-02', 'breakfast', [['poha', 250]]),
    ]
    expect(suggestMealShortcut(meals, 'breakfast', TODAY)).toBeNull()
  })

  it('returns items without ids so they can be logged as new entries', () => {
    const meals = [meal('2026-11-21', 'lunch', [['rice', 200]])]
    const item = suggestMealShortcut(meals, 'lunch', TODAY)!.items[0]
    expect(item).not.toHaveProperty('id')
    expect(item.foodId).toBe('rice')
  })
})

describe('usualPortion', () => {
  function log(date: string, type: MealType, foodId: string, servingLabel: string, quantity: number, loggedAt = 0): Meal {
    return {
      id: `m${++seq}`, date, type, loggedAt,
      items: [{
        id: `i${++seq}`, foodId, foodName: foodId, servingLabel, quantity, grams: 40 * quantity,
        nutrients: { ...EMPTY_NUTRIENTS, calories: 120 * quantity },
      }],
    }
  }

  it('returns null for a food never logged', () => {
    expect(usualPortion([], 'roti')).toBeNull()
  })

  it('picks the most common amount', () => {
    const meals = [
      log('2026-11-18', 'dinner', 'roti', '1 roti', 2),
      log('2026-11-19', 'dinner', 'roti', '1 roti', 2),
      log('2026-11-20', 'dinner', 'roti', '1 roti', 3),
    ]
    const p = usualPortion(meals, 'roti')
    expect(p).toMatchObject({ kind: 'usual', servingLabel: '1 roti', quantity: 2, times: 2 })
    expect(portionHint(p!)).toBe('You usually have 2 × 1 roti')
  })

  it('prefers the meal slot being logged when there is enough history there', () => {
    const meals = [
      log('2026-11-17', 'lunch', 'roti', '1 roti', 1),
      log('2026-11-18', 'lunch', 'roti', '1 roti', 1),
      log('2026-11-19', 'lunch', 'roti', '1 roti', 1),
      log('2026-11-18', 'dinner', 'roti', '1 roti', 3),
      log('2026-11-20', 'dinner', 'roti', '1 roti', 3),
    ]
    expect(usualPortion(meals, 'roti', { mealType: 'dinner' })?.quantity).toBe(3)
    expect(usualPortion(meals, 'roti', { mealType: 'lunch' })?.quantity).toBe(1)
    // Breakfast has no history, so all slots count: 1 roti appears most.
    expect(usualPortion(meals, 'roti', { mealType: 'breakfast' })?.quantity).toBe(1)
  })

  it('breaks ties by recency and labels a single log as "last time"', () => {
    const tie = [
      log('2026-11-18', 'lunch', 'rice', '1 cup', 1),
      log('2026-11-21', 'lunch', 'rice', '1 bowl', 1.5),
    ]
    const p = usualPortion(tie, 'rice')
    expect(p).toMatchObject({ kind: 'last', servingLabel: '1 bowl', quantity: 1.5 })
    expect(portionHint(p!)).toBe('Last time: 1.5 × 1 bowl')
  })

  it('only looks at the most recent logs, so habits can change', () => {
    const old = Array.from({ length: 10 }, (_, i) => log(`2026-10-${10 + i}`, 'dinner', 'roti', '1 roti', 4))
    const recent = Array.from({ length: 10 }, (_, i) => log(`2026-11-${10 + i}`, 'dinner', 'roti', '1 roti', 2))
    expect(usualPortion([...old, ...recent], 'roti')?.quantity).toBe(2)
  })
})
