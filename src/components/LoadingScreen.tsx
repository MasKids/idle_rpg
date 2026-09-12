import { useEffect, useState } from 'react'
import { BrandLogo } from './BrandLogo'
import { getMetaUiLabel } from '../data/uiStrings'

// balance.json은 정적 import라 JS 번들이 파싱되는 순간 이미 메모리에 있다(따로
// 기다릴 "로딩"이 없다) — 실질적으로 기다리는 건 폰트(Pretendard Variable
// dynamic-subset, 실제 쓰는 글자만 네트워크로 받아온다)뿐이다. document.fonts.ready로
// 그 완료 시점을 감지한다.
//
// 최소 표시 시간 — 실제 로딩(폰트)이 더 빨리 끝나도 항상 이만큼은 강제로
// 보여준다(요청사항).
const MIN_DISPLAY_MS = 3000
const FADE_MS = 400
// document.fonts.ready가 어떤 이유로든 끝나지 않는 경우(구형 브라우저 등)를 대비한
// 안전장치 — MIN_DISPLAY_MS(강제 3초) 위에 느린 폰트 로딩을 위한 여유를 더 둔 값이다.
const SAFETY_TIMEOUT_MS = 6000
// 상태 텍스트 전환 시점 — 실제 로딩 단계와 무관한 장식용 타이밍(로딩이 이 시점
// 전에 끝나도 그냥 넘어간다). "READY"는 타이머가 아니라 isFading 시점에 맞춘다.
const STATUS_SWITCH_MS = 1300

const LOGO_SIZE = 240

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface LoadingScreenProps {
  // 페이드아웃 애니메이션까지 전부 끝난 뒤 호출된다 — 부모는 이 시점에 로딩
  // 화면을 완전히 걷어내면 된다(그 전에 걷으면 페이드 도중 내용이 끊겨 보인다).
  onDone: () => void
}

export function LoadingScreen({ onDone }: LoadingScreenProps) {
  const [isFading, setIsFading] = useState(false)
  const [showSecondStatus, setShowSecondStatus] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fontsReady = (document.fonts?.ready ?? Promise.resolve()).catch(() => undefined)
    const ready = Promise.race([Promise.all([fontsReady, delay(MIN_DISPLAY_MS)]), delay(SAFETY_TIMEOUT_MS)])

    ready.then(() => {
      if (!cancelled) setIsFading(true)
    })

    const statusTimer = setTimeout(() => {
      if (!cancelled) setShowSecondStatus(true)
    }, STATUS_SWITCH_MS)

    return () => {
      cancelled = true
      clearTimeout(statusTimer)
    }
  }, [])

  useEffect(() => {
    if (!isFading) return
    const timer = setTimeout(onDone, FADE_MS)
    return () => clearTimeout(timer)
  }, [isFading, onDone])

  const statusText = isFading
    ? getMetaUiLabel('statusReady')
    : getMetaUiLabel(showSecondStatus ? 'statusLoadingArchive' : 'statusInitializing')

  return (
    <div
      className={`absolute inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-surface-base transition-opacity ease-out ${
        isFading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      {/* 아주 흐린 배경 장식 — 전투 화면 배경의 동심원 모티프를 아주 약하게만
          재사용(요소 자체를 늘리지 않도록 파티클 없이 원 3개뿐). */}
      <svg
        className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2"
        viewBox="0 0 420 420"
        style={{ animation: 'spin-slow 90s linear infinite', opacity: 0.05 }}
      >
        <circle cx="210" cy="210" r="200" fill="none" stroke="var(--color-brand-teal)" strokeWidth="1" />
        <circle cx="210" cy="210" r="150" fill="none" stroke="var(--color-brand-teal)" strokeWidth="1" />
        <circle cx="210" cy="210" r="100" fill="none" stroke="var(--color-brand-teal)" strokeWidth="1" />
      </svg>

      <BrandLogo size={LOGO_SIZE} showSubtitle />

      <div className="absolute bottom-16 flex flex-col items-center gap-2.5" style={{ width: LOGO_SIZE }}>
        <div className="h-px w-full overflow-hidden bg-surface-border">
          <div
            style={{ backgroundColor: 'var(--color-brand-teal)' }}
            className={`h-full ${
              isFading ? 'w-full transition-[width] duration-200 ease-out' : 'animate-[loading-bar-trickle_2.8s_ease-out_forwards]'
            }`}
          />
        </div>
        <p className="font-mono text-[10px] tracking-widest" style={{ color: 'var(--color-brand-dim)' }}>
          {statusText}
        </p>
      </div>

      <p className="absolute bottom-5 font-mono text-[10px]" style={{ color: 'var(--color-brand-dim)' }}>
        {getMetaUiLabel('createdByPrefix')}
      </p>
    </div>
  )
}
