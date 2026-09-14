// 1회성 마이그레이션: 치명타 확률(CRIT)/치명타피해(CRIT_DMG) 계산을 "깡스탯 ×
// (1+퍼센트%)" 곱연산에서 순수 가산(flat+percent를 그냥 더함)으로 바꾼
// src/store/gameStore.ts 코드 변경(computeEffectiveStats의 ADDITIVE_STAT_KEYS)에
// 맞춰, 관련 수치 전부를 다시 설계한다. migration 054(곱연산 시절의 제곱근 보정)를
// 대체한다.
//
// ## 두 종류의 원천, 서로 다른 처리
// - "깡스탯" 원천(StatTable.ValuePerLevel/BaseValue, 무기 EquipEffectValue, 유물
//   FLAT값)은 원래도 곱연산 밖에서 그냥 더해지는 값이라 가산식으로 바뀌어도 의미가
//   그대로다 — 요청받은 배율(치확 ×0.5, 치피 ×0.1)을 원본 값에 그대로 곱하면 된다.
// - "퍼센트" 원천(ExistTreeTable.Value, 무기 OwnEffectValue, 유물 PERCENT값)은
//   원래 "지금까지 쌓인 깡스탯 합계에 얹는 배율"로 설계된 숫자라 원본 크기 자체가
//   가산식에는 너무 크다(직접 계산해 확인 — 원본 값에 ×0.5/×0.1만 곱해서
//   더했더니 치확 100%가 트리 진행률 24%에서 나왔다. 요청은 "더 늦어져야 한다"
//   였는데 정반대로 더 빨라진 것). 그래서 퍼센트 원천은 "존재력 트리 100%
//   해금·스탯레벨 50·무기 없음" 기준점에서, 곱연산 시절 최종값에 요청 배율을
//   곱한 값과 가산식 결과가 같아지도록 역산한 배율로 다시 스케일한다.
//
// 대상 및 배율 계산:
// 1. StatTable: CRIT.ValuePerLevel ×0.5(요청 배율 그대로). CRIT_DMG.ValuePerLevel
//    ×0.1. CRIT_DMG.BaseValue는 150×0.1=15가 아니라 max(100, 15)=100으로 바닥을
//    뒀다 — calculateDamage.ts가 `max(0, critDmg-100)`로 100 미만은 크리티컬
//    배율을 1.0(논크리티컬과 동일)으로 취급하는데, 150을 그대로 ×0.1 하면
//    크리티컬이 "뜨긴 하지만 데미지 보너스가 없는" 상태가 될 뻔했다. 100을
//    최소 바닥으로 둬 "크리티컬은 항상 논크리티컬보다 세다"는 불변식을 지킨다.
// 2. ExistTreeTable: CRIT/CRIT_DMG 노드 Value에 위에서 역산한 스케일 배율 적용
// 3. WeaponTable: 활(PrimaryStat=CRIT) EquipEffectValue ×0.5(깡스탯),
//    OwnEffectValue는 CRIT 스케일 배율(퍼센트). 도끼(PrimaryStat=CRIT_DMG)
//    EquipEffectValue ×0.1, OwnEffectValue는 CRIT_DMG 스케일 배율
// 4. RelicTable: STAT_CRIT/STAT_CRIT_DMG 중 EffectValueType=FLAT은 요청 배율
//    그대로, PERCENT는 스케일 배율 적용
//
// 실행: node scripts/migrations/055-crit-additive-redesign.mjs
// 재실행 방지 없음 — 매번 git 커밋(8b67aed, 이번 치명타 작업 착수 전 원본)의
// 값에서 새로 계산한다.

import ExcelJS from 'exceljs'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../..')
const XLSX_PATH = resolve(REPO_ROOT, 'balance/balance.xlsx')
const ORIGINAL_COMMIT = '8b67aed'

const CRIT_MULT = 0.5
const CRIT_DMG_MULT = 0.1
const CRIT_DMG_BASE_FLOOR = 100
// 기준점: 존재력 트리 100% 해금, 스탯 레벨 50, 무기 없음
const REFERENCE_STAT_LEVEL = 50

function getColumns(ws) {
  const engRow = ws.getRow(4)
  const cols = {}
  for (let c = 1; c <= ws.columnCount; c++) {
    const v = engRow.getCell(c).value
    if (v) cols[v] = c
  }
  return cols
}

async function loadOriginalWorkbook() {
  const buffer = execFileSync('git', ['show', `${ORIGINAL_COMMIT}:balance/balance.xlsx`], { cwd: REPO_ROOT, maxBuffer: 1024 * 1024 * 64 })
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  return wb
}

function sumColumn(ws, { filter, targetCol }) {
  const cols = getColumns(ws)
  let sum = 0
  for (let r = 5; r <= ws.lastRow.number; r++) {
    const row = ws.getRow(r)
    if (!filter(row, cols)) continue
    sum += row.getCell(cols[targetCol]).value
  }
  return sum
}

function getStatRow(ws, statType) {
  const cols = getColumns(ws)
  for (let r = 5; r <= ws.lastRow.number; r++) {
    const row = ws.getRow(r)
    if (row.getCell(cols.StatType).value === statType) return { row, cols }
  }
  throw new Error(`StatTable에서 ${statType}을 찾지 못했습니다.`)
}

// 퍼센트 원천(ExistTree 등)의 "가산식으로 전환 시 스케일 배율"을 역산한다.
// 곱연산 시절: final = flat × (1 + percentSum/100)
// 목표: 가산식 final(=flat_new + percentSum_new)이 "곱연산 시절 final × 요청배율"과
// 같아지도록 percentSum_new를 구하고, percentSum_new / percentSum_old를 반환한다.
function deriveScaleFactor({ origFlatAtRef, origPercentSum, newFlatAtRef, targetMult }) {
  const oldFinal = origFlatAtRef * (1 + origPercentSum / 100)
  const targetFinal = oldFinal * targetMult
  const newPercentSum = targetFinal - newFlatAtRef
  return newPercentSum / origPercentSum
}

function applyFromOriginal(currentWs, origWs, { filter, targetCol, mult, label }) {
  const cols = getColumns(currentWs)
  const origCols = getColumns(origWs)
  let count = 0
  for (let r = 5; r <= currentWs.lastRow.number; r++) {
    const row = currentWs.getRow(r)
    const origRow = origWs.getRow(r)
    if (!filter(row, cols)) continue
    const origValue = origRow.getCell(origCols[targetCol]).value
    if (typeof origValue !== 'number') continue
    const cell = row.getCell(cols[targetCol])
    cell.value = Math.round(origValue * mult * 1e6) / 1e6
    count += 1
  }
  console.log(`  [${label}] ${count}행 (원본×${mult.toFixed(6)})`)
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const orig = await loadOriginalWorkbook()
  const current = new ExcelJS.Workbook()
  await current.xlsx.readFile(XLSX_PATH)

  const origStatWs = orig.getWorksheet('StatTable')
  const origExistWs = orig.getWorksheet('ExistTreeTable')
  const { row: origCritStatRow, cols: statCols } = getStatRow(origStatWs, 'CRIT')
  const { row: origCritDmgStatRow } = getStatRow(origStatWs, 'CRIT_DMG')

  const origCritBase = origCritStatRow.getCell(statCols.BaseValue).value
  const origCritPerLevel = origCritStatRow.getCell(statCols.ValuePerLevel).value
  const origCritDmgBase = origCritDmgStatRow.getCell(statCols.BaseValue).value
  const origCritDmgPerLevel = origCritDmgStatRow.getCell(statCols.ValuePerLevel).value

  const origExistCritSum = sumColumn(origExistWs, {
    filter: (row, c) => row.getCell(c.EffectType).value === 'STAT' && row.getCell(c.StatType).value === 'CRIT',
    targetCol: 'Value',
  })
  const origExistCritDmgSum = sumColumn(origExistWs, {
    filter: (row, c) => row.getCell(c.EffectType).value === 'STAT' && row.getCell(c.StatType).value === 'CRIT_DMG',
    targetCol: 'Value',
  })

  const newCritPerLevel = origCritPerLevel * CRIT_MULT
  const newCritDmgPerLevel = origCritDmgPerLevel * CRIT_DMG_MULT
  const newCritDmgBase = Math.max(CRIT_DMG_BASE_FLOOR, origCritDmgBase * CRIT_DMG_MULT)

  const critScale = deriveScaleFactor({
    origFlatAtRef: origCritBase + origCritPerLevel * REFERENCE_STAT_LEVEL,
    origPercentSum: origExistCritSum,
    newFlatAtRef: 0 + newCritPerLevel * REFERENCE_STAT_LEVEL,
    targetMult: CRIT_MULT,
  })
  const critDmgScale = deriveScaleFactor({
    origFlatAtRef: origCritDmgBase + origCritDmgPerLevel * REFERENCE_STAT_LEVEL,
    origPercentSum: origExistCritDmgSum,
    newFlatAtRef: newCritDmgBase + newCritDmgPerLevel * REFERENCE_STAT_LEVEL,
    targetMult: CRIT_DMG_MULT,
  })

  console.log(`[migration] 기준점(트리100%·스탯레벨${REFERENCE_STAT_LEVEL}·무기없음) 역산 결과:`)
  console.log(`  CRIT 퍼센트 원천 스케일 배율: ${critScale.toFixed(6)}`)
  console.log(`  CRIT_DMG 퍼센트 원천 스케일 배율: ${critDmgScale.toFixed(6)}`)

  // 1. StatTable
  {
    const ws = current.getWorksheet('StatTable')
    const { row: critRow, cols } = getStatRow(ws, 'CRIT')
    const { row: critDmgRow } = getStatRow(ws, 'CRIT_DMG')
    critRow.getCell(cols.ValuePerLevel).value = Math.round(newCritPerLevel * 1e6) / 1e6
    critDmgRow.getCell(cols.ValuePerLevel).value = Math.round(newCritDmgPerLevel * 1e6) / 1e6
    critDmgRow.getCell(cols.BaseValue).value = newCritDmgBase
    console.log(`  [StatTable] CRIT.ValuePerLevel: ${origCritPerLevel} → ${critRow.getCell(cols.ValuePerLevel).value}`)
    console.log(`  [StatTable] CRIT_DMG.ValuePerLevel: ${origCritDmgPerLevel} → ${critDmgRow.getCell(cols.ValuePerLevel).value}`)
    console.log(`  [StatTable] CRIT_DMG.BaseValue: ${origCritDmgBase} → ${newCritDmgBase} (바닥 ${CRIT_DMG_BASE_FLOOR} 적용)`)
  }

  // 2. ExistTreeTable — 퍼센트 원천이라 스케일 배율 적용
  {
    const origWs = origExistWs
    const ws = current.getWorksheet('ExistTreeTable')
    applyFromOriginal(ws, origWs, {
      filter: (row, c) => row.getCell(c.EffectType).value === 'STAT' && row.getCell(c.StatType).value === 'CRIT',
      targetCol: 'Value',
      mult: critScale,
      label: 'ExistTreeTable/CRIT',
    })
    applyFromOriginal(ws, origWs, {
      filter: (row, c) => row.getCell(c.EffectType).value === 'STAT' && row.getCell(c.StatType).value === 'CRIT_DMG',
      targetCol: 'Value',
      mult: critDmgScale,
      label: 'ExistTreeTable/CRIT_DMG',
    })
  }

  // 3. WeaponTable — Equip(깡스탯)은 요청 배율 그대로. Own(퍼센트)은 balance.xlsx에서
  // 건드리지 않는다 — 활/도끼의 OwnEffectValue는 종류 불문 ATK% 보너스
  // (weaponBaseAtkOwnPercent)와 같은 원본 값을 공유해서, 여기서 깎으면 그 공용
  // 메커니즘까지 같이 깎여 "무기 종류 불문 동일 기여" 불변식이 깨진다(직접 겪음).
  // 원본 그대로 두고, CRIT/CRIT_DMG 특화 몫만 gameStore.ts의
  // CRIT_SERIES_PERCENT_SCALE로 코드 레벨에서 축소한다.
  {
    const origWs = orig.getWorksheet('WeaponTable')
    const ws = current.getWorksheet('WeaponTable')
    applyFromOriginal(ws, origWs, {
      filter: (row, c) => row.getCell(c.PrimaryStat).value === 'CRIT',
      targetCol: 'EquipEffectValue',
      mult: CRIT_MULT,
      label: 'WeaponTable(Bow)/EquipEffectValue',
    })
    applyFromOriginal(ws, origWs, {
      filter: (row, c) => row.getCell(c.PrimaryStat).value === 'CRIT',
      targetCol: 'OwnEffectValue',
      mult: 1, // 원본 유지 — 위 설명 참고
      label: 'WeaponTable(Bow)/OwnEffectValue(원본 유지)',
    })
    applyFromOriginal(ws, origWs, {
      filter: (row, c) => row.getCell(c.PrimaryStat).value === 'CRIT_DMG',
      targetCol: 'EquipEffectValue',
      mult: CRIT_DMG_MULT,
      label: 'WeaponTable(Axe)/EquipEffectValue',
    })
    applyFromOriginal(ws, origWs, {
      filter: (row, c) => row.getCell(c.PrimaryStat).value === 'CRIT_DMG',
      targetCol: 'OwnEffectValue',
      mult: 1, // 원본 유지 — 위 설명 참고
      label: 'WeaponTable(Axe)/OwnEffectValue(원본 유지)',
    })
  }

  // 4. RelicTable — 유물은 무기처럼 다른 메커니즘과 원본 값을 공유하지 않고
  // 개별 수치라 요청 배율을 그대로 적용해도 된다(FLAT/PERCENT 모두 — 가산식에서는
  // 결국 같은 합산 버킷으로 더해지므로 타입 구분이 의미 없어졌다).
  {
    const origWs = orig.getWorksheet('RelicTable')
    const ws = current.getWorksheet('RelicTable')
    applyFromOriginal(ws, origWs, {
      filter: (row, c) => row.getCell(c.EffectType).value === 'STAT_CRIT',
      targetCol: 'EffectValue',
      mult: CRIT_MULT,
      label: 'RelicTable/STAT_CRIT',
    })
    applyFromOriginal(ws, origWs, {
      filter: (row, c) => row.getCell(c.EffectType).value === 'STAT_CRIT_DMG',
      targetCol: 'EffectValue',
      mult: CRIT_DMG_MULT,
      label: 'RelicTable/STAT_CRIT_DMG',
    })
  }

  await current.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] 완료. 이제 `npm run balance`를 실행하세요.')
}

main()
