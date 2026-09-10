# FitTrack

A mobile-first fitness and nutrition tracker. Local-first, offline-capable, and
structured so it can be packaged as an Android APK with Capacitor without
reworking the architecture.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 100 unit tests
npm run build      # production build into dist/
```

## What it does

| Area | Capability |
| --- | --- |
| Dashboard | Calorie ring, macro progress, burn/water/steps/weight tiles, time-of-day suggestion, meal and workout status |
| Food | 218-food seeded database with search, serving/quantity selection, custom foods, saved meals, repeat-a-meal, per-item editing |
| Workouts | 83 exercises, set/rep/weight logging, cardio duration & distance, MET-based burn estimates, routines, personal records |
| Goals | BMR/TDEE onboarding, recommended calorie and macro targets, manual override, water and step targets |
| Suggestions | Rule engine keyed to intake, remaining calories, protein, activity, hydration and time of day |
| Reminders | Per-meal, workout, hydration and daily-summary reminders, suppressed automatically once you've logged the thing they ask about |
| Smart notifications | State-aware nudges chosen from the day's numbers — protein below your own usual, calories still available (with treats from the food database that fit), hydration or movement lagging — with quiet hours and a daily cap |
| Analytics | 7/30/90-day and custom ranges; calorie, macro, step, burn, duration and weight charts; cardio-vs-strength split |
| Insights | Trend detection across protein, steps, weekend patterns, adherence, weight and logging consistency |
| History | Month calendar with per-day detail, editing and deletion |
| Profile | Personal info, targets, units, theme, weight history, export/import, reset |

## Android & iOS

The same codebase ships as an Android APK and an iOS app via Capacitor — a packaging layer,
not a fork. `npm run build` output is loaded from the APK's assets, so the web
and PWA builds are unaffected and browsers download no Capacitor code.

```bash
npm run android:sync    # build + copy into the native project
npm run android:open    # Android Studio
npm run android:apk     # signed release APK
```

```bash
npm run ios:sync        # same flow for iOS
npm run ios:open        # Xcode
```

Only four small files under `src/services/native/` are platform-specific
(notifications, file export, back button, platform detection), and only the
back button is Android-only. Setup, signing and known limitations:
[docs/ANDROID.md](docs/ANDROID.md) · [docs/IOS.md](docs/IOS.md).

Android is built and verified on a device; iOS is scaffolded but needs Xcode.

## Architecture

Business logic is fully separated from presentation. Nothing in `src/pages` or
`src/components` computes nutrition, energy or trends.

```
src/
├── types/         Domain models (User, Food, Meal, Workout, …)
├── data/          Seeded foods (130) and exercises (83)
├── utils/         calculations.ts — pure BMR/TDEE/macro/trend maths; date.ts
├── services/      idb.ts, repository.ts, foodRepository.ts,
│                  exerciseRepository.ts, suggestions.ts, insights.ts,
│                  notifications.ts
├── store/         Zustand store + derived selectors
├── charts/        Dependency-free SVG bar / line / donut charts
├── components/    UI primitives, icons, sheets
├── layouts/       App shell, bottom navigation, quick-add
├── hooks/         Theme, scroll direction, global log sheets
└── pages/         Screens only
```

### Key decisions

**Storage goes through one interface.** Everything persists via the
`Repository` interface in `services/repository.ts`. There are two
implementations — IndexedDB, and a localStorage fallback for private-browsing
and restricted WebViews. Adding a backend or Capacitor-native storage means
writing a third implementation, not touching callers.

**Food lookup is already API-shaped.** `foodRepository.search()` is
asynchronous-ready and reads the bundled seed list plus user-created foods.
Swapping in a remote food API is a change to that one file.

**Notifications are a channel.** `NotificationChannel` abstracts scheduling.
The web build uses `setTimeout` plus the Notification API (with a
visibility-change catch-up for throttled background tabs). An Android build
registers the same computed schedule with `@capacitor/local-notifications`.

**Notifications are planned from state, not patched.** `notificationScheduler`
rebuilds the whole queue on every store change, so logging lunch removes the
lunch reminder rather than leaving a stale timer behind. Each queued item
carries a `NotificationRelevance` — a serialisable descriptor, not a closure,
so it can travel to a native scheduler — which is re-checked immediately before
display. Nothing is ever delivered about something the user has already done.

**Nutrition scales from one source of truth.** Foods store nutrition per 100 g;
every portion is derived. Logged items denormalise their food name and
nutrients so history stays intact if a food is later edited or deleted.

**No chart library.** Four chart shapes did not justify ~100 kB gzipped. The
SVG components in `src/charts` read from real tracked data, theme through CSS
variables, and render unlogged days as gaps rather than zeroes.

**Dependencies:** react, react-dom, react-router-dom, zustand. That's it.
Total bundle: **106 kB gzipped**.

## Calculations

All in `src/utils/calculations.ts`, all pure, all unit-tested:

- `calculateBMR` — Mifflin–St Jeor
- `calculateTDEE` — BMR × activity factor
- `calculateDailyCalorieTarget` — goal-based, deficit capped at 25% of TDEE, floored at a safe minimum
- `calculateMacroTargets` — protein per kg by goal, fat ~27–28% of energy, carbs as remainder
- `calculateRemainingCalories` — target − consumed + burned
- `calculateMacroProgress`, `scaleNutrients`, `sumNutrients`
- `calculateWorkoutCalories` / `estimateWorkoutCalories` — MET × kg × hours, with session time shared across untimed strength blocks
- `calculateWeeklyAverage` — ignores unlogged days
- `calculateWeightTrend` — least-squares weekly rate plus a 7-point moving average
- `estimate1RM` (Epley), `workoutVolume`, `calculateStreak`, `calorieAdherence`

Every energy figure derived from activity is an **estimate** and is labelled as
such in the UI. The app presents no medical advice.

## Notifications

Two kinds, deliberately separated:

**Fixed reminders** are times the user chose. They fire on schedule, but are
dropped if already satisfied, and their copy is filled in with real numbers —
the daily summary reports the actual day rather than a generic prompt.

**Smart suggestions** are chosen from the day's state at a set of checkpoints:

| Rule | Fires when |
| --- | --- |
| `under_eating` | Intake is far below target late in the day |
| `low_protein` | Protein is low against target **and** against the user's own recent average |
| `calorie_room` | Calories remain, with real foods from the database that fit inside them |
| `hydration` | Water is behind the expected pace |
| `move` | Steps well below usual with no workout logged |
| `good_day` | On target with a workout done |

"Low" is always relative to the individual. Someone who habitually eats 60 g of
protein against a 140 g target is not told about it daily — the rule requires
today to be unusual for *them*, not merely short of a number.

Restraint is enforced on the whole plan, not per rule: quiet hours (22:00–08:00
by default), a daily cap that counts what has already been delivered, and a
90-minute minimum gap. Checkpoint times are spaced at least that far apart so
one rule can't permanently shadow its neighbour. Settings offers a preview of
exactly what is queued for the rest of today.

## Suggestion tone

`services/suggestions.ts` is governed by explicit constraints, enforced by
tests in `suggestions.test.ts` that assert against banned phrasing across every
reachable message:

- Never shame the user for what they ate
- Never frame movement as compensating for food
- Movement suggestions stay optional in wording
- No medical claims
- Calorie figures phrased approximately

## Testing

100 tests covering the calculation layer, the suggestion engine (including
tone), reminder scheduling and chart axis scaling.

```bash
npm test
```

## Data

Everything is stored locally in IndexedDB. Nothing is transmitted. Export
produces a versioned JSON file that import restores.
