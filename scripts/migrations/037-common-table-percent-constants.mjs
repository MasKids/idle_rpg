// 1회성 마이그레이션: v0.3.0 밸런스 개편 — 깡스탯/퍼센트 분리에 필요한
// CommonTable 값 정리.
//   - WeaponBaseAtkOwnPercentRatio(신규, 0.5) — 무기 보유 시 종류 불문 적용되는
//     "기본 공격력 보유 퍼센트"가 특화 스탯 보유 퍼센트(WeaponTable.OwnEffectValue)
//     대비 갖는 비율. 검/창/활 전부 보유해도 매번 적용되는 범용 효과라 특화
//     효과보다 절반만 반영한다.
//   - MasteryMultiplierPerLevel(기존 0.05 → 5) — 이전엔 "1 + 레벨×0.05" 배율
//     공식의 계수(소수)였는데, 이제 존재력 트리/무기 보유와 같은 퍼센트 합산
//     버킷에 "레벨×포인트"로 직접 더해지는 퍼센트 포인트 값으로 바뀐다.
//     레벨당 +5%라는 실제 성장률 자체는 그대로다(0.05 → 5는 단위 변경일 뿐).
//
// 실행: node scripts/migrations/037-common-table-percent-constants.mjs
// 재실행 방지: WeaponBaseAtkOwnPercentRatio가 이미 있으면 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')
const DATA_START_ROW = 5

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] 오류: ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)
  const ws = workbook.getWorksheet('CommonTable')
  if (!ws) {
    console.error('[migration] 오류: CommonTable 시트를 찾지 못했습니다.')
    process.exit(1)
  }

  const engRow = ws.getRow(4)
  const cols = {}
  for (let c = 1; c <= ws.columnCount; c++) {
    const eng = engRow.getCell(c).value
    if (eng) cols[String(eng)] = c
  }

  let masteryRow = -1
  let maxId = 0
  for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const key = row.getCell(cols.Key).value
    const id = Number(row.getCell(cols.Id).value)
    if (Number.isFinite(id)) maxId = Math.max(maxId, id)
    if (key === 'WeaponBaseAtkOwnPercentRatio') {
      console.log('[migration] 이미 적용됨 — 건너뜁니다.')
      return
    }
    if (key === 'MasteryMultiplierPerLevel') masteryRow = r
  }

  if (masteryRow === -1) {
    console.error('[migration] 오류: CommonTable에서 MasteryMultiplierPerLevel을 찾지 못했습니다.')
    process.exit(1)
  }

  ws.getRow(masteryRow).getCell(cols.Value).value = 5

  const newRow = ws.getRow(ws.rowCount + 1)
  newRow.getCell(cols.Index).value = ws.rowCount - (DATA_START_ROW - 1)
  newRow.getCell(cols.Id).value = maxId + 1
  newRow.getCell(cols.Key).value = 'WeaponBaseAtkOwnPercentRatio'
  newRow.getCell(cols.Value).value = 0.5
  newRow.getCell(cols.ValueType).value = 'float'

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] MasteryMultiplierPerLevel 0.05 → 5, WeaponBaseAtkOwnPercentRatio(신규) = 0.5 적용.')
  console.log('[migration] 다음: npm run balance')
}

main()
