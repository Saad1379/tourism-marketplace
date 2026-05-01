import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ensureProfile } from "@/lib/supabase/ensure-profile"
import { isSeller } from "@/lib/marketplace/roles"

/**
 * GET /api/cars
 * Public: list published cars with optional filters.
 *
 * Query params:
 *   city_slug  — filter by city
 *   limit      — max results (default 20)
 *   q          — title search
 *   transmission — 'automatic' | 'manual'
 *   seats      — minimum seat count
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const citySlug = searchParams.get("city_slug")
    const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100)
    const q = searchParams.get("q")
    const transmission = searchParams.get("transmission")
    const minSeats = Number(searchParams.get("seats") ?? "0")
    const includeOwn = searchParams.get("include_own") === "true"

    const supabase = await createClient()

    let query = supabase
      .from("cars")
      .select(`
        id,
        title,
        description,
        city,
        city_slug,
        country,
        price_per_day,
        make,
        model,
        year,
        seats,
        transmission,
        fuel_type,
        images,
        features,
        status,
        created_at,
        seller:seller_id(id, full_name, avatar_url),
        car_schedules(id, start_time, end_time, capacity, booked_count)
      `)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (includeOwn) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      query = query.eq("seller_id", user.id)
    } else {
      query = query.eq("status", "published")
    }

    if (citySlug) query = query.eq("city_slug", citySlug)
    if (transmission) query = query.eq("transmission", transmission)
    if (minSeats > 0) query = query.gte("seats", minSeats)

    const { data, error } = await query

    if (error) {
      console.error("[v0] Error fetching cars:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let results = data ?? []

    // Title search (in-memory since Supabase free tier lacks full-text on custom tables)
    if (q) {
      const term = q.toLowerCase()
      results = results.filter(
        (car: any) =>
          car.title?.toLowerCase().includes(term) ||
          car.make?.toLowerCase().includes(term) ||
          car.model?.toLowerCase().includes(term) ||
          car.city?.toLowerCase().includes(term),
      )
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error("[v0] Server error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

/**
 * POST /api/cars
 * Seller-only: create a new car listing.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const profile = await ensureProfile(supabase, user as any)
    if (!profile || !isSeller(profile.role)) {
      return NextResponse.json({ error: "Only sellers can create car listings" }, { status: 403 })
    }

    const body = await request.json()
    const {
      title,
      description,
      city,
      city_slug,
      country,
      price_per_day,
      make,
      model,
      year,
      seats,
      transmission,
      fuel_type,
      images,
      features,
    } = body

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 })
    }

    if (!city_slug || typeof city_slug !== "string") {
      return NextResponse.json({ error: "city_slug is required" }, { status: 400 })
    }

    const { data: car, error } = await supabase
      .from("cars")
      .insert({
        seller_id: user.id,
        title: title.trim(),
        description: description ?? null,
        city: city ?? null,
        city_slug: city_slug.trim().toLowerCase(),
        country: country ?? null,
        price_per_day: price_per_day ?? null,
        make: make ?? null,
        model: model ?? null,
        year: year ?? null,
        seats: Number(seats ?? 4),
        transmission: transmission ?? "automatic",
        fuel_type: fuel_type ?? "petrol",
        images: Array.isArray(images) ? images : [],
        features: Array.isArray(features) ? features : [],
        status: "draft",
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating car:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(car, { status: 201 })
  } catch (error) {
    console.error("[v0] Server error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
