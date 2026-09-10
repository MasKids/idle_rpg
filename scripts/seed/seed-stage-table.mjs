// ⚠️ 이미 실행되어 적용된 1회성 시딩 스크립트다(테이블 개편 2단계) — StageTable을
// 챕터 템플릿(20행: 챕터당 Normal/Boss 2행 + 챕터 내 보간) 방식에서 스테이지
// 1개당 1행(200행 = 20챕터 × 10스테이지)으로 펼쳤다. 콘텐츠 확장 계획이 있어
// 기존 10챕터가 아니라 20챕터까지 미리 시딩했다(docs/TABLE_REDESIGN.md 4절 Q1
// 결정). seed_balance_xlsx.py와 같은 이유로 scripts/seed/에 둔다 — 챕터 보간에
// 쓰였던 공식(enemy_hp/enemy_atk/gold_reward 등 + 챕터 내 GrowthRate^offset
// 복리 보간)을 나중에 다시 참고할 수 있게 보존하는 것이지, 평소 파이프라인에서
// 실행하는 스크립트가 아니다. stages.ts는 이제 이 공식을 쓰지 않고 StageTable을
// 조회만 한다(200을 넘는 스테이지는 마지막 행으로 연장).
//
// 재실행 방지: StageTable에 이미 Stage 칼럼이 있으면(=이미 적용됨) 건너뜀.

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

// ---- 현재 balance/*.py, stages.ts와 동일한 공식 ----
const HP_GROWTH_RATE = 1.07
const REWARD_GROWTH_RATE = 1.1
const BOSS_HP_MULT = 5
const BOSS_ATK_MULT = 2
const BOSS_REWARD_MULT = 3
const BOSS_EXIST_MULT = 2
const EXIST_REWARD_DIVISOR = 4.5
const STAGES_PER_CHAPTER = 10
const TOTAL_CHAPTERS = 20 // 콘텐츠 확장 여유분 — 4절 Q1 결정

const enemyHpRaw = (stage) => Math.floor(20 * HP_GROWTH_RATE ** (stage - 1))
const enemyAtkRaw = (stage) => Math.floor(3 * 1.12 ** (stage - 1))
const goldRewardRaw = (stage) => Math.floor(5 * REWARD_GROWTH_RATE ** (stage - 1))
const growthRewardRaw = (stage) => Math.floor(2 * 1.08 ** (stage - 1))
const existRewardRaw = (stage) => Math.max(1, Math.floor(stage / EXIST_REWARD_DIVISOR))
const bossTimeEnergyReward = (chapter) => 15 + (chapter - 1) * 5

// stages.ts의 generateStage()와 동일한 보간 — 챕터 시작(reference) 스테이지의
// "참" 공식값을 기준으로, 챕터 내부는 GrowthRate^offset으로 복리 보간한다.
function computeStage(stage) {
  const chapter = Math.ceil(stage / STAGES_PER_CHAPTER)
  const isBoss = stage % STAGES_PER_CHAPTER === 0
  const referenceStage = (chapter - 1) * STAGES_PER_CHAPTER + 1

  if (isBoss) {
    return {
      stage,
      chapter,
      stageType: 'Boss',
      enemyHp: enemyHpRaw(stage) * BOSS_HP_MULT,
      enemyAtk: enemyAtkRaw(stage) * BOSS_ATK_MULT,
      killCount: 1,
      rewardGold: goldRewardRaw(stage) * BOSS_REWARD_MULT,
      rewardGrowth: growthRewardRaw(stage) * BOSS_REWARD_MULT,
      rewardExist: existRewardRaw(stage) * BOSS_EXIST_MULT,
      rewardTimeEnergy: bossTimeEnergyReward(chapter),
    }
  }

  const offset = stage - referenceStage
  const refHp = enemyHpRaw(referenceStage)
  const refAtk = enemyAtkRaw(referenceStage)
  const refGold = goldRewardRaw(referenceStage)
  const refGrowth = growthRewardRaw(referenceStage)
  const refExist = existRewardRaw(referenceStage)

  return {
    stage,
    chapter,
    stageType: 'Normal',
    enemyHp: Math.floor(refHp * HP_GROWTH_RATE ** offset),
    enemyAtk: Math.floor(refAtk * HP_GROWTH_RATE ** offset),
    killCount: 5,
    rewardGold: Math.floor(refGold * REWARD_GROWTH_RATE ** offset),
    rewardGrowth: Math.floor(refGrowth * REWARD_GROWTH_RATE ** offset),
    rewardExist: Math.max(1, Math.floor(refExist * REWARD_GROWTH_RATE ** offset)),
    rewardTimeEnergy: 0,
  }
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[migration] ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const existing = workbook.getWorksheet('StageTable')
  if (existing) {
    const engRow = existing.getRow(4)
    const hasStageColumn = Array.from({ length: existing.columnCount }, (_, i) => engRow.getCell(i + 1).value).includes('Stage')
    if (hasStageColumn) {
      console.log('[migration] StageTable에 이미 Stage 칼럼이 있습니다 — 이미 적용된 것으로 보고 건너뜁니다.')
      return
    }
  }

  const columns = [
    { ref: '', kor: '순번', type: 'int', eng: 'Index' },
    { ref: '', kor: 'ID', type: 'int', eng: 'Id' },
    { ref: '', kor: '스테이지 번호', type: 'int', eng: 'Stage' },
    { ref: '', kor: '챕터', type: 'int', eng: 'Chapter' },
    { ref: 'EnumDefine/StageType', kor: '스테이지 종류', type: 'enum', eng: 'StageType' },
    { ref: '', kor: '적 HP', type: 'int', eng: 'EnemyHp' },
    { ref: '', kor: '적 공격력', type: 'int', eng: 'EnemyAtk' },
    { ref: '', kor: '처치 필요 수', type: 'int', eng: 'KillCount' },
    { ref: '', kor: '골드 보상', type: 'int', eng: 'RewardGold' },
    { ref: '', kor: '성장에너지 보상', type: 'int', eng: 'RewardGrowth' },
    { ref: '', kor: '존재력 보상', type: 'int', eng: 'RewardExist' },
    { ref: '', kor: '시간에너지 보상', type: 'int', eng: 'RewardTimeEnergy' },
    { ref: 'StringTable/Id', kor: '이름ID', type: 'int', eng: 'NameStringId' },
  ]

  const rows = []
  const totalStages = TOTAL_CHAPTERS * STAGES_PER_CHAPTER
  for (let stage = 1; stage <= totalStages; stage++) {
    const s = computeStage(stage)
    rows.push([
      stage, // Index
      10000 + stage, // Id
      s.stage,
      s.chapter,
      s.stageType,
      s.enemyHp,
      s.enemyAtk,
      s.killCount,
      s.rewardGold,
      s.rewardGrowth,
      s.rewardExist,
      s.rewardTimeEnergy,
      0, // NameStringId — 스테이지 이름 미확정, 0=자동생성("STAGE {chapter}-{sub}") 폴백
    ])
  }

  writeDataSheet(workbook, 'StageTable', columns, rows)

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log(`[migration] StageTable을 챕터 템플릿(20행) → 스테이지 리터럴 ${totalStages}행으로 확장했습니다.`)
  const s1 = computeStage(1), s10 = computeStage(10), s100 = computeStage(100), s200 = computeStage(200)
  console.log(`[migration] stage1: hp=${s1.enemyHp} / stage10(보스): hp=${s10.enemyHp} / stage100(보스): hp=${s100.enemyHp} / stage200(보스): hp=${s200.enemyHp}`)
  console.log('[migration] 이제 `npm run balance`를 실행하세요.')
}

main()
