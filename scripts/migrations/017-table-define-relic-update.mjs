// 1회성 마이그레이션: RelicTable에 DescStringId 칼럼이 신설된 것에 맞춰
// #TableDefine을 갱신한다(3단계 StringTable 확장 마무리).
//
// 실행: node scripts/migrations/017-table-define-relic-update.mjs
// 재실행 방지: #TableDefine에 RelicTable.DescStringId 행이 이미 있으면 건너뜀.

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

  const alreadyDone = rows.some((r) => r[0] === 'RelicTable' && r[2] === 'DescStringId')
  if (alreadyDone) {
    console.log('[migration] #TableDefine에 RelicTable.DescStringId 정의가 이미 있습니다 — 건너뜁니다.')
    return
  }

  const insertIndex = rows.findIndex((r) => r[0] === 'RelicTable' && r[2] === 'EffectType')
  if (insertIndex === -1) throw new Error('RelicTable.EffectType 정의 행을 찾지 못했습니다.')

  const newCol = ['RelicTable', '설명ID', 'DescStringId', 'int', '3단계 StringTable 확장으로 신설', 'StringTable/Id']
  const finalRows = [...rows.slice(0, insertIndex), newCol, ...rows.slice(insertIndex)]

  defineWs.spliceRows(1, rows.length, ...finalRows)
  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] #TableDefine: RelicTable.DescStringId 정의 추가.')
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
