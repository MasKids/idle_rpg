// balance/balance.xlsx를 읽어 src/data/balance.json으로 변환한다.
// 시트는 3행 헤더(한글 라벨 / 영문 필드명 / 자료형) + 데이터 구조.
// 데이터 열은 A=번호, B=이름, C=key(수정 금지), D=value(수정 대상), E=기본값, F=설명 —
// 이 중 C열(key)과 D열(value)만 신뢰하고 나머지는 사람이 읽기 위한 참고용이다.

import * as fs from 'node:fs'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

// SheetJS의 ESM 빌드는 Node의 fs 모듈을 자동으로 잡지 못해 직접 연결해줘야 한다.
XLSX.set_fs(fs)

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../balance/balance.xlsx')
const JSON_PATH = resolve(__dirname, '../src/data/balance.json')

// 엑셀 시트명(한글) → balance.json/balance.ts에서 쓰는 카테고리 키
const SHEET_TO_CATEGORY = {
  전투: 'battle',
  보상: 'rewards',
  스탯: 'stats',
  장비숙련: 'equipmentMastery',
  존재력트리: 'existTree',
  타임하이스트: 'timeHeist',
  오프라인: 'offline',
}

function fail(message) {
  console.error(`[balance] 오류: ${message}`)
  process.exit(1)
}

function loadWorkbook() {
  if (!existsSync(XLSX_PATH)) {
    fail(`${XLSX_PATH} 파일이 없습니다. node scripts/generate-balance-xlsx.mjs 로 먼저 생성하세요.`)
  }

  try {
    return XLSX.readFile(XLSX_PATH)
  } catch (error) {
    fail(
      `${XLSX_PATH} 파일을 열 수 없습니다 (엑셀에서 열려 있으면 닫고 다시 시도하세요). ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

const HEADER_ROW_COUNT = 3
const COL_KEY = 2 // C열
const COL_VALUE = 3 // D열

function parseSheet(sheetName, sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
  const category = {}
  const seenKeys = new Map()

  // 앞 3행은 헤더(한글 라벨 / 영문 필드명 / 자료형). 실제 데이터는 4행부터 (엑셀 기준 행 번호 = index + 1)
  for (let i = HEADER_ROW_COUNT; i < rows.length; i++) {
    const row = rows[i]
    const excelRow = i + 1
    if (!row || row.length === 0 || row.every((cell) => cell === undefined || cell === '')) continue

    const key = row[COL_KEY]
    const value = row[COL_VALUE]

    if (typeof key !== 'string' || key.trim() === '') {
      fail(`[${sheetName}] 행 ${excelRow}: C열(key)이 비어 있습니다.`)
    }

    if (seenKeys.has(key)) {
      fail(`[${sheetName}] 행 ${excelRow}: key "${key}"가 행 ${seenKeys.get(key)}와 중복됩니다.`)
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      fail(`[${sheetName}] 행 ${excelRow}: key "${key}"의 value("${value}")가 숫자가 아닙니다.`)
    }

    seenKeys.set(key, excelRow)
    category[key] = value
  }

  return category
}

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
  for (const category of Object.keys(next)) {
    const prevCategory = previous[category] ?? {}
    const nextCategory = next[category]
    for (const key of Object.keys(nextCategory)) {
      const prevValue = prevCategory[key]
      const nextValue = nextCategory[key]
      if (prevValue !== nextValue) {
        changes.push(`  ${category}.${key}: ${prevValue ?? '(없음)'} → ${nextValue}`)
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

function main() {
  const workbook = loadWorkbook()
  const result = {}
  let totalItems = 0

  for (const [sheetName, category] of Object.entries(SHEET_TO_CATEGORY)) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) {
      fail(`balance.xlsx에 "${sheetName}" 시트가 없습니다.`)
    }
    const parsed = parseSheet(sheetName, sheet)
    result[category] = parsed
    totalItems += Object.keys(parsed).length
  }

  const previous = loadPreviousJson()
  diffAndReport(previous, result)

  writeFileSync(JSON_PATH, `${JSON.stringify(result, null, 2)}\n`)

  console.log(`[balance] 항목 ${totalItems}개를 읽어 ${JSON_PATH} 에 저장했습니다.`)
}

main()
