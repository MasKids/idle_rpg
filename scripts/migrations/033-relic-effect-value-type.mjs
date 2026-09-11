// 1회성 마이그레이션: v0.3.0 밸런스 개편(깡스탯/퍼센트 분리) — 유물은 "혼합"
// 역할이라(유물별로 깡스탯일 수도, 퍼센트일 수도 있음) RelicTable에 EffectValueType
// (FLAT/PERCENT) 칼럼을 새로 추가하고, 퍼센트로 바뀌는 3개 유물의 EffectValue를
// 깡수치 재사용 없이 새로 정한다(요청사항 — 기존 깡수치를 퍼센트로 그대로 쓰지
// 않음). GOLD_GAIN/TIMEHEIST_COOLDOWN은 원래도 퍼센트 전용 특수 효과라
// EffectValueType=PERCENT로 채우되(스탯 파이프라인 밖이라 코드가 이 칼럼을 읽지는
// 않음, 문서화 목적) 수치는 그대로 둔다.
//
// 등급별 구성: Normal 3종은 전부 FLAT(입문용 — 값이 그대로 스탯에 더해져 이해하기
// 쉬움). Rare 3종은 혼합(ASPD는 PERCENT로 전환, CRIT_DMG는 FLAT 유지, GOLD_GAIN은
// 원래 PERCENT). Epic 3종은 대부분 PERCENT(EXIST_GAIN·ATK를 PERCENT로 전환 —
// 후반 갈수록 퍼센트 비중이 커지는 설계 의도).
//
// 실행: node scripts/migrations/033-relic-effect-value-type.mjs
// 재실행 방지: EffectValueType 칼럼이 이미 있으면 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

// Id → { valueType, newEffectValue(선택 — 지정 안 하면 기존 값 유지) }
const RELIC_UPDATES = {
  38001: { valueType: 'FLAT' }, // Normal STAT_ATK +5 (유지)
  38002: { valueType: 'FLAT' }, // Normal STAT_ASPD +0.05 (유지)
  38003: { valueType: 'FLAT' }, // Normal STAT_CRIT +2 (유지)
  38004: { valueType: 'PERCENT', newEffectValue: 8 }, // Rare STAT_ASPD: 깡스탯→퍼센트 +8%
  38005: { valueType: 'FLAT' }, // Rare STAT_CRIT_DMG +15 (유지)
  38006: { valueType: 'PERCENT' }, // Rare GOLD_GAIN +10% (원래 퍼센트, 유지)
  38007: { valueType: 'PERCENT', newEffectValue: 12 }, // Epic STAT_EXIST_GAIN: 깡스탯→퍼센트 +12%
  38008: { valueType: 'PERCENT' }, // Epic TIMEHEIST_COOLDOWN -10% (원래 퍼센트, 유지)
  38009: { valueType: 'PERCENT', newEffectValue: 15 }, // Epic STAT_ATK: 깡스탯→퍼센트 +15%
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] 오류: ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)
  const ws = workbook.getWorksheet('RelicTable')
  if (!ws) {
    console.error('[migration] 오류: RelicTable 시트를 찾지 못했습니다.')
    process.exit(1)
  }

  const engRow = ws.getRow(4)
  const cols = {}
  for (let c = 1; c <= ws.columnCount; c++) {
    const eng = engRow.getCell(c).value
    if (eng) cols[String(eng)] = c
  }

  if (cols.EffectValueType) {
    console.log('[migration] 이미 적용됨 — 건너뜁니다.')
    return
  }

  // 새 칼럼은 끝(//Description 다음)에 추가한다 — 위치는 조회에 영향 없음(이름으로
  // 찾으므로), spliceColumns로 중간에 끼워 넣다 순서가 꼬였던 전례(migration 025/026)를
  // 피하기 위해 항상 append만 한다.
  const newCol = ws.columnCount + 1
  ws.getRow(1).getCell(newCol).value = 'EnumDefine/EffectValueType'
  ws.getRow(2).getCell(newCol).value = '효과 수치 종류'
  ws.getRow(3).getCell(newCol).value = 'enum'
  ws.getRow(4).getCell(newCol).value = 'EffectValueType'

  const idCol = cols.Id
  const valueCol = cols.EffectValue
  let updated = 0
  for (let r = 5; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const id = row.getCell(idCol).value
    const update = RELIC_UPDATES[id]
    if (!update) {
      console.warn(`[migration] 경고: RelicTable Id=${id}에 대한 EffectValueType 지정이 없습니다.`)
      continue
    }
    row.getCell(newCol).value = update.valueType
    if (update.newEffectValue !== undefined) row.getCell(valueCol).value = update.newEffectValue
    updated += 1
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] RelicTable ${updated}행에 EffectValueType 추가 완료.`)
  console.log('[migration] 다음: node scripts/migrations/020-table-define-rebuild.mjs 로 #TableDefine 갱신, #EnumDefine에 EffectValueType 그룹 추가, npm run balance')
}

main()
