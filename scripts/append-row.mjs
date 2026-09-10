// balance.xlsx의 기존 시트에 행을 "하나만" 추가하는 도구.
//
// make-balance-xlsx.py(이제 scripts/seed/seed_balance_xlsx.py)는 워크북 전체를
// 처음부터 다시 만들어서 기획자가 엑셀에서 직접 고친 값을 날려버릴 위험이 있다.
// 이 스크립트는 반대로 기존 워크북을 "열어서" 지정한 시트의 마지막 데이터 행
// 다음에 새 행 하나만 추가하고 저장한다 — 다른 시트, 다른 행은 절대 건드리지
// 않는다. StringTable에 텍스트 하나 추가하는 것처럼 "새 행 하나 늘리기"가
// 목적일 때 이 도구를 쓴다(테이블 자체를 새로 만드는 것 같은 더 큰 구조 변경은
// 별도 마이그레이션 스크립트를 쓴다).
//
// 시트는 4행 헤더(1=참조정보, 2=한글명, 3=자료형, 4=영문 칼럼명) + 5행부터
// 데이터라는 전제(build-balance.mjs와 동일). 모든 테이블의 첫 칼럼은 항상
// Index(행 번호, 자동 채움)이므로, 사용자는 그다음 칼럼(보통 Id)부터 순서대로
// 값을 넘기면 된다. "//"로 시작하는 참고용 칼럼(//Description 등)도 값을 받는
// 위치를 그대로 차지한다 — 채우고 싶지 않으면 빈 문자열("")을 넘기면 된다.
//
// 사용법:
//   node scripts/append-row.mjs <시트명> <칼럼2 값> <칼럼3 값> ... (Index 제외, 순서대로)
//   node scripts/append-row.mjs string <카테고리> <Id> <KOR> <ENG>   (StringTable 전용 단축 명령)
//
// 예:
//   node scripts/append-row.mjs GrowthCurveTable 39006 STAT_EXTRA 8 1.18 0 0 9999 "설명"
//   node scripts/append-row.mjs string GrowthUi 40135 "자동 버림" "Auto Discard"

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../balance/balance.xlsx')

const REF_ROW = 1
const TYPE_ROW = 3
const ENG_ROW = 4
const DATA_START_ROW = 5

function fail(message) {
  console.error(`[append-row] 오류: ${message}`)
  process.exit(1)
}

function isBlank(raw) {
  return raw === null || raw === undefined || raw === ''
}

function readColumns(ws) {
  const columns = []
  const colCount = ws.columnCount
  for (let c = 1; c <= colCount; c++) {
    const eng = ws.getRow(ENG_ROW).getCell(c).value
    const type = ws.getRow(TYPE_ROW).getCell(c).value
    const ref = ws.getRow(REF_ROW).getCell(c).value
    if (isBlank(eng)) continue
    columns.push({ index: c, eng: String(eng), type: isBlank(type) ? 'string' : String(type), ref: isBlank(ref) ? '' : String(ref) })
  }
  return columns
}

function convertValue(raw, type, colEng) {
  if (isBlank(raw)) {
    if (type === 'int' || type === 'float') return 0
    if (type === 'bool') return false
    return ''
  }
  switch (type) {
    case 'int': {
      const n = Number(raw)
      if (!Number.isFinite(n)) fail(`칼럼 "${colEng}": 값("${raw}")이 int인데 숫자가 아닙니다.`)
      return Math.trunc(n)
    }
    case 'float': {
      const n = Number(raw)
      if (!Number.isFinite(n)) fail(`칼럼 "${colEng}": 값("${raw}")이 float인데 숫자가 아닙니다.`)
      return n
    }
    case 'bool':
      return raw === 'true' || raw === 'TRUE' || raw === '1' || raw === true
    default:
      return String(raw)
  }
}

function nextDataRow(ws) {
  const lastRow = ws.lastRow ? ws.lastRow.number : DATA_START_ROW - 1
  return Math.max(DATA_START_ROW - 1, lastRow) + 1
}

// values: 첫 칼럼(Index)을 제외한 나머지 칼럼 값 배열 — 시트 칼럼 순서 그대로.
async function appendRow(sheetName, values) {
  if (!existsSync(XLSX_PATH)) {
    fail(`${XLSX_PATH} 파일이 없습니다. scripts/seed/seed_balance_xlsx.py로 먼저 생성하세요.`)
  }

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.readFile(XLSX_PATH)
  } catch (error) {
    fail(`${XLSX_PATH}를 열 수 없습니다(엑셀에서 열려 있으면 닫고 재시도하세요). ${error.message}`)
  }

  const ws = workbook.getWorksheet(sheetName)
  if (!ws) {
    const names = workbook.worksheets.map((s) => s.name).join(', ')
    fail(`시트 "${sheetName}"을 찾지 못했습니다. 존재하는 시트: ${names}`)
  }

  const columns = readColumns(ws)
  if (columns.length === 0) fail(`시트 "${sheetName}"에서 칼럼 정의(4행)를 읽지 못했습니다.`)
  if (columns[0].eng !== 'Index') {
    fail(`시트 "${sheetName}"의 첫 칼럼이 "Index"가 아닙니다(${columns[0].eng}) — 이 도구는 첫 칼럼이 Index(자동 채움)라고 전제합니다.`)
  }

  const dataColumns = columns.slice(1) // Index 제외
  if (values.length !== dataColumns.length) {
    const list = dataColumns.map((c) => `${c.eng}(${c.type})`).join(', ')
    fail(
      `"${sheetName}"은 Index를 제외하고 ${dataColumns.length}개 칼럼이 필요한데 ${values.length}개를 받았습니다.\n` +
        `  필요한 칼럼 순서: ${list}`,
    )
  }

  const rowNum = nextDataRow(ws)
  const index = rowNum - (DATA_START_ROW - 1)

  const idColumn = dataColumns.find((c) => c.eng === 'Id')
  if (idColumn) {
    const idValue = convertValue(values[dataColumns.indexOf(idColumn)], idColumn.type, 'Id')
    for (let r = DATA_START_ROW; r < rowNum; r++) {
      if (ws.getRow(r).getCell(idColumn.index).value === idValue) {
        fail(`Id ${idValue}가 "${sheetName}" 행 ${r}과 중복됩니다.`)
      }
    }
  }

  ws.getRow(rowNum).getCell(1).value = index
  dataColumns.forEach((col, i) => {
    ws.getRow(rowNum).getCell(col.index).value = convertValue(values[i], col.type, col.eng)
  })

  await workbook.xlsx.writeFile(XLSX_PATH)

  console.log(`[append-row] "${sheetName}" 시트 ${rowNum}행(Index=${index})에 추가했습니다.`)
  dataColumns.forEach((col, i) => {
    console.log(`  ${col.eng} = ${JSON.stringify(convertValue(values[i], col.type, col.eng))}`)
  })
  console.log('[append-row] 이제 `npm run balance`를 실행해 src/data/balance.json에 반영하세요.')
}

// ---------------------------------------------------------------------------
// StringTable 전용 단축 명령 — node scripts/append-row.mjs string <카테고리> <Id> <KOR> <ENG>
// StringTable의 실제 칼럼 순서(Id, KOR, ENG, //Category)로 재배열해서 appendRow에 넘긴다.
// ---------------------------------------------------------------------------
async function appendStringShortcut(args) {
  if (args.length !== 4) {
    fail('string 단축 명령은 <카테고리> <Id> <KOR> <ENG> 4개 인자가 필요합니다.')
  }
  const [category, id, kor, eng] = args
  await appendRow('StringTable', [id, kor, eng, category])
}

async function main() {
  const [, , sheetName, ...rest] = process.argv
  if (!sheetName) {
    console.error(
      [
        '사용법:',
        '  node scripts/append-row.mjs <시트명> <칼럼2 값> <칼럼3 값> ...',
        '  node scripts/append-row.mjs string <카테고리> <Id> <KOR> <ENG>',
      ].join('\n'),
    )
    process.exit(1)
  }

  if (sheetName.toLowerCase() === 'string') {
    await appendStringShortcut(rest)
  } else {
    await appendRow(sheetName, rest)
  }
}

main()
