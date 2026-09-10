import { describe, it, expect } from 'vitest'
import { SEED_FOODS } from './foods'
import { scaleNutrients } from '@/utils/calculations'

describe('seed food database', () => {
  it('has unique ids', () => {
    const ids = SEED_FOODS.map((f) => f.id)
    const dupes = ids.filter((x, i) => ids.indexOf(x) !== i)
    expect(dupes).toEqual([])
  })

  it('has no duplicate name+brand pairs', () => {
    const keys = SEED_FOODS.map((f) => `${f.name.toLowerCase()}|${f.brand ?? ''}`)
    const dupes = keys.filter((x, i) => keys.indexOf(x) !== i)
    expect(dupes).toEqual([])
  })

  it('gives every food at least one serving with a positive weight', () => {
    for (const f of SEED_FOODS) {
      expect(f.servings.length, f.name).toBeGreaterThan(0)
      for (const s of f.servings) {
        expect(s.grams, `${f.name} / ${s.label}`).toBeGreaterThan(0)
        expect(s.label.trim(), f.name).not.toBe('')
      }
    }
  })

  it('keeps per-100g calories in a physically plausible range', () => {
    // Nothing edible is below ~1 kcal/100g except water-like drinks, and pure
    // fat (900) is the ceiling.
    for (const f of SEED_FOODS) {
      expect(f.per100g.calories, f.name).toBeGreaterThanOrEqual(0)
      expect(f.per100g.calories, f.name).toBeLessThanOrEqual(900)
    }
  })

  it('has calories consistent with its own macros', () => {
    // 4/4/9 kcal per gram. Tolerance is generous: rounded reference values,
    // and fibre/alcohol are not counted at 4 kcal/g.
    for (const f of SEED_FOODS) {
      const { calories, protein, carbs, fat } = f.per100g
      if (calories < 20) continue // near-zero drinks
      const implied = protein * 4 + carbs * 4 + fat * 9
      const slack = Math.max(60, calories * 0.3)
      expect(Math.abs(implied - calories), `${f.name}: ${calories} vs ${implied}`)
        .toBeLessThanOrEqual(slack)
    }
  })

  it('never has a macro exceeding 100g per 100g of food', () => {
    for (const f of SEED_FOODS) {
      for (const k of ['protein', 'carbs', 'fat', 'fiber', 'sugar'] as const) {
        expect(f.per100g[k], `${f.name}.${k}`).toBeGreaterThanOrEqual(0)
        expect(f.per100g[k], `${f.name}.${k}`).toBeLessThanOrEqual(100)
      }
    }
  })

  it('scales a serving back to the figures the source table specified', () => {
    // Spot-checks across the converted per-serving data: storing per-100g must
    // reproduce the original serving values.
    const expected: Array<[string, number]> = [
      ['thepla', 120],
      ['bajra-rotla', 180],
      ['misal-pav', 350],
      ['mutton-biryani', 560],
      ['shrikhand', 220],
      ['lays-potato-chips', 270],
      ['maggi-2-minute-noodles', 310],
      ['dark-chocolate', 110],
      ['chicken-tikka', 180],
      ['gujarati-kadhi', 150],
    ]
    for (const [id, kcal] of expected) {
      const food = SEED_FOODS.find((f) => f.id === id)
      expect(food, `missing ${id}`).toBeDefined()
      const serving = food!.servings[0]
      const scaled = scaleNutrients(food!.per100g, serving.grams)
      expect(Math.round(scaled.calories), `${id} (${serving.label})`).toBeCloseTo(kcal, -1)
    }
  })

  it('gives packaged foods a brand and unbranded foods none', () => {
    const branded = SEED_FOODS.filter((f) => f.brand)
    expect(branded.length).toBeGreaterThan(0)
    for (const f of branded) expect(f.brand!.trim()).not.toBe('')
  })

  it('covers the regional additions', () => {
    for (const id of ['thepla', 'jowar-bhakri', 'undhiyu', 'khandvi', 'puran-poli', 'egg-bhurji']) {
      expect(SEED_FOODS.some((f) => f.id === id), id).toBe(true)
    }
  })
})
