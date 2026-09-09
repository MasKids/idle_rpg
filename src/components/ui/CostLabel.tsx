import { CURRENCY_ICON } from '../icons'
import type { CurrencyKey } from '../../types/game'
import { formatNumber } from '../../utils/format'
import { CURRENCY_TEXT_COLOR } from './currencyColor'

interface CostLabelProps {
  currency: CurrencyKey
  amount: number
  // 지금 낼 수 있으면 기본 색, 못 내면 danger 톤으로 — 업그레이드 버튼 등에서
  // "왜 안 눌리는지"를 숫자 색만으로도 짐작할 수 있게 한다.
  affordable?: boolean
  className?: string
}

// TODO-UI.md 1번 대응 — 업그레이드/뽑기 버튼 등에서 "무슨 재화를 얼마나 쓰는지"를
// 아이콘 없이 숫자만 보여주던 자리에 넣는 용도.
export function CostLabel({ currency, amount, affordable = true, className = '' }: CostLabelProps) {
  const Icon = CURRENCY_ICON[currency]
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium tabular-nums ${
        affordable ? 'text-text-secondary' : 'text-danger-strong'
      } ${className}`}
    >
      <Icon size={12} strokeWidth={2} className={affordable ? CURRENCY_TEXT_COLOR[currency] : 'text-danger-strong'} />
      {formatNumber(amount)}
    </span>
  )
}
