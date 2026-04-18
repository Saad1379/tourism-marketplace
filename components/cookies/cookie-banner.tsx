"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { setConsentChoice, shouldShowBanner } from "./cookie-utils"
import { updateConsentStatus } from "@/lib/analytics/ga"
import { updatePostHogConsent } from "@/lib/analytics/posthog"
import { updateMetaConsent } from "@/lib/analytics/meta"
import { Button } from "@/components/ui/button"

const BANNER_IDLE_TIMEOUT_MS = 1400
const BANNER_MIN_VISIBLE_DELAY_MS = 900

function debugLog(message: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return
  if (payload) {
    console.info(`[TipWalk Consent] ${message}`, payload)
    return
  }
  console.info(`[TipWalk Consent] ${message}`)
}

export function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [shownAt, setShownAt] = useState<number | null>(null)

  useEffect(() => {
    let idleHandle: number | null = null
    let timeoutHandle: number | null = null
    let minDelayHandle: number | null = null
    let hasRendered = false
    const startedAt = Date.now()

    const revealBanner = (source: "idle" | "timeout") => {
      if (hasRendered) return
      hasRendered = true
      const timestamp = Date.now()
      setShowBanner(true)
      setShownAt(timestamp)
      setIsLoading(false)
      debugLog("banner displayed", {
        source,
        timestamp,
      })
    }

    const scheduleReveal = (source: "idle" | "timeout") => {
      const elapsed = Date.now() - startedAt
      const remaining = Math.max(0, BANNER_MIN_VISIBLE_DELAY_MS - elapsed)
      if (remaining === 0) {
        revealBanner(source)
        return
      }
      minDelayHandle = window.setTimeout(() => {
        revealBanner(source)
      }, remaining)
    }

    if (shouldShowBanner()) {
      timeoutHandle = window.setTimeout(() => {
        scheduleReveal("timeout")
      }, BANNER_IDLE_TIMEOUT_MS)

      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(() => {
          scheduleReveal("idle")
        }, { timeout: BANNER_IDLE_TIMEOUT_MS })
      }
    } else {
      setIsLoading(false)
    }

    return () => {
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle)
      }
      if (minDelayHandle !== null) {
        window.clearTimeout(minDelayHandle)
      }
      if (idleHandle !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle)
      }
    }
  }, [])

  const handleAccept = () => {
    setConsentChoice("accepted")
    updateConsentStatus("accepted")
    updatePostHogConsent("accepted")
    updateMetaConsent("accepted")
    setShowBanner(false)
    debugLog("consent accepted", { acceptedAt: Date.now() })
  }

  const handleReject = () => {
    setConsentChoice("rejected")
    updateConsentStatus("rejected")
    updatePostHogConsent("rejected")
    updateMetaConsent("rejected")
    setShowBanner(false)
    debugLog("consent rejected", { rejectedAt: Date.now() })
  }

  const handleDismiss = () => {
    setShowBanner(false)
    debugLog("banner dismissed")
  }

  if (isLoading || !showBanner) {
    return null
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/98 backdrop-blur-sm shadow-lg"
      data-testid="cookie-banner"
      data-consent-banner="visible"
      data-shown-at={shownAt ?? undefined}
    >
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              We use cookies to improve the site and measure audience via Google Analytics. You can accept or refuse
              analytics cookies.{" "}
              <Link
                href="/cookies"
                className="font-semibold text-[color:var(--landing-accent-strong)] underline-offset-2 hover:underline dark:text-[color:var(--landing-accent)]"
              >
                Read our Cookie Policy
              </Link>
            </p>
          </div>

          {/* Button group */}
          <div className="flex gap-3 sm:flex-shrink-0">
            <Button onClick={handleReject} size="sm" variant="outline">
              Reject
            </Button>
            <Button
              onClick={handleAccept}
              size="sm"
              className="bg-[color:var(--landing-accent-strong)] text-white hover:bg-[color:var(--landing-accent)] dark:bg-[color:var(--landing-accent)] dark:hover:bg-[color:var(--landing-accent-strong)]"
            >
              Accept All
            </Button>
            <button
              onClick={handleDismiss}
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
