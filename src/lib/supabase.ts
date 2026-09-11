// Supabase 클라이언트 초기화. .env에 URL/키가 없거나 잘못돼도 여기서 예외를
// 던지지 않는다 — supabase를 null로 두고 랭킹 기능만 조용히 비활성화된다
// (게임의 다른 부분은 이 모듈과 무관하게 정상 동작해야 한다).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// createClient는 프로젝트 base URL(예: https://xxx.supabase.co)을 받아 내부에서
// /rest/v1 등 경로를 직접 붙인다. .env에 REST 경로까지 포함된 URL을 넣는 실수를
// 해도 동작하도록 흔한 꼬리(trailing /rest/v1, 마지막 슬래시)를 정규화한다.
function normalizeSupabaseUrl(url: string): string {
  return url.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
}

function createSupabaseClient(): SupabaseClient | null {
  if (!rawUrl || !anonKey) return null
  try {
    return createClient(normalizeSupabaseUrl(rawUrl), anonKey)
  } catch (error) {
    console.warn('[supabase] 클라이언트 초기화에 실패해 랭킹 기능을 비활성화합니다.', error)
    return null
  }
}

export const supabase = createSupabaseClient()
export const isSupabaseConfigured = supabase !== null
