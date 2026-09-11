// 025번 마이그레이션의 spliceColumns 삽입이 예상과 다르게 동작해(//Description이
// 밀리지 않고 그 자리에 남고, 빈 칼럼이 하나 끼어든 채로) RebirthRewardTable 헤더
// 순서가 깨졌다. 이 스크립트는 현재 시트를 칼럼 "이름" 기준으로 읽어 값을 보존한
// 뒤, 올바른 순서(Index/Id/StageFrom/StageTo/DiamondReward/GrowthEnergyReward/
// GoldReward/MasteryEssenceReward/Description)로 시트를 통째로 다시 쓴다.
//
// 실행: node scripts/migrations/026-rebirth-reward-table-column-fix.mjs
// 재실행 방지: 헤더가 이미 올바른 순서면(6번 칼럼이 GrowthEnergyReward) 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')
const DATA_START_ROW = 5

const CORRECT_ORDER = [
  'Index',
  'Id',
  'StageFrom',
  'StageTo',
  'DiamondReward',
  'GrowthEnergyReward',
  'GoldReward',
  'MasteryEssenceReward',
  '//Description',
]

function fail(message) {
  console.error(`[migration] 오류: ${message}`)
  process.exit(1)
}

async function main() {
  if (!existsSync(XLSX_PATH)) fail(`${XLSX_PATH} 파일이 없습니다.`)

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const ws = workbook.getWorksheet('RebirthRewardTable')
  if (!ws) fail('RebirthRewardTable 시트를 찾지 못했습니다.')

  if (String(ws.getRow(4).getCell(6).value) === 'GrowthEnergyReward') {
    console.log('[migration] 이미 올바른 순서입니다 — 건너뜁니다.')
    return
  }

  // 현재 칼럼을 영문명(4행) 기준으로 인덱싱 — 빈 칼럼(null)은 무시.
  const columnsByName = {}
  for (let c = 1; c <= ws.columnCount; c++) {
    const eng = ws.getRow(4).getCell(c).value
    if (!eng) continue
    columnsByName[String(eng)] = {
      ref: ws.getRow(1).getCell(c).value,
      kor: ws.getRow(2).getCell(c).value,
      type: ws.getRow(3).getCell(c).value,
      eng: String(eng),
      data: [],
    }
  }
  for (let r = DATA_START_ROW; r <= ws.rowCount; r++) {
    for (const eng of Object.keys(columnsByName)) {
      // 원래 칼럼 위치를 다시 찾아 그 열의 데이터 행 값을 읽는다.
      let colIndex = -1
      for (let c = 1; c <= ws.columnCount; c++) {
        if (String(ws.getRow(4).getCell(c).value) === eng) {
          colIndex = c
          break
        }
      }
      columnsByName[eng].data.push(ws.getRow(r).getCell(colIndex).value)
    }
  }

  const rowCount = columnsByName['Index'].data.length

  // 시트를 지우고 올바른 순서로 다시 쓴다.
  ws.spliceColumns(1, ws.columnCount)
  CORRECT_ORDER.forEach((eng, i) => {
    const col = columnsByName[eng]
    const cIdx = i + 1
    ws.getRow(1).getCell(cIdx).value = col.ref ?? null
    ws.getRow(2).getCell(cIdx).value = col.kor
    ws.getRow(3).getCell(cIdx).value = col.type
    ws.getRow(4).getCell(cIdx).value = col.eng
    for (let r = 0; r < rowCount; r++) {
      ws.getRow(DATA_START_ROW + r).getCell(cIdx).value = col.data[r]
    }
  })

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[migration] RebirthRewardTable 칼럼 순서를 복구했습니다:', CORRECT_ORDER.join(', '))
}

main()
