// 최초 1회(또는 초기값으로 되돌리고 싶을 때) balance/balance.xlsx를 만드는 스크립트.
// 코드에 흩어져 있던 밸런싱 수치를 각 시트의 초기값으로 그대로 옮겨 담는다.
// 이미 balance.xlsx가 있으면 실수로 덮어쓰지 않도록 --force 없이는 중단한다.
//
// 시트 구조:
//   1행 = 시트 제목(색으로 구분되는 캡션, 표에는 포함 안 됨)
//   2행 = 엑셀 "표(Table)" 헤더 (번호/이름/key/value/기본값/설명) — 이름 붙은 표라
//         이름상자에서 바로 찾거나 수식에서 tbl_전투[value]처럼 참조할 수 있다
//   3행부터 = 데이터. key(C열)는 회색, value(D열)는 연노랑으로 칠해 구분한다.

import ExcelJS from 'exceljs'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = resolve(__dirname, '../balance/balance.xlsx')

// 현재 코드의 nodeCost 공식과 동일 — 리버스/타임하이스트 해금 비용의 초기값을
// 손계산 없이 실제 공식으로 정확히 뽑아낸다.
function nodeCost(order) {
  return Math.floor(10 * 1.35 ** (order - 1))
}

// 시트명(한글) → 표 이름에 쓸 영문 카테고리 키 (build-balance.mjs의 SHEET_TO_CATEGORY와 동일 매핑)
const SHEET_TO_CATEGORY = {
  전투: 'battle',
  보상: 'rewards',
  스탯: 'stats',
  장비숙련: 'equipmentMastery',
  존재력트리: 'existTree',
  타임하이스트: 'timeHeist',
  오프라인: 'offline',
}

// 시트별 제목 캡션 색상 — 구분하기 쉽도록 카테고리마다 다르게
const SHEET_ACCENT_COLOR = {
  전투: 'FFC62828',
  보상: 'FFEF6C00',
  스탯: 'FF1565C0',
  장비숙련: 'FF2E7D32',
  존재력트리: 'FF6A1B9A',
  타임하이스트: 'FFF9A825',
  오프라인: 'FF00838F',
}

// [이름, key, value, 설명]
const SHEETS = {
  전투: [
    ['적 기본 HP', 'enemyBaseHp', 20, '1스테이지 기준 일반 적 기본 HP'],
    ['적 HP 증가율', 'enemyHpGrowth', 1.15, '적 HP = enemyBaseHp × enemyHpGrowth^(스테이지-1)'],
    ['적 기본 공격력', 'enemyBaseAtk', 3, '1스테이지 기준 적 기본 공격력'],
    ['적 공격력 증가율', 'enemyAtkGrowth', 1.12, '적 공격력 = enemyBaseAtk × enemyAtkGrowth^(스테이지-1)'],
    ['스테이지당 처치 필요 수', 'killsRequiredPerStage', 5, '일반 스테이지에서 다음 스테이지로 넘어가기 위한 처치 수 (보스는 1 고정)'],
    ['보스 등장 주기', 'bossInterval', 10, 'N스테이지마다 보스 등장 (예: 10 = 10, 20, 30...)'],
    ['보스 HP 배율', 'bossHpMultiplier', 5, '보스 HP = 일반 계산값 × 이 배율'],
    ['보스 공격력 배율', 'bossAtkMultiplier', 2, '보스 공격력 = 일반 계산값 × 이 배율'],
    ['보스 보상 배율', 'bossRewardMultiplier', 3, '보스 처치 시 골드/성장에너지/존재력 보상 × 이 배율'],
  ],
  보상: [
    ['골드 기본 획득량', 'goldBaseReward', 5, '1스테이지 기준 처치당 골드 기본 획득량'],
    ['골드 증가율', 'goldGrowth', 1.1, '골드 보상 = goldBaseReward × goldGrowth^(스테이지-1)'],
    ['성장에너지 기본 획득량', 'growthEnergyBaseReward', 2, '1스테이지 기준 처치당 성장에너지 기본 획득량'],
    ['성장에너지 증가율', 'growthEnergyGrowth', 1.08, '성장에너지 보상 = growthEnergyBaseReward × growthEnergyGrowth^(스테이지-1)'],
    ['존재력 보상 나눔값', 'existRewardStageDivisor', 10, '존재력 보상 = max(1, floor(스테이지 / 이 값))'],
    ['존재력 보스 배율', 'existRewardBossMultiplier', 2, '보스 처치 시 존재력 보상 × 이 배율'],
    ['보스 시간에너지 보상', 'bossTimeEnergyReward', 5, '보스 처치 시 지급하는 시간에너지 고정량'],
  ],
  스탯: [
    ['ATK 기본값', 'statBaseAtk', 1, 'ATK 레벨 0 기본값'],
    ['DEF 기본값', 'statBaseDef', 1, 'DEF 레벨 0 기본값'],
    ['ASPD 기본값', 'statBaseAspd', 1, 'ASPD 레벨 0 기본값'],
    ['CRIT 기본값', 'statBaseCrit', 0, 'CRIT(%) 레벨 0 기본값'],
    ['CRIT_DMG 기본값', 'statBaseCritDmg', 150, 'CRIT_DMG(%) 레벨 0 기본값'],
    ['EXIST_GAIN 기본값', 'statBaseExistGain', 1, 'EXIST_GAIN 배율 레벨 0 기본값'],
    ['ATK 레벨당 상승치', 'statGrowthAtk', 1, '레벨업 1회당 ATK 상승치'],
    ['DEF 레벨당 상승치', 'statGrowthDef', 1, '레벨업 1회당 DEF 상승치'],
    ['ASPD 레벨당 상승치', 'statGrowthAspd', 0.05, '레벨업 1회당 ASPD 상승치'],
    ['CRIT 레벨당 상승치', 'statGrowthCrit', 0.5, '레벨업 1회당 CRIT(%) 상승치'],
    ['CRIT_DMG 레벨당 상승치', 'statGrowthCritDmg', 2, '레벨업 1회당 CRIT_DMG(%) 상승치'],
    ['EXIST_GAIN 레벨당 상승치', 'statGrowthExistGain', 0.02, '레벨업 1회당 EXIST_GAIN 배율 상승치'],
    ['스탯 업그레이드 기준 비용', 'statUpgradeCostBase', 8, '스탯 업그레이드 비용(성장에너지) 레벨 0→1 기준값'],
    ['스탯 업그레이드 비용 증가율', 'statUpgradeCostGrowth', 1.18, '비용 = statUpgradeCostBase × statUpgradeCostGrowth^현재레벨'],
  ],
  장비숙련: [
    ['장비 레벨당 상승치', 'equipmentValuePerLevel', 2, '장비 강화 레벨당 ATK/DEF 상승치 (5부위 공용)'],
    ['장비 강화 기준 비용', 'equipmentCostBase', 15, '장비 강화 비용(골드) 레벨 0→1 기준값'],
    ['장비 강화 비용 증가율', 'equipmentCostGrowth', 1.22, '비용 = equipmentCostBase × equipmentCostGrowth^현재레벨'],
    ['숙련 레벨당 ATK 배율', 'masteryMultiplierPerLevel', 0.05, '무기 숙련 레벨당 ATK 배율 상승치 (0.05 = +5%)'],
    ['숙련 기준 비용', 'masteryCostBase', 10, '무기 숙련 비용(정수/essence) 레벨 0→1 기준값'],
    ['숙련 비용 증가율', 'masteryCostGrowth', 1.25, '비용 = masteryCostBase × masteryCostGrowth^현재레벨'],
  ],
  존재력트리: [
    ['총 노드 개수', 'totalNodes', 50, '존재력 트리 총 노드 개수'],
    ['노드 비용 기준값', 'nodeCostBase', 10, '노드 해금 비용(존재력) order=1 기준값'],
    ['노드 비용 증가율', 'nodeCostGrowth', 1.35, '비용 = nodeCostBase × nodeCostGrowth^(order-1)'],
    ['스탯 효과 기본값', 'statValueBase', 5, '스탯 지급 노드의 효과값 기본치'],
    ['스탯 효과 티어 증가폭', 'statValueTierStep', 3, '10노드(1티어)마다 스탯 효과값에 더해지는 값'],
    ['재화 지급 기본값', 'currencyAmountBase', 5, '재화 지급 노드의 지급량 기본치'],
    ['재화 지급 티어 증가폭', 'currencyAmountTierStep', 5, '10노드(1티어)마다 재화 지급량에 더해지는 값'],
    ['리버스 필요 노드 수', 'reverseRequiredNodes', 15, '리버스 특별 해금이 나타나는 데 필요한 트리 해금 개수'],
    ['타임하이스트 필요 노드 수', 'timeHeistRequiredNodes', 33, '타임 하이스트 특별 해금이 나타나는 데 필요한 트리 해금 개수'],
    ['리버스 해금 비용', 'reverseUnlockCost', nodeCost(15), '리버스 해금에 필요한 존재력'],
    ['타임하이스트 해금 비용', 'timeHeistUnlockCost', nodeCost(33), '타임 하이스트 해금에 필요한 존재력'],
  ],
  타임하이스트: [
    ['선취 스테이지 오프셋', 'stageOffset', 10, '현재 스테이지 + 이 값 = 선취할 미래 스테이지'],
    ['클리어 환산 배수', 'clearCount', 5, '선취 스테이지를 몇 클리어분으로 환산해 보상을 줄지'],
    ['기준 비용', 'baseCost', 20, '1회차 사용 비용(시간에너지) 기준값'],
    ['비용 증가율', 'costGrowth', 2.0, '비용 = baseCost × costGrowth^사용횟수'],
    ['기준 쿨타임(초)', 'baseCooldownSeconds', 7200, '1회차 사용 후 쿨타임 기준값. 7200 = 2시간'],
    ['쿨타임 증가율', 'cooldownGrowth', 1.5, '쿨타임 = baseCooldownSeconds × cooldownGrowth^사용횟수'],
  ],
  오프라인: [
    ['최대 인정 시간(시간)', 'maxHours', 8, '오프라인 보상으로 인정하는 최대 시간'],
    ['보상 배율', 'rewardMultiplier', 1, '오프라인 보상 전체에 곱해지는 배율 (1 = 온라인과 동일 효율)'],
  ],
}

const COLUMN_WIDTHS = [6, 22, 26, 14, 12, 50]
const KEY_FILL = 'FFEFEFEF'
const VALUE_FILL = 'FFFFF9C4'

function buildSheet(workbook, sheetName, rows) {
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 2 }] })
  sheet.columns = COLUMN_WIDTHS.map((width) => ({ width }))

  // 1행: 색으로 구분되는 제목 캡션 (표에는 포함되지 않음, 순수 시각 구분용)
  sheet.mergeCells('A1:F1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = `${sheetName} 밸런싱`
  titleCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SHEET_ACCENT_COLOR[sheetName] } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  sheet.getRow(1).height = 22

  // 2행부터: 이름 붙은 엑셀 표(Table) — 필터/줄무늬 자동 적용, 이름상자에서 tbl_* 로 바로 찾을 수 있음
  sheet.addTable({
    name: `tbl_${SHEET_TO_CATEGORY[sheetName]}`,
    ref: 'A2',
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleMedium9', showRowStripes: true },
    columns: [
      { name: '번호' },
      { name: '이름' },
      { name: 'key (수정 금지)' },
      { name: 'value (여기만 수정)' },
      { name: '기본값 (참고용)' },
      { name: '설명' },
    ],
    rows: rows.map(([name, key, value, desc], i) => [i + 1, name, key, value, value, desc]),
  })

  // key열(회색=만지지 마세요) / value열(연노랑=여기만 수정) 시각 구분
  for (let i = 0; i < rows.length; i++) {
    const excelRow = i + 3
    const keyCell = sheet.getCell(`C${excelRow}`)
    keyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: KEY_FILL } }
    keyCell.font = { italic: true, color: { argb: 'FF888888' } }

    const valueCell = sheet.getCell(`D${excelRow}`)
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VALUE_FILL } }
    valueCell.font = { bold: true }
  }
}

async function main() {
  const force = process.argv.includes('--force')

  if (existsSync(OUTPUT_PATH) && !force) {
    console.error(`이미 ${OUTPUT_PATH} 파일이 있습니다. 초기값으로 되돌리려면 --force를 붙여 다시 실행하세요.`)
    process.exit(1)
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })

  const workbook = new ExcelJS.Workbook()
  for (const [sheetName, rows] of Object.entries(SHEETS)) {
    buildSheet(workbook, sheetName, rows)
  }
  await workbook.xlsx.writeFile(OUTPUT_PATH)

  const totalRows = Object.values(SHEETS).reduce((sum, rows) => sum + rows.length, 0)
  console.log(`balance.xlsx 생성 완료: ${OUTPUT_PATH}`)
  console.log(`시트 ${Object.keys(SHEETS).length}개, 총 ${totalRows}개 항목`)
}

main()
