export type CurrencyKey = 'exist' | 'growthEnergy' | 'timeEnergy' | 'gold' | 'essence'

export type StatKey = 'atk' | 'def' | 'aspd' | 'crit' | 'critDmg' | 'existGain'

export type TabKey = 'growth' | 'equipment' | 'gacha' | 'time' | 'dogam'

// 존재력 트리

export type ExistNodeEffect =
  | { kind: 'stat'; stat: StatKey; value: number }
  | { kind: 'currency'; currency: CurrencyKey; amount: number }

export interface ExistTreeNode {
  order: number
  tier: number
  name: string
  cost: number
  effect: ExistNodeEffect
}

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
