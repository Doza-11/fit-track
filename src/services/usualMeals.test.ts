import { describe, it, expect } from 'vitest'
import { suggestMealShortcut } from './usualMeals'
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
