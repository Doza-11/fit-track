/**
 * Keeps the notification queue in step with the app's live state.
 *
 * Every mutation re-plans: log lunch and the lunch reminder disappears from
 * the queue; log a workout and the movement nudge goes with it. Because the
 * plan is rebuilt from current state rather than patched, there is no drift
 * between what the user has done and what they will be told.
 *
 * Delivered keys are persisted so a reload doesn't re-fire the same nudge, and
 * are pruned to today so the record can't grow without bound.
 */
import type { DailySummary } from '@/types'
import { useStore, selectDailySummary } from '@/store/useStore'
import {
  buildSchedule, isStillRelevant, notifications, type ScheduledNotification,
} from './notifications'
import { planSmartNotifications } from './smartNotifications'
import { calculateWeeklyAverage } from '@/utils/calculations'
import { lastNDays, today } from '@/utils/date'

const FIRED_KEY = 'fittrack:notifications-fired'
/** Re-plan at most this often, so a burst of edits schedules once. */
const DEBOUNCE_MS = 800
/** Safety net for a tab left open across a day boundary. */
const REPLAN_INTERVAL_MS = 15 * 60_000

interface FiredRecord { date: string; keys: string[] }

function loadFired(date: string): Set<string> {
  try {
    const raw = localStorage.getItem(FIRED_KEY)
    if (!raw) return new Set()
    const rec = JSON.parse(raw) as FiredRecord
    // Yesterday's deliveries must not suppress today's.
    return rec.date === date ? new Set(rec.keys) : new Set()
  } catch {
    return new Set()
  }
}

function saveFired(date: string, keys: Set<string>): void {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify({ date, keys: [...keys] } satisfies FiredRecord))
  } catch {
    // Storage unavailable — dedupe degrades to per-session, which is fine.
  }
}

/**
 * Build the full queue: fixed reminders the user set, plus state-aware
 * suggestions. Exported for tests.
 */
export function buildFullSchedule(
  state: ReturnType<typeof useStore.getState>,
  now: Date = new Date(),
): { items: ScheduledNotification[]; summary: DailySummary } {
  const date = today()
  const summary = selectDailySummary(state, date)
  const profile = state.profile

  // Drop anything that is already satisfied, rather than queueing a timer that
  // would only be discarded at fire time. Since the plan is rebuilt on every
  // state change, an item that becomes relevant again (a deleted workout, say)
  // is simply re-added on the next pass. The fire-time check still runs, for
  // changes that land between planning and delivery.
  const reminderItems = buildSchedule(state.reminders, now, summary)
    // A reminder for a future day cannot be judged against today's log, so
    // only today's are filtered for relevance.
    .filter((n) => n.forDate !== date || !n.relevance || isStillRelevant(n.relevance, summary))

  if (!profile) return { items: reminderItems, summary }

  // Recent averages give the "lower than usual" comparisons something to
  // compare against; today itself is excluded so it can't skew its own baseline.
  const past = lastNDays(14, date).slice(0, -1).map((d) => selectDailySummary(state, d))
  const smart = planSmartNotifications({
    summary,
    profile,
    recentAvgProtein: calculateWeeklyAverage(past.map((d) => d.macros.protein)),
    recentAvgSteps: calculateWeeklyAverage(past.map((d) => d.steps)),
    now,
    alreadyFired: loadFired(date),
  })

  const smartItems: ScheduledNotification[] = smart.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    at: n.at,
    dedupeKey: n.dedupeKey,
    relevance: n.relevance,
  }))

  return {
    items: [...reminderItems, ...smartItems].sort((a, b) => a.at - b.at),
    summary,
  }
}

let debounce: number | undefined
let interval: number | undefined
let unsubscribe: (() => void) | undefined

async function replan(): Promise<void> {
  const state = useStore.getState()
  if (state.status !== 'ready') return

  const { items } = buildFullSchedule(state)
  const date = today()
  const fired = loadFired(date)

  await notifications.schedule(items.filter((n) => !n.dedupeKey || !fired.has(n.dedupeKey)), {
    // Evaluated at fire time against the state as it is *then*, not now.
    isRelevant: (n) => {
      if (!n.relevance) return true
      // Same rule at fire time: only today's state can invalidate it.
      const now = today()
      if (n.forDate && n.forDate !== now) return true
      return isStillRelevant(n.relevance, selectDailySummary(useStore.getState(), now))
    },
    onDelivered: (n) => {
      if (!n.dedupeKey) return
      const current = loadFired(today())
      current.add(n.dedupeKey)
      saveFired(today(), current)
    },
  })
}

function scheduleReplan(): void {
  if (debounce !== undefined) window.clearTimeout(debounce)
  debounce = window.setTimeout(() => { void replan() }, DEBOUNCE_MS)
}

/**
 * Start keeping notifications in sync. Idempotent; returns a stop function.
 */
export function startNotificationScheduler(): () => void {
  stopNotificationScheduler()

  unsubscribe = useStore.subscribe(scheduleReplan)
  interval = window.setInterval(() => { void replan() }, REPLAN_INTERVAL_MS)
  // Coming back to the app is the moment the queue is most likely stale.
  document.addEventListener('visibilitychange', onVisible)
  void replan()

  return stopNotificationScheduler
}

function onVisible(): void {
  if (document.visibilityState === 'visible') scheduleReplan()
}

export function stopNotificationScheduler(): void {
  unsubscribe?.()
  unsubscribe = undefined
  if (debounce !== undefined) window.clearTimeout(debounce)
  if (interval !== undefined) window.clearInterval(interval)
  debounce = undefined
  interval = undefined
  document.removeEventListener('visibilitychange', onVisible)
}

/** Re-plan immediately — used after the user changes notification settings. */
export function refreshNotifications(): void {
  void replan()
}

/**
 * Preview of what would be delivered for the rest of today, for the settings
 * screen. Shows the user exactly what the app intends to say.
 */
export function previewTodaysNotifications(): ScheduledNotification[] {
  const state = useStore.getState()
  if (state.status !== 'ready') return []
  const fired = loadFired(today())
  return buildFullSchedule(state).items.filter((n) => !n.dedupeKey || !fired.has(n.dedupeKey))
}
