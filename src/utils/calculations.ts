/**
 * Pure nutrition / fitness maths. No React, no storage, no side effects —
 * every function here is directly unit-testable and reused across screens.
 *
 * All energy values are kcal, mass kg, distance km, duration minutes.
 * Every burn figure is an *estimate*; the UI must label it as such.
 */
import type {
  ActivityLevel, DailySummary, Exercise, GoalType, Intensity, LocalDate,
  MacroTargets, Meal, Nutrients, Sex, UserProfile, WeightEntry, Workout,
  WorkoutExercise,
} from '@/types'
import { daysBetween, fromLocalDate } from './date'

export const EMPTY_NUTRIENTS: Nutrients = {
  calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0,
}

/** Multipliers applied to BMR to approximate total daily energy expenditure. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

export const ACTIVITY_LABELS: Record<ActivityLevel, { title: string; detail: string }> = {
  sedentary: { title: 'Sedentary', detail: 'Desk job, little exercise' },
  light: { title: 'Lightly active', detail: 'Light exercise 1–3 days/week' },
  moderate: { title: 'Moderately active', detail: 'Exercise 3–5 days/week' },
  active: { title: 'Very active', detail: 'Hard exercise 6–7 days/week' },
  very_active: { title: 'Extremely active', detail: 'Physical job or 2x daily training' },
}

export const GOAL_LABELS: Record<GoalType, { title: string; detail: string }> = {
  lose: { title: 'Lose weight', detail: 'Gradual, sustainable deficit' },
  maintain: { title: 'Maintain weight', detail: 'Stay around your current weight' },
  gain: { title: 'Gain weight', detail: 'Gradual surplus' },
  build_muscle: { title: 'Build muscle', detail: 'Slight surplus, higher protein' },
}

/** Energy in 1 kg of body mass — the standard planning approximation. */
const KCAL_PER_KG = 7700

/** Never recommend a target below these floors. */
const MIN_CALORIES: Record<Sex, number> = { male: 1500, female: 1200 }

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function round(n: number, dp = 0): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

// ── Energy expenditure ──────────────────────────────────────────────────────

/**
 * Basal metabolic rate via Mifflin–St Jeor, the most widely used
 * predictive equation for healthy adults.
 */
export function calculateBMR(input: {
  weightKg: number
  heightCm: number
  age: number
  sex: Sex
}): number {
  const { weightKg, heightCm, age, sex } = input
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return Math.round(base + (sex === 'male' ? 5 : -161))
}

/** Total daily energy expenditure: BMR scaled by habitual activity. */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_FACTORS[activityLevel])
}

/**
 * Recommended daily intake for a goal.
 *
 * The deficit/surplus comes from the desired weekly rate of change, capped so
 * we never suggest an aggressive cut. Result is floored at a safe minimum.
 */
export function calculateDailyCalorieTarget(input: {
  tdee: number
  goal: GoalType
  weeklyRateKg?: number
  sex: Sex
}): number {
  const { tdee, goal, sex } = input
  const rate = input.weeklyRateKg ?? defaultWeeklyRate(goal)
  const dailyDelta = (rate * KCAL_PER_KG) / 7

  // Cap the deficit at 25% of TDEE so the recommendation stays moderate.
  const maxDeficit = tdee * 0.25
  const bounded = clamp(dailyDelta, -maxDeficit, tdee * 0.2)

  return Math.max(MIN_CALORIES[sex], Math.round((tdee + bounded) / 10) * 10)
}

export function defaultWeeklyRate(goal: GoalType): number {
  switch (goal) {
    case 'lose': return -0.5
    case 'gain': return 0.35
    case 'build_muscle': return 0.25
    case 'maintain': return 0
  }
}

/**
 * Macro split for a calorie target.
 *
 * Protein is set per kg of bodyweight (higher when building muscle or cutting,
 * where preserving lean mass matters), fat at ~25–30% of energy, and carbs
 * take the remainder.
 */
export function calculateMacroTargets(
  calories: number,
  weightKg: number,
  goal: GoalType,
): MacroTargets {
  const proteinPerKg = goal === 'build_muscle' ? 1.9 : goal === 'lose' ? 1.8 : 1.5
  const protein = Math.round(weightKg * proteinPerKg)
  const fatPct = goal === 'lose' ? 0.27 : 0.28
  const fat = Math.round((calories * fatPct) / 9)
  const remaining = calories - protein * 4 - fat * 9
  // Guard against a negative carb figure at very low targets.
  const carbs = Math.max(0, Math.round(remaining / 4))
  return { protein, carbs, fat }
}

/** Full recommendation chain from a profile. Used by onboarding and recalcs. */
export function recommendTargets(p: {
  weightKg: number; heightCm: number; age: number; sex: Sex
  activityLevel: ActivityLevel; goal: GoalType; weeklyRateKg?: number
}) {
  const bmr = calculateBMR(p)
  const tdee = calculateTDEE(bmr, p.activityLevel)
  const calories = calculateDailyCalorieTarget({
    tdee, goal: p.goal, weeklyRateKg: p.weeklyRateKg, sex: p.sex,
  })
  return { bmr, tdee, calories, macros: calculateMacroTargets(calories, p.weightKg, p.goal) }
}

// ── Daily balance ───────────────────────────────────────────────────────────

/**
 * Calories still available today.
 *
 * Exercise calories are *added back* to the allowance, matching how mainstream
 * trackers behave. A negative result means the target has been exceeded.
 */
export function calculateRemainingCalories(input: {
  target: number
  consumed: number
  burned: number
}): number {
  return Math.round(input.target - input.consumed + input.burned)
}

export interface MacroProgress {
  key: 'protein' | 'carbs' | 'fat'
  label: string
  consumed: number
  target: number
  /** 0–1, uncapped ratio is available as `rawRatio`. */
  ratio: number
  rawRatio: number
  remaining: number
}

export function calculateMacroProgress(
  consumed: Nutrients,
  targets: MacroTargets,
): MacroProgress[] {
  const rows: Array<[MacroProgress['key'], string]> = [
    ['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat'],
  ]
  return rows.map(([key, label]) => {
    const c = consumed[key]
    const t = targets[key]
    const rawRatio = t > 0 ? c / t : 0
    return {
      key, label,
      consumed: Math.round(c),
      target: t,
      ratio: clamp(rawRatio, 0, 1),
      rawRatio,
      remaining: Math.round(t - c),
    }
  })
}

// ── Nutrition scaling ───────────────────────────────────────────────────────

/** Scale per-100g nutrition to an arbitrary gram weight. */
export function scaleNutrients(per100g: Nutrients, grams: number): Nutrients {
  const f = grams / 100
  return {
    calories: round(per100g.calories * f, 1),
    protein: round(per100g.protein * f, 1),
    carbs: round(per100g.carbs * f, 1),
    fat: round(per100g.fat * f, 1),
    fiber: round(per100g.fiber * f, 1),
    sugar: round(per100g.sugar * f, 1),
  }
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  return list.reduce<Nutrients>((acc, n) => ({
    calories: acc.calories + n.calories,
    protein: acc.protein + n.protein,
    carbs: acc.carbs + n.carbs,
    fat: acc.fat + n.fat,
    fiber: acc.fiber + n.fiber,
    sugar: acc.sugar + n.sugar,
  }), { ...EMPTY_NUTRIENTS })
}

export function mealNutrients(meal: Meal): Nutrients {
  return sumNutrients(meal.items.map((i) => i.nutrients))
}

export function totalNutrients(meals: Meal[]): Nutrients {
  return sumNutrients(meals.flatMap((m) => m.items.map((i) => i.nutrients)))
}

// ── Workout energy ──────────────────────────────────────────────────────────

/**
 * Estimated burn for one activity block using the MET formula:
 *   kcal = MET × bodyweight(kg) × hours
 *
 * This is an approximation — real expenditure varies with fitness, efficiency
 * and effort — so results are always surfaced as estimates.
 */
export function calculateWorkoutCalories(input: {
  met: number
  weightKg: number
  durationMin: number
}): number {
  const { met, weightKg, durationMin } = input
  if (durationMin <= 0 || met <= 0) return 0
  return Math.round(met * weightKg * (durationMin / 60))
}

export function metFor(exercise: Exercise, intensity: Intensity = 'moderate'): number {
  return exercise.metByIntensity?.[intensity] ?? exercise.met
}

/**
 * Burn for a whole session.
 *
 * Cardio blocks use their own logged duration. Strength blocks rarely carry a
 * duration, so the remaining session time is shared between them.
 */
export function estimateWorkoutCalories(
  exercises: WorkoutExercise[],
  sessionDurationMin: number,
  weightKg: number,
  lookup: (id: string) => Exercise | undefined,
): number {
  if (exercises.length === 0 || sessionDurationMin <= 0) return 0

  const timed = exercises.filter((e) => (e.durationMin ?? 0) > 0)
  const untimedCount = exercises.length - timed.length
  const timedTotal = timed.reduce((s, e) => s + (e.durationMin ?? 0), 0)
  const leftover = Math.max(0, sessionDurationMin - timedTotal)
  const perUntimed = untimedCount > 0 ? leftover / untimedCount : 0

  let total = 0
  for (const we of exercises) {
    const ex = lookup(we.exerciseId)
    if (!ex) continue
    const minutes = (we.durationMin ?? 0) > 0 ? we.durationMin! : perUntimed
    total += calculateWorkoutCalories({
      met: metFor(ex, we.intensity ?? 'moderate'),
      weightKg,
      durationMin: minutes,
    })
  }
  return Math.round(total)
}

/** Total kg lifted across completed sets — the standard volume metric. */
export function workoutVolume(exercises: WorkoutExercise[]): number {
  let volume = 0
  for (const we of exercises) {
    for (const s of we.sets ?? []) {
      if (s.done) volume += s.weightKg * s.reps
    }
  }
  return Math.round(volume)
}

/** Epley formula — estimated one-rep max from a submaximal set. */
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0
  if (reps === 1) return round(weightKg, 1)
  return round(weightKg * (1 + reps / 30), 1)
}

/** Rough walking burn — used for the step contribution shown on the dashboard. */
export function caloriesFromSteps(steps: number, weightKg: number): number {
  // ~0.04 kcal per step for a 70 kg adult, scaled linearly by bodyweight.
  return Math.round(steps * 0.04 * (weightKg / 70))
}

// ── Aggregates & trends ─────────────────────────────────────────────────────

export function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Mean of a series, ignoring days with no data so blanks don't drag it down. */
export function calculateWeeklyAverage(
  values: Array<number | null | undefined>,
): number {
  const present = values.filter((v): v is number => typeof v === 'number' && v > 0)
  return Math.round(average(present))
}

export interface WeightTrend {
  start?: number
  current?: number
  changeKg: number
  /** kg per week, from a least-squares fit over the logged points. */
  ratePerWeek: number
  direction: 'up' | 'down' | 'flat'
  /** Smoothed series for charting, one point per entry. */
  smoothed: Array<{ date: LocalDate; weightKg: number }>
}

/**
 * Weight trend from raw entries.
 *
 * Daily weight is noisy (water, food, time of day), so we fit a linear
 * regression over time for the rate and expose a 7-point moving average for
 * display rather than reacting to single readings.
 */
export function calculateWeightTrend(entries: WeightEntry[]): WeightTrend {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length === 0) {
    return { changeKg: 0, ratePerWeek: 0, direction: 'flat', smoothed: [] }
  }
  const start = sorted[0].weightKg
  const current = sorted[sorted.length - 1].weightKg
  const changeKg = round(current - start, 1)

  // Moving average over a trailing window, clipped at the series start.
  const WINDOW = 7
  const smoothed = sorted.map((e, i) => {
    const from = Math.max(0, i - WINDOW + 1)
    const slice = sorted.slice(from, i + 1)
    return { date: e.date, weightKg: round(average(slice.map((s) => s.weightKg)), 2) }
  })

  let ratePerWeek = 0
  if (sorted.length >= 2) {
    const x0 = fromLocalDate(sorted[0].date).getTime()
    const xs = sorted.map((e) => (fromLocalDate(e.date).getTime() - x0) / 86_400_000)
    const ys = sorted.map((e) => e.weightKg)
    const mx = average(xs)
    const my = average(ys)
    let num = 0
    let den = 0
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i] - mx) * (ys[i] - my)
      den += (xs[i] - mx) ** 2
    }
    // den is 0 when every entry lands on the same day — no slope to fit.
    ratePerWeek = den === 0 ? 0 : round((num / den) * 7, 2)
  }

  const direction = Math.abs(changeKg) < 0.2 ? 'flat' : changeKg > 0 ? 'up' : 'down'
  return { start, current, changeKg, ratePerWeek, direction, smoothed }
}

/** Projected days to reach a goal weight at the observed rate. */
export function projectGoalDays(
  current: number, goalWeight: number, ratePerWeek: number,
): number | null {
  const delta = goalWeight - current
  if (Math.abs(delta) < 0.1) return 0
  // No projection when the trend runs away from the goal or is flat.
  if (ratePerWeek === 0 || Math.sign(delta) !== Math.sign(ratePerWeek)) return null
  return Math.round((delta / ratePerWeek) * 7)
}

/** Consecutive days with at least one logged entry, counting back from today. */
export function calculateStreak(
  loggedDates: Set<LocalDate>, endDate: LocalDate,
): number {
  let streak = 0
  const d = fromLocalDate(endDate)
  // Allow today to be empty without breaking a streak earned yesterday.
  if (!loggedDates.has(endDate)) d.setDate(d.getDate() - 1)
  for (;;) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!loggedDates.has(key)) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

/** Percentage change between two periods, guarding division by zero. */
export function percentChange(previous: number, current: number): number | null {
  if (previous <= 0) return null
  return round(((current - previous) / previous) * 100, 0)
}

export function workoutSplit(workouts: Workout[]): { strength: number; cardio: number; other: number } {
  let strength = 0, cardio = 0, other = 0
  for (const w of workouts) {
    for (const e of w.exercises) {
      if (e.type === 'strength' || e.type === 'bodyweight') strength++
      else if (e.type === 'cardio') cardio++
      else other++
    }
  }
  return { strength, cardio, other }
}

/** Adherence: share of days within ±10% of the calorie target. */
export function calorieAdherence(days: DailySummary[]): number {
  const logged = days.filter((d) => d.caloriesConsumed > 0)
  if (logged.length === 0) return 0
  const onTarget = logged.filter(
    (d) => Math.abs(d.caloriesConsumed - d.calorieTarget) <= d.calorieTarget * 0.1,
  )
  return Math.round((onTarget.length / logged.length) * 100)
}

export function bmi(weightKg: number, heightCm: number): number {
  if (heightCm <= 0) return 0
  return round(weightKg / (heightCm / 100) ** 2, 1)
}

// ── Unit conversion ─────────────────────────────────────────────────────────

export const kgToLb = (kg: number) => round(kg * 2.20462, 1)
export const lbToKg = (lb: number) => round(lb / 2.20462, 2)
export const cmToInches = (cm: number) => cm / 2.54

export function cmToFtIn(cm: number): { ft: number; inches: number } {
  const total = cmToInches(cm)
  const ft = Math.floor(total / 12)
  return { ft, inches: Math.round(total - ft * 12) }
}

export function ftInToCm(ft: number, inches: number): number {
  return round((ft * 12 + inches) * 2.54, 1)
}

export function displayWeight(kg: number, unit: 'kg' | 'lb'): number {
  return unit === 'lb' ? kgToLb(kg) : round(kg, 1)
}

/** Days a profile has been tracking, used to gate "not enough data" states. */
export function daysTracking(profile: UserProfile, to: LocalDate): number {
  return Math.max(0, daysBetween(
    new Date(profile.createdAt).toISOString().slice(0, 10) as LocalDate, to,
  ))
}
