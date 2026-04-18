import { useUserStore } from '@/store/user-store'

// Guide tier system definitions
export type GuideTier = "free" | "pro"

export interface TierLimits {
  maxTours: number
  maxCapacityPerTour: number
  canBoostListings: boolean
  priorityPlacement: boolean
  advancedAnalytics: boolean
  verifiedBadge: boolean
  customBranding: boolean
}

export const TIER_LIMITS: Record<GuideTier, TierLimits> = {
  free: {
    maxTours: 1,
    maxCapacityPerTour: 7,
    canBoostListings: false,
    priorityPlacement: false,
    advancedAnalytics: false,
    verifiedBadge: false,
    customBranding: false,
  },
  pro: {
    maxTours: Number.POSITIVE_INFINITY,
    maxCapacityPerTour: Number.POSITIVE_INFINITY,
    canBoostListings: true,
    priorityPlacement: true,
    advancedAnalytics: true,
    verifiedBadge: true,
    customBranding: true,
  },
}

export const TIER_PRICING = {
  monthly: 29, // 29 EUR = 29 credits
  yearly: 249, // 249 EUR = 249 credits (~30% discount)
}

export function getTierLimits(tier: GuideTier): TierLimits {
  return TIER_LIMITS[tier]
}

export function canCreateTour(tier: GuideTier, currentTourCount: number): boolean {
  const limits = getTierLimits(tier)
  return currentTourCount < limits.maxTours
}

export function getMaxCapacity(tier: GuideTier): number {
  return TIER_LIMITS[tier].maxCapacityPerTour
}

export function formatCapacity(capacity: number): string {
  return capacity === Number.POSITIVE_INFINITY ? "Unlimited" : `${capacity} guests`
}

export function formatTourLimit(limit: number): string {
  return limit === Number.POSITIVE_INFINITY ? "Unlimited" : `${limit} tour${limit > 1 ? "s" : ""}`
}

/**
 * Hook to get current user's tier limits
 */
export function useGuideTierLimits() {
  const profile = useUserStore((state) => state.profile)
  const tier = profile?.guide_tier || 'free'
  return getTierLimits(tier)
}

/**
 * Hook to check if user can create a tour
 */
export function useCanCreateTour(currentTourCount: number) {
  const profile = useUserStore((state) => state.profile)
  const tier = profile?.guide_tier || 'free'
  return canCreateTour(tier, currentTourCount)
}
