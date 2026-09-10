// 1회성 마이그레이션: 전체 진행 속도 하향(존재력 트리/특별 해금 비용 쪽 레버).
//
// 두 가지를 분리해서 조정한다:
// - ExistTreeTable.Cost: 노드 순번(order)에 지수적으로 커지는 배율을 기존 값에
//   곱한다 — 초반 노드는 배율이 1에 가까워 거의 그대로, 후반으로 갈수록 비싸진다.
//   주로 노드 50 근처 후반부 페이스에 영향을 준다.
// - FeatureUnlockTable.UnlockCost(리버스/타임 하이스트): 시뮬레이션해보니 이걸
//   노드 원가 배율에 연동시키면(노드가 비싸질수록 같이 비싸지는 방식) 정작 "노드
//   개수 자체"는 존재력 수입 증가 속도에 묻혀 거의 안 늦춰지고, 반대로 33번
//   근처에서는 배율이 과하게 겹쳐 아예 도달 불가능해지는 문제가 있었다. 그래서
//   이 두 해금 비용은 노드 원가와 무관한 독립 상수로 직접 지정한다 — "노드 개수
//   자체는 채웠지만 해금 비용을 모을 때까지 기다려야 하는" 구간을 의도적으로
//   만든다(실제 여러 방치형 게임이 쓰는 "조건 충족 + 별도 비용" 이중 게이트 구조).
//
// 실행: node scripts/migrations/022-exist-tree-pacing.mjs
// 재실행 방지 없음(튜닝 중 반복 실행 전제) — 항상 시딩 당시 원본 값을 기준으로
// 다시 계산해 덮어쓴다.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

// 2단계 개편 때 시딩된 "원본" Cost 값(order 1~50) — scripts/seed/seed-exist-tree-nodes.mjs의
// nodeCost() 결과와 동일.
const ORIGINAL_COST = [
  12, 13, 15, 17, 19, 22, 24, 28, 31, 35, 40, 45, 51, 57, 65, 73, 84, 94, 107, 121, 138, 155, 176, 199, 225, 254, 287, 324, 366,
  414, 469, 529, 598, 676, 764, 864, 976, 1104, 1247, 1409, 1593, 1800, 2034, 2298, 2597, 2934, 3317, 3748, 4235, 4786,
]

const PACING_MULTIPLIER_BASE = 1.015
// 11~15번(리버스 해금 직전 구간)에만 추가로 곱하는 배율 — 시뮬레이션해보니 노드
// 개수 자체는 존재력 수입이 워낙 빨리 불어나서 전체 곡선을 완만하게 올리는
// 것만으로는 15번 근처만 딱 집어 늦추기 어려웠다(33번은 쉽게 늦춰지는데 15번은
// 거의 안 움직임). 그래서 리버스 해금 바로 앞 구간에만 문턱을 하나 더 둔다.
const NODE15_GATE_BUMP = 12
const NODE15_GATE_RANGE = [11, 15]

function costMultiplier(order) {
  const base = PACING_MULTIPLIER_BASE ** (order - 1)
  if (order >= NODE15_GATE_RANGE[0] && order <= NODE15_GATE_RANGE[1]) return base * NODE15_GATE_BUMP
  return base
}

// 독립 상수 — 노드 원가 배율과 별개로 직접 지정한다. 밸런싱 시뮬레이션으로 튜닝됨.
const NEW_UNLOCK_COST = { REBIRTH: 200, TIME_HEIST: 1200 }

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const ws = workbook.getWorksheet('ExistTreeTable')
  if (!ws) throw new Error('ExistTreeTable 시트를 찾지 못했습니다.')

  const engRow = ws.getRow(4)
  let orderCol = -1
  let costCol = -1
  for (let c = 1; c <= ws.columnCount; c++) {
    const v = engRow.getCell(c).value
    if (v === 'Order') orderCol = c
    if (v === 'Cost') costCol = c
  }
  if (orderCol < 0 || costCol < 0) throw new Error('Order/Cost 칼럼을 찾지 못했습니다.')

  const lastRow = ws.lastRow.number
  const changes = []
  for (let r = 5; r <= lastRow; r++) {
    const row = ws.getRow(r)
    const order = row.getCell(orderCol).value
    const original = ORIGINAL_COST[order - 1]
    const newCost = Math.round(original * costMultiplier(order))
    const oldCost = row.getCell(costCol).value
    row.getCell(costCol).value = newCost
    changes.push({ order, oldCost, newCost })
  }

  console.log(`[migration] ExistTreeTable Cost 재계산 완료(배율 기준 ${PACING_MULTIPLIER_BASE}).`)
  for (const o of [1, 5, 10, 15, 20, 33, 50]) {
    const c = changes.find((x) => x.order === o)
    console.log(`  order${o}: ${c.oldCost} → ${c.newCost}`)
  }

  const featureWs = workbook.getWorksheet('FeatureUnlockTable')
  if (featureWs) {
    const fEngRow = featureWs.getRow(4)
    let featureTypeCol = -1
    let unlockCostCol = -1
    for (let c = 1; c <= featureWs.columnCount; c++) {
      const v = fEngRow.getCell(c).value
      if (v === 'FeatureType') featureTypeCol = c
      if (v === 'UnlockCost') unlockCostCol = c
    }
    const fLastRow = featureWs.lastRow.number
    for (let r = 5; r <= fLastRow; r++) {
      const featureType = featureWs.getRow(r).getCell(featureTypeCol).value
      const newCost = NEW_UNLOCK_COST[featureType]
      if (newCost === undefined) continue
      const oldCost = featureWs.getRow(r).getCell(unlockCostCol).value
      featureWs.getRow(r).getCell(unlockCostCol).value = newCost
      console.log(`  FeatureUnlockTable ${featureType}: ${oldCost} → ${newCost}`)
    }
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
