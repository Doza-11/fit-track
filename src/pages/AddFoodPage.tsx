/**
 * Add food: search → pick portion → log.
 *
 * Three tabs cover the ways people actually log: searching the database,
 * repeating something saved, and creating a food that isn't there.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { CustomMeal, Food, MealItem, MealType, Nutrients, ServingSize } from '@/types'
import { useStore } from '@/store/useStore'
import { foodRepo, nutrientsForServing } from '@/services/foodRepository'
import {
  Card, ConfirmDialog, EmptyState, Field, NumberField, Segmented, Sheet,
  Stepper, toast,
} from '@/components/ui'
import { ChevronLeft, PlusIcon, SearchIcon, TrashIcon } from '@/components/icons'
import { FOOD_CATEGORY_LABELS, MEAL_ICONS, MEAL_LABELS, MEAL_ORDER } from '@/data/foods'
import { EMPTY_NUTRIENTS, round, sumNutrients } from '@/utils/calculations'
import { today } from '@/utils/date'

type Tab = 'search' | 'meals' | 'custom'

export function AddFoodPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const date = params.get('date') ?? today()

  const initialMeal = (params.get('meal') as MealType | null) ?? defaultMealForNow()
  const initialTab = (params.get('tab') as Tab | null) ?? 'search'

  const [tab, setTab] = useState<Tab>(initialTab)
  const [mealType, setMealType] = useState<MealType>(initialMeal)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)

  const frequentFoodIds = useStore((s) => s.frequentFoodIds)
  const customFoods = useStore((s) => s.customFoods)

  const results = useMemo(
    () => foodRepo.search(query, { mealType, frequentIds: frequentFoodIds, limit: 60 }),
    // customFoods is a dependency because foodRepo's contents change with it.
    [query, mealType, frequentFoodIds, customFoods],
  )

  const frequent = useMemo(
    () => frequentFoodIds.map((id) => foodRepo.get(id)).filter((f): f is Food => !!f).slice(0, 8),
    [frequentFoodIds, customFoods],
  )

  return (
    <div className="px-4 pt-3">
      <header className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate(-1)} className="tap -ml-2.5 text-muted focusable rounded-lg" aria-label="Back">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[20px] font-bold tracking-tight flex-1">Add food</h1>
      </header>

      {/* Meal selector — always visible so the destination is never ambiguous. */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-3 -mx-4 px-4">
        {MEAL_ORDER.map((t) => (
          <button
            key={t}
            onClick={() => setMealType(t)}
            className={mealType === t ? 'chip-on' : 'chip-off'}
          >
            <span aria-hidden="true">{MEAL_ICONS[t]}</span> {MEAL_LABELS[t]}
          </button>
        ))}
      </div>

      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'search', label: 'Search' },
          { value: 'meals', label: 'My meals' },
          { value: 'custom', label: 'Create' },
        ]}
      />

      {tab === 'search' && (
        <>
          <div className="relative mb-3">
            <SearchIcon size={19} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
            <input
              className="field pl-11"
              placeholder="Search foods…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              type="search"
              aria-label="Search foods"
            />
          </div>

          {query.length === 0 && frequent.length > 0 && (
            <>
              <p className="label px-1 mb-2">Frequently logged</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {frequent.map((f) => (
                  <button key={f.id} className="chip-off" onClick={() => setSelected(f)}>
                    {f.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {results.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="No foods found"
              body={`Nothing matches "${query}". You can create it as a custom food instead.`}
              action={
                <button className="btn-primary" onClick={() => setTab('custom')}>
                  <PlusIcon size={18} /> Create food
                </button>
              }
            />
          ) : (
            <div className="space-y-1.5">
              {results.map((f) => (
                <FoodRow key={f.id} food={f} onClick={() => setSelected(f)} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'meals' && <SavedMealsTab date={date} mealType={mealType} />}
      {tab === 'custom' && <CreateFoodTab onCreated={(f) => { setSelected(f); setTab('search') }} />}

      <PortionSheet
        food={selected}
        mealType={mealType}
        date={date}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}

/** Meal slot that matches the current time, so the common case needs no taps. */
function defaultMealForNow(): MealType {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 19) return 'snack'
  return 'dinner'
}

function FoodRow({ food, onClick }: { food: Food; onClick: () => void }) {
  const s = food.servings[0]
  const per = nutrientsForServing(food, s, 1).nutrients
  return (
    <button
      onClick={onClick}
      className="card w-full flex items-center gap-3 text-left py-3 active:scale-[0.99] transition focusable"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-[14.5px] font-medium truncate">
          {food.name}
          {food.brand && <span className="ml-1.5 text-[11.5px] text-faint font-normal">{food.brand}</span>}
          {food.custom && <span className="ml-1.5 text-[10px] text-brand font-bold uppercase">Custom</span>}
        </span>
        <span className="block text-[12px] text-faint truncate">
          {s.label} · P {round(per.protein, 0)}g · C {round(per.carbs, 0)}g · F {round(per.fat, 0)}g
        </span>
      </span>
      <span className="text-right shrink-0">
        <span className="block text-[15px] font-bold tabular-nums">{Math.round(per.calories)}</span>
        <span className="block text-[10.5px] text-faint">kcal</span>
      </span>
    </button>
  )
}

// ── Portion sheet ───────────────────────────────────────────────────────────

function PortionSheet({ food, mealType, date, onClose }: {
  food: Food | null; mealType: MealType; date: string; onClose: () => void
}) {
  const addMealItems = useStore((s) => s.addMealItems)
  const [servingIndex, setServingIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [saving, setSaving] = useState(false)

  // Reset the portion whenever a different food is opened.
  useEffect(() => {
    setServingIndex(0)
    setQuantity(1)
  }, [food?.id])

  if (!food) return null

  const serving: ServingSize = food.servings[servingIndex] ?? food.servings[0]
  const { grams, nutrients } = nutrientsForServing(food, serving, quantity)

  const add = async () => {
    if (quantity <= 0) return
    setSaving(true)
    await addMealItems(date, mealType, [{
      foodId: food.id,
      foodName: food.name,
      servingLabel: serving.label,
      quantity,
      grams,
      nutrients,
    }])
    setSaving(false)
    toast(`${food.name} added to ${MEAL_LABELS[mealType].toLowerCase()}`)
    onClose()
  }

  return (
    <Sheet
      open={!!food}
      onClose={onClose}
      title={food.name}
      footer={
        <button className="btn-primary w-full" onClick={() => void add()} disabled={saving || quantity <= 0}>
          {saving ? 'Adding…' : `Add to ${MEAL_LABELS[mealType]} · ${Math.round(nutrients.calories)} kcal`}
        </button>
      }
    >
      <div className="pb-3">
        <p className="text-[12.5px] text-muted mb-4">
          {FOOD_CATEGORY_LABELS[food.category]} · {Math.round(food.per100g.calories)} kcal per 100 g
        </p>

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

        <Field label="Quantity" hint={`${round(grams, 0)} g total`}>
          <Stepper value={quantity} onChange={setQuantity} step={0.5} min={0.5} max={50} />
        </Field>

        <NutritionPanel nutrients={nutrients} />
      </div>
    </Sheet>
  )
}

export function NutritionPanel({ nutrients }: { nutrients: Nutrients }) {
  const rows: Array<[string, number, string, string?]> = [
    ['Protein', nutrients.protein, 'g', 'protein'],
    ['Carbs', nutrients.carbs, 'g', 'carbs'],
    ['Fat', nutrients.fat, 'g', 'fat'],
    ['Fiber', nutrients.fiber, 'g'],
    ['Sugar', nutrients.sugar, 'g'],
  ]
  return (
    <Card className="mt-1">
      <div className="flex items-baseline justify-between pb-2.5 mb-2.5 border-b border-line">
        <span className="text-[14px] font-semibold">Calories</span>
        <span className="text-[22px] font-bold tabular-nums">{Math.round(nutrients.calories)}</span>
      </div>
      {rows.map(([label, value, unit, token]) => (
        <div key={label} className="flex justify-between py-[3px]">
          <span className="text-[13px] text-muted flex items-center gap-2">
            {token && (
              <span className="w-2 h-2 rounded-full" style={{ background: `rgb(var(--c-${token}))` }} />
            )}
            {label}
          </span>
          <span className="text-[13px] font-semibold tabular-nums">{round(value, 1)}{unit}</span>
        </div>
      ))}
    </Card>
  )
}

// ── Saved meals tab ─────────────────────────────────────────────────────────

function SavedMealsTab({ date, mealType }: { date: string; mealType: MealType }) {
  const customMeals = useStore((s) => s.customMeals)
  const meals = useStore((s) => s.meals)
  const addMealItems = useStore((s) => s.addMealItems)
  const deleteCustomMeal = useStore((s) => s.deleteCustomMeal)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  /** Recent distinct meals from history, newest first. */
  const recent = useMemo(() => {
    return [...meals]
      .filter((m) => m.date !== date && m.items.length > 0)
      .sort((a, b) => b.loggedAt - a.loggedAt)
      .slice(0, 8)
  }, [meals, date])

  const addSaved = async (m: CustomMeal) => {
    await addMealItems(date, mealType, m.items)
    toast(`${m.name} added`)
  }

  if (customMeals.length === 0 && recent.length === 0) {
    return (
      <EmptyState
        icon="🍱"
        title="No saved meals yet"
        body="Log a few meals first — you can then save combinations you eat often and add them again in one tap."
      />
    )
  }

  return (
    <>
      {customMeals.length > 0 && (
        <>
          <p className="label px-1 mb-2">Saved meals</p>
          <div className="space-y-1.5 mb-5">
            {customMeals.map((m) => {
              const n = sumNutrients(m.items.map((i) => i.nutrients))
              return (
                <div key={m.id} className="card flex items-center gap-2 py-3">
                  <button className="flex-1 min-w-0 text-left" onClick={() => void addSaved(m)}>
                    <span className="block text-[14.5px] font-medium truncate">{m.name}</span>
                    <span className="block text-[12px] text-faint truncate">
                      {m.items.length} item{m.items.length === 1 ? '' : 's'} · {Math.round(n.calories)} kcal
                    </span>
                  </button>
                  <button
                    onClick={() => setConfirmId(m.id)}
                    className="tap text-faint focusable rounded-lg"
                    aria-label={`Delete ${m.name}`}
                  >
                    <TrashIcon size={18} />
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {recent.length > 0 && (
        <>
          <p className="label px-1 mb-2">Repeat a recent meal</p>
          <div className="space-y-1.5">
            {recent.map((m) => {
              const n = sumNutrients(m.items.map((i) => i.nutrients))
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    void addMealItems(date, mealType, m.items.map(({ id: _id, ...r }) => r))
                    toast('Meal added')
                  }}
                  className="card w-full flex items-center gap-3 text-left py-3 active:scale-[0.99] transition focusable"
                >
                  <span className="text-[18px] shrink-0" aria-hidden="true">{MEAL_ICONS[m.type]}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-medium truncate">
                      {m.items.map((i) => i.foodName).join(', ')}
                    </span>
                    <span className="block text-[11.5px] text-faint">
                      {MEAL_LABELS[m.type]} · {m.date}
                    </span>
                  </span>
                  <span className="text-[14px] font-semibold tabular-nums shrink-0">
                    {Math.round(n.calories)}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmId !== null}
        title="Delete saved meal?"
        body="This removes the saved combination. Meals you've already logged are not affected."
        onCancel={() => setConfirmId(null)}
        onConfirm={() => {
          if (confirmId) void deleteCustomMeal(confirmId)
          setConfirmId(null)
          toast('Saved meal deleted')
        }}
      />
    </>
  )
}

// ── Create custom food ──────────────────────────────────────────────────────

function CreateFoodTab({ onCreated }: { onCreated: (f: Food) => void }) {
  const addCustomFood = useStore((s) => s.addCustomFood)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Food['category']>('indian')
  const [servingLabel, setServingLabel] = useState('1 serving')
  const [servingGrams, setServingGrams] = useState(100)
  const [per, setPer] = useState<Nutrients>({ ...EMPTY_NUTRIENTS })
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  const errors: Record<string, string> = {}
  if (name.trim().length < 2) errors.name = 'Enter a name of at least 2 characters.'
  if (!(per.calories > 0)) errors.calories = 'Calories must be greater than 0.'
  if (!(servingGrams > 0)) errors.grams = 'Serving weight must be greater than 0.'
  const macroKcal = per.protein * 4 + per.carbs * 4 + per.fat * 9
  // A gross mismatch usually means a typo, so warn without blocking the save.
  const macroWarning = per.calories > 0 && macroKcal > per.calories * 1.6
    ? 'The macros add up to noticeably more energy than the calories you entered. Double-check the values.'
    : null

  const valid = Object.keys(errors).length === 0

  const save = async () => {
    setTouched(true)
    if (!valid) return
    setSaving(true)
    const food = await addCustomFood({
      name: name.trim(),
      category,
      per100g: per,
      servings: [{ label: servingLabel.trim() || '1 serving', grams: servingGrams }],
    })
    setSaving(false)
    toast('Custom food created')
    setName('')
    setPer({ ...EMPTY_NUTRIENTS })
    onCreated(food)
  }

  const field = (key: keyof Nutrients, label: string, suffix = 'g') => (
    <Field label={label} error={touched && key === 'calories' ? errors.calories : undefined}>
      <NumberField
        value={per[key]}
        onChange={(v) => setPer((p) => ({ ...p, [key]: v }))}
        min={0} max={key === 'calories' ? 900 : 100} step={0.1} suffix={suffix}
      />
    </Field>
  )

  return (
    <div className="pb-4">
      <p className="text-[12.5px] text-muted mb-4 leading-relaxed">
        Enter nutrition <strong>per 100 g</strong> — usually printed on the pack. FitTrack
        scales it to whatever portion you log.
      </p>

      <Field label="Food name" error={touched ? errors.name : undefined}>
        <input
          className="field" value={name} maxLength={60}
          placeholder="e.g. Mum's rajma"
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <Field label="Category">
        <select
          className="field appearance-none"
          value={category}
          onChange={(e) => setCategory(e.target.value as Food['category'])}
        >
          {Object.entries(FOOD_CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Serving name">
          <input
            className="field" value={servingLabel} maxLength={24}
            placeholder="1 bowl"
            onChange={(e) => setServingLabel(e.target.value)}
          />
        </Field>
        <Field label="Serving weight" error={touched ? errors.grams : undefined}>
          <NumberField value={servingGrams} onChange={setServingGrams} min={1} max={2000} suffix="g" />
        </Field>
      </div>

      <p className="label px-1 mt-2 mb-2">Per 100 g</p>
      {field('calories', 'Calories', 'kcal')}
      <div className="grid grid-cols-3 gap-2">
        {field('protein', 'Protein')}
        {field('carbs', 'Carbs')}
        {field('fat', 'Fat')}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {field('fiber', 'Fiber')}
        {field('sugar', 'Sugar')}
      </div>

      {macroWarning && (
        <p className="text-[12px] text-burn bg-burn/10 rounded-xl px-3 py-2.5 mb-3 leading-snug">
          {macroWarning}
        </p>
      )}

      <button className="btn-primary w-full" onClick={() => void save()} disabled={saving}>
        {saving ? 'Saving…' : 'Create food'}
      </button>
      {touched && !valid && (
        <p className="text-[12px] text-danger text-center mt-2">{Object.values(errors)[0]}</p>
      )}
    </div>
  )
}

export type { MealItem }
