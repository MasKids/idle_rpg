// 1회성 마이그레이션: PatchNoteTable v0.2.0의 "무기 장착 효과 밸런스"(FIX) 항목은
// 실제로는 아직 작업 전이었고(v0.3.0 "밸런스 개편"에서 다룰 내용을 착각해 미리
// 적어둔 것) v0.2.0에는 해당하지 않아 제거한다. 함께 추가됐던 StringTable
// 텍스트(Id 55011)도 더 이상 참조되지 않으므로 같이 제거한다.
//
// 실행: node scripts/migrations/030-remove-premature-patch-note.mjs
// 재실행 방지: PatchNoteTable Id 33012가 이미 없으면 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')
const DATA_START_ROW = 5
const PATCH_NOTE_ID_TO_REMOVE = 33012
const STRING_ID_TO_REMOVE = 55011

function findColumns(ws, headerRowNum) {
  const headerRow = ws.getRow(headerRowNum)
  const cols = {}
  for (let c = 1; c <= ws.columnCount; c++) {
    const eng = headerRow.getCell(c).value
    if (eng) cols[String(eng)] = c
  }
  return cols
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] 오류: ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const patchWs = workbook.getWorksheet('PatchNoteTable')
  if (!patchWs) {
    console.error('[migration] 오류: PatchNoteTable 시트를 찾지 못했습니다.')
    process.exit(1)
  }
  const patchCols = findColumns(patchWs, 4)

  let patchRowToRemove = -1
  for (let r = DATA_START_ROW; r <= patchWs.rowCount; r++) {
    if (patchWs.getRow(r).getCell(patchCols.Id).value === PATCH_NOTE_ID_TO_REMOVE) {
      patchRowToRemove = r
      break
    }
  }

  if (patchRowToRemove === -1) {
    console.log('[migration] 이미 제거됨 — 건너뜁니다.')
    return
  }

  patchWs.spliceRows(patchRowToRemove, 1)
  for (let r = DATA_START_ROW; r <= patchWs.rowCount; r++) {
    patchWs.getRow(r).getCell(patchCols.Index).value = r - DATA_START_ROW + 1
  }
  console.log(`[migration] PatchNoteTable에서 Id ${PATCH_NOTE_ID_TO_REMOVE}("무기 장착 효과 밸런스") 제거.`)

  const stringWs = workbook.getWorksheet('StringTable')
  if (!stringWs) {
    console.error('[migration] 오류: StringTable 시트를 찾지 못했습니다.')
    process.exit(1)
  }
  const stringCols = findColumns(stringWs, 4)

  let stringRowToRemove = -1
  for (let r = DATA_START_ROW; r <= stringWs.rowCount; r++) {
    if (stringWs.getRow(r).getCell(stringCols.Id).value === STRING_ID_TO_REMOVE) {
      stringRowToRemove = r
      break
    }
  }

  if (stringRowToRemove !== -1) {
    stringWs.spliceRows(stringRowToRemove, 1)
    for (let r = DATA_START_ROW; r <= stringWs.rowCount; r++) {
      stringWs.getRow(r).getCell(stringCols.Index).value = r - DATA_START_ROW + 1
    }
    console.log(`[migration] StringTable에서 Id ${STRING_ID_TO_REMOVE}("무기 장착 효과 밸런스") 제거.`)
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] 완료. 다음: npm run balance')
}

main()
