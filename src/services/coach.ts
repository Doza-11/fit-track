/**
 * Personal coach.
 *
 * A fixed set of message templates, each with an explicit trigger, priority,
 * repeat frequency and the messages it must never appear alongside. Numbers in
 * the copy are calculated at runtime from the user's own tracking data; the
 * wording itself never changes.
 *
 * Everything here is pure. `coachRuntime.ts` supplies the state, persists
 * what was shown, and puts messages on screen.
 *
 * Tone rules (enforced by `coach.test.ts` against every reachable message):
 *  - Friendly and non-judgmental; never shame what someone ate.
 *  - Movement is always optional and capped at a gentle 30-minute walk.
 *  - Never praise or encourage eating below the safe intake floor.
 *  - Days with incomplete logging are not judged: deficit and "goal achieved"
 *    messages need a reasonably complete day, activity messages need the user
 *    to actually be tracking activity.
 */
import type {
  DailySummary, LocalDate, MealType, UserProfile, WeightEntry, Workout,
} from '@/types'
import {
  calculateBMR, calculateFiberTarget, calculateTDEE, clamp, kgToLb, minimumCalories, round,
} from '@/utils/calculations'
import { daysBetween } from '@/utils/date'

// ── Types ───────────────────────────────────────────────────────────────────

export type CoachMessageId =
  | 'calorie_over'
  | 'healthy_deficit'
  | 'excessive_deficit'
  | 'reward'
  | 'protein_gap'
  | 'goal_achieved'
  | 'low_activity'
  | 'weekly_progress'
  | 'logging_streak'
  | 'breakfast_early'
  | 'water_behind'
  | 'water_done'
  | 'protein_hit'
  | 'fiber_hit'
  | 'personal_record'
  | 'weight_milestone'
  | 'welcome_back'
  | 'workout_week'

/**
 * What prompted an evaluation.
 * - `meal_logged` / `water_logged` / `weight_logged`: the user just added one.
 * - `workout_finished`: a workout was just completed.
 * - `check`: a time-based look (app opened, returned to, or a periodic tick).
 */
export type CoachEvent =
  | 'meal_logged' | 'water_logged' | 'workout_finished' | 'weight_logged' | 'check'

/** A new best set, found by `findNewRecord`. */
export interface NewRecord {
  exercise: string
  weightKg: number
  reps: number
}

export interface CoachInput {
  event: CoachEvent
  now: Date
  profile: UserProfile
  /** Today, including anything just logged. */
  today: DailySummary
  /** Net remaining calories *before* the food that triggered `meal_logged`. */
  previousRemaining?: number
  /** Meal slot the user just logged into, for `meal_logged`. */
  loggedMealType?: MealType
  /** The previous 7 days (oldest first, today excluded). Missing days are fine. */
  pastWeek: DailySummary[]
  /** The previous 30 days, for streaks and month comparisons. Defaults to `pastWeek`. */
  pastMonth?: DailySummary[]
  /** Protein / water before the entry that triggered the event, to detect crossing a goal. */
  previousProtein?: number
  previousWaterMl?: number
  /** For `workout_finished`: a best set that beats every earlier session. */
  newRecord?: NewRecord
  /** All weight entries, and the latest weight before the one just logged. */
  weights?: WeightEntry[]
  previousWeightKg?: number
  /** Most recent day before today with anything logged. */
  lastActiveDate?: LocalDate
  /** Messages already shown, for frequency limits. */
  history: CoachHistoryEntry[]
}

export interface CoachHistoryEntry {
  id: CoachMessageId
  date: LocalDate
  at: number
}

export interface CoachMessage {
  id: CoachMessageId
  icon: string
  title: string
  body: string
  tone: 'positive' | 'neutral'
  priority: number
}

type Vars = Record<string, string | number>

interface CoachRule {
  id: CoachMessageId
  icon: string
  title: string
  /** Static copy; `{{name}}` placeholders are filled from `evaluate`. */
  template: string
  /** Alternative copy for a variant `evaluate` can choose via `_variant`. */
  variants?: Record<string, string>
  tone: CoachMessage['tone']
  /** Higher wins when messages conflict or the per-evaluation cap bites. */
  priority: number
  /** Which events may produce this message. */
  events: CoachEvent[]
  /** Local hours [from, to) in which a `check` may produce it. */
  checkHours?: [number, number]
  /** Minimum days between two showings (1 = at most once a day). */
  cooldownDays: number
  /** Never shown in the same evaluation as these. */
  conflicts: CoachMessageId[]
  /** Variables for the template, or null when the condition doesn't hold. */
  evaluate: (c: CoachInput) => Vars | null
  /** May fire on a day with nothing logged yet (default: no). */
  allowEmptyDay?: boolean
  /**
   * The message describes a moment (a record, a milestone), so the Dashboard
   * keeps its original text instead of recomputing it from live data.
   */
  snapshot?: boolean
}

// ── Shared helpers ──────────────────────────────────────────────────────────

/** Most people walk ~100 steps a minute at an easy pace. */
const STEPS_PER_MINUTE = 100
/** Easy walking is about 3.5 MET (Compendium of Physical Activities). */
const WALK_MET = 3.5
/** No walk suggestion is ever longer than this, whatever the numbers say. */
const MAX_WALK_MIN = 30
const MIN_WALK_MIN = 10

const roundTo5 = (n: number) => Math.round(n / 5) * 5
const walkMinutes = (n: number) => clamp(roundTo5(n), MIN_WALK_MIN, MAX_WALK_MIN)

const mainMealsLogged = (s: DailySummary) =>
  s.meals.filter((m) => m.items.length > 0 && m.type !== 'drink').length

const hasDinner = (s: DailySummary) =>
  s.meals.some((m) => m.type === 'dinner' && m.items.length > 0)

/**
 * Enough of the day is logged to judge it. Without this, someone who simply
 * forgot to log lunch would be told they had a "very low-calorie day".
 */
const dayLooksComplete = (s: DailySummary) => hasDinner(s) && mainMealsLogged(s) >= 2

/** Calories burned in completed workouts (step estimates are already in TDEE). */
const workoutBurn = (s: DailySummary) =>
  s.workouts.filter((w) => !w.inProgress).reduce((t, w) => t + w.caloriesBurned, 0)

/** Estimated maintenance calories from the profile. */
export function maintenanceCalories(p: UserProfile): number {
  return calculateTDEE(calculateBMR(p), p.activityLevel)
}

/**
 * Today's deficit as a fraction of maintenance; positive means eating below it.
 * Workout calories are credited back, matching the rest of the app.
 */
export function deficitRatio(s: DailySummary, p: UserProfile): number {
  const tdee = maintenanceCalories(p)
  if (tdee <= 0) return 0
  return (tdee - (s.caloriesConsumed - workoutBurn(s))) / tdee
}

/** A deficit this deep (or intake below the floor) is no longer "healthy". */
const HEALTHY_DEFICIT_MIN = 0.05
const HEALTHY_DEFICIT_MAX = 0.25
const EXCESSIVE_DEFICIT = 0.3

const isTrackingActivity = (c: CoachInput) =>
  c.today.steps > 0 || c.today.workouts.length > 0
  || c.pastWeek.some((d) => d.steps > 0 || d.workouts.length > 0)

const isTrackingWater = (c: CoachInput) =>
  c.today.waterMl > 0 || c.pastWeek.some((d) => d.waterMl > 0)

const month = (c: CoachInput) => c.pastMonth ?? c.pastWeek

/** Consecutive days with anything logged, ending today. */
export function loggingStreak(c: CoachInput): number {
  if (!c.today.hasAnyEntry) return 0
  const past = month(c)
  let n = 1
  for (let i = past.length - 1; i >= 0 && past[i].hasAnyEntry; i--) n++
  return n
}

const STREAK_MILESTONES = [3, 7, 14, 30]
const isStreakMilestone = (n: number) => STREAK_MILESTONES.includes(n) || (n > 30 && n % 30 === 0)

const completedWorkouts = (days: DailySummary[]) =>
  days.reduce((t, d) => t + d.workouts.filter((w) => !w.inProgress).length, 0)

/** Weight in the user's unit, to one decimal, as text so templates keep the decimal. */
const showWeight = (kg: number, p: UserProfile) =>
  String(p.units.weight === 'lb' ? round(kgToLb(kg), 1) : round(kg, 1))

/**
 * The best improvement this workout made over every earlier session, by
 * heaviest completed set. An exercise done for the first time isn't a record —
 * there is nothing to beat yet.
 */
export function findNewRecord(workout: Workout, earlier: Workout[]): NewRecord | null {
  let best: (NewRecord & { gain: number }) | null = null
  for (const ex of workout.exercises) {
    const top = (ex.sets ?? []).filter((s) => s.done && s.weightKg > 0)
      .sort((a, b) => b.weightKg - a.weightKg || b.reps - a.reps)[0]
    if (!top) continue
    const previous = earlier
      .filter((w) => w.id !== workout.id && !w.inProgress)
      .flatMap((w) => w.exercises.filter((e) => e.exerciseId === ex.exerciseId))
      .flatMap((e) => (e.sets ?? []).filter((s) => s.done && s.weightKg > 0).map((s) => s.weightKg))
    if (previous.length === 0) continue
    const gain = top.weightKg - Math.max(...previous)
    if (gain > 0 && (!best || gain > best.gain)) {
      best = { exercise: ex.exerciseName, weightKg: top.weightKg, reps: top.reps, gain }
    }
  }
  return best ? { exercise: best.exercise, weightKg: best.weightKg, reps: best.reps } : null
}

const withinCalorieTarget = (s: DailySummary) =>
  s.calorieTarget > 0 && s.caloriesConsumed > 0
  && Math.abs(s.caloriesConsumed - s.calorieTarget) <= s.calorieTarget * 0.1

// ── The messages ────────────────────────────────────────────────────────────
//
// Emoji: each message has one icon; positive copy may end with one more.
// Messages about being over, under-eating or inactive carry none in the text,
// so they read as information rather than a reaction.

export const COACH_RULES: CoachRule[] = [
  {
    // 1. Shown the moment a meal tips the day over target, never again that day.
    id: 'calorie_over',
    icon: '📊',
    title: 'A little over today',
    template: 'You\'re {{extra_calories}} kcal above your target. An optional {{walking_minutes}}-minute walk can add some movement!',
    tone: 'neutral',
    priority: 80,
    events: ['meal_logged'],
    cooldownDays: 1,
    conflicts: ['reward', 'healthy_deficit', 'goal_achieved', 'low_activity', 'excessive_deficit'],
    evaluate: ({ today, previousRemaining, profile }) => {
      if (today.remaining >= 0) return null
      // Only the meal that crosses the line triggers it.
      if (previousRemaining !== undefined && previousRemaining < 0) return null
      const extra = Math.abs(today.remaining)
      if (extra < 50) return null
      const kcalPerMin = (WALK_MET * profile.weightKg) / 60
      return {
        extra_calories: Math.round(extra),
        // Sized from the overage, but always an easy 10–30 minutes: a gentle
        // suggestion, never a debt to be paid back.
        walking_minutes: walkMinutes(kcalPerMin > 0 ? extra / kcalPerMin : MAX_WALK_MIN),
      }
    },
  },
  {
    // 2. Night summary, weight-loss goal only; at most every other night.
    id: 'healthy_deficit',
    icon: '🌙',
    title: 'Nice work today',
    template: 'Wonderful job! You\'re maintaining a healthy calorie deficit. Keep it up! 💪',
    tone: 'positive',
    priority: 60,
    events: ['check'],
    checkHours: [20, 24],
    cooldownDays: 2,
    conflicts: ['excessive_deficit', 'calorie_over', 'goal_achieved'],
    evaluate: ({ today, profile }) => {
      if (profile.goal.type !== 'lose' || !dayLooksComplete(today)) return null
      if (today.caloriesConsumed < minimumCalories(profile.sex)) return null
      const r = deficitRatio(today, profile)
      return r >= HEALTHY_DEFICIT_MIN && r <= HEALTHY_DEFICIT_MAX ? {} : null
    },
  },
  {
    // 3. Night summary, any goal; outranks every other calorie message.
    id: 'excessive_deficit',
    icon: '🍽️',
    title: 'A light day on food',
    template: 'You\'ve had a very low-calorie day. Consider eating something nutritious to fuel your body.',
    tone: 'neutral',
    priority: 90,
    events: ['check'],
    checkHours: [20, 24],
    cooldownDays: 1,
    conflicts: ['healthy_deficit', 'reward', 'goal_achieved', 'calorie_over'],
    evaluate: ({ today, profile }) => {
      if (!dayLooksComplete(today)) return null
      const belowFloor = today.caloriesConsumed < minimumCalories(profile.sex)
      return belowFloor || deficitRatio(today, profile) > EXCESSIVE_DEFICIT ? {} : null
    },
  },
  {
    // 4. After dinner is logged or in the evening; no more than every 3 days
    //    so it stays a treat, and only for people who have been logging.
    id: 'reward',
    icon: '🍨',
    title: 'Room for a treat',
    template: 'You\'ve been consistent! You can comfortably enjoy a dessert within your calorie budget today 😋',
    tone: 'positive',
    priority: 50,
    events: ['meal_logged', 'check'],
    checkHours: [19, 23],
    cooldownDays: 3,
    conflicts: ['calorie_over', 'excessive_deficit', 'protein_gap', 'goal_achieved'],
    evaluate: ({ event, today, loggedMealType, pastWeek }) => {
      if (event === 'meal_logged' && loggedMealType !== 'dinner') return null
      if (!hasDinner(today)) return null
      const room = today.remaining
      // Enough for a dessert, but not so much that the day is under-fuelled.
      if (room < 250 || room > today.calorieTarget * 0.35) return null
      const loggedDays = pastWeek.filter((d) => d.caloriesConsumed > 0).length
      return loggedDays >= 4 ? {} : null
    },
  },
  {
    // 5. After logging, once a day, only when protein is well behind the
    //    pace expected for the time of day.
    id: 'protein_gap',
    icon: '🥚',
    title: 'Protein check',
    template: 'You\'re {{remaining_protein}}g away from your protein goal. Add some protein-rich food like dal, paneer, eggs or chicken!',
    tone: 'neutral',
    priority: 65,
    events: ['meal_logged'],
    cooldownDays: 1,
    conflicts: ['reward', 'protein_hit'],
    evaluate: ({ today, now }) => {
      const target = today.macroTargets.protein
      if (target <= 0) return null
      const hour = now.getHours()
      if (hour < 12) return null
      const expected = hour < 16 ? 0.35 : hour < 20 ? 0.55 : 0.75
      const eaten = today.macros.protein
      const remaining = Math.round(target - eaten)
      if (eaten / target >= expected || remaining < 20) return null
      return { remaining_protein: remaining }
    },
  },
  {
    // 6. After dinner is logged or at night, when the day's goals are met.
    id: 'goal_achieved',
    icon: '🏆',
    title: 'Goal achieved',
    template: 'You crushed today\'s goal! Another step towards your dream physique 💪',
    tone: 'positive',
    priority: 75,
    events: ['meal_logged', 'check'],
    checkHours: [20, 24],
    cooldownDays: 1,
    conflicts: ['calorie_over', 'excessive_deficit', 'healthy_deficit', 'reward', 'protein_hit', 'fiber_hit'],
    evaluate: (c) => {
      const { event, today, loggedMealType } = c
      if (event === 'meal_logged' && loggedMealType !== 'dinner') return null
      if (!dayLooksComplete(today) || !withinCalorieTarget(today)) return null
      const p = today.macroTargets.protein
      if (p > 0 && today.macros.protein < p * 0.9) return null
      // Activity counts only for people who track it.
      if (isTrackingActivity(c)) {
        const moved = today.workouts.some((w) => !w.inProgress)
          || (today.stepTarget > 0 && today.steps >= today.stepTarget)
        if (!moved) return null
      }
      return {}
    },
  },
  {
    // 7. Evening check, once a day, only for people who log activity.
    id: 'low_activity',
    icon: '🚶',
    title: 'Time to move',
    template: 'Time to get moving! A {{suggested_minutes}}-minute walk could help you reach your activity goal.',
    tone: 'neutral',
    priority: 45,
    events: ['check'],
    checkHours: [17, 21],
    cooldownDays: 1,
    conflicts: ['calorie_over'],
    evaluate: (c) => {
      const { today } = c
      if (today.workouts.length > 0 || today.stepTarget <= 0) return null
      if (!isTrackingActivity(c)) return null
      if (today.steps >= today.stepTarget * 0.5) return null
      const minutes = (today.stepTarget - today.steps) / STEPS_PER_MINUTE
      return { suggested_minutes: walkMinutes(minutes) }
    },
  },
  {
    // 8. Sunday evening, once a week, from the whole week's data.
    id: 'weekly_progress',
    icon: '📅',
    title: 'Your week',
    template: 'Amazing consistency! 🌟 You\'ve achieved your calorie target {{days}} out of 7 days this week.',
    variants: {
      building: 'You hit your calorie target {{days}} out of 7 days this week. Every day you log builds the habit — next week is a fresh start.',
      starting: 'You logged {{logged_days}} days this week — that\'s the foundation. Next week, try landing close to your calorie target on a couple of them.',
    },
    tone: 'positive',
    priority: 70,
    events: ['check'],
    checkHours: [18, 24],
    cooldownDays: 7,
    conflicts: [],
    evaluate: ({ now, today, pastWeek }) => {
      if (now.getDay() !== 0) return null
      const week = [...pastWeek.slice(-6), today]
      const logged = week.filter((d) => d.caloriesConsumed > 0)
      // Too little data to say anything fair about the week.
      if (logged.length < 3) return null
      const days = week.filter(withinCalorieTarget).length
      const vars: Vars = days >= 4 ? { days }
        : days > 0 ? { days, _variant: 'building' }
        // "0 out of 7" reads as a failure; talk about the logging instead.
        : { logged_days: logged.length, _variant: 'starting' }
      return vars
    },
  },
  {
    // 9. After logging, on streak milestones only (3, 7, 14, 30, then every 30).
    id: 'logging_streak',
    icon: '🔥',
    title: 'On a roll',
    template: '{{streak}} days logged in a row! Consistency is your superpower ⚡',
    tone: 'positive',
    priority: 40,
    events: ['meal_logged'],
    cooldownDays: 1,
    conflicts: [],
    snapshot: true,
    evaluate: (c) => {
      const streak = loggingStreak(c)
      return isStreakMilestone(streak) ? { streak } : null
    },
  },
  {
    // 10. Breakfast logged before 10am; at most once a week so it stays special.
    id: 'breakfast_early',
    icon: '🍳',
    title: 'Great start',
    template: 'Great start! Logging breakfast early makes the rest of the day easier to plan ☀️',
    tone: 'positive',
    priority: 30,
    events: ['meal_logged'],
    cooldownDays: 7,
    conflicts: [],
    snapshot: true,
    evaluate: ({ loggedMealType, now }) =>
      loggedMealType === 'breakfast' && now.getHours() < 10 ? {} : null,
  },
  {
    // 11. Afternoon water check, once a day, only for people who log water.
    id: 'water_behind',
    icon: '💧',
    title: 'Water check',
    template: 'You\'re at {{water_l}}L of {{target_l}}L. A glass of water now keeps you on track.',
    tone: 'neutral',
    priority: 35,
    events: ['check'],
    checkHours: [14, 19],
    cooldownDays: 1,
    conflicts: ['water_done'],
    evaluate: (c) => {
      const { today, now } = c
      const target = today.waterTargetMl
      if (target <= 0 || !isTrackingWater(c)) return null
      const pace = now.getHours() < 17 ? 0.35 : 0.55
      if (today.waterMl >= target * pace) return null
      return { water_l: (today.waterMl / 1000).toFixed(1), target_l: (target / 1000).toFixed(1) }
    },
  },
  {
    // 12. The water entry that reaches the daily target.
    id: 'water_done',
    icon: '✅',
    title: 'Well hydrated',
    template: 'Hydration goal done 💧 — nice work!',
    tone: 'positive',
    priority: 42,
    events: ['water_logged'],
    cooldownDays: 1,
    conflicts: ['water_behind'],
    evaluate: ({ today, previousWaterMl }) => {
      const target = today.waterTargetMl
      if (target <= 0 || today.waterMl < target) return null
      return previousWaterMl === undefined || previousWaterMl < target ? {} : null
    },
  },
  {
    // 13. The meal that reaches the protein target.
    id: 'protein_hit',
    icon: '🎯',
    title: 'Protein goal reached',
    template: 'Protein goal reached: {{protein}}g today. Your muscles thank you 💪',
    tone: 'positive',
    priority: 58,
    events: ['meal_logged'],
    cooldownDays: 1,
    conflicts: ['protein_gap', 'goal_achieved'],
    evaluate: ({ today, previousProtein }) => {
      const target = today.macroTargets.protein
      if (target <= 0 || today.macros.protein < target) return null
      if (previousProtein !== undefined && previousProtein >= target) return null
      return { protein: today.macros.protein }
    },
  },
  {
    // 14. Night check, at most every 3 days.
    id: 'fiber_hit',
    icon: '🥦',
    title: 'Fiber goal met',
    template: '{{fiber}}g of fiber today — great for steady energy!',
    tone: 'positive',
    priority: 35,
    events: ['check'],
    checkHours: [20, 24],
    cooldownDays: 3,
    conflicts: ['goal_achieved'],
    evaluate: ({ today }) => {
      const target = calculateFiberTarget(today.calorieTarget)
      return today.macros.fiber >= target ? { fiber: today.macros.fiber } : null
    },
  },
  {
    // 15. Right after finishing a workout that beat an earlier best set.
    id: 'personal_record',
    icon: '🏆',
    title: 'New personal record',
    template: 'New personal record on {{exercise}}: {{weight}} {{unit}} × {{reps}}! 🎉',
    tone: 'positive',
    priority: 85,
    events: ['workout_finished'],
    // A record is a one-off event, so every one is worth celebrating.
    cooldownDays: 0,
    conflicts: [],
    snapshot: true,
    evaluate: ({ newRecord, profile }) => newRecord
      ? {
        exercise: newRecord.exercise,
        weight: showWeight(newRecord.weightKg, profile),
        unit: profile.units.weight,
        reps: newRecord.reps,
      }
      : null,
  },
  {
    // 16. The weigh-in that passes each whole kilogram towards the goal.
    id: 'weight_milestone',
    icon: '⚖️',
    title: 'Milestone reached',
    template: 'You\'re down {{amount}} {{unit}} since you started — steady progress! 🎉',
    variants: {
      up: 'You\'re up {{amount}} {{unit}} since you started — steady progress! 🎉',
    },
    tone: 'positive',
    priority: 72,
    events: ['weight_logged'],
    cooldownDays: 0,
    conflicts: [],
    allowEmptyDay: true,
    snapshot: true,
    evaluate: ({ profile, weights, previousWeightKg }) => {
      const goal = profile.goal.type
      if (goal === 'maintain' || !weights || weights.length < 2 || previousWeightKg === undefined) return null
      const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date) || a.loggedAt - b.loggedAt)
      const start = sorted[0].weightKg
      const current = sorted[sorted.length - 1].weightKg
      const sign = goal === 'lose' ? 1 : -1
      const now = Math.floor((start - current) * sign)
      const before = Math.floor((start - previousWeightKg) * sign)
      if (now < 1 || now <= before) return null
      const vars: Vars = { amount: showWeight(now, profile), unit: profile.units.weight }
      if (goal !== 'lose') vars._variant = 'up'
      return vars
    },
  },
  {
    // 17. First open after 3+ quiet days, before anything is logged.
    id: 'welcome_back',
    icon: '👋',
    title: 'Welcome back',
    template: 'Welcome back! Every fresh start counts — log one meal to get going.',
    tone: 'positive',
    priority: 95,
    events: ['check'],
    cooldownDays: 3,
    conflicts: [],
    allowEmptyDay: true,
    evaluate: ({ today, lastActiveDate }) => {
      // A brand-new user has nothing to come back to.
      if (today.hasAnyEntry || !lastActiveDate) return null
      return daysBetween(lastActiveDate, today.date) >= 3 ? {} : null
    },
  },
  {
    // 18. After a workout, when this week beats the three before it.
    id: 'workout_week',
    icon: '🏋️',
    title: 'Best week',
    template: '{{n}} workouts this week — that\'s your best week this month! 🔥',
    tone: 'positive',
    priority: 55,
    events: ['workout_finished'],
    cooldownDays: 7,
    conflicts: [],
    snapshot: true,
    evaluate: (c) => {
      const days = [...month(c), c.today]
      if (days.length < 28) return null
      const week = (i: number) => days.slice(days.length - 7 * (i + 1), days.length - 7 * i)
      const n = completedWorkouts(week(0))
      const earlier = [1, 2, 3].map((i) => completedWorkouts(week(i)))
      // Needs some history to be a "best", and at least two sessions.
      if (n < 2 || earlier.every((e) => e === 0) || n <= Math.max(...earlier)) return null
      return { n }
    },
  },
]

// ── Rendering & selection ───────────────────────────────────────────────────

/** Fill `{{name}}` placeholders. Unknown names are left visible so tests catch them. */
export function fillTemplate(template: string, vars: Vars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (m, k: string) =>
    k in vars ? String(typeof vars[k] === 'number' ? Math.round(vars[k] as number) : vars[k]) : m)
}

/** At most this many messages from one evaluation, so the coach never floods. */
export const MAX_PER_EVALUATION = 2
/** And at most this many across a whole day. */
export const MAX_PER_DAY = 5

function dateOf(now: Date): LocalDate {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function onCooldown(rule: CoachRule, history: CoachHistoryEntry[], date: LocalDate): boolean {
  return history.some((h) => h.id === rule.id && daysBetween(h.date, date) < rule.cooldownDays)
}

/**
 * The messages to show now: matching rules, minus anything on cooldown, then
 * best-first with conflicts removed, capped per evaluation and per day.
 */
export function evaluateCoach(input: CoachInput): CoachMessage[] {
  const date = dateOf(input.now)
  const shownToday = input.history.filter((h) => h.date === date).length
  const budget = Math.min(MAX_PER_EVALUATION, MAX_PER_DAY - shownToday)
  if (budget <= 0) return []

  const hour = input.now.getHours()
  const candidates: Array<{ rule: CoachRule; vars: Vars }> = []
  for (const rule of COACH_RULES) {
    if (!rule.events.includes(input.event)) continue
    // An empty day isn't judged — except by messages meant for one.
    if (!input.today.hasAnyEntry && !rule.allowEmptyDay) continue
    if (input.event === 'check' && rule.checkHours) {
      const [from, to] = rule.checkHours
      if (hour < from || hour >= to) continue
    }
    if (onCooldown(rule, input.history, date)) continue
    const vars = rule.evaluate(input)
    if (vars) candidates.push({ rule, vars })
  }

  // Resolve conflicts among *all* matches first, so a lower-priority message
  // can't slip through just because its higher-priority rival was capped out.
  candidates.sort((a, b) => b.rule.priority - a.rule.priority)
  const kept: typeof candidates = []
  for (const c of candidates) {
    const clashes = kept.some((k) =>
      k.rule.conflicts.includes(c.rule.id) || c.rule.conflicts.includes(k.rule.id))
    if (!clashes) kept.push(c)
  }

  return kept.slice(0, budget).map(({ rule, vars }) => render(rule, vars))
}

/**
 * Re-render an already-shown message against current data, so the Dashboard
 * never shows a stale figure ("92g away" after you've eaten more). Returns
 * null once the message no longer applies — protein reached, for instance.
 * Frequency and time windows are ignored: this updates, it doesn't re-send.
 */
export function refreshCoachMessage(
  id: CoachMessageId, input: Omit<CoachInput, 'event' | 'history'>, original?: CoachMessage,
): CoachMessage | null {
  const rule = COACH_RULES.find((r) => r.id === id)
  if (!rule) return null
  if (rule.snapshot) return original ?? null
  const event: CoachEvent = rule.events.includes('check') ? 'check' : 'meal_logged'
  const vars = rule.evaluate({ ...input, event, history: [], loggedMealType: input.loggedMealType ?? 'dinner' })
  return vars ? render(rule, vars) : null
}

function render(rule: CoachRule, vars: Vars): CoachMessage {
  const variant = typeof vars._variant === 'string' ? rule.variants?.[vars._variant] : undefined
  return {
    id: rule.id,
    icon: rule.icon,
    title: rule.title,
    body: fillTemplate(variant ?? rule.template, vars),
    tone: rule.tone,
    priority: rule.priority,
  }
}

/** Add shown messages to the history, keeping only the last 14 days. */
export function recordShown(
  history: CoachHistoryEntry[], shown: CoachMessage[], now: Date,
): CoachHistoryEntry[] {
  const date = dateOf(now)
  const next = [...history, ...shown.map((m) => ({ id: m.id, date, at: now.getTime() }))]
  return next.filter((h) => daysBetween(h.date, date) < 14)
}
