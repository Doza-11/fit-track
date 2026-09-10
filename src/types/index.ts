/**
 * Domain models for FitTrack.
 *
 * Everything is a plain serialisable object so records can move between
 * IndexedDB today and a REST/SQL backend later without reshaping.
 *
 * Dates: `LocalDate` is a calendar day in the *user's* timezone ("2026-09-09").
 * Timestamps are epoch milliseconds. We never store `Date` instances.
 */

/** ISO calendar day, `YYYY-MM-DD`, in local time. */
export type LocalDate = string
/** Epoch milliseconds. */
export type Timestamp = number
export type ID = string

// ── User & goals ────────────────────────────────────────────────────────────

export type Sex = 'male' | 'female'

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active'

export type GoalType = 'lose' | 'maintain' | 'gain' | 'build_muscle'

export type WeightUnit = 'kg' | 'lb'
export type HeightUnit = 'cm' | 'ft'
export type ThemePref = 'light' | 'dark' | 'system'

export interface MacroTargets {
  protein: number
  carbs: number
  fat: number
}

export interface Goal {
  type: GoalType
  /** Target body weight in kg, if the user set one. */
  targetWeightKg?: number
  /** kg per week; negative for loss. Derived from `type` but user-editable. */
  weeklyRateKg: number
}

/** Delivery policy for state-aware notifications. */
export interface NotificationPrefs {
  /** Master switch for suggestion notifications (separate from fixed reminders). */
  smartSuggestions: boolean
  /** No delivery between these local times; the window may wrap midnight. */
  quietStart: string
  quietEnd: string
  /** Hard cap on suggestion notifications per day, so the app never nags. */
  maxPerDay: number
}

export interface UserProfile {
  id: ID
  name: string
  age: number
  sex: Sex
  heightCm: number
  /** Most recent known weight; kept in sync with the latest WeightEntry. */
  weightKg: number
  activityLevel: ActivityLevel
  goal: Goal
  /** Daily kcal target actually in use (may be user-overridden). */
  calorieTarget: number
  /** True when the user hand-edited the target, so recalcs stop clobbering it. */
  calorieTargetIsCustom: boolean
  macroTargets: MacroTargets
  waterTargetMl: number
  stepTarget: number
  units: { weight: WeightUnit; height: HeightUnit }
  theme: ThemePref
  notifications: NotificationPrefs
  createdAt: Timestamp
  onboardedAt?: Timestamp
}

// ── Food & meals ────────────────────────────────────────────────────────────

export type FoodCategory =
  | 'indian'
  | 'grains'
  | 'protein'
  | 'dairy'
  | 'fruit'
  | 'vegetable'
  | 'snack'
  | 'fastfood'
  | 'dessert'
  | 'beverage'
  | 'condiment'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink' | 'dessert'

/** Nutrition for one *serving* of a food (not per 100 g). */
export interface Nutrients {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
}

export interface ServingSize {
  /** "100 g", "1 roti", "1 cup" */
  label: string
  /** Weight of this serving in grams, used to scale nutrition. */
  grams: number
}

export interface Food {
  id: ID
  name: string
  brand?: string
  category: FoodCategory
  /** Nutrition per 100 g — the single source of truth for scaling. */
  per100g: Nutrients
  /** Offered portions. The first entry is the default. */
  servings: ServingSize[]
  /** Meal slots this food is usually eaten in; used for smarter search ranking. */
  commonMeals?: MealType[]
  /** True for user-created foods, which are editable and deletable. */
  custom?: boolean
  createdAt?: Timestamp
}

/** One logged food, resolved to absolute grams so history is immutable. */
export interface MealItem {
  id: ID
  foodId: ID
  /** Denormalised so history survives the food being edited or deleted. */
  foodName: string
  servingLabel: string
  /** Number of servings, e.g. 1.5 */
  quantity: number
  grams: number
  nutrients: Nutrients
}

export interface Meal {
  id: ID
  date: LocalDate
  type: MealType
  items: MealItem[]
  loggedAt: Timestamp
}

/** A reusable named combination of foods ("My oats bowl"). */
export interface CustomMeal {
  id: ID
  name: string
  defaultType: MealType
  items: Omit<MealItem, 'id'>[]
  createdAt: Timestamp
}

// ── Exercise & workouts ─────────────────────────────────────────────────────

export type ExerciseType = 'strength' | 'cardio' | 'bodyweight' | 'mobility' | 'sport'

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'legs' | 'glutes' | 'core' | 'full_body' | 'cardio'

export type Intensity = 'light' | 'moderate' | 'vigorous'

export interface Exercise {
  id: ID
  name: string
  type: ExerciseType
  muscleGroups: MuscleGroup[]
  /**
   * Metabolic equivalent of task — kcal/kg/hour at moderate effort.
   * Source: Compendium of Physical Activities (approximate).
   */
  met: number
  /** MET overrides per intensity for cardio where effort varies a lot. */
  metByIntensity?: Record<Intensity, number>
  /** Cardio exercises track distance; strength tracks sets/reps/weight. */
  tracksDistance?: boolean
  equipment?: string
  custom?: boolean
}

export interface StrengthSet {
  id: ID
  weightKg: number
  reps: number
  /** Completed sets count toward volume; planned-but-skipped ones don't. */
  done: boolean
}

export interface WorkoutExercise {
  id: ID
  exerciseId: ID
  /** Denormalised for durable history. */
  exerciseName: string
  type: ExerciseType
  /** Strength / bodyweight. */
  sets?: StrengthSet[]
  /** Cardio & everything time-based. */
  durationMin?: number
  distanceKm?: number
  intensity?: Intensity
  notes?: string
}

export interface Workout {
  id: ID
  date: LocalDate
  name: string
  exercises: WorkoutExercise[]
  /** Total session minutes; drives the calorie estimate. */
  durationMin: number
  /** Estimated kcal — always presented to the user as an estimate. */
  caloriesBurned: number
  /** An in-progress session the user hasn't finished yet. */
  inProgress: boolean
  startedAt: Timestamp
  completedAt?: Timestamp
  notes?: string
}

/** Best-ever performance for one exercise, recomputed from workout history. */
export interface PersonalRecord {
  exerciseId: ID
  exerciseName: string
  maxWeightKg?: number
  maxReps?: number
  /** Epley 1-rep-max estimate at the heaviest set. */
  estimated1RM?: number
  bestVolume?: number
  longestDistanceKm?: number
  longestDurationMin?: number
  achievedOn: LocalDate
}

/** A saved template the user can start a workout from. */
export interface WorkoutRoutine {
  id: ID
  name: string
  exercises: Array<{
    exerciseId: ID
    exerciseName: string
    type: ExerciseType
    targetSets?: number
    targetReps?: number
    targetWeightKg?: number
    durationMin?: number
  }>
  createdAt: Timestamp
}

// ── Body & intake logs ──────────────────────────────────────────────────────

export interface WeightEntry {
  id: ID
  date: LocalDate
  weightKg: number
  note?: string
  loggedAt: Timestamp
}

export interface WaterEntry {
  id: ID
  date: LocalDate
  ml: number
  loggedAt: Timestamp
}

export interface StepEntry {
  date: LocalDate
  steps: number
}

// ── Reminders ───────────────────────────────────────────────────────────────

export type ReminderKind =
  | 'breakfast' | 'lunch' | 'snack' | 'dinner'
  | 'workout' | 'water' | 'summary'

/** State-aware notifications, chosen from the day's actual numbers. */
export type SmartNotificationKind =
  | 'low_protein'
  | 'calorie_room'
  | 'under_eating'
  | 'hydration'
  | 'move'
  | 'good_day'
  | 'goal_on_track'

/**
 * A condition re-checked immediately before a notification is shown, so a
 * queued nudge is dropped once the user has already acted on it.
 *
 * Deliberately a plain data descriptor rather than a closure: it can be
 * serialised and handed to a native scheduler in the Capacitor build.
 */
export type NotificationRelevance =
  | { type: 'always' }
  | { type: 'meal_unlogged'; meal: MealType }
  | { type: 'no_workout' }
  | { type: 'water_below'; ml: number }
  | { type: 'protein_below'; grams: number }
  | { type: 'calories_below'; kcal: number }
  | { type: 'steps_below'; steps: number }

export interface Reminder {
  id: ID
  kind: ReminderKind
  label: string
  enabled: boolean
  /** "HH:MM" 24h local time. Ignored when `repeatEveryMin` is set. */
  time: string
  /** For interval reminders such as water every 2 hours. */
  repeatEveryMin?: number
  /** 0 = Sunday … 6 = Saturday. Empty means every day. */
  days: number[]
}

// ── Derived views ───────────────────────────────────────────────────────────

/** Everything needed to render one day. Computed, never persisted. */
export interface DailySummary {
  date: LocalDate
  caloriesConsumed: number
  caloriesBurned: number
  calorieTarget: number
  /** target − consumed + burned */
  remaining: number
  macros: Nutrients
  macroTargets: MacroTargets
  waterMl: number
  waterTargetMl: number
  steps: number
  stepTarget: number
  weightKg?: number
  meals: Meal[]
  workouts: Workout[]
  hasAnyEntry: boolean
}
