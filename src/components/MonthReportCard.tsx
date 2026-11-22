/**
 * The monthly report card: a 1080×1350 image (the 4:5 shape Instagram and
 * WhatsApp show uncropped) drawn on a canvas entirely on the device, plus the
 * sheet that previews and shares it.
 *
 * Colours are fixed to the dark theme rather than read from CSS, so a card
 * looks the same whichever theme the sender happens to use.
 */
import { useEffect, useMemo, useState } from 'react'
import { useStore, selectDailySummary } from '@/store/useStore'
import { buildMonthReport, type MonthReport } from '@/services/monthReport'
import { shareImage } from '@/services/native/fileExport'
import { toLocalDate, today } from '@/utils/date'
import { Sheet, toast } from './ui'

const W = 1080
const H = 1350
const C = {
  bg: '#06111F',
  card: '#10233A',
  line: '#1E3A56',
  ink: '#F8FAFC',
  muted: '#94A3B8',
  faint: '#64748B',
  from: '#249BFF',
  to: '#4F46E5',
  protein: '#22D3EE',
  success: '#22C55E',
  burn: '#F59E0B',
  gold: '#FBBF24',
}
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string,
  weight = 400, align: CanvasTextAlign = 'left') {
  ctx.font = `${weight} ${size}px ${FONT}`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.fillText(s, x, y)
}

/** Draw the card and return it as a PNG data URL. */
export function drawReportCard(r: MonthReport): string {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'alphabetic'

  // Background + header band.
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, H)
  const grad = ctx.createLinearGradient(0, 0, W, 360)
  grad.addColorStop(0, C.from)
  grad.addColorStop(1, C.to)
  ctx.fillStyle = grad
  roundRect(ctx, 0, -40, W, 400, 48)
  ctx.fill()

  text(ctx, 'FITTRACK · MONTHLY REPORT', 72, 104, 28, 'rgba(255,255,255,0.8)', 700)
  text(ctx, r.monthLabel, 72, 196, 76, '#FFFFFF', 800)
  text(ctx, `${r.name} · ${r.daysLogged} of ${r.daysInPeriod} days logged`, 72, 262, 34, 'rgba(255,255,255,0.85)', 500)

  // Four headline tiles.
  const tiles: Array<[label: string, value: string, sub: string, color: string]> = [
    ['Avg calories', r.avgCalories ? r.avgCalories.toLocaleString() : '—', `target ${r.calorieTarget.toLocaleString()}`, C.from],
    ['Avg protein', r.avgProtein ? `${r.avgProtein} g` : '—', `goal hit ${r.proteinDays} day${r.proteinDays === 1 ? '' : 's'}`, C.protein],
    ['Workouts', String(r.workouts), r.workoutMinutes ? `${r.workoutMinutes} min total` : 'none logged', C.burn],
    ['Weight', r.weightChange === null ? '—' : `${r.weightChange > 0 ? '+' : ''}${r.weightChange} ${r.weightUnit}`,
      r.weightChange === null ? 'log 2+ weigh-ins' : 'this month', C.success],
  ]
  const tileW = (W - 72 * 2 - 24) / 2
  const tileH = 170
  tiles.forEach(([label, value, sub, color], i) => {
    const x = 72 + (i % 2) * (tileW + 24)
    const y = 340 + Math.floor(i / 2) * (tileH + 24)
    ctx.fillStyle = C.card
    roundRect(ctx, x, y, tileW, tileH, 32)
    ctx.fill()
    ctx.fillStyle = color
    roundRect(ctx, x + 32, y + 32, 14, 14, 7)
    ctx.fill()
    text(ctx, label, x + 58, y + 46, 28, C.muted, 600)
    text(ctx, value, x + 32, y + 110, 58, C.ink, 800)
    text(ctx, sub, x + 32, y + 148, 26, C.faint, 500)
  })

  // Daily calories mini chart with the target line.
  const cx = 72
  const cy = 800
  const cw = W - 144
  const ch = 170
  ctx.fillStyle = C.card
  roundRect(ctx, cx, cy - 64, cw, ch + 110, 32)
  ctx.fill()
  text(ctx, 'Daily calories', cx + 32, cy - 16, 28, C.muted, 600)
  text(ctx, `on target ${r.onTargetDays} days`, cx + cw - 32, cy - 16, 26, C.faint, 500, 'right')
  const plotX = cx + 32
  const plotW = cw - 64
  const plotY = cy + 12
  const plotH = ch - 30
  const max = Math.max(r.calorieTarget * 1.3, ...r.dailyCalories, 1)
  const n = Math.max(r.dailyCalories.length, 1)
  const gap = n > 20 ? 4 : 8
  const bw = (plotW - gap * (n - 1)) / n
  r.dailyCalories.forEach((v, i) => {
    const h = v > 0 ? Math.max(6, (v / max) * plotH) : 6
    const over = v > r.calorieTarget * 1.1
    ctx.fillStyle = v === 0 ? C.line : over ? C.burn : C.from
    roundRect(ctx, plotX + i * (bw + gap), plotY + plotH - h, bw, h, Math.min(6, bw / 2))
    ctx.fill()
  })
  const ty = plotY + plotH - (r.calorieTarget / max) * plotH
  ctx.strokeStyle = 'rgba(248,250,252,0.55)'
  ctx.setLineDash([12, 10])
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(plotX, ty)
  ctx.lineTo(plotX + plotW, ty)
  ctx.stroke()
  ctx.setLineDash([])

  // Wins.
  text(ctx, 'Highlights', 72, 1080, 30, C.gold, 700)
  r.wins.slice(0, 3).forEach((w, i) => {
    const y = 1134 + i * 54
    ctx.fillStyle = C.gold
    ctx.beginPath()
    ctx.arc(84, y - 11, 7, 0, Math.PI * 2)
    ctx.fill()
    text(ctx, w, 108, y, 34, C.ink, 600)
  })

  text(ctx, 'Tracked privately on my phone with FitTrack', W / 2, H - 40, 24, C.faint, 500, 'center')
  return canvas.toDataURL('image/png')
}

/** Preview and share the card for the month shown in History. */
export function MonthReportSheet({ open, month, onClose }: {
  open: boolean
  month: Date
  onClose: () => void
}) {
  const state = useStore()
  const [sharing, setSharing] = useState(false)
  const [image, setImage] = useState<string | null>(null)

  const report = useMemo(() => {
    if (!open || !state.profile) return null
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const end = today()
    const days = Array.from({ length: last }, (_, i) => toLocalDate(new Date(month.getFullYear(), month.getMonth(), i + 1)))
      .filter((d) => d <= end)
      .map((d) => selectDailySummary(state, d))
    return buildMonthReport({
      month, days, profile: state.profile, weights: state.weights, allWorkouts: state.workouts,
    })
    // Rebuilt each time the sheet opens; the data can't change while it's up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, month])

  // Draw after the sheet renders so opening it stays instant.
  useEffect(() => {
    if (!report) { setImage(null); return }
    const t = window.setTimeout(() => setImage(drawReportCard(report)), 30)
    return () => window.clearTimeout(t)
  }, [report])

  const share = async () => {
    if (!image || !report) return
    setSharing(true)
    try {
      const file = `fittrack-${report.monthLabel.toLowerCase().replace(/\s+/g, '-')}.png`
      const { via } = await shareImage(file, image, `My ${report.monthLabel} on FitTrack`)
      if (via === 'downloaded') toast('Report card saved to your downloads')
    } catch {
      toast('Couldn’t share the report card')
    } finally {
      setSharing(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Monthly report card"
      footer={
        <button className="btn-primary w-full" onClick={() => void share()} disabled={!image || sharing}>
          {sharing ? 'Preparing…' : 'Share report card'}
        </button>
      }
    >
      <div className="pb-3">
        {image ? (
          <img
            src={image}
            alt={report ? `Report card for ${report.monthLabel}: ${report.wins.join(', ')}` : 'Report card'}
            className="w-full rounded-2xl border border-line"
          />
        ) : (
          <div className="w-full aspect-[4/5] rounded-2xl bg-raised animate-pulse" />
        )}
        <p className="text-[12px] text-faint text-center mt-2">
          Made on your phone — nothing is uploaded unless you share it.
        </p>
      </div>
    </Sheet>
  )
}
