/**
 * Monthly report card — the numbers behind the shareable image.
 *
 * Pure: give it a month's daily summaries plus weight and workout history and
 * it returns averages, counts and a short list of "wins". Drawing lives in
 * `components/MonthReportCard.tsx`.
 *
 * Averages count logged days only, so a forgotten day doesn't look like
 * under-eating. Wins are only ever positive; a month with little logged gets
 * an encouraging line rather than a list of zeroes.
 */
import type { DailySummary, UserProfile, WeightEntry, Workout } from '@/types'
import { calculateFiberTarget, kgToLb, round } from '@/utils/calculations'
import { findNewRecord } from './coach'

export interface MonthReport {
  monthLabel: string
  name: string
  daysLogged: number
  daysInPeriod: number
  avgCalories: number
  calorieTarget: number
  onTargetDays: number
  avgProtein: number
  proteinTarget: number
  proteinDays: number
  avgFiber: number
  fiberTarget: number
  workouts: number
  workoutMinutes: number
  workoutKcal: number
  /** Change between the first and last weigh-in of the month, in the user's unit. */
  weightChange: number | null
  weightUnit: 'kg' | 'lb'
  bestStreak: number
  topRecord: { exercise: string; weight: number; reps: number } | null
  /** One value per day for the mini chart; 0 = nothing logged. */
  dailyCalories: number[]
  wins: string[]
}

export interface MonthReportInput {
  /** First day of the month, local time. */
  month: Date
  /** One summary per day of the month up to today (oldest first). */
  days: DailySummary[]
  profile: UserProfile
  weights: WeightEntry[]
  /** All workouts, so records can be compared with earlier months. */
  allWorkouts: Workout[]
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function buildMonthReport({ month, days, profile, weights, allWorkouts }: MonthReportInput): MonthReport {
  const monthLabel = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`

  const food = days.filter((d) => d.caloriesConsumed > 0)
  const logged = days.filter((d) => d.hasAnyEntry)
  const calorieTarget = profile.calorieTarget
  const proteinTarget = profile.macroTargets.protein
  const fiberTarget = calculateFiberTarget(calorieTarget)

  const onTargetDays = food.filter((d) =>
    d.calorieTarget > 0 && Math.abs(d.caloriesConsumed - d.calorieTarget) <= d.calorieTarget * 0.1).length
  const proteinDays = food.filter((d) =>
    d.macroTargets.protein > 0 && d.macros.protein >= d.macroTargets.protein * 0.9).length

  const monthWorkouts = days.flatMap((d) => d.workouts.filter((w) => !w.inProgress))
  const workoutMinutes = Math.round(monthWorkouts.reduce((t, w) => t + w.durationMin, 0))
  const workoutKcal = Math.round(monthWorkouts.reduce((t, w) => t + w.caloriesBurned, 0))

  // Longest run of consecutive logged days within the month.
  let bestStreak = 0
  let run = 0
  for (const d of days) {
    run = d.hasAnyEntry ? run + 1 : 0
    bestStreak = Math.max(bestStreak, run)
  }

  // First vs last weigh-in this month.
  const unit = profile.units.weight
  const inMonth = weights
    .filter((w) => w.date.startsWith(prefix))
    .sort((a, b) => a.date.localeCompare(b.date) || a.loggedAt - b.loggedAt)
  const deltaKg = inMonth.length >= 2 ? inMonth[inMonth.length - 1].weightKg - inMonth[0].weightKg : null
  const weightChange = deltaKg === null ? null : round(unit === 'lb' ? kgToLb(deltaKg) : deltaKg, 1)

  // Heaviest new personal record set this month.
  let topRecord: MonthReport['topRecord'] = null
  for (const w of monthWorkouts) {
    const earlier = allWorkouts.filter((o) => !o.inProgress && o.id !== w.id
      && (o.date < w.date || (o.date === w.date && (o.completedAt ?? o.startedAt) < (w.completedAt ?? w.startedAt))))
    const rec = findNewRecord(w, earlier)
    if (rec && (!topRecord || rec.weightKg > topRecord.weight)) {
      topRecord = { exercise: rec.exercise, weight: rec.weightKg, reps: rec.reps }
    }
  }
  if (topRecord && unit === 'lb') topRecord = { ...topRecord, weight: round(kgToLb(topRecord.weight), 1) }

  const report: Omit<MonthReport, 'wins'> = {
    monthLabel,
    name: profile.name,
    daysLogged: logged.length,
    daysInPeriod: days.length,
    avgCalories: Math.round(avg(food.map((d) => d.caloriesConsumed))),
    calorieTarget,
    onTargetDays,
    avgProtein: Math.round(avg(food.map((d) => d.macros.protein))),
    proteinTarget,
    proteinDays,
    avgFiber: Math.round(avg(food.map((d) => d.macros.fiber))),
    fiberTarget,
    workouts: monthWorkouts.length,
    workoutMinutes,
    workoutKcal,
    weightChange,
    weightUnit: unit,
    bestStreak,
    topRecord,
    dailyCalories: days.map((d) => Math.round(d.caloriesConsumed)),
  }
  return { ...report, wins: pickWins(report, profile) }
}

/** Up to three positive highlights, most impressive first. */
export function pickWins(r: Omit<MonthReport, 'wins'>, profile: UserProfile): string[] {
  const wins: Array<[score: number, text: string]> = []

  if (r.topRecord) {
    wins.push([90, `New PR: ${r.topRecord.exercise} ${r.topRecord.weight} ${r.weightUnit} × ${r.topRecord.reps}`])
  }
  if (r.weightChange !== null) {
    const goal = profile.goal.type
    const toward = (goal === 'lose' && r.weightChange <= -0.3)
      || ((goal === 'gain' || goal === 'build_muscle') && r.weightChange >= 0.3)
    if (toward) {
      const verb = r.weightChange < 0 ? 'Down' : 'Up'
      wins.push([85, `${verb} ${Math.abs(r.weightChange)} ${r.weightUnit} this month`])
    } else if (goal === 'maintain' && Math.abs(r.weightChange) <= 0.5) {
      wins.push([60, 'Weight held steady — right on plan'])
    }
  }
  if (r.bestStreak >= 5) wins.push([70 + Math.min(r.bestStreak, 20), `${r.bestStreak}-day logging streak`])
  if (r.proteinDays >= 5) wins.push([65 + r.proteinDays / 2, `Protein goal hit on ${plural(r.proteinDays, 'day')}`])
  if (r.onTargetDays >= 5) wins.push([60 + r.onTargetDays / 2, `On calorie target ${plural(r.onTargetDays, 'day')}`])
  if (r.workouts >= 4) wins.push([55 + r.workouts, `${plural(r.workouts, 'workout')} · ${r.workoutMinutes} min`])
  if (r.fiberTarget > 0 && r.avgFiber >= r.fiberTarget) wins.push([50, `Fiber goal met on average (${r.avgFiber} g)`])

  const top = wins.sort((a, b) => b[0] - a[0]).slice(0, 3).map(([, t]) => t)
  if (top.length > 0) return top
  if (r.daysLogged > 0) return [`${plural(r.daysLogged, 'day')} logged — the habit is building`]
  return ['A fresh month — every logged day counts']
}
