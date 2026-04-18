import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schedule_id = searchParams.get("schedule_id")

    if (!schedule_id) {
      return NextResponse.json({ error: "schedule_id is required" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: schedule, error: scheduleError } = await supabase
      .from("tour_schedules")
      .select("id, capacity, tour_id")
      .eq("id", schedule_id)
      .single()

    if (scheduleError || !schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 })
    }

    const { data: tour } = await supabase
      .from("tours")
      .select("guide_id")
      .eq("id", schedule.tour_id)
      .single()

    const guideId = tour?.guide_id
    if (!guideId) {
      return NextResponse.json({ error: "Guide not found" }, { status: 404 })
    }

    const { data: creditAccount } = await supabase
      .from("guide_credits")
      .select("balance")
      .eq("guide_id", guideId)
      .maybeSingle()

    const creditBalance = creditAccount?.balance || 0

    const { data: bookings } = await supabase
      .from("bookings")
      .select("adults, children")
      .eq("schedule_id", schedule_id)
      .in("status", ["pending", "confirmed", "upcoming"])

    const bookedTotal = (bookings || []).reduce((sum, b) => sum + (b.adults || 0), 0)
    const remainingCapacity = (schedule.capacity || 10) - bookedTotal

    return NextResponse.json({
      available: remainingCapacity > 0,
      max_adults: remainingCapacity,
      remaining_capacity: remainingCapacity,
      credit_balance: creditBalance,
      booked_count: bookedTotal,
    })
  } catch (error) {
    console.error("[v0] Server error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
