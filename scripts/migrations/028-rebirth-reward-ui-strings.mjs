// 1회성 마이그레이션: 리버스 보상 구조 개편(환급 배율 → 구간 고정 지급 × 회차
// 배율)에 맞춰 StringTable 문구를 정리한다.
//   - 40053 "환급 배율" → "회차 배율"로 텍스트만 수정(리버스 횟수 기반 배율이라는
//     새 의미에 맞춤. Id/용도는 그대로라 새 행을 만들지 않는다).
//   - 새 화면 문구(리버스 보상 섹션 제목, 구간/기본/다음 리버스 배율 라벨) 추가.
//
// 실행: node scripts/migrations/028-rebirth-reward-ui-strings.mjs
// 재실행 방지: Id 41047(rewardSectionTitle)이 이미 있으면 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')
const DATA_START_ROW = 5

const RENAMES = [{ id: 40053, kor: '회차 배율', eng: 'Rebirth Multiplier' }]

const NEW_ROWS = [
  { id: 41047, kor: '리버스 보상', eng: 'Rebirth Reward', category: 'RebirthModal' },
  { id: 41048, kor: '도달 구간', eng: 'Stage Range', category: 'RebirthModal' },
  { id: 41049, kor: '기본', eng: 'Base', category: 'RebirthModal' },
  { id: 41050, kor: '다음 리버스 배율', eng: 'Next Rebirth Multiplier', category: 'RebirthModal' },
]

async function main() {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)
  const ws = workbook.getWorksheet('StringTable')

  const engRow = ws.getRow(4)
  const cols = {}
  for (let c = 1; c <= ws.columnCount; c++) {
    const eng = engRow.getCell(c).value
    if (eng) cols[String(eng)] = c
  }

  if (!cols.Id) throw new Error('Id 칼럼을 찾지 못했습니다.')

  const idToRow = {}
  for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
    const id = ws.getRow(r).getCell(cols.Id).value
    if (id != null) idToRow[id] = r
  }

  for (const { id, kor, eng } of RENAMES) {
    const r = idToRow[id]
    if (!r) {
      console.warn(`[migration] Id ${id}를 찾지 못해 건너뜁니다.`)
      continue
    }
    ws.getRow(r).getCell(cols.KOR).value = kor
    ws.getRow(r).getCell(cols.ENG).value = eng
    console.log(`[migration] StringTable#${id} 텍스트 수정 → "${kor}"`)
  }

  if (idToRow[NEW_ROWS[0].id]) {
    console.log('[migration] 새 문구는 이미 추가돼 있습니다 — 건너뜁니다.')
  } else {
    let nextRow = ws.rowCount + 1
    for (const { id, kor, eng, category } of NEW_ROWS) {
      const row = ws.getRow(nextRow)
      row.getCell(cols.Index).value = nextRow - (DATA_START_ROW - 1)
      row.getCell(cols.Id).value = id
      row.getCell(cols.KOR).value = kor
      row.getCell(cols.ENG).value = eng
      if (cols['//Category']) row.getCell(cols['//Category']).value = category
      nextRow += 1
    }
    console.log(`[migration] StringTable에 신규 문구 ${NEW_ROWS.length}개 추가.`)
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
}

main()
