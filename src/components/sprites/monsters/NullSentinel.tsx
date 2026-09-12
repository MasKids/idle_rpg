import { MONSTER_SPRITE_DEFAULT_SIZE, type MonsterSpriteProps } from './types'

// 널 센티널 — 보스 전용. 궤도 링 2개 + 이중 육각 코어 + 방사형 스파이크.
// 보스라 다른 5종보다 viewBox 여유를 더 뒀다(방사형 스파이크가 몸통보다 훨씬
// 밖으로 뻗어나가서, 120 기준으로 정규화하면 경계에 살짝 걸린다).
export function NullSentinel({ size = MONSTER_SPRITE_DEFAULT_SIZE, color, className }: MonsterSpriteProps) {
  return (
    <svg
      viewBox="0 0 140 140"
      width={size}
      height={size}
      className={['decor-motion', className].filter(Boolean).join(' ')}
      style={{ color: color ?? 'var(--color-monster-boss)', animation: 'sprite-float 3s ease-in-out infinite' }}
    >
      <g style={{ animation: 'spin-slow 14s linear infinite', transformOrigin: '70px 70px' }}>
        <circle
          cx="70"
          cy="70"
          r="52"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="24 14"
          opacity="0.6"
        />
      </g>
      <circle cx="70" cy="70" r="42" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="14 10" opacity="0.4" />
      <path d="M70 32 L103 51 L103 89 L70 108 L37 89 L37 51 Z" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <path d="M70 46 L90 58 L90 82 L70 94 L50 82 L50 58 Z" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="70" cy="70" r="7" fill="currentColor" />
      <path d="M70 8 V20 M70 120 V132 M18 70 H6 M122 70 H134" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
