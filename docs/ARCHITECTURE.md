# 아키텍처 문서

이 문서는 "시간 기반 방치형 RPG" 프로토타입이 지금까지 어떻게 구현되어 있는지 설명합니다.
코드를 몰라도 게임이 내부적으로 어떻게 돌아가는지 이해할 수 있도록, 각 시스템이 "무엇을
하는지"와 "그걸 어느 파일이 담당하는지"를 함께 적었습니다.

무기/유물/가챠/무기 숙련 시스템의 설계 배경과 초안은
[docs/WEAPON_SYSTEM.md](WEAPON_SYSTEM.md)에 별도로 정리되어 있습니다. 이 문서는 그
설계가 실제로 어떻게 구현됐는지를 다룹니다 — 세부값(Id 대역, CommonTable 구성 등)이
서로 다르면 WEAPON_SYSTEM.md 쪽이 실제 구현에 맞춰 갱신된 최신 값입니다.

---

## 1. 폴더 구조와 각 폴더의 역할

```
src/
  App.tsx              화면 전체를 조립하는 최상위 컴포넌트. 어떤 탭이 열려있는지,
                        어떤 모달이 떠있는지를 여기서 관리한다.
  main.tsx             앱의 진입점 (React를 브라우저 화면에 붙이는 코드).

  components/          화면 어디서나 쓰는 공용 UI.
                        - BattleArea.tsx: 상단 전투 화면 + HUD 재화 칩 4개(다이아/
                          존재력/성장에너지/골드). 숙련의 정수·시간에너지는 여기 없고
                          각자 쓰이는 화면(성장 탭 숙련/유물 탭·타임 하이스트 모달)
                          안에서만 보여준다.
                        - ControlArea.tsx: 하단 탭 내용이 바뀌는 영역 (성장 탭만 여기서
                          교체되고, 나머지 탭은 전체화면으로 뜬다)
                        - BottomMenu.tsx: 하단 메뉴바 (성장/무기고/가챠/존재력/도감)
                        - StageInfoModal.tsx: 스테이지 정보 팝업 (리버스 진입점)
                        - StubPanel.tsx: 도감처럼 "설계 완료 · 프로토타입 미구현"만
                          보여주는 스텁 화면 공용 컴포넌트
                        - DevPanel.tsx: 개발자 전용 테스트 도구 (배포 빌드에는 안 들어감)

  data/                "게임 규칙을 계산하는 함수"들이 모인 곳. 여기 있는 함수들은
                        전부 balance.ts(13번 항목 참고)에서 수치를 가져와 계산만 한다 —
                        숫자를 직접 코드에 적어두지 않는다.
                        - balance.ts / balance.json: 엑셀 밸런싱 데이터 (13번 항목 참고)
                        - uiStrings.ts: 화면 텍스트를 StringTable에서 조회하는 함수 모음.
                          도메인별로 묶여 있다(getStatName/getCurrencyName/getTabName/
                          getButtonLabel/getStateLabel/getWeaponUiLabel/getGachaUiLabel/
                          getRelicUiLabel/getGrowthUiLabel/getCommonUiLabel 등) — 새 화면
                          텍스트를 추가할 때도 컴포넌트에 한글을 직접 적지 않고 여기 키를
                          하나 늘리고 StringTable에 대응 행을 추가하는 식으로 간다.
                        - stages.ts: 스테이지별 적 능력치/보상 계산
                        - stats.ts: 6스탯 레벨업 비용/효과 계산
                        - mastery.ts: 무기 종류별(검/창/활) 숙련 배율·비용 계산 (7번 항목)
                        - existTree.ts: 존재력 트리 50노드 생성 (4번 항목 참고)

  store/                게임 전체 상태(재화, 레벨, 진행도 등)를 담는 곳.
                        - gameStore.ts: 상태 그 자체와, 상태를 바꾸는 모든 함수 (2번 항목 참고)
                        - gameStateStorage.ts: localStorage에 저장/불러오기 (12번 항목 참고)

  systems/              기능 단위로 묶은 폴더. 폴더 하나가 게임 시스템 하나에 대응한다.
                        - battle/: 전투 루프, 데미지 계산, 오프라인 보상
                        - growth/: 6스탯 성장 + 무기 숙련 화면. 상단 [스탯]/[숙련]
                          하위 탭으로 나뉜다(7번 항목)
                        - weapon/: 무기 인벤토리·성장(레벨업/돌파/합성)·가챠 로직과
                          화면(장비/가챠 하위 탭 전부 포함, 6·8번 항목)
                        - relic/: 유물 뽑기·슬롯 관리·효과 계산 로직과 화면(9번 항목)
                        - exist/: 존재력 트리 화면
                        - rebirth/: 리버스(환생) 확인 모달 + 회차 보너스 계산(10번 항목)
                        - timeheist/: 타임 하이스트 계산 + 화면(11번 항목)

  types/game.ts          TypeScript 타입 정의만 모아둔 파일. 재화 종류, 스탯 종류 같은
                        "이 게임에 어떤 값들이 있는지"의 목록이 여기 있다.

  utils/                숫자를 "1.2K" 처럼 축약하거나, 초를 "1:23:45"로 바꾸는 등
                        여러 화면에서 공통으로 쓰는 잡다한 도구 함수.

balance/                밸런싱 엑셀 원본. 자세한 내용은 balance/README.md와
                        이 문서의 13번 항목 참고.
scripts/                엑셀 ↔ 코드를 연결하는 스크립트 (npm run balance 등).
docs/                  이 문서, WEAPON_SYSTEM.md(무기/유물/가챠 설계 원안).
```

과거에 있던 5부위 장비 강화 시스템(`systems/equipment/`, `equipmentLevels` 상태,
`data/equipment.ts`)은 무기 시스템으로 완전히 대체되어 삭제됐다. 지금 `data/`에는
그 후신인 `mastery.ts`(숙련 계산만 담당)만 남아 있다.

---

## 2. `gameStore.ts`의 상태 목록

게임이 "지금 어떤 상태인지"는 전부 `src/store/gameStore.ts` 한 곳에 모여 있습니다. 이걸
[Zustand](https://github.com/pmndrs/zustand)라는 상태관리 라이브러리로 관리하는데, 쉽게
말하면 "게임 전체가 공유해서 보는 큰 칠판" 같은 것입니다. 화면 어디서든 이 칠판의 값을
읽거나 정해진 방법으로만 고칠 수 있습니다.

| 상태 | 담당하는 것 |
|---|---|
| `currencies` | 6종 재화(다이아/존재력/성장에너지/숙련의 정수/시간에너지/골드) 보유량 |
| `statLevels` | 6스탯 각각의 성장 레벨 (리버스 시 초기화 대상) |
| `masteryLevels` | 무기 종류별(검/창/활) 숙련 레벨 — `{ Sword: n, Spear: n, Bow: n }` |
| `existTreeStatBonus` | 존재력 트리를 해금하며 누적된 "영구" 스탯 보너스. 리버스해도 보통 유지됨 |
| `stats` | 성장 스탯 + 존재력 트리 보너스 + 활성 유물 스탯 효과 + 무기 보유/장착 효과 +
  (장착 중이면) 그 종류의 숙련 배율까지 전부 합산한 "최종 전투 스탯". 아무거나 하나라도
  바뀌면 즉시 다시 계산됨 |
| `currentStage` | 지금 몇 스테이지인지 |
| `battle` | 지금 싸우는 중인 적의 상태 (최대체력/현재체력/보스 여부/처치 수/필요 처치 수) |
| `lastHit` | 가장 최근 공격 결과 한 건. 화면에 데미지 숫자를 띄우는 연출용일 뿐, 전투 자체는 이 값과 무관하게 계속 진행됨 (3번 항목 참고) |
| `unlockedCount` | 존재력 트리에서 지금까지 해금한 노드 개수 (0~50). 유물 슬롯 수와
  숙련의 정수 지급 시점도 이 값에 연동된다 |
| `specialUnlocks` | 리버스 / 타임 하이스트를 각각 해금했는지 여부 |
| `rebirthSpent` | 이번 회차에 소비한 성장에너지·골드·숙련의 정수의 누적량. 리버스 환급 계산에 쓰임 (10번 항목 참고) |
| `rebirthCount` / `rebirthBonusPoint` / `rebirthMaxStage` | 회차 보너스 관련 — 리버스해도 초기화되지 않고 계속 누적됨 |
| `timeHeistUsedCount` | 타임 하이스트를 지금까지 사용한 누적 횟수 |
| `timeHeistLastUsedAt` | 타임 하이스트를 마지막으로 사용한 시각. 쿨타임 계산의 기준 (11번 항목 참고) |
| `offlineReward` | 오프라인 보상 미리보기 내용. 플레이어가 "받기"를 누르기 전까지만 존재하고, 받으면 `null`이 됨 |
| `ownedWeapons` | 보유 무기 인벤토리. `{ "Sword_Rare_3": { count, level, breakthroughCount } }` 형태로, 75종(3종류×5등급×5단계) 중 보유한 타입만 키로 들어있다 (6번 항목) |
| `equippedWeaponId` | 지금 장착 중인 무기 타입 ID 하나(없으면 `null`). 장착 슬롯은 1개뿐 |
| `gachaCount` / `gachaLevel` | 무기 가챠 누적 뽑기 횟수와 현재 가챠 레벨 — 리버스해도 유지됨 (8번 항목) |
| `ownedRelics` | 보유 유물 id 목록. 도감형이라 종류당 최대 1개만 담긴다 (9번 항목) |
| `activeRelics` | 유물 슬롯 배열(길이 5, 잠긴 슬롯도 자리는 차지). 각 칸에 활성화된 유물 id 또는 `null` |

이 상태들을 바꾸는 함수(`upgradeStat`, `executeRebirth`, `executeTimeHeist`,
`pullWeaponGacha`, `pullRelicGacha` 등)도 전부 같은 파일 안에 정의되어 있습니다.
화면(버튼 클릭 등)은 이 함수를 호출할 뿐, 값을 직접 바꾸지 않습니다.

---

## 3. 전투 루프가 어디서 어떻게 도는지 (탭을 이동해도 유지되는 구조)

관련 파일: `src/systems/battle/battleLoop.ts`, `src/systems/battle/useBattleLoop.ts`,
`src/App.tsx`

전투는 "화면에 전투 장면이 보이고 있어야만 진행되는" 방식이 아닙니다. **전투 시뮬레이션
자체는 화면과 완전히 분리되어 있고, 앱이 켜져 있는 한 항상 돕니다.**

- `battleLoop.ts`는 React 컴포넌트가 아닌 일반 함수입니다. `setTimeout`으로 스스로를
  반복 호출하면서 "공격 → 데미지 계산 → 적 체력 감소 → 죽으면 보상 지급하고 다음 적"을
  계속 반복합니다. 다음 공격까지 걸리는 시간은 매번 최신 공격속도(ASPD)로 다시 계산합니다.
  틱 하나가 예외를 던져도(밸런스 데이터 이상 등) 그 안을 try/catch로 감싸둬서 재귀
  `setTimeout` 체인 자체는 끊기지 않는다 — 그렇지 않으면 그 순간부터 전투가 새로고침
  전까지 영구히 멈춰버린다.
- 처치 보상은 골드·성장에너지·존재력(×EXIST_GAIN 배율) 세 가지가 기본이고, 활성화된
  유물 중 `GOLD_GAIN` 효과가 있으면 골드에 그 비율만큼 더 붙는다(`relic.ts`의
  `applyGoldGainBonus`). 시간에너지는 스테이지 데이터의 `RewardTimeEnergy`가 0보다 클
  때만(=보스 스테이지) 지급된다.
- 이 루프는 `App.tsx`에서 앱이 처음 켜질 때 딱 한 번 `startBattleLoop()`로 시작됩니다.
  이후에는 사용자가 "성장" 탭에서 "존재력" 탭으로 이동하는 것과 무관하게 계속 돕니다.
- 화면에 있는 `BattleArea` 컴포넌트는 `useBattleLoop.ts`라는 훅을 통해 지금 전투 상태를
  "구독"만 합니다. 즉 화면은 루프가 만들어낸 결과를 보여줄 뿐, 화면이 사라진다고 루프가
  멈추지 않습니다 (반대로 화면이 다시 나타나면 그 시점의 최신 상태를 바로 보여줍니다).
- 매 공격마다 `lastHit`이라는 상태 한 칸에 "이번 공격이 얼마나 데미지를 줬는지"를 기록해
  두는데, 화면이 떠 있을 때만 이 값을 보고 데미지 숫자가 위로 떠오르는 연출을 만듭니다.
  연출이 꺼져 있어도 전투 자체(처치, 보상 지급, 스테이지 진행)는 그대로 진행됩니다.

---

## 4. 존재력 트리 50노드가 `ExistTreeTable`로부터 어떻게 생성되는지 + 해금 판정

관련 파일: `src/data/existTree.ts`, `src/data/balance.ts`,
`balance/balance.xlsx`의 `ExistTreeTable` 시트

존재력 트리는 50개 노드를 엑셀에 하나하나 적어두지 않습니다. 대신 `ExistTreeTable`
시트에 **5개 행(5티어 × 10노드) 밴드**만 정의해두고, 코드가 그 계수로 50개를 계산해서
만들어냅니다. 노드 하나하나를 order%5 같은 방식으로 순환시키는 게 아니라, 티어 하나가
통째로 10개 연속 노드를 차지하는 구조입니다 — 지금 배정은 1티어(1~10번)=ATK,
2티어(11~20번)=DEF, 3티어(21~30번)=ASPD, 4티어(31~40번)=재화 지급(숙련의 정수),
5티어(41~50번)=EXIST_GAIN 입니다.

`ExistTreeTable`의 한 행(티어)은 이런 정보를 담고 있습니다: 이 티어가 몇 번 노드부터
몇 번 노드까지인지(`OrderFrom`~`OrderTo`), 이 티어의 효과가 스탯 상승(`STAT`)인지
재화 지급(`GRANT`)인지, 노드 하나당 비용/효과가 기준값(`CostBase`/`ValueBase`)에서
얼마씩 늘어나는지(`CostGrowthRate`/`ValuePerNode`).

`generateExistTree()` 함수(`existTree.ts`)가 1번부터 50번까지 순서대로 돌면서, 각
노드 번호가 어느 티어에 속하는지 찾은 뒤(`getExistTreeTier`, `balance.ts`) 그 티어의
계수로 노드 하나하나의 비용과 효과를 계산합니다.

- 비용: `floor(티어.CostBase × 티어.CostGrowthRate ^ (order − 티어 시작 order))`
- 효과값(스탯 상승량 또는 재화 지급량): `티어.ValueBase + (order − 티어 시작 order) × 티어.ValuePerNode`

**해금 판정 로직**은 아주 단순합니다 (`existNodeStatus` 함수):
- 이미 해금한 노드 번호(`unlockedCount`) 이하 → **해금됨**
- 바로 다음 번호(`unlockedCount + 1`) → **해금 가능** (지금 누를 수 있는 노드)
- 그보다 뒤 → **잠김**

즉 노드는 반드시 1번부터 순서대로만 해금할 수 있고, 건너뛰거나 갈라지는 분기가 없습니다.

총 노드 개수는 코드에 `50`을 박아두지 않고 `ExistTreeTable`의 마지막 티어 `OrderTo`
값으로부터 `EXIST_TREE_TOTAL_NODES` 상수로 파생됩니다 — 나중에 티어를 추가/조정해도
이 상수를 참조하는 화면(리버스 모달의 "존재력 트리 (n/50 해금)" 등)이 자동으로 맞게
표시됩니다.

---

## 5. 특별 해금(리버스/타임 하이스트)이 트리 노드와 어떻게 분리되어 있는지

관련 파일: `src/data/existTree.ts`(`EXIST_SPECIAL_UNLOCKS`), `src/store/gameStore.ts`
(`unlockSpecial`), `src/systems/exist/ExistTreePanel.tsx`,
`balance/balance.xlsx`의 `FeatureUnlockTable` 시트

리버스와 타임 하이스트는 **50개 노드 배열에 속한 노드가 아닙니다.** 완전히 별도의 목록
(`EXIST_SPECIAL_UNLOCKS`)으로 관리되고, `FeatureUnlockTable` 시트에서 "몇 번 노드를
해금해야 나타나는지(`RequireNodeCount`)"와 "해금 비용(`UnlockCost`)"만 가져와서 씁니다.

화면(`ExistTreePanel.tsx`)에서는 이 특별 해금들을 "트리 옆 특정 노드 번호(anchor) 옆
자리"에 그려주기만 합니다 — 트리를 스크롤하다가 15번 노드나 33번 노드 근처에 도달하면
그 옆에 나타나는 식입니다. 하지만 실제 해금 여부는 트리 노드와 완전히 별개의 상태
(`specialUnlocks.reverse`, `specialUnlocks.timeHeist`)로 저장되고, 트리를 50개 다
해금하지 않아도 조건(노드 개수)만 채우면 별도로 존재력을 지불해 해금할 수 있습니다.

---

## 6. 무기 시스템 — 인벤토리, 성장(레벨업/돌파/합성), 보유/장착 효과

관련 파일: `src/systems/weapon/weapon.ts`, `src/systems/weapon/WeaponEquipmentTab.tsx`,
`src/systems/weapon/WeaponDetailModal.tsx`, `src/store/gameStore.ts`,
`balance/balance.xlsx`의 `WeaponTypeTable`/`WeaponGradeTable`/`WeaponUpgradeTable`/
`WeaponBreakthroughTable`/`WeaponFusionTable` 시트

**인벤토리 모델**: 무기는 인스턴스가 아니라 "종류(검/창/활) × 등급(5) × 단계(5) = 75종"
각각에 대한 스택형 보유 데이터로 관리됩니다. `buildWeaponId(type, grade, tier)`가
`"Sword_Rare_3"` 같은 문자열 ID를 만들고, `ownedWeapons`에 이 ID를 키로 `{ count,
level, breakthroughCount }`가 하나씩만 존재합니다 — 같은 타입을 여러 개 보유해도
레벨/돌파는 타입당 하나뿐이고, 나머지는 돌파·합성 재료로 쓰입니다.

**성장 공식**: 등급 배율(`WeaponGradeTable.GradeMultiplier`)과 단계(Tier) 보정
(`WeaponUpgradeTable.TierStepBonusPercent`를 전역 계수로 적용, 등급별로 따로 두지
않음)이 종류별 기본 계수 위에 곱연산으로 얹힙니다. 레벨업 골드 비용은
`LevelCostBase × LevelCostGrowthRate^(레벨-1) × 등급배율`.

**돌파**: 같은 타입의 중복분을 소모해 실행합니다. `WeaponBreakthroughTable`에 1~5단계
행이 있고, N회차에 필요한 중복 개수는 테이블화하지 않고 코드에서 N 그 자체로 계산합니다
(1회차→1개, …, 5회차→5개, 누적 15개). 돌파 1회당 레벨 상한이
`LevelCapBonus`만큼 오릅니다(`weaponMaxLevel`).

**합성**: 같은 타입을 `WeaponFusionTable.RequiredCount`(기본 5)개 보유하면 사다리
(종류별 25단계: 5등급×5단계)의 다음 칸으로 합성됩니다. **장착 중인 타입은 재료 계산에서
항상 1개를 제외**합니다(`canMerge`/`computeWeaponReadiness`) — 장착 무기를 실수로
합성 재료로 날리지 않도록 하는 확정 규칙입니다. 합성 결과물은 레벨 1/돌파 0의 새
무기이고, 원본 타입의 레벨·돌파 상태는 그대로 남습니다.

**보유/장착 효과** (`computeWeaponBonusBreakdown`, `gameStore.ts`의
`computeEffectiveStats`에서 사용):
1. **모든 무기가 종류 불문 공유하는 기본 ATK** — 보유만 해도 적용되고, 장착 여부와도
   무관합니다. 무기 종류를 바꿔도 이 값은 계속 남아 있어 ATK가 0으로 꺼지지 않습니다.
2. **장착 중인 종류의 특화 스탯**(검=ATK 추가분, 창=ASPD, 활=CRIT) — 그 종류를 보유한
   모든 타입의 보유 효과 합 + 장착한 무기 1개만의 장착 효과(계수가 훨씬 큼)가 더해집니다.
3. 마지막으로 그 특화 스탯에 (장착 중이면) 그 종류의 무기 숙련 배율이 곱연산으로
   걸립니다 — 자세한 내용은 7번 항목 참고.

---

## 7. 무기 종류별 숙련 — 장착한 종류만 전투에 적용되는 구조

관련 파일: `src/data/mastery.ts`, `src/systems/growth/GrowthPanel.tsx`,
`src/store/gameStore.ts`(`computeEffectiveStats`, `upgradeMastery`,
`maxUpgradeMastery`), `balance/balance.xlsx`의 `MasteryTable` 시트

숙련은 무기 1종 고정이 아니라 **검/창/활 종류별로 각각 레벨을 갖습니다**
(`masteryLevels: { Sword, Spear, Bow }`). `MasteryTable`에 종류당 1행씩 있고,
`MultiplierPerLevel`만큼 레벨당 배율이 오르며, 숙련의 정수를 `CostBase ×
CostGrowthRate^현재레벨`만큼 소비해 올립니다.

전투에는 **지금 장착한 무기의 종류에 해당하는 숙련만** 적용됩니다
(`computeEffectiveStats`에서 `equippedWeaponId`가 있을 때만 그 종류의 배율을 특화
스탯에 곱연산으로 겁니다). 무기를 아예 장착하지 않았으면 숙련 배율 자체가 걸리지
않고, 종류를 바꾸면 곱해지는 배율도 그 자리에서 바뀝니다 — 검 숙련을 아무리 올려도
창을 장착한 순간 ATK 배율은 빠지고 ASPD에 창 숙련 배율이 걸리는 식입니다.

화면은 **성장 탭**([GrowthPanel.tsx](../src/systems/growth/GrowthPanel.tsx)) 상단의
[스탯]/[숙련] 하위 탭 중 [숙련] 쪽에 있습니다(무기고 탭이 아님). 검/창/활 3줄로
레벨·현재 효과 배율·다음 레벨 비용·[수련]/종류별 [최대로] 버튼을 보여주고, 지금
장착 중인 종류는 강조 테두리 + "장착 중" 배지로 표시해 왜 나머지 두 종류가 대기
상태인지 알 수 있게 합니다. 숙련의 정수 보유량도 이 화면 안에서만 표시됩니다.

---

## 8. 무기 가챠 — 레벨과 확률 구조

관련 파일: `src/systems/weapon/weapon.ts`(`rollWeaponGacha`,
`currentGachaLevelConfig`), `src/systems/weapon/WeaponGachaPanel.tsx`,
`src/data/balance.ts`(`getGachaLevelForPullCount`), `balance/balance.xlsx`의
`GachaTable` 시트

다이아를 소모하는 순수 랜덤 뽑기입니다. 뽑을 때마다 종류(검/창/활)는 균등 확률로,
등급과 단계(Tier)는 각각 독립적인 가중치로 따로 추첨한 뒤 셋을 조합합니다
(`weightedPick` — 가중치 합 대비 난수 위치로 하나를 고르는 표준적인 룰렛휠 선택).

**가챠 레벨**은 플레이어가 직접 올리는 액션이 없고, 누적 뽑기 횟수(`gachaCount`)가
`GachaTable.RequirePullCount`를 넘을 때마다 자동으로 오릅니다
(`getGachaLevelForPullCount`). 레벨이 오르면 상위 등급·상위 Tier 가중치가 함께
올라가지만, 노말 등급 가중치가 0이 되는 일은 없습니다(완전 배제되지 않음).
`gachaCount`/`gachaLevel`은 **리버스해도 유지**됩니다 — 무기 자체는 리버스로 전부
소멸하지만 가챠 숙련도(?)라 할 수 있는 이 진행도는 남습니다.

1회 비용(`GachaTable.PullCostDiamond`)은 가챠 레벨별로 다르게 매길 수 있는 구조지만,
현재 기본값은 전 레벨 100다이아로 동일합니다. 화면은 하단 5탭의 **가챠** 탭이 그대로
이 화면입니다(유물 뽑기와는 다른 탭 — 재화도 다이아 vs 시간에너지로 다르다는 점에
주의).

---

## 9. 유물 시스템과 슬롯 해금 구조

관련 파일: `src/systems/relic/relic.ts`, `src/systems/relic/RelicTab.tsx`,
`src/systems/relic/RelicDetailModal.tsx`, `src/store/gameStore.ts`,
`balance/balance.xlsx`의 `RelicTable`/`RelicSlotTable` 시트

유물은 시간에너지를 소모하는 순수 랜덤 뽑기입니다(가챠 레벨 같은 성장 개념 없음 —
등급별 확률은 고정). **도감형 인벤토리**라 유물 종류당 최대 1개만 보유하고, 이미
보유한 유물이 다시 뽑히면 자동으로 `RelicDuplicateRefundTimeEnergy`만큼 시간에너지로
환급됩니다(`pullRelicGacha`). 뽑기 자체는 9종 전체를 `GachaWeight`로 한 번에 추첨하는
단일 풀 방식이라, 등급별 게이트 없이 등급이 높을수록 가중치만 낮게 잡혀 있습니다.

**슬롯**: 보유만으로는 효과가 없고 슬롯에 꽂아야(활성화) 발동합니다. 슬롯 개수는
`RelicSlotTable`(슬롯 1~5번째 각각의 `RequireUnlockedCount` = 10/20/30/40/50)로
정의되고, `computeRelicSlotCount(unlockedCount)`가 존재력 트리 해금 노드 수를 보고
지금 열려 있는 슬롯 수를 계산합니다. 슬롯 최대 개수(`RELIC_SLOT_MAX`)도 숫자를 박아두지
않고 `RelicSlotTable.length`로 파생됩니다. `setRelicSlot(slotIndex, relicId)`이
활성화/비활성화를 모두 처리합니다 — 슬롯이 가득 찼거나 이미 다른 슬롯에 꽂혀 있으면
거부됩니다.

**효과**: 활성화된 유물들의 효과는 `computeActiveRelicEffects`가 한 번에 합산합니다.
- **스탯형**(STAT_ATK/DEF/ASPD/CRIT/CRIT_DMG/EXIST_GAIN): `computeEffectiveStats`에서
  가산으로 반영
- **특수효과형**: `GOLD_GAIN`(골드 획득량 %)은 전투 처치 보상·오프라인 보상·타임
  하이스트 보상 세 곳 전부에서 `applyGoldGainBonus`로 적용되고, `TIMEHEIST_COOLDOWN`
  (쿨타임 감소 %)은 `applyTimeHeistCooldownReduction`으로 타임 하이스트 쿨타임 계산에
  적용됩니다(11번 항목).

화면은 무기고 탭의 **[유물] 하위 탭**입니다 — 상단 슬롯 현황, 중단 유물 뽑기, 하단
전체 유물을 등급순으로 나열한 그리드(미보유도 흐리게 함께 표시) + 클릭 시 뜨는 상세
팝업(무기 상세 팝업과 동일한 패턴)으로 구성됩니다.

---

## 10. 리버스 실행 시 초기화/유지/환급/지급이 각각 어디서 처리되는지

관련 파일: `src/store/gameStore.ts`(`executeRebirth`), `src/data/balance.ts`
(`getRebirthConfig`, `getRebirthDiamondReward`), `src/systems/rebirth/rebirthBonus.ts`,
`balance/balance.xlsx`의 `RebirthTable`/`RebirthRewardTable` 시트

리버스를 눌렀을 때 스탯/숙련/존재력 트리를 각각 초기화할지 유지할지는
`RebirthTable`의 참/거짓(bool) 값 7개로 결정됩니다. 코드에 "리버스=이런 것"이라고
못 박혀 있는 게 아니라, 엑셀 값을 그대로 따릅니다.

| RebirthTable 칼럼 | 참이면 |
|---|---|
| `ResetStage` | 스테이지를 1로 되돌림 |
| `ResetStats` | 6스탯 레벨을 전부 0으로 |
| `ResetMastery` | 무기 숙련 레벨을 0으로 |
| `RefundGrowthEnergy` | 그동안 쓴 성장에너지를 전액 돌려줌 |
| `RefundGold` | 그동안 쓴 골드를 전액 돌려줌 |
| `RefundMasteryEssence` | 그동안 쓴 숙련의 정수를 전액 돌려줌 |
| `KeepExistTree` | 존재력 트리 해금 상태(노드 개수, 리버스·타임하이스트 해금 여부)를 초기화하지 않고 유지 |

무기 인벤토리(전부 소멸)와 유물 보유/슬롯(전부 초기화)은 이 bool 테이블에 속하지
않고 `executeRebirth` 안에서 항상 무조건 실행됩니다 — 옵션으로 켜고 끌 대상이
아니라는 설계입니다. 가챠 레벨·누적 뽑기 횟수는 항상 유지됩니다.

**"그동안 쓴 양"을 어떻게 아는가 — 누적 소비량 추적**: `gameStore.ts`의
`rebirthSpent` 상태가 그 역할을 합니다. 스탯을 올리거나(`upgradeStat`), 숙련을
올릴(`upgradeMastery`) 때마다 그때 든 비용을 `rebirthSpent`의 해당 항목에 계속
더해둡니다. 리버스를 실행하면 이 누적값만큼을 `RefundGrowthEnergy`/`RefundGold`/
`RefundMasteryEssence` 조건에 따라 재화에 돌려주고, `rebirthSpent`는 다시 0으로
리셋됩니다.

**다이아 지급 — 환급이 아니라 신규 지급**: 다이아는 `rebirthSpent`가 추적하지 않으므로
"돌려받을" 대상이 없습니다. 대신 별도 테이블 `RebirthRewardTable`이 도달 스테이지
구간별로 고정된 지급량을 정의해두고(예: 50~99스테이지 구간은 700), 리버스 시점의
도달 스테이지가 속한 구간의 값을 그대로 지급합니다(`balance.ts`의
`getRebirthDiamondReward`) — 다이아가 유일하게 요구하는 재화인 무기 가챠를, 리버스
없이는 아예 시도조차 할 수 없는 문제를 이걸로 해소합니다. 지수 공식이 아니라 구간별
고정값 테이블을 쓰는 이유는 기획자가 구간 경계와 값을 엑셀에서 직접, 예측 가능하게
조정할 수 있게 하기 위함입니다. 리버스 모달에서도 이 지급은 "환급" 섹션과 분리된
별도 "지급" 섹션에 표시되고, 다음 구간에 도달하면 얼마를 받는지도 함께 미리 보여줍니다
(환급 배율이 적용되는 대상이 아니라는 걸 시각적으로 구분하기 위함).

회차 보너스(`rebirthBonusPoint`, `rebirthBonus.ts`)는 이 환급 배율 자체를 키우는
별도 누적치입니다 — 도달 스테이지가 높을수록 이번 리버스로 얻는 포인트가 커지고,
누적 포인트가 많을수록 *다음* 리버스부터 환급 배율이 올라갑니다(이번 리버스 환급에는
반영되지 않음 — 순서가 그렇게 짜여 있습니다).

---

## 11. 타임 하이스트의 비용과 쿨타임 계산 (타임스탬프 기반)

관련 파일: `src/systems/timeheist/timeHeist.ts`, `src/store/gameStore.ts`
(`executeTimeHeist`), `balance/balance.xlsx`의 `TimeHeistTable` 시트

**비용**은 사용할 때마다 비싸집니다: `비용 = CostBase × CostGrowthRate ^ 사용횟수`.
사용횟수(`timeHeistUsedCount`)가 늘어날수록 지수적으로 오릅니다. 유물 중
`GOLD_GAIN` 효과가 활성화되어 있으면 타임 하이스트로 받는 골드 보상에도 똑같이
적용됩니다 — 유물 뽑기와 타임 하이스트는 시간에너지를 공유하는 소비처라, 한쪽에
많이 쓰면 다른 쪽 여유가 줄어드는 구조입니다.

**쿨타임 계산은 "지금부터 몇 초 남았다"를 직접 저장하지 않습니다.** 대신 딱 두 가지만
저장합니다: 지금까지 사용한 횟수(`timeHeistUsedCount`)와, 마지막으로 사용한 시각
(`timeHeistLastUsedAt`, 정확한 시각 값). 남은 쿨타임이 필요할 때마다
`timeHeistCooldownEndsAt(usedCount, lastUsedAt, 쿨타임감소%)` 함수가 "마지막 사용 시각 +
그때 기준 쿨타임 길이(유물의 `TIMEHEIST_COOLDOWN` 효과가 있으면 그만큼 단축)"로
쿨타임이 끝나는 정확한 시각을 계산하고, 그 값을 지금 시각과 비교합니다.

이렇게 절대 시각 기준으로 계산하는 이유는, 앱을 껐다 켜거나 브라우저를 오래 닫아뒀다
와도 정확하기 때문입니다 — 타이머를 돌리다가 앱이 꺼지면 멈춰버리는 방식이 아니라,
"몇 시 몇 분에 끝난다"는 사실 자체를 기준으로 계산하므로 언제 다시 켜서 확인하든
정확한 남은 시간이 나옵니다.

---

## 12. 세이브/로드가 언제 일어나고 무엇을 저장하는지

관련 파일: `src/store/gameStateStorage.ts`, `src/store/gameStore.ts`

**언제 저장되는가**: 재화가 바뀌거나, 전투에서 적 체력이 줄어들거나, 뭐가 됐든
게임 상태가 하나라도 바뀔 때마다 저장 "예약"이 걸립니다. 하지만 매번 그 순간 바로
저장하지는 않고, 마지막 변경 후 일정 시간(기본 2초, `CommonTable`의
`AutoSaveIntervalSec`로 조정 가능)이 지나면 그때 한 번에 실제로 저장합니다 — 전투가
1초에 여러 번 진행되는데 그때마다 저장하면 느려지기 때문입니다. 브라우저 탭을 닫거나
새로고침하기 직전에는 이 "예약된 저장"을 즉시 실행해서 최근 몇 초 안의 변경도
놓치지 않습니다.

이 "닫기/새로고침 직전 즉시 저장" 동작 때문에, 테스트용으로 `localStorage`를 직접
비운 뒤 새로고침하는 방식은 **믿을 수 없습니다** — 그 순간 살아있는 다른 탭이나
지금 페이지 자체가 가진 메모리상의 최신 상태를 다시 써버릴 수 있습니다. 개발 중
완전히 초기화하려면 `DevPanel`의 "전체 상태 초기화" 버튼(`disableAutosave()`로
예약된 저장을 먼저 끄고 → `clearGameState()` → 새로고침 순서)을 쓰거나, 콘솔에서
같은 순서를 직접 호출해야 합니다.

**무엇을 저장하는가**: 재화(6종), 6스탯 레벨, 무기 종류별 숙련 레벨, 존재력 트리
보너스, 현재 스테이지, 지금 싸우는 중인 적 상태, 존재력 트리 해금 개수, 리버스·
타임하이스트 해금 여부, 리버스 환급용 누적 소비량, 회차 보너스(누적 포인트/최고
도달 스테이지), 타임 하이스트 사용 횟수와 마지막 사용 시각, 무기 인벤토리와 장착
무기 ID, 무기 가챠 누적 뽑기 횟수·가챠 레벨, 유물 보유 목록과 슬롯 장착 상태,
그리고 "마지막 접속 시각"(오프라인 보상 계산용)입니다.

**언제 불러오는가**: 앱이 처음 켜질 때(브라우저 새로고침 포함) 저장된 값이 있으면
그 값으로 시작하고, 없으면 전부 기본값(레벨 0, 스테이지 1, 다이아는 `InitialDiamond`
등)으로 시작합니다. 저장 데이터의 "버전 번호"가 지금 코드가 기대하는 것과 다르면(예:
나중에 저장 구조가 바뀌면) 안전하게 무시하고 기본값으로 시작합니다 — 깨진 값으로
게임이 죽는 것을 막기 위함입니다.

---

## 13. 밸런싱 파이프라인의 데이터 흐름

관련 파일: `balance/balance.xlsx`, `scripts/build-balance.mjs`, `src/data/balance.json`,
`src/data/balance.ts`

```
balance/balance.xlsx          ← 기획자가 엑셀에서 직접 수치를 수정하는 원본
        │  (npm run balance 실행)
        ▼
scripts/build-balance.mjs     ← 엑셀을 읽어 검증(중복/오타/범위 밖 값 등)하고 변환
        ▼
src/data/balance.json         ← 변환 결과. 순수 데이터(테이블별 행 목록)
        │  (import)
        ▼
src/data/balance.ts           ← json을 타입이 붙은 형태로 감싸고, "이 스탯 정보 줘",
                                 "이 무기 등급 정보 줘" 같은 조회 함수(getStatConfig,
                                 getWeaponGradeConfig, getRelicConfig 등)를 제공
        │  (각 시스템이 이 함수들을 호출)
        ▼
data/stages.ts, data/stats.ts, data/mastery.ts, data/existTree.ts,
systems/weapon/weapon.ts, systems/relic/relic.ts, systems/timeheist/timeHeist.ts,
systems/battle/offlineReward.ts, store/gameStore.ts, store/gameStateStorage.ts …
        ▼
실제 게임 화면에 반영
```

`scripts/make-balance-xlsx.py`(별도 Python 스크립트)는 `balance.xlsx` 자체를
처음부터 다시 생성하는 용도입니다 — 새 테이블/컬럼/StringTable 항목을 추가할 때
이 스크립트를 고치고 실행해 엑셀을 재생성한 뒤, 위 파이프라인(`npm run balance`)을
한 번 더 돌려 `balance.json`에 반영합니다. 밸런스 수치 자체(기존 컬럼의 값)만
바꾸고 싶으면 스크립트를 건드릴 필요 없이 엑셀만 고치고 `npm run balance`(또는
`balance-commit.bat`)를 실행하면 됩니다. 절차와 주의사항은 `balance/README.md`에
자세히 정리되어 있습니다.

---

## 14. 전체 데이터 흐름 요약 (전투 → 재화 → 성장 → 전투)

게임의 핵심 순환 구조는 다음과 같습니다.

```
   ┌─────────────────────────────────────────────────────────┐
   │                                                           │
   ▼                                                           │
[전투 루프가 자동으로 공격]                                        │
   │  적을 처치하면 (보스는 시간에너지도 추가 지급)                     │
   ▼                                                           │
[재화 획득] 골드 / 성장에너지 / 존재력 (+보스만 시간에너지)              │
   │                                                           │
   ▼                                                           │
[성장] 재화로 6스탯을 올리거나, 무기를 강화(레벨업/돌파/합성)하거나,      │
   │  무기 종류별 숙련을 올리거나, 존재력 트리 노드를 해금(영구 보너스 +   │
   │  4티어에서 숙련의 정수 획득)함                                  │
   ▼                                                           │
[전투 스탯이 강해짐] (gameStore의 stats가 다시 계산됨)                 │
   │                                                           │
   └──────────── 다음 전투는 더 빠르고 강하게 진행됨 ──────────────────┘
```

여기에 다섯 가지 "곁가지 순환"이 더해집니다.

- **리버스**: 스테이지·스탯·숙련을 초기화하고 무기·유물을 소멸/초기화하는 대신,
  그동안 쓴 재화를 전액 돌려받고 도달 스테이지에 비례한 다이아를 새로 지급받아
  존재력 트리로 강해진 상태로 처음부터 다시 빠르게 성장합니다.
- **타임 하이스트**: 시간에너지를 소비해서 지금보다 앞선 스테이지의 보상을 미리
  당겨 받습니다 — 실제로 그 스테이지까지 진행하지 않고도 재화만 먼저 얻습니다.
- **무기 가챠**: 다이아(초기 지급 + 리버스 지급)를 소비해 무기를 뽑고, 보유/장착
  효과와 숙련 배율로 전투 스탯을 끌어올립니다.
- **유물 뽑기**: 시간에너지를 소비해 유물을 뽑고, 슬롯(존재력 트리 진행도에 연동)에
  꽂아 스탯형/특수효과형 효과를 얻습니다.
- **오프라인 보상**: 앱을 꺼둔 시간 동안도 전투가 계속됐다고 가정하고, 다시 켰을 때
  그 시간만큼의 재화를 한 번에 지급합니다(최대 인정 시간 있음).

이 다섯 가지 모두 결국 "재화를 더 벌어서 성장에 다시 투입한다"는 같은 순환으로
합류합니다.
