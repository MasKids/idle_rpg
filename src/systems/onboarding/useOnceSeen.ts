import { useState } from 'react'
import { onboardingStorage } from './onboardingStorage'

// "한 번 확인하면 다시 안 뜨는" 안내(첫 진입 온보딩, 시스템별 첫 진입 툴팁)에 공용으로 쓴다.
export function useOnceSeen(key: string): [boolean, () => void] {
  const [seen, setSeen] = useState(() => onboardingStorage.readFlag(key))

  const markSeen = () => {
    onboardingStorage.writeFlag(key)
    setSeen(true)
  }

  return [seen, markSeen]
}
