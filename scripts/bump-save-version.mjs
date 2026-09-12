// 릴리스 절차의 "SAVE_VERSION 올리기" 단계를 위한 도구 — docs/RELEASE.md 1절
// 3단계에서 호출한다. 버전을 올릴 때는 구조 변경 여부와 무관하게 항상
// SAVE_VERSION도 함께 올리기로 했으므로(RELEASE.md 3절), 손으로 상수를 고치다
// 깜빡하는 사고를 막기 위해 기계적인 스크립트로 만들었다.
//
// src/store/gameStateStorage.ts의 `const SAVE_VERSION = N` 줄을 찾아 N+1로 올리고,
// 바로 위에 "vX.Y.Z에서 N→N+1: <사유>" 이력 주석을 한 줄 추가한다.
//
// 사용법: node scripts/bump-save-version.mjs <릴리스 버전(vX.Y.Z)> <사유>
// 예:     node scripts/bump-save-version.mjs v0.4.0 "몬스터 스프라이트/로고 추가"

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TARGET_PATH = resolve(__dirname, '../src/store/gameStateStorage.ts')
const CONST_PATTERN = /^const SAVE_VERSION = (\d+)$/m

function fail(message) {
  console.error(`[bump-save-version] 오류: ${message}`)
  process.exit(1)
}

const [, , releaseVersion, reason] = process.argv
if (!releaseVersion || !reason) {
  fail('사용법: node scripts/bump-save-version.mjs <릴리스 버전(vX.Y.Z)> <사유>')
}
if (!/^v\d+\.\d+\.\d+$/.test(releaseVersion)) {
  fail(`릴리스 버전 형식이 vX.Y.Z가 아닙니다: ${releaseVersion}`)
}

const source = readFileSync(TARGET_PATH, 'utf8')
const match = source.match(CONST_PATTERN)
if (!match) fail(`SAVE_VERSION 상수를 찾지 못했습니다: ${TARGET_PATH}`)

const current = Number(match[1])
const next = current + 1
const historyLine = `// ${releaseVersion}에서 ${current}→${next}: ${reason}`
const constLine = `const SAVE_VERSION = ${next}`

const updated = source.replace(CONST_PATTERN, `${historyLine}\n${constLine}`)
writeFileSync(TARGET_PATH, updated)

console.log(`[bump-save-version] SAVE_VERSION ${current} → ${next} (${releaseVersion})`)
console.log(`[bump-save-version] 이력 주석 추가: ${historyLine}`)
console.log('[bump-save-version] src/store/gameStateStorage.ts를 확인하고 커밋에 포함하세요.')
