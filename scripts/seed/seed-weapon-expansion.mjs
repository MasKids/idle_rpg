// ⚠️ 1회성 시딩 스크립트(v0.4.0 — 무기 확장: 3종류×5등급×5단계=75개 →
// 5종류×6등급×5단계=150개). 기존 75행(WeaponTable)·5행(GachaTable)의 값은
// 절대 건드리지 않고, 새 조합만 추가한다.
//
// 새 무기 종류 2개: 도끼(Axe, 특성 CRIT_DMG) / 지팡이(Staff, 특성 EXIST_GAIN).
// 새 등급 1개: 신화(Mythic, Legendary 위).
//
// 값 설계 — 기존 75행이 이미 아주 깨끗한 공식이라(직접 실측) 그대로 연장했다:
//   - BaseAtk/OwnEffectValue: 종류 무관, 등급마다 정확히 ×2(Normal=0.5/1 →
//     Legendary=8/16 → Mythic=16/32). 등급 안에서 단계(Tier)가 오를 때는
//     BaseAtk가 산술로(+10%씩, 예 0.5→0.55→0.6...), OwnEffectValue는 복리로
//     (×1.1^(tier-1)) 늘어난다 — 두 컬럼이 서로 다른 공식을 쓴다는 걸 실제
//     데이터에서 확인하고 그대로 재현했다.
//   - EquipEffectValue(장착 효과, 깡스탯): 종류마다 다르다 — 그 종류 특성
//     스탯의 StatTable.ValuePerLevel 대비 정확히 4~6배 비율로 잡혀 있었다
//     (검 5=ATK퍼레벨1의 5배, 창 0.2=ASPD퍼레벨0.05의 4배, 활 3=CRIT퍼레벨0.5의
//     6배). 새 종류도 같은 비율(약 5배)로 새로 잡았다 — 도끼(CRIT_DMG
//     퍼레벨2)=10, 지팡이(EXIST_GAIN 퍼레벨0.02)=0.1. 등급/단계 스케일링은
//     기존과 동일(등급마다 ×2, 단계마다 +10%).
//
// 재실행 방지: WeaponTable에 이미 Grade=Mythic 행이 있으면 건너뛴다.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')
const DATA_START_ROW = 5

const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
}
const CENTER = { horizontal: 'center', vertical: 'middle' }
const LEFT = { horizontal: 'left', vertical: 'middle' }

function styleCell(cell, value) {
  cell.value = value
  cell.font = { size: 9 }
  cell.border = THIN_BORDER
  cell.alignment = typeof value === 'number' ? CENTER : LEFT
}

// ---------------------------------------------------------------------------
// 무기 설계 상수
// ---------------------------------------------------------------------------
const OLD_TYPES = ['Sword', 'Spear', 'Bow']
const NEW_TYPES = ['Axe', 'Staff']
const ALL_TYPES = [...OLD_TYPES, ...NEW_TYPES]
const OLD_GRADES = ['Normal', 'Rare', 'Epic', 'Unique', 'Legendary']
const NEW_GRADE = 'Mythic'
const ALL_GRADES = [...OLD_GRADES, NEW_GRADE]
const TIERS = [1, 2, 3, 4, 5]

const TYPE_PRIMARY_STAT = { Sword: 'ATK', Spear: 'ASPD', Bow: 'CRIT', Axe: 'CRIT_DMG', Staff: 'EXIST_GAIN' }
const TYPE_KOR_NAME = { Sword: '검', Spear: '창', Bow: '활', Axe: '도끼', Staff: '지팡이' }
const GRADE_KOR_NAME = { Normal: '노말', Rare: '레어', Epic: '에픽', Unique: '유니크', Legendary: '레전드리', Mythic: '신화' }

// 등급 배수(전부 종류 무관, Normal=1배 기준 ×2^등급인덱스)
const GRADE_INDEX = Object.fromEntries(ALL_GRADES.map((g, i) => [g, i]))
const gradeMultiplier = (grade) => 2 ** GRADE_INDEX[grade]

// 종류별 EquipEffectValue의 Normal-Tier1 기준값 — 그 종류 특성 스탯의
// StatTable.ValuePerLevel × 5 (기존 3종 실측 비율 4~6배의 중앙값).
const TYPE_EQUIP_BASE = { Sword: 5, Spear: 0.2, Bow: 3, Axe: 10, Staff: 0.1 }

const BASE_ATK_GRADE1 = 0.5 // Normal-Tier1 기준 BaseAtk (종류 무관)
const OWN_GRADE1 = 1 // Normal-Tier1 기준 OwnEffectValue (종류 무관)

function weaponRow(type, grade, tier) {
  const mult = gradeMultiplier(grade)
  const tierArith = 1 + 0.1 * (tier - 1) // BaseAtk/Equip: 등급 안에서 산술 +10%/단계
  const tierCompound = 1.1 ** (tier - 1) // OwnEffectValue: 등급 안에서 복리 ×1.1/단계
  return {
    WeaponId: `${type}_${grade}_${tier}`,
    Type: type,
    PrimaryStat: TYPE_PRIMARY_STAT[type],
    Grade: grade,
    GradeNameStringId: null, // 나중에 채움(등급별 StringId)
    GradeColorToken: grade.toLowerCase(),
    Tier: tier,
    NameStringId: null, // 나중에 채움
    DescStringId: null,
    BaseAtk: Math.round(BASE_ATK_GRADE1 * mult * tierArith * 1000) / 1000,
    OwnEffectValue: Math.round(OWN_GRADE1 * mult * tierCompound * 1000) / 1000,
    EquipEffectValue: Math.round(TYPE_EQUIP_BASE[type] * mult * tierArith * 1000) / 1000,
    CurveKey: `WEAPON_LEVEL_UP_${grade.toUpperCase()}`,
  }
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[seed] 오류: ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const weaponWs = workbook.getWorksheet('WeaponTable')
  if (!weaponWs) {
    console.error('[seed] 오류: WeaponTable 시트를 찾지 못했습니다.')
    process.exit(1)
  }
  const wEngRow = weaponWs.getRow(4)
  const wCols = {}
  for (let c = 1; c <= weaponWs.columnCount; c++) {
    const v = wEngRow.getCell(c).value
    if (v) wCols[String(v)] = c
  }

  const alreadyApplied = weaponWs.getRow(weaponWs.rowCount).getCell(wCols.Grade).value === 'Mythic'
  if (alreadyApplied) {
    console.log('[seed] 이미 무기 확장이 적용돼 있습니다 — 건너뜁니다.')
    return
  }

  // ---- StringTable: 등급/종류 이름 + 새 무기 75종 이름·설명 ----
  const stringWs = workbook.getWorksheet('StringTable')
  const sEngRow = stringWs.getRow(4)
  const sCols = {}
  for (let c = 1; c <= stringWs.columnCount; c++) {
    const v = sEngRow.getCell(c).value
    if (v) sCols[String(v)] = c
  }
  let stringLastRow = DATA_START_ROW - 1
  for (let r = DATA_START_ROW; r <= stringWs.rowCount; r++) {
    if (stringWs.getRow(r).getCell(sCols.Id).value != null) stringLastRow = r
  }

  function appendString(id, kor, category) {
    stringLastRow += 1
    const row = stringWs.getRow(stringLastRow)
    styleCell(row.getCell(sCols.Index), stringLastRow - DATA_START_ROW + 1)
    styleCell(row.getCell(sCols.Id), id)
    styleCell(row.getCell(sCols.KOR), kor)
    styleCell(row.getCell(sCols.ENG), kor)
    if (sCols['//Category']) styleCell(row.getCell(sCols['//Category']), category)
  }

  const MYTHIC_GRADE_NAME_ID = 40136
  const AXE_TYPE_NAME_ID = 40137
  const STAFF_TYPE_NAME_ID = 40138
  appendString(MYTHIC_GRADE_NAME_ID, GRADE_KOR_NAME.Mythic, 'WeaponGrade')
  appendString(AXE_TYPE_NAME_ID, TYPE_KOR_NAME.Axe, 'WeaponType')
  appendString(STAFF_TYPE_NAME_ID, TYPE_KOR_NAME.Staff, 'WeaponType')

  const GRADE_NAME_ID = {
    Normal: 40058,
    Rare: 40059,
    Epic: 40060,
    Unique: 40061,
    Legendary: 40062,
    Mythic: MYTHIC_GRADE_NAME_ID,
  }

  // ---- 새 무기 75행 생성 (기존 조합은 건너뛴다) ----
  const newRows = []
  for (const type of ALL_TYPES) {
    for (const grade of ALL_GRADES) {
      const isExistingCombo = OLD_TYPES.includes(type) && OLD_GRADES.includes(grade)
      if (isExistingCombo) continue
      for (const tier of TIERS) {
        newRows.push(weaponRow(type, grade, tier))
      }
    }
  }
  if (newRows.length !== 75) throw new Error(`내부 오류: 신규 무기 행 수 ${newRows.length}, 기대값 75`)

  // 이름/설명 StringId 부여 — 기존 규칙과 동일한 대역 연장(50000/51000번대,
  // "{종류}-{등급}-{단계}" / "{종류} {등급} 등급 무기, {단계}단계").
  let nextNameId = 50075
  let nextDescId = 51075
  for (const row of newRows) {
    row.GradeNameStringId = GRADE_NAME_ID[row.Grade]
    row.NameStringId = nextNameId
    row.DescStringId = nextDescId
    appendString(nextNameId, `${TYPE_KOR_NAME[row.Type]}-${GRADE_KOR_NAME[row.Grade]}-${row.Tier}`, 'WeaponName')
    appendString(nextDescId, `${TYPE_KOR_NAME[row.Type]} ${GRADE_KOR_NAME[row.Grade]} 등급 무기, ${row.Tier}단계`, 'WeaponDesc')
    nextNameId += 1
    nextDescId += 1
  }

  // WeaponTable에 실제로 추가
  const maxWeaponId = Math.max(
    ...Array.from({ length: weaponWs.rowCount - DATA_START_ROW + 1 }, (_, i) => {
      const v = weaponWs.getRow(DATA_START_ROW + i).getCell(wCols.Id).value
      return typeof v === 'number' ? v : 0
    }),
  )
  let weaponRowNum = weaponWs.rowCount + 1
  let nextWeaponId = maxWeaponId + 1
  for (const row of newRows) {
    const excelRow = weaponWs.getRow(weaponRowNum)
    const values = {
      Index: weaponRowNum - DATA_START_ROW + 1,
      Id: nextWeaponId,
      WeaponId: row.WeaponId,
      Type: row.Type,
      PrimaryStat: row.PrimaryStat,
      Grade: row.Grade,
      GradeNameStringId: row.GradeNameStringId,
      GradeColorToken: row.GradeColorToken,
      Tier: row.Tier,
      NameStringId: row.NameStringId,
      DescStringId: row.DescStringId,
      BaseAtk: row.BaseAtk,
      OwnEffectValue: row.OwnEffectValue,
      EquipEffectValue: row.EquipEffectValue,
      CurveKey: row.CurveKey,
    }
    for (const [eng, colIndex] of Object.entries(wCols)) {
      styleCell(excelRow.getCell(colIndex), values[eng])
    }
    weaponRowNum += 1
    nextWeaponId += 1
  }
  weaponWs.autoFilter = { from: { row: 4, column: 1 }, to: { row: weaponRowNum - 1, column: Object.keys(wCols).length } }

  // ---- GrowthCurveTable: WEAPON_LEVEL_UP_MYTHIC 행 추가 ----
  const growthWs = workbook.getWorksheet('GrowthCurveTable')
  const gEngRow = growthWs.getRow(4)
  const gCols = {}
  for (let c = 1; c <= growthWs.columnCount; c++) {
    const v = gEngRow.getCell(c).value
    if (v) gCols[String(v)] = c
  }
  const maxGrowthId = Math.max(
    ...Array.from({ length: growthWs.rowCount - DATA_START_ROW + 1 }, (_, i) => {
      const v = growthWs.getRow(DATA_START_ROW + i).getCell(gCols.Id).value
      return typeof v === 'number' ? v : 0
    }),
  )
  const growthRow = growthWs.getRow(growthWs.rowCount + 1)
  const growthValues = {
    Index: growthWs.rowCount - DATA_START_ROW + 2,
    Id: maxGrowthId + 1,
    CurveKey: 'WEAPON_LEVEL_UP_MYTHIC',
    CostBase: 480, // Legendary(240)의 ×2 — 기존 등급 간 배율과 동일
    CostGrowthRate: 1.2,
    ValueBase: 1,
    ValuePerLevel: 0.1,
    MaxLevel: 0,
  }
  for (const [eng, colIndex] of Object.entries(gCols)) {
    styleCell(growthRow.getCell(colIndex), growthValues[eng])
  }

  // ---- GachaTable: MythicWeight 컬럼을 맨 끝(//Description 뒤)에 새로 추가 ----
  const gachaWs = workbook.getWorksheet('GachaTable')
  const gaEngRow = gachaWs.getRow(4)
  const gaCols = {}
  for (let c = 1; c <= gachaWs.columnCount; c++) {
    const v = gaEngRow.getCell(c).value
    if (v) gaCols[String(v)] = c
  }
  const newCol = gachaWs.columnCount + 1
  gachaWs.getCell(1, newCol).value = null
  gachaWs.getCell(2, newCol).value = '신화 가중치'
  gachaWs.getCell(3, newCol).value = 'float'
  gachaWs.getCell(4, newCol).value = 'MythicWeight'
  for (let r = 1; r <= 4; r++) {
    const cell = gachaWs.getCell(r, newCol)
    cell.font = r === 2 ? { size: 9, bold: true, color: { argb: 'FFFFFFFF' } } : { size: 9, color: { argb: 'FF1F3864' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r === 2 ? 'FF2F5597' : 'FFD9E2F3' } }
    cell.alignment = CENTER
    cell.border = THIN_BORDER
  }
  gachaWs.getColumn(newCol).width = 14
  // Legendary 대비 훨씬 희귀하게(레벨이 오를수록 그 격차를 서서히 좁힌다 —
  // 기존 등급들도 레벨이 오를수록 상위 등급 비중이 커지는 것과 같은 방향).
  const MYTHIC_WEIGHT_BY_LEVEL = { 0: 0.03, 1: 0.15, 2: 0.4, 3: 0.6, 4: 1.4 }
  for (let r = DATA_START_ROW; r <= gachaWs.rowCount; r++) {
    const level = gachaWs.getRow(r).getCell(gaCols.GachaLevel).value
    styleCell(gachaWs.getCell(r, newCol), MYTHIC_WEIGHT_BY_LEVEL[level] ?? 0)
  }
  gachaWs.autoFilter = { from: { row: 4, column: 1 }, to: { row: gachaWs.rowCount, column: newCol } }

  // ---- #EnumDefine: WeaponType 2행 + WeaponGrade 1행 추가 ----
  const enumWs = workbook.getWorksheet('#EnumDefine')
  const enumLastRow = enumWs.rowCount
  const enumRowsToAdd = [
    ['WeaponType', TYPE_KOR_NAME.Axe, 'Axe', 'WeaponTable.Type'],
    ['WeaponType', TYPE_KOR_NAME.Staff, 'Staff', 'WeaponTable.Type'],
    ['WeaponGrade', GRADE_KOR_NAME.Mythic, 'Mythic', 'WeaponTable.Grade'],
  ]
  enumRowsToAdd.forEach((values, i) => {
    const row = enumWs.getRow(enumLastRow + 1 + i)
    values.forEach((v, c) => {
      const cell = row.getCell(c + 1)
      cell.value = v
      cell.font = { size: 9 }
      cell.border = THIN_BORDER
      cell.alignment = LEFT
    })
  })

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[seed] 무기를 75종 → 150종(5종류×6등급×5단계)으로 확장했습니다.')
  console.log('[seed] 새 종류: 도끼(CRIT_DMG) / 지팡이(EXIST_GAIN). 새 등급: 신화(Mythic).')
  console.log('[seed] GachaTable에 MythicWeight 컬럼 추가, GrowthCurveTable에 WEAPON_LEVEL_UP_MYTHIC 추가.')
  console.log('[seed] 다음: npm run balance')
}

main()
