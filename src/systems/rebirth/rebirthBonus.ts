import { getCommon } from '../../data/balance'

// 리버스 보상(도달 스테이지 구간별 고정 지급량, RebirthRewardTable)에 곱해지는
// 리버스 횟수 기반 배율 — 회차가 쌓일수록 다음 리버스의 보상이 커진다.
// rebirthCount는 "이번 리버스를 실행하기 전" 값을 넘겨야 한다(첫 리버스는
// rebirthCount=0이라 배율 ×1.00). 다이아에는 적용하지 않는다(gameStore.ts 참고
// — 가챠 재화라 인플레이션 우려로 의도적으로 제외).
export function computeRebirthCountMultiplier(rebirthCount: number): number {
  const perRun = getCommon('RebirthCountBonusPerRun')
  const max = getCommon('MaxRebirthCountMultiplier')
  return Math.min(1 + rebirthCount * perRun, max)
}
