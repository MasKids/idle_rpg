# 몬스터 스프라이트 원본 SVG — 참고·보관용

이 폴더의 `.svg` 6개는 **게임이 실제로 쓰지 않는** 참고·보관용 원본이다.
디자인 리뷰나 외부 공유용으로 열어볼 때 어떤 배경에서도 바로 보이도록 색을
전부 고정값(hex)으로 박아뒀다.

실제 게임 화면은 `src/components/sprites/monsters/`의 React 컴포넌트를
쓴다 — 그쪽은 같은 좌표를 그대로 쓰되 색만 `currentColor`와
`index.css`의 `--color-monster-*` 토큰으로 바꿔서, 다른 배경 위에서도
안전하고 `color` prop으로 개체별 색 변경도 가능하다.

두 버전이 좌표까지 따로 놀지 않도록, 이 파일들을 고칠 일이 있으면
대응하는 `.tsx` 컴포넌트도 같이 고칠 것.

| 파일 | 대응 컴포넌트 | 비고 |
|---|---|---|
| `glitch-wisp.svg` | `GlitchWisp.tsx` | 일반 |
| `circuit-crawler.svg` | `CircuitCrawler.tsx` | 일반 |
| `data-wraith.svg` | `DataWraith.tsx` | 일반 |
| `fracture-core.svg` | `FractureCore.tsx` | 일반 |
| `oscillator.svg` | `Oscillator.tsx` | 일반 |
| `null-sentinel.svg` | `NullSentinel.tsx` | 보스 — viewBox가 더 넓음(0 0 140 140) |
