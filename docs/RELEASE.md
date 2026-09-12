# 릴리스 발행 절차

이 프로젝트는 포트폴리오용 프로토타입이라 릴리스가 "새 버전을 배포한다"는 의미는
아니다 — 배포 자체는 Vercel이 `main` 브랜치 push마다 자동으로 한다(아래 참고).
여기서 말하는 릴리스는 **"이 시점까지의 변경사항을 정리해서 기록에 남기는 것"**이
목적이다.

## 1. 절차

1. **CHANGELOG.md 갱신** — `[Unreleased]` 섹션에 그동안 쌓인 항목들이 잘 정리돼
   있는지 확인한다(작업할 때마다 추가해왔다면 이 시점엔 다듬기만 하면 된다 —
   CLAUDE.md "변경 이력 관리" 참고). `[Unreleased]`의 내용을 새 버전 섹션
   (`## [vX.Y.Z] - YYYY-MM-DD`)으로 옮기고, `[Unreleased]`는 다시 빈 상태로
   되돌린다.
2. **버전 번호 결정** — CLAUDE.md "버전 규칙" 참고(큰 기능/개편은 X 올림, 버그
   수정·밸런싱은 Y 올림, 앞자리는 프로토타입 기간 내내 0 유지).
3. **SAVE_VERSION 올리기 (필수, 절대 생략 금지)** — 아래 3절 참고. 구조 변경
   여부와 무관하게 **버전을 올릴 때는 항상** 세이브를 초기화한다.
   ```bash
   node scripts/bump-save-version.mjs vX.Y.Z "한 줄 사유(CHANGELOG 요약이면 충분)"
   ```
   이 스크립트가 `src/store/gameStateStorage.ts`의 `SAVE_VERSION`을 1 올리고
   이력 주석을 자동으로 추가한다 — 잊기 쉬운 수동 상수 수정 대신 릴리스 절차의
   기계적인 한 단계로 만든 것. 빠뜨리면 이번 릴리스로 넘어온 플레이어가 깨진
   구세이브를 그대로 이어받을 수 있으니, 4단계 커밋에 이 변경도 함께 포함한다.
4. **커밋 + 태그 생성** — CHANGELOG.md와 `gameStateStorage.ts` 갱신을 함께
   커밋한 뒤, 그 커밋에 `vX.Y.Z` 태그를 붙인다.
   ```bash
   git add CHANGELOG.md src/store/gameStateStorage.ts
   git commit -m "chore: prepare vX.Y.Z release"
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin main --tags
   ```
5. **GitHub 릴리스 발행** — 아래 2절 참고(gh CLI 또는 웹).

## 2. GitHub 릴리스 발행 — 두 가지 방법

### gh CLI 사용

```bash
gh release create vX.Y.Z --title "vX.Y.Z - 릴리스 제목" --notes-file -
```
(`--notes-file -`는 표준입력으로 노트를 받는다 — CHANGELOG.md의 해당 버전 섹션을
그대로 붙여넣거나 파이프로 흘려보내면 된다. 파일로 미리 저장해뒀다면
`--notes-file CHANGELOG_vX.Y.Z.md`처럼 경로를 직접 줘도 된다.)

`gh`가 없다면 설치 후 `gh auth login`으로 GitHub 계정 인증이 먼저 필요하다.
- Windows: `winget install --id GitHub.cli`
- macOS: `brew install gh`
- 기타: https://cli.github.com/ 참고

### 웹에서 발행

1. 태그까지는 위 1절 4단계처럼 로컬에서 만들어 push해둔다(`git push origin
   main --tags`) — 웹 화면에서도 새 태그를 직접 만들 수 있지만, 로컬에서 만들어
   둔 태그를 그대로 쓰는 쪽이 실수(다른 커밋에 태그가 붙는 등)가 적다.
2. GitHub 저장소 페이지 → **Releases** → **Draft a new release**.
3. **Choose a tag**에서 방금 push한 `vX.Y.Z` 태그를 선택.
4. **Release title**에 `vX.Y.Z - 릴리스 제목` 입력.
5. **Describe this release**에 CHANGELOG.md의 해당 버전 섹션 내용을 그대로
   붙여넣는다.
6. **Publish release** 클릭.

## 3. 세이브 버전을 올려야 하는 경우

릴리스 버전(`vX.Y.Z`, git 태그)과 **세이브 버전**(`src/store/gameStateStorage.ts`의
`SAVE_VERSION` 상수)은 서로 다른 숫자이고 완전히 별개로 관리한다. 세이브 버전은
"기존에 저장된 localStorage 데이터를 계속 믿고 불러올지"를 가르는 스위치다 —
버전이 다르면 마이그레이션 없이 그냥 저장 안 된 것처럼 취급하고 처음부터
시작한다(현재 정책, `gameStateStorage.ts` 주석 참고).

**규칙은 단순하다 — 버전(`vX.Y.0` 또는 `vX.Y.Z`)을 올릴 때는 예외 없이 항상
`SAVE_VERSION`도 함께 올린다.** `GameSaveState` 구조가 실제로 바뀌었는지는
따지지 않는다. 프로토타입 단계에서는 마이그레이션을 작성하지 않고 매 릴리스를
깨끗한 상태에서 시작하는 쪽을 원칙으로 삼기로 했기 때문이다 — 판단 기준을 두면
(예전엔 "필드 구조가 바뀌었을 때만") 애매한 경계 케이스에서 빠뜨리기 쉽고,
실제로 이전에 이 판단을 잘못 적용한 사례(밸런스 수치만 바뀐 v0.2.0)도 있었다.
"버전을 올렸는데 세이브 버전을 안 올렸다"가 나올 수 없는 구조가 "구조가 바뀐
경우만 올린다"는 판단보다 안전하다.

실행은 1절 3단계에 있는 `scripts/bump-save-version.mjs`로 한다 — 상수
값을 손으로 고치지 않는다(고치는 걸 깜빡하기 쉬운 지점이라 스크립트로 만들었다).

`SAVE_VERSION`을 올리면 그 배포 이후 접속하는 모든 플레이어의 기존 진행 상황이
초기화된다. 이 사실은 CHANGELOG.md 최상단에 한 번, 인게임 패치노트 화면에도
고정 배너로 한 번만 안내한다(`PatchNoteModal.tsx`) — 매 버전 항목에 개별로 다시
쓰지 않는다(어차피 항상 일어나는 일이라 반복은 소음이 될 뿐이고, 반복해서 쓰는
쪽이 오히려 빠뜨리기 쉽다).

## 4. Vercel 자동 배포와의 관계

`main` 브랜치에 push되면 Vercel이 그 즉시 자동으로 새 빌드를 배포한다(별도
릴리스 액션 없이도 배포는 이미 끝나 있다). 그래서 이 문서의 "릴리스 발행"은
**배포 트리거가 아니라 기록용 스냅샷**이다 — "이 태그 시점에 사이트가 이런
상태였다"를 나중에 되짚어볼 수 있게 표시해두는 것. 순서상 실제 배포(Vercel)가
항상 릴리스 발행보다 먼저(또는 동시에) 일어난다.
