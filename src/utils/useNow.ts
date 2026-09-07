import { useEffect, useState } from 'react'

// 화면 갱신용일 뿐 — 실제 남은 시간 계산은 항상 Date.now()와 저장된
// 절대 시각의 차이로 구한다. 이 훅이 안 돌아도(탭 비활성 등) 다음 렌더에서
// 다시 Date.now()를 읽는 순간 정확한 값으로 돌아온다.
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
