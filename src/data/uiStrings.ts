// 화면 곳곳에서 재사용되는 짧은 한글 라벨(스탯/재화/탭/시스템/버튼/상태)을
// StringTable(balance.xlsx) 한 곳에서 가져오는 조회 함수 모음.
// 각 함수는 "어떤 도메인 키가 StringTable의 어느 Id에 대응하는지"만 알고,
// 실제 텍스트 조회는 전부 getString()에 위임한다. StringTable에 해당 Id가
// 없으면 getString이 콘솔 경고를 남기고, 화면이 비어 보이지 않도록 키 이름
// 자체를 대체 문자열로 보여준다.
import { getString } from './balance'
import type { CurrencyKey, StatKey, TabKey } from '../types/game'

const STAT_NAME_ID: Record<StatKey, number> = {
  atk: 40001,
  def: 40002,
  aspd: 40003,
  crit: 40004,
  critDmg: 40005,
  existGain: 40006,
}

const CURRENCY_NAME_ID: Record<CurrencyKey, number> = {
  exist: 40015,
  growthEnergy: 40016,
  essence: 40017,
  timeEnergy: 40018,
  gold: 40019,
  diamond: 40075,
}

const CURRENCY_ABBR_ID: Record<CurrencyKey, number> = {
  exist: 40021,
  growthEnergy: 40022,
  timeEnergy: 40023,
  gold: 40024,
  essence: 40025,
  diamond: 40076,
}

const TAB_NAME_ID: Record<TabKey, number> = {
  growth: 40026,
  equipment: 40027,
  gacha: 40028,
  exist: 40029,
  dogam: 40030,
}

export type SystemNameKey = 'reverse' | 'timeHeist' | 'existTree'

const SYSTEM_NAME_ID: Record<SystemNameKey, number> = {
  reverse: 40007,
  timeHeist: 40008,
  existTree: 40020,
}

export type ButtonLabelKey =
  | 'close'
  | 'cancel'
  | 'confirm'
  | 'execute'
  | 'steal'
  | 'claim'
  | 'unlock'
  | 'enhance'
  | 'train'
  | 'upgrade'
  | 'maxAll'
  | 'back'

const BUTTON_LABEL_ID: Record<ButtonLabelKey, number> = {
  close: 40031,
  cancel: 40032,
  confirm: 40033,
  execute: 40034,
  steal: 40035,
  claim: 40036,
  unlock: 40037,
  enhance: 40038,
  train: 40039,
  upgrade: 40040,
  maxAll: 40041,
  back: 40042,
}

export type StateLabelKey = 'locked' | 'unlocked' | 'available' | 'tier' | 'effect' | 'cost'

const STATE_LABEL_ID: Record<StateLabelKey, number> = {
  locked: 40043,
  unlocked: 40044,
  available: 40045,
  tier: 40046,
  effect: 40047,
  cost: 40048,
}

export type RebirthBonusLabelKey =
  | 'title'
  | 'currentCycle'
  | 'totalPoints'
  | 'pendingPoints'
  | 'refundMultiplier'
  | 'maxStageReached'

const REBIRTH_BONUS_LABEL_ID: Record<RebirthBonusLabelKey, number> = {
  title: 40049,
  currentCycle: 40050,
  totalPoints: 40051,
  pendingPoints: 40052,
  refundMultiplier: 40053,
  maxStageReached: 40054,
}

export function getStatName(stat: StatKey): string {
  return getString(STAT_NAME_ID[stat], 'KOR', stat)
}

// 전체 이름 (예: "성장에너지")
export function getCurrencyName(currency: CurrencyKey): string {
  return getString(CURRENCY_NAME_ID[currency], 'KOR', currency)
}

// 축약형 (예: "성장") — 공간이 좁은 목록에서 사용
export function getCurrencyAbbr(currency: CurrencyKey): string {
  return getString(CURRENCY_ABBR_ID[currency], 'KOR', currency)
}

export function getTabName(tab: TabKey): string {
  return getString(TAB_NAME_ID[tab], 'KOR', tab)
}

export function getSystemName(key: SystemNameKey): string {
  return getString(SYSTEM_NAME_ID[key], 'KOR', key)
}

export function getButtonLabel(key: ButtonLabelKey): string {
  return getString(BUTTON_LABEL_ID[key], 'KOR', key)
}

export function getStateLabel(key: StateLabelKey): string {
  return getString(STATE_LABEL_ID[key], 'KOR', key)
}

export function getRebirthBonusLabel(key: RebirthBonusLabelKey): string {
  return getString(REBIRTH_BONUS_LABEL_ID[key], 'KOR', key)
}
