# 디자인 시스템 (다크 미니멀)

게임을 다크 미니멀 톤으로 재설계하기 위한 토큰/아이콘/공용 컴포넌트 정의다. **이
단계에서는 토큰과 컴포넌트만 만들었고, 기존 화면(성장/무기고/유물/가챠/존재력/
리버스/타임 하이스트 등)의 레이아웃은 아직 하나도 바꾸지 않았다** — 다음 단계에서
화면을 하나씩 이 시스템으로 옮겨간다.

실제로 색/아이콘/컴포넌트가 어떻게 보이는지는 코드를 읽는 대신 브라우저에서 직접
확인할 수 있다 — "한눈에 보는 방법" 참고.

---

## 한눈에 보는 방법

1. `npm run dev`로 개발 서버를 켠다.
2. 게임 화면 우상단의 🛠️(개발자 도구) 버튼을 누른다.
3. 목록 맨 아래 **"디자인 시스템 보기"** 버튼을 누른다.

[src/dev/DesignSystemPreview.tsx](../src/dev/DesignSystemPreview.tsx)가 전체화면으로
뜨면서 타이포그래피, 배경/텍스트 계층, 기능 색상, 무기·유물 등급색, 재화 6종 색+아이콘,
아이콘 전체 목록, 공용 컴포넌트(Button/Card/CostLabel/ProgressBar/EmptyState/Modal)를
전부 실제 렌더링된 상태로 보여준다. 개발 모드(`import.meta.env.DEV`)에서만 렌더링되므로
배포 빌드에는 포함되지 않는다.

---

## 1. 폰트

**[Pretendard](https://github.com/orioncactus/pretendard)** — 가변 폰트(variable
font) 1개 파일로 전체 굵기 범위(45~920)를 지원한다.

- 설치: `npm install pretendard` (이미 완료)
- 적용: [main.tsx](../src/main.tsx)에서 `pretendard/dist/web/variable/pretendardvariable.css`를
  전역 import → [index.css](../src/index.css)의 `@theme`에서 `--font-sans`로 지정 →
  `body`에 `font-family: var(--font-sans)` 적용. Tailwind의 `font-sans` 유틸리티도
  자동으로 이 폰트를 가리키게 된다.
- **숫자 흔들림 방지**: `body { font-variant-numeric: tabular-nums; }`를
  index.css에 전역 적용해뒀다 — 재화/스탯 숫자가 바뀔 때 자릿수 폭이 안 흔들린다.
  숫자 글리프에만 적용되는 속성이라 한글/영문 텍스트 레이아웃에는 영향이 없다(이번에
  "화면을 안 건드린다"는 원칙과 무관하게 전역으로 켜둔 이유).
- **라이선스**: SIL Open Font License 1.1 — 상업적 이용/배포 전부 무료, 폰트
  자체를 수정 후 재배포할 때만 이름 변경 등의 제약이 있음(이 프로젝트는 해당 없음).
  원문: `node_modules/pretendard/LICENSE.md`.

### 타이포그래피 스케일 (앞으로 화면을 옮길 때 쓸 기준)

기존 화면들은 9~12px 사이 임의의 픽셀 값(`text-[9px]`, `text-[11px]` 등)을 화면마다
따로 정해 써왔다. 다음 단계에서 화면을 옮길 때는 아래 6단계로 통일한다.

| 이름 | 크기 | 용도 |
|---|---|---|
| 2xl | 28px | 큰 재화 합계, 강조 숫자 |
| xl | 22px | 화면 타이틀 |
| lg | 18px | 섹션 타이틀 |
| base | 15px | 본문 |
| sm | 13px | 보조 본문 |
| xs | 11px | 캡션, 라벨 |

Tailwind 유틸리티 클래스로 새로 등록하지 않고 `text-[28px]`처럼 임의값 클래스로
쓴다 — 이 프로젝트 규모에서 별도 스케일 토큰까지 두는 건 과설계라고 판단했다. 대신
"6단계 중 하나만 쓴다"는 규칙 자체를 지키는 게 핵심이다.

---

## 2. 색상 토큰

Tailwind v4의 `@theme` 블록으로 [index.css](../src/index.css)에 정의했다 —
`tailwind.config.js` 없이 CSS 한 곳에서 관리한다(이 프로젝트의 기존 방식과 동일).
`--color-surface-card` 하나를 정의하면 `bg-surface-card`/`text-surface-card`/
`border-surface-card` 유틸리티가 전부 자동 생성된다.

### 배경 계층 4단계

| 토큰 | 값 | 용도 |
|---|---|---|
| `surface-base` | `#0A0A0F` | 화면 최하단 배경 |
| `surface-card` | `#131318` | 카드/리스트 항목 |
| `surface-elevated` | `#1C1C24` | 강조 카드(선택됨/장착 중 등) |
| `surface-border` | `#2A2A35` | 테두리, 구분선 |

### 텍스트 계층 3단계

| 토큰 | 값 | 용도 |
|---|---|---|
| `text-primary` | `#F5F5F7` | 주요 텍스트 |
| `text-secondary` | `#9A9AA5` | 보조 텍스트, 설명 |
| `text-disabled` | `#55555F` | 비활성 텍스트 |

### 기능 색상 — 화면 톤 (CLAUDE.md 규칙 재정의)

기존 CLAUDE.md 규칙("기본 파랑 / 가챠·시간 화면 금색 / 컨트롤 영역 드릴다운 청록")을
아래처럼 명확히 했다. 특히 **존재력 트리도 무기고와 같은 청록**으로 통일한다 — 기존
구현은 존재력 화면이 가챠와 같은 금색이라 화면 톤만 봐서는 구분이 안 됐다(다음 단계
화면 이관 때 고칠 대상).

| 범주 | 대상 화면 | 토큰 |
|---|---|---|
| 청록 (전체화면 드릴다운) | 무기고, 존재력 | `teal-soft` `#0F2E2C` / `teal-base` `#14B8A6` / `teal-strong` `#5EEAD4` |
| 금색 | 가챠, 타임 하이스트 | `gold-soft` `#2E2008` / `gold-base` `#D97706` / `gold-strong` `#FBBF24` |
| 파랑 (일반 UI 포인트) | 성장(컨트롤 영역), 배틀 HUD, 공용 버튼 | `blue-soft` `#12203D` / `blue-base` `#2563EB` / `blue-strong` `#60A5FA` |

각 범주는 3단계(soft/base/strong)로, `soft`는 은은한 배경 틴트(카드 강조 등), `base`는
버튼 등 단색 채움, `strong`은 텍스트/아이콘처럼 어두운 배경 위에서 밝게 보여야 하는
자리에 쓴다.

경고/비활성:

| 토큰 | 값 | 용도 |
|---|---|---|
| `danger-base` / `danger-strong` | `#DC2626` / `#F87171` | 경고, 재화 부족 |
| `success-base` / `success-strong` | `#16A34A` / `#4ADE80` | 완료/충족 상태 (요청엔 없었지만 "장착 중"·돌파 가능 등 기존에도 쓰이던 상태라 추가함) |
| 비활성 | — | 별도 토큰 없이 `text-disabled` + `surface-elevated` 조합으로 표현 |

### 무기 등급 5색 / 유물 등급 3색

유물은 Normal/Rare/Epic 3등급만 있고, 이건 무기 등급의 앞 3단계와 같은 색을 그대로
공유한다(기존 구현도 등급 명칭을 공유해왔던 것과 같은 맥락).

| 등급 | 토큰 | 값 |
|---|---|---|
| Normal | `grade-normal` | `#9CA3AF` (회색) |
| Rare | `grade-rare` | `#38BDF8` (하늘색) |
| Epic | `grade-epic` | `#A78BFA` (보라) |
| Unique | `grade-unique` | `#FB923C` (주황) |
| Legendary | `grade-legendary` | `#FBBF24` (금색) |

5개 전부 어두운 배경(`surface-base`/`surface-card`) 위에서 서로 구분되도록 명도·채도를
다르게 잡았다 — 회색(무채색) → 파랑 → 보라 → 주황 → 금색 순으로 색상환을 넓게 씀.

### 재화 6종 색상

| 재화 | 토큰 | 값 | 아이콘(3장 참고) |
|---|---|---|---|
| 다이아 | `currency-diamond` | `#67E8F9` | Gem |
| 존재력 | `currency-exist` | `#C084FC` | Orbit |
| 성장에너지 | `currency-growth` | `#4ADE80` | TrendingUp |
| 숙련의 정수 | `currency-essence` | `#818CF8` | FlaskConical |
| 시간에너지 | `currency-time` | `#FB923C` | Hourglass |
| 골드 | `currency-gold` | `#FACC15` | Coins |

6개를 색상환에 고르게 배치(청록/보라/초록/남색/주황/노랑)해 HUD에 나란히 떠도
서로 헷갈리지 않게 했다.

---

## 3. 아이콘

**[lucide-react](https://lucide.dev)**를 기본으로 쓰고, lucide에 없는 게임 특화
아이콘(창/활/유물)만 [src/components/icons/](../src/components/icons/)에 직접
그렸다. 커스텀 아이콘은 lucide와 같은 톤으로 맞췄다 — `viewBox="0 0 24 24"`,
`fill="none"`, `stroke="currentColor"`, `strokeWidth={2}`,
`strokeLinecap/Linejoin="round"`, `size`/`strokeWidth` prop을 lucide 아이콘과
동일하게 받는다([types.ts](../src/components/icons/types.ts)의 `IconProps`).

화면 코드는 개별 아이콘을 직접 import하지 않고
[src/components/icons/index.ts](../src/components/icons/index.ts)가 내보내는
도메인별 맵을 쓴다 — "이 아이콘이 lucide인지 커스텀인지" 화면이 몰라도 되게 하기 위함.

| 맵 | 키 | 용도 |
|---|---|---|
| `WEAPON_ICON` | `Sword`(lucide) / `Spear`(커스텀) / `Bow`(커스텀) | 무기 3종 |
| `CURRENCY_ICON` | `CurrencyKey` 6종 | 재화 아이콘(Gem/Orbit/TrendingUp/FlaskConical/Hourglass/Coins) |
| `TAB_ICON` | `TabKey` 5종 | 하단 메뉴(LineChart/Swords/Dices/Orbit/BookOpen) |
| `SYSTEM_ICON` | `relic`(커스텀) / `timeHeist`(History) / `reverse`(RotateCcw) | 유물·타임 하이스트·리버스 |
| `STATE_ICON` | `locked`(Lock) / `unlocked`(Unlock) / `equipped`(CircleCheck) | 상태 표시 |

사용 예:

```tsx
import { WEAPON_ICON, CURRENCY_ICON } from '../components/icons'

<WEAPON_ICON.Sword size={20} className="text-grade-rare" />
<CURRENCY_ICON.diamond size={14} className="text-currency-diamond" />
```

**라이선스**: lucide-react는 ISC License(무료, 상업적 이용 가능, 배포 시 저작권 표시
권장 — 별도 고지 의무는 없음). 커스텀 아이콘 3개(Spear/Bow/Relic)는 이 프로젝트
자체 저작물.

---

## 4. 공용 컴포넌트

[src/components/ui/](../src/components/ui/)에 있다. 전부 위 색상 토큰만 쓰고,
아직 실제 화면에는 연결하지 않았다(Import는 가능하지만 기존 컴포넌트를 대체하진
않음).

### Button

```tsx
import { Button } from '../components/ui'

<Button variant="primary">확인</Button>
<Button variant="secondary">취소</Button>
<Button variant="gold">뽑기</Button>
<Button variant="primary" disabled>부족함</Button>
```

- `variant`: `'primary' | 'secondary' | 'gold'` (기본 `primary`)
- `disabled`는 variant가 아니라 표준 `<button disabled>` 속성 — 색 의도와 활성
  여부는 서로 다른 축이라, "gold인데 비활성" 같은 조합도 자연스럽게 표현된다.
- `hover:`/`active:scale-[0.97]`/`transition-all` 전부 기본 내장 — 기존 화면
  전체에 클릭 피드백이 없던 문제(이전 UI 점검에서 발견)를 새 컴포넌트부터 해소.
- 최소 높이 44px(`min-h-11`)로 터치 영역 권장 기준을 만족.

### Card

```tsx
<Card>기본 카드</Card>
<Card elevated>강조 카드</Card>
```

### Modal

```tsx
<Modal isOpen={isOpen} onClose={onClose} title="제목" footer={<Button onClick={onClose}>확인</Button>}>
  내용
</Modal>
```

제목 + 내용 + 하단 버튼 영역 3단 고정 구조.

### CurrencyChip / CostLabel

```tsx
<CurrencyChip currency="diamond" amount={1234} />   // "지금 얼마 있는지" — HUD용
<CostLabel currency="gold" amount={500} affordable={canAfford} />  // "이 행동에 얼마 드는지" — 버튼 옆
```

`CostLabel`이 TODO-UI.md 1번("업그레이드 버튼에서 어떤 재화를 쓰는지 알기 어려움")에
대응하는 컴포넌트다. `affordable={false}`면 danger 색으로 바뀐다.

### ProgressBar

```tsx
<ProgressBar value={3} max={5} colorClassName="bg-teal-base" />
```

### GradeBadge

```tsx
<GradeBadge grade="Rare" />  // "레어" 한글로 표시
```

기존 화면 중 무기 상세 모달/가챠 확률 목록이 등급을 영문("Rare")으로 노출하던
문제(이전 UI 점검에서 발견)가 새 컴포넌트에서는 반복되지 않도록 `getString()`으로
항상 한글을 조회한다.

### EmptyState

```tsx
<EmptyState icon={<WEAPON_ICON.Sword size={28} />} message="보유한 무기가 없습니다" description="가챠로 무기를 뽑아보세요" />
```

---

## 참고 — 아직 안 한 일

- 기존 화면(BattleArea, GrowthPanel, WeaponEquipmentTab, RelicTab, 각종 모달 등)은
  전부 예전 하드코딩 색(`text-cyan-300`, `bg-amber-500` 등)과 자체 버튼 마크업을
  그대로 쓰고 있다. 이 문서의 토큰/컴포넌트로 옮기는 작업은 다음 단계.
- 존재력 화면을 청록으로 바꾸는 것, 등급 영문 노출을 고치는 것도 "화면을 건드리는"
  작업이라 이번 단계에서는 하지 않았다 — 색상 규칙표에만 반영해뒀다.
