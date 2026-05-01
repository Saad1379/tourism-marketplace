"use client"

import posthog from "posthog-js"
import type { ConsentChoice } from "@/components/cookies/cookie-utils"

type PostHogTraits = Record<string, string | number | boolean | null | undefined>

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const DEFAULT_POSTHOG_HOST = "https://eu.posthog.com"
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_POSTHOG_HOST

let isInitialized = false
let isCaptureEnabled = false
let queuedIdentity: { userId: string; traits?: PostHogTraits } | null = null
let activeApiHost = resolveHosts(POSTHOG_HOST).apiHost

type PostHogHosts = {
  apiHost: string
  uiHost: string
}

function shouldLogDebug() {
  return process.env.NODE_ENV !== "production"
}

function debugLog(message: string, payload?: Record<string, unknown>) {
  if (!shouldLogDebug()) return
  if (payload) {
    console.info(`[v0] PostHog: ${message}`, payload)
    return
  }
  console.info(`[v0] PostHog: ${message}`)
}

function isConfigured() {
  return Boolean(POSTHOG_KEY)
}

function resolveHosts(baseHost: string): PostHogHosts {
  try {
    const url = new URL(baseHost)
    const uiHost = `${url.protocol}//${url.hostname}`

    const apiUrl = new URL(baseHost)
    if (apiUrl.hostname === "eu.posthog.com") {
      apiUrl.hostname = "eu.i.posthog.com"
    } else if (apiUrl.hostname === "us.posthog.com") {
      apiUrl.hostname = "us.i.posthog.com"
    } else if (!apiUrl.hostname.includes(".i.")) {
      apiUrl.hostname = `i.${apiUrl.hostname}`
    }

    return {
      apiHost: `${apiUrl.protocol}//${apiUrl.hostname}`,
      uiHost,
    }
  } catch {
    return {
      apiHost: "https://eu.i.posthog.com",
      uiHost: "https://eu.posthog.com",
    }
  }
}

function flushQueuedIdentity() {
  if (!queuedIdentity || !isCaptureEnabled || !isInitialized) return
  posthog.identify(queuedIdentity.userId, queuedIdentity.traits)
  debugLog("identity synced", { distinctId: queuedIdentity.userId })
}

function readDistinctIdFromPersistence() {
  if (typeof window === "undefined" || !POSTHOG_KEY) return null

  try {
    const storageKey = `ph_${POSTHOG_KEY}_posthog`
    const payload = window.localStorage.getItem(storageKey)
    if (!payload) return null

    const parsed = JSON.parse(payload) as { distinct_id?: string; $device_id?: string }
    return parsed.distinct_id || parsed.$device_id || null
  } catch {
    return null
  }
}

function getDistinctId() {
  const sdkDistinctId = posthog.get_distinct_id?.()
  if (sdkDistinctId) return sdkDistinctId
  return readDistinctIdFromPersistence() || "touricho-anonymous"
}

async function captureDirect(event: string, properties: Record<string, unknown>) {
  if (typeof window === "undefined" || !POSTHOG_KEY || !isCaptureEnabled) return

  const body = {
    api_key: POSTHOG_KEY,
    event,
    distinct_id: getDistinctId(),
    properties: {
      ...properties,
      $source: "touricho-client",
    },
  }

  try {
    const response = await fetch(`${activeApiHost}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    })

    debugLog("direct capture sent", {
      event,
      status: response.status,
    })
  } catch (error) {
    debugLog("direct capture failed", { event, error: String(error) })
  }
}

function ensureInitialized() {
  if (typeof window === "undefined" || isInitialized || !isConfigured()) return

  const { apiHost, uiHost } = resolveHosts(POSTHOG_HOST)
  activeApiHost = apiHost
  posthog.init(POSTHOG_KEY!, {
    api_host: apiHost,
    ui_host: uiHost,
    api_transport: "fetch",
    request_batching: false,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    person_profiles: "identified_only",
    persistence: "localStorage+cookie",
    loaded: () => {
      debugLog("sdk loaded", { host: POSTHOG_HOST })
    },
  })

  isInitialized = true
  debugLog("sdk initialized", { apiHost, uiHost })
}

export function initPostHog(consent: ConsentChoice = null) {
  if (typeof window === "undefined") return

  if (!isConfigured()) {
    debugLog("skipped init (missing NEXT_PUBLIC_POSTHOG_KEY)")
    return
  }

  if (consent === "accepted") {
    updatePostHogConsent("accepted")
    return
  }

  // Do not initialize PostHog on rejected/no-consent to avoid non-essential storage.
  isCaptureEnabled = false
  if (isInitialized) {
    posthog.opt_out_capturing()
    posthog.reset()
    debugLog("capture disabled from initial consent state")
  }
}

export function updatePostHogConsent(consent: "accepted" | "rejected") {
  isCaptureEnabled = consent === "accepted"

  if (typeof window === "undefined" || !isConfigured()) return

  if (isCaptureEnabled) {
    ensureInitialized()
    if (!isInitialized) return

    posthog.opt_in_capturing()
    debugLog("capture enabled from consent")
    flushQueuedIdentity()
  } else {
    if (!isInitialized) {
      debugLog("capture disabled from consent (sdk not initialized)")
      return
    }

    posthog.opt_out_capturing()
    posthog.reset()
    debugLog("capture disabled from consent")
  }
}

export function trackPostHogPageView(path: string) {
  if (!isCaptureEnabled || typeof window === "undefined") return

  ensureInitialized()
  if (!isInitialized) return

  const payload = {
    path,
    $current_url: window.location.href,
  }

  posthog.capture("$pageview", payload)
  void captureDirect("$pageview", payload)
  debugLog("captured pageview", { path })
}

export function trackPostHogEvent(action: string, payload: Record<string, unknown> = {}) {
  if (!isCaptureEnabled) return

  ensureInitialized()
  if (!isInitialized) return

  posthog.capture(action, payload)
  void captureDirect(action, payload)
  debugLog("captured event", { action })
}

export function identifyPostHogUser(userId: string, traits?: PostHogTraits) {
  if (!userId) return

  queuedIdentity = { userId, traits }
  if (!isCaptureEnabled) return
  ensureInitialized()
  if (!isInitialized) return
  flushQueuedIdentity()
}

export function resetPostHogUser() {
  queuedIdentity = null
  if (!isInitialized) return

  posthog.reset()
  debugLog("identity reset")
}
