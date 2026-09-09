import type { ButtonHTMLAttributes } from 'react'

// 요청한 3종(primary/secondary/gold)에 teal을 더했다 — 화면 톤 규칙(무기고/존재력
// 전체화면 드릴다운=청록, 가챠/타임하이스트=금색, 일반 UI=파랑)을 실제 화면에
// 적용해보니 청록 화면 안의 "주 행동" 버튼도 그 화면 톤을 따라야 해서(파랑을 쓰면
// 화면 톤과 충돌) 필요해졌다. className으로 배경색만 덮어쓰는 방식은 Tailwind
// 유틸리티 순서상 안정적으로 이기지 않아 variant로 분리하는 쪽을 택했다.
export type ButtonVariant = 'primary' | 'secondary' | 'gold' | 'teal'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

// disabled는 별도 variant가 아니라 표준 <button disabled> 속성으로 받는다 — 색 의도
// (primary/secondary/gold/teal)와 활성 여부는 서로 독립적인 축이라, disabled를
// variant로 두면 "gold인데 비활성"같은 조합을 표현할 수 없어진다.
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-blue-base text-white hover:bg-blue-strong active:scale-[0.97]',
  secondary:
    'border border-surface-border bg-surface-elevated text-text-primary hover:bg-surface-border active:scale-[0.97]',
  gold: 'bg-gold-base text-surface-base hover:bg-gold-strong active:scale-[0.97]',
  teal: 'bg-teal-base text-surface-base hover:bg-teal-strong active:scale-[0.97]',
}

export function Button({ variant = 'primary', disabled, className = '', children, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-all duration-150 ${
        disabled ? 'cursor-not-allowed bg-surface-elevated text-text-disabled' : VARIANT_CLASS[variant]
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
