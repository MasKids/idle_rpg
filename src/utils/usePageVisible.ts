import { useEffect, useState } from 'react'

// 배경 장식 애니메이션(회전/파티클)을 탭이 백그라운드일 때 멈추기 위한 훅.
// 방치형 게임 특성상 탭을 오래 띄워두는 경우가 많아, 안 보일 때도 계속 도는
// 무한 애니메이션은 불필요한 렌더 비용이라 판단.
export function usePageVisible(): boolean {
  const [isVisible, setIsVisible] = useState(() => document.visibilityState === 'visible')

  useEffect(() => {
    const handleChange = () => setIsVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', handleChange)
    return () => document.removeEventListener('visibilitychange', handleChange)
  }, [])

  return isVisible
}
