// 1회성 마이그레이션: TimeHeistTable을 1행(공식 계수)에서 10행(UsedCount 0~9별
// 리터럴 값)으로 펼친다(3단계, docs/TABLE_REDESIGN.md 3.1절) — 비용/쿨타임/
// 보상배율을 사용 횟수별로 개별 조정할 수 있게 하기 위함.
//
// Cost(UsedCount) = floor(20 × 2^UsedCount) — 원래 공식과 완전히 동일(2의 거듭제곱이라
//   floor에 걸리는 지점이 없음).
// CooldownSec(UsedCount) = 900 × 1.5^UsedCount — 정수가 아닐 수 있어 float로 저장한다.
//   기존 코드가 이 값을 *1000 한 뒤 floor(ms 단위)했으므로, 여기서 미리 반올림하면
//   floor 순서가 바뀌어 결과가 달라진다 — float 그대로 저장하고 floor는 여전히
//   timeHeist.ts가 ms 변환 시점에 한다.
// RewardMultiplier는 원래 UsedCount와 무관한 상수(5)였지만, 사용자가 "개별 조정
//   가능하게" 요청했으므로 10행 모두에 같은 값을 반복 기입한다(다른 테이블들과
//   동일한 "의도적 중복" 패턴).
// TargetStageOffset은 UsedCount와 무관하게 항상 고정값이라 CommonTable로 옮긴다
//   (append-row.mjs로 이미 추가함, TimeHeistTargetStageOffset=10).
//
// 실행: node scripts/migrations/011-time-heist-table-expansion.mjs
// 재실행 방지: TimeHeistTable에 이미 UsedCount 칼럼이 있으면 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

const DATA_START_ROW = 5
const HEADER_FILLS = {
  ref: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } },
  kor: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } },
  type: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } },
  eng: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8EA9DB' } },
}
const HEADER_FONTS = {
  ref: { size: 9, color: { argb: 'FF7F6000' } },
  kor: { size: 9, bold: true, color: { argb: 'FFFFFFFF' } },
  type: { size: 9, color: { argb: 'FF1F3864' } },
  eng: { size: 9, bold: true, color: { argb: 'FF1F3864' } },
}
const CENTER = { horizontal: 'center', vertical: 'middle' }
const LEFT = { horizontal: 'left', vertical: 'middle' }
const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
}

function writeDataSheet(workbook, sheetName, columns, rows) {
  const existing = workbook.getWorksheet(sheetName)
  if (existing) workbook.removeWorksheet(existing.id)
  const ws = workbook.addWorksheet(sheetName)
  const headerRows = [columns.map((c) => c.ref), columns.map((c) => c.kor), columns.map((c) => c.type), columns.map((c) => c.eng)]
  const styleKeys = ['ref', 'kor', 'type', 'eng']
  headerRows.forEach((values, rIdx) => {
    const rowNum = rIdx + 1
    const key = styleKeys[rIdx]
    values.forEach((value, cIdx) => {
      const cell = ws.getCell(rowNum, cIdx + 1)
      cell.value = value === '' ? null : value
      cell.fill = HEADER_FILLS[key]
      cell.font = HEADER_FONTS[key]
      cell.alignment = CENTER
      cell.border = THIN_BORDER
    })
  })
  rows.forEach((rowValues, i) => {
    const excelRow = DATA_START_ROW + i
    rowValues.forEach((value, cIdx) => {
      const cell = ws.getCell(excelRow, cIdx + 1)
      cell.value = value
      cell.font = { size: 9 }
      cell.border = THIN_BORDER
      cell.alignment = typeof value === 'number' || typeof value === 'boolean' ? CENTER : LEFT
    })
  })
  ws.views = [{ state: 'frozen', ySplit: 4 }]
  const lastRow = 4 + rows.length
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: lastRow, column: columns.length } }
  columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = Math.max(10, col.eng.length + 2, col.kor.length * 1.8 + 2)
  })
  return ws
}

const COST_BASE = 20
const COST_GROWTH_RATE = 2
const COOLDOWN_BASE_SEC = 900
const COOLDOWN_GROWTH_RATE = 1.5
const REWARD_MULTIPLIER = 5
const ROW_COUNT = 10

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const ws = workbook.getWorksheet('TimeHeistTable')
  if (!ws) throw new Error('TimeHeistTable 시트를 찾지 못했습니다.')
  const engRow = ws.getRow(4)
  const hasUsedCount = Array.from({ length: ws.columnCount }, (_, i) => engRow.getCell(i + 1).value).includes('UsedCount')
  if (hasUsedCount) {
    console.log('[migration] TimeHeistTable에 이미 UsedCount 칼럼이 있습니다 — 건너뜁니다.')
    return
  }

  const columns = [
    { ref: '', kor: '순번', type: 'int', eng: 'Index' },
    { ref: '', kor: 'ID', type: 'int', eng: 'Id' },
    { ref: '', kor: '사용 횟수', type: 'int', eng: 'UsedCount' },
    { ref: '', kor: '비용(시간에너지)', type: 'int', eng: 'Cost' },
    { ref: '', kor: '쿨타임(초)', type: 'float', eng: 'CooldownSec' },
    { ref: '', kor: '보상 배율', type: 'float', eng: 'RewardMultiplier' },
    { ref: '', kor: '설명', type: 'string', eng: '//Description' },
  ]

  const rows = []
  for (let usedCount = 0; usedCount < ROW_COUNT; usedCount++) {
    const cost = Math.floor(COST_BASE * COST_GROWTH_RATE ** usedCount)
    const cooldownSec = COOLDOWN_BASE_SEC * COOLDOWN_GROWTH_RATE ** usedCount
    rows.push([usedCount + 1, 34001 + usedCount, usedCount, cost, cooldownSec, REWARD_MULTIPLIER, ''])
  }

  writeDataSheet(workbook, 'TimeHeistTable', columns, rows)
  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] TimeHeistTable을 1행(공식 계수) → ${ROW_COUNT}행(UsedCount별 리터럴)으로 확장했습니다.`)
  console.log(`[migration] usedCount=0: cost=${rows[0][3]}, cooldownSec=${rows[0][4]}`)
  console.log(`[migration] usedCount=9: cost=${rows[9][3]}, cooldownSec=${rows[9][4]}`)
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
