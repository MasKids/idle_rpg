// 타임 하이스트 사용 횟수/쿨타임 종료 시각을 localStorage에 저장.
// setInterval에 의존하지 않고, 절대 시각(cooldownEndsAt)을 저장해두면
// 앱을 껐다 켜도 Date.now()와의 차이만으로 남은 쿨타임을 정확히 계산할 수 있다.

const STORAGE_KEY = 'idle-rpg:timeheist'

export interface TimeHeistPersisted {
  usedCount: number
  cooldownEndsAt: number | null
}

const DEFAULT_STATE: TimeHeistPersisted = {
  usedCount: 0,
  cooldownEndsAt: null,
}

export function loadTimeHeistState(): TimeHeistPersisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE }

    const parsed = JSON.parse(raw) as Partial<TimeHeistPersisted>
    return {
      usedCount: typeof parsed.usedCount === 'number' ? parsed.usedCount : 0,
      cooldownEndsAt: typeof parsed.cooldownEndsAt === 'number' ? parsed.cooldownEndsAt : null,
    }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export function saveTimeHeistState(state: TimeHeistPersisted): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // 프라이빗 모드 등 localStorage 접근 불가 환경에서는 조용히 무시
  }
}
