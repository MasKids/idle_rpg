import { EXIST_SPECIAL_UNLOCKS } from '../../data/existTree'
import { useGameStore } from '../../store/gameStore'
import type { TabKey } from '../../types/game'
import { computeRelicSlotCount } from '../relic/relic'
import { useNumericNotice } from './useNumericNotice'

// 하단 메뉴 탭에 "새로운 것" 뱃지를 붙일지 계산한다.
// - 존재력: 리버스/타임 하이스트 조건을 채웠지만 아직 해금(활성화)하지 않은 상태 —
//   조건 자체가 계속 참/거짓이라 "확인 처리"가 필요 없다(해금하면 자연히 사라진다).
// - 무기고: 유물 활성화 슬롯이 늘어났을 때 — RelicTab을 열면 확인 처리된다.
// - 소환: 가챠 레벨이 올랐을 때 — WeaponGachaTab을 열면 확인 처리된다.
export function useTabBadges(): Record<TabKey, boolean> {
  const unlockedCount = useGameStore((state) => state.unlockedCount)
  const specialUnlocks = useGameStore((state) => state.specialUnlocks)
  const gachaLevel = useGameStore((state) => state.gachaLevel)

  const hasReachableSpecial = EXIST_SPECIAL_UNLOCKS.some(
    (unlock) => !specialUnlocks[unlock.id] && unlockedCount >= unlock.requiredUnlockedCount,
  )

  const relicSlotNotice = useNumericNotice('relic-slot-count', computeRelicSlotCount(unlockedCount))
  const gachaLevelNotice = useNumericNotice('gacha-level', gachaLevel)

  return {
    growth: false,
    equipment: relicSlotNotice.hasNotice,
    gacha: gachaLevelNotice.hasNotice,
    exist: hasReachableSpecial,
    dogam: false,
  }
}
