// 1회성 마이그레이션: StageTable.FirstClearDiamond를 "최소 50개 ~ 최대 500개"
// 범위로 다시 맞춘다.
//
// 배경: migration 049에서 당시 최고값(8748)에 균일 배율(500/8748)만 곱해
// 최댓값을 500으로 맞췄는데, 그 결과 최솟값(1~9스테이지)도 같이 짓눌려 1까지
// 내려갔다 — "스테이지 클리어당 다이아를 최소 50개는 주면서 시작해서 500개까지
// 늘어나게" 하려던 의도와 어긋난다.
//
// 방식: 현재 컬럼의 최솟값 → 50, 최댓값 → 500이 되도록 선형(affine) 변환을
// 적용한다: new = 50 + (old - currentMin) / (currentMax - currentMin) * (500 - 50).
// 순서·상대적 굴곡(챕터별/보스 배율)은 그대로 유지된다.
//
// 실행: node scripts/migrations/052-diamond-min-50.mjs
// 재실행 방지 없음 — 항상 "실행 시점의 현재 값" 기준으로 다시 계산한다.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

const TARGET_MIN = 50
const TARGET_MAX = 500

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const ws = workbook.getWorksheet('StageTable')
  if (!ws) throw new Error('StageTable 시트를 찾지 못했습니다.')

  const engRow = ws.getRow(4)
  let col = -1
  for (let c = 1; c <= ws.columnCount; c++) {
    if (engRow.getCell(c).value === 'FirstClearDiamond') col = c
  }
  if (col < 0) throw new Error('StageTable에서 FirstClearDiamond 칼럼을 찾지 못했습니다.')

  const lastRow = ws.lastRow.number
  let currentMin = Infinity
  let currentMax = -Infinity
  for (let r = 5; r <= lastRow; r++) {
    const v = ws.getRow(r).getCell(col).value
    if (typeof v !== 'number') continue
    if (v < currentMin) currentMin = v
    if (v > currentMax) currentMax = v
  }
  const span = currentMax - currentMin

  let count = 0
  for (let r = 5; r <= lastRow; r++) {
    const cell = ws.getRow(r).getCell(col)
    const oldValue = cell.value
    if (typeof oldValue !== 'number') continue
    const ratio = span > 0 ? (oldValue - currentMin) / span : 0
    cell.value = Math.round(TARGET_MIN + ratio * (TARGET_MAX - TARGET_MIN))
    count += 1
  }
  console.log(
    `[migration] StageTable.FirstClearDiamond: ${count}행, 범위 ${currentMin}~${currentMax} → ${TARGET_MIN}~${TARGET_MAX}`,
  )

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] 완료. 이제 `npm run balance`를 실행하세요.')
}

main()
