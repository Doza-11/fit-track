/**
 * Settings sections, routed as /settings/:section.
 * One file since the sections share layout and all write through the same
 * `updateProfile` action.
 */
import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type {
  ActivityLevel, GoalType, HeightUnit, ReminderKind, Sex, ThemePref, WeightUnit,
} from '@/types'
import { useStore } from '@/store/useStore'
import { useLogSheets } from '@/hooks/useLogSheets'
import {
  Card, ConfirmDialog, EmptyState, Field, List, NumberField, Row, Segmented,
  Stepper, Toggle, toast,
} from '@/components/ui'
import { ChevronLeft, TrashIcon } from '@/components/icons'
import {
  ACTIVITY_LABELS, GOAL_LABELS, calculateMacroTargets, cmToFtIn, displayWeight,
  ftInToCm, kgToLb, lbToKg, recommendTargets,
} from '@/utils/calculations'
import { formatDate, formatTime12h } from '@/utils/date'
import {
  notifications, sendTestNotification, REMINDER_COPY,
} from '@/services/notifications'
import { saveExport } from '@/services/native/fileExport'
import { DEFAULT_NOTIFICATION_PREFS } from '@/services/smartNotifications'
import {
  previewTodaysNotifications, refreshNotifications,
} from '@/services/notificationScheduler'

const TITLES: Record<string, string> = {
  personal: 'Personal information',
  goals: 'Goal & targets',
  reminders: 'Reminders',
  appearance: 'Appearance & units',
  weight: 'Weight history',
  data: 'Data',
}

export function SettingsPage() {
  const { section = 'personal' } = useParams()
  const navigate = useNavigate()

  return (
    <div className="px-4 pt-3">
      <header className="flex items-center gap-2 mb-5">
        <button onClick={() => navigate('/profile')} className="tap -ml-2.5 text-muted focusable rounded-lg" aria-label="Back">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[20px] font-bold tracking-tight">{TITLES[section] ?? 'Settings'}</h1>
      </header>

      {section === 'personal' && <PersonalSection />}
      {section === 'goals' && <GoalsSection />}
      {section === 'reminders' && <RemindersSection />}
      {section === 'appearance' && <AppearanceSection />}
      {section === 'weight' && <WeightSection />}
      {section === 'data' && <DataSection />}
    </div>
  )
}

// ── Personal ────────────────────────────────────────────────────────────────

function PersonalSection() {
  const profile = useStore((s) => s.profile)!
  const updateProfile = useStore((s) => s.updateProfile)
  const recalculateTargets = useStore((s) => s.recalculateTargets)
  const logWeight = useStore((s) => s.logWeight)

  const [name, setName] = useState(profile.name)
  const [age, setAge] = useState(profile.age)
  const [sex, setSex] = useState<Sex>(profile.sex)
  const [heightCm, setHeightCm] = useState(profile.heightCm)
  const [weightKg, setWeightKg] = useState(profile.weightKg)
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(profile.activityLevel)
  const [saving, setSaving] = useState(false)

  const wUnit = profile.units.weight
  const { ft, inches } = cmToFtIn(heightCm)

  const error =
    name.trim().length === 0 ? 'Enter your name.'
      : !(age >= 13 && age <= 100) ? 'Age must be between 13 and 100.'
      : !(heightCm >= 100 && heightCm <= 250) ? 'Height must be between 100 and 250 cm.'
      : !(weightKg >= 30 && weightKg <= 300) ? 'Weight must be between 30 and 300 kg.'
      : null

  const preview = useMemo(() => recommendTargets({
    weightKg, heightCm, age, sex, activityLevel, goal: profile.goal.type,
  }), [weightKg, heightCm, age, sex, activityLevel, profile.goal.type])

  const save = async () => {
    if (error) { toast(error); return }
    setSaving(true)
    await updateProfile({ name: name.trim(), age, sex, heightCm, activityLevel })
    // Weight changes go through the log so history and charts stay consistent.
    if (Math.abs(weightKg - profile.weightKg) > 0.01) {
      await logWeight(new Date().toISOString().slice(0, 10), weightKg)
    }
    await recalculateTargets()
    setSaving(false)
    toast('Profile updated')
  }

  return (
    <>
      <Card className="mb-3">
        <Field label="Name">
          <input className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Age">
          <NumberField value={age} onChange={setAge} min={13} max={100} suffix="years" />
        </Field>
        <Field label="Sex" hint="Used by the BMR equation.">
          <Segmented
            value={sex} onChange={setSex}
            options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
          />
        </Field>

        {profile.units.height === 'cm' ? (
          <Field label="Height">
            <Stepper value={heightCm} onChange={setHeightCm} min={100} max={250} suffix="cm" />
          </Field>
        ) : (
          <Field label="Height">
            <div className="flex gap-2">
              <NumberField value={ft} onChange={(v) => setHeightCm(ftInToCm(v, inches))} min={3} max={8} suffix="ft" />
              <NumberField value={inches} onChange={(v) => setHeightCm(ftInToCm(ft, Math.min(11, v)))} min={0} max={11} suffix="in" />
            </div>
          </Field>
        )}

        <Field label={`Current weight (${wUnit})`} hint="Saving also adds an entry to your weight history.">
          <Stepper
            value={wUnit === 'lb' ? kgToLb(weightKg) : weightKg}
            onChange={(v) => setWeightKg(wUnit === 'lb' ? lbToKg(v) : v)}
            step={0.1} min={wUnit === 'lb' ? 66 : 30} max={wUnit === 'lb' ? 660 : 300} suffix={wUnit}
          />
        </Field>
      </Card>

      <Card className="mb-3">
        <p className="label mb-2">Activity level</p>
        <div className="space-y-1.5">
          {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((l) => (
            <button
              key={l}
              onClick={() => setActivityLevel(l)}
              className={`w-full text-left rounded-xl border px-3 py-2.5 transition focusable
                ${activityLevel === l ? 'border-brand bg-brand/8' : 'border-line'}`}
            >
              <span className="block text-[14px] font-medium">{ACTIVITY_LABELS[l].title}</span>
              <span className="block text-[11.5px] text-muted">{ACTIVITY_LABELS[l].detail}</span>
            </button>
          ))}
        </div>
      </Card>

      {!profile.calorieTargetIsCustom && preview.calories !== profile.calorieTarget && (
        <Card className="mb-3 border-brand/30 bg-brand/[0.05]">
          <p className="text-[13px] text-muted leading-relaxed">
            Saving these changes will update your recommended target from{' '}
            <strong className="text-ink">{profile.calorieTarget.toLocaleString()}</strong> to{' '}
            <strong className="text-ink">{preview.calories.toLocaleString()}</strong> kcal.
          </p>
        </Card>
      )}

      <button className="btn-primary w-full" onClick={() => void save()} disabled={saving || error !== null}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
      {error && <p className="text-[12px] text-danger text-center mt-2">{error}</p>}
    </>
  )
}

// ── Goals & targets ─────────────────────────────────────────────────────────

function GoalsSection() {
  const profile = useStore((s) => s.profile)!
  const updateProfile = useStore((s) => s.updateProfile)

  const [goalType, setGoalType] = useState<GoalType>(profile.goal.type)
  const [targetWeight, setTargetWeight] = useState(profile.goal.targetWeightKg ?? profile.weightKg)
  const [calories, setCalories] = useState(profile.calorieTarget)
  const [custom, setCustom] = useState(profile.calorieTargetIsCustom)
  const [macros, setMacros] = useState(profile.macroTargets)
  const [water, setWater] = useState(profile.waterTargetMl)
  const [steps, setSteps] = useState(profile.stepTarget)
  const [saving, setSaving] = useState(false)

  const unit = profile.units.weight

  const recommended = useMemo(() => recommendTargets({
    weightKg: profile.weightKg, heightCm: profile.heightCm, age: profile.age,
    sex: profile.sex, activityLevel: profile.activityLevel, goal: goalType,
  }), [profile, goalType])

  const macroKcal = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9
  const macroGap = Math.round(macroKcal - calories)

  const applyRecommended = () => {
    setCalories(recommended.calories)
    setMacros(recommended.macros)
    setCustom(false)
    toast('Reset to recommended targets')
  }

  const save = async () => {
    setSaving(true)
    await updateProfile({
      goal: {
        type: goalType,
        targetWeightKg: goalType === 'maintain' ? undefined : targetWeight,
        weeklyRateKg: profile.goal.weeklyRateKg,
      },
      calorieTarget: calories,
      calorieTargetIsCustom: custom || calories !== recommended.calories,
      macroTargets: macros,
      waterTargetMl: water,
      stepTarget: steps,
    })
    setSaving(false)
    toast('Targets updated')
  }

  return (
    <>
      <Card className="mb-3">
        <p className="label mb-2">Fitness goal</p>
        <div className="space-y-1.5">
          {(Object.keys(GOAL_LABELS) as GoalType[]).map((g) => (
            <button
              key={g}
              onClick={() => setGoalType(g)}
              className={`w-full text-left rounded-xl border px-3 py-2.5 transition focusable
                ${goalType === g ? 'border-brand bg-brand/8' : 'border-line'}`}
            >
              <span className="block text-[14px] font-medium">{GOAL_LABELS[g].title}</span>
              <span className="block text-[11.5px] text-muted">{GOAL_LABELS[g].detail}</span>
            </button>
          ))}
        </div>

        {goalType !== 'maintain' && (
          <div className="mt-3.5">
            <Field label={`Goal weight (${unit})`}>
              <Stepper
                value={unit === 'lb' ? kgToLb(targetWeight) : targetWeight}
                onChange={(v) => setTargetWeight(unit === 'lb' ? lbToKg(v) : v)}
                step={0.5} min={unit === 'lb' ? 66 : 30} max={unit === 'lb' ? 660 : 300} suffix={unit}
              />
            </Field>
          </div>
        )}
      </Card>

      <Card className="mb-3">
        <Field
          label="Daily calorie target"
          hint={`Recommended for this goal: ${recommended.calories.toLocaleString()} kcal`}
        >
          <Stepper
            value={calories}
            onChange={(v) => { setCalories(v); setCustom(true) }}
            step={50} min={1000} max={6000} suffix="kcal"
          />
        </Field>

        <p className="label mb-2">Macro targets</p>
        <div className="grid grid-cols-3 gap-2">
          {(['protein', 'carbs', 'fat'] as const).map((k) => (
            <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>
              <NumberField
                value={macros[k]}
                onChange={(v) => setMacros((m) => ({ ...m, [k]: Math.round(v) }))}
                min={0} max={600} suffix="g"
              />
            </Field>
          ))}
        </div>
        <p className={`text-[12px] leading-snug -mt-1 ${Math.abs(macroGap) > 100 ? 'text-burn' : 'text-faint'}`}>
          Your macros add up to {Math.round(macroKcal).toLocaleString()} kcal
          {Math.abs(macroGap) > 25
            ? ` — ${Math.abs(macroGap)} kcal ${macroGap > 0 ? 'above' : 'below'} your calorie target.`
            : ', which matches your calorie target.'}
        </p>

        <button className="btn-ghost w-full mt-3" onClick={applyRecommended}>
          Reset to recommended
        </button>
        <button
          className="btn-ghost w-full mt-2"
          onClick={() => setMacros(calculateMacroTargets(calories, profile.weightKg, goalType))}
        >
          Recalculate macros for {calories.toLocaleString()} kcal
        </button>
      </Card>

      <Card className="mb-3">
        <Field label="Daily water target">
          <Stepper value={water} onChange={setWater} step={250} min={500} max={6000} suffix="ml" />
        </Field>
        <Field label="Daily step target">
          <Stepper value={steps} onChange={setSteps} step={500} min={1000} max={40000} suffix="steps" />
        </Field>
      </Card>

      <button className="btn-primary w-full" onClick={() => void save()} disabled={saving}>
        {saving ? 'Saving…' : 'Save targets'}
      </button>

      <p className="text-[11.5px] text-faint mt-4 leading-relaxed">
        Recommendations use standard BMR/TDEE formulas and are estimates only. Adjust them to suit
        how you actually feel and what your trend shows. FitTrack does not give medical or dietary advice.
      </p>
    </>
  )
}

// ── Reminders ───────────────────────────────────────────────────────────────

function RemindersSection() {
  const reminders = useStore((s) => s.reminders)
  const updateReminder = useStore((s) => s.updateReminder)
  const profile = useStore((s) => s.profile)!
  const updateProfile = useStore((s) => s.updateProfile)
  const [permission, setPermission] = useState(notifications.getPermission())
  const [showPreview, setShowPreview] = useState(false)

  const prefs = profile.notifications ?? DEFAULT_NOTIFICATION_PREFS
  const anyEnabled = reminders.some((r) => r.enabled) || prefs.smartSuggestions
  // 'denied' can't be recovered from in-page — the user has to change it in
  // browser settings, so offering an Enable button there would just fail.
  const needsPermission = anyEnabled && permission === 'default'
  const blocked = anyEnabled && permission === 'denied'

  const setPrefs = (patch: Partial<typeof prefs>) => {
    void updateProfile({ notifications: { ...prefs, ...patch } }).then(refreshNotifications)
  }

  const request = async () => {
    const result = await notifications.requestPermission()
    setPermission(result)
    if (result === 'granted') { toast('Notifications enabled'); refreshNotifications() }
    else if (result === 'denied') toast('Notifications blocked in browser settings')
  }

  const preview = previewTodaysNotifications()
  const lastError = notifications.getLastError()

  const runTest = async () => {
    try {
      await sendTestNotification()
      toast('Test notification sent')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send a test notification')
    }
  }

  const permissionLabel = {
    granted: 'Allowed',
    denied: 'Blocked in system settings',
    default: 'Not yet requested',
    unsupported: 'Not supported here',
  }[permission]

  return (
    <>
      {/* Diagnostics first: when reminders do not arrive, this is the screen
          that has to explain why. */}
      <Card className="mb-3">
        <h3 className="text-[14px] font-semibold mb-2.5">Delivery status</h3>
        <div className="space-y-1.5 text-[13px]">
          <div className="flex justify-between gap-3">
            <span className="text-muted">Permission</span>
            <span className={`font-semibold text-right ${permission === 'granted' ? 'text-success' : 'text-burn'}`}>
              {permissionLabel}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted">Reminders switched on</span>
            <span className="font-semibold tabular-nums">{reminders.filter((r) => r.enabled).length}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted">Queued for the rest of today</span>
            <span className="font-semibold tabular-nums">{preview.length}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted">Delivered by</span>
            <span className="font-semibold">{notifications.name === 'capacitor' ? 'Android system' : notifications.name}</span>
          </div>
        </div>

        {lastError && (
          <p className="text-[12px] text-danger bg-danger/10 rounded-xl px-3 py-2.5 mt-3 leading-snug">
            Last scheduling error: {lastError}
          </p>
        )}

        <button className="btn-ghost w-full mt-3" onClick={() => void runTest()}>
          Send a test notification
        </button>
        {permission === 'default' && (
          <button className="btn-primary w-full mt-2" onClick={() => void request()}>
            Allow notifications
          </button>
        )}
        {permission === 'denied' && (
          // Once denied, Android will not show the prompt again — only the
          // system settings screen can undo it, so say that plainly instead of
          // offering a button that cannot work.
          <p className="text-[12.5px] text-muted leading-relaxed mt-3">
            Android will not ask again. To turn them back on: <strong className="text-ink">Settings →
            Apps → FitTrack → Notifications</strong>, then come back and send a test.
          </p>
        )}
      </Card>

      {permission === 'unsupported' ? (
        <Card className="mb-3 border-burn/30 bg-burn/[0.06]">
          <p className="text-[13px] text-muted leading-relaxed">
            This browser doesn't support notifications. You can still set reminder times — they'll
            work once the app is installed on Android.
          </p>
        </Card>
      ) : blocked ? (
        <Card className="mb-3 border-burn/30 bg-burn/[0.06]">
          <p className="text-[13px] text-muted leading-relaxed">
            Notifications are blocked for this site, so nothing can be delivered. You can
            re-allow them in your browser's site settings (the icon beside the address bar).
            Your reminder times below are still saved.
          </p>
        </Card>
      ) : needsPermission ? (
        <Card className="mb-3 border-brand/30 bg-brand/[0.06]">
          <p className="text-[13px] text-muted leading-relaxed mb-3">
            Allow notifications so FitTrack can remind you to log. Reminders only fire while the
            app is open in a browser tab; installed as an app on Android they run in the background.
          </p>
          <button className="btn-primary w-full" onClick={() => void request()}>
            Enable notifications
          </button>
        </Card>
      ) : null}

      <Card className="mb-3">
        <div className="flex items-start gap-3">
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-semibold">Smart suggestions</span>
            <span className="block text-[12.5px] text-muted leading-relaxed mt-0.5">
              Notifications based on your actual day — protein running lower than usual,
              calories still available in the evening, hydration or movement lagging.
            </span>
          </span>
          <Toggle
            checked={prefs.smartSuggestions}
            label="Smart suggestions"
            onChange={(v) => {
              setPrefs({ smartSuggestions: v })
              if (v && permission === 'default') void request()
            }}
          />
        </div>

        {prefs.smartSuggestions && (
          <div className="mt-4 pt-3.5 border-t border-line/70">
            <Field label="At most per day" hint="Suggestions only — your own reminders are never capped.">
              <Segmented
                value={String(prefs.maxPerDay)}
                onChange={(v) => setPrefs({ maxPerDay: Number(v) })}
                options={[
                  { value: '2', label: '2' },
                  { value: '4', label: '4' },
                  { value: '6', label: '6' },
                ]}
              />
            </Field>

            <p className="label mb-1.5">Quiet hours</p>
            <div className="flex items-center gap-2 mb-1">
              <input
                type="time" className="field py-2 flex-1" value={prefs.quietStart}
                onChange={(e) => setPrefs({ quietStart: e.target.value })}
                aria-label="Quiet hours start"
              />
              <span className="text-[13px] text-faint">to</span>
              <input
                type="time" className="field py-2 flex-1" value={prefs.quietEnd}
                onChange={(e) => setPrefs({ quietEnd: e.target.value })}
                aria-label="Quiet hours end"
              />
            </div>
            <p className="text-[11.5px] text-faint leading-snug">
              Nothing is delivered inside this window.
            </p>

            <button
              className="btn-ghost w-full mt-3"
              onClick={() => setShowPreview((v) => !v)}
            >
              {showPreview ? 'Hide' : 'Preview'} what's queued for today
            </button>

            {showPreview && (
              <div className="mt-3 space-y-2">
                {preview.length === 0 ? (
                  <p className="text-[12.5px] text-muted leading-relaxed">
                    Nothing queued right now — either everything is on track, today's
                    checkpoints have passed, or notifications aren't enabled yet.
                  </p>
                ) : preview.map((n) => (
                  <div key={n.id} className="rounded-xl bg-raised px-3 py-2.5">
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <span className="text-[13px] font-semibold truncate">{n.title}</span>
                      <span className="text-[11px] text-faint tabular-nums shrink-0">
                        {new Date(n.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[12px] text-muted leading-snug">{n.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <p className="label px-1 mb-2">Reminders at fixed times</p>

      <List className="mb-3">
        {reminders.map((r) => (
          <div key={r.id} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-medium">{r.label}</span>
                <span className="block text-[12px] text-faint">
                  {r.repeatEveryMin
                    ? `Every ${r.repeatEveryMin / 60} hours from ${formatTime12h(r.time)}`
                    : formatTime12h(r.time)}
                </span>
              </span>
              <Toggle
                checked={r.enabled}
                label={`${r.label} reminder`}
                onChange={(v) => {
                  void updateReminder(r.id, { enabled: v })
                  if (v && permission === 'default') void request()
                }}
              />
            </div>
            {r.enabled && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="time"
                  className="field py-2 flex-1"
                  value={r.time}
                  onChange={(e) => void updateReminder(r.id, { time: e.target.value })}
                  aria-label={`${r.label} time`}
                />
                {r.repeatEveryMin !== undefined && (
                  <select
                    className="field py-2 w-[130px]"
                    value={r.repeatEveryMin}
                    onChange={(e) => void updateReminder(r.id, { repeatEveryMin: Number(e.target.value) })}
                    aria-label="Repeat interval"
                  >
                    {[60, 120, 180, 240].map((m) => (
                      <option key={m} value={m}>Every {m / 60}h</option>
                    ))}
                  </select>
                )}
              </div>
            )}
            {r.enabled && (
              <p className="text-[11.5px] text-faint mt-2 leading-snug">
                “{REMINDER_COPY[r.kind as ReminderKind].body}”
              </p>
            )}
          </div>
        ))}
      </List>

      <p className="text-[11.5px] text-faint leading-relaxed">
        Reminders are skipped automatically when you've already logged the thing they ask
        about, so a logged lunch never produces a “log your lunch” notification.
        <br /><br />
        In the browser, notifications are delivered while FitTrack is open. Packaged as an
        Android app they use the system scheduler and arrive even when the app is closed.
      </p>
    </>
  )
}

// ── Appearance & units ──────────────────────────────────────────────────────

function AppearanceSection() {
  const profile = useStore((s) => s.profile)!
  const updateProfile = useStore((s) => s.updateProfile)

  return (
    <>
      <Card className="mb-3">
        <Field label="Theme">
          <Segmented
            value={profile.theme}
            onChange={(v: ThemePref) => void updateProfile({ theme: v })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Field>
        <Field label="Weight unit">
          <Segmented
            value={profile.units.weight}
            onChange={(v: WeightUnit) => void updateProfile({ units: { ...profile.units, weight: v } })}
            options={[{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }]}
          />
        </Field>
        <Field label="Height unit">
          <Segmented
            value={profile.units.height}
            onChange={(v: HeightUnit) => void updateProfile({ units: { ...profile.units, height: v } })}
            options={[{ value: 'cm', label: 'Centimetres' }, { value: 'ft', label: 'Feet & inches' }]}
          />
        </Field>
      </Card>
      <p className="text-[11.5px] text-faint leading-relaxed">
        Units affect display only. Everything is stored in kilograms and centimetres, so switching
        back and forth never loses precision.
      </p>
    </>
  )
}

// ── Weight history ──────────────────────────────────────────────────────────

function WeightSection() {
  const weights = useStore((s) => s.weights)
  const deleteWeight = useStore((s) => s.deleteWeight)
  const profile = useStore((s) => s.profile)!
  const { openWeight } = useLogSheets()
  const [confirm, setConfirm] = useState<string | null>(null)

  const unit = profile.units.weight
  const sorted = useMemo(
    () => [...weights].sort((a, b) => b.date.localeCompare(a.date)),
    [weights],
  )

  return (
    <>
      <button className="btn-primary w-full mb-4" onClick={() => openWeight()}>
        Log today's weight
      </button>

      {sorted.length === 0 ? (
        <EmptyState icon="⚖️" title="No entries yet" body="Log your weight and it will show up here." />
      ) : (
        <List>
          {sorted.map((w, i) => {
            const prev = sorted[i + 1]
            const delta = prev ? w.weightKg - prev.weightKg : null
            return (
              <Row
                key={w.id}
                label={`${displayWeight(w.weightKg, unit)} ${unit}`}
                sub={formatDate(w.date, 'long')}
                value={delta !== null && Math.abs(delta) >= 0.05 ? (
                  <span className={delta > 0 ? 'text-burn' : 'text-brand'}>
                    {delta > 0 ? '+' : ''}{displayWeight(delta, unit)}
                  </span>
                ) : undefined}
                right={
                  <button
                    onClick={() => setConfirm(w.id)}
                    className="tap text-faint focusable rounded-lg"
                    aria-label={`Delete entry from ${formatDate(w.date, 'long')}`}
                  >
                    <TrashIcon size={17} />
                  </button>
                }
              />
            )
          })}
        </List>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title="Delete this weight entry?"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) void deleteWeight(confirm)
          setConfirm(null)
          toast('Entry deleted')
        }}
      />
    </>
  )
}

// ── Data ────────────────────────────────────────────────────────────────────

function DataSection() {
  const exportData = useStore((s) => s.exportData)
  const importData = useStore((s) => s.importData)
  const resetAll = useStore((s) => s.resetAll)
  const meals = useStore((s) => s.meals)
  const workouts = useStore((s) => s.workouts)
  const weights = useStore((s) => s.weights)

  const [confirmReset, setConfirmReset] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const doExport = async () => {
    setBusy(true)
    try {
      // Generation is unchanged — only the delivery differs by platform:
      // a browser download on the web, the share sheet on Android.
      const json = await exportData()
      const filename = `fittrack-export-${new Date().toISOString().slice(0, 10)}.json`
      const { via } = await saveExport(filename, json)
      toast(via === 'shared' ? 'Export ready to share' : 'Export downloaded')
    } catch {
      toast('Export failed')
    }
    setBusy(false)
  }

  const doImport = async (file: File) => {
    setBusy(true)
    try {
      const text = await file.text()
      await importData(text)
      toast('Data imported')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import failed — is that a FitTrack export?')
    }
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <Card className="mb-3">
        <h3 className="text-[14px] font-semibold mb-2">What's stored</h3>
        <div className="space-y-1 text-[13px]">
          <div className="flex justify-between"><span className="text-muted">Meals</span><span className="font-semibold tabular-nums">{meals.length}</span></div>
          <div className="flex justify-between"><span className="text-muted">Workouts</span><span className="font-semibold tabular-nums">{workouts.length}</span></div>
          <div className="flex justify-between"><span className="text-muted">Weight entries</span><span className="font-semibold tabular-nums">{weights.length}</span></div>
        </div>
        <p className="text-[11.5px] text-faint mt-3 leading-snug">
          All of it lives in this browser's local storage on this device. Clearing site data
          removes it, so export a backup before you do.
        </p>
      </Card>

      <div className="space-y-2 mb-6">
        <button className="btn-ghost w-full" onClick={() => void doExport()} disabled={busy}>
          Export all data (JSON)
        </button>
        <button className="btn-ghost w-full" onClick={() => fileRef.current?.click()} disabled={busy}>
          Import from a backup
        </button>
        <input
          ref={fileRef} type="file" accept="application/json,.json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f) }}
        />
      </div>

      <Card className="border-danger/30">
        <h3 className="text-[14px] font-semibold mb-1.5 text-danger">Reset everything</h3>
        <p className="text-[12.5px] text-muted leading-relaxed mb-3">
          Deletes your profile, meals, workouts, weight and settings from this device. This cannot
          be undone — export a backup first if you might want the data back.
        </p>
        <button className="btn-danger w-full" onClick={() => setConfirmReset(true)} disabled={busy}>
          Reset all data
        </button>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        title="Delete all your data?"
        body="Your profile, meals, workouts and weight history will be permanently removed from this device. This cannot be undone."
        confirmLabel="Delete everything"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false)
          void resetAll().then(() => toast('All data cleared'))
        }}
      />
    </>
  )
}
