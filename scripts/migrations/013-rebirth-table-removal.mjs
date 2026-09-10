// 1회성 마이그레이션: RebirthTable(1행) 삭제(3단계, 1행 테이블 정리 마지막).
//
// - ResetStage/ResetStats/ResetMastery/KeepExistTree(4개 bool) → CommonTable로
//   0/1 흡수(RebirthResetStage 등). gameStore.ts가 getCommonBool()로 읽는다.
// - RefundGrowthEnergy/RefundGold/RefundMasteryEssence(3개 bool) → 삭제. 이미
//   CurrencyTable.RefundOnRebirth가 GROWTH_ENERGY/GOLD/MASTERY_ESSENCE=true,
//   나머지=false로 동일한 값을 갖고 있었다(1단계 개편 때 스키마+데이터만 있던 것을
//   이번에 실제로 연결) — 별도 CommonTable 이관 없이 gameStore.ts가 CurrencyTable을
//   직접 조회하도록 전환.
// - BonusBase/BonusExponent → CommonTable로 흡수(RebirthBonusBase/RebirthBonusExponent).
// - RefundBonusPerPoint/MaxRefundMultiplier → RebirthRewardTable에 새 칼럼으로 추가
//   (기존 5개 구간 행 전부에 동일 값 반복 — computeRefundMultiplier가 stage로
//   구간을 찾아 조회하게 된다).
//
// 실행: node scripts/migrations/013-rebirth-table-removal.mjs
// 재실행 방지: RebirthRewardTable에 이미 RefundBonusPerPoint 칼럼이 있으면 건너뜀.

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

const REFUND_BONUS_PER_POINT = 1
const MAX_REFUND_MULTIPLIER = 5

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const rewardWs = workbook.getWorksheet('RebirthRewardTable')
  if (!rewardWs) throw new Error('RebirthRewardTable 시트를 찾지 못했습니다.')
  const rewardEngRow = rewardWs.getRow(4)
  const alreadyDone = Array.from({ length: rewardWs.columnCount }, (_, i) => rewardEngRow.getCell(i + 1).value).includes(
    'RefundBonusPerPoint',
  )
  if (alreadyDone) {
    console.log('[migration] RebirthRewardTable에 이미 RefundBonusPerPoint 칼럼이 있습니다 — 건너뜁니다.')
    return
  }

  const oldCols = {}
  for (let c = 1; c <= rewardWs.columnCount; c++) {
    const eng = rewardEngRow.getCell(c).value
    if (eng) oldCols[eng] = c
  }
  const lastRow = rewardWs.lastRow ? rewardWs.lastRow.number : 4
  const oldRows = []
  for (let r = 5; r <= lastRow; r++) {
    const row = rewardWs.getRow(r)
    oldRows.push({
      Index: row.getCell(oldCols.Index).value,
      Id: row.getCell(oldCols.Id).value,
      StageFrom: row.getCell(oldCols.StageFrom).value,
      StageTo: row.getCell(oldCols.StageTo).value,
      DiamondReward: row.getCell(oldCols.DiamondReward).value,
    })
  }

  const rewardColumns = [
    { ref: '', kor: '순번', type: 'int', eng: 'Index' },
    { ref: '', kor: 'ID', type: 'int', eng: 'Id' },
    { ref: '', kor: '구간 시작 스테이지', type: 'int', eng: 'StageFrom' },
    { ref: '', kor: '구간 끝 스테이지', type: 'int', eng: 'StageTo' },
    { ref: '', kor: '다이아 지급량', type: 'int', eng: 'DiamondReward' },
    { ref: '', kor: '포인트당 환급 증폭률', type: 'float', eng: 'RefundBonusPerPoint' },
    { ref: '', kor: '환급 배율 상한', type: 'float', eng: 'MaxRefundMultiplier' },
    { ref: '', kor: '설명', type: 'string', eng: '//Description' },
  ]
  const rewardRows = oldRows.map((r) => [
    r.Index,
    r.Id,
    r.StageFrom,
    r.StageTo,
    r.DiamondReward,
    REFUND_BONUS_PER_POINT,
    MAX_REFUND_MULTIPLIER,
    '',
  ])
  writeDataSheet(workbook, 'RebirthRewardTable', rewardColumns, rewardRows)
  console.log(`[migration] RebirthRewardTable에 RefundBonusPerPoint/MaxRefundMultiplier 칼럼 추가 완료(${rewardRows.length}행).`)

  const rebirthWs = workbook.getWorksheet('RebirthTable')
  if (rebirthWs) {
    workbook.removeWorksheet(rebirthWs.id)
    console.log('[migration] RebirthTable 시트 삭제.')
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
