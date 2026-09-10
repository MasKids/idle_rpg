// 1회성 마이그레이션: 하드코딩된 UI 문구를 StringTable 41000번대로 이관(3단계
// StringTable 확장, docs/TABLE_REDESIGN.md 4절 Q6 결정 — 기존 40001~40134는 그대로
// 두고 새 항목부터 새 대역을 쓴다).
//
// append-row.mjs와 동일한 안전 원칙(기존 행은 절대 건드리지 않고 끝에만 추가)을
// 한 스크립트 안에서 26개 행에 대해 한 번에 적용한다 — CLI를 26번 따로 호출하는
// 것과 최종 결과는 동일하지만(기존 값 보존 + Id 중복 검사), xlsx 파일을 26번
// 열고 닫는 대신 한 번만 열고 닫아 훨씬 빠르다.
//
// 실행: node scripts/migrations/015-string-table-ui-labels.mjs
// 재실행 방지: StringTable에 Id 41000이 이미 있으면 건너뜀.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

const DATA_START_ROW = 5

// [Id, KOR, ENG, Category] — RebirthModal이 하드코딩 비중이 가장 컸다(TABLE_REDESIGN.md
// 투자 C절). ENG는 프로토타입에 UI 언어 전환 기능이 없어 KOR을 그대로 채운다(다른
// 40001~40134 대역 항목들도 동일 관례).
const ROWS = [
  [41000, 'RebirthModal', '스테이지·스탯·숙련을 초기화하고 무기·유물을 소멸/초기화하는 대신, 그동안 소비한 재화를 전액 돌려받고 도달 스테이지에 비례한 다이아를 새로 받습니다. 존재력 트리는 그대로 유지됩니다.', '스테이지·스탯·숙련을 초기화하고 무기·유물을 소멸/초기화하는 대신, 그동안 소비한 재화를 전액 돌려받고 도달 스테이지에 비례한 다이아를 새로 받습니다. 존재력 트리는 그대로 유지됩니다.'],
  [41001, 'RebirthModal', '(도달 스테이지 기준, 이번 환급에 바로 반영)', '(도달 스테이지 기준, 이번 환급에 바로 반영)'],
  [41002, 'RebirthModal', '초기화 / 소멸', '초기화 / 소멸'],
  [41003, 'RebirthModal', '스테이지 → 1-1', '스테이지 → 1-1'],
  [41004, 'RebirthModal', '5스탯 레벨 전부 0', '5스탯 레벨 전부 0'],
  [41005, 'RebirthModal', '무기 전부 소멸', '무기 전부 소멸'],
  [41006, 'RebirthModal', '유물 전부 초기화', '유물 전부 초기화'],
  [41007, 'RebirthModal', '무기 숙련 레벨 0', '무기 숙련 레벨 0'],
  [41008, 'RebirthModal', '지급', '지급'],
  [41009, 'RebirthModal', '→ 스테이지', '→ 스테이지'],
  [41010, 'RebirthModal', '도달 시', '도달 시'],
  [41011, 'RebirthModal', '유지', '유지'],
  [41012, 'RebirthModal', '해금', '해금'],
  [41013, 'RebirthModal', '리버스 · 타임 하이스트 해금 상태', '리버스 · 타임 하이스트 해금 상태'],
  [41014, 'RebirthModal', '존재력(EXIST), 시간에너지 보유량', '존재력(EXIST), 시간에너지 보유량'],
  [41015, 'StubPanel', '설계 완료 · 프로토타입 미구현', '설계 완료 · 프로토타입 미구현'],
  [41016, 'BattleArea', '플레이어', '플레이어'],
  [41017, 'WeaponDetailModal', '레벨', '레벨'],
  [41018, 'WeaponDetailModal', '최대', '최대'],
  [41019, 'WeaponDetailModal', '개', '개'],
  [41020, 'WeaponDetailModal', '합성 불가', '합성 불가'],
  [41021, 'WeaponDetailModal', '돌파·합성 모두 항상 1개 보존 · 합성 재료', '돌파·합성 모두 항상 1개 보존 · 합성 재료'],
  [41022, 'WeaponDetailModal', '개 필요', '개 필요'],
  [41023, 'OfflineRewardModal', '자리를 비운 동안 전투가 계속된 것으로 계산해 보상을 지급합니다.', '자리를 비운 동안 전투가 계속된 것으로 계산해 보상을 지급합니다.'],
  [41024, 'TimeHeistModal', '미래 스테이지의 보상을 시간에너지로 미리 훔쳐옵니다. 스테이지 진행에는 영향을 주지 않습니다.', '미래 스테이지의 보상을 시간에너지로 미리 훔쳐옵니다. 스테이지 진행에는 영향을 주지 않습니다.'],
  [41025, 'RelicDetailModal', '보유하지 않은 유물입니다', '보유하지 않은 유물입니다'],
]

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const ws = workbook.getWorksheet('StringTable')
  if (!ws) throw new Error('StringTable 시트를 찾지 못했습니다.')

  const existingIds = new Set()
  const lastRow = ws.lastRow ? ws.lastRow.number : DATA_START_ROW - 1
  for (let r = DATA_START_ROW; r <= lastRow; r++) {
    const id = ws.getRow(r).getCell(2).value
    if (id !== null && id !== undefined) existingIds.add(id)
  }

  if (existingIds.has(41000)) {
    console.log('[migration] StringTable에 Id 41000이 이미 있습니다 — 이미 적용된 것으로 보고 건너뜁니다.')
    return
  }

  for (const [id] of ROWS) {
    if (existingIds.has(id)) throw new Error(`Id ${id}가 이미 StringTable에 존재합니다 — 중복.`)
  }

  let nextRow = lastRow + 1
  let nextIndex = lastRow - (DATA_START_ROW - 1) + 1
  for (const [id, category, kor, eng] of ROWS) {
    ws.getRow(nextRow).getCell(1).value = nextIndex
    ws.getRow(nextRow).getCell(2).value = id
    ws.getRow(nextRow).getCell(3).value = kor
    ws.getRow(nextRow).getCell(4).value = eng
    ws.getRow(nextRow).getCell(5).value = category
    nextRow++
    nextIndex++
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] StringTable에 UI 문구 ${ROWS.length}개(Id 41000~${41000 + ROWS.length - 1}) 추가 완료.`)
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
