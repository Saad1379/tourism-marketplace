"use client"

import { getConsentChoice, type ConsentChoice } from "@/components/cookies/cookie-utils"

type FbqFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue?: unknown[]
  loaded?: boolean
  version?: string
  push?: (...args: unknown[]) => void
}

declare global {
  interface Window {
    fbq?: FbqFunction
    _fbq?: FbqFunction
    __tipwalkLoadMetaPixel?: () => void
    __tipwalkMetaPixelId?: string
    __tipwalkMetaPixelLoaded?: boolean
    __tipwalkMetaPixelInitialized?: boolean
  }
}

const META_PIXEL_ID = "1573217977123283"

function isProductionRuntime() {
  return process.env.NODE_ENV === "production"
}

function hasConsent() {
  return getConsentChoice() === "accepted"
}

function ensurePixelLoaded() {
  if (typeof window === "undefined") return
  window.__tipwalkLoadMetaPixel?.()
}

function ensurePixelInitialized() {
  if (typeof window === "undefined") return
  if (window.__tipwalkMetaPixelInitialized) return
  if (typeof window.fbq !== "function") return

  window.fbq("init", META_PIXEL_ID)
  window.__tipwalkMetaPixelInitialized = true
}

function canTrack() {
  if (typeof window === "undefined") return false
  if (!isProductionRuntime()) return false
  if (!hasConsent()) return false
  if (!window.__tipwalkMetaPixelInitialized) return false
  return typeof window.fbq === "function"
}

export function initMetaPixel(consent: ConsentChoice = null) {
  if (typeof window === "undefined") return
  if (!isProductionRuntime()) return

  if (consent === "accepted") {
    updateMetaConsent("accepted")
    return
  }

  if (consent === "rejected") {
    updateMetaConsent("rejected")
  }
}

export function updateMetaConsent(consent: "accepted" | "rejected") {
  if (typeof window === "undefined") return
  if (!isProductionRuntime()) return

  if (consent === "accepted") {
    ensurePixelLoaded()
    ensurePixelInitialized()

    if (typeof window.fbq === "function") {
      window.fbq("consent", "grant")
    }
    return
  }

  if (typeof window.fbq === "function") {
    window.fbq("consent", "revoke")
  }
}

export function trackMetaPageView() {
  if (!canTrack()) return
  window.fbq?.("track", "PageView")
}

export function trackMetaLead(payload: {
  currency: string
  value: number
  content_name: string
}) {
  if (!canTrack()) return
  window.fbq?.("track", "Lead", payload)
}

