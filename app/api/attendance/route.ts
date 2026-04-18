import { type NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { ensureProfile } from "@/lib/supabase/ensure-profile"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const profile = await ensureProfile(supabase, user)
    if (!profile || profile.role !== "guide") {
      return NextResponse.json({ error: "Only guides can mark attendance" }, { status: 403 })
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

    const guideId = booking.schedule?.tour?.guide_id
    if (guideId !== user.id) {
      return NextResponse.json({ error: "You can only mark attendance for your own tours" }, { status: 403 })
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
        guide_id: user.id,
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

    // Finalize held credits
    const { error: finalizeError } = await supabase.rpc('finalize_credits_on_attendance', {
      p_booking_id: booking_id
    })

    if (finalizeError) {
      console.error('[v0] Error finalizing credits:', finalizeError)
    }

    let reviewQrSessionOpened = false
    try {
      const scheduleId = booking.schedule?.id
      if (scheduleId) {
        const serviceSupabase = createServiceRoleClient()
        const { error: qrSessionError } = await serviceSupabase.rpc("create_review_qr_session", {
          p_schedule_id: scheduleId,
          p_guide_id: user.id,
          p_ttl_minutes: 180,
        })

        if (qrSessionError) {
          console.warn("[v0] Attendance marked but QR session auto-open failed:", qrSessionError.message)
        } else {
          reviewQrSessionOpened = true
        }
      }
    } catch (qrError) {
      console.warn("[v0] Attendance marked but QR session auto-open exception:", qrError)
    }

    return NextResponse.json({ success: true, reviewQrSessionOpened })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Error in POST /api/attendance:", errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
