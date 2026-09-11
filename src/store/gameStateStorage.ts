// 재화/스탯/장비/숙련/존재력 트리/스테이지 진행 등 게임 전체 진행 상태를
// localStorage에 저장해 새로고침·재접속 시 복원한다.
// 전투 틱마다 상태가 바뀌므로 매번 쓰지 않고 일정 주기로 묶어서(debounce) 저장한다.

import { getCommon } from '../data/balance'
import type { ActiveRelicSlots, BattleState, CurrencyKey, OwnedWeapons, SpecialUnlockId, StatKey } from '../types/game'

const STORAGE_KEY = 'idle-rpg:game'
const SAVE_DEBOUNCE_MS = getCommon('AutoSaveIntervalSec') * 1000
// idle-rpg:game(세이브 본체) 외에 onboarding(idle-rpg:onboarding:*)·ranking
// (idle-rpg:ranking:*) 등도 전부 이 접두사를 쓴다 — 세이브 버전이 바뀌어 초기화할
// 때 구버전이 남긴 흔적을 한 번에 정리하기 위한 공용 접두사.
const STORAGE_PREFIX = 'idle-rpg:'

// 저장 구조가 바뀌면 이 값을 올린다. 로드 시 버전이 다르면 깨진 값으로 취급하지 않고
// 그냥 "저장 없음"과 동일하게 취급해 초기 상태로 시작한다 (마이그레이션은 하지 않음 — 프로토타입 범위 밖).
// v0.2.0에서 1→2: 데이터 테이블 전면 개편으로 존재력 트리 비용 곡선·스테이지 HP
// 증가율이 달라져서, 구버전 세이브를 그대로 이어서 로드하면 크래시는 안 나지만
// (실제로 확인함 — 새 필드는 ??로 기본값 대체, 무기/스탯 등 기존 필드도 그대로
// 유효) 진행 중이던 난이도가 로드 시점에 갑자기 확 뀌는 어색한 경험이 된다.
// 포트폴리오 데모라 굳이 구버전 진행을 이어갈 이유가 없어 초기화 쪽을 택했다.
// v0.2.0에서 2→3: 이름 입력을 강제하는 흐름을 새로 넣으면서, 이미 배포돼있던
// 이전 버전 사용자들도 전부 그 흐름을 거치게 하려고 일부러 세이브를 무효화했다
// (기술적으로 GameSaveState 필드가 바뀐 건 아니지만, RELEASE.md 3절 — 일관된
// 첫인상이 더 중요한 경우 — 에 해당한다고 판단).
// v0.2.0에서 3→4: 리버스 보상 구조를 "누적 소비량 × 환급 배율"에서 "구간 고정
// 지급량 × 리버스 횟수 배율"로 교체하며 rebirthSpent/rebirthBonusPoint 필드
// 자체를 없앴다 — 필드가 사라졌으니 RELEASE.md 3절 기준으로도 세이브 버전을
// 올려야 하는 경우.
const SAVE_VERSION = 4

export interface GameSaveState {
  currencies: Record<CurrencyKey, number>
  statLevels: Record<StatKey, number>
  masteryLevels: Record<string, number>
  existTreeStatBonus: Record<StatKey, number>
  currentStage: number
  battle: BattleState
  unlockedCount: number
  specialUnlocks: Record<SpecialUnlockId, boolean>
  timeHeistUsedCount: number
  timeHeistLastUsedAt: number | null
  // 오프라인 보상 계산용. 저장할 때마다 현재 시각으로 갱신된다.
  lastActiveAt: number
  // 리버스 횟수 — 리버스해도 초기화되지 않는다(리버스 보상 배율의 기준값).
  rebirthCount: number
  rebirthMaxStage: number
  // 무기 — 리버스 시 전부 소멸(초기화)
  ownedWeapons: OwnedWeapons
  equippedWeaponId: string | null
  // 가챠 레벨/누적 뽑기 횟수는 리버스해도 유지된다.
  gachaCount: number
  gachaLevel: number
  // 유물 — 리버스 시 전부 초기화
  ownedRelics: number[]
  activeRelics: ActiveRelicSlots
  // 성장 탭 자동 업그레이드 토글 (존재력 트리는 자동화 대상 아님)
  autoUpgradeStats: boolean
  // 플레이어 프로필
  playerName: string
  // 누적 플레이타임(초) — 앱이 실제로 켜져 있던 시간만 더해진다(오프라인 시간 제외).
  // 리버스해도 유지된다.
  totalPlayTimeSec: number
  // 현재 회차 플레이타임(초) — totalPlayTimeSec과 같은 기준이지만 리버스 시 0으로 초기화된다.
  currentRunTimeSec: number
}

interface SaveEnvelope {
  version: number
  data: GameSaveState
}

// 이번 로드에서 "버전이 달라(또는 값이 깨져) 세이브를 무효화했는지" — NameEntryGate가
// "저장 데이터가 초기화되었습니다" 안내를 보여줄지 판단하는 데 쓴다. 앱 부팅 중
// loadGameState()가 실행되는 시점에 딱 한 번만 정해지고 그 뒤로는 바뀌지 않는다.
let didResetOnLoad = false

export function wasSaveResetOnLoad(): boolean {
  return didResetOnLoad
}

// idle-rpg: 접두사를 쓰는 로컬스토리지 키를 전부 지운다(세이브 본체 + 온보딩 +
// 랭킹 등록 스로틀 상태). 세이브 버전이 달라 초기화하는 시점에는 구버전이 남긴
// 흔적이 새 흐름(이름 입력 강제 등)과 꼬이지 않게 통째로 정리하는 편이 안전하다.
function clearAllIdleRpgStorage(): void {
  try {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith(STORAGE_PREFIX))
    for (const key of keys) localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export function loadGameState(): GameSaveState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<SaveEnvelope>
    if (parsed.version !== SAVE_VERSION || !parsed.data) {
      didResetOnLoad = true
      clearAllIdleRpgStorage()
      return null
    }
    return parsed.data
  } catch {
    didResetOnLoad = true
    clearAllIdleRpgStorage()
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
