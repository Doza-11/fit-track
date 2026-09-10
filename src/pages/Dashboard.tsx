/**
 * Dashboard — today at a glance.
 *
 * Ordering is deliberate: the calorie ring answers "how am I doing?" first,
 * then macros, then the supporting logs. The suggestion card adapts to the
 * time of day so the screen stays useful from morning to night.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, selectDailySummary } from '@/store/useStore'
import { useLogSheets } from '@/hooks/useLogSheets'
import {
  Card, EstimateNote, ProgressBar, ProgressRing, SectionTitle, StatTile,
} from '@/components/ui'
import {
  CalendarIcon, CheckIcon, ChevronRight, DropIcon, DumbbellIcon, FlameIcon,
  ScaleIcon, StepsIcon,
} from '@/components/icons'
import { MEAL_ICONS, MEAL_LABELS, MEAL_ORDER } from '@/data/foods'
import {
  calculateMacroProgress, calculateStreak, calculateWeeklyAverage, displayWeight,
} from '@/utils/calculations'
import { greeting, lastNDays, today } from '@/utils/date'
import { buildContext, generateDailySuggestion } from '@/services/suggestions'
import type { MealType } from '@/types'

export function Dashboard() {
  const navigate = useNavigate()
  const date = today()
  const profile = useStore((s) => s.profile)!
  const summary = useStore((s) => selectDailySummary(s, date))
  const state = useStore()
  const { openWater, openWeight, openSteps } = useLogSheets()

  // Recent history feeds the "higher than usual" comparisons and the streak.
  const { recentAvgCalories, recentAvgSteps, streak } = useMemo(() => {
    const past = lastNDays(14, date).slice(0, -1)
    const summaries = past.map((d) => selectDailySummary(state, d))
    const loggedDates = new Set(
      summaries.filter((s) => s.hasAnyEntry).map((s) => s.date),
    )
    if (summary.hasAnyEntry) loggedDates.add(date)
    return {
      recentAvgCalories: calculateWeeklyAverage(summaries.map((s) => s.caloriesConsumed)),
      recentAvgSteps: calculateWeeklyAverage(summaries.map((s) => s.steps)),
      streak: calculateStreak(loggedDates, date),
    }
    // `state` changes on any mutation, which is exactly when this should recompute.
  }, [state, date, summary.hasAnyEntry])

  const suggestion = useMemo(() => generateDailySuggestion(buildContext({
    summary, profile, recentAvgCalories, recentAvgSteps, streak,
  })), [summary, profile, recentAvgCalories, recentAvgSteps, streak])

  const macros = calculateMacroProgress(summary.macros, summary.macroTargets)
  const ratio = summary.calorieTarget > 0 ? summary.caloriesConsumed / summary.calorieTarget : 0
  const overTarget = summary.remaining < 0
  const unit = profile.units.weight

  return (
    <div className="px-4 pt-4">
      <header className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[13px] text-muted">{greeting()} 👋</p>
          <h1 className="text-[24px] font-bold tracking-tight leading-tight">
            {profile.name}
          </h1>
        </div>
        <button
          onClick={() => navigate('/history')}
          className="tap rounded-xl bg-surface border border-line/70 text-muted focusable"
          aria-label="History"
        >
          <CalendarIcon size={21} />
        </button>
      </header>

      {/* ── Calorie headline ── */}
      <Card className="mb-3 flex flex-col items-center pt-5 pb-4">
        <ProgressRing value={ratio}>
          <span className="text-[34px] font-bold tabular-nums leading-none">
            {summary.caloriesConsumed.toLocaleString()}
          </span>
          <span className="text-[12.5px] text-muted mt-1">
            of {summary.calorieTarget.toLocaleString()} kcal
          </span>
          <span
            className={`text-[12px] font-semibold mt-2 px-2.5 py-1 rounded-full
              ${overTarget ? 'bg-burn/15 text-burn' : 'bg-brand/12 text-brand'}`}
          >
            {overTarget
              ? `${Math.abs(summary.remaining).toLocaleString()} over`
              : `${summary.remaining.toLocaleString()} left`}
          </span>
        </ProgressRing>

        <div className="grid grid-cols-3 w-full mt-4 pt-4 border-t border-line/70">
          {macros.map((m) => (
            <div key={m.key} className="px-2 text-center">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-[16px] font-bold tabular-nums">{m.consumed}</span>
                <span className="text-[11.5px] text-faint">/{m.target}g</span>
              </div>
              <p className="text-[11.5px] text-muted mb-1.5">{m.label}</p>
              <ProgressBar value={m.rawRatio} color={m.key} height={5} />
            </div>
          ))}
        </div>
      </Card>

      {/* ── Suggestion ── */}
      {suggestion && (
        <Card
          className={`mb-3 animate-pop-in ${
            suggestion.tone === 'positive' ? 'border-brand/35 bg-brand/[0.06]' : ''
          }`}
        >
          <div className="flex gap-3">
            <span className="text-[20px] leading-none pt-0.5" aria-hidden="true">{suggestion.icon}</span>
            <div className="min-w-0">
              <h3 className="text-[14.5px] font-semibold mb-1 leading-snug">{suggestion.title}</h3>
              <p className="text-[13px] text-muted leading-relaxed">{suggestion.body}</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Supporting stats ── */}
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <StatTile
          icon={<FlameIcon size={15} />} accent="rgb(var(--c-burn))"
          label="Burned" value={`${summary.caloriesBurned.toLocaleString()}`}
          sub={summary.workouts.length > 0 ? 'Workout + steps (est.)' : 'From steps (est.)'}
        />
        <StatTile
          icon={<DropIcon size={15} />} accent="rgb(var(--c-water))"
          label="Water" value={`${(summary.waterMl / 1000).toFixed(1)}L`}
          sub={`of ${(summary.waterTargetMl / 1000).toFixed(1)}L`}
          onClick={() => openWater(date)}
        />
        <StatTile
          icon={<StepsIcon size={15} />} accent="rgb(var(--c-brand))"
          label="Steps" value={summary.steps.toLocaleString()}
          sub={`of ${summary.stepTarget.toLocaleString()}`}
          onClick={() => openSteps(date)}
        />
        <StatTile
          icon={<ScaleIcon size={15} />} accent="rgb(var(--c-fat))"
          label="Weight"
          value={summary.weightKg
            ? `${displayWeight(summary.weightKg, unit)}`
            : `${displayWeight(profile.weightKg, unit)}`}
          sub={summary.weightKg ? `${unit} · logged today` : `${unit} · tap to update`}
          onClick={() => openWeight(date)}
        />
      </div>

      {/* ── Meals ── */}
      <SectionTitle
        action={
          <button
            className="text-[13px] font-semibold text-brand tap px-1"
            onClick={() => navigate('/food/add')}
          >
            Add food
          </button>
        }
      >
        Today's meals
      </SectionTitle>

      <div className="space-y-2 mb-4">
        {MEAL_ORDER.filter((t) => t !== 'drink' && t !== 'dessert').map((type) => (
          <MealRow key={type} type={type} date={date} />
        ))}
        {summary.meals.some((m) => m.type === 'drink' || m.type === 'dessert') &&
          (['drink', 'dessert'] as MealType[])
            .filter((t) => summary.meals.some((m) => m.type === t && m.items.length > 0))
            .map((type) => <MealRow key={type} type={type} date={date} />)}
      </div>

      {/* ── Workout ── */}
      <SectionTitle
        action={
          <button
            className="text-[13px] font-semibold text-brand tap px-1"
            onClick={() => navigate('/workout/new')}
          >
            {summary.workouts.length > 0 ? 'Add another' : 'Log workout'}
          </button>
        }
      >
        Today's workout
      </SectionTitle>

      {summary.workouts.length === 0 ? (
        <button
          onClick={() => navigate('/workout/new')}
          className="card w-full flex items-center gap-3 text-left active:scale-[0.99] transition focusable"
        >
          <span className="w-10 h-10 rounded-xl bg-raised text-faint flex items-center justify-center shrink-0">
            <DumbbellIcon size={20} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[14.5px] font-medium">No workout logged</span>
            <span className="block text-[12px] text-faint">Tap to start a session</span>
          </span>
          <ChevronRight size={18} className="text-faint shrink-0" />
        </button>
      ) : (
        <div className="space-y-2">
          {summary.workouts.map((w) => (
            <button
              key={w.id}
              onClick={() => navigate(`/workout/${w.id}`)}
              className="card w-full flex items-center gap-3 text-left active:scale-[0.99] transition focusable"
            >
              <span
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                  ${w.inProgress ? 'bg-burn/15 text-burn' : 'bg-brand/12 text-brand'}`}
              >
                {w.inProgress ? <DumbbellIcon size={20} /> : <CheckIcon size={20} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14.5px] font-semibold truncate">{w.name}</span>
                <span className="block text-[12px] text-muted">
                  {w.inProgress
                    ? 'In progress — tap to continue'
                    : `${w.durationMin} min · ~${w.caloriesBurned} kcal · ${w.exercises.length} exercise${w.exercises.length === 1 ? '' : 's'}`}
                </span>
              </span>
              <ChevronRight size={18} className="text-faint shrink-0" />
            </button>
          ))}
        </div>
      )}

      <EstimateNote>
        <span className="block mt-4 px-1">
          Calorie burn is estimated from activity type, duration and your bodyweight.
          Treat it as a rough guide rather than a measurement.
        </span>
      </EstimateNote>
    </div>
  )
}

function MealRow({ type, date }: { type: MealType; date: string }) {
  const navigate = useNavigate()
  const meal = useStore((s) => s.meals.find((m) => m.date === date && m.type === type))
  const calories = Math.round(meal?.items.reduce((s, i) => s + i.nutrients.calories, 0) ?? 0)
  const count = meal?.items.length ?? 0

  return (
    <button
      onClick={() => navigate(`/food/add?meal=${type}`)}
      className="card w-full flex items-center gap-3 text-left py-3 active:scale-[0.99] transition focusable"
    >
      <span className="text-[20px] w-8 text-center shrink-0" aria-hidden="true">{MEAL_ICONS[type]}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14.5px] font-medium">{MEAL_LABELS[type]}</span>
        <span className="block text-[12px] text-faint truncate">
          {count === 0
            ? 'Not logged'
            : meal!.items.map((i) => i.foodName).join(', ')}
        </span>
      </span>
      {calories > 0 ? (
        <span className="text-[14px] font-semibold tabular-nums shrink-0">{calories}</span>
      ) : (
        <ChevronRight size={18} className="text-faint shrink-0" />
      )}
    </button>
  )
}
