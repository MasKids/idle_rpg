// 1회성 마이그레이션: GachaTable 등급/단계 가중치를 042(경제 개편)에서 손댄
// 이전으로 복원(레벨 0~4는 5433c49 커밋 — 무기 150종 확장, Mythic 등급 신설
// 당시의 값 그대로)하고, 그 위에 레벨 5~7을 새로 얹어 8단계로 확장한다.
//
// 복원 대상(레벨 0~4, 042 이전 원본 — git show 5433c49:src/data/balance.json):
//   L0: N70 R22 E6 U1.8 Leg0.2 M0.03 | T1:60 T2:25 T3:10 T4:4 T5:1
//   L1: N60 R27 E9 U3.3 Leg0.7 M0.15 | T1:50 T2:27 T3:14 T4:6 T5:3
//   L2: N50 R30 E13 U5.5 Leg1.5 M0.4 | T1:42 T2:27 T3:17 T4:9 T5:5
//   L3: N40 R32 E18 U8 Leg2 M0.6 | T1:35 T2:26 T3:19 T4:12 T5:8
//   L4: N30 R32 E22 U12 Leg4 M1.4 | T1:28 T2:24 T3:20 T4:16 T5:12
// (PullCostDiamond은 이 마이그레이션이 건드리지 않는다 — 별도로 50 동결 확정됨.)
//
// 레벨 5~7은 원본 곡선의 추세를 그대로 연장해서 손으로 설계했다(042처럼 새
// 곡선을 만든 게 아니라, 원본이 실제로 보이던 변화폭 — 노말 -10/-8/-7/-7,
// 레어 +5/+3/+2/+0, 에픽 +3/+4/+5/+4, 유니크 +1.5/+2.2/+2.5/+4, 레전드리
// ×3.5/×2.14/×1.33/×2, 신화 ×5/×2.67/×1.5/×2.33 — 를 감쇠시키며 이어감).
// 요구 누적 뽑기(RequirePullCount)의 700 이후 곡선(1300/2300/4000)은 042에서도
// 이미 원본의 배증 패턴(50→100→200→350, 매번 ×1.7~2)을 그대로 연장한 값이라
// 다시 손대지 않았다.
//
// 실행: node scripts/migrations/046-gacha-restore-and-extend.mjs
// 재실행 방지 없음 — 항상 GachaTable 전체를 아래 GACHA_LEVELS 기준으로 재작성한다.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')
const KEEP_PULL_COST = 50 // 별도로 동결 확정된 값 — 이 마이그레이션은 손대지 않음

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

// level, requirePullCount, N,R,E,U,Leg,Mythic, T1,T2,T3,T4,T5
const GACHA_LEVELS = [
  // --- 0~4: 원본(042 이전) 그대로 복원 ---
  [0, 0, 70, 22, 6, 1.8, 0.2, 0.03, 60, 25, 10, 4, 1],
  [1, 50, 60, 27, 9, 3.3, 0.7, 0.15, 50, 27, 14, 6, 3],
  [2, 150, 50, 30, 13, 5.5, 1.5, 0.4, 42, 27, 17, 9, 5],
  [3, 350, 40, 32, 18, 8, 2, 0.6, 35, 26, 19, 12, 8],
  [4, 700, 30, 32, 22, 12, 4, 1.4, 28, 24, 20, 16, 12],
  // --- 5~7: 원본 추세를 감쇠시키며 연장(신규) ---
  [5, 1300, 24, 30, 24, 15, 6, 2.2, 23, 22, 20, 20, 16],
  [6, 2300, 19, 27, 25, 18, 9, 3.3, 19, 20, 19, 24, 21],
  [7, 4000, 15, 23, 25, 21, 13, 4.8, 15, 17, 18, 28, 26],
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
    KEEP_PULL_COST,
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
  console.log('[migration] GachaTable 재작성 완료 — 레벨 0~4 원본 확률 복원, 5~7 신규 추가(8단계).')

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
