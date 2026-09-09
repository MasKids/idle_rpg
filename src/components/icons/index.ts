// 게임 전체가 아이콘을 가져올 때 쓰는 단일 창구. lucide-react 아이콘과
// src/components/icons/ 아래의 커스텀 아이콘(Spear/Bow/Relic)을 한 곳에서
// 도메인 이름(WEAPON_ICON.Sword 등)으로 다시 내보낸다 — 화면 코드가 "이 아이콘이
// lucide인지 커스텀인지"를 몰라도 되게 하기 위함. 목록/사용법은
// docs/DESIGN_SYSTEM.md 3장 참고.
import {
  BookOpen,
  CircleCheck,
  Coins,
  Dices,
  FlaskConical,
  Gem,
  History,
  Hourglass,
  LineChart,
  Lock,
  Orbit,
  RotateCcw,
  Sword,
  Swords,
  TrendingUp,
  Unlock,
  type LucideIcon,
} from 'lucide-react'
import { Bow } from './Bow'
import { Relic } from './Relic'
import { Spear } from './Spear'
import type { IconProps } from './types'
import type { CurrencyKey, TabKey } from '../../types/game'

export type { IconProps }
export { Bow, Relic, Spear }

// 무기 3종
export const WEAPON_ICON = {
  Sword,
  Spear,
  Bow,
} as const

// 재화 6종
export const CURRENCY_ICON = {
  diamond: Gem,
  exist: Orbit,
  growthEnergy: TrendingUp,
  essence: FlaskConical,
  timeEnergy: Hourglass,
  gold: Coins,
} as const satisfies Record<CurrencyKey, LucideIcon>

// 하단 메뉴 5개
export const TAB_ICON = {
  growth: LineChart,
  equipment: Swords,
  gacha: Dices,
  exist: Orbit,
  dogam: BookOpen,
} as const satisfies Record<TabKey, LucideIcon>

// 유물 / 타임 하이스트 / 리버스
export const SYSTEM_ICON = {
  relic: Relic,
  timeHeist: History,
  reverse: RotateCcw,
} as const

// 상태: 잠김 / 해금 / 장착 중
export const STATE_ICON = {
  locked: Lock,
  unlocked: Unlock,
  equipped: CircleCheck,
} as const
