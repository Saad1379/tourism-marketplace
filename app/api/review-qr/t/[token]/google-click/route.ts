import { type NextRequest, NextResponse } from "next/server"
import { getRequestIp, hashSha256Hex } from "@/lib/review-qr"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

type TourStateRow = {
  tour_id: string
  guide_id: string
  session_id: string | null
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-fA-F-]{36}$/.test(value)
}

export const runtime = "nodejs"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params
    const body = await request.json().catch(() => ({}))
    const reviewId = isUuid(body?.review_id) ? body.review_id : null
    const sessionId = isUuid(body?.session_id) ? body.session_id : null

    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createServiceRoleClient()
      : await createClient()
    const { data: tourStateData, error: stateError } = await supabase.rpc("get_review_qr_tour_public_state", {
      p_public_token: token.trim(),
    })

    if (stateError) {
      return NextResponse.json({ error: "Unable to validate tour QR token." }, { status: 400 })
    }

    const rows = (Array.isArray(tourStateData) ? tourStateData : []) as TourStateRow[]
    if (rows.length === 0) {
      return NextResponse.json({ error: "Tour review session not found." }, { status: 404 })
    }

    const row = sessionId
      ? rows.find((item) => item.session_id === sessionId) || rows[0]
      : rows[0]

    const ipHash = hashSha256Hex(getRequestIp(request))
    const userAgentHash = hashSha256Hex(request.headers.get("user-agent") || "unknown")

    const { error: insertError } = await supabase.from("review_qr_google_events").insert({
      session_id: sessionId || row.session_id || null,
      review_id: reviewId,
      tour_id: row.tour_id,
      guide_id: row.guide_id,
      ip_hash: ipHash,
      user_agent_hash: userAgentHash,
    })

    if (insertError && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Unable to track click." }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[review-qr] Failed to track tour QR Google click:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
