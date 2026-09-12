// 1회성 마이그레이션: 무기 가챠 뽑기 비용을 레벨 무관 다이아 50으로 동결
// (직전 마이그레이션 042에서 40 → 60으로 올렸던 걸 50으로 재조정).
//
// 실행: node scripts/migrations/043-gacha-cost-freeze-50.mjs
// 재실행 방지 없음 — 항상 GachaTable.PullCostDiamond 전 행을 50으로 덮어쓴다.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')
const NEW_COST = 50

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const ws = workbook.getWorksheet('GachaTable')
  if (!ws) throw new Error('GachaTable 시트를 찾지 못했습니다.')

  const engRow = ws.getRow(4)
  let col = -1
  for (let c = 1; c <= ws.columnCount; c++) {
    if (engRow.getCell(c).value === 'PullCostDiamond') col = c
  }
  if (col < 0) throw new Error('GachaTable에서 PullCostDiamond 칼럼을 찾지 못했습니다.')

  const lastRow = ws.lastRow.number
  for (let r = 5; r <= lastRow; r++) {
    const cell = ws.getRow(r).getCell(col)
    const oldValue = cell.value
    cell.value = NEW_COST
    console.log(`  row${r}: ${oldValue} → ${NEW_COST}`)
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] GachaTable.PullCostDiamond 전 레벨 ${NEW_COST}로 동결 완료.`)
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
