// 몬스터 스프라이트 6종 공용 props. 모든 색은 stroke/fill 하드코딩 없이
// currentColor(기본 윤곽선/전신) 또는 index.css의 --color-monster-* 토큰
// (코어·눈 강조색, 보조선)만 쓴다 — 배경색(--color-surface-base)은 스프라이트
// 안에 절대 넣지 않는다(어떤 배경 위에 올라가든 안전해야 함).
export interface MonsterSpriteProps {
  // 렌더 픽셀 크기(정사각형). viewBox 내부 좌표계와는 별개라 보스(NullSentinel,
  // viewBox가 더 넓다)도 이 값 하나로 다른 스프라이트와 동일하게 크기를 맞출 수 있다.
  size?: number
  // currentColor로 흐르는 기본 윤곽선 색을 override한다. 안 주면 각 컴포넌트가
  // 자기 기본 토큰(일반 5종=--color-monster-base, NullSentinel=--color-monster-boss)을 쓴다.
  color?: string
  className?: string
}

export const MONSTER_SPRITE_DEFAULT_SIZE = 120
