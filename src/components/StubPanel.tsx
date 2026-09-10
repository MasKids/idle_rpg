import { getStubUiLabel } from '../data/uiStrings'
import { PanelHeader } from './ui'

interface StubPanelProps {
  title: string
  onBack: () => void
}

export function StubPanel({ title, onBack }: StubPanelProps) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-surface-base text-text-primary">
      <PanelHeader title={title} onBack={onBack} toneClassName="text-teal-strong" accentColorVar="var(--color-teal-strong)" />
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
        <p className="text-sm text-text-secondary">{getStubUiLabel('notImplemented')}</p>
      </div>
    </div>
  )
}
