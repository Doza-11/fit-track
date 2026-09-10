import { describe, it, expect } from 'vitest'
import {
  nextOccurrence, buildSchedule, sortReminders, DEFAULT_REMINDERS, REMINDER_COPY,
} from './notifications'
import type { Reminder, ReminderKind } from '@/types'

const r = (over: Partial<Reminder> = {}): Reminder => ({
  id: 'r1', kind: 'lunch', label: 'Lunch', enabled: true, time: '13:30', days: [], ...over,
})

// A fixed Wednesday for deterministic weekday maths.
const wed10am = new Date(2026, 8, 9, 10, 0, 0, 0)

describe('nextOccurrence', () => {
  it('returns today’s slot when it is still ahead', () => {
    const at = nextOccurrence(r({ time: '13:30' }), wed10am)!
    expect(new Date(at).getHours()).toBe(13)
    expect(new Date(at).getDate()).toBe(9)
  })

  it('rolls to tomorrow once the time has passed', () => {
    const at = nextOccurrence(r({ time: '09:00' }), wed10am)!
    expect(new Date(at).getDate()).toBe(10)
    expect(new Date(at).getHours()).toBe(9)
  })

  it('returns null when disabled', () => {
    expect(nextOccurrence(r({ enabled: false }), wed10am)).toBeNull()
  })

  it('skips days not in the allowed list', () => {
    // Only Saturday (6); from Wednesday that is 3 days out.
    const at = nextOccurrence(r({ time: '09:00', days: [6] }), wed10am)!
    expect(new Date(at).getDay()).toBe(6)
    expect(new Date(at).getDate()).toBe(12)
  })

  it('always returns a future time', () => {
    for (const time of ['00:00', '09:59', '10:00', '10:01', '23:59']) {
      const at = nextOccurrence(r({ time }), wed10am)!
      expect(at).toBeGreaterThan(wed10am.getTime())
    }
  })

  describe('interval reminders', () => {
    const water = r({ kind: 'water', time: '10:00', repeatEveryMin: 120 })

    it('waits for the start time before the first slot', () => {
      const at = nextOccurrence(water, new Date(2026, 8, 9, 7, 30))!
      expect(new Date(at).getHours()).toBe(10)
    })

    it('advances to the next slot mid-day', () => {
      const at = nextOccurrence(water, new Date(2026, 8, 9, 11, 0))!
      expect(new Date(at).getHours()).toBe(12)
    })

    it('lands exactly on a boundary’s next slot, not the same one', () => {
      const from = new Date(2026, 8, 9, 12, 0)
      const at = nextOccurrence(water, from)!
      expect(at).toBeGreaterThan(from.getTime())
      expect(new Date(at).getHours()).toBe(14)
    })

    it('rolls past midnight back to the next day’s start', () => {
      const at = nextOccurrence(water, new Date(2026, 8, 9, 23, 30))!
      expect(new Date(at).getDate()).toBe(10)
      expect(new Date(at).getHours()).toBe(10)
    })
  })
})

describe('buildSchedule', () => {
  it('ignores disabled reminders', () => {
    expect(buildSchedule([r({ enabled: false })], wed10am)).toHaveLength(0)
  })

  it('queues several slots ahead for interval reminders', () => {
    const s = buildSchedule([r({ kind: 'water', time: '10:00', repeatEveryMin: 120 })], wed10am)
    expect(s.length).toBeGreaterThan(1)
    expect(s.every((x, i) => i === 0 || x.at > s[i - 1].at)).toBe(true)
  })

  it('returns entries sorted by time', () => {
    const s = buildSchedule([
      r({ id: 'a', kind: 'dinner', time: '20:30' }),
      r({ id: 'b', kind: 'lunch', time: '13:30' }),
    ], wed10am)
    expect(s[0].at).toBeLessThan(s[1].at)
  })

  it('carries the copy for each reminder kind', () => {
    const s = buildSchedule([r({ kind: 'dinner', time: '20:30' })], wed10am)
    expect(s[0].body).toBe(REMINDER_COPY.dinner.body)
  })
})

describe('reminder copy', () => {
  it('covers every reminder kind', () => {
    const kinds: ReminderKind[] = ['breakfast', 'lunch', 'snack', 'dinner', 'workout', 'water', 'summary']
    for (const k of kinds) expect(REMINDER_COPY[k].body.length).toBeGreaterThan(0)
  })

  it('asks the user to log rather than judging them', () => {
    for (const k of Object.keys(REMINDER_COPY) as ReminderKind[]) {
      const { body } = REMINDER_COPY[k]
      expect(body, k).not.toMatch(/\b(bad|guilty|cheat|lazy|must|failed)\b/i)
    }
  })

  it('ships a default for every kind', () => {
    expect(DEFAULT_REMINDERS).toHaveLength(7)
  })

  it('turns the main meal reminders on out of the box', () => {
    // Reminders are the point of the feature; shipping them all off meant a
    // fresh install reminded the user of nothing until they found Settings.
    const on = DEFAULT_REMINDERS.filter((d) => d.enabled).map((d) => d.kind)
    expect(on).toEqual(expect.arrayContaining(['breakfast', 'lunch', 'dinner', 'summary']))
  })

  it('leaves the noisier optional reminders off', () => {
    const off = DEFAULT_REMINDERS.filter((d) => !d.enabled).map((d) => d.kind)
    expect(off).toEqual(expect.arrayContaining(['snack', 'workout', 'water']))
  })
})

describe('sortReminders', () => {
  it('orders reminders to follow the shape of a day', () => {
    const shuffled: Reminder[] = [
      r({ id: '1', kind: 'summary', label: 'Daily summary' }),
      r({ id: '2', kind: 'lunch', label: 'Lunch' }),
      r({ id: '3', kind: 'breakfast', label: 'Breakfast' }),
      r({ id: '4', kind: 'water', label: 'Water' }),
      r({ id: '5', kind: 'dinner', label: 'Dinner' }),
      r({ id: '6', kind: 'workout', label: 'Workout' }),
      r({ id: '7', kind: 'snack', label: 'Snack' }),
    ]
    expect(sortReminders(shuffled).map((x) => x.kind)).toEqual([
      'breakfast', 'lunch', 'snack', 'dinner', 'workout', 'water', 'summary',
    ])
  })

  it('does not mutate the input array', () => {
    const list = [r({ id: '1', kind: 'dinner' }), r({ id: '2', kind: 'breakfast' })]
    sortReminders(list)
    expect(list[0].kind).toBe('dinner')
  })
})

describe('lookahead', () => {
  const dinner = r({ kind: 'dinner', time: '20:30' })

  it('queues several days of a fixed reminder, not just the next one', () => {
    // Without this, missing a day of app usage stops reminders entirely.
    const s = buildSchedule([dinner], wed10am)
    expect(s.length).toBeGreaterThan(1)
    const days = new Set(s.map((n) => new Date(n.at).getDate()))
    expect(days.size).toBeGreaterThan(1)
  })

  it('tags each occurrence with the local day it will fire on', () => {
    // The scheduler uses this to avoid judging a future reminder against
    // today's log.
    for (const n of buildSchedule([dinner], wed10am)) {
      const d = new Date(n.at)
      const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      expect(n.forDate).toBe(expected)
    }
  })

  it('spreads the occurrences across consecutive days', () => {
    const dates = buildSchedule([dinner], wed10am).map((n) => n.forDate)
    expect(new Set(dates).size).toBe(dates.length)
  })

  it('keeps occurrences in ascending order and all in the future', () => {
    const s = buildSchedule([dinner], wed10am)
    for (let i = 0; i < s.length; i++) {
      expect(s[i].at).toBeGreaterThan(wed10am.getTime())
      if (i > 0) expect(s[i].at).toBeGreaterThan(s[i - 1].at)
    }
  })

  it('still respects a weekday restriction across the lookahead', () => {
    // Saturdays only: every queued occurrence must be a Saturday.
    const satOnly = r({ kind: 'workout', time: '09:00', days: [6] })
    for (const n of buildSchedule([satOnly], wed10am)) {
      expect(new Date(n.at).getDay()).toBe(6)
    }
  })
})
