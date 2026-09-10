/** The `+` menu: one tap from anywhere to any logging flow. */
import { useNavigate } from 'react-router-dom'
import { Sheet } from './ui'
import {
  AppleIcon, DropIcon, DumbbellIcon, RepeatIcon, ScaleIcon, StepsIcon,
} from './icons'
import { useLogSheets } from '@/hooks/useLogSheets'

export function QuickAddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { openWater, openWeight, openSteps } = useLogSheets()

  const go = (fn: () => void) => () => { onClose(); fn() }

  const ACTIONS = [
    {
      icon: <AppleIcon size={22} />, label: 'Food', hint: 'Search and log a food',
      onClick: go(() => navigate('/food/add')),
    },
    {
      icon: <RepeatIcon size={22} />, label: 'Meal', hint: 'Repeat a saved meal',
      onClick: go(() => navigate('/food/add?tab=meals')),
    },
    {
      icon: <DumbbellIcon size={22} />, label: 'Exercise', hint: 'Log a workout',
      onClick: go(() => navigate('/workout/new')),
    },
    {
      icon: <ScaleIcon size={22} />, label: 'Weight', hint: "Record today's weight",
      onClick: go(openWeight),
    },
    {
      icon: <DropIcon size={22} />, label: 'Water', hint: 'Add a glass or bottle',
      onClick: go(openWater),
    },
    {
      icon: <StepsIcon size={22} />, label: 'Steps', hint: "Update today's step count",
      onClick: go(openSteps),
    },
  ]

  return (
    <Sheet open={open} onClose={onClose} title="Add">
      <div className="grid grid-cols-2 gap-2.5 pb-4">
        {ACTIONS.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className="card flex flex-col items-start gap-2 p-3.5 active:scale-[0.97] transition focusable"
          >
            <span className="w-10 h-10 rounded-xl bg-brand/12 text-brand flex items-center justify-center">
              {a.icon}
            </span>
            <span className="text-left">
              <span className="block text-[15px] font-semibold">{a.label}</span>
              <span className="block text-[11.5px] text-faint leading-tight mt-0.5">{a.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
