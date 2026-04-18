import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

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
    const { booking_id, credits_amount } = body

    if (!booking_id || !credits_amount) {
      return NextResponse.json({ error: "booking_id and credits_amount are required" }, { status: 400 })
    }

    // Get guide_id from booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        id,
        schedule:tour_schedules(
          tour:tours(guide_id)
        )
      `)
      .eq("id", booking_id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const guideId = booking.schedule?.tour?.guide_id
    if (!guideId) {
      return NextResponse.json({ error: "Guide not found" }, { status: 404 })
    }

    // Check guide has sufficient credits
    const { data: creditAccount } = await supabase
      .from("guide_credits")
      .select("balance")
      .eq("guide_id", guideId)
      .single()

    if (!creditAccount || creditAccount.balance < credits_amount) {
      return NextResponse.json({ error: "Insufficient credits" }, { status: 400 })
    }

    // Create hold transaction
    const { error: transactionError } = await supabase
      .from("credit_transactions")
      .insert({
        guide_id: guideId,
        amount: -credits_amount,
        type: "spend",
        description: `Credits on hold for booking`,
        reference_id: booking_id,
      })

    if (transactionError) {
      return NextResponse.json({ error: transactionError.message }, { status: 400 })
    }

    // Update guide credits balance
    const { error: updateError } = await supabase
      .from("guide_credits")
      .update({ balance: creditAccount.balance - credits_amount })
      .eq("guide_id", guideId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    // Update booking with credits charged
    await supabase
      .from("bookings")
      .update({ credits_charged: credits_amount })
      .eq("id", booking_id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Server error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
