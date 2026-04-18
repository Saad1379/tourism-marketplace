"use client"

// GTM-first analytics dispatcher for TipWalk.
// Google events flow through dataLayer; PostHog mirrors the same funnel events.
import { getConsentChoice, type ConsentChoice } from "@/components/cookies/cookie-utils"
import { CONSENT_DENIED_REGIONS } from "./consent-regions"
import { trackPostHogEvent } from "./posthog"

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown> | unknown[]>
    gtag?: (...args: unknown[]) => void
  }
}

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || process.env.GOOGLE_TAG_MANAGER_ID || "GTM-TZ5KDWDD"

const CONSENT_DENIED = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
} as const

const CONSENT_GRANTED = {
  analytics_storage: "granted",
  ad_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
} as const
const CONSENT_WAIT_FOR_UPDATE_MS = 500
const CONSENT_DEFAULT_GRANTED = {
  ...CONSENT_GRANTED,
  wait_for_update: CONSENT_WAIT_FOR_UPDATE_MS,
} as const
const CONSENT_DEFAULT_DENIED_FOR_REGIONS = {
  ...CONSENT_DENIED,
  region: [...CONSENT_DENIED_REGIONS],
  wait_for_update: CONSENT_WAIT_FOR_UPDATE_MS,
} as const

const GTM_LOAD_IDLE_TIMEOUT_MS = 1400
const GTM_SCRIPT_ATTR = "data-tipwalk-gtm-script"

let hasInitializedGoogle = false
let hasLoadedGtmScript = false
let hasScheduledGtmLoad = false
let gtmIdleHandle: number | null = null
let gtmTimeoutHandle: number | null = null
let consentState: ConsentChoice = null
const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const
type UTMParamKey = (typeof UTM_PARAMS)[number]

function debugLog(message: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return
  if (payload) {
    console.info(`[TipWalk Analytics] ${message}`, payload)
    return
  }
  console.info(`[TipWalk Analytics] ${message}`)
}

function ensureDataLayer() {
  if (typeof window === "undefined") return
  window.dataLayer = window.dataLayer || []
}

function clearGtmLoadTimers() {
  if (typeof window === "undefined") return
  if (gtmIdleHandle !== null && typeof window.cancelIdleCallback === "function") {
    window.cancelIdleCallback(gtmIdleHandle)
  }
  if (gtmTimeoutHandle !== null) {
    window.clearTimeout(gtmTimeoutHandle)
  }
  gtmIdleHandle = null
  gtmTimeoutHandle = null
}

function ensureGtagProxy() {
  if (typeof window === "undefined") return
  if (window.gtag) return
  window.gtag = (...args: unknown[]) => {
    window.dataLayer?.push(args)
  }
}

function pushGoogleConsent(mode: "default" | "update", payload: Record<string, unknown>) {
  if (typeof window === "undefined") return
  ensureDataLayer()
  ensureGtagProxy()
  window.gtag?.("consent", mode, payload)
}

function hasConsent(): boolean {
  if (consentState === "accepted") return true
  if (consentState === "rejected") return false

  const savedConsent = getConsentChoice()
  consentState = savedConsent
  return savedConsent === "accepted"
}

function pushEventToDataLayer(event: Record<string, unknown>) {
  if (typeof window === "undefined") return
  ensureDataLayer()
  window.dataLayer?.push(event)
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production"
}

function injectGtmScript() {
  if (typeof window === "undefined" || !GTM_ID || hasLoadedGtmScript) return

  const existingScript =
    document.querySelector<HTMLScriptElement>(`script[${GTM_SCRIPT_ATTR}="true"]`) ||
    document.querySelector<HTMLScriptElement>(`script[src*="googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}"]`)

  if (existingScript) {
    hasLoadedGtmScript = true
    hasScheduledGtmLoad = false
    clearGtmLoadTimers()
    debugLog("google tag script already present", { gtmId: GTM_ID })
    return
  }

  pushEventToDataLayer({
    "gtm.start": Date.now(),
    event: "gtm.js",
  })

  const script = document.createElement("script")
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`
  script.setAttribute(GTM_SCRIPT_ATTR, "true")
  script.onload = () => {
    hasLoadedGtmScript = true
    debugLog("google tag script loaded", { loadedAt: Date.now() })
  }
  script.onerror = () => {
    hasScheduledGtmLoad = false
    debugLog("google tag script failed to load", { gtmId: GTM_ID })
  }
  document.head.appendChild(script)

  hasScheduledGtmLoad = false
  clearGtmLoadTimers()
  debugLog("google tag script injected", { gtmId: GTM_ID, injectedAt: Date.now() })
}

function scheduleGtmLoadOnIdle() {
  if (typeof window === "undefined" || !GTM_ID || hasLoadedGtmScript || hasScheduledGtmLoad) return

  hasScheduledGtmLoad = true
  const runLoad = () => {
    injectGtmScript()
  }

  if (typeof window.requestIdleCallback === "function") {
    gtmIdleHandle = window.requestIdleCallback(() => {
      runLoad()
    }, { timeout: GTM_LOAD_IDLE_TIMEOUT_MS })
  }

  gtmTimeoutHandle = window.setTimeout(() => {
    runLoad()
  }, GTM_LOAD_IDLE_TIMEOUT_MS)

  debugLog("google tag load scheduled", { timeoutMs: GTM_LOAD_IDLE_TIMEOUT_MS })
}

export function initGA(initialConsent: ConsentChoice = null) {
  if (typeof window === "undefined") return

  if (!GTM_ID) {
    console.warn("[TipWalk Analytics] GTM_ID not configured. Skipping GTM initialization.")
    return
  }

  ensureDataLayer()
  ensureGtagProxy()

  if (!hasInitializedGoogle) {
    pushGoogleConsent("default", CONSENT_DEFAULT_GRANTED)
    pushGoogleConsent("default", CONSENT_DEFAULT_DENIED_FOR_REGIONS)
    hasInitializedGoogle = true
    debugLog("google consent defaults applied", {
      gtmId: GTM_ID,
      deniedRegions: CONSENT_DENIED_REGIONS.length,
    })
  }

  consentState = initialConsent
  if (consentState === "accepted") {
    pushGoogleConsent("update", CONSENT_GRANTED)
    scheduleGtmLoadOnIdle()
    debugLog("google consent restored to granted")
    return
  }

  if (consentState === "rejected") {
    pushGoogleConsent("update", CONSENT_DENIED)
    debugLog("google consent restored to denied")
    return
  }

  scheduleGtmLoadOnIdle()
  debugLog("google tag load enabled for default consent state")
}

export function updateConsentStatus(consent: "accepted" | "rejected") {
  consentState = consent
  pushGoogleConsent("update", consent === "accepted" ? CONSENT_GRANTED : CONSENT_DENIED)
  if (consent === "accepted") {
    scheduleGtmLoadOnIdle()
  }
  debugLog("google consent updated", { consent })
}

export function trackPageView(path: string) {
  if (typeof window === "undefined") return
  if (!hasConsent()) return

  pushEventToDataLayer({
    event: "page_view",
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  })
}

export function trackEvent({
  action,
  category,
  label,
  value,
}: {
  action: string
  category: string
  label?: string
  value?: number
}) {
  if (typeof window === "undefined") return
  if (!hasConsent()) return

  pushEventToDataLayer({
    event: action,
    event_category: category,
    event_label: label || "",
    value: value || undefined,
  })
}

function getDefaultFunnelContext() {
  if (typeof window === "undefined") {
    return {
      device_type: "server",
      entry_page: "",
    }
  }

  return {
    device_type: window.innerWidth < 768 ? "mobile" : "desktop",
    entry_page: window.location.pathname,
  }
}

export function trackFunnelEvent(action: string, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return
  const defaults = getDefaultFunnelContext()
  const eventPayload = {
    event_category: "conversion_funnel",
    ...defaults,
    ...payload,
  }

  if (hasConsent()) {
    pushEventToDataLayer({
      event: action,
      ...eventPayload,
    })
  }

  trackPostHogEvent(action, eventPayload)
}

export function pushGa4Event(event: string, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return
  if (!isProductionRuntime()) return
  if (!hasConsent()) return

  pushEventToDataLayer({
    event,
    ...payload,
  })
}

export function persistUtmParamsFromQuery(query: string) {
  if (typeof window === "undefined") return

  const normalizedQuery = query.startsWith("?") ? query.slice(1) : query
  const params = new URLSearchParams(normalizedQuery)
  for (const key of UTM_PARAMS) {
    const value = params.get(key)
    if (value) {
      window.sessionStorage.setItem(key, value)
    }
  }
}

export function getStoredUtmParams(): Partial<Record<UTMParamKey, string>> {
  if (typeof window === "undefined") return {}

  const output: Partial<Record<UTMParamKey, string>> = {}
  for (const key of UTM_PARAMS) {
    const value = window.sessionStorage.getItem(key)
    if (value) {
      output[key] = value
    }
  }

  return output
}
