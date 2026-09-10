// 1회성 마이그레이션: TimeHeistTable이 1행(공식 계수)→10행(UsedCount별 리터럴)으로
// 바뀐 것에 맞춰 #TableDefine의 TimeHeistTable 정의 블록을 갱신한다(3단계).
//
// 실행: node scripts/migrations/012-table-define-timeheist-update.mjs
// 재실행 방지: #TableDefine에 TimeHeistTable.UsedCount 행이 이미 있으면 건너뜀.

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

  const alreadyUpdated = rows.some((r) => r[0] === 'TimeHeistTable' && r[2] === 'UsedCount')
  if (alreadyUpdated) {
    console.log('[migration] #TableDefine에 TimeHeistTable.UsedCount 정의가 이미 있습니다 — 건너뜁니다.')
    return
  }

  const newTimeHeistBlock = [
    ['TimeHeistTable', '순번', 'Index', 'int', '', ''],
    ['TimeHeistTable', 'ID', 'Id', 'int', '', ''],
    ['TimeHeistTable', '사용 횟수', 'UsedCount', 'int', '0부터 시작, 이 값을 넘는 사용 횟수는 마지막 행 값으로 고정', ''],
    ['TimeHeistTable', '비용(시간에너지)', 'Cost', 'int', '', ''],
    ['TimeHeistTable', '쿨타임(초)', 'CooldownSec', 'float', '', ''],
    ['TimeHeistTable', '보상 배율', 'RewardMultiplier', 'float', '', ''],
    ['TimeHeistTable', '설명', '//Description', 'string', '', ''],
  ]

  // TimeHeistTable 정의가 있던 자리를 찾아 그 자리에 새 블록을 끼워 넣는다.
  const firstOldIndex = rows.findIndex((r) => r[0] === 'TimeHeistTable')
  const before = rows.slice(0, firstOldIndex)
  const afterAll = rows.slice(firstOldIndex).filter((r) => r[0] !== 'TimeHeistTable')

  const newRows = [...before, ...newTimeHeistBlock, ...afterAll]
  defineWs.spliceRows(1, rows.length, ...newRows)

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] #TableDefine: TimeHeistTable 정의를 UsedCount 기반 스키마로 갱신.')
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
