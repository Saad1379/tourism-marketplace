import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { booking_id, attended } = body

    if (!booking_id || typeof attended !== "boolean") {
      return NextResponse.json({ error: "booking_id and attended are required" }, { status: 400 })
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(
        `
          id,
          tourist_id,
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

    if (booking.tourist_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    if (booking.status !== "completed") {
      return NextResponse.json({ error: "Only completed bookings can be confirmed" }, { status: 400 })
    }

    const { data: existingAttendance, error: attendanceFetchError } = await supabase
      .from("attendance")
      .select("id")
      .eq("booking_id", booking_id)
      .single()

    if (attendanceFetchError && attendanceFetchError.code !== "PGRST116") {
      return NextResponse.json({ error: attendanceFetchError.message }, { status: 400 })
    }

    if (existingAttendance) {
      const { error: updateError } = await supabase
        .from("attendance")
        .update({
          confirmed_by_tourist: true,
          attended,
        })
        .eq("id", existingAttendance.id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 })
      }
    } else {
      const guideId = booking.schedule?.tour?.guide_id
      if (!guideId) {
        return NextResponse.json({ error: "Guide not found for booking" }, { status: 400 })
      }

      const { error: insertError } = await supabase
        .from("attendance")
        .insert({
          booking_id,
          guide_id: guideId,
          adults_attended: 0,
          children_attended: 0,
          attended,
          confirmed_by_guide: false,
          confirmed_by_tourist: true,
        })

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Error in POST /api/attendance/confirm:", errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
