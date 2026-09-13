// 1회성 마이그레이션: 다이아 수급 배율을 원본(v0.4.0 다이아 개편 이전, 커밋
// 5433c49) 대비 ×9.1(041의 ×1.3 × 042의 ×7)에서 ×4로 낮춘다 — "너무 퍼준다,
// 증가폭을 줄일 필요가 있다"는 피드백 반영. 지금까지 두 번의 반올림을 거친
// 현재 값에서 역산하지 않고, 원본 스냅샷 값에 ×4를 새로 곱해 반올림 오차가
// 누적되지 않게 했다.
//
// 원본 스냅샷은 git 이력에서 직접 읽는다(커밋 5433c49 — 다이아 개편 전 마지막
// 커밋 — 시점의 src/data/balance.json). 세션 임시 파일에 의존하지 않아야 이
// 스크립트가 나중에 다시 봐도(또는 다른 환경에서도) 그대로 재현 가능하다.
// StageTable/RebirthRewardTable 행 수·순서가 지금과 동일해서 Stage 번호/구간으로
// 그대로 매핑된다.
//
// 실행: node scripts/migrations/048-diamond-supply-scale-down-to-4x.mjs
// 재실행 방지 없음 — 항상 원본 스냅샷 값 × 4로 덮어쓴다.

import ExcelJS from 'exceljs'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../..')
const XLSX_PATH = resolve(REPO_ROOT, 'balance/balance.xlsx')
const ORIGINAL_COMMIT = '5433c49'
const TARGET_MULTIPLIER = 4

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const originalJson = execFileSync('git', ['show', `${ORIGINAL_COMMIT}:src/data/balance.json`], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024 * 50,
  })
  const original = JSON.parse(originalJson)

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  // --- StageTable.FirstClearDiamond ---
  {
    const ws = workbook.getWorksheet('StageTable')
    if (!ws) throw new Error('StageTable 시트를 찾지 못했습니다.')
    const engRow = ws.getRow(4)
    let stageCol = -1
    let diamondCol = -1
    for (let c = 1; c <= ws.columnCount; c++) {
      const v = engRow.getCell(c).value
      if (v === 'Stage') stageCol = c
      if (v === 'FirstClearDiamond') diamondCol = c
    }
    if (stageCol < 0 || diamondCol < 0) throw new Error('StageTable에서 Stage/FirstClearDiamond 칼럼을 찾지 못했습니다.')

    const originalByStage = new Map(original.StageTable.map((r) => [r.Stage, r.FirstClearDiamond]))
    const lastRow = ws.lastRow.number
    let count = 0
    for (let r = 5; r <= lastRow; r++) {
      const row = ws.getRow(r)
      const stage = row.getCell(stageCol).value
      const originalValue = originalByStage.get(stage)
      if (originalValue === undefined) continue
      row.getCell(diamondCol).value = Math.round(originalValue * TARGET_MULTIPLIER)
      count += 1
    }
    console.log(`[migration] StageTable.FirstClearDiamond: ${count}행을 원본×${TARGET_MULTIPLIER}로 재설정`)
  }

  // --- RebirthRewardTable.DiamondReward ---
  {
    const ws = workbook.getWorksheet('RebirthRewardTable')
    if (!ws) throw new Error('RebirthRewardTable 시트를 찾지 못했습니다.')
    const engRow = ws.getRow(4)
    let fromCol = -1
    let toCol = -1
    let diamondCol = -1
    for (let c = 1; c <= ws.columnCount; c++) {
      const v = engRow.getCell(c).value
      if (v === 'StageFrom') fromCol = c
      if (v === 'StageTo') toCol = c
      if (v === 'DiamondReward') diamondCol = c
    }
    if (fromCol < 0 || toCol < 0 || diamondCol < 0) {
      throw new Error('RebirthRewardTable에서 StageFrom/StageTo/DiamondReward 칼럼을 찾지 못했습니다.')
    }

    const lastRow = ws.lastRow.number
    for (let r = 5; r <= lastRow; r++) {
      const row = ws.getRow(r)
      const from = row.getCell(fromCol).value
      const to = row.getCell(toCol).value
      const originalRow = original.RebirthRewardTable.find((x) => x.StageFrom === from && x.StageTo === to)
      if (!originalRow) continue
      const oldValue = row.getCell(diamondCol).value
      const newValue = Math.round(originalRow.DiamondReward * TARGET_MULTIPLIER)
      row.getCell(diamondCol).value = newValue
      console.log(`  구간 ${from}~${to}: ${oldValue} → ${newValue}`)
    }
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] 완료(원본 대비 ×${TARGET_MULTIPLIER}). 이제 \`npm run balance\`를 실행하세요.`)
}

main()
