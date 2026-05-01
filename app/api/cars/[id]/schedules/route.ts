import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/cars/[id]/schedules
 * Returns all schedules for a car (public for published cars).
 *
 * POST /api/cars/[id]/schedules
 * Seller-only: create a schedule for a car.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: carId } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("car_schedules")
      .select("id, car_id, start_time, end_time, capacity, booked_count, price_override")
      .eq("car_id", carId)
      .order("start_time", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error("[v0] Server error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: carId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify ownership
    const { data: car } = await supabase
      .from("cars")
      .select("seller_id")
      .eq("id", carId)
      .single()

    if (!car) {
      return NextResponse.json({ error: "Car not found" }, { status: 404 })
    }

    if (car.seller_id !== user.id) {
      return NextResponse.json({ error: "You can only add schedules to your own cars" }, { status: 403 })
    }

    const body = await request.json()
    const { start_time, end_time, capacity = 1, price_override } = body

    if (!start_time || !end_time) {
      return NextResponse.json({ error: "start_time and end_time are required" }, { status: 400 })
    }

    if (new Date(end_time) <= new Date(start_time)) {
      return NextResponse.json({ error: "end_time must be after start_time" }, { status: 400 })
    }

    const { data: schedule, error } = await supabase
      .from("car_schedules")
      .insert({
        car_id: carId,
        start_time,
        end_time,
        capacity: Math.max(1, Number(capacity)),
        booked_count: 0,
        price_override: price_override ?? null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    console.error("[v0] Server error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: carId } = await params
    const { searchParams } = new URL(request.url)
    const scheduleId = searchParams.get("schedule_id")

    if (!scheduleId) {
      return NextResponse.json({ error: "schedule_id is required" }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify ownership through the car
    const { data: schedule } = await supabase
      .from("car_schedules")
      .select("car_id, cars!inner(seller_id)")
      .eq("id", scheduleId)
      .eq("car_id", carId)
      .single()

    if (!schedule) {
      return NextResponse.json({ error: "Schedule not found" }, { status: 404 })
    }

    const sellerData = Array.isArray((schedule as any).cars)
      ? (schedule as any).cars[0]
      : (schedule as any).cars

    if (sellerData?.seller_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { error } = await supabase.from("car_schedules").delete().eq("id", scheduleId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Server error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
