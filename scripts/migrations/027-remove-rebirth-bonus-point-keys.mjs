// 1회성 마이그레이션: 포인트 누적 기반 환급 배율 공식(RebirthBonusBase/
// RebirthBonusExponent)이 리버스 횟수 기반 배율로 교체되며 더 이상 쓰이지 않아
// CommonTable에서 두 행을 제거한다.
//
// 실행: node scripts/migrations/027-remove-rebirth-bonus-point-keys.mjs
// 재실행 방지: 두 Key가 이미 없으면 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')
const DATA_START_ROW = 5
const KEYS_TO_REMOVE = ['RebirthBonusBase', 'RebirthBonusExponent']

async function main() {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)
  const ws = workbook.getWorksheet('CommonTable')

  const engRow = ws.getRow(4)
  let keyCol = -1
  for (let c = 1; c <= ws.columnCount; c++) {
    if (engRow.getCell(c).value === 'Key') keyCol = c
  }

  const rowsToRemove = []
  for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
    const key = ws.getRow(r).getCell(keyCol).value
    if (KEYS_TO_REMOVE.includes(key)) rowsToRemove.push(r)
  }

  if (rowsToRemove.length === 0) {
    console.log('[migration] 이미 제거됨 — 건너뜁니다.')
    return
  }

  // 뒤에서부터 지워야 앞쪽 행 번호가 밀리지 않는다.
  rowsToRemove.sort((a, b) => b - a)
  for (const r of rowsToRemove) ws.spliceRows(r, 1)

  // Index 칼럼(1) 재정렬 — 순번이 비면 어색하므로 1부터 다시 채운다.
  for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
    ws.getRow(r).getCell(1).value = r - DATA_START_ROW + 1
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] CommonTable에서 ${rowsToRemove.length}개 행 제거: ${KEYS_TO_REMOVE.join(', ')}`)
}

main()
