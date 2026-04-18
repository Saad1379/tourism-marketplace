import { createClient } from "@/lib/supabase/server"
import { normalizeSeoKeywords } from "@/lib/tours/seo-quality"
import { DESCRIPTION_MIN_MESSAGE, TOUR_DESCRIPTION_MIN_CHARS } from "@/lib/tours/publish-rules"
import { generateUniqueTourSlugPair } from "@/lib/tours/slugs"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { title, description, duration, highlights, meetingPoint, seo_keywords } = body

    // Validate required fields
    if (!title || !description) {
      return NextResponse.json({ error: "Title and description are required" }, { status: 400 })
    }

    if (String(description).trim().length < TOUR_DESCRIPTION_MIN_CHARS) {
      return NextResponse.json({ error: DESCRIPTION_MIN_MESSAGE }, { status: 400 })
    }

    // Get guide's city from profile
    const { data: profile } = await supabase.from("profiles").select("city").eq("id", user.id).single()

    if (!profile?.city) {
      return NextResponse.json({ error: "Guide profile incomplete" }, { status: 400 })
    }

    const normalizedKeywords = normalizeSeoKeywords(seo_keywords || [])
    const { citySlug, tourSlug } = await generateUniqueTourSlugPair(supabase, profile.city, title)

    // Create tour as draft
    const { data: tour, error: tourError } = await supabase
      .from("tours")
      .insert({
        guide_id: user.id,
        title: title.trim(),
        description: description.trim(),
        city: profile.city,
        city_slug: citySlug,
        tour_slug: tourSlug,
        seo_keywords: normalizedKeywords,
        duration_minutes: duration ? parseInt(duration) * 60 : 120, // Convert hours to minutes
        meeting_point_address: meetingPoint?.trim() || null,
        status: "draft",
        // Parse highlights from textarea (one per line)
        highlights: highlights
          ? highlights
              .split("\n")
              .map((h: string) => h.trim())
              .filter((h: string) => h.length > 0)
          : [],
      })
      .select()
      .single()

    if (tourError) {
      console.error("[API] Tour creation error:", tourError)
      return NextResponse.json({ error: "Failed to create tour" }, { status: 500 })
    }

    return NextResponse.json({ success: true, tour }, { status: 201 })
  } catch (error) {
    console.error("[API] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
