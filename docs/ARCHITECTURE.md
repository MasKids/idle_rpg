# 아키텍처 문서

이 문서는 "시간 기반 방치형 RPG" 프로토타입이 지금까지 어떻게 구현되어 있는지 설명합니다.
코드를 몰라도 게임이 내부적으로 어떻게 돌아가는지 이해할 수 있도록, 각 시스템이 "무엇을
하는지"와 "그걸 어느 파일이 담당하는지"를 함께 적었습니다.

---

## 1. 폴더 구조와 각 폴더의 역할

```
src/
  App.tsx              화면 전체를 조립하는 최상위 컴포넌트. 어떤 탭이 열려있는지,
                        어떤 모달이 떠있는지를 여기서 관리한다.
  main.tsx             앱의 진입점 (React를 브라우저 화면에 붙이는 코드).

  components/          화면 어디서나 쓰는 공용 UI.
                        - BattleArea.tsx: 상단 전투 화면 + 재화 표시
                        - ControlArea.tsx: 하단 탭 내용이 바뀌는 영역
                        - BottomMenu.tsx: 하단 메뉴바
                        - StageInfoModal.tsx: 스테이지 정보 팝업
                        - DevPanel.tsx: 개발자 전용 테스트 도구 (배포 빌드에는 안 들어감)

  data/                "게임 규칙을 계산하는 함수"들이 모인 곳. 여기 있는 함수들은
                        전부 balance.ts(6번 항목 참고)에서 수치를 가져와 계산만 한다 —
                        숫자를 직접 코드에 적어두지 않는다.
                        - balance.ts / balance.json: 엑셀 밸런싱 데이터 (9번 항목 참고)
                        - stages.ts: 스테이지별 적 능력치/보상 계산
                        - stats.ts: 6스탯 레벨업 비용/효과 계산
                        - equipment.ts: 장비 강화, 무기 숙련 계산
                        - existTree.ts: 존재력 트리 50노드 생성 (4번 항목 참고)

  store/                게임 전체 상태(재화, 레벨, 진행도 등)를 담는 곳.
                        - gameStore.ts: 상태 그 자체와, 상태를 바꾸는 모든 함수 (2번 항목 참고)
                        - gameStateStorage.ts: localStorage에 저장/불러오기 (8번 항목 참고)

  systems/              기능 단위로 묶은 폴더. 폴더 하나가 게임 시스템 하나에 대응한다.
                        - battle/: 전투 루프, 데미지 계산, 오프라인 보상
                        - growth/: 6스탯 성장 화면
                        - equipment/: 장비/무기숙련 화면
                        - exist/: 존재력 트리 화면
                        - rebirth/: 리버스(환생) 확인 모달
                        - timeheist/: 타임 하이스트 계산 + 화면

  types/game.ts          TypeScript 타입 정의만 모아둔 파일. 재화 종류, 스탯 종류 같은
                        "이 게임에 어떤 값들이 있는지"의 목록이 여기 있다.

  utils/                숫자를 "1.2K" 처럼 축약하거나, 초를 "1:23:45"로 바꾸는 등
                        여러 화면에서 공통으로 쓰는 잡다한 도구 함수.

balance/                밸런싱 엑셀 원본. 자세한 내용은 balance/README.md와
                        이 문서의 9번 항목 참고.
scripts/                엑셀 ↔ 코드를 연결하는 스크립트 (npm run balance 등).
docs/                  지금 읽고 있는 이 문서.
```

---

## 2. `gameStore.ts`의 상태 목록

게임이 "지금 어떤 상태인지"는 전부 `src/store/gameStore.ts` 한 곳에 모여 있습니다. 이걸
[Zustand](https://github.com/pmndrs/zustand)라는 상태관리 라이브러리로 관리하는데, 쉽게
말하면 "게임 전체가 공유해서 보는 큰 칠판" 같은 것입니다. 화면 어디서든 이 칠판의 값을
읽거나 정해진 방법으로만 고칠 수 있습니다.

| 상태 | 담당하는 것 |
|---|---|
| `currencies` | 5종 재화(존재력/성장에너지/시간에너지/골드/정수) 보유량 |
| `statLevels` | 6스탯 각각의 성장 레벨 (리버스 시 초기화 대상) |
| `equipmentLevels` | 장비 5부위 각각의 강화 레벨 |
| `masteryLevels` | 무기 숙련 레벨 (무기 하나당 레벨 하나) |
| `existTreeStatBonus` | 존재력 트리를 해금하며 누적된 "영구" 스탯 보너스. 리버스해도 보통 유지됨 |
| `stats` | 위 네 가지를 전부 합산한 "최종 전투 스탯". 아무거나 하나라도 바뀌면 즉시 다시 계산됨 |
| `currentStage` | 지금 몇 스테이지인지 |
| `battle` | 지금 싸우는 중인 적의 상태 (최대체력/현재체력/보스 여부/처치 수/필요 처치 수) |
| `lastHit` | 가장 최근 공격 결과 한 건. 화면에 데미지 숫자를 띄우는 연출용일 뿐, 전투 자체는 이 값과 무관하게 계속 진행됨 (3번 항목 참고) |
| `unlockedCount` | 존재력 트리에서 지금까지 해금한 노드 개수 (0~50) |
| `specialUnlocks` | 리버스 / 타임 하이스트를 각각 해금했는지 여부 |
| `rebirthSpent` | 이번 회차에 소비한 성장에너지·골드·정수의 누적량. 리버스 환급 계산에 쓰임 (6번 항목 참고) |
| `timeHeistUsedCount` | 타임 하이스트를 지금까지 사용한 누적 횟수 |
| `timeHeistLastUsedAt` | 타임 하이스트를 마지막으로 사용한 시각. 쿨타임 계산의 기준 (7번 항목 참고) |
| `offlineReward` | 오프라인 보상 미리보기 내용. 플레이어가 "받기"를 누르기 전까지만 존재하고, 받으면 `null`이 됨 |

이 상태들을 바꾸는 함수(`upgradeStat`, `executeRebirth`, `executeTimeHeist` 등)도 전부
같은 파일 안에 정의되어 있습니다. 화면(버튼 클릭 등)은 이 함수를 호출할 뿐, 값을 직접
바꾸지 않습니다.

---

## 3. 전투 루프가 어디서 어떻게 도는지 (탭을 이동해도 유지되는 구조)

관련 파일: `src/systems/battle/battleLoop.ts`, `src/systems/battle/useBattleLoop.ts`,
`src/App.tsx`

전투는 "화면에 전투 장면이 보이고 있어야만 진행되는" 방식이 아닙니다. **전투 시뮬레이션
자체는 화면과 완전히 분리되어 있고, 앱이 켜져 있는 한 항상 돕니다.**

- `battleLoop.ts`는 React 컴포넌트가 아닌 일반 함수입니다. `setTimeout`으로 스스로를
  반복 호출하면서 "공격 → 데미지 계산 → 적 체력 감소 → 죽으면 보상 지급하고 다음 적"을
  계속 반복합니다. 다음 공격까지 걸리는 시간은 매번 최신 공격속도(ASPD)로 다시 계산합니다.
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
시트에 **5개 행(5티어 × 10노드)** 만 정의해두고, 코드가 그 계수로 50개를 계산해서
만들어냅니다.

`ExistTreeTable`의 한 행(티어)은 이런 정보를 담고 있습니다: 이 티어가 몇 번 노드부터
몇 번 노드까지인지(`OrderFrom`~`OrderTo`), 이 티어의 효과가 스탯 상승인지 재화 지급인지,
노드 하나당 비용/효과가 기준값에서 얼마씩 늘어나는지.

`generateExistTree()` 함수(`existTree.ts`)가 1번부터 50번까지 순서대로 돌면서, 각
노드 번호가 어느 티어에 속하는지 찾은 뒤(`getExistTreeTier`, `balance.ts`) 그 티어의
계수로 노드 하나하나의 비용과 효과를 계산합니다.

**해금 판정 로직**은 아주 단순합니다 (`existNodeStatus` 함수):
- 이미 해금한 노드 번호(`unlockedCount`) 이하 → **해금됨**
- 바로 다음 번호(`unlockedCount + 1`) → **해금 가능** (지금 누를 수 있는 노드)
- 그보다 뒤 → **잠김**

즉 노드는 반드시 1번부터 순서대로만 해금할 수 있고, 건너뛰거나 갈라지는 분기가 없습니다.

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

## 6. 리버스 실행 시 초기화/유지/환급이 각각 어디서 처리되는지

관련 파일: `src/store/gameStore.ts`(`executeRebirth`), `src/data/balance.ts`
(`getRebirthConfig`), `balance/balance.xlsx`의 `RebirthTable` 시트

리버스를 눌렀을 때 정확히 무엇을 초기화하고, 무엇을 유지하고, 무엇을 돌려주는지는
전부 `RebirthTable`의 참/거짓(bool) 값 8개로 결정됩니다. 코드에 "리버스=이런 것"이라고
못 박혀 있는 게 아니라, 엑셀 값을 그대로 따릅니다.

| RebirthTable 칼럼 | 참이면 |
|---|---|
| `ResetStage` | 스테이지를 1로 되돌림 |
| `ResetStats` | 6스탯 레벨을 전부 0으로 |
| `ResetEquipment` | 장비 5부위 강화 레벨을 전부 0으로 |
| `ResetMastery` | 무기 숙련 레벨을 0으로 |
| `RefundGrowthEnergy` | 그동안 쓴 성장에너지를 전액 돌려줌 |
| `RefundGold` | 그동안 쓴 골드를 전액 돌려줌 |
| `RefundMasteryEssence` | 그동안 쓴 정수를 전액 돌려줌 |
| `KeepExistTree` | 존재력 트리 해금 상태(노드 개수, 리버스·타임하이스트 해금 여부)를 초기화하지 않고 유지 |

**"그동안 쓴 양"을 어떻게 아는가 — 누적 소비량 추적**: `gameStore.ts`의
`rebirthSpent` 상태가 그 역할을 합니다. 스탯을 올리거나(`upgradeStat`), 장비를
강화하거나(`upgradeEquipment`), 숙련을 올릴(`upgradeMastery`) 때마다 그때 든 비용을
`rebirthSpent`의 해당 항목에 계속 더해둡니다. 리버스를 실행하면 이 누적값만큼을
`RefundGrowthEnergy`/`RefundGold`/`RefundMasteryEssence` 조건에 따라 재화에 돌려주고,
`rebirthSpent`는 다시 0으로 리셋됩니다 — 즉 "이번 회차에 쓴 금액표"를 계속 들고 있다가
리버스 시점에 정산하는 방식입니다.

---

## 7. 타임 하이스트의 비용과 쿨타임 계산 (타임스탬프 기반)

관련 파일: `src/systems/timeheist/timeHeist.ts`, `src/store/gameStore.ts`
(`executeTimeHeist`), `balance/balance.xlsx`의 `TimeHeistTable` 시트

**비용**은 사용할 때마다 비싸집니다: `비용 = CostBase × CostGrowthRate ^ 사용횟수`.
사용횟수(`timeHeistUsedCount`)가 늘어날수록 지수적으로 오릅니다.

**쿨타임 계산은 "지금부터 몇 초 남았다"를 직접 저장하지 않습니다.** 대신 딱 두 가지만
저장합니다: 지금까지 사용한 횟수(`timeHeistUsedCount`)와, 마지막으로 사용한 시각
(`timeHeistLastUsedAt`, 정확한 시각 값). 남은 쿨타임이 필요할 때마다
`timeHeistCooldownEndsAt(usedCount, lastUsedAt)` 함수가 "마지막 사용 시각 + 그때
기준 쿨타임 길이"로 쿨타임이 끝나는 정확한 시각을 계산하고, 그 값을 지금 시각과
비교합니다.

이렇게 절대 시각 기준으로 계산하는 이유는, 앱을 껐다 켜거나 브라우저를 오래 닫아뒀다
와도 정확하기 때문입니다 — 타이머를 돌리다가 앱이 꺼지면 멈춰버리는 방식이 아니라,
"몇 시 몇 분에 끝난다"는 사실 자체를 기준으로 계산하므로 언제 다시 켜서 확인하든
정확한 남은 시간이 나옵니다.

---

## 8. 세이브/로드가 언제 일어나고 무엇을 저장하는지

관련 파일: `src/store/gameStateStorage.ts`, `src/store/gameStore.ts`

**언제 저장되는가**: 재화가 바뀌거나, 전투에서 적 체력이 줄어들거나, 뭐가 됐든
게임 상태가 하나라도 바뀔 때마다 저장 "예약"이 걸립니다. 하지만 매번 그 순간 바로
저장하지는 않고, 마지막 변경 후 일정 시간(기본 2초, `CommonTable`의
`AutoSaveIntervalSec`로 조정 가능)이 지나면 그때 한 번에 실제로 저장합니다 — 전투가
1초에 여러 번 진행되는데 그때마다 저장하면 느려지기 때문입니다. 브라우저 탭을 닫거나
새로고침하기 직전에는 이 "예약된 저장"을 즉시 실행해서 최근 몇 초 안의 변경도
놓치지 않습니다.

**무엇을 저장하는가**: 재화, 6스탯 레벨, 장비 레벨, 숙련 레벨, 존재력 트리 보너스,
현재 스테이지, 지금 싸우는 중인 적 상태, 존재력 트리 해금 개수, 리버스·타임하이스트
해금 여부, 리버스 환급용 누적 소비량, 타임 하이스트 사용 횟수와 마지막 사용 시각,
그리고 "마지막 접속 시각"(오프라인 보상 계산용) 입니다.

**언제 불러오는가**: 앱이 처음 켜질 때(브라우저 새로고침 포함) 저장된 값이 있으면
그 값으로 시작하고, 없으면 전부 기본값(레벨 0, 스테이지 1 등)으로 시작합니다. 저장
데이터의 "버전 번호"가 지금 코드가 기대하는 것과 다르면(예: 나중에 저장 구조가 바뀌면)
안전하게 무시하고 기본값으로 시작합니다 — 깨진 값으로 게임이 죽는 것을 막기 위함입니다.

---

## 9. 밸런싱 파이프라인의 데이터 흐름

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
                                 "이 스테이지 정보 줘" 같은 조회 함수(getStatConfig,
                                 getStageConfig 등)를 제공
        │  (각 시스템이 이 함수들을 호출)
        ▼
data/stages.ts, data/stats.ts, data/equipment.ts, data/existTree.ts,
systems/timeheist/timeHeist.ts, systems/battle/offlineReward.ts,
store/gameStore.ts, store/gameStateStorage.ts …
        ▼
실제 게임 화면에 반영
```

즉 밸런스 수치를 바꾸고 싶으면 코드를 건드릴 필요 없이 엑셀만 고치고
`npm run balance`(또는 `balance-commit.bat`)를 실행하면 됩니다. 절차와 주의사항은
`balance/README.md`에 자세히 정리되어 있습니다.

---

## 10. 전체 데이터 흐름 요약 (전투 → 재화 → 성장 → 전투)

게임의 핵심 순환 구조는 다음과 같습니다.

```
   ┌─────────────────────────────────────────────────────────┐
   │                                                           │
   ▼                                                           │
[전투 루프가 자동으로 공격]                                        │
   │  적을 처치하면                                              │
   ▼                                                           │
[재화 획득] 골드 / 성장에너지 / 존재력 (+가끔 시간에너지)                │
   │                                                           │
   ▼                                                           │
[성장] 플레이어가 재화로 스탯을 올리거나 장비를 강화하거나 숙련을 올림      │
   │  (또는 존재력 트리 노드를 해금해 영구 보너스를 얻음)                  │
   ▼                                                           │
[전투 스탯이 강해짐] (gameStore의 stats가 다시 계산됨)                 │
   │                                                           │
   └──────────── 다음 전투는 더 빠르고 강하게 진행됨 ──────────────────┘
```

여기에 세 가지 "곁가지 순환"이 더해집니다.

- **리버스**: 스테이지·스탯·장비·숙련을 초기화하는 대신 그동안 쓴 재화를 전액 돌려받아,
  존재력 트리로 강해진 상태로 처음부터 다시 빠르게 성장합니다.
- **타임 하이스트**: 시간에너지를 소비해서 지금보다 앞선 스테이지의 보상을 미리
  당겨 받습니다 — 실제로 그 스테이지까지 진행하지 않고도 재화만 먼저 얻습니다.
- **오프라인 보상**: 앱을 꺼둔 시간 동안도 전투가 계속됐다고 가정하고, 다시 켰을 때
  그 시간만큼의 재화를 한 번에 지급합니다 (최대 인정 시간 있음).

이 세 가지 모두 결국 "재화를 더 벌어서 성장에 다시 투입한다"는 같은 순환으로
합류합니다.
