// 1회성 마이그레이션: v0.3.0 밸런스 개편 — 무기 보유 효과(OwnEffectValue)를
// 깡스탯에서 퍼센트로 전환한다. 퍼센트는 "그 스탯의 깡스탯 총합에 곱해지는 비율"이라
// 종류(검/창/활)마다 다른 스탯(ATK/ASPD/CRIT)의 서로 다른 기준값에 맞춰 값을
// 따로 조정할 필요가 없다 — 세 종류가 같은 등급·단계면 완전히 같은 값을 쓴다
// (기존엔 창의 ASPD 기준값이 작아서 OwnEffectValue도 검의 1/25 수준으로 작게
// 잡아야 했는데, 그 이유 자체가 사라졌다).
//
// 등급 1단계 기준 1.0%(보유 1개당), 등급마다 ×2(검전과 동일한 기존 배율 구조
// 유지), 등급 내 단계(Tier)마다 ×1.1. EquipEffectValue/BaseAtk는 그대로 깡스탯이라
// 이 마이그레이션에서 건드리지 않는다.
//
// 실행: node scripts/migrations/035-weapon-own-effect-percent.mjs
// 재실행 방지: Sword_Normal_1의 OwnEffectValue가 이미 1이면 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

const GRADE_BASE = {
  Normal: 1,
  Rare: 2,
  Epic: 4,
  Unique: 8,
  Legendary: 16,
}
const TIER_MULTIPLIER = 1.1

function ownEffectPercent(grade, tier) {
  const value = GRADE_BASE[grade] * TIER_MULTIPLIER ** (tier - 1)
  return Math.round(value * 100) / 100
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] 오류: ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)
  const ws = workbook.getWorksheet('WeaponTable')
  if (!ws) {
    console.error('[migration] 오류: WeaponTable 시트를 찾지 못했습니다.')
    process.exit(1)
  }

  const engRow = ws.getRow(4)
  const cols = {}
  for (let c = 1; c <= ws.columnCount; c++) {
    const eng = engRow.getCell(c).value
    if (eng) cols[String(eng)] = c
  }

  const firstRow = ws.getRow(5)
  if (Number(firstRow.getCell(cols.OwnEffectValue).value) === 1) {
    console.log('[migration] 이미 적용됨 — 건너뜁니다.')
    return
  }

  let updated = 0
  for (let r = 5; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const grade = row.getCell(cols.Grade).value
    const tier = Number(row.getCell(cols.Tier).value)
    row.getCell(cols.OwnEffectValue).value = ownEffectPercent(grade, tier)
    updated += 1
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] WeaponTable ${updated}행: OwnEffectValue를 퍼센트(종류 무관, 등급×단계 기준)로 재설정.`)
  console.log('[migration] 다음: npm run balance')
}

main()
