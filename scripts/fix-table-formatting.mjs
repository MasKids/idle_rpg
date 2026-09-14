// 1회성 정리 스크립트: append-row.mjs/마이그레이션 스크립트로 새 행을 추가할 때
// 스타일(글꼴/정렬/테두리/채우기)을 복사해오지 않아서, 원래 스타일이 있던 표
// 아래에 서식 없는 빈 셀({})로 행이 추가돼온 문제를 정리한다.
//
// 방식: 시트별로 데이터 행(5행~)을 위에서부터 훑으며, 칼럼별로 "가장 최근에
// 스타일이 있던 셀"을 기억해뒀다가, 스타일이 비어있는({} — font/alignment/
// border/fill이 전부 없음) 셀을 만나면 그 스타일을 그대로 복사해 채운다(forward-fill).
// 값은 절대 건드리지 않는다 — style만 복사.
//
// 실행: node scripts/fix-table-formatting.mjs

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../balance/balance.xlsx')
const DATA_START_ROW = 5

function isEmptyStyle(cell) {
  const hasFont = cell.font && Object.keys(cell.font).length > 0
  const hasAlignment = cell.alignment && Object.keys(cell.alignment).length > 0
  const hasBorder = cell.border && Object.keys(cell.border).length > 0
  const hasFill = cell.fill && cell.fill.pattern && cell.fill.pattern !== 'none'
  return !hasFont && !hasAlignment && !hasBorder && !hasFill
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[fix-formatting] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  let totalFixed = 0
  for (const ws of workbook.worksheets) {
    if (ws.name.startsWith('#')) continue
    const lastRow = ws.lastRow ? ws.lastRow.number : 0
    if (lastRow < DATA_START_ROW) continue

    const lastCol = ws.columnCount
    const templateStyle = new Array(lastCol + 1).fill(null)
    let fixedInSheet = 0

    for (let r = DATA_START_ROW; r <= lastRow; r++) {
      const row = ws.getRow(r)
      for (let c = 1; c <= lastCol; c++) {
        const cell = row.getCell(c)
        if (!isEmptyStyle(cell)) {
          templateStyle[c] = { font: cell.font, alignment: cell.alignment, border: cell.border, fill: cell.fill, numFmt: cell.numFmt }
        } else if (templateStyle[c]) {
          const t = templateStyle[c]
          if (t.font) cell.font = t.font
          if (t.alignment) cell.alignment = t.alignment
          if (t.border) cell.border = t.border
          if (t.fill) cell.fill = t.fill
          if (t.numFmt) cell.numFmt = t.numFmt
          fixedInSheet += 1
        }
      }
    }
    if (fixedInSheet > 0) {
      console.log(`[fix-formatting] ${ws.name}: 셀 ${fixedInSheet}개 서식 보정`)
      totalFixed += fixedInSheet
    }
  }

  if (totalFixed === 0) {
    console.log('[fix-formatting] 보정할 셀이 없습니다.')
    return
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[fix-formatting] 완료 — 총 ${totalFixed}개 셀 서식 보정.`)
}

main()
