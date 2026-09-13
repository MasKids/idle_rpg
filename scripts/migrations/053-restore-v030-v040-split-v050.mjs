// 1회성 마이그레이션: migration 051이 PatchNoteTable의 v0.3.0(6행)·v0.4.0(21행)을
// v0.5.0 하나로 합친 것을 되돌린다. v0.3.0/v0.4.0을 한 번도 실제로 릴리스한 적이
// 없다는 이유로 통합했었는데, 플레이어 대상 패치노트 화면에서 v0.3.0/v0.4.0
// 이력 자체가 사라져버리는 부작용이 있어 되돌리기로 했다.
//
// 되돌리는 기준(커밋 로그로 재구성, docs 참고):
// - v0.3.0(2026-09-11): 현재 SortOrder 1~6 그대로 v0.3.0으로 복원
// - v0.4.0(2026-09-13): 현재 SortOrder 7~23(원래 v0.4.0의 1~17번)을 v0.4.0으로 복원.
//   원래 v0.4.0의 18~21번(다이아 하향/존재력 하향/다중크리 하향/후반부 HP 상승)은
//   전부 "release v0.5.0" 커밋(ce48876/5cb9f7e, 2026-09-13 19시대) 이후에 벌어진
//   별도의 밸런스 교정 배치라 v0.5.0으로 남긴다.
// - v0.5.0(2026-09-13): 현재 SortOrder 24~27(다이아 하향/존재력 하향/다중크리 하향/
//   후반부 HP 상승) + 오늘 추가된 "다이아 최소 지급량 상향" 1건, 총 5건.
//
// 실행: node scripts/migrations/053-restore-v030-v040-split-v050.mjs
// 재실행 방지: PatchNoteTable에 "스테이지 다이아 최소 지급량 상향" 문구가 이미
// 있으면 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

const NEW_STRING_ID = 55045
const NEW_STRING_KOR = '스테이지 다이아 최소 지급량 상향'
const NEW_STRING_ENG = 'Stage diamond minimum reward increased'

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const stringWs = workbook.getWorksheet('StringTable')
  const patchWs = workbook.getWorksheet('PatchNoteTable')
  if (!stringWs || !patchWs) throw new Error('StringTable/PatchNoteTable 시트를 찾지 못했습니다.')

  // 재실행 방지
  {
    const engRow = stringWs.getRow(4)
    let korCol = -1
    for (let c = 1; c <= stringWs.columnCount; c++) if (engRow.getCell(c).value === 'KOR') korCol = c
    const lastRow = stringWs.lastRow.number
    for (let r = 5; r <= lastRow; r++) {
      if (stringWs.getRow(r).getCell(korCol).value === NEW_STRING_KOR) {
        console.log('[migration] 이미 적용됨 — 건너뜁니다.')
        return
      }
    }
  }

  // PatchNoteTable 칼럼 찾기
  const engRow = patchWs.getRow(4)
  let idCol = -1
  let versionCol = -1
  let dateCol = -1
  let categoryCol = -1
  let textIdCol = -1
  let sortCol = -1
  for (let c = 1; c <= patchWs.columnCount; c++) {
    const v = engRow.getCell(c).value
    if (v === 'Id') idCol = c
    if (v === 'Version') versionCol = c
    if (v === 'ReleaseDate') dateCol = c
    if (v === 'Category') categoryCol = c
    if (v === 'TextStringId') textIdCol = c
    if (v === 'SortOrder') sortCol = c
  }
  if ([idCol, versionCol, dateCol, categoryCol, textIdCol, sortCol].some((c) => c < 0)) {
    throw new Error('PatchNoteTable 칼럼을 찾지 못했습니다.')
  }

  const lastRow = patchWs.lastRow.number
  let maxId = 0
  let v30 = 0
  let v40 = 0
  let v50 = 0
  for (let r = 5; r <= lastRow; r++) {
    const row = patchWs.getRow(r)
    const id = row.getCell(idCol).value
    if (typeof id === 'number' && id > maxId) maxId = id
    if (row.getCell(versionCol).value !== 'v0.5.0') continue
    const sort = row.getCell(sortCol).value
    if (sort >= 1 && sort <= 6) {
      row.getCell(versionCol).value = 'v0.3.0'
      row.getCell(dateCol).value = '2026-09-11'
      v30 += 1
    } else if (sort >= 7 && sort <= 23) {
      row.getCell(versionCol).value = 'v0.4.0'
      row.getCell(dateCol).value = '2026-09-13'
      row.getCell(sortCol).value = sort - 6
      v40 += 1
    } else if (sort >= 24 && sort <= 27) {
      row.getCell(versionCol).value = 'v0.5.0'
      row.getCell(dateCol).value = '2026-09-13'
      row.getCell(sortCol).value = sort - 23
      v50 += 1
    } else {
      throw new Error(`예상치 못한 SortOrder(${sort})를 가진 v0.5.0 행이 있습니다.`)
    }
  }
  console.log(`[migration] PatchNoteTable: v0.3.0 ${v30}행, v0.4.0 ${v40}행, v0.5.0 ${v50}행으로 재분리`)

  // StringTable에 새 문구 추가
  const stringLastRow = stringWs.lastRow.number
  const stringEngRow = stringWs.getRow(4)
  let sIdCol = -1
  let korCol = -1
  let engCol = -1
  let catCol = -1
  for (let c = 1; c <= stringWs.columnCount; c++) {
    const v = stringEngRow.getCell(c).value
    if (v === 'Id') sIdCol = c
    if (v === 'KOR') korCol = c
    if (v === 'ENG') engCol = c
    if (v === '//Category') catCol = c
  }
  const newStringRow = stringWs.getRow(stringLastRow + 1)
  newStringRow.getCell(1).value = stringLastRow - 4 // Index (헤더 4행 제외)
  newStringRow.getCell(sIdCol).value = NEW_STRING_ID
  newStringRow.getCell(korCol).value = NEW_STRING_KOR
  newStringRow.getCell(engCol).value = NEW_STRING_ENG
  newStringRow.getCell(catCol).value = 'PatchNote'
  newStringRow.commit()

  // PatchNoteTable에 v0.5.0 5번째 행 추가
  const newPatchRow = patchWs.getRow(lastRow + 1)
  newPatchRow.getCell(1).value = lastRow - 4
  newPatchRow.getCell(idCol).value = maxId + 1
  newPatchRow.getCell(versionCol).value = 'v0.5.0'
  newPatchRow.getCell(dateCol).value = '2026-09-13'
  newPatchRow.getCell(categoryCol).value = 'CHANGE'
  newPatchRow.getCell(textIdCol).value = NEW_STRING_ID
  newPatchRow.getCell(sortCol).value = 5
  newPatchRow.commit()

  console.log('[migration] StringTable/PatchNoteTable에 "스테이지 다이아 최소 지급량 상향" 항목 추가')

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] 완료. 이제 `npm run balance`를 실행하세요.')
}

main()
