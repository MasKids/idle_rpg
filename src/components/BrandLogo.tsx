// 브랜드 로고 — "Re:[커서]" 박스 + "N.O.V.A"(마침표는 청록 원) + 선택적 부제.
// public/reference/logo-reference.png 시안을 SVG로 재현했다. 청록 계열(박스
// 테두리·커서 블록·N.O.V.A 마침표)은 color prop으로 override 가능한
// currentColor, "N.O.V.A" 글자와 부제는 각각 고정 토큰(text-primary/
// text-secondary)을 쓴다 — 로고를 다른 색으로 바꿔도 글자 대비는 항상 보장된다.
interface BrandLogoProps {
  // 렌더 너비(px). 높이는 showSubtitle 여부에 따른 내부 비율로 자동 계산된다.
  size?: number
  // 부제 "NONLINEAR · OSCILLATION · VOID · APPARATUS" 표시 여부 — 좁은 자리에선 꺼서 로고만.
  showSubtitle?: boolean
  // 청록 계열(currentColor) override.
  color?: string
  className?: string
}

const VIEW_WIDTH = 600
const MAIN_HEIGHT = 100
const SUBTITLE_HEIGHT = 40

export function BrandLogo({ size = 280, showSubtitle = true, color, className }: BrandLogoProps) {
  const viewHeight = MAIN_HEIGHT + (showSubtitle ? SUBTITLE_HEIGHT : 0)
  const height = (size * viewHeight) / VIEW_WIDTH

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight}`}
      width={size}
      height={height}
      className={className}
      style={{ color: color ?? 'var(--color-brand-teal)' }}
    >
      {/* 청록 계열 — 박스, 커서 블록, N.O.V.A 마침표. 아주 약한 글로우만(참고
          이미지보다 훨씬 약하게 — blur 반경을 작게 잡았다). */}
      <g style={{ filter: 'drop-shadow(0 0 2.5px currentColor)' }}>
        <rect x="20" y="15" width="172" height="70" rx="6" fill="var(--color-surface-base)" stroke="currentColor" strokeWidth="2" />
        <text x="38" y="63" fontFamily="var(--font-mono)" fontSize="40" fontWeight="600" fill="currentColor">
          Re:
        </text>
        <rect x="156" y="26" width="15" height="48" fill="currentColor" style={{ animation: 'cursor-blink 1s step-end infinite' }} />

        <circle cx="308" cy="44" r="6" fill="currentColor" />
        <circle cx="392" cy="44" r="6" fill="currentColor" />
        <circle cx="472" cy="44" r="6" fill="currentColor" />
      </g>

      {/* N.O.V.A — 흰색 고정, 글로우 없음 */}
      <g fill="var(--color-text-primary)" fontFamily="var(--font-sans)" fontWeight="700" fontSize="66">
        <text x="216" y="63">
          N
        </text>
        <text x="326" y="63">
          O
        </text>
        <text x="410" y="63">
          V
        </text>
        <text x="490" y="63">
          A
        </text>
      </g>

      {showSubtitle && (
        <text
          x={VIEW_WIDTH / 2}
          y="128"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="15"
          letterSpacing="5"
          fill="var(--color-brand-dim)"
        >
          NONLINEAR · OSCILLATION · VOID · APPARATUS
        </text>
      )}
    </svg>
  )
}
