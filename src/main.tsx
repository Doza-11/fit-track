import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'
import { isNative } from './services/native/platform'

/**
 * HashRouter rather than BrowserRouter: it needs no server rewrite rules and
 * works unchanged from the `file://`-style origin a Capacitor WebView serves.
 */
/**
 * Service worker handling.
 *
 * In a browser the PWA registers as normal — offline support and installability
 * are unchanged. Inside the Capacitor WebView it is skipped: the assets are
 * already on disk, so the cache buys nothing, and a precache left over from a
 * previous APK will happily serve the old bundle after an update. Anything
 * registered by an earlier build is torn down here so upgrades self-heal.
 */
if (isNative()) {
  void (async () => {
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.() ?? []
      await Promise.all(regs.map((r) => r.unregister()))
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch {
      // Nothing registered, or the API is unavailable — either is fine.
    }
  })()
} else {
  void import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => { /* PWA support is optional */ })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
