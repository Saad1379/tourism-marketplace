"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { CookieBanner } from "@/components/cookies/cookie-banner"
import { initGA, persistUtmParamsFromQuery, trackPageView } from "@/lib/analytics/ga"
import { getConsentChoice } from "@/components/cookies/cookie-utils"
import { identifyPostHogUser, initPostHog, resetPostHogUser, trackPostHogPageView } from "@/lib/analytics/posthog"
import { initMetaPixel, trackMetaPageView } from "@/lib/analytics/meta"
import { useAuth } from "@/lib/supabase/auth-context"

function debugLog(message: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return
  if (payload) {
    console.info(`[TipWalk Analytics Setup] ${message}`, payload)
    return
  }
  console.info(`[TipWalk Analytics Setup] ${message}`)
}

/**
 * Client-side analytics setup and banner
 */
export function AnalyticsSetup() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useAuth()

  useEffect(() => {
    const consent = getConsentChoice()
    initGA(consent)
    initPostHog(consent)
    initMetaPixel(consent)
    debugLog("analytics initialized", {
      consent,
      initializedAt: Date.now(),
    })
  }, [])

  useEffect(() => {
    const query = searchParams.toString()
    persistUtmParamsFromQuery(query)

    const consent = getConsentChoice()
    if (consent !== "accepted") return

    const path = query ? `${pathname}?${query}` : pathname
    trackPageView(path)
    trackPostHogPageView(path)
    trackMetaPageView()
  }, [pathname, searchParams])

  useEffect(() => {
    if (user?.id) {
      identifyPostHogUser(user.id)
    } else {
      resetPostHogUser()
    }
  }, [user?.id])

  return <CookieBanner />
}
