/**
 * Trend detection over a window of daily summaries.
 *
 * Each detector compares the recent period with the one before it and only
 * speaks up when it has enough data and the change is large enough to be
 * meaningful — otherwise the section fills with noise.
 */
import type { DailySummary, LocalDate, UserProfile, WeightEntry } from '@/types'
import { isWeekend } from '@/utils/date'
import {
  average, calculateStreak, calculateWeightTrend, percentChange, round,
} from '@/utils/calculations'

export interface Insight {
  id: string
  icon: string
  text: string
  tone: 'positive' | 'neutral'
}

/** Minimum logged days in each half before comparisons are trustworthy. */
const MIN_DAYS_PER_HALF = 3
/** Changes smaller than this read as noise, not a trend. */
const MIN_PCT = 8

interface Halves {
  recent: DailySummary[]
  previous: DailySummary[]
}

function splitHalves(days: DailySummary[]): Halves {
  const mid = Math.floor(days.length / 2)
  return { previous: days.slice(0, mid), recent: days.slice(mid) }
}

const logged = (days: DailySummary[]) => days.filter((d) => d.caloriesConsumed > 0)

function avgOf(days: DailySummary[], pick: (d: DailySummary) => number): number {
  const vals = days.map(pick).filter((v) => v > 0)
  return vals.length ? average(vals) : 0
}

export function generateInsights(input: {
  days: DailySummary[]
  weights: WeightEntry[]
  profile: UserProfile
  today: LocalDate
}): Insight[] {
  const { days, weights, profile, today } = input
  const out: Insight[] = []
  const loggedDays = logged(days)
  const { recent, previous } = splitHalves(days)
  const comparable =
    logged(recent).length >= MIN_DAYS_PER_HALF && logged(previous).length >= MIN_DAYS_PER_HALF

  // ── Protein trend ─────────────────────────────────────────────────────────
  if (comparable) {
    const r = avgOf(recent, (d) => d.macros.protein)
    const p = avgOf(previous, (d) => d.macros.protein)
    const pct = percentChange(p, r)
    if (pct !== null && Math.abs(pct) >= MIN_PCT) {
      out.push({
        id: 'protein-trend', icon: pct > 0 ? '💪' : '🥚',
        text: pct > 0
          ? `Your average protein intake increased ${pct}% in the second half of this period.`
          : `Your average protein intake is down ${Math.abs(pct)}% compared with the first half of this period.`,
        tone: pct > 0 ? 'positive' : 'neutral',
      })
    }
  }

  // ── Workouts ──────────────────────────────────────────────────────────────
  const workoutDays = days.filter((d) => d.workouts.length > 0)
  if (workoutDays.length > 0) {
    const totalMin = workoutDays.reduce(
      (s, d) => s + d.workouts.reduce((a, w) => a + w.durationMin, 0), 0)
    out.push({
      id: 'workout-count', icon: '🏋️',
      text: `You completed ${workoutDays.length} workout${workoutDays.length === 1 ? '' : 's'} in this period — about ${Math.round(totalMin)} minutes in total.`,
      tone: 'positive',
    })
  }

  // ── Steps ─────────────────────────────────────────────────────────────────
  if (comparable) {
    const r = avgOf(recent, (d) => d.steps)
    const p = avgOf(previous, (d) => d.steps)
    const pct = percentChange(p, r)
    if (pct !== null && Math.abs(pct) >= MIN_PCT) {
      out.push({
        id: 'steps-trend', icon: pct > 0 ? '🚶' : '📉',
        text: pct > 0
          ? `Your average daily steps increased ${pct}% compared with earlier in this period.`
          : `Your average daily steps are ${Math.abs(pct)}% lower than earlier in this period.`,
        tone: pct > 0 ? 'positive' : 'neutral',
      })
    }
  }

  // ── Weekend vs weekday intake ─────────────────────────────────────────────
  const weekendDays = loggedDays.filter((d) => isWeekend(d.date))
  const weekdayDays = loggedDays.filter((d) => !isWeekend(d.date))
  if (weekendDays.length >= 2 && weekdayDays.length >= 3) {
    const we = average(weekendDays.map((d) => d.caloriesConsumed))
    const wd = average(weekdayDays.map((d) => d.caloriesConsumed))
    const pct = percentChange(wd, we)
    if (pct !== null && pct >= 12) {
      out.push({
        id: 'weekend-pattern', icon: '📅',
        text: `Your calorie intake averages about ${pct}% higher on weekends than weekdays. That is a common pattern, not a problem in itself.`,
        tone: 'neutral',
      })
    }
  }

  // ── Target adherence ──────────────────────────────────────────────────────
  if (loggedDays.length >= 4) {
    const over = loggedDays.filter((d) => d.caloriesConsumed > d.calorieTarget * 1.1).length
    const under = loggedDays.filter((d) => d.caloriesConsumed < d.calorieTarget * 0.8).length
    if (over >= Math.ceil(loggedDays.length * 0.6)) {
      out.push({
        id: 'consistently-over', icon: '📊',
        text: `You were above your calorie target on ${over} of ${loggedDays.length} logged days. If that matches how you feel, adjusting the target may be more realistic than changing your eating.`,
        tone: 'neutral',
      })
    } else if (under >= Math.ceil(loggedDays.length * 0.6)) {
      out.push({
        id: 'consistently-under', icon: '🍽️',
        text: `You were well under your target on ${under} of ${loggedDays.length} logged days. Either some meals are going unlogged, or the target may be set higher than you need.`,
        tone: 'neutral',
      })
    }
  }

  // ── Weight ────────────────────────────────────────────────────────────────
  const trend = calculateWeightTrend(weights)
  if (weights.length >= 3 && trend.current !== undefined) {
    if (Math.abs(trend.ratePerWeek) >= 0.1) {
      const dir = trend.ratePerWeek < 0 ? 'down' : 'up'
      out.push({
        id: 'weight-trend', icon: '⚖️',
        text: `Your weight is trending ${dir} about ${Math.abs(trend.ratePerWeek).toFixed(2)} kg per week. Day-to-day readings fluctuate, so the trend matters more than any single one.`,
        tone: 'neutral',
      })
    } else {
      out.push({
        id: 'weight-stable', icon: '⚖️',
        text: `Your weight has been stable at around ${round(trend.current, 1)} kg over this period.`,
        tone: 'neutral',
      })
    }
    if (profile.goal.targetWeightKg) {
      const remaining = round(Math.abs(trend.current - profile.goal.targetWeightKg), 1)
      if (remaining >= 0.5) {
        out.push({
          id: 'goal-distance', icon: '🎯',
          text: `You are about ${remaining} kg from your goal weight of ${profile.goal.targetWeightKg} kg.`,
          tone: 'neutral',
        })
      } else {
        out.push({ id: 'goal-reached', icon: '🎯', text: 'You are within half a kilo of your goal weight.', tone: 'positive' })
      }
    }
  }

  // ── Logging consistency ───────────────────────────────────────────────────
  const streak = calculateStreak(new Set(loggedDays.map((d) => d.date)), today)
  if (streak >= 3) {
    out.push({
      id: 'logging-streak', icon: '🔥',
      text: `You have logged meals consistently for ${streak} days in a row.`,
      tone: 'positive',
    })
  } else if (loggedDays.length >= 3 && loggedDays.length < days.length * 0.5) {
    out.push({
      id: 'sparse-logging', icon: '📝',
      text: `You logged ${loggedDays.length} of the last ${days.length} days. More complete logging makes these trends more reliable.`,
      tone: 'neutral',
    })
  }

  return out
}

/** Headline numbers for the analytics period summary card. */
export interface PeriodStats {
  avgCalories: number
  avgProtein: number
  avgCarbs: number
  avgFat: number
  avgSteps: number
  avgBurned: number
  workouts: number
  workoutMinutes: number
  loggedDays: number
  totalDays: number
  weightChangeKg: number | null
  avgTarget: number
}

export function calculatePeriodStats(
  days: DailySummary[], weights: WeightEntry[],
): PeriodStats {
  const loggedDays = logged(days)
  const workouts = days.flatMap((d) => d.workouts)
  const trend = calculateWeightTrend(weights)
  return {
    avgCalories: Math.round(avgOf(loggedDays, (d) => d.caloriesConsumed)),
    avgProtein: Math.round(avgOf(loggedDays, (d) => d.macros.protein)),
    avgCarbs: Math.round(avgOf(loggedDays, (d) => d.macros.carbs)),
    avgFat: Math.round(avgOf(loggedDays, (d) => d.macros.fat)),
    avgSteps: Math.round(avgOf(days, (d) => d.steps)),
    avgBurned: Math.round(avgOf(days, (d) => d.caloriesBurned)),
    workouts: workouts.length,
    workoutMinutes: Math.round(workouts.reduce((s, w) => s + w.durationMin, 0)),
    loggedDays: loggedDays.length,
    totalDays: days.length,
    weightChangeKg: weights.length >= 2 ? trend.changeKg : null,
    avgTarget: Math.round(avgOf(days, (d) => d.calorieTarget)),
  }
}
