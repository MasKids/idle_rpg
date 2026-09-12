import type { FC } from 'react'
import { CircuitCrawler } from './CircuitCrawler'
import { DataWraith } from './DataWraith'
import { FractureCore } from './FractureCore'
import { GlitchWisp } from './GlitchWisp'
import { Oscillator } from './Oscillator'
import type { MonsterSpriteProps } from './types'

export { CircuitCrawler } from './CircuitCrawler'
export { DataWraith } from './DataWraith'
export { FractureCore } from './FractureCore'
export { GlitchWisp } from './GlitchWisp'
export { NullSentinel } from './NullSentinel'
export { Oscillator } from './Oscillator'
export type { MonsterSpriteProps } from './types'
export { MONSTER_SPRITE_DEFAULT_SIZE } from './types'

// 일반(비보스) 5종 — 정식 스테이지별 배정 테이블이 나오기 전까지 임시로 순환
// 배정하는 데 쓴다(전투 화면). 보스는 NullSentinel 고정이라 여기 포함 안 함.
export const NORMAL_MONSTER_SPRITES: FC<MonsterSpriteProps>[] = [
  GlitchWisp,
  CircuitCrawler,
  DataWraith,
  FractureCore,
  Oscillator,
]
