import { useEffect, useState } from 'react'
import { getMetaUiLabel } from '../data/uiStrings'

// balance.json은 정적 import라 JS 번들이 파싱되는 순간 이미 메모리에 있다(따로
// 기다릴 "로딩"이 없다) — 실질적으로 기다릴 만한 건 폰트(Pretendard Variable
// dynamic-subset, 실제 쓰는 글자만 네트워크로 받아온다)뿐이다. document.fonts.ready로
// 그 완료 시점을 감지한다.
//
// 최소 표시 시간 — 실제 로딩(폰트)이 더 빨리 끝나도 항상 이만큼은 강제로
// 보여준다(요청사항).
const MIN_DISPLAY_MS = 3000
const FADE_MS = 400
// document.fonts.ready가 어떤 이유로든 끝나지 않는 경우(구형 브라우저 등)를 대비한
// 안전장치 — 이 시간이 지나면 로딩 상태와 무관하게 강제로 다음 단계로 넘어간다.
// MIN_DISPLAY_MS(강제 3초) 위에 느린 폰트 로딩을 위한 여유를 더 둔 값이다.
const SAFETY_TIMEOUT_MS = 6000

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

  useEffect(() => {
    let cancelled = false
    const fontsReady = (document.fonts?.ready ?? Promise.resolve()).catch(() => undefined)
    const ready = Promise.race([Promise.all([fontsReady, delay(MIN_DISPLAY_MS)]), delay(SAFETY_TIMEOUT_MS)])

    ready.then(() => {
      if (!cancelled) setIsFading(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isFading) return
    const timer = setTimeout(onDone, FADE_MS)
    return () => clearTimeout(timer)
  }, [isFading, onDone])

  return (
    <div
      className={`absolute inset-0 z-[60] flex flex-col items-center justify-center bg-surface-base transition-opacity ease-out ${
        isFading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <div className="flex flex-col items-center">
        <h1 className="text-3xl font-semibold text-text-primary">{getMetaUiLabel('gameTitle')}</h1>
        <p className="mt-2 text-[10px] tracking-[0.35em] text-text-disabled">{getMetaUiLabel('gameSubtitle')}</p>
      </div>

      <div className="absolute bottom-16 flex w-40 flex-col items-center gap-3">
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-surface-border">
          <div
            className={`h-full rounded-full bg-blue-base ${
              isFading ? 'w-full transition-[width] duration-200 ease-out' : 'animate-[loading-bar-trickle_2.8s_ease-out_forwards]'
            }`}
          />
        </div>
        <p className="text-[10px] text-text-disabled">{getMetaUiLabel('createdByPrefix')}</p>
      </div>
    </div>
  )
}
