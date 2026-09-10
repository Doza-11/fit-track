/**
 * App shell: scrollable content, a fixed bottom tab bar, and the quick-add
 * button. Content gets bottom padding equal to the nav height plus the safe
 * area so nothing hides behind the bar on gesture-nav phones.
 */
import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  AppleIcon, ChartIcon, DumbbellIcon, HomeIcon, PlusIcon, UserIcon,
} from '@/components/icons'
import { QuickAddSheet } from '@/components/QuickAddSheet'
import { useScrollDirection } from '@/hooks/useScrollDirection'
import { ToastHost } from '@/components/ui'

const TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/food', label: 'Food', Icon: AppleIcon, end: false },
  { to: '/workout', label: 'Workout', Icon: DumbbellIcon, end: false },
  { to: '/analytics', label: 'Analytics', Icon: ChartIcon, end: false },
  { to: '/profile', label: 'Profile', Icon: UserIcon, end: false },
]

export function AppLayout({ children }: { children: ReactNode }) {
  const [quickAdd, setQuickAdd] = useState(false)
  const { pathname } = useLocation()
  const scrollDir = useScrollDirection()
  const fabHidden = scrollDir === 'down' && !quickAdd

  return (
    <div className="min-h-[100dvh] bg-bg">
      {/* Centred column keeps the phone layout intact on desktop. */}
      <main
        className="mx-auto w-full max-w-[560px]"
        style={{
          // Android 15+ (targetSdk 36) draws the WebView edge-to-edge, so
          // content would sit under the status bar. The inset is 0 in a normal
          // browser, leaving the web layout unchanged.
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 8.5rem)',
        }}
        key={pathname}
      >
        <div className="animate-fade-in">{children}</div>
      </main>

      <ToastHost />

      {/*
        The add button floats above the bar rather than occupying a tab slot,
        so all five destinations stay reachable while `+` stays the most
        prominent control and sits within thumb reach. It tucks away while the
        user scrolls down so it never sits on top of what they are reading.
      */}
      <button
        onClick={() => setQuickAdd(true)}
        aria-label="Quick add"
        aria-hidden={fabHidden}
        tabIndex={fabHidden ? -1 : 0}
        className={`fixed right-4 z-40 w-14 h-14 rounded-full grad-primary text-white
                   shadow-lg shadow-black/40 flex items-center justify-center
                   focusable transition-all duration-300 active:scale-95
                   ${fabHidden ? 'translate-y-24 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 4.75rem)' }}
      >
        <PlusIcon size={27} strokeWidth={2.4} />
      </button>

      <nav
        className="fixed bottom-0 inset-x-0 z-40 bg-section/95 backdrop-blur-lg border-t border-line"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Main"
      >
        <div className="mx-auto max-w-[560px] grid grid-cols-5">
          {TABS.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-[3px] pt-2 pb-1.5 min-h-[56px]
                 transition-colors focusable ${isActive ? 'text-brand' : 'text-faint'}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={23} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="text-[10.5px] font-medium tracking-tight">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <QuickAddSheet open={quickAdd} onClose={() => setQuickAdd(false)} />
    </div>
  )
}
