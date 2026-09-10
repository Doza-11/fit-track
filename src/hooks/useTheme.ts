/**
 * Theme application.
 *
 * The `dark` class on <html> drives Tailwind. "system" follows the OS and
 * keeps following it live; an explicit choice pins the theme and also updates
 * the address-bar colour so the browser chrome matches.
 */
import { useEffect } from 'react'
import type { ThemePref } from '@/types'

const DARK_BG = '#0b1120'
const LIGHT_BG = '#f7f8fa'

export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
  const dark = pref === 'dark' || (pref === 'system' && prefersDark)

  root.classList.toggle('dark', dark)
  root.classList.toggle('theme-forced', pref !== 'system')
  root.style.colorScheme = dark ? 'dark' : 'light'

  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? DARK_BG : LIGHT_BG)
}

export function useTheme(pref: ThemePref | undefined) {
  useEffect(() => {
    const chosen = pref ?? 'system'
    applyTheme(chosen)
    if (chosen !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [pref])
}
