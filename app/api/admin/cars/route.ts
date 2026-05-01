import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/admin/cars
 * Admin-only: list all cars with seller info, supporting search + status filter.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Admin gate
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 500)
    const statusFilter = searchParams.get("status")

    let query = supabase
      .from("cars")
      .select(`
        id,
        title,
        status,
        price_per_day,
        make,
        model,
        year,
        seats,
        city,
        images,
        created_at,
        seller:seller_id(id, full_name, email),
        car_schedules(id)
      `)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error("[v0] Admin cars GET error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
