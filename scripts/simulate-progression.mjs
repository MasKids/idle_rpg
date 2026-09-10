// 밸런스 조정용 진행 속도 시뮬레이터. balance.json(=npm run balance 결과)을 직접
// 읽어서 "능동적으로 최적 플레이"하는 경우의 기준선을 계산한다 — 실제 게임 코드
// (calculateDamage.ts/battleLoop.ts/stats.ts/existTree.ts)의 공식을 그대로
// 재구현했다. 무기 가챠/숙련/유물 보너스는 제외한 "스탯+존재력 트리" 단독
// 기준선이다(실제 플레이는 이보다 약간 더 빠를 수 있음 — 아래 REPORT 출력에도
// 명시).
//
// 실행: node scripts/simulate-progression.mjs [최대 시뮬레이션 분]

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const balance = JSON.parse(readFileSync(resolve(__dirname, '../src/data/balance.json'), 'utf-8'))

const MAX_SIM_SECONDS = (Number(process.argv[2]) || 90) * 60

// ---- 데이터 조회 헬퍼 (balance.ts의 조회 함수를 그대로 재구현) ----
const statTable = Object.fromEntries(balance.StatTable.map((r) => [r.StatType, r]))
const growthCurve = Object.fromEntries(balance.GrowthCurveTable.map((r) => [r.CurveKey, r]))
const statUpgradeCurve = growthCurve.STAT_UPGRADE
const existTree = [...balance.ExistTreeTable].sort((a, b) => a.Order - b.Order)
const featureUnlock = Object.fromEntries(balance.FeatureUnlockTable.map((r) => [r.FeatureType, r]))
const stageByNumber = new Map(balance.StageTable.map((r) => [r.Stage, r]))
const maxStageRow = balance.StageTable.length
const rebirthReward = [...balance.RebirthRewardTable].sort((a, b) => a.StageFrom - b.StageFrom)
const gachaCost = balance.GachaTable[0].PullCostDiamond
const commonTable = Object.fromEntries(balance.CommonTable.map((r) => [r.Key, r.Value]))

function getStageConfig(stage) {
  const clamped = Math.min(stage, maxStageRow)
  return stageByNumber.get(clamped)
}

function statUpgradeCost(level) {
  return Math.floor(statUpgradeCurve.CostBase * statUpgradeCurve.CostGrowthRate ** level)
}

function statValue(statType, level) {
  const config = statTable[statType]
  return config.BaseValue + level * config.ValuePerLevel
}

function rebirthDiamondReward(stage) {
  const row = rebirthReward.find((r) => stage >= r.StageFrom && stage <= r.StageTo)
  return row ? row.DiamondReward : 0
}

// ---- 시뮬레이션 상태 ----
const state = {
  timeSec: 0,
  stage: 1,
  kills: 0,
  currentEnemyHp: getStageConfig(1).EnemyHp,
  statLevels: { ATK: 0, ASPD: 0, CRIT: 0, CRIT_DMG: 0, EXIST_GAIN: 0 },
  currencies: { gold: 0, growthEnergy: 0, exist: 0, timeEnergy: 0, essence: 0, diamond: commonTable.InitialDiamond ?? 200 },
  existTreeBonus: { ATK: 0, ASPD: 0, CRIT: 0, CRIT_DMG: 0 },
  unlockedCount: 0,
  maxClearedStage: 0,
  totalFirstClearDiamond: 0,
  reverseUnlockedAt: null,
  timeHeistUnlockedAt: null,
  nodeReachedAt: {}, // order -> seconds
  stageReachedAt: {}, // stage -> seconds (처음 클리어 시각)
  diamondAt: {}, // checkpoint minute -> diamond snapshot
}

function effectiveStats() {
  return {
    atk: statValue('ATK', state.statLevels.ATK) + state.existTreeBonus.ATK,
    aspd: statValue('ASPD', state.statLevels.ASPD) + state.existTreeBonus.ASPD,
    crit: statValue('CRIT', state.statLevels.CRIT) + state.existTreeBonus.CRIT,
    critDmg: statValue('CRIT_DMG', state.statLevels.CRIT_DMG) + state.existTreeBonus.CRIT_DMG,
  }
}

// 틱당 평균 데미지 기댓값(연속값) — 실제 게임은 매 타격마다 랜덤 크리 여부를
// 굴리지만(calculateDamage.ts), 시뮬레이션에서는 기댓값으로 근사한다.
function dps() {
  const s = effectiveStats()
  const hitsPerSec = Math.min(10, Math.max(0.1, s.aspd)) // MIN_INTERVAL_MS=100ms → 초당 최대 10회
  const avgDamage = Math.max(1, s.atk * (1 + (s.crit / 100) * (s.critDmg / 100 - 1)))
  return hitsPerSec * avgDamage
}

// 가장 싼 스탯부터 자동 구매(자동 업그레이드 토글 ON 가정) — growthEnergy가 들어올 때마다.
function spendGrowthEnergyGreedy() {
  for (;;) {
    let cheapestKey = null
    let cheapestCost = Infinity
    for (const key of ['ATK', 'ASPD', 'CRIT', 'CRIT_DMG', 'EXIST_GAIN']) {
      const cost = statUpgradeCost(state.statLevels[key])
      if (cost < cheapestCost) {
        cheapestCost = cost
        cheapestKey = key
      }
    }
    if (state.currencies.growthEnergy < cheapestCost) break
    state.currencies.growthEnergy -= cheapestCost
    state.statLevels[cheapestKey] += 1
  }
}

// 다음 존재력 트리 노드를 살 수 있으면 즉시 구매(숙련된 플레이어 가정) — 순서대로만.
// 단, 노드 수 조건은 이미 채웠는데 특별 해금(리버스/타임 하이스트) 비용을 아직 못
// 낸 상태라면, 계속 다음 노드를 사느라 존재력이 새어나가 해금 비용이 영영 안
// 모이는 걸 막기 위해 그 해금 비용을 먼저 모으는 쪽을 우선한다(리버스를 노리는
// 플레이어라면 자연스러운 선택).
function pendingSpecialUnlock() {
  if (state.reverseUnlockedAt === null && state.unlockedCount >= featureUnlock.REBIRTH.RequireNodeCount) {
    return featureUnlock.REBIRTH
  }
  if (state.timeHeistUnlockedAt === null && state.unlockedCount >= featureUnlock.TIME_HEIST.RequireNodeCount) {
    return featureUnlock.TIME_HEIST
  }
  return null
}

function spendExistGreedy() {
  for (;;) {
    const pending = pendingSpecialUnlock()
    if (pending) break // 다음 노드보다 해금 비용 저축을 우선한다.

    const nextOrder = state.unlockedCount + 1
    const node = existTree[nextOrder - 1]
    if (!node) break
    if (state.currencies.exist < node.Cost) break
    state.currencies.exist -= node.Cost
    state.unlockedCount = nextOrder
    if (node.EffectType === 'STAT') {
      state.existTreeBonus[node.StatType] += node.Value
    }
    if (!(nextOrder in state.nodeReachedAt)) state.nodeReachedAt[nextOrder] = state.timeSec
  }

  // 특별 해금(리버스/타임 하이스트) — 노드 수 조건 충족 + exist 여유가 되면 즉시 해금.
  if (state.reverseUnlockedAt === null && state.unlockedCount >= featureUnlock.REBIRTH.RequireNodeCount) {
    if (state.currencies.exist >= featureUnlock.REBIRTH.UnlockCost) {
      state.currencies.exist -= featureUnlock.REBIRTH.UnlockCost
      state.reverseUnlockedAt = state.timeSec
    }
  }
  if (state.timeHeistUnlockedAt === null && state.unlockedCount >= featureUnlock.TIME_HEIST.RequireNodeCount) {
    if (state.currencies.exist >= featureUnlock.TIME_HEIST.UnlockCost) {
      state.currencies.exist -= featureUnlock.TIME_HEIST.UnlockCost
      state.timeHeistUnlockedAt = state.timeSec
    }
  }

  // 방금 해금이 끝났다면 남은 존재력으로 이어서 다음 노드 구매를 재개한다.
  if (!pendingSpecialUnlock()) {
    for (;;) {
      const nextOrder = state.unlockedCount + 1
      const node = existTree[nextOrder - 1]
      if (!node) break
      if (state.currencies.exist < node.Cost) break
      state.currencies.exist -= node.Cost
      state.unlockedCount = nextOrder
      if (node.EffectType === 'STAT') {
        state.existTreeBonus[node.StatType] += node.Value
      }
      if (!(nextOrder in state.nodeReachedAt)) state.nodeReachedAt[nextOrder] = state.timeSec
    }
  }
}

function onKill() {
  const cfg = getStageConfig(state.stage)
  state.currencies.gold += cfg.RewardGold
  state.currencies.growthEnergy += cfg.RewardGrowth
  const existGainMult = statValue('EXIST_GAIN', state.statLevels.EXIST_GAIN)
  state.currencies.exist += Math.floor(cfg.RewardExist * existGainMult)
  if (cfg.RewardTimeEnergy > 0) state.currencies.timeEnergy += cfg.RewardTimeEnergy

  spendGrowthEnergyGreedy()
  spendExistGreedy()

  state.kills += 1
  if (state.kills >= cfg.KillCount) {
    // 스테이지 클리어 — 최초 클리어면 다이아 지급.
    if (state.stage > state.maxClearedStage) {
      const diamond = cfg.FirstClearDiamond ?? 0
      state.currencies.diamond += diamond
      state.totalFirstClearDiamond += diamond
      state.maxClearedStage = state.stage
      if (!(state.stage in state.stageReachedAt)) state.stageReachedAt[state.stage] = state.timeSec
    }
    state.stage += 1
    state.kills = 0
    state.currentEnemyHp = getStageConfig(state.stage).EnemyHp
  } else {
    state.currentEnemyHp = cfg.EnemyHp
  }
}

// ---- 메인 루프 — 킬 단위 이벤트 시뮬레이션 ----
let nextCheckpointMin = 5
while (state.timeSec < MAX_SIM_SECONDS) {
  const currentDps = dps()
  const timeToKill = state.currentEnemyHp / currentDps
  state.timeSec += timeToKill
  onKill()

  while (state.timeSec / 60 >= nextCheckpointMin) {
    state.diamondAt[nextCheckpointMin] = {
      diamond: Math.floor(state.currencies.diamond),
      pulls: Math.floor(state.currencies.diamond / gachaCost),
      stage: state.stage,
      unlockedCount: state.unlockedCount,
      // 참고용 — 이 시점에 리버스를 실행한다면 별도로 받는 다이아(RebirthRewardTable,
      // 최초 클리어 다이아와는 별개 수급원). 실제로 리버스를 실행하지는 않는다.
      rebirthDiamondIfExecutedNow: rebirthDiamondReward(state.stage),
    }
    nextCheckpointMin += 5
  }

  // 사실상 진행이 멈춘 경우(DPS가 HP 대비 너무 느려져 한 마리 죽이는 데 몇 시간씩
  // 걸리는 경우) 무한루프 방지.
  if (timeToKill > MAX_SIM_SECONDS) break
}

// ---- 리포트 출력 ----
function fmtTime(sec) {
  if (sec === undefined || sec === null) return '도달 못함'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}분 ${s}초`
}

console.log('=== 노드 도달 시간 ===')
for (const order of [1, 5, 15, 33, 50]) {
  console.log(`노드 ${order}: ${fmtTime(state.nodeReachedAt[order])}`)
}
console.log(`리버스 해금(15노드+비용): ${fmtTime(state.reverseUnlockedAt)}`)
console.log(`타임 하이스트 해금(33노드+비용): ${fmtTime(state.timeHeistUnlockedAt)}`)

console.log('\n=== 스테이지 도달(최초 클리어) 시간 ===')
for (const stage of [10, 50, 100]) {
  console.log(`스테이지 ${stage}: ${fmtTime(state.stageReachedAt[stage])}`)
}

console.log('\n=== 시간대별 다이아/가챠 ===')
for (const min of [20, 40, 60]) {
  const snap = state.diamondAt[min]
  if (!snap) {
    console.log(`${min}분: 시뮬레이션이 여기까지 도달하지 못함(총 ${Math.floor(state.timeSec / 60)}분 진행)`)
  } else {
    console.log(
      `${min}분: 다이아 ${snap.diamond} (가챠 ${snap.pulls}회 가능) / 스테이지 ${snap.stage} / 노드 ${snap.unlockedCount}` +
        ` / 참고: 지금 리버스하면 +${snap.rebirthDiamondIfExecutedNow}다이아 별도`,
    )
  }
}

console.log(`\n최종(${(state.timeSec / 60).toFixed(1)}분): 스테이지 ${state.stage}, 노드 ${state.unlockedCount}, 다이아 ${Math.floor(state.currencies.diamond)}, 최초클리어 누적다이아 ${state.totalFirstClearDiamond}`)
