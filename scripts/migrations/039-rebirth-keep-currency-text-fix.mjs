// 1회성 마이그레이션: 리버스 모달의 "유지" 섹션이 "존재력(EXIST), 시간에너지
// 보유량"이라고 안내하고 있었는데, 이번에 EXIST도 리버스 시 초기화되도록
// 바뀌면서(038 마이그레이션 + gameStore.ts) 더 이상 사실이 아니게 됐다.
// 시간에너지만 유지된다고 고친다(StringTable Id 41014).
//
// 실행: node scripts/migrations/039-rebirth-keep-currency-text-fix.mjs
// 재실행 방지: 이미 "시간에너지 보유량"이면 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')
const DATA_START_ROW = 5
const TARGET_ID = 41014
const NEW_TEXT = '시간에너지 보유량'

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] 오류: ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)
  const ws = workbook.getWorksheet('StringTable')
  if (!ws) {
    console.error('[migration] 오류: StringTable 시트를 찾지 못했습니다.')
    process.exit(1)
  }

  const engRow = ws.getRow(4)
  const cols = {}
  for (let c = 1; c <= ws.columnCount; c++) {
    const eng = engRow.getCell(c).value
    if (eng) cols[String(eng)] = c
  }

  let targetRow = -1
  for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
    if (ws.getRow(r).getCell(cols.Id).value === TARGET_ID) {
      targetRow = r
      break
    }
  }

  if (targetRow === -1) {
    console.error(`[migration] 오류: StringTable Id=${TARGET_ID}를 찾지 못했습니다.`)
    process.exit(1)
  }

  const row = ws.getRow(targetRow)
  if (row.getCell(cols.KOR).value === NEW_TEXT) {
    console.log('[migration] 이미 적용됨 — 건너뜁니다.')
    return
  }

  row.getCell(cols.KOR).value = NEW_TEXT
  row.getCell(cols.ENG).value = NEW_TEXT

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] StringTable#${TARGET_ID}: "${NEW_TEXT}"로 수정 완료.`)
  console.log('[migration] 다음: npm run balance')
}

main()
