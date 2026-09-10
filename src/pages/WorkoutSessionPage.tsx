/**
 * Workout session editor.
 *
 * One screen for building and logging a session: add exercises, fill in sets
 * or duration, then finish. Strength blocks get a set grid; cardio and
 * time-based blocks get duration/distance/intensity. Burn re-estimates as the
 * session changes.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type {
  Exercise, ExerciseType, Intensity, StrengthSet, Workout, WorkoutExercise, WorkoutRoutine,
} from '@/types'
import { useStore } from '@/store/useStore'
import { uid } from '@/services/repository'
import { exerciseRepo } from '@/services/exerciseRepository'
import {
  Card, ConfirmDialog, EmptyState, EstimateNote, Field, NumberField,
  Segmented, Sheet, toast,
} from '@/components/ui'
import {
  CheckIcon, ChevronLeft, CloseIcon, FlameIcon, PlusIcon, SearchIcon, TrashIcon,
} from '@/components/icons'
import {
  EXERCISE_TYPE_LABELS, INTENSITY_LABELS, MUSCLE_LABELS, isSetBased,
} from '@/data/exercises'
import { estimateWorkoutCalories, metFor, workoutVolume } from '@/utils/calculations'
import { today } from '@/utils/date'

export function WorkoutSessionPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [params] = useSearchParams()
  const date = params.get('date') ?? today()
  const routineId = params.get('routine')

  const workouts = useStore((s) => s.workouts)
  const routines = useStore((s) => s.routines)
  const profile = useStore((s) => s.profile)!
  const saveWorkout = useStore((s) => s.saveWorkout)
  const deleteWorkout = useStore((s) => s.deleteWorkout)
  const saveRoutine = useStore((s) => s.saveRoutine)

  const existing = id ? workouts.find((w) => w.id === id) : undefined

  // Local draft; committed to the store on save/finish so partial edits to an
  // in-progress session don't churn storage on every keystroke.
  const [draft, setDraft] = useState<Workout>(() =>
    existing ?? buildDraft(date, routineId ? routines.find((r) => r.id === routineId) : undefined))

  const [picker, setPicker] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saveAsRoutine, setSaveAsRoutine] = useState(false)
  const [saving, setSaving] = useState(false)

  // Adopt the stored version if it changes underneath us (e.g. after a save).
  useEffect(() => {
    if (existing && existing.id !== draft.id) setDraft(existing)
  }, [existing, draft.id])

  const estimatedBurn = useMemo(() => estimateWorkoutCalories(
    draft.exercises, Math.max(draft.durationMin, totalTimed(draft.exercises)),
    profile.weightKg, (eid) => exerciseRepo.get(eid),
  ), [draft.exercises, draft.durationMin, profile.weightKg])

  const volume = workoutVolume(draft.exercises)
  const isNew = !existing

  const update = (patch: Partial<Workout>) => setDraft((d) => ({ ...d, ...patch }))

  const updateExercise = (exId: string, patch: Partial<WorkoutExercise>) =>
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e)),
    }))

  const removeExercise = (exId: string) =>
    setDraft((d) => ({ ...d, exercises: d.exercises.filter((e) => e.id !== exId) }))

  const addExercise = (ex: Exercise) => {
    const block: WorkoutExercise = {
      id: uid('we-'),
      exerciseId: ex.id,
      exerciseName: ex.name,
      type: ex.type,
      ...(isSetBased(ex.type)
        ? { sets: [newSet(lastUsedWeight(workouts, ex.id))] }
        : { durationMin: 20, intensity: 'moderate' as Intensity, distanceKm: ex.tracksDistance ? 0 : undefined }),
    }
    setDraft((d) => ({ ...d, exercises: [...d.exercises, block] }))
    setPicker(false)
  }

  const validationError = useMemo(() => {
    if (draft.name.trim().length === 0) return 'Give the workout a name.'
    if (draft.exercises.length === 0) return 'Add at least one exercise.'
    const timed = totalTimed(draft.exercises)
    if (draft.durationMin <= 0 && timed <= 0) return 'Set a duration for the session.'
    return null
  }, [draft])

  const persist = async (finish: boolean) => {
    if (validationError) { toast(validationError); return }
    setSaving(true)
    const duration = Math.max(draft.durationMin, totalTimed(draft.exercises))
    await saveWorkout({
      ...draft,
      name: draft.name.trim(),
      durationMin: duration,
      inProgress: finish ? false : draft.inProgress,
      completedAt: finish ? Date.now() : draft.completedAt,
    })
    setSaving(false)
    toast(finish ? 'Workout logged' : 'Workout saved')
    navigate('/workout')
  }

  return (
    <div className="px-4 pt-3">
      <header className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate(-1)} className="tap -ml-2.5 text-muted focusable rounded-lg" aria-label="Back">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[19px] font-bold tracking-tight flex-1 truncate">
          {isNew ? 'New workout' : draft.inProgress ? 'In progress' : 'Edit workout'}
        </h1>
        {!isNew && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="tap -mr-2 text-faint focusable rounded-lg"
            aria-label="Delete workout"
          >
            <TrashIcon size={19} />
          </button>
        )}
      </header>

      <Card className="mb-3">
        <Field label="Workout name">
          <input
            className="field"
            value={draft.name}
            maxLength={50}
            placeholder="e.g. Push day"
            onChange={(e) => update({ name: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Duration" hint="Total session time">
            <NumberField
              value={draft.durationMin}
              onChange={(v) => update({ durationMin: v })}
              min={0} max={600} suffix="min"
            />
          </Field>
          <div>
            <span className="label block mb-1.5">Estimated burn</span>
            <div className="field flex items-center gap-2 text-burn font-semibold">
              <FlameIcon size={17} />
              <span className="tabular-nums">~{estimatedBurn} kcal</span>
            </div>
          </div>
        </div>
        {volume > 0 && (
          <p className="text-[12px] text-muted -mt-1">
            Volume: <strong className="text-ink">{volume.toLocaleString()} kg</strong> across completed sets
          </p>
        )}
      </Card>

      {draft.exercises.length === 0 ? (
        <EmptyState
          icon="💪"
          title="No exercises yet"
          body="Add exercises to log your sets, reps and weights — or duration and distance for cardio."
          action={
            <button className="btn-primary" onClick={() => setPicker(true)}>
              <PlusIcon size={18} /> Add exercise
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {draft.exercises.map((we) => (
            <ExerciseBlock
              key={we.id}
              block={we}
              onChange={(patch) => updateExercise(we.id, patch)}
              onRemove={() => removeExercise(we.id)}
            />
          ))}
        </div>
      )}

      {draft.exercises.length > 0 && (
        <button className="btn-ghost w-full mt-3" onClick={() => setPicker(true)}>
          <PlusIcon size={18} /> Add exercise
        </button>
      )}

      <div className="mt-5 space-y-2">
        <button
          className="btn-primary w-full"
          onClick={() => void persist(true)}
          disabled={saving || validationError !== null}
        >
          <CheckIcon size={19} /> {saving ? 'Saving…' : 'Finish workout'}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="btn-ghost"
            onClick={() => void persist(false)}
            disabled={saving || validationError !== null}
          >
            Save for later
          </button>
          <button
            className="btn-ghost"
            onClick={() => setSaveAsRoutine(true)}
            disabled={draft.exercises.length === 0}
          >
            Save as routine
          </button>
        </div>
        {validationError && (
          <p className="text-[12px] text-muted text-center pt-1">{validationError}</p>
        )}
      </div>

      <EstimateNote>
        <span className="block mt-4 px-1">
          Calorie burn is estimated from each activity's MET value, your bodyweight and the
          time spent. Actual expenditure varies between people and sessions.
        </span>
      </EstimateNote>

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={addExercise} />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this workout?"
        body="It will be removed from your history and analytics."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          void deleteWorkout(draft.id)
          toast('Workout deleted')
          navigate('/workout')
        }}
      />

      <SaveRoutineSheet
        open={saveAsRoutine}
        defaultName={draft.name}
        onClose={() => setSaveAsRoutine(false)}
        onSave={async (name) => {
          const routine: WorkoutRoutine = {
            id: uid('rt-'),
            name,
            createdAt: Date.now(),
            exercises: draft.exercises.map((e) => ({
              exerciseId: e.exerciseId,
              exerciseName: e.exerciseName,
              type: e.type,
              targetSets: e.sets?.length,
              targetReps: e.sets?.[0]?.reps,
              targetWeightKg: e.sets?.[0]?.weightKg,
              durationMin: e.durationMin,
            })),
          }
          await saveRoutine(routine)
          setSaveAsRoutine(false)
          toast('Routine saved')
        }}
      />
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function totalTimed(exercises: WorkoutExercise[]): number {
  return exercises.reduce((s, e) => s + (e.durationMin ?? 0), 0)
}

function newSet(weightKg = 20): StrengthSet {
  return { id: uid('set-'), weightKg, reps: 10, done: false }
}

/** Prefill new sets with the weight last used for that exercise. */
function lastUsedWeight(workouts: Workout[], exerciseId: string): number {
  const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date))
  for (const w of sorted) {
    for (const we of w.exercises) {
      if (we.exerciseId !== exerciseId) continue
      const done = (we.sets ?? []).filter((s) => s.done)
      const last = done[done.length - 1] ?? we.sets?.[we.sets.length - 1]
      if (last && last.weightKg > 0) return last.weightKg
    }
  }
  return 20
}

function buildDraft(date: string, routine?: WorkoutRoutine): Workout {
  return {
    id: uid('w-'),
    date,
    name: routine?.name ?? suggestName(),
    exercises: (routine?.exercises ?? []).map((r) => ({
      id: uid('we-'),
      exerciseId: r.exerciseId,
      exerciseName: r.exerciseName,
      type: r.type,
      ...(isSetBased(r.type)
        ? {
            sets: Array.from({ length: r.targetSets ?? 3 }, () => ({
              id: uid('set-'),
              weightKg: r.targetWeightKg ?? 20,
              reps: r.targetReps ?? 10,
              done: false,
            })),
          }
        : { durationMin: r.durationMin ?? 20, intensity: 'moderate' as Intensity }),
    })),
    durationMin: 0,
    caloriesBurned: 0,
    inProgress: true,
    startedAt: Date.now(),
  }
}

function suggestName(): string {
  const h = new Date().getHours()
  if (h < 11) return 'Morning workout'
  if (h < 17) return 'Afternoon workout'
  return 'Evening workout'
}

// ── Exercise block ──────────────────────────────────────────────────────────

function ExerciseBlock({ block, onChange, onRemove }: {
  block: WorkoutExercise
  onChange: (patch: Partial<WorkoutExercise>) => void
  onRemove: () => void
}) {
  const exercise = exerciseRepo.get(block.exerciseId)
  const setBased = isSetBased(block.type)

  const addSet = () => {
    const sets = block.sets ?? []
    const last = sets[sets.length - 1]
    onChange({
      sets: [...sets, last ? { ...last, id: uid('set-'), done: false } : newSet()],
    })
  }

  const updateSet = (setId: string, patch: Partial<StrengthSet>) =>
    onChange({ sets: (block.sets ?? []).map((s) => (s.id === setId ? { ...s, ...patch } : s)) })

  const removeSet = (setId: string) =>
    onChange({ sets: (block.sets ?? []).filter((s) => s.id !== setId) })

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line/60">
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold truncate">{block.exerciseName}</span>
          <span className="block text-[11.5px] text-faint">
            {EXERCISE_TYPE_LABELS[block.type]}
            {exercise && ` · ${exercise.muscleGroups.map((m) => MUSCLE_LABELS[m]).join(', ')}`}
          </span>
        </span>
        <button onClick={onRemove} className="tap -mr-2 text-faint focusable rounded-lg" aria-label={`Remove ${block.exerciseName}`}>
          <CloseIcon size={18} />
        </button>
      </div>

      {setBased ? (
        <div className="px-4 py-2.5">
          <div className="grid grid-cols-[28px_1fr_1fr_44px] gap-2 mb-1.5 text-[11px] text-faint font-medium px-0.5">
            <span>Set</span><span>Weight (kg)</span><span>Reps</span><span className="text-center">Done</span>
          </div>
          <div className="space-y-1.5">
            {(block.sets ?? []).map((s, i) => (
              <div key={s.id} className="grid grid-cols-[28px_1fr_1fr_44px] gap-2 items-center">
                <button
                  className="text-[13px] font-semibold text-faint tabular-nums text-left"
                  onClick={() => removeSet(s.id)}
                  aria-label={`Remove set ${i + 1}`}
                  title="Remove set"
                >
                  {i + 1}
                </button>
                <NumberField
                  value={s.weightKg}
                  onChange={(v) => updateSet(s.id, { weightKg: v })}
                  min={0} max={600} step={0.5}
                  aria-label={`Set ${i + 1} weight`}
                />
                <NumberField
                  value={s.reps}
                  onChange={(v) => updateSet(s.id, { reps: Math.round(v) })}
                  min={0} max={200}
                  aria-label={`Set ${i + 1} reps`}
                />
                <button
                  onClick={() => updateSet(s.id, { done: !s.done })}
                  aria-pressed={s.done}
                  aria-label={`Mark set ${i + 1} ${s.done ? 'not done' : 'done'}`}
                  className={`h-[44px] rounded-xl flex items-center justify-center transition focusable
                    ${s.done ? 'bg-brand text-brand-ink' : 'bg-raised text-faint'}`}
                >
                  <CheckIcon size={19} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addSet}
            className="w-full mt-2 py-2 text-[13px] font-semibold text-brand active:bg-raised rounded-lg transition focusable"
          >
            + Add set
          </button>
        </div>
      ) : (
        <div className="px-4 py-3">
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Duration">
              <NumberField
                value={block.durationMin ?? 0}
                onChange={(v) => onChange({ durationMin: v })}
                min={0} max={600} suffix="min"
              />
            </Field>
            {exercise?.tracksDistance && (
              <Field label="Distance">
                <NumberField
                  value={block.distanceKm ?? 0}
                  onChange={(v) => onChange({ distanceKm: v })}
                  min={0} max={500} step={0.1} suffix="km"
                />
              </Field>
            )}
          </div>
          <Field label="Intensity">
            <Segmented
              value={block.intensity ?? 'moderate'}
              onChange={(v) => onChange({ intensity: v })}
              options={(Object.keys(INTENSITY_LABELS) as Intensity[]).map((i) => ({
                value: i, label: INTENSITY_LABELS[i],
              }))}
            />
          </Field>
          {exercise && (
            <p className="text-[11.5px] text-faint -mt-1">
              ~{metFor(exercise, block.intensity ?? 'moderate')} MET at this intensity
            </p>
          )}
        </div>
      )}

      <div className="px-4 pb-3">
        <input
          className="field text-[13px] py-2.5"
          placeholder="Notes (optional)"
          value={block.notes ?? ''}
          maxLength={200}
          onChange={(e) => onChange({ notes: e.target.value })}
          aria-label={`Notes for ${block.exerciseName}`}
        />
      </div>
    </Card>
  )
}

// ── Exercise picker ─────────────────────────────────────────────────────────

function ExercisePicker({ open, onClose, onPick }: {
  open: boolean; onClose: () => void; onPick: (e: Exercise) => void
}) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<ExerciseType | 'all'>('all')

  const results = useMemo(
    () => exerciseRepo.search(query, type === 'all' ? undefined : type),
    [query, type],
  )

  useEffect(() => { if (open) { setQuery(''); setType('all') } }, [open])

  return (
    <Sheet open={open} onClose={onClose} title="Add exercise" fullHeight>
      <div className="sticky top-0 bg-surface pb-2 z-10">
        <div className="relative mb-2.5">
          <SearchIcon size={19} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          <input
            className="field pl-11"
            placeholder="Search exercises…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            aria-label="Search exercises"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          <button onClick={() => setType('all')} className={type === 'all' ? 'chip-on' : 'chip-off'}>
            All
          </button>
          {(Object.keys(EXERCISE_TYPE_LABELS) as ExerciseType[]).map((t) => (
            <button key={t} onClick={() => setType(t)} className={type === t ? 'chip-on' : 'chip-off'}>
              {EXERCISE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {results.length === 0 ? (
        <EmptyState icon="🔍" title="No exercises found" body={`Nothing matches "${query}".`} />
      ) : (
        <div className="space-y-1.5 pb-4">
          {results.map((e) => (
            <button
              key={e.id}
              onClick={() => onPick(e)}
              className="card w-full flex items-center gap-3 text-left py-3 active:scale-[0.99] transition focusable"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-[14.5px] font-medium truncate">{e.name}</span>
                <span className="block text-[11.5px] text-faint truncate">
                  {EXERCISE_TYPE_LABELS[e.type]} · {e.muscleGroups.map((m) => MUSCLE_LABELS[m]).join(', ')}
                  {e.equipment && ` · ${e.equipment}`}
                </span>
              </span>
              <PlusIcon size={19} className="text-brand shrink-0" />
            </button>
          ))}
        </div>
      )}
    </Sheet>
  )
}

function SaveRoutineSheet({ open, defaultName, onClose, onSave }: {
  open: boolean; defaultName: string; onClose: () => void; onSave: (name: string) => Promise<void>
}) {
  const [name, setName] = useState(defaultName)
  useEffect(() => { if (open) setName(defaultName) }, [open, defaultName])

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Save as routine"
      footer={
        <button
          className="btn-primary w-full"
          disabled={name.trim().length === 0}
          onClick={() => void onSave(name.trim())}
        >
          Save routine
        </button>
      }
    >
      <div className="pb-3">
        <p className="text-[13px] text-muted mb-4 leading-relaxed">
          Saves this exercise list as a template you can start future sessions from.
        </p>
        <Field label="Routine name">
          <input
            className="field" value={name} maxLength={50} autoFocus
            placeholder="e.g. Push day"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
      </div>
    </Sheet>
  )
}
