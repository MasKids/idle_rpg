export type CurrencyKey = 'exist' | 'growthEnergy' | 'timeEnergy' | 'gold' | 'essence'

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

// 장비 / 무기 숙련

export type EquipmentSlotId = 'weapon' | 'helmet' | 'armor' | 'gloves' | 'boots'

export interface EquipmentSlotData {
  id: EquipmentSlotId
  label: string
  stat: Extract<StatKey, 'atk' | 'def'>
}

export interface WeaponMasteryData {
  id: string
  name: string
}

// 리버스 환급 추적

export interface RebirthSpentTotals {
  growthEnergy: number
  gold: number
  essence: number
}
