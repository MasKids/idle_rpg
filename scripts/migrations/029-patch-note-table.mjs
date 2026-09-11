// 1회성 마이그레이션: 게임 내 패치노트 기능을 위한 PatchNoteTable 신설.
//   - PatchNoteTable 시트 생성 (Index/Id/Version/ReleaseDate/Category/
//     TextStringId/SortOrder). 행 하나 = 패치노트 항목 하나.
//   - #EnumDefine에 PatchNoteCategory 그룹(추가/ADD, 변경/CHANGE, 수정/FIX) 추가.
//   - StringTable 55000번대에 항목별 한 줄 텍스트 추가(v0.1.0 6개, v0.2.0 6개 —
//     CHANGELOG.md를 참고하되 그대로 옮기지 않고 플레이어 체감 위주로 간결하게
//     재작성. v0.2.0 쪽은 CHANGELOG상 아직 [Unreleased]인 이번 세션 작업 중
//     플레이어가 실제로 마주치는 항목도 포함했다 — 게임에 이미 반영돼 있는
//     내용이라 인게임 패치노트에서 굳이 숨길 이유가 없다고 판단).
//
// 실행: node scripts/migrations/029-patch-note-table.mjs
// 재실행 방지: PatchNoteTable 시트가 이미 있으면 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')
const DATA_START_ROW = 5

const PATCH_NOTE_COLUMNS = [
  { ref: '', kor: '순번', type: 'int', eng: 'Index' },
  { ref: '', kor: 'ID', type: 'int', eng: 'Id' },
  { ref: '', kor: '버전', type: 'string', eng: 'Version' },
  { ref: '', kor: '출시일', type: 'string', eng: 'ReleaseDate' },
  { ref: 'EnumDefine/PatchNoteCategory', kor: '분류', type: 'enum', eng: 'Category' },
  { ref: 'StringTable/Id', kor: '내용', type: 'int', eng: 'TextStringId' },
  { ref: '', kor: '같은 버전 내 순서', type: 'int', eng: 'SortOrder' },
]

// [Version, ReleaseDate, Category, KOR 텍스트]
const PATCH_NOTES = [
  ['v0.1.0', '2026-09-10', 'ADD', '존재력 트리'],
  ['v0.1.0', '2026-09-10', 'ADD', '리버스(환생)'],
  ['v0.1.0', '2026-09-10', 'ADD', '타임 하이스트'],
  ['v0.1.0', '2026-09-10', 'ADD', '무기 가챠 · 강화'],
  ['v0.1.0', '2026-09-10', 'ADD', '유물 시스템'],
  ['v0.1.0', '2026-09-10', 'ADD', '오프라인 보상'],
  ['v0.2.0', '2026-09-11', 'ADD', '플레이어 이름 · 프로필'],
  ['v0.2.0', '2026-09-11', 'ADD', '스테이지 최초 클리어 보상'],
  ['v0.2.0', '2026-09-11', 'ADD', '랭킹'],
  ['v0.2.0', '2026-09-11', 'CHANGE', '리버스 보상 방식 개편'],
  ['v0.2.0', '2026-09-11', 'CHANGE', '전체 진행 속도 조정'],
  ['v0.2.0', '2026-09-11', 'FIX', '무기 장착 효과 밸런스'],
]

const STRING_ID_BASE = 55000
const PATCH_NOTE_ID_BASE = 33001

const ENUM_ROWS = [
  ['PatchNoteCategory', '추가', 'ADD', 'PatchNoteTable.Category'],
  ['PatchNoteCategory', '변경', 'CHANGE', 'PatchNoteTable.Category'],
  ['PatchNoteCategory', '수정', 'FIX', 'PatchNoteTable.Category'],
]

function fail(message) {
  console.error(`[migration] 오류: ${message}`)
  process.exit(1)
}

async function main() {
  if (!existsSync(XLSX_PATH)) fail(`${XLSX_PATH} 파일이 없습니다.`)

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  if (workbook.getWorksheet('PatchNoteTable')) {
    console.log('[migration] PatchNoteTable이 이미 있습니다 — 건너뜁니다.')
    return
  }

  // --- StringTable에 텍스트 추가 ---
  const stringWs = workbook.getWorksheet('StringTable')
  if (!stringWs) fail('StringTable 시트를 찾지 못했습니다.')
  const strEngRow = stringWs.getRow(4)
  const strCols = {}
  for (let c = 1; c <= stringWs.columnCount; c++) {
    const eng = strEngRow.getCell(c).value
    if (eng) strCols[String(eng)] = c
  }
  let stringRowNum = stringWs.rowCount + 1
  PATCH_NOTES.forEach(([, , , kor], i) => {
    const id = STRING_ID_BASE + i
    const row = stringWs.getRow(stringRowNum)
    row.getCell(strCols.Index).value = stringRowNum - (DATA_START_ROW - 1)
    row.getCell(strCols.Id).value = id
    row.getCell(strCols.KOR).value = kor
    row.getCell(strCols.ENG).value = kor
    if (strCols['//Category']) row.getCell(strCols['//Category']).value = 'PatchNoteTable'
    stringRowNum += 1
  })
  console.log(`[migration] StringTable에 패치노트 텍스트 ${PATCH_NOTES.length}개 추가(Id ${STRING_ID_BASE}~${STRING_ID_BASE + PATCH_NOTES.length - 1}).`)

  // --- #EnumDefine에 PatchNoteCategory 추가 ---
  const enumWs = workbook.getWorksheet('#EnumDefine')
  if (!enumWs) fail('#EnumDefine 시트를 찾지 못했습니다.')
  let enumRowNum = enumWs.rowCount + 1
  for (const values of ENUM_ROWS) {
    const row = enumWs.getRow(enumRowNum)
    values.forEach((v, i) => {
      row.getCell(i + 1).value = v
    })
    enumRowNum += 1
  }
  console.log(`[migration] #EnumDefine에 PatchNoteCategory(추가/변경/수정) 추가.`)

  // --- PatchNoteTable 시트 생성 ---
  const ws = workbook.addWorksheet('PatchNoteTable')
  PATCH_NOTE_COLUMNS.forEach((col, i) => {
    const c = i + 1
    ws.getRow(1).getCell(c).value = col.ref || null
    ws.getRow(2).getCell(c).value = col.kor
    ws.getRow(3).getCell(c).value = col.type
    ws.getRow(4).getCell(c).value = col.eng
  })
  PATCH_NOTES.forEach(([version, releaseDate, category], i) => {
    const r = DATA_START_ROW + i
    const row = ws.getRow(r)
    row.getCell(1).value = i + 1 // Index
    row.getCell(2).value = PATCH_NOTE_ID_BASE + i // Id
    row.getCell(3).value = version
    row.getCell(4).value = releaseDate
    row.getCell(5).value = category
    row.getCell(6).value = STRING_ID_BASE + i // TextStringId
    // SortOrder — 같은 버전 안에서의 순서. 버전이 바뀌면 1부터 다시.
    const isFirstOfVersion = i === 0 || PATCH_NOTES[i - 1][0] !== version
    row.getCell(7).value = isFirstOfVersion ? 1 : Number(ws.getRow(r - 1).getCell(7).value) + 1
  })

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] PatchNoteTable 생성 완료 — ${PATCH_NOTES.length}행(v0.1.0 6개, v0.2.0 6개).`)
  console.log('[migration] 다음: node scripts/migrations/020-table-define-rebuild.mjs && npm run balance')
}

main()
