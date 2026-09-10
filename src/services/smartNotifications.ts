/**
 * State-aware notifications.
 *
 * Fixed-time reminders ask "have you logged lunch?" regardless of whether you
 * have. These are chosen from the day's actual numbers instead: protein
 * running behind your usual, calories still available, hydration lagging.
 *
 * Two properties matter and both are handled here rather than at delivery:
 *
 *  - **Relevance.** Every notification carries a `NotificationRelevance`
 *    descriptor that is re-checked immediately before display, so a nudge
 *    queued at 15:00 is silently dropped if you logged the meal at 15:30.
 *  - **Restraint.** Quiet hours, a per-day cap and a minimum gap are applied
 *    to the whole plan, so a bad day cannot turn into a stream of alerts.
 *
 * Planning is pure: it takes the day's state and returns what should fire and
 * when. Nothing here touches the Notification API.
 *
 * Tone follows the same rules as `suggestions.ts` — never shame the user for
 * what they ate, never frame movement as making up for food, keep everything
 * optional, and avoid medical claims. `smartNotifications.test.ts` enforces
 * this against every string this module can emit.
 */
import type {
  DailySummary, Food, LocalDate, MealType, NotificationPrefs,
  NotificationRelevance, SmartNotificationKind, UserProfile,
} from '@/types'
import { SEED_FOODS } from '@/data/foods'
import { parseTime } from '@/utils/date'

export interface PlannedNotification {
  id: string
  /** `${date}:${kind}` — fires at most once per day. */
  dedupeKey: string
  at: number
  title: string
  body: string
  /** Higher wins when the daily cap forces a choice. */
  priority: number
  relevance: NotificationRelevance
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  smartSuggestions: true,
  quietStart: '22:00',
  quietEnd: '08:00',
  maxPerDay: 4,
}

/** Minimum spacing between suggestion notifications. */
const MIN_GAP_MIN = 90

/**
 * When each rule evaluates. Times are late enough in the relevant window that
 * the day's data is meaningful, and early enough to still be actionable.
 *
 * They are also spaced at least `MIN_GAP_MIN` apart on purpose. The spacing
 * filter drops the lower-priority of any two notifications that land too close
 * together, so checkpoints bunched 30 minutes apart would mean a rule could
 * never fire alongside its neighbour — the evening protein nudge would be
 * permanently shadowed by the calorie one, for instance.
 */
const CHECKPOINT = {
  hydration: '14:00',
  proteinAfternoon: '15:30',
  move: '17:00',
  treat: '19:00',
  proteinEvening: '20:30',
  goodDay: '20:30',
} as const

// ── Treat suggestions ───────────────────────────────────────────────────────

const TREAT_CATEGORIES = new Set<Food['category']>(['dessert', 'snack', 'fruit', 'dairy'])

/**
 * Is this something a person would actually reach for with calories to spare?
 *
 * Category alone isn't enough: paneer and milk are dairy, but "you have 500
 * kcal left, how about some paneer" is not a suggestion anyone wants. So a
 * treat must also be *eaten* as a snack or dessert, and must not be a
 * main-meal food — which is what excludes paneer, curd and cooking milk while
 * keeping ice cream, fruit, nuts and Greek yogurt.
 */
function isTreat(f: Food): boolean {
  if (!TREAT_CATEGORIES.has(f.category)) return false
  const meals = f.commonMeals ?? []
  if (!meals.includes('snack') && !meals.includes('dessert')) return false
  return !meals.includes('lunch') && !meals.includes('dinner')
}

export interface TreatOption {
  name: string
  serving: string
  kcal: number
  category: Food['category']
}

/**
 * Real foods from the database that fit inside the remaining calories.
 *
 * Options are capped well below the full remainder so acting on one doesn't
 * blow the day's target, and rotated by date so the same three items don't
 * appear every evening.
 */
export function pickTreats(
  remainingKcal: number,
  date: LocalDate = '',
  foods: Food[] = SEED_FOODS,
): TreatOption[] {
  if (remainingKcal < 150) return []
  // Leave headroom: a suggestion should fit comfortably, not exactly.
  const budget = Math.min(remainingKcal * 0.7, remainingKcal - 60)

  const fitting = foods
    .filter(isTreat)
    .map((f) => {
      const s = f.servings[0]
      return {
        name: f.name,
        serving: s.label,
        kcal: Math.round((f.per100g.calories * s.grams) / 100),
        category: f.category,
      }
    })
    .filter((t) => t.kcal >= 60 && t.kcal <= budget)

  if (fitting.length === 0) return []

  // Prefer portions around a third of what's left — substantial enough to be
  // worth suggesting, small enough to stay comfortably inside the target.
  const ideal = remainingKcal * 0.33
  const ranked = [...fitting].sort(
    (a, b) => Math.abs(a.kcal - ideal) - Math.abs(b.kcal - ideal),
  )

  // Rotate the shortlist by the date so suggestions vary day to day while
  // staying deterministic for a given day (and for tests).
  const pool = ranked.slice(0, 12)
  const offset = hashDate(date) % pool.length
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)]

  // One per category, for variety across the three shown.
  const out: TreatOption[] = []
  const seen = new Set<Food['category']>()
  for (const t of rotated) {
    if (seen.has(t.category)) continue
    seen.add(t.category)
    out.push(t)
    if (out.length === 3) break
  }
  return out
}

function hashDate(date: string): number {
  let h = 0
  for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) | 0
  return Math.abs(h)
}

const treatPhrase = (t: TreatOption) => `${t.name.toLowerCase()} (${t.serving}, ~${t.kcal} kcal)`

// ── Relevance ───────────────────────────────────────────────────────────────

/** Re-checked just before display; false means the nudge is dropped. */
export function isStillRelevant(rel: NotificationRelevance, s: DailySummary): boolean {
  switch (rel.type) {
    case 'always':
      return true
    case 'meal_unlogged':
      return !s.meals.some((m) => m.type === rel.meal && m.items.length > 0)
    case 'no_workout':
      return s.workouts.length === 0
    case 'water_below':
      return s.waterMl < rel.ml
    case 'protein_below':
      return s.macros.protein < rel.grams
    case 'calories_below':
      return s.caloriesConsumed < rel.kcal
    case 'steps_below':
      return s.steps < rel.steps
  }
}

// ── Planning ────────────────────────────────────────────────────────────────

export interface SmartPlanInput {
  summary: DailySummary
  profile: UserProfile
  /** Averages over recent logged days, for "lower than usual" comparisons. */
  recentAvgProtein: number
  recentAvgSteps: number
  now: Date
  /** Dedupe keys already delivered today. */
  alreadyFired?: Set<string>
}

type Rule = (i: SmartPlanInput) => Omit<PlannedNotification, 'id' | 'dedupeKey' | 'at'> & {
  kind: SmartNotificationKind
  time: string
} | null

/**
 * Is protein genuinely unusual for this person, not merely short of target?
 *
 * Someone who habitually eats 60g against a 140g target does not need that
 * pointed out every afternoon. So when we have a baseline, today must be low
 * against *both* their target and their own recent average. Without a
 * baseline (a new user) the target is all we have to go on.
 */
function proteinIsUnusuallyLow(
  current: number, target: number, recentAvg: number, targetRatio: number,
): boolean {
  const behindTarget = current / target < targetRatio
  const behindUsual = recentAvg > 0 ? current / recentAvg < 0.6 : true
  return behindTarget && behindUsual
}

/** Protein noticeably below the user's own recent norm, checked mid-afternoon. */
const lowProtein: Rule = ({ summary, recentAvgProtein }) => {
  const target = summary.macroTargets.protein
  if (target <= 0 || !summary.hasAnyEntry) return null
  const current = summary.macros.protein
  if (!proteinIsUnusuallyLow(current, target, recentAvgProtein, 0.45)) return null

  const vsUsual = recentAvgProtein > 0 ? current / recentAvgProtein : 1
  const usualNote = recentAvgProtein > 0 && vsUsual < 0.6
    ? ` That's lower than your recent average of about ${Math.round(recentAvgProtein)}g.`
    : ''

  return {
    kind: 'low_protein',
    time: CHECKPOINT.proteinAfternoon,
    title: '🥚 Protein is running low today',
    body: `You're at about ${Math.round(current)}g of ${target}g.${usualNote} Greek yogurt, eggs, paneer, dal or chicken are easy ways to add some.`,
    priority: 70,
    relevance: { type: 'protein_below', grams: Math.round(target * 0.7) },
  }
}

/** A second, gentler protein check for people who eat most protein at dinner. */
const lowProteinEvening: Rule = ({ summary, recentAvgProtein }) => {
  const target = summary.macroTargets.protein
  if (target <= 0 || !summary.hasAnyEntry) return null
  // Same baseline gate as the afternoon check, so a habitually lower-protein
  // diet doesn't produce a nudge every single evening.
  if (!proteinIsUnusuallyLow(summary.macros.protein, target, recentAvgProtein, 0.7)) return null
  const gap = Math.round(target - summary.macros.protein)
  if (gap < 25) return null
  return {
    kind: 'low_protein',
    time: CHECKPOINT.proteinEvening,
    title: '🥚 About ' + gap + 'g of protein left today',
    body: 'If dinner is still to come, a protein-rich option would close most of the gap. No pressure either way.',
    priority: 62,
    relevance: { type: 'protein_below', grams: Math.round(target * 0.8) },
  }
}

/**
 * Calories still available in the evening.
 *
 * This is the "you have room, here is what fits" case — the point is to make
 * the remainder concrete and to say plainly that a treat is allowed.
 */
const calorieRoom: Rule = ({ summary }) => {
  if (!summary.hasAnyEntry) return null
  const remaining = summary.remaining
  if (remaining < 250) return null
  // A very large remainder is under-eating, handled by its own rule.
  if (remaining > summary.calorieTarget * 0.55) return null

  const treats = pickTreats(remaining, summary.date)
  const options = treats.slice(0, 2).map(treatPhrase).join(' or ')
  const body = options
    ? `If you fancy something, ${options} would fit comfortably. Entirely up to you.`
    : 'If you\'re hungry, a snack or dessert can fit within what\'s left. Entirely up to you.'

  return {
    kind: 'calorie_room',
    time: CHECKPOINT.treat,
    title: `🍨 About ${Math.round(remaining / 50) * 50} kcal left today`,
    body,
    priority: 66,
    relevance: { type: 'calories_below', kcal: summary.calorieTarget - 200 },
  }
}

/** A large shortfall late in the day — worth surfacing, kindly. */
const underEating: Rule = ({ summary, profile }) => {
  if (!summary.hasAnyEntry) return null
  const shortfall = summary.calorieTarget - summary.caloriesConsumed
  if (shortfall <= summary.calorieTarget * 0.55) return null

  const goalNote = profile.goal.type === 'lose'
    ? 'Even on a deficit, eating enough makes the habit easier to keep up.'
    : 'Getting enough food supports the goal you set.'

  const treats = pickTreats(shortfall, summary.date)
  const idea = treats[0] ? ` Something like ${treatPhrase(treats[0])} is an easy start.` : ''

  return {
    kind: 'under_eating',
    time: CHECKPOINT.treat,
    title: `🍽️ About ${Math.round(shortfall / 50) * 50} kcal remaining`,
    body: `${goalNote}${idea}`,
    priority: 74,
    relevance: { type: 'calories_below', kcal: Math.round(summary.calorieTarget * 0.6) },
  }
}

const hydration: Rule = ({ summary }) => {
  const target = summary.waterTargetMl
  if (target <= 0) return null
  const expectedByNow = target * 0.45
  if (summary.waterMl >= expectedByNow) return null
  return {
    kind: 'hydration',
    time: CHECKPOINT.hydration,
    title: '💧 Water is behind your usual',
    body: `You've logged ${(summary.waterMl / 1000).toFixed(1)}L of ${(target / 1000).toFixed(1)}L. A glass now would close most of the gap.`,
    priority: 40,
    relevance: { type: 'water_below', ml: Math.round(expectedByNow) },
  }
}

const move: Rule = ({ summary, recentAvgSteps }) => {
  if (summary.workouts.length > 0) return null
  const usual = recentAvgSteps > 0 ? recentAvgSteps : summary.stepTarget
  if (usual <= 0 || summary.steps > usual * 0.5) return null
  return {
    kind: 'move',
    time: CHECKPOINT.move,
    title: '🚶 A quieter day for movement',
    body: 'A 20–30 minute walk could be a simple way to add some activity, if it fits your day.',
    priority: 45,
    relevance: { type: 'steps_below', steps: Math.round(usual * 0.6) },
  }
}

const goodDay: Rule = ({ summary }) => {
  if (summary.workouts.length === 0 || !summary.hasAnyEntry) return null
  if (Math.abs(summary.remaining) > summary.calorieTarget * 0.15) return null
  return {
    kind: 'good_day',
    time: CHECKPOINT.goodDay,
    title: '🔥 Nicely done today',
    body: 'You\'re close to your calorie target and today\'s workout is logged. Keep the consistency going.',
    priority: 55,
    relevance: { type: 'always' },
  }
}

/**
 * Appreciation for actually following the plan, judged against the user's own
 * goal rather than a generic target.
 *
 * This is the counterpart to the nudges: someone losing weight who lands in a
 * sensible deficit should hear about it, and it should not require a logged
 * workout the way `good_day` does.
 */
const goalOnTrack: Rule = ({ summary, profile }) => {
  if (!summary.hasAnyEntry) return null
  // Needs a reasonably complete day before congratulating anyone.
  if (summary.meals.filter((m) => m.items.length > 0).length < 2) return null

  const target = summary.calorieTarget
  const consumed = summary.caloriesConsumed
  const goal = profile.goal.type
  const ratio = consumed / target

  // "On plan" means something different per goal.
  let earned = false
  let line = ''
  if (goal === 'lose') {
    // Comfortably under target, but not so far under that it's under-eating.
    earned = ratio >= 0.75 && ratio <= 1.0
    line = `You finished the day at about ${Math.round(consumed).toLocaleString()} kcal against a ${target.toLocaleString()} target — a steady deficit, which is exactly the pace you set.`
  } else if (goal === 'gain' || goal === 'build_muscle') {
    const proteinOk = summary.macroTargets.protein <= 0
      || summary.macros.protein >= summary.macroTargets.protein * 0.8
    earned = ratio >= 0.95 && proteinOk
    line = `You hit about ${Math.round(consumed).toLocaleString()} kcal with ${Math.round(summary.macros.protein)}g of protein — a solid day for building.`
  } else {
    earned = Math.abs(consumed - target) <= target * 0.08
    line = `You landed within a hair of your ${target.toLocaleString()} kcal target. That consistency is the whole game.`
  }
  if (!earned) return null

  return {
    kind: 'goal_on_track',
    time: CHECKPOINT.goodDay,
    title: '🎯 On track today',
    body: line,
    priority: 58,
    relevance: { type: 'always' },
  }
}

/**
 * Over the day's target, with activity offered as an option rather than a
 * penalty. The user asked for this nudge explicitly; the wording keeps it a
 * suggestion about feeling good, never a debt to be worked off.
 */
const overTargetMove: Rule = ({ summary, profile }) => {
  if (!summary.hasAnyEntry) return null
  if (summary.remaining >= 0) return null
  const over = Math.abs(summary.remaining)
  if (over < summary.calorieTarget * 0.1) return null
  if (summary.workouts.length > 0) return null

  const goalNote = profile.goal.type === 'lose'
    ? 'One day rarely shifts a weekly average.'
    : 'Days vary, and that is fine.'

  return {
    kind: 'move',
    time: CHECKPOINT.treat,
    title: `📊 About ${Math.round(over / 50) * 50} kcal above today's target`,
    body: `${goalNote} If you feel like moving, an easy 20–30 minute walk is a nice way to end the evening — entirely optional.`,
    priority: 52,
    relevance: { type: 'always' },
  }
}

const RULES: Rule[] = [
  underEating, lowProtein, calorieRoom, lowProteinEvening,
  goodDay, goalOnTrack, move, overTargetMove, hydration,
]

/**
 * Build today's remaining suggestion notifications.
 *
 * Applies, in order: rule evaluation, quiet hours, already-fired dedupe,
 * minimum spacing, and the daily cap (dropping lowest priority first).
 */
export function planSmartNotifications(input: SmartPlanInput): PlannedNotification[] {
  const prefs = input.profile.notifications ?? DEFAULT_NOTIFICATION_PREFS
  if (!prefs.smartSuggestions) return []

  const { summary, now } = input
  const fired = input.alreadyFired ?? new Set<string>()
  const nowMs = now.getTime()

  const candidates: PlannedNotification[] = []
  const usedKinds = new Set<SmartNotificationKind>()

  for (const rule of RULES) {
    const r = rule(input)
    if (!r) continue
    // One notification per kind per day, even if two rules cover it.
    if (usedKinds.has(r.kind)) continue

    const at = atTimeToday(r.time, now)
    if (at <= nowMs) continue
    if (isQuietHour(r.time, prefs.quietStart, prefs.quietEnd)) continue

    const dedupeKey = `${summary.date}:${r.kind}`
    if (fired.has(dedupeKey)) continue

    usedKinds.add(r.kind)
    candidates.push({
      id: `smart-${dedupeKey}`,
      dedupeKey,
      at,
      title: r.title,
      body: r.body,
      priority: r.priority,
      relevance: r.relevance,
    })
  }

  // The cap is a budget for the whole day, so what already went out counts
  // against it — otherwise a re-plan after each delivery would keep topping
  // the queue back up.
  const remainingBudget = prefs.maxPerDay - countFiredToday(fired, summary.date)
  return enforceSpacingAndCap(candidates, remainingBudget)
}

/** How many suggestion notifications have already been delivered today. */
function countFiredToday(fired: Set<string>, date: LocalDate): number {
  let n = 0
  for (const key of fired) if (key.startsWith(`${date}:`)) n++
  return n
}

/**
 * Thin the plan so notifications never bunch up or exceed the daily cap.
 * Lower-priority items give way when two land too close together.
 */
export function enforceSpacingAndCap(
  items: PlannedNotification[], maxPerDay: number,
): PlannedNotification[] {
  const byPriority = [...items].sort((a, b) => b.priority - a.priority || a.at - b.at)
  const kept: PlannedNotification[] = []

  for (const item of byPriority) {
    if (kept.length >= Math.max(0, maxPerDay)) break
    const tooClose = kept.some(
      (k) => Math.abs(k.at - item.at) < MIN_GAP_MIN * 60_000,
    )
    if (tooClose) continue
    kept.push(item)
  }

  return kept.sort((a, b) => a.at - b.at)
}

/** Today at "HH:MM" in local time. */
export function atTimeToday(hhmm: string, base: Date): number {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(base)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

/** True when a time falls inside the quiet window, which may wrap midnight. */
export function isQuietHour(time: string, start: string, end: string): boolean {
  const t = parseTime(time)
  const s = parseTime(start)
  const e = parseTime(end)
  if (s === e) return false
  return s < e ? t >= s && t < e : t >= s || t < e
}

// ── Dynamic copy for fixed-time reminders ───────────────────────────────────

const MEAL_FOR_KIND: Partial<Record<string, MealType>> = {
  breakfast: 'breakfast', lunch: 'lunch', snack: 'snack', dinner: 'dinner',
}

/** The meal slot a reminder kind refers to, if any. */
export function mealForReminder(kind: string): MealType | undefined {
  return MEAL_FOR_KIND[kind]
}

/**
 * Relevance gate for a fixed-time reminder, so an already-satisfied reminder
 * stays silent rather than asking about something the user has done.
 */
export function reminderRelevance(kind: string, summary: DailySummary): NotificationRelevance {
  const meal = mealForReminder(kind)
  if (meal) return { type: 'meal_unlogged', meal }
  if (kind === 'workout') return { type: 'no_workout' }
  if (kind === 'water') return { type: 'water_below', ml: summary.waterTargetMl }
  return { type: 'always' }
}

/** Reminder copy filled in with the day's actual numbers where it helps. */
export function reminderBody(
  kind: string, fallback: string, summary: DailySummary,
): string {
  if (kind === 'summary') {
    const workout = summary.workouts.length > 0 ? 'logged' : 'not logged'
    return `${Math.round(summary.caloriesConsumed).toLocaleString()} of ${summary.calorieTarget.toLocaleString()} kcal · protein ${Math.round(summary.macros.protein)}g · steps ${summary.steps.toLocaleString()} · workout ${workout}.`
  }
  if (kind === 'water') {
    const left = Math.max(0, summary.waterTargetMl - summary.waterMl)
    if (left > 0) return `About ${(left / 1000).toFixed(1)}L left to reach today's target.`
  }
  return fallback
}
