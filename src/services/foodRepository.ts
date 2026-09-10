/**
 * Food lookup and search.
 *
 * Today this reads the bundled seed list plus the user's custom foods. The
 * async signature is deliberate: swapping in a remote food API later means
 * reimplementing `searchFoods`/`getFood` here, with no caller changes.
 */
import type { Food, ID, MealType, Nutrients, ServingSize } from '@/types'
import { SEED_FOODS } from '@/data/foods'
import { scaleNutrients } from '@/utils/calculations'

export interface FoodSearchOptions {
  /** Bias results toward foods usually eaten in this slot. */
  mealType?: MealType
  /** Ids the user logs often, floated to the top. */
  frequentIds?: ID[]
  limit?: number
}

/** Case/diacritic-insensitive key for matching. */
function normalise(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

/**
 * Score a food against a query. Higher is better; 0 means no match.
 * Ranking: exact > prefix > word-prefix > substring, then usage and meal fit.
 */
function scoreFood(food: Food, query: string, opts: FoodSearchOptions): number {
  const name = normalise(food.name)
  const q = normalise(query)

  let score = 0
  if (q.length > 0) {
    if (name === q) score = 1000
    else if (name.startsWith(q)) score = 700
    else if (name.split(/[\s/()-]+/).some((w) => w.startsWith(q))) score = 500
    else if (name.includes(q)) score = 300
    else if (food.brand && normalise(food.brand).includes(q)) score = 250
    else if (normalise(food.category).startsWith(q)) score = 100
    else return 0
  } else {
    score = 100
  }

  if (opts.frequentIds?.includes(food.id)) score += 120
  if (opts.mealType && food.commonMeals?.includes(opts.mealType)) score += 60
  if (food.custom) score += 40
  // Prefer shorter names among equally good matches ("Roti" over "Aloo Paratha").
  score -= Math.min(20, name.length / 4)
  return score
}

export class FoodRepository {
  private custom: Food[] = []

  setCustomFoods(foods: Food[]): void {
    this.custom = foods
  }

  all(): Food[] {
    return [...this.custom, ...SEED_FOODS]
  }

  get(id: ID): Food | undefined {
    return this.all().find((f) => f.id === id)
  }

  search(query: string, opts: FoodSearchOptions = {}): Food[] {
    const limit = opts.limit ?? 50
    return this.all()
      .map((food) => ({ food, score: scoreFood(food, query, opts) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name))
      .slice(0, limit)
      .map((r) => r.food)
  }

  byCategory(category: Food['category']): Food[] {
    return this.all().filter((f) => f.category === category)
  }
}

export const foodRepo = new FoodRepository()

/** Nutrition for `quantity` of a given serving. */
export function nutrientsForServing(
  food: Food, serving: ServingSize, quantity: number,
): { grams: number; nutrients: Nutrients } {
  const grams = serving.grams * quantity
  return { grams, nutrients: scaleNutrients(food.per100g, grams) }
}
