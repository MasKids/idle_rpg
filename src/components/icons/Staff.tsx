import type { IconProps } from './types'

// lucide에 없는 무기 아이콘 — 긴 자루(shaft) + 끝에 맺힌 보주(원). Spear/Bow/Axe와
// 같은 톤(24x24, stroke 2, round cap/join, currentColor)으로 손으로 그렸다.
export function Staff({ size = 24, strokeWidth = 2, ...props }: IconProps) {
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
      <line x1="9" y1="6.5" x2="6" y2="21" />
      <circle cx="12.5" cy="5" r="3.2" />
    </svg>
  )
}
