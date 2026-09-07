const UNITS: [number, string][] = [
  [1_000, 'K'],
  [1_000_000, 'M'],
  [1_000_000_000, 'B'],
]

const MAX_DISPLAY_SCALED = 999_999.9

// 1000 미만은 그대로, 그 이상은 K/M/B 단위로 소수점 첫째 자리까지 축약
export function formatNumber(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)

  if (!Number.isFinite(abs)) return `${sign}∞`
  if (abs < 1_000) return `${sign}${Math.trunc(abs)}`

  let unitIndex = 0
  for (let i = 0; i < UNITS.length; i++) {
    if (abs >= UNITS[i][0]) unitIndex = i
  }

  let [threshold, suffix] = UNITS[unitIndex]
  let scaled = Number((abs / threshold).toFixed(1))

  // 반올림으로 다음 단위 경계(1000)에 걸리면 한 단계 위 단위로 올림
  if (scaled >= 1000 && unitIndex < UNITS.length - 1) {
    ;[threshold, suffix] = UNITS[unitIndex + 1]
    scaled = Number((abs / threshold).toFixed(1))
  }

  // 최상위 단위(B)에서도 표현 범위를 넘어서면(비현실적으로 큰 값) 상한으로 고정
  scaled = Math.min(scaled, MAX_DISPLAY_SCALED)

  return `${sign}${scaled.toFixed(1)}${suffix}`
}

// 밀리초를 "H:MM:SS" 형태 카운트다운 문자열로. 음수는 0으로 취급
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')

  return `${hours}:${pad(minutes)}:${pad(seconds)}`
}
