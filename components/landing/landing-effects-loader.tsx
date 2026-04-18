"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

const EFFECTS_STYLESHEET_HREF = "/landing-effects.css"
const EFFECTS_STYLESHEET_ATTR = "data-tipwalk-landing-effects"
const EFFECTS_LOAD_TIMEOUT_MS = 1400
const EFFECTS_MIN_DELAY_MS = 900

const PROTECTED_PREFIXES = ["/dashboard", "/profile", "/bookings", "/messages", "/admin", "/checkout"]

function debugLog(message: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return
  if (payload) {
    console.info(`[TipWalk Styles] ${message}`, payload)
    return
  }
  console.info(`[TipWalk Styles] ${message}`)
}

function isPublicRoute(pathname: string | null) {
  if (!pathname) return true
  return !PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function ensureEffectsStylesheet() {
  if (typeof document === "undefined") return
  const existing = document.querySelector<HTMLLinkElement>(`link[${EFFECTS_STYLESHEET_ATTR}="true"]`)
  if (existing) return

  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = EFFECTS_STYLESHEET_HREF
  link.setAttribute(EFFECTS_STYLESHEET_ATTR, "true")
  link.onload = () => debugLog("landing effects stylesheet loaded", { loadedAt: Date.now() })
  link.onerror = () => debugLog("landing effects stylesheet failed to load")
  document.head.appendChild(link)
  debugLog("landing effects stylesheet injected", { injectedAt: Date.now() })
}

export function LandingEffectsLoader() {
  const pathname = usePathname()

  useEffect(() => {
    if (!isPublicRoute(pathname)) {
      const existing = document.querySelector<HTMLLinkElement>(`link[${EFFECTS_STYLESHEET_ATTR}="true"]`)
      if (existing) {
        existing.remove()
        debugLog("landing effects stylesheet removed on protected route", { pathname })
      }
      return
    }

    let idleHandle: number | null = null
    let timeoutHandle: number | null = null
    let minDelayHandle: number | null = null
    let hasLoaded = false
    const startedAt = Date.now()

    const loadEffects = (source: "idle" | "timeout") => {
      if (hasLoaded) return
      hasLoaded = true
      ensureEffectsStylesheet()
      debugLog("landing effects load triggered", { source, pathname })
    }

    const scheduleLoad = (source: "idle" | "timeout") => {
      const elapsed = Date.now() - startedAt
      const remaining = Math.max(0, EFFECTS_MIN_DELAY_MS - elapsed)
      if (remaining === 0) {
        loadEffects(source)
        return
      }
      minDelayHandle = window.setTimeout(() => {
        loadEffects(source)
      }, remaining)
    }

    timeoutHandle = window.setTimeout(() => {
      scheduleLoad("timeout")
    }, EFFECTS_LOAD_TIMEOUT_MS)

    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(() => {
        scheduleLoad("idle")
      }, { timeout: EFFECTS_LOAD_TIMEOUT_MS })
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
  }, [pathname])

  return null
}
