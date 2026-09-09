import type { SVGProps } from 'react'

// lucide-react 아이콘 컴포넌트와 동일한 사용 관례(size/strokeWidth prop, currentColor)를
// 따르기 위한 공용 props 타입. src/components/icons/의 게임 특화 아이콘 전부가 이 타입을 쓴다.
export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string
  strokeWidth?: number | string
}
