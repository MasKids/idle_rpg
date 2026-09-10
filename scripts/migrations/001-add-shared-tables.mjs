// 1회성 마이그레이션: 테이블 개편 1단계(docs/TABLE_REDESIGN.md 2절/C) —
// GrowthCurveTable / CurrencyTable / GradeTable 3개 신규 시트를 balance.xlsx에
// 추가한다. 기존 시트/행은 전혀 건드리지 않는다(새 시트 3개 추가 + #TableDefine·
// #EnumDefine에 새 시트/enum 설명 행 추가만 한다).
//
// scripts/append-row.mjs는 "이미 있는 시트에 행 하나 추가"만 할 수 있어서, 시트
// 자체를 새로 만드는 이번 작업은 별도 마이그레이션 스크립트로 처리한다
// (docs/TABLE_REDESIGN.md 5절 제안대로).
//
// 실행: node scripts/migrations/001-add-shared-tables.mjs
// 재실행 방지: 이미 GrowthCurveTable 시트가 있으면 아무것도 하지 않고 종료한다.

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

// columns: [{ ref, kor, type, eng, desc }]; rows: [[value, ...]]
function writeDataSheet(workbook, sheetName, columns, rows) {
  const ws = workbook.addWorksheet(sheetName)
  const headerRows = [
    columns.map((c) => c.ref),
    columns.map((c) => c.kor),
    columns.map((c) => c.type),
    columns.map((c) => c.eng),
  ]
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
    const width = Math.max(10, col.eng.length + 2, col.kor.length * 1.8 + 2)
    ws.getColumn(i + 1).width = width
  })
}

function appendTableDefineRows(workbook, rows) {
  const ws = workbook.getWorksheet('#TableDefine')
  if (!ws) throw new Error('#TableDefine 시트를 찾지 못했습니다.')
  let nextRow = (ws.lastRow ? ws.lastRow.number : 1) + 1
  for (const row of rows) {
    row.forEach((value, cIdx) => {
      const cell = ws.getCell(nextRow, cIdx + 1)
      cell.value = value
      cell.font = { size: 9 }
      cell.border = THIN_BORDER
      cell.alignment = LEFT
    })
    nextRow += 1
  }
  const lastCol = ws.columnCount
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: nextRow - 1, column: lastCol } }
}

function appendEnumDefineRows(workbook, rows) {
  const ws = workbook.getWorksheet('#EnumDefine')
  if (!ws) throw new Error('#EnumDefine 시트를 찾지 못했습니다.')
  let nextRow = (ws.lastRow ? ws.lastRow.number : 1) + 1
  for (const row of rows) {
    row.forEach((value, cIdx) => {
      const cell = ws.getCell(nextRow, cIdx + 1)
      cell.value = value
      cell.font = { size: 9 }
      cell.border = THIN_BORDER
      cell.alignment = LEFT
    })
    nextRow += 1
  }
  const lastCol = ws.columnCount
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: nextRow - 1, column: lastCol } }
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  if (workbook.getWorksheet('GrowthCurveTable')) {
    console.log('[migration] GrowthCurveTable이 이미 있습니다 — 이 마이그레이션은 이미 적용된 것으로 보고 건너뜁니다.')
    return
  }

  // ---------------------------------------------------------------------
  // GrowthCurveTable — StatTable/MasteryTable/WeaponUpgradeTable에 흩어진
  // "비용 = Base × GrowthRate^n" 성장 곡선을 한 곳으로 모은다.
  // ValueBase/ValuePerLevel/MaxLevel은 이번 단계에서 아직 참조 전환하지 않는
  // 여유 칼럼(스탯마다 값이 달라 지금은 각 테이블이 자체 보유) — 0으로 시딩.
  // ---------------------------------------------------------------------
  const growthCurveColumns = [
    { ref: '', kor: '행 번호', type: 'int', eng: 'Index', desc: '' },
    { ref: '', kor: 'Id', type: 'int', eng: 'Id', desc: '' },
    { ref: '', kor: '곡선 키', type: 'string', eng: 'CurveKey', desc: '다른 테이블이 참조하는 고유 식별자' },
    { ref: '', kor: '비용 기준값', type: 'float', eng: 'CostBase', desc: '' },
    { ref: '', kor: '비용 증가율', type: 'float', eng: 'CostGrowthRate', desc: '비용 = CostBase × CostGrowthRate^레벨' },
    { ref: '', kor: '효과값 기준(예비)', type: 'float', eng: 'ValueBase', desc: '이번 단계 미사용 — 향후 값 곡선 통합용' },
    { ref: '', kor: '레벨당 효과 증가(예비)', type: 'float', eng: 'ValuePerLevel', desc: '이번 단계 미사용 — 향후 값 곡선 통합용' },
    { ref: '', kor: '최대 레벨', type: 'int', eng: 'MaxLevel', desc: '' },
    { ref: '', kor: '설명', type: 'string', eng: '//Description', desc: '파싱 제외, 참고용' },
  ]
  const growthCurveRows = [
    [1, 39001, 'STAT_UPGRADE', 8, 1.18, 0, 0, 9999, 'StatTable 5행 전부가 참조 — 성장에너지 스탯 업그레이드 비용'],
    [2, 39002, 'MASTERY_UPGRADE', 10, 1.25, 0, 0, 9999, 'MasteryTable 3행(검/창/활) 전부가 참조 — 숙련의 정수 업그레이드 비용'],
    [3, 39003, 'WEAPON_LEVEL_UP', 15, 1.2, 0, 0, 0, '(구)WeaponUpgradeTable.LevelCostBase/LevelCostGrowthRate 값 — 참조 전환은 다음 단계'],
  ]
  writeDataSheet(workbook, 'GrowthCurveTable', growthCurveColumns, growthCurveRows)

  // ---------------------------------------------------------------------
  // CurrencyTable — 재화 6종의 리버스 초기화/환급/HUD 노출 속성.
  // ResetOnRebirth/RefundOnRebirth 값은 gameStore.ts의 executeRebirth() 실제
  // 동작을 그대로 옮겼다 — 지금 당장 이 값을 읽어서 동작을 바꾸는 코드는 없다
  // (참조 전환은 다음 단계, 이번엔 스키마+데이터만).
  // ---------------------------------------------------------------------
  const currencyColumns = [
    { ref: '', kor: '행 번호', type: 'int', eng: 'Index', desc: '' },
    { ref: '', kor: 'Id', type: 'int', eng: 'Id', desc: '' },
    { ref: 'EnumDefine/CurrencyType', kor: '재화 종류', type: 'enum', eng: 'Type', desc: '' },
    { ref: 'StringTable/Id', kor: '이름', type: 'int', eng: 'NameStringId', desc: '' },
    { ref: '', kor: '리버스 시 초기화', type: 'bool', eng: 'ResetOnRebirth', desc: '' },
    { ref: '', kor: '리버스 시 환급', type: 'bool', eng: 'RefundOnRebirth', desc: '누적 소비량 × 환급 배율만큼 지급' },
    { ref: '', kor: 'HUD 표시', type: 'bool', eng: 'ShowInHUD', desc: '전투 화면 상단 재화 칩에 보일지' },
    { ref: '', kor: '정렬 순서', type: 'int', eng: 'SortOrder', desc: '' },
    { ref: '', kor: '설명', type: 'string', eng: '//Description', desc: '파싱 제외, 참고용' },
  ]
  const currencyRows = [
    [1, 39101, 'DIAMOND', 40075, false, false, true, 1, '리버스 시 환급 대상 아님 — RebirthRewardTable로 별도 신규 지급(환급과 다른 메커니즘)'],
    [2, 39102, 'EXIST', 40015, false, false, true, 2, '존재력 트리 해금에 씀 — 리버스로 사라지지 않음'],
    [3, 39103, 'GROWTH_ENERGY', 40016, false, true, true, 3, ''],
    [4, 39104, 'GOLD', 40019, false, true, true, 4, ''],
    [5, 39105, 'MASTERY_ESSENCE', 40017, false, true, false, 5, '성장 탭 숙련 하위탭에서만 표시'],
    [6, 39106, 'TIME_ENERGY', 40018, false, false, false, 6, '유물 탭·타임 하이스트 모달에서만 표시'],
  ]
  writeDataSheet(workbook, 'CurrencyTable', currencyColumns, currencyRows)

  // ---------------------------------------------------------------------
  // GradeTable — WeaponGradeTable을 대체할 무기/유물 공용 등급 테이블.
  // 이번 단계에서는 WeaponGradeTable을 아직 지우지 않는다(같이 존재) — 코드
  // 참조 전환은 다음 단계(WeaponTable 75행 신설과 함께 처리하는 쪽이 자연스러움).
  // ---------------------------------------------------------------------
  const gradeColumns = [
    { ref: '', kor: '행 번호', type: 'int', eng: 'Index', desc: '' },
    { ref: '', kor: 'Id', type: 'int', eng: 'Id', desc: '' },
    { ref: 'EnumDefine/WeaponGrade', kor: '등급', type: 'enum', eng: 'GradeKey', desc: '기존 WeaponGrade enum 재사용' },
    { ref: 'StringTable/Id', kor: '이름', type: 'int', eng: 'NameStringId', desc: '' },
    { ref: '', kor: '색 토큰', type: 'string', eng: 'ColorToken', desc: 'CSS 변수 접미사, 예: var(--color-grade-{token})' },
    { ref: '', kor: '기준 배율', type: 'float', eng: 'BaseMultiplier', desc: '' },
    { ref: 'EnumDefine/GradeUsedByType', kor: '사용처', type: 'enum', eng: 'UsedBy', desc: '' },
    { ref: '', kor: '정렬 순서', type: 'int', eng: 'SortOrder', desc: '' },
  ]
  const gradeRows = [
    [1, 39201, 'Normal', 40058, 'normal', 1, 'Both', 1],
    [2, 39202, 'Rare', 40059, 'rare', 2, 'Both', 2],
    [3, 39203, 'Epic', 40060, 'epic', 4, 'Both', 3],
    [4, 39204, 'Unique', 40061, 'unique', 8, 'Weapon', 4],
    [5, 39205, 'Legendary', 40062, 'legendary', 16, 'Weapon', 5],
  ]
  writeDataSheet(workbook, 'GradeTable', gradeColumns, gradeRows)

  // ---------------------------------------------------------------------
  // #EnumDefine — CurrencyType에 DIAMOND 추가(ExistTreeTable.GrantCurrency는
  // 다이아를 지급한 적이 없어 지금까지 없었다) + GradeUsedByType 신규 그룹.
  // ---------------------------------------------------------------------
  appendEnumDefineRows(workbook, [
    ['CurrencyType', '다이아', 'DIAMOND', 'CurrencyTable.Type(신규) — ExistTreeTable.GrantCurrency는 다이아를 지급하지 않아 기존엔 없었음'],
    ['GradeUsedByType', '무기', 'Weapon', 'GradeTable.UsedBy'],
    ['GradeUsedByType', '유물', 'Relic', 'GradeTable.UsedBy'],
    ['GradeUsedByType', '공용', 'Both', 'GradeTable.UsedBy'],
  ])

  // ---------------------------------------------------------------------
  // #TableDefine — 신규 테이블 3개 문서화
  // ---------------------------------------------------------------------
  const tableDefineRows = []
  for (const [tableName, columns] of [
    ['GrowthCurveTable', growthCurveColumns],
    ['CurrencyTable', currencyColumns],
    ['GradeTable', gradeColumns],
  ]) {
    for (const col of columns) {
      tableDefineRows.push([tableName, col.kor, col.eng, col.type, col.desc, col.ref])
    }
  }
  appendTableDefineRows(workbook, tableDefineRows)

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] GrowthCurveTable(3행) / CurrencyTable(6행) / GradeTable(5행) 추가 완료.')
  console.log('[migration] #TableDefine / #EnumDefine(CurrencyType.DIAMOND, GradeUsedByType 신규)에도 반영했습니다.')
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
