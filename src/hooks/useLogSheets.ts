/**
 * Global handles for the small logging sheets.
 *
 * Water, weight and steps are reachable from the quick-add menu, the dashboard
 * tiles and the history screen. A tiny store beats threading callbacks through
 * every one of those.
 */
import { create } from 'zustand'
import type { LocalDate } from '@/types'
import { today } from '@/utils/date'

type SheetKind = 'water' | 'weight' | 'steps' | null

interface LogSheetState {
  kind: SheetKind
  date: LocalDate
  openWater: (date?: LocalDate) => void
  openWeight: (date?: LocalDate) => void
  openSteps: (date?: LocalDate) => void
  close: () => void
}

export const useLogSheets = create<LogSheetState>((set) => ({
  kind: null,
  date: today(),
  openWater: (date) => set({ kind: 'water', date: date ?? today() }),
  openWeight: (date) => set({ kind: 'weight', date: date ?? today() }),
  openSteps: (date) => set({ kind: 'steps', date: date ?? today() }),
  close: () => set({ kind: null }),
}))
