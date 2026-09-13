// 1회성 마이그레이션: 스테이지 201~300(21~30챕터, "후반부")의 몬스터 체력을
// 갈수록 훨씬 가파르게 오르도록 추가 배율을 곱한다.
//
// 배경: 현재 EnemyHp는 챕터가 오를수록 커지는 챕터당 성장률 자체가 뒷챕터로
// 갈수록 taper(감쇠)되도록 설계돼 있었다(21~30챕터 구간에서 5챕터당 배율이
// 37.2배 → 27.1배 → 11.2배로 오히려 둔화). 그 결과 "가면 갈수록 기하급수적으로
// 강해진다"는 체감보다는 뒷쪽으로 갈수록 오히려 완만해지는 쪽에 가까웠다 —
// 요청대로 후반부일수록 더 가파르게(지수적으로) 오르도록 되돌린다.
//
// 방식: 스테이지 201~300 EnemyHp에 growth^((stage-200)/10)의 추가 배율을 곱한다
// (growth=1.5 → 스테이지 300에서 약 57.7배). 200 이전(1~20챕터)은 전혀 건드리지
// 않는다. 적 공격력/보상 등 다른 칼럼도 그대로 둔다 — 요청이 "몬스터 체력"으로
// 한정됨.
//
// 실행: node scripts/migrations/050-lategame-hp-exponential-ramp.mjs
// 재실행 방지 없음 — 항상 "실행 시점의 현재 EnemyHp"에 배율을 적용한다(반복
// 실행하면 누적되므로 주의).

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

const RAMP_START_STAGE = 201
const GROWTH_PER_10_STAGES = 1.5

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
  let stageCol = -1
  let hpCol = -1
  for (let c = 1; c <= ws.columnCount; c++) {
    const v = engRow.getCell(c).value
    if (v === 'Stage') stageCol = c
    if (v === 'EnemyHp') hpCol = c
  }
  if (stageCol < 0 || hpCol < 0) throw new Error('Stage/EnemyHp 칼럼을 찾지 못했습니다.')

  const lastRow = ws.lastRow.number
  let count = 0
  for (let r = 5; r <= lastRow; r++) {
    const row = ws.getRow(r)
    const stage = row.getCell(stageCol).value
    if (typeof stage !== 'number' || stage < RAMP_START_STAGE) continue
    const ramp = GROWTH_PER_10_STAGES ** ((stage - (RAMP_START_STAGE - 1)) / 10)
    const cell = row.getCell(hpCol)
    const oldValue = cell.value
    cell.value = Math.round(oldValue * ramp)
    count += 1
    if (stage % 10 === 0) console.log(`  stage${stage}: ${oldValue} → ${cell.value} (×${ramp.toFixed(2)})`)
  }
  console.log(`[migration] StageTable.EnemyHp: 스테이지 ${RAMP_START_STAGE}~300 ${count}행에 후반부 지수 램프 적용`)

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] 완료. 이제 `npm run balance`를 실행하세요.')
}

main()
