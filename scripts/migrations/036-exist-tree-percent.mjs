// 1회성 마이그레이션: v0.3.0 밸런스 개편 — 존재력 트리의 스탯형 효과(EffectType=
// STAT인 39개 노드)를 깡스탯에서 퍼센트로 전환한다. 재화 지급형 노드(GRANT, 11개 —
// 17~20/27~30/38~40번)는 스탯 파이프라인과 무관해 대상이 아니다.
//
// 기존 값(깡스탯, 예: ATK 5→8.6)을 그대로 퍼센트로 재사용하지 않고 새로 정했다.
// 구간 안에서 완만히 증가하는 기존 모양은 유지하되, 4티어 ATK/5티어 ASPD("연장
// 구간")는 1/2티어보다 더 크게 잡아 "후반 구간이 전반보다 강하다"는 기존 설계
// 의도를 유지한다. 50노드 전부 뚫었을 때 스탯별 합계 목표: ATK 154%, ASPD 123%,
// CRIT 18%, CRIT_DMG 45%, EXIST_GAIN 39%.
//
// 실행: node scripts/migrations/036-exist-tree-percent.mjs
// 재실행 방지: Order=1의 Value가 이미 3이면 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

// order → 새 퍼센트 값. STAT 타입 39개 노드만 포함(GRANT 11개는 미포함 — 원래 값 유지).
const VALUES = {}
;[3, 4, 5, 6, 7, 8, 9].forEach((v, i) => (VALUES[1 + i] = v)) // T1 ATK 1~7
;[5, 6, 7].forEach((v, i) => (VALUES[8 + i] = v)) // T1 CRIT 8~10
;[5, 6, 7, 8, 9, 10].forEach((v, i) => (VALUES[11 + i] = v)) // T2 ASPD 11~16
;[5, 6, 7, 8, 9, 10].forEach((v, i) => (VALUES[21 + i] = v)) // T3 CRIT_DMG 21~26
;[10, 12, 14, 16, 18, 20, 22].forEach((v, i) => (VALUES[31 + i] = v)) // T4 ATK 31~37
;[4, 5, 6, 7, 8, 9].forEach((v, i) => (VALUES[41 + i] = v)) // T5 EXIST_GAIN 41~46
;[15, 18, 21, 24].forEach((v, i) => (VALUES[47 + i] = v)) // T5 ASPD 47~50

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] 오류: ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)
  const ws = workbook.getWorksheet('ExistTreeTable')
  if (!ws) {
    console.error('[migration] 오류: ExistTreeTable 시트를 찾지 못했습니다.')
    process.exit(1)
  }

  const engRow = ws.getRow(4)
  const cols = {}
  for (let c = 1; c <= ws.columnCount; c++) {
    const eng = engRow.getCell(c).value
    if (eng) cols[String(eng)] = c
  }

  const firstRow = ws.getRow(5)
  if (Number(firstRow.getCell(cols.Value).value) === 3) {
    console.log('[migration] 이미 적용됨 — 건너뜁니다.')
    return
  }

  let updated = 0
  let missing = 0
  for (let r = 5; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const order = Number(row.getCell(cols.Order).value)
    const effectType = row.getCell(cols.EffectType).value
    if (effectType !== 'STAT') continue
    if (!(order in VALUES)) {
      console.warn(`[migration] 경고: order=${order}(STAT)에 대한 새 값이 없습니다.`)
      missing += 1
      continue
    }
    row.getCell(cols.Value).value = VALUES[order]
    updated += 1
  }

  if (missing > 0) {
    console.error('[migration] 누락된 order가 있어 중단합니다(파일은 저장하지 않음).')
    process.exit(1)
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] ExistTreeTable ${updated}개 STAT 노드를 퍼센트 값으로 재설정.`)
  console.log('[migration] 다음: npm run balance')
}

main()
