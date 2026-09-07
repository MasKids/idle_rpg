// 최초 1회(또는 초기값으로 되돌리고 싶을 때) balance/balance.xlsx를 만드는 스크립트.
// 코드에 흩어져 있던 밸런싱 수치를 각 시트의 초기값으로 그대로 옮겨 담는다.
// 이미 balance.xlsx가 있으면 실수로 덮어쓰지 않도록 --force 없이는 중단한다.

import * as fs from 'node:fs'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

// SheetJS의 ESM 빌드는 Node의 fs 모듈을 자동으로 잡지 못해 직접 연결해줘야 한다.
XLSX.set_fs(fs)

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = resolve(__dirname, '../balance/balance.xlsx')

const HEADER = ['key (수정 금지)', 'value', '설명', '기본값 (참고용)']

// 현재 코드의 nodeCost 공식과 동일 — 리버스/타임하이스트 해금 비용의 초기값을
// 손계산 없이 실제 공식으로 정확히 뽑아낸다.
function nodeCost(order) {
  return Math.floor(10 * 1.35 ** (order - 1))
}

const SHEETS = {
  전투: [
    ['enemyBaseHp', 20, '1스테이지 기준 일반 적 기본 HP'],
    ['enemyHpGrowth', 1.15, '스테이지 1개당 적 HP 증가 배율'],
    ['enemyBaseAtk', 3, '1스테이지 기준 적 기본 공격력'],
    ['enemyAtkGrowth', 1.12, '스테이지 1개당 적 공격력 증가 배율'],
    ['killsRequiredPerStage', 5, '일반 스테이지에서 다음 스테이지로 넘어가기 위한 처치 수'],
    ['bossInterval', 10, 'N스테이지마다 보스 등장 (예: 10 = 10, 20, 30...)'],
    ['bossHpMultiplier', 5, '보스 HP = 일반 계산값 × 이 배율'],
    ['bossAtkMultiplier', 2, '보스 공격력 = 일반 계산값 × 이 배율'],
    ['bossRewardMultiplier', 3, '보스 처치 시 골드/성장에너지/존재력 보상 × 이 배율'],
  ],
  보상: [
    ['goldBaseReward', 5, '1스테이지 기준 처치당 골드 기본 획득량'],
    ['goldGrowth', 1.1, '스테이지 1개당 골드 보상 증가 배율'],
    ['growthEnergyBaseReward', 2, '1스테이지 기준 처치당 성장에너지 기본 획득량'],
    ['growthEnergyGrowth', 1.08, '스테이지 1개당 성장에너지 보상 증가 배율'],
    ['existRewardStageDivisor', 10, '존재력 보상 = max(1, floor(스테이지 / 이 값))'],
    ['existRewardBossMultiplier', 2, '보스 처치 시 존재력 보상 × 이 배율'],
    ['bossTimeEnergyReward', 5, '보스 처치 시 지급하는 시간에너지 고정량'],
  ],
  스탯: [
    ['statBaseAtk', 1, 'ATK 레벨 0 기본값'],
    ['statBaseDef', 1, 'DEF 레벨 0 기본값'],
    ['statBaseAspd', 1, 'ASPD 레벨 0 기본값'],
    ['statBaseCrit', 0, 'CRIT(%) 레벨 0 기본값'],
    ['statBaseCritDmg', 150, 'CRIT_DMG(%) 레벨 0 기본값'],
    ['statBaseExistGain', 1, 'EXIST_GAIN 배율 레벨 0 기본값'],
    ['statGrowthAtk', 1, 'ATK 레벨당 상승치'],
    ['statGrowthDef', 1, 'DEF 레벨당 상승치'],
    ['statGrowthAspd', 0.05, 'ASPD 레벨당 상승치'],
    ['statGrowthCrit', 0.5, 'CRIT(%) 레벨당 상승치'],
    ['statGrowthCritDmg', 2, 'CRIT_DMG(%) 레벨당 상승치'],
    ['statGrowthExistGain', 0.02, 'EXIST_GAIN 배율 레벨당 상승치'],
    ['statUpgradeCostBase', 8, '스탯 업그레이드 비용(성장에너지) 기본값 (레벨 0 → 1)'],
    ['statUpgradeCostGrowth', 1.18, '스탯 업그레이드 비용 레벨당 증가 배율'],
  ],
  장비숙련: [
    ['equipmentValuePerLevel', 2, '장비 강화 레벨당 ATK/DEF 상승치 (5부위 공용)'],
    ['equipmentCostBase', 15, '장비 강화 비용(골드) 기본값'],
    ['equipmentCostGrowth', 1.22, '장비 강화 비용 레벨당 증가 배율'],
    ['masteryMultiplierPerLevel', 0.05, '무기 숙련 레벨당 ATK 배율 상승치 (예: 0.05 = +5%)'],
    ['masteryCostBase', 10, '무기 숙련 비용(정수/essence) 기본값'],
    ['masteryCostGrowth', 1.25, '무기 숙련 비용 레벨당 증가 배율'],
  ],
  존재력트리: [
    ['totalNodes', 50, '존재력 트리 총 노드 개수'],
    ['nodeCostBase', 10, '노드 해금 비용(존재력) 기본값 (order=1)'],
    ['nodeCostGrowth', 1.35, '노드 해금 비용 order 1당 증가 배율'],
    ['statValueBase', 5, '스탯 지급 노드의 효과값 기본치'],
    ['statValueTierStep', 3, '10노드(1티어)마다 스탯 효과값에 더해지는 값'],
    ['currencyAmountBase', 5, '재화 지급 노드의 지급량 기본치'],
    ['currencyAmountTierStep', 5, '10노드(1티어)마다 재화 지급량에 더해지는 값'],
    ['reverseRequiredNodes', 15, '리버스 특별 해금이 나타나는 데 필요한 트리 해금 개수'],
    ['timeHeistRequiredNodes', 33, '타임 하이스트 특별 해금이 나타나는 데 필요한 트리 해금 개수'],
    ['reverseUnlockCost', nodeCost(15), '리버스 해금에 필요한 존재력'],
    ['timeHeistUnlockCost', nodeCost(33), '타임 하이스트 해금에 필요한 존재력'],
  ],
  타임하이스트: [
    ['stageOffset', 10, '현재 스테이지 + 이 값 = 선취할 미래 스테이지'],
    ['clearCount', 5, '선취 스테이지를 몇 클리어분으로 환산해 보상을 줄지'],
    ['baseCost', 20, '1회차 사용 비용(시간에너지) 기본값'],
    ['costGrowth', 2.0, '사용 1회당 비용 증가 배율'],
    ['baseCooldownSeconds', 7200, '1회차 사용 후 쿨타임 기본값(초). 7200 = 2시간'],
    ['cooldownGrowth', 1.5, '사용 1회당 쿨타임 증가 배율'],
  ],
  오프라인: [
    ['maxHours', 8, '오프라인 보상으로 인정하는 최대 시간(시간 단위)'],
    ['rewardMultiplier', 1, '오프라인 보상 전체에 곱해지는 배율 (1 = 온라인과 동일 효율)'],
  ],
}

function buildWorkbook() {
  const workbook = XLSX.utils.book_new()

  for (const [sheetName, rows] of Object.entries(SHEETS)) {
    const aoa = [HEADER, ...rows.map(([key, value, desc]) => [key, value, desc, value])]
    const sheet = XLSX.utils.aoa_to_sheet(aoa)
    sheet['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 46 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
  }

  return workbook
}

function main() {
  const force = process.argv.includes('--force')

  if (existsSync(OUTPUT_PATH) && !force) {
    console.error(`이미 ${OUTPUT_PATH} 파일이 있습니다. 초기값으로 되돌리려면 --force를 붙여 다시 실행하세요.`)
    process.exit(1)
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  const workbook = buildWorkbook()
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  writeFileSync(OUTPUT_PATH, buffer)

  const totalRows = Object.values(SHEETS).reduce((sum, rows) => sum + rows.length, 0)
  console.log(`balance.xlsx 생성 완료: ${OUTPUT_PATH}`)
  console.log(`시트 ${Object.keys(SHEETS).length}개, 총 ${totalRows}개 항목`)
}

main()
