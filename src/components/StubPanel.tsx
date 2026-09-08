import { getButtonLabel } from '../data/uiStrings'

interface StubPanelProps {
  title: string
  onBack: () => void
}

export function StubPanel({ title, onBack }: StubPanelProps) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-2 bg-amber-950 text-amber-100">
      <button
        type="button"
        onClick={onBack}
        className="absolute left-4 top-4 text-sm text-amber-300"
      >
        ← {getButtonLabel('back')}
      </button>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-amber-300/70">설계 완료 · 프로토타입 미구현</p>
    </div>
  )
}
