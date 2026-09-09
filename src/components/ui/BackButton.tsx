import { ArrowLeft } from 'lucide-react'
import { getButtonLabel } from '../../data/uiStrings'

interface BackButtonProps {
  onClick: () => void
  // 화면 톤(청록/금색 등)에 맞는 text-* 색 클래스. 기본은 중립 텍스트.
  toneClassName?: string
  className?: string
}

// 전체화면 패널마다 반복되던 "← 뒤로" 버튼을 한 곳으로 모았다.
export function BackButton({ onClick, toneClassName = 'text-text-primary', className = '' }: BackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-sm transition-opacity hover:opacity-80 ${toneClassName} ${className}`}
    >
      <ArrowLeft size={16} strokeWidth={2} />
      {getButtonLabel('back')}
    </button>
  )
}
