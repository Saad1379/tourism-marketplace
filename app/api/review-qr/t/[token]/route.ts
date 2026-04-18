import { type NextRequest, NextResponse } from "next/server"
import { mapQrRpcError } from "@/lib/review-qr"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

type TourStateRow = {
  tour_id: string
  guide_id: string
  tour_title: string
  guide_name: string
  session_id: string | null
  schedule_id: string | null
  schedule_start_time: string | null
  slots_total: number | null
  slots_used: number | null
  slots_remaining: number | null
  expires_at: string | null
  status: "active" | "closed" | "expired" | null
  is_open: boolean | null
}

export const runtime = "nodejs"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params
    if (!token || token.trim().length < 16) {
      return NextResponse.json({ error: "Invalid tour review QR token." }, { status: 400 })
    }

    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createServiceRoleClient()
      : await createClient()
    const { data, error } = await supabase.rpc("get_review_qr_tour_public_state", {
      p_public_token: token.trim(),
    })

    if (error) {
      const mapped = mapQrRpcError(error.message)
      return NextResponse.json({ error: mapped.message }, { status: mapped.status })
    }

    const rows = (Array.isArray(data) ? data : []) as TourStateRow[]
    if (rows.length === 0) {
      return NextResponse.json({ error: "Tour review QR not found." }, { status: 404 })
    }

    const first = rows[0]
    const activeSessions = rows
      .filter((row) => row.session_id && row.is_open)
      .map((row) => ({
        sessionId: String(row.session_id),
        scheduleId: String(row.schedule_id || ""),
        startTime: row.schedule_start_time,
        slotsTotal: Number(row.slots_total || 0),
        slotsUsed: Number(row.slots_used || 0),
        slotsRemaining: Number(row.slots_remaining || 0),
        expiresAt: row.expires_at,
        status: row.status,
        isOpen: Boolean(row.is_open),
      }))

    return NextResponse.json({
      tourId: first.tour_id,
      guideId: first.guide_id,
      tourTitle: first.tour_title,
      guideName: first.guide_name,
      activeSessions,
      hasOpenSession: activeSessions.length > 0,
    })
  } catch (error) {
    console.error("[review-qr] Failed to fetch tour QR state:", error)
    const mapped = mapQrRpcError(error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: mapped.message }, { status: mapped.status })
  }
}
