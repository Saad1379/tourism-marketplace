"use client"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Session, User } from "@supabase/supabase-js"
import { getSupabaseEnv } from "./env"
import { withTimeout } from "./timeout"

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  /**
   * Canonical values: "buyer" | "seller" | "admin"
   * Legacy values (backward compat): "tourist" | "guide"
   */
  role: "tourist" | "guide" | "buyer" | "seller" | "admin"
  phone: string | null
  bio: string | null
  languages: string[]
  guide_tier: "free" | "pro"
  guide_verified: boolean
  guide_rating: number
  guide_total_reviews: number
  guide_total_tours: number
  tourist_total_bookings: number
  tourist_confirmed_attendances: number
  city: string | null
  onboarding_completed: boolean
  roles: string[]
  created_at: string
}

export interface BootstrapResult {
  session: Session | null
  user: User | null
  profile: Profile | null
  error: Error | null
  isReady: boolean
}

export function validateEnvironment(): { valid: boolean; error?: string } {
  const env = getSupabaseEnv()

  if (!env) {
    return {
      valid: false,
      error:
        "Supabase environment variables not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to Vercel environment variables.",
    }
  }

  if (env.url.includes("placeholder") || env.key.includes("placeholder")) {
    return {
      valid: false,
      error: "Supabase environment variables contain placeholder values. Configure real credentials in Vercel.",
    }
  }

  if (!env.url.startsWith("https://") || !env.key) {
    return {
      valid: false,
      error:
        "Supabase environment variables are invalid. Check NEXT_PUBLIC_SUPABASE_URL format and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    }
  }

  return { valid: true }
}

export async function bootstrapAuth(supabase: SupabaseClient, timeoutMs = 15000): Promise<BootstrapResult> {
  console.log("[v0] Starting deterministic auth bootstrap with", timeoutMs, "ms timeout")

  const envValidation = validateEnvironment()
  if (!envValidation.valid) {
    const error = new Error(envValidation.error || "Environment validation failed")
    console.error("[v0] Environment error:", error)
    return { session: null, user: null, profile: null, error, isReady: false }
  }
  console.log("[v0] Environment validated")

  const runBoot = async () => {
    try {
      // Step 1: Get session with better error handling
      console.log("[v0] Step 1: Getting session...")
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        console.warn("[v0] Session fetch returned error:", sessionError.message)
        throw new Error(`Session fetch failed: ${sessionError.message}`)
      }

      console.log(`[v0] Step 2: Got session ${session ? "✓" : "✗ (user not logged in)"}`)

      if (!session) {
        console.log("[v0] No active session - user is logged out")
        return { session: null, user: null, profile: null, error: null, isReady: true }
      }

      const user = session.user
      console.log("[v0] Step 3: Got user:", user.id)

      // Step 2: Fetch profile only if session exists
      console.log("[v0] Step 4: Fetching profile...")
      const { data: profile, error: profileError } = await supabase.from("profiles").select("*").eq("id", user.id).single()

      if (profileError) {
        if (profileError.code !== "PGRST116") {
          // PGRST116 = no rows found (new user, profile will be created by trigger)
          console.warn("[v0] Profile fetch error:", profileError.message)
        }
      }

      console.log(`[v0] Step 5: Profile fetch complete ${profile ? "✓" : "✗ (new user)"}`)

      if (profile && (profile.role === null || profile.role === "tourist")) {
        const userRole = user.user_metadata?.role
        if (userRole && userRole !== profile.role) {
          console.log("[v0] Detected role mismatch. Profile has:", profile.role, "metadata has:", userRole)

          const { error: fixError } = await supabase.from("profiles").update({ role: userRole }).eq("id", user.id)

          if (fixError) {
            console.error("[v0] Failed to fix role in profile:", fixError.message)
          } else {
            console.log("[v0] Fixed profile role to:", userRole)
            profile.role = userRole as "tourist" | "guide" | "buyer" | "seller"
          }
        }
      }

      return {
        session,
        user,
        profile: (profile as Profile) || null,
        error: null,
        isReady: true,
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      // Don't log abort errors as they're expected from timeouts
      if (error.name !== "AbortError") {
        console.error("[v0] Bootstrap error:", error.message)
      }
      return { session: null, user: null, profile: null, error, isReady: false }
    }
  }

  try {
    return await withTimeout(runBoot(), timeoutMs)
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    
    if (error.message.includes("Timeout")) {
      console.error("[v0] Connection timeout after", timeoutMs, "ms")
      return {
        session: null,
        user: null,
        profile: null,
        error: new Error("Connection timeout. Please check your internet and reload the page."),
        isReady: false,
      }
    }
    
    // Don't log abort errors as they're expected from timeouts
    if (error.name !== "AbortError") {
      console.error("[v0] Bootstrap failed:", error.message)
    }
    
    return { session: null, user: null, profile: null, error, isReady: false }
  }
}
