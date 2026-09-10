import { BALANCE_TABLES, getExistTreeTier, getFeatureUnlock, getString } from './balance'
import type {
  CurrencyKey,
  ExistNodeEffect,
  ExistNodeStatus,
  ExistSpecialUnlock,
  ExistTreeLane,
  ExistTreeNode,
  SpecialUnlockId,
  StatKey,
} from '../types/game'

// ExistTreeTable은 50노드를 나열하지 않고, 각 행이 담당하는 order 구간(OrderFrom~OrderTo)
// 단위의 계수만 담는다. 티어(10노드) 하나가 여러 행(소구간)으로 나뉠 수 있어 같은 티어
// 안에서도 서로 다른 효과가 섞인다 — getExistTreeTier(order)가 순번이 속한 행을 찾아준다.
// 총 노드 개수는 테이블에 정의된 마지막 행의 OrderTo로부터 그대로 계산한다.
export const EXIST_TREE_TOTAL_NODES = Math.max(...BALANCE_TABLES.ExistTreeTable.map((row) => row.OrderTo))

// 이름 자동생성(T{tier}-{n})용 표시 상수 — ExistTreeTable이 티어당 10노드로 설계된 것과 동일 전제
const NODES_PER_TIER = 10

// 노드 이름 오버라이드 (index = order - 1). 채워지면 자동 생성 대신 사용.
// 이름이 확정되면 이 배열만 채우면 된다.
const NODE_NAME_OVERRIDES: (string | null)[] = new Array(EXIST_TREE_TOTAL_NODES).fill(null)

function tierOf(order: number): number {
  return Math.floor((order - 1) / NODES_PER_TIER) + 1
}

// 홀수 order = 왼쪽, 짝수 order = 오른쪽 (지그재그 배치)
function laneOf(order: number): ExistTreeLane {
  return order % 2 === 1 ? 'left' : 'right'
}

function defaultName(order: number): string {
  const indexInTier = ((order - 1) % NODES_PER_TIER) + 1
  return `T${tierOf(order)}-${indexInTier}`
}

function nodeName(order: number): string {
  return NODE_NAME_OVERRIDES[order - 1] ?? defaultName(order)
}

function nodeCost(order: number): number {
  const tier = getExistTreeTier(order)
  return Math.floor(tier.CostBase * tier.CostGrowthRate ** (order - tier.OrderFrom))
}

function nodeValue(order: number): number {
  const tier = getExistTreeTier(order)
  return tier.ValueBase + (order - tier.OrderFrom) * tier.ValuePerNode
}

const STAT_TYPE_TO_KEY: Record<string, StatKey> = {
  ATK: 'atk',
  ASPD: 'aspd',
  CRIT: 'crit',
  CRIT_DMG: 'critDmg',
  EXIST_GAIN: 'existGain',
}

const CURRENCY_TYPE_TO_KEY: Record<string, CurrencyKey> = {
  EXIST: 'exist',
  GROWTH_ENERGY: 'growthEnergy',
  MASTERY_ESSENCE: 'essence',
  TIME_ENERGY: 'timeEnergy',
  GOLD: 'gold',
}

function effectFor(order: number): ExistNodeEffect {
  const tier = getExistTreeTier(order)
  const value = nodeValue(order)

  if (tier.EffectType === 'GRANT' && tier.GrantCurrency) {
    return { kind: 'currency', currency: CURRENCY_TYPE_TO_KEY[tier.GrantCurrency], amount: value }
  }
  if (tier.StatType) {
    return { kind: 'stat', stat: STAT_TYPE_TO_KEY[tier.StatType], value }
  }

  console.warn(`[existTree] order ${order} (tier ${tier.Tier})의 효과 설정이 비어있어 기본값(ATK)으로 대체합니다.`)
  return { kind: 'stat', stat: 'atk', value }
}

export function generateExistTree(): ExistTreeNode[] {
  const nodes: ExistTreeNode[] = []

  for (let order = 1; order <= EXIST_TREE_TOTAL_NODES; order++) {
    nodes.push({
      order,
      tier: tierOf(order),
      lane: laneOf(order),
      name: nodeName(order),
      cost: nodeCost(order),
      effect: effectFor(order),
    })
  }

  return nodes
}

// 해금 판정: order <= unlockedCount + 1. 다음 순번 하나만 "해금 가능"
export function existNodeStatus(order: number, unlockedCount: number): ExistNodeStatus {
  if (order <= unlockedCount) return 'unlocked'
  if (order === unlockedCount + 1) return 'unlockable'
  return 'locked'
}

// 트리 소속 아님 — 트리 옆 여백에 조건 충족 시 등장하는 특별 해금. FeatureUnlockTable 기반.
const SPECIAL_UNLOCK_FEATURE_TYPE: Record<SpecialUnlockId, 'REBIRTH' | 'TIME_HEIST'> = {
  reverse: 'REBIRTH',
  timeHeist: 'TIME_HEIST',
}

export const EXIST_SPECIAL_UNLOCKS: ExistSpecialUnlock[] = (Object.keys(SPECIAL_UNLOCK_FEATURE_TYPE) as SpecialUnlockId[]).map(
  (id) => {
    const config = getFeatureUnlock(SPECIAL_UNLOCK_FEATURE_TYPE[id])
    return {
      id,
      label: getString(config.Name, 'KOR'),
      anchorOrder: config.RequireNodeCount,
      requiredUnlockedCount: config.RequireNodeCount,
      cost: config.UnlockCost,
    }
  },
)
