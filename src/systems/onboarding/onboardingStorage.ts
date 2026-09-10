// 온보딩(첫 진입 안내/시스템 툴팁/해금 알림 확인 여부)은 게임 진행 저장(idle-rpg:game)과는
// 별개의 localStorage 키로 관리한다 — 세이브 구조 변경 없이 자유롭게 추가/조정하기 위함.
const PREFIX = 'idle-rpg:onboarding:'

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(PREFIX + key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string): void {
  try {
    localStorage.setItem(PREFIX + key, '1')
  } catch {
    // 프라이빗 모드 등 접근 불가 환경에서는 조용히 무시
  }
}

function readNumber(key: string): number | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

function writeNumber(key: string, value: number): void {
  try {
    localStorage.setItem(PREFIX + key, String(value))
  } catch {
    // ignore
  }
}

export const onboardingStorage = {
  readFlag,
  writeFlag,
  readNumber,
  writeNumber,
}

// 전체 상태 초기화(DevPanel) 시 온보딩도 "새 플레이어" 상태로 함께 되돌리기 위한 헬퍼.
export function clearOnboardingState(): void {
  try {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(PREFIX))
    for (const key of keys) localStorage.removeItem(key)
  } catch {
    // ignore
  }
}
