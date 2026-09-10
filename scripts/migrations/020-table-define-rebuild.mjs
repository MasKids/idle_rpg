// 1회성 마이그레이션: #TableDefine을 현재 실제 시트 구조에서 다시 생성한다.
//
// 이전 마이그레이션들(008/012/014)이 "삽입 위치를 텍스트로 찾아 그 자리에 끼워
// 넣는" 방식으로 #TableDefine을 패치해왔는데, 그 탐색 로직이 방금 추가한 블록의
// 꼬리(예: WeaponTable의 마지막 CurveKey/설명 행)를 다시 매치해버려 부분 중복이
// 누적됐다(WeaponTable 정의가 3번 겹쳐 있었음 — #TableDefine은 balance.json 빌드에서
// 제외되는 순수 문서 시트라 게임 동작에는 영향 없었지만 부정확했다). 이 스크립트는
// 그 누적 오류를 고치는 김에, 매번 텍스트로 삽입 위치를 찾는 대신 실제 데이터
// 시트(#으로 시작하지 않는 시트)의 4행 헤더(참조/한글명/자료형/영문명)를 그대로
// 읽어 #TableDefine 전체를 재생성한다 — 더 이상 수작업 삽입이 필요 없다.
//
// 실행: node scripts/migrations/020-table-define-rebuild.mjs
// (멱등적 — 몇 번을 실행해도 항상 현재 시트 구조를 그대로 재생성한다)

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')

// 시트 순서 — 기존 #TableDefine의 대략적인 순서를 최대한 따른다(가독성).
const TABLE_ORDER = [
  'StageTable',
  'ExistTreeTable',
  'FeatureUnlockTable',
  'WeaponBreakthroughTable',
  'WeaponTable',
  'GachaTable',
  'RelicTable',
  'RelicSlotTable',
  'TimeHeistTable',
  'RebirthRewardTable',
  'CommonTable',
  'StringTable',
  'GrowthCurveTable',
  'CurrencyTable',
  'StatTable',
]

// (테이블, 영문 칼럼명) → 칼럼 설명 — 그동안 마이그레이션 스크립트가 손으로 달아온
// 의미 있는 주석만 보존한다. 나머지는 빈 칸(기존 관례와 동일).
const DESCRIPTIONS = {
  'WeaponTable.WeaponId': '"{종류}_{등급}_{단계}" 형식',
  'WeaponTable.PrimaryStat':
    '이 무기 종류의 숙련이 곱해지는 대상 스탯 — WeaponTypeTable 삭제로 이관, 같은 종류 25행 전부 동일값(무기별 개별 조정 대비 의도적 중복)',
  'WeaponTable.GradeNameStringId': 'WeaponGradeTable/GradeTable 삭제로 이관 — 같은 등급 15행 전부 동일값(의도적 중복)',
  'WeaponTable.GradeColorToken': 'WeaponGradeTable/GradeTable 삭제로 이관 — 같은 등급 15행 전부 동일값(의도적 중복)',
  'WeaponTable.Tier': '1~5',
  'WeaponTable.NameStringId': '0=미확정(자동 생성 이름 폴백)',
  'WeaponTable.DescStringId': '0=미확정',
  'RelicTable.DescStringId': '3단계 StringTable 확장으로 신설',
  'RelicTable.GradeNameStringId': 'GradeTable 삭제로 이관 — 같은 등급 3행 전부 동일값(의도적 중복)',
  'RelicTable.GradeColorToken': 'GradeTable 삭제로 이관 — 같은 등급 3행 전부 동일값(의도적 중복)',
  'TimeHeistTable.UsedCount': '0부터 시작, 이 값을 넘는 사용 횟수는 마지막 행 값으로 고정',
  'StageTable.FirstClearDiamond': '이 스테이지를 계정 통틀어 처음 클리어할 때만 지급(3단계 진행 속도 조정에서 신설) — 챕터가 오를수록·보스일수록 커짐',
}

function readSheetHeader(ws) {
  const refRow = ws.getRow(1)
  const korRow = ws.getRow(2)
  const typeRow = ws.getRow(3)
  const engRow = ws.getRow(4)
  const cols = []
  for (let c = 1; c <= ws.columnCount; c++) {
    const eng = engRow.getCell(c).value
    if (!eng) continue
    cols.push({
      kor: korRow.getCell(c).value ?? '',
      eng: String(eng),
      type: typeRow.getCell(c).value ?? 'string',
      ref: refRow.getCell(c).value ?? '',
    })
  }
  return cols
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const defineWs = workbook.getWorksheet('#TableDefine')
  if (!defineWs) throw new Error('#TableDefine 시트를 찾지 못했습니다.')

  const sheetNames = workbook.worksheets.map((w) => w.name).filter((n) => !n.startsWith('#'))
  const missingFromOrder = sheetNames.filter((n) => !TABLE_ORDER.includes(n))
  const orderedNames = [...TABLE_ORDER.filter((n) => sheetNames.includes(n)), ...missingFromOrder]

  const rows = [['테이블명', '칼럼', '칼럼명(영문)', '자료형', '칼럼 설명', '비고']]
  for (const name of orderedNames) {
    const ws = workbook.getWorksheet(name)
    if (!ws) continue
    const cols = readSheetHeader(ws)
    for (const col of cols) {
      const desc = DESCRIPTIONS[`${name}.${col.eng}`] ?? ''
      rows.push([name, col.kor, col.eng, col.type, desc, col.ref])
    }
  }

  defineWs.spliceRows(1, defineWs.rowCount, ...rows)
  // 남은 빈 꼬리 행이 있으면(재생성분이 이전보다 짧을 경우) 지운다.
  for (let r = defineWs.rowCount; r > rows.length; r--) {
    defineWs.spliceRows(r, 1)
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] #TableDefine 재생성 완료 — 테이블 ${orderedNames.length}개, 칼럼 정의 ${rows.length - 1}행.`)
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
