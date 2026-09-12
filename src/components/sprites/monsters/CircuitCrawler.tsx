import { MONSTER_SPRITE_DEFAULT_SIZE, type MonsterSpriteProps } from './types'

// 서킷 크롤러 — 일반 몬스터. 네 다리로 뻗은 회로 기판 + 안테나.
export function CircuitCrawler({ size = MONSTER_SPRITE_DEFAULT_SIZE, color, className }: MonsterSpriteProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={['decor-motion', className].filter(Boolean).join(' ')}
      style={{ color: color ?? 'var(--color-monster-base)', animation: 'sprite-float 2.1s ease-in-out infinite' }}
    >
      <rect x="34" y="44" width="52" height="30" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M34 52 L16 38 L0 38 M34 66 L16 80 L0 80 M86 52 L104 38 L120 38 M86 66 L104 80 L120 80"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="16" cy="38" r="2.5" fill="currentColor" />
      <circle cx="16" cy="80" r="2.5" fill="currentColor" />
      <circle cx="104" cy="38" r="2.5" fill="currentColor" />
      <circle cx="104" cy="80" r="2.5" fill="currentColor" />
      <rect x="44" y="55" width="7" height="7" fill="var(--color-monster-accent)" />
      <rect x="69" y="55" width="7" height="7" fill="var(--color-monster-accent)" />
      <path d="M60 44 V30" stroke="var(--color-monster-line)" strokeWidth="1" />
    </svg>
  )
}
