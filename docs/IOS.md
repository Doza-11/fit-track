# Building FitTrack for iOS

The same codebase that produces the Android APK also produces an iOS app —
Capacitor treats both as targets of one web build. Nothing in `src/` is
Android-specific except the hardware back-button hook, which is a no-op on iOS.

```
React + Vite ──► dist/ ──┬──► Capacitor Android ──► APK
                         └──► Capacitor iOS     ──► .ipa
```

## Status

The iOS platform is scaffolded and synced (`ios/` is committed). It has **not
been built or run** — that needs Xcode, which is not installed on this machine.

| | |
| --- | --- |
| `@capacitor/ios` installed | ✓ |
| `ios/` project created | ✓ |
| Web assets copied | ✓ |
| All 4 plugins registered | ✓ (via Swift Package Manager) |
| Built / run on a device | ✗ — needs Xcode |

## Prerequisites

| Requirement | Notes |
| --- | --- |
| macOS | Any Apple Silicon or Intel Mac |
| **Xcode 16+** | ~15 GB from the App Store. Command Line Tools alone are not enough. |
| CocoaPods | **Not required.** Capacitor 8 uses Swift Package Manager; there is no Podfile. |
| Apple ID | Free tier works for sideloading, with limits — see Distribution |

After installing Xcode, point the toolchain at it once:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

## Build and run

```bash
npm run ios:sync    # vite build + cap sync ios
npm run ios:open    # opens ios/App/App.xcworkspace in Xcode
```

In Xcode: select a simulator or a connected iPhone, set the signing team under
**Signing & Capabilities**, then Run. Or straight from the CLI:

```bash
npm run ios:run
```

Re-run `npm run ios:sync` after **any** web change — Capacitor copies `dist/`
into the app bundle, so the native project does not pick up edits on its own.

## Distribution — the part that costs money

This is the real difference from Android, where a signed APK can be shared
freely.

| Route | Cost | Limit |
| --- | --- | --- |
| Simulator | Free | Your Mac only |
| Free Apple ID sideload | Free | Expires after **7 days**; the iPhone must be plugged into your Mac to re-sign |
| **Apple Developer Program** | **$99/year** | TestFlight (100 testers, 90-day builds) or App Store |

There is no equivalent of "send someone an APK" on iOS. Sharing with anyone
else in a usable way requires the paid programme.

## What already works, unchanged

The native integration layer is cross-platform, so nothing needed rewriting:

| Feature | iOS behaviour |
| --- | --- |
| Notifications | `@capacitor/local-notifications` supports iOS; the same `{id, title, body, at}` schedule is used |
| Data export | `Filesystem` + `Share` open the iOS share sheet |
| Storage | IndexedDB in WKWebView, with the same localStorage fallback |
| Safe areas | `env(safe-area-inset-*)` is properly populated on iOS, so the notch and home indicator are handled by the CSS already in `AppLayout`. The Android-only `MainActivity.java` inset fix does not apply. |
| Back button | Not applicable — the hook is gated on `isAndroid()` |

## Known gaps for iOS

- **Untested.** None of the above has run on a simulator or device.
- **Notification permission copy** in Settings mentions Android. Cosmetic.
- **App icons and splash** are Capacitor defaults. Generate real ones with
  `npx @capacitor/assets generate --ios` from the existing `public/icons/`.
- **`SCHEDULE_EXACT_ALARM` has no iOS equivalent** — iOS local notifications
  are inherently approximate under Low Power Mode.

## The zero-cost alternative

The app is already an installable PWA. On an iPhone: open it in **Safari** →
Share → **Add to Home Screen**. Full screen, offline, its own storage, no Xcode
and no developer account.

The one significant limitation: **iOS home-screen PWAs cannot schedule local
notifications.** Apple supports only server-sent Web Push (iOS 16.4+), so the
reminder and smart-suggestion system stays silent unless the app is open. If
reminders matter on iPhone, the native build is the only option.
