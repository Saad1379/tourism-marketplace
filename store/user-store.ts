import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { Profile } from '@/lib/supabase/bootstrap'

export interface AuthUser {
  id: string
  email: string | null
  name?: string | null
  image?: string | null
  role?: 'tourist' | 'guide' | 'admin' | null
  // Back-compat fields for code that previously expected a Supabase User.
  user_metadata?: Record<string, any>
  app_metadata?: Record<string, any>
}

export interface AuthSession {
  user: AuthUser
  supabaseAccessToken?: string | null
  supabaseRefreshToken?: string | null
  expires?: string | null
  // Back-compat: Supabase session shape.
  access_token?: string | null
  refresh_token?: string | null
}

interface UserState {
  user: AuthUser | null
  session: AuthSession | null
  profile: Profile | null
  isLoading: boolean
  error: Error | null
  planType: 'free' | 'pro'
  credits: number
  expiresAt: string | null
  planLoading: boolean

  // Actions
  setUser: (user: AuthUser | null) => void
  setSession: (session: AuthSession | null) => void
  setProfile: (profile: Profile | null) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: Error | null) => void
  clearAuth: () => void
  updateProfile: (updates: Partial<Profile>) => void
  setPlan: (planType: 'free' | 'pro', credits: number, expiresAt: string | null) => void
  fetchPlan: () => Promise<void>

  // Computed getters
  isAuthenticated: () => boolean
  isGuide: () => boolean
  isTourist: () => boolean
  isProGuide: () => boolean
  isFreeGuide: () => boolean
  isVerifiedGuide: () => boolean
}

export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        session: null,
        profile: null,
        isLoading: true,
        error: null,
        planType: 'free',
        credits: 0,
        expiresAt: null,
        planLoading: true,

        setUser: (user) => set({ user }),

        setSession: (session) => set({ session, user: session?.user ?? null }),

        setProfile: (profile) => set({ profile }),

        setLoading: (isLoading) => set({ isLoading }),

        setError: (error) => set({ error }),

        clearAuth: () => set({
          user: null,
          session: null,
          profile: null,
          error: null,
          planType: 'free',
          credits: 0,
          expiresAt: null,
          planLoading: false,
        }),

        updateProfile: (updates) => {
          const currentProfile = get().profile
          if (currentProfile) {
            set({ profile: { ...currentProfile, ...updates } })
          }
        },

        setPlan: (planType, credits, expiresAt) => set({ planType, credits, expiresAt }),

        fetchPlan: async () => {
          const user = get().user
          if (!user) {
            set({ planType: 'free', credits: 0, expiresAt: null, planLoading: false })
            return
          }
          set({ planLoading: true })
          try {
            const response = await fetch('/api/plan')
            const data = await response.json()
            set({
              planType: data.planType || 'free',
              credits: data.credits || 0,
              expiresAt: data.expiresAt || null,
              planLoading: false,
            })
          } catch (error) {
            console.error('Failed to fetch plan:', error)
            set({ planType: 'free', credits: 0, expiresAt: null, planLoading: false })
          }
        },

        isAuthenticated: () => !!get().user,

        isGuide: () => get().profile?.role === 'guide',

        isTourist: () => get().profile?.role === 'tourist',

        isProGuide: () => {
          const state = get()
          return state.profile?.role === 'guide' && state.planType === 'pro'
        },

        isFreeGuide: () => {
          const state = get()
          return state.profile?.role === 'guide' && state.planType === 'free'
        },

        isVerifiedGuide: () => {
          const profile = get().profile
          return profile?.role === 'guide' && profile?.guide_verified === true
        },
      }),
      {
        name: 'user-storage',
        partialize: (state) => ({
          user: state.user,
          profile: state.profile,
          planType: state.planType,
          credits: state.credits,
          expiresAt: state.expiresAt,
        }),
      }
    ),
    { name: 'UserStore' }
  )
)
