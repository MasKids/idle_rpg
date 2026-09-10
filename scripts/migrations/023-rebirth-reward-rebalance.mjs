// 1회성 마이그레이션: 최초 클리어 다이아 보상 신설(마이그레이션 021)에 맞춰
// RebirthRewardTable 지급량을 하향 조정한다 — 두 수급원(최초 클리어 + 리버스)이
// 합쳐지면 과해지므로, 리버스 보상을 대략 절반으로 줄여 균형을 맞춘다. 구간
// 경계(StageFrom/StageTo)나 다른 칼럼(RefundBonusPerPoint 등)은 그대로 둔다.
//
// 실행: node scripts/migrations/023-rebirth-reward-rebalance.mjs
// 재실행 방지 없음(튜닝 중 반복 실행 전제) — 항상 최초 시딩값을 기준으로 다시
// 계산한다.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

// 원본(마이그레이션 전) 지급량 — 재실행해도 항상 이 값을 기준으로 배율을 다시 적용.
const ORIGINAL_DIAMOND_REWARD = { 1: 1200, 2: 2000, 3: 3500, 4: 6000, 5: 10000 }
const REBALANCE_MULTIPLIER = 0.5

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const ws = workbook.getWorksheet('RebirthRewardTable')
  if (!ws) throw new Error('RebirthRewardTable 시트를 찾지 못했습니다.')

  const engRow = ws.getRow(4)
  let indexCol = -1
  let diamondCol = -1
  for (let c = 1; c <= ws.columnCount; c++) {
    const v = engRow.getCell(c).value
    if (v === 'Index') indexCol = c
    if (v === 'DiamondReward') diamondCol = c
  }
  if (indexCol < 0 || diamondCol < 0) throw new Error('Index/DiamondReward 칼럼을 찾지 못했습니다.')

  const lastRow = ws.lastRow.number
  for (let r = 5; r <= lastRow; r++) {
    const row = ws.getRow(r)
    const index = row.getCell(indexCol).value
    const original = ORIGINAL_DIAMOND_REWARD[index]
    if (original === undefined) continue
    const newValue = Math.round(original * REBALANCE_MULTIPLIER)
    const oldValue = row.getCell(diamondCol).value
    row.getCell(diamondCol).value = newValue
    console.log(`  구간${index}: ${oldValue} → ${newValue}`)
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] RebirthRewardTable.DiamondReward 재조정 완료(배율 ${REBALANCE_MULTIPLIER}).`)
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
