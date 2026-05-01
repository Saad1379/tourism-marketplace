import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSeller } from "@/lib/marketplace/roles"

/**
 * GET /api/cars/[id]
 * Public: get a single published car with its schedules.
 * Sellers can also see their own drafts.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: car, error } = await supabase
      .from("cars")
      .select(`
        *,
        seller:seller_id(id, full_name, avatar_url, bio),
        car_schedules(id, start_time, end_time, capacity, booked_count, price_override)
      `)
      .eq("id", id)
      .single()

    if (error || !car) {
      return NextResponse.json({ error: "Car not found" }, { status: 404 })
    }

    // Only return published cars to non-owners
    if (car.status !== "published") {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || car.seller_id !== user.id) {
        return NextResponse.json({ error: "Car not found" }, { status: 404 })
      }
    }

    return NextResponse.json(car)
  } catch (error) {
    console.error("[v0] Server error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/cars/[id]
 * Seller-only: update a car listing.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from("cars")
      .select("seller_id")
      .eq("id", id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: "Car not found" }, { status: 404 })
    }

    if (existing.seller_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const body = await request.json()

    // Only allow safe fields to be updated
    const allowed = [
      "title",
      "description",
      "city",
      "city_slug",
      "country",
      "price_per_day",
      "make",
      "model",
      "year",
      "seats",
      "transmission",
      "fuel_type",
      "images",
      "features",
      "status",
    ] as const

    const updatePayload: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updatePayload[key] = body[key]
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from("cars")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[v0] Server error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/cars/[id]
 * Seller-only: delete a car listing.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: existing } = await supabase
      .from("cars")
      .select("seller_id")
      .eq("id", id)
      .single()

    if (!existing || existing.seller_id !== user.id) {
      return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 })
    }

    const { error } = await supabase.from("cars").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Server error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
