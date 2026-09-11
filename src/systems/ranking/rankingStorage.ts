// 랭킹 기록 등록 스로틀링 상태 — 게임 진행 저장(idle-rpg:game)과 별개 키로 관리한다
// (onboardingStorage.ts와 동일한 패턴). "마지막으로 등록을 시도한 최고 스테이지"만
// 기억해두고, 이 값이 속한 10 단위 구간을 벗어나야(스테이지 10 상승) 다시 등록한다.
const KEY = 'idle-rpg:ranking:lastSubmittedStage'

export function readLastSubmittedStage(): number {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return 0
    const value = Number(raw)
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

export function writeLastSubmittedStage(stage: number): void {
  try {
    localStorage.setItem(KEY, String(stage))
  } catch {
    // 프라이빗 모드 등 접근 불가 환경에서는 조용히 무시
  }
}
