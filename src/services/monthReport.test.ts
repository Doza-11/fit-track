import { describe, it, expect } from 'vitest'
import { buildMonthReport, pickWins } from './monthReport'
import type { DailySummary, Meal, UserProfile, WeightEntry, Workout } from '@/types'
import { EMPTY_NUTRIENTS } from '@/utils/calculations'

const profile: UserProfile = {
  id: 'current', name: 'Divyam', age: 30, sex: 'male', heightCm: 178, weightKg: 75,
  activityLevel: 'moderate',
  goal: { type: 'lose', weeklyRateKg: -0.5 },
  calorieTarget: 2200, calorieTargetIsCustom: false,
  macroTargets: { protein: 130, carbs: 250, fat: 70 },
  waterTargetMl: 2500, stepTarget: 8000,
  units: { weight: 'kg', height: 'cm' }, theme: 'system',
  notifications: { smartSuggestions: true, quietStart: '22:00', quietEnd: '08:00', maxPerDay: 4 },
  createdAt: 0,
}

function lift(id: string, date: string, weightKg: number): Workout {
  return {
    id, date, name: 'Push', durationMin: 40, caloriesBurned: 200, inProgress: false, startedAt: 0,
    exercises: [{
      id: `${id}e`, exerciseId: 'bench', exerciseName: 'Bench Press', type: 'strength',
      sets: [{ id: '1', weightKg, reps: 5, done: true }],
    }],
  }
}

function day(n: number, kcal = 0, protein = 0, workouts: Workout[] = [], fiber = 0): DailySummary {
  const date = `2026-11-${String(n).padStart(2, '0')}`
  const meals: Meal[] = kcal ? [{
    id: date, date, type: 'lunch', loggedAt: 0,
    items: [{ id: '1', foodId: 'x', foodName: 'x', servingLabel: '1', quantity: 1, grams: 100, nutrients: { ...EMPTY_NUTRIENTS, calories: kcal, protein } }],
  }] : []
  return {
    date, caloriesConsumed: kcal, caloriesBurned: 0, calorieTarget: 2200, remaining: 2200 - kcal,
    macros: { ...EMPTY_NUTRIENTS, calories: kcal, protein, fiber }, macroTargets: profile.macroTargets,
    waterMl: 0, waterTargetMl: 2500, steps: 0, stepTarget: 8000, meals, workouts,
    hasAnyEntry: kcal > 0 || workouts.length > 0,
  }
}

const NOV = new Date(2026, 10, 1)
const w = (date: string, weightKg: number): WeightEntry => ({ id: date, date, weightKg, loggedAt: 0 })

describe('buildMonthReport', () => {
  const pr = lift('b', '2026-11-12', 70)
  const days = [
    ...Array.from({ length: 10 }, (_, i) => day(i + 1, 2150, 135, [], 32)), // 10-day streak, on target
    day(11),
    day(12, 1800, 90, [pr]),
    day(13, 2600, 100),
  ]
  const r = buildMonthReport({
    month: NOV, days, profile,
    weights: [w('2026-10-30', 80), w('2026-11-02', 78.4), w('2026-11-13', 77.2)],
    allWorkouts: [lift('a', '2026-10-20', 65), pr],
  })

  it('averages only days with food logged', () => {
    expect(r.daysLogged).toBe(12)
    expect(r.daysInPeriod).toBe(13)
    expect(r.avgCalories).toBe(Math.round((2150 * 10 + 1800 + 2600) / 12))
  })

  it('counts target days, protein days and the longest streak', () => {
    expect(r.onTargetDays).toBe(10)
    expect(r.proteinDays).toBe(10)
    expect(r.bestStreak).toBe(10)
  })

  it('measures weight change within the month only', () => {
    expect(r.weightChange).toBe(-1.2)
  })

  it('finds the month\'s new personal record', () => {
    expect(r.topRecord).toEqual({ exercise: 'Bench Press', weight: 70, reps: 5 })
    expect(r.workouts).toBe(1)
  })

  it('leads with the most impressive wins, max three', () => {
    expect(r.wins).toEqual([
      'New PR: Bench Press 70 kg × 5',
      'Down 1.2 kg this month',
      '10-day logging streak',
    ])
  })

  it('converts to pounds for lb users', () => {
    const lb = buildMonthReport({
      month: NOV, days, profile: { ...profile, units: { weight: 'lb', height: 'cm' } },
      weights: [w('2026-11-02', 78.4), w('2026-11-13', 77.2)], allWorkouts: [lift('a', '2026-10-20', 65), pr],
    })
    expect(lb.weightChange).toBe(-2.6)
    expect(lb.topRecord?.weight).toBe(154.3)
  })
})

describe('pickWins', () => {
  const base = buildMonthReport({ month: NOV, days: [day(1)], profile, weights: [], allWorkouts: [] })

  it('never lists weight moving away from the goal', () => {
    const wins = pickWins({ ...base, weightChange: 1.5 }, profile)
    expect(wins.join(' ')).not.toMatch(/Up 1.5/)
  })

  it('encourages instead of listing zeroes on a quiet month', () => {
    expect(pickWins({ ...base, daysLogged: 3 }, profile)).toEqual(['3 days logged — the habit is building'])
    expect(pickWins(base, profile)).toEqual(['A fresh month — every logged day counts'])
  })

  it('celebrates holding steady on a maintenance goal', () => {
    const maintain = { ...profile, goal: { type: 'maintain' as const, weeklyRateKg: 0 } }
    expect(pickWins({ ...base, weightChange: 0.2 }, maintain)).toContain('Weight held steady — right on plan')
  })
})
