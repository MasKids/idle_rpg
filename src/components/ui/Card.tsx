import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  // 카드 위에 얹는 강조 카드 계층(배경 4단계 중 3번째)을 쓸지
  elevated?: boolean
}

export function Card({ elevated = false, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`panel-frame rounded-xl border border-surface-border ${elevated ? 'bg-surface-elevated' : 'bg-surface-card'} p-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
