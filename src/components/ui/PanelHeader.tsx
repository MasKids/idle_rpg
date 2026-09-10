import type { CSSProperties, ReactNode } from 'react'
import { BackButton } from './BackButton'

interface PanelHeaderProps {
  title: ReactNode
  onBack: () => void
  // 화면 톤(청록/금색 등)에 맞는 text-* 색 클래스 — 뒤로가기와 제목 둘 다에 적용된다.
  toneClassName?: string
  // 모서리 액센트·사선 패턴에 쓰는 CSS 색상 값(예: 'var(--color-teal-strong)') — 화면 톤과 맞춘다.
  accentColorVar?: string
}

// 전체화면 패널(무기고/가챠/존재력/도감) 상단의 "← 뒤로 + 가운데 제목 + 아래 구분선"을
// 한 곳으로 모았다 — 화면마다 여백/정렬/테두리가 미묘하게 달랐던 걸 구조적으로
// 완전히 동일하게 맞추기 위함(색만 화면 톤을 따라간다).
export function PanelHeader({
  title,
  onBack,
  toneClassName = 'text-text-primary',
  accentColorVar = 'var(--color-surface-border)',
}: PanelHeaderProps) {
  return (
    <div
      className="panel-header-frame relative flex shrink-0 items-center justify-center border-b border-surface-border py-3"
      style={{ '--panel-accent-color': accentColorVar } as CSSProperties}
    >
      <BackButton onClick={onBack} toneClassName={toneClassName} className="absolute left-4" />
      <div className={`text-sm font-semibold ${toneClassName}`}>{title}</div>
    </div>
  )
}
