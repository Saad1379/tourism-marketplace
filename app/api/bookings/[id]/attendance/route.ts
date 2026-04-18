import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const bookingId = params.id
    const { action } = await req.json()

    if (!["guide-checkin", "tourist-confirm", "guide-confirm"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 },
      )
    }

    const authHeader = req.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      )
    }

    const token = authHeader.split(" ")[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      )
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 },
      )
    }

    // Verify user has permission to update this booking
    if (user.id !== booking.guide_id && user.id !== booking.tourist_id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 },
      )
    }

    let updateData: any = { updated_at: new Date().toISOString() }

    if (action === "guide-checkin") {
      if (user.id !== booking.guide_id) {
        return NextResponse.json(
          { error: "Only the guide can check in" },
          { status: 403 },
        )
      }
      updateData.guide_checked_in = true
    } else if (action === "tourist-confirm") {
      if (user.id !== booking.tourist_id) {
        return NextResponse.json(
          { error: "Only the tourist can confirm attendance" },
          { status: 403 },
        )
      }
      updateData.tourist_confirmed = true
    } else if (action === "guide-confirm") {
      if (user.id !== booking.guide_id) {
        return NextResponse.json(
          { error: "Only the guide can confirm" },
          { status: 403 },
        )
      }
      updateData.guide_checked_in = true
      updateData.attendance_status = "show"
    }

    const { data: updated, error: updateError } = await supabase
      .from("bookings")
      .update(updateData)
      .eq("id", bookingId)
      .select()
      .single()

    if (updateError) {
      console.error("[v0] Attendance update error:", updateError)
      return NextResponse.json(
        { error: "Failed to update attendance" },
        { status: 500 },
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[v0] Attendance confirmation error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const bookingId = params.id

    const authHeader = req.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      )
    }

    const token = authHeader.split(" ")[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      )
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*, tours(*), profiles!guide_id(full_name, avatar_url), profiles!tourist_id(full_name)")
      .eq("id", bookingId)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 },
      )
    }

    if (user.id !== booking.guide_id && user.id !== booking.tourist_id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 },
      )
    }

    return NextResponse.json(booking)
  } catch (error) {
    console.error("[v0] Error fetching booking:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
