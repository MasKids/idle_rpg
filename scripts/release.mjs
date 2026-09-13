// 릴리스 발행 자동화 — docs/RELEASE.md의 수작업 절차를 그대로 스크립트로 옮긴
// 것이다. PatchNoteTable에 넣을 "플레이어 체감 1줄 요약"만은 기계적으로
// 뽑아낼 수 없는 편집 판단이 필요해서(CLAUDE.md "변경 이력 관리" 참고) 여기서
// 스크립트를 잠깐 멈추고 사람(또는 Claude)이 직접 append-row.mjs로 채워 넣게
// 한다 — 그 외 단계는 전부 자동.
//
// 사용법 (2단계로 나뉜다):
//   1) node scripts/release.mjs <X.Y.Z>
//      사전 검사 → 버전 결정 → package.json 버전 갱신 → SAVE_VERSION 갱신 →
//      CHANGELOG.md의 [Unreleased]를 [vX.Y.Z] 섹션으로 이동. 여기서 멈추고
//      PatchNoteTable에 채워 넣을 항목 목록과 append-row.mjs 명령을 출력한다.
//      (이 단계에서는 아직 커밋하지 않는다 — 작업 트리가 dirty한 상태로 남는다.)
//   2) balance.xlsx에 append-row.mjs로 patch note 행을 다 채워 넣은 뒤:
//      node scripts/release.mjs <X.Y.Z> --finish
//      npm run balance 재실행 → 최종 빌드 확인 → 커밋 + 태그 생성 → (확인 후)
//      원격 push + GitHub Release 발행까지.
//
// 예: node scripts/release.mjs 0.6.0
//     (PatchNoteTable 채워 넣기)
//     node scripts/release.mjs 0.6.0 --finish

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const CHANGELOG_PATH = resolve(REPO_ROOT, 'CHANGELOG.md')
const PACKAGE_JSON_PATH = resolve(REPO_ROOT, 'package.json')
const BALANCE_JSON_PATH = resolve(REPO_ROOT, 'src/data/balance.json')

function fail(message) {
  console.error(`\n[release] 중단: ${message}`)
  process.exit(1)
}

function step(message) {
  console.log(`\n[release] ${message}`)
}

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: REPO_ROOT, stdio: 'inherit', shell: process.platform === 'win32', ...opts })
}

function runCapture(cmd, args) {
  return execFileSync(cmd, args, { cwd: REPO_ROOT, encoding: 'utf-8', shell: process.platform === 'win32' }).trim()
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question(`${question} (y/N) `)
    return /^y(es)?$/i.test(answer.trim())
  } finally {
    rl.close()
  }
}

function todayDate() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ---- 버전 인자 파싱 ----

async function resolveVersion(rawArg) {
  let v = rawArg
  if (!v) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    try {
      v = (await rl.question('릴리스 버전을 입력하세요 (예: 0.6.0): ')).trim()
    } finally {
      rl.close()
    }
  }
  v = v.replace(/^v/i, '')
  if (!/^\d+\.\d+\.\d+$/.test(v)) fail(`버전 형식이 X.Y.Z가 아닙니다: "${v}"`)
  return v
}

// ---- CHANGELOG.md 파싱/조작 ----

function readChangelog() {
  return readFileSync(CHANGELOG_PATH, 'utf-8')
}

function findUnreleasedBody(text) {
  const headerMatch = text.match(/^## \[Unreleased\]\r?\n/m)
  if (!headerMatch) fail('CHANGELOG.md에서 "## [Unreleased]" 섹션을 찾지 못했습니다.')
  const bodyStart = headerMatch.index + headerMatch[0].length
  const nextHeaderMatch = text.slice(bodyStart).match(/^## \[/m)
  const bodyEnd = nextHeaderMatch ? bodyStart + nextHeaderMatch.index : text.length
  return { bodyStart, bodyEnd, body: text.slice(bodyStart, bodyEnd) }
}

function extractBulletTitles(unreleasedBody) {
  // "### 추가/변경/수정" 섹션별로 최상위(- 로 시작, 들여쓰기 없는) 항목의
  // **굵게** 표시된 제목(없으면 문장 앞부분)을 뽑아 PatchNoteTable 초안으로 쓴다.
  const categoryMap = { 추가: 'ADD', 변경: 'CHANGE', 수정: 'FIX' }
  const result = []
  const lines = unreleasedBody.split(/\r?\n/)
  let currentCategory = null
  for (const line of lines) {
    const headerMatch = line.match(/^### (추가|변경|수정)\s*$/)
    if (headerMatch) {
      currentCategory = categoryMap[headerMatch[1]]
      continue
    }
    if (!currentCategory) continue
    const bulletMatch = line.match(/^- (.+)$/)
    if (!bulletMatch) continue
    const boldMatch = bulletMatch[1].match(/\*\*(.+?)\*\*/)
    const title = boldMatch ? boldMatch[1] : bulletMatch[1].replace(/[*`]/g, '').slice(0, 40)
    result.push({ category: currentCategory, title })
  }
  return result
}

function buildSaveVersionReason(bulletTitles) {
  if (bulletTitles.length === 0) return '릴리스'
  const joined = bulletTitles.map((b) => b.title).join(', ')
  return joined.length > 80 ? `${joined.slice(0, 77)}...` : joined
}

function ensureSaveResetNotice(text) {
  if (text.includes('버전이 올라갈 때마다 세이브가 초기화됩니다')) return text
  const insertion =
    '\n> ⚠️ **버전이 올라갈 때마다 세이브가 초기화됩니다.** 프로토타입 단계라 구조\n' +
    '> 변경 여부와 무관하게 릴리스마다(v0.X.0/v0.X.Y 모두) 세이브 버전을 함께 올리고\n' +
    '> 마이그레이션은 만들지 않는다(docs/RELEASE.md 3절). 업데이트 후 처음 접속하면\n' +
    '> 진행 상황이 초기화되고, 안내 화면이 한 번 뜬 뒤 이름 입력으로 이어진다 — 이\n' +
    '> 문서의 각 버전 항목에는 더 이상 개별로 표시하지 않는다.\n'
  const headerMatch = text.match(/^# .+\r?\n\r?\n.+\r?\n/)
  if (!headerMatch) return insertion.trimStart() + '\n' + text
  const insertAt = headerMatch.index + headerMatch[0].length
  return text.slice(0, insertAt) + insertion + text.slice(insertAt)
}

function moveUnreleasedIntoVersion(text, version, date) {
  const withNotice = ensureSaveResetNotice(text)
  const { bodyStart, bodyEnd, body } = findUnreleasedBody(withNotice)
  const trimmedBody = body.replace(/^\r?\n+/, '').replace(/\s+$/, '')
  const newSection = `\n## [v${version}] - ${date}\n\n${trimmedBody}\n\n`
  return withNotice.slice(0, bodyStart) + newSection + withNotice.slice(bodyEnd)
}

function hasVersionSection(text, version) {
  return new RegExp(`^## \\[v${version.replace(/\./g, '\\.')}\\]`, 'm').test(text)
}

function extractVersionSection(text, version) {
  const re = new RegExp(`^## \\[v${version.replace(/\./g, '\\.')}\\].*\\r?\\n`, 'm')
  const headerMatch = text.match(re)
  if (!headerMatch) return null
  const bodyStart = headerMatch.index + headerMatch[0].length
  const nextHeaderMatch = text.slice(bodyStart).match(/^## \[/m)
  const bodyEnd = nextHeaderMatch ? bodyStart + nextHeaderMatch.index : text.length
  return text.slice(bodyStart, bodyEnd).trim()
}

// ---- package.json ----

function bumpPackageVersion(version) {
  const text = readFileSync(PACKAGE_JSON_PATH, 'utf-8')
  const updated = text.replace(/"version":\s*"[^"]*"/, `"version": "${version}"`)
  if (updated === text) fail('package.json에서 "version" 필드를 찾지 못했습니다.')
  writeFileSync(PACKAGE_JSON_PATH, updated)
}

// ---- 사전 검사 ----

function checkGitClean() {
  const status = runCapture('git', ['status', '--porcelain'])
  if (status.length > 0) {
    fail(`커밋되지 않은 변경사항이 있습니다. 먼저 커밋하거나 정리하세요:\n${status}`)
  }
}

function checkTagNotExists(version) {
  const existing = runCapture('git', ['tag', '-l', `v${version}`])
  if (existing.trim().length > 0) fail(`태그 v${version}이(가) 이미 존재합니다.`)
}

function runBuildChecks() {
  step('빌드 확인 중 (lint, build)...')
  run('npm', ['run', 'lint'])
  run('npm', ['run', 'build'])
}

// ---- PatchNoteTable 안내 출력 ----

function printPatchNoteGuidance(version, date, bulletTitles) {
  let nextStringId = 55000
  let nextPatchId = 33001
  if (existsSync(BALANCE_JSON_PATH)) {
    const data = JSON.parse(readFileSync(BALANCE_JSON_PATH, 'utf-8'))
    if (Array.isArray(data.StringTable) && data.StringTable.length > 0) {
      nextStringId = Math.max(...data.StringTable.map((r) => r.Id)) + 1
    }
    if (Array.isArray(data.PatchNoteTable) && data.PatchNoteTable.length > 0) {
      nextPatchId = Math.max(...data.PatchNoteTable.map((r) => r.Id)) + 1
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log(`[release] PatchNoteTable에 v${version} 항목을 채워 넣어야 합니다.`)
  console.log('='.repeat(70))
  if (bulletTitles.length === 0) {
    console.log('(CHANGELOG.md에서 굵은 제목을 찾지 못했습니다 — 직접 확인해 채워주세요.)')
  } else {
    console.log('\nCHANGELOG.md 항목을 참고해 "플레이어가 체감할 항목만 1줄(20자 내외)"로')
    console.log('추려서 아래 명령을 채운 뒤 실행하세요(내부 리팩터링/문서 정리는 생략):\n')
    bulletTitles.forEach((b, i) => {
      const sortOrder = i + 1
      const stringId = nextStringId + i
      console.log(`# ${i + 1}. [${b.category}] ${b.title}`)
      console.log(`node scripts/append-row.mjs string PatchNote ${stringId} "<20자 내외 한글 요약>" "<English summary>"`)
      console.log(
        `node scripts/append-row.mjs PatchNoteTable v${version} ${date} ${b.category} ${stringId} ${sortOrder}\n`,
      )
    })
    console.log(`(다음 PatchNoteTable Id는 ${nextPatchId}부터 append-row.mjs가 자동으로 채웁니다.)`)
  }
  console.log('모두 채워 넣은 뒤 `npm run balance`로 반영을 확인하고, 다음 명령으로 이어서 실행하세요:')
  console.log(`\n  node scripts/release.mjs ${version} --finish\n`)
}

// ---- 메인 ----

async function phaseA(version) {
  step(`v${version} 릴리스 준비 시작`)

  checkGitClean()
  checkTagNotExists(version)

  const before = readChangelog()
  const { body } = findUnreleasedBody(before)
  if (body.trim().length === 0) {
    fail('CHANGELOG.md의 [Unreleased] 섹션이 비어 있습니다 — 릴리스할 내용이 없습니다.')
  }

  runBuildChecks()

  const bulletTitles = extractBulletTitles(body)
  const date = todayDate()

  step('package.json 버전 갱신')
  bumpPackageVersion(version)

  step('SAVE_VERSION 갱신')
  const reason = buildSaveVersionReason(bulletTitles)
  run('node', ['scripts/bump-save-version.mjs', `v${version}`, reason])

  step('CHANGELOG.md: [Unreleased] → [v' + version + '] 이동')
  const updatedChangelog = moveUnreleasedIntoVersion(before, version, date)
  writeFileSync(CHANGELOG_PATH, updatedChangelog)

  printPatchNoteGuidance(version, date, bulletTitles)
}

async function phaseFinish(version) {
  step(`v${version} 릴리스 마무리`)

  const changelog = readChangelog()
  if (!hasVersionSection(changelog, version)) {
    fail(`CHANGELOG.md에 [v${version}] 섹션이 없습니다 — 먼저 "node scripts/release.mjs ${version}"를 실행하세요.`)
  }
  checkTagNotExists(version)

  step('balance.xlsx → balance.json 재생성 (npm run balance)')
  run('npm', ['run', 'balance'])

  runBuildChecks()

  step('커밋 생성')
  const filesToAdd = [
    'CHANGELOG.md',
    'package.json',
    'src/store/gameStateStorage.ts',
    'balance/balance.xlsx',
    'src/data/balance.json',
  ].filter((f) => existsSync(resolve(REPO_ROOT, f)))
  run('git', ['add', ...filesToAdd])

  const status = runCapture('git', ['status', '--porcelain'])
  if (status.trim().length === 0) fail('커밋할 변경사항이 없습니다 — phaseA를 먼저 실행했는지 확인하세요.')

  run('git', ['commit', '-m', `chore: prepare v${version} release`])

  step('태그 생성')
  run('git', ['tag', '-a', `v${version}`, '-m', `v${version}`])

  console.log(`\n[release] v${version} 커밋 + 태그 생성 완료 (아직 원격에는 반영되지 않음).`)

  const shouldPush = await confirm('원격(origin)에 push할까요?')
  if (!shouldPush) {
    console.log('\n[release] push를 건너뜁니다. 준비되면 직접 실행하세요:')
    console.log(`  git push origin main && git push origin v${version}`)
    return
  }

  step('원격 push')
  run('git', ['push', 'origin', 'main'])
  run('git', ['push', 'origin', `v${version}`])

  const hasGh = (() => {
    try {
      runCapture('gh', ['--version'])
      return true
    } catch {
      return false
    }
  })()
  if (!hasGh) {
    console.log('\n[release] gh CLI를 찾지 못해 GitHub Release는 건너뜁니다. docs/RELEASE.md 2절 참고.')
    return
  }

  const shouldRelease = await confirm('GitHub Release도 발행할까요?')
  if (!shouldRelease) {
    console.log('\n[release] GitHub Release 발행을 건너뜁니다. 준비되면 직접 실행하세요:')
    console.log(`  gh release create v${version} --title "v${version} - <제목>" --notes-file -`)
    return
  }

  const notes = extractVersionSection(readChangelog(), version) ?? ''
  step('GitHub Release 발행')
  run('gh', ['release', 'create', `v${version}`, '--title', `v${version}`, '--notes', notes])

  console.log(`\n[release] v${version} 릴리스 완료.`)
}

async function main() {
  const args = process.argv.slice(2)
  const finish = args.includes('--finish')
  const positional = args.find((a) => !a.startsWith('--'))

  const version = await resolveVersion(positional)

  if (finish) {
    await phaseFinish(version)
  } else {
    await phaseA(version)
  }
}

main().catch((err) => {
  console.error('\n[release] 예기치 않은 오류:', err.message ?? err)
  process.exit(1)
})
