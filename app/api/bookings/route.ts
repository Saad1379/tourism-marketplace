import { createClient } from "@/lib/supabase/server"
import { ensureProfile } from "@/lib/supabase/ensure-profile"
import { type NextRequest, NextResponse } from "next/server"
import { sendBookingConfirmationEmails } from "@/lib/email/mailgun"
import { capturePostHogServerEvent } from "@/lib/analytics/posthog-server"
import { resolveTourTimeZone } from "@/lib/timezone"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role") || "guide"

  const query = supabase.from("bookings").select(`
  id,
  status,
  created_at,
  adults,
  children,
  total_guests,
  credits_charged,
  payment_status,
  attendance(
    id,
    attended,
    confirmed_by_guide,
    confirmed_by_tourist
  ),
  tour_schedules(
    id,
    start_time,
    capacity,
    tours(
      id,
      title,
      city,
      country,
      price,
      meeting_point,
      duration_minutes,
      images,
      photos,
      guide_id,
      guide:guide_id(id, full_name, avatar_url)
    )
  ),
  tourist:tourist_id(id, full_name, avatar_url, email),
  reviews!reviews_booking_id_fkey(id)
`)

    if (role === "guide") {
      const { data: guideSchedules, error: schedulesError } = await supabase
        .from("tour_schedules")
        .select("id, tours!inner(guide_id)")
        .eq("tours.guide_id", user.id)

      if (schedulesError) {
        return NextResponse.json({ error: schedulesError.message }, { status: 400 })
      }

      const scheduleIds = (guideSchedules || []).map((schedule: any) => schedule.id)
      if (scheduleIds.length === 0) {
        return NextResponse.json([])
      }

      const { data, error } = await query.in("schedule_id", scheduleIds).order("created_at", { ascending: false })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json(data || [])
    }

    const { data, error } = await query.eq("tourist_id", user.id).order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("[v0] Server error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Ensure profile exists
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

    // Get tour details to find guide
    const { data: tourData, error: tourError } = await supabase
      .from("tour_schedules")
      .select("tour_id")
      .eq("id", schedule_id)
      .single()

    if (tourError || !tourData) {
      return NextResponse.json({ error: "Tour not found" }, { status: 404 })
    }

    const { data: tour } = await supabase
      .from("tours")
      .select("guide_id, title, meeting_point, city, city_slug, country")
      .eq("id", tourData.tour_id)
      .single()

    const guideId = tour?.guide_id
    if (!guideId) {
      return NextResponse.json({ error: "Guide not found" }, { status: 404 })
    }

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        schedule_id,
        tourist_id: user.id,
        adults,
        children,
        total_guests: totalGuests,
        status: "pending",
        payment_status: "completed",
        credits_charged: 0,
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating booking:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const { data: confirmedBooking, error: confirmError } = await supabase
      .from("bookings")
      .update({ status: "confirmed" })
      .eq("id", data.id)
      .select()
      .single()

    if (confirmError) {
      console.error("[v0] Error confirming booking:", confirmError)
      await supabase.from("bookings").delete().eq("id", data.id)
      return NextResponse.json({ error: confirmError.message }, { status: 400 })
    }

    void capturePostHogServerEvent({
      event: "booking_completed_server",
      distinctId: user.id,
      insertId: `booking:${confirmedBooking.id}`,
      properties: {
        booking_id: confirmedBooking.id,
        schedule_id,
        tour_id: tourData.tour_id,
        adults,
        children,
        total_guests: totalGuests,
      },
    })

    // Send confirmation emails (non-blocking — don't fail the booking if email fails)
    try {
      const { data: guideProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", guideId)
        .single()

      if (guideProfile?.email) {
        const tourTimeZone = resolveTourTimeZone({
          citySlug: tour?.city_slug,
          city: tour?.city,
          country: tour?.country,
        })

        await sendBookingConfirmationEmails({
          touristName: profile.full_name || user.email!,
          touristEmail: user.email!,
          guideName: guideProfile.full_name || "Guide",
          guideEmail: guideProfile.email,
          tourTitle: tour?.title || "Tour",
          tourDate: schedule.start_time,
          tourTime: schedule.start_time,
          tourTimeZone,
          meetingPoint: tour?.meeting_point || "",
          adults,
          children,
          bookingId: confirmedBooking.id,
        })
      }
    } catch (emailError) {
      console.error("[v0] Failed to send booking confirmation emails:", emailError)
    }

    return NextResponse.json(confirmedBooking, { status: 201 })
  } catch (error) {
    console.error("[v0] Server error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { bookingId } = body

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 })
    }

    // Fetch booking to verify ownership and get tour details
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select(`
        id, 
        tourist_id, 
        status, 
        credits_charged,
        schedule:tour_schedules(
          start_time,
          tour:tours(guide_id)
        )
      `)
      .eq("id", bookingId)
      .single()

    if (fetchError || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    // Verify tourist owns this booking
    if (booking.tourist_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Only allow cancelling upcoming/confirmed bookings
    if (booking.status !== "confirmed" && booking.status !== "upcoming") {
      return NextResponse.json({ error: `Cannot cancel a ${booking.status} booking` }, { status: 400 })
    }

    // Update booking status to cancelled (trigger will handle refund)
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId)
      .select()
      .single()

    if (error) {
      console.error("[v0] Error cancelling booking:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Server error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
