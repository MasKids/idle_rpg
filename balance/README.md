# 밸런싱 데이터 파이프라인

게임의 모든 밸런싱 수치는 `balance/balance.xlsx` 한 파일에서 관리합니다. 코드를 건드리지
않고 엑셀만 고쳐서 게임 밸런스를 조정할 수 있습니다.

`#TableDefine` 시트에 전체 테이블/칼럼 명세가, `#EnumDefine` 시트에 enum 값 정의가 있으니
칼럼 하나가 정확히 뭘 뜻하는지 헷갈리면 그 두 시트를 먼저 보세요.

## 수정 절차

1. `balance/balance.xlsx`를 엑셀(또는 호환 프로그램)로 엽니다.
2. 바꾸고 싶은 시트를 고르고, **4행 헤더 아래 데이터 행의 값만** 수정합니다.
3. 저장하고 **엑셀 프로그램을 완전히 닫습니다.**
   (엑셀이 파일을 잠그고 있으면 다음 단계에서 읽기에 실패합니다.)
4. 터미널에서 실행합니다.
   ```bash
   npm run balance
   ```
5. 콘솔 출력을 확인합니다.
   - 시트별로 몇 행을 읽었는지
   - 이전 값과 달라진 항목이 있으면 `테이블#Id.칼럼: 이전값 → 새값` 형태로 목록 출력
   - 검증 경고가 있으면 목록으로 출력 (에러는 아니지만 확인해볼 만한 것들)
   - **Id 중복 / 숫자가 아닌 int·float / #EnumDefine에 없는 enum 값 / 존재하지 않는 Id를
     참조하는 값** 중 하나라도 있으면 **어느 시트, 몇 번째 행, 어느 칼럼**인지 정확히 알려주고
     `src/data/balance.json`은 갱신되지 않은 채(에러) 중단됩니다. 엑셀에서 해당 위치를 고친 뒤
     다시 `npm run balance`를 실행하세요.
6. 브라우저를 새로고침해 원하는 대로 반영됐는지 확인합니다 (`npm run dev`가 이미 떠 있다면
   그냥 새로고침, 안 떠 있다면 먼저 실행).
7. 문제 없으면 `balance/balance.xlsx`와 갱신된 `src/data/balance.json`을 함께 커밋합니다.

## 시트 구조 (4행 헤더)

`#TableDefine`, `#EnumDefine`을 제외한 모든 데이터 시트는 4행 헤더 + 5행부터 데이터입니다.

| 행 | 내용 | 비고 |
|---|---|---|
| 1행 | 참조 정보 | 다른 테이블을 참조하는 칼럼만 `TableName/Id` 또는 `EnumDefine/그룹명` 표기. 나머지는 빈 칸 |
| 2행 | 한글 칼럼명 | 사람이 읽는 용도. 파싱 시 무시 |
| 3행 | 자료형 | int / float / string / enum / bool 중 하나 |
| 4행 | **영문 칼럼명** | **코드가 실제로 참조하는 키. 절대 수정 금지** |
| 5행~ | 데이터 | 이 부분만 수정 |

### `//` 접두사 규칙

4행 칼럼명이 `//`로 시작하면(`//Name`, `//Description`, `//Category` 등) **기획자가 읽으라고
남겨둔 참고용 칼럼**이라는 뜻입니다. `npm run balance`가 이 칼럼은 통째로 건너뛰고
`src/data/balance.json`에 넣지 않습니다. 자유롭게 메모를 남겨도 게임 동작에 영향 없습니다.

### 자료형별 빈 칸 처리

| 자료형 | 값이 비어있을 때 |
|---|---|
| int / float | 0 |
| string / enum | 빈 문자열 |
| bool | false |

## 검증 규칙

- **같은 테이블 안에서 Id 중복 불가** — Id는 그 테이블 안에서 유일해야 다른 테이블이나
  코드가 정확히 참조할 수 있습니다.
- **int/float 칼럼에 숫자가 아닌 값 불가.**
- **enum 칼럼의 값은 반드시 `#EnumDefine`에 정의된 값이어야 함** — 1행에
  `EnumDefine/그룹명`이 적힌 칼럼이 대상입니다.
- **`TableName/Id` 참조 칼럼의 값은 그 테이블에 실제로 존재하는 Id여야 함** — 예를 들어
  StatTable의 `Name` 칼럼(1행에 `StringTable/Id`)에 40001을 적었다면 StringTable에
  Id=40001인 행이 반드시 있어야 합니다. 값 0이나 빈 칸은 "참조 없음"으로 취급해 검증하지
  않습니다.

## 새 칼럼/테이블 추가하기

**새 칼럼 추가**
1. 해당 시트에 열을 하나 추가하고, 1~4행에 참조정보/한글명/자료형/영문칼럼명을 채웁니다.
2. 5행부터 각 데이터 행에 값을 채웁니다 (비워두면 자료형별 기본값으로 처리됨).
3. `src/data/balance.ts`의 해당 테이블 인터페이스(`XxxTableRow`)에 새 필드를 추가합니다.
4. 필요하면 `#TableDefine`에도 새 칼럼을 한 줄 추가해 문서화합니다.
5. `npm run balance` → 게임 코드에서 `getXxxConfig(...).새필드`로 사용.

**새 테이블 추가**
1. 새 시트를 만들고 위 "시트 구조(4행 헤더)"를 그대로 따릅니다. 시트명이 `#`으로 시작하면
   안 됩니다(제외 대상).
2. `scripts/build-balance.mjs`는 `#`으로 시작하지 않는 시트를 전부 자동으로 읽으므로,
   이 스크립트 자체는 수정할 필요가 보통 없습니다.
3. `src/data/balance.ts`에 그 테이블용 `XxxTableRow` 인터페이스와, 필요하면 조회 헬퍼
   함수(`getXxxConfig` 등)를 추가합니다.
4. `#TableDefine`에 새 테이블의 칼럼들을 문서화합니다.

**새 enum 그룹 추가**
1. `#EnumDefine`에 그룹명/한글 라벨/영문 라벨/사용처 행을 추가합니다.
2. 해당 enum을 쓰는 칼럼의 1행에 `EnumDefine/그룹명`을 적습니다.
3. `src/data/balance.ts`에 TypeScript 유니온 타입(`export type XxxEnum = 'A' | 'B' | ...`)을
   추가/갱신합니다.

## 주의사항

- **4행(영문 칼럼명)은 절대 수정하지 마세요.** 코드가 이 문자열로 값을 찾아 읽습니다.
- **시트 이름도 바꾸지 마세요.** `scripts/build-balance.mjs`가 시트 이름으로 테이블을
  구분합니다 (`#`으로 시작하는 시트는 자동으로 제외됩니다).
- `npm run balance`를 실행하기 전에 **엑셀 파일을 꼭 닫아주세요.** 열려 있으면
  "파일을 열 수 없습니다" 에러가 납니다.
- 1~3행(참조정보/한글명/자료형)과 `//` 칼럼들은 참고용입니다. 게임 동작에는 영향을
  주지 않으니 자유롭게 메모를 남겨도 됩니다.
- `src/data/balance.json`은 `balance.xlsx`로부터 자동 생성되는 빌드 산출물입니다.
  이 파일을 직접 수정하지 말고, 항상 엑셀 → `npm run balance`를 거치세요.
  (git에는 xlsx와 json을 둘 다 커밋합니다 — json이 있어야 앱이 바로 실행됩니다.)
- `src/data/balance.ts`의 조회 헬퍼(`getStatConfig` 등)는 해당하는 행을 못 찾으면 게임을
  멈추지 않고 콘솔 경고 + 안전한 기본값으로 대체합니다. 브라우저 콘솔에
  `[balance] ... 기본값을 사용합니다` 경고가 보이면 엑셀 데이터를 확인하세요.

## 파일 구성

- `balance/balance.xlsx` — 사람이 수정하는 원본.
  `#TableDefine`(전체 칼럼 명세) / `#EnumDefine`(enum 정의) / StageTable / StatTable /
  ExistTreeTable / FeatureUnlockTable / EquipmentTable / MasteryTable / TimeHeistTable /
  RebirthTable / CommonTable / StringTable, 총 12시트.
- `scripts/build-balance.mjs` — `balance.xlsx` → `src/data/balance.json` 변환 스크립트
  (`npm run balance`). ExcelJS로 읽고, Id 중복/자료형/enum/참조 무결성을 검증합니다.
- `scripts/make-balance-xlsx.py` — `balance.xlsx`가 없을 때(또는 완전히 새로 만들고 싶을 때)
  처음부터 다시 생성하는 스크립트(openpyxl 필요). 평소에는 쓸 일이 없습니다.
- `src/data/balance.json` — 빌드 산출물. 게임이 실제로 읽는 파일.
- `src/data/balance.ts` — `balance.json`을 테이블별 타입이 붙은 배열로 노출하고,
  `getStatConfig` / `getStageConfig` / `getExistTreeTier` / `getFeatureUnlock` /
  `getEquipmentConfig` / `getMasteryConfig` / `getTimeHeistConfig` / `getRebirthConfig` /
  `getCommon` / `getString` 조회 헬퍼를 제공합니다. 게임의 모든 시스템은 이 함수들을 통해서만
  밸런싱 수치를 읽습니다 — 코드에 숫자를 직접 적지 않습니다.
