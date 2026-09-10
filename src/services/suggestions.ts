/**
 * Suggestion engine.
 *
 * Rules are pure functions of the day's state. Each returns a suggestion or
 * null; the highest-priority match wins.
 *
 * Tone rules, applied to every string in this file:
 *  - Never shame the user for what they ate. No "too much", no "bad".
 *  - Never frame movement as punishment or compensation for food.
 *  - Everything is optional and phrased as a possibility, not an instruction.
 *  - No medical claims; use approximate language ("about", "around").
 */
import type { DailySummary, UserProfile } from '@/types'
import type { DayPart } from '@/utils/date'
import { dayPart } from '@/utils/date'
import { MEAL_ORDER } from '@/data/foods'

export type SuggestionTone = 'positive' | 'neutral' | 'nudge'

export interface Suggestion {
  id: string
  icon: string
  title: string
  body: string
  tone: SuggestionTone
  /** Higher wins when several rules match. */
  priority: number
}

export interface SuggestionContext {
  summary: DailySummary
  profile: UserProfile
  part: DayPart
  /** Mean intake over the recent window, for "higher than usual" comparisons. */
  recentAvgCalories: number
  recentAvgSteps: number
  /** Consecutive days with at least one entry. */
  streak: number
}

type Rule = (c: SuggestionContext) => Suggestion | null

const kcal = (n: number) => `${Math.round(Math.abs(n)).toLocaleString()} kcal`

/** Round to the nearest 50 so figures read as estimates, not precise claims. */
const approx = (n: number) => Math.round(Math.abs(n) / 50) * 50

// ── Rules, roughly ordered by how much they matter ──────────────────────────

const nothingLoggedYet: Rule = ({ summary, part }) => {
  if (summary.hasAnyEntry) return null
  const copy: Record<DayPart, [string, string]> = {
    morning: ['Ready when you are', 'Log your first meal to start tracking today.'],
    afternoon: ['Nothing logged yet today', 'Adding what you have eaten so far keeps your daily picture accurate.'],
    evening: ['Nothing logged yet today', 'You can still add today’s meals — logging late is better than skipping the day.'],
    night: ['Nothing logged yet today', 'A quick entry now keeps your history complete for tomorrow’s summary.'],
  }
  const [title, body] = copy[part]
  return { id: 'empty-day', icon: '📝', title, body, tone: 'neutral', priority: 100 }
}

const missingBreakfast: Rule = ({ summary, part }) => {
  if (part !== 'morning') return null
  if (summary.meals.some((m) => m.type === 'breakfast' && m.items.length > 0)) return null
  if (!summary.hasAnyEntry) return null
  return {
    id: 'log-breakfast', icon: '🍳',
    title: 'Breakfast not logged',
    body: `Today’s target is about ${kcal(summary.calorieTarget)}. Logging breakfast helps the rest of the day stay accurate.`,
    tone: 'neutral', priority: 82,
  }
}

/**
 * A large shortfall late in the day is worth surfacing — under-eating is as
 * much a tracking problem as over-eating, and the framing stays supportive.
 */
const wellUnderTarget: Rule = ({ summary, part, profile }) => {
  if (!summary.hasAnyEntry) return null
  if (part === 'morning') return null
  const shortfall = summary.calorieTarget - summary.caloriesConsumed
  if (shortfall < summary.calorieTarget * 0.35) return null
  const goalNote = profile.goal.type === 'lose'
    ? 'Even on a deficit, eating enough helps you keep the habit going.'
    : 'Getting enough food and protein supports the goal you set.'
  return {
    id: 'under-target', icon: '🍽️',
    title: `About ${kcal(approx(shortfall))} remaining today`,
    body: `${goalNote} If you are hungry, a balanced meal or snack fits comfortably.`,
    tone: 'neutral', priority: 76,
  }
}

const comfortableRemaining: Rule = ({ summary, part }) => {
  if (!summary.hasAnyEntry || part === 'morning') return null
  const remaining = summary.remaining
  if (remaining < 200 || remaining > summary.calorieTarget * 0.35) return null
  return {
    id: 'remaining-room', icon: '💡',
    title: `You have about ${kcal(approx(remaining))} remaining today`,
    body: 'If you’re hungry, a snack or dessert can fit within your remaining calories.',
    tone: 'neutral', priority: 60,
  }
}

/**
 * When intake runs above the day's target we describe it neutrally and, at
 * most, mention a gentle walk as an option — never as making up for food.
 */
const aboveTarget: Rule = ({ summary, recentAvgCalories }) => {
  if (!summary.hasAnyEntry) return null
  if (summary.remaining >= 0) return null
  const over = Math.abs(summary.remaining)
  const noticeablyHigher = recentAvgCalories > 0 && summary.caloriesConsumed > recentAvgCalories * 1.15
  const body = noticeablyHigher
    ? 'Today was higher in calories than your recent average. One day rarely changes the trend — your weekly pattern is what matters.'
    : 'You are a little above today’s target. This is normal from day to day and nothing to correct for.'
  return {
    id: 'above-target', icon: '📊',
    title: `About ${kcal(approx(over))} above today’s target`,
    body, tone: 'neutral', priority: 70,
  }
}

const heavyDinnerWalk: Rule = ({ summary, part }) => {
  if (part !== 'evening' && part !== 'night') return null
  const dinner = summary.meals.find((m) => m.type === 'dinner')
  if (!dinner || dinner.items.length === 0) return null
  const dinnerCals = dinner.items.reduce((s, i) => s + i.nutrients.calories, 0)
  if (dinnerCals < summary.calorieTarget * 0.45) return null
  return {
    id: 'evening-walk', icon: '🚶',
    title: 'Dinner was calorie-dense today',
    body: 'If you feel up to it, an easy 20–30 minute walk is a pleasant way to end the day. Entirely optional.',
    tone: 'neutral', priority: 55,
  }
}

const lowProtein: Rule = ({ summary, part }) => {
  if (!summary.hasAnyEntry || part === 'morning') return null
  const target = summary.macroTargets.protein
  if (target <= 0) return null
  const ratio = summary.macros.protein / target
  // Only flag once enough of the day has passed for the gap to be meaningful.
  const expected = part === 'afternoon' ? 0.4 : 0.7
  if (ratio >= expected) return null
  return {
    id: 'low-protein', icon: '🥚',
    title: 'Protein is a little low today',
    body: `You’re at about ${Math.round(summary.macros.protein)}g of ${target}g. Greek yogurt, eggs, chicken, tofu, paneer, or dal are easy ways to add some.`,
    tone: 'neutral', priority: 65,
  }
}

const lowActivity: Rule = ({ summary, part, recentAvgSteps, profile }) => {
  if (part === 'morning') return null
  if (summary.workouts.length > 0) return null
  const stepTarget = profile.stepTarget || 8000
  const usual = recentAvgSteps > 0 ? recentAvgSteps : stepTarget
  if (summary.steps > usual * 0.6) return null
  if (summary.steps === 0 && !summary.hasAnyEntry) return null
  return {
    id: 'low-activity', icon: '🚶',
    title: 'A quieter day for movement',
    body: 'A 20–30 minute walk could be a simple way to add some activity, if it fits your day.',
    tone: 'neutral', priority: 50,
  }
}

const hydration: Rule = ({ summary, part }) => {
  if (part === 'morning') return null
  const target = summary.waterTargetMl || 2500
  const expected = part === 'afternoon' ? 0.4 : 0.7
  if (summary.waterMl >= target * expected) return null
  return {
    id: 'hydration', icon: '💧',
    title: 'Water intake is behind your usual',
    body: `You’ve logged about ${(summary.waterMl / 1000).toFixed(1)}L of ${(target / 1000).toFixed(1)}L. A glass or two over the next hour closes most of the gap.`,
    tone: 'neutral', priority: 45,
  }
}

const workoutDone: Rule = ({ summary }) => {
  if (summary.workouts.length === 0) return null
  const onTarget = Math.abs(summary.remaining) <= summary.calorieTarget * 0.15
  if (!onTarget) return null
  return {
    id: 'good-day', icon: '🔥',
    title: 'Great job today',
    body: 'You’re close to your calorie target and today’s workout is done. Keep the consistency going.',
    tone: 'positive', priority: 90,
  }
}

const streakPraise: Rule = ({ streak, summary }) => {
  if (streak < 3 || !summary.hasAnyEntry) return null
  return {
    id: 'streak', icon: '⭐',
    title: `${streak} days logged in a row`,
    body: 'Consistent tracking is what makes the weekly trends meaningful. Nice work.',
    tone: 'positive', priority: streak >= 7 ? 88 : 40,
  }
}

const endOfDaySummary: Rule = ({ summary, part }) => {
  if (part !== 'night' || !summary.hasAnyEntry) return null
  const workout = summary.workouts.length > 0 ? '✓' : '—'
  return {
    id: 'day-summary', icon: '🌙',
    title: 'Today’s summary',
    body: `${Math.round(summary.caloriesConsumed).toLocaleString()} / ${summary.calorieTarget.toLocaleString()} kcal · Protein ${Math.round(summary.macros.protein)}g · Steps ${summary.steps.toLocaleString()} · Workout ${workout}`,
    tone: 'neutral', priority: 30,
  }
}

const missingDinner: Rule = ({ summary, part }) => {
  if (part !== 'night') return null
  if (!summary.hasAnyEntry) return null
  if (summary.meals.some((m) => m.type === 'dinner' && m.items.length > 0)) return null
  return {
    id: 'log-dinner', icon: '🌙',
    title: 'Dinner not logged yet',
    body: 'Before you finish your day, logging dinner completes today’s nutrition summary.',
    tone: 'neutral', priority: 78,
  }
}

const RULES: Rule[] = [
  nothingLoggedYet, workoutDone, streakPraise, missingBreakfast, missingDinner,
  wellUnderTarget, aboveTarget, lowProtein, comfortableRemaining,
  heavyDinnerWalk, lowActivity, hydration, endOfDaySummary,
]

/** The single most relevant suggestion for right now. */
export function generateDailySuggestion(ctx: SuggestionContext): Suggestion | null {
  return generateSuggestions(ctx)[0] ?? null
}

/** All matching suggestions, best first. */
export function generateSuggestions(ctx: SuggestionContext): Suggestion[] {
  return RULES
    .map((rule) => rule(ctx))
    .filter((s): s is Suggestion => s !== null)
    .sort((a, b) => b.priority - a.priority)
}

export function buildContext(input: {
  summary: DailySummary
  profile: UserProfile
  recentAvgCalories?: number
  recentAvgSteps?: number
  streak?: number
  hour?: number
}): SuggestionContext {
  return {
    summary: input.summary,
    profile: input.profile,
    part: dayPart(input.hour),
    recentAvgCalories: input.recentAvgCalories ?? 0,
    recentAvgSteps: input.recentAvgSteps ?? 0,
    streak: input.streak ?? 0,
  }
}

/** Meal slots with nothing logged, for the dashboard's quick-add prompts. */
export function unloggedMeals(summary: DailySummary): typeof MEAL_ORDER {
  const logged = new Set(summary.meals.filter((m) => m.items.length > 0).map((m) => m.type))
  return MEAL_ORDER.filter((t) => !logged.has(t) && t !== 'drink' && t !== 'dessert')
}
