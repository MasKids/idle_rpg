import { CURRENCY_ICON } from '../icons'
import type { CurrencyKey } from '../../types/game'
import { formatNumber } from '../../utils/format'
import { CURRENCY_TEXT_COLOR } from './currencyColor'

interface CurrencyChipProps {
  currency: CurrencyKey
  amount: number
  className?: string
}

// HUD처럼 "지금 얼마 갖고 있는지"를 보여주는 자리에서 쓴다. 비용 표시는 CostLabel 참고.
export function CurrencyChip({ currency, amount, className = '' }: CurrencyChipProps) {
  const Icon = CURRENCY_ICON[currency]
  return (
    <div
      className={`flex items-center gap-1 rounded-full bg-surface-elevated px-2 py-1 ${className}`}
    >
      <Icon size={14} strokeWidth={2} className={CURRENCY_TEXT_COLOR[currency]} />
      <span className="text-xs font-medium tabular-nums text-text-primary">{formatNumber(amount)}</span>
    </div>
  )
}
