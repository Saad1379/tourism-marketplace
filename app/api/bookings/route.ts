import { createClient } from "@/lib/supabase/server"
import { ensureProfile } from "@/lib/supabase/ensure-profile"
import { type NextRequest, NextResponse } from "next/server"
import { sendBookingConfirmationEmails } from "@/lib/email/mailgun"
import { capturePostHogServerEvent } from "@/lib/analytics/posthog-server"
import { resolveTourTimeZone } from "@/lib/timezone"
import { isSeller } from "@/lib/marketplace/roles"
import { createBooking, cancelBooking } from "@/lib/marketplace/booking-engine"
import { tourAdapter } from "@/lib/marketplace/adapters/tour-adapter"
import { carAdapter } from "@/lib/marketplace/adapters/car-adapter"
import type { ResourceType } from "@/lib/marketplace/types"
import type { ResourceAdapter } from "@/lib/marketplace/resource-adapter"

function getAdapter(resourceType: ResourceType): ResourceAdapter {
  if (resourceType === "car") return carAdapter
  return tourAdapter
}

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
    const rawRole = searchParams.get("role") ?? "buyer"
    // Normalize: accept both old ("guide","tourist") and new ("seller","buyer") role names
    const viewAsSeller = rawRole === "guide" || rawRole === "seller"

    const query = supabase.from("bookings").select(`
      id,
      status,
      created_at,
      adults,
      children,
      total_guests,
      credits_charged,
      payment_status,
      resource_type,
      resource_id,
      resource_schedule_id,
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

    if (viewAsSeller) {
      // Return all bookings for slots the current user owns as a seller
      const { data: tourSchedules } = await supabase
        .from("tour_schedules")
        .select("id, tours!inner(guide_id)")
        .eq("tours.guide_id", user.id)

      const { data: carSchedules } = await supabase
        .from("car_schedules")
        .select("id, cars!inner(seller_id)")
        .eq("cars.seller_id", user.id)

      const tourScheduleIds = (tourSchedules ?? []).map((s: any) => s.id)
      const carScheduleIds = (carSchedules ?? []).map((s: any) => s.id)
      const allScheduleIds = [...tourScheduleIds, ...carScheduleIds]

      if (allScheduleIds.length === 0) {
        return NextResponse.json([])
      }

      // Match via both legacy schedule_id and new resource_schedule_id
      const { data, error } = await query
        .or(
          `schedule_id.in.(${allScheduleIds.join(",")}),resource_schedule_id.in.(${allScheduleIds.join(",")})`,
        )
        .order("created_at", { ascending: false })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json(data ?? [])
    }

    // Buyer view — their own bookings
    const { data, error } = await query
      .eq("tourist_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data ?? [])
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

    const profile = await ensureProfile(supabase, user as { id: string; email: string })
    if (!profile) {
      return NextResponse.json({ error: "Failed to access or create profile" }, { status: 500 })
    }

    const body = await request.json()
    const {
      schedule_id,
      adults = 1,
      children = 0,
      resource_type = "tour",
    } = body

    if (!schedule_id || typeof schedule_id !== "string") {
      return NextResponse.json({ error: "schedule_id is required" }, { status: 400 })
    }
    if (!/^[0-9a-fA-F-]{36}$/.test(schedule_id)) {
      return NextResponse.json({ error: "schedule_id must be a valid UUID" }, { status: 400 })
    }
    if (!["tour", "car"].includes(resource_type)) {
      return NextResponse.json({ error: "resource_type must be 'tour' or 'car'" }, { status: 400 })
    }

    const adapter = getAdapter(resource_type as ResourceType)

    // Resolve resource_id from the schedule
    const slot = await adapter.getSlot(schedule_id, supabase)
    if (!slot) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 })
    }

    const result = await createBooking(
      {
        resource_type: resource_type as ResourceType,
        resource_id: slot.resource_id,
        schedule_id,
        buyer_id: user.id,
        adults,
        children,
      },
      adapter,
      supabase,
    )

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const confirmedBooking = result.data

    void capturePostHogServerEvent({
      event: "booking_completed_server",
      distinctId: user.id,
      insertId: `booking:${confirmedBooking.id}`,
      properties: {
        booking_id: confirmedBooking.id,
        schedule_id,
        resource_type,
        resource_id: slot.resource_id,
        adults,
        children,
        total_guests: adults + children,
      },
    })

    // Send confirmation emails for tours (non-blocking)
    if (resource_type === "tour") {
      try {
        const { data: tourSchedule } = await supabase
          .from("tour_schedules")
          .select("start_time, tours(guide_id, title, meeting_point, city, city_slug, country)")
          .eq("id", schedule_id)
          .single()

        const tourData = Array.isArray(tourSchedule?.tours)
          ? tourSchedule!.tours[0]
          : tourSchedule?.tours

        if (tourData?.guide_id) {
          const { data: guideProfile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", tourData.guide_id)
            .single()

          if (guideProfile?.email) {
            const tourTimeZone = resolveTourTimeZone({
              citySlug: tourData?.city_slug,
              city: tourData?.city,
              country: tourData?.country,
            })

            await sendBookingConfirmationEmails({
              touristName: profile.full_name || user.email!,
              touristEmail: user.email!,
              guideName: guideProfile.full_name || "Guide",
              guideEmail: guideProfile.email,
              tourTitle: tourData?.title || "Tour",
              tourDate: tourSchedule?.start_time,
              tourTime: tourSchedule?.start_time,
              tourTimeZone,
              meetingPoint: tourData?.meeting_point || "",
              adults,
              children,
              bookingId: confirmedBooking.id,
            })
          }
        }
      } catch (emailError) {
        console.error("[v0] Failed to send booking confirmation emails:", emailError)
      }
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

    // Fetch booking to determine which adapter to use
    const { data: bookingMeta } = await supabase
      .from("bookings")
      .select("resource_type")
      .eq("id", bookingId)
      .single()

    const resourceType = (bookingMeta?.resource_type as ResourceType) ?? "tour"
    const adapter = getAdapter(resourceType)

    const result = await cancelBooking(bookingId, user.id, adapter, supabase)

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error("[v0] Server error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
