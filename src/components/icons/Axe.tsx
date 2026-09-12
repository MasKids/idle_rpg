import type { IconProps } from './types'

// lucide에 없는 무기 아이콘 — 자루(shaft) + 반달형 도끼날. Spear/Bow와 같은 톤(24x24,
// stroke 2, round cap/join, currentColor)으로 손으로 그렸다.
export function Axe({ size = 24, strokeWidth = 2, ...props }: IconProps) {
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
      <line x1="7" y1="21" x2="16" y2="5" />
      <path d="M16 5 C20 3.5 22 6 21 9.5 C19.5 9 17.5 8.5 15 9.5 Z" />
    </svg>
  )
}
