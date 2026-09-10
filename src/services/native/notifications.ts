/**
 * Android notification delivery.
 *
 * This is an adapter, not a second implementation: all reminder and
 * suggestion logic stays in `services/notifications.ts`,
 * `services/smartNotifications.ts` and `services/notificationScheduler.ts`.
 * Those still produce the same `{ id, title, body, at }` objects, and this
 * file only maps them onto `@capacitor/local-notifications`.
 *
 * One behavioural difference is unavoidable. The web channel re-checks a
 * notification's `relevance` in the instant before it displays; a native
 * alarm fires without waking the app, so it cannot. The existing scheduler
 * already compensates by rebuilding the whole queue on every store change —
 * and since logging only ever happens inside this app, a stale notification
 * would have to survive a mutation that never occurred. The `relevance`
 * descriptor still travels in `extra` so it can be inspected on resume.
 */
import type {
  NotificationChannel, NotificationPermissionState, ScheduleOptions,
  ScheduledNotification,
} from '../notifications'

/** Loaded lazily so the plugin never enters the web bundle. */
type LocalNotificationsModule = typeof import('@capacitor/local-notifications')

let modulePromise: Promise<LocalNotificationsModule> | null = null
function loadPlugin(): Promise<LocalNotificationsModule> {
  modulePromise ??= import('@capacitor/local-notifications')
  return modulePromise
}

/**
 * Capacitor notification ids must be 32-bit ints, but the app's ids are
 * strings such as `smart-2026-09-09:low_protein`. Hash them to a stable
 * positive int so re-planning maps the same logical notification to the same
 * native id rather than accumulating duplicates.
 */
export function toNativeId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0
  }
  // Keep it positive and inside Java's int range.
  return Math.abs(h) % 2_147_483_600
}

export class CapacitorNotificationChannel implements NotificationChannel {
  readonly name = 'capacitor'

  /**
   * `getPermission()` is synchronous in the existing interface, but the
   * Capacitor API is async — so the state is cached and refreshed around any
   * operation that could change it.
   */
  private cached: NotificationPermissionState = 'default'

  constructor() {
    void this.refreshPermission()
  }

  isSupported(): boolean {
    return true
  }

  getPermission(): NotificationPermissionState {
    return this.cached
  }

  /** Re-read the OS permission state into the cache. */
  async refreshPermission(): Promise<NotificationPermissionState> {
    try {
      const { LocalNotifications } = await loadPlugin()
      const { display } = await LocalNotifications.checkPermissions()
      this.cached = mapPermission(display)
    } catch {
      this.cached = 'denied'
    }
    return this.cached
  }

  async requestPermission(): Promise<NotificationPermissionState> {
    try {
      const { LocalNotifications } = await loadPlugin()
      const { display } = await LocalNotifications.requestPermissions()
      this.cached = mapPermission(display)
    } catch {
      this.cached = 'denied'
    }
    return this.cached
  }

  async schedule(items: ScheduledNotification[], options: ScheduleOptions = {}): Promise<void> {
    // Replace the queue wholesale, matching the web channel's semantics and
    // the scheduler's assumption that re-planning supersedes what came before.
    await this.cancelAll()

    await this.refreshPermission()
    if (this.cached !== 'granted') return

    const now = Date.now()
    const due = items.filter((i) => i.at > now)
    if (due.length === 0) return

    // The relevance gate still applies at *scheduling* time on native, so a
    // notification that is already moot is never registered in the first place.
    const relevant = options.isRelevant
      ? due.filter((i) => options.isRelevant!(i))
      : due

    if (relevant.length === 0) return

    try {
      const { LocalNotifications } = await loadPlugin()
      await LocalNotifications.schedule({
        notifications: relevant.map((i) => ({
          id: toNativeId(i.id),
          title: i.title,
          body: i.body,
          schedule: {
            at: new Date(i.at),
            // Survive Doze so an evening reminder isn't deferred for hours.
            allowWhileIdle: true,
          },
          // Preserve the app's own metadata rather than reshaping the model.
          extra: {
            appId: i.id,
            dedupeKey: i.dedupeKey ?? null,
            relevance: i.relevance ?? null,
          },
        })),
      })
    } catch {
      // A scheduling failure must not break the app; the queue is rebuilt on
      // the next store change anyway.
    }
  }

  async cancelAll(): Promise<void> {
    try {
      const { LocalNotifications } = await loadPlugin()
      const pending = await LocalNotifications.getPending()
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications })
      }
    } catch {
      // Nothing pending, or the plugin is unavailable.
    }
  }
}

function mapPermission(state: string): NotificationPermissionState {
  if (state === 'granted') return 'granted'
  if (state === 'denied') return 'denied'
  return 'default'
}
