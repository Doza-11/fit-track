/**
 * Inline SVG icon set.
 *
 * Hand-rolled rather than pulled from an icon package: the app needs ~25
 * glyphs, and inlining keeps the bundle small and the stroke weight uniform.
 */
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 24, children, ...rest }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" {...rest}
    >
      {children}
    </svg>
  )
}

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h3.5v-5.5h5V21H18a1 1 0 0 0 1-1V9.5" /></Icon>
)
export const AppleIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 8.5c-1-1.6-2.6-2.4-4.2-2C5.6 7 4 9 4 12c0 4 2.6 8 4.8 8 1 0 1.6-.5 3.2-.5s2.2.5 3.2.5c2.2 0 4.8-4 4.8-8 0-3-1.6-5-3.8-5.5-1.6-.4-3.2.4-4.2 2Z" /><path d="M12 8.5V6a3 3 0 0 1 3-3" /></Icon>
)
export const DumbbellIcon = (p: IconProps) => (
  <Icon {...p}><path d="M6.5 7v10M3.5 9v6M17.5 7v10M20.5 9v6M6.5 12h11" /></Icon>
)
export const ChartIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Icon>
)
export const UserIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></Icon>
)
export const PlusIcon = (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
export const CloseIcon = (p: IconProps) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>
export const ChevronLeft = (p: IconProps) => <Icon {...p}><path d="M15 5l-7 7 7 7" /></Icon>
export const ChevronRight = (p: IconProps) => <Icon {...p}><path d="M9 5l7 7-7 7" /></Icon>
export const ChevronDown = (p: IconProps) => <Icon {...p}><path d="M5 9l7 7 7-7" /></Icon>
export const SearchIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Icon>
)
export const TrashIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6" /></Icon>
)
export const EditIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20Z" /></Icon>
)
export const FlameIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 22c3.9 0 6.5-2.6 6.5-6 0-4.5-4-6.5-4.5-10-2 1.5-2.5 3.5-2.5 5 0 .8-1.5 1-1.5-.5 0-1-.5-2-1-2.5C7.6 9.6 5.5 12 5.5 16c0 3.4 2.6 6 6.5 6Z" /></Icon>
)
export const DropIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 3.5s6 6 6 10a6 6 0 0 1-12 0c0-4 6-10 6-10Z" /></Icon>
)
export const StepsIcon = (p: IconProps) => (
  <Icon {...p}><path d="M7 5.5c1.5 0 2.5 1 2.5 3S8.5 13 8.5 15c0 1.4-.6 2-1.8 2s-2-.8-2-2.2c0-2 .8-3 .8-5.3 0-2.5.5-4 1.5-4ZM16.5 8c1.5 0 2 1.5 2 4 0 2.3.8 3.3.8 5.3 0 1.4-.8 2.2-2 2.2s-1.8-.6-1.8-2c0-2-1-4.5-1-6.5s.5-3 2-3Z" /></Icon>
)
export const ScaleIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M8.5 10.5 12 8l3.5 2.5" /><path d="M7 16h10" /></Icon>
)
export const BellIcon = (p: IconProps) => (
  <Icon {...p}><path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" /><path d="M10 18a2 2 0 0 0 4 0" /></Icon>
)
export const CheckIcon = (p: IconProps) => <Icon {...p}><path d="m5 12.5 4.5 4.5L19 7" /></Icon>
export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Icon>
)
export const SunIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>
)
export const MoonIcon = (p: IconProps) => (
  <Icon {...p}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" /></Icon>
)
export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4 19h16" /></Icon>
)
export const UploadIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4 19h16" /></Icon>
)
export const TimerIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></Icon>
)
export const TargetIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></Icon>
)
export const RepeatIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 11V9a3 3 0 0 1 3-3h12M16 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H5M8 21l-3-3 3-3" /></Icon>
)
export const SparkIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></Icon>
)
export const InfoIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Icon>
)
