import { useState, type CSSProperties } from 'react'
import { getButtonLabel } from '../../data/uiStrings'
import { Button } from '../../components/ui'
import { WELCOME_STEPS } from './onboardingContent'
import { useOnceSeen } from './useOnceSeen'

const STORAGE_KEY = 'welcome'

// 새 게임 시작 시 한 번만 뜨는 2~3단계 첫 진입 안내. 건너뛰기 가능, 확인하면
// localStorage에 기록되어 다시 뜨지 않는다.
export function WelcomeOnboarding() {
  const [seen, markSeen] = useOnceSeen(STORAGE_KEY)
  const [step, setStep] = useState(0)

  if (seen) return null

  const isLast = step === WELCOME_STEPS.length - 1
  const current = WELCOME_STEPS[step]

  const handleNext = () => {
    if (isLast) {
      markSeen()
      return
    }
    setStep((prev) => prev + 1)
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-6 animate-[backdrop-fade-in_180ms_ease-out]">
      <div
        className="panel-frame w-full max-w-xs rounded-xl border border-surface-border bg-surface-card p-5 text-text-primary animate-[modal-pop-in_180ms_ease-out]"
        style={{ '--panel-accent-color': 'var(--color-blue-strong)' } as CSSProperties}
      >
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {WELCOME_STEPS.map((_, index) => (
              <span
                key={index}
                className={`h-1.5 w-5 rounded-full transition-colors duration-150 ${
                  index === step ? 'bg-blue-strong' : 'bg-surface-border'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={markSeen}
            className="text-[11px] text-text-secondary transition-colors duration-150 hover:text-text-primary"
          >
            {getButtonLabel('skip')}
          </button>
        </div>

        <div key={step} className="animate-[panel-fade-in_200ms_ease-out]">
          <h2 className="mt-4 text-base font-semibold text-blue-strong">{current.title}</h2>
          <p className="mt-2 text-xs leading-relaxed text-text-secondary">{current.body}</p>
        </div>

        <Button variant="primary" onClick={handleNext} className="mt-5 w-full">
          {isLast ? getButtonLabel('start') : getButtonLabel('next')}
        </Button>
      </div>
    </div>
  )
}
