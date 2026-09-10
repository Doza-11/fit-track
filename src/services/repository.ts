/**
 * Data access layer.
 *
 * The rest of the app talks only to `repo` — never to IndexedDB directly. That
 * keeps a future swap to a REST/SQLite backend (or Capacitor Preferences on
 * Android) a change to this one file: implement `Repository` and export a
 * different instance.
 *
 * A localStorage-backed fallback keeps the app usable in private-browsing
 * modes and WebViews where IndexedDB is unavailable.
 */
import type {
  CustomMeal, Food, ID, LocalDate, Meal, Reminder, StepEntry, UserProfile,
  WaterEntry, WeightEntry, Workout, WorkoutRoutine,
} from '@/types'
import { STORES, idb, isIndexedDBAvailable, type StoreName } from './idb'

const PROFILE_KEY = 'current'

export interface Repository {
  getProfile(): Promise<UserProfile | undefined>
  saveProfile(p: UserProfile): Promise<void>

  getMeals(from: LocalDate, to: LocalDate): Promise<Meal[]>
  getAllMeals(): Promise<Meal[]>
  saveMeal(m: Meal): Promise<void>
  deleteMeal(id: ID): Promise<void>

  getWorkouts(from: LocalDate, to: LocalDate): Promise<Workout[]>
  getAllWorkouts(): Promise<Workout[]>
  saveWorkout(w: Workout): Promise<void>
  deleteWorkout(id: ID): Promise<void>

  getWeights(): Promise<WeightEntry[]>
  saveWeight(w: WeightEntry): Promise<void>
  deleteWeight(id: ID): Promise<void>

  getWater(from: LocalDate, to: LocalDate): Promise<WaterEntry[]>
  getAllWater(): Promise<WaterEntry[]>
  saveWater(w: WaterEntry): Promise<void>
  deleteWater(id: ID): Promise<void>

  getSteps(): Promise<StepEntry[]>
  saveSteps(s: StepEntry): Promise<void>

  getCustomFoods(): Promise<Food[]>
  saveCustomFood(f: Food): Promise<void>
  deleteCustomFood(id: ID): Promise<void>

  getCustomMeals(): Promise<CustomMeal[]>
  saveCustomMeal(m: CustomMeal): Promise<void>
  deleteCustomMeal(id: ID): Promise<void>

  getRoutines(): Promise<WorkoutRoutine[]>
  saveRoutine(r: WorkoutRoutine): Promise<void>
  deleteRoutine(id: ID): Promise<void>

  getReminders(): Promise<Reminder[]>
  saveReminders(list: Reminder[]): Promise<void>

  /** Small key/value bag for things that don't deserve a store. */
  getSetting<T>(key: string): Promise<T | undefined>
  setSetting<T>(key: string, value: T): Promise<void>

  clearAll(): Promise<void>
}

// ── IndexedDB implementation ────────────────────────────────────────────────

class IdbRepository implements Repository {
  async getProfile() {
    return idb.get<UserProfile>(STORES.profile, PROFILE_KEY)
  }
  async saveProfile(p: UserProfile) {
    // The singleton profile always occupies one fixed key.
    await idb.put(STORES.profile, { ...p, id: PROFILE_KEY })
  }

  getMeals(from: LocalDate, to: LocalDate) {
    return idb.getByDateRange<Meal>(STORES.meals, from, to)
  }
  getAllMeals() { return idb.getAll<Meal>(STORES.meals) }
  async saveMeal(m: Meal) { await idb.put(STORES.meals, m) }
  deleteMeal(id: ID) { return idb.delete(STORES.meals, id) }

  getWorkouts(from: LocalDate, to: LocalDate) {
    return idb.getByDateRange<Workout>(STORES.workouts, from, to)
  }
  getAllWorkouts() { return idb.getAll<Workout>(STORES.workouts) }
  async saveWorkout(w: Workout) { await idb.put(STORES.workouts, w) }
  deleteWorkout(id: ID) { return idb.delete(STORES.workouts, id) }

  getWeights() { return idb.getAll<WeightEntry>(STORES.weights) }
  async saveWeight(w: WeightEntry) { await idb.put(STORES.weights, w) }
  deleteWeight(id: ID) { return idb.delete(STORES.weights, id) }

  getWater(from: LocalDate, to: LocalDate) {
    return idb.getByDateRange<WaterEntry>(STORES.water, from, to)
  }
  getAllWater() { return idb.getAll<WaterEntry>(STORES.water) }
  async saveWater(w: WaterEntry) { await idb.put(STORES.water, w) }
  deleteWater(id: ID) { return idb.delete(STORES.water, id) }

  getSteps() { return idb.getAll<StepEntry>(STORES.steps) }
  async saveSteps(s: StepEntry) { await idb.put(STORES.steps, s) }

  getCustomFoods() { return idb.getAll<Food>(STORES.customFoods) }
  async saveCustomFood(f: Food) { await idb.put(STORES.customFoods, f) }
  deleteCustomFood(id: ID) { return idb.delete(STORES.customFoods, id) }

  getCustomMeals() { return idb.getAll<CustomMeal>(STORES.customMeals) }
  async saveCustomMeal(m: CustomMeal) { await idb.put(STORES.customMeals, m) }
  deleteCustomMeal(id: ID) { return idb.delete(STORES.customMeals, id) }

  getRoutines() { return idb.getAll<WorkoutRoutine>(STORES.routines) }
  async saveRoutine(r: WorkoutRoutine) { await idb.put(STORES.routines, r) }
  deleteRoutine(id: ID) { return idb.delete(STORES.routines, id) }

  getReminders() { return idb.getAll<Reminder>(STORES.reminders) }
  async saveReminders(list: Reminder[]) {
    await idb.clear(STORES.reminders)
    await idb.putMany(STORES.reminders, list)
  }

  async getSetting<T>(key: string) {
    const row = await idb.get<{ id: string; value: T }>(STORES.settings, key)
    return row?.value
  }
  async setSetting<T>(key: string, value: T) {
    await idb.put(STORES.settings, { id: key, value })
  }

  clearAll() { return idb.clearAll() }
}

// ── localStorage fallback ───────────────────────────────────────────────────

/**
 * Used when IndexedDB is missing or blocked. Same contract, backed by a JSON
 * blob per store. Fine at this data volume (a year of logs is well under 1 MB).
 */
class LocalStorageRepository implements Repository {
  private prefix = 'fittrack:'

  private read<T>(store: StoreName): T[] {
    try {
      const raw = localStorage.getItem(this.prefix + store)
      return raw ? (JSON.parse(raw) as T[]) : []
    } catch {
      return []
    }
  }
  private write<T>(store: StoreName, rows: T[]): void {
    try {
      localStorage.setItem(this.prefix + store, JSON.stringify(rows))
    } catch {
      // Quota exceeded or storage disabled — the in-memory store still works
      // for this session, so we degrade rather than crash the app.
    }
  }
  private upsert<T extends { id: string }>(store: StoreName, row: T): void {
    const rows = this.read<T>(store)
    const i = rows.findIndex((r) => r.id === row.id)
    if (i >= 0) rows[i] = row
    else rows.push(row)
    this.write(store, rows)
  }
  private remove(store: StoreName, id: string): void {
    this.write(store, this.read<{ id: string }>(store).filter((r) => r.id !== id))
  }
  private inRange<T extends { date: string }>(store: StoreName, from: string, to: string): T[] {
    return this.read<T>(store).filter((r) => r.date >= from && r.date <= to)
  }

  async getProfile() { return this.read<UserProfile>(STORES.profile)[0] }
  async saveProfile(p: UserProfile) { this.write(STORES.profile, [{ ...p, id: PROFILE_KEY }]) }

  async getMeals(f: LocalDate, t: LocalDate) { return this.inRange<Meal>(STORES.meals, f, t) }
  async getAllMeals() { return this.read<Meal>(STORES.meals) }
  async saveMeal(m: Meal) { this.upsert(STORES.meals, m) }
  async deleteMeal(id: ID) { this.remove(STORES.meals, id) }

  async getWorkouts(f: LocalDate, t: LocalDate) { return this.inRange<Workout>(STORES.workouts, f, t) }
  async getAllWorkouts() { return this.read<Workout>(STORES.workouts) }
  async saveWorkout(w: Workout) { this.upsert(STORES.workouts, w) }
  async deleteWorkout(id: ID) { this.remove(STORES.workouts, id) }

  async getWeights() { return this.read<WeightEntry>(STORES.weights) }
  async saveWeight(w: WeightEntry) { this.upsert(STORES.weights, w) }
  async deleteWeight(id: ID) { this.remove(STORES.weights, id) }

  async getWater(f: LocalDate, t: LocalDate) { return this.inRange<WaterEntry>(STORES.water, f, t) }
  async getAllWater() { return this.read<WaterEntry>(STORES.water) }
  async saveWater(w: WaterEntry) { this.upsert(STORES.water, w) }
  async deleteWater(id: ID) { this.remove(STORES.water, id) }

  async getSteps() { return this.read<StepEntry>(STORES.steps) }
  async saveSteps(s: StepEntry) {
    const rows = this.read<StepEntry>(STORES.steps).filter((r) => r.date !== s.date)
    rows.push(s)
    this.write(STORES.steps, rows)
  }

  async getCustomFoods() { return this.read<Food>(STORES.customFoods) }
  async saveCustomFood(f: Food) { this.upsert(STORES.customFoods, f) }
  async deleteCustomFood(id: ID) { this.remove(STORES.customFoods, id) }

  async getCustomMeals() { return this.read<CustomMeal>(STORES.customMeals) }
  async saveCustomMeal(m: CustomMeal) { this.upsert(STORES.customMeals, m) }
  async deleteCustomMeal(id: ID) { this.remove(STORES.customMeals, id) }

  async getRoutines() { return this.read<WorkoutRoutine>(STORES.routines) }
  async saveRoutine(r: WorkoutRoutine) { this.upsert(STORES.routines, r) }
  async deleteRoutine(id: ID) { this.remove(STORES.routines, id) }

  async getReminders() { return this.read<Reminder>(STORES.reminders) }
  async saveReminders(list: Reminder[]) { this.write(STORES.reminders, list) }

  async getSetting<T>(key: string) {
    return this.read<{ id: string; value: T }>(STORES.settings).find((r) => r.id === key)?.value
  }
  async setSetting<T>(key: string, value: T) { this.upsert(STORES.settings, { id: key, value }) }

  async clearAll() {
    for (const s of Object.values(STORES)) {
      try { localStorage.removeItem(this.prefix + s) } catch { /* ignore */ }
    }
  }
}

export const repo: Repository = isIndexedDBAvailable()
  ? new IdbRepository()
  : new LocalStorageRepository()

/** Random id that works without `crypto.randomUUID` in older WebViews. */
export function uid(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}${Date.now().toString(36)}${rand}`
}
