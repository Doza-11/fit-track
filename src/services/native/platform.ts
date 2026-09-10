/**
 * Platform detection for the native integration layer.
 *
 * This deliberately reads Capacitor's injected runtime global instead of
 * importing `@capacitor/core`. A static import would pull the bridge into the
 * main chunk — roughly 8 kB gzipped of code the browser build can never use —
 * because `services/notifications.ts` loads on every startup. Reading the
 * global keeps the web/PWA bundle exactly as it was, while on Android the
 * bridge is still loaded normally through the plugin chunks (each plugin
 * imports `@capacitor/core` itself).
 *
 * `window.Capacitor` is part of Capacitor's documented runtime contract and is
 * injected by the native bridge before app code runs.
 */

interface CapacitorGlobal {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
}

function bridge(): CapacitorGlobal | undefined {
  return (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor
}

export function isNative(): boolean {
  try {
    return bridge()?.isNativePlatform?.() === true
  } catch {
    return false
  }
}

export function getPlatform(): string {
  try {
    return bridge()?.getPlatform?.() ?? 'web'
  } catch {
    return 'web'
  }
}

export function isAndroid(): boolean {
  return getPlatform() === 'android'
}
