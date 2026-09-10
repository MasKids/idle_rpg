// 1회성 마이그레이션: WeaponUpgradeTable 삭제(1행짜리 테이블 정리, 3단계).
// 유일하게 실제로 읽히던 값 BaseMaxLevel은 CommonTable(WeaponBaseMaxLevel)로
// append-row.mjs를 통해 이미 옮겼다. 나머지(LevelCostBase/LevelCostGrowthRate/
// TierStepBonusPercent/BaseAtkOwnBonusPerLevel/BaseAtkEquipBonusPerLevel)는 2단계
// 개편 때 WeaponTable/GrowthCurveTable에 이미 흡수되어 어디서도 읽지 않는 죽은
// 값이라 그대로 버린다.
//
// 실행: node scripts/migrations/009-weapon-upgrade-table-removal.mjs
// 재실행 방지: WeaponUpgradeTable 시트가 이미 없으면 건너뜀.

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

  const ws = workbook.getWorksheet('WeaponUpgradeTable')
  if (!ws) {
    console.log('[migration] WeaponUpgradeTable 시트가 이미 없습니다 — 건너뜁니다.')
    return
  }

  workbook.removeWorksheet(ws.id)
  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] WeaponUpgradeTable 시트 삭제 완료.')
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
