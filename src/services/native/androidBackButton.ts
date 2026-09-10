/**
 * Android hardware back button.
 *
 * Registered once at the app root — never per page. The app uses `HashRouter`,
 * so WebView history and router history are the same stack: going back one
 * entry lands on the previous route (Dashboard, Food, Workout, Analytics,
 * Profile, History, Settings, …). Only at the bottom of that stack does back
 * mean "leave the app", which is what Android users expect.
 */
import { useEffect } from 'react'
import { isNative } from './platform'

export function useAndroidBackButton(): void {
  useEffect(() => {
    if (!isNative()) return

    let remove: (() => void) | undefined
    let cancelled = false

    void (async () => {
      const { App } = await import('@capacitor/app')
      const handle = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          // Let the router handle it; HashRouter reads the popstate.
          window.history.back()
        } else {
          void App.exitApp()
        }
      })
      // The effect may have been torn down while the import was in flight.
      if (cancelled) void handle.remove()
      else remove = () => void handle.remove()
    })()

    return () => {
      cancelled = true
      remove?.()
    }
  }, [])
}
