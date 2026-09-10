/** Exercise lookup and search, mirroring `foodRepository`. */
import type { Exercise, ExerciseType, ID } from '@/types'
import { SEED_EXERCISES } from '@/data/exercises'

function normalise(s: string): string {
  return s.toLowerCase().trim()
}

export class ExerciseRepository {
  private custom: Exercise[] = []

  setCustomExercises(list: Exercise[]): void {
    this.custom = list
  }

  all(): Exercise[] {
    return [...this.custom, ...SEED_EXERCISES]
  }

  get(id: ID): Exercise | undefined {
    return this.all().find((e) => e.id === id)
  }

  search(query: string, type?: ExerciseType): Exercise[] {
    const q = normalise(query)
    return this.all()
      .filter((e) => (type ? e.type === type : true))
      .map((e) => {
        const name = normalise(e.name)
        let score = 0
        if (q.length === 0) score = 100
        else if (name === q) score = 1000
        else if (name.startsWith(q)) score = 700
        else if (name.split(/[\s-]+/).some((w) => w.startsWith(q))) score = 500
        else if (name.includes(q)) score = 300
        else if (e.muscleGroups.some((m) => m.replace('_', ' ').startsWith(q))) score = 200
        else if (e.equipment && normalise(e.equipment).includes(q)) score = 150
        return { e, score }
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name))
      .map((r) => r.e)
  }

  byType(type: ExerciseType): Exercise[] {
    return this.all().filter((e) => e.type === type)
  }
}

export const exerciseRepo = new ExerciseRepository()
