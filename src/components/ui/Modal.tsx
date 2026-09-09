import type { ReactNode } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  // 하단 버튼 영역 — 보통 <Button variant="secondary">취소</Button> + <Button>확인</Button>
  footer?: ReactNode
}

// 제목 + 내용 + 하단 버튼 영역 3단 구성의 공용 모달 뼈대. 기존 화면별 모달
// (RebirthModal 등)은 아직 이걸 쓰도록 옮기지 않았다 — 이번 단계는 컴포넌트 정의까지만.
export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  if (!isOpen) return null

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div
        className="w-full max-w-xs rounded-xl border border-surface-border bg-surface-card p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-surface-elevated px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-border hover:text-text-primary"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 text-sm text-text-secondary">{children}</div>

        {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}
