// 1회성 마이그레이션: v0.3.0 밸런스 개편 — 스탯 계산에 곱연산(퍼센트)이 들어가며
// 전투력 상승이 훨씬 가팔라져, 그 재원이 되는 골드/성장에너지 획득량을 함께
// 낮춘다. StageTable.RewardGold/RewardGrowth 200행 전부에 동일 배율을 곱한다
// (다른 보상 칼럼 — RewardExist/RewardTimeEnergy/FirstClearDiamond — 은 대상 아님).
//
// 골드 ×0.25 (75% 감소, 요청 범위 70~80% 안), 성장에너지 ×0.45(55% 감소, 요청
// 범위 50~60% 안). 곡선 모양(스테이지가 오를수록 가팔라지는 성장률)은 그대로
// 유지하고 전체 크기만 줄인다 — 최소 1 밑으로는 내려가지 않게 클램프.
//
// 실행: node scripts/migrations/032-currency-reward-nerf.mjs
// 재실행 방지: 별도 플래그 없이 매번 곱하므로, 실수로 두 번 돌리면 중복 적용된다 —
// CommonTable에 적용 여부 플래그를 두는 대신 아래 GOLD_MULTIPLIER 자체를 realistic
// 범위로 한정해 재실행 감지(1스테이지 RewardGold가 이미 목표치 이하면 건너뜀)한다.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')
const DATA_START_ROW = 5
const GOLD_MULTIPLIER = 0.25
const GROWTH_MULTIPLIER = 0.45

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] 오류: ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)
  const ws = workbook.getWorksheet('StageTable')
  if (!ws) {
    console.error('[migration] 오류: StageTable 시트를 찾지 못했습니다.')
    process.exit(1)
  }

  const engRow = ws.getRow(4)
  const cols = {}
  for (let c = 1; c <= ws.columnCount; c++) {
    const eng = engRow.getCell(c).value
    if (eng) cols[String(eng)] = c
  }

  // 재실행 감지: 1스테이지(Stage=1) RewardGold가 이미 5 미만(=한 번 적용된 값,
  // 5 × 0.25 = 1.25 → 저장 시 1)이면 이미 적용된 것으로 보고 건너뛴다.
  const firstRow = ws.getRow(DATA_START_ROW)
  const firstGold = Number(firstRow.getCell(cols.RewardGold).value)
  if (firstGold > 0 && firstGold < 5) {
    console.log('[migration] 이미 적용됨 — 건너뜁니다.')
    return
  }

  let rows = 0
  for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const gold = Number(row.getCell(cols.RewardGold).value)
    const growth = Number(row.getCell(cols.RewardGrowth).value)
    if (!Number.isFinite(gold) || !Number.isFinite(growth)) continue

    row.getCell(cols.RewardGold).value = Math.max(1, Math.round(gold * GOLD_MULTIPLIER))
    row.getCell(cols.RewardGrowth).value = Math.max(1, Math.round(growth * GROWTH_MULTIPLIER))
    rows += 1
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] StageTable ${rows}행: RewardGold ×${GOLD_MULTIPLIER}, RewardGrowth ×${GROWTH_MULTIPLIER} 적용.`)
  console.log('[migration] 다음: npm run balance')
}

main()
