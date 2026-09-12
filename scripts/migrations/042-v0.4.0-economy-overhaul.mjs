// 1회성 마이그레이션: v0.4.0 보상 밸런스/콘텐츠 조정 — 대화에서 요청된 5개 항목을
// 한 스크립트에 묶었다(서로 맞물려 있어 따로 실행하면 중간 상태가 어색해진다).
//
// 1. 다이아 수급량 대폭 상향 — StageTable.FirstClearDiamond / RebirthRewardTable.
//    DiamondReward에 균일하게 ×7 적용(migration 041의 ×1.3 위에 추가로). 가챠
//    비용(뽑기당 40→60 다이아)도 함께 올려 수급 증가를 일부 상쇄한다.
// 2. 가챠 레벨을 5단계(0~4)에서 8단계(0~7)로 확장 — 누적 뽑기 요구치를
//    0/50/150/350/700/1300/2300/4000으로 늘리고, 등급/단계 가중치도 레벨이
//    오를수록 계속 고급 등급 쪽으로 기울도록 연장. 신화(Mythic) 가중치는
//    기존 곡선(레벨4=1.4)보다 훨씬 가파르게 올려 레벨7=10까지 키웠다 — "거의
//    안 나오는 수준"이라는 지적에 맞춰, 최고 레벨에서는 뽑을 때마다 체감될
//    정도로.
// 3. RelicSlotTable — 8슬롯/30노드 간격을 10슬롯/25노드 간격으로 재배치(존재력
//    트리 250에 정확히 10등분). 5번 항목(루즈 구간 제거)의 일부: 노드 60~250
//    구간에서 relic slot만으로는 27노드까지 벌어지던 "아무 해금도 없는 구간"을
//    최대 17노드로 줄인다.
//
// 신화 무기 합성 허용(요청 3번)과 유물 15종 확장(요청 4번, RelicTable 신규 6행)은
// 이미 별도로 처리됨 — 무기 합성은 nextWeaponIdForMerge(weapon.ts)가 애초에
// 등급 배열의 "마지막 등급의 마지막 단계"만 막는 구조라 Mythic1→2→3→4→5는 코드
// 변경 없이 이미 지원되고 있었다(실제 콘솔 테스트로 확인). 유물은
// scripts/append-row.mjs로 RelicTable/StringTable에 개별 추가했다.
//
// 실행: node scripts/migrations/042-v0.4.0-economy-overhaul.mjs
// 재실행 방지 없음(튜닝 중 반복 실행 전제) — 항상 "실행 시점의 현재 값"을
// 기준으로 다시 계산/덮어쓴다.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

const DIAMOND_MULTIPLIER = 7

async function scaleColumn(workbook, sheetName, columnName, multiplier) {
  const ws = workbook.getWorksheet(sheetName)
  if (!ws) throw new Error(`${sheetName} 시트를 찾지 못했습니다.`)
  const engRow = ws.getRow(4)
  let col = -1
  for (let c = 1; c <= ws.columnCount; c++) {
    if (engRow.getCell(c).value === columnName) col = c
  }
  if (col < 0) throw new Error(`${sheetName}에서 ${columnName} 칼럼을 찾지 못했습니다.`)

  const lastRow = ws.lastRow.number
  let count = 0
  for (let r = 5; r <= lastRow; r++) {
    const cell = ws.getRow(r).getCell(col)
    const oldValue = cell.value
    if (typeof oldValue !== 'number') continue
    cell.value = Math.round(oldValue * multiplier)
    count += 1
  }
  console.log(`[migration] ${sheetName}.${columnName}: ${count}행에 ×${multiplier} 적용`)
}

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

// ---- 2. 가챠 레벨 8단계 ----
const GACHA_LEVELS = [
  // level, requirePullCount, N,R,E,U,Leg,Mythic, T1,T2,T3,T4,T5, costDiamond
  [0, 0, 70, 22, 6, 1.8, 0.2, 0.05, 60, 25, 10, 4, 1, 60],
  [1, 50, 60, 27, 9, 3.3, 0.7, 0.3, 50, 27, 14, 6, 3, 60],
  [2, 150, 50, 30, 13, 5.5, 1.5, 0.8, 42, 27, 17, 9, 5, 60],
  [3, 350, 40, 32, 18, 8, 2, 1.3, 35, 26, 19, 12, 8, 60],
  [4, 700, 30, 32, 22, 12, 4, 2.5, 28, 24, 20, 16, 12, 60],
  [5, 1300, 22, 30, 24, 16, 6.5, 4.5, 22, 22, 21, 19, 16, 60],
  [6, 2300, 16, 26, 24, 19, 10, 7, 17, 19, 21, 21, 22, 60],
  [7, 4000, 10, 20, 22, 22, 16, 10, 12, 15, 19, 24, 30, 60],
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
  return GACHA_LEVELS.map(([level, req, n, r, e, u, leg, myth, t1, t2, t3, t4, t5, cost], i) => [
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
    cost,
  ])
}

// ---- 3. RelicSlotTable 10슬롯/25노드 간격 ----
const RELIC_SLOT_COLUMNS = [
  { ref: '', kor: '순번', type: 'int', eng: 'Index' },
  { ref: '', kor: 'ID', type: 'int', eng: 'Id' },
  { ref: '', kor: '슬롯 번호', type: 'int', eng: 'SlotIndex' },
  { ref: '', kor: '해금 조건(존재력 트리 해금 수)', type: 'int', eng: 'RequireUnlockedCount' },
]

function buildRelicSlotRows() {
  const intervals = [25, 50, 75, 100, 125, 150, 175, 200, 225, 250]
  return intervals.map((required, i) => [i + 1, 38101 + i, i + 1, required])
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  // 1. 다이아 수급 ×7
  await scaleColumn(workbook, 'StageTable', 'FirstClearDiamond', DIAMOND_MULTIPLIER)
  await scaleColumn(workbook, 'RebirthRewardTable', 'DiamondReward', DIAMOND_MULTIPLIER)

  // 2. 가챠 8단계 재작성
  writeDataSheet(workbook, 'GachaTable', GACHA_COLUMNS, buildGachaRows())
  console.log(`[migration] GachaTable 재작성 완료(5단계 → 8단계, 뽑기 비용 40 → 60).`)

  // 3. 유물 슬롯 10개/25노드 간격 재작성
  writeDataSheet(workbook, 'RelicSlotTable', RELIC_SLOT_COLUMNS, buildRelicSlotRows())
  console.log('[migration] RelicSlotTable 재작성 완료(8슬롯/30노드 간격 → 10슬롯/25노드 간격).')

  // #EnumDefine — 유물 등급 Legendary, 신규 유물 효과 타입 3종
  const enumWs = workbook.getWorksheet('#EnumDefine')
  if (!enumWs) throw new Error('#EnumDefine 시트를 찾지 못했습니다.')
  const alreadyApplied = (() => {
    for (let r = 1; r <= enumWs.rowCount; r++) {
      if (enumWs.getRow(r).getCell(3).value === 'GROWTH_GAIN') return true
    }
    return false
  })()
  if (alreadyApplied) {
    console.log('[migration] #EnumDefine 추가분은 이미 적용됨 — 건너뜀.')
  } else {
    const ENUM_ROWS = [
      ['RelicGrade', '레전드리', 'Legendary', 'RelicTable.RelicGrade'],
      ['RelicEffectType', '성장에너지획득량', 'GROWTH_GAIN', 'RelicTable.EffectType'],
      ['RelicEffectType', '시간에너지획득량', 'TIME_ENERGY_GAIN', 'RelicTable.EffectType'],
      ['RelicEffectType', '신화확률상승', 'GACHA_MYTHIC_CHANCE', 'RelicTable.EffectType'],
    ]
    let rowNum = enumWs.rowCount + 1
    for (const values of ENUM_ROWS) {
      const row = enumWs.getRow(rowNum)
      values.forEach((v, i) => (row.getCell(i + 1).value = v))
      rowNum += 1
    }
    console.log('[migration] #EnumDefine에 RelicGrade.Legendary + RelicEffectType 3종 추가 완료.')
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] 전체 완료. 이제 `npm run balance`를 실행하세요.')
}

main()
