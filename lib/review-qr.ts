import { createHash } from "node:crypto"
import { createServiceRoleClient } from "@/lib/supabase/server"

export function hashSha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

export function getRequestIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown"
  }

  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp.trim()
  return "unknown"
}

export function sanitizeReviewerName(value: unknown): string | null {
  const normalized = typeof value === "string" ? value.trim().slice(0, 80) : ""
  return normalized.length > 0 ? normalized : null
}

export function sanitizeReviewTitle(value: unknown): string | null {
  const normalized = typeof value === "string" ? value.trim().slice(0, 120) : ""
  return normalized.length > 0 ? normalized : null
}

export function sanitizeReviewContent(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 1500) : ""
}

function normalizeReviewUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`
    const parsed = new URL(withProtocol)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    return parsed.toString()
  } catch {
    return null
  }
}

async function getPlatformReviewUrl(configKey: string, envFallbackKey?: string): Promise<string | null> {
  const envUrl = envFallbackKey ? normalizeReviewUrl(process.env[envFallbackKey]) : null

  try {
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from("platform_config")
      .select("value")
      .eq("key", configKey)
      .maybeSingle()

    if (!error && data?.value) {
      const dbUrl = normalizeReviewUrl(data.value)
      if (dbUrl) return dbUrl
    }
  } catch (error) {
    console.warn(`[review-qr] Failed to read platform config for ${configKey}; using env fallback if present.`, error)
  }

  return envUrl || null
}

export async function getPlatformGoogleReviewUrl(): Promise<string | null> {
  return getPlatformReviewUrl("google_platform_review_url", "GOOGLE_PLATFORM_REVIEW_URL")
}

export async function getPlatformTrustpilotReviewUrl(): Promise<string | null> {
  return getPlatformReviewUrl("trustpilot_platform_review_url", "TRUSTPILOT_PLATFORM_REVIEW_URL")
}

export function mapQrRpcError(errorMessage: string): { status: number; message: string } {
  const code = String(errorMessage || "").toUpperCase()

  if (code.includes("SESSION_CREATE_CONFLICT")) {
    return { status: 409, message: "Review session is already being opened. Please retry once." }
  }
  if (code.includes("DUPLICATE KEY VALUE") || code.includes("UNIQUE CONSTRAINT")) {
    return { status: 409, message: "A review session is already active. Please refresh and try again." }
  }
  if (code.includes("GUIDE_NOT_ALLOWLISTED")) {
    return { status: 403, message: "Your account is not enabled for QR review pilot in this city." }
  }
  if (code.includes("SCHEDULE_NOT_OWNED")) {
    return { status: 403, message: "You can only create review sessions for your own tours." }
  }
  if (code.includes("TOUR_NOT_OWNED")) {
    return { status: 403, message: "You can only access review QR for your own tour." }
  }
  if (code.includes("INVALID_TOUR_QR_TOKEN")) {
    return { status: 404, message: "This tour review QR link is invalid." }
  }
  if (code.includes("SESSION_NOT_FOR_TOUR_LINK")) {
    return { status: 409, message: "Selected tour slot is no longer available for reviews." }
  }
  if (code.includes("NO_ELIGIBLE_ATTENDANCE")) {
    return { status: 400, message: "No eligible attended adults found. Mark attendance first." }
  }
  if (code.includes("SESSION_NOT_FOUND")) {
    return { status: 404, message: "This review QR link is invalid." }
  }
  if (code.includes("SESSION_NOT_ACTIVE")) {
    return { status: 409, message: "This review session is closed." }
  }
  if (code.includes("SESSION_EXPIRED")) {
    return { status: 410, message: "This review session has expired." }
  }
  if (code.includes("NO_SLOTS_LEFT")) {
    return { status: 409, message: "All verified review slots have already been used." }
  }
  if (code.includes("INVALID_RATING")) {
    return { status: 400, message: "Rating must be between 1 and 5." }
  }
  if (code.includes("CONTENT_TOO_SHORT")) {
    return { status: 400, message: "Please write at least 20 characters." }
  }
  if (code.includes("IP_RATE_LIMITED")) {
    return { status: 429, message: "Too many submissions from this connection. Please try again later." }
  }
  if (code.includes("IP_TOUR_RATE_LIMITED")) {
    return { status: 429, message: "Only one review per connection is allowed for this tour in 24 hours." }
  }
  if (code.includes("REVIEW_QR_TOUR_LINKS") && code.includes("DOES NOT EXIST")) {
    return { status: 500, message: "QR database setup is incomplete. Run the latest QR SQL migration first." }
  }
  if (code.includes("PUBLIC_TOKEN") && code.includes("DOES NOT EXIST")) {
    return { status: 500, message: "QR table schema is outdated. Re-run the latest QR SQL migration." }
  }
  if (code.includes("SUPABASE_SERVICE_ROLE_KEY IS NOT SET")) {
    return { status: 500, message: "Server configuration missing SUPABASE_SERVICE_ROLE_KEY." }
  }
  if (code.includes("FUNCTION") && code.includes("GET_OR_CREATE_REVIEW_QR_TOUR_LINK") && code.includes("DOES NOT EXIST")) {
    return { status: 500, message: "Tour QR DB function is missing. Run the latest QR SQL migration." }
  }
  if (code.includes("COLUMN REFERENCE") && code.includes("AMBIGUOUS")) {
    return { status: 500, message: "QR SQL function is outdated. Re-run the latest QR SQL migration." }
  }

  return { status: 500, message: "Unable to process request right now." }
}

export function isRetryableQrSessionConflict(errorMessage: string): boolean {
  const code = String(errorMessage || "").toUpperCase()
  return (
    code.includes("DUPLICATE KEY VALUE") ||
    code.includes("UNIQUE CONSTRAINT") ||
    code.includes("REVIEW_QR_SESSIONS_ONE_ACTIVE_PER_SCHEDULE_UIDX") ||
    code.includes("SESSION_CREATE_CONFLICT")
  )
}
