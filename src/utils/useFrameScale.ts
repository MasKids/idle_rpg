import { useEffect, useState } from 'react'

// 데스크톱에서 항상 같은 세로 프레임 비율로 보이게 하는 고정 논리 해상도.
// 기존 App.tsx가 이미 쓰던 max-w-[430px]/h-[900px] 값을 그대로 가져왔다(비율
// 430:900 ≈ 9:18.8, 세로로 긴 스마트폰 화면과 비슷한 비율).
export const FRAME_WIDTH = 430
export const FRAME_HEIGHT = 900

// 이 너비 이하는 "실제 모바일 기기"로 간주해 프레임 비율을 강제하지 않는다.
// 실기기는 기종마다 화면 비율이 430:900과 정확히 일치하지 않는데(예: 아이폰
// 13은 390:844), 억지로 비율을 맞추면 화면 위아래에 레터박스(빈 여백)가
// 생긴다 — 실기기에서는 그냥 화면을 꽉 채우는 쪽이 자연스럽다. Tailwind의
// sm: 브레이크포인트(640px)와 동일한 값을 써서 기존 반응형 클래스와 기준을
// 맞췄다.
const DESKTOP_BREAKPOINT = 640

export interface FrameScale {
  // true면 고정 크기(FRAME_WIDTH×FRAME_HEIGHT) + transform: scale() 프레임,
  // false면 스케일 없이 화면을 그대로 채운다.
  isDesktopFrame: boolean
  scale: number
}

function computeFrameScale(): FrameScale {
  if (typeof window === 'undefined') return { isDesktopFrame: false, scale: 1 }
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (vw <= DESKTOP_BREAKPOINT) return { isDesktopFrame: false, scale: 1 }
  // 가로/세로 중 더 빡빡하게 맞는 쪽 기준으로 맞춘다 — 세로가 짧은 화면(노트북
  // 등)에서는 세로 기준으로 축소되고, 큰 모니터에서는 화면을 최대한 채우도록
  // 확대된다. 어느 쪽이든 430:900 비율 자체는 항상 그대로 유지된다.
  const scale = Math.min(vw / FRAME_WIDTH, vh / FRAME_HEIGHT)
  return { isDesktopFrame: true, scale }
}

// 창 크기가 바뀌어도(데스크톱 브라우저 리사이즈, 모바일 기기 회전 등) 프레임
// 내부 UI 비율이 항상 동일하게 유지되도록 스케일 값을 계산해 반환한다.
export function useFrameScale(): FrameScale {
  const [frame, setFrame] = useState<FrameScale>(computeFrameScale)

  useEffect(() => {
    const update = () => setFrame(computeFrameScale())
    update()
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [])

  return frame
}
