// 1회성 마이그레이션: 리버스 보상 구조를 "누적 소비량 × 환급 배율"에서
// "도달 스테이지 구간별 고정 지급량 × 리버스 횟수 배율"로 전면 교체한다.
//
// RebirthRewardTable:
//   - 제거: RefundBonusPerPoint, MaxRefundMultiplier (포인트 누적 기반 환급 배율 —
//     더 이상 안 씀)
//   - 추가: GrowthEnergyReward, GoldReward, MasteryEssenceReward (구간별 고정
//     지급량 — DiamondReward와 동일한 성격). 초기값은 기존 밸런스에서 그 구간
//     즈음 누적 소비량이 어느 정도였는지 추정해 비슷한 체감이 나오도록 채웠다
//     (StageTable 누적 보상 추정 + 다이아 보상 구간별 성장률(×1.7 안팎)을 참고한
//     근사치 — 정확한 수치가 아니라 시작점이므로 플레이해보고 balance.xlsx에서
//     조정하면 된다).
//   - DiamondReward는 그대로 유지(리버스 횟수 배율 미적용 — 가챠 인플레 우려로
//     의도적으로 제외).
//
// CommonTable:
//   - 제거: RebirthBonusBase, RebirthBonusExponent (포인트 누적 공식 계수)
//   - 추가는 이 스크립트가 아니라 append-row.mjs로 별도 실행(RebirthCountBonusPerRun,
//     MaxRebirthCountMultiplier).
//
// 실행: node scripts/migrations/025-rebirth-reward-restructure.mjs
// 재실행 방지: RebirthRewardTable에 이미 GrowthEnergyReward 칼럼이 있으면 건너뛴다.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

const DATA_START_ROW = 5

// [StageFrom, StageTo, GrowthEnergyReward, GoldReward, MasteryEssenceReward] — DiamondReward는 기존 값 유지.
const NEW_REWARDS = [
  [1, 24, 1500, 3000, 50],
  [25, 49, 3000, 6000, 100],
  [50, 99, 6000, 12000, 200],
  [100, 199, 12000, 24000, 400],
  [200, 999999, 24000, 48000, 800],
]

function fail(message) {
  console.error(`[migration] 오류: ${message}`)
  process.exit(1)
}

async function main() {
  if (!existsSync(XLSX_PATH)) fail(`${XLSX_PATH} 파일이 없습니다.`)

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const ws = workbook.getWorksheet('RebirthRewardTable')
  if (!ws) fail('RebirthRewardTable 시트를 찾지 못했습니다.')

  const engRow = ws.getRow(4)
  const engValues = []
  for (let c = 1; c <= ws.columnCount; c++) engValues.push(String(engRow.getCell(c).value ?? ''))

  if (engValues.includes('GrowthEnergyReward')) {
    console.log('[migration] 이미 적용됨 — 건너뜁니다.')
    return
  }

  const refundBonusCol = engValues.indexOf('RefundBonusPerPoint')
  const maxMultiplierCol = engValues.indexOf('MaxRefundMultiplier')
  if (refundBonusCol === -1 || maxMultiplierCol === -1) {
    fail('RefundBonusPerPoint/MaxRefundMultiplier 칼럼을 찾지 못했습니다(이미 다른 형태로 바뀐 듯).')
  }
  // spliceColumns는 1-based 위치를 받는다. 두 칼럼이 인접해 있으므로 한 번에 제거.
  const removeStart = Math.min(refundBonusCol, maxMultiplierCol) + 1
  ws.spliceColumns(removeStart, 2)

  // 제거 후 남은 칼럼 수(=//Description 칼럼 바로 앞) 다음 위치에 새 칼럼 3개를 삽입.
  const afterRemovalCount = ws.columnCount
  const descColIndex = afterRemovalCount // //Description이 마지막 칼럼이라고 전제
  const insertAt = descColIndex // //Description 칼럼 "앞"에 삽입

  const NEW_COLUMNS = [
    { ref: '', kor: '성장에너지 지급량', type: 'int', eng: 'GrowthEnergyReward' },
    { ref: '', kor: '골드 지급량', type: 'int', eng: 'GoldReward' },
    { ref: '', kor: '숙련의 정수 지급량', type: 'int', eng: 'MasteryEssenceReward' },
  ]

  // 빈 칼럼 3개를 한 번에 삽입(개별 호출로 나누면 매번 밀리는 위치를 다시 계산해야 해서 실수하기 쉽다).
  ws.spliceColumns(insertAt, 0, [], [], [])
  NEW_COLUMNS.forEach((col, i) => {
    const cIdx = insertAt + i
    ws.getRow(1).getCell(cIdx).value = col.ref || null
    ws.getRow(2).getCell(cIdx).value = col.kor
    ws.getRow(3).getCell(cIdx).value = col.type
    ws.getRow(4).getCell(cIdx).value = col.eng
  })

  // 데이터 행에 값 채우기 — StageFrom으로 어느 구간인지 매칭.
  const stageFromCol = engValues.indexOf('StageFrom') + 1
  for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const stageFrom = row.getCell(stageFromCol).value
    if (stageFrom == null) continue
    const preset = NEW_REWARDS.find((entry) => entry[0] === stageFrom)
    if (!preset) {
      console.warn(`[migration] 행 ${r}(StageFrom=${stageFrom})에 대응하는 초기값을 찾지 못해 0으로 둡니다.`)
      continue
    }
    row.getCell(insertAt).value = preset[2]
    row.getCell(insertAt + 1).value = preset[3]
    row.getCell(insertAt + 2).value = preset[4]
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] RebirthRewardTable 재구성 완료 — RefundBonusPerPoint/MaxRefundMultiplier 제거, GrowthEnergyReward/GoldReward/MasteryEssenceReward 추가.')
  console.log('[migration] 다음 단계:')
  console.log('  1. node scripts/append-row.mjs CommonTable <Id> RebirthCountBonusPerRun "" 0.05 float "..."')
  console.log('  2. node scripts/append-row.mjs CommonTable <Id> MaxRebirthCountMultiplier "" 3.0 float "..."')
  console.log('  3. CommonTable에서 RebirthBonusBase/RebirthBonusExponent 행을 수동으로 제거(또는 별도 스크립트)')
  console.log('  4. node scripts/migrations/020-table-define-rebuild.mjs (± #TableDefine 재생성)')
  console.log('  5. npm run balance')
}

main()
