# FitTrack on the web

The web app is the same code as the Android and iOS apps: `npm run build`
produces a static site in `dist/` that runs in any modern browser. There is no
server and nothing to configure. Every feature works offline, and all data stays
in the browser.

## Layouts

| Screen width | Layout |
| --- | --- |
| Under 1024 px (phones, tablets) | The mobile app: bottom tab bar, floating **+** button, sheets that slide up |
| 1024 px and wider (laptops, desktops) | Left sidebar with navigation and **Add**; Dashboard, History, Food and Analytics in columns; sheets open as centred dialogs |

Forms (Add food, workouts, settings) keep a comfortable reading width on large
screens. Mouse users get hover states, and **Esc** closes any dialog.

## Deploying

### GitHub Pages (already set up)

Every push to `main` runs `.github/workflows/deploy.yml`:

1. `npm ci`, then `npm test`. A failing test stops the deploy.
2. `npm run build`.
3. The `dist/` folder is pushed to the `gh-pages` branch.

The repository's **Settings → Pages** must say *Deploy from a branch →
`gh-pages` / `(root)`*. The site is then live at
`https://<user>.github.io/fit-track/`. You can also deploy by hand from the
**Actions** tab with **Run workflow**.

### Any other static host

`vite.config.ts` uses `base: './'` and the app uses hash routing (`/#/food`), so
the build works from any folder or sub-path with no rewrite rules.

| Host | Build command | Output directory |
| --- | --- | --- |
| Netlify | `npm run build` | `dist` |
| Vercel | `npm run build` | `dist` |
| Cloudflare Pages | `npm run build` | `dist` |
| Your own server / S3 | `npm run build`, then upload `dist/` | — |

To try a production build locally:

```bash
npm run build && npm run preview
```

## Installing as an app

The site is a Progressive Web App (PWA):

- **Chrome or Edge (desktop or Android):** use the install icon in the address
  bar, or the menu's *Install FitTrack*.
- **Safari on iPhone:** Share → *Add to Home Screen*.

After the first visit, the installed app opens and works without a connection.

## Your data on the web

- Everything is stored in the browser's IndexedDB, separately for each browser
  and device. Your phone app and your laptop don't share data automatically.
- To move data, go to **Profile → Data → Export** on one device, then
  **Import** on the other.
- Clearing the browser's site data deletes the app's data too, so export a
  backup now and then.

## Known differences from the phone apps

- **Reminders and coach messages:** browsers only show notifications while the
  site is open, or installed as a PWA and running. The Android app schedules
  them natively.
- **Sharing:** the report card and data export use the browser's share sheet
  where available; otherwise the file is downloaded.
