import { MONSTER_SPRITE_DEFAULT_SIZE, type MonsterSpriteProps } from './types'

// 오실레이터 — 일반 몬스터. 타원형 몸통 + 내부 파형 + 위아래 안테나·다리.
export function Oscillator({ size = MONSTER_SPRITE_DEFAULT_SIZE, color, className }: MonsterSpriteProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={['decor-motion', className].filter(Boolean).join(' ')}
      style={{ color: color ?? 'var(--color-monster-base)', animation: 'sprite-float 2.2s ease-in-out infinite' }}
    >
      <ellipse cx="60" cy="62" rx="30" ry="38" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M32 62 Q41 42 50 62 Q59 82 68 62 Q77 42 86 62"
        fill="none"
        stroke="var(--color-monster-accent)"
        strokeWidth="1.5"
        style={{ animation: 'sprite-wave-drift 1.8s ease-in-out infinite' }}
      />
      <rect x="44" y="36" width="9" height="4" fill="var(--color-monster-accent)" />
      <rect x="67" y="36" width="9" height="4" fill="var(--color-monster-accent)" />
      <path d="M46 28 L40 14 M74 28 L80 14" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="40" cy="14" r="2.5" fill="currentColor" />
      <circle cx="80" cy="14" r="2.5" fill="currentColor" />
      <path d="M44 94 L38 108 M76 94 L82 108" stroke="currentColor" strokeWidth="1" opacity="0.6" />
    </svg>
  )
}
