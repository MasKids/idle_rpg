// ⚠️ 이미 실행되어 적용된 1회성 시딩 스크립트다(테이블 개편 2단계,
// docs/TABLE_REDESIGN.md 2.2절) — ExistTreeTable을 10개 구간 행에서 50개 노드
// 리터럴 행으로 펼쳤다. seed_balance_xlsx.py와 같은 이유로 scripts/seed/에 둔다:
// 구간→리터럴 변환에 쓰인 공식(BANDS의 CostBase/CostGrowthRate/ValueBase/
// ValuePerNode)을 나중에 다시 참고하거나 재현할 일이 생길 수 있어 보존하는
// 것이지, 평소 파이프라인에서 실행하는 스크립트가 아니다. existTree.ts는 이제
// 이 공식을 쓰지 않고 ExistTreeTable을 조회만 한다.
//
// 재실행 방지: ExistTreeTable에 이미 Order 칼럼이 있으면(=이미 적용됨) 아무것도
// 하지 않고 종료한다.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

const DATA_START_ROW = 5
const HEADER_FILLS = {
  ref: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } },
  kor: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } },
  type: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } },
  eng: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8EA9DB' } },
}
const HEADER_FONTS = {
  ref: { size: 9, color: { argb: 'FF7F6000' } },
  kor: { size: 9, bold: true, color: { argb: 'FFFFFFFF' } },
  type: { size: 9, color: { argb: 'FF1F3864' } },
  eng: { size: 9, bold: true, color: { argb: 'FF1F3864' } },
}
const CENTER = { horizontal: 'center', vertical: 'middle' }
const LEFT = { horizontal: 'left', vertical: 'middle' }
const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
}

function writeDataSheet(workbook, sheetName, columns, rows) {
  const existing = workbook.getWorksheet(sheetName)
  if (existing) workbook.removeWorksheet(existing.id)
  const ws = workbook.addWorksheet(sheetName)

  const headerRows = [columns.map((c) => c.ref), columns.map((c) => c.kor), columns.map((c) => c.type), columns.map((c) => c.eng)]
  const styleKeys = ['ref', 'kor', 'type', 'eng']
  headerRows.forEach((values, rIdx) => {
    const rowNum = rIdx + 1
    const key = styleKeys[rIdx]
    values.forEach((value, cIdx) => {
      const cell = ws.getCell(rowNum, cIdx + 1)
      cell.value = value === '' ? null : value
      cell.fill = HEADER_FILLS[key]
      cell.font = HEADER_FONTS[key]
      cell.alignment = CENTER
      cell.border = THIN_BORDER
    })
  })

  rows.forEach((rowValues, i) => {
    const excelRow = DATA_START_ROW + i
    rowValues.forEach((value, cIdx) => {
      const cell = ws.getCell(excelRow, cIdx + 1)
      cell.value = value
      cell.font = { size: 9 }
      cell.border = THIN_BORDER
      cell.alignment = typeof value === 'number' || typeof value === 'boolean' ? CENTER : LEFT
    })
  })

  ws.views = [{ state: 'frozen', ySplit: 4 }]
  const lastRow = 4 + rows.length
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: lastRow, column: columns.length } }
  columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = Math.max(10, col.eng.length + 2, col.kor.length * 1.8 + 2)
  })
  return ws
}

// ---- 현재 ExistTreeTable(10개 구간) 값 그대로 복제한 공식 — existTree.ts의
// nodeCost()/nodeValue()/tierOf()/laneOf()/effectFor()와 동일 ----
const BANDS = [
  { tier: 1, from: 1, to: 7, effectType: 'STAT', statType: 'ATK', grantCurrency: '', valueBase: 5, valuePerNode: 0.6, costBase: 12, costGrowthRate: 1.13 },
  { tier: 1, from: 8, to: 10, effectType: 'STAT', statType: 'CRIT', grantCurrency: '', valueBase: 2, valuePerNode: 0.6, costBase: 28, costGrowthRate: 1.13 },
  { tier: 2, from: 11, to: 16, effectType: 'STAT', statType: 'ASPD', grantCurrency: '', valueBase: 0.8, valuePerNode: 0.15, costBase: 40, costGrowthRate: 1.13 },
  { tier: 2, from: 17, to: 20, effectType: 'GRANT', statType: '', grantCurrency: 'TIME_ENERGY', valueBase: 8, valuePerNode: 2, costBase: 84, costGrowthRate: 1.13 },
  { tier: 3, from: 21, to: 26, effectType: 'STAT', statType: 'CRIT_DMG', grantCurrency: '', valueBase: 10, valuePerNode: 1, costBase: 138, costGrowthRate: 1.13 },
  { tier: 3, from: 27, to: 30, effectType: 'GRANT', statType: '', grantCurrency: 'MASTERY_ESSENCE', valueBase: 31, valuePerNode: 1, costBase: 287, costGrowthRate: 1.13 },
  { tier: 4, from: 31, to: 37, effectType: 'STAT', statType: 'ATK', grantCurrency: '', valueBase: 23, valuePerNode: 0.6, costBase: 469, costGrowthRate: 1.13 },
  { tier: 4, from: 38, to: 40, effectType: 'GRANT', statType: '', grantCurrency: 'MASTERY_ESSENCE', valueBase: 42, valuePerNode: 1, costBase: 1104, costGrowthRate: 1.13 },
  { tier: 5, from: 41, to: 46, effectType: 'STAT', statType: 'EXIST_GAIN', grantCurrency: '', valueBase: 29, valuePerNode: 0.6, costBase: 1593, costGrowthRate: 1.13 },
  { tier: 5, from: 47, to: 50, effectType: 'STAT', statType: 'ASPD', grantCurrency: '', valueBase: 6.2, valuePerNode: 0.15, costBase: 3317, costGrowthRate: 1.13 },
]
function bandOf(order) {
  return BANDS.find((b) => order >= b.from && order <= b.to)
}
function nodeCost(order) {
  const b = bandOf(order)
  return Math.floor(b.costBase * b.costGrowthRate ** (order - b.from))
}
function nodeValue(order) {
  const b = bandOf(order)
  return b.valueBase + (order - b.from) * b.valuePerNode
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const existing = workbook.getWorksheet('ExistTreeTable')
  if (existing) {
    const engRow = existing.getRow(4)
    const hasOrderColumn = Array.from({ length: existing.columnCount }, (_, i) => engRow.getCell(i + 1).value).includes('Order')
    if (hasOrderColumn) {
      console.log('[migration] ExistTreeTable에 이미 Order 칼럼이 있습니다 — 이미 적용된 것으로 보고 건너뜁니다.')
      return
    }
  }

  const columns = [
    { ref: '', kor: '순번', type: 'int', eng: 'Index' },
    { ref: '', kor: 'ID', type: 'int', eng: 'Id' },
    { ref: '', kor: '노드 순번', type: 'int', eng: 'Order' },
    { ref: '', kor: '티어', type: 'int', eng: 'Tier' },
    { ref: 'StringTable/Id', kor: '이름ID', type: 'int', eng: 'NameStringId' },
    { ref: 'StringTable/Id', kor: '설명ID', type: 'int', eng: 'DescStringId' },
    { ref: 'EnumDefine/NodeEffectType', kor: '효과 종류', type: 'enum', eng: 'EffectType' },
    { ref: 'EnumDefine/StatType', kor: '스탯 종류', type: 'enum', eng: 'StatType' },
    { ref: 'EnumDefine/CurrencyType', kor: '지급 재화', type: 'enum', eng: 'GrantCurrency' },
    { ref: '', kor: '효과값', type: 'float', eng: 'Value' },
    { ref: '', kor: '해금 비용(존재력)', type: 'int', eng: 'Cost' },
  ]

  const rows = []
  for (let order = 1; order <= 50; order++) {
    const b = bandOf(order)
    rows.push([
      order, // Index
      30000 + order, // Id — 기존 구간 행(30001~30010)과 겹치지 않게 30xxx를 order 기준으로 재부여
      order, // Order
      b.tier, // Tier
      0, // NameStringId — 노드 이름 미확정, 0=자동생성("T{tier}-{n}") 폴백 사용
      0, // DescStringId — 노드 설명 아직 없음
      b.effectType,
      b.statType,
      b.grantCurrency,
      Math.round(nodeValue(order) * 100) / 100, // 부동소수 오차 방지
      nodeCost(order),
    ])
  }

  writeDataSheet(workbook, 'ExistTreeTable', columns, rows)

  // FeatureUnlockTable.UnlockCost 보정 — 기존엔 Python의 연속 공식(node_cost(order) =
  // floor(12*1.13^(order-1)))으로 따로 계산돼 있었는데, 실제 게임이 쓰는 값(구간별로
  // 이미 floor된 CostBase에서부터 이어서 compounding)과 order=15/33에서 1만큼
  // 어긋나 있었다(65≠66, 598≠599) — 구간 경계에서 두 번 floor되며 생기는 오차.
  // 이제 ExistTreeTable 리터럴 값이 유일한 진실이므로 여기 맞춰 바로잡는다.
  const featureWs = workbook.getWorksheet('FeatureUnlockTable')
  if (featureWs) {
    const engRow = featureWs.getRow(4)
    let featureTypeCol = -1
    let unlockCostCol = -1
    let requireNodeCountCol = -1
    for (let c = 1; c <= featureWs.columnCount; c++) {
      const v = engRow.getCell(c).value
      if (v === 'FeatureType') featureTypeCol = c
      if (v === 'UnlockCost') unlockCostCol = c
      if (v === 'RequireNodeCount') requireNodeCountCol = c
    }
    if (featureTypeCol > 0 && unlockCostCol > 0 && requireNodeCountCol > 0) {
      const lastRow = featureWs.lastRow ? featureWs.lastRow.number : 4
      for (let r = 5; r <= lastRow; r++) {
        const requireNodeCount = featureWs.getRow(r).getCell(requireNodeCountCol).value
        const correctCost = nodeCost(requireNodeCount)
        const oldCost = featureWs.getRow(r).getCell(unlockCostCol).value
        if (oldCost !== correctCost) {
          console.log(`[migration] FeatureUnlockTable 행 ${r} UnlockCost 보정: ${oldCost} → ${correctCost} (RequireNodeCount=${requireNodeCount})`)
          featureWs.getRow(r).getCell(unlockCostCol).value = correctCost
        }
      }
    }
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] ExistTreeTable을 10개 구간 행 → 50개 노드 리터럴 행으로 확장했습니다.`)
  console.log(`[migration] node15 비용=${nodeCost(15)}, node33 비용=${nodeCost(33)}.`)
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
