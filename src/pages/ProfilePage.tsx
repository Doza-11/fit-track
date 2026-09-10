/** Profile hub — identity, headline stats and links into each settings area. */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, selectDailySummary } from '@/store/useStore'
import { Card, List, Row, Screen } from '@/components/ui'
import {
  BellIcon, ChevronRight, DownloadIcon, MoonIcon, ScaleIcon, SunIcon,
  TargetIcon, UserIcon,
} from '@/components/icons'
import {
  ACTIVITY_LABELS, GOAL_LABELS, bmi, calculateBMR, calculateStreak,
  calculateTDEE, calculateWeightTrend, cmToFtIn, displayWeight,
} from '@/utils/calculations'
import { lastNDays, today } from '@/utils/date'

export function ProfilePage() {
  const navigate = useNavigate()
  const profile = useStore((s) => s.profile)!
  const weights = useStore((s) => s.weights)
  const meals = useStore((s) => s.meals)
  const workouts = useStore((s) => s.workouts)
  const reminders = useStore((s) => s.reminders)
  const state = useStore()

  const streak = useMemo(() => {
    const dates = new Set(
      lastNDays(120)
        .filter((d) => selectDailySummary(state, d).hasAnyEntry),
    )
    return calculateStreak(dates, today())
  }, [state])

  const trend = useMemo(() => calculateWeightTrend(weights), [weights])
  const bmr = calculateBMR(profile)
  const tdee = calculateTDEE(bmr, profile.activityLevel)
  const unit = profile.units.weight
  const activeReminders = reminders.filter((r) => r.enabled).length

  const height = profile.units.height === 'ft'
    ? (() => { const { ft, inches } = cmToFtIn(profile.heightCm); return `${ft}'${inches}"` })()
    : `${profile.heightCm} cm`

  return (
    <Screen title="Profile">
      <Card className="mb-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-brand/12 text-brand flex items-center justify-center shrink-0">
          <UserIcon size={28} />
        </div>
        <div className="min-w-0">
          <h2 className="text-[18px] font-bold truncate">{profile.name}</h2>
          <p className="text-[12.5px] text-muted">
            {profile.age} · {height} · {displayWeight(profile.weightKg, unit)} {unit}
          </p>
          <p className="text-[12px] text-brand font-medium mt-0.5">
            {GOAL_LABELS[profile.goal.type].title}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <MetricCard label="Day streak" value={streak} sub={streak === 1 ? 'day' : 'days'} />
        <MetricCard label="Workouts" value={workouts.filter((w) => !w.inProgress).length} sub="logged" />
        <MetricCard label="Meals" value={meals.length} sub="logged" />
      </div>

      <Card className="mb-4">
        <h3 className="text-[14px] font-semibold mb-3">Your numbers</h3>
        <div className="space-y-2 text-[13px]">
          <NumberRow label="Daily calorie target" value={`${profile.calorieTarget.toLocaleString()} kcal`} note={profile.calorieTargetIsCustom ? 'custom' : 'recommended'} />
          <NumberRow label="Estimated BMR" value={`${bmr.toLocaleString()} kcal`} />
          <NumberRow label="Estimated daily burn" value={`${tdee.toLocaleString()} kcal`} />
          <NumberRow label="Activity level" value={ACTIVITY_LABELS[profile.activityLevel].title} />
          <NumberRow label="BMI" value={String(bmi(profile.weightKg, profile.heightCm))} note="reference only" />
          {trend.current !== undefined && weights.length >= 2 && (
            <NumberRow
              label="Weight trend"
              value={`${trend.ratePerWeek > 0 ? '+' : ''}${trend.ratePerWeek} kg/week`}
            />
          )}
        </div>
        <p className="text-[11px] text-faint mt-3 leading-snug">
          BMR and daily burn are estimates from the Mifflin–St Jeor equation. BMI is a rough
          population-level reference and says nothing about body composition. Neither is medical advice.
        </p>
      </Card>

      <List className="mb-4">
        <Row
          icon={<UserIcon size={19} />} label="Personal information"
          sub="Age, sex, height, weight"
          onClick={() => navigate('/settings/personal')}
          right={<ChevronRight size={18} className="text-faint" />}
        />
        <Row
          icon={<TargetIcon size={19} />} label="Goal & targets"
          sub={`${profile.calorieTarget.toLocaleString()} kcal · P ${profile.macroTargets.protein}g / C ${profile.macroTargets.carbs}g / F ${profile.macroTargets.fat}g`}
          onClick={() => navigate('/settings/goals')}
          right={<ChevronRight size={18} className="text-faint" />}
        />
        <Row
          icon={<BellIcon size={19} />} label="Reminders"
          sub={activeReminders > 0 ? `${activeReminders} active` : 'None active'}
          onClick={() => navigate('/settings/reminders')}
          right={<ChevronRight size={18} className="text-faint" />}
        />
        <Row
          icon={profile.theme === 'light' ? <SunIcon size={19} /> : <MoonIcon size={19} />}
          label="Appearance & units"
          sub={`${profile.theme === 'system' ? 'System' : profile.theme === 'dark' ? 'Dark' : 'Light'} · ${unit}/${profile.units.height}`}
          onClick={() => navigate('/settings/appearance')}
          right={<ChevronRight size={18} className="text-faint" />}
        />
        <Row
          icon={<ScaleIcon size={19} />} label="Weight history"
          sub={`${weights.length} entr${weights.length === 1 ? 'y' : 'ies'}`}
          onClick={() => navigate('/settings/weight')}
          right={<ChevronRight size={18} className="text-faint" />}
        />
        <Row
          icon={<DownloadIcon size={19} />} label="Data"
          sub="Export, import or reset"
          onClick={() => navigate('/settings/data')}
          right={<ChevronRight size={18} className="text-faint" />}
        />
      </List>

      <p className="text-[11.5px] text-faint text-center leading-relaxed px-4 pb-2">
        FitTrack stores everything on this device. Nothing is uploaded anywhere.
        <br />
        Not a medical device — for general fitness tracking only.
      </p>
    </Screen>
  )
}

function MetricCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <Card className="text-center py-3 px-2">
      <p className="text-[22px] font-bold tabular-nums leading-none">{value}</p>
      <p className="text-[11px] text-faint mt-1">{sub}</p>
      <p className="text-[11.5px] text-muted font-medium mt-1.5">{label}</p>
    </Card>
  )
}

function NumberRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-muted">{label}</span>
      <span className="font-semibold tabular-nums text-right">
        {value}
        {note && <span className="text-[11px] text-faint font-normal ml-1.5">({note})</span>}
      </span>
    </div>
  )
}
