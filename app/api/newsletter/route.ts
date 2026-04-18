import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"

function normalizeEmail(value: string): string {
  return String(value || "").trim().toLowerCase()
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function parseSource(value: string): string {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .slice(0, 64)

  return normalized || "website_newsletter"
}

async function parseNewsletterPayload(request: Request) {
  const contentType = request.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}))
    return {
      email: normalizeEmail(String(body?.email || "")),
      source: parseSource(String(body?.source || "website_newsletter")),
      isHtmlForm: false,
    }
  }

  const formData = await request.formData()
  return {
    email: normalizeEmail(String(formData.get("email") || "")),
    source: parseSource(String(formData.get("source") || "website_newsletter")),
    isHtmlForm: true,
  }
}

function resolveSafeRedirect(request: Request): URL {
  const fallback = new URL("/", request.url)
  const referer = request.headers.get("referer")
  if (!referer) return fallback

  try {
    const refererUrl = new URL(referer)
    if (refererUrl.origin !== fallback.origin) return fallback
    return new URL(`${refererUrl.pathname}${refererUrl.search}`, fallback.origin)
  } catch {
    return fallback
  }
}

export async function POST(request: Request) {
  const { email, source, isHtmlForm } = await parseNewsletterPayload(request)
  if (!email || !isValidEmail(email)) {
    if (isHtmlForm) {
      return NextResponse.redirect(resolveSafeRedirect(request), 303)
    }
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 })
  }

  try {
    const supabase = createServiceRoleClient()
    const now = new Date().toISOString()

    const { error } = await supabase
      .from("newsletter_subscribers")
      .upsert(
        {
          email,
          email_normalized: email,
          source,
          consented_at: now,
          updated_at: now,
        },
        { onConflict: "email_normalized" },
      )

    if (error) {
      throw new Error(error.message)
    }

    if (isHtmlForm) {
      return NextResponse.redirect(resolveSafeRedirect(request), 303)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Newsletter subscribe failed:", error)

    if (isHtmlForm) {
      return NextResponse.redirect(resolveSafeRedirect(request), 303)
    }

    return NextResponse.json({ error: "Unable to subscribe right now." }, { status: 500 })
  }
}
