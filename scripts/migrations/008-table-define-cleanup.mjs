// 1회성 마이그레이션: WeaponTypeTable/MasteryTable 삭제에 맞춰 #TableDefine·
// #EnumDefine 문서 시트를 갱신한다.
// - #TableDefine: WeaponTypeTable/MasteryTable 행 제거, WeaponTable 행을 새로
//   추가(2단계 개편 때 생긴 테이블인데 그때도 문서화가 안 됐던 걸 이번에 채움),
//   PrimaryStat 칼럼 포함.
// - #EnumDefine: "사용처" 칼럼에 남아있는 WeaponTypeTable 참조를 WeaponTable로 교체.
//
// 실행: node scripts/migrations/008-table-define-cleanup.mjs
// 재실행 방지: #TableDefine에 WeaponTypeTable/MasteryTable 행이 이미 없으면 건너뜀.

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

  const defineWs = workbook.getWorksheet('#TableDefine')
  if (!defineWs) throw new Error('#TableDefine 시트를 찾지 못했습니다.')

  const rows = []
  for (let r = 1; r <= defineWs.rowCount; r++) {
    const row = defineWs.getRow(r)
    const vals = []
    for (let c = 1; c <= defineWs.columnCount; c++) vals.push(row.getCell(c).value)
    rows.push(vals)
  }

  const header = rows[0]
  const dataRows = rows.slice(1)
  const stillHasRemovedTables = dataRows.some((r) => r[0] === 'WeaponTypeTable' || r[0] === 'MasteryTable')
  if (!stillHasRemovedTables) {
    console.log('[migration] #TableDefine에 WeaponTypeTable/MasteryTable 행이 이미 없습니다 — 건너뜁니다.')
  } else {
    const filtered = dataRows.filter((r) => r[0] !== 'WeaponTypeTable' && r[0] !== 'MasteryTable')

    // WeaponTable 정의 블록 — 2단계 개편(75행 리터럴화) 때 문서화가 누락됐던 것도
    // 함께 채운다. 실제 시트 칼럼 순서(006 마이그레이션 이후)와 동일.
    const weaponTableBlock = [
      ['WeaponTable', '순번', 'Index', 'int', '', ''],
      ['WeaponTable', 'ID', 'Id', 'int', '', ''],
      ['WeaponTable', '무기 ID', 'WeaponId', 'string', '"{종류}_{등급}_{단계}" 형식', ''],
      ['WeaponTable', '종류', 'Type', 'enum', '', 'EnumDefine/WeaponType'],
      ['WeaponTable', '주 스탯', 'PrimaryStat', 'enum', '이 무기 종류의 숙련이 곱해지는 대상 스탯 — WeaponTypeTable 삭제로 이관, 같은 종류 25행 전부 동일값(무기별 개별 조정 대비 의도적 중복)', 'EnumDefine/StatType'],
      ['WeaponTable', '등급', 'Grade', 'enum', '', 'EnumDefine/WeaponGrade'],
      ['WeaponTable', '단계', 'Tier', 'int', '1~5', ''],
      ['WeaponTable', '이름ID', 'NameStringId', 'int', '0=미확정(자동 생성 이름 폴백)', 'StringTable/Id'],
      ['WeaponTable', '설명ID', 'DescStringId', 'int', '0=미확정', 'StringTable/Id'],
      ['WeaponTable', '기본 공격력', 'BaseAtk', 'float', '등급·단계 배율까지 곱연산 완료된 최종값', ''],
      ['WeaponTable', '보유 효과값', 'OwnEffectValue', 'float', '', ''],
      ['WeaponTable', '장착 효과값', 'EquipEffectValue', 'float', '', ''],
      ['WeaponTable', '레벨업 곡선', 'CurveKey', 'string', '', 'GrowthCurveTable/CurveKey'],
      ['WeaponTable', '설명', '//Description', 'string', '', ''],
    ]

    const newRows = [header, ...filtered, ...weaponTableBlock]
    defineWs.spliceRows(1, rows.length, ...newRows)
    console.log(
      `[migration] #TableDefine: WeaponTypeTable(8행)/MasteryTable(7행) 정의 제거, WeaponTable(${weaponTableBlock.length}행) 정의 추가.`,
    )
  }

  const enumWs = workbook.getWorksheet('#EnumDefine')
  if (!enumWs) throw new Error('#EnumDefine 시트를 찾지 못했습니다.')
  let replaced = 0
  for (let r = 1; r <= enumWs.rowCount; r++) {
    const cell = enumWs.getRow(r).getCell(4)
    if (typeof cell.value === 'string' && cell.value.includes('WeaponTypeTable')) {
      const next = cell.value.replace(/WeaponTypeTable\.PrimaryStat/g, 'WeaponTable.PrimaryStat').replace(/WeaponTypeTable\.WeaponType/g, 'WeaponTable.Type')
      if (next !== cell.value) {
        cell.value = next
        replaced++
      }
    }
  }
  if (replaced > 0) {
    console.log(`[migration] #EnumDefine: "사용처" 칼럼의 WeaponTypeTable 참조 ${replaced}곳을 WeaponTable로 교체.`)
  } else {
    console.log('[migration] #EnumDefine: 교체할 WeaponTypeTable 참조가 없습니다 — 건너뜁니다.')
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
