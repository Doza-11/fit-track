/**
 * Runs the coach against live app state.
 *
 * Two kinds of trigger:
 *  - **After logging**: a store subscription notices when food, water or a
 *    weight is added, or a workout is finished, and evaluates the matching
 *    event with the numbers from just before it — so "this meal tipped you
 *    over" or "this glass reached your goal" can be detected.
 *  - **Time-based**: evaluated when the app starts, when it comes back to the
 *    foreground, and every 10 minutes while open. Each rule's own hours window
 *    (evening, night, Sunday) decides whether it applies.
 *
 * What was shown is kept in localStorage: a 14-day history for frequency
 * limits, and today's messages for the Dashboard card. Nothing leaves the
 * device.
 */
import type { MealType } from '@/types'
import { useStore, selectDailySummary } from '@/store/useStore'
import {
  evaluateCoach, findNewRecord, recordShown, refreshCoachMessage,
  type CoachEvent, type CoachHistoryEntry, type CoachInput, type CoachMessage,
} from './coach'
import { lastNDays, today } from '@/utils/date'

const HISTORY_KEY = 'fittrack:coach-history'
const FEED_KEY = 'fittrack:coach-today'
const CHECK_INTERVAL_MS = 10 * 60_000

export interface CoachFeed {
  date: string
  messages: Array<CoachMessage & { at: number }>
  dismissed: string[]
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable: limits fall back to this session only.
  }
}

export function loadFeed(date = today()): CoachFeed {
  const feed = read<CoachFeed | null>(FEED_KEY, null)
  return feed && feed.date === date ? feed : { date, messages: [], dismissed: [] }
}

// ── Listeners (the banner and the Dashboard card) ──────────────────────────

type Listener = (fresh: CoachMessage[], feed: CoachFeed) => void
const listeners = new Set<Listener>()

export function onCoachMessages(l: Listener): () => void {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

export function dismissCoachMessage(id: string): void {
  const feed = loadFeed()
  if (!feed.dismissed.includes(id)) feed.dismissed.push(id)
  write(FEED_KEY, feed)
  listeners.forEach((l) => l([], feed))
}

// ── Evaluation ──────────────────────────────────────────────────────────────

type StoreState = ReturnType<typeof useStore.getState>
type EventExtras = Partial<Pick<CoachInput,
  'previousRemaining' | 'loggedMealType' | 'previousProtein' | 'previousWaterMl'
  | 'previousWeightKg' | 'newRecord'>>

/** Most recent day before `date` with anything at all logged. */
function lastActiveBefore(state: StoreState, date: string): string | undefined {
  const dates = [
    ...state.meals.filter((m) => m.items.length > 0).map((m) => m.date),
    ...state.workouts.map((w) => w.date),
    ...state.water.map((w) => w.date),
    ...state.steps.filter((s) => s.steps > 0).map((s) => s.date),
    ...state.weights.map((w) => w.date),
  ].filter((d) => d < date)
  return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : undefined
}

/** Everything the rules read, minus the event and history. */
function baseInput(state: StoreState, now: Date): Omit<CoachInput, 'event' | 'history'> {
  const date = today()
  const pastMonth = lastNDays(31, date).slice(0, -1).map((d) => selectDailySummary(state, d))
  return {
    now,
    profile: state.profile!,
    today: selectDailySummary(state, date),
    pastWeek: pastMonth.slice(-7),
    pastMonth,
    weights: state.weights,
    lastActiveDate: lastActiveBefore(state, date),
  }
}

export function runCoach(
  event: CoachEvent,
  extra: EventExtras = {},
  now: Date = new Date(),
): CoachMessage[] {
  const state = useStore.getState()
  if (state.status !== 'ready' || !state.profile) return []

  const date = today()
  const history = read<CoachHistoryEntry[]>(HISTORY_KEY, [])
  const messages = evaluateCoach({ ...baseInput(state, now), event, history, ...extra })
  if (messages.length === 0) return []

  write(HISTORY_KEY, recordShown(history, messages, now))
  const feed = loadFeed(date)
  feed.messages.push(...messages.map((m) => ({ ...m, at: now.getTime() })))
  write(FEED_KEY, feed)
  listeners.forEach((l) => l(messages, feed))
  return messages
}

/** A shown message re-rendered with today's live numbers, or null if it no longer applies. */
export function liveCoachMessage(m: CoachMessage, now: Date = new Date()): CoachMessage | null {
  const state = useStore.getState()
  if (state.status !== 'ready' || !state.profile) return null
  return refreshCoachMessage(m.id, baseInput(state, now), m)
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

interface Snapshot {
  date: string
  remaining: number
  protein: number
  waterMl: number
  itemsByType: Record<string, number>
  /** Workouts that are finished, by id. */
  completed: Set<string>
  weightCount: number
  /** Latest weight by date, and a fingerprint to notice same-day edits. */
  latestWeightKg?: number
  weightKey: string
}

function latestWeight(state: StoreState) {
  const sorted = [...state.weights].sort((a, b) => a.date.localeCompare(b.date) || a.loggedAt - b.loggedAt)
  return sorted[sorted.length - 1]
}

function snapshot(): Snapshot | null {
  const state = useStore.getState()
  if (state.status !== 'ready' || !state.profile) return null
  const date = today()
  const s = selectDailySummary(state, date)
  const itemsByType: Record<string, number> = {}
  for (const m of s.meals) itemsByType[m.type] = (itemsByType[m.type] ?? 0) + m.items.length
  return {
    date,
    remaining: s.remaining,
    protein: s.macros.protein,
    waterMl: s.waterMl,
    itemsByType,
    completed: new Set(state.workouts.filter((w) => !w.inProgress).map((w) => w.id)),
    weightCount: state.weights.length,
    latestWeightKg: latestWeight(state)?.weightKg,
    weightKey: state.weights.map((w) => `${w.id}:${w.weightKg}`).join('|'),
  }
}

/** Compare two snapshots and fire the matching events. Only additions count. */
function detectEvents(prev: Snapshot, next: Snapshot): void {
  const grew = (Object.keys(next.itemsByType) as MealType[])
    .find((t) => (next.itemsByType[t] ?? 0) > (prev.itemsByType[t] ?? 0))
  if (grew) {
    runCoach('meal_logged', {
      previousRemaining: prev.remaining, previousProtein: prev.protein, loggedMealType: grew,
    })
  }

  if (next.waterMl > prev.waterMl) {
    runCoach('water_logged', { previousWaterMl: prev.waterMl })
  }

  if (next.weightKey !== prev.weightKey && next.weightCount >= prev.weightCount) {
    runCoach('weight_logged', { previousWeightKg: prev.latestWeightKg })
  }

  const state = useStore.getState()
  for (const w of state.workouts) {
    if (w.inProgress || prev.completed.has(w.id)) continue
    const earlier = state.workouts.filter((o) => o.id !== w.id && !o.inProgress
      && (o.date < w.date || (o.date === w.date && (o.completedAt ?? o.startedAt) < (w.completedAt ?? w.startedAt))))
    runCoach('workout_finished', { newRecord: findNewRecord(w, earlier) ?? undefined })
  }
}

let stop: (() => void) | null = null

/** Start the coach. Idempotent; returns a stop function. */
export function startCoach(): () => void {
  stop?.()
  let prev = snapshot()

  const unsubscribe = useStore.subscribe(() => {
    const next = snapshot()
    // Only genuine additions on the same day count — not hydration, an
    // import, a deletion, or the clock passing midnight.
    if (prev && next && prev.date === next.date) detectEvents(prev, next)
    prev = next
  })

  const check = () => { runCoach('check') }
  const onVisible = () => { if (document.visibilityState === 'visible') check() }
  const interval = window.setInterval(check, CHECK_INTERVAL_MS)
  document.addEventListener('visibilitychange', onVisible)
  check()

  stop = () => {
    unsubscribe()
    window.clearInterval(interval)
    document.removeEventListener('visibilitychange', onVisible)
    stop = null
  }
  return stop
}
