// 1회성 마이그레이션: v0.3.0 "밸런스 개편" — 무기 장착 효과가 레벨에 따라 커지도록
// GrowthCurveTable의 WEAPON_LEVEL_UP_* 5행에 ValueBase/ValuePerLevel을 채운다.
// (지금까지 두 칼럼은 0으로 방치돼 있었다 — "장착 효과 = EquipEffectValue × 레벨"이던
// 옛 공식이 이 칼럼을 아예 쓰지 않았기 때문. 이번에 weapon.ts의 weaponEquipBonus가
// EquipEffectValue × (ValueBase + (레벨-1) × ValuePerLevel)로 바뀌며 참조를 시작한다.)
//
// ValueBase=1 → 레벨 1에서는 EquipEffectValue 그대로(배율 없음).
// ValuePerLevel=0.1 → 레벨 60(만렙)에서 배율 6.9배. 5등급 곡선 모두 동일(등급 차이는
// EquipEffectValue 자체에 이미 등급별로 반영돼 있어 성장률까지 등급별로 나눌 필요가 없다).
//
// 실행: node scripts/migrations/031-weapon-equip-growth-curve.mjs
// 재실행 방지: 대상 행의 ValuePerLevel이 이미 0이 아니면 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')
const DATA_START_ROW = 5
const TARGET_CURVE_KEYS = [
  'WEAPON_LEVEL_UP_NORMAL',
  'WEAPON_LEVEL_UP_RARE',
  'WEAPON_LEVEL_UP_EPIC',
  'WEAPON_LEVEL_UP_UNIQUE',
  'WEAPON_LEVEL_UP_LEGENDARY',
]
const VALUE_BASE = 1
const VALUE_PER_LEVEL = 0.1

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] 오류: ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)
  const ws = workbook.getWorksheet('GrowthCurveTable')
  if (!ws) {
    console.error('[migration] 오류: GrowthCurveTable 시트를 찾지 못했습니다.')
    process.exit(1)
  }

  const engRow = ws.getRow(4)
  const cols = {}
  for (let c = 1; c <= ws.columnCount; c++) {
    const eng = engRow.getCell(c).value
    if (eng) cols[String(eng)] = c
  }

  let updated = 0
  let alreadyDone = 0
  for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const curveKey = row.getCell(cols.CurveKey).value
    if (!TARGET_CURVE_KEYS.includes(curveKey)) continue

    const currentValuePerLevel = row.getCell(cols.ValuePerLevel).value
    if (currentValuePerLevel && currentValuePerLevel !== 0) {
      alreadyDone += 1
      continue
    }

    row.getCell(cols.ValueBase).value = VALUE_BASE
    row.getCell(cols.ValuePerLevel).value = VALUE_PER_LEVEL
    updated += 1
  }

  if (updated === 0) {
    console.log('[migration] 이미 적용됨 — 건너뜁니다.')
    return
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] GrowthCurveTable ${updated}행에 ValueBase=${VALUE_BASE}, ValuePerLevel=${VALUE_PER_LEVEL} 적용 (이미 적용된 ${alreadyDone}행 제외).`)
  console.log('[migration] 다음: npm run balance')
}

main()
