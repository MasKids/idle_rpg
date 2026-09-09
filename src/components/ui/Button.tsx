import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'gold'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

// disabled는 별도 variant가 아니라 표준 <button disabled> 속성으로 받는다 — 색 의도
// (primary/secondary/gold)와 활성 여부는 서로 독립적인 축이라, disabled를 4번째
// variant로 두면 "gold인데 비활성"같은 조합을 표현할 수 없어진다.
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-blue-base text-white hover:bg-blue-strong active:scale-[0.97]',
  secondary:
    'border border-surface-border bg-surface-elevated text-text-primary hover:bg-surface-border active:scale-[0.97]',
  gold: 'bg-gold-base text-surface-base hover:bg-gold-strong active:scale-[0.97]',
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
