/** Host for the water / weight / steps sheets, mounted once at the app root. */
import { useEffect, useMemo, useState } from 'react'
import { useLogSheets } from '@/hooks/useLogSheets'
import { useStore, selectDailySummary } from '@/store/useStore'
import { Field, NumberField, Sheet, Stepper, toast } from './ui'
import { relativeDayLabel } from '@/utils/date'
import { displayWeight, lbToKg } from '@/utils/calculations'

const GLASS_ML = 250
const BOTTLE_ML = 500

export function LogSheets() {
  const { kind, date, close } = useLogSheets()
  return (
    <>
      <WaterSheet open={kind === 'water'} date={date} onClose={close} />
      <WeightSheet open={kind === 'weight'} date={date} onClose={close} />
      <StepsSheet open={kind === 'steps'} date={date} onClose={close} />
    </>
  )
}

function WaterSheet({ open, date, onClose }: { open: boolean; date: string; onClose: () => void }) {
  const addWater = useStore((s) => s.addWater)
  const removeLastWater = useStore((s) => s.removeLastWater)
  const summary = useStore((s) => selectDailySummary(s, date))
  const target = summary.waterTargetMl

  const add = async (ml: number) => {
    await addWater(date, ml)
    toast(`${ml} ml added`, { label: 'Undo', run: () => void removeLastWater(date) })
  }

  return (
    <Sheet open={open} onClose={onClose} title="Water">
      <div className="pb-4">
        <div className="text-center py-4">
          <div className="text-[34px] font-bold tabular-nums text-water">
            {(summary.waterMl / 1000).toFixed(2)}
            <span className="text-[18px] text-muted font-semibold"> L</span>
          </div>
          <p className="text-[13px] text-muted mt-1">
            of {(target / 1000).toFixed(1)} L target · {relativeDayLabel(date)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <button className="btn-ghost h-[76px] flex-col gap-1" onClick={() => void add(GLASS_ML)}>
            <span className="text-2xl">🥛</span>
            <span className="text-[13px]">Glass · {GLASS_ML} ml</span>
          </button>
          <button className="btn-ghost h-[76px] flex-col gap-1" onClick={() => void add(BOTTLE_ML)}>
            <span className="text-2xl">🍶</span>
            <span className="text-[13px]">Bottle · {BOTTLE_ML} ml</span>
          </button>
        </div>

        <CustomAmount onAdd={add} />

        {summary.waterMl > 0 && (
          <button
            className="btn-ghost w-full mt-2.5 text-danger"
            onClick={() => void removeLastWater(date)}
          >
            Remove last entry
          </button>
        )}
      </div>
    </Sheet>
  )
}

function CustomAmount({ onAdd }: { onAdd: (ml: number) => Promise<void> }) {
  const [ml, setMl] = useState(200)
  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <Field label="Custom amount">
          <NumberField value={ml} onChange={setMl} min={10} max={3000} step={10} suffix="ml" />
        </Field>
      </div>
      <button className="btn-primary mb-3.5 px-5" onClick={() => void onAdd(ml)} disabled={ml <= 0}>
        Add
      </button>
    </div>
  )
}

function WeightSheet({ open, date, onClose }: { open: boolean; date: string; onClose: () => void }) {
  const logWeight = useStore((s) => s.logWeight)
  const profile = useStore((s) => s.profile)
  const weights = useStore((s) => s.weights)
  const unit = profile?.units.weight ?? 'kg'

  const existing = useMemo(() => weights.find((w) => w.date === date), [weights, date])
  const startValue = existing?.weightKg ?? profile?.weightKg ?? 70

  const [value, setValue] = useState(() => displayWeight(startValue, unit))
  const [saving, setSaving] = useState(false)

  // Re-seed when the sheet reopens on a different day or after a change.
  useEffect(() => {
    if (open) setValue(displayWeight(startValue, unit))
  }, [open, startValue, unit])

  const save = async () => {
    const kg = unit === 'lb' ? lbToKg(value) : value
    if (!(kg > 20 && kg < 400)) {
      toast('Enter a weight between 20 and 400 kg')
      return
    }
    setSaving(true)
    await logWeight(date, kg)
    setSaving(false)
    toast(existing ? 'Weight updated' : 'Weight logged')
    onClose()
  }

  const diff = existing ? null : profile ? value - displayWeight(profile.weightKg, unit) : null

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={existing ? 'Update weight' : 'Log weight'}
      footer={
        <button className="btn-primary w-full" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      }
    >
      <div className="pb-2">
        <p className="text-[13px] text-muted mb-4">{relativeDayLabel(date)}</p>
        <Field label={`Weight (${unit})`}>
          <Stepper
            value={value}
            onChange={setValue}
            step={unit === 'lb' ? 0.2 : 0.1}
            min={unit === 'lb' ? 44 : 20}
            max={unit === 'lb' ? 880 : 400}
            suffix={unit}
          />
        </Field>
        {diff !== null && Math.abs(diff) > 0.05 && (
          <p className="text-[12.5px] text-muted -mt-1">
            {diff > 0 ? '+' : ''}{diff.toFixed(1)} {unit} vs your last recorded weight
          </p>
        )}
        <p className="text-[11.5px] text-faint mt-3 leading-snug">
          Weight naturally fluctuates day to day with food, water and time of day. The
          trend over a few weeks tells you more than any single reading.
        </p>
      </div>
    </Sheet>
  )
}

function StepsSheet({ open, date, onClose }: { open: boolean; date: string; onClose: () => void }) {
  const setSteps = useStore((s) => s.setSteps)
  const summary = useStore((s) => selectDailySummary(s, date))
  const [value, setValue] = useState(summary.steps)

  useEffect(() => { if (open) setValue(summary.steps) }, [open, summary.steps])

  const save = async () => {
    await setSteps(date, value)
    toast('Steps updated')
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Steps"
      footer={<button className="btn-primary w-full" onClick={() => void save()}>Save</button>}
    >
      <div className="pb-2">
        <p className="text-[13px] text-muted mb-4">{relativeDayLabel(date)}</p>
        <Field label="Step count" hint={`Daily target: ${summary.stepTarget.toLocaleString()} steps`}>
          <NumberField value={value} onChange={setValue} min={0} max={100000} step={1} suffix="steps" />
        </Field>
        <div className="flex gap-2 flex-wrap">
          {[1000, 2500, 5000].map((n) => (
            <button key={n} className="chip-off" onClick={() => setValue(value + n)}>
              +{n.toLocaleString()}
            </button>
          ))}
          <button className="chip-off" onClick={() => setValue(0)}>Reset</button>
        </div>
        <p className="text-[11.5px] text-faint mt-4 leading-snug">
          Steps are entered manually for now. On Android this can later read from
          Health Connect instead.
        </p>
      </div>
    </Sheet>
  )
}
