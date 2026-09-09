import type { IconProps } from './types'

// lucide에 없는 무기 아이콘 — 자루(shaft) + 마름모 창날. lucide 톤(24x24, stroke 2,
// round cap/join, currentColor)에 맞춰 손으로 그렸다.
export function Spear({ size = 24, strokeWidth = 2, ...props }: IconProps) {
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
      <line x1="4" y1="20" x2="15.5" y2="8.5" />
      <path d="M15 9 L18.5 3 L21 6.5 L17.5 12.5 Z" />
    </svg>
  )
}
