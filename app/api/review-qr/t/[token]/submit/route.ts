import { type NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import {
  getPlatformGoogleReviewUrl,
  getPlatformTrustpilotReviewUrl,
  getRequestIp,
  hashSha256Hex,
  mapQrRpcError,
  sanitizeReviewContent,
  sanitizeReviewerName,
  sanitizeReviewTitle,
} from "@/lib/review-qr"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { buildCanonicalTourPath, buildCityToursPath, resolveCitySlug, resolveTourSlug } from "@/lib/tour-url"

type SubmitQrReviewRow = {
  review_id: string
  session_id: string
  slots_remaining: number
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-fA-F-]{36}$/.test(value)
}

export const runtime = "nodejs"

async function revalidateTourReviewSurfaces(supabase: any, token: string) {
  const { data: stateData } = await supabase.rpc("get_review_qr_tour_public_state", {
    p_public_token: token.trim(),
  })

  const firstState = Array.isArray(stateData) && stateData.length > 0 ? stateData[0] : null
  const tourId = typeof firstState?.tour_id === "string" ? firstState.tour_id : null
  if (!tourId) return

  const { data: tour } = await supabase
    .from("tours")
    .select("city, city_slug, title, tour_slug")
    .eq("id", tourId)
    .maybeSingle()

  if (!tour) return

  const citySlug = resolveCitySlug(String(tour.city_slug || tour.city || ""))
  const tourSlug = resolveTourSlug(String(tour.tour_slug || tour.title || ""))
  const paths = new Set<string>(["/", "/tours", "/reviews"])

  if (citySlug) {
    paths.add(buildCityToursPath(citySlug))
  }

  if (citySlug && tourSlug) {
    paths.add(buildCanonicalTourPath(citySlug, tourSlug))
  }

  for (const path of paths) {
    try {
      revalidatePath(path)
    } catch (error) {
      console.error("[review-qr] Failed to revalidate path:", path, error)
    }
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params
    const body = await request.json().catch(() => ({}))
    const rating = Number(body?.rating)
    const sessionId = isUuid(body?.session_id) ? body.session_id : ""
    const title = sanitizeReviewTitle(body?.title)
    const content = sanitizeReviewContent(body?.content)
    const reviewerName = sanitizeReviewerName(body?.reviewer_name)

    if (!sessionId) {
      return NextResponse.json({ error: "session_id is required." }, { status: 400 })
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5." }, { status: 400 })
    }

    if (content.length < 20) {
      return NextResponse.json({ error: "Please write at least 20 characters." }, { status: 400 })
    }

    const ipAddress = getRequestIp(request)
    const userAgent = request.headers.get("user-agent") || "unknown"
    const ipHash = hashSha256Hex(ipAddress)
    const uaHash = hashSha256Hex(userAgent)

    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createServiceRoleClient()
      : await createClient()
    const { data, error } = await supabase.rpc("submit_review_via_tour_qr", {
      p_tour_public_token: token.trim(),
      p_session_id: sessionId,
      p_rating: rating,
      p_title: title,
      p_content: content,
      p_reviewer_name: reviewerName,
      p_ip_hash: ipHash,
      p_user_agent_hash: uaHash,
    })

    if (error) {
      const mapped = mapQrRpcError(error.message)
      return NextResponse.json({ error: mapped.message }, { status: mapped.status })
    }

    const row = Array.isArray(data) ? (data[0] as SubmitQrReviewRow | undefined) : undefined
    if (!row?.review_id) {
      return NextResponse.json({ error: "Unable to submit review right now." }, { status: 500 })
    }

    await revalidateTourReviewSurfaces(supabase, token)

    const [googleReviewUrl, trustpilotReviewUrl] = await Promise.all([
      getPlatformGoogleReviewUrl(),
      getPlatformTrustpilotReviewUrl(),
    ])

    return NextResponse.json({
      success: true,
      reviewId: row.review_id,
      sessionId: row.session_id,
      remainingSlots: Number(row.slots_remaining || 0),
      googleReviewUrl: googleReviewUrl || null,
      trustpilotReviewUrl: trustpilotReviewUrl || null,
    })
  } catch (error) {
    console.error("[review-qr] Failed to submit tour QR review:", error)
    const mapped = mapQrRpcError(error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: mapped.message }, { status: mapped.status })
  }
}
