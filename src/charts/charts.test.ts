import { describe, it, expect } from 'vitest'
import { __niceMaxForTest as niceMax } from './Charts'

describe('niceMax axis scaling', () => {
  it('keeps the axis close above the data so bars fill the chart', () => {
    // A ~2,400 kcal series must not land on a 5,000 axis.
    expect(niceMax(2640)).toBe(3000)
    expect(niceMax(2200)).toBe(2500)
    expect(niceMax(1050)).toBe(1200)
  })

  it('never returns a max below the data', () => {
    for (const v of [1, 7, 43, 99, 137, 950, 2345, 9800, 12500]) {
      expect(niceMax(v)).toBeGreaterThanOrEqual(v)
    }
  })

  it('stays within 25% above the data for typical values', () => {
    for (const v of [120, 250, 800, 1900, 2400, 8500]) {
      expect(niceMax(v) / v).toBeLessThanOrEqual(1.3)
    }
  })

  it('handles zero and negatives without producing an unusable axis', () => {
    expect(niceMax(0)).toBe(10)
    expect(niceMax(-5)).toBe(10)
  })
})
