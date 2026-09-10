/**
 * Onboarding: collects the inputs the BMR/TDEE calculation needs, then shows
 * the recommended target before committing so the number never appears
 * unexplained.
 */
import { useMemo, useState } from 'react'
import { useStore, type OnboardingInput } from '@/store/useStore'
import { Field, NumberField, Segmented, Stepper } from '@/components/ui'
import { ChevronLeft, TargetIcon } from '@/components/icons'
import {
  ACTIVITY_LABELS, GOAL_LABELS, cmToFtIn, ftInToCm, kgToLb, lbToKg, recommendTargets,
} from '@/utils/calculations'
import type { ActivityLevel, GoalType, HeightUnit, Sex, WeightUnit } from '@/types'

type Step = 'welcome' | 'about' | 'body' | 'activity' | 'goal' | 'plan'
const FLOW: Step[] = ['welcome', 'about', 'body', 'activity', 'goal', 'plan']

interface Draft {
  name: string
  age: number
  sex: Sex
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  goalType: GoalType
  targetWeightKg: number
  weightUnit: WeightUnit
  heightUnit: HeightUnit
}

const INITIAL: Draft = {
  name: '', age: 28, sex: 'male', heightCm: 172, weightKg: 70,
  activityLevel: 'light', goalType: 'maintain', targetWeightKg: 70,
  weightUnit: 'kg', heightUnit: 'cm',
}

export function OnboardingPage() {
  const createProfile = useStore((s) => s.createProfile)
  const updateProfile = useStore((s) => s.updateProfile)
  const [step, setStep] = useState<Step>('welcome')
  const [draft, setDraft] = useState<Draft>(INITIAL)
  const [saving, setSaving] = useState(false)
  const [customTarget, setCustomTarget] = useState<number | null>(null)

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const index = FLOW.indexOf(step)

  const plan = useMemo(() => recommendTargets({
    weightKg: draft.weightKg, heightCm: draft.heightCm, age: draft.age, sex: draft.sex,
    activityLevel: draft.activityLevel, goal: draft.goalType,
  }), [draft])

  const errors = validate(draft, step)
  const canContinue = Object.keys(errors).length === 0

  const next = () => setStep(FLOW[Math.min(FLOW.length - 1, index + 1)])
  const back = () => setStep(FLOW[Math.max(0, index - 1)])

  const finish = async () => {
    setSaving(true)
    const input: OnboardingInput = {
      name: draft.name, age: draft.age, sex: draft.sex, heightCm: draft.heightCm,
      weightKg: draft.weightKg, activityLevel: draft.activityLevel, goalType: draft.goalType,
      targetWeightKg: draft.goalType === 'maintain' ? undefined : draft.targetWeightKg,
    }
    await createProfile(input)
    // Persist unit preference and any hand-edited target from the last step.
    await updateProfile({
      units: { weight: draft.weightUnit, height: draft.heightUnit },
      ...(customTarget !== null && customTarget !== plan.calories
        ? { calorieTarget: customTarget, calorieTargetIsCustom: true }
        : {}),
    })
    setSaving(false)
  }

  return (
    <div className="min-h-[100dvh] bg-bg flex flex-col">
      <div className="mx-auto w-full max-w-[480px] flex-1 flex flex-col px-5"
           style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>

        {step !== 'welcome' && (
          <div className="flex items-center gap-3 py-3">
            <button onClick={back} className="tap -ml-2.5 text-muted focusable rounded-lg" aria-label="Back">
              <ChevronLeft size={24} />
            </button>
            <div className="flex-1 h-1.5 bg-raised rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all duration-400"
                style={{ width: `${(index / (FLOW.length - 1)) * 100}%` }}
              />
            </div>
            <span className="text-[12px] text-faint tabular-nums w-8 text-right">
              {index}/{FLOW.length - 1}
            </span>
          </div>
        )}

        <div className="flex-1 py-4 animate-pop-in" key={step}>
          {step === 'welcome' && <Welcome />}

          {step === 'about' && (
            <StepBody title="Tell us about you" sub="This sets your starting calorie estimate. You can change any of it later.">
              <Field label="Name" hint="Only used to greet you.">
                <input
                  className="field" value={draft.name} autoFocus
                  placeholder="Your name"
                  onChange={(e) => set('name', e.target.value)}
                  maxLength={40}
                />
              </Field>
              <Field label="Age" error={errors.age}>
                <NumberField value={draft.age} onChange={(v) => set('age', v)} min={13} max={100} suffix="years" />
              </Field>
              <Field label="Sex" hint="Used by the BMR formula. Only male/female are supported by the standard equation.">
                <Segmented
                  value={draft.sex}
                  onChange={(v) => set('sex', v)}
                  options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
                />
              </Field>
            </StepBody>
          )}

          {step === 'body' && (
            <StepBody title="Your measurements" sub="Height and weight drive the calorie and macro estimates.">
              <Field label="Units">
                <div className="flex gap-2">
                  <Segmented
                    className="flex-1"
                    value={draft.weightUnit}
                    onChange={(v) => set('weightUnit', v)}
                    options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]}
                  />
                  <Segmented
                    className="flex-1"
                    value={draft.heightUnit}
                    onChange={(v) => set('heightUnit', v)}
                    options={[{ value: 'cm', label: 'cm' }, { value: 'ft', label: 'ft/in' }]}
                  />
                </div>
              </Field>

              <HeightInput
                unit={draft.heightUnit}
                cm={draft.heightCm}
                onChange={(cm) => set('heightCm', cm)}
                error={errors.heightCm}
              />

              <Field label={`Weight (${draft.weightUnit})`} error={errors.weightKg}>
                <Stepper
                  value={draft.weightUnit === 'lb' ? kgToLb(draft.weightKg) : draft.weightKg}
                  onChange={(v) => set('weightKg', draft.weightUnit === 'lb' ? lbToKg(v) : v)}
                  step={draft.weightUnit === 'lb' ? 0.5 : 0.5}
                  min={draft.weightUnit === 'lb' ? 66 : 30}
                  max={draft.weightUnit === 'lb' ? 660 : 300}
                  suffix={draft.weightUnit}
                />
              </Field>
            </StepBody>
          )}

          {step === 'activity' && (
            <StepBody title="How active are you?" sub="Outside of workouts you log — think about your typical week.">
              <div className="space-y-2">
                {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((level) => (
                  <ChoiceCard
                    key={level}
                    selected={draft.activityLevel === level}
                    title={ACTIVITY_LABELS[level].title}
                    sub={ACTIVITY_LABELS[level].detail}
                    onClick={() => set('activityLevel', level)}
                  />
                ))}
              </div>
            </StepBody>
          )}

          {step === 'goal' && (
            <StepBody title="What's your goal?" sub="We'll set a moderate, sustainable pace by default.">
              <div className="space-y-2 mb-4">
                {(Object.keys(GOAL_LABELS) as GoalType[]).map((g) => (
                  <ChoiceCard
                    key={g}
                    selected={draft.goalType === g}
                    title={GOAL_LABELS[g].title}
                    sub={GOAL_LABELS[g].detail}
                    onClick={() => {
                      set('goalType', g)
                      // Seed a sensible goal weight the first time it's needed.
                      if (draft.targetWeightKg === draft.weightKg) {
                        const delta = g === 'lose' ? -4 : g === 'gain' || g === 'build_muscle' ? 3 : 0
                        set('targetWeightKg', Math.round((draft.weightKg + delta) * 10) / 10)
                      }
                    }}
                  />
                ))}
              </div>

              {draft.goalType !== 'maintain' && (
                <Field label={`Goal weight (${draft.weightUnit})`} error={errors.targetWeightKg}>
                  <Stepper
                    value={draft.weightUnit === 'lb' ? kgToLb(draft.targetWeightKg) : draft.targetWeightKg}
                    onChange={(v) => set('targetWeightKg', draft.weightUnit === 'lb' ? lbToKg(v) : v)}
                    step={0.5}
                    min={draft.weightUnit === 'lb' ? 66 : 30}
                    max={draft.weightUnit === 'lb' ? 660 : 300}
                    suffix={draft.weightUnit}
                  />
                </Field>
              )}
            </StepBody>
          )}

          {step === 'plan' && (
            <PlanStep
              plan={plan}
              draft={draft}
              customTarget={customTarget}
              onCustomTarget={setCustomTarget}
            />
          )}
        </div>

        <div className="py-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {step === 'plan' ? (
            <button className="btn-primary w-full" onClick={() => void finish()} disabled={saving}>
              {saving ? 'Setting up…' : 'Start tracking'}
            </button>
          ) : (
            <button className="btn-primary w-full" onClick={next} disabled={!canContinue}>
              {step === 'welcome' ? 'Get started' : 'Continue'}
            </button>
          )}
          {!canContinue && Object.values(errors)[0] && (
            <p className="text-[12px] text-danger text-center mt-2">{Object.values(errors)[0]}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function validate(d: Draft, step: Step): Record<string, string> {
  const e: Record<string, string> = {}
  if (step === 'about') {
    if (!(d.age >= 13 && d.age <= 100)) e.age = 'Enter an age between 13 and 100.'
  }
  if (step === 'body') {
    if (!(d.heightCm >= 100 && d.heightCm <= 250)) e.heightCm = 'Enter a height between 100 and 250 cm.'
    if (!(d.weightKg >= 30 && d.weightKg <= 300)) e.weightKg = 'Enter a weight between 30 and 300 kg.'
  }
  if (step === 'goal' && d.goalType !== 'maintain') {
    if (!(d.targetWeightKg >= 30 && d.targetWeightKg <= 300)) {
      e.targetWeightKg = 'Enter a goal weight between 30 and 300 kg.'
    }
  }
  return e
}

function Welcome() {
  return (
    <div className="flex flex-col items-center text-center pt-10">
      <div className="w-20 h-20 rounded-3xl bg-brand text-brand-ink flex items-center justify-center mb-6 shadow-lg shadow-brand/25">
        <TargetIcon size={40} />
      </div>
      <h1 className="text-[32px] font-bold tracking-tight leading-tight mb-3">FitTrack</h1>
      <p className="text-[15px] text-muted leading-relaxed max-w-[300px]">
        Track meals, workouts and progress in one place. A few questions first, so
        your daily targets start out close to right.
      </p>
      <ul className="mt-8 space-y-3 text-left w-full max-w-[300px]">
        {[
          ['🍎', 'Log food from a built-in database'],
          ['🏋️', 'Track workouts, sets and personal records'],
          ['📊', 'See trends across weeks, not just days'],
          ['🔒', 'Everything stays on this device'],
        ].map(([icon, text]) => (
          <li key={text} className="flex items-center gap-3">
            <span className="text-xl w-8 text-center" aria-hidden="true">{icon}</span>
            <span className="text-[14px] text-muted">{text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StepBody({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <>
      <h1 className="text-[26px] font-bold tracking-tight leading-tight mb-1.5">{title}</h1>
      <p className="text-[14px] text-muted mb-6 leading-relaxed">{sub}</p>
      {children}
    </>
  )
}

function ChoiceCard({ selected, title, sub, onClick }: {
  selected: boolean; title: string; sub: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full text-left rounded-2xl border p-3.5 transition active:scale-[0.99] focusable
        ${selected ? 'border-brand bg-brand/8' : 'border-line bg-surface'}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center
            ${selected ? 'border-brand' : 'border-line'}`}
        >
          {selected && <span className="w-2.5 h-2.5 rounded-full bg-brand" />}
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold">{title}</span>
          <span className="block text-[12.5px] text-muted mt-0.5">{sub}</span>
        </span>
      </div>
    </button>
  )
}

function HeightInput({ unit, cm, onChange, error }: {
  unit: HeightUnit; cm: number; onChange: (cm: number) => void; error?: string
}) {
  const { ft, inches } = cmToFtIn(cm)
  if (unit === 'cm') {
    return (
      <Field label="Height (cm)" error={error}>
        <Stepper value={cm} onChange={onChange} step={1} min={100} max={250} suffix="cm" />
      </Field>
    )
  }
  return (
    <Field label="Height" error={error}>
      <div className="flex gap-2">
        <div className="flex-1">
          <NumberField
            value={ft} onChange={(v) => onChange(ftInToCm(v, inches))}
            min={3} max={8} suffix="ft"
          />
        </div>
        <div className="flex-1">
          <NumberField
            value={inches} onChange={(v) => onChange(ftInToCm(ft, Math.min(11, v)))}
            min={0} max={11} suffix="in"
          />
        </div>
      </div>
    </Field>
  )
}

function PlanStep({ plan, draft, customTarget, onCustomTarget }: {
  plan: ReturnType<typeof recommendTargets>
  draft: Draft
  customTarget: number | null
  onCustomTarget: (n: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const target = customTarget ?? plan.calories

  return (
    <>
      <h1 className="text-[26px] font-bold tracking-tight leading-tight mb-1.5">Your starting plan</h1>
      <p className="text-[14px] text-muted mb-6 leading-relaxed">
        Based on {GOAL_LABELS[draft.goalType].title.toLowerCase()} at a moderate pace.
      </p>

      <div className="card mb-3 text-center py-6">
        <p className="label mb-1">Daily calorie target</p>
        <p className="text-[42px] font-bold tabular-nums leading-none text-brand">
          {target.toLocaleString()}
        </p>
        <p className="text-[13px] text-muted mt-1">kcal per day</p>
        <button
          className="text-[13px] font-semibold text-brand mt-3 tap mx-auto px-3"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? 'Done' : 'Adjust'}
        </button>
        {editing && (
          <div className="px-4 mt-2">
            <Stepper
              value={target}
              onChange={(v) => onCustomTarget(v)}
              step={50} min={1000} max={6000} suffix="kcal"
            />
            {customTarget !== null && customTarget !== plan.calories && (
              <button
                className="text-[12px] text-muted mt-2 underline"
                onClick={() => onCustomTarget(null)}
              >
                Reset to recommended ({plan.calories.toLocaleString()})
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          ['Protein', plan.macros.protein, 'protein'],
          ['Carbs', plan.macros.carbs, 'carbs'],
          ['Fat', plan.macros.fat, 'fat'],
        ].map(([label, value, token]) => (
          <div key={String(label)} className="card text-center py-3">
            <p className="text-[11.5px] text-muted mb-0.5">{label}</p>
            <p className="text-[19px] font-bold tabular-nums" style={{ color: `rgb(var(--c-${token}))` }}>
              {value}<span className="text-[13px] font-semibold">g</span>
            </p>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex justify-between text-[13px] py-1">
          <span className="text-muted">Estimated BMR</span>
          <span className="font-semibold tabular-nums">{plan.bmr.toLocaleString()} kcal</span>
        </div>
        <div className="flex justify-between text-[13px] py-1">
          <span className="text-muted">Estimated daily burn (TDEE)</span>
          <span className="font-semibold tabular-nums">{plan.tdee.toLocaleString()} kcal</span>
        </div>
      </div>

      <p className="text-[11.5px] text-faint mt-4 leading-relaxed">
        These figures are estimates from the Mifflin–St Jeor equation and standard activity
        multipliers. Individual needs vary, so treat them as a starting point and adjust based on
        how you feel and what the trend shows over a few weeks. FitTrack does not provide medical
        or dietary advice.
      </p>
    </>
  )
}
