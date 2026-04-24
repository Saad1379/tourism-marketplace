"use client"

import { signOut as nextAuthSignOut } from "next-auth/react"
import { useUserStore, type AuthUser, type AuthSession } from "@/store/user-store"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/supabase/bootstrap"

interface AuthContextShape {
  user: AuthUser | null
  session: AuthSession | null
  profile: Profile | null
  isLoading: boolean
  error: Error | null
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

/**
 * Backward-compatible hook. Reads auth state from the Zustand store (populated
 * by the NextAuth <-> Zustand bridge in components/providers/auth-provider.tsx).
 */
export function useAuth(): AuthContextShape {
  const user = useUserStore((s) => s.user)
  const session = useUserStore((s) => s.session)
  const profile = useUserStore((s) => s.profile)
  const isLoading = useUserStore((s) => s.isLoading)
  const error = useUserStore((s) => s.error)
  const setProfile = useUserStore((s) => s.setProfile)
  const clearAuth = useUserStore((s) => s.clearAuth)

  const signOut = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {
      // Ignore - Supabase sign-out is best-effort; NextAuth is source of truth.
    }
    clearAuth()
    await nextAuthSignOut({ callbackUrl: "/login" })
  }

  const refreshProfile = async () => {
    if (!user) return
    try {
      const supabase = createClient()
      const { data: newProfile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      if (profileError && profileError.code !== "PGRST116") {
        throw new Error(`Profile refresh failed: ${profileError.message}`)
      }
      setProfile((newProfile as Profile) || null)
    } catch (err) {
      console.error("[auth] refreshProfile error:", err)
    }
  }

  return { user, session, profile, isLoading, error, signOut, refreshProfile }
}

// Backward-compatible re-export for any consumer importing AuthProvider from here.
export { AuthProvider } from "@/components/providers/auth-provider"
