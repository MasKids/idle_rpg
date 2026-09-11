// 1회성 마이그레이션: 리버스 시 재화 초기화 범위를 넓힌다. CurrencyTable.
// ResetOnRebirth 칼럼은 1단계 때부터 스키마만 있고 코드가 읽지 않던 죽은
// 값이었는데(gameStore.ts는 RefundOnRebirth 하나로 "초기화 후 재지급"을
// 판단했다), 이제 "초기화 여부"와 "재지급 여부"를 따로 둬야 해서 살려 쓴다.
//
//   - DIAMOND: ResetOnRebirth=true로 새로 켠다(기존엔 초기화 없이 그냥
//     누적이었다 — 요청에 따라 초기화 후 재지급으로 변경).
//   - EXIST: ResetOnRebirth=true로 새로 켠다. RefundOnRebirth는 그대로
//     false — 초기화만 하고 별도 재지급은 하지 않는다(존재력 트리 해금
//     자체는 RebirthKeepExistTree로 별도 유지되고, EXIST는 전투로 다시
//     모으는 재화라 재지급 소스가 없다).
//   - GROWTH_ENERGY/GOLD/MASTERY_ESSENCE: 기존에도 RefundOnRebirth로
//     사실상 초기화 후 재지급이었던 걸 ResetOnRebirth=true로 명시한다
//     (동작은 그대로, 근거 칼럼만 명확해짐).
//   - TIME_ENERGY: 요청대로 제외 — ResetOnRebirth 그대로 false.
//
// 실행: node scripts/migrations/038-currency-reset-on-rebirth.mjs
// 재실행 방지: DIAMOND의 ResetOnRebirth가 이미 true면 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')
const DATA_START_ROW = 5

// Type → { resetOnRebirth, refundOnRebirth(선택 — 지정 안 하면 기존 값 유지) }
const UPDATES = {
  DIAMOND: { resetOnRebirth: true, refundOnRebirth: true },
  EXIST: { resetOnRebirth: true },
  GROWTH_ENERGY: { resetOnRebirth: true },
  GOLD: { resetOnRebirth: true },
  MASTERY_ESSENCE: { resetOnRebirth: true },
  TIME_ENERGY: { resetOnRebirth: false },
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] 오류: ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)
  const ws = workbook.getWorksheet('CurrencyTable')
  if (!ws) {
    console.error('[migration] 오류: CurrencyTable 시트를 찾지 못했습니다.')
    process.exit(1)
  }

  const engRow = ws.getRow(4)
  const cols = {}
  for (let c = 1; c <= ws.columnCount; c++) {
    const eng = engRow.getCell(c).value
    if (eng) cols[String(eng)] = c
  }

  const diamondRow = Array.from({ length: ws.rowCount - DATA_START_ROW + 1 }, (_, i) => DATA_START_ROW + i).find(
    (r) => ws.getRow(r).getCell(cols.Type).value === 'DIAMOND',
  )
  if (diamondRow && ws.getRow(diamondRow).getCell(cols.ResetOnRebirth).value === true) {
    console.log('[migration] 이미 적용됨 — 건너뜁니다.')
    return
  }

  let updated = 0
  for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const type = row.getCell(cols.Type).value
    const update = UPDATES[type]
    if (!update) continue
    row.getCell(cols.ResetOnRebirth).value = update.resetOnRebirth
    if (update.refundOnRebirth !== undefined) row.getCell(cols.RefundOnRebirth).value = update.refundOnRebirth
    updated += 1
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] CurrencyTable ${updated}행의 ResetOnRebirth/RefundOnRebirth 갱신 완료.`)
  console.log('[migration] 다음: npm run balance')
}

main()
