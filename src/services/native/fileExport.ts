/**
 * Saving an export on Android.
 *
 * The export *data* is produced by the existing `store.exportData()` and is
 * untouched — this only replaces the final delivery step, because a WebView
 * ignores `<a download>`. The file is written to the app's private cache and
 * handed to the Android share sheet, so the user can save it to Drive, Files,
 * email it, or anywhere else. Writing to cache needs no storage permission.
 */
import { isNative } from './platform'

export interface SaveResult {
  /** 'shared' on Android, 'downloaded' in the browser. */
  via: 'shared' | 'downloaded'
}

/**
 * Deliver a generated export to the user by whatever means the platform
 * supports. Throws on failure so the caller can surface it.
 */
export async function saveExport(filename: string, json: string): Promise<SaveResult> {
  if (isNative()) {
    await shareOnNative(filename, json)
    return { via: 'shared' }
  }
  downloadInBrowser(filename, json)
  return { via: 'downloaded' }
}

async function shareOnNative(filename: string, json: string): Promise<void> {
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])

  await Filesystem.writeFile({
    path: filename,
    data: json,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  })

  // The share sheet needs a content:// URI, which FileProvider supplies for
  // the cache directory (declared in the Android manifest's file_paths.xml).
  const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path: filename })

  await Share.share({
    title: 'FitTrack export',
    text: `FitTrack data export — ${filename}`,
    url: uri,
    dialogTitle: 'Save or share your FitTrack data',
  })
}

/** The original browser path, unchanged. */
function downloadInBrowser(filename: string, json: string): void {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // Revoke on the next tick so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Images (the monthly report card) ────────────────────────────────────────

/**
 * Share a generated PNG. Android gets the system share sheet (WhatsApp,
 * Instagram, Photos…); browsers that support sharing files do the same, and
 * the rest download it. Everything is produced on the device.
 */
export async function shareImage(filename: string, dataUrl: string, text: string): Promise<SaveResult> {
  if (isNative()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ])
    // Written as base64 (no encoding option) so the bytes stay binary.
    await Filesystem.writeFile({
      path: filename,
      data: dataUrl.slice(dataUrl.indexOf(',') + 1),
      directory: Directory.Cache,
    })
    const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path: filename })
    await Share.share({ title: text, text, url: uri, dialogTitle: 'Share your report card' })
    return { via: 'shared' }
  }

  const blob = await (await fetch(dataUrl)).blob()
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: text, text })
      return { via: 'shared' }
    } catch (e) {
      // The user closing the share sheet is not an error worth reporting.
      if (e instanceof DOMException && e.name === 'AbortError') return { via: 'shared' }
      throw e
    }
  }
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
  return { via: 'downloaded' }
}
