interface ProgressBarProps {
  value: number
  max: number
  // 채우는 색의 Tailwind bg 클래스. 기본은 전체화면 드릴다운 톤(청록).
  colorClassName?: string
  className?: string
}

export function ProgressBar({ value, max, colorClassName = 'bg-teal-base', className = '' }: ProgressBarProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0

  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated ${className}`}>
      <div
        className={`h-full rounded-full transition-[width] duration-200 ${colorClassName}`}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  )
}
