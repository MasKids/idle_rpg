// 랭킹 등록/조회. rankings 테이블은 같은 플레이어가 갱신할 때도 기존 행을 고치지
// 않고 새 행을 추가하는 구조(insert-only)라, "이름별 최고 기록"은 여기서(클라이언트)
// 조회 결과를 정렬·중복 제거해서 만든다 — 별도 DB 뷰 없이 이 규모(프로토타입)에는
// 충분하다. 실패는 전부 조용히 처리한다: 등록 실패는 게임 진행에 영향을 주면 안 되고,
// 조회 실패는 RankingModal이 자체적으로 에러 상태를 보여준다.
import { isSupabaseConfigured, supabase } from '../../lib/supabase'

export const isRankingEnabled = isSupabaseConfigured

const TABLE = 'rankings'
// 이름별 최고 기록만 추리기 위해 넉넉히 가져오는 상한 — 정확한 대규모 랭킹엔 DB 뷰가
// 낫지만, 이 프로토타입 규모(테스트 플레이어 수)에서는 클라이언트 dedup으로 충분하다.
const FETCH_LIMIT = 300
const TOP_N = 50

export interface RankingEntry {
  playerName: string
  maxStage: number
  playTime: number
  rebirthCount: number
}

export interface RankingRow extends RankingEntry {
  id: string
  rank: number
  updatedAt: string
}

export interface RankingListResult {
  top: RankingRow[]
  // 본인 기록이 top 50 밖에 있을 때만 채워진다(안에 있으면 top 목록에서 강조 표시로 충분).
  ownEntry: RankingRow | null
}

interface RankingRawRow {
  id: string
  player_name: string
  max_stage: number
  play_time: number
  rebirth_count: number
  updated_at: string
}

// 최고 스테이지가 갱신될 때 자동 호출된다(gameStore.ts). 실패해도 던지지 않고
// 콘솔 경고만 남긴다 — 네트워크 문제로 게임이 멈추거나 에러 화면이 뜨면 안 된다.
export async function submitRanking(entry: RankingEntry): Promise<void> {
  if (!supabase) return
  try {
    const { error } = await supabase.from(TABLE).insert({
      player_name: entry.playerName,
      max_stage: entry.maxStage,
      play_time: entry.playTime,
      rebirth_count: entry.rebirthCount,
    })
    if (error) throw error
  } catch (error) {
    console.warn('[ranking] 기록 등록에 실패했습니다(게임 진행에는 영향 없음).', error)
  }
}

export async function fetchRankings(playerName: string): Promise<RankingListResult> {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.')

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, player_name, max_stage, play_time, rebirth_count, updated_at')
    .order('max_stage', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(FETCH_LIMIT)

  if (error) throw error

  // 정렬 순서(최고 스테이지 내림차순)대로 훑으며 이름마다 처음 나오는 행(=그 이름의
  // 최고 기록)만 남긴다.
  const seenNames = new Set<string>()
  const deduped: RankingRow[] = []
  for (const row of (data ?? []) as RankingRawRow[]) {
    if (seenNames.has(row.player_name)) continue
    seenNames.add(row.player_name)
    deduped.push({
      id: row.id,
      playerName: row.player_name,
      maxStage: row.max_stage,
      playTime: row.play_time,
      rebirthCount: row.rebirth_count,
      updatedAt: row.updated_at,
      rank: deduped.length + 1,
    })
  }

  const top = deduped.slice(0, TOP_N)
  const ownIndex = deduped.findIndex((row) => row.playerName === playerName)
  const ownEntry = ownIndex >= TOP_N ? deduped[ownIndex] : null

  return { top, ownEntry }
}
