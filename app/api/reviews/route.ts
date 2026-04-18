import { createClient } from "@/lib/supabase/server"
import { revalidateTourSeo } from "@/lib/seo/revalidate"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("reviews")
      .select(`
        *,
        tourist:tourist_id(full_name, avatar_url)
      `)
      .eq("guide_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Server error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

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
    const { tour_id, booking_id, guide_id, rating, title, content } = body

    // Validate required fields
    if (!tour_id || !guide_id || !rating || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 })
    }

    // Create review
    const { data, error } = await supabase
      .from("reviews")
      .insert({
        tour_id,
        booking_id: booking_id || null,
        tourist_id: user.id,
        guide_id,
        rating,
        title: title || null,
        content,
        is_published: true,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const { data: tourMeta } = await supabase
      .from("tours")
      .select("city, city_slug, title, tour_slug")
      .eq("id", tour_id)
      .maybeSingle()

    if (tourMeta) {
      revalidateTourSeo({
        city: tourMeta.city,
        citySlug: tourMeta.city_slug,
        title: tourMeta.title,
        tourSlug: tourMeta.tour_slug,
      })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("[v0] Server error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
