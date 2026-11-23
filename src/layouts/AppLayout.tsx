/**
 * App shell.
 *
 * Phones and tablets (< 1024 px): scrollable content, a fixed bottom tab bar
 * and a floating `+` button — unchanged from the mobile app.
 *
 * Desktop browsers (≥ 1024 px, Tailwind `lg`): a fixed left sidebar holds the
 * navigation and the Add button, and content gets the full width so pages
 * can lay out in columns. The bottom bar and floating button are hidden.
 */
import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  AppleIcon, CalendarIcon, ChartIcon, DumbbellIcon, HomeIcon, PlusIcon, UserIcon,
} from '@/components/icons'
import { QuickAddSheet } from '@/components/QuickAddSheet'
import { useScrollDirection } from '@/hooks/useScrollDirection'
import { ToastHost } from '@/components/ui'
import { CoachBanner } from '@/components/Coach'
import { useStore } from '@/store/useStore'

const TABS = [
  { to: '/', label: 'Home', Icon: HomeIcon, end: true },
  { to: '/food', label: 'Food', Icon: AppleIcon, end: false },
  { to: '/workout', label: 'Workout', Icon: DumbbellIcon, end: false },
  { to: '/analytics', label: 'Analytics', Icon: ChartIcon, end: false },
  { to: '/profile', label: 'Profile', Icon: UserIcon, end: false },
]

/** History has no bottom-bar slot on phones (it's reached from Home), but fits in the sidebar. */
const SIDEBAR = [
  ...TABS.slice(0, 4),
  { to: '/history', label: 'History', Icon: CalendarIcon, end: false },
  TABS[4],
]

export function AppLayout({ children }: { children: ReactNode }) {
  const [quickAdd, setQuickAdd] = useState(false)
  const { pathname } = useLocation()
  const scrollDir = useScrollDirection()
  const fabHidden = scrollDir === 'down' && !quickAdd

  return (
    <div className="min-h-[100dvh] bg-bg">
      <Sidebar onAdd={() => setQuickAdd(true)} />

      {/* Centred column keeps the phone layout intact; on desktop it widens
          beside the sidebar and each page sets its own max width. */}
      <main
        className="mx-auto w-full max-w-[560px] lg:max-w-none lg:pl-64 app-main"
        style={{
          // Android 15+ (targetSdk 36) draws the WebView edge-to-edge, so
          // content would sit under the status bar. The inset is 0 in a normal
          // browser, leaving the web layout unchanged.
          paddingTop: 'env(safe-area-inset-top)',
        }}
        key={pathname}
      >
        <div className="animate-fade-in lg:px-6 lg:pt-4">{children}</div>
      </main>

      <ToastHost />
      <CoachBanner />

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
        className={`lg:hidden fixed right-4 z-40 w-14 h-14 rounded-full grad-primary text-white
                   shadow-lg shadow-black/40 flex items-center justify-center
                   focusable transition-all duration-300 active:scale-95
                   ${fabHidden ? 'translate-y-24 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 4.75rem)' }}
      >
        <PlusIcon size={27} strokeWidth={2.4} />
      </button>

      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-section/95 backdrop-blur-lg border-t border-line"
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

function Sidebar({ onAdd }: { onAdd: () => void }) {
  const name = useStore((s) => s.profile?.name)
  return (
    <aside
      className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col bg-section border-r border-line px-4 py-6"
      aria-label="Main"
    >
      <div className="flex items-center gap-2.5 px-2 mb-7">
        <img src="./favicon.svg" alt="" className="w-9 h-9 rounded-xl" />
        <span className="text-[19px] font-bold tracking-tight">FitTrack</span>
      </div>

      <button onClick={onAdd} className="btn-primary w-full mb-5">
        <PlusIcon size={19} strokeWidth={2.4} /> Add
      </button>

      <nav className="flex flex-col gap-1">
        {SIDEBAR.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14.5px] font-medium transition-colors focusable
               ${isActive ? 'bg-brand/12 text-brand' : 'text-muted hover:bg-raised hover:text-ink'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={21} strokeWidth={isActive ? 2.2 : 1.8} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-3 pt-4 border-t border-line/70">
        {name && <p className="text-[13px] font-semibold truncate">{name}</p>}
        <p className="text-[11.5px] text-faint leading-snug mt-0.5">
          Your data stays in this browser. Export it from Profile → Data to move between devices.
        </p>
      </div>
    </aside>
  )
}
