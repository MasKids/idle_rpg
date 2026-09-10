import type { CSSProperties } from 'react'
import { getButtonLabel } from '../../data/uiStrings'
import { Button } from '../../components/ui'
import { useOnceSeen } from './useOnceSeen'

interface IntroBannerProps {
  // localStorage에 남기는 고유 키 — 화면마다 다른 값을 줘서 한 번 확인하면 다시 안 뜨게 한다.
  storageKey: string
  title: string
  lines: string[]
  // 제목/테두리 색 — 화면 톤에 맞춘 CSS 색상 값 (예: 'var(--color-teal-strong)')
  accentColorVar?: string
  // 바깥 여백 — 호출부마다 배치가 달라(전체화면 패널 상단 vs 모달 안) 기본값을 두지 않고
  // 항상 호출부에서 넘긴다(Tailwind 유틸리티 클래스 뒤섞임으로 인한 우선순위 문제를 피하기 위함).
  className: string
}

// "시스템 첫 진입 툴팁" — 모달처럼 화면을 덮지 않고, 패널 상단에 끼워 넣는 안내 배너.
// 확인을 누르면 그 storageKey로는 다시 뜨지 않는다.
export function IntroBanner({ storageKey, title, lines, accentColorVar = 'var(--color-text-secondary)', className }: IntroBannerProps) {
  const [seen, markSeen] = useOnceSeen(storageKey)
  if (seen) return null

  return (
    <div
      className={`panel-frame shrink-0 rounded-xl border border-surface-border bg-surface-elevated p-3 animate-[panel-fade-in_200ms_ease-out] ${className}`}
      style={{ '--panel-accent-color': accentColorVar } as CSSProperties}
    >
      <p className="text-xs font-semibold" style={{ color: accentColorVar }}>
        {title}
      </p>
      <div className="mt-1 space-y-0.5 text-[11px] leading-relaxed text-text-secondary">
        {lines.map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </div>
      <Button variant="secondary" onClick={markSeen} className="mt-2 w-full py-1.5 text-xs">
        {getButtonLabel('confirm')}
      </Button>
    </div>
  )
}
