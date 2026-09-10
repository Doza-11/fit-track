import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { startNotificationScheduler } from '@/services/notificationScheduler'
import { useAndroidBackButton } from '@/services/native/androidBackButton'
import { useTheme } from '@/hooks/useTheme'
import { AppLayout } from '@/layouts/AppLayout'
import { LogSheets } from '@/components/LogSheets'
import { ErrorState, Spinner } from '@/components/ui'
import { Dashboard } from '@/pages/Dashboard'
import { FoodPage } from '@/pages/FoodPage'
import { AddFoodPage } from '@/pages/AddFoodPage'
import { WorkoutPage } from '@/pages/WorkoutPage'
import { WorkoutSessionPage } from '@/pages/WorkoutSessionPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { HistoryPage } from '@/pages/HistoryPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { SettingsPage } from '@/pages/SettingsPage'

/** Screens fully own their scroll position; restore the top on navigation. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  const status = useStore((s) => s.status)
  const error = useStore((s) => s.error)
  const profile = useStore((s) => s.profile)
  const hydrate = useStore((s) => s.hydrate)

  useTheme(profile?.theme)
  // No-op off Android; registered once here rather than per page.
  useAndroidBackButton()

  useEffect(() => { void hydrate() }, [hydrate])

  // Keeps the notification queue in step with what the user has logged.
  useEffect(() => {
    if (status !== 'ready') return
    return startNotificationScheduler()
  }, [status])

  if (status === 'loading') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-bg">
        <Spinner label="Loading your data" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-bg">
        <ErrorState
          message={error ?? 'Your data could not be loaded.'}
          onRetry={() => void hydrate()}
        />
      </div>
    )
  }

  // Everything depends on targets from onboarding, so it gates the whole app.
  if (!profile) {
    return (
      <>
        <ScrollToTop />
        <Routes>
          <Route path="*" element={<OnboardingPage />} />
        </Routes>
      </>
    )
  }

  return (
    <>
      <ScrollToTop />
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/food" element={<FoodPage />} />
          <Route path="/food/add" element={<AddFoodPage />} />
          <Route path="/workout" element={<WorkoutPage />} />
          <Route path="/workout/new" element={<WorkoutSessionPage />} />
          <Route path="/workout/:id" element={<WorkoutSessionPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/history/:date" element={<HistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings/:section" element={<SettingsPage />} />
          <Route path="/onboarding" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
      <LogSheets />
    </>
  )
}
