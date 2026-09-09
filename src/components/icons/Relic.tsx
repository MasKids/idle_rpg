import type { IconProps } from './types'

// lucide에 없는 유물 아이콘 — 고리(펜던트 링) + 컷팅된 보석(마름모, 내부 단면선).
export function Relic({ size = 24, strokeWidth = 2, ...props }: IconProps) {
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
      <circle cx="12" cy="5" r="2" />
      <line x1="12" y1="7" x2="12" y2="9.5" />
      <path d="M12 9.5 L18 14 L12 20 L6 14 Z" />
      <line x1="6" y1="14" x2="18" y2="14" />
    </svg>
  )
}
