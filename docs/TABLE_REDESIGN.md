# 밸런싱 테이블 구조 개편안

**이 문서는 조사 + 제안으로 시작했고, 1·2단계와 `WeaponTypeTable`/`MasteryTable`
정리가 이제 구현 완료됐다.** 남은 단계(1행 테이블 4개 실제 제거 —
WeaponUpgradeTable/WeaponFusionTable/TimeHeistTable/RebirthTable,
`WeaponGradeTable`→`GradeTable` 코드 참조 전환, StringTable 확장)는 아직 진행 전이다.

> **진행 상황**:
> - 버그 수정(전투 틱/체력바, 무기 돌파·합성, 리버스 재화 초기화)을 먼저 완료.
> - 4절 질문 Q1~Q4 결정됨(아래 각 항목에 표시), Q5~Q7은 아직 미정.
> - **개편 1단계 구현 완료**: `make-balance-xlsx.py` 격리(→ `scripts/seed/
>   seed_balance_xlsx.py` + 존재 시 실행 거부 가드), `scripts/append-row.mjs`(행 추가
>   전용 도구) 신설, `GrowthCurveTable`/`CurrencyTable`/`GradeTable` 3개 신규 테이블
>   추가, `StatTable`/`MasteryTable`의 `CostBase`/`CostGrowthRate`를 `CurveKey` 참조로
>   전환. `CurrencyTable`/`GradeTable`은 이 시점엔 스키마+데이터만 있고 아직 아무
>   코드도 읽지 않았음.
> - **개편 2단계 구현 완료**: 계산식으로 생성하던 데이터를 전부 리터럴 행으로 폈다.
>   - `ExistTreeTable` 10행(구간 압축) → 50행(노드 1개당 1행). `existTree.ts`는
>     이제 공식 없이 조회만 한다. 부수 발견: `FeatureUnlockTable.UnlockCost`가
>     구간 경계의 이중 floor 오차로 실제 노드 비용과 1씩 어긋나 있던 걸 바로잡음
>     (65/598, 기존 66/599).
>   - `StageTable` 20행(챕터 템플릿+보간) → 200행(스테이지 1개당 1행, 10→20챕터로
>     확장 — 4절 Q1 결정). `stages.ts`는 조회만 하고, 200 초과는 마지막 행으로
>     연장한다.
>   - `WeaponTable` 신설(75행 = 3종류×5등급×5단계). 무기 보유/장착 효과가 이제
>     등급 배율을 실시간 참조하지 않고 무기마다 개별 리터럴 값을 가진다(피드백
>     11번). `WeaponTypeTable`에서 `OwnBonusBase`/`EquipBonusBase` 제거,
>     `GrowthCurveTable`에 등급별 무기 레벨업 곡선 5개 추가.
>   - 시딩에 쓰인 공식은 `scripts/seed/seed-exist-tree-nodes.mjs` /
>     `seed-stage-table.mjs` / `seed-weapon-table.mjs`로 보존(평소 파이프라인
>     미실행, 재실행 방지 가드 있음).
>   - **판단 필요**: WeaponTable의 "기본 공격력" 칼럼이 하나(`BaseAtk`)뿐이라,
>     기존에 보유 시/장착 시 서로 다르게 쓰이던 계수(장착이 보유 대비 10배)를
>     하나로 합쳤다 — 장착 시의 종류 무관 공격력 기여도가 예전보다 작아짐.
>     자세한 내용은 `scripts/seed/seed-weapon-table.mjs` 상단 주석 참고.
>   - `WeaponTypeTable`과 `MasteryTable` 통합 검토: **병합하지 않는 쪽을 권장**
>     (서로 다른 책임 — 무기 정체성 vs 숙련 진행도 — 이 같은 3행짜리 작은 테이블에
>     섞이면 오히려 이해하기 어려워지고, 규모가 작아 중복 비용도 미미함).
> - **`WeaponTypeTable`/`MasteryTable` 정리 완료**(위 2단계와는 별개 요청, 2026-09-10):
>   - `WeaponTypeTable` 삭제. `PrimaryStat`(검=ATK/창=ASPD/활=CRIT)을 `WeaponTable`
>     각 행에 직접 기입(같은 종류 25행이 동일값을 반복 — 무기별 개별 조정 여지를
>     남기려는 의도적 중복, 2단계의 다른 칼럼들과 같은 패턴). 종류 이름(StringId,
>     40055~40057)은 테이블화할 실익이 없어(3종류 고정) `balance.ts`의
>     `WEAPON_TYPE_NAME_STRING_ID` 코드 상수로 이관.
>   - `MasteryTable` 삭제. 3행(검/창/활)을 다시 보니 `MultiplierPerLevel`/
>     `CurveKey`/`MaxLevel`이 전부 동일값이었다 — `WeaponType`/`Name`만 다른 순수
>     정체성 데이터였던 셈. 숫자 둘(`MultiplierPerLevel`=0.05, `MaxLevel`=9999)은
>     `CommonTable`로, `CurveKey`("MASTERY_UPGRADE")와 이름 StringId(40072~40074)는
>     3종류 고정이라 `mastery.ts` 코드 상수로 이관.
>   - `mastery.ts`의 `masteryPrimaryStat()`이 이제 `WeaponTable`을 조회한다(기존엔
>     `WeaponTypeTable`). `weapon.ts`의 무기 이름 폴백 조립도 동일하게 전환.
>   - 마이그레이션: `scripts/migrations/006-weapon-type-table-removal.mjs`,
>     `007-mastery-table-removal.mjs`, `008-table-define-cleanup.mjs`(`#TableDefine`/
>     `#EnumDefine` 갱신 — `WeaponTable`이 2단계 신설 이후 처음으로 `#TableDefine`에
>     문서화됨).
>   - 결과: 테이블 22개 → 20개, 총 528행. 브라우저에서 무기 종류 전환·가챠·장착·
>     숙련 업그레이드까지 실제 플레이로 확인(검=ATK/창=ASPD/활=CRIT 특성 유지 확인).

---

## 0. 한눈에 보기

- 현재 18개 테이블 중 **1행짜리 테이블이 4개** (`WeaponUpgradeTable`,
  `WeaponFusionTable`, `TimeHeistTable`, `RebirthTable`) — 전부 없앤다.
- **"개별 조정 필요" 데이터**(존재력 트리 노드, 무기, 스테이지)는 지금 전부
  공식으로 계산되고 있다 — 행으로 펼친다.
- **"규칙적인 성장 비용"**(스탯/숙련/무기 레벨업/타임 하이스트 반복 비용)은 지금
  `CostBase`/`CostGrowthRate` 쌍이 4개 테이블에 흩어져 중복 정의돼 있다 —
  `GrowthCurveTable` 하나로 합친다.
- `make-balance-xlsx.py`는 지금 **매번 전체 xlsx를 처음부터 다시 만드는 스크립트**다.
  이 구조로는 기획자가 엑셀에서 직접 고친 값이 다음 실행 때 통째로 사라진다 —
  이게 이번 개편에서 반드시 풀어야 하는 핵심 문제다 (6절).
- 최종 테이블 수: 18개 → **17개** (1행짜리 4개 소멸, `WeaponTable`/`GrowthCurveTable`/
  `CurrencyTable` 3개 신설).

---

## 1. 현황 조사

### 1.1 테이블별 행 수 / 칼럼 / 용도

`src/data/balance.json`(현재 커밋된 실제 데이터) 기준.

| 테이블 | 행 수 | 칼럼 | 용도 |
|---|---|---|---|
| StageTable | 20 (챕터당 2행: Normal/Boss 템플릿) | Chapter, StageType, EnemyHp, EnemyAtk, KillCount, RewardGold, RewardGrowth, RewardExist, RewardTimeEnergy, HpGrowthRate, RewardGrowthRate | 스테이지 100개를 챕터 템플릿 + 챕터 내 보간(`stages.ts`)으로 생성 |
| StatTable | 5 | StatType, Name, BaseValue, ValuePerLevel, CostBase, CostGrowthRate, MaxLevel | 5스탯 레벨업 비용/효과 |
| ExistTreeTable | 10 (order 구간별 소구간) | Tier, OrderFrom, OrderTo, EffectType, StatType, GrantCurrency, ValueBase, ValuePerNode, CostBase, CostGrowthRate | 존재력 트리 50노드를 10개 구간으로 압축 표현 |
| FeatureUnlockTable | 2 | FeatureType, Name, RequireNodeCount, UnlockCost | 리버스/타임 하이스트 해금 조건 |
| MasteryTable | 3 | WeaponType, Name, MultiplierPerLevel, CostBase, CostGrowthRate, MaxLevel | 무기 종류별 숙련 배율/비용 |
| WeaponTypeTable | 3 | WeaponType, Name, PrimaryStat, OwnBonusBase, EquipBonusBase | 무기 종류별 주스탯, 보유/장착 효과 기준값 |
| WeaponGradeTable | 5 | WeaponGrade, Name, GradeMultiplier | 무기 등급별 배율 |
| WeaponUpgradeTable | **1** | BaseMaxLevel, LevelCostBase, LevelCostGrowthRate, TierStepBonusPercent, BaseAtkOwnBonusPerLevel, BaseAtkEquipBonusPerLevel | 무기 레벨업 전역 공식 |
| WeaponBreakthroughTable | 5 | BreakthroughStep, RequiredDuplicateCount, LevelCapBonus | 돌파 단계별 요구 개수/레벨상한 보너스 |
| WeaponFusionTable | **1** | RequiredCount, ResultLevel, ResultBreakthroughCount | 합성 규칙 (5개 → 1레벨) |
| GachaTable | 5 | GachaLevel, RequirePullCount, 등급별/티어별 Weight, PullCostDiamond | 가챠 레벨별 확률 테이블 |
| RelicTable | 9 | RelicGrade, Name, EffectType, EffectValue, GachaWeight | 유물 9종 개별 효과 |
| RelicSlotTable | 5 | SlotIndex, RequireUnlockedCount | 유물 슬롯 해금 조건 |
| TimeHeistTable | **1** | CostBase, CostGrowthRate, CooldownBase, CooldownGrowthRate, TargetStageOffset, RewardMultiplier | 타임 하이스트 비용/쿨타임 공식 + 대상 스테이지 오프셋 |
| RebirthTable | **1** | ResetStage, ResetStats, ResetMastery, RefundGrowthEnergy, RefundGold, RefundMasteryEssence, KeepExistTree(불리언 7개), BonusBase, BonusExponent, RefundBonusPerPoint, MaxRefundMultiplier | 리버스 동작 스위치 + 보너스 포인트 공식 |
| RebirthRewardTable | 5 | StageFrom, StageTo, DiamondReward | 리버스 시 도달 스테이지 구간별 다이아 신규 지급 |
| CommonTable | 11 | Key, Value, ValueType | 전역 상수 (초기 재화, 오프라인 보상 등) |
| StringTable | 127 | Id, KOR, ENG | 게임 텍스트 |

### 1.2 여러 테이블에 중복 존재하는 칼럼/개념

**`CostBase`/`CostGrowthRate`(또는 `LevelCostBase`/`LevelCostGrowthRate`) 패턴 — 정확히
같은 모양(`floor(Base × Rate^n)`)이 4개 테이블, 6곳에 따로 정의돼 있다:**

| 위치 | 현재 값 |
|---|---|
| StatTable (5행 전부 동일) | CostBase=8, CostGrowthRate=1.18 |
| ExistTreeTable (구간마다 다름, 10곳) | 구간별 상이 |
| MasteryTable (3행 — **셋 다 동일값**) | CostBase=10, CostGrowthRate=1.25 |
| WeaponUpgradeTable | LevelCostBase=15, LevelCostGrowthRate=1.2 |
| TimeHeistTable.Cost | CostBase=20, CostGrowthRate=2.0 |
| TimeHeistTable.Cooldown | CooldownBase=900, CooldownGrowthRate=1.5 |

MasteryTable은 검/창/활 3행이 **값이 완전히 동일**한데도 행마다 따로 들고 있다 — 곡선을
공유 테이블로 빼면 이 중복이 자연히 없어진다. ExistTreeTable은 50노드 개별 조정
대상이라 곡선이 아니라 리터럴 값으로 펼쳐야 하므로(2.2절) 이 통합 대상에서 제외한다.

**등급 배율(`GradeMultiplier`) — 현재 무기만 명시적 테이블(WeaponGradeTable)을 갖고
있고, 유물은 등급 이름(`Normal`/`Rare`/`Epic`)의 StringTable Id만 재사용할 뿐 배율
테이블이 없다.** (`relic.ts`의 `relicGradeName()`이 `WeaponGradeTable`의 이름 Id를
그대로 가져다 쓰는 주석: "무기 등급 이름 StringTable을 그대로 재사용") 이름은 이미
공유되는데 구조(배율/순서)는 공유되지 않는 비대칭 상태 — 사용자가 요청한
`GradeTable` 통합의 직접적인 근거다.

**"노드 수 기반 해금 게이트" 패턴 — `FeatureUnlockTable`(리버스/타임하이스트,
`RequireNodeCount`)과 `RelicSlotTable`(유물 슬롯, `RequireUnlockedCount`)이 같은
개념("존재력 트리 해금 노드 수 N 이상이면 무언가 활성화")을 서로 다른 두 테이블에서
반복한다.** 다만 하나는 EXIST 비용이 붙고(FeatureUnlockTable) 하나는 비용이 없어서
(RelicSlotTable) 완전히 같은 모양은 아니다 — 통합은 선택 사항으로 4절 질문에 남긴다.

**`Name` → StringTable Id 참조 패턴**은 StatTable/FeatureUnlockTable/MasteryTable/
WeaponTypeTable/WeaponGradeTable/RelicTable 6곳에서 일관되게 쓰이고 있다 — 이건
중복이 아니라 이미 잘 통일된 패턴이니 그대로 유지한다.

**`HpGrowthRate`(1.07)/`RewardGrowthRate`(1.1)가 StageTable 20행 전부에 동일한 값으로
박혀있다.** 챕터 내 보간에 쓰는 전역 성장률인데, 한 곳만 고치면 되는 게 아니라
20행을 전부 고쳐야 한다 — 스테이지를 리터럴 행으로 펼치면(2.2절) 이 칼럼 자체가
사라지므로 자연히 해결된다.

### 1.3 1행짜리 테이블 4개 성격 분석

| 테이블 | 담긴 값 | 성격 |
|---|---|---|
| `WeaponUpgradeTable` | BaseMaxLevel(전역 상한), LevelCostBase/Rate(성장 곡선), TierStepBonusPercent(전역 배율), BaseAtkOwnBonusPerLevel/EquipBonusPerLevel(전역 기준값) | **전역 상수 + 성장 곡선이 섞여있다.** 무기 종류/등급별로 다르지 않고 딱 하나뿐이라 데이터 성격상 굳이 "테이블"일 필요가 없다 — 지금도 항상 `TABLES.WeaponUpgradeTable[0]`로만 읽는다(`getWeaponUpgradeConfig()`). |
| `WeaponFusionTable` | RequiredCount(5), ResultLevel(1), ResultBreakthroughCount(0) | **순수 전역 상수 3개.** 등급/무기별로 갈릴 여지가 설계상 없다(합성 규칙은 게임 전체에 하나). |
| `TimeHeistTable` | Cost 곡선, Cooldown 곡선, TargetStageOffset(전역), RewardMultiplier(전역) | **성장 곡선 2개 + 전역 상수 2개가 섞여있다.** 여러 챕터/난이도별로 나뉠 이유가 지금은 없다. |
| `RebirthTable` | 불리언 스위치 7개(전부 `true` 고정), 보너스 포인트 공식 상수 4개 | **동작 스위치 + 공식 상수.** `gameStore.ts`의 `executeRebirth()`가 이 7개 불리언을 실제로 다 읽어서 분기하므로(`config.ResetStage`, `config.RefundGold` 등) 죽은 데이터는 아니다 — 다만 CLAUDE.md에 리버스 동작이 고정 스펙으로 명시돼 있어서("스테이지/스탯 초기화, 무기 전부 소멸... 존재력 트리는 유지") 실질적으로 값이 바뀔 일은 없다. `BonusBase × stage^BonusExponent`는 `Base × Rate^n` 지수 곡선이 아니라 **거듭제곱(power) 곡선**이라 GrowthCurveTable과 모양이 다르다(4절 질문 Q2). |

네 테이블 다 "대상별로 달라질 여지"가 현재 코드/설계상 없다 — 대상이 하나뿐이라
1행인 게 아니라, 애초에 나뉠 구조가 없어서 1행이다. 그래서 전부 CommonTable
흡수 또는 GrowthCurveTable 이관 대상으로 본다(2.4절, 2.3절).

### 1.4 코드에서 계산식으로 생성하는 데이터

| 데이터 | 원본 행 수 | 생성 로직 | 실제 산출량 |
|---|---|---|---|
| 존재력 트리 노드 | ExistTreeTable 10행(구간) | `existTree.ts`의 `generateExistTree()` — 구간의 CostBase/CostGrowthRate/ValueBase/ValuePerNode로 order별 비용·효과 계산 | 50개 노드 |
| 스테이지 | StageTable 20행(챕터 템플릿) | `stages.ts`의 `generateStage()` — 챕터 첫 스테이지 대비 HpGrowthRate/RewardGrowthRate 거듭제곱 보간 | 100개 스테이지(챕터 10개 × 10) |
| 무기 | WeaponTypeTable 3행 + WeaponGradeTable 5행 + WeaponUpgradeTable 1행(TierStepBonusPercent) | `weapon.ts` — 종류×등급×단계 조합마다 `OwnBonusBase × GradeMultiplier × TierMultiplier(tier) × level × count` 공식으로 실시간 계산. **데이터 행은 0개** — 완전히 코드 계산 | 75종 (3종류 × 5등급 × 5단계) |

셋 다 "규칙적으로 생성되지만 개별 조정은 불가능한" 상태다 — 예를 들어 지금은 "35번
노드만 비용을 깎고 싶다"거나 "활-에픽-3단계 무기 하나만 보유 효과를 다르게 주고
싶다"는 걸 표현할 방법이 없다. 개편 방향이 요구하는 "개별 조정 필요 데이터는 행으로
펼친다"가 정확히 이 세 가지를 가리킨다.

### 1.5 StringTable을 거치지 않는 게임 텍스트 전수조사

`src/**/*.tsx` 전체에서 한글이 포함된 줄을 훑어 분류했다.

**A. 의도적 예외 (이미 문서화됨, 그대로 유지 검토)**

- `src/systems/onboarding/onboardingContent.ts` — 웰컴 온보딩 3단계 본문(`WELCOME_STEPS`),
  시스템별 첫 진입 안내(`SYSTEM_INTRO_LINES`). 파일 상단 주석에 "자주 다듬게 되는
  자유 텍스트라 StringTable이 아니라 컴포넌트 쪽 데이터로 둔다"고 명시돼 있다 —
  StringTable을 안 거치지만 최소한 **한 곳에 중앙화**는 돼 있다.

**B. 개발자 전용, 범위 밖**

- `src/components/DevPanel.tsx`, `src/dev/DesignSystemPreview.tsx` — 둘 다
  `import.meta.env.DEV` 게이트로 프로덕션 빌드에서 완전히 제외된다(트리셰이킹
  확인됨). 플레이어가 보지 않는 텍스트라 StringTable 대상이 아니다.

**C. 하드코딩되어 있어 StringTable로 옮겨야 할 대상**

| 파일 | 텍스트 | 비고 |
|---|---|---|
| `StubPanel.tsx` | "설계 완료 · 프로토타입 미구현" | 도감 탭 스텁 안내 — 플레이어가 실제로 보는 문구 |
| `BattleArea.tsx` | "플레이어" | 프로필 표시 이름 |
| `WeaponDetailModal.tsx` | "레벨", "돌파", "최대", "개 필요", "합성 불가", "합성: 장착 중 1개 제외 · 재료 {n}개 필요" | 무기 상세 팝업 라벨/문장 |
| `OfflineRewardModal.tsx` | "자리를 비운 동안 전투가 계속된 것으로 계산해 보상을 지급합니다." | 오프라인 보상 설명 문장 |
| `TimeHeistModal.tsx` | "미래 스테이지의 보상을 시간에너지로 미리 훔쳐옵니다. 스테이지 진행에는 영향을 주지 않습니다." | 타임 하이스트 설명 문장 |
| `RebirthModal.tsx` | 설명 문장 1개, 섹션 제목 3개("초기화 / 소멸"/"지급"/"유지"), 목록 항목 5개("스테이지 → 1-1" 등), 조합 문장 3개 | **가장 많이 새고 있는 화면.** 리버스가 핵심 시스템인데 정작 설명 문구는 전부 하드코딩 |
| `RelicDetailModal.tsx` | "보유하지 않은 유물입니다" | |
| `ExistTreePanel.tsx` | "보유 " 접두사, "' 트리'" 접미사(문자열 조합), "{n}번 노드 · {tier}" | 완전한 문장이 아니라 StringTable 값과 하드코딩 문자열을 이어붙이는 방식이라 다국어 전환 시 어순이 깨진다 |
| `GrowthPanel.tsx` | `/초` 단위 접미사 | 상대적으로 사소함(숫자 포맷팅에 가까움) — 4절 질문 Q5 |

**추가로 발견한 구조적 공백**: 존재력 트리 노드 이름(`T1-3` 형태)과 무기 표시 이름
(`검-Epic-3` 형태)은 지금 **StringTable을 거치지 않고 코드에서 조립**된다
(`existTree.ts`의 `defaultName()`, `weapon.ts`의 `weaponDisplayName()`). 둘 다 "이름이
확정되면 교체 가능하게" 오버라이드 배열(`NODE_NAME_OVERRIDES`, `WEAPON_NAME_OVERRIDES`)만
마련돼 있고 실제 이름은 아직 없다. 노드/무기를 행으로 펼치는 이번 개편과 맞물려
`NameId` 칼럼(기본값 0 = 자동 생성 이름 사용)으로 흡수하는 게 자연스럽다(2.2절).

---

## 2. 개편 설계

### 2.1 개편 후 전체 테이블 목록

| # | 테이블 | 예상 행 수 | 역할 | 비고 |
|---|---|---|---|---|
| 1 | StageTable | **100+** | 스테이지별 적 능력치/보상 리터럴 | 20→100, 보간 제거 |
| 2 | StatTable | 5 | 5스탯 기본값/효과 | CostBase/Rate → CurveKey |
| 3 | ExistTreeTable | **50** | 노드별 비용/효과 리터럴 | 10→50 |
| 4 | FeatureUnlockTable | 2 | 리버스/타임하이스트 해금 조건 | UnlockCost 칼럼 제거(ExistTreeTable에서 조회) |
| 5 | MasteryTable | 3 | 무기 종류별 숙련 배율 | CostBase/Rate → CurveKey(3행 공유 1곡선) |
| 6 | WeaponTypeTable | 3 | 무기 종류별 주스탯 | OwnBonusBase/EquipBonusBase 제거(WeaponTable로 이관) |
| 7 | GradeTable | 5 | 무기/유물 공용 등급 배율·이름 | WeaponGradeTable 재설계 |
| 8 | **WeaponTable** | **75** | 무기 종류×등급×단계별 보유/장착 효과 리터럴 | 신설 |
| 9 | WeaponBreakthroughTable | 5 | 돌파 단계별 조건/보너스 | 변경 없음 |
| 10 | GachaTable | 5 | 가챠 레벨별 확률 | 변경 없음 |
| 11 | RelicTable | 9 | 유물별 효과 | GradeId로 GradeTable 참조(선택) |
| 12 | RelicSlotTable | 5 | 유물 슬롯 해금 조건 | 변경 없음 |
| 13 | RebirthRewardTable | 5 | 리버스 다이아 지급 구간 | 변경 없음 |
| 14 | **GrowthCurveTable** | **~6** | 공용 성장 곡선(Base×Rate^n) | 신설 |
| 15 | **CurrencyTable** | **6** | 재화별 리버스 초기화/환급 속성 | 신설 |
| 16 | CommonTable | **~25** | 전역 상수(1행 테이블 4개 흡수) | 11→25 |
| 17 | StringTable | 150+ | 게임 텍스트 | ID 대역 재설계(2.7절) |

**삭제되는 테이블**: `WeaponUpgradeTable`, `WeaponFusionTable`, `TimeHeistTable`,
`RebirthTable` (4개 전부 CommonTable/GrowthCurveTable로 흡수 — 2.3, 2.4절)

총 테이블 수: 18 → 17. 1행짜리 테이블 4→0.

### 2.2 각 테이블 칼럼 설계 (신규/변경분만)

**StageTable (100+행으로 확장)**

```
Id, Stage(1~), Chapter, StageType(Normal/Boss),
EnemyHp, EnemyAtk, KillCount,
RewardGold, RewardGrowth, RewardExist, RewardTimeEnergy
```

`HpGrowthRate`/`RewardGrowthRate` 칼럼 자체가 없어진다 — 매 스테이지 값이 이미
리터럴이라 보간이 필요 없다. `stages.ts`의 `generateStage()`는 공식 계산 대신 단순
행 조회로 바뀐다.

**ExistTreeTable (50행으로 확장)**

```
Id, Order(1~50), Tier, Lane(left/right),
NameId(→StringTable, 0=자동생성 "T{tier}-{n}" 사용),
EffectType(STAT/GRANT), StatType, GrantCurrency,
Value(리터럴 상승치/지급량), Cost(리터럴 존재력 비용)
```

`ValueBase`/`ValuePerNode`/`CostBase`/`CostGrowthRate`가 전부 없어지고 `Value`/`Cost`
리터럴 두 칼럼으로 줄어든다 — order 50개를 전부 펼치므로 구간(OrderFrom~OrderTo)
개념 자체가 필요 없다. `Tier`/`Lane`은 지금처럼 코드에서 계산해도 되고(1~10=1티어 등,
홀짝=좌우) 데이터로 내려도 된다 — 어차피 order로부터 결정론적이라 어느 쪽이든
동일하니 **칼럼으로 남겨 엑셀에서 한눈에 보이게** 하는 쪽을 제안한다(계산은 코드가
검증용으로 계속 해도 무방).

**FeatureUnlockTable (UnlockCost 제거)**

```
Id, FeatureType, Name, RequireNodeCount
```

해금 비용은 `ExistTreeTable[Order=RequireNodeCount].Cost`를 그대로 조회해서 쓴다 —
지금은 `node_cost(15)`/`node_cost(33)`으로 **같은 공식에서 파생**돼 값이 자동으로
맞지만, ExistTreeTable이 리터럴 50행이 되고 나면 두 값을 따로 들고 있는 게 오히려
"노드 15번 비용을 고쳤는데 FeatureUnlockTable의 UnlockCost 고치는 걸 깜빡함" 같은
새로운 어긋남 위험을 만든다. 칼럼을 아예 없애고 조회로 바꾸는 게 더 안전하다.

**StatTable / MasteryTable (CurveKey 참조로 변경)**

```
StatTable:   Id, StatType, Name, BaseValue, ValuePerLevel, CurveKey, MaxLevel
MasteryTable: Id, WeaponType, Name, MultiplierPerLevel, CurveKey, MaxLevel
```

`CostBase`/`CostGrowthRate` 두 칼럼이 `CurveKey`(문자열, GrowthCurveTable 참조) 하나로
줄어든다. MasteryTable 3행은 전부 같은 `CurveKey`(예: `"MASTERY_UPGRADE"`)를 가리키게
되어 3중 중복이 사라진다.

**WeaponTypeTable (효과 기준값 제거)**

```
Id, WeaponType, Name, PrimaryStat
```

`OwnBonusBase`/`EquipBonusBase`는 WeaponTable 75행에 이미 곱연산까지 끝난 리터럴로
들어가므로 여기선 필요 없다.

**GradeTable (WeaponGradeTable 재설계, 무기/유물 공용)**

```
Id, Grade(Normal/Rare/Epic/Unique/Legendary), Name, GradeMultiplier, UsableByRelic(bool)
```

무기는 5행 전부, 유물은 `UsableByRelic=true`인 앞 3행(Normal/Rare/Epic)만 쓴다.
`RelicTable.RelicGrade`는 그대로 이 테이블의 `Grade` enum 값을 공유한다(이미 이름
StringTable을 공유하고 있으니 자연스러운 연장).

**WeaponTable (신설, 75행)**

```
Id, WeaponType, Grade, Tier(1~5), NameId(0=자동생성),
OwnBonusPerLevel(리터럴, = OwnBonusBase×GradeMultiplier×TierMultiplier 시딩 결과),
EquipBonusPerLevel(리터럴, 동일)
```

`weapon.ts`의 `computeWeaponOwnBonus`/`computeWeaponEquipBonus`는 공식 계산 대신
`getWeaponConfig(type, grade, tier)` 행 조회 + `× level × count`만 하면 된다 — 곱연산
중 "레벨"과 "보유 개수"만 실행 시점 값이고 나머지는 전부 시딩 시점에 확정되는 상수라
행에 미리 곱해 넣는 게 타당하다.

**GrowthCurveTable (신설)**

```
Id, Key(문자열, FK처럼 참조됨), Base, GrowthRate, //Description
```

초기 행 구성안(시딩 시점 기존 값 그대로):

| Key | Base | GrowthRate | 참조하는 곳 |
|---|---|---|---|
| STAT_UPGRADE | 8 | 1.18 | StatTable 5행 전부 |
| MASTERY_UPGRADE | 10 | 1.25 | MasteryTable 3행 전부 |
| WEAPON_LEVEL_UP | 15 | 1.2 | (구)WeaponUpgradeTable |
| TIME_HEIST_COST | 20 | 2.0 | (구)TimeHeistTable.Cost |
| TIME_HEIST_COOLDOWN | 900 | 1.5 | (구)TimeHeistTable.Cooldown |

리버스 보너스 포인트 공식(`Base × stage^Exponent`)은 모양이 달라 여기 포함할지
질문으로 남긴다(Q2).

**CurrencyTable (신설, 6행)**

```
Id, CurrencyType(EXIST/GROWTH_ENERGY/MASTERY_ESSENCE/TIME_ENERGY/GOLD/DIAMOND),
Name(→StringTable), Abbr(→StringTable),
ResetOnRebirth(bool), RefundOnRebirth(bool)
```

현재 코드(`gameStore.ts`의 `executeRebirth()`) 기준 실제 값:

| 재화 | ResetOnRebirth | RefundOnRebirth |
|---|---|---|
| exist | false | false |
| growthEnergy | false | **true** |
| timeEnergy | false | false |
| gold | false | **true** |
| essence(숙련의 정수) | false | **true** |
| diamond | false | false (대신 RebirthRewardTable로 별도 신규 지급 — 환급과는 다른 메커니즘이라 이 테이블 범위 밖) |

지금은 6종 재화 중 하나도 "리버스 시 초기화"되지 않는다 — `ResetOnRebirth`가 전부
`false`인 게 현재 실제 동작과 일치한다(칼럼은 있지만 아직 아무도 `true`가 아님 —
향후 재화가 추가되거나 규칙이 바뀔 때를 대비한 확장 포인트).

**CommonTable (25행 안팎으로 확장)**

기존 11개 키 + 4개 1행 테이블에서 흡수하는 키들:

```
# WeaponUpgradeTable에서
WeaponBaseMaxLevel, WeaponTierStepBonusPercent

# WeaponFusionTable에서
WeaponFusionRequiredCount, WeaponFusionResultLevel, WeaponFusionResultBreakthroughCount

# TimeHeistTable에서
TimeHeistTargetStageOffset, TimeHeistRewardMultiplier

# RebirthTable에서
RebirthResetStage, RebirthResetStats, RebirthResetMastery,
RebirthRefundGrowthEnergy, RebirthRefundGold, RebirthRefundMasteryEssence,
RebirthKeepExistTree,
RebirthBonusBase, RebirthBonusExponent,
RebirthRefundBonusPerPoint, RebirthMaxRefundMultiplier
```

불리언 7개를 어떻게 저장할지는 2.4절 끝과 질문 Q3 참고.

### 2.3 GrowthCurveTable 설계 원칙

"규칙적이고 개별 조정이 불필요한" 판단 기준을 명시한다 — **최대 레벨/사용 횟수가
사실상 무한하거나(9999) 개별 항목이 아니라 하나의 규칙에 여러 대상이 종속되는 경우**
GrowthCurveTable 대상으로 본다:

- StatTable: MaxLevel 9999 (사실상 무한 레벨) → 곡선
- MasteryTable: MaxLevel 9999 → 곡선
- WeaponUpgradeTable: 레벨 상한이 유한(기본 10 + 돌파 최대 50 = 60)하지만, 이걸 무기
  75종 × 레벨 60개로 펼치면 4,500행이 나온다 — 명백한 과설계라 곡선 유지가 맞다
- TimeHeistTable: 사용 횟수 무제한 → 곡선

반대로 **개수가 유한하고 적으며(50개, 75개) 항목마다 다른 값을 주고 싶을 가능성이
실제로 있는 경우**(존재력 트리 노드, 무기 종류×등급×단계 조합)는 곡선이 아니라
리터럴 행으로 펼친다. 이 구분이 이번 개편의 핵심 원칙이다.

### 2.4 CommonTable 설계 — bool 값 처리

`CommonTable.Value`는 지금 엑셀 칼럼 하나(`float` 타입)라 모든 행이 같은 자료형을
써야 한다. RebirthTable의 불리언 7개를 그대로 옮기면 `Value` 칼럼에 숫자와 참/거짓이
섞이게 되는데, 엑셀 시트 구조상(칼럼 하나 = 자료형 하나) `Value`를 `bool` 전용으로
바꿀 수는 없다(다른 키들은 숫자값이라).

제안: **`Value`는 계속 float로 두고 불리언은 0/1로 저장**, `ValueType`에 `"bool"`을
추가해 의미만 표시한다. `balance.ts`에 `getCommonBool(key)` 헬퍼를 새로 추가해서
`getCommon(key) !== 0`을 반환하게 한다 — `build-balance.mjs`가 이미 xlsx의 `bool`
타입 칼럼을 파싱할 수 있으니(파이프라인 자체는 지원됨), CommonTable 시트 안에서만
"이 칼럼은 float로 두고 값으로 0/1을 쓴다"는 관례를 정하면 된다. (대안은 질문 Q3)

### 2.5 CurrencyTable — 2.2절 참고

### 2.6 GradeTable — 2.2절 참고

### 2.7 StringTable ID 대역 설계

지금은 기능이 추가될 때마다 다음 순번을 그냥 이어 붙이는 식이라(40001→40134),
카테고리 구분이 번호만 봐서는 안 된다(중간에 40002처럼 삭제된 DEF 자리, 40009~40014
같은 이유를 알 수 없는 공백이 이미 있다). 100단위로 카테고리 대역을 나눈다:

| 대역 | 카테고리 | 현재 대응 |
|---|---|---|
| 40000~40099 | 스탯/재화 이름·축약형 | STAT_NAME_ID, CURRENCY_NAME_ID, CURRENCY_ABBR_ID |
| 40100~40199 | 탭/시스템 이름 | TAB_NAME_ID, SYSTEM_NAME_ID |
| 40200~40299 | 버튼 라벨 | BUTTON_LABEL_ID |
| 40300~40399 | 상태 라벨 | STATE_LABEL_ID |
| 40400~40499 | 공용 UI 라벨(여러 화면 공유) | COMMON_UI_LABEL_ID |
| 40500~40599 | 무기고 UI | WEAPON_UI_LABEL_ID |
| 40600~40699 | 소환(가챠) UI | GACHA_UI_LABEL_ID |
| 40700~40799 | 유물 UI | RELIC_UI_LABEL_ID |
| 40800~40899 | 성장 탭 UI | GROWTH_UI_LABEL_ID |
| 40900~40999 | 리버스 UI(설명문/섹션제목 포함, 1.5절 C) | REBIRTH_BONUS_LABEL_ID + 신규 |
| 41000~41099 | 타임 하이스트 UI(설명문 포함) | 신규 |
| 41100~41199 | 존재력 트리 UI + 노드 이름(NameId) | EXIST_UI_LABEL_ID + ExistTreeTable.NameId가 가리킬 대역 |
| 41200~41299 | 온보딩/뱃지/기타 공용 | BADGE_LABEL_ID 등 |
| 41300~41399 | 무기 등급/종류 이름 | WeaponGradeTable→GradeTable, WeaponTypeTable |
| 41400~41599 | 무기 이름(WeaponTable.NameId, 75개분 여유) | 신규 |
| 41600~41699 | 유물 이름 9종 | 기존 40063~40071 이관 |
| 41700~41799 | 스텁/에러/기타 잡문구(1.5절 C 나머지) | 신규 |

기존 번호를 전부 재배치하면 StringTable 참조를 쓰는 모든 코드(`STAT_NAME_ID` 등
상수 맵)를 한 번에 고쳐야 한다 — 대역 재설계를 "지금 있는 값 전체 재번호"로 할지
"앞으로 추가되는 것부터 새 대역을 쓰고 기존은 그대로 둘지"는 질문 Q6에 남긴다.

---

## 3. 계산식 → 데이터 전환 시 초기값 채우는 방법

세 가지(존재력 트리 50노드, 무기 75종, 스테이지 100+개) 전부 같은 절차를 따른다:

1. **지금 있는 공식 코드를 그대로 실행**해서(`node_cost()`, `weapon.ts`의 보유/장착
   효과 공식, `stages.ts`의 챕터 보간식) 대상 전체(50/75/100개)에 대한 값을 계산한다.
2. 계산 결과를 엑셀 시트에 **리터럴 값으로 한 번만** 써넣는다 — 이 시점 이후로는
   공식이 아니라 이 리터럴 값이 진실이다.
3. 시딩에 쓰인 공식 코드(Python `node_cost()`/`enemy_hp()` 등, TS의 무기 곱연산 공식)는
   **런타임 코드에서 제거**한다 — `existTree.ts`/`stages.ts`/`weapon.ts`는 이제 계산이
   아니라 행 조회만 한다.
4. 시딩에 쓰인 공식은 완전히 버리지 않고 **1회성 스크립트로 보존**한다(예:
   `scripts/seed/` 디렉터리) — 나중에 "전체를 공식으로 재생성해서 새 베이스라인을
   만들고 싶다"는 요구가 다시 생길 수 있으니 계산 로직 자체는 남겨두되, 평소
   파이프라인(`npm run balance`)에서는 절대 자동 실행되지 않게 격리한다.

## 4. 판단이 애매한 항목 — 질문

**Q1. 스테이지 100+행 확장 범위.** ✅ **결정: 20챕터(200스테이지)까지 행으로 시딩한다.**
그 이상은 마지막 행 기준으로 연장하는 방식으로 처리한다. 콘텐츠 확장 계획이 있어
여유를 둔다.

**Q2. 리버스 보너스 포인트 공식(`Base × stage^Exponent`)을 GrowthCurveTable에 넣을지.**
✅ **결정: (B) CommonTable에 상수 두 개로 유지.** 이 공식을 쓰는 곳이 리버스 하나뿐이라
GrowthCurveTable에 넣을 이득이 적다는 판단.
- ~~(A) `CurveType` 칼럼을 추가해서 `EXP`(Base×Rate^n)와 `POW`(Base×n^Exponent) 둘 다
  지원하게 확장~~ (기각)
- (B) 지금처럼 CommonTable에 `RebirthBonusBase`/`RebirthBonusExponent`로 그냥 상수
  두 개 두기. **← 채택**

**Q3. CommonTable의 bool 저장 방식.** ✅ **결정: (A) `Value`는 float 유지, 0/1로 저장 +
`getCommonBool()` 헬퍼 추가.** 기존 파이프라인을 건드리지 않는 쪽.
- (A) 2.4절 제안대로 `Value`는 float 유지, 0/1로 저장 + `getCommonBool()` 헬퍼 추가.
  **← 채택**
- ~~(B) `CommonTable`에 `Value`(float용)와 별도로 `BoolValue`(bool) 칼럼을 추가~~ (기각)

**Q4. `make-balance-xlsx.py`를 정확히 어떻게 재정의할지.** ✅ **결정 및 구현 완료: (B).**
- ~~(A) 완전 폐기~~ (기각)
- (B) "시딩 전용" 스크립트로 격리하고, 새 행 추가는 별도의 **append 전용 도구**를
  새로 만든다. **← 채택, 구현 완료:**
  - `scripts/make-balance-xlsx.py` → `scripts/seed/seed_balance_xlsx.py`로 이동.
    `balance.xlsx`가 이미 있으면 실행을 거부하는 가드 추가(`--force`로만 강제).
  - `scripts/append-row.mjs` 신설 — 기존 워크북을 열어 지정 시트 마지막 행 다음에
    한 줄만 추가(4행 헤더를 읽어 칼럼 순서 자동 매핑). `node scripts/append-row.mjs
    string <카테고리> <Id> <KOR> <ENG>` StringTable 전용 단축 명령도 포함.
  - 시트 자체를 새로 추가하거나(GrowthCurveTable 등) 기존 시트의 칼럼 구조를 바꾸는
    (StatTable/MasteryTable의 CostBase/CostGrowthRate→CurveKey 전환 등) 더 큰 변경은
    `scripts/migrations/*.mjs` 1회성 마이그레이션 스크립트로 처리 — append-row.mjs의
    책임 범위(행 하나 추가) 밖이라 분리했다.
- ~~(C) 테이블별 코드소유/기획자소유 플래그~~ (기각 — (B)로 충분, 구현 복잡도 대비 이득 적음)

**Q5. `GrowthPanel.tsx`의 `/초` 같은 단위 접미사를 StringTable 대상으로 볼지.** ⏳ **답변
대기 중.** 순수 숫자 포맷팅에 가까워서 게임 "텍스트"라기보다는 코드 로직으로 보고
제외해도 될 것 같다 — 제외를 권장하되 확인 필요.

**Q6. StringTable ID 재배치를 기존 값까지 소급 적용할지, 신규분만 새 대역을 쓸지.**
⏳ **답변 대기 중.**
- (A) 전부 소급 재배치 — 깔끔하지만 `uiStrings.ts`의 모든 ID 맵을 다시 써야 하고
  balance.xlsx StringTable 시트도 전면 재작성.
- (B) 기존 40001~40134는 그대로 두고, 새로 추가되는 항목부터만 새 대역(41000~)을
  적용 — 리스크는 적지만 결국 절반은 카테고리 규칙이 안 맞는 상태로 영구히 남는다.
  **(권장 — 이번 개편의 핵심은 테이블 구조지 ID 정렬이 아니므로, ID는 신규분부터만
  규칙을 적용하는 쪽이 실익 대비 리스크가 낮다)**

**Q7. `FeatureUnlockTable`과 `RelicSlotTable`의 "노드 수 게이트" 패턴을 통합할지.**
⏳ **답변 대기 중.** 현재 하나는 비용이 붙고 하나는 안 붙어 완전히 같은 모양은 아니다 — 굳이 합치면
"비용 0"을 표현해야 해서 오히려 RelicSlotTable 쪽이 부자연스러워진다. **통합하지
않는 쪽을 권장**하지만, 이후 "슬롯 해금에도 비용을 붙이고 싶다" 같은 요구가 생기면
재검토.

---

## 5. `make-balance-xlsx.py` 역할 재정의

### 지금 문제

`make-balance-xlsx.py`는 실행할 때마다 **워크북을 처음부터 새로 만든다**
(`Workbook()`으로 새 객체 생성 후 시트를 하나씩 `write_data_sheet()`로 채움 — 기존
`balance.xlsx`를 열어서 병합하는 게 아니라 통째로 덮어쓴다). 반면
`balance/README.md`가 안내하는 일상적인 밸런싱 절차는 "엑셀을 열어서 값만 고친 뒤
`npm run balance`(=`build-balance.mjs`)만 실행"이다.

두 스크립트의 역할이 다르다:
- `build-balance.mjs` — **읽기 전용**. `balance.xlsx` → `balance.json`. 안전.
- `make-balance-xlsx.py` — **쓰기 전용, 전체 덮어쓰기**. 아무 값이나 xlsx로
  → `balance.xlsx`. 실행하는 순간 기획자가 엑셀에서 직접 고친 값이 전부
  Python 코드의 하드코딩된 값으로 되돌아간다.

지금까지는 이 문제가 드러나지 않았는데, 이번 세션 동안 balance.xlsx를 실제로
엑셀에서 직접 편집한 적이 없고 **항상 Python 스크립트를 고쳐서 재생성**하는 식으로만
작업했기 때문이다. 앞으로 기획자가 실제로 엑셀을 열어 값을 조정하기 시작하면 이
구조는 그 순간 바로 문제가 된다 — StringTable에 새 텍스트 하나 추가하려고
`make-balance-xlsx.py`를 실행하는 순간, 기획자가 이미 고쳐둔 다른 모든 값이
Python 코드가 마지막으로 알고 있던 값으로 롤백된다.

### 제안 (Q4-B 기준)

1. **`make-balance-xlsx.py` → `scripts/seed/seed_balance_xlsx.py`로 이동, 이름과
   docstring에 "1회성, balance.xlsx가 아직 없을 때만 실행" 경고를 명시.** 지금의
   `build_*_rows()` 공식 기반 생성 로직은 여기 그대로 둔다(3절의 "시딩에 쓰인 공식
   보존" 요구를 이 파일이 담당).
2. **`balance.xlsx`가 이미 존재하면 이 스크립트가 스스로 실행을 거부**하도록 가드를
   추가한다(`if XLSX_PATH.exists(): sys.exit("이미 존재합니다 — 덮어쓰려면 강제
   플래그 필요")` 같은 형태) — 실수로 다시 돌려서 기획자 편집분을 날리는 사고를
   원천 차단.
3. **새 StringTable 행 추가 같은 "한 줄만 더하면 되는" 일상적인 변경을 위해 별도의
   작은 도구를 신설**한다 — 예: `scripts/append-string.mjs "카테고리" 41305 "새 텍스트"
   "New Text"`. `build-balance.mjs`처럼 ExcelJS로 **기존 워크북을 열어서** 해당 시트
   마지막 데이터 행 다음에 한 줄만 추가하고 저장한다 — 다른 시트, 다른 행은 전혀
   건드리지 않는다. StringTable뿐 아니라 향후 다른 "행 추가가 잦은" 테이블(예: 새
   유물 추가)에도 같은 패턴을 재사용할 수 있다.
4. 결과적으로 일상적인 밸런싱 흐름은 **"엑셀 직접 편집 또는 append 도구" →
   `npm run balance`** 두 단계로 고정되고, `seed_balance_xlsx.py`는 "새 프로젝트를
   시작하거나 balance.xlsx를 완전히 유실했을 때만 쓰는 재해복구용 스크립트"로
   격하된다.

---

## 6. 다음 단계

이 문서의 2절 설계와 4절 질문에 대한 답이 정해지면, 구현은 대략 다음 순서가 될 것
같다(참고용 — 실제 구현 계획은 별도로 다시 잡는다):

1. GrowthCurveTable/CurrencyTable/GradeTable 신설, WeaponTable 신설
2. ExistTreeTable/StageTable 50/100+행으로 확장(3절 시딩 절차)
3. StatTable/MasteryTable을 CurveKey 참조로 전환
4. FeatureUnlockTable.UnlockCost 제거 + 조회 방식 전환
5. WeaponUpgradeTable/WeaponFusionTable/TimeHeistTable/RebirthTable → CommonTable/
   GrowthCurveTable 흡수 후 삭제
6. `make-balance-xlsx.py` 분리(5절) + append 도구 신설
7. StringTable 신규 항목 추가(1.5절 C 목록) + 신규분 ID 대역 적용(Q6)
8. 코드 쪽(`data/*.ts`, `systems/**/*.ts`) 조회 로직을 공식 계산 → 행 조회로 전환
