import { useUserStore } from '@/store/user-store'

/**
 * Hook to access user tier and role information
 * Provides convenient getters for checking user status
 */
export function useUserTier() {
  const {
    profile,
    isAuthenticated,
    isGuide,
    isTourist,
    isProGuide,
    isFreeGuide,
    isVerifiedGuide,
  } = useUserStore()

  return {
    profile,
    isAuthenticated: isAuthenticated(),
    isGuide: isGuide(),
    isTourist: isTourist(),
    isProGuide: isProGuide(),
    isFreeGuide: isFreeGuide(),
    isVerifiedGuide: isVerifiedGuide(),
    guideTier: profile?.guide_tier,
    role: profile?.role,
  }
}
