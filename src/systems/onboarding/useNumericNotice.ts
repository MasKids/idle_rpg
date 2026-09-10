import { useEffect, useSyncExternalStore } from 'react'
import { onboardingStorage } from './onboardingStorage'

interface NumericNotice {
  // currentValue가 마지막으로 확인한 값보다 늘어났으면 true (유물 슬롯 수, 가챠 레벨 등).
  hasNotice: boolean
  // 알림을 확인 처리 — 이후 currentValue가 다시 늘어나기 전까지 hasNotice는 false.
  acknowledge: () => void
}

// 하단 메뉴 뱃지(BottomMenu)와 실제 확인 지점(RelicTab, WeaponGachaTab)은 서로 다른
// 컴포넌트 트리에 있어 로컬 state만으로는 동기화되지 않는다 — acknowledge()가 한쪽에서
// 호출돼도 다른 쪽이 즉시 반영해야 하므로, localStorage를 외부 소스로 하는
// useSyncExternalStore + 수동 구독자 알림으로 여러 인스턴스를 동기화한다.
const listeners = new Set<() => void>()

function emitChange(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// 처음 보는 키라면 "지금 값"을 기준선으로 삼는다 — 기존에 이미 갖고 있던 진행 상태를
// 전부 "새로운 것"으로 알려주지 않기 위함. 그 이후로 값이 늘어난 만큼만 알림 대상이 된다.
export function useNumericNotice(key: string, currentValue: number): NumericNotice {
  useEffect(() => {
    if (onboardingStorage.readNumber(key) === null) {
      onboardingStorage.writeNumber(key, currentValue)
      emitChange()
    }
    // 기준선은 "이 키를 처음 만난 시점"의 값으로 딱 한 번만 확정한다 — currentValue를
    // deps에 넣으면 값이 늘어날 때마다 기준선도 따라 움직여 알림이 영원히 안 뜬다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const baseline = useSyncExternalStore(subscribe, () => onboardingStorage.readNumber(key) ?? currentValue)

  const acknowledge = () => {
    onboardingStorage.writeNumber(key, currentValue)
    emitChange()
  }

  return { hasNotice: currentValue > baseline, acknowledge }
}

// 실제로 해당 화면을 열어봤을 때 알림을 확인 처리하는 용도 — RelicTab/WeaponGachaTab
// 마운트 시 한 번 호출해, 하단 메뉴 뱃지가 사라지게 한다.
export function useAcknowledgeNumericNotice(key: string, currentValue: number): void {
  useEffect(() => {
    onboardingStorage.writeNumber(key, currentValue)
    emitChange()
    // 화면을 열 때마다 한 번만 확인 처리하면 된다 — currentValue가 더 바뀌어도 재실행 불필요.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
