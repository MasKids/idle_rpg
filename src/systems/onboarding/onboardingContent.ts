// 온보딩 안내 문구(본문)는 자주 다듬게 되는 자유 텍스트라 StringTable이 아니라
// 여기 컴포넌트 쪽 데이터로 둔다 — 짧은 라벨(버튼 등)만 StringTable을 쓴다.

export interface WelcomeStep {
  title: string
  body: string
}

export const WELCOME_STEPS: WelcomeStep[] = [
  {
    title: '자동으로 전투합니다',
    body: '캐릭터가 스테이지를 자동으로 돌파합니다. 화면을 계속 보고 있지 않아도 진행돼요.',
  },
  {
    title: '재화를 모아 성장하세요',
    body: '전투에서 얻는 재화로 스탯을 올리고 무기를 강화할 수 있습니다.',
  },
  {
    title: '존재력 트리가 핵심입니다',
    body: '하단 "존재력" 탭에서 노드를 순서대로 해금하는 것이 이 게임의 핵심 진행입니다. 여기서 리버스·타임 하이스트 같은 시스템도 열립니다.',
  },
]

export type SystemIntroKey = 'existTree' | 'equipment' | 'relic' | 'reverse' | 'timeHeist'

export const SYSTEM_INTRO_LINES: Record<SystemIntroKey, string[]> = {
  existTree: ['순서대로 노드를 해금하며 스탯과 재화를 얻습니다.', '일정 노드를 해금하면 리버스·타임 하이스트 같은 특별 기능이 열립니다.'],
  equipment: ['가챠로 무기를 얻습니다.', '같은 무기가 중복되면 돌파와 합성으로 더 강하게 만들 수 있습니다.'],
  relic: ['존재력 트리를 진행하면 유물을 장착할 수 있는 활성화 슬롯이 늘어납니다.'],
  reverse: ['진행 상황을 초기화하지만, 소비한 재화를 전액 돌려받습니다.', '도달 스테이지에 비례한 다이아도 새로 얻습니다.'],
  timeHeist: ['시간에너지를 소비해 미래 스테이지의 보상을 미리 받아옵니다.', '스테이지 진행 자체에는 영향을 주지 않습니다.'],
}
