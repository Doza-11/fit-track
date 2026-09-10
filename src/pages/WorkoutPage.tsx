/** Workout tab: recent sessions, saved routines and personal records. */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, selectPersonalRecords } from '@/store/useStore'
import {
  Card, ConfirmDialog, EmptyState, List, Row, Screen, Segmented, toast,
} from '@/components/ui'
import {
  CheckIcon, ChevronRight, DumbbellIcon, FlameIcon, PlusIcon, TimerIcon, TrashIcon,
} from '@/components/icons'
import { formatDate, relativeDayLabel } from '@/utils/date'
import { workoutVolume } from '@/utils/calculations'

type Tab = 'history' | 'routines' | 'records'

export function WorkoutPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('history')
  const workouts = useStore((s) => s.workouts)

  const sorted = useMemo(
    () => [...workouts].sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt),
    [workouts],
  )
  const active = sorted.find((w) => w.inProgress)

  const weekCount = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 7)
    const key = cutoff.toISOString().slice(0, 10)
    return workouts.filter((w) => !w.inProgress && w.date >= key).length
  }, [workouts])

  return (
    <Screen
      title="Workouts"
      subtitle={weekCount > 0 ? `${weekCount} session${weekCount === 1 ? '' : 's'} in the last 7 days` : undefined}
      right={
        <button
          onClick={() => navigate('/workout/new')}
          className="btn-primary px-4 min-h-[42px] text-[14px]"
        >
          <PlusIcon size={18} /> Start
        </button>
      }
    >
      {active && (
        <button
          onClick={() => navigate(`/workout/${active.id}`)}
          className="card w-full mb-4 flex items-center gap-3 border-burn/40 bg-burn/[0.07] text-left active:scale-[0.99] transition focusable"
        >
          <span className="w-10 h-10 rounded-xl bg-burn/15 text-burn flex items-center justify-center shrink-0">
            <TimerIcon size={20} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[14.5px] font-semibold">{active.name}</span>
            <span className="block text-[12px] text-muted">In progress — tap to continue</span>
          </span>
          <ChevronRight size={18} className="text-faint" />
        </button>
      )}

      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'history', label: 'History' },
          { value: 'routines', label: 'Routines' },
          { value: 'records', label: 'Records' },
        ]}
      />

      {tab === 'history' && <HistoryTab />}
      {tab === 'routines' && <RoutinesTab />}
      {tab === 'records' && <RecordsTab />}
    </Screen>
  )
}

function HistoryTab() {
  const navigate = useNavigate()
  const workouts = useStore((s) => s.workouts)
  const deleteWorkout = useStore((s) => s.deleteWorkout)
  const [confirm, setConfirm] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...workouts]
      .filter((w) => !w.inProgress)
      .sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt),
    [workouts],
  )

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon="🏋️"
        title="No workouts yet"
        body="Start a session to log sets, reps and weights. Your history and personal records build up from there."
        action={
          <button className="btn-primary" onClick={() => navigate('/workout/new')}>
            <PlusIcon size={18} /> Start a workout
          </button>
        }
      />
    )
  }

  return (
    <>
      <div className="space-y-2.5">
        {sorted.map((w) => {
          const volume = workoutVolume(w.exercises)
          return (
            <Card key={w.id} className="p-0 overflow-hidden">
              <button
                onClick={() => navigate(`/workout/${w.id}`)}
                className="w-full text-left px-4 py-3 active:bg-raised transition focusable"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[15px] font-semibold flex-1 truncate">{w.name}</span>
                  <span className="text-[11.5px] text-faint shrink-0">{relativeDayLabel(w.date)}</span>
                </div>
                <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] text-muted">
                  <span className="flex items-center gap-1"><TimerIcon size={13} /> {w.durationMin} min</span>
                  <span className="flex items-center gap-1"><FlameIcon size={13} /> ~{w.caloriesBurned} kcal</span>
                  <span className="flex items-center gap-1"><DumbbellIcon size={13} /> {w.exercises.length} exercise{w.exercises.length === 1 ? '' : 's'}</span>
                  {volume > 0 && <span>{volume.toLocaleString()} kg volume</span>}
                </div>
                {w.exercises.length > 0 && (
                  <p className="text-[11.5px] text-faint mt-1.5 truncate">
                    {w.exercises.map((e) => e.exerciseName).join(' · ')}
                  </p>
                )}
              </button>
              <button
                onClick={() => setConfirm(w.id)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-[12px] text-faint
                           border-t border-line/60 active:bg-raised transition focusable"
              >
                <TrashIcon size={14} /> Delete
              </button>
            </Card>
          )
        })}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title="Delete this workout?"
        body="The session and its sets will be removed from your history and analytics."
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) void deleteWorkout(confirm)
          setConfirm(null)
          toast('Workout deleted')
        }}
      />
    </>
  )
}

function RoutinesTab() {
  const navigate = useNavigate()
  const routines = useStore((s) => s.routines)
  const deleteRoutine = useStore((s) => s.deleteRoutine)
  const [confirm, setConfirm] = useState<string | null>(null)

  if (routines.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title="No routines saved"
        body="Finish a workout and save it as a routine. You can then start the same session again without re-adding every exercise."
      />
    )
  }

  return (
    <>
      <List>
        {routines.map((r) => (
          <Row
            key={r.id}
            label={r.name}
            sub={`${r.exercises.length} exercises · ${r.exercises.map((e) => e.exerciseName).slice(0, 3).join(', ')}`}
            onClick={() => navigate(`/workout/new?routine=${r.id}`)}
            right={
              <button
                onClick={(e) => { e.stopPropagation(); setConfirm(r.id) }}
                className="tap text-faint focusable rounded-lg"
                aria-label={`Delete ${r.name}`}
              >
                <TrashIcon size={17} />
              </button>
            }
          />
        ))}
      </List>
      <ConfirmDialog
        open={confirm !== null}
        title="Delete routine?"
        body="Workouts you already logged from it are not affected."
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) void deleteRoutine(confirm)
          setConfirm(null)
          toast('Routine deleted')
        }}
      />
    </>
  )
}

function RecordsTab() {
  const records = useStore(selectPersonalRecords)

  if (records.length === 0) {
    return (
      <EmptyState
        icon="🏅"
        title="No records yet"
        body="Log a few strength sets with weights and your best lift for each exercise will show up here."
      />
    )
  }

  return (
    <>
      <div className="space-y-2">
        {records.map((r) => (
          <Card key={r.exerciseId} className="flex items-center gap-3 py-3">
            <span className="w-9 h-9 rounded-xl bg-achievement/15 text-achievement flex items-center justify-center shrink-0">
              <CheckIcon size={18} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14.5px] font-semibold truncate">{r.exerciseName}</span>
              <span className="block text-[11.5px] text-faint">
                {formatDate(r.achievedOn, 'long')} · est. 1RM {r.estimated1RM} kg
              </span>
            </span>
            <span className="text-right shrink-0">
              <span className="block text-[16px] font-bold tabular-nums">{r.maxWeightKg} kg</span>
              <span className="block text-[11px] text-faint">× {r.reps}</span>
            </span>
          </Card>
        ))}
      </div>
      <p className="text-[11.5px] text-faint mt-4 px-1 leading-snug">
        Estimated 1RM uses the Epley formula and is an approximation, not a tested maximum.
      </p>
    </>
  )
}
