// 1회성 마이그레이션: 리버스 다이아 수급량 상향.
//
// 배경: 최초 클리어 다이아(StageTable.FirstClearDiamond)가 리버스해도 초기화되지
// 않던 버그(gameStore.ts executeRebirth — firstClearMaxStage 필드 신설로 수정)
// 때문에, 실질적으로 첫 회차 이후로는 최초 클리어 다이아가 거의 안 나왔었다.
// RebirthRewardTable.DiamondReward는 애초에 "최초 클리어 다이아와 리버스 보상
// 두 수급원이 합쳐지는 것"을 전제로 튜닝돼 있었는데(마이그레이션 023 주석 참고),
// 그 전제가 버그로 깨져 있었던 것 — 버그만 고쳐도 수급량이 크게 회복된다.
//
// 이번 변경은 그 위에 "가챠를 좀 더 여유 있게 돌릴 수 있게" 완만한 추가 상향을
// 얹는 것. 두 테이블 모두 기존 값에 균일하게 ×1.3을 적용해 챕터별/구간별 상대
// 곡선(보스 3배, 구간 간 배율 등)은 그대로 유지한다. 가챠 비용(GachaTable.
// PullCostDiamond)은 건드리지 않는다 — 버그 수정만으로도 회차당 수급량이 이미
// 큰 폭(예: 스테이지50 도달 기준 약 56회 뽑기 상당)으로 늘어나 있어, 추가로
// 가챠 비용까지 낮추면 무기가 한 회차만에 과하게 쌓일 위험이 있다고 판단.
//
// 실행: node scripts/migrations/041-rebirth-diamond-income-buff.mjs
// 재실행 방지 없음(튜닝 중 반복 실행 전제) — 항상 "실행 시점의 현재 값"에 배율을
// 적용한다(다른 마이그레이션처럼 최종 확정 후에는 다시 실행하지 않는다).

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

const MULTIPLIER = 1.3

async function scaleColumn(workbook, sheetName, columnName) {
  const ws = workbook.getWorksheet(sheetName)
  if (!ws) throw new Error(`${sheetName} 시트를 찾지 못했습니다.`)

  const engRow = ws.getRow(4)
  let col = -1
  for (let c = 1; c <= ws.columnCount; c++) {
    if (engRow.getCell(c).value === columnName) col = c
  }
  if (col < 0) throw new Error(`${sheetName}에서 ${columnName} 칼럼을 찾지 못했습니다.`)

  const lastRow = ws.lastRow.number
  let count = 0
  for (let r = 5; r <= lastRow; r++) {
    const cell = ws.getRow(r).getCell(col)
    const oldValue = cell.value
    if (typeof oldValue !== 'number') continue
    cell.value = Math.round(oldValue * MULTIPLIER)
    count += 1
  }
  console.log(`[migration] ${sheetName}.${columnName}: ${count}행에 ×${MULTIPLIER} 적용`)
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  await scaleColumn(workbook, 'StageTable', 'FirstClearDiamond')
  await scaleColumn(workbook, 'RebirthRewardTable', 'DiamondReward')

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] 완료. 이제 `npm run balance`를 실행하세요.')
}

main()
