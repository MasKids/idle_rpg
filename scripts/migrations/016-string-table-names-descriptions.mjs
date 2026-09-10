// 1회성 마이그레이션: 무기 75개 · 유물 9개 · 존재력 노드 50개의 이름/설명을
// StringTable에 채우고 각 테이블이 그 Id만 참조하게 한다(3단계 StringTable 확장,
// docs/TABLE_REDESIGN.md 4절 Q6 대역 설계).
//
// 이름은 전부 미확정이라 자동 생성 값이다("검-레어-3" 형태) — 나중에 엑셀에서
// StringTable 값만 교체하면 된다. 단위 접미사(초 등)는 제외한다(Q5 결정, 무기/노드/
// 유물 설명과는 무관하지만 동일 원칙 적용).
//
// ID 대역:
//   50000~ 무기 이름(75)      51000~ 무기 설명(75)
//   52000~ 유물 설명(9, 이름은 이미 40001~40134에 확정돼 있어 새로 만들지 않음)
//   53000~53049 존재력 노드 이름(50)   53050~53099 존재력 노드 설명(50)
//
// StringTable에는 append-row.mjs와 동일한 안전 원칙(기존 행 보존, 끝에만 추가)으로
// 한 번에 추가하고, WeaponTable/ExistTreeTable/RelicTable은 NameStringId/DescStringId
// 칼럼만 갱신하는 재작성을 한다(다른 칼럼 값은 전부 그대로 보존).
//
// 실행: node scripts/migrations/016-string-table-names-descriptions.mjs
// 재실행 방지: StringTable에 Id 50000이 이미 있으면 건너뜀.

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

const TYPE_KOR = { Sword: '검', Spear: '창', Bow: '활' }
const GRADE_KOR = { Normal: '노말', Rare: '레어', Epic: '에픽', Unique: '유니크', Legendary: '레전드리' }
const STAT_KOR = { ATK: '공격력', ASPD: '공격속도', CRIT: '치명타확률', CRIT_DMG: '치명타피해', EXIST_GAIN: '존재력획득량' }
const CURRENCY_KOR = { TIME_ENERGY: '시간에너지', MASTERY_ESSENCE: '숙련의 정수' }

// RelicTable의 실제 EffectType/EffectValue(9개, 전부 확정된 값)를 기준으로 손으로
// 설명 문장을 쓴다 — relic.ts의 relicEffectLabel()과 동일한 표기 규칙(스탯은
// 접미사 없이 +값, GOLD_GAIN/TIMEHEIST_COOLDOWN은 %)을 따른다.
const RELIC_DESCRIPTIONS = {
  38001: '공격력 +5 증가',
  38002: '공격속도 +0.05 증가',
  38003: '치명타확률 +2 증가',
  38004: '공격속도 +0.1 증가',
  38005: '치명타피해 +15 증가',
  38006: '골드 획득량 +10% 증가',
  38007: '존재력 획득량 +0.1 증가',
  38008: '타임 하이스트 쿨타임 -10% 감소',
  38009: '공격력 +20 증가',
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const stringWs = workbook.getWorksheet('StringTable')
  const weaponWs = workbook.getWorksheet('WeaponTable')
  const treeWs = workbook.getWorksheet('ExistTreeTable')
  const relicWs = workbook.getWorksheet('RelicTable')
  if (!stringWs || !weaponWs || !treeWs || !relicWs) throw new Error('필요한 시트를 찾지 못했습니다.')

  const stringExistingIds = new Set()
  const stringLastRow = stringWs.lastRow ? stringWs.lastRow.number : DATA_START_ROW - 1
  for (let r = DATA_START_ROW; r <= stringLastRow; r++) {
    const id = stringWs.getRow(r).getCell(2).value
    if (id !== null && id !== undefined) stringExistingIds.add(id)
  }
  if (stringExistingIds.has(50000)) {
    console.log('[migration] StringTable에 Id 50000이 이미 있습니다 — 이미 적용된 것으로 보고 건너뜁니다.')
    return
  }

  // ---- WeaponTable 읽기 (75행) ----
  const wEngRow = weaponWs.getRow(4)
  const wCols = {}
  for (let c = 1; c <= weaponWs.columnCount; c++) {
    const eng = wEngRow.getCell(c).value
    if (eng) wCols[eng] = c
  }
  const wLastRow = weaponWs.lastRow.number
  const weaponRows = []
  for (let r = DATA_START_ROW; r <= wLastRow; r++) {
    const row = weaponWs.getRow(r)
    weaponRows.push({
      Index: row.getCell(wCols.Index).value,
      Id: row.getCell(wCols.Id).value,
      WeaponId: row.getCell(wCols.WeaponId).value,
      Type: row.getCell(wCols.Type).value,
      PrimaryStat: row.getCell(wCols.PrimaryStat).value,
      Grade: row.getCell(wCols.Grade).value,
      Tier: row.getCell(wCols.Tier).value,
      BaseAtk: row.getCell(wCols.BaseAtk).value,
      OwnEffectValue: row.getCell(wCols.OwnEffectValue).value,
      EquipEffectValue: row.getCell(wCols.EquipEffectValue).value,
      CurveKey: row.getCell(wCols.CurveKey).value,
      Description: row.getCell(wCols['//Description']).value ?? '',
    })
  }

  // ---- ExistTreeTable 읽기 (50행) ----
  const tEngRow = treeWs.getRow(4)
  const tCols = {}
  for (let c = 1; c <= treeWs.columnCount; c++) {
    const eng = tEngRow.getCell(c).value
    if (eng) tCols[eng] = c
  }
  const tLastRow = treeWs.lastRow.number
  const treeRows = []
  for (let r = DATA_START_ROW; r <= tLastRow; r++) {
    const row = treeWs.getRow(r)
    treeRows.push({
      Index: row.getCell(tCols.Index).value,
      Id: row.getCell(tCols.Id).value,
      Order: row.getCell(tCols.Order).value,
      Tier: row.getCell(tCols.Tier).value,
      EffectType: row.getCell(tCols.EffectType).value,
      StatType: row.getCell(tCols.StatType).value,
      GrantCurrency: row.getCell(tCols.GrantCurrency).value,
      Value: row.getCell(tCols.Value).value,
      Cost: row.getCell(tCols.Cost).value,
    })
  }

  // ---- RelicTable 읽기 (9행, DescStringId 칼럼 신설) ----
  const rEngRow = relicWs.getRow(4)
  const rCols = {}
  for (let c = 1; c <= relicWs.columnCount; c++) {
    const eng = rEngRow.getCell(c).value
    if (eng) rCols[eng] = c
  }
  if (rCols.DescStringId) {
    console.log('[migration] RelicTable에 이미 DescStringId 칼럼이 있습니다 — 건너뜁니다.')
    return
  }
  const rLastRow = relicWs.lastRow.number
  const relicRows = []
  for (let r = DATA_START_ROW; r <= rLastRow; r++) {
    const row = relicWs.getRow(r)
    relicRows.push({
      Index: row.getCell(rCols.Index).value,
      Id: row.getCell(rCols.Id).value,
      RelicGrade: row.getCell(rCols.RelicGrade).value,
      Name: row.getCell(rCols.Name).value,
      EffectType: row.getCell(rCols.EffectType).value,
      EffectValue: row.getCell(rCols.EffectValue).value,
      GachaWeight: row.getCell(rCols.GachaWeight).value,
      Description: row.getCell(rCols['//Description']).value ?? '',
    })
  }

  // ---- 새 StringTable 행 조립 ----
  const newStringRows = []
  weaponRows.forEach((w, i) => {
    const nameId = 50000 + i
    const descId = 51000 + i
    const typeKor = TYPE_KOR[w.Type]
    const gradeKor = GRADE_KOR[w.Grade]
    const name = `${typeKor}-${gradeKor}-${w.Tier}`
    const desc = `${typeKor} ${gradeKor} 등급 무기, ${w.Tier}단계`
    newStringRows.push([nameId, 'WeaponName', name, name])
    newStringRows.push([descId, 'WeaponDesc', desc, desc])
    w.NameStringId = nameId
    w.DescStringId = descId
  })
  relicRows.forEach((r) => {
    const descId = 52000 + (r.Id - 38001)
    const desc = RELIC_DESCRIPTIONS[r.Id]
    if (!desc) throw new Error(`RelicTable Id ${r.Id}에 대한 설명이 준비되지 않았습니다.`)
    newStringRows.push([descId, 'RelicDesc', desc, desc])
    r.DescStringId = descId
  })
  treeRows.forEach((n, i) => {
    const nameId = 53000 + i
    const descId = 53050 + i
    const indexInTier = ((n.Order - 1) % 10) + 1
    const name = `T${n.Tier}-${indexInTier}`
    let desc
    if (n.EffectType === 'STAT') {
      desc = `${STAT_KOR[n.StatType]} +${n.Value} 증가`
    } else {
      desc = `${CURRENCY_KOR[n.GrantCurrency]} ${n.Value} 지급`
    }
    newStringRows.push([nameId, 'ExistNodeName', name, name])
    newStringRows.push([descId, 'ExistNodeDesc', desc, desc])
    n.NameStringId = nameId
    n.DescStringId = descId
  })

  for (const [id] of newStringRows) {
    if (stringExistingIds.has(id)) throw new Error(`Id ${id}가 이미 StringTable에 존재합니다 — 중복.`)
  }

  let nextRow = stringLastRow + 1
  let nextIndex = stringLastRow - (DATA_START_ROW - 1) + 1
  for (const [id, category, kor, eng] of newStringRows) {
    stringWs.getRow(nextRow).getCell(1).value = nextIndex
    stringWs.getRow(nextRow).getCell(2).value = id
    stringWs.getRow(nextRow).getCell(3).value = kor
    stringWs.getRow(nextRow).getCell(4).value = eng
    stringWs.getRow(nextRow).getCell(5).value = category
    nextRow++
    nextIndex++
  }
  console.log(`[migration] StringTable에 이름/설명 ${newStringRows.length}개 추가.`)

  // ---- WeaponTable 재작성 (NameStringId/DescStringId만 갱신, 나머지 보존) ----
  const weaponColumns = [
    { ref: '', kor: '순번', type: 'int', eng: 'Index' },
    { ref: '', kor: 'ID', type: 'int', eng: 'Id' },
    { ref: '', kor: '무기 ID', type: 'string', eng: 'WeaponId' },
    { ref: 'EnumDefine/WeaponType', kor: '종류', type: 'enum', eng: 'Type' },
    { ref: 'EnumDefine/StatType', kor: '주스탯', type: 'enum', eng: 'PrimaryStat' },
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
  writeDataSheet(
    workbook,
    'WeaponTable',
    weaponColumns,
    weaponRows.map((w) => [
      w.Index,
      w.Id,
      w.WeaponId,
      w.Type,
      w.PrimaryStat,
      w.Grade,
      w.Tier,
      w.NameStringId,
      w.DescStringId,
      w.BaseAtk,
      w.OwnEffectValue,
      w.EquipEffectValue,
      w.CurveKey,
      w.Description,
    ]),
  )
  console.log(`[migration] WeaponTable NameStringId/DescStringId 갱신 완료(${weaponRows.length}행).`)

  // ---- ExistTreeTable 재작성 ----
  const treeColumns = [
    { ref: '', kor: '순번', type: 'int', eng: 'Index' },
    { ref: '', kor: 'ID', type: 'int', eng: 'Id' },
    { ref: '', kor: '순서', type: 'int', eng: 'Order' },
    { ref: '', kor: '티어', type: 'int', eng: 'Tier' },
    { ref: 'StringTable/Id', kor: '이름ID', type: 'int', eng: 'NameStringId' },
    { ref: 'StringTable/Id', kor: '설명ID', type: 'int', eng: 'DescStringId' },
    { ref: 'EnumDefine/NodeEffectType', kor: '효과 종류', type: 'enum', eng: 'EffectType' },
    { ref: 'EnumDefine/StatType', kor: '스탯 종류', type: 'enum', eng: 'StatType' },
    { ref: 'EnumDefine/CurrencyType', kor: '지급 재화', type: 'enum', eng: 'GrantCurrency' },
    { ref: '', kor: '효과값', type: 'float', eng: 'Value' },
    { ref: '', kor: '비용', type: 'int', eng: 'Cost' },
  ]
  writeDataSheet(
    workbook,
    'ExistTreeTable',
    treeColumns,
    treeRows.map((n) => [
      n.Index,
      n.Id,
      n.Order,
      n.Tier,
      n.NameStringId,
      n.DescStringId,
      n.EffectType,
      n.StatType,
      n.GrantCurrency,
      n.Value,
      n.Cost,
    ]),
  )
  console.log(`[migration] ExistTreeTable NameStringId/DescStringId 갱신 완료(${treeRows.length}행).`)

  // ---- RelicTable 재작성 (DescStringId 칼럼 신설) ----
  const relicColumns = [
    { ref: '', kor: '순번', type: 'int', eng: 'Index' },
    { ref: '', kor: 'ID', type: 'int', eng: 'Id' },
    { ref: 'EnumDefine/RelicGrade', kor: '등급', type: 'enum', eng: 'RelicGrade' },
    { ref: 'StringTable/Id', kor: '이름ID', type: 'int', eng: 'Name' },
    { ref: 'StringTable/Id', kor: '설명ID', type: 'int', eng: 'DescStringId' },
    { ref: 'EnumDefine/RelicEffectType', kor: '효과 종류', type: 'enum', eng: 'EffectType' },
    { ref: '', kor: '효과 수치', type: 'float', eng: 'EffectValue' },
    { ref: '', kor: '뽑기 가중치', type: 'float', eng: 'GachaWeight' },
    { ref: '', kor: '설명', type: 'string', eng: '//Description' },
  ]
  writeDataSheet(
    workbook,
    'RelicTable',
    relicColumns,
    relicRows.map((r) => [
      r.Index,
      r.Id,
      r.RelicGrade,
      r.Name,
      r.DescStringId,
      r.EffectType,
      r.EffectValue,
      r.GachaWeight,
      r.Description,
    ]),
  )
  console.log(`[migration] RelicTable에 DescStringId 칼럼 추가 완료(${relicRows.length}행).`)

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
