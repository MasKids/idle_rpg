// 1회성 마이그레이션: StatTable/MasteryTable이 자체 CostBase/CostGrowthRate 대신
// GrowthCurveTable을 CurveKey로 참조하게 바꾼다(docs/TABLE_REDESIGN.md 2절/D).
//
// ExcelJS로는 기존 시트에서 칼럼 2개를 지우고 1개를 끼워넣는 "칼럼 구조 변경"을
// 안전하게 제자리 수정하기 어려워서(모든 셀을 밀어야 함), 두 시트는 기존 데이터를
// 전부 읽어들인 뒤 새 칼럼 구성으로 다시 쓰는 방식을 쓴다 — 값 자체는 하나도
// 잃지 않는다(StatType/이름/BaseValue/ValuePerLevel/MaxLevel 등 그대로 보존,
// CostBase/CostGrowthRate만 없어지고 CurveKey가 새로 생김). 다른 시트는 전혀
// 건드리지 않는다.
//
// #TableDefine은 이제 모든 데이터 시트의 실제 헤더(1~4행)를 그대로 읽어
// 통째로 재생성한다 — 개별 행을 찾아 지우고 끼워넣는 것보다 "지금 실제 시트
// 구조와 항상 일치"가 보장되어 더 안전하다(#TableDefine은 build-balance.mjs가
// 읽지 않는 순수 문서용 시트라 통째로 재생성해도 데이터 손실 위험이 없다).
//
// 실행: node scripts/migrations/002-stat-mastery-curve-key.mjs
// 재실행 방지: StatTable에 이미 CurveKey 칼럼이 있으면 아무것도 하지 않고 종료.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

const REF_ROW = 1
const TYPE_ROW = 3
const ENG_ROW = 4
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

function readColumns(ws) {
  const columns = []
  for (let c = 1; c <= ws.columnCount; c++) {
    const eng = ws.getRow(ENG_ROW).getCell(c).value
    if (eng === null || eng === undefined || eng === '') continue
    columns.push({
      index: c,
      eng: String(eng),
      kor: String(ws.getRow(2).getCell(c).value ?? ''),
      type: String(ws.getRow(TYPE_ROW).getCell(c).value ?? 'string'),
      ref: String(ws.getRow(REF_ROW).getCell(c).value ?? ''),
    })
  }
  return columns
}

function readRows(ws, columns) {
  const lastRow = ws.lastRow ? ws.lastRow.number : DATA_START_ROW - 1
  const rows = []
  for (let r = DATA_START_ROW; r <= lastRow; r++) {
    const row = ws.getRow(r)
    const isEmpty = columns.every((col) => row.getCell(col.index).value === null || row.getCell(col.index).value === undefined)
    if (isEmpty) continue
    const record = {}
    for (const col of columns) record[col.eng] = row.getCell(col.index).value
    rows.push(record)
  }
  return rows
}

function rewriteSheet(workbook, sheetName, newColumnDefs, rowBuilder) {
  const ws = workbook.getWorksheet(sheetName)
  if (!ws) throw new Error(`${sheetName} 시트를 찾지 못했습니다.`)

  const oldColumns = readColumns(ws)
  const oldRows = readRows(ws, oldColumns)
  const newRows = oldRows.map(rowBuilder)

  // 시트를 지우고 새로 만들면 탭 순서가 맨 뒤로 밀린다(엑셀에서 볼 때 탭
  // 위치만 바뀌는 순수 미관 문제 — 파싱/참조 무결성에는 영향 없음. workbook.
  // worksheets 배열을 직접 스플라이스해 순서를 되돌리는 것보다, 내부 id
  // 매핑을 건드리지 않는 이 방식이 더 안전하다고 판단해 순서 복원은 생략한다).
  workbook.removeWorksheet(ws.id)
  const newWs = workbook.addWorksheet(sheetName)

  const headerRows = [
    newColumnDefs.map((c) => c.ref),
    newColumnDefs.map((c) => c.kor),
    newColumnDefs.map((c) => c.type),
    newColumnDefs.map((c) => c.eng),
  ]
  const styleKeys = ['ref', 'kor', 'type', 'eng']
  headerRows.forEach((values, rIdx) => {
    const rowNum = rIdx + 1
    const key = styleKeys[rIdx]
    values.forEach((value, cIdx) => {
      const cell = newWs.getCell(rowNum, cIdx + 1)
      cell.value = value === '' ? null : value
      cell.fill = HEADER_FILLS[key]
      cell.font = HEADER_FONTS[key]
      cell.alignment = CENTER
      cell.border = THIN_BORDER
    })
  })

  newRows.forEach((rowValues, i) => {
    const excelRow = DATA_START_ROW + i
    newColumnDefs.forEach((col, cIdx) => {
      const value = rowValues[col.eng]
      const cell = newWs.getCell(excelRow, cIdx + 1)
      cell.value = value
      cell.font = { size: 9 }
      cell.border = THIN_BORDER
      cell.alignment = typeof value === 'number' || typeof value === 'boolean' ? CENTER : LEFT
    })
  })

  newWs.views = [{ state: 'frozen', ySplit: 4 }]
  const lastRow = 4 + newRows.length
  newWs.autoFilter = { from: { row: 4, column: 1 }, to: { row: lastRow, column: newColumnDefs.length } }
  newColumnDefs.forEach((col, i) => {
    const width = Math.max(10, col.eng.length + 2, col.kor.length * 1.8 + 2)
    newWs.getColumn(i + 1).width = width
  })

  return { oldColumns, rowCount: newRows.length }
}

// #TableDefine을 현재 모든 데이터 시트의 실제 헤더(1~4행)를 그대로 읽어 재생성.
// build-balance.mjs는 #TableDefine을 읽지 않으므로(순수 문서용) 통째로 다시 써도 안전하다.
function rebuildTableDefine(workbook) {
  const ws = workbook.getWorksheet('#TableDefine')
  if (!ws) throw new Error('#TableDefine 시트를 찾지 못했습니다.')
  const headers = ['테이블명', '칼럼', '칼럼명(영문)', '자료형', '칼럼 설명', '비고']

  const rows = []
  for (const sheet of workbook.worksheets) {
    if (sheet.name.startsWith('#')) continue
    const columns = readColumns(sheet)
    for (const col of columns) {
      rows.push([sheet.name, col.kor, col.eng, col.type, '', col.ref])
    }
  }
  // #EnumDefine 자체 칼럼 문서화(기존 시딩 스크립트와 동일하게 유지)
  for (const [kor, desc] of [
    ['enum 그룹', 'enum 값이 속한 그룹 이름'],
    ['한글 라벨', '기획 문서/화면에 쓰는 한글 표기'],
    ['영문 라벨', '코드가 참조하는 영문 값'],
    ['사용처', '이 enum 그룹을 참조하는 테이블.칼럼 목록'],
  ]) {
    rows.push(['#EnumDefine', kor, '', 'string', desc, ''])
  }

  workbook.removeWorksheet(ws.id)
  const newWs = workbook.addWorksheet('#TableDefine')

  headers.forEach((h, cIdx) => {
    const cell = newWs.getCell(1, cIdx + 1)
    cell.value = h
    cell.fill = HEADER_FILLS.kor
    cell.font = HEADER_FONTS.kor
    cell.alignment = CENTER
    cell.border = THIN_BORDER
  })
  rows.forEach((rowValues, i) => {
    const rowNum = 2 + i
    rowValues.forEach((value, cIdx) => {
      const cell = newWs.getCell(rowNum, cIdx + 1)
      cell.value = value
      cell.font = { size: 9 }
      cell.border = THIN_BORDER
      cell.alignment = LEFT
    })
  })
  newWs.views = [{ state: 'frozen', ySplit: 1 }]
  newWs.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + rows.length, column: headers.length } }
  headers.forEach((h, i) => {
    newWs.getColumn(i + 1).width = Math.max(12, h.length * 1.8)
  })
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const statWs = workbook.getWorksheet('StatTable')
  if (!statWs) throw new Error('StatTable 시트를 찾지 못했습니다.')
  const statColumns = readColumns(statWs)
  if (statColumns.some((c) => c.eng === 'CurveKey')) {
    console.log('[migration] StatTable에 이미 CurveKey가 있습니다 — 이미 적용된 것으로 보고 건너뜁니다.')
    return
  }

  // ---- StatTable: CostBase/CostGrowthRate 제거, CurveKey 삽입(전부 STAT_UPGRADE) ----
  const newStatColumns = [
    { ref: '', kor: '순번', type: 'int', eng: 'Index' },
    { ref: '', kor: 'ID', type: 'int', eng: 'Id' },
    { ref: '', kor: '이름', type: 'string', eng: '//Name' },
    { ref: 'EnumDefine/StatType', kor: '스탯 종류', type: 'enum', eng: 'StatType' },
    { ref: 'StringTable/Id', kor: '이름ID', type: 'int', eng: 'Name' },
    { ref: '', kor: '기본값', type: 'float', eng: 'BaseValue' },
    { ref: '', kor: '레벨당 상승치', type: 'float', eng: 'ValuePerLevel' },
    { ref: 'GrowthCurveTable/CurveKey', kor: '성장 곡선', type: 'string', eng: 'CurveKey' },
    { ref: '', kor: '최대 레벨', type: 'int', eng: 'MaxLevel' },
    { ref: '', kor: '설명', type: 'string', eng: '//Description' },
  ]
  const { rowCount: statRowCount } = rewriteSheet(workbook, 'StatTable', newStatColumns, (row) => ({
    ...row,
    CurveKey: 'STAT_UPGRADE',
  }))

  // ---- MasteryTable: CostBase/CostGrowthRate 제거, CurveKey 삽입(전부 MASTERY_UPGRADE) ----
  const newMasteryColumns = [
    { ref: '', kor: '순번', type: 'int', eng: 'Index' },
    { ref: '', kor: 'ID', type: 'int', eng: 'Id' },
    { ref: 'EnumDefine/WeaponType', kor: '무기 종류', type: 'enum', eng: 'WeaponType' },
    { ref: 'StringTable/Id', kor: '이름ID', type: 'int', eng: 'Name' },
    { ref: '', kor: '레벨당 배율', type: 'float', eng: 'MultiplierPerLevel' },
    { ref: 'GrowthCurveTable/CurveKey', kor: '성장 곡선', type: 'string', eng: 'CurveKey' },
    { ref: '', kor: '최대 레벨', type: 'int', eng: 'MaxLevel' },
  ]
  const { rowCount: masteryRowCount } = rewriteSheet(workbook, 'MasteryTable', newMasteryColumns, (row) => ({
    ...row,
    CurveKey: 'MASTERY_UPGRADE',
  }))

  rebuildTableDefine(workbook)

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] StatTable(${statRowCount}행), MasteryTable(${masteryRowCount}행)을 CurveKey 참조로 전환했습니다.`)
  console.log('[migration] #TableDefine을 현재 시트 구조 기준으로 재생성했습니다.')
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
