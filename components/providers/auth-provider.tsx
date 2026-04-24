"use client"

import { SessionProvider, useSession } from "next-auth/react"
import { useEffect, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { useUserStore } from "@/store/user-store"
import type { Profile } from "@/lib/supabase/bootstrap"

function AuthBridge({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const {
    setUser,
    setSession,
    setProfile,
    setLoading,
    clearAuth,
    fetchPlan,
  } = useUserStore()

  useEffect(() => {
    if (status === "loading") {
      setLoading(true)
      return
    }

    if (status === "unauthenticated" || !session?.user) {
      clearAuth()
      setLoading(false)
      return
    }

    const sessionUser = session.user
    const authUser = {
      id: sessionUser.id,
      email: sessionUser.email ?? null,
      name: sessionUser.name ?? null,
      image: sessionUser.image ?? null,
      role: (sessionUser.role as "tourist" | "guide" | "admin" | null) ?? "tourist",
      user_metadata: {
        full_name: sessionUser.name ?? null,
        avatar_url: sessionUser.image ?? null,
      },
      app_metadata: {},
    }

    setUser(authUser)
    setSession({
      user: authUser,
      supabaseAccessToken: sessionUser.supabaseAccessToken ?? null,
      supabaseRefreshToken: sessionUser.supabaseRefreshToken ?? null,
      access_token: sessionUser.supabaseAccessToken ?? null,
      refresh_token: sessionUser.supabaseRefreshToken ?? null,
      expires: session.expires ?? null,
    })

    let cancelled = false
    const loadProfile = async () => {
      try {
        const supabase = createClient()
        if (sessionUser.supabaseAccessToken && sessionUser.supabaseRefreshToken) {
          await supabase.auth.setSession({
            access_token: sessionUser.supabaseAccessToken,
            refresh_token: sessionUser.supabaseRefreshToken,
          })
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", sessionUser.id)
          .single()

        if (cancelled) return

        if (error && error.code !== "PGRST116") {
          console.error("[auth-bridge] profile fetch error:", error.message)
        }

        setProfile((profile as Profile) || null)
        fetchPlan()
      } catch (err) {
        if (!cancelled) {
          console.error("[auth-bridge] profile load failed:", err)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadProfile()

    return () => {
      cancelled = true
    }
  }, [session, status, setUser, setSession, setProfile, setLoading, clearAuth, fetchPlan])

  return <>{children}</>
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <AuthBridge>{children}</AuthBridge>
    </SessionProvider>
  )
}
