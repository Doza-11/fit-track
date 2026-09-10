/**
 * Food tab — the day's intake in detail, with per-item editing.
 * The date can be shifted so this doubles as the food view for past days.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Meal, MealItem, MealType, Nutrients } from '@/types'
import { useStore, selectDailySummary } from '@/store/useStore'
import { foodRepo, nutrientsForServing } from '@/services/foodRepository'
import {
  Card, ConfirmDialog, EmptyState, Field, ProgressBar, Screen, Sheet,
  Stepper, toast,
} from '@/components/ui'
import {
  ChevronLeft, ChevronRight, PlusIcon, RepeatIcon, TrashIcon,
} from '@/components/icons'
import { MEAL_ICONS, MEAL_LABELS, MEAL_ORDER } from '@/data/foods'
import { calculateMacroProgress, round, sumNutrients } from '@/utils/calculations'
import { addDays, relativeDayLabel, today } from '@/utils/date'

export function FoodPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const date = params.get('date') ?? today()
  const isToday = date === today()

  const summary = useStore((s) => selectDailySummary(s, date))
  const saveCustomMeal = useStore((s) => s.saveCustomMeal)
  const [editing, setEditing] = useState<{ meal: Meal; item: MealItem } | null>(null)
  const [saveMealFor, setSaveMealFor] = useState<Meal | null>(null)

  const macros = calculateMacroProgress(summary.macros, summary.macroTargets)
  const shift = (days: number) => setParams({ date: addDays(date, days) })

  const visibleMeals = useMemo(() => {
    return MEAL_ORDER
      .map((type) => ({ type, meal: summary.meals.find((m) => m.type === type) }))
      .filter(({ type, meal }) =>
        // Always show the four main slots; extras only once they have content.
        (meal && meal.items.length > 0) || ['breakfast', 'lunch', 'snack', 'dinner'].includes(type))
  }, [summary.meals])

  return (
    <Screen>
      {/* Date navigator */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => shift(-1)} className="tap -ml-2 text-muted focusable rounded-lg" aria-label="Previous day">
          <ChevronLeft size={22} />
        </button>
        <div className="text-center">
          <h1 className="text-[19px] font-bold tracking-tight">{relativeDayLabel(date)}</h1>
          {!isToday && (
            <button className="text-[12px] text-brand font-semibold" onClick={() => setParams({})}>
              Jump to today
            </button>
          )}
        </div>
        <button
          onClick={() => shift(1)}
          disabled={isToday}
          className="tap -mr-2 text-muted disabled:opacity-25 focusable rounded-lg"
          aria-label="Next day"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Day totals */}
      <Card className="mb-4">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[13px] text-muted">Calories</span>
          <span className="text-[13px] text-muted tabular-nums">
            <strong className="text-ink text-[17px]">{summary.caloriesConsumed.toLocaleString()}</strong>
            {' / '}{summary.calorieTarget.toLocaleString()}
          </span>
        </div>
        <ProgressBar
          value={summary.calorieTarget > 0 ? summary.caloriesConsumed / summary.calorieTarget : 0}
          height={9}
        />
        <div className="grid grid-cols-3 gap-3 mt-3.5">
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
        <div className="flex gap-4 mt-3 pt-3 border-t border-line/70 text-[12px] text-muted">
          <span>Fiber <strong className="text-ink">{round(summary.macros.fiber, 0)}g</strong></span>
          <span>Sugar <strong className="text-ink">{round(summary.macros.sugar, 0)}g</strong></span>
        </div>
      </Card>

      {summary.meals.length === 0 && (
        <EmptyState
          icon="🍽️"
          title={isToday ? 'Nothing logged yet' : 'No meals logged this day'}
          body={isToday
            ? 'Add your first food and your daily totals will start filling in.'
            : 'You can still add meals to this day — pick a slot below.'}
          action={
            <button className="btn-primary" onClick={() => navigate(`/food/add?date=${date}`)}>
              <PlusIcon size={18} /> Add food
            </button>
          }
        />
      )}

      <div className="space-y-3">
        {visibleMeals.map(({ type, meal }) => (
          <MealCard
            key={type}
            type={type}
            meal={meal}
            date={date}
            onEdit={(item) => meal && setEditing({ meal, item })}
            onSaveAsMeal={() => meal && setSaveMealFor(meal)}
          />
        ))}
      </div>

      <EditItemSheet
        entry={editing}
        onClose={() => setEditing(null)}
      />

      <SaveMealSheet
        meal={saveMealFor}
        onClose={() => setSaveMealFor(null)}
        onSave={async (name) => {
          if (!saveMealFor) return
          await saveCustomMeal(
            name, saveMealFor.type,
            saveMealFor.items.map(({ id: _id, ...rest }) => rest),
          )
          toast('Meal saved')
          setSaveMealFor(null)
        }}
      />
    </Screen>
  )
}

function MealCard({ type, meal, date, onEdit, onSaveAsMeal }: {
  type: MealType
  meal?: Meal
  date: string
  onEdit: (item: MealItem) => void
  onSaveAsMeal: () => void
}) {
  const navigate = useNavigate()
  const removeMealItem = useStore((s) => s.removeMealItem)
  const [confirm, setConfirm] = useState<MealItem | null>(null)

  const items = meal?.items ?? []
  const totals = sumNutrients(items.map((i) => i.nutrients))

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className="text-[19px]" aria-hidden="true">{MEAL_ICONS[type]}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold">{MEAL_LABELS[type]}</span>
          {items.length > 0 && (
            <span className="block text-[11.5px] text-faint">
              P {round(totals.protein, 0)}g · C {round(totals.carbs, 0)}g · F {round(totals.fat, 0)}g
            </span>
          )}
        </span>
        {items.length > 0 && (
          <>
            <span className="text-[15px] font-bold tabular-nums">{Math.round(totals.calories)}</span>
            <button
              onClick={onSaveAsMeal}
              className="tap -mr-1 text-faint focusable rounded-lg"
              aria-label={`Save ${MEAL_LABELS[type]} as a reusable meal`}
              title="Save as meal"
            >
              <RepeatIcon size={17} />
            </button>
          </>
        )}
      </div>

      {items.length > 0 && (
        <div className="divide-y divide-line/60 border-t border-line/60">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 px-4 py-2.5">
              <button className="flex-1 min-w-0 text-left" onClick={() => onEdit(item)}>
                <span className="block text-[13.5px] font-medium truncate">{item.foodName}</span>
                <span className="block text-[11.5px] text-faint">
                  {item.quantity} × {item.servingLabel} · {round(item.grams, 0)} g
                </span>
              </button>
              <span className="text-[13px] font-semibold tabular-nums shrink-0">
                {Math.round(item.nutrients.calories)}
              </span>
              <button
                onClick={() => setConfirm(item)}
                className="tap -mr-2 text-faint focusable rounded-lg"
                aria-label={`Remove ${item.foodName}`}
              >
                <TrashIcon size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => navigate(`/food/add?meal=${type}&date=${date}`)}
        className="w-full flex items-center gap-2 px-4 py-3 text-[13.5px] font-semibold text-brand
                   border-t border-line/60 active:bg-raised transition focusable"
      >
        <PlusIcon size={17} /> Add to {MEAL_LABELS[type].toLowerCase()}
      </button>

      <ConfirmDialog
        open={confirm !== null}
        title={`Remove ${confirm?.foodName ?? 'item'}?`}
        confirmLabel="Remove"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (meal && confirm) void removeMealItem(meal.id, confirm.id)
          setConfirm(null)
          toast('Item removed')
        }}
      />
    </Card>
  )
}

/** Rescale a logged item's stored nutrition when its source food is gone. */
function scaleStored(item: MealItem, quantity: number): Nutrients {
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

function EditItemSheet({ entry, onClose }: {
  entry: { meal: Meal; item: MealItem } | null
  onClose: () => void
}) {
  const updateMealItem = useStore((s) => s.updateMealItem)
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

  const save = async () => {
    await updateMealItem(entry.meal.id, {
      ...entry.item,
      quantity,
      servingLabel: serving?.label ?? entry.item.servingLabel,
      grams: computed.grams,
      nutrients: computed.nutrients,
    })
    toast('Updated')
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={entry.item.foodName}
      footer={
        <button className="btn-primary w-full" onClick={() => void save()} disabled={quantity <= 0}>
          Save · {Math.round(computed.nutrients.calories)} kcal
        </button>
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
        <Field label="Quantity" hint={`${round(computed.grams, 0)} g total`}>
          <Stepper value={quantity} onChange={setQuantity} step={0.5} min={0.5} max={50} />
        </Field>
      </div>
    </Sheet>
  )
}

function SaveMealSheet({ meal, onClose, onSave }: {
  meal: Meal | null; onClose: () => void; onSave: (name: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  if (!meal) return null

  const suggested = meal.items.map((i) => i.foodName).slice(0, 2).join(' + ')

  return (
    <Sheet
      open
      onClose={onClose}
      title="Save as a meal"
      footer={
        <button
          className="btn-primary w-full"
          onClick={() => void onSave(name.trim() || suggested)}
        >
          Save meal
        </button>
      }
    >
      <div className="pb-3">
        <p className="text-[13px] text-muted mb-4 leading-relaxed">
          Save this combination so you can add all {meal.items.length} item
          {meal.items.length === 1 ? '' : 's'} again in one tap.
        </p>
        <Field label="Name">
          <input
            className="field" value={name} maxLength={50} autoFocus
            placeholder={suggested}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <div className="text-[12.5px] text-muted space-y-1">
          {meal.items.map((i) => (
            <div key={i.id} className="flex justify-between">
              <span className="truncate pr-3">{i.foodName}</span>
              <span className="tabular-nums shrink-0">{Math.round(i.nutrients.calories)} kcal</span>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  )
}
