// 1회성 마이그레이션: #EnumDefine에 EffectValueType(깡스탯/퍼센트) 그룹 추가 —
// RelicTable.EffectValueType(migration 033)이 참조하는 enum 정의.
//
// 실행: node scripts/migrations/034-enum-define-effect-value-type.mjs
// 재실행 방지: EffectValueType 그룹이 이미 있으면 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

const ENUM_ROWS = [
  ['EffectValueType', '깡스탯', 'FLAT', 'RelicTable.EffectValueType'],
  ['EffectValueType', '퍼센트', 'PERCENT', 'RelicTable.EffectValueType'],
]

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] 오류: ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)
  const ws = workbook.getWorksheet('#EnumDefine')
  if (!ws) {
    console.error('[migration] 오류: #EnumDefine 시트를 찾지 못했습니다.')
    process.exit(1)
  }

  for (let r = 1; r <= ws.rowCount; r++) {
    if (ws.getRow(r).getCell(1).value === 'EffectValueType') {
      console.log('[migration] 이미 적용됨 — 건너뜁니다.')
      return
    }
  }

  let rowNum = ws.rowCount + 1
  for (const values of ENUM_ROWS) {
    const row = ws.getRow(rowNum)
    values.forEach((v, i) => {
      row.getCell(i + 1).value = v
    })
    rowNum += 1
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] #EnumDefine에 EffectValueType(깡스탯/퍼센트) 추가 완료.')
}

main()
