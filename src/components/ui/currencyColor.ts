import type { CurrencyKey } from '../../types/game'

// CurrencyChip/CostLabel이 공유하는 재화별 텍스트/아이콘 색.
export const CURRENCY_TEXT_COLOR: Record<CurrencyKey, string> = {
  diamond: 'text-currency-diamond',
  exist: 'text-currency-exist',
  growthEnergy: 'text-currency-growth',
  essence: 'text-currency-essence',
  timeEnergy: 'text-currency-time',
  gold: 'text-currency-gold',
}
