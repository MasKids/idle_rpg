// 1회성 마이그레이션: MasteryTable 삭제.
// 3행(검/창/활) 전부 MultiplierPerLevel/CurveKey/MaxLevel이 동일했다 — WeaponType과
// Name(StringId)만 다른 순수 정체성 데이터였던 셈이다. 숫자 두 값(MultiplierPerLevel/
// MaxLevel)은 CommonTable로(append-row.mjs로 이미 추가함), CurveKey는 3종류 고정이라
// 테이블화할 실익이 없어 mastery.ts 코드 상수로, Name(StringId)도 같은 이유로
// mastery.ts 코드 상수 맵으로 옮겼다.
//
// 실행: node scripts/migrations/007-mastery-table-removal.mjs
// 재실행 방지: MasteryTable 시트가 이미 없으면 건너뜀.

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

  const ws = workbook.getWorksheet('MasteryTable')
  if (!ws) {
    console.log('[migration] MasteryTable 시트가 이미 없습니다 — 이미 적용된 것으로 보고 건너뜁니다.')
    return
  }

  workbook.removeWorksheet(ws.id)
  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] MasteryTable 시트 삭제 완료.')
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
