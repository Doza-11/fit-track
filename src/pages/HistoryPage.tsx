/**
 * History — a month calendar with per-day detail.
 * Days are tinted by how close intake landed to target, so patterns are
 * visible before drilling in.
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore, selectDailySummary } from '@/store/useStore'
import { useLogSheets } from '@/hooks/useLogSheets'
import {
  Card, ConfirmDialog, EmptyState, ProgressBar, Screen, toast,
} from '@/components/ui'
import {
  CheckIcon, ChevronLeft, ChevronRight, DropIcon, FlameIcon, PlusIcon,
  ScaleIcon, StepsIcon, TrashIcon,
} from '@/components/icons'
import { MEAL_ICONS, MEAL_LABELS } from '@/data/foods'
import {
  addDays, formatDate, fromLocalDate, relativeDayLabel, today, toLocalDate,
} from '@/utils/date'
import { calculateMacroProgress, displayWeight, round } from '@/utils/calculations'
import type { LocalDate } from '@/types'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function HistoryPage() {
  const { date: routeDate } = useParams()
  const navigate = useNavigate()
  const selected = routeDate ?? today()
  const [month, setMonth] = useState(() => fromLocalDate(selected))

  const state = useStore()

  const grid = useMemo(() => buildMonthGrid(month), [month])
  const summaries = useMemo(() => {
    const map = new Map<LocalDate, ReturnType<typeof selectDailySummary>>()
    for (const d of grid) {
      if (d) map.set(d, selectDailySummary(state, d))
    }
    return map
  }, [grid, state])

  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const isFutureMonth = month.getFullYear() > new Date().getFullYear()
    || (month.getFullYear() === new Date().getFullYear() && month.getMonth() >= new Date().getMonth())

  return (
    <Screen title="History">
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            className="tap -ml-2 text-muted focusable rounded-lg" aria-label="Previous month"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-[15px] font-semibold">{monthLabel}</h2>
          <button
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            disabled={isFutureMonth}
            className="tap -mr-2 text-muted disabled:opacity-25 focusable rounded-lg"
            aria-label="Next month"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="text-[10.5px] text-faint text-center font-medium py-1">{d}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.map((d, i) => {
            if (!d) return <span key={`pad-${i}`} />
            const s = summaries.get(d)!
            const isSelected = d === selected
            const isToday = d === today()
            const future = d > today()
            const ratio = s.calorieTarget > 0 ? s.caloriesConsumed / s.calorieTarget : 0

            return (
              <button
                key={d}
                onClick={() => navigate(`/history/${d}`)}
                disabled={future}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5
                  transition relative focusable disabled:opacity-25
                  ${isSelected ? 'bg-brand text-brand-ink' : s.hasAnyEntry ? 'bg-raised' : ''}`}
                aria-label={`${formatDate(d, 'long')}${s.hasAnyEntry ? `, ${s.caloriesConsumed} kcal` : ', no entries'}`}
                aria-current={isToday ? 'date' : undefined}
              >
                <span className={`text-[12.5px] tabular-nums ${isToday && !isSelected ? 'font-bold text-brand' : 'font-medium'}`}>
                  {fromLocalDate(d).getDate()}
                </span>
                <span className="flex gap-[2px] h-[4px]">
                  {s.caloriesConsumed > 0 && (
                    <span
                      className="w-[4px] h-[4px] rounded-full"
                      style={{
                        background: isSelected
                          ? 'rgb(var(--c-brand-ink))'
                          : ratio > 1.1 ? 'rgb(var(--c-burn))' : 'rgb(var(--c-brand))',
                      }}
                    />
                  )}
                  {s.workouts.length > 0 && (
                    <span
                      className="w-[4px] h-[4px] rounded-full"
                      style={{ background: isSelected ? 'rgb(var(--c-brand-ink))' : 'rgb(var(--c-fat))' }}
                    />
                  )}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex gap-4 mt-3 pt-3 border-t border-line/70 text-[11px] text-faint">
          <span className="flex items-center gap-1.5">
            <span className="w-[6px] h-[6px] rounded-full bg-brand" /> Meals logged
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-[6px] h-[6px] rounded-full bg-fat" /> Workout
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-[6px] h-[6px] rounded-full bg-burn" /> Over target
          </span>
        </div>
      </Card>

      <DayDetail date={selected} />
    </Screen>
  )
}

/** Month grid padded with nulls so the 1st lands on the right weekday. */
function buildMonthGrid(month: Date): Array<LocalDate | null> {
  const year = month.getFullYear()
  const m = month.getMonth()
  const first = new Date(year, m, 1)
  const daysInMonth = new Date(year, m + 1, 0).getDate()
  const cells: Array<LocalDate | null> = Array(first.getDay()).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(toLocalDate(new Date(year, m, d)))
  return cells
}

function DayDetail({ date }: { date: LocalDate }) {
  const navigate = useNavigate()
  const summary = useStore((s) => selectDailySummary(s, date))
  const profile = useStore((s) => s.profile)!
  const removeMeal = useStore((s) => s.removeMeal)
  const deleteWorkout = useStore((s) => s.deleteWorkout)
  const { openWeight, openSteps, openWater } = useLogSheets()
  const [confirm, setConfirm] = useState<{ kind: 'meal' | 'workout'; id: string; name: string } | null>(null)

  const macros = calculateMacroProgress(summary.macros, summary.macroTargets)
  const unit = profile.units.weight

  return (
    <>
      <div className="flex items-center justify-between mb-2.5 px-1">
        <h2 className="text-[16px] font-semibold">{relativeDayLabel(date)}</h2>
        <button
          onClick={() => navigate(`/food/add?date=${date}`)}
          className="text-[13px] font-semibold text-brand tap px-1"
        >
          Add food
        </button>
      </div>

      {!summary.hasAnyEntry ? (
        <EmptyState
          icon="📅"
          title="Nothing logged this day"
          body={date > today()
            ? 'This day is in the future.'
            : 'You can still add meals, workouts or weight for this date.'}
          action={date <= today() ? (
            <button className="btn-primary" onClick={() => navigate(`/food/add?date=${date}`)}>
              <PlusIcon size={18} /> Add food
            </button>
          ) : undefined}
        />
      ) : (
        <>
          <Card className="mb-3">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[13px] text-muted">Calories</span>
              <span className="text-[13px] text-muted tabular-nums">
                <strong className="text-ink text-[17px]">{summary.caloriesConsumed.toLocaleString()}</strong>
                {' / '}{summary.calorieTarget.toLocaleString()}
              </span>
            </div>
            <ProgressBar
              value={summary.calorieTarget > 0 ? summary.caloriesConsumed / summary.calorieTarget : 0}
              height={8}
            />
            <div className="grid grid-cols-3 gap-3 mt-3">
              {macros.map((m) => (
                <div key={m.key}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[11.5px] text-muted">{m.label}</span>
                    <span className="text-[11.5px] font-semibold tabular-nums">{m.consumed}g</span>
                  </div>
                  <ProgressBar value={m.rawRatio} color={m.key} height={4} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3.5 pt-3 border-t border-line/70">
              <MiniStat icon={<FlameIcon size={14} />} label="Burned" value={`${summary.caloriesBurned}`} />
              <MiniStat icon={<StepsIcon size={14} />} label="Steps" value={summary.steps.toLocaleString()} onClick={() => openSteps(date)} />
              <MiniStat icon={<DropIcon size={14} />} label="Water" value={`${(summary.waterMl / 1000).toFixed(1)}L`} onClick={() => openWater(date)} />
              <MiniStat
                icon={<ScaleIcon size={14} />} label="Weight"
                value={summary.weightKg ? `${displayWeight(summary.weightKg, unit)}` : '—'}
                onClick={() => openWeight(date)}
              />
            </div>
          </Card>

          {summary.meals.filter((m) => m.items.length > 0).map((meal) => {
            const kcal = Math.round(meal.items.reduce((s, i) => s + i.nutrients.calories, 0))
            return (
              <Card key={meal.id} className="mb-2 p-0 overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 py-2.5">
                  <span className="text-[17px]" aria-hidden="true">{MEAL_ICONS[meal.type]}</span>
                  <span className="flex-1 text-[14px] font-semibold">{MEAL_LABELS[meal.type]}</span>
                  <span className="text-[14px] font-bold tabular-nums">{kcal}</span>
                  <button
                    onClick={() => setConfirm({ kind: 'meal', id: meal.id, name: MEAL_LABELS[meal.type] })}
                    className="tap -mr-2 text-faint focusable rounded-lg"
                    aria-label={`Delete ${MEAL_LABELS[meal.type]}`}
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
                <div className="px-4 pb-2.5 border-t border-line/60 pt-2 space-y-1">
                  {meal.items.map((i) => (
                    <div key={i.id} className="flex justify-between text-[12.5px]">
                      <span className="text-muted truncate pr-3">
                        {i.foodName} <span className="text-faint">· {round(i.grams, 0)}g</span>
                      </span>
                      <span className="tabular-nums shrink-0">{Math.round(i.nutrients.calories)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )
          })}

          {summary.workouts.map((w) => (
            <Card key={w.id} className="mb-2 flex items-center gap-3 py-3">
              <span className="w-9 h-9 rounded-xl bg-brand/12 text-brand flex items-center justify-center shrink-0">
                <CheckIcon size={18} />
              </span>
              <button className="flex-1 min-w-0 text-left" onClick={() => navigate(`/workout/${w.id}`)}>
                <span className="block text-[14px] font-semibold truncate">{w.name}</span>
                <span className="block text-[11.5px] text-muted">
                  {w.durationMin} min · ~{w.caloriesBurned} kcal · {w.exercises.length} exercise{w.exercises.length === 1 ? '' : 's'}
                </span>
              </button>
              <button
                onClick={() => setConfirm({ kind: 'workout', id: w.id, name: w.name })}
                className="tap -mr-2 text-faint focusable rounded-lg"
                aria-label={`Delete ${w.name}`}
              >
                <TrashIcon size={16} />
              </button>
            </Card>
          ))}
        </>
      )}

      <div className="flex gap-2 mt-3">
        <button className="btn-ghost flex-1" onClick={() => navigate(`/history/${addDays(date, -1)}`)}>
          <ChevronLeft size={17} /> Previous day
        </button>
        <button
          className="btn-ghost flex-1"
          disabled={date >= today()}
          onClick={() => navigate(`/history/${addDays(date, 1)}`)}
        >
          Next day <ChevronRight size={17} />
        </button>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={`Delete ${confirm?.name ?? 'entry'}?`}
        body="This removes it from your history and analytics."
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === 'meal') void removeMeal(confirm.id)
          if (confirm?.kind === 'workout') void deleteWorkout(confirm.id)
          setConfirm(null)
          toast('Deleted')
        }}
      />
    </>
  )
}

function MiniStat({ icon, label, value, onClick }: {
  icon: React.ReactNode; label: string; value: string; onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className="text-center focusable rounded-lg py-0.5">
      <span className="flex items-center justify-center gap-1 text-faint mb-0.5">{icon}</span>
      <span className="block text-[13px] font-bold tabular-nums">{value}</span>
      <span className="block text-[10.5px] text-faint">{label}</span>
    </Tag>
  )
}
