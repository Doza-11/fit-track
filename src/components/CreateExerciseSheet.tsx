/**
 * Create your own exercise: a name, a type, and roughly how many calories it
 * burns. The calories are turned into a MET value at the user's weight, which
 * is what every built-in exercise uses — so a custom one scales to any
 * duration and intensity exactly like the rest.
 */
import { useEffect, useState } from 'react'
import type { Exercise, ExerciseType, MuscleGroup } from '@/types'
import { useStore } from '@/store/useStore'
import { EXERCISE_TYPE_LABELS, MUSCLE_LABELS } from '@/data/exercises'
import { metFromCalories } from '@/utils/calculations'
import { Field, NumberField, Sheet, toast } from './ui'

/** Rough guides at 70 kg, shown so "how many calories?" isn't a blank stare. */
const EXAMPLES = 'For 30 min at ~70 kg: yoga ~100, brisk walk ~150, cycling ~250, running ~350 kcal.'

const DEFAULT_MUSCLE: Record<ExerciseType, MuscleGroup> = {
  strength: 'full_body', cardio: 'cardio', bodyweight: 'full_body', mobility: 'full_body', sport: 'full_body',
}

export function CreateExerciseSheet({ open, initialName = '', onClose, onCreated }: {
  open: boolean
  initialName?: string
  onClose: () => void
  onCreated: (e: Exercise) => void
}) {
  const addCustomExercise = useStore((s) => s.addCustomExercise)
  const weightKg = useStore((s) => s.profile?.weightKg ?? 70)
  const [name, setName] = useState('')
  const [type, setType] = useState<ExerciseType>('cardio')
  const [muscle, setMuscle] = useState<MuscleGroup>('cardio')
  const [kcal, setKcal] = useState(0)
  const [minutes, setMinutes] = useState(30)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(initialName)
    setType('cardio'); setMuscle('cardio'); setKcal(0); setMinutes(30); setTouched(false)
  }, [open, initialName])

  const met = metFromCalories(kcal, minutes, weightKg)
  const errors: string[] = []
  if (name.trim().length < 2) errors.push('Enter a name of at least 2 characters.')
  if (!(kcal > 0)) errors.push('Enter roughly how many calories it burns.')
  if (!(minutes > 0)) errors.push('Enter the duration those calories are for.')

  const save = async () => {
    setTouched(true)
    if (errors.length) return
    setSaving(true)
    const exercise = await addCustomExercise({
      name: name.trim(),
      type,
      muscleGroups: [muscle],
      met,
      tracksDistance: type === 'cardio',
    })
    setSaving(false)
    toast(`${exercise.name} saved to your exercises`)
    onCreated(exercise)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Create exercise"
      footer={
        <button className="btn-primary w-full" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save & add to workout'}
        </button>
      }
    >
      <div className="pb-3">
        <Field label="Exercise name">
          <input
            className="field" value={name} maxLength={50} autoFocus
            placeholder="e.g. Zumba class, Badminton"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label="Type">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(EXERCISE_TYPE_LABELS) as ExerciseType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setType(t); setMuscle(DEFAULT_MUSCLE[t]) }}
                className={type === t ? 'chip-on' : 'chip-off'}
              >
                {EXERCISE_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Main muscle group">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(MUSCLE_LABELS) as MuscleGroup[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMuscle(m)}
                className={muscle === m ? 'chip-on' : 'chip-off'}
              >
                {MUSCLE_LABELS[m]}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Calories burned">
            <NumberField value={kcal} onChange={setKcal} min={0} max={3000} suffix="kcal" />
          </Field>
          <Field label="In this many minutes">
            <NumberField value={minutes} onChange={setMinutes} min={1} max={600} suffix="min" />
          </Field>
        </div>
        <p className="text-[11.5px] text-faint -mt-1 mb-3 leading-snug">{EXAMPLES}</p>

        {met > 0 && (
          <p className="text-[12.5px] text-muted bg-raised rounded-xl px-3 py-2.5 leading-snug">
            About <strong className="text-ink">{Math.round((met * weightKg) / 60 * 10) / 10} kcal per minute</strong> at
            your weight. Logged sessions scale with the time you enter, like any other exercise.
          </p>
        )}
        {touched && errors.length > 0 && (
          <p className="text-[12px] text-danger text-center mt-3">{errors[0]}</p>
        )}
      </div>
    </Sheet>
  )
}
