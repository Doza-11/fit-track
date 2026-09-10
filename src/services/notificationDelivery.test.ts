/**
 * Delivery-layer tests for the web notification channel.
 *
 * The browser globals it needs are stubbed here rather than pulling in a DOM
 * environment, keeping the suite dependency-free and fast.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { ScheduledNotification } from './notifications'

interface Shown { title: string; body: string }
let shown: Shown[] = []

class FakeNotification {
  static permission: 'granted' | 'denied' | 'default' = 'granted'
  constructor(title: string, opts: { body: string }) {
    shown.push({ title, body: opts.body })
  }
  static async requestPermission() { return FakeNotification.permission }
}

const listeners: Record<string, Array<() => void>> = {}

beforeEach(() => {
  shown = []
  FakeNotification.permission = 'granted'
  vi.useFakeTimers()
  vi.stubGlobal('Notification', FakeNotification)
  vi.stubGlobal('window', globalThis)
  vi.stubGlobal('document', {
    visibilityState: 'visible',
    addEventListener: (ev: string, fn: () => void) => {
      (listeners[ev] ??= []).push(fn)
    },
    removeEventListener: () => {},
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function makeChannel() {
  const { WebNotificationChannel } = await import('./notifications')
  return new WebNotificationChannel()
}

const item = (over: Partial<ScheduledNotification> = {}): ScheduledNotification => ({
  id: 'n1', title: 'Title', body: 'Body', at: Date.now() + 1000, ...over,
})

describe('WebNotificationChannel', () => {
  it('shows a notification when its time arrives', async () => {
    const ch = await makeChannel()
    await ch.schedule([item()])
    await vi.advanceTimersByTimeAsync(1200)
    expect(shown).toHaveLength(1)
    expect(shown[0].title).toBe('Title')
  })

  it('drops a notification that is no longer relevant at fire time', async () => {
    const ch = await makeChannel()
    // Logged the meal between scheduling and delivery.
    let logged = false
    await ch.schedule([item({ relevance: { type: 'meal_unlogged', meal: 'lunch' } })], {
      isRelevant: () => !logged,
    })
    logged = true
    await vi.advanceTimersByTimeAsync(1200)
    expect(shown).toHaveLength(0)
  })

  it('still shows it when the condition is unchanged', async () => {
    const ch = await makeChannel()
    await ch.schedule([item()], { isRelevant: () => true })
    await vi.advanceTimersByTimeAsync(1200)
    expect(shown).toHaveLength(1)
  })

  it('reports what it delivered so callers can dedupe', async () => {
    const ch = await makeChannel()
    const delivered: string[] = []
    await ch.schedule([item({ dedupeKey: '2026-09-09:low_protein' })], {
      onDelivered: (n) => delivered.push(n.dedupeKey!),
    })
    await vi.advanceTimersByTimeAsync(1200)
    expect(delivered).toEqual(['2026-09-09:low_protein'])
  })

  it('does not report a delivery for something it suppressed', async () => {
    const ch = await makeChannel()
    const delivered: string[] = []
    await ch.schedule([item({ dedupeKey: 'k' })], {
      isRelevant: () => false,
      onDelivered: (n) => delivered.push(n.dedupeKey!),
    })
    await vi.advanceTimersByTimeAsync(1200)
    expect(delivered).toEqual([])
  })

  it('fires each notification only once', async () => {
    const ch = await makeChannel()
    await ch.schedule([item()])
    await vi.advanceTimersByTimeAsync(5000)
    expect(shown).toHaveLength(1)
  })

  it('rescheduling replaces the previous queue rather than adding to it', async () => {
    const ch = await makeChannel()
    await ch.schedule([item({ id: 'a', title: 'First' })])
    await ch.schedule([item({ id: 'b', title: 'Second' })])
    await vi.advanceTimersByTimeAsync(1200)
    expect(shown.map((s) => s.title)).toEqual(['Second'])
  })

  it('cancelling stops anything pending', async () => {
    const ch = await makeChannel()
    await ch.schedule([item()])
    await ch.cancelAll()
    await vi.advanceTimersByTimeAsync(2000)
    expect(shown).toHaveLength(0)
  })

  it('shows nothing without permission', async () => {
    FakeNotification.permission = 'denied'
    const ch = await makeChannel()
    await ch.schedule([item()])
    await vi.advanceTimersByTimeAsync(1200)
    expect(shown).toHaveLength(0)
  })

  it('skips items whose time has already passed', async () => {
    const ch = await makeChannel()
    await ch.schedule([item({ at: Date.now() - 60_000 })])
    await vi.advanceTimersByTimeAsync(1000)
    expect(shown).toHaveLength(0)
  })
})
