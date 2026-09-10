# Architecture review: Phase 2 status and Android readiness

Written after the MVP, as a review of what the current architecture supports
and what has to change next.

## Phase 2 — already delivered

The MVP overshot the Phase 1 scope. These Phase 2 items shipped with it:

| Item | Where |
| --- | --- |
| Reminders | `services/notifications.ts`, `pages/SettingsPage.tsx` |
| State-aware notifications | `services/smartNotifications.ts`, `services/notificationScheduler.ts` |
| Smart suggestions | `services/suggestions.ts` (13 rules, tone-tested) |
| Advanced analytics | `pages/AnalyticsPage.tsx` — 4 periods incl. custom range, 8 charts |
| Insights | `services/insights.ts` — 9 trend detectors |
| Custom foods & meals | `AddFoodPage` create tab, `FoodPage` save-as-meal |
| Goals | Onboarding + `SettingsPage` goals section |
| PWA support | `vite-plugin-pwa`, manifest, service worker, generated icons |

## Phase 2 — what genuinely remains

**1. Notification reliability on the web.** The current web channel only fires
while a tab is alive. Real background delivery needs the service worker plus
the Push API, which requires a push server — so on the web this stays
best-effort. This is precisely why the Capacitor path matters; see below.

**2. Food API integration.** `foodRepository` is already the seam. What is
missing is a caching layer and an offline-first merge policy so remote results
don't degrade the offline experience. Suggested shape: keep the seed list as
the always-available tier, cache remote hits in a new `foodCache` store, and
have `search()` race local against remote with a short timeout.

**3. Barcode scanning.** Needs a camera API. On Android this is
`@capacitor-mlkit/barcode-scanning`; on the web, `BarcodeDetector` with a
manual-entry fallback. It plugs into `AddFoodPage` as a fourth tab.

**4. Data volume.** The store loads every record into memory at boot. That is
correct at this scale — a year of logging is well under a megabyte — but past
roughly two years it should move to windowed loading. `repo.getMeals(from, to)`
already exists and is indexed by date, so the change is confined to
`doHydrate` and the selectors.

**5. Recipes.** `CustomMeal` covers saved combinations, but not per-serving
recipes (cook 6 portions, log 1). Needs a `servings` field on `CustomMeal` and
a divisor at log time.

## Phase 3 — Android via Capacitor

> **Status: done.** The Android project is committed under `android/` and the
> native integration lives in `src/services/native/`. Build and signing
> instructions are in [ANDROID.md](ANDROID.md). The notes below record the
> reasoning behind that work; where they describe steps, those steps are now
> complete.

### What already works unchanged

These were deliberate choices made during the MVP, not conveniences:

- **`HashRouter`** — no server rewrite rules; works from the `file://`-style
  origin a WebView serves.
- **`base: './'` in `vite.config.ts`** — all asset URLs are relative.
- **IndexedDB** — fully supported in Android System WebView, with the
  localStorage fallback covering restricted configurations.
- **No exotic browser APIs.** The only optional API is `Notification`, and it
  sits behind the `NotificationChannel` interface.
- **`env(safe-area-inset-*)`** already applied to the nav, sheets and headers.
- **Touch targets** are ≥44 px throughout; inputs are 16 px so the WebView
  never zooms on focus.

### Concrete steps

```bash
npm i -D @capacitor/cli
npm i @capacitor/core @capacitor/android \
      @capacitor/local-notifications @capacitor/preferences @capacitor/share
npx cap init FitTrack app.fittrack.mobile --web-dir=dist
npm run build && npx cap add android && npx cap sync
```

**0. Notification relevance on native.** Worth reading before the section
below, because it is the one place the new smart-notification design meets a
platform constraint.

On the web, a queued notification is re-checked against live state the instant
before it displays, so a nudge is dropped if the user has already acted. A
native scheduled notification cannot do that: Android fires pre-baked text
without waking the app.

The design already accommodates this. `NotificationRelevance` is a serialisable
data descriptor rather than a closure, and the scheduler rebuilds the entire
queue from current state on every store mutation. So on Android:

- Carry the relevance descriptor in the notification's `extra` payload.
- Cancel and re-register the queue on every store change and on app resume —
  `LocalNotifications.cancel()` takes the ids the plan already assigns.

Because logging only ever happens *inside* this app, a re-plan on every
mutation covers essentially every case where a notification would have gone
stale. The residual gap is a day boundary crossed while the app is closed,
which the existing 15-minute re-plan interval and the resume hook both close.

**1. Native notifications.** Add `services/notificationsCapacitor.ts`
implementing `NotificationChannel` against `LocalNotifications`, then make the
export in `notifications.ts` platform-conditional:

```ts
export const notifications: NotificationChannel =
  Capacitor.isNativePlatform() ? capacitorChannel
  : webChannel.isSupported() ? webChannel
  : new NoopChannel()
```

`buildSchedule()` already produces plain `{id, title, body, at}` objects, which
map directly onto `LocalNotifications.schedule()`. Nothing else changes.
Android 13+ additionally needs the `POST_NOTIFICATIONS` runtime permission —
`requestPermission()` is already the single place that asks.

For recurring reminders, prefer Capacitor's native `repeats`/`every` schedule
over the current approach of queuing the next six interval slots; the queueing
exists only because web timers die with the tab.

Note that smart suggestions should *not* use native `repeats` — their text is
computed from the day's numbers and must be re-registered daily.

**2. Export/import.** The current export uses an `<a download>` blob, which a
WebView will not honour. Swap in `@capacitor/filesystem` + `@capacitor/share`
behind a small `saveFile()` helper — the only call site is `DataSection` in
`SettingsPage.tsx`.

**3. Back button.** Register a hardware back handler that pops the router
history and exits at the root, otherwise Android backs out of the app from any
screen.

**4. Steps.** Currently manual entry. Health Connect
(`@kiwi-health/capacitor-health-connect`) can populate them automatically;
`setSteps(date, n)` is already the single write path, so the integration is a
background sync that calls it.

**5. Storage.** IndexedDB works as-is. If WebView data clearing proves a
problem in the field, add a `PreferencesRepository` implementing the same
`Repository` interface — no caller changes.

**6. Icons and splash.** `public/icons/` holds 192/512/maskable PNGs generated
for the PWA. Run `@capacitor/assets` to produce the Android density buckets
and splash screens from the same source.

**7. Build.**

```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleRelease   # APK
cd android && ./gradlew bundleRelease     # AAB for Play
```

Signing config goes in `android/app/build.gradle` with the keystore kept out of
version control.

### What would need rework

Only one thing: **the `<a download>` export**, covered above. Everything else in
the current codebase runs unchanged in a WebView.

## Known limitations

- Calorie burn is an MET-based estimate; individual expenditure varies and the
  UI labels it as an estimate everywhere.
- BMR/TDEE use population-level equations and are starting points, not
  measurements.
- Steps are entered manually until Health Connect is wired up.
- Web reminders only fire while the app is open — the Capacitor path is the
  fix, not a web workaround.
- Food nutrition figures are rounded reference values for common preparations,
  not brand-specific.
