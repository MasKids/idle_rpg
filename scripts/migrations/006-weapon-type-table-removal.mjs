// 1회성 마이그레이션: WeaponTypeTable 삭제 — PrimaryStat을 WeaponTable 각 행에
// 직접 기입한다(같은 종류의 25행 모두 동일한 값이 반복되지만, 무기별 개별
// 조정이 가능해야 한다는 원칙을 그대로 따른 것 — WeaponTable의 다른 칼럼들과
// 동일한 패턴). 종류 이름(StringId)은 이제 어느 테이블에도 없다 — weapon.ts
// 코드에 WeaponTypeEnum → StringTable Id 매핑 3개를 직접 둔다(3종류 고정이라
// 테이블화할 실익이 없고, CommonTable은 문자열/타입별 행을 못 담는다).
//
// 실행: node scripts/migrations/006-weapon-type-table-removal.mjs
// 재실행 방지: WeaponTable에 이미 PrimaryStat 칼럼이 있으면 건너뜀.

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

const PRIMARY_STAT_BY_TYPE = { Sword: 'ATK', Spear: 'ASPD', Bow: 'CRIT' }

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const weaponWs = workbook.getWorksheet('WeaponTable')
  if (!weaponWs) throw new Error('WeaponTable 시트를 찾지 못했습니다(2단계 마이그레이션을 먼저 실행하세요).')
  const wEngRow = weaponWs.getRow(4)
  const hasPrimaryStat = Array.from({ length: weaponWs.columnCount }, (_, i) => wEngRow.getCell(i + 1).value).includes('PrimaryStat')
  if (hasPrimaryStat) {
    console.log('[migration] WeaponTable에 이미 PrimaryStat이 있습니다 — 이미 적용된 것으로 보고 건너뜁니다.')
    return
  }

  // WeaponTable 재구성: Type 칼럼 바로 뒤에 PrimaryStat 삽입
  const weaponColumns = [
    { ref: '', kor: '순번', type: 'int', eng: 'Index' },
    { ref: '', kor: 'ID', type: 'int', eng: 'Id' },
    { ref: '', kor: '무기 ID', type: 'string', eng: 'WeaponId' },
    { ref: 'EnumDefine/WeaponType', kor: '종류', type: 'enum', eng: 'Type' },
    { ref: 'EnumDefine/StatType', kor: '주스탯', type: 'enum', eng: 'PrimaryStat' },
    { ref: 'EnumDefine/WeaponGrade', kor: '등급', type: 'enum', eng: 'Grade' },
    { ref: '', kor: '단계', type: 'int', eng: 'Tier' },
    { ref: 'StringTable/Id', kor: '이름ID', type: 'int', eng: 'NameStringId' },
    { ref: 'StringTable/Id', kor: '설명ID', type: 'int', eng: 'DescStringId' },
    { ref: '', kor: '기본 공격력', type: 'float', eng: 'BaseAtk' },
    { ref: '', kor: '보유 효과값', type: 'float', eng: 'OwnEffectValue' },
    { ref: '', kor: '장착 효과값', type: 'float', eng: 'EquipEffectValue' },
    { ref: 'GrowthCurveTable/CurveKey', kor: '레벨업 곡선', type: 'string', eng: 'CurveKey' },
    { ref: '', kor: '설명', type: 'string', eng: '//Description' },
  ]
  const wLastRow = weaponWs.lastRow ? weaponWs.lastRow.number : 4
  const oldWeaponCols = {}
  for (let c = 1; c <= weaponWs.columnCount; c++) {
    const eng = wEngRow.getCell(c).value
    if (eng) oldWeaponCols[eng] = c
  }
  const weaponRows = []
  for (let r = 5; r <= wLastRow; r++) {
    const row = weaponWs.getRow(r)
    const type = row.getCell(oldWeaponCols.Type).value
    weaponRows.push([
      row.getCell(oldWeaponCols.Index).value,
      row.getCell(oldWeaponCols.Id).value,
      row.getCell(oldWeaponCols.WeaponId).value,
      type,
      PRIMARY_STAT_BY_TYPE[type],
      row.getCell(oldWeaponCols.Grade).value,
      row.getCell(oldWeaponCols.Tier).value,
      row.getCell(oldWeaponCols.NameStringId).value,
      row.getCell(oldWeaponCols.DescStringId).value,
      row.getCell(oldWeaponCols.BaseAtk).value,
      row.getCell(oldWeaponCols.OwnEffectValue).value,
      row.getCell(oldWeaponCols.EquipEffectValue).value,
      row.getCell(oldWeaponCols.CurveKey).value,
      row.getCell(oldWeaponCols['//Description']).value ?? '',
    ])
  }
  writeDataSheet(workbook, 'WeaponTable', weaponColumns, weaponRows)
  console.log(`[migration] WeaponTable에 PrimaryStat 칼럼 추가 완료(${weaponRows.length}행).`)

  const typeWs = workbook.getWorksheet('WeaponTypeTable')
  if (typeWs) {
    workbook.removeWorksheet(typeWs.id)
    console.log('[migration] WeaponTypeTable 시트 삭제.')
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
