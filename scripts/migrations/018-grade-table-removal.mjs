// 1회성 마이그레이션: WeaponGradeTable/GradeTable 삭제.
// 무기 종류를 WeaponTable에 흡수했던 것과 같은 논리 — 등급 이름 StringId·색상
// 토큰을 WeaponTable(75행)/RelicTable(9행) 각 행에 직접 기입한다(같은 등급끼리는
// 값이 반복되지만, 무기/유물별 개별 조정 여지를 남기려는 의도적 중복).
// GradeMultiplier/BaseMultiplier는 옮기지 않는다 — 2단계 개편 때 이미 BaseAtk 등에
// 곱연산까지 끝난 값으로 흡수돼 어디서도 읽지 않는 죽은 칼럼이었다.
//
// 실행: node scripts/migrations/018-grade-table-removal.mjs
// 재실행 방지: WeaponTable에 이미 GradeNameStringId 칼럼이 있으면 건너뜀.

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

// 등급 이름 StringId(기존 40001~40134 대역, 그대로 재사용) / 색상 토큰(소문자 —
// weaponUi.ts의 --color-grade-* CSS 토큰과 동일한 이름).
const GRADE_NAME_STRING_ID = { Normal: 40058, Rare: 40059, Epic: 40060, Unique: 40061, Legendary: 40062 }
const GRADE_COLOR_TOKEN = { Normal: 'normal', Rare: 'rare', Epic: 'epic', Unique: 'unique', Legendary: 'legendary' }

function readSheetRows(ws) {
  const engRow = ws.getRow(4)
  const cols = {}
  for (let c = 1; c <= ws.columnCount; c++) {
    const eng = engRow.getCell(c).value
    if (eng) cols[eng] = c
  }
  const lastRow = ws.lastRow.number
  const rows = []
  for (let r = DATA_START_ROW; r <= lastRow; r++) {
    const row = ws.getRow(r)
    const obj = {}
    for (const [eng, c] of Object.entries(cols)) obj[eng] = row.getCell(c).value
    rows.push(obj)
  }
  return { cols, rows }
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const weaponWs = workbook.getWorksheet('WeaponTable')
  const relicWs = workbook.getWorksheet('RelicTable')
  if (!weaponWs || !relicWs) throw new Error('WeaponTable/RelicTable 시트를 찾지 못했습니다.')

  const weaponEngRow = weaponWs.getRow(4)
  const alreadyDone = Array.from({ length: weaponWs.columnCount }, (_, i) => weaponEngRow.getCell(i + 1).value).includes(
    'GradeNameStringId',
  )
  if (alreadyDone) {
    console.log('[migration] WeaponTable에 이미 GradeNameStringId 칼럼이 있습니다 — 건너뜁니다.')
    return
  }

  const { rows: weaponRows } = readSheetRows(weaponWs)
  const { rows: relicRows } = readSheetRows(relicWs)

  // ---- WeaponTable 재작성 ----
  const weaponColumns = [
    { ref: '', kor: '순번', type: 'int', eng: 'Index' },
    { ref: '', kor: 'ID', type: 'int', eng: 'Id' },
    { ref: '', kor: '무기 ID', type: 'string', eng: 'WeaponId' },
    { ref: 'EnumDefine/WeaponType', kor: '종류', type: 'enum', eng: 'Type' },
    { ref: 'EnumDefine/StatType', kor: '주스탯', type: 'enum', eng: 'PrimaryStat' },
    { ref: 'EnumDefine/WeaponGrade', kor: '등급', type: 'enum', eng: 'Grade' },
    { ref: 'StringTable/Id', kor: '등급 이름ID', type: 'int', eng: 'GradeNameStringId' },
    { ref: '', kor: '등급 색상 토큰', type: 'string', eng: 'GradeColorToken' },
    { ref: '', kor: '단계', type: 'int', eng: 'Tier' },
    { ref: 'StringTable/Id', kor: '이름ID', type: 'int', eng: 'NameStringId' },
    { ref: 'StringTable/Id', kor: '설명ID', type: 'int', eng: 'DescStringId' },
    { ref: '', kor: '기본 공격력', type: 'float', eng: 'BaseAtk' },
    { ref: '', kor: '보유 효과값', type: 'float', eng: 'OwnEffectValue' },
    { ref: '', kor: '장착 효과값', type: 'float', eng: 'EquipEffectValue' },
    { ref: 'GrowthCurveTable/CurveKey', kor: '레벨업 곡선', type: 'string', eng: 'CurveKey' },
    { ref: '', kor: '설명', type: 'string', eng: '//Description' },
  ]
  writeDataSheet(
    workbook,
    'WeaponTable',
    weaponColumns,
    weaponRows.map((w) => [
      w.Index,
      w.Id,
      w.WeaponId,
      w.Type,
      w.PrimaryStat,
      w.Grade,
      GRADE_NAME_STRING_ID[w.Grade],
      GRADE_COLOR_TOKEN[w.Grade],
      w.Tier,
      w.NameStringId,
      w.DescStringId,
      w.BaseAtk,
      w.OwnEffectValue,
      w.EquipEffectValue,
      w.CurveKey,
      w['//Description'] ?? '',
    ]),
  )
  console.log(`[migration] WeaponTable에 GradeNameStringId/GradeColorToken 칼럼 추가 완료(${weaponRows.length}행).`)

  // ---- RelicTable 재작성 ----
  const relicColumns = [
    { ref: '', kor: '순번', type: 'int', eng: 'Index' },
    { ref: '', kor: 'ID', type: 'int', eng: 'Id' },
    { ref: 'EnumDefine/RelicGrade', kor: '등급', type: 'enum', eng: 'RelicGrade' },
    { ref: 'StringTable/Id', kor: '이름ID', type: 'int', eng: 'Name' },
    { ref: 'StringTable/Id', kor: '설명ID', type: 'int', eng: 'DescStringId' },
    { ref: 'StringTable/Id', kor: '등급 이름ID', type: 'int', eng: 'GradeNameStringId' },
    { ref: '', kor: '등급 색상 토큰', type: 'string', eng: 'GradeColorToken' },
    { ref: 'EnumDefine/RelicEffectType', kor: '효과 종류', type: 'enum', eng: 'EffectType' },
    { ref: '', kor: '효과 수치', type: 'float', eng: 'EffectValue' },
    { ref: '', kor: '뽑기 가중치', type: 'float', eng: 'GachaWeight' },
    { ref: '', kor: '설명', type: 'string', eng: '//Description' },
  ]
  writeDataSheet(
    workbook,
    'RelicTable',
    relicColumns,
    relicRows.map((r) => [
      r.Index,
      r.Id,
      r.RelicGrade,
      r.Name,
      r.DescStringId,
      GRADE_NAME_STRING_ID[r.RelicGrade],
      GRADE_COLOR_TOKEN[r.RelicGrade],
      r.EffectType,
      r.EffectValue,
      r.GachaWeight,
      r['//Description'] ?? '',
    ]),
  )
  console.log(`[migration] RelicTable에 GradeNameStringId/GradeColorToken 칼럼 추가 완료(${relicRows.length}행).`)

  // ---- WeaponGradeTable/GradeTable 삭제 ----
  for (const name of ['WeaponGradeTable', 'GradeTable']) {
    const ws = workbook.getWorksheet(name)
    if (ws) {
      workbook.removeWorksheet(ws.id)
      console.log(`[migration] ${name} 시트 삭제.`)
    }
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
