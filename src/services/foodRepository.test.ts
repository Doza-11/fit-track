import { describe, it, expect, beforeEach } from 'vitest'
import { foodRepo, nutrientsForServing } from './foodRepository'
import { SEED_FOODS } from '@/data/foods'

const names = (q: string, n = 4) => foodRepo.search(q, { limit: n }).map((f) => f.name)

describe('food search', () => {
  beforeEach(() => { foodRepo.setCustomFoods([]) })

  it('finds the regional dishes that were added', () => {
    expect(names('thepla')).toContain('Thepla')
    expect(names('bhakri')).toContain('Jowar Bhakri')
    expect(names('undhiyu')).toContain('Undhiyu')
    expect(names('shrikhand')).toContain('Shrikhand')
    expect(names('khandvi')).toContain('Khandvi')
    expect(names('puran')).toContain('Puran Poli')
  })

  it('ranks an exact name first', () => {
    expect(foodRepo.search('Thepla')[0].name).toBe('Thepla')
    expect(foodRepo.search('Modak')[0].name).toBe('Modak')
  })

  it('matches on brand as well as name', () => {
    const haldiram = names('haldiram', 6)
    expect(haldiram).toContain('Aloo Bhujia')
    expect(haldiram).toContain('Moong Dal Namkeen')
    expect(names('amul', 6).some((n) => /Chocolate/.test(n))).toBe(true)
  })

  it('still finds an apostrophed brand', () => {
    expect(names("lay's", 6)).toContain("Lay's Potato Chips")
    expect(names('lays', 6).concat(names('potato chips', 6))).toContain("Lay's Potato Chips")
  })

  it('matches a word in the middle of a name', () => {
    expect(names('paratha', 8)).toContain('Laccha Paratha')
    expect(names('dal', 8).length).toBeGreaterThan(2)
  })

  it('returns nothing for a nonsense query', () => {
    expect(foodRepo.search('zzzzqqqq')).toEqual([])
  })

  it('biases results toward the meal slot being logged', () => {
    const breakfast = foodRepo.search('', { mealType: 'breakfast', limit: 12 })
    expect(breakfast.some((f) => (f.commonMeals ?? []).includes('breakfast'))).toBe(true)
  })

  it('floats frequently logged foods to the top', () => {
    const target = 'thepla'
    const withFrequent = foodRepo.search('', { frequentIds: [target], limit: 5 })
    expect(withFrequent.map((f) => f.id)).toContain(target)
  })

  it('does not crash on an empty query and respects the limit', () => {
    expect(foodRepo.search('', { limit: 7 })).toHaveLength(7)
  })
})

describe('nutrientsForServing', () => {
  it('reproduces the source table figures for a converted food', () => {
    const cases: Array<[string, number]> = [
      ['thepla', 120], ['bajra-rotla', 180], ['mutton-biryani', 560],
      ['kurkure', 280], ['modak', 170],
    ]
    for (const [id, kcal] of cases) {
      const food = SEED_FOODS.find((f) => f.id === id)!
      const { nutrients } = nutrientsForServing(food, food.servings[0], 1)
      expect(Math.round(nutrients.calories), id).toBeCloseTo(kcal, -1)
    }
  })

  it('scales linearly with quantity', () => {
    const food = SEED_FOODS.find((f) => f.id === 'thepla')!
    const one = nutrientsForServing(food, food.servings[0], 1)
    const two = nutrientsForServing(food, food.servings[0], 2)
    expect(two.grams).toBe(one.grams * 2)
    expect(two.nutrients.calories).toBeCloseTo(one.nutrients.calories * 2, 1)
  })
})
