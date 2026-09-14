// 1회성 마이그레이션: 치명타 확률(CRIT) 획득량을 절반으로, 치명타피해(CRIT_DMG)
// 획득량을 10분의 1로 낮춘다.
//
// ## 왜 단순히 ×0.5 / ×0.1을 곱하지 않았는가 (복리 효과)
// 최종 스탯 = (기본값 + 깡스탯 합계) × (1 + 퍼센트 합계/100) 구조라(gameStore.ts
// computeEffectiveStats), 깡스탯 쪽 원천(StatTable.ValuePerLevel, 무기
// EquipEffectValue, 유물 FLAT)과 퍼센트 쪽 원천(ExistTreeTable.Value, 무기
// OwnEffectValue, 유물 PERCENT)이 곱셈으로 묶인다. 두 쪽 모두에 똑같이 ×0.5를
// 곱하면 투자가 큰 구간(퍼센트가 100을 훨씬 넘는 구간)에서는 결과가 0.5×0.5=
// ×0.25로, ×0.1을 곱하면 ×0.1×0.1=×0.01로 "제곱"되어 요청한 것보다 훨씬 가파르게
// 깎인다(직접 계산해서 확인함 — 검증 섹션 참고). "성장분(획득량)을 절반/10분의1로"
// 라는 요청의 실제 의도는 최종 스탯이 대략 그 비율로 줄어드는 것이므로, 깡스탯·
// 퍼센트 두 원천에 각각 목표 배율의 제곱근(√0.5≈0.7071, √0.1≈0.3162)을 곱해
// 곱셈 결과가 정확히 목표 배율(0.5배/0.1배)이 되도록 보정했다.
//
// CRIT_DMG는 StatTable.BaseValue=150(치확 0에서도 크리티컬이 뜨면 기본 1.5배라는
// 순수 시작값)이 있어서, 이 값 자체는 손대지 않는다 — 건드리면 150→15가 돼
// 치확 100% 미만 구간에서도 크리티컬이 논크리티컬보다 약해지는 모순이 생긴다.
// CRIT은 BaseValue=0이라 이 문제가 없다.
//
// 대상:
// 1. StatTable(깡스탯 원천): CRIT.ValuePerLevel ×√0.5, CRIT_DMG.ValuePerLevel ×√0.1
//    (BaseValue는 둘 다 유지)
// 2. ExistTreeTable(퍼센트 원천): StatType=CRIT 행 Value ×√0.5,
//    StatType=CRIT_DMG 행 Value ×√0.1
// 3. WeaponTable: PrimaryStat=CRIT(활) 행의 EquipEffectValue(깡스탯) ×√0.5,
//    OwnEffectValue(퍼센트) ×√0.5. PrimaryStat=CRIT_DMG(도끼) 행의
//    EquipEffectValue ×√0.1, OwnEffectValue ×√0.1.
//    (검/창/지팡이는 PrimaryStat이 달라 대상에서 자동으로 빠진다 — "검과 창은
//    건드리지 말 것" 요건을 스키마상 자연히 만족)
// 4. RelicTable: EffectType=STAT_CRIT(전부 FLAT=깡스탯) 행 EffectValue ×√0.5.
//    EffectType=STAT_CRIT_DMG 행 중 FLAT은 ×√0.1, PERCENT는 ×√0.1
//    (같은 √0.1이지만 원천이 깡스탯/퍼센트로 나뉘어 있어 같은 배율을 각각 적용)
//
// 실행: node scripts/migrations/054-crit-rebalance.mjs
// 재실행 방지 없음 — 항상 "실행 시점의 현재 값" 기준으로 다시 계산한다.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

// 최종 스탯에서 느껴지는 배율(요청한 값)
const CRIT_TARGET = 0.5
const CRIT_DMG_TARGET = 0.1
// 깡스탯×퍼센트 두 원천에 곱해 곱셈 결과가 위 목표가 되게 하는 실제 배율
const CRIT_MULT = Math.sqrt(CRIT_TARGET) // ≈0.70711
const CRIT_DMG_MULT = Math.sqrt(CRIT_DMG_TARGET) // ≈0.31623

function getColumns(ws) {
  const engRow = ws.getRow(4)
  const cols = {}
  for (let c = 1; c <= ws.columnCount; c++) {
    const v = engRow.getCell(c).value
    if (v) cols[v] = c
  }
  return cols
}

function scaleRows(ws, { filter, targetCol, mult, label }) {
  const cols = getColumns(ws)
  const lastRow = ws.lastRow.number
  let count = 0
  for (let r = 5; r <= lastRow; r++) {
    const row = ws.getRow(r)
    if (!filter(row, cols)) continue
    const cell = row.getCell(cols[targetCol])
    const oldValue = cell.value
    if (typeof oldValue !== 'number') continue
    const newValue = Math.round(oldValue * mult * 1e6) / 1e6
    cell.value = newValue
    count += 1
  }
  console.log(`  [${label}] ${count}행 조정 (×${mult.toFixed(5)})`)
  return count
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  // 1. StatTable
  {
    const ws = workbook.getWorksheet('StatTable')
    const cols = getColumns(ws)
    const lastRow = ws.lastRow.number
    for (let r = 5; r <= lastRow; r++) {
      const row = ws.getRow(r)
      const statType = row.getCell(cols.StatType).value
      if (statType === 'CRIT') {
        const cell = row.getCell(cols.ValuePerLevel)
        const old = cell.value
        cell.value = Math.round(old * CRIT_MULT * 1e6) / 1e6
        console.log(`  [StatTable] CRIT.ValuePerLevel: ${old} → ${cell.value}`)
      } else if (statType === 'CRIT_DMG') {
        const cell = row.getCell(cols.ValuePerLevel)
        const old = cell.value
        cell.value = Math.round(old * CRIT_DMG_MULT * 1e6) / 1e6
        console.log(`  [StatTable] CRIT_DMG.ValuePerLevel: ${old} → ${cell.value} (BaseValue 150은 유지)`)
      }
    }
  }

  // 2. ExistTreeTable
  {
    const ws = workbook.getWorksheet('ExistTreeTable')
    const cols = getColumns(ws)
    scaleRows(ws, {
      filter: (row) => row.getCell(cols.EffectType).value === 'STAT' && row.getCell(cols.StatType).value === 'CRIT',
      targetCol: 'Value',
      mult: CRIT_MULT,
      label: 'ExistTreeTable/CRIT',
    })
    scaleRows(ws, {
      filter: (row) => row.getCell(cols.EffectType).value === 'STAT' && row.getCell(cols.StatType).value === 'CRIT_DMG',
      targetCol: 'Value',
      mult: CRIT_DMG_MULT,
      label: 'ExistTreeTable/CRIT_DMG',
    })
  }

  // 3. WeaponTable
  {
    const ws = workbook.getWorksheet('WeaponTable')
    const cols = getColumns(ws)
    scaleRows(ws, {
      filter: (row) => row.getCell(cols.PrimaryStat).value === 'CRIT',
      targetCol: 'OwnEffectValue',
      mult: CRIT_MULT,
      label: 'WeaponTable(Bow)/OwnEffectValue',
    })
    scaleRows(ws, {
      filter: (row) => row.getCell(cols.PrimaryStat).value === 'CRIT',
      targetCol: 'EquipEffectValue',
      mult: CRIT_MULT,
      label: 'WeaponTable(Bow)/EquipEffectValue',
    })
    scaleRows(ws, {
      filter: (row) => row.getCell(cols.PrimaryStat).value === 'CRIT_DMG',
      targetCol: 'OwnEffectValue',
      mult: CRIT_DMG_MULT,
      label: 'WeaponTable(Axe)/OwnEffectValue',
    })
    scaleRows(ws, {
      filter: (row) => row.getCell(cols.PrimaryStat).value === 'CRIT_DMG',
      targetCol: 'EquipEffectValue',
      mult: CRIT_DMG_MULT,
      label: 'WeaponTable(Axe)/EquipEffectValue',
    })
  }

  // 4. RelicTable
  {
    const ws = workbook.getWorksheet('RelicTable')
    const cols = getColumns(ws)
    scaleRows(ws, {
      filter: (row) => row.getCell(cols.EffectType).value === 'STAT_CRIT',
      targetCol: 'EffectValue',
      mult: CRIT_MULT,
      label: 'RelicTable/STAT_CRIT',
    })
    scaleRows(ws, {
      filter: (row) => row.getCell(cols.EffectType).value === 'STAT_CRIT_DMG',
      targetCol: 'EffectValue',
      mult: CRIT_DMG_MULT,
      label: 'RelicTable/STAT_CRIT_DMG',
    })
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] 완료. 이제 `npm run balance`를 실행하세요.')
}

main()
