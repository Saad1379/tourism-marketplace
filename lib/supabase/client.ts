import { createBrowserClient } from "@supabase/ssr"
import { getSupabaseEnv } from "./env"

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null
let hasWarnedMissingEnv = false

const FALLBACK_SUPABASE_URL = "http://127.0.0.1:54321"
const FALLBACK_SUPABASE_ANON_KEY = "missing-env-anon-key"

export function createClient() {
  const env = getSupabaseEnv()

  if (!env) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Supabase credentials missing: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY not set in environment",
      )
    }

    if (!hasWarnedMissingEnv) {
      hasWarnedMissingEnv = true
      console.error(
        "[v0] Supabase environment variables are missing. Running in degraded mode until NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are configured.",
      )
    }
  }

  if (supabaseClient) {
    return supabaseClient
  }

  supabaseClient = createBrowserClient(
    env?.url ?? FALLBACK_SUPABASE_URL,
    env?.key ?? FALLBACK_SUPABASE_ANON_KEY,
  )
  return supabaseClient
}
