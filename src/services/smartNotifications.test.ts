import { describe, it, expect } from 'vitest'
import {
  planSmartNotifications, pickTreats, isStillRelevant, isQuietHour,
  enforceSpacingAndCap, atTimeToday, reminderRelevance, reminderBody,
  DEFAULT_NOTIFICATION_PREFS, type PlannedNotification,
} from './smartNotifications'
import type { DailySummary, Meal, UserProfile, Workout } from '@/types'
import { EMPTY_NUTRIENTS } from '@/utils/calculations'
import { SEED_FOODS } from '@/data/foods'

const profile: UserProfile = {
  id: 'current', name: 'Test', age: 30, sex: 'male', heightCm: 178, weightKg: 78,
  activityLevel: 'moderate', goal: { type: 'lose', weeklyRateKg: -0.5 },
  calorieTarget: 2150, calorieTargetIsCustom: false,
  macroTargets: { protein: 140, carbs: 251, fat: 65 },
  waterTargetMl: 2500, stepTarget: 8000,
  units: { weight: 'kg', height: 'cm' }, theme: 'system',
  notifications: { ...DEFAULT_NOTIFICATION_PREFS },
  createdAt: 0,
}

const DATE = '2026-09-09'

function meal(type: Meal['type'], calories: number, protein = 0): Meal {
  return {
    id: type, date: DATE, type, loggedAt: 0,
    items: [{
      id: '1', foodId: 'x', foodName: 'Food', servingLabel: '100 g', quantity: 1, grams: 100,
      nutrients: { ...EMPTY_NUTRIENTS, calories, protein },
    }],
  }
}

const workout: Workout = {
  id: 'w1', date: DATE, name: 'Strength', exercises: [], durationMin: 45,
  caloriesBurned: 300, inProgress: false, startedAt: 0,
}

function summary(over: Partial<DailySummary> = {}): DailySummary {
  const meals = over.meals ?? []
  const consumed = over.caloriesConsumed
    ?? meals.reduce((s, m) => s + m.items.reduce((a, i) => a + i.nutrients.calories, 0), 0)
  const protein = meals.reduce((s, m) => s + m.items.reduce((a, i) => a + i.nutrients.protein, 0), 0)
  return {
    date: DATE,
    caloriesConsumed: consumed,
    caloriesBurned: 0,
    calorieTarget: 2150,
    remaining: 2150 - consumed,
    macros: { ...EMPTY_NUTRIENTS, protein },
    macroTargets: profile.macroTargets,
    waterMl: 2500, waterTargetMl: 2500,
    steps: 8000, stepTarget: 8000,
    meals, workouts: [],
    hasAnyEntry: meals.length > 0,
    ...over,
  }
}

/** 10:00 on the summary date, so every checkpoint is still ahead. */
const morning = new Date(2026, 8, 9, 10, 0, 0, 0)

const plan = (s: DailySummary, over: Partial<Parameters<typeof planSmartNotifications>[0]> = {}) =>
  planSmartNotifications({
    summary: s, profile, recentAvgProtein: 120, recentAvgSteps: 8000, now: morning, ...over,
  })

const kinds = (items: PlannedNotification[]) => items.map((i) => i.dedupeKey.split(':')[1])

describe('low protein', () => {
  it('notifies when protein is far below target and the user’s usual', () => {
    const p = plan(summary({ meals: [meal('lunch', 1200, 30)] }))
    expect(kinds(p)).toContain('low_protein')
  })

  it('mentions the user’s own recent average, not a generic number', () => {
    const n = plan(summary({ meals: [meal('lunch', 1200, 25)] }))
      .find((x) => x.dedupeKey.endsWith('low_protein'))!
    expect(n.body).toMatch(/recent average of about 120g/)
  })

  it('stays quiet when protein is on pace', () => {
    expect(kinds(plan(summary({ meals: [meal('lunch', 1200, 110)] })))).not.toContain('low_protein')
  })

  it('stays quiet when nothing is logged at all', () => {
    expect(kinds(plan(summary()))).not.toContain('low_protein')
  })

  it('does not fire when protein is low against target but normal for this user', () => {
    // 55g of a 140g target, but this user averages 60g — not unusual for them.
    const p = plan(summary({ meals: [meal('lunch', 1200, 55)] }), { recentAvgProtein: 60 })
    expect(kinds(p)).not.toContain('low_protein')
  })

  it('drops the nudge once protein has been topped up', () => {
    const n = plan(summary({ meals: [meal('lunch', 1200, 30)] }))
      .find((x) => x.dedupeKey.endsWith('low_protein'))!
    expect(isStillRelevant(n.relevance, summary({ meals: [meal('lunch', 1200, 130)] }))).toBe(false)
    expect(isStillRelevant(n.relevance, summary({ meals: [meal('lunch', 1200, 30)] }))).toBe(true)
  })
})

describe('calorie room', () => {
  it('suggests concrete treats that fit the remaining calories', () => {
    const n = plan(summary({ meals: [meal('lunch', 1600, 100)] }))
      .find((x) => x.dedupeKey.endsWith('calorie_room'))!
    expect(n.title).toMatch(/kcal left today/)
    expect(n.body).toMatch(/~\d+ kcal/)
  })

  it('never suggests something that would exceed what is left', () => {
    for (const remaining of [300, 450, 600, 900]) {
      for (const t of pickTreats(remaining, DATE)) {
        expect(t.kcal, `${t.name} @ ${remaining}`).toBeLessThanOrEqual(remaining)
      }
    }
  })

  it('leaves headroom rather than filling the whole remainder', () => {
    for (const t of pickTreats(500, DATE)) expect(t.kcal).toBeLessThanOrEqual(500 * 0.7)
  })

  it('suggests nothing when there is too little room to be worth it', () => {
    expect(pickTreats(100, DATE)).toEqual([])
    expect(pickTreats(0, DATE)).toEqual([])
  })

  it('varies suggestions across days but is stable for a given day', () => {
    const a = pickTreats(600, '2026-09-09').map((t) => t.name)
    const b = pickTreats(600, '2026-09-09').map((t) => t.name)
    expect(a).toEqual(b)
    const week = new Set(
      ['09-09', '09-10', '09-11', '09-12', '09-13']
        .map((d) => pickTreats(600, `2026-${d}`)[0]?.name),
    )
    expect(week.size).toBeGreaterThan(1)
  })

  it('never offers a main-meal food as a treat', () => {
    // The rule is semantic, not a name pattern: a treat must be eaten as a
    // snack or dessert and must not be a main-meal food. Checking the source
    // data directly keeps this honest as the database grows.
    for (const remaining of [300, 500, 700, 1000]) {
      for (const d of ['2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']) {
        for (const t of pickTreats(remaining, d)) {
          const food = SEED_FOODS.find((f) => f.name === t.name)
          expect(food, t.name).toBeDefined()
          const meals = food!.commonMeals ?? []
          expect(meals, `${t.name} is a lunch food`).not.toContain('lunch')
          expect(meals, `${t.name} is a dinner food`).not.toContain('dinner')
          expect(meals.some((m) => m === 'snack' || m === 'dessert'), t.name).toBe(true)
        }
      }
    }
  })

  it('never offers these specifically, however the data changes', () => {
    // Regression guard: plain paneer, cooking milk and curd were once
    // suggested as treats, which reads absurdly.
    const nonsense = ['Paneer', 'Milk (full fat)', 'Milk (toned)', 'Curd / Dahi']
    for (const remaining of [300, 500, 700, 1000, 1500]) {
      for (const d of ['2026-09-09', '2026-09-11', '2026-09-13']) {
        for (const t of pickTreats(remaining, d)) {
          expect(nonsense, `${t.name} @ ${remaining}`).not.toContain(t.name)
        }
      }
    }
  })

  it('does surface an actual dessert when there is room for one', () => {
    // Across a week at a typical evening remainder, something from the dessert
    // category should come up rather than only worthy options.
    const week = ['2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14']
      .flatMap((d) => pickTreats(500, d))
    expect(week.some((t) => t.category === 'dessert')).toBe(true)
  })

  it('offers variety rather than three desserts', () => {
    const cats = pickTreats(700, DATE).map((t) => t.category)
    expect(new Set(cats).size).toBe(cats.length)
  })

  it('does not fire when the user is over target', () => {
    expect(kinds(plan(summary({ meals: [meal('lunch', 2600, 120)] })))).not.toContain('calorie_room')
  })

  it('is dropped once the user has eaten into the remainder', () => {
    const n = plan(summary({ meals: [meal('lunch', 1600, 100)] }))
      .find((x) => x.dedupeKey.endsWith('calorie_room'))!
    expect(isStillRelevant(n.relevance, summary({ meals: [meal('lunch', 2100, 120)] }))).toBe(false)
  })
})

describe('under-eating', () => {
  it('flags a large shortfall and takes priority over the treat nudge', () => {
    const p = plan(summary({ meals: [meal('breakfast', 300, 20)] }))
    expect(kinds(p)).toContain('under_eating')
    expect(kinds(p)).not.toContain('calorie_room')
  })

  it('frames it around the user’s goal without alarm', () => {
    const n = plan(summary({ meals: [meal('breakfast', 300, 20)] }))
      .find((x) => x.dedupeKey.endsWith('under_eating'))!
    expect(n.body).toMatch(/deficit|goal/i)
  })
})

describe('activity, hydration and praise', () => {
  it('nudges movement on a low-step day with no workout', () => {
    expect(kinds(plan(summary({ meals: [meal('lunch', 1500, 90)], steps: 800 })))).toContain('move')
  })

  it('stays quiet about movement when a workout is logged', () => {
    const s = summary({ meals: [meal('lunch', 1500, 90)], steps: 800, workouts: [workout] })
    expect(kinds(plan(s))).not.toContain('move')
  })

  it('nudges hydration when water is behind', () => {
    expect(kinds(plan(summary({ meals: [meal('lunch', 1500, 90)], waterMl: 300 })))).toContain('hydration')
  })

  it('celebrates a day on target with a workout done', () => {
    const s = summary({ meals: [meal('lunch', 2100, 130)], workouts: [workout] })
    expect(kinds(plan(s))).toContain('good_day')
  })
})

describe('restraint', () => {
  /** A deliberately bad day that trips as many rules as possible. */
  const messyDay = summary({
    meals: [meal('breakfast', 200, 5)], steps: 200, waterMl: 100,
  })

  it('respects the daily cap', () => {
    const p = planSmartNotifications({
      summary: messyDay, profile: { ...profile, notifications: { ...DEFAULT_NOTIFICATION_PREFS, maxPerDay: 2 } },
      recentAvgProtein: 120, recentAvgSteps: 9000, now: morning,
    })
    expect(p.length).toBeLessThanOrEqual(2)
  })

  it('keeps the highest-priority items when capping', () => {
    const p = planSmartNotifications({
      summary: messyDay, profile: { ...profile, notifications: { ...DEFAULT_NOTIFICATION_PREFS, maxPerDay: 1 } },
      recentAvgProtein: 120, recentAvgSteps: 9000, now: morning,
    })
    expect(kinds(p)).toEqual(['under_eating'])
  })

  it('lets the evening protein nudge coexist with the calorie one', () => {
    // Both apply on a day that was light on food and light on protein; the
    // checkpoints must be far enough apart that spacing doesn't drop one.
    const lightDay = summary({ meals: [meal('lunch', 900, 18)] })
    expect(kinds(plan(lightDay))).toEqual(
      expect.arrayContaining(['under_eating', 'low_protein']),
    )
  })

  it('never schedules two notifications within 90 minutes', () => {
    const p = plan(messyDay)
    for (let i = 1; i < p.length; i++) {
      expect(p[i].at - p[i - 1].at).toBeGreaterThanOrEqual(90 * 60_000)
    }
  })

  it('emits nothing when smart suggestions are switched off', () => {
    const p = planSmartNotifications({
      summary: messyDay,
      profile: { ...profile, notifications: { ...DEFAULT_NOTIFICATION_PREFS, smartSuggestions: false } },
      recentAvgProtein: 120, recentAvgSteps: 9000, now: morning,
    })
    expect(p).toEqual([])
  })

  it('never schedules anything in the past', () => {
    const evening = new Date(2026, 8, 9, 21, 0, 0, 0)
    for (const n of plan(messyDay, { now: evening })) {
      expect(n.at).toBeGreaterThan(evening.getTime())
    }
  })

  it('does not repeat something already delivered today', () => {
    const first = plan(messyDay)
    expect(first.length).toBeGreaterThan(0)
    const firedKeys = first.map((n) => n.dedupeKey)
    const again = plan(messyDay, { alreadyFired: new Set(firedKeys) })
    for (const n of again) expect(firedKeys).not.toContain(n.dedupeKey)
  })

  it('counts already-delivered notifications against the daily cap', () => {
    // Four already out today means the budget is spent, whatever else is true.
    const spent = new Set([
      `${DATE}:under_eating`, `${DATE}:low_protein`, `${DATE}:move`, `${DATE}:good_day`,
    ])
    expect(plan(messyDay, { alreadyFired: spent })).toEqual([])
  })

  it('stops entirely once the day is fully logged and nothing is off', () => {
    const goodDay = summary({ meals: [meal('lunch', 2100, 135)], workouts: [workout] })
    const p = plan(goodDay).filter((n) => !n.dedupeKey.endsWith('good_day'))
    expect(p).toEqual([])
  })

  it('gives every notification a key unique to its day and kind', () => {
    const p = plan(messyDay)
    expect(new Set(p.map((n) => n.dedupeKey)).size).toBe(p.length)
    for (const n of p) expect(n.dedupeKey.startsWith(`${DATE}:`)).toBe(true)
  })
})

describe('quiet hours', () => {
  it('treats a window that wraps midnight correctly', () => {
    expect(isQuietHour('23:00', '22:00', '08:00')).toBe(true)
    expect(isQuietHour('02:00', '22:00', '08:00')).toBe(true)
    expect(isQuietHour('07:59', '22:00', '08:00')).toBe(true)
    expect(isQuietHour('08:00', '22:00', '08:00')).toBe(false)
    expect(isQuietHour('15:00', '22:00', '08:00')).toBe(false)
  })

  it('handles a same-day window', () => {
    expect(isQuietHour('13:00', '12:00', '14:00')).toBe(true)
    expect(isQuietHour('15:00', '12:00', '14:00')).toBe(false)
  })

  it('suppresses notifications falling inside the window', () => {
    const p = planSmartNotifications({
      summary: summary({ meals: [meal('lunch', 1600, 100)] }),
      // Silence the whole afternoon and evening.
      profile: { ...profile, notifications: { ...DEFAULT_NOTIFICATION_PREFS, quietStart: '12:00', quietEnd: '23:00' } },
      recentAvgProtein: 120, recentAvgSteps: 8000, now: morning,
    })
    expect(p).toEqual([])
  })
})

describe('fixed reminders become state-aware', () => {
  it('is dropped when that meal is already logged', () => {
    const rel = reminderRelevance('lunch', summary())
    expect(isStillRelevant(rel, summary({ meals: [meal('lunch', 600, 30)] }))).toBe(false)
    expect(isStillRelevant(rel, summary({ meals: [meal('breakfast', 300, 10)] }))).toBe(true)
  })

  it('is dropped when the workout is already logged', () => {
    const rel = reminderRelevance('workout', summary())
    expect(isStillRelevant(rel, summary({ workouts: [workout] }))).toBe(false)
    expect(isStillRelevant(rel, summary())).toBe(true)
  })

  it('is dropped once the water target is met', () => {
    const rel = reminderRelevance('water', summary())
    expect(isStillRelevant(rel, summary({ waterMl: 2500 }))).toBe(false)
    expect(isStillRelevant(rel, summary({ waterMl: 900 }))).toBe(true)
  })

  it('fills the daily summary with the day’s real numbers', () => {
    const s = summary({ meals: [meal('lunch', 1850, 118)], steps: 9240, workouts: [workout] })
    const body = reminderBody('summary', 'fallback', s)
    expect(body).toContain('1,850')
    expect(body).toContain('118g')
    expect(body).toContain('9,240')
    expect(body).toContain('workout logged')
  })

  it('tells the user how much water is left', () => {
    expect(reminderBody('water', 'fallback', summary({ waterMl: 1000 }))).toMatch(/1\.5L left/)
  })

  it('falls back to the static copy for kinds with nothing dynamic to add', () => {
    expect(reminderBody('breakfast', 'Log breakfast.', summary())).toBe('Log breakfast.')
  })
})

describe('notification tone', () => {
  /** Every string this module can emit, across a spread of day states. */
  function allCopy(): string[] {
    const states = [
      summary({ meals: [meal('breakfast', 200, 5)], steps: 200, waterMl: 100 }),
      summary({ meals: [meal('lunch', 1600, 100)] }),
      summary({ meals: [meal('lunch', 2600, 130)] }),
      summary({ meals: [meal('lunch', 2100, 130)], workouts: [workout] }),
      summary({ meals: [meal('dinner', 900, 20)], steps: 500 }),
    ]
    const out: string[] = []
    for (const s of states) {
      for (const n of plan(s)) out.push(`${n.title} ${n.body}`)
      for (const kind of ['summary', 'water', 'breakfast', 'dinner']) {
        out.push(reminderBody(kind, 'Log it when you can.', s))
      }
    }
    return out
  }

  it('never shames the user', () => {
    const banned = /\b(bad|guilty|guilt|shame|cheat|junk|naughty|overate|too much|unhealthy|lazy|failed|failure)\b/i
    for (const c of allCopy()) expect(c, c).not.toMatch(banned)
  })

  it('never frames movement as compensating for food', () => {
    const banned = /\b(burn (it|them)? ?off|work(ed)? off|make up for|compensate|cancel out|earn(ed)? (it|your)|offset)\b/i
    for (const c of allCopy()) expect(c, c).not.toMatch(banned)
  })

  it('avoids medical claims', () => {
    const banned = /\b(diagnos\w*|disease|obese|obesity|prescrib\w*|cure|treatment)\b/i
    for (const c of allCopy()) expect(c, c).not.toMatch(banned)
  })

  it('keeps treat and movement suggestions optional', () => {
    for (const c of allCopy()) {
      if (/\b(walk|fancy|dessert|ice cream)\b/i.test(c)) {
        expect(c, c).toMatch(/could|if you|up to you|optional|fits your|no pressure/i)
      }
    }
  })

  it('phrases calorie figures approximately', () => {
    for (const c of allCopy()) {
      if (/kcal (left|remaining)/i.test(c)) expect(c, c).toMatch(/about|around|~/i)
    }
  })

  it('keeps bodies short enough for a notification shade', () => {
    for (const c of allCopy()) expect(c.length, c).toBeLessThan(220)
  })
})

describe('helpers', () => {
  it('resolves a time against the given day', () => {
    const at = atTimeToday('19:30', morning)
    expect(new Date(at).getHours()).toBe(19)
    expect(new Date(at).getDate()).toBe(9)
  })

  it('returns an empty plan for a cap of zero', () => {
    expect(enforceSpacingAndCap([{
      id: 'a', dedupeKey: 'k', at: 1, title: 't', body: 'b', priority: 1,
      relevance: { type: 'always' },
    }], 0)).toEqual([])
  })
})
