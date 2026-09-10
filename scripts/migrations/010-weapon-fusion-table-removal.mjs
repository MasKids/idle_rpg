// 1회성 마이그레이션: WeaponFusionTable 삭제(1행짜리 테이블 정리, 3단계).
// 3개 칼럼(RequiredCount/ResultLevel/ResultBreakthroughCount) 전 등급 동일한
// 상수라 CommonTable로 append-row.mjs를 통해 이미 옮겼다(WeaponFusionRequiredCount/
// WeaponFusionResultLevel/WeaponFusionResultBreakthroughCount). balance.ts의
// getWeaponFusionConfig()는 시그니처를 그대로 유지한 채(같은 3개 필드를 가진
// 객체 반환) 내부만 CommonTable 조회로 바뀌어, 호출부(gameStore.ts/weapon.ts/
// WeaponDetailModal.tsx)는 수정할 필요가 없다.
//
// 실행: node scripts/migrations/010-weapon-fusion-table-removal.mjs
// 재실행 방지: WeaponFusionTable 시트가 이미 없으면 건너뜀.

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

  const ws = workbook.getWorksheet('WeaponFusionTable')
  if (!ws) {
    console.log('[migration] WeaponFusionTable 시트가 이미 없습니다 — 건너뜁니다.')
    return
  }

  workbook.removeWorksheet(ws.id)
  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] WeaponFusionTable 시트 삭제 완료.')
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
