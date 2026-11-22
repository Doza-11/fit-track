import { describe, it, expect } from 'vitest'
import { __niceMaxForTest as niceMax, targetStatus } from './Charts'

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

describe('targetStatus', () => {
  it('treats crossing a reach target as met and falling short as below', () => {
    expect(targetStatus(120, 108, 'reach')).toBe('met')
    expect(targetStatus(108, 108, 'reach')).toBe('met')
    expect(targetStatus(60, 108, 'reach')).toBe('below')
  })

  it('only flags a limit target when it is exceeded', () => {
    expect(targetStatus(2800, 2500, 'limit')).toBe('over')
    expect(targetStatus(2500, 2500, 'limit')).toBe('none')
    expect(targetStatus(1200, 2500, 'limit')).toBe('none')
  })

  it('has no status without a target or a value', () => {
    expect(targetStatus(50, undefined, 'reach')).toBe('none')
    expect(targetStatus(50, 0, 'reach')).toBe('none')
    expect(targetStatus(0, 108, 'reach')).toBe('none')
  })
})
