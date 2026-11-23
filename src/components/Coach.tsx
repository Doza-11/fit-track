/**
 * Where coach messages appear.
 *
 * - `CoachBanner`: pops up the moment a message is triggered (after logging a
 *   meal, or at an evening/night/Sunday check), above the bottom bar.
 * - `CoachCard`: the Dashboard's record of today's latest message, so one that
 *   arrived while you were elsewhere is still there to read.
 */
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { CoachMessage } from '@/services/coach'
import {
  dismissCoachMessage, liveCoachMessage, loadFeed, onCoachMessages, type CoachFeed,
} from '@/services/coachRuntime'
import { useStore } from '@/store/useStore'
import { CloseIcon } from './icons'

const BANNER_MS = 9000

export function CoachBanner() {
  const [shown, setShown] = useState<CoachMessage | null>(null)
  // The Dashboard already shows today's message in its card.
  const onDashboard = useLocation().pathname === '/'

  useEffect(() => onCoachMessages((fresh) => {
    // The engine already chose and ordered these; the banner shows the top one.
    if (fresh[0]) setShown(fresh[0])
  }), [])

  useEffect(() => {
    if (!shown) return
    const t = window.setTimeout(() => setShown(null), BANNER_MS)
    return () => window.clearTimeout(t)
  }, [shown])

  if (!shown || onDashboard) return null
  return (
    <div
      className="fixed inset-x-0 lg:left-64 z-[55] px-4 flex justify-center pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 9rem)' }}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto max-w-[420px] w-full animate-pop-in">
        <CoachBody message={shown} onClose={() => setShown(null)} elevated />
      </div>
    </div>
  )
}

/** Today's latest undismissed coach message, or nothing. */
export function useCoachFeed(): CoachMessage | null {
  const [feed, setFeed] = useState<CoachFeed>(() => loadFeed())
  useEffect(() => onCoachMessages((_fresh, next) => setFeed({ ...next })), [])
  // Re-render on any data change so the figures stay current.
  useStore((s) => s.meals)
  useStore((s) => s.workouts)
  useStore((s) => s.steps)
  const visible = feed.messages.filter((m) => !feed.dismissed.includes(m.id))
  // Newest first; skip any that no longer apply (e.g. protein now reached).
  for (let i = visible.length - 1; i >= 0; i--) {
    const live = liveCoachMessage(visible[i])
    if (live) return live
  }
  return null
}

export function CoachCard({ message }: { message: CoachMessage }) {
  return (
    <div className="mb-3 animate-pop-in">
      <CoachBody message={message} onClose={() => dismissCoachMessage(message.id)} />
    </div>
  )
}

function CoachBody({ message, onClose, elevated }: {
  message: CoachMessage; onClose: () => void; elevated?: boolean
}) {
  const positive = message.tone === 'positive'
  return (
    <div
      className={`card flex gap-3 ${positive ? 'border-achievement/35' : 'border-brand/30'}
        ${elevated
          // Floating over content, so it needs an opaque background.
          ? 'bg-raised shadow-xl shadow-black/30'
          : positive ? 'bg-achievement/[0.07]' : 'bg-brand/[0.06]'}`}
    >
      <span className="text-[20px] leading-none pt-0.5" aria-hidden="true">{message.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand mb-0.5">Coach</p>
        <h3 className="text-[14.5px] font-semibold mb-1 leading-snug">{message.title}</h3>
        <p className="text-[13px] text-muted leading-relaxed">{message.body}</p>
      </div>
      <button
        onClick={onClose}
        className="tap -mr-2 -mt-2 text-faint focusable rounded-lg shrink-0"
        aria-label="Dismiss coach message"
      >
        <CloseIcon size={16} />
      </button>
    </div>
  )
}
