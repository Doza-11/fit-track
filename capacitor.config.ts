import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor wraps the existing Vite build — it is a packaging layer, not a
 * second app. `webDir: 'dist'` reuses `npm run build` output as-is, which
 * already sets `base: './'` so every asset resolves from the WebView's local
 * origin without a server. The app's `HashRouter` means routing needs no URL
 * rewriting either.
 */
const config: CapacitorConfig = {
  appId: 'com.divyamoza.fittrack',
  appName: 'FitTrack',
  webDir: 'dist',
  android: {
    // The web app paints its own dark ground (see index.html). Matching it
    // here avoids a white flash between the splash screen and first paint.
    backgroundColor: '#0b1120',
  },
}

export default config
