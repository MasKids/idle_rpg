// 1회성 마이그레이션: RebirthTable 삭제에 맞춰 #TableDefine 갱신(3단계).
// RebirthTable 정의 블록 제거, RebirthRewardTable 정의에 새 칼럼 2개 추가.
//
// 실행: node scripts/migrations/014-table-define-rebirth-update.mjs
// 재실행 방지: #TableDefine에 RebirthTable 행이 없고 RebirthRewardTable에
// RefundBonusPerPoint 행이 있으면 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const defineWs = workbook.getWorksheet('#TableDefine')
  if (!defineWs) throw new Error('#TableDefine 시트를 찾지 못했습니다.')

  const rows = []
  for (let r = 1; r <= defineWs.rowCount; r++) {
    const row = defineWs.getRow(r)
    const vals = []
    for (let c = 1; c <= defineWs.columnCount; c++) vals.push(row.getCell(c).value)
    rows.push(vals)
  }

  const hasRebirthTable = rows.some((r) => r[0] === 'RebirthTable')
  const hasNewRewardCols = rows.some((r) => r[0] === 'RebirthRewardTable' && r[2] === 'RefundBonusPerPoint')
  if (!hasRebirthTable && hasNewRewardCols) {
    console.log('[migration] #TableDefine이 이미 갱신되어 있습니다 — 건너뜁니다.')
    return
  }

  // RebirthTable 정의 제거
  const withoutRebirthTable = rows.filter((r) => r[0] !== 'RebirthTable')

  // RebirthRewardTable 정의 끝(=//Description 행) 바로 앞에 새 칼럼 2개 삽입
  const insertIndex = withoutRebirthTable.findIndex((r) => r[0] === 'RebirthRewardTable' && r[2] === '//Description')
  const newCols = [
    ['RebirthRewardTable', '포인트당 환급 증폭률', 'RefundBonusPerPoint', 'float', 'RebirthTable 삭제로 흡수 — 구간별 동일값 반복', ''],
    ['RebirthRewardTable', '환급 배율 상한', 'MaxRefundMultiplier', 'float', 'RebirthTable 삭제로 흡수 — 구간별 동일값 반복', ''],
  ]
  const finalRows =
    insertIndex === -1
      ? withoutRebirthTable
      : [...withoutRebirthTable.slice(0, insertIndex), ...newCols, ...withoutRebirthTable.slice(insertIndex)]

  defineWs.spliceRows(1, rows.length, ...finalRows)
  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] #TableDefine: RebirthTable 정의 제거, RebirthRewardTable에 칼럼 2개 추가.')
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
