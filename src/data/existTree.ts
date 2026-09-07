import type { CurrencyKey, ExistNodeEffect, ExistSpecialUnlock, ExistTreeNode, StatKey } from '../types/game'

export const EXIST_TREE_TOTAL_NODES = 50
const NODES_PER_TIER = 10

// 노드 이름 오버라이드 (index = order - 1). 채워지면 자동 생성 대신 사용.
// 이름이 확정되면 이 배열만 채우면 된다.
const NODE_NAME_OVERRIDES: (string | null)[] = new Array(EXIST_TREE_TOTAL_NODES).fill(null)

const CYCLE3_STATS: StatKey[] = ['aspd', 'crit', 'critDmg']
const CYCLE4_CURRENCIES: CurrencyKey[] = ['essence', 'timeEnergy']

function tierOf(order: number): number {
  return Math.floor((order - 1) / NODES_PER_TIER) + 1
}

function defaultName(order: number): string {
  const indexInTier = ((order - 1) % NODES_PER_TIER) + 1
  return `T${tierOf(order)}-${indexInTier}`
}

function nodeName(order: number): string {
  return NODE_NAME_OVERRIDES[order - 1] ?? defaultName(order)
}

function nodeCost(order: number): number {
  return Math.floor(10 * 1.35 ** (order - 1))
}

function statValue(order: number): number {
  return 5 + Math.floor(order / 5) * 3
}

function currencyAmount(order: number): number {
  return 5 + Math.floor(order / 5) * 5
}

function effectFor(order: number): ExistNodeEffect {
  const cycle = order % 5

  if (cycle === 1) return { kind: 'stat', stat: 'atk', value: statValue(order) }
  if (cycle === 2) return { kind: 'stat', stat: 'def', value: statValue(order) }

  if (cycle === 3) {
    const stat = CYCLE3_STATS[Math.floor((order - 3) / 5) % CYCLE3_STATS.length]
    return { kind: 'stat', stat, value: statValue(order) }
  }

  if (cycle === 4) {
    const currency = CYCLE4_CURRENCIES[Math.floor((order - 4) / 5) % CYCLE4_CURRENCIES.length]
    return { kind: 'currency', currency, amount: currencyAmount(order) }
  }

  // cycle === 0: EXIST_GAIN 스탯 / 성장에너지 지급 교대
  const isStatTurn = Math.floor((order - 5) / 5) % 2 === 0
  return isStatTurn
    ? { kind: 'stat', stat: 'existGain', value: statValue(order) }
    : { kind: 'currency', currency: 'growthEnergy', amount: currencyAmount(order) }
}

export function generateExistTree(): ExistTreeNode[] {
  const nodes: ExistTreeNode[] = []

  for (let order = 1; order <= EXIST_TREE_TOTAL_NODES; order++) {
    nodes.push({
      order,
      tier: tierOf(order),
      name: nodeName(order),
      cost: nodeCost(order),
      effect: effectFor(order),
    })
  }

  return nodes
}

// 트리 소속 아님 — 트리 옆 여백에 조건 충족 시 등장하는 특별 해금.
// cost는 해당 order의 노드 비용 공식을 재사용한 1차 초안 값.
export const EXIST_SPECIAL_UNLOCKS: ExistSpecialUnlock[] = [
  {
    id: 'reverse',
    label: '리버스',
    anchorOrder: 15,
    requiredUnlockedCount: 15,
    cost: nodeCost(15),
  },
  {
    id: 'timeHeist',
    label: '타임 하이스트',
    anchorOrder: 33,
    requiredUnlockedCount: 33,
    cost: nodeCost(33),
  },
]
