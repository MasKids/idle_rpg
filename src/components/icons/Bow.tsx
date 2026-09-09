import type { IconProps } from './types'

// lucide에 없는 무기 아이콘 — 활대(곡선) + 활시위(직선) + 시위에 걸린 화살.
export function Bow({ size = 24, strokeWidth = 2, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M8 3 Q2.5 12 8 21" />
      <line x1="8" y1="3" x2="8" y2="21" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <path d="M16.5 8.5 L20 12 L16.5 15.5" />
    </svg>
  )
}
