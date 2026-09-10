// 1회성 마이그레이션: 전체 진행 속도 하향 + 스테이지 최초 클리어 다이아 보상 추가.
//
// - EnemyHp 증가율을 올려 스테이지가 오를수록 전투가 상대적으로 더 오래 걸리게
//   한다(다른 보상/난이도 곡선은 그대로 — HP만 조정). 초반 스테이지는 원래도 HP가
//   낮아 한두 방에 끝나므로 이 변경의 영향이 거의 없고, 영향은 중후반으로 갈수록
//   누적된다 — "초반 5분은 빠르게 유지" 요구사항과 맞아떨어진다.
// - FirstClearDiamond 칼럼 신설. 챕터가 오를수록 배율로 증가, 보스는 3배.
//   RewardGold/RewardGrowth 등 기존 리워드 칼럼은 전혀 건드리지 않는다(그대로 보존).
//
// 실행: node scripts/migrations/021-stage-table-pacing-and-first-clear.mjs
// 재실행 방지 없음(튜닝 중 반복 실행 전제) — 매번 EnemyHp/FirstClearDiamond를
// 이 스크립트의 상수 기준으로 다시 계산해 덮어쓴다. 최종 확정 후에는 이 스크립트를
// 다시 실행하지 않는다(다른 마이그레이션처럼 일회성 기록으로 남긴다).

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')
const DATA_START_ROW = 5

const HEADER_FILLS = {
  ref: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } },
  kor: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } },
  type: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } },
  eng: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8EA9DB' } },
}
const HEADER_FONTS = {
  ref: { size: 9, color: { argb: 'FF7F6000' } },
  kor: { size: 9, bold: true, color: { argb: 'FFFFFFFF' } },
  type: { size: 9, color: { argb: 'FF1F3864' } },
  eng: { size: 9, bold: true, color: { argb: 'FF1F3864' } },
}
const CENTER = { horizontal: 'center', vertical: 'middle' }
const LEFT = { horizontal: 'left', vertical: 'middle' }
const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
}

function writeDataSheet(workbook, sheetName, columns, rows) {
  const existing = workbook.getWorksheet(sheetName)
  if (existing) workbook.removeWorksheet(existing.id)
  const ws = workbook.addWorksheet(sheetName)
  const headerRows = [columns.map((c) => c.ref), columns.map((c) => c.kor), columns.map((c) => c.type), columns.map((c) => c.eng)]
  const styleKeys = ['ref', 'kor', 'type', 'eng']
  headerRows.forEach((values, rIdx) => {
    const rowNum = rIdx + 1
    const key = styleKeys[rIdx]
    values.forEach((value, cIdx) => {
      const cell = ws.getCell(rowNum, cIdx + 1)
      cell.value = value === '' ? null : value
      cell.fill = HEADER_FILLS[key]
      cell.font = HEADER_FONTS[key]
      cell.alignment = CENTER
      cell.border = THIN_BORDER
    })
  })
  rows.forEach((rowValues, i) => {
    const excelRow = DATA_START_ROW + i
    rowValues.forEach((value, cIdx) => {
      const cell = ws.getCell(excelRow, cIdx + 1)
      cell.value = value
      cell.font = { size: 9 }
      cell.border = THIN_BORDER
      cell.alignment = typeof value === 'number' || typeof value === 'boolean' ? CENTER : LEFT
    })
  })
  ws.views = [{ state: 'frozen', ySplit: 4 }]
  const lastRow = 4 + rows.length
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: lastRow, column: columns.length } }
  columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = Math.max(10, col.eng.length + 2, col.kor.length * 1.8 + 2)
  })
  return ws
}

// ---- 조정 상수 ----
const OLD_HP_GROWTH_RATE = 1.07
const NEW_HP_GROWTH_RATE = 1.075 // 밸런싱 시뮬레이션으로 튜닝됨(과거 1.07)
const BOSS_HP_MULT = 5 // 기존과 동일하게 유지
const STAGES_PER_CHAPTER = 10

const FIRST_CLEAR_BASE = 6
const FIRST_CLEAR_CHAPTER_GROWTH = 1.18
const FIRST_CLEAR_BOSS_MULT = 3

function chapterOf(stage) {
  return Math.ceil(stage / STAGES_PER_CHAPTER)
}

function firstClearDiamond(stage, isBoss) {
  const chapter = chapterOf(stage)
  const base = Math.round(FIRST_CLEAR_BASE * FIRST_CLEAR_CHAPTER_GROWTH ** (chapter - 1))
  return isBoss ? Math.round(base * FIRST_CLEAR_BOSS_MULT) : base
}

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
  const cols = {}
  for (let c = 1; c <= ws.columnCount; c++) {
    const eng = engRow.getCell(c).value
    if (eng) cols[eng] = c
  }
  const lastRow = ws.lastRow.number
  const oldRows = []
  for (let r = DATA_START_ROW; r <= lastRow; r++) {
    const row = ws.getRow(r)
    const obj = {}
    for (const [eng, c] of Object.entries(cols)) obj[eng] = row.getCell(c).value
    oldRows.push(obj)
  }

  const newRows = oldRows.map((old) => {
    const stage = old.Stage
    const isBoss = old.StageType === 'Boss'
    // EnemyHp만 새 성장률로 재계산 — "기준 스테이지(챕터 시작)의 참 공식값에서
    // 챕터 내부는 복리 보간"했던 2단계 시딩 방식과 동일한 구조를 새 성장률로 다시
    // 적용한다. EnemyAtk/보상/KillCount 등 나머지 칼럼은 전부 기존 값 그대로 둔다.
    const chapter = chapterOf(stage)
    const referenceStage = (chapter - 1) * STAGES_PER_CHAPTER + 1
    const offset = stage - referenceStage
    const refHpRaw = 20 * NEW_HP_GROWTH_RATE ** (referenceStage - 1)
    const newEnemyHpRaw = isBoss
      ? 20 * NEW_HP_GROWTH_RATE ** (stage - 1) * BOSS_HP_MULT
      : Math.floor(refHpRaw * NEW_HP_GROWTH_RATE ** offset)
    const newEnemyHp = Math.floor(newEnemyHpRaw)

    return {
      ...old,
      EnemyHp: newEnemyHp,
      FirstClearDiamond: firstClearDiamond(stage, isBoss),
    }
  })

  const columns = [
    { ref: '', kor: '순번', type: 'int', eng: 'Index' },
    { ref: '', kor: 'ID', type: 'int', eng: 'Id' },
    { ref: '', kor: '스테이지 번호', type: 'int', eng: 'Stage' },
    { ref: '', kor: '챕터', type: 'int', eng: 'Chapter' },
    { ref: 'EnumDefine/StageType', kor: '스테이지 종류', type: 'enum', eng: 'StageType' },
    { ref: '', kor: '적 HP', type: 'int', eng: 'EnemyHp' },
    { ref: '', kor: '적 공격력', type: 'int', eng: 'EnemyAtk' },
    { ref: '', kor: '처치 필요 수', type: 'int', eng: 'KillCount' },
    { ref: '', kor: '골드 보상', type: 'int', eng: 'RewardGold' },
    { ref: '', kor: '성장에너지 보상', type: 'int', eng: 'RewardGrowth' },
    { ref: '', kor: '존재력 보상', type: 'int', eng: 'RewardExist' },
    { ref: '', kor: '시간에너지 보상', type: 'int', eng: 'RewardTimeEnergy' },
    { ref: 'StringTable/Id', kor: '이름ID', type: 'int', eng: 'NameStringId' },
    { ref: '', kor: '최초 클리어 다이아', type: 'int', eng: 'FirstClearDiamond' },
  ]

  writeDataSheet(
    workbook,
    'StageTable',
    columns,
    newRows.map((r) => [
      r.Index,
      r.Id,
      r.Stage,
      r.Chapter,
      r.StageType,
      r.EnemyHp,
      r.EnemyAtk,
      r.KillCount,
      r.RewardGold,
      r.RewardGrowth,
      r.RewardExist,
      r.RewardTimeEnergy,
      r.NameStringId,
      r.FirstClearDiamond,
    ]),
  )

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] StageTable 재작성 완료(${newRows.length}행) — EnemyHp 성장률 ${OLD_HP_GROWTH_RATE} → ${NEW_HP_GROWTH_RATE}, FirstClearDiamond 칼럼 추가.`)
  const sample = [1, 10, 50, 100, 200]
  for (const s of sample) {
    const r = newRows.find((x) => x.Stage === s)
    console.log(`  stage${s}: hp=${r.EnemyHp} firstClearDiamond=${r.FirstClearDiamond}`)
  }
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
