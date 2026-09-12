// ⚠️ 1회성 시딩 스크립트(v0.4.0 — 존재력 트리 50→250노드 확장). 기존 1~50번
// 노드 행은 절대 건드리지 않고(엑셀에서 수동 조정됐을 수 있음), 51~250번 노드
// 200행만 ExistTreeTable 끝에 추가한다. FeatureUnlockTable(리버스/타임 하이스트
// 해금 조건)과 RelicSlotTable(유물 슬롯 해금 조건 + 슬롯 수 5→8)도 250 체계에
// 맞춰 함께 조정한다. 값 설계 근거는 scripts/seed/README-exist-tree-250.md 참고.
//
// 재실행 방지: ExistTreeTable 마지막 행의 Order가 이미 250이면 아무것도 하지
// 않고 종료한다.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')
const DATA_START_ROW = 5

// ---------------------------------------------------------------------------
// 250노드 확장 설계
// ---------------------------------------------------------------------------
// 티어 구조: 25티어 × 10노드 (원본 5티어 × 10노드와 같은 "청크 크기"를 유지 —
// 스크롤 중 티어 구분이 나타나는 빈도가 원본과 비슷하게 느껴지도록).
//
// 밴드 형태: 원본 1~50번이 실제로 쓰는 10개 밴드 형태(크기/종류)를 그대로
// "사이클"로 반복한다 — 사이클1(원본, 건드리지 않음) = 노드1~50,
// 사이클2~5(신규) = 노드51~250. 밴드 크기 합은 항상 50이라 사이클 5개 = 250.
//   pos1: STAT 7개, pos2: STAT 3개, pos3: STAT 6개, pos4: GRANT(시간에너지) 4개,
//   pos5: STAT 6개, pos6: GRANT(숙련의 정수) 4개, pos7: STAT 7개,
//   pos8: GRANT(숙련의 정수) 3개, pos9: STAT 6개, pos10: STAT 4개.
// STAT 39개 + GRANT 11개 = 50 → 사이클마다 정확히 원본과 같은 78:22 비율이
// 유지된다("스탯 노드와 재화 지급 노드의 분포 유지" 요구사항).
//
// 스탯 배정: STAT_WHEEL을 사이클마다 한 칸씩 돌려서 배정한다. pos1/pos7은
// 항상 "그 사이클의 대표 스탯"이 되고, 5개 스탯이 사이클마다 순서대로 대표를
// 맡아 25티어 전체에서 공평하게 분포한다(GRANT 위치는 회전하지 않고 고정 —
// 시간에너지/숙련의 정수가 트리 전체에 고르게 흩어지도록).
//
// 값 곡선: 이전 시도(사이클 내내 값을 한 줄로 누적)는 사이클을 거듭할수록
// 구간 증가폭 자체가 눈에 띄게 커져("급격") 요구사항에 어긋났다. 대신 사이클별
// "목표 값 구간"(CYCLE_BASE)을 직접 못박아 두고 그 구간 안에서만 완만하게
// 증가시킨다 — 사이클별 구간 증가량이 거의 일정한 등차수열을 이루도록
// 설계했다(가속 없이 완만하게 커짐). 이전 값보다 낮아지지는 않는다(자연스러운
// 이어짐 보장, MIN_GAP).
//
// 비용 곡선: 50번 노드의 실제 비용(9,927)에서 이어서, 노드당 증가율을
// 1.13(원본 평균 비율)에서 시작해 노드가 늘어날수록 서서히 낮춰(최저 1.02)
// 250번째가 약 6.4억으로 도달 가능한 수준에서 멈추게 했다 — 비율을 고정한
// 채로 200개를 더 이어가면(1.13^200배) 사실상 무한대에 가까운 값이 된다.
// ---------------------------------------------------------------------------

const STAT_WHEEL = ['ATK', 'ASPD', 'CRIT', 'CRIT_DMG', 'EXIST_GAIN']

const SHAPE = [
  { size: 7, kind: 'STAT', offset: 0 },
  { size: 3, kind: 'STAT', offset: 2 },
  { size: 6, kind: 'STAT', offset: 1 },
  { size: 4, kind: 'GRANT', currency: 'TIME_ENERGY' },
  { size: 6, kind: 'STAT', offset: 3 },
  { size: 4, kind: 'GRANT', currency: 'MASTERY_ESSENCE' },
  { size: 7, kind: 'STAT', offset: 0 },
  { size: 3, kind: 'GRANT', currency: 'MASTERY_ESSENCE' },
  { size: 6, kind: 'STAT', offset: 4 },
  { size: 4, kind: 'STAT', offset: 1 },
]
const TIERS_PER_CYCLE = 5
const CYCLES = 5 // 1(원본, 생성 안 함) + 4(신규)
const TOTAL_NODES = 250

// 원본 1~50번의 실제 마지막 값(엑셀에서 그대로 읽은 값 — 여기서 이어받는다)
const LAST_STAT_VALUE = { ATK: 22, ASPD: 24, CRIT: 7, CRIT_DMG: 10, EXIST_GAIN: 9 }
const STAT_CYCLE_BASE = { 1: 25, 2: 38, 3: 51, 4: 64 }
const STAT_CYCLE_STEP = { 1: 0.4, 2: 0.45, 3: 0.5, 4: 0.55 }

const LAST_GRANT_VALUE = { TIME_ENERGY: 14, MASTERY_ESSENCE: 44 }
const GRANT_CYCLE_BASE = {
  TIME_ENERGY: { 1: 16, 2: 22, 3: 28, 4: 34 },
  MASTERY_ESSENCE: { 1: 48, 2: 58, 3: 68, 4: 78 },
}
const GRANT_CYCLE_STEP = { TIME_ENERGY: 0.5, MASTERY_ESSENCE: 1 }
const MIN_GAP = 1

function buildNewNodes() {
  const lastStat = { ...LAST_STAT_VALUE }
  const lastGrant = { ...LAST_GRANT_VALUE }
  const nodes = []
  let order = 51

  for (let cycle = 1; cycle < CYCLES; cycle++) {
    for (let posIdx = 0; posIdx < SHAPE.length; posIdx++) {
      const band = SHAPE[posIdx]
      const tier = 1 + cycle * TIERS_PER_CYCLE + Math.floor(posIdx / 2)

      if (band.kind === 'GRANT') {
        const currency = band.currency
        const step = GRANT_CYCLE_STEP[currency]
        let v = Math.max(GRANT_CYCLE_BASE[currency][cycle], lastGrant[currency] + MIN_GAP)
        for (let i = 0; i < band.size; i++) {
          nodes.push({ order, tier, effectType: 'GRANT', statType: '', grantCurrency: currency, value: Math.round(v * 100) / 100 })
          lastGrant[currency] = v
          v += step
          order++
        }
        continue
      }

      const stat = STAT_WHEEL[(band.offset + cycle) % 5]
      const step = STAT_CYCLE_STEP[cycle]
      let v = Math.max(STAT_CYCLE_BASE[cycle], lastStat[stat] + MIN_GAP)
      for (let i = 0; i < band.size; i++) {
        nodes.push({ order, tier, effectType: 'STAT', statType: stat, grantCurrency: '', value: Math.round(v * 100) / 100 })
        lastStat[stat] = v
        v += step
        order++
      }
    }
  }

  if (order - 1 !== TOTAL_NODES) throw new Error(`내부 오류: 마지막 order가 ${order - 1}, 기대값 250`)
  return nodes
}

function buildCostCurve(lastKnownCost) {
  const costs = new Map()
  let cost = lastKnownCost
  for (let order = 51; order <= TOTAL_NODES; order++) {
    const delta = order - 50
    const rate = Math.max(1.02, 1.13 - 0.0008 * delta)
    cost = Math.floor(cost * rate)
    costs.set(order, cost)
  }
  return costs
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[seed] 오류: ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const ws = workbook.getWorksheet('ExistTreeTable')
  if (!ws) {
    console.error('[seed] 오류: ExistTreeTable 시트를 찾지 못했습니다.')
    process.exit(1)
  }

  const engRow = ws.getRow(4)
  const cols = {}
  for (let c = 1; c <= ws.columnCount; c++) {
    const v = engRow.getCell(c).value
    if (v) cols[String(v)] = c
  }

  const lastDataRow = DATA_START_ROW + 49 // order 1~50 = row 5~54
  const lastOrder = ws.getRow(lastDataRow).getCell(cols.Order).value
  if (lastOrder === 250) {
    console.log('[seed] ExistTreeTable이 이미 250노드로 확장돼 있습니다 — 건너뜁니다.')
    return
  }
  if (lastOrder !== 50) {
    console.error(`[seed] 오류: ${lastDataRow}행의 Order가 50이 아니라 ${lastOrder}입니다 — 예상한 기존 상태(50노드)가 아니라 중단합니다.`)
    process.exit(1)
  }

  const lastKnownCost = ws.getRow(lastDataRow).getCell(cols.Cost).value // 실제 50번 노드 비용(9927)에서 이어간다
  const newNodes = buildNewNodes()
  const costCurve = buildCostCurve(lastKnownCost)

  let rowNum = lastDataRow + 1
  for (const node of newNodes) {
    const row = ws.getRow(rowNum)
    const values = {
      Index: node.order,
      Id: 30000 + node.order,
      Order: node.order,
      Tier: node.tier,
      NameStringId: 0,
      DescStringId: 0,
      EffectType: node.effectType,
      StatType: node.statType,
      GrantCurrency: node.grantCurrency,
      Value: node.value,
      Cost: costCurve.get(node.order),
    }
    for (const [eng, colIndex] of Object.entries(cols)) {
      const cell = row.getCell(colIndex)
      cell.value = values[eng] === '' ? null : values[eng]
      cell.font = { size: 9 }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      }
      cell.alignment =
        typeof values[eng] === 'number' || typeof values[eng] === 'boolean'
          ? { horizontal: 'center', vertical: 'middle' }
          : { horizontal: 'left', vertical: 'middle' }
    }
    rowNum++
  }

  const lastRow = rowNum - 1
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: lastRow, column: Object.keys(cols).length } }

  // ---- FeatureUnlockTable: 리버스/타임 하이스트 해금 조건을 250 체계에 맞게 재조정 ----
  // 새 앵커(20/45)도 기존 1~50번 범위 안이라 노드 비용 자체는 건드리지 않는다.
  // UnlockCost는 노드 비용과 독립적으로 관리되던 값이라(기존 200/1200도 node15=961,
  // node33 비용과 일치하지 않았다) 같은 방식으로 새 앵커에 맞춰 완만히 올렸다.
  const featureWs = workbook.getWorksheet('FeatureUnlockTable')
  if (featureWs) {
    const fEngRow = featureWs.getRow(4)
    const fCols = {}
    for (let c = 1; c <= featureWs.columnCount; c++) {
      const v = fEngRow.getCell(c).value
      if (v) fCols[String(v)] = c
    }
    const FEATURE_UPDATES = {
      REBIRTH: { RequireNodeCount: 20, UnlockCost: 280 },
      TIME_HEIST: { RequireNodeCount: 45, UnlockCost: 1600 },
    }
    for (let r = DATA_START_ROW; r <= featureWs.rowCount; r++) {
      const row = featureWs.getRow(r)
      const featureType = row.getCell(fCols.FeatureType).value
      const update = FEATURE_UPDATES[featureType]
      if (!update) continue
      row.getCell(fCols.RequireNodeCount).value = update.RequireNodeCount
      row.getCell(fCols.UnlockCost).value = update.UnlockCost
    }
  }

  // ---- RelicSlotTable: 슬롯 5개→8개, 간격 10→30으로 확장 ----
  const relicSlotWs = workbook.getWorksheet('RelicSlotTable')
  if (relicSlotWs) {
    const rEngRow = relicSlotWs.getRow(4)
    const rCols = {}
    for (let c = 1; c <= relicSlotWs.columnCount; c++) {
      const v = rEngRow.getCell(c).value
      if (v) rCols[String(v)] = c
    }
    const NEW_SLOTS = [30, 60, 90, 120, 150, 180, 210, 240] // 8슬롯, 30노드 간격
    for (let i = 0; i < NEW_SLOTS.length; i++) {
      const slotIndex = i + 1
      const requireUnlockedCount = NEW_SLOTS[i]
      const targetRow = DATA_START_ROW + i
      const row = relicSlotWs.getRow(targetRow)
      const isNewRow = slotIndex > 5
      const values = { Index: slotIndex, Id: 38100 + slotIndex, SlotIndex: slotIndex, RequireUnlockedCount: requireUnlockedCount }
      for (const [eng, colIndex] of Object.entries(rCols)) {
        const cell = row.getCell(colIndex)
        cell.value = values[eng]
        if (isNewRow) {
          cell.font = { size: 9 }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
          }
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        }
      }
    }
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[seed] ExistTreeTable을 50노드 → 250노드로 확장했습니다(1~50번 원본 유지).')
  console.log(`[seed] node51 비용=${costCurve.get(51)}, node150 비용=${costCurve.get(150)}, node250 비용=${costCurve.get(250)}.`)
  console.log('[seed] FeatureUnlockTable: REBIRTH 15→20노드, TIME_HEIST 33→45노드로 조정.')
  console.log('[seed] RelicSlotTable: 5슬롯(10간격) → 8슬롯(30간격)으로 확장.')
  console.log('[seed] 다음: npm run balance')
}

main()
