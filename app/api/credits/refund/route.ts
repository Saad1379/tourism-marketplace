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
    const { booking_id } = body

    if (!booking_id) {
      return NextResponse.json({ error: "booking_id is required" }, { status: 400 })
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        id,
        credits_charged,
        schedule:tour_schedules(
          start_time,
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

    const creditsToRefund = booking.credits_charged || 0
    if (creditsToRefund === 0) {
      return NextResponse.json({ success: true, message: "No credits to refund" })
    }

    // Check if cancellation is more than 24 hours before tour
    const tourStartTime = new Date(booking.schedule?.start_time)
    const now = new Date()
    const hoursUntilTour = (tourStartTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (hoursUntilTour < 24) {
      return NextResponse.json({ 
        success: false, 
        message: "No refund - cancellation within 24 hours of tour" 
      })
    }

    // Get current balance
    const { data: creditAccount } = await supabase
      .from("guide_credits")
      .select("balance")
      .eq("guide_id", guideId)
      .single()

    if (!creditAccount) {
      return NextResponse.json({ error: "Credit account not found" }, { status: 404 })
    }

    // Create refund transaction
    const { error: transactionError } = await supabase
      .from("credit_transactions")
      .insert({
        guide_id: guideId,
        amount: creditsToRefund,
        type: "refund",
        description: `Refund for cancelled booking`,
        reference_id: booking_id,
      })

    if (transactionError) {
      return NextResponse.json({ error: transactionError.message }, { status: 400 })
    }

    // Update guide credits balance
    const { error: updateError } = await supabase
      .from("guide_credits")
      .update({ balance: creditAccount.balance + creditsToRefund })
      .eq("guide_id", guideId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, refunded: creditsToRefund })
  } catch (error) {
    console.error("[v0] Server error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
