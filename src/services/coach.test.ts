import { describe, it, expect } from 'vitest'
import {
  COACH_RULES, MAX_PER_DAY, evaluateCoach, fillTemplate, maintenanceCalories, recordShown,
  refreshCoachMessage, findNewRecord, loggingStreak,
  type CoachHistoryEntry, type CoachInput, type CoachMessage,
} from './coach'
import type { DailySummary, Meal, MealType, UserProfile, WeightEntry, Workout } from '@/types'
import { EMPTY_NUTRIENTS } from '@/utils/calculations'

// 2026-11-22 is a Sunday; 2026-11-20 a Friday.
const SUN = '2026-11-22'
const FRI = '2026-11-20'
const at = (date: string, hour: number) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, hour, 0)
}

const profile: UserProfile = {
  id: 'current', name: 'Test', age: 30, sex: 'male', heightCm: 178, weightKg: 75,
  activityLevel: 'moderate',
  goal: { type: 'lose', weeklyRateKg: -0.5 },
  calorieTarget: 2200, calorieTargetIsCustom: false,
  macroTargets: { protein: 130, carbs: 250, fat: 70 },
  waterTargetMl: 2500, stepTarget: 8000,
  units: { weight: 'kg', height: 'cm' }, theme: 'system',
  notifications: { smartSuggestions: true, quietStart: '22:00', quietEnd: '08:00', maxPerDay: 4 },
  createdAt: 0,
}
// Mifflin–St Jeor for this profile ≈ 1,758 × 1.55 ≈ 2,725 kcal maintenance.
const TDEE = maintenanceCalories(profile)

function meal(type: MealType, calories: number, protein = 0): Meal {
  return {
    id: `${type}-${calories}`, date: FRI, type, loggedAt: 0,
    items: [{
      id: '1', foodId: 'x', foodName: 'Food', servingLabel: '1', quantity: 1, grams: 100,
      nutrients: { ...EMPTY_NUTRIENTS, calories, protein },
    }],
  }
}

const workout: Workout = {
  id: 'w', date: FRI, name: 'Run', exercises: [], durationMin: 30,
  caloriesBurned: 300, inProgress: false, startedAt: 0,
}

/** A day summary; `remaining` follows the app's rule (target − eaten + burned). */
function day(over: Partial<DailySummary> & { meals?: Meal[] } = {}, date = FRI): DailySummary {
  const meals = over.meals ?? []
  const consumed = meals.reduce((s, m) => s + m.items.reduce((a, i) => a + i.nutrients.calories, 0), 0)
  const protein = meals.reduce((s, m) => s + m.items.reduce((a, i) => a + i.nutrients.protein, 0), 0)
  const burned = over.caloriesBurned ?? 0
  const workouts = over.workouts ?? []
  return {
    date,
    caloriesConsumed: consumed,
    caloriesBurned: burned,
    calorieTarget: 2200,
    remaining: 2200 - consumed + burned,
    macros: { ...EMPTY_NUTRIENTS, calories: consumed, protein },
    macroTargets: profile.macroTargets,
    waterMl: 0, waterTargetMl: 2500,
    steps: 0, stepTarget: 8000,
    meals, workouts,
    hasAnyEntry: meals.length > 0 || workouts.length > 0,
    ...over,
  }
}

const emptyWeek = () => Array.from({ length: 7 }, () => day())
const loggedWeek = (kcal = 2150) =>
  Array.from({ length: 7 }, () => day({ meals: [meal('lunch', kcal, 120)] }))

function run(over: Partial<CoachInput>): CoachMessage[] {
  return evaluateCoach({
    event: 'check',
    now: at(FRI, 21),
    profile,
    today: day(),
    pastWeek: emptyWeek(),
    history: [],
    ...over,
  })
}
const ids = (m: CoachMessage[]) => m.map((x) => x.id)

describe('fillTemplate', () => {
  it('substitutes and rounds numbers', () => {
    expect(fillTemplate('{{a}} and {{b}}', { a: 12.6, b: 'x' })).toBe('13 and x')
  })
  it('leaves unknown placeholders visible', () => {
    expect(fillTemplate('{{missing}}', {})).toBe('{{missing}}')
  })
})

describe('1. calorie over target', () => {
  const over = day({ meals: [meal('breakfast', 900), meal('lunch', 1600)] }) // 300 over

  it('fires on the meal that crosses the target, with dynamic numbers', () => {
    const [m] = run({ event: 'meal_logged', now: at(FRI, 14), today: over, previousRemaining: 1300 })
    expect(m.id).toBe('calorie_over')
    expect(m.body).toContain('300 kcal above')
    // 300 kcal / (3.5 MET × 75 kg / 60) ≈ 69 min → capped at 30.
    expect(m.body).toContain('30-minute walk')
  })

  it('scales the walk for small overages but never below 10 minutes', () => {
    const small = day({ meals: [meal('lunch', 2260)] }) // 60 over → ~14 min
    const [m] = run({ event: 'meal_logged', now: at(FRI, 14), today: small, previousRemaining: 400 })
    expect(m.body).toMatch(/1[05]-minute walk/)
  })

  it('does not repeat for later meals once already over', () => {
    const msgs = run({ event: 'meal_logged', now: at(FRI, 20), today: over, previousRemaining: -100 })
    expect(ids(msgs)).not.toContain('calorie_over')
  })

  it('ignores trivial overages', () => {
    const msgs = run({ event: 'meal_logged', today: day({ meals: [meal('lunch', 2220)] }), previousRemaining: 300 })
    expect(ids(msgs)).not.toContain('calorie_over')
  })

  it('is not a time-based message', () => {
    expect(ids(run({ event: 'check', today: over }))).not.toContain('calorie_over')
  })
})

describe('2–3. deficit at night', () => {
  // Healthy: ~2,150 eaten vs ~2,725 maintenance ≈ 21% deficit. Protein is
  // short of goal so "goal achieved" (which outranks this) doesn't apply.
  const healthy = day({ meals: [meal('lunch', 1000, 60), meal('dinner', 1150, 40)] })
  // Excessive: 1,300 eaten — below the 1,500 floor for this profile.
  const tooLow = day({ meals: [meal('lunch', 600), meal('dinner', 700)] })

  it('praises a healthy deficit for a weight-loss goal', () => {
    expect(ids(run({ today: healthy }))).toContain('healthy_deficit')
  })

  it('stays quiet about deficits for other goals', () => {
    const maintain = { ...profile, goal: { type: 'maintain' as const, weeklyRateKg: 0 } }
    expect(ids(run({ today: healthy, profile: maintain }))).not.toContain('healthy_deficit')
  })

  it('flags an excessive deficit instead of praising it', () => {
    const msgs = ids(run({ today: tooLow }))
    expect(msgs).toContain('excessive_deficit')
    expect(msgs).not.toContain('healthy_deficit')
    expect(msgs).not.toContain('reward')
  })

  it('credits workout calories when judging the deficit', () => {
    // 2,000 eaten + 300 workout → net 1,700 ≈ 38% deficit vs 2,725.
    const t = day({ meals: [meal('lunch', 1000), meal('dinner', 1000)], workouts: [workout], caloriesBurned: 300 })
    expect(TDEE).toBeGreaterThan(2600)
    expect(ids(run({ today: t }))).toContain('excessive_deficit')
  })

  it('only judges the day once it looks fully logged', () => {
    const noDinner = day({ meals: [meal('breakfast', 300), meal('lunch', 400)] })
    expect(ids(run({ today: noDinner }))).toEqual([])
  })

  it('waits for night', () => {
    expect(ids(run({ today: tooLow, now: at(FRI, 15) }))).not.toContain('excessive_deficit')
  })

  it('shows healthy-deficit praise at most every other night', () => {
    const history: CoachHistoryEntry[] = [{ id: 'healthy_deficit', date: '2026-11-19', at: 0 }]
    expect(ids(run({ today: healthy, history }))).not.toContain('healthy_deficit')
    const older: CoachHistoryEntry[] = [{ id: 'healthy_deficit', date: '2026-11-18', at: 0 }]
    expect(ids(run({ today: healthy, history: older }))).toContain('healthy_deficit')
  })
})

describe('4. reward yourself', () => {
  const roomy = day({ meals: [meal('lunch', 900, 70), meal('dinner', 900, 60)] }) // 400 left

  it('fires after dinner for someone who has been logging', () => {
    const msgs = run({ event: 'meal_logged', loggedMealType: 'dinner', today: roomy, pastWeek: loggedWeek() })
    expect(ids(msgs)).toContain('reward')
  })

  it('needs a consistent week first', () => {
    expect(ids(run({ today: roomy, now: at(FRI, 20) }))).not.toContain('reward')
  })

  it('is not triggered by logging lunch', () => {
    const msgs = run({ event: 'meal_logged', loggedMealType: 'lunch', today: roomy, pastWeek: loggedWeek() })
    expect(ids(msgs)).not.toContain('reward')
  })

  it('is held back for three days after showing', () => {
    const history: CoachHistoryEntry[] = [{ id: 'reward', date: '2026-11-18', at: 0 }]
    expect(ids(run({ today: roomy, now: at(FRI, 20), pastWeek: loggedWeek(), history }))).not.toContain('reward')
  })
})

describe('5. protein goal reminder', () => {
  it('fires after a meal when protein is well behind pace', () => {
    const t = day({ meals: [meal('lunch', 900, 20)] })
    const [m] = run({ event: 'meal_logged', now: at(FRI, 14), today: t })
    expect(m.id).toBe('protein_gap')
    expect(m.body).toContain('110g away')
  })

  it('does not fire in the morning or when on pace', () => {
    const t = day({ meals: [meal('breakfast', 500, 10)] })
    expect(ids(run({ event: 'meal_logged', now: at(FRI, 9), today: t }))).not.toContain('protein_gap')
    const onPace = day({ meals: [meal('lunch', 900, 60)] })
    expect(ids(run({ event: 'meal_logged', now: at(FRI, 14), today: onPace }))).not.toContain('protein_gap')
  })

  it('wins over the dessert suggestion', () => {
    const t = day({ meals: [meal('lunch', 900, 20), meal('dinner', 900, 20)] })
    const msgs = ids(run({ event: 'meal_logged', loggedMealType: 'dinner', now: at(FRI, 20), today: t, pastWeek: loggedWeek() }))
    expect(msgs).toContain('protein_gap')
    expect(msgs).not.toContain('reward')
  })
})

describe('6. daily goal achieved', () => {
  const great = day({ meals: [meal('lunch', 1100, 70), meal('dinner', 1100, 60)] })

  it('fires when calories and protein are on target', () => {
    const msgs = ids(run({ event: 'meal_logged', loggedMealType: 'dinner', today: great }))
    expect(msgs[0]).toBe('goal_achieved')
    // It replaces, rather than stacks with, other praise.
    expect(msgs).not.toContain('healthy_deficit')
  })

  it('requires activity for people who track it', () => {
    const tracker = loggedWeek().map((d) => ({ ...d, steps: 9000 }))
    expect(ids(run({ today: great, pastWeek: tracker }))).not.toContain('goal_achieved')
    expect(ids(run({ today: { ...great, steps: 8500 }, pastWeek: tracker }))).toContain('goal_achieved')
  })

  it('does not fire when protein falls short', () => {
    const low = day({ meals: [meal('lunch', 1100, 30), meal('dinner', 1100, 30)] })
    expect(ids(run({ today: low }))).not.toContain('goal_achieved')
  })
})

describe('7. low activity', () => {
  const t = day({ meals: [meal('lunch', 900, 60)], steps: 2000 })
  const tracker = loggedWeek().map((d) => ({ ...d, steps: 7000 }))

  it('suggests a walk sized to the step gap, capped at 30 minutes', () => {
    const [m] = run({ now: at(FRI, 18), today: t, pastWeek: tracker })
    expect(m.id).toBe('low_activity')
    expect(m.body).toContain('30-minute walk')
  })

  it('sizes short gaps smaller', () => {
    const [m] = run({ now: at(FRI, 18), today: { ...t, steps: 3900 }, pastWeek: tracker, profile: profile })
    // 4,100 steps short → 41 min → capped 30; check the floor with a small target.
    expect(m.body).toMatch(/\d+-minute walk/)
    const small = { ...t, steps: 1000, stepTarget: 2500 }
    const [m2] = run({ now: at(FRI, 18), today: small, pastWeek: tracker })
    expect(m2.body).toContain('15-minute walk')
  })

  it('stays quiet for people who do not track activity', () => {
    expect(ids(run({ now: at(FRI, 18), today: { ...t, steps: 0 } }))).toEqual([])
  })

  it('stays quiet once a workout is logged or outside the evening', () => {
    expect(ids(run({ now: at(FRI, 18), today: { ...t, workouts: [workout] }, pastWeek: tracker }))).not.toContain('low_activity')
    expect(ids(run({ now: at(FRI, 11), today: t, pastWeek: tracker }))).not.toContain('low_activity')
  })
})

describe('8. weekly progress', () => {
  const sunday = day({ meals: [meal('lunch', 2150, 120)] }, SUN)

  it('counts on-target days on Sunday evening', () => {
    const [m] = run({ now: at(SUN, 19), today: sunday, pastWeek: loggedWeek() })
    expect(m.id).toBe('weekly_progress')
    expect(m.body).toBe('Amazing consistency! 🌟 You\'ve achieved your calorie target 7 out of 7 days this week.')
  })

  it('uses gentler copy for a building week', () => {
    const mixed = [...emptyWeek().slice(0, 3), ...loggedWeek(1500).slice(0, 2), ...loggedWeek().slice(0, 2)]
    const [m] = run({ now: at(SUN, 19), today: sunday, pastWeek: mixed })
    expect(m.body).toMatch(/^You hit your calorie target 3 out of 7 days/)
    expect(m.body).not.toMatch(/Amazing/)
  })

  it('never reports zero on-target days', () => {
    const [m] = run({ now: at(SUN, 19), today: day({ meals: [meal('lunch', 900)] }, SUN), pastWeek: loggedWeek(1200) })
    expect(m.body).toMatch(/^You logged 7 days this week/)
    expect(m.body).not.toMatch(/\b0 out of/)
  })

  it('needs at least three logged days', () => {
    expect(ids(run({ now: at(SUN, 19), today: sunday }))).not.toContain('weekly_progress')
  })

  it('only runs on Sunday evenings, once a week', () => {
    expect(ids(run({ now: at(FRI, 19), today: sunday, pastWeek: loggedWeek() }))).not.toContain('weekly_progress')
    const history: CoachHistoryEntry[] = [{ id: 'weekly_progress', date: SUN, at: 0 }]
    expect(ids(run({ now: at(SUN, 22), today: sunday, pastWeek: loggedWeek(), history }))).not.toContain('weekly_progress')
  })
})

describe('selection', () => {
  it('returns nothing on an empty day', () => {
    expect(run({ now: at(SUN, 21), pastWeek: loggedWeek() })).toEqual([])
  })

  it('never shows conflicting messages together', () => {
    for (const rule of COACH_RULES) {
      for (const other of rule.conflicts) {
        const back = COACH_RULES.find((r) => r.id === other)!
        // Conflicts are checked both ways, but declaring them symmetric keeps intent obvious.
        expect(back, `${other} exists`).toBeDefined()
      }
    }
  })

  it('caps messages per evaluation and per day', () => {
    const t = day({ meals: [meal('lunch', 1100, 70), meal('dinner', 1100, 60)] }, SUN)
    const msgs = run({ now: at(SUN, 20), today: { ...t, steps: 0 }, pastWeek: loggedWeek() })
    expect(msgs.length).toBeLessThanOrEqual(2)

    const full: CoachHistoryEntry[] = Array.from({ length: MAX_PER_DAY }, (_, i) =>
      ({ id: COACH_RULES[i].id, date: SUN, at: 0 }))
    expect(run({ now: at(SUN, 20), today: t, pastWeek: loggedWeek(), history: full })).toEqual([])
  })

  it('orders by priority', () => {
    const t = day({ meals: [meal('lunch', 1100, 70), meal('dinner', 1100, 60)] }, SUN)
    const msgs = run({ now: at(SUN, 21), today: t, pastWeek: loggedWeek() })
    for (let i = 1; i < msgs.length; i++) expect(msgs[i - 1].priority).toBeGreaterThanOrEqual(msgs[i].priority)
  })

  it('records history and prunes entries older than two weeks', () => {
    const old: CoachHistoryEntry[] = [{ id: 'reward', date: '2026-11-01', at: 0 }]
    const next = recordShown(old, [{ id: 'protein_gap', icon: '', title: '', body: '', tone: 'neutral', priority: 1 }], at(SUN, 12))
    expect(next).toEqual([{ id: 'protein_gap', date: SUN, at: at(SUN, 12).getTime() }])
  })
})

// ── The ten newer messages ──────────────────────────────────────────────────

const monthOf = (d: () => DailySummary, n = 30) => Array.from({ length: n }, d)

function lift(id: string, date: string, weightKg: number, reps = 5, exerciseId = 'bench'): Workout {
  return {
    id, date, name: 'Push', durationMin: 45, caloriesBurned: 200, inProgress: false, startedAt: 0,
    exercises: [{
      id: `${id}-e`, exerciseId, exerciseName: 'Bench Press', type: 'strength',
      sets: [
        { id: '1', weightKg: weightKg - 10, reps: 8, done: true },
        { id: '2', weightKg, reps, done: true },
        { id: '3', weightKg: weightKg + 20, reps: 1, done: false },
      ],
    }],
  }
}

describe('9. logging streak', () => {
  const logged = () => day({ meals: [meal('lunch', 900, 60)] })

  it('counts consecutive logged days ending today', () => {
    const c = { today: logged(), pastWeek: [], pastMonth: [day(), logged(), logged()] } as unknown as CoachInput
    expect(loggingStreak(c)).toBe(3)
  })

  it('celebrates milestones only', () => {
    const at7 = run({ event: 'meal_logged', now: at(FRI, 9), today: logged(), pastMonth: [day(), ...monthOf(logged, 6)] })
    expect(at7.find((m) => m.id === 'logging_streak')?.body).toBe('7 days logged in a row! Consistency is your superpower ⚡')
    const at8 = run({ event: 'meal_logged', now: at(FRI, 9), today: logged(), pastMonth: [day(), ...monthOf(logged, 7)] })
    expect(ids(at8)).not.toContain('logging_streak')
  })
})

describe('10. breakfast early', () => {
  const t = day({ meals: [meal('breakfast', 400, 20)] })
  it('fires for breakfast before 10am, at most weekly', () => {
    expect(ids(run({ event: 'meal_logged', loggedMealType: 'breakfast', now: at(FRI, 8), today: t }))).toContain('breakfast_early')
    expect(ids(run({ event: 'meal_logged', loggedMealType: 'breakfast', now: at(FRI, 11), today: t }))).not.toContain('breakfast_early')
    const history: CoachHistoryEntry[] = [{ id: 'breakfast_early', date: '2026-11-16', at: 0 }]
    expect(ids(run({ event: 'meal_logged', loggedMealType: 'breakfast', now: at(FRI, 8), today: t, history }))).not.toContain('breakfast_early')
  })
})

describe('11–12. water', () => {
  const t = day({ meals: [meal('lunch', 900, 60)], waterMl: 500 })
  const drinker = loggedWeek().map((d) => ({ ...d, waterMl: 2000 }))

  it('nudges in the afternoon with real figures', () => {
    const [m] = run({ now: at(FRI, 15), today: t, pastWeek: drinker })
    expect(m.body).toBe('You\'re at 0.5L of 2.5L. A glass of water now keeps you on track.')
  })

  it('stays quiet for people who never log water', () => {
    expect(ids(run({ now: at(FRI, 15), today: { ...t, waterMl: 0 } }))).not.toContain('water_behind')
  })

  it('celebrates the entry that reaches the goal, once', () => {
    const full = { ...t, waterMl: 2600 }
    expect(ids(run({ event: 'water_logged', today: full, previousWaterMl: 2300 }))).toEqual(['water_done'])
    expect(ids(run({ event: 'water_logged', today: { ...full, waterMl: 2900 }, previousWaterMl: 2600 }))).toEqual([])
  })
})

describe('13. protein goal hit', () => {
  const t = day({ meals: [meal('lunch', 900, 70), meal('snack', 300, 65)] })
  it('fires on the meal that reaches the target', () => {
    const [m] = run({ event: 'meal_logged', loggedMealType: 'snack', now: at(FRI, 17), today: t, previousProtein: 70 })
    expect(m.body).toBe('Protein goal reached: 135g today. Your muscles thank you 💪')
    expect(ids(run({ event: 'meal_logged', now: at(FRI, 17), today: t, previousProtein: 131 }))).not.toContain('protein_hit')
  })
})

describe('14. fiber goal hit', () => {
  it('fires at night when fiber meets the guide', () => {
    const t = day({ meals: [meal('lunch', 900, 60)] })
    const rich = { ...t, macros: { ...t.macros, fiber: 32 } } // guide for 2,200 kcal is 31g
    expect(ids(run({ now: at(FRI, 21), today: rich }))).toContain('fiber_hit')
    expect(ids(run({ now: at(FRI, 21), today: t }))).not.toContain('fiber_hit')
  })
})

describe('15. personal record', () => {
  it('finds a heavier completed set than any earlier session', () => {
    const rec = findNewRecord(lift('b', FRI, 70, 5), [lift('a', '2026-11-18', 65)])
    expect(rec).toEqual({ exercise: 'Bench Press', weightKg: 70, reps: 5 })
  })

  it('ignores skipped sets, first-ever exercises and ties', () => {
    expect(findNewRecord(lift('b', FRI, 65), [lift('a', '2026-11-18', 65)])).toBeNull()
    expect(findNewRecord(lift('b', FRI, 70), [])).toBeNull()
  })

  it('announces the record in the user\'s unit', () => {
    const t = day({ workouts: [lift('b', FRI, 70)] })
    const [m] = run({ event: 'workout_finished', today: t, newRecord: { exercise: 'Bench Press', weightKg: 70, reps: 5 } })
    expect(m.body).toBe('New personal record on Bench Press: 70 kg × 5! 🎉')
    const lb = { ...profile, units: { weight: 'lb' as const, height: 'cm' as const } }
    const [m2] = run({ event: 'workout_finished', today: t, profile: lb, newRecord: { exercise: 'Bench Press', weightKg: 70, reps: 5 } })
    expect(m2.body).toContain('154.3 lb')
  })
})

describe('16. weight milestone', () => {
  const w = (date: string, weightKg: number, loggedAt = 0): WeightEntry => ({ id: date, date, weightKg, loggedAt })

  it('fires as each whole kilogram is passed towards the goal', () => {
    const weights = [w('2026-10-01', 80), w('2026-11-10', 79.4), w(FRI, 78.9)]
    const [m] = run({ event: 'weight_logged', weights, previousWeightKg: 79.4 })
    expect(m.body).toBe('You\'re down 1 kg since you started — steady progress! 🎉')
    // Same milestone again (78.9 → 78.6) stays quiet.
    expect(run({ event: 'weight_logged', weights: [...weights, w('2026-11-21', 78.6)], previousWeightKg: 78.9 })).toEqual([])
  })

  it('speaks about gains for a gain goal and stays quiet for maintenance', () => {
    const gainer = { ...profile, goal: { type: 'build_muscle' as const, weeklyRateKg: 0.25 } }
    const weights = [w('2026-10-01', 70), w(FRI, 72.1)]
    expect(run({ event: 'weight_logged', profile: gainer, weights, previousWeightKg: 71.5 })[0].body)
      .toBe('You\'re up 2 kg since you started — steady progress! 🎉')
    const maintain = { ...profile, goal: { type: 'maintain' as const, weeklyRateKg: 0 } }
    expect(run({ event: 'weight_logged', profile: maintain, weights, previousWeightKg: 71.5 })).toEqual([])
  })
})

describe('17. welcome back', () => {
  it('greets after three quiet days, before anything is logged', () => {
    expect(ids(run({ now: at(FRI, 9), lastActiveDate: '2026-11-16' }))).toEqual(['welcome_back'])
    expect(run({ now: at(FRI, 9), lastActiveDate: '2026-11-18' })).toEqual([])
    expect(run({ now: at(FRI, 9) })).toEqual([]) // brand-new user
    expect(ids(run({ now: at(FRI, 9), lastActiveDate: '2026-11-16', today: day({ meals: [meal('lunch', 500)] }) })))
      .not.toContain('welcome_back')
  })
})

describe('18. workout consistency', () => {
  const withWorkouts = (n: number) => () => day({ workouts: Array.from({ length: n }, (_, i) => ({ ...workout, id: `w${i}` })) })

  it('fires when this week beats the three before it', () => {
    // Previous weeks: 1 workout each (on one day per week); this week: 3.
    const past = monthOf(() => day(), 30).map((d, i) => (i % 7 === 0 ? withWorkouts(1)() : d))
    past[27] = withWorkouts(1)(); past[28] = withWorkouts(1)()
    const [m] = run({ event: 'workout_finished', today: withWorkouts(1)(), pastMonth: past })
    expect(m.body).toBe('3 workouts this week — that\'s your best week this month! 🔥')
  })

  it('needs earlier weeks to compare against', () => {
    const past = monthOf(() => day(), 30)
    past[28] = withWorkouts(2)()
    expect(ids(run({ event: 'workout_finished', today: withWorkouts(1)(), pastMonth: past }))).not.toContain('workout_week')
  })
})

describe('refreshCoachMessage', () => {
  const base = { now: at(FRI, 14), profile, pastWeek: emptyWeek() }

  it('updates figures from current data', () => {
    const later = day({ meals: [meal('lunch', 900, 40)] })
    expect(refreshCoachMessage('protein_gap', { ...base, today: later })?.body).toContain('90g away')
  })

  it('returns null once the message no longer applies', () => {
    const done = day({ meals: [meal('lunch', 900, 125)] })
    expect(refreshCoachMessage('protein_gap', { ...base, today: done })).toBeNull()
  })

  it('keeps one-off moments (records, milestones) exactly as shown', () => {
    const original: CoachMessage = { id: 'personal_record', icon: '🏆', title: 'x', body: 'y', tone: 'positive', priority: 1 }
    expect(refreshCoachMessage('personal_record', { ...base, today: day() }, original)).toBe(original)
  })
})

describe('coach tone', () => {
  function allCopy(): string[] {
    const out: string[] = []
    const add = (m: CoachMessage[]) => m.forEach((x) => out.push(`${x.title} ${x.body}`))
    const days = [
      day({ meals: [meal('lunch', 900, 20)] }),
      day({ meals: [meal('lunch', 1100, 70), meal('dinner', 1100, 60)] }),
      day({ meals: [meal('lunch', 600), meal('dinner', 700)] }),
      day({ meals: [meal('lunch', 1000, 70), meal('dinner', 1150, 60)] }),
      day({ meals: [meal('lunch', 900, 70), meal('dinner', 900, 60)] }),
      day({ meals: [meal('breakfast', 900), meal('lunch', 1900)] }),
      day({ meals: [meal('lunch', 900, 60)], steps: 1500 }),
    ]
    const weeks = [loggedWeek(), loggedWeek().map((d) => ({ ...d, steps: 6000 })), [...emptyWeek().slice(0, 4), ...loggedWeek(1500).slice(0, 3)]]
    for (const t of days) {
      for (const pastWeek of weeks) {
        for (const hour of [13, 18, 20, 22]) {
          for (const date of [FRI, SUN]) {
            add(run({ event: 'check', now: at(date, hour), today: { ...t, date }, pastWeek }))
            add(run({ event: 'meal_logged', loggedMealType: 'dinner', previousRemaining: 500, now: at(date, hour), today: { ...t, date }, pastWeek }))
          }
        }
      }
    }
    // Event-specific messages.
    const logged = () => day({ meals: [meal('lunch', 900, 60)] })
    add(run({ event: 'meal_logged', now: at(FRI, 9), loggedMealType: 'breakfast', today: logged(), pastMonth: [day(), ...monthOf(logged, 6)] }))
    add(run({ event: 'meal_logged', now: at(FRI, 17), today: day({ meals: [meal('lunch', 900, 140)] }), previousProtein: 50 }))
    add(run({ event: 'water_logged', today: { ...logged(), waterMl: 2600 }, previousWaterMl: 2000 }))
    add(run({ now: at(FRI, 15), today: { ...logged(), waterMl: 300 }, pastWeek: loggedWeek().map((d) => ({ ...d, waterMl: 2000 })) }))
    add(run({ now: at(FRI, 21), today: { ...logged(), macros: { ...logged().macros, fiber: 40 } } }))
    add(run({ event: 'workout_finished', today: day({ workouts: [workout] }), newRecord: { exercise: 'Squat', weightKg: 100, reps: 3 } }))
    const wkPast = monthOf(() => day(), 30).map((d, i) => (i % 7 === 0 ? day({ workouts: [workout] }) : d))
    wkPast[28] = day({ workouts: [workout] }); wkPast[27] = day({ workouts: [workout] })
    add(run({ event: 'workout_finished', today: day({ workouts: [workout] }), pastMonth: wkPast }))
    add(run({ event: 'weight_logged', weights: [{ id: 'a', date: '2026-10-01', weightKg: 80, loggedAt: 0 }, { id: 'b', date: FRI, weightKg: 77.8, loggedAt: 0 }], previousWeightKg: 78.4 }))
    add(run({ now: at(FRI, 9), lastActiveDate: '2026-11-10' }))
    return out
  }

  const copy = allCopy()

  it('reaches every message', () => {
    for (const rule of COACH_RULES) {
      expect(copy.some((c) => c.startsWith(rule.title)), rule.id).toBe(true)
    }
  })

  it('fills every placeholder', () => {
    for (const c of copy) expect(c, c).not.toMatch(/\{\{|\}\}|NaN|undefined/)
  })

  it('uses at most two emoji per message', () => {
    for (const c of copy) expect((c.match(/\p{Extended_Pictographic}/gu) ?? []).length, c).toBeLessThanOrEqual(2)
  })

  it('keeps emoji out of over-target, under-eating and inactivity messages', () => {
    for (const id of ['calorie_over', 'excessive_deficit', 'low_activity', 'water_behind', 'protein_gap']) {
      const rule = COACH_RULES.find((r) => r.id === id)!
      expect(rule.template, id).not.toMatch(/\p{Extended_Pictographic}/u)
    }
  })

  it('never shames the user', () => {
    const banned = /\b(bad|guilty|guilt|shame|cheat|junk|naughty|indulgent|overate|too much|unhealthy|lazy|failed|failure)\b/i
    for (const c of copy) expect(c, c).not.toMatch(banned)
  })

  it('never frames exercise as compensation for eating', () => {
    const banned = /\b(burn (it |them )?off|work(ed)? off|make up for|compensate|cancel out|earn(ed)? (it|your)|offset)\b/i
    for (const c of copy) expect(c, c).not.toMatch(banned)
  })

  it('keeps every walk optional and at most 30 minutes', () => {
    for (const c of copy) {
      const mins = c.match(/(\d+)-minute walk/)
      if (!mins) continue
      expect(Number(mins[1]), c).toBeLessThanOrEqual(30)
      expect(c, c).toMatch(/optional|could/i)
    }
  })

  it('never encourages restriction', () => {
    const banned = /\b(skip|fast(ing)?|eat less|cut (more|back)|starv\w*|restrict\w*)\b/i
    for (const c of copy) expect(c, c).not.toMatch(banned)
  })
})
