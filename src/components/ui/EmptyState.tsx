import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  message: string
  description?: string
  className?: string
}

export function EmptyState({ icon, message, description, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-8 text-center ${className}`}>
      {icon && <div className="text-text-disabled">{icon}</div>}
      <p className="text-sm font-medium text-text-secondary">{message}</p>
      {description && <p className="text-xs text-text-disabled">{description}</p>}
    </div>
  )
}
