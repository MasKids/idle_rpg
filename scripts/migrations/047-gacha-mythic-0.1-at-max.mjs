// 1회성 마이그레이션: 신화(Mythic) 위 등급이 아직 없으므로, 최대 가챠 레벨(7)에서
// 신화 확률이 0.1%가 되도록 GachaTable 등급 가중치를 재조정한다. 046에서 복원한
// 원본 곡선은 레벨0=0.03%였지만 레벨4=1.4%까지 이미 가팔라서, 레벨5~7을 그 추세로
// 그대로 연장하면 최대 레벨에서 4.7%까지 치솟았다 — "위 등급이 생기기 전까지는
// 신화가 계속 희귀해야 한다"는 방향으로 되돌린다.
//
// 방식: 레벨별 총 가중치가 정확히 100이 되도록(신화% = 신화 가중치 그대로) 맞추고,
// 신화 가중치는 레벨0의 0.03에서 레벨7의 0.10까지 0.01씩 선형 증가시킨다. 줄어든
// 만큼(구 신화 - 새 신화)은 전부 레전드리로 옮긴다(신화 바로 아래 등급이라 "사실상의
// 최고 등급" 체감을 레전드리가 대신 맡는 셈) — 노말/레어/에픽/유니크는 그대로 둬서
// 변경 폭을 최소화했다.
//
// 실행: node scripts/migrations/047-gacha-mythic-0.1-at-max.mjs
// 재실행 방지 없음 — 항상 GachaTable을 아래 GACHA_LEVELS 기준으로 재작성한다.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')
const PULL_COST = 50 // 별도로 동결 확정된 값 — 이 마이그레이션은 손대지 않음

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
const DATA_START_ROW = 5

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

// level, requirePullCount, N,R,E,U,Leg,Mythic, T1,T2,T3,T4,T5 — 레벨별 총 가중치(N~M 합)가
// 정확히 100이 되도록 Legendary로 맞춤(그래서 MythicWeight 그대로가 곧 확률%).
const GACHA_LEVELS = [
  [0, 0, 70, 22, 6, 1.8, 0.17, 0.03, 60, 25, 10, 4, 1],
  [1, 50, 60, 27, 9, 3.3, 0.66, 0.04, 50, 27, 14, 6, 3],
  [2, 150, 50, 30, 13, 5.5, 1.45, 0.05, 42, 27, 17, 9, 5],
  [3, 350, 40, 32, 18, 8, 1.94, 0.06, 35, 26, 19, 12, 8],
  [4, 700, 30, 32, 22, 12, 3.93, 0.07, 28, 24, 20, 16, 12],
  [5, 1300, 24, 30, 24, 15, 6.92, 0.08, 23, 22, 20, 20, 16],
  [6, 2300, 19, 27, 25, 18, 10.91, 0.09, 19, 20, 19, 24, 21],
  [7, 4000, 15, 23, 25, 21, 15.9, 0.1, 15, 17, 18, 28, 26],
]

const GACHA_COLUMNS = [
  { ref: '', kor: '순번', type: 'int', eng: 'Index' },
  { ref: '', kor: 'ID', type: 'int', eng: 'Id' },
  { ref: '', kor: '가챠 레벨', type: 'int', eng: 'GachaLevel' },
  { ref: '', kor: '요구 누적 뽑기', type: 'int', eng: 'RequirePullCount' },
  { ref: '', kor: '노말 가중치', type: 'float', eng: 'NormalWeight' },
  { ref: '', kor: '레어 가중치', type: 'float', eng: 'RareWeight' },
  { ref: '', kor: '에픽 가중치', type: 'float', eng: 'EpicWeight' },
  { ref: '', kor: '유니크 가중치', type: 'float', eng: 'UniqueWeight' },
  { ref: '', kor: '레전드리 가중치', type: 'float', eng: 'LegendaryWeight' },
  { ref: '', kor: '신화 가중치', type: 'float', eng: 'MythicWeight' },
  { ref: '', kor: '1단계 가중치', type: 'float', eng: 'Tier1Weight' },
  { ref: '', kor: '2단계 가중치', type: 'float', eng: 'Tier2Weight' },
  { ref: '', kor: '3단계 가중치', type: 'float', eng: 'Tier3Weight' },
  { ref: '', kor: '4단계 가중치', type: 'float', eng: 'Tier4Weight' },
  { ref: '', kor: '5단계 가중치', type: 'float', eng: 'Tier5Weight' },
  { ref: '', kor: '뽑기 비용(다이아)', type: 'int', eng: 'PullCostDiamond' },
]

function buildGachaRows() {
  return GACHA_LEVELS.map(([level, req, n, r, e, u, leg, myth, t1, t2, t3, t4, t5], i) => [
    i + 1,
    37101 + i,
    level,
    req,
    n,
    r,
    e,
    u,
    leg,
    myth,
    t1,
    t2,
    t3,
    t4,
    t5,
    PULL_COST,
  ])
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  writeDataSheet(workbook, 'GachaTable', GACHA_COLUMNS, buildGachaRows())
  console.log('[migration] GachaTable 재작성 완료 — 신화 확률 레벨0 0.03% ~ 레벨7(최대) 0.100%로 재조정, 차액은 레전드리로 이관.')

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
