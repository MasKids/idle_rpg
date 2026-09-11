// 1회성 마이그레이션: 리버스 모달 상단 설명(StringTable Id 41000)이 "그동안
// 소비한 재화를 전액 돌려받고"라는, 4단계 개편(누적 소비량 환급 → 구간 고정
// 지급 × 횟수 배율) 이전의 옛 설명 그대로 남아 있었다 — 실제 동작과 이미 다른
// 상태였다(이번 재화 초기화 범위 확장과는 별개로 발견해 함께 고친다).
//
// 실행: node scripts/migrations/040-rebirth-description-text-fix.mjs
// 재실행 방지: 이미 새 문구면 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')
const DATA_START_ROW = 5
const TARGET_ID = 41000
const NEW_TEXT =
  '스테이지·스탯·숙련을 초기화하고 무기·유물을 소멸/초기화합니다. 골드·성장에너지·숙련의 정수·다이아는 초기화된 뒤 도달 스테이지 구간에 맞춰 새로 지급되고, 존재력은 초기화만 됩니다(시간에너지는 그대로 유지). 존재력 트리는 그대로 유지됩니다.'

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
  console.log(`[migration] StringTable#${TARGET_ID} 리버스 설명 문구 갱신 완료.`)
  console.log('[migration] 다음: npm run balance')
}

main()
