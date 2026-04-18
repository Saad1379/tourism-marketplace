import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const serviceRoleSupabase = createServiceRoleClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { review_id, guide_response } = body

    if (!review_id || !guide_response) {
      return NextResponse.json({ error: "Missing review_id or guide_response" }, { status: 400 })
    }

    // Update the review response
    const { data, error } = await serviceRoleSupabase
      .from("reviews")
      .update({
        guide_response,
        guide_responded_at: new Date().toISOString(),
      })
      .eq("id", review_id)
      .eq("guide_id", user.id) // Security check remains
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Review not found or unauthorized" }, { status: 404 })
    }

    return NextResponse.json(data[0])
  } catch (error) {
    console.error("[v0] Server error in PATCH /api/reviews/update-response:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
