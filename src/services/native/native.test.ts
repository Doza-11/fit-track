import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { toNativeId } from './notifications'
import { isNative, isAndroid, getPlatform } from './platform'

describe('toNativeId', () => {
  /** Ids the scheduler actually produces. */
  const realIds = [
    'smart-2026-09-09:low_protein',
    'smart-2026-09-09:calorie_room',
    'smart-2026-09-09:under_eating',
    'smart-2026-09-09:hydration',
    'smart-2026-09-09:move',
    'smart-2026-09-09:good_day',
    'rem-abc123:1788953400000',
    'rem-def456:1788957000000',
  ]

  it('is deterministic, so re-planning reuses the same native id', () => {
    for (const id of realIds) expect(toNativeId(id)).toBe(toNativeId(id))
  })

  it('always produces a positive 32-bit int, as the plugin requires', () => {
    for (const id of [...realIds, '', 'x', 'a'.repeat(500), '🍨-emoji-id']) {
      const n = toNativeId(id)
      expect(Number.isInteger(n)).toBe(true)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(2_147_483_647)
    }
  })

  it('does not collide across a realistic day of notifications', () => {
    expect(new Set(realIds.map(toNativeId)).size).toBe(realIds.length)
  })

  it('distinguishes ids that differ only by date or kind', () => {
    expect(toNativeId('smart-2026-09-09:move')).not.toBe(toNativeId('smart-2026-09-10:move'))
    expect(toNativeId('smart-2026-09-09:move')).not.toBe(toNativeId('smart-2026-09-09:hydration'))
  })
})

describe('platform detection', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('reports web when Capacitor is not injected', () => {
    expect(isNative()).toBe(false)
    expect(getPlatform()).toBe('web')
    expect(isAndroid()).toBe(false)
  })

  it('reports android when the native bridge is present', () => {
    vi.stubGlobal('Capacitor', {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
    })
    expect(isNative()).toBe(true)
    expect(isAndroid()).toBe(true)
  })

  it('treats a Capacitor web build as non-native', () => {
    vi.stubGlobal('Capacitor', {
      isNativePlatform: () => false,
      getPlatform: () => 'web',
    })
    expect(isNative()).toBe(false)
  })

  it('survives a malformed or partial bridge object', () => {
    vi.stubGlobal('Capacitor', {})
    expect(isNative()).toBe(false)
    expect(getPlatform()).toBe('web')

    vi.stubGlobal('Capacitor', { isNativePlatform: () => { throw new Error('boom') } })
    expect(isNative()).toBe(false)
  })
})

describe('saveExport', () => {
  let clicked: { download: string; href: string } | null = null

  beforeEach(() => {
    clicked = null
    vi.stubGlobal('Blob', class { constructor(public parts: unknown[]) {} } as unknown as typeof Blob)
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} })
    vi.stubGlobal('document', {
      createElement: () => ({
        set download(v: string) { this._d = v },
        get download() { return this._d },
        href: '',
        _d: '',
        click() { clicked = { download: this._d, href: this.href } },
      }),
    })
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('falls back to a browser download when not running natively', async () => {
    const { saveExport } = await import('./fileExport')
    const result = await saveExport('fittrack-export-2026-09-09.json', '{"profile":{}}')
    expect(result.via).toBe('downloaded')
    expect(clicked?.download).toBe('fittrack-export-2026-09-09.json')
  })
})
