import { useEffect, useRef, useState } from 'react'

interface ProgressBarProps {
  value: number
  max: number
  // 채우는 색의 Tailwind bg 클래스. 기본은 전체화면 드릴다운 톤(청록).
  colorClassName?: string
  className?: string
  // 지정하면 값이 줄어들 때(체력바 등) 잔상 레이어가 뒤늦게 따라 내려온다.
  trailColorClassName?: string
  // 보스 체력바처럼 더 두껍게
  thick?: boolean
  // 지정한 개수만큼 눈금 분할선을 얹는다 (보스 체력바용)
  segments?: number
}

export function ProgressBar({
  value,
  max,
  colorClassName = 'bg-teal-base',
  className = '',
  trailColorClassName,
  thick = false,
  segments,
}: ProgressBarProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0

  const committedTrailValue = useRef(value)
  const [trailDisplayValue, setTrailDisplayValue] = useState(value)

  useEffect(() => {
    if (!trailColorClassName) return

    if (value < committedTrailValue.current) {
      // 줄어드는 중 — 잔상은 잠깐 그대로 뒀다가 따라 내려온다.
      const timer = setTimeout(() => {
        committedTrailValue.current = value
        setTrailDisplayValue(value)
      }, 400)
      return () => clearTimeout(timer)
    }

    // 늘어나거나 동일 — 즉시 따라잡는다 (새 적 등장 시 풀피로 리셋되는 경우 등).
    committedTrailValue.current = value
    setTrailDisplayValue(value)
  }, [value, trailColorClassName])

  const trailRatio = max > 0 ? Math.min(1, Math.max(0, trailDisplayValue / max)) : 0

  return (
    <div
      className={`relative w-full overflow-hidden rounded-full bg-surface-elevated ${thick ? 'h-3' : 'h-1.5'} ${className}`}
    >
      {trailColorClassName && (
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out ${trailColorClassName}`}
          style={{ width: `${trailRatio * 100}%` }}
        />
      )}
      <div
        className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-200 ${colorClassName}`}
        style={{ width: `${ratio * 100}%` }}
      />
      {segments && segments > 1 && (
        <div className="absolute inset-0 flex">
          {Array.from({ length: segments }, (_, index) => (
            <div key={index} className="flex-1 border-r border-surface-base/70 last:border-r-0" />
          ))}
        </div>
      )}
    </div>
  )
}
