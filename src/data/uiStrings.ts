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
  | 'train'
  | 'upgrade'
  | 'maxAll'
  | 'back'
  | 'equip'
  | 'breakthrough'
  | 'fuse'
  | 'activate'
  | 'deactivate'
  | 'skip'
  | 'next'
  | 'start'

const BUTTON_LABEL_ID: Record<ButtonLabelKey, number> = {
  close: 40031,
  cancel: 40032,
  confirm: 40033,
  execute: 40034,
  steal: 40035,
  claim: 40036,
  unlock: 40037,
  train: 40039,
  upgrade: 40040,
  maxAll: 40041,
  back: 40042,
  equip: 40077,
  breakthrough: 40078,
  fuse: 40079,
  activate: 40102,
  deactivate: 40103,
  skip: 40129,
  next: 40130,
  start: 40131,
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

export type WeaponUiLabelKey =
  | 'equipmentSubTab'
  | 'relicSubTab'
  | 'ownBonus'
  | 'equipBonus'
  | 'equipped'
  | 'noWeaponEquipped'
  | 'ownedCount'
  | 'grade'

const WEAPON_UI_LABEL_ID: Record<WeaponUiLabelKey, number> = {
  equipmentSubTab: 40080,
  relicSubTab: 40081,
  ownBonus: 40082,
  equipBonus: 40083,
  equipped: 40084,
  noWeaponEquipped: 40085,
  ownedCount: 40086,
  grade: 40087,
}

export function getWeaponUiLabel(key: WeaponUiLabelKey): string {
  return getString(WEAPON_UI_LABEL_ID[key], 'KOR', key)
}

export type GachaUiLabelKey =
  | 'gachaLevel'
  | 'toNextLevel'
  | 'pullOnce'
  | 'pullTen'
  | 'newItem'
  | 'duplicate'
  | 'weaponSubTab'
  | 'relicSubTab'

const GACHA_UI_LABEL_ID: Record<GachaUiLabelKey, number> = {
  gachaLevel: 40088,
  toNextLevel: 40089,
  pullOnce: 40090,
  pullTen: 40091,
  newItem: 40092,
  duplicate: 40093,
  // 소환 화면 하위 탭 — [무기]는 새 Id(40128), [유물]은 무기고 쪽과 같은 단어라 그 Id(40081)를 재사용
  weaponSubTab: 40128,
  relicSubTab: 40081,
}

export function getGachaUiLabel(key: GachaUiLabelKey): string {
  return getString(GACHA_UI_LABEL_ID[key], 'KOR', key)
}

export type RelicUiLabelKey =
  | 'pullRelic'
  | 'duplicateRefund'
  | 'nextSlot'
  | 'activeSlots'
  | 'ownedRelics'
  | 'slotsFull'
  | 'goldGain'
  | 'timeHeistCooldown'

const RELIC_UI_LABEL_ID: Record<RelicUiLabelKey, number> = {
  pullRelic: 40094,
  duplicateRefund: 40095,
  nextSlot: 40096,
  activeSlots: 40097,
  ownedRelics: 40098,
  slotsFull: 40099,
  goldGain: 40100,
  timeHeistCooldown: 40101,
}

export function getRelicUiLabel(key: RelicUiLabelKey): string {
  return getString(RELIC_UI_LABEL_ID[key], 'KOR', key)
}

export type GrowthUiLabelKey = 'statSubTab' | 'masterySubTab' | 'autoUpgrade'

const GROWTH_UI_LABEL_ID: Record<GrowthUiLabelKey, number> = {
  statSubTab: 40104,
  masterySubTab: 40105,
  autoUpgrade: 40134,
}

export function getGrowthUiLabel(key: GrowthUiLabelKey): string {
  return getString(GROWTH_UI_LABEL_ID[key], 'KOR', key)
}

// 특정 화면 하나에 속하지 않고 여러 화면(스테이지 정보/오프라인 보상/유물/
// 타임 하이스트/무기 가챠)에서 재사용되는 짧은 라벨.
export type CommonUiLabelKey =
  | 'enemyHp'
  | 'enemyAtk'
  | 'killProgress'
  | 'rewardPerKill'
  | 'cycleSuffix'
  | 'offlineRewardTitle'
  | 'awayTime'
  | 'maxRecognizedPrefix'
  | 'maxRecognizedSuffix'
  | 'rewardsEarned'
  | 'costPerPull'
  | 'kindSuffix'
  | 'nodeSuffix'
  | 'targetStage'
  | 'clearConversion'
  | 'expectedGain'
  | 'consume'
  | 'useCount'
  | 'cooldown'
  | 'timesSuffix'
  | 'gradeProbability'
  | 'owned'

const COMMON_UI_LABEL_ID: Record<CommonUiLabelKey, number> = {
  enemyHp: 40106,
  enemyAtk: 40107,
  killProgress: 40108,
  rewardPerKill: 40109,
  cycleSuffix: 40110,
  offlineRewardTitle: 40111,
  awayTime: 40112,
  maxRecognizedPrefix: 40113,
  maxRecognizedSuffix: 40114,
  rewardsEarned: 40115,
  costPerPull: 40116,
  kindSuffix: 40117,
  nodeSuffix: 40118,
  targetStage: 40119,
  clearConversion: 40120,
  expectedGain: 40121,
  consume: 40122,
  useCount: 40123,
  cooldown: 40124,
  timesSuffix: 40125,
  gradeProbability: 40126,
  owned: 40127,
}

export function getCommonUiLabel(key: CommonUiLabelKey): string {
  return getString(COMMON_UI_LABEL_ID[key], 'KOR', key)
}

export type ExistUiLabelKey = 'untilNextSpecial'

const EXIST_UI_LABEL_ID: Record<ExistUiLabelKey, number> = {
  untilNextSpecial: 40132,
}

export function getExistUiLabel(key: ExistUiLabelKey): string {
  return getString(EXIST_UI_LABEL_ID[key], 'KOR', key)
}

export type BadgeLabelKey = 'new'

const BADGE_LABEL_ID: Record<BadgeLabelKey, number> = {
  new: 40133,
}

export function getBadgeLabel(key: BadgeLabelKey): string {
  return getString(BADGE_LABEL_ID[key], 'KOR', key)
}

// 화면 하나에서만 쓰이는, 지금까지 컴포넌트에 직접 하드코딩돼 있던 문구들
// (3단계 StringTable 확장, StringTable 41000번대 — docs/TABLE_REDESIGN.md 4절 Q6).
export type RebirthUiLabelKey =
  | 'description'
  | 'pendingNote'
  | 'resetSectionTitle'
  | 'resetStage'
  | 'resetStats'
  | 'resetWeapons'
  | 'resetRelics'
  | 'resetMastery'
  | 'grantSectionTitle'
  | 'nextTierReachPrefix'
  | 'nextTierReachSuffix'
  | 'keepSectionTitle'
  | 'keepUnlockedSuffix'
  | 'keepUnlockState'
  | 'keepCurrency'

const REBIRTH_UI_LABEL_ID: Record<RebirthUiLabelKey, number> = {
  description: 41000,
  pendingNote: 41001,
  resetSectionTitle: 41002,
  resetStage: 41003,
  resetStats: 41004,
  resetWeapons: 41005,
  resetRelics: 41006,
  resetMastery: 41007,
  grantSectionTitle: 41008,
  nextTierReachPrefix: 41009,
  nextTierReachSuffix: 41010,
  keepSectionTitle: 41011,
  keepUnlockedSuffix: 41012,
  keepUnlockState: 41013,
  keepCurrency: 41014,
}

export function getRebirthUiLabel(key: RebirthUiLabelKey): string {
  return getString(REBIRTH_UI_LABEL_ID[key], 'KOR', key)
}

export type StubUiLabelKey = 'notImplemented'

const STUB_UI_LABEL_ID: Record<StubUiLabelKey, number> = {
  notImplemented: 41015,
}

export function getStubUiLabel(key: StubUiLabelKey): string {
  return getString(STUB_UI_LABEL_ID[key], 'KOR', key)
}

export type BattleUiLabelKey = 'playerName' | 'firstClear'

const BATTLE_UI_LABEL_ID: Record<BattleUiLabelKey, number> = {
  playerName: 41016,
  firstClear: 41026,
}

export function getBattleUiLabel(key: BattleUiLabelKey): string {
  return getString(BATTLE_UI_LABEL_ID[key], 'KOR', key)
}

export type WeaponDetailUiLabelKey = 'level' | 'maxReached' | 'unitCount' | 'fusionUnavailable' | 'fusionNotePrefix' | 'fusionNoteSuffix'

const WEAPON_DETAIL_UI_LABEL_ID: Record<WeaponDetailUiLabelKey, number> = {
  level: 41017,
  maxReached: 41018,
  unitCount: 41019,
  fusionUnavailable: 41020,
  fusionNotePrefix: 41021,
  fusionNoteSuffix: 41022,
}

export function getWeaponDetailUiLabel(key: WeaponDetailUiLabelKey): string {
  return getString(WEAPON_DETAIL_UI_LABEL_ID[key], 'KOR', key)
}

export type OfflineRewardUiLabelKey = 'description'

const OFFLINE_REWARD_UI_LABEL_ID: Record<OfflineRewardUiLabelKey, number> = {
  description: 41023,
}

export function getOfflineRewardUiLabel(key: OfflineRewardUiLabelKey): string {
  return getString(OFFLINE_REWARD_UI_LABEL_ID[key], 'KOR', key)
}

export type TimeHeistUiLabelKey = 'description'

const TIME_HEIST_UI_LABEL_ID: Record<TimeHeistUiLabelKey, number> = {
  description: 41024,
}

export function getTimeHeistUiLabel(key: TimeHeistUiLabelKey): string {
  return getString(TIME_HEIST_UI_LABEL_ID[key], 'KOR', key)
}

export type RelicDetailUiLabelKey = 'notOwned'

const RELIC_DETAIL_UI_LABEL_ID: Record<RelicDetailUiLabelKey, number> = {
  notOwned: 41025,
}

export function getRelicDetailUiLabel(key: RelicDetailUiLabelKey): string {
  return getString(RELIC_DETAIL_UI_LABEL_ID[key], 'KOR', key)
}

export type RankingUiLabelKey =
  | 'title'
  | 'columnRank'
  | 'columnName'
  | 'columnMaxStage'
  | 'columnPlayTime'
  | 'columnRebirthCount'
  | 'loading'
  | 'errorTitle'
  | 'retry'
  | 'empty'
  | 'myRecord'

const RANKING_UI_LABEL_ID: Record<RankingUiLabelKey, number> = {
  title: 41027,
  columnRank: 41028,
  columnName: 41029,
  columnMaxStage: 41030,
  columnPlayTime: 41031,
  columnRebirthCount: 41032,
  loading: 41033,
  errorTitle: 41034,
  retry: 41035,
  empty: 41036,
  myRecord: 41037,
}

export function getRankingUiLabel(key: RankingUiLabelKey): string {
  return getString(RANKING_UI_LABEL_ID[key], 'KOR', key)
}
