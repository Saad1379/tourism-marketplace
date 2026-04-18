"use client"

import { createContext, useContext, useEffect, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { bootstrapAuth, type Profile, type BootstrapResult } from "@/lib/supabase/bootstrap"
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js"
import { useUserStore } from "@/store/user-store"
import { getSupabaseEnv } from "@/lib/supabase/env"

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  isLoading: boolean
  error: Error | null
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const hasSupabaseEnv = Boolean(getSupabaseEnv())
  const supabase = hasSupabaseEnv || process.env.NODE_ENV === "production" ? createClient() : null
  
  // Use Zustand store
  const {
    user,
    session,
    profile,
    isLoading,
    error,
    setUser,
    setSession,
    setProfile,
    setLoading,
    setError,
    clearAuth,
    fetchPlan,
  } = useUserStore()

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    clearAuth()
  }

  const refreshProfile = async () => {
    if (!user || !supabase) return

    try {
      const { data: newProfile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (profileError && profileError.code !== "PGRST116") {
        throw new Error(`Profile refresh failed: ${profileError.message}`)
      }

      setProfile((newProfile as Profile) || null)
      console.log("[v0] Profile refreshed")
    } catch (err) {
      const refreshError = err instanceof Error ? err : new Error(String(err))
      console.error("[v0] Profile refresh error:", refreshError)
    }
  }

  useEffect(() => {
    if (!supabase) {
      setSession(null)
      setUser(null)
      setProfile(null)
      setError(null)
      setLoading(false)
      fetchPlan()
      return
    }

    let isMounted = true

    const runBootstrap = async () => {
      console.log("[v0] Auth context mounting - starting bootstrap")

      const result: BootstrapResult = await bootstrapAuth(supabase)

      if (!isMounted) {
        console.log("[v0] Component unmounted, discarding bootstrap result")
        return
      }

      // Set state from bootstrap result
      setSession(result.session)
      setUser(result.user)
      setProfile(result.profile)
      setError(result.error)
      setLoading(false)
      if (result.user) {
         fetchPlan()
      } else {
         fetchPlan() // Which gracefully defaults to false inside Zustand
      }

      if (result.error && result.error.name !== "AbortError") {
        console.error("[v0] Auth bootstrap failed with error:", result.error.message)
      }

      // Only set up listener AFTER bootstrap is complete to avoid race conditions
      if (result.isReady) {
        console.log("[v0] Bootstrap ready - setting up auth state listener")

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, newSession: Session | null) => {
          console.log("[v0] Auth state changed:", event)

          setSession(newSession)
          setUser(newSession?.user ?? null)

          if (newSession?.user) {
            // Push profile fetch to the next tick to prevent deadlocks with auth state emitter
            setTimeout(() => {
              supabase
                .from("profiles")
                .select("*")
                .eq("id", newSession.user.id)
                .single()
                .then(({ data: newProfile, error: profileError }: any) => {
                  if (profileError && profileError.code !== "PGRST116") {
                    console.error(`[v0] Profile fetch in listener failed: ${profileError.message}`)
                    return
                  }
                  setProfile((newProfile as Profile) || null)
                  fetchPlan()
                })
                .catch((err: any) => {
                  console.error("[v0] Profile fetch in listener error:", err)
                })
            }, 0)
          } else {
            setProfile(null)
          }
        })

        return () => {
          subscription.unsubscribe()
        }
      }
    }

    runBootstrap()

    return () => {
      isMounted = false
    }
  }, [supabase])

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        error,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
