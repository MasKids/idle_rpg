import { useEffect, useState } from 'react'

// isOpen이 꺼진 뒤에도 durationMs 동안 실제 렌더링을 유지해, 그 사이 퇴장
// 애니메이션 클래스를 붙일 시간을 벌어준다. 반환값이 false가 되면 완전히 언마운트해도 된다.
export function useMountTransition(isOpen: boolean, durationMs: number): boolean {
  const [shouldRender, setShouldRender] = useState(isOpen)

  // "닫힘 → 열림"은 렌더 중 바로 반영한다 — effect까지 갈 필요 없는 파생 상태.
  if (isOpen && !shouldRender) {
    setShouldRender(true)
  }

  // "열림 → 닫힘"만 타이머(외부 시스템)와 동기화해야 하므로 effect를 쓴다.
  useEffect(() => {
    if (isOpen) return
    const timeout = setTimeout(() => setShouldRender(false), durationMs)
    return () => clearTimeout(timeout)
  }, [isOpen, durationMs])

  return shouldRender
}
