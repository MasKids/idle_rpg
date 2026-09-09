# 무기 / 유물 / 가챠 시스템 설계

이 문서는 새로 설계된 무기·유물·가챠 시스템의 설계 문서다. **아직 구현되지 않았다.**
아래 내용은 구현 전 합의를 위한 설계 정리이며, 코드는 이 문서와 별개로 이후 작업에서
착수한다. `CLAUDE.md`의 구현 등급/재화/탭 구성도 이 설계에 맞춰 갱신되었다.

---

## 0. 기존 시스템 폐기

- **장비 5부위 골드 강화 시스템(무기/투구/갑옷/장갑/신발) 완전 제거.**
  `EquipmentTable`, `equipmentLevels`, 슬롯별 강화 UI를 전부 없앤다.
- **무기 숙련(현재 무기 1종 고정 구조) 폐기.** 무기 종류(검/창/활)별 숙련 구조로
  재설계한다. 숙련이라는 개념 자체는 유지되지만 데이터 모델이 바뀐다.
- 방어력(DEF) 성장 경로였던 장비 갑옷 슬롯이 없어지므로, DEF는 6스탯 성장(성장에너지)
  경로만 남는다. (기존 존재력 트리의 DEF 보너스도 그대로 유지)

---

## 1. 무기

### 1.1 구성

- **3종류**: 검(Sword) / 창(Spear) / 활(Bow)
- **5등급**: Normal / Rare / Epic / Unique / Legendary
- **5단계(Tier 1~5)**: 등급 내에서의 세부 단계
- 종류 × 등급 × 단계 = **3 × 5 × 5 = 75개 아이템**
- 종류별 특성(주 스탯):
  | 종류 | 주 스탯 |
  |---|---|
  | 검 | 공격력(ATK) |
  | 창 | 공격속도(ASPD) |
  | 활 | 치명타 확률(CRIT) |
- 장착 슬롯은 **1개**. 어떤 무기를 장착하든 종류가 바뀔 수 있다(예: 검 장착 중
  활을 장착하면 주 스탯 적용 대상이 ATK에서 CRIT로 전환).
- **이름**: 존재력 트리 노드와 동일한 패턴 — 자동 생성 이름(예: `검-Rare-3`,
  `{종류}-{등급}-{단계}`)을 우선 사용하고, 나중에 이름 배열로 교체 가능한
  구조로 둔다([existTree.ts](../src/data/existTree.ts)의 `NODE_NAME_OVERRIDES`와
  동일한 패턴).

### 1.2 인벤토리 모델

무기는 인스턴스가 아니라 **(종류, 등급, 단계) 75종 각각에 대한 스택형 보유
데이터**로 관리한다.

무기 타입 하나(예: "검·Rare·3단계")당 플레이어가 갖는 상태는 다음 세 가지뿐이다.

| 필드 | 의미 |
|---|---|
| `count` | 보유 개수 (가챠/합성으로 증가, 돌파/합성 소비로 감소) |
| `level` | 레벨업으로 오르는 값 (1 ~ 현재 레벨 상한) |
| `breakthroughCount` | 돌파 횟수 (0~5) |

레벨/돌파는 "무기 타입" 단위로 하나만 존재한다. 즉 같은 타입을 여러 개
보유해도 레벨은 하나만 있고, 나머지 보유분은 돌파·합성의 재료로 소비된다.
장착은 "무기 타입 ID" 하나를 가리키는 포인터다.

### 1.3 무기 성장

**레벨업**
- 골드 소모.
- 기본 레벨 상한 10.

**돌파 (Breakthrough)**
- 같은 무기 타입의 중복분(추가로 보유한 개수)을 소모해 실행.
- 5단계까지: 1회차 진입에 중복 1개, 2회차에 2개, 3회차에 3개, 4회차에 4개,
  5회차에 5개 소모. 누적 소모량 1+2+3+4+5 = **15개**.
- 돌파 1회당 레벨 상한 +10 → 5회 완료 시 레벨 상한 10 + 5×10 = **60**.

**합성 (Merge)**
- 같은 무기 타입을 5개 보유하면 다음 단계 무기 1개로 합성 가능.
- 레벨·돌파 상태는 조건에 관여하지 않는다. **오직 개수만으로 판단.**
- "다음 단계"는 종류별로 25단계(5등급 × 5단계)가 이어진 하나의 사다리로 본다.
  등급 내 단계(1→2→3→4→5)뿐 아니라 등급 경계도 자연스럽게 이어진다.
  예: 노말 5단계 5개 → 레어 1단계 1개.
- 레전드리 5단계는 사다리의 끝이므로 합성 불가.
- **합성 결과물은 레벨 1 / 돌파 0의 새 무기다.** 원본 타입의 레벨·돌파 상태는
  합성과 무관하게 그대로 남는다(재료로 쓴 `count`만 감소할 뿐, 레벨/돌파를
  새 타입으로 옮기지 않는다).
- **장착 무기 보호 (확정)**: 장착 중인 무기 타입은 재료 계산 시 **항상 1개를
  제외**한다. 즉 합성하려면 "장착 1개 + 재료 5개 = 총 6개"를 보유해야 하고,
  장착 중이 아닌 타입은 5개만 있으면 합성할 수 있다.
  - 계산식: `가용 재료 개수 = count - (장착 중인 타입이면 1, 아니면 0)`,
    `합성 가능 = 가용 재료 개수 >= MergeRequiredCount(5)`.
  - **UI 요구사항**: 무기 목록에서 이 규칙이 명확히 보여야 한다. 예를 들어
    장착 중인 타입은 "보유 6 (장착 1 보호 + 재료 5)"처럼 보호분을 분리해
    표시하고, 재료가 5개 미만이면(장착 보호분 제외) 합성 버튼을 비활성화한다.
  - 이 문서에서 확정된 것은 **합성** 재료 계산에서의 보호뿐이다. **돌파의
    중복 소모**에도 같은 보호를 적용할지는 아직 정해지지 않았다(→ 9장 미결정).

### 1.4 무기 효과

- **보유 효과**: 무기를 보유만 해도 적용된다. 단, **현재 장착 중인 무기와 같은
  종류**의 무기만 대상이다. (검을 장착 중이면, 보유 중인 검들의 보유 효과만
  합산 적용. 창/활은 보유하고 있어도 비활성)
- **보유 개수에 비례 (확정)**: 같은 타입을 여러 개 보유하면 그만큼 보유
  효과가 누적된다. 타입 하나의 보유 효과 = `OwnBonusPerLevel × level × count`.
  전투에 적용되는 총 보유 효과 = 장착 중인 종류와 같은 종류인 모든 보유
  타입에 대해 위 값을 합산한 것.
- **장착 효과**: 장착한 무기 1개만의 효과. 해당 종류의 주 스탯에 큰 폭으로
  적용된다(보유 효과보다 계수가 훨씬 큼). `EquipBonusPerLevel × level`
  (개수와 무관 — 장착은 항상 "1개" 취급).
- 두 효과 모두 **무기 레벨에 비례**해 상승한다.

### 1.5 무기 숙련

- 무기 **종류별로 별도** 숙련 레벨: 검 숙련 / 창 숙련 / 활 숙련.
- 숙련의 정수(essence) 소모로 레벨업.
- 전투에는 **장착한 무기의 종류에 해당하는 숙련만** 적용된다(다른 두 종류는
  레벨을 올려도 대기 상태).
- 배치 위치: **성장 탭** ([GrowthPanel.tsx](../src/systems/growth/GrowthPanel.tsx))
  하단에 3종 숙련 리스트로 추가. 기존처럼 장비 탭에 두지 않는다.
- 숙련의 정수 보유량은 이 성장 탭(숙련 화면) 안에서만 표시한다 (→ 4장 HUD
  구성 참고).

---

## 2. 가챠 (무기)

- **다이아** 소모, 순수 랜덤 뽑기. (다이아는 신규 재화 — 4장 HUD 참고)
- 뽑기 결과는 75개 무기 아이템(종류×등급×단계) 중 하나.
  - 종류(검/창/활)는 균등 확률.
  - **등급과 단계(Tier) 모두 확률 분배 대상이다 (확정).** 가챠 레벨이 오르면
    상위 등급 확률과 상위 Tier 확률이 함께 증가한다. 등급 분포와 Tier 분포는
    서로 독립적으로 뽑는다 (예: 등급을 먼저 가중치로 뽑고, Tier도 별도
    가중치로 뽑은 뒤, 종류는 균등하게 뽑아 셋을 조합).
- **가챠 레벨**: 누적 뽑기 횟수에 따라 자동으로 오른다(플레이어가 직접 올리는
  액션 없음). 레벨이 오르면 상위 등급/상위 Tier 확률이 올라간다.
- 노말 등급은 가챠 레벨이 아무리 올라도 **완전히 배제되지 않는다**(확률은
  낮아지되 0은 아님).
- 가챠 레벨은 **리버스해도 유지**된다(무기 자체는 소멸하지만, 가챠 레벨/누적
  뽑기 횟수는 남는다).
- 가챠 레벨 단계 수, 레벨별 필요 누적 뽑기 횟수, 등급/Tier별 가중치, 1회 비용은
  전부 **밸런싱 영역** — `WeaponGachaLevelTable`/`CommonTable`에 적당한 기본값을
  넣어두고 나중에 엑셀에서만 조정한다 (→ 6.4, 6.6 참고).
- 화면 위치: 기존 하단 5탭 중 이미 있는 **"가챠" 탭**(현재 스텁)이 이 화면이
  된다. 새 탭을 추가하지 않는다. (→ 4장 화면 구조에서 재확인)

---

## 3. 유물

- **시간에너지** 소모, 순수 랜덤 뽑기(가챠 레벨 같은 성장 개념 없음 — 확률은
  등급별로 고정).
- **등급 3단계**: Normal / Rare / Epic. **레벨 개념 없음**(뽑으면 완성형).
- **활성화형**: 보유만으로는 효과가 없고, **슬롯에 장착해야** 발동.
- 슬롯 수 = 존재력 트리 **10노드 해금마다 +1**, 최대 5개.
  `slotCount = min(5, floor(unlockedCount / 10))`
- 효과: 스탯 상승 위주 + 일부 특수 효과(골드 획득량 증가, 타임 하이스트 쿨타임
  감소 등). 구체적인 유물 목록/효과값은 `RelicTable`에 적당한 기본값을 넣어두고
  나중에 엑셀에서 조정한다 (→ 6.5 참고).
- **인벤토리: 1종당 1개만 보유하는 도감형 (확정).** 같은 유물이 중복으로
  뽑히면 자동으로 소량의 시간에너지로 환급된다(`RelicDuplicateRefundTimeEnergy`,
  → 6.6 참고). 슬롯에는 유물 "종류"(정의 Id)를 꽂는다 — 개별 인스턴스 개념
  자체가 없다.
- 화면 위치: (아래 4장) 무기고 탭의 **[유물] 하위 탭**. 가챠 탭과는 별도.

---

## 4. 화면 구조

- 하단 탭 5개 유지: **성장 / 무기고 / 가챠 / 존재력 / 도감** (기존 "장비"
  탭을 "무기고"로 개명).
- 탭 클릭 시 **전체화면 전환**(하단 메뉴바는 유지). 기존 CLAUDE.md 기준
  "컨트롤 영역만 교체" 그룹에 있던 장비 탭이 "전체화면 전환" 그룹(가챠/
  존재력/도감)으로 이동 — 컨트롤 영역만 교체되는 탭은 이제 **성장 하나뿐**이다.
- 상단에 **[장비] [유물]** 하위 탭:
  - **장비 하위 탭**: 무기 종류 전환 키(검/창/활), 무기 목록(75종 중 보유분),
    장착, 레벨업, 돌파, 합성.
  - **유물 하위 탭**: 유물 뽑기, 보유 유물 목록, 슬롯 활성화 관리.
- **가챠 탭**(기존 하단 탭, 스텁 해제)이 곧 "무기 가챠" 화면이 된다. 유물 뽑기는
  가챠 탭이 아니라 무기고 탭의 유물 하위 탭 안에 있다는 점에 주의(재화도
  다이아 vs 시간에너지로 서로 다르다).
- **HUD 재화 칩 4개 (확정)**: **다이아 / 존재력 / 성장에너지 / 골드.**
  - 숙련의 정수는 HUD에 없고 **성장 탭(숙련 화면)에서만** 표시한다.
  - 시간에너지는 HUD에 없고 **유물 탭과 타임 하이스트 모달에서만** 표시한다.
  - [BattleArea.tsx](../src/components/BattleArea.tsx)의 HUD 칩 구성을
    이 4개로 교체해야 한다.

---

## 5. 리버스 시 처리

| 대상 | 처리 |
|---|---|
| 무기(인벤토리 전체: count/level/breakthrough) | 전부 소멸 |
| 유물(보유분 + 슬롯 장착 상태) | 전부 초기화 |
| 무기 숙련(검/창/활 3종 레벨) | 전부 초기화 + 소비한 숙련의 정수 전액 환급 |
| 가챠 레벨(누적 뽑기 횟수 포함) | 유지 |
| 존재력 트리 | 유지 (기존과 동일) |
| 다이아 | 유지 |

무기 숙련의 "전액 환급"은 기존 리버스 환급 로직(소비 누적 추적 →
[gameStore.ts](../src/store/gameStore.ts)의 `rebirthSpent`, [rebirthBonus.ts](../src/systems/rebirth/rebirthBonus.ts)의
환급 배율)과 동일한 패턴을 따른다. 즉 숙련의 정수 소비 누적치도 회차 보너스
환급 배율의 적용 대상이 된다(기존 essence 환급과 동일 취급).

무기/유물 자체는 "환급"이 아니라 "소멸/초기화"이므로 회차 보너스 환급 배율과
무관하다.

---

## 6. 데이터 테이블 설계

기존 `balance/balance.xlsx`의 4행 헤더 규칙(1행 참조정보 / 2행 한글명 / 3행
자료형 / 4행 영문 칼럼명, 5행부터 데이터)을 그대로 따른다. 아래 표는 그 4행을
한 줄로 풀어 쓴 것이다.

### 6.1 Id 대역 (실제 구현 기준)

기존 대역(`StageTable` 10000대 ~ `StringTable` 40000대)을 건드리지 않도록 비어 있는
33000/37000/38000대를 신규 테이블에 할당했다. 아래 표는 구현 완료 후의 실제 배정이며,
애초 제안(§6.1 초안의 "WeaponTable 37001~37015 15행 하나" 구조)과는 테이블 분리
방식이 달라졌다 — 75개 아이템을 "종류×등급 15행" 하나로 묶는 대신, 종류(3)/등급(5)/
성장 규칙(1)/돌파 단계(5)/합성 규칙(1)을 각각 별도 테이블로 나눴다(6.2~6.3 참고).
무기 숙련도 33000대를 새로 할당해 별도 테이블(`MasteryTable`)로 관리한다.

| 테이블 | Id 대역 | 행 수 |
|---|---|---|
| MasteryTable | 33002 ~ 33004 | 3 (검/창/활 숙련) |
| WeaponTypeTable | 37001 ~ 37003 | 3 (검/창/활) |
| WeaponGradeTable | 37011 ~ 37015 | 5 (Normal~Legendary) |
| WeaponUpgradeTable | 37021 | 1 (단일 행, TimeHeistTable/RebirthTable과 동일 패턴) |
| WeaponBreakthroughTable | 37031 ~ 37035 | 5 (돌파 1~5단계) |
| WeaponFusionTable | 37041 | 1 (단일 행) |
| GachaTable | 37101 ~ 37105 | 5 (가챠 레벨 0~4, §6.4의 WeaponGachaLevelTable에 대응) |
| RelicTable | 38001 ~ 38009 | 9 (유물 9종) |
| RelicSlotTable | 38101 ~ 38105 | 5 (슬롯 1~5번째 해금 조건, §6.6 참고) |
| CommonTable 추가 행 | 36009 ~ | 기존 테이블에 이어서 |

`#EnumDefine`에는 `WeaponType`(Sword/Spear/Bow), `WeaponGrade`(Normal/Rare/Epic/
Unique/Legendary), `RelicGrade`(Normal/Rare/Epic), `RelicEffectType`(6.5 참고) 4종을
추가했다(당초 제안한 `WeaponKindEnum`/`WeaponGradeEnum` 이름 대신, 다른 Enum들과
동일하게 접미사 없는 이름을 썼다).

### 6.2 WeaponTable — 무기 종류×등급별 기본 계수 (15행)

75개 아이템을 모두 나열하지 않고, 기존 `ExistTreeTable`처럼 **종류×등급 15행 +
단계(Tier)는 코드에서 공식으로 계산**하는 방식을 쓴다(설계 원칙의
"과설계 금지"에 부합).

| 영문 칼럼명 | 한글명 | 자료형 | 참조정보 | 설명 |
|---|---|---|---|---|
| Index | 순번 | int | | 행 순번(표시용) |
| Id | ID | int | | 무기 고유 ID (37000번대) |
| WeaponKind | 무기 종류 | enum | EnumDefine/WeaponKindEnum | Sword/Spear/Bow |
| WeaponGrade | 등급 | enum | EnumDefine/WeaponGradeEnum | Normal~Legendary |
| Name | 이름 | int | StringTable/Id | 무기 이름 문자열 참조 |
| PrimaryStat | 주 스탯 | enum | EnumDefine/StatTypeEnum | 종류별 특성 스탯(ATK/ASPD/CRIT) |
| OwnBonusPerLevel | 보유효과 레벨당 계수 | float | | 보유 효과(타입당) = 이 값 × 레벨 × 보유개수 |
| EquipBonusPerLevel | 장착효과 레벨당 계수 | float | | 장착 효과 = 이 값 × 레벨. 보유효과보다 훨씬 큼 |
| LevelCostBase | 레벨업 비용 기준 | int | | 골드 비용 = LevelCostBase × LevelCostGrowthRate^(레벨-1) |
| LevelCostGrowthRate | 레벨업 비용 성장률 | float | | 위 공식 참고 |
| GachaWeightBase | 가챠 기본 가중치 | float | | 가챠 레벨 0 기준 등급 가중치 (등급이 높을수록 작은 값) |
| //Description | 설명 | string | | 참고용 (파싱 제외) |

단계(Tier 1~5)에 따른 배율은 `WeaponGrowthTable`의 전역 계수
(`TierStepBonusPercent`) 하나로 계산한다 — 등급별로 따로 두지 않는다 (확정, 6.3 참고).

### 6.3 WeaponGrowthTable — 무기 성장 전역 규칙 (단일 행)

`RebirthTable`/`TimeHeistTable`과 같은 "설정 1행" 패턴.

| 영문 칼럼명 | 한글명 | 자료형 | 참조정보 | 설명 |
|---|---|---|---|---|
| Index | 순번 | int | | |
| Id | ID | int | | 37101 고정 |
| BaseMaxLevel | 기본 레벨 상한 | int | | 기본값 10 |
| BreakthroughLevelBonus | 돌파 1회당 레벨 상한 증가 | int | | 기본값 10 |
| MaxBreakthroughCount | 최대 돌파 횟수 | int | | 기본값 5 |
| MergeRequiredCount | 합성 필요 개수 | int | | 기본값 5 |
| TierStepBonusPercent | 단계(Tier)당 스탯 보정 | float | | 단계 하나 오를 때마다 등급 기본 계수에 곱해지는 가산율(%). tier=1 기준 0%, tier=5는 (tier-1)×이 값. 기본값 10 제안 |
| //Description | 설명 | string | | |

돌파 N회차에 필요한 중복 개수는 테이블화하지 않고 **N 그 자체**(1회차→1개,
2회차→2개, …)로 코드에서 계산한다. 데이터로 뺄 필요가 없는 값이라 판단.

### 6.4 WeaponGachaLevelTable — 무기 가챠 레벨 구간

`ExistTreeTable`처럼 구간(band) 방식. 등급과 Tier를 각각 독립적으로 뽑으므로
등급 가중치 5개 + Tier 가중치 5개를 한 행에 함께 둔다.

| 영문 칼럼명 | 한글명 | 자료형 | 참조정보 | 설명 |
|---|---|---|---|---|
| Index | 순번 | int | | |
| Id | ID | int | | 37200번대 |
| GachaLevel | 가챠 레벨 | int | | |
| RequirePullCount | 도달에 필요한 누적 뽑기 횟수 | int | | 이 값 이상 누적 뽑기 시 해당 레벨로 상승 |
| NormalWeight | 노말 가중치 | float | | |
| RareWeight | 레어 가중치 | float | | |
| EpicWeight | 에픽 가중치 | float | | |
| UniqueWeight | 유니크 가중치 | float | | |
| LegendaryWeight | 레전드리 가중치 | float | | |
| Tier1Weight | 1단계 가중치 | float | | |
| Tier2Weight | 2단계 가중치 | float | | |
| Tier3Weight | 3단계 가중치 | float | | |
| Tier4Weight | 4단계 가중치 | float | | |
| Tier5Weight | 5단계 가중치 | float | | |
| //Description | 설명 | string | | |

**초기 기본값 제안 (밸런싱 영역, 엑셀에서 조정)** — 가챠 레벨 5단계:

| GachaLevel | RequirePullCount | Normal | Rare | Epic | Unique | Legendary | Tier1 | Tier2 | Tier3 | Tier4 | Tier5 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 0 | 70 | 22 | 6 | 1.8 | 0.2 | 60 | 25 | 10 | 4 | 1 |
| 1 | 50 | 60 | 27 | 9 | 3.3 | 0.7 | 50 | 27 | 14 | 6 | 3 |
| 2 | 150 | 50 | 30 | 13 | 5.5 | 1.5 | 42 | 27 | 17 | 9 | 5 |
| 3 | 350 | 40 | 32 | 18 | 8 | 2 | 35 | 26 | 19 | 12 | 8 |
| 4 | 700 | 30 | 32 | 22 | 12 | 4 | 28 | 24 | 20 | 16 | 12 |

노말 가중치가 레벨이 올라도 0이 되지 않는 것으로 예시 값을 잡았다(위 규칙
그대로).

### 6.5 RelicTable — 유물 목록

`EquipmentTable`처럼 개별 행 나열 방식(유물은 각각 고유한 효과를 갖는 "도감형"
아이템이라 공식으로 생성하기 어렵다).

| 영문 칼럼명 | 한글명 | 자료형 | 참조정보 | 설명 |
|---|---|---|---|---|
| Index | 순번 | int | | |
| Id | ID | int | | 38000번대 |
| RelicGrade | 등급 | enum | EnumDefine/RelicGradeEnum | Normal/Rare/Epic |
| Name | 이름 | int | StringTable/Id | |
| EffectType | 효과 종류 | enum | EnumDefine/RelicEffectTypeEnum | 스탯형 또는 특수효과형 |
| EffectValue | 효과 수치 | float | | 스탯형이면 가산량, 특수효과형이면 % 등 |
| GachaWeight | 뽑기 가중치 | float | | 등급 내에서의 상대 가중치 |
| //Description | 설명 | string | | |

`RelicEffectTypeEnum` 초기 값 제안: `STAT_ATK`, `STAT_DEF`, `STAT_ASPD`,
`STAT_CRIT`, `STAT_CRIT_DMG`, `STAT_EXIST_GAIN`(스탯형), `GOLD_GAIN`,
`TIMEHEIST_COOLDOWN`(특수효과형).

**초기 기본값 제안 (밸런싱 영역, 엑셀에서 조정)** — 등급당 3종, 총 9종:

| Id | RelicGrade | Name | EffectType | EffectValue | GachaWeight |
|---|---|---|---|---|---|
| 38001 | Normal | 힘의 유물 | STAT_ATK | 5 | 40 |
| 38002 | Normal | 방패의 유물 | STAT_DEF | 5 | 40 |
| 38003 | Normal | 행운의 유물 | STAT_CRIT | 2 | 20 |
| 38004 | Rare | 가속의 유물 | STAT_ASPD | 0.1 | 30 |
| 38005 | Rare | 파괴의 유물 | STAT_CRIT_DMG | 15 | 30 |
| 38006 | Rare | 상인의 유물 | GOLD_GAIN | 10 | 20 |
| 38007 | Epic | 균열의 유물 | STAT_EXIST_GAIN | 0.1 | 10 |
| 38008 | Epic | 시간의 유물 | TIMEHEIST_COOLDOWN | 10 | 10 |
| 38009 | Epic | 전능의 유물 | STAT_ATK | 20 | 10 |

### 6.6 CommonTable 추가 행 (실제 구현 기준)

기존 `CommonTable`(36001~36008)에 이어서 추가. 당초 이 절에서 CommonTable 스칼라 값으로
제안했던 `RelicSlotUnlockInterval`/`RelicSlotMax`/`WeaponGachaCostDiamond` 3개는
구현 단계에서 아래처럼 전용 테이블로 옮겼다 — CommonTable에는 존재하지 않는다:

- **유물 슬롯 해금 조건**: `RelicSlotUnlockInterval`(간격)+`RelicSlotMax`(개수) 두
  스칼라 대신 `RelicSlotTable`(38101~38105, §6.1)에 슬롯 1~5번째마다
  `RequireUnlockedCount`(10/20/30/40/50)를 개별 행으로 넣었다. 슬롯 최대 개수는
  `BALANCE_TABLES.RelicSlotTable.length`로 파생([relic.ts](../src/systems/relic/relic.ts)의
  `RELIC_SLOT_MAX`) — 간격이 균등하지 않아져도(예: 나중에 10/25/40/... 로 바꿔도) 코드
  변경 없이 그대로 반영된다.
- **무기 가챠 1회 비용**: 고정 스칼라 대신 `GachaTable.PullCostDiamond`(§6.1의
  37101~37105, 가챠 레벨별 1행)로 옮겨 레벨마다 다른 비용을 매길 수 있게 했다
  (현재 기본값은 전 레벨 100으로 동일하지만, 구조상 레벨별로 달리 조정 가능하다).

CommonTable에 실제로 남아 있는 행(전부 밸런싱 영역, 엑셀에서 조정):

| Key | 자료형 | 기본값 | 설명 |
|---|---|---|---|
| InitialDiamond | int | 200 | 초기 다이아 보유량 — 리버스 전에도 무기 가챠를 1~2회 체험 가능한 양 |
| RelicGachaCostTimeEnergy | int | 50 | 유물 뽑기 1회 비용 |
| RelicDuplicateRefundTimeEnergy | int | 20 | 유물 중복 획득 시 자동 환급되는 시간에너지 |

다이아의 또 다른 획득 경로(리버스 시 신규 지급)는 무기/유물 시스템이 아니라 리버스
시스템 소관이라 `RebirthTable`(§6.1 밖, 35000번대)에 `DiamondBase`/`DiamondExponent`
컬럼으로 추가했다 — 자세한 내용은 `CLAUDE.md`의 재화 절과
[docs/ARCHITECTURE.md](ARCHITECTURE.md) 6장 참고.

### 6.7 StringTable 추가

기존 규칙대로 마지막 Id(40054) 다음부터 이어서 부여, `//Category`로 분류.
필요한 카테고리: 무기 이름(15개, `WeaponName`), 무기 등급 이름(5개,
`WeaponGrade`), 무기 종류 이름(3개, `WeaponKind`), 유물 이름(9개,
`RelicName`), 신규 재화 이름/축약형("다이아", 기존 `Currency`/`CurrencyAbbr`
카테고리에 합류), 신규 탭 이름("무기고", `Tab` 카테고리), 하위 탭 이름 2개
(장비/유물), 무기 강화 관련 버튼 라벨(장착/레벨업/돌파/합성 — 기존 `Button`
카테고리에 추가), 무기 숙련 관련 라벨(검 숙련/창 숙련/활 숙련).

---

## 7. 기존 코드에서 제거해야 할 것

- **[src/data/equipment.ts](../src/data/equipment.ts)**
  - `EQUIP_SLOT_BY_ID`, `SLOT_ORDER`, `EQUIPMENT_SLOTS`, `equipmentValuePerLevel`,
    `equipmentUpgradeCost` — 5부위 강화 전체 제거.
  - `MASTERY_WEAPON_IDS = [1]` 및 그 위의 단일 무기 숙련 구조 — 종류별
    구조(검/창/활)로 전면 재작성.
- **[src/systems/equipment/EquipmentPanel.tsx](../src/systems/equipment/EquipmentPanel.tsx)**
  - `EquipmentSlotsList`(5부위 강화 UI) 제거.
  - `MasteryList`는 성장 탭으로 이전(이 파일 자체는 새 무기/유물 전체화면
    패널로 대체되거나 삭제).
- **[src/store/gameStore.ts](../src/store/gameStore.ts)**
  - `equipmentLevels` 상태, `upgradeEquipment`/`maxUpgradeEquipment` 액션 제거.
  - `masteryLevels`(현재 `Record<string, number>`, 무기 1종 전제) → 검/창/활
    3종 구조로 재설계.
  - `computeEffectiveStats`의 `equipmentAtk`/`equipmentDef` 가산 로직 제거,
    무기 보유/장착 효과 계산 로직으로 대체.
  - `RebirthTableRow`의 `ResetEquipment`(장비 레벨 초기화 의미) → 무기 인벤토리
    소멸 의미로 재정의 필요. `ResetMastery`는 "전 종류 초기화 + 정수 환급"
    의미 그대로 유지 가능.
- **[src/data/balance.ts](../src/data/balance.ts)**
  - `EquipmentTableRow`, `DEFAULT_EQUIPMENT`, `getEquipmentConfig` 제거.
  - `MasteryTableRow`의 `WeaponId: number` 단일 참조 구조 → `WeaponKind`
    참조로 변경.
- **[balance/balance.xlsx](../balance/balance.xlsx)** / **[scripts/make-balance-xlsx.py](../scripts/make-balance-xlsx.py)**
  - `EquipmentTable` 시트 및 `#TableDefine`의 관련 행 전부 제거.
  - `MasteryTable` 재설계(무기 1종 → 종류 3종, `WeaponId` 참조 방식 변경).
- **[src/types/game.ts](../src/types/game.ts)**
  - `EquipmentSlotId`, `EquipmentSlotData` 제거.
  - `WeaponMasteryData` 재설계(종류 3개 고정 목록으로).
- **[src/store/gameStateStorage.ts](../src/store/gameStateStorage.ts)**
  - `GameSaveState.equipmentLevels` 제거.
  - 무기 인벤토리, 장착 무기 ID, 종류별 숙련 레벨, 유물 보유/슬롯, 무기 가챠
    누적 뽑기 횟수·가챠 레벨, 다이아(신규 `CurrencyKey`라 `currencies`에
    자연 포함) 등 신규 필드 추가.
- **[src/App.tsx](../src/App.tsx)**
  - `FULLSCREEN_TABS`에 `equipment`(무기고로 개명된 탭 키) 추가, 기존 컨트롤
    영역 드릴다운 렌더링 분기 제거.
- **[src/components/BattleArea.tsx](../src/components/BattleArea.tsx)**
  - HUD 재화 칩 구성을 다이아/존재력/성장에너지/골드 4개로 교체(시간에너지
    칩 제거).
- StringTable의 기존 `EquipSlot` 관련 이름(무기/투구/갑옷/장갑/신발, Id
  40001 계열은 아니고 EquipmentTable Name 참조용 문자열)은 더 이상 참조되지
  않으므로 정리 대상이나, 강제 삭제하지 않아도 동작에는 지장 없음(죽은 데이터로
  남는 것만 주의).

---

## 8. 구현 순서 제안 (의존관계 고려)

1. **데이터 기반**: `types/game.ts`에 신규 타입(`WeaponKind`, `WeaponGrade`,
   무기 인벤토리 엔트리, 유물 등) 정의 → `balance.xlsx`/`make-balance-xlsx.py`에
   6장 테이블 반영(기본값 포함) → `npm run balance`로 `balance.json`/`balance.ts`
   갱신. (이후 모든 단계가 이 데이터에 의존하므로 최우선)
2. **재화 확장**: `CurrencyKey`에 `diamond` 추가, HUD를 4장에서 확정한 4칩
   구성(다이아/존재력/성장에너지/골드)으로 교체.
3. **무기 도메인 로직**: `src/systems/weapon/`(신규) 아래 레벨업 비용, 돌파
   조건, 합성 조건(장착 보호 포함), 보유/장착 효과 계산 순수 함수 작성.
   아직 UI 없이 로직만.
4. **무기 숙련 재설계**: `masteryLevels`를 종류별 구조로 바꾸고, 성장 탭
   ([GrowthPanel.tsx](../src/systems/growth/GrowthPanel.tsx))에 숙련 UI 추가.
   (기존 5부위 장비 제거와 동시에 진행 — `gameStore.ts`의 `computeEffectiveStats`
   개편이 이 단계에서 함께 일어남)
5. **기존 장비 시스템 제거**: 0장/7장 목록대로 5부위 강화 코드 삭제.
   (3~4단계로 대체 로직이 준비된 뒤 제거해야 전투 스탯 계산이 끊기지 않는다)
6. **무기 가챠**: `WeaponGachaLevelTable` 기반 확률 로직(등급×Tier 독립 추첨)
   + 가챠 탭 UI(기존 스텁 해제). 가챠 레벨/누적 뽑기 횟수를 저장 상태에 추가.
7. **유물 시스템**: `RelicTable` 기반 뽑기 로직(중복 시 자동 환급 포함),
   슬롯 수 계산(존재력 트리 연동), 슬롯 장착 UI.
8. **탭 개편**: 무기고 탭을 전체화면 탭으로 승격, [장비]/[유물] 하위 탭 UI로
   6~7단계 결과물을 배치.
9. **리버스 연동**: `executeRebirth`에 무기 소멸/유물 초기화/숙련 초기화+환급
   로직 추가(기존 `rebirthSpent`/환급 배율 패턴 재사용).
10. **문서 정리**: 구현하며 확정되는 세부값이 있으면 이 문서와 `CLAUDE.md`를
    갱신.

---

## 9. 미결정

- **돌파 소모 시 장착 보호 적용 여부**: 1.3에서 확정된 "장착 무기 보호"는
  합성 재료 계산에만 명시되어 있다. 돌파의 중복 소모 계산에도 동일하게
  적용할지(예: 돌파 5회차에 중복 5개가 필요할 때, 장착 중인 1개를 항상
  제외하고 계산할지) 확인이 필요하다.
- **밸런싱 수치의 최종값**: 6.4/6.5/6.6에 넣은 가챠 레벨 구간, 등급/Tier
  가중치, 유물 9종의 이름·효과값, 뽑기 비용은 전부 임시 기본값이다. 엑셀에서
  자유롭게 조정 가능한 구조로만 만들어두고, 실제 값은 플레이 테스트 후
  확정한다.
