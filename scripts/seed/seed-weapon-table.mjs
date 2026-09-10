// ⚠️ 이미 실행되어 적용된 1회성 시딩 스크립트다(테이블 개편 2단계) —
// WeaponTable(75행 = 3종류×5등급×5단계)을 신설했다. 그 전까지는 무기 보유/장착
// 효과가 전부 실시간 곱연산(OwnBonusBase×등급배율×Tier배율×레벨×개수)으로
// 계산되고 데이터 행이 0개였다 — 이 공식으로 75종 값을 전부 계산해 리터럴로
// 채웠다. 이제 등급 배율에 실시간으로 의존하지 않고 무기마다 개별 값을 가지므로,
// 나중에 "이 무기 하나만 세게" 같은 개별 조정이 가능해진다(피드백 11번 "무기간
// 메리트를 확실하게"). seed_balance_xlsx.py와 같은 이유로 scripts/seed/에 둔다 —
// 곱연산 공식을 나중에 다시 참고할 수 있게 보존하는 것이지, 평소 파이프라인에서
// 실행하는 스크립트가 아니다. weapon.ts는 이제 이 공식을 쓰지 않고 WeaponTable을
// 조회만 한다.
//
// ⚠️ 설계 판단(3열 칼럼 수 제약): 현재 "기본 공격력" 보너스는 보유 시
// (BaseAtkOwnBonusPerLevel=0.5, 레벨×개수 배로 스케일)와 장착 시(BaseAtkEquipBonusPerLevel=5,
// 레벨만 배로 스케일, 개수 무관)에 서로 다른 계수를 썼다(장착이 보유 대비 10배).
// WeaponTable에는 BaseAtk 칼럼이 하나뿐이라 이 두 계수를 하나로 합쳤다 — 보유 시
// BaseAtk×레벨×개수, 장착 시 BaseAtk×레벨(개수 무관)로 "같은 값을 두 맥락에 재사용"하는
// 규칙으로 통일했다(OwnEffectValue/EquipEffectValue가 애초에 이 패턴이라 구조를
// 맞췄다). 결과적으로 장착 시의 "종류 무관 기본 공격력" 기여도가 예전보다 작아진다
// (10배 증폭이 없어짐) — 대신 각 행을 손으로 조정할 수 있게 됐으니 필요하면 엑셀에서
// 개별 무기의 BaseAtk를 다시 올리면 된다. 이 판단이 마음에 안 들면 알려달라.
//
// 재실행 방지: WeaponTable 시트가 이미 있으면(=이미 적용됨) 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

const DATA_START_ROW = 5
const HEADER_FILLS = {
  ref: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } },
  kor: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } },
  type: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } },
  eng: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8EA9DB' } },
}
const HEADER_FONTS = {
  ref: { size: 9, color: { argb: 'FF7F6000' } },
  kor: { size: 9, bold: true, color: { argb: 'FFFFFFFF' } },
  type: { size: 9, color: { argb: 'FF1F3864' } },
  eng: { size: 9, bold: true, color: { argb: 'FF1F3864' } },
}
const CENTER = { horizontal: 'center', vertical: 'middle' }
const LEFT = { horizontal: 'left', vertical: 'middle' }
const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
}

function writeDataSheet(workbook, sheetName, columns, rows) {
  const existing = workbook.getWorksheet(sheetName)
  if (existing) workbook.removeWorksheet(existing.id)
  const ws = workbook.addWorksheet(sheetName)

  const headerRows = [columns.map((c) => c.ref), columns.map((c) => c.kor), columns.map((c) => c.type), columns.map((c) => c.eng)]
  const styleKeys = ['ref', 'kor', 'type', 'eng']
  headerRows.forEach((values, rIdx) => {
    const rowNum = rIdx + 1
    const key = styleKeys[rIdx]
    values.forEach((value, cIdx) => {
      const cell = ws.getCell(rowNum, cIdx + 1)
      cell.value = value === '' ? null : value
      cell.fill = HEADER_FILLS[key]
      cell.font = HEADER_FONTS[key]
      cell.alignment = CENTER
      cell.border = THIN_BORDER
    })
  })

  rows.forEach((rowValues, i) => {
    const excelRow = DATA_START_ROW + i
    rowValues.forEach((value, cIdx) => {
      const cell = ws.getCell(excelRow, cIdx + 1)
      cell.value = value
      cell.font = { size: 9 }
      cell.border = THIN_BORDER
      cell.alignment = typeof value === 'number' || typeof value === 'boolean' ? CENTER : LEFT
    })
  })

  ws.views = [{ state: 'frozen', ySplit: 4 }]
  const lastRow = 4 + rows.length
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: lastRow, column: columns.length } }
  columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = Math.max(10, col.eng.length + 2, col.kor.length * 1.8 + 2)
  })
  return ws
}

// ---- 현재 실시간 공식과 동일한 값 ----
const WEAPON_TYPES = [
  { type: 'Sword', ownBonusBase: 0.5, equipBonusBase: 5 },
  { type: 'Spear', ownBonusBase: 0.02, equipBonusBase: 0.2 },
  { type: 'Bow', ownBonusBase: 0.3, equipBonusBase: 3 },
]
const GRADES = [
  { grade: 'Normal', multiplier: 1 },
  { grade: 'Rare', multiplier: 2 },
  { grade: 'Epic', multiplier: 4 },
  { grade: 'Unique', multiplier: 8 },
  { grade: 'Legendary', multiplier: 16 },
]
const TIERS = [1, 2, 3, 4, 5]
const BASE_ATK_OWN_PER_LEVEL = 0.5 // WeaponUpgradeTable.BaseAtkOwnBonusPerLevel
const TIER_STEP_BONUS_PERCENT = 10 // WeaponUpgradeTable.TierStepBonusPercent
const LEVEL_COST_BASE = 15 // WeaponUpgradeTable.LevelCostBase
const LEVEL_COST_GROWTH_RATE = 1.2 // WeaponUpgradeTable.LevelCostGrowthRate

const tierMultiplier = (tier) => 1 + (tier - 1) * (TIER_STEP_BONUS_PERCENT / 100)
const round2 = (n) => Math.round(n * 100) / 100

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  if (workbook.getWorksheet('WeaponTable')) {
    console.log('[migration] WeaponTable이 이미 있습니다 — 이미 적용된 것으로 보고 건너뜁니다.')
    return
  }

  // ---- GrowthCurveTable에 등급별 무기 레벨업 곡선 5개 추가, 기존 단일
  // WEAPON_LEVEL_UP(Id=39003, 등급 무관)은 제거 — 이제 등급 배율이 곡선 자체에
  // 미리 곱해져 있어(CostBase = 15 × 등급배율) 무기 레벨업 비용 계산이 런타임에
  // WeaponGradeTable을 더 이상 참조하지 않는다. 시트를 통째로 읽어들인 뒤 다시
  // 쓰는 방식(행 단위 splice보다 안전) — writeDataSheet로 재생성한다. ----
  const curveWs = workbook.getWorksheet('GrowthCurveTable')
  if (!curveWs) throw new Error('GrowthCurveTable 시트를 찾지 못했습니다(1단계 마이그레이션을 먼저 실행하세요).')

  const curveColumns = [
    { ref: '', kor: '순번', type: 'int', eng: 'Index' },
    { ref: '', kor: 'Id', type: 'int', eng: 'Id' },
    { ref: '', kor: '곡선 키', type: 'string', eng: 'CurveKey' },
    { ref: '', kor: '비용 기준값', type: 'float', eng: 'CostBase' },
    { ref: '', kor: '비용 증가율', type: 'float', eng: 'CostGrowthRate' },
    { ref: '', kor: '효과값 기준(예비)', type: 'float', eng: 'ValueBase' },
    { ref: '', kor: '레벨당 효과 증가(예비)', type: 'float', eng: 'ValuePerLevel' },
    { ref: '', kor: '최대 레벨', type: 'int', eng: 'MaxLevel' },
  ]
  const curveLastRow = curveWs.lastRow ? curveWs.lastRow.number : 4
  const existingCurveRows = []
  let maxCurveId = 39000
  for (let r = 5; r <= curveLastRow; r++) {
    const row = curveWs.getRow(r)
    const curveKey = row.getCell(3).value
    if (curveKey === 'WEAPON_LEVEL_UP') continue // 등급 무관 단일 곡선 — 제거하고 등급별 5개로 대체
    existingCurveRows.push([row.getCell(1).value, row.getCell(2).value, curveKey, row.getCell(4).value, row.getCell(5).value, row.getCell(6).value, row.getCell(7).value, row.getCell(8).value])
    maxCurveId = Math.max(maxCurveId, row.getCell(2).value)
  }
  let nextCurveId = maxCurveId + 1
  for (const g of GRADES) {
    existingCurveRows.push([
      existingCurveRows.length + 1,
      nextCurveId++,
      `WEAPON_LEVEL_UP_${g.grade.toUpperCase()}`,
      LEVEL_COST_BASE * g.multiplier,
      LEVEL_COST_GROWTH_RATE,
      0,
      0,
      0,
    ])
  }
  existingCurveRows.forEach((row, i) => (row[0] = i + 1)) // Index 재정렬
  writeDataSheet(workbook, 'GrowthCurveTable', curveColumns, existingCurveRows)
  console.log('[migration] GrowthCurveTable: WEAPON_LEVEL_UP(등급 무관) 제거, 등급별 5개(WEAPON_LEVEL_UP_NORMAL~LEGENDARY) 추가.')

  // ---- WeaponTable 75행 시딩 ----
  const columns = [
    { ref: '', kor: '순번', type: 'int', eng: 'Index' },
    { ref: '', kor: 'ID', type: 'int', eng: 'Id' },
    { ref: '', kor: '무기 ID', type: 'string', eng: 'WeaponId' },
    { ref: 'EnumDefine/WeaponType', kor: '종류', type: 'enum', eng: 'Type' },
    { ref: 'EnumDefine/WeaponGrade', kor: '등급', type: 'enum', eng: 'Grade' },
    { ref: '', kor: '단계', type: 'int', eng: 'Tier' },
    { ref: 'StringTable/Id', kor: '이름ID', type: 'int', eng: 'NameStringId' },
    { ref: 'StringTable/Id', kor: '설명ID', type: 'int', eng: 'DescStringId' },
    { ref: '', kor: '기본 공격력', type: 'float', eng: 'BaseAtk' },
    { ref: '', kor: '보유 효과값', type: 'float', eng: 'OwnEffectValue' },
    { ref: '', kor: '장착 효과값', type: 'float', eng: 'EquipEffectValue' },
    { ref: 'GrowthCurveTable/CurveKey', kor: '레벨업 곡선', type: 'string', eng: 'CurveKey' },
    { ref: '', kor: '설명', type: 'string', eng: '//Description' },
  ]

  const rows = []
  let id = 37201 // 기존 37xxx 대역 중 비어있는 구간(WeaponType/Grade/Upgrade/Breakthrough/Fusion이 37001~37041 사용)
  for (const t of WEAPON_TYPES) {
    for (const g of GRADES) {
      for (const tier of TIERS) {
        const weaponId = `${t.type}_${g.grade}_${tier}`
        const tm = tierMultiplier(tier)
        rows.push([
          rows.length + 1,
          id++,
          weaponId,
          t.type,
          g.grade,
          tier,
          0, // NameStringId — 미확정, 0=자동생성("{종류}-{등급}-{단계}") 폴백
          0, // DescStringId
          round2(BASE_ATK_OWN_PER_LEVEL * g.multiplier * tm),
          round2(t.ownBonusBase * g.multiplier * tm),
          round2(t.equipBonusBase * g.multiplier * tm),
          `WEAPON_LEVEL_UP_${g.grade.toUpperCase()}`,
          '',
        ])
      }
    }
  }

  writeDataSheet(workbook, 'WeaponTable', columns, rows)

  // ---- WeaponTypeTable에서 OwnBonusBase/EquipBonusBase 제거 — WeaponTable 75행에
  // 이미 곱연산까지 끝난 값으로 들어갔으니 더 이상 필요 없다. WeaponTypeTable은
  // 이제 "종류 → 주스탯 매핑"만 남는 순수 정체성 테이블이다. ----
  const typeWs = workbook.getWorksheet('WeaponTypeTable')
  if (typeWs) {
    const typeColumns = [
      { ref: '', kor: '순번', type: 'int', eng: 'Index' },
      { ref: '', kor: 'ID', type: 'int', eng: 'Id' },
      { ref: 'EnumDefine/WeaponType', kor: '무기 종류', type: 'enum', eng: 'WeaponType' },
      { ref: 'StringTable/Id', kor: '이름ID', type: 'int', eng: 'Name' },
      { ref: 'EnumDefine/StatType', kor: '주스탯', type: 'enum', eng: 'PrimaryStat' },
    ]
    const typeLastRow = typeWs.lastRow ? typeWs.lastRow.number : 4
    const typeRows = []
    for (let r = 5; r <= typeLastRow; r++) {
      const row = typeWs.getRow(r)
      typeRows.push([row.getCell(1).value, row.getCell(2).value, row.getCell(3).value, row.getCell(4).value, row.getCell(5).value])
    }
    writeDataSheet(workbook, 'WeaponTypeTable', typeColumns, typeRows)
    console.log('[migration] WeaponTypeTable에서 OwnBonusBase/EquipBonusBase 제거(WeaponTable로 이관 완료).')
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] WeaponTable ${rows.length}행 신설 완료.`)
  const sample = rows.find((r) => r[2] === 'Sword_Epic_3')
  console.log(`[migration] 예시(Sword_Epic_3): BaseAtk=${sample[8]}, OwnEffectValue=${sample[9]}, EquipEffectValue=${sample[10]}, CurveKey=${sample[11]}`)
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
