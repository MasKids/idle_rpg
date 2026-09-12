import { MONSTER_SPRITE_DEFAULT_SIZE, type MonsterSpriteProps } from './types'

// 글리치 위습 — 일반 몬스터. 깜빡이는 다이아몬드 형태 + 어긋난 조각(글리치 비트).
export function GlitchWisp({ size = MONSTER_SPRITE_DEFAULT_SIZE, color, className }: MonsterSpriteProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={['decor-motion', className].filter(Boolean).join(' ')}
      style={{ color: color ?? 'var(--color-monster-base)', animation: 'sprite-float 2.4s ease-in-out infinite' }}
    >
      <path d="M64 19 L96 57 L64 95 L32 57 Z" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
      <path d="M60 22 L92 60 L60 98 L28 60 Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M44 41 L76 41 M40 79 L80 79" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <rect x="46" y="56" width="28" height="6" fill="var(--color-monster-accent)" />
      <rect x="80" y="50" width="14" height="3" fill="currentColor" opacity="0.6" />
      <rect x="22" y="70" width="12" height="3" fill="currentColor" opacity="0.6" />
    </svg>
  )
}
