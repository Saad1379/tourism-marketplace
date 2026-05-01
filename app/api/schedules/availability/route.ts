import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { computeRemainingCapacity } from "@/lib/marketplace/capacity"

/**
 * GET /api/schedules/availability?schedule_id=<uuid>&resource_type=tour|car
 *
 * Returns the remaining capacity for a given schedule slot.
 *
 * BUG FIX: The previous implementation counted only `adults` when computing
 * booked seats, ignoring `children`. This version uses `total_guests` via the
 * shared computeRemainingCapacity() function so children are always counted.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schedule_id = searchParams.get("schedule_id")
    const resource_type = searchParams.get("resource_type") ?? "tour"

    if (!schedule_id) {
      return NextResponse.json({ error: "schedule_id is required" }, { status: 400 })
    }

    const supabase = await createClient()

    // -----------------------------------------------------------------------
    // Fetch the schedule slot from the correct table based on resource_type
    // -----------------------------------------------------------------------
    let slotCapacity: number
    let resourceId: string | null = null

    if (resource_type === "car") {
      const { data: slot, error: slotError } = await supabase
        .from("car_schedules")
        .select("id, capacity, car_id")
        .eq("id", schedule_id)
        .single()

      if (slotError || !slot) {
        return NextResponse.json({ error: "Schedule not found" }, { status: 404 })
      }

      slotCapacity = slot.capacity ?? 1
      resourceId = slot.car_id
    } else {
      // Default: tour
      const { data: slot, error: slotError } = await supabase
        .from("tour_schedules")
        .select("id, capacity, tour_id")
        .eq("id", schedule_id)
        .single()

      if (slotError || !slot) {
        return NextResponse.json({ error: "Schedule not found" }, { status: 404 })
      }

      slotCapacity = slot.capacity ?? 10
      resourceId = slot.tour_id
    }

    // -----------------------------------------------------------------------
    // Fetch seller's credit balance (only relevant for tours)
    // -----------------------------------------------------------------------
    let creditBalance = 0

    if (resource_type === "tour" && resourceId) {
      const { data: tour } = await supabase
        .from("tours")
        .select("guide_id")
        .eq("id", resourceId)
        .single()

      if (tour?.guide_id) {
        const { data: creditAccount } = await supabase
          .from("guide_credits")
          .select("balance")
          .eq("guide_id", tour.guide_id)
          .maybeSingle()

        creditBalance = creditAccount?.balance ?? 0
      }
    }

    // -----------------------------------------------------------------------
    // Live capacity computation using the shared engine
    // FIXED: now uses total_guests (not just adults)
    // -----------------------------------------------------------------------
    const { data: activeBookings } = await supabase
      .from("bookings")
      .select("adults, children, total_guests")
      .or(`resource_schedule_id.eq.${schedule_id},schedule_id.eq.${schedule_id}`)
      .in("status", ["pending", "confirmed", "upcoming"])

    const capacityResult = computeRemainingCapacity(slotCapacity, activeBookings ?? [])

    return NextResponse.json({
      available: capacityResult.available,
      max_adults: capacityResult.remaining,
      remaining_capacity: capacityResult.remaining,
      booked_count: capacityResult.booked,
      credit_balance: creditBalance,
    })
  } catch (error) {
    console.error("[v0] Server error in /api/schedules/availability:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
