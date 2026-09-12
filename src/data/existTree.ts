import { BALANCE_TABLES, getExistTreeNode, getFeatureUnlock, getString } from './balance'
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

// ExistTreeTable은 250노드(v0.4.0부터)를 전부 개별 행으로 나열한다(2단계 개편 — 구간 압축 방식은
// 폐기, docs/TABLE_REDESIGN.md 2.2절). 노드 하나하나를 손으로 조정할 수 있어야 하는
// 데이터라 공식이 아니라 리터럴 값을 그대로 조회만 한다. 총 노드 개수는 테이블 행 수.
export const EXIST_TREE_TOTAL_NODES = BALANCE_TABLES.ExistTreeTable.length

// 이름이 아직 확정되지 않은 노드는 NameStringId가 0이라 "T{tier}-{n}" 자동 생성
// 이름으로 대체한다(폴백). 이름이 확정되면 엑셀에서 NameStringId만 채우면 된다.
function defaultName(order: number, tier: number): string {
  const indexInTier = ((order - 1) % 10) + 1
  return `T${tier}-${indexInTier}`
}

// 홀수 order = 왼쪽, 짝수 order = 오른쪽 (지그재그 배치) — order로부터 결정론적이라
// 데이터로 내리지 않고 코드에서 계산한다.
function laneOf(order: number): ExistTreeLane {
  return order % 2 === 1 ? 'left' : 'right'
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

function effectFor(node: ReturnType<typeof getExistTreeNode>): ExistNodeEffect {
  if (node.EffectType === 'GRANT' && node.GrantCurrency) {
    return { kind: 'currency', currency: CURRENCY_TYPE_TO_KEY[node.GrantCurrency], amount: node.Value }
  }
  if (node.StatType) {
    return { kind: 'stat', stat: STAT_TYPE_TO_KEY[node.StatType], value: node.Value }
  }

  console.warn(`[existTree] order ${node.Order}(tier ${node.Tier})의 효과 설정이 비어있어 기본값(ATK)으로 대체합니다.`)
  return { kind: 'stat', stat: 'atk', value: node.Value }
}

export function generateExistTree(): ExistTreeNode[] {
  const nodes: ExistTreeNode[] = []

  for (let order = 1; order <= EXIST_TREE_TOTAL_NODES; order++) {
    const node = getExistTreeNode(order)
    nodes.push({
      order,
      tier: node.Tier,
      lane: laneOf(order),
      name: node.NameStringId ? getString(node.NameStringId, 'KOR', defaultName(order, node.Tier)) : defaultName(order, node.Tier),
      cost: node.Cost,
      effect: effectFor(node),
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

export interface BulkExistUnlockResult {
  fromCount: number
  toCount: number
  totalCost: number
  // 도중에 멈췄다면 그 원인이 된 특별 해금(아직 해금 안 한 리버스/타임 하이스트) —
  // 도달한 순간 자동으로 계속 진행하지 않고 여기서 멈춘다(v0.4.0 일괄 해금).
  stoppedAtSpecial: ExistSpecialUnlock | null
  currencyGrants: Partial<Record<CurrencyKey, number>>
  statGains: Partial<Record<StatKey, number>>
}

// 보유 EXIST로 가능한 만큼 다음 노드부터 연속 해금 — 순수 함수라 미리보기와 실제
// 적용(gameStore.ts의 bulkUnlockExistNodes) 양쪽에서 그대로 재사용한다. 아직
// 해금하지 않은 특별 해금(리버스/타임 하이스트)의 조건 노드에 도달하면 그 노드까지만
// 해금하고 멈춘다 — 중요한 해금이라 "일괄"에 묻혀 지나치지 않고 플레이어가 직접
// 인지하고 개별 클릭하게 하기 위함(요청 3번).
export function simulateBulkExistUnlock(
  nodes: ExistTreeNode[],
  startCount: number,
  exist: number,
  specialUnlocks: Record<SpecialUnlockId, boolean>,
): BulkExistUnlockResult {
  let count = startCount
  let remaining = exist
  let totalCost = 0
  const currencyGrants: Partial<Record<CurrencyKey, number>> = {}
  const statGains: Partial<Record<StatKey, number>> = {}
  const pendingSpecialOrders = new Set(
    EXIST_SPECIAL_UNLOCKS.filter((unlock) => !specialUnlocks[unlock.id]).map((unlock) => unlock.requiredUnlockedCount),
  )
  let stoppedAtSpecial: ExistSpecialUnlock | null = null

  while (true) {
    const node = nodes[count]
    if (!node) break
    if (remaining < node.cost) break

    remaining -= node.cost
    totalCost += node.cost
    count = node.order

    if (node.effect.kind === 'currency') {
      currencyGrants[node.effect.currency] = (currencyGrants[node.effect.currency] ?? 0) + node.effect.amount
    } else {
      statGains[node.effect.stat] = (statGains[node.effect.stat] ?? 0) + node.effect.value
    }

    if (pendingSpecialOrders.has(count)) {
      stoppedAtSpecial = EXIST_SPECIAL_UNLOCKS.find((unlock) => unlock.requiredUnlockedCount === count) ?? null
      break
    }
  }

  return { fromCount: startCount, toCount: count, totalCost, stoppedAtSpecial, currencyGrants, statGains }
}
