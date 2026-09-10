// 1회성 마이그레이션: WeaponGradeTable/GradeTable 삭제에 맞춰 #EnumDefine을 갱신.
// - WeaponGrade 그룹의 "사용처"를 WeaponGradeTable.WeaponGrade → WeaponTable.Grade로.
// - GradeUsedByType 그룹(GradeTable.UsedBy 전용) 자체를 삭제 — 참조하는 테이블이
//   더는 없다(SortOrder/UsedBy 둘 다 죽은 데이터였다, 정렬은 코드의 WEAPON_GRADES/
//   RELIC_GRADES 배열이 이미 담당).
//
// 실행: node scripts/migrations/019-enum-define-grade-cleanup.mjs
// 재실행 방지: #EnumDefine에 GradeUsedByType 행이 이미 없으면 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const ws = workbook.getWorksheet('#EnumDefine')
  if (!ws) throw new Error('#EnumDefine 시트를 찾지 못했습니다.')

  const rows = []
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const vals = []
    for (let c = 1; c <= ws.columnCount; c++) vals.push(row.getCell(c).value)
    rows.push(vals)
  }

  const hasGradeUsedByType = rows.some((r) => r[0] === 'GradeUsedByType')
  if (!hasGradeUsedByType) {
    console.log('[migration] #EnumDefine에 GradeUsedByType 행이 이미 없습니다 — 건너뜁니다.')
    return
  }

  let replaced = 0
  const filtered = rows.filter((r) => r[0] !== 'GradeUsedByType')
  filtered.forEach((r) => {
    if (r[0] === 'WeaponGrade' && typeof r[3] === 'string' && r[3].includes('WeaponGradeTable.WeaponGrade')) {
      r[3] = r[3].replace('WeaponGradeTable.WeaponGrade', 'WeaponTable.Grade')
      replaced++
    }
  })

  ws.spliceRows(1, rows.length, ...filtered)
  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] #EnumDefine: GradeUsedByType 그룹 삭제(3행), WeaponGrade 사용처 ${replaced}곳 교체.`)
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
