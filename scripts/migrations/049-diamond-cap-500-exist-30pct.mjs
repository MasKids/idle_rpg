// 1회성 마이그레이션:
// 1. StageTable.FirstClearDiamond — 최고값(스테이지300, 8748)이 정확히 500이
//    되도록 전체 컬럼에 균일 배율(500/8748)을 적용해 "스테이지 클리어당 다이아가
//    많아야 500을 넘지 않게" 만든다. 상대적 곡선 모양(챕터별/보스 배율)은 그대로
//    유지 — RebirthRewardTable(리버스 보상)은 "스테이지 클리어당" 보상이 아니라
//    별개의 일괄 지급이라 이번 요청 범위 밖으로 보고 건드리지 않았다.
// 2. StageTable.RewardExist — 전체 컬럼에 ×0.3 적용(기존의 약 30%만 획득).
//
// 실행: node scripts/migrations/049-diamond-cap-500-exist-30pct.mjs
// 재실행 방지 없음 — 항상 "실행 시점의 현재 값" 기준으로 다시 계산한다.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

async function scaleColumnToTargetMax(workbook, sheetName, columnName, targetMax) {
  const ws = workbook.getWorksheet(sheetName)
  if (!ws) throw new Error(`${sheetName} 시트를 찾지 못했습니다.`)
  const engRow = ws.getRow(4)
  let col = -1
  for (let c = 1; c <= ws.columnCount; c++) {
    if (engRow.getCell(c).value === columnName) col = c
  }
  if (col < 0) throw new Error(`${sheetName}에서 ${columnName} 칼럼을 찾지 못했습니다.`)

  const lastRow = ws.lastRow.number
  let currentMax = -Infinity
  for (let r = 5; r <= lastRow; r++) {
    const v = ws.getRow(r).getCell(col).value
    if (typeof v === 'number' && v > currentMax) currentMax = v
  }
  const scale = targetMax / currentMax

  let count = 0
  for (let r = 5; r <= lastRow; r++) {
    const cell = ws.getRow(r).getCell(col)
    const oldValue = cell.value
    if (typeof oldValue !== 'number') continue
    cell.value = Math.round(oldValue * scale)
    count += 1
  }
  console.log(`[migration] ${sheetName}.${columnName}: ${count}행, 최댓값 ${currentMax} → ${targetMax}(배율 ${scale.toFixed(6)})`)
}

async function scaleColumn(workbook, sheetName, columnName, multiplier) {
  const ws = workbook.getWorksheet(sheetName)
  if (!ws) throw new Error(`${sheetName} 시트를 찾지 못했습니다.`)
  const engRow = ws.getRow(4)
  let col = -1
  for (let c = 1; c <= ws.columnCount; c++) {
    if (engRow.getCell(c).value === columnName) col = c
  }
  if (col < 0) throw new Error(`${sheetName}에서 ${columnName} 칼럼을 찾지 못했습니다.`)

  const lastRow = ws.lastRow.number
  let count = 0
  for (let r = 5; r <= lastRow; r++) {
    const cell = ws.getRow(r).getCell(col)
    const oldValue = cell.value
    if (typeof oldValue !== 'number') continue
    cell.value = Math.round(oldValue * multiplier)
    count += 1
  }
  console.log(`[migration] ${sheetName}.${columnName}: ${count}행에 ×${multiplier} 적용`)
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  await scaleColumnToTargetMax(workbook, 'StageTable', 'FirstClearDiamond', 500)
  await scaleColumn(workbook, 'StageTable', 'RewardExist', 0.3)

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] 완료. 이제 `npm run balance`를 실행하세요.')
}

main()
