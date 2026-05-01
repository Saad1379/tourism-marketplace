import { createClient } from "@/lib/supabase/server"
import { ensureProfile } from "@/lib/supabase/ensure-profile"
import { type NextRequest, NextResponse } from "next/server"

import { isSeller } from "@/lib/marketplace/roles"

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
    if (!profile || !isSeller(profile.role)) {
      return NextResponse.json({ error: "Only sellers can boost tours" }, { status: 403 })
    }

    const body = await request.json()
    const { tour_id, credits, days } = body

    if (!tour_id || !credits || !days) {
      return NextResponse.json({ error: "tour_id, credits, and days are required" }, { status: 400 })
    }

    const normalizedCredits = Number(credits)
    const normalizedDays = Number(days)
    if (normalizedCredits !== 30 || normalizedDays !== 30) {
      return NextResponse.json(
        { error: "Boost policy is fixed to 30 days for 30 credits." },
        { status: 400 },
      )
    }

    const { error } = await supabase.rpc("activate_tour_boost", {
      p_tour_id: tour_id,
      p_credits: normalizedCredits,
      p_days: normalizedDays,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Server error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
