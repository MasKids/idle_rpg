// ⚠️ 1회성 시딩 스크립트(v0.4.0 — 존재력 트리 250노드 확장에 맞춰 스테이지도
// 200개(20챕터) → 300개(30챕터)로 확장). 기존 1~200번 스테이지 행은 절대
// 건드리지 않고, 201~300번 100행만 StageTable 끝에 추가한다.
//
// 왜 필요한가: getStageConfig()가 200을 넘는 스테이지를 200번 행 값으로
// 클램프해서 연장하는데(docs/TABLE_REDESIGN.md 2.2절 — "언젠가 그 뒤 스테이지도
// 채워 넣으면 그만"이라던 바로 그 자리), 200번이 보스 스테이지라 그 이후로는
// 챕터 번호만 21, 22...로 계속 올라가는 것처럼 보이면서 실제로는 똑같은 보스를
// 무한 반복하게 된다. RebirthRewardTable도 200~999999 구간 하나로 묶여 있어
// 200을 훨씬 넘겨 리버스해도 보상이 똑같다.
//
// 값 설계: 20챕터(191~200번, 챕터20)의 실제 데이터를 뜯어보면 매우 깨끗한
// 공식이 나온다 — 챕터 하나 전체(10행)가 다음 챕터로 넘어갈 때 정확히 같은
// 배율로 스케일된다(EnemyHp ×2.0610316, RewardGold ×2.5937425,
// RewardGrowth ×2.1589248, EnemyAtk ×3.1058482 — 챕터 내 9번째 행이든 1번째
// 행이든 배율이 동일했다). 이 배율을 그대로 이어가면 200개를 더 늘렸을 때
// 급격해지므로("후반 챕터에서 난이도가 급격히 치솟지 않게" 요구사항), 21챕터는
// 지금 배율 그대로 시작해서 30챕터에 가까워질수록 점점 낮춰(HP/Atk는 1.5,
// Gold는 1.7, Growth는 1.6까지) 완만하게 만들었다. FirstClearDiamond(일반
// ×1.18/챕터, 보스=일반×3)·보스 시간에너지(+5/챕터)·처치 필요 수(일반5/보스1)는
// 원래도 완만한 패턴이라 그대로 이어간다. RewardExist는 원래도 스테이지 깊이와
// 거의 무관하게 80~90대에서 오르내리는 패턴이라(스테이지 200 안에서도 153번
// 비단조 — 존재력은 스테이지 보상이 아니라 EXIST_GAIN 스탯/유물로 불리는
// 재화로 설계된 듯하다) 같은 범위 안에서 이어간다 — 이번 확장으로 새로 만든
// 값은 아니고 기존 패턴 그대로다.
//
// 재실행 방지: StageTable 마지막 행의 Stage가 이미 300이면 아무것도 하지
// 않고 종료한다.

import ExcelJS from 'exceljs'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XLSX_PATH = resolve(__dirname, '../../balance/balance.xlsx')
const DATA_START_ROW = 5
const STAGES_PER_CHAPTER = 10
const CHAPTERS_FROM = 21
const CHAPTERS_TO = 30
const TOTAL_STAGES = 300

// 챕터20(191~200번)의 실제 배율 — 챕터 전체가 다음 챕터로 넘어갈 때 이 배율로
// 균일하게 스케일된다(직접 실측, floor() 오차 제외하면 사실상 상수).
const CURRENT_RATE = { hp: 2.0610316, gold: 2.5937425, growth: 2.1589248, atk: 3.1058482 }
const RATE_FLOOR = { hp: 1.5, gold: 1.7, growth: 1.6, atk: 1.5 }
const NEW_CHAPTERS = CHAPTERS_TO - CHAPTERS_FROM + 1 // 10

function taperedRate(base, floor, chapterOffset) {
  // chapterOffset: 0 = 21챕터(현재 배율 그대로), NEW_CHAPTERS-1 = 30챕터(바닥 배율)
  const t = chapterOffset / (NEW_CHAPTERS - 1)
  return base - (base - floor) * t
}

function buildNewStages(templateChapterRows) {
  const rows = []
  let prevChapterRows = templateChapterRows // 챕터20의 실제 10행(엑셀에서 읽은 값)
  let prevDiamondNormal = prevChapterRows[0].FirstClearDiamond
  let prevBossTimeEnergy = prevChapterRows[9].RewardTimeEnergy

  for (let i = 0; i < NEW_CHAPTERS; i++) {
    const chapter = CHAPTERS_FROM + i
    const hpRate = taperedRate(CURRENT_RATE.hp, RATE_FLOOR.hp, i)
    const goldRate = taperedRate(CURRENT_RATE.gold, RATE_FLOOR.gold, i)
    const growthRate = taperedRate(CURRENT_RATE.growth, RATE_FLOOR.growth, i)
    const atkRate = taperedRate(CURRENT_RATE.atk, RATE_FLOOR.atk, i)

    const diamondNormal = Math.round(prevDiamondNormal * 1.18)
    const bossTimeEnergy = prevBossTimeEnergy + 5

    const chapterRows = []
    for (let k = 0; k < STAGES_PER_CHAPTER; k++) {
      const stage = (chapter - 1) * STAGES_PER_CHAPTER + k + 1
      const isBoss = k === STAGES_PER_CHAPTER - 1
      const prev = prevChapterRows[k]
      // RewardExist는 스테이지 깊이와 거의 무관한 기존 패턴을 그대로 반복한다
      // (원본 191~200번 값을 그대로 재사용 — 새로 설계한 값이 아니다).
      const row = {
        Stage: stage,
        Chapter: chapter,
        StageType: isBoss ? 'Boss' : 'Normal',
        EnemyHp: Math.floor(prev.EnemyHp * hpRate),
        EnemyAtk: Math.floor(prev.EnemyAtk * atkRate),
        KillCount: prev.KillCount,
        RewardGold: Math.floor(prev.RewardGold * goldRate),
        RewardGrowth: Math.floor(prev.RewardGrowth * growthRate),
        RewardExist: prev.RewardExist,
        RewardTimeEnergy: isBoss ? bossTimeEnergy : 0,
        NameStringId: 0,
        FirstClearDiamond: isBoss ? diamondNormal * 3 : diamondNormal,
      }
      chapterRows.push(row)
      rows.push(row)
    }

    prevChapterRows = chapterRows
    prevDiamondNormal = diamondNormal
    prevBossTimeEnergy = bossTimeEnergy
  }

  if (rows[rows.length - 1].Stage !== TOTAL_STAGES) {
    throw new Error(`내부 오류: 마지막 stage가 ${rows[rows.length - 1].Stage}, 기대값 ${TOTAL_STAGES}`)
  }
  return rows
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`[seed] 오류: ${XLSX_PATH} 파일이 없습니다.`)
    process.exit(1)
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(XLSX_PATH)

  const ws = workbook.getWorksheet('StageTable')
  if (!ws) {
    console.error('[seed] 오류: StageTable 시트를 찾지 못했습니다.')
    process.exit(1)
  }

  const engRow = ws.getRow(4)
  const cols = {}
  for (let c = 1; c <= ws.columnCount; c++) {
    const v = engRow.getCell(c).value
    if (v) cols[String(v)] = c
  }

  const lastDataRow = DATA_START_ROW + 199 // stage 1~200 = row 5~204
  const lastStage = ws.getRow(lastDataRow).getCell(cols.Stage).value
  if (lastStage === TOTAL_STAGES) {
    console.log('[seed] StageTable이 이미 300스테이지로 확장돼 있습니다 — 건너뜁니다.')
    return
  }
  if (lastStage !== 200) {
    console.error(`[seed] 오류: ${lastDataRow}행의 Stage가 200이 아니라 ${lastStage}입니다 — 예상한 기존 상태(200스테이지)가 아니라 중단합니다.`)
    process.exit(1)
  }

  // 챕터20(191~200번, row 195~204)의 실제 값을 템플릿으로 읽어온다.
  const templateChapterRows = []
  for (let r = lastDataRow - 9; r <= lastDataRow; r++) {
    const row = ws.getRow(r)
    templateChapterRows.push({
      EnemyHp: Number(row.getCell(cols.EnemyHp).value),
      EnemyAtk: Number(row.getCell(cols.EnemyAtk).value),
      KillCount: Number(row.getCell(cols.KillCount).value),
      RewardGold: Number(row.getCell(cols.RewardGold).value),
      RewardGrowth: Number(row.getCell(cols.RewardGrowth).value),
      RewardExist: Number(row.getCell(cols.RewardExist).value),
      RewardTimeEnergy: Number(row.getCell(cols.RewardTimeEnergy).value),
      FirstClearDiamond: Number(row.getCell(cols.FirstClearDiamond).value),
    })
  }

  const newStages = buildNewStages(templateChapterRows)

  let rowNum = lastDataRow + 1
  for (const stageRow of newStages) {
    const row = ws.getRow(rowNum)
    const values = {
      Index: stageRow.Stage,
      Id: 10000 + stageRow.Stage,
      Stage: stageRow.Stage,
      Chapter: stageRow.Chapter,
      StageType: stageRow.StageType,
      EnemyHp: stageRow.EnemyHp,
      EnemyAtk: stageRow.EnemyAtk,
      KillCount: stageRow.KillCount,
      RewardGold: stageRow.RewardGold,
      RewardGrowth: stageRow.RewardGrowth,
      RewardExist: stageRow.RewardExist,
      RewardTimeEnergy: stageRow.RewardTimeEnergy,
      NameStringId: stageRow.NameStringId,
      FirstClearDiamond: stageRow.FirstClearDiamond,
    }
    for (const [eng, colIndex] of Object.entries(cols)) {
      const cell = row.getCell(colIndex)
      cell.value = values[eng]
      cell.font = { size: 9 }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      }
      cell.alignment =
        typeof values[eng] === 'number' ? { horizontal: 'center', vertical: 'middle' } : { horizontal: 'left', vertical: 'middle' }
    }
    rowNum++
  }

  const lastRow = rowNum - 1
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: lastRow, column: Object.keys(cols).length } }

  // ---- RebirthRewardTable: 200~999999 구간 하나를 200~299 / 300~999999로 쪼갠다 ----
  const rebirthWs = workbook.getWorksheet('RebirthRewardTable')
  if (rebirthWs) {
    const rEngRow = rebirthWs.getRow(4)
    const rCols = {}
    for (let c = 1; c <= rebirthWs.columnCount; c++) {
      const v = rEngRow.getCell(c).value
      if (v) rCols[String(v)] = c
    }
    let lastRebirthRow = DATA_START_ROW
    for (let r = DATA_START_ROW; r <= rebirthWs.rowCount; r++) {
      if (rebirthWs.getRow(r).getCell(rCols.StageFrom).value != null) lastRebirthRow = r
    }
    const openEndedRow = rebirthWs.getRow(lastRebirthRow) // 기존 200~999999 행
    if (Number(openEndedRow.getCell(rCols.StageTo).value) === 999999) {
      openEndedRow.getCell(rCols.StageTo).value = 299
      const newRow = rebirthWs.getRow(lastRebirthRow + 1)
      const base = {
        StageFrom: 300,
        StageTo: 999999,
        DiamondReward: Math.round(Number(openEndedRow.getCell(rCols.DiamondReward).value) * 1.8),
        GrowthEnergyReward: Math.round(Number(openEndedRow.getCell(rCols.GrowthEnergyReward).value) * 1.8),
        GoldReward: Math.round(Number(openEndedRow.getCell(rCols.GoldReward).value) * 1.8),
        MasteryEssenceReward: Math.round(Number(openEndedRow.getCell(rCols.MasteryEssenceReward).value) * 1.8),
      }
      const maxId = Math.max(
        ...Array.from({ length: rebirthWs.rowCount - DATA_START_ROW + 1 }, (_, i) => {
          const v = rebirthWs.getRow(DATA_START_ROW + i).getCell(rCols.Id).value
          return typeof v === 'number' ? v : 0
        }),
      )
      newRow.getCell(rCols.Index).value = lastRebirthRow - DATA_START_ROW + 2
      newRow.getCell(rCols.Id).value = maxId + 1
      for (const [eng, val] of Object.entries(base)) newRow.getCell(rCols[eng]).value = val
    }
  }

  await workbook.xlsx.writeFile(XLSX_PATH)
  console.log('[seed] StageTable을 200스테이지 → 300스테이지(20챕터 → 30챕터)로 확장했습니다(1~200번 원본 유지).')
  const last = newStages[newStages.length - 1]
  console.log(`[seed] stage300 HP=${last.EnemyHp.toLocaleString()}, gold=${last.RewardGold.toLocaleString()}, growth=${last.RewardGrowth.toLocaleString()}, diamond=${last.FirstClearDiamond}, timeE=${last.RewardTimeEnergy}.`)
  console.log('[seed] RebirthRewardTable: 200~999999 구간을 200~299 / 300~999999(×1.8)로 분리.')
  console.log('[seed] 다음: npm run balance')
}

main()
