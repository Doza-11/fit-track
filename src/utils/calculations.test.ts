import { describe, it, expect } from 'vitest'
import {
  calculateBMR, calculateTDEE, calculateDailyCalorieTarget, calculateMacroTargets,
  calculateRemainingCalories, calculateMacroProgress, calculateWorkoutCalories,
  estimateWorkoutCalories, calculateWeeklyAverage, calculateWeightTrend,
  scaleNutrients, sumNutrients, estimate1RM, workoutVolume, calculateStreak,
  percentChange, projectGoalDays, cmToFtIn, ftInToCm, kgToLb, lbToKg, bmi,
  calorieAdherence, recommendTargets, defaultWeeklyRate, EMPTY_NUTRIENTS,
} from './calculations'
import type { Exercise, Nutrients, WeightEntry, WorkoutExercise, DailySummary } from '@/types'

const nut = (o: Partial<Nutrients>): Nutrients => ({ ...EMPTY_NUTRIENTS, ...o })

describe('calculateBMR (Mifflin–St Jeor)', () => {
  it('matches the published formula for a male subject', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(calculateBMR({ weightKg: 80, heightCm: 180, age: 30, sex: 'male' })).toBe(1780)
  })

  it('matches the published formula for a female subject', () => {
    // 10*60 + 6.25*165 - 5*28 - 161 = 600 + 1031.25 - 140 - 161 = 1330.25 → 1330
    expect(calculateBMR({ weightKg: 60, heightCm: 165, age: 28, sex: 'female' })).toBe(1330)
  })

  it('decreases with age', () => {
    const young = calculateBMR({ weightKg: 70, heightCm: 175, age: 25, sex: 'male' })
    const older = calculateBMR({ weightKg: 70, heightCm: 175, age: 55, sex: 'male' })
    expect(older).toBeLessThan(young)
  })
})

describe('calculateTDEE', () => {
  it('scales BMR by the activity factor', () => {
    expect(calculateTDEE(1780, 'sedentary')).toBe(Math.round(1780 * 1.2))
    expect(calculateTDEE(1780, 'moderate')).toBe(Math.round(1780 * 1.55))
  })

  it('increases monotonically with activity level', () => {
    const levels = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const
    const vals = levels.map((l) => calculateTDEE(1600, l))
    for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeGreaterThan(vals[i - 1])
  })
})

describe('calculateDailyCalorieTarget', () => {
  it('returns TDEE when maintaining', () => {
    expect(calculateDailyCalorieTarget({ tdee: 2500, goal: 'maintain', sex: 'male' })).toBe(2500)
  })

  it('applies a deficit for weight loss', () => {
    const t = calculateDailyCalorieTarget({ tdee: 2500, goal: 'lose', sex: 'male' })
    expect(t).toBeLessThan(2500)
    // -0.5 kg/week ≈ -550 kcal/day, within the 25% cap (625).
    expect(t).toBeCloseTo(1950, -1)
  })

  it('applies a surplus for weight gain', () => {
    expect(calculateDailyCalorieTarget({ tdee: 2500, goal: 'gain', sex: 'male' }))
      .toBeGreaterThan(2500)
  })

  it('caps the deficit at 25% of TDEE for aggressive rates', () => {
    const t = calculateDailyCalorieTarget({ tdee: 2400, goal: 'lose', weeklyRateKg: -2, sex: 'male' })
    expect(t).toBeGreaterThanOrEqual(2400 * 0.75 - 10)
  })

  it('never drops below the safe floor', () => {
    const t = calculateDailyCalorieTarget({ tdee: 1400, goal: 'lose', weeklyRateKg: -1, sex: 'female' })
    expect(t).toBeGreaterThanOrEqual(1200)
  })

  it('rounds to the nearest 10 kcal', () => {
    const t = calculateDailyCalorieTarget({ tdee: 2437, goal: 'maintain', sex: 'male' })
    expect(t % 10).toBe(0)
  })
})

describe('calculateMacroTargets', () => {
  it('produces macros whose energy is close to the calorie target', () => {
    const m = calculateMacroTargets(2200, 75, 'maintain')
    const kcal = m.protein * 4 + m.carbs * 4 + m.fat * 9
    expect(Math.abs(kcal - 2200)).toBeLessThan(25)
  })

  it('assigns more protein when building muscle', () => {
    const build = calculateMacroTargets(2600, 80, 'build_muscle')
    const maintain = calculateMacroTargets(2600, 80, 'maintain')
    expect(build.protein).toBeGreaterThan(maintain.protein)
  })

  it('never returns negative carbs at very low targets', () => {
    expect(calculateMacroTargets(900, 100, 'lose').carbs).toBeGreaterThanOrEqual(0)
  })
})

describe('calculateRemainingCalories', () => {
  it('adds exercise calories back to the allowance', () => {
    expect(calculateRemainingCalories({ target: 2200, consumed: 1650, burned: 420 })).toBe(970)
  })

  it('goes negative once the target is exceeded', () => {
    expect(calculateRemainingCalories({ target: 2000, consumed: 2500, burned: 100 })).toBe(-400)
  })
})

describe('calculateMacroProgress', () => {
  const targets = { protein: 130, carbs: 250, fat: 70 }

  it('reports per-macro ratios and remainders', () => {
    const [p] = calculateMacroProgress(nut({ protein: 95 }), targets)
    expect(p.consumed).toBe(95)
    expect(p.remaining).toBe(35)
    expect(p.ratio).toBeCloseTo(95 / 130, 5)
  })

  it('clamps the display ratio at 1 but keeps the raw overshoot', () => {
    const [p] = calculateMacroProgress(nut({ protein: 260 }), targets)
    expect(p.ratio).toBe(1)
    expect(p.rawRatio).toBeCloseTo(2, 5)
    expect(p.remaining).toBeLessThan(0)
  })

  it('handles a zero target without dividing by zero', () => {
    const [p] = calculateMacroProgress(nut({ protein: 50 }), { protein: 0, carbs: 0, fat: 0 })
    expect(Number.isFinite(p.ratio)).toBe(true)
    expect(p.ratio).toBe(0)
  })
})

describe('scaleNutrients / sumNutrients', () => {
  const chicken = nut({ calories: 165, protein: 31, carbs: 0, fat: 3.6 })

  it('scales per-100g values to a serving weight', () => {
    const s = scaleNutrients(chicken, 150)
    expect(s.calories).toBeCloseTo(247.5, 1)
    expect(s.protein).toBeCloseTo(46.5, 1)
  })

  it('returns zeroes for a zero-gram serving', () => {
    expect(scaleNutrients(chicken, 0).calories).toBe(0)
  })

  it('sums a list of nutrient objects field-wise', () => {
    const total = sumNutrients([nut({ calories: 100, protein: 10 }), nut({ calories: 250, protein: 5 })])
    expect(total.calories).toBe(350)
    expect(total.protein).toBe(15)
  })

  it('sums an empty list to zero', () => {
    expect(sumNutrients([])).toEqual(EMPTY_NUTRIENTS)
  })
})

describe('calculateWorkoutCalories (MET formula)', () => {
  it('computes MET x kg x hours', () => {
    // 8 MET, 70 kg, 30 min → 8 * 70 * 0.5 = 280
    expect(calculateWorkoutCalories({ met: 8, weightKg: 70, durationMin: 30 })).toBe(280)
  })

  it('returns zero for a zero-length session', () => {
    expect(calculateWorkoutCalories({ met: 8, weightKg: 70, durationMin: 0 })).toBe(0)
  })

  it('scales with bodyweight', () => {
    const light = calculateWorkoutCalories({ met: 6, weightKg: 55, durationMin: 60 })
    const heavy = calculateWorkoutCalories({ met: 6, weightKg: 95, durationMin: 60 })
    expect(heavy).toBeGreaterThan(light)
  })
})

describe('estimateWorkoutCalories', () => {
  const bench: Exercise = { id: 'bench', name: 'Bench Press', type: 'strength', muscleGroups: ['chest'], met: 5 }
  const run: Exercise = { id: 'run', name: 'Running', type: 'cardio', muscleGroups: ['cardio'], met: 9.8, tracksDistance: true }
  const lookup = (id: string) => ({ bench, run }[id])

  it('uses each cardio block’s own logged duration', () => {
    const ex: WorkoutExercise[] = [{ id: '1', exerciseId: 'run', exerciseName: 'Running', type: 'cardio', durationMin: 30 }]
    expect(estimateWorkoutCalories(ex, 30, 70, lookup))
      .toBe(calculateWorkoutCalories({ met: 9.8, weightKg: 70, durationMin: 30 }))
  })

  it('splits leftover session time across untimed strength blocks', () => {
    const ex: WorkoutExercise[] = [
      { id: '1', exerciseId: 'bench', exerciseName: 'Bench Press', type: 'strength' },
      { id: '2', exerciseId: 'bench', exerciseName: 'Bench Press', type: 'strength' },
    ]
    // 40 min split two ways at 5 MET, 70 kg → 2 * (5*70*(20/60)) ≈ 233
    expect(estimateWorkoutCalories(ex, 40, 70, lookup)).toBe(234)
  })

  it('returns zero with no exercises or no duration', () => {
    expect(estimateWorkoutCalories([], 45, 70, lookup)).toBe(0)
    const ex: WorkoutExercise[] = [{ id: '1', exerciseId: 'bench', exerciseName: 'B', type: 'strength' }]
    expect(estimateWorkoutCalories(ex, 0, 70, lookup)).toBe(0)
  })

  it('ignores exercises missing from the database', () => {
    const ex: WorkoutExercise[] = [{ id: '1', exerciseId: 'gone', exerciseName: '?', type: 'strength' }]
    expect(estimateWorkoutCalories(ex, 30, 70, lookup)).toBe(0)
  })
})

describe('strength metrics', () => {
  it('counts volume only for completed sets', () => {
    const ex: WorkoutExercise[] = [{
      id: '1', exerciseId: 'sq', exerciseName: 'Squat', type: 'strength',
      sets: [
        { id: 'a', weightKg: 80, reps: 8, done: true },
        { id: 'b', weightKg: 80, reps: 8, done: true },
        { id: 'c', weightKg: 80, reps: 6, done: false },
      ],
    }]
    expect(workoutVolume(ex)).toBe(1280)
  })

  it('estimates 1RM with the Epley formula', () => {
    expect(estimate1RM(100, 1)).toBe(100)
    expect(estimate1RM(100, 10)).toBeCloseTo(133.3, 1)
    expect(estimate1RM(0, 5)).toBe(0)
  })
})

describe('calculateWeeklyAverage', () => {
  it('ignores days with no data', () => {
    expect(calculateWeeklyAverage([2000, 0, 2200, null, undefined, 1800])).toBe(2000)
  })

  it('returns zero when nothing was logged', () => {
    expect(calculateWeeklyAverage([0, null, undefined])).toBe(0)
  })
})

describe('calculateWeightTrend', () => {
  const entry = (date: string, weightKg: number): WeightEntry =>
    ({ id: date, date, weightKg, loggedAt: 0 })

  it('reports start, current and net change', () => {
    const t = calculateWeightTrend([
      entry('2026-09-01', 75), entry('2026-09-08', 74.2), entry('2026-09-04', 74.6),
    ])
    expect(t.start).toBe(75)
    expect(t.current).toBe(74.2)
    expect(t.changeKg).toBe(-0.8)
    expect(t.direction).toBe('down')
  })

  it('fits a weekly rate from the regression slope', () => {
    const t = calculateWeightTrend([
      entry('2026-09-01', 80), entry('2026-09-08', 79), entry('2026-09-15', 78),
    ])
    expect(t.ratePerWeek).toBeCloseTo(-1, 1)
  })

  it('handles a single entry without dividing by zero', () => {
    const t = calculateWeightTrend([entry('2026-09-01', 70)])
    expect(t.ratePerWeek).toBe(0)
    expect(t.changeKg).toBe(0)
    expect(t.smoothed).toHaveLength(1)
  })

  it('handles an empty history', () => {
    const t = calculateWeightTrend([])
    expect(t.current).toBeUndefined()
    expect(t.direction).toBe('flat')
  })

  it('calls a sub-200g change flat', () => {
    expect(calculateWeightTrend([entry('2026-09-01', 70), entry('2026-09-05', 70.1)]).direction).toBe('flat')
  })

  it('does not divide by zero when all entries share one date', () => {
    const t = calculateWeightTrend([entry('2026-09-01', 70), { ...entry('2026-09-01', 71), id: 'x' }])
    expect(Number.isFinite(t.ratePerWeek)).toBe(true)
  })
})

describe('projectGoalDays', () => {
  it('estimates days to the goal at the current rate', () => {
    // 5 kg to lose at 0.5 kg/week = 10 weeks.
    expect(projectGoalDays(80, 75, -0.5)).toBe(70)
    expect(projectGoalDays(70, 75, 0.25)).toBe(140)
  })

  it('returns zero when already at the goal', () => {
    expect(projectGoalDays(75, 75, -0.5)).toBe(0)
  })

  it('returns null when the trend moves away from the goal', () => {
    expect(projectGoalDays(80, 75, 0.5)).toBeNull()
  })

  it('returns null for a flat trend', () => {
    expect(projectGoalDays(80, 75, 0)).toBeNull()
  })
})

describe('calculateStreak', () => {
  it('counts consecutive logged days back from today', () => {
    const dates = new Set(['2026-09-09', '2026-09-08', '2026-09-07'])
    expect(calculateStreak(dates, '2026-09-09')).toBe(3)
  })

  it('keeps a streak alive when today has not been logged yet', () => {
    const dates = new Set(['2026-09-08', '2026-09-07'])
    expect(calculateStreak(dates, '2026-09-09')).toBe(2)
  })

  it('stops at the first gap', () => {
    const dates = new Set(['2026-09-09', '2026-09-07', '2026-09-06'])
    expect(calculateStreak(dates, '2026-09-09')).toBe(1)
  })

  it('returns zero with no history', () => {
    expect(calculateStreak(new Set(), '2026-09-09')).toBe(0)
  })
})

describe('percentChange', () => {
  it('computes a signed percentage', () => {
    expect(percentChange(100, 112)).toBe(12)
    expect(percentChange(100, 80)).toBe(-20)
  })

  it('returns null when there is no baseline', () => {
    expect(percentChange(0, 50)).toBeNull()
  })
})

describe('unit conversion', () => {
  it('round-trips kg and lb', () => {
    expect(lbToKg(kgToLb(70))).toBeCloseTo(70, 1)
  })

  it('round-trips cm and ft/in', () => {
    const { ft, inches } = cmToFtIn(180)
    expect(ft).toBe(5)
    expect(inches).toBe(11)
    expect(ftInToCm(ft, inches)).toBeCloseTo(180, 0)
  })

  it('computes BMI and guards a zero height', () => {
    expect(bmi(70, 175)).toBeCloseTo(22.9, 1)
    expect(bmi(70, 0)).toBe(0)
  })
})

describe('calorieAdherence', () => {
  const day = (consumed: number, target = 2000): DailySummary => ({
    date: '2026-09-09', caloriesConsumed: consumed, caloriesBurned: 0, calorieTarget: target,
    remaining: target - consumed, macros: EMPTY_NUTRIENTS,
    macroTargets: { protein: 0, carbs: 0, fat: 0 }, waterMl: 0, waterTargetMl: 0,
    steps: 0, stepTarget: 0, meals: [], workouts: [], hasAnyEntry: true,
  })

  it('counts days within 10% of target', () => {
    expect(calorieAdherence([day(2000), day(1900), day(1000)])).toBe(67)
  })

  it('ignores unlogged days and returns 0 when nothing is logged', () => {
    expect(calorieAdherence([day(0), day(0)])).toBe(0)
  })
})

describe('recommendTargets', () => {
  it('chains BMR → TDEE → target → macros consistently', () => {
    const r = recommendTargets({
      weightKg: 75, heightCm: 178, age: 30, sex: 'male',
      activityLevel: 'moderate', goal: 'lose',
    })
    expect(r.bmr).toBe(calculateBMR({ weightKg: 75, heightCm: 178, age: 30, sex: 'male' }))
    expect(r.tdee).toBe(calculateTDEE(r.bmr, 'moderate'))
    expect(r.calories).toBeLessThan(r.tdee)
    expect(r.macros.protein).toBeGreaterThan(0)
  })

  it('gives maintain a zero default rate', () => {
    expect(defaultWeeklyRate('maintain')).toBe(0)
  })
})
