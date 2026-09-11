// 이름 입력 강제 화면(NameEntryGate)과 프로필 패널(ProfileModal)이 같은 규칙을
// 쓰도록 검증 로직을 한 곳에 둔다.
export const PLAYER_NAME_MIN_LENGTH = 2
export const PLAYER_NAME_MAX_LENGTH = 12

// 앞뒤 공백만 제거한다 — 공백만 입력한 경우는 trim 결과가 빈 문자열이 되어
// isValidPlayerName()의 길이 검사에서 자연스럽게 걸러진다.
export function normalizePlayerName(raw: string): string {
  return raw.trim()
}

export function isValidPlayerName(raw: string): boolean {
  const length = normalizePlayerName(raw).length
  return length >= PLAYER_NAME_MIN_LENGTH && length <= PLAYER_NAME_MAX_LENGTH
}
