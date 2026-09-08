// balance/balance.xlsx(상용 게임 데이터 테이블 형식)를 읽어 src/data/balance.json으로 변환한다.
//
// 시트 구조: 1행(참조정보)/2행(한글명)/3행(자료형)은 메타 정보일 뿐 출력에 안 들어간다.
// 4행의 영문 칼럼명이 실제 키. //로 시작하는 칼럼(기획자용 주석)은 출력에서 제외.
// 5행부터 데이터. 시트명이 #으로 시작하면(#TableDefine, #EnumDefine) 통째로 제외.
//
// 출력: { "StageTable": [...], "StatTable": [...], ... } — 테이블별 행 객체 배열.

import ExcelJS from 'exceljs'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../balance/balance.xlsx')
const JSON_PATH = resolve(__dirname, '../src/data/balance.json')

const REF_ROW = 1
// 2행(한글명)은 사람이 읽는 용도라 파싱에서 그냥 건너뛴다 (읽지도 않음)
const TYPE_ROW = 3
const ENG_ROW = 4
const DATA_START_ROW = 5

const errors = []
const warnings = []

function fail(message) {
  errors.push(message)
  console.error(`[balance] 오류: ${message}`)
}

function isBlank(raw) {
  return raw === null || raw === undefined || raw === ''
}

function toNumberOrNull(raw) {
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : null
}

// ---------------------------------------------------------------------------
// 워크북 로드
// ---------------------------------------------------------------------------

async function loadWorkbook() {
  if (!existsSync(XLSX_PATH)) {
    fail(`${XLSX_PATH} 파일이 없습니다. balance/balance.xlsx를 먼저 준비하세요.`)
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.readFile(XLSX_PATH)
  } catch (error) {
    console.error(
      `[balance] 오류: ${XLSX_PATH} 파일을 열 수 없습니다 (엑셀에서 열려 있으면 닫고 다시 시도하세요). ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    process.exit(1)
  }
  return workbook
}

// ---------------------------------------------------------------------------
// #EnumDefine — enum 그룹별 유효 영문 라벨 집합
// ---------------------------------------------------------------------------

function parseEnumDefine(workbook) {
  const ws = workbook.getWorksheet('#EnumDefine')
  const enumMap = new Map() // group -> Set<string>
  if (!ws) {
    warnings.push('#EnumDefine 시트를 찾지 못해 enum 값 검증을 건너뜁니다.')
    return enumMap
  }

  const lastRow = ws.lastRow ? ws.lastRow.number : 0
  for (let r = 2; r <= lastRow; r++) {
    const row = ws.getRow(r)
    const group = row.getCell(1).value
    const engLabel = row.getCell(3).value
    if (isBlank(group) || isBlank(engLabel)) continue
    if (!enumMap.has(group)) enumMap.set(group, new Set())
    enumMap.get(group).add(String(engLabel))
  }
  return enumMap
}

// ---------------------------------------------------------------------------
// 데이터 시트 1개 파싱
// ---------------------------------------------------------------------------

function parseColumnDefs(ws) {
  const columns = []
  const colCount = ws.columnCount
  for (let c = 1; c <= colCount; c++) {
    const ref = ws.getRow(REF_ROW).getCell(c).value
    const type = ws.getRow(TYPE_ROW).getCell(c).value
    const eng = ws.getRow(ENG_ROW).getCell(c).value
    if (isBlank(eng)) continue // 헤더가 아예 없는 빈 칼럼은 스킵
    columns.push({
      index: c,
      ref: isBlank(ref) ? '' : String(ref),
      type: isBlank(type) ? 'string' : String(type),
      eng: String(eng),
      isComment: String(eng).startsWith('//'),
    })
  }
  return columns
}

function convertCell(raw, type, sheetName, rowNum, colEng) {
  switch (type) {
    case 'int': {
      if (isBlank(raw)) return 0
      const n = toNumberOrNull(raw)
      if (n === null) {
        fail(`[${sheetName}] 행 ${rowNum}, 칼럼 "${colEng}": 값("${raw}")이 int인데 숫자가 아닙니다.`)
        return 0
      }
      return Math.trunc(n)
    }
    case 'float': {
      if (isBlank(raw)) return 0
      const n = toNumberOrNull(raw)
      if (n === null) {
        fail(`[${sheetName}] 행 ${rowNum}, 칼럼 "${colEng}": 값("${raw}")이 float인데 숫자가 아닙니다.`)
        return 0
      }
      return n
    }
    case 'bool': {
      if (raw === true) return true
      if (raw === 1) return true
      if (typeof raw === 'string' && ['true', 'TRUE'].includes(raw.trim())) return true
      return false
    }
    case 'enum':
      return isBlank(raw) ? '' : String(raw)
    case 'string':
    default:
      return isBlank(raw) ? '' : String(raw)
  }
}

function isRowEmpty(ws, rowNum, colCount) {
  for (let c = 1; c <= colCount; c++) {
    if (!isBlank(ws.getRow(rowNum).getCell(c).value)) return false
  }
  return true
}

function parseDataSheet(ws) {
  const sheetName = ws.name
  const columns = parseColumnDefs(ws)
  const outputColumns = columns.filter((col) => !col.isComment)
  const idColumn = outputColumns.find((col) => col.eng === 'Id')

  const rows = []
  const seenIds = new Map() // id -> rowNum (중복 검사용)
  const lastRow = ws.lastRow ? ws.lastRow.number : 0
  const colCount = ws.columnCount

  for (let r = DATA_START_ROW; r <= lastRow; r++) {
    if (isRowEmpty(ws, r, colCount)) continue

    const record = {}
    for (const col of outputColumns) {
      const raw = ws.getRow(r).getCell(col.index).value
      record[col.eng] = convertCell(raw, col.type, sheetName, r, col.eng)
    }

    if (idColumn) {
      const id = record.Id
      if (seenIds.has(id)) {
        fail(`[${sheetName}] 행 ${r}: Id ${id}가 행 ${seenIds.get(id)}와 중복됩니다.`)
      } else {
        seenIds.set(id, r)
      }
    }

    record.__row = r // 검증 메시지용, 최종 출력 전에 제거
    rows.push(record)
  }

  return { columns, rows }
}

// ---------------------------------------------------------------------------
// 참조 칼럼 검증 (enum 값 / TableName.Id FK) — 모든 시트를 먼저 파싱한 뒤 2차로 수행
// ---------------------------------------------------------------------------

function validateReferences(sheetSchemas, enumMap, idSets) {
  for (const [sheetName, { columns, rows }] of sheetSchemas) {
    for (const col of columns) {
      if (col.isComment || !col.ref) continue

      const [refTarget, refField] = col.ref.split('/')

      if (refTarget === 'EnumDefine') {
        const validValues = enumMap.get(refField)
        for (const row of rows) {
          const value = row[col.eng]
          if (value === '' || value === undefined) continue
          if (!validValues || !validValues.has(value)) {
            fail(
              `[${sheetName}] 행 ${row.__row}, 칼럼 "${col.eng}": 값 "${value}"이 #EnumDefine의 "${refField}" 그룹에 정의되지 않았습니다.`,
            )
          }
        }
        continue
      }

      // TableName/Id 형식의 FK 참조
      if (refField === 'Id') {
        const targetIds = idSets.get(refTarget)
        if (!targetIds) {
          warnings.push(`[${sheetName}] 칼럼 "${col.eng}"이 존재하지 않는 테이블 "${refTarget}"을 참조합니다 (검증 스킵).`)
          continue
        }
        for (const row of rows) {
          const value = row[col.eng]
          if (value === 0 || value === '' || value === undefined) continue // 0/빈값 = 참조 없음으로 취급
          if (!targetIds.has(value)) {
            fail(
              `[${sheetName}] 행 ${row.__row}, 칼럼 "${col.eng}": 값 ${value}이 ${refTarget}에 존재하지 않는 Id입니다.`,
            )
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 이전 balance.json과 비교
// ---------------------------------------------------------------------------

function loadPreviousJson() {
  if (!existsSync(JSON_PATH)) return null
  try {
    return JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
  } catch {
    return null
  }
}

function diffAndReport(previous, next) {
  if (!previous) {
    console.log('[balance] 이전 balance.json이 없어 비교를 건너뜁니다 (최초 생성).')
    return
  }

  const changes = []
  for (const tableName of Object.keys(next)) {
    const prevRows = new Map((previous[tableName] ?? []).map((row) => [row.Id, row]))
    for (const row of next[tableName]) {
      const prevRow = prevRows.get(row.Id)
      if (!prevRow) {
        changes.push(`  ${tableName}#${row.Id}: (신규 행)`)
        continue
      }
      for (const field of Object.keys(row)) {
        if (prevRow[field] !== row[field]) {
          changes.push(`  ${tableName}#${row.Id}.${field}: ${prevRow[field]} → ${row[field]}`)
        }
      }
    }
    for (const prevRow of previous[tableName] ?? []) {
      if (!next[tableName].some((row) => row.Id === prevRow.Id)) {
        changes.push(`  ${tableName}#${prevRow.Id}: (삭제됨)`)
      }
    }
  }

  if (changes.length === 0) {
    console.log('[balance] 이전 값과 달라진 항목 없음.')
  } else {
    console.log(`[balance] 변경된 항목 ${changes.length}개:`)
    changes.forEach((line) => console.log(line))
  }
}

// ---------------------------------------------------------------------------
// 메인
// ---------------------------------------------------------------------------

async function main() {
  const workbook = await loadWorkbook()
  const enumMap = parseEnumDefine(workbook)

  const sheetSchemas = [] // [sheetName, { columns, rows }][]
  for (const ws of workbook.worksheets) {
    if (ws.name.startsWith('#')) continue
    sheetSchemas.push([ws.name, parseDataSheet(ws)])
  }

  const idSets = new Map()
  for (const [sheetName, { rows }] of sheetSchemas) {
    idSets.set(
      sheetName,
      new Set(rows.map((row) => row.Id).filter((id) => id !== undefined)),
    )
  }

  validateReferences(sheetSchemas, enumMap, idSets)

  if (errors.length > 0) {
    console.error(`[balance] 검증 실패: 오류 ${errors.length}건. balance.json을 갱신하지 않았습니다.`)
    process.exit(1)
  }

  const result = {}
  console.log('[balance] 시트별 읽은 행 수:')
  for (const [sheetName, { rows }] of sheetSchemas) {
    const cleanRows = rows.map(({ __row, ...rest }) => rest)
    result[sheetName] = cleanRows
    console.log(`  - ${sheetName}: ${cleanRows.length}행`)
  }

  const previous = loadPreviousJson()
  diffAndReport(previous, result)

  if (warnings.length > 0) {
    console.log(`[balance] 검증 경고 ${warnings.length}건:`)
    warnings.forEach((line) => console.log(`  ${line}`))
  }

  writeFileSync(JSON_PATH, `${JSON.stringify(result, null, 2)}\n`)

  const totalRows = Object.values(result).reduce((sum, rows) => sum + rows.length, 0)
  console.log(`[balance] 테이블 ${Object.keys(result).length}개, 총 ${totalRows}행을 ${JSON_PATH} 에 저장했습니다.`)
}

main()
