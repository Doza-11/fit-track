/**
 * Seed exercise database.
 *
 * `met` is the Metabolic Equivalent of Task at moderate effort, taken from the
 * Compendium of Physical Activities. Burn estimates derived from it are
 * approximations — the UI labels them as estimates everywhere they appear.
 */
import type { Exercise, ExerciseType, Intensity, MuscleGroup } from '@/types'

type MetTriple = [light: number, moderate: number, vigorous: number]

function e(
  id: string,
  name: string,
  type: ExerciseType,
  muscleGroups: MuscleGroup[],
  met: number | MetTriple,
  opts: { tracksDistance?: boolean; equipment?: string } = {},
): Exercise {
  const base: Exercise = {
    id, name, type, muscleGroups,
    met: Array.isArray(met) ? met[1] : met,
    ...opts,
  }
  if (Array.isArray(met)) {
    const byIntensity: Record<Intensity, number> = { light: met[0], moderate: met[1], vigorous: met[2] }
    base.metByIntensity = byIntensity
  }
  return base
}

export const SEED_EXERCISES: Exercise[] = [
  // ── Strength: chest ──────────────────────────────────────────────────────
  e('bench-press', 'Bench Press', 'strength', ['chest', 'triceps'], 5, { equipment: 'Barbell' }),
  e('incline-bench', 'Incline Bench Press', 'strength', ['chest', 'shoulders'], 5, { equipment: 'Barbell' }),
  e('dumbbell-press', 'Dumbbell Chest Press', 'strength', ['chest', 'triceps'], 5, { equipment: 'Dumbbells' }),
  e('chest-fly', 'Chest Fly', 'strength', ['chest'], 4, { equipment: 'Dumbbells' }),
  e('cable-crossover', 'Cable Crossover', 'strength', ['chest'], 4, { equipment: 'Cable' }),
  e('dips', 'Dips', 'bodyweight', ['chest', 'triceps'], 6, { equipment: 'Parallel bars' }),

  // ── Strength: back ───────────────────────────────────────────────────────
  e('deadlift', 'Deadlift', 'strength', ['back', 'legs', 'glutes'], 6, { equipment: 'Barbell' }),
  e('barbell-row', 'Barbell Row', 'strength', ['back', 'biceps'], 5, { equipment: 'Barbell' }),
  e('dumbbell-row', 'Dumbbell Row', 'strength', ['back', 'biceps'], 5, { equipment: 'Dumbbells' }),
  e('lat-pulldown', 'Lat Pulldown', 'strength', ['back', 'biceps'], 5, { equipment: 'Cable' }),
  e('seated-row', 'Seated Cable Row', 'strength', ['back', 'biceps'], 5, { equipment: 'Cable' }),
  e('pull-up', 'Pull-up', 'bodyweight', ['back', 'biceps'], 8, { equipment: 'Pull-up bar' }),
  e('chin-up', 'Chin-up', 'bodyweight', ['back', 'biceps'], 8, { equipment: 'Pull-up bar' }),
  e('face-pull', 'Face Pull', 'strength', ['back', 'shoulders'], 4, { equipment: 'Cable' }),
  e('shrugs', 'Shrugs', 'strength', ['back', 'shoulders'], 4, { equipment: 'Dumbbells' }),

  // ── Strength: shoulders & arms ───────────────────────────────────────────
  e('shoulder-press', 'Shoulder Press', 'strength', ['shoulders', 'triceps'], 5, { equipment: 'Barbell' }),
  e('lateral-raise', 'Lateral Raise', 'strength', ['shoulders'], 4, { equipment: 'Dumbbells' }),
  e('front-raise', 'Front Raise', 'strength', ['shoulders'], 4, { equipment: 'Dumbbells' }),
  e('rear-delt-fly', 'Rear Delt Fly', 'strength', ['shoulders', 'back'], 4, { equipment: 'Dumbbells' }),
  e('arnold-press', 'Arnold Press', 'strength', ['shoulders'], 5, { equipment: 'Dumbbells' }),
  e('bicep-curl', 'Bicep Curl', 'strength', ['biceps'], 4, { equipment: 'Dumbbells' }),
  e('hammer-curl', 'Hammer Curl', 'strength', ['biceps'], 4, { equipment: 'Dumbbells' }),
  e('preacher-curl', 'Preacher Curl', 'strength', ['biceps'], 4, { equipment: 'Barbell' }),
  e('tricep-extension', 'Tricep Extension', 'strength', ['triceps'], 4, { equipment: 'Dumbbells' }),
  e('tricep-pushdown', 'Tricep Pushdown', 'strength', ['triceps'], 4, { equipment: 'Cable' }),
  e('skull-crusher', 'Skull Crusher', 'strength', ['triceps'], 4, { equipment: 'Barbell' }),

  // ── Strength: legs ───────────────────────────────────────────────────────
  e('squat', 'Squat', 'strength', ['legs', 'glutes'], 6, { equipment: 'Barbell' }),
  e('front-squat', 'Front Squat', 'strength', ['legs', 'core'], 6, { equipment: 'Barbell' }),
  e('leg-press', 'Leg Press', 'strength', ['legs', 'glutes'], 5, { equipment: 'Machine' }),
  e('lunges', 'Lunges', 'strength', ['legs', 'glutes'], 5, { equipment: 'Dumbbells' }),
  e('bulgarian-split-squat', 'Bulgarian Split Squat', 'strength', ['legs', 'glutes'], 5, { equipment: 'Dumbbells' }),
  e('romanian-deadlift', 'Romanian Deadlift', 'strength', ['legs', 'glutes', 'back'], 5, { equipment: 'Barbell' }),
  e('leg-curl', 'Leg Curl', 'strength', ['legs'], 4, { equipment: 'Machine' }),
  e('leg-extension', 'Leg Extension', 'strength', ['legs'], 4, { equipment: 'Machine' }),
  e('calf-raise', 'Calf Raise', 'strength', ['legs'], 4, { equipment: 'Machine' }),
  e('hip-thrust', 'Hip Thrust', 'strength', ['glutes', 'legs'], 5, { equipment: 'Barbell' }),
  e('goblet-squat', 'Goblet Squat', 'strength', ['legs', 'glutes'], 5, { equipment: 'Dumbbell' }),

  // ── Bodyweight & core ────────────────────────────────────────────────────
  e('push-up', 'Push-up', 'bodyweight', ['chest', 'triceps'], 8),
  e('bodyweight-squat', 'Bodyweight Squat', 'bodyweight', ['legs', 'glutes'], 5),
  e('plank', 'Plank', 'bodyweight', ['core'], 3),
  e('side-plank', 'Side Plank', 'bodyweight', ['core'], 3),
  e('crunches', 'Crunches', 'bodyweight', ['core'], 3.8),
  e('sit-up', 'Sit-up', 'bodyweight', ['core'], 4.3),
  e('leg-raise', 'Leg Raise', 'bodyweight', ['core'], 3.8),
  e('russian-twist', 'Russian Twist', 'bodyweight', ['core'], 4),
  e('mountain-climbers', 'Mountain Climbers', 'bodyweight', ['core', 'full_body'], 8),
  e('burpees', 'Burpees', 'bodyweight', ['full_body'], 8),
  e('jumping-jacks', 'Jumping Jacks', 'bodyweight', ['full_body'], 8),
  e('glute-bridge', 'Glute Bridge', 'bodyweight', ['glutes', 'core'], 3.5),
  e('wall-sit', 'Wall Sit', 'bodyweight', ['legs'], 4),
  e('bear-crawl', 'Bear Crawl', 'bodyweight', ['full_body', 'core'], 7),

  // ── Cardio ───────────────────────────────────────────────────────────────
  e('walking', 'Walking', 'cardio', ['cardio'], [2.8, 3.5, 5], { tracksDistance: true }),
  e('brisk-walking', 'Brisk Walking', 'cardio', ['cardio'], [3.5, 4.3, 5.3], { tracksDistance: true }),
  e('running', 'Running', 'cardio', ['cardio'], [7, 9.8, 12.8], { tracksDistance: true }),
  e('jogging', 'Jogging', 'cardio', ['cardio'], [6, 7, 8.3], { tracksDistance: true }),
  e('treadmill', 'Treadmill', 'cardio', ['cardio'], [5, 8, 11], { tracksDistance: true, equipment: 'Treadmill' }),
  e('cycling', 'Cycling', 'cardio', ['cardio', 'legs'], [4, 8, 12], { tracksDistance: true, equipment: 'Bicycle' }),
  e('stationary-bike', 'Stationary Bike', 'cardio', ['cardio', 'legs'], [4.8, 7, 10.5], { tracksDistance: true, equipment: 'Bike' }),
  e('swimming', 'Swimming', 'cardio', ['cardio', 'full_body'], [5.3, 7, 9.8], { tracksDistance: true }),
  e('elliptical', 'Elliptical', 'cardio', ['cardio', 'full_body'], [4.6, 5.5, 8], { equipment: 'Elliptical' }),
  e('rowing-machine', 'Rowing Machine', 'cardio', ['cardio', 'back', 'full_body'], [4.8, 7, 12], { tracksDistance: true, equipment: 'Rower' }),
  e('stair-climbing', 'Stair Climbing', 'cardio', ['cardio', 'legs'], [4, 8, 11], { equipment: 'Stairs' }),
  e('jump-rope', 'Jump Rope', 'cardio', ['cardio', 'full_body'], [8.8, 11.8, 12.3], { equipment: 'Rope' }),
  e('hiking', 'Hiking', 'cardio', ['cardio', 'legs'], [5.3, 6, 7.8], { tracksDistance: true }),
  e('hiit', 'HIIT', 'cardio', ['full_body', 'cardio'], [6, 8, 10]),
  e('boxing', 'Boxing', 'cardio', ['full_body', 'cardio'], [5.5, 7.8, 12.8]),
  e('dancing', 'Dancing', 'cardio', ['cardio', 'full_body'], [3.5, 5, 7.8]),

  // ── Mobility ─────────────────────────────────────────────────────────────
  e('yoga', 'Yoga', 'mobility', ['full_body'], [2.3, 3, 4]),
  e('power-yoga', 'Power Yoga', 'mobility', ['full_body'], 4),
  e('stretching', 'Stretching', 'mobility', ['full_body'], 2.3),
  e('foam-rolling', 'Foam Rolling', 'mobility', ['full_body'], 2.3, { equipment: 'Foam roller' }),
  e('pilates', 'Pilates', 'mobility', ['core', 'full_body'], 3),
  e('mobility-flow', 'Mobility Flow', 'mobility', ['full_body'], 2.8),
  e('surya-namaskar', 'Surya Namaskar', 'mobility', ['full_body'], 4.5),

  // ── Sports ───────────────────────────────────────────────────────────────
  e('cricket', 'Cricket', 'sport', ['full_body'], 4.8),
  e('football', 'Football', 'sport', ['full_body', 'cardio'], [5, 7, 10]),
  e('basketball', 'Basketball', 'sport', ['full_body', 'cardio'], [4.5, 6.5, 8]),
  e('badminton', 'Badminton', 'sport', ['full_body'], [4.5, 5.5, 7]),
  e('tennis', 'Tennis', 'sport', ['full_body'], [5, 7.3, 8]),
  e('table-tennis', 'Table Tennis', 'sport', ['full_body'], 4),
  e('volleyball', 'Volleyball', 'sport', ['full_body'], 4),
  e('squash', 'Squash', 'sport', ['full_body', 'cardio'], [7, 9, 12]),
  e('kabaddi', 'Kabaddi', 'sport', ['full_body'], 8),
]

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  bodyweight: 'Bodyweight',
  mobility: 'Mobility',
  sport: 'Sports',
}

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps',
  triceps: 'Triceps', legs: 'Legs', glutes: 'Glutes', core: 'Core',
  full_body: 'Full body', cardio: 'Cardio',
}

export const INTENSITY_LABELS: Record<Intensity, string> = {
  light: 'Light', moderate: 'Moderate', vigorous: 'Vigorous',
}

/** Exercises that log sets/reps/weight rather than duration. */
export function isSetBased(type: ExerciseType): boolean {
  return type === 'strength' || type === 'bodyweight'
}
