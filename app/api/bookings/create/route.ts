import { createClient } from "@/lib/supabase/server"
import { ensureProfile } from "@/lib/supabase/ensure-profile"
import { type NextRequest, NextResponse } from "next/server"
import { capturePostHogServerEvent } from "@/lib/analytics/posthog-server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const profile = await ensureProfile(supabase, user as { id: string; email: string })
    if (!profile) {
      return NextResponse.json({ error: "Failed to access or create profile" }, { status: 500 })
    }

    const body = await request.json()
    const { schedule_id, adults = 1, children = 0 } = body

    if (!schedule_id || typeof schedule_id !== "string") {
      return NextResponse.json({ error: "schedule_id is required" }, { status: 400 })
    }
    if (!/^[0-9a-fA-F-]{36}$/.test(schedule_id)) {
      return NextResponse.json({ error: "schedule_id must be a valid UUID" }, { status: 400 })
    }

    const totalGuests = adults + children

    if (totalGuests === 0) {
      return NextResponse.json({ error: "At least one adult is required" }, { status: 400 })
    }

    const { data: schedule, error: scheduleError } = await supabase
      .from("tour_schedules")
      .select("*, _booked_count:bookings(count)")
      .eq("id", schedule_id)
      .single()

    if (scheduleError || !schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 })
    }

    const bookedCount = schedule._booked_count?.[0]?.count || 0
    const availableCapacity = (schedule.capacity || 10) - bookedCount

    if (totalGuests > availableCapacity) {
      return NextResponse.json(
        { error: `Only ${availableCapacity} spot${availableCapacity === 1 ? "" : "s"} available` },
        { status: 400 },
      )
    }

    const { data: existingBooking, error: existingError } = await supabase
      .from("bookings")
      .select("id, status")
      .eq("schedule_id", schedule_id)
      .eq("tourist_id", user.id)
      .in("status", ["pending", "confirmed", "upcoming"])
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 400 })
    }

    if (existingBooking) {
      return NextResponse.json({ error: "You already have an active booking for this schedule." }, { status: 409 })
    }

    const { data: existingTourBooking, error: existingTourError } = await supabase
      .from("bookings")
      .select(`
        id,
        status,
        schedule_id,
        tour_schedules!inner(
          id,
          tour_id,
          start_time
        )
      `)
      .eq("tourist_id", user.id)
      .in("status", ["pending", "confirmed", "upcoming"])
      .eq("tour_schedules.tour_id", schedule.tour_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingTourError) {
      return NextResponse.json({ error: existingTourError.message }, { status: 400 })
    }

    if (existingTourBooking) {
      const existingSchedule = Array.isArray(existingTourBooking.tour_schedules)
        ? existingTourBooking.tour_schedules[0]
        : existingTourBooking.tour_schedules
      const existingStartTime = existingSchedule?.start_time ? new Date(existingSchedule.start_time) : null
      const when = existingStartTime && Number.isFinite(existingStartTime.getTime())
        ? existingStartTime.toLocaleString()
        : "another date"

      return NextResponse.json(
        { error: `You already have an active booking for this tour (${when}). Cancel it first to book another date.` },
        { status: 409 },
      )
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        schedule_id,
        tourist_id: user.id,
        adults,
        children,
        total_guests: totalGuests,
        status: "pending",
        payment_status: "completed",
      })
      .select()
      .single()

    if (bookingError) {
      console.error("[v0] Error creating booking:", bookingError)
      return NextResponse.json({ error: bookingError.message }, { status: 400 })
    }

    const { data: confirmedBooking, error: confirmError } = await supabase
      .from("bookings")
      .update({ status: "confirmed" })
      .eq("id", booking.id)
      .select()
      .single()

    if (confirmError) {
      console.error("[v0] Error confirming booking:", confirmError)
      await supabase.from("bookings").delete().eq("id", booking.id)
      return NextResponse.json({ error: confirmError.message }, { status: 400 })
    }

    void capturePostHogServerEvent({
      event: "booking_completed_server",
      distinctId: user.id,
      insertId: `booking:${confirmedBooking.id}`,
      properties: {
        booking_id: confirmedBooking.id,
        schedule_id,
        tour_id: schedule.tour_id || null,
        adults,
        children,
        total_guests: totalGuests,
      },
    })

    return NextResponse.json(confirmedBooking, { status: 201 })
  } catch (error) {
    console.error("[v0] Server error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
