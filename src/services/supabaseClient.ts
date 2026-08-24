import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Backend integration point. When VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// are set (see .env.example), this client becomes available and a remote
// persistence driver can be wired into services/persistence.ts. The table
// schema lives in supabase/schema.sql.

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  if (!url || !key) return null
  if (!client) client = createClient(url, key)
  return client
}

export function isSupabaseConfigured(): boolean {
  return getSupabase() !== null
}
