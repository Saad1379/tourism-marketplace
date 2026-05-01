import { type NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { ensureProfile } from "@/lib/supabase/ensure-profile"
import { isSeller } from "@/lib/marketplace/roles"

/**
 * POST /api/attendance
 *
 * Mark attendance for a completed booking slot.
 * Only the seller (guide) who owns the resource can mark attendance.
 *
 * REFACTOR: Replaced hardcoded `profile.role !== "guide"` with the generic
 * `isSeller()` helper so this route works for both old ("guide") and new
 * ("seller") role values.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const profile = await ensureProfile(supabase, user as any)
    if (!profile || !isSeller(profile.role)) {
      return NextResponse.json({ error: "Only sellers can mark attendance" }, { status: 403 })
    }

    const body = await request.json()
    const { booking_id, adults_attended = 0, children_attended = 0 } = body

    if (!booking_id) {
      return NextResponse.json({ error: "booking_id is required" }, { status: 400 })
    }

    if (adults_attended < 0 || children_attended < 0) {
      return NextResponse.json({ error: "Attendance counts must be positive" }, { status: 400 })
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(
        `
          id,
          adults,
          children,
          status,
          resource_type,
          resource_id,
          resource_schedule_id,
          schedule:tour_schedules(
            id,
            tour:tours(id, guide_id)
          )
        `,
      )
      .eq("id", booking_id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    // Verify that the current user is the seller for this booking's resource
    let isOwner = false

    if (booking.resource_type === "tour") {
      const guideId = (booking.schedule as any)?.tour?.guide_id
      isOwner = guideId === user.id
    } else if (booking.resource_type === "car") {
      const { data: car } = await supabase
        .from("cars")
        .select("seller_id")
        .eq("id", booking.resource_id)
        .single()
      isOwner = car?.seller_id === user.id
    }

    if (!isOwner) {
      return NextResponse.json(
        { error: "You can only mark attendance for your own listings" },
        { status: 403 },
      )
    }

    const maxAdults = booking.adults ?? 0
    const maxChildren = booking.children ?? 0

    if (adults_attended > maxAdults || children_attended > maxChildren) {
      return NextResponse.json({ error: "Attendance exceeds booking guest counts" }, { status: 400 })
    }

    const { error: attendanceError } = await supabase
      .from("attendance")
      .insert({
        booking_id,
        guide_id: user.id, // kept as guide_id for DB backward compat
        adults_attended,
        children_attended,
        attended: true,
        confirmed_by_guide: true,
      })

    if (attendanceError) {
      return NextResponse.json({ error: attendanceError.message }, { status: 400 })
    }

    const { error: bookingUpdateError } = await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", booking_id)

    if (bookingUpdateError) {
      return NextResponse.json({ error: bookingUpdateError.message }, { status: 400 })
    }

    // Finalize held credits (tour-only side effect)
    if (booking.resource_type === "tour") {
      const { error: finalizeError } = await supabase.rpc("finalize_credits_on_attendance", {
        p_booking_id: booking_id,
      })

      if (finalizeError) {
        console.error("[v0] Error finalizing credits:", finalizeError)
      }
    }

    // Auto-open QR review session for tours
    let reviewQrSessionOpened = false
    if (booking.resource_type === "tour") {
      try {
        const scheduleId =
          booking.resource_schedule_id ?? (booking.schedule as any)?.id
        if (scheduleId) {
          const serviceSupabase = createServiceRoleClient()
          const { error: qrSessionError } = await serviceSupabase.rpc(
            "create_review_qr_session",
            {
              p_schedule_id: scheduleId,
              p_guide_id: user.id,
              p_ttl_minutes: 180,
            },
          )

          if (qrSessionError) {
            console.warn(
              "[v0] Attendance marked but QR session auto-open failed:",
              qrSessionError.message,
            )
          } else {
            reviewQrSessionOpened = true
          }
        }
      } catch (qrError) {
        console.warn("[v0] Attendance marked but QR session auto-open exception:", qrError)
      }
    }

    return NextResponse.json({ success: true, reviewQrSessionOpened })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Error in POST /api/attendance:", errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
