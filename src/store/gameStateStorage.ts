// 재화/스탯/장비/숙련/존재력 트리/스테이지 진행 등 게임 전체 진행 상태를
// localStorage에 저장해 새로고침·재접속 시 복원한다.
// 전투 틱마다 상태가 바뀌므로 매번 쓰지 않고 일정 주기로 묶어서(debounce) 저장한다.

import type {
  BattleState,
  CurrencyKey,
  EquipmentSlotId,
  RebirthSpentTotals,
  SpecialUnlockId,
  StatKey,
} from '../types/game'

const STORAGE_KEY = 'idle-rpg:game'
const SAVE_DEBOUNCE_MS = 2000

// 저장 구조가 바뀌면 이 값을 올린다. 로드 시 버전이 다르면 깨진 값으로 취급하지 않고
// 그냥 "저장 없음"과 동일하게 취급해 초기 상태로 시작한다 (마이그레이션은 하지 않음 — 프로토타입 범위 밖).
const SAVE_VERSION = 1

export interface GameSaveState {
  currencies: Record<CurrencyKey, number>
  statLevels: Record<StatKey, number>
  equipmentLevels: Record<EquipmentSlotId, number>
  masteryLevels: Record<string, number>
  existTreeStatBonus: Record<StatKey, number>
  currentStage: number
  battle: BattleState
  unlockedCount: number
  specialUnlocks: Record<SpecialUnlockId, boolean>
  rebirthSpent: RebirthSpentTotals
  timeHeistUsedCount: number
  timeHeistLastUsedAt: number | null
  // 오프라인 보상 계산용. 저장할 때마다 현재 시각으로 갱신된다.
  lastActiveAt: number
}

interface SaveEnvelope {
  version: number
  data: GameSaveState
}

export function loadGameState(): GameSaveState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<SaveEnvelope>
    if (parsed.version !== SAVE_VERSION || !parsed.data) return null
    return parsed.data
  } catch {
    return null
  }
}

function writeGameState(state: GameSaveState): void {
  try {
    const envelope: SaveEnvelope = { version: SAVE_VERSION, data: state }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope))
  } catch {
    // 프라이빗 모드 등 localStorage 접근 불가 환경에서는 조용히 무시
  }
}

export function clearGameState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

// 오프라인 보상 테스트용: 저장된 마지막 접속 시각을 직접 덮어쓴다.
// 저장 자체를 건드리는 것이라 자동저장이 즉시 되살리지 않도록 disableAutosave()와 함께 쓰고,
// 다음 앱 시작(module 로드) 시점에 반영되므로 호출 후 새로고침이 필요하다.
export function debugOverrideLastActiveAt(timestampMs: number): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<SaveEnvelope>
    if (parsed.version !== SAVE_VERSION || !parsed.data) return
    parsed.data.lastActiveAt = timestampMs
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
  } catch {
    // ignore
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingState: GameSaveState | null = null
let autosaveDisabled = false

export function scheduleSave(state: GameSaveState): void {
  if (autosaveDisabled) return
  pendingState = state
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    if (pendingState) writeGameState(pendingState)
  }, SAVE_DEBOUNCE_MS)
}

// 탭 종료/새로고침 직전에 대기 중이던 저장을 즉시 반영
export function flushSave(): void {
  if (autosaveDisabled) return
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (pendingState) writeGameState(pendingState)
}

// 의도적인 전체 초기화 시 호출: 이후의 예약된/beforeunload 저장이
// 방금 지운 세이브를 되살리지 않도록 막는다.
export function disableAutosave(): void {
  autosaveDisabled = true
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  pendingState = null
}
