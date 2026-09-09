export type CurrencyKey = 'exist' | 'growthEnergy' | 'timeEnergy' | 'gold' | 'essence' | 'diamond'

export type StatKey = 'atk' | 'def' | 'aspd' | 'crit' | 'critDmg' | 'existGain'

export type TabKey = 'growth' | 'equipment' | 'gacha' | 'exist' | 'dogam'

// 존재력 트리

export type ExistNodeEffect =
  | { kind: 'stat'; stat: StatKey; value: number }
  | { kind: 'currency'; currency: CurrencyKey; amount: number }

export type ExistTreeLane = 'left' | 'right'

export interface ExistTreeNode {
  order: number
  tier: number
  lane: ExistTreeLane
  name: string
  cost: number
  effect: ExistNodeEffect
}

export type ExistNodeStatus = 'unlocked' | 'unlockable' | 'locked'

export type SpecialUnlockId = 'reverse' | 'timeHeist'

export interface ExistSpecialUnlock {
  id: SpecialUnlockId
  label: string
  anchorOrder: number
  requiredUnlockedCount: number
  cost: number
}

// 스테이지 / 전투

export interface StageData {
  stage: number
  isBoss: boolean
  enemyHp: number
  enemyAtk: number
  rewards: {
    gold: number
    growthEnergy: number
    exist: number
    timeEnergy: number
  }
}

export interface BattleState {
  stage: number
  enemyMaxHp: number
  enemyHp: number
  isBossStage: boolean
  kills: number
  killsRequired: number
}

// 전투 루프는 store 레벨에서 항상 돌아간다. lastHit은 화면(BattleArea)이
// 떠 있을 때 데미지 팝업 연출을 위해 구독하는 이벤트성 필드일 뿐,
// 전투 시뮬레이션 자체는 이 값과 무관하게 진행된다.
export interface BattleHit {
  id: number
  amount: number
  isCrit: boolean
}

// 무기 숙련

export interface WeaponMasteryData {
  id: string
  name: string
}

// 무기 인벤토리 — 무기 타입(종류_등급_단계) 문자열 하나당 보유 상태 하나.
// (레벨/돌파는 타입 단위로만 존재한다. docs/WEAPON_SYSTEM.md 1.2 참고)

export interface WeaponInstance {
  count: number
  level: number
  breakthroughCount: number
}

export type OwnedWeapons = Record<string, WeaponInstance>

// 무기 가챠 1회 결과 — 화면에 등급별 색상/중복 여부를 표시하기 위해 판정까지 함께 담는다.
export interface WeaponGachaPullResult {
  weaponId: string
  isDuplicate: boolean
}

// 유물 슬롯 — 인덱스 위치에 유물 Id(RelicTable.Id)를 꽂거나 비워둔다(null).
export type ActiveRelicSlots = (number | null)[]

// 유물 뽑기 1회 결과 — 중복이면 보유 목록에 추가되지 않고 시간에너지로 환급된다.
export interface RelicGachaPullResult {
  relicId: number
  isDuplicate: boolean
}

// 리버스 환급 추적

export interface RebirthSpentTotals {
  growthEnergy: number
  gold: number
  essence: number
}
