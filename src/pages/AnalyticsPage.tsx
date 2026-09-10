/**
 * Analytics — nutrition, activity and weight over a selectable period.
 * Every series is computed from real logged data; unlogged days render as
 * gaps rather than zeroes so averages aren't visually misleading.
 */
import { useMemo, useState } from 'react'
import { useStore, selectDailySummary } from '@/store/useStore'
import { BarChart, ChartLegend, DonutChart, LineChart, type Point } from '@/charts/Charts'
import { Card, EmptyState, Field, Screen, Sheet } from '@/components/ui'
import { InfoIcon, SparkIcon } from '@/components/icons'
import { calculatePeriodStats, generateInsights } from '@/services/insights'
import {
  calculateWeightTrend, calorieAdherence, displayWeight, projectGoalDays, round, workoutSplit,
} from '@/utils/calculations'
import {
  addDays, dateRange, daysBetween, formatDate, lastNDays, today,
} from '@/utils/date'
import type { LocalDate } from '@/types'

type Period = '7' | '30' | '90' | 'custom'
type Tab = 'nutrition' | 'activity' | 'weight'

const PERIOD_LABELS: Record<Period, string> = {
  '7': '7 days', '30': '30 days', '90': '3 months', custom: 'Custom',
}

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('7')
  const [tab, setTab] = useState<Tab>('nutrition')
  const [customOpen, setCustomOpen] = useState(false)
  const [custom, setCustom] = useState<{ from: LocalDate; to: LocalDate }>(
    () => ({ from: addDays(today(), -13), to: today() }),
  )

  const state = useStore()
  const profile = useStore((s) => s.profile)!
  const weights = useStore((s) => s.weights)

  const dates = useMemo(() => {
    if (period === 'custom') return dateRange(custom.from, custom.to)
    return lastNDays(Number(period))
  }, [period, custom])

  const days = useMemo(
    () => dates.map((d) => selectDailySummary(state, d)),
    [dates, state],
  )

  const stats = useMemo(() => {
    const inRange = weights.filter((w) => w.date >= dates[0] && w.date <= dates[dates.length - 1])
    return calculatePeriodStats(days, inRange)
  }, [days, weights, dates])

  const insights = useMemo(
    () => generateInsights({ days, weights, profile, today: today() }),
    [days, weights, profile],
  )

  const hasData = days.some((d) => d.hasAnyEntry)
  const labelFor = (d: LocalDate) =>
    dates.length <= 7 ? formatDate(d, 'weekday') : formatDate(d, 'short').replace(' ', ' ')

  return (
    <Screen title="Analytics">
      {/* Period selector */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-4 -mx-4 px-4">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => { setPeriod(p); if (p === 'custom') setCustomOpen(true) }}
            className={period === p ? 'chip-on' : 'chip-off'}
          >
            {p === 'custom' && period === 'custom'
              ? `${formatDate(custom.from)} – ${formatDate(custom.to)}`
              : PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {!hasData ? (
        <EmptyState
          icon="📊"
          title="No data for this period"
          body="Log meals, workouts or weight and your trends will appear here. A few days of data makes the charts much more useful."
        />
      ) : (
        <>
          {/* Period summary */}
          <Card className="mb-4">
            <h2 className="text-[14px] font-semibold mb-3">
              {period === 'custom'
                ? `${formatDate(custom.from)} – ${formatDate(custom.to)}`
                : `Last ${PERIOD_LABELS[period]}`}
            </h2>
            <div className="grid grid-cols-2 gap-y-3.5 gap-x-3">
              <Stat label="Avg calories" value={stats.avgCalories.toLocaleString()} unit="kcal" />
              <Stat label="Avg protein" value={stats.avgProtein} unit="g" />
              <Stat label="Workouts" value={stats.workouts} unit={`· ${stats.workoutMinutes} min`} />
              <Stat label="Avg steps" value={stats.avgSteps.toLocaleString()} />
              <Stat
                label="Days logged"
                value={`${stats.loggedDays}/${stats.totalDays}`}
              />
              <Stat
                label="Weight change"
                value={stats.weightChangeKg === null
                  ? '—'
                  : `${stats.weightChangeKg > 0 ? '+' : ''}${displayWeight(stats.weightChangeKg, profile.units.weight)}`}
                unit={stats.weightChangeKg === null ? '' : profile.units.weight}
              />
            </div>
          </Card>

          <div className="flex gap-1.5 mb-4">
            {([
              ['nutrition', 'Nutrition'], ['activity', 'Activity'], ['weight', 'Weight'],
            ] as Array<[Tab, string]>).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 ${tab === t ? 'chip-on' : 'chip-off'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'nutrition' && <NutritionTab days={days} labelFor={labelFor} stats={stats} />}
          {tab === 'activity' && <ActivityTab days={days} labelFor={labelFor} stats={stats} />}
          {tab === 'weight' && <WeightTab dates={dates} labelFor={labelFor} />}

          {/* Insights */}
          {insights.length > 0 && (
            <>
              <div className="flex items-center gap-2 mt-6 mb-2.5 px-1">
                <SparkIcon size={17} className="text-brand" />
                <h2 className="text-[15px] font-semibold">Insights</h2>
              </div>
              <div className="space-y-2">
                {insights.map((i) => (
                  <Card
                    key={i.id}
                    className={`flex gap-3 py-3 ${i.tone === 'positive' ? 'border-brand/30 bg-brand/[0.05]' : ''}`}
                  >
                    <span className="text-[17px] leading-none pt-0.5" aria-hidden="true">{i.icon}</span>
                    <p className="text-[13px] text-muted leading-relaxed flex-1">{i.text}</p>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <CustomRangeSheet
        open={customOpen}
        value={custom}
        onClose={() => setCustomOpen(false)}
        onApply={(v) => { setCustom(v); setPeriod('custom'); setCustomOpen(false) }}
      />
    </Screen>
  )
}

function Stat({ label, value, unit }: { label: string; value: React.ReactNode; unit?: string }) {
  return (
    <div>
      <p className="text-[11.5px] text-muted mb-0.5">{label}</p>
      <p className="text-[18px] font-bold tabular-nums leading-tight">
        {value}
        {unit && <span className="text-[12px] font-medium text-faint ml-1">{unit}</span>}
      </p>
    </div>
  )
}

function ChartCard({ title, note, children }: {
  title: string; note?: string; children: React.ReactNode
}) {
  return (
    <Card className="mb-3">
      <h3 className="text-[14px] font-semibold mb-3">{title}</h3>
      {children}
      {note && (
        <p className="text-[11.5px] text-faint mt-3 flex items-start gap-1.5 leading-snug">
          <InfoIcon size={13} className="shrink-0 mt-[1px]" />
          <span>{note}</span>
        </p>
      )}
    </Card>
  )
}

type Days = ReturnType<typeof selectDailySummary>[]
type LabelFn = (d: LocalDate) => string
type Stats = ReturnType<typeof calculatePeriodStats>

function NutritionTab({ days, labelFor, stats }: { days: Days; labelFor: LabelFn; stats: Stats }) {
  const calories: Point[] = days.map((d) => ({
    label: labelFor(d.date), value: d.caloriesConsumed, empty: d.caloriesConsumed === 0,
  }))
  const target = days[0]?.calorieTarget ?? 0
  const adherence = calorieAdherence(days)

  const macroPoints = (key: 'protein' | 'carbs' | 'fat'): Point[] =>
    days.map((d) => ({
      label: labelFor(d.date), value: Math.round(d.macros[key]), empty: d.caloriesConsumed === 0,
    }))

  const totalMacros = {
    protein: stats.avgProtein, carbs: stats.avgCarbs, fat: stats.avgFat,
  }
  const macroKcal = {
    protein: totalMacros.protein * 4,
    carbs: totalMacros.carbs * 4,
    fat: totalMacros.fat * 9,
  }
  const totalKcal = macroKcal.protein + macroKcal.carbs + macroKcal.fat

  return (
    <>
      <ChartCard
        title="Daily calories"
        note={`Dashed line is your target of ${target.toLocaleString()} kcal. Bars above it are shown in orange. Grey bars are days with nothing logged.`}
      >
        <BarChart points={calories} target={target} unit=" kcal" />
        <div className="flex justify-between mt-3 pt-3 border-t border-line/70 text-[12px]">
          <span className="text-muted">Average <strong className="text-ink">{stats.avgCalories.toLocaleString()}</strong> kcal</span>
          <span className="text-muted">Within 10% of target on <strong className="text-ink">{adherence}%</strong> of days</span>
        </div>
      </ChartCard>

      <ChartCard title="Protein">
        <BarChart points={macroPoints('protein')} color="protein" unit=" g" />
        <p className="text-[12px] text-muted mt-2">
          Average <strong className="text-ink">{stats.avgProtein}g</strong> per logged day
        </p>
      </ChartCard>

      <ChartCard title="Carbs">
        <BarChart points={macroPoints('carbs')} color="carbs" unit=" g" height={140} />
        <p className="text-[12px] text-muted mt-2">
          Average <strong className="text-ink">{stats.avgCarbs}g</strong> per logged day
        </p>
      </ChartCard>

      <ChartCard title="Fat">
        <BarChart points={macroPoints('fat')} color="fat" unit=" g" height={140} />
        <p className="text-[12px] text-muted mt-2">
          Average <strong className="text-ink">{stats.avgFat}g</strong> per logged day
        </p>
      </ChartCard>

      {totalKcal > 0 && (
        <ChartCard title="Where your calories come from">
          <div className="flex items-center gap-5">
            <DonutChart
              slices={[
                { label: 'Protein', value: macroKcal.protein, color: 'rgb(var(--c-protein))' },
                { label: 'Carbs', value: macroKcal.carbs, color: 'rgb(var(--c-carbs))' },
                { label: 'Fat', value: macroKcal.fat, color: 'rgb(var(--c-fat))' },
              ]}
              center={
                <>
                  <span className="text-[17px] font-bold tabular-nums">{Math.round(totalKcal)}</span>
                  <span className="text-[10px] text-faint">avg kcal</span>
                </>
              }
            />
            <div className="flex-1">
              <ChartLegend
                items={[
                  { label: 'Protein', color: 'rgb(var(--c-protein))', value: `${Math.round((macroKcal.protein / totalKcal) * 100)}%` },
                  { label: 'Carbs', color: 'rgb(var(--c-carbs))', value: `${Math.round((macroKcal.carbs / totalKcal) * 100)}%` },
                  { label: 'Fat', color: 'rgb(var(--c-fat))', value: `${Math.round((macroKcal.fat / totalKcal) * 100)}%` },
                ]}
              />
            </div>
          </div>
        </ChartCard>
      )}
    </>
  )
}

function ActivityTab({ days, labelFor, stats }: { days: Days; labelFor: LabelFn; stats: Stats }) {
  const steps: Point[] = days.map((d) => ({
    label: labelFor(d.date), value: d.steps, empty: d.steps === 0,
  }))
  const burned: Point[] = days.map((d) => ({
    label: labelFor(d.date), value: d.caloriesBurned, empty: d.caloriesBurned === 0,
  }))
  const duration: Point[] = days.map((d) => ({
    label: labelFor(d.date),
    value: d.workouts.reduce((s, w) => s + w.durationMin, 0),
    empty: d.workouts.length === 0,
  }))

  const allWorkouts = days.flatMap((d) => d.workouts)
  const split = workoutSplit(allWorkouts)
  const splitTotal = split.strength + split.cardio + split.other
  const stepTarget = days[0]?.stepTarget ?? 0

  return (
    <>
      <ChartCard title="Steps" note={`Dashed line is your daily target of ${stepTarget.toLocaleString()} steps.`}>
        <BarChart points={steps} target={stepTarget} unit=" steps" />
        <p className="text-[12px] text-muted mt-2">
          Average <strong className="text-ink">{stats.avgSteps.toLocaleString()}</strong> steps per day
        </p>
      </ChartCard>

      <ChartCard
        title="Calories burned"
        note="Estimated from logged workouts plus a walking estimate based on your steps."
      >
        <BarChart points={burned} color="burn" unit=" kcal" height={140} />
        <p className="text-[12px] text-muted mt-2">
          Average <strong className="text-ink">~{stats.avgBurned}</strong> kcal per day
        </p>
      </ChartCard>

      <ChartCard title="Workout duration">
        <BarChart points={duration} unit=" min" height={140} />
        <p className="text-[12px] text-muted mt-2">
          <strong className="text-ink">{stats.workouts}</strong> workout{stats.workouts === 1 ? '' : 's'} ·{' '}
          <strong className="text-ink">{stats.workoutMinutes}</strong> minutes total
        </p>
      </ChartCard>

      {splitTotal > 0 && (
        <ChartCard title="Cardio vs strength">
          <div className="flex items-center gap-5">
            <DonutChart
              slices={[
                { label: 'Strength', value: split.strength, color: 'rgb(var(--c-brand))' },
                { label: 'Cardio', value: split.cardio, color: 'rgb(var(--c-burn))' },
                { label: 'Other', value: split.other, color: 'rgb(var(--c-fat))' },
              ].filter((s) => s.value > 0)}
              center={
                <>
                  <span className="text-[17px] font-bold tabular-nums">{splitTotal}</span>
                  <span className="text-[10px] text-faint">exercises</span>
                </>
              }
            />
            <div className="flex-1">
              <ChartLegend
                items={[
                  { label: 'Strength', color: 'rgb(var(--c-brand))', value: String(split.strength) },
                  { label: 'Cardio', color: 'rgb(var(--c-burn))', value: String(split.cardio) },
                  { label: 'Other', color: 'rgb(var(--c-fat))', value: String(split.other) },
                ].filter((i) => i.value !== '0')}
              />
            </div>
          </div>
        </ChartCard>
      )}
    </>
  )
}

function WeightTab({ dates, labelFor }: { dates: LocalDate[]; labelFor: LabelFn }) {
  const profile = useStore((s) => s.profile)!
  const allWeights = useStore((s) => s.weights)
  const unit = profile.units.weight

  const inRange = useMemo(
    () => allWeights
      .filter((w) => w.date >= dates[0] && w.date <= dates[dates.length - 1])
      .sort((a, b) => a.date.localeCompare(b.date)),
    [allWeights, dates],
  )

  const trend = useMemo(() => calculateWeightTrend(inRange), [inRange])
  const allTimeTrend = useMemo(() => calculateWeightTrend(allWeights), [allWeights])

  if (inRange.length === 0) {
    return (
      <EmptyState
        icon="⚖️"
        title="No weight entries in this period"
        body="Log your weight from the + button. A few entries a week is enough to see a reliable trend."
      />
    )
  }

  const points: Point[] = inRange.map((w) => ({
    label: labelFor(w.date), value: displayWeight(w.weightKg, unit),
  }))
  const smoothed: Point[] = trend.smoothed.map((s) => ({
    label: labelFor(s.date), value: displayWeight(s.weightKg, unit),
  }))

  const goal = profile.goal.targetWeightKg
  const daysToGoal = goal && allTimeTrend.current
    ? projectGoalDays(allTimeTrend.current, goal, allTimeTrend.ratePerWeek)
    : null

  return (
    <>
      <ChartCard
        title="Weight trend"
        note="The solid line is a 7-point moving average, which smooths out normal daily fluctuation from food, water and time of day."
      >
        <LineChart
          points={smoothed.length > 1 ? smoothed : points}
          color="fat"
          unit={` ${unit}`}
          decimals={1}
          target={goal ? displayWeight(goal, unit) : undefined}
        />
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-line/70">
          <Stat label="Starting" value={displayWeight(trend.start ?? 0, unit)} unit={unit} />
          <Stat label="Current" value={displayWeight(trend.current ?? 0, unit)} unit={unit} />
          <Stat
            label="Change"
            value={`${trend.changeKg > 0 ? '+' : ''}${displayWeight(trend.changeKg, unit)}`}
            unit={unit}
          />
        </div>
      </ChartCard>

      <Card>
        <h3 className="text-[14px] font-semibold mb-3">Progress toward your goal</h3>
        {goal ? (
          <>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Stat label="Goal weight" value={displayWeight(goal, unit)} unit={unit} />
              <Stat
                label="Trend"
                value={`${allTimeTrend.ratePerWeek > 0 ? '+' : ''}${round(displayWeight(Math.abs(allTimeTrend.ratePerWeek), unit) * Math.sign(allTimeTrend.ratePerWeek || 1), 2)}`}
                unit={`${unit}/week`}
              />
            </div>
            <p className="text-[12.5px] text-muted leading-relaxed">
              {daysToGoal === null
                ? 'Not enough of a consistent trend yet to project a date. Keep logging and this will fill in.'
                : daysToGoal === 0
                  ? 'You are at your goal weight.'
                  : `At your current trend you would reach ${displayWeight(goal, unit)} ${unit} in roughly ${daysToGoal} days (around ${formatDate(addDays(today(), daysToGoal), 'long')}). This is a rough projection, not a promise.`}
            </p>
          </>
        ) : (
          <p className="text-[12.5px] text-muted leading-relaxed">
            You haven't set a goal weight. You can add one from Profile → Goal &amp; targets.
          </p>
        )}
      </Card>
    </>
  )
}

function CustomRangeSheet({ open, value, onClose, onApply }: {
  open: boolean
  value: { from: LocalDate; to: LocalDate }
  onClose: () => void
  onApply: (v: { from: LocalDate; to: LocalDate }) => void
}) {
  const [from, setFrom] = useState(value.from)
  const [to, setTo] = useState(value.to)

  const span = daysBetween(from, to)
  const error = span < 0
    ? 'The start date must come before the end date.'
    : span > 365
      ? 'Choose a range of 365 days or fewer.'
      : null

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Custom range"
      footer={
        <button
          className="btn-primary w-full"
          disabled={error !== null}
          onClick={() => onApply({ from, to })}
        >
          Apply {error === null && `· ${span + 1} days`}
        </button>
      }
    >
      <div className="pb-3">
        <Field label="From">
          <input
            type="date" className="field" value={from} max={today()}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="To" error={error ?? undefined}>
          <input
            type="date" className="field" value={to} max={today()}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {[
            ['This week', 6], ['Last 14 days', 13], ['Last 60 days', 59],
          ].map(([label, back]) => (
            <button
              key={String(label)}
              className="chip-off"
              onClick={() => { setFrom(addDays(today(), -(back as number))); setTo(today()) }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  )
}
