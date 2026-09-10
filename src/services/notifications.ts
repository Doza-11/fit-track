/**
 * Reminder scheduling.
 *
 * `NotificationChannel` is the seam that keeps this Android-ready: the web
 * build schedules with `setTimeout` + the Notification API, and a Capacitor
 * build registers the same reminders with `@capacitor/local-notifications`
 * instead. Nothing outside this file knows which one is active.
 *
 * Web timers only survive while a tab is open, so the web channel also
 * re-checks on visibility change and shows anything that came due while the
 * app was backgrounded.
 */
import type {
  DailySummary, NotificationRelevance, Reminder, ReminderKind,
} from '@/types'
import { parseTime } from '@/utils/date'
import { isStillRelevant, reminderBody, reminderRelevance } from './smartNotifications'
import { isNative } from './native/platform'
import { CapacitorNotificationChannel } from './native/notifications'

export interface ScheduledNotification {
  id: string
  title: string
  body: string
  /** Epoch ms at which it should fire. */
  at: number
  /** Delivered at most once per key; survives reloads. */
  dedupeKey?: string
  /**
   * Re-checked immediately before display. A reminder to log lunch queued at
   * 13:30 is dropped silently if lunch was logged at 13:20.
   */
  relevance?: NotificationRelevance
}

export interface ScheduleOptions {
  /**
   * Resolves a notification's relevance at fire time. Supplied by the
   * scheduler, which holds the live day state; the channel stays domain-free.
   */
  isRelevant?: (n: ScheduledNotification) => boolean
  /** Invoked after a notification is actually shown. */
  onDelivered?: (n: ScheduledNotification) => void
}

export interface NotificationChannel {
  readonly name: string
  isSupported(): boolean
  getPermission(): NotificationPermissionState
  requestPermission(): Promise<NotificationPermissionState>
  schedule(items: ScheduledNotification[], options?: ScheduleOptions): Promise<void>
  cancelAll(): Promise<void>
}

export type NotificationPermissionState = 'granted' | 'denied' | 'default' | 'unsupported'

export const REMINDER_COPY: Record<ReminderKind, { title: string; body: string }> = {
  breakfast: { title: '🍳 Breakfast', body: 'Don’t forget to log breakfast.' },
  lunch: { title: '🍽️ Lunch', body: 'Have you logged your lunch?' },
  snack: { title: '🥨 Snack', body: 'Logging snacks keeps your daily total accurate.' },
  dinner: { title: '🌙 Dinner', body: 'Before you finish your day, log your dinner to complete today’s nutrition summary.' },
  workout: { title: '🏋️ Workout', body: 'Planning to train today? Log it when you’re done.' },
  water: { title: '💧 Water', body: 'A glass of water is a good idea about now.' },
  summary: { title: '📊 Daily summary', body: 'Your day is nearly done — check today’s summary and fill in anything missing.' },
}

export const DEFAULT_REMINDERS: Omit<Reminder, 'id'>[] = [
  { kind: 'breakfast', label: 'Breakfast', enabled: false, time: '09:00', days: [] },
  { kind: 'lunch', label: 'Lunch', enabled: false, time: '13:30', days: [] },
  { kind: 'snack', label: 'Snack', enabled: false, time: '17:00', days: [] },
  { kind: 'dinner', label: 'Dinner', enabled: false, time: '20:30', days: [] },
  { kind: 'workout', label: 'Workout', enabled: false, time: '18:30', days: [] },
  { kind: 'water', label: 'Water', enabled: false, time: '10:00', repeatEveryMin: 120, days: [] },
  { kind: 'summary', label: 'Daily summary', enabled: false, time: '22:00', days: [] },
]

/** Display order for the reminder list, following the shape of a day. */
const KIND_ORDER: ReminderKind[] = [
  'breakfast', 'lunch', 'snack', 'dinner', 'workout', 'water', 'summary',
]

/**
 * Sort reminders into day order. Storage returns them in key order, which is
 * effectively arbitrary, so the settings list must impose this itself.
 */
export function sortReminders(list: Reminder[]): Reminder[] {
  return [...list].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
}

/** Next epoch-ms occurrence of a reminder, or null if it never fires. */
export function nextOccurrence(r: Reminder, from: Date = new Date()): number | null {
  if (!r.enabled) return null

  if (r.repeatEveryMin && r.repeatEveryMin > 0) {
    // Interval reminders run from their start time onward, each day.
    const startMin = parseTime(r.time)
    const nowMin = from.getHours() * 60 + from.getMinutes()
    const base = new Date(from)
    base.setSeconds(0, 0)
    if (nowMin < startMin) {
      base.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0)
      return base.getTime()
    }
    const elapsed = nowMin - startMin
    const slots = Math.floor(elapsed / r.repeatEveryMin) + 1
    const nextMin = startMin + slots * r.repeatEveryMin
    // Past midnight — roll to tomorrow's first slot.
    if (nextMin >= 24 * 60) {
      base.setDate(base.getDate() + 1)
      base.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0)
      return base.getTime()
    }
    base.setHours(Math.floor(nextMin / 60), nextMin % 60, 0, 0)
    return base.getTime()
  }

  const target = parseTime(r.time)
  // Look ahead a full week to find the next allowed weekday.
  for (let offset = 0; offset < 8; offset++) {
    const d = new Date(from)
    d.setDate(d.getDate() + offset)
    d.setHours(Math.floor(target / 60), target % 60, 0, 0)
    if (d.getTime() <= from.getTime()) continue
    if (r.days.length > 0 && !r.days.includes(d.getDay())) continue
    return d.getTime()
  }
  return null
}

export function toScheduled(
  r: Reminder, at: number, summary?: DailySummary,
): ScheduledNotification {
  const copy = REMINDER_COPY[r.kind]
  return {
    id: `${r.id}:${at}`,
    title: copy.title,
    // With a day's state to hand, say something specific instead of a
    // generic prompt — and let it be dropped if it's already been done.
    body: summary ? reminderBody(r.kind, copy.body, summary) : copy.body,
    at,
    dedupeKey: summary ? `${summary.date}:reminder:${r.kind}:${at}` : undefined,
    relevance: summary ? reminderRelevance(r.kind, summary) : { type: 'always' },
  }
}

// ── Web channel ─────────────────────────────────────────────────────────────

/** Exported for tests; use the `notifications` singleton in app code. */
export class WebNotificationChannel implements NotificationChannel {
  readonly name = 'web'
  private timers: number[] = []
  private pending: ScheduledNotification[] = []
  private options: ScheduleOptions = {}
  private visibilityBound = false

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window
  }

  getPermission(): NotificationPermissionState {
    if (!this.isSupported()) return 'unsupported'
    return Notification.permission as NotificationPermissionState
  }

  async requestPermission(): Promise<NotificationPermissionState> {
    if (!this.isSupported()) return 'unsupported'
    try {
      return (await Notification.requestPermission()) as NotificationPermissionState
    } catch {
      return 'denied'
    }
  }

  async schedule(items: ScheduledNotification[], options: ScheduleOptions = {}): Promise<void> {
    await this.cancelAll()
    this.options = options
    if (this.getPermission() !== 'granted') return
    this.pending = [...items].sort((a, b) => a.at - b.at)

    for (const item of this.pending) {
      const delay = item.at - Date.now()
      if (delay < 0) continue
      // setTimeout saturates past ~24.8 days; nothing here schedules that far
      // out, but clamp so a bad value can't fire immediately.
      if (delay > 2_147_483_647) continue
      const id = window.setTimeout(() => this.fire(item), delay)
      this.timers.push(id)
    }

    this.bindVisibility()
  }

  private fire(item: ScheduledNotification): void {
    // Drop it from the queue first, so a failed send can't fire twice.
    this.pending = this.pending.filter((p) => p.id !== item.id)
    if (this.getPermission() !== 'granted') return

    // The day may have moved on since this was queued — check before nagging.
    if (this.options.isRelevant && !this.options.isRelevant(item)) return

    try {
      new Notification(item.title, { body: item.body, tag: item.id, icon: './icons/icon-192.png' })
    } catch {
      // Some browsers require a service-worker registration to construct
      // notifications; failing silently is better than breaking the timer loop.
    }
    this.options.onDelivered?.(item)
  }

  /**
   * Background tabs get throttled timers, so on return to the foreground we
   * fire anything whose time has passed (once, thanks to the tag + filter).
   */
  private bindVisibility(): void {
    if (this.visibilityBound || typeof document === 'undefined') return
    this.visibilityBound = true
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      for (const item of [...this.pending]) {
        if (item.at <= now) this.fire(item)
      }
    })
  }

  async cancelAll(): Promise<void> {
    for (const t of this.timers) window.clearTimeout(t)
    this.timers = []
    this.pending = []
  }
}

/**
 * No-op channel for environments without notification support, so callers
 * never need a null check.
 */
class NoopChannel implements NotificationChannel {
  readonly name = 'noop'
  isSupported() { return false }
  getPermission(): NotificationPermissionState { return 'unsupported' }
  async requestPermission(): Promise<NotificationPermissionState> { return 'unsupported' }
  async schedule(_items: ScheduledNotification[], _options?: ScheduleOptions) { /* nothing to do */ }
  async cancelAll() { /* nothing to do */ }
}

const webChannel = new WebNotificationChannel()

/**
 * Active channel, chosen once at startup.
 *
 * Android gets the Capacitor-backed channel so reminders are handed to the OS
 * scheduler and arrive with the app closed; the browser keeps the timer-based
 * one. Both satisfy the same interface, so no caller knows which is in use.
 */
export const notifications: NotificationChannel =
  isNative() ? new CapacitorNotificationChannel()
  : webChannel.isSupported() ? webChannel
  : new NoopChannel()

/**
 * Turn the user's reminder list into the next concrete firing times.
 *
 * Pass `summary` to make the reminders state-aware: copy is filled in with the
 * day's real numbers, and each one carries a relevance check so it stays
 * silent if the user has already done the thing it asks about.
 */
export function buildSchedule(
  reminders: Reminder[], from: Date = new Date(), summary?: DailySummary,
): ScheduledNotification[] {
  const out: ScheduledNotification[] = []
  for (const r of reminders) {
    if (!r.enabled) continue
    if (r.repeatEveryMin) {
      // Queue the next few interval slots so the day is covered without
      // needing the app to be reopened between each one.
      let cursor = from
      for (let i = 0; i < 6; i++) {
        const at = nextOccurrence(r, cursor)
        if (at === null) break
        out.push(toScheduled(r, at, summary))
        cursor = new Date(at + 1000)
      }
    } else {
      const at = nextOccurrence(r, from)
      if (at !== null) out.push(toScheduled(r, at, summary))
    }
  }
  return out.sort((a, b) => a.at - b.at)
}

/**
 * Schedule reminders alone, with no day context.
 *
 * Used before the store has hydrated. Once it has, the scheduler in
 * `notificationScheduler.ts` takes over and supplies live state.
 */
export async function applyReminders(reminders: Reminder[]): Promise<void> {
  await notifications.schedule(buildSchedule(reminders))
}

/** Re-export so callers have one import for evaluating a queued notification. */
export { isStillRelevant }
