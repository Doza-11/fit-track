import { describe, it, expect } from 'vitest'
import { generateDailySuggestion, generateSuggestions, buildContext, unloggedMeals } from './suggestions'
import type { DailySummary, Meal, UserProfile, Workout } from '@/types'
import { EMPTY_NUTRIENTS } from '@/utils/calculations'

const profile: UserProfile = {
  id: 'current', name: 'Test', age: 30, sex: 'male', heightCm: 178, weightKg: 75,
  activityLevel: 'moderate',
  goal: { type: 'maintain', weeklyRateKg: 0 },
  calorieTarget: 2200, calorieTargetIsCustom: false,
  macroTargets: { protein: 130, carbs: 250, fat: 70 },
  waterTargetMl: 2500, stepTarget: 8000,
  units: { weight: 'kg', height: 'cm' }, theme: 'system',
  notifications: { smartSuggestions: true, quietStart: '22:00', quietEnd: '08:00', maxPerDay: 4 },
  createdAt: 0,
}

function meal(type: Meal['type'], calories: number, protein = 0): Meal {
  return {
    id: type, date: '2026-09-09', type, loggedAt: 0,
    items: [{
      id: '1', foodId: 'x', foodName: 'Food', servingLabel: '100 g', quantity: 1, grams: 100,
      nutrients: { ...EMPTY_NUTRIENTS, calories, protein },
    }],
  }
}

function summary(over: Partial<DailySummary> = {}): DailySummary {
  const meals = over.meals ?? []
  const consumed = over.caloriesConsumed
    ?? meals.reduce((s, m) => s + m.items.reduce((a, i) => a + i.nutrients.calories, 0), 0)
  const protein = meals.reduce((s, m) => s + m.items.reduce((a, i) => a + i.nutrients.protein, 0), 0)
  const base: DailySummary = {
    date: '2026-09-09',
    caloriesConsumed: consumed,
    caloriesBurned: 0,
    calorieTarget: 2200,
    remaining: 2200 - consumed,
    macros: { ...EMPTY_NUTRIENTS, protein },
    macroTargets: profile.macroTargets,
    waterMl: 2500, waterTargetMl: 2500,
    steps: 8000, stepTarget: 8000,
    meals, workouts: [],
    hasAnyEntry: meals.length > 0,
  }
  return { ...base, ...over }
}

const workout: Workout = {
  id: 'w1', date: '2026-09-09', name: 'Strength', exercises: [], durationMin: 45,
  caloriesBurned: 310, inProgress: false, startedAt: 0,
}

const ctx = (s: DailySummary, hour: number, extra = {}) =>
  buildContext({ summary: s, profile, hour, ...extra })

describe('generateDailySuggestion', () => {
  it('prompts to start logging on an empty day', () => {
    const s = generateDailySuggestion(ctx(summary(), 9))
    expect(s?.id).toBe('empty-day')
  })

  it('celebrates a completed workout near target', () => {
    const s = generateDailySuggestion(ctx(summary({
      meals: [meal('lunch', 2100, 130)], workouts: [workout], remaining: 100,
    }), 19))
    expect(s?.id).toBe('good-day')
    expect(s?.tone).toBe('positive')
  })

  it('flags a missing breakfast in the morning only', () => {
    const s = summary({ meals: [meal('snack', 200)] })
    expect(generateSuggestions(ctx(s, 9)).some((x) => x.id === 'log-breakfast')).toBe(true)
    expect(generateSuggestions(ctx(s, 15)).some((x) => x.id === 'log-breakfast')).toBe(false)
  })

  it('reminds about dinner at night', () => {
    const s = summary({ meals: [meal('lunch', 1400, 90)] })
    expect(generateSuggestions(ctx(s, 22)).some((x) => x.id === 'log-dinner')).toBe(true)
  })

  it('surfaces remaining calories when there is comfortable room', () => {
    const s = summary({ meals: [meal('lunch', 1650, 100)] })
    const ids = generateSuggestions(ctx(s, 18)).map((x) => x.id)
    expect(ids).toContain('remaining-room')
  })

  it('notes being under target without alarm', () => {
    const s = generateSuggestions(ctx(summary({ meals: [meal('breakfast', 400, 20)] }), 19))
      .find((x) => x.id === 'under-target')
    expect(s).toBeDefined()
    expect(s!.tone).not.toBe('nudge')
  })

  it('flags low protein only once enough of the day has passed', () => {
    const s = summary({ meals: [meal('lunch', 1200, 30)] })
    expect(generateSuggestions(ctx(s, 20)).some((x) => x.id === 'low-protein')).toBe(true)
    expect(generateSuggestions(ctx(s, 8)).some((x) => x.id === 'low-protein')).toBe(false)
  })

  it('suggests an optional walk after a calorie-dense dinner', () => {
    const s = summary({ meals: [meal('dinner', 1100, 40)] })
    const walk = generateSuggestions(ctx(s, 21)).find((x) => x.id === 'evening-walk')
    expect(walk).toBeDefined()
    expect(walk!.body).toMatch(/optional/i)
  })

  it('notices a low-movement day', () => {
    const s = summary({ meals: [meal('lunch', 1500, 90)], steps: 1200 })
    expect(generateSuggestions(ctx(s, 18)).some((x) => x.id === 'low-activity')).toBe(true)
  })

  it('does not nag about activity when a workout is logged', () => {
    const s = summary({ meals: [meal('lunch', 1500, 90)], steps: 500, workouts: [workout] })
    expect(generateSuggestions(ctx(s, 18)).some((x) => x.id === 'low-activity')).toBe(false)
  })

  it('mentions hydration when water is behind', () => {
    const s = summary({ meals: [meal('lunch', 1500, 90)], waterMl: 400 })
    expect(generateSuggestions(ctx(s, 20)).some((x) => x.id === 'hydration')).toBe(true)
  })

  it('praises a logging streak', () => {
    const s = generateSuggestions(ctx(summary({ meals: [meal('lunch', 900, 50)] }), 14, { streak: 8 }))
    expect(s.some((x) => x.id === 'streak')).toBe(true)
  })

  it('returns an end-of-day summary at night', () => {
    const s = generateSuggestions(ctx(summary({ meals: [meal('dinner', 700, 40)] }), 22))
    expect(s.some((x) => x.id === 'day-summary')).toBe(true)
  })

  it('always returns something actionable for a logged day', () => {
    for (const hour of [7, 13, 19, 23]) {
      expect(generateDailySuggestion(ctx(summary({ meals: [meal('lunch', 1200, 60)] }), hour))).not.toBeNull()
    }
  })
})

describe('suggestion tone', () => {
  /** Every string the engine can emit, across a spread of day states. */
  function allCopy(): string[] {
    const states: DailySummary[] = [
      summary(),
      summary({ meals: [meal('breakfast', 300, 10)] }),
      summary({ meals: [meal('dinner', 1400, 30)] }),
      summary({ meals: [meal('lunch', 3200, 40)], remaining: -1000 }),
      summary({ meals: [meal('lunch', 1650, 95)], workouts: [workout] }),
      summary({ meals: [meal('lunch', 800, 20)], steps: 300, waterMl: 200 }),
    ]
    const out: string[] = []
    for (const s of states) {
      for (const hour of [8, 14, 19, 22]) {
        for (const sug of generateSuggestions(ctx(s, hour, { recentAvgCalories: 2000, recentAvgSteps: 8000, streak: 5 }))) {
          out.push(`${sug.title} ${sug.body}`)
        }
      }
    }
    return out
  }

  it('never shames the user', () => {
    const banned = /\b(bad|guilty|guilt|shame|cheat|junk|naughty|indulgent|overate|too much|unhealthy|lazy|failed|failure)\b/i
    for (const copy of allCopy()) expect(copy, copy).not.toMatch(banned)
  })

  it('never frames exercise as compensation for eating', () => {
    const banned = /\b(burn (it |them )?off|work(ed)? off|make up for|compensate|cancel out|earn(ed)? (it|your)|offset)\b/i
    for (const copy of allCopy()) expect(copy, copy).not.toMatch(banned)
  })

  it('avoids medical claims', () => {
    const banned = /\b(diagnos\w*|disease|obese|obesity|prescrib\w*|medical\w*|you should consult|cure|treatment)\b/i
    for (const copy of allCopy()) expect(copy, copy).not.toMatch(banned)
  })

  it('keeps movement suggestions optional', () => {
    for (const copy of allCopy()) {
      if (/\bwalk\b/i.test(copy)) {
        expect(copy, copy).toMatch(/could|if you|optional|feel up to|fits your/i)
      }
    }
  })

  it('phrases calorie figures approximately', () => {
    for (const copy of allCopy()) {
      if (/remaining today/i.test(copy)) expect(copy, copy).toMatch(/about|around|~/i)
    }
  })
})

describe('unloggedMeals', () => {
  it('lists the main slots still empty', () => {
    expect(unloggedMeals(summary({ meals: [meal('breakfast', 400)] })))
      .toEqual(['lunch', 'snack', 'dinner'])
  })

  it('returns nothing when the main slots are covered', () => {
    const meals = [meal('breakfast', 300), meal('lunch', 600), meal('snack', 200), meal('dinner', 700)]
    expect(unloggedMeals(summary({ meals }))).toEqual([])
  })
})
