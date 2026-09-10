/**
 * Application state.
 *
 * The whole dataset is small (a year of logging is well under a megabyte), so
 * it is held in memory and every mutation writes through to `repo`. That keeps
 * reads synchronous for the UI while persistence stays async and swappable.
 */
import { create } from 'zustand'
import type {
  CustomMeal, DailySummary, Exercise, Food, ID, LocalDate, Meal, MealItem, MealType,
  Reminder, StepEntry, UserProfile, WaterEntry, WeightEntry, Workout, WorkoutRoutine,
} from '@/types'
import { repo, uid } from '@/services/repository'
import { foodRepo } from '@/services/foodRepository'
import { exerciseRepo } from '@/services/exerciseRepository'
import { DEFAULT_REMINDERS, applyReminders, sortReminders } from '@/services/notifications'
import { DEFAULT_NOTIFICATION_PREFS } from '@/services/smartNotifications'
import { today as todayFn } from '@/utils/date'
import {
  EMPTY_NUTRIENTS, caloriesFromSteps, calculateRemainingCalories,
  estimateWorkoutCalories, recommendTargets, sumNutrients,
} from '@/utils/calculations'

export interface StoreState {
  status: 'loading' | 'ready' | 'error'
  error: string | null

  profile: UserProfile | null
  meals: Meal[]
  workouts: Workout[]
  weights: WeightEntry[]
  water: WaterEntry[]
  steps: StepEntry[]
  customFoods: Food[]
  customMeals: CustomMeal[]
  routines: WorkoutRoutine[]
  reminders: Reminder[]
  /** Food ids ranked by how often they've been logged. */
  frequentFoodIds: ID[]

  hydrate: () => Promise<void>

  // Profile
  createProfile: (input: OnboardingInput) => Promise<void>
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>
  recalculateTargets: () => Promise<void>

  // Meals
  addMealItems: (date: LocalDate, type: MealType, items: Omit<MealItem, 'id'>[]) => Promise<void>
  updateMealItem: (mealId: ID, item: MealItem) => Promise<void>
  removeMealItem: (mealId: ID, itemId: ID) => Promise<void>
  removeMeal: (mealId: ID) => Promise<void>
  repeatMeal: (sourceMealId: ID, date: LocalDate, type?: MealType) => Promise<void>

  // Custom foods & meals
  addCustomFood: (food: Omit<Food, 'id' | 'custom' | 'createdAt'>) => Promise<Food>
  deleteCustomFood: (id: ID) => Promise<void>
  saveCustomMeal: (name: string, type: MealType, items: Omit<MealItem, 'id'>[]) => Promise<void>
  deleteCustomMeal: (id: ID) => Promise<void>

  // Workouts
  saveWorkout: (w: Workout) => Promise<void>
  deleteWorkout: (id: ID) => Promise<void>
  startWorkout: (date: LocalDate, name: string) => Promise<Workout>
  finishWorkout: (id: ID) => Promise<void>
  saveRoutine: (r: WorkoutRoutine) => Promise<void>
  deleteRoutine: (id: ID) => Promise<void>

  // Body & intake
  logWeight: (date: LocalDate, weightKg: number, note?: string) => Promise<void>
  deleteWeight: (id: ID) => Promise<void>
  addWater: (date: LocalDate, ml: number) => Promise<void>
  removeLastWater: (date: LocalDate) => Promise<void>
  setSteps: (date: LocalDate, steps: number) => Promise<void>

  // Reminders
  updateReminder: (id: ID, patch: Partial<Reminder>) => Promise<void>

  // Data management
  exportData: () => Promise<string>
  importData: (json: string) => Promise<void>
  resetAll: () => Promise<void>
}

export interface OnboardingInput {
  name: string
  age: number
  sex: UserProfile['sex']
  heightCm: number
  weightKg: number
  activityLevel: UserProfile['activityLevel']
  goalType: UserProfile['goal']['type']
  targetWeightKg?: number
}

/** Recompute a workout's duration/burn from its exercises. */
function withDerivedBurn(w: Workout, weightKg: number): Workout {
  const timed = w.exercises.reduce((s, e) => s + (e.durationMin ?? 0), 0)
  // Session duration is whichever is larger: what the user set, or the sum of
  // the timed blocks (so adding a 40-min run can't leave a 10-min session).
  const durationMin = Math.max(w.durationMin, timed)
  return {
    ...w,
    durationMin,
    caloriesBurned: estimateWorkoutCalories(
      w.exercises, durationMin, weightKg, (id) => exerciseRepo.get(id),
    ),
  }
}

function rankFrequentFoods(meals: Meal[]): ID[] {
  const counts = new Map<ID, number>()
  for (const m of meals) {
    for (const i of m.items) counts.set(i.foodId, (counts.get(i.foodId) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([id]) => id)
}

/**
 * In-flight hydrate, shared by concurrent callers.
 *
 * React StrictMode invokes mount effects twice in development, and
 * `resetAll`/`importData` also re-hydrate. Without this guard two runs can
 * both observe an empty reminder store and each seed a default set, leaving
 * duplicates behind.
 */
let hydrating: Promise<void> | null = null

export const useStore = create<StoreState>((set, get) => ({
  status: 'loading',
  error: null,
  profile: null,
  meals: [],
  workouts: [],
  weights: [],
  water: [],
  steps: [],
  customFoods: [],
  customMeals: [],
  routines: [],
  reminders: [],
  frequentFoodIds: [],

  hydrate() {
    if (hydrating) return hydrating
    hydrating = doHydrate(set, get).finally(() => { hydrating = null })
    return hydrating
  },

  // ── Profile ───────────────────────────────────────────────────────────────

  async createProfile(input) {
    const { calories, macros } = recommendTargets({
      weightKg: input.weightKg, heightCm: input.heightCm, age: input.age,
      sex: input.sex, activityLevel: input.activityLevel, goal: input.goalType,
    })
    const now = Date.now()
    const profile: UserProfile = {
      id: 'current',
      name: input.name.trim() || 'You',
      age: input.age,
      sex: input.sex,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      activityLevel: input.activityLevel,
      goal: {
        type: input.goalType,
        targetWeightKg: input.targetWeightKg,
        weeklyRateKg: 0,
      },
      calorieTarget: calories,
      calorieTargetIsCustom: false,
      macroTargets: macros,
      waterTargetMl: 2500,
      stepTarget: 8000,
      units: { weight: 'kg', height: 'cm' },
      theme: 'system',
      notifications: { ...DEFAULT_NOTIFICATION_PREFS },
      createdAt: now,
      onboardedAt: now,
    }
    await repo.saveProfile(profile)
    set({ profile })
    // Seed the weight history so charts have a starting point from day one.
    await get().logWeight(todayFn(), input.weightKg)
  },

  async updateProfile(patch) {
    const current = get().profile
    if (!current) return
    const next = { ...current, ...patch }
    await repo.saveProfile(next)
    set({ profile: next })
  },

  async recalculateTargets() {
    const p = get().profile
    if (!p) return
    const { calories, macros } = recommendTargets({
      weightKg: p.weightKg, heightCm: p.heightCm, age: p.age, sex: p.sex,
      activityLevel: p.activityLevel, goal: p.goal.type,
      weeklyRateKg: p.goal.weeklyRateKg || undefined,
    })
    // A hand-edited calorie target is left alone; macros still refresh.
    await get().updateProfile({
      calorieTarget: p.calorieTargetIsCustom ? p.calorieTarget : calories,
      macroTargets: macros,
    })
  },

  // ── Meals ─────────────────────────────────────────────────────────────────

  async addMealItems(date, type, items) {
    if (items.length === 0) return
    const meals = get().meals
    const existing = meals.find((m) => m.date === date && m.type === type)
    const withIds: MealItem[] = items.map((i) => ({ ...i, id: uid('mi-') }))

    const meal: Meal = existing
      ? { ...existing, items: [...existing.items, ...withIds] }
      : { id: uid('meal-'), date, type, items: withIds, loggedAt: Date.now() }

    await repo.saveMeal(meal)
    const next = existing
      ? meals.map((m) => (m.id === meal.id ? meal : m))
      : [...meals, meal]
    set({ meals: next, frequentFoodIds: rankFrequentFoods(next) })
  },

  async updateMealItem(mealId, item) {
    const meals = get().meals
    const meal = meals.find((m) => m.id === mealId)
    if (!meal) return
    const next = { ...meal, items: meal.items.map((i) => (i.id === item.id ? item : i)) }
    await repo.saveMeal(next)
    set({ meals: meals.map((m) => (m.id === mealId ? next : m)) })
  },

  async removeMealItem(mealId, itemId) {
    const meals = get().meals
    const meal = meals.find((m) => m.id === mealId)
    if (!meal) return
    const items = meal.items.filter((i) => i.id !== itemId)
    // Drop the meal entirely once its last item is gone.
    if (items.length === 0) {
      await repo.deleteMeal(mealId)
      set({ meals: meals.filter((m) => m.id !== mealId) })
      return
    }
    const next = { ...meal, items }
    await repo.saveMeal(next)
    set({ meals: meals.map((m) => (m.id === mealId ? next : m)) })
  },

  async removeMeal(mealId) {
    await repo.deleteMeal(mealId)
    set({ meals: get().meals.filter((m) => m.id !== mealId) })
  },

  async repeatMeal(sourceMealId, date, type) {
    const source = get().meals.find((m) => m.id === sourceMealId)
    if (!source) return
    const items = source.items.map(({ id: _id, ...rest }) => rest)
    await get().addMealItems(date, type ?? source.type, items)
  },

  // ── Custom foods & meals ──────────────────────────────────────────────────

  async addCustomFood(input) {
    const food: Food = { ...input, id: uid('food-'), custom: true, createdAt: Date.now() }
    await repo.saveCustomFood(food)
    const customFoods = [...get().customFoods, food]
    foodRepo.setCustomFoods(customFoods)
    set({ customFoods })
    return food
  },

  async deleteCustomFood(id) {
    await repo.deleteCustomFood(id)
    const customFoods = get().customFoods.filter((f) => f.id !== id)
    foodRepo.setCustomFoods(customFoods)
    set({ customFoods })
  },

  async saveCustomMeal(name, type, items) {
    const meal: CustomMeal = {
      id: uid('cm-'), name: name.trim(), defaultType: type,
      items, createdAt: Date.now(),
    }
    await repo.saveCustomMeal(meal)
    set({ customMeals: [...get().customMeals, meal] })
  },

  async deleteCustomMeal(id) {
    await repo.deleteCustomMeal(id)
    set({ customMeals: get().customMeals.filter((m) => m.id !== id) })
  },

  // ── Workouts ──────────────────────────────────────────────────────────────

  async saveWorkout(w) {
    const weightKg = get().profile?.weightKg ?? 70
    const next = withDerivedBurn(w, weightKg)
    await repo.saveWorkout(next)
    const workouts = get().workouts
    set({
      workouts: workouts.some((x) => x.id === next.id)
        ? workouts.map((x) => (x.id === next.id ? next : x))
        : [...workouts, next],
    })
  },

  async deleteWorkout(id) {
    await repo.deleteWorkout(id)
    set({ workouts: get().workouts.filter((w) => w.id !== id) })
  },

  async startWorkout(date, name) {
    const w: Workout = {
      id: uid('w-'), date, name, exercises: [], durationMin: 0,
      caloriesBurned: 0, inProgress: true, startedAt: Date.now(),
    }
    await repo.saveWorkout(w)
    set({ workouts: [...get().workouts, w] })
    return w
  },

  async finishWorkout(id) {
    const w = get().workouts.find((x) => x.id === id)
    if (!w) return
    // Fall back to elapsed wall-clock time when the user never set a duration.
    const elapsed = Math.max(1, Math.round((Date.now() - w.startedAt) / 60000))
    await get().saveWorkout({
      ...w,
      durationMin: w.durationMin > 0 ? w.durationMin : elapsed,
      inProgress: false,
      completedAt: Date.now(),
    })
  },

  async saveRoutine(r) {
    await repo.saveRoutine(r)
    const routines = get().routines
    set({
      routines: routines.some((x) => x.id === r.id)
        ? routines.map((x) => (x.id === r.id ? r : x))
        : [...routines, r],
    })
  },

  async deleteRoutine(id) {
    await repo.deleteRoutine(id)
    set({ routines: get().routines.filter((r) => r.id !== id) })
  },

  // ── Body & intake ─────────────────────────────────────────────────────────

  async logWeight(date, weightKg, note) {
    const weights = get().weights
    const existing = weights.find((w) => w.date === date)
    const entry: WeightEntry = {
      id: existing?.id ?? uid('wt-'), date, weightKg, note, loggedAt: Date.now(),
    }
    await repo.saveWeight(entry)
    const next = existing
      ? weights.map((w) => (w.id === entry.id ? entry : w))
      : [...weights, entry]
    set({ weights: next })

    // Keep the profile's current weight aligned with the newest entry.
    const latest = [...next].sort((a, b) => b.date.localeCompare(a.date))[0]
    if (latest && get().profile && get().profile!.weightKg !== latest.weightKg) {
      await get().updateProfile({ weightKg: latest.weightKg })
    }
  },

  async deleteWeight(id) {
    await repo.deleteWeight(id)
    set({ weights: get().weights.filter((w) => w.id !== id) })
  },

  async addWater(date, ml) {
    const entry: WaterEntry = { id: uid('wa-'), date, ml, loggedAt: Date.now() }
    await repo.saveWater(entry)
    set({ water: [...get().water, entry] })
  },

  async removeLastWater(date) {
    const forDay = get().water.filter((w) => w.date === date)
    const last = forDay[forDay.length - 1]
    if (!last) return
    await repo.deleteWater(last.id)
    set({ water: get().water.filter((w) => w.id !== last.id) })
  },

  async setSteps(date, steps) {
    const entry: StepEntry = { date, steps: Math.max(0, Math.round(steps)) }
    await repo.saveSteps(entry)
    const rest = get().steps.filter((s) => s.date !== date)
    set({ steps: [...rest, entry] })
  },

  // ── Reminders ─────────────────────────────────────────────────────────────

  async updateReminder(id, patch) {
    const reminders = sortReminders(
      get().reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    )
    await repo.saveReminders(reminders)
    set({ reminders })
    void applyReminders(reminders)
  },

  // ── Data management ───────────────────────────────────────────────────────

  async exportData() {
    const s = get()
    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: s.profile,
      meals: s.meals,
      workouts: s.workouts,
      weights: s.weights,
      water: s.water,
      steps: s.steps,
      customFoods: s.customFoods,
      customMeals: s.customMeals,
      routines: s.routines,
      reminders: s.reminders,
    }, null, 2)
  },

  async importData(json) {
    const data = JSON.parse(json) as Partial<{
      profile: UserProfile; meals: Meal[]; workouts: Workout[]; weights: WeightEntry[]
      water: WaterEntry[]; steps: StepEntry[]; customFoods: Food[]
      customMeals: CustomMeal[]; routines: WorkoutRoutine[]; reminders: Reminder[]
    }>
    if (!data || typeof data !== 'object') throw new Error('That file is not a FitTrack export.')

    await repo.clearAll()
    if (data.profile) await repo.saveProfile(data.profile)
    for (const m of data.meals ?? []) await repo.saveMeal(m)
    for (const w of data.workouts ?? []) await repo.saveWorkout(w)
    for (const w of data.weights ?? []) await repo.saveWeight(w)
    for (const w of data.water ?? []) await repo.saveWater(w)
    for (const s of data.steps ?? []) await repo.saveSteps(s)
    for (const f of data.customFoods ?? []) await repo.saveCustomFood(f)
    for (const m of data.customMeals ?? []) await repo.saveCustomMeal(m)
    for (const r of data.routines ?? []) await repo.saveRoutine(r)
    if (data.reminders?.length) await repo.saveReminders(data.reminders)

    await get().hydrate()
  },

  async resetAll() {
    await repo.clearAll()
    set({
      profile: null, meals: [], workouts: [], weights: [], water: [], steps: [],
      customFoods: [], customMeals: [], routines: [], reminders: [], frequentFoodIds: [],
    })
    foodRepo.setCustomFoods([])
    await get().hydrate()
  },
}))

// ── Selectors ───────────────────────────────────────────────────────────────

/** Fallback profile so screens can render before onboarding completes. */
export const FALLBACK_PROFILE: UserProfile = {
  id: 'current', name: 'You', age: 30, sex: 'male', heightCm: 170, weightKg: 70,
  activityLevel: 'moderate', goal: { type: 'maintain', weeklyRateKg: 0 },
  calorieTarget: 2000, calorieTargetIsCustom: false,
  macroTargets: { protein: 105, carbs: 225, fat: 62 },
  waterTargetMl: 2500, stepTarget: 8000,
  units: { weight: 'kg', height: 'cm' }, theme: 'system',
  notifications: { ...DEFAULT_NOTIFICATION_PREFS },
  createdAt: Date.now(),
}

export function selectDailySummary(state: StoreState, date: LocalDate): DailySummary {
  const profile = state.profile ?? FALLBACK_PROFILE
  const meals = state.meals.filter((m) => m.date === date)
  const workouts = state.workouts.filter((w) => w.date === date)
  const waterMl = state.water.filter((w) => w.date === date).reduce((s, w) => s + w.ml, 0)
  const steps = state.steps.find((s) => s.date === date)?.steps ?? 0
  const weightKg = state.weights.find((w) => w.date === date)?.weightKg

  const macros = sumNutrients(meals.flatMap((m) => m.items.map((i) => i.nutrients)))
  const caloriesConsumed = Math.round(macros.calories)
  // Completed workouts plus a walking estimate from the day's steps.
  const workoutBurn = workouts
    .filter((w) => !w.inProgress)
    .reduce((s, w) => s + w.caloriesBurned, 0)
  const caloriesBurned = Math.round(workoutBurn + caloriesFromSteps(steps, profile.weightKg))

  return {
    date,
    caloriesConsumed,
    caloriesBurned,
    calorieTarget: profile.calorieTarget,
    remaining: calculateRemainingCalories({
      target: profile.calorieTarget, consumed: caloriesConsumed, burned: caloriesBurned,
    }),
    macros: meals.length ? macros : { ...EMPTY_NUTRIENTS },
    macroTargets: profile.macroTargets,
    waterMl,
    waterTargetMl: profile.waterTargetMl,
    steps,
    stepTarget: profile.stepTarget,
    weightKg,
    meals,
    workouts,
    hasAnyEntry:
      meals.some((m) => m.items.length > 0) || workouts.length > 0 || waterMl > 0 || steps > 0,
  }
}

export function selectSummaries(state: StoreState, dates: LocalDate[]): DailySummary[] {
  return dates.map((d) => selectDailySummary(state, d))
}

/** Best-ever lifts per exercise, derived from completed workouts. */
export function selectPersonalRecords(state: StoreState) {
  const records = new Map<string, {
    exerciseId: string; exerciseName: string; maxWeightKg: number
    reps: number; estimated1RM: number; achievedOn: LocalDate
  }>()

  for (const w of state.workouts) {
    if (w.inProgress) continue
    for (const we of w.exercises) {
      for (const s of we.sets ?? []) {
        if (!s.done || s.weightKg <= 0) continue
        const prev = records.get(we.exerciseId)
        if (!prev || s.weightKg > prev.maxWeightKg) {
          records.set(we.exerciseId, {
            exerciseId: we.exerciseId,
            exerciseName: we.exerciseName,
            maxWeightKg: s.weightKg,
            reps: s.reps,
            estimated1RM: Math.round(s.weightKg * (1 + s.reps / 30) * 10) / 10,
            achievedOn: w.date,
          })
        }
      }
    }
  }
  return [...records.values()].sort((a, b) => b.maxWeightKg - a.maxWeightKg)
}

export function selectExercise(id: ID): Exercise | undefined {
  return exerciseRepo.get(id)
}

/**
 * The actual load. Always reached through `hydrate()`, which serialises
 * concurrent callers so the first-run reminder seeding can't happen twice.
 */
async function doHydrate(
  set: (partial: Partial<StoreState>) => void,
  _get: () => StoreState,
): Promise<void> {
  try {
    const [
      profile, meals, workouts, weights, water, steps,
      customFoods, customMeals, routines, storedReminders,
    ] = await Promise.all([
      repo.getProfile(), repo.getAllMeals(), repo.getAllWorkouts(), repo.getWeights(),
      repo.getAllWater(), repo.getSteps(), repo.getCustomFoods(), repo.getCustomMeals(),
      repo.getRoutines(), repo.getReminders(),
    ])

    // First run: materialise the default reminder set so Settings has rows.
    // Any duplicate kinds from an earlier bad write are collapsed here too.
    let reminders = dedupeReminders(storedReminders)
    if (reminders.length === 0) {
      reminders = DEFAULT_REMINDERS.map((d) => ({ ...d, id: uid('rem-') }))
      await repo.saveReminders(reminders)
    } else if (reminders.length !== storedReminders.length) {
      await repo.saveReminders(reminders)
    }
    reminders = sortReminders(reminders)

    foodRepo.setCustomFoods(customFoods)

    set({
      status: 'ready',
      profile: profile ? withDefaults(profile) : null,
      meals, workouts, weights, water, steps,
      customFoods, customMeals, routines, reminders,
      frequentFoodIds: rankFrequentFoods(meals),
    })

    void applyReminders(reminders)
  } catch (e) {
    set({ status: 'error', error: e instanceof Error ? e.message : 'Failed to load your data' })
  }
}

/**
 * Fill in fields added after a profile was first written, so upgrading the app
 * never leaves an older stored profile missing settings the UI reads.
 */
function withDefaults(p: UserProfile): UserProfile {
  return {
    ...p,
    notifications: { ...DEFAULT_NOTIFICATION_PREFS, ...(p.notifications ?? {}) },
  }
}

/** One reminder per kind; an enabled duplicate wins over a disabled one. */
function dedupeReminders(list: Reminder[]): Reminder[] {
  const byKind = new Map<Reminder['kind'], Reminder>()
  for (const r of list) {
    const existing = byKind.get(r.kind)
    if (!existing || (r.enabled && !existing.enabled)) byKind.set(r.kind, r)
  }
  return [...byKind.values()]
}
