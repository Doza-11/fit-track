# Building FitTrack for Android

Capacitor wraps the existing Vite build in an Android WebView. There is no
second codebase: `npm run build` produces `dist/`, and the APK ships that
directory as local assets. The web and PWA builds are unaffected.

```
React + Vite ──► dist/ ──► Capacitor ──► Android WebView ──► APK
                                                              │
                                              IndexedDB ◄─────┴─────► localStorage
                                              (per device, no sync)
```

## Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| Node | 20+ | |
| **JDK** | **21** | Not 22+. Gradle 8.14.3 and AGP 8.13 target Java 21; a newer JDK fails the build. |
| Android Studio | Ladybug or newer | Supplies the SDK, platform-tools and an emulator |
| Android SDK | Platform 36, Build-Tools 36 | `compileSdk`/`targetSdk` are 36 |
| Min Android | 7.0 (API 24) | `minSdkVersion = 24` |

Set `JAVA_HOME` to a JDK 21 install and make sure `ANDROID_HOME` points at the
SDK (Android Studio does this for you; a `local.properties` with
`sdk.dir=/path/to/sdk` inside `android/` also works and is git-ignored).

Verify before building:

```bash
java -version   # expect 21.x
echo $ANDROID_HOME
```

## Installation

```bash
npm install
```

Capacitor and the four plugins it uses are already in `package.json`:
`@capacitor/core`, `@capacitor/android`, `@capacitor/local-notifications`,
`@capacitor/filesystem`, `@capacitor/share`, `@capacitor/app`.

The `android/` project is committed, so there is no `cap add` step on a fresh
clone.

## Development build

```bash
npm run android:sync    # vite build + cap sync android
npm run android:open    # opens the project in Android Studio
```

Then press Run in Android Studio, or go straight to a connected device:

```bash
npm run android:run
```

Re-run `npm run android:sync` after **any** web change — Capacitor copies
`dist/` into the APK's assets, so the native project does not pick up edits on
its own.

To debug the WebView, open `chrome://inspect` in desktop Chrome while the app
is running.

## Release APK build

```bash
npm run android:apk
# → android/app/build/outputs/apk/release/app-release.apk
```

Or an App Bundle, if you ever need one for Play:

```bash
npm run android:aab
# → android/app/build/outputs/bundle/release/app-release.aab
```

Both are equivalent to running Gradle directly:

```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleRelease
```

Without a keystore configured (below) `assembleRelease` still succeeds but
produces an **unsigned** APK, which Android will refuse to install.

## Signing

Signing is read from `android/keystore.properties`, which is git-ignored.
`android/keystore.properties.example` shows the shape.

**1. Create a keystore** (once — keep it safe; losing it means you can never
update an installed app in place):

```bash
keytool -genkey -v -keystore ~/keystores/fittrack-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias fittrack
```

**2. Store it outside the repository.** `~/keystores/` is a good default.
Never put a `.jks`/`.keystore` inside the project — `.gitignore` blocks the
common cases, but keeping it out entirely is safer.

**3. Point the build at it** — create `android/keystore.properties`:

```properties
storeFile=/Users/you/keystores/fittrack-release.jks
storePassword=...
keyAlias=fittrack
keyPassword=...
```

**4. Build.** `android/app/build.gradle` picks the file up automatically and
applies `signingConfigs.release`. If the file is absent, the release build
silently stays unsigned, so a fresh clone needs no secrets to compile.

Never commit `keystore.properties`, the keystore itself, or these passwords.

## Installing the APK on a phone

Via USB, with developer options and USB debugging enabled:

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Or copy the `.apk` to the device and open it — Android will ask you to allow
installation from that source. Each install keeps its own IndexedDB, so every
device holds independent data with no synchronisation between them.

To upgrade an existing install in place, the new APK must be signed with the
**same** keystore and have a higher `versionCode` (`android/app/build.gradle`).

## What is native, and what is not

Only three integration points exist, all under `src/services/native/`:

| File | Replaces | Why |
| --- | --- | --- |
| `notifications.ts` | Browser `Notification` API | An OS-scheduled alarm fires with the app closed |
| `fileExport.ts` | `<a download>` | WebViews ignore download links; uses Filesystem + Share instead |
| `androidBackButton.ts` | — | Maps the hardware Back key onto router history |
| `platform.ts` | — | Detects native at runtime |

Everything else is untouched. The `Repository` interface, IndexedDB storage,
calorie maths, charts, reminder scheduling logic and all UI are shared verbatim
between web and Android. `services/notifications.ts` picks a channel at startup
and no caller knows which one is active.

The web build carries **no** Capacitor code: plugins are loaded through dynamic
imports, and `platform.ts` reads Capacitor's injected runtime global rather than
importing `@capacitor/core`, so browsers never download the bridge.

## Permissions

The APK requests only what the reminders feature needs:

| Permission | Source | Purpose |
| --- | --- | --- |
| `INTERNET` | Capacitor | Required for the local WebView origin |
| `POST_NOTIFICATIONS` | local-notifications | Android 13+ runtime prompt for reminders |
| `SCHEDULE_EXACT_ALARM` | local-notifications | Reminders fire at the time set, not whenever Android batches |
| `RECEIVE_BOOT_COMPLETED` | local-notifications | Reminders survive a reboot |
| `WAKE_LOCK` | local-notifications | Deliver while the device is idle |

No location, camera, microphone, contacts, Bluetooth or storage permission is
requested. Exports are written to the app's private cache directory, which
needs no storage permission.

If you disable reminders entirely, all four notification permissions can be
removed by dropping `@capacitor/local-notifications`.

## Known limitations

- **Notification relevance is checked when scheduled, not when it fires.** On
  the web, a queued nudge is re-checked in the instant before it displays and
  dropped if you already logged the meal. A native alarm fires without waking
  the app, so it cannot do that. In practice the gap is tiny: logging only
  happens inside the app, and the scheduler rebuilds the whole queue on every
  change, so a stale notification would need a mutation that never occurred.
  The relevance descriptor still travels in the notification's `extra`.
- **The per-day suggestion cap is approximate on Android.** Nothing observes a
  notification delivered while the app is closed, so the "already sent today"
  count resets — a re-plan later in the day can schedule another suggestion
  beyond the configured maximum. Nothing ever repeats (a checkpoint whose time
  has passed is never rescheduled), so the effect is at most a few extra
  notifications on a very eventful day, not duplicates. Tightening it would
  need delivery tracking that the OS does not report back.
- **Notification small icon** uses the Capacitor default. Android may render it
  as a plain white square. Fix by adding a white-on-transparent silhouette at
  `android/app/src/main/res/drawable/ic_stat_icon.xml` and referencing it via
  `plugins.LocalNotifications.smallIcon` in `capacitor.config.ts`.
- **The service worker is left enabled inside the WebView.** It is redundant
  there — assets are already local — and it duplicates ~425 KB into Cache
  Storage. It was kept because removing it risks the browser PWA and could not
  be tested on a device here. **Watch for this first if the app shows stale
  content after an APK update.** The minimal fix is to stop registering it on
  native: set `injectRegister: null` in the `VitePWA` options and register
  manually in `src/main.tsx` behind `if (!isNative())`.
- **Back button does not close bottom sheets.** Pressing Back with a sheet open
  navigates the route underneath instead of dismissing the sheet. Handling that
  would mean touching every sheet, which was out of scope for a packaging pass.
- **Steps are still entered manually.** Health Connect integration is a
  separate piece of work — see `docs/ROADMAP.md`.
- **`SCHEDULE_EXACT_ALARM` is restricted on Android 14+** for Play-distributed
  apps. It is fine for sideloaded personal builds; publishing would mean
  switching to inexact alarms.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Unsupported class file major version` | JDK is newer than 21 — point `JAVA_HOME` at a JDK 21 |
| `SDK location not found` | Set `ANDROID_HOME`, or add `sdk.dir=` to `android/local.properties` |
| Blank white screen | `dist/` wasn't synced — run `npm run android:sync` |
| Web changes not appearing | Same: Capacitor copies `dist/` only on `cap sync` |
| `INSTALL_PARSE_FAILED_NO_CERTIFICATES` | The release APK is unsigned — configure `keystore.properties` |
| App won't upgrade in place | Different signing key, or `versionCode` not incremented |
