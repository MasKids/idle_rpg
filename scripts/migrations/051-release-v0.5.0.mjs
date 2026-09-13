// 1회성 마이그레이션: v0.5.0 릴리스 발행 — PatchNoteTable에서 지금까지
// "v0.3.0"/"v0.4.0"으로 개발 중 임시로 붙여뒀던 행(실제로는 한 번도 정식
// 배포되지 않았다 — git 태그는 v0.1.0/v0.2.0뿐)을 전부 "v0.5.0" 하나로
// 합친다. SortOrder도 v0.3.0(1~6) 뒤에 v0.4.0(1~21)을 이어붙여 1~27로
// 다시 매긴다.
//
// 실행: node scripts/migrations/051-release-v0.5.0.mjs
// 재실행 방지: PatchNoteTable에 이미 "v0.5.0" 행이 있으면 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')
const RELEASE_DATE = '2026-09-13'

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const ws = workbook.getWorksheet('PatchNoteTable')
  if (!ws) throw new Error('PatchNoteTable 시트를 찾지 못했습니다.')

  const engRow = ws.getRow(4)
  let versionCol = -1
  let dateCol = -1
  let sortCol = -1
  for (let c = 1; c <= ws.columnCount; c++) {
    const v = engRow.getCell(c).value
    if (v === 'Version') versionCol = c
    if (v === 'ReleaseDate') dateCol = c
    if (v === 'SortOrder') sortCol = c
  }
  if (versionCol < 0 || dateCol < 0 || sortCol < 0) {
    throw new Error('Version/ReleaseDate/SortOrder 칼럼을 찾지 못했습니다.')
  }

  const lastRow = ws.lastRow.number
  for (let r = 5; r <= lastRow; r++) {
    if (ws.getRow(r).getCell(versionCol).value === 'v0.5.0') {
      console.log('[migration] 이미 적용됨(v0.5.0 행 존재) — 건너뜁니다.')
      return
    }
  }

  // v0.3.0 먼저(SortOrder 그대로 1~6), 이어서 v0.4.0을 6만큼 밀어서 7~27로.
  let updated = 0
  for (let r = 5; r <= lastRow; r++) {
    const row = ws.getRow(r)
    const version = row.getCell(versionCol).value
    if (version === 'v0.3.0') {
      row.getCell(versionCol).value = 'v0.5.0'
      row.getCell(dateCol).value = RELEASE_DATE
      updated += 1
    }
  }
  for (let r = 5; r <= lastRow; r++) {
    const row = ws.getRow(r)
    const version = row.getCell(versionCol).value
    if (version === 'v0.4.0') {
      const oldSort = row.getCell(sortCol).value
      row.getCell(versionCol).value = 'v0.5.0'
      row.getCell(dateCol).value = RELEASE_DATE
      row.getCell(sortCol).value = oldSort + 6
      updated += 1
    }
  }

  console.log(`[migration] PatchNoteTable: v0.3.0/v0.4.0 ${updated}행을 v0.5.0(${RELEASE_DATE})으로 통합.`)

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] 완료. 이제 `npm run balance`를 실행하세요.')
}

main()
