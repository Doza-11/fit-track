/**
 * Change the portion of something already logged — from the Food tab or a
 * past day in History — instead of deleting and re-adding it.
 */
import { useEffect, useState } from 'react'
import type { Meal, MealItem, Nutrients } from '@/types'
import { useStore } from '@/store/useStore'
import { foodRepo, nutrientsForServing } from '@/services/foodRepository'
import { round } from '@/utils/calculations'
import { Field, Sheet, toast } from './ui'
import { PortionControl } from './PortionControl'
import { TrashIcon } from './icons'

/** Rescale a logged item's stored nutrition when its source food is gone. */
export function scaleStored(item: MealItem, quantity: number): Nutrients {
  const f = item.quantity > 0 ? quantity / item.quantity : 0
  const n = item.nutrients
  return {
    calories: round(n.calories * f, 1),
    protein: round(n.protein * f, 1),
    carbs: round(n.carbs * f, 1),
    fat: round(n.fat * f, 1),
    fiber: round(n.fiber * f, 1),
    sugar: round(n.sugar * f, 1),
  }
}

export function EditPortionSheet({ entry, onClose }: {
  entry: { meal: Meal; item: MealItem } | null
  onClose: () => void
}) {
  const updateMealItem = useStore((s) => s.updateMealItem)
  const removeMealItem = useStore((s) => s.removeMealItem)
  const [quantity, setQuantity] = useState(1)
  const [servingIndex, setServingIndex] = useState(0)

  const food = entry ? foodRepo.get(entry.item.foodId) : undefined

  // Seed the controls whenever a different item is opened.
  const key = entry?.item.id
  useEffect(() => {
    if (!entry) return
    setQuantity(entry.item.quantity)
    const i = food?.servings.findIndex((s) => s.label === entry.item.servingLabel) ?? -1
    setServingIndex(i >= 0 ? i : 0)
    // Keyed on the item id so re-renders don't fight the user's edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!entry) return null

  const serving = food?.servings[servingIndex]
  const computed = food && serving
    ? nutrientsForServing(food, serving, quantity)
    // The food is no longer in the database — scale the stored values instead.
    : {
        grams: entry.item.grams * (quantity / entry.item.quantity),
        nutrients: scaleStored(entry.item, quantity),
      }
  const before = Math.round(entry.item.nutrients.calories)
  const after = Math.round(computed.nutrients.calories)

  const save = async () => {
    await updateMealItem(entry.meal.id, {
      ...entry.item,
      quantity,
      servingLabel: serving?.label ?? entry.item.servingLabel,
      grams: computed.grams,
      nutrients: computed.nutrients,
    })
    toast(after === before ? 'Updated' : `Updated · ${before} → ${after} kcal`)
    onClose()
  }

  const remove = async () => {
    await removeMealItem(entry.meal.id, entry.item.id)
    toast(`${entry.item.foodName} removed`)
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={entry.item.foodName}
      footer={
        <div className="flex gap-2">
          <button
            className="btn-ghost px-4"
            onClick={() => void remove()}
            aria-label={`Remove ${entry.item.foodName}`}
          >
            <TrashIcon size={18} />
          </button>
          <button className="btn-primary flex-1" onClick={() => void save()} disabled={quantity <= 0}>
            Save · {after} kcal
          </button>
        </div>
      }
    >
      <div className="pb-3">
        {food && food.servings.length > 1 && (
          <Field label="Serving">
            <div className="flex flex-wrap gap-1.5">
              {food.servings.map((s, i) => (
                <button
                  key={s.label}
                  onClick={() => setServingIndex(i)}
                  className={i === servingIndex ? 'chip-on' : 'chip-off'}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Field>
        )}
        <PortionControl
          quantity={quantity}
          onChange={setQuantity}
          servingLabel={serving?.label ?? entry.item.servingLabel}
          grams={serving?.weightUnknown ? undefined : computed.grams}
          nutrients={computed.nutrients}
          hint={after !== before ? `Was ${before} kcal` : undefined}
        />
      </div>
    </Sheet>
  )
}
