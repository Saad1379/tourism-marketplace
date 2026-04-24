import { createClient } from "@/lib/supabase/server"
import { ensureProfile } from "@/lib/supabase/ensure-profile"
import { normalizeSeoKeywords } from "@/lib/tours/seo-quality"
import { generateUniqueTourSlugPair } from "@/lib/tours/slugs"
import { revalidateTourSeo } from "@/lib/seo/revalidate"
import { buildAutoSeoMetaDescription, buildAutoSeoTitle, deriveNeighbourhood, getGuideFirstName } from "@/lib/tours/seo-autogen"
import { validatePublishRequirements } from "@/lib/tours/publish-validation"
import { DESCRIPTION_MIN_MESSAGE, TOUR_DESCRIPTION_MIN_CHARS } from "@/lib/tours/publish-rules"
import { sanitizeStopNames, syncAndRefreshTourStopContent } from "@/lib/tours/tour-stops"
import { type NextRequest, NextResponse } from "next/server"

function parsePositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? fallback), 10)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return fallback
  return parsed
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
    const {
      title,
      city,
      description,
      highlights,
      duration_minutes,
      max_capacity,
      languages,
      categories,
      meeting_point,
      meeting_point_details,
      status,
      what_to_expect,
      what_to_bring,
      accessibility_info,
      seo_keywords,
      minimum_attendees,
    } = body

    const isPublish = status === "published"

    // Drafts can be saved in any state; only publish requires the full set
    // of inputs and the min-description check.
    if (isPublish) {
      if (!title || !city || !description || !duration_minutes || !max_capacity) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
      }
      if (String(description).trim().length < TOUR_DESCRIPTION_MIN_CHARS) {
        return NextResponse.json({ error: DESCRIPTION_MIN_MESSAGE }, { status: 400 })
      }
    }

    const profile = await ensureProfile(supabase, user as { id: string; email: string })
    if (!profile) {
      return NextResponse.json({ error: "Failed to access or create profile" }, { status: 500 })
    }

    if (profile.role && profile.role !== "guide") {
      return NextResponse.json(
        { error: "Only guides can create tours. Please upgrade your account to guide." },
        { status: 403 },
      )
    }

    const parsedCapacity = parseInt(String(max_capacity ?? ""), 10)
    const capacityProvided = Number.isFinite(parsedCapacity) && parsedCapacity > 0
    // Clamp a provided value to 7 on free; leave null otherwise so drafts
    // don't silently invent a max_capacity the user never typed.
    const safeCapacity: number | null = capacityProvided
      ? profile.guide_tier === "free"
        ? Math.min(parsedCapacity, 7)
        : parsedCapacity
      : null

    if (profile.guide_tier === "free" && isPublish) {
      // Only block publishing past the published-tour cap. Drafts are unlimited.
      const { data: existingPublished, error: toursError } = await supabase
        .from("tours")
        .select("id")
        .eq("guide_id", user.id)
        .eq("status", "published")
        .is("deleted_at", null)
        .limit(1)

      if (!toursError && existingPublished && existingPublished.length > 0) {
        return NextResponse.json(
          { error: "Free plan allows 1 published tour. Upgrade to Pro for unlimited tours." },
          { status: 403 },
        )
      }
    }

    const safeMinimumAttendees = parsePositiveInteger(minimum_attendees, 1)
    if (safeMinimumAttendees < 1) {
      return NextResponse.json({ error: "minimum_attendees must be at least 1" }, { status: 400 })
    }

    if (isPublish && safeCapacity !== null && safeMinimumAttendees > safeCapacity) {
      return NextResponse.json(
        {
          error: `minimum_attendees cannot be greater than max_capacity (${safeCapacity})`,
        },
        { status: 400 },
      )
    }

    return createTour(
      supabase,
      user.id,
      {
        title,
        city,
        description,
        highlights,
        duration_minutes,
        max_capacity: safeCapacity,
        languages,
        categories,
        meeting_point,
        meeting_point_details,
        what_to_expect,
        what_to_bring,
        accessibility_info: accessibility_info || "",
        seo_keywords,
        minimum_attendees: safeMinimumAttendees,
        status: status || "draft",
      },
      profile,
    )
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Server error in POST /api/tours:", errorMsg, error)
    return NextResponse.json({ error: `Server error: ${errorMsg}` }, { status: 500 })
  }
}

async function createTour(supabase: any, guideId: string, data: any, guideProfile: any) {
  try {
    const normalizedKeywords = normalizeSeoKeywords(data.seo_keywords || [])
    const stopNames = sanitizeStopNames(data.highlights || [])

    // `title` is NOT NULL in the DB, and the slug generator needs *some*
    // string. For drafts the user may not have entered anything yet.
    const effectiveTitle = (data.title && String(data.title).trim()) || "Untitled draft"
    const effectiveCity = (data.city && String(data.city).trim()) || "unassigned"
    const { citySlug, tourSlug } = await generateUniqueTourSlugPair(
      supabase,
      effectiveCity,
      effectiveTitle,
    )

    if (data.status === "published") {
      const publishIssues = validatePublishRequirements({
        description: String(data.description || ""),
        guideBio: String(guideProfile?.bio || ""),
        stopCount: stopNames.length,
        futureScheduleCount: 0,
      })

      if (publishIssues.length > 0) {
        return NextResponse.json(
          {
            error: "Publish requirements not met",
            issues: publishIssues,
          },
          { status: 400 },
        )
      }
    }

    const neighbourhood = deriveNeighbourhood(effectiveTitle, effectiveCity, stopNames)
    const guideFirstName = getGuideFirstName(guideProfile?.full_name)
    const shouldGenerateSeo = data.status === "published"

    const parseIntOrNull = (v: unknown): number | null => {
      if (v === undefined || v === null || v === "") return null
      const n = parseInt(String(v), 10)
      return Number.isFinite(n) ? n : null
    }

    const { data: tour, error } = await supabase
      .from("tours")
      .insert({
        guide_id: guideId,
        title: effectiveTitle,
        city: data.city || null,
        city_slug: citySlug,
        tour_slug: tourSlug,
        description: data.description || null,
        highlights: stopNames,
        duration_minutes: parseIntOrNull(data.duration_minutes),
        max_capacity: parseIntOrNull(data.max_capacity),
        minimum_attendees: parsePositiveInteger(data.minimum_attendees, 1),
        languages: data.languages || [],
        categories: data.categories || [],
        seo_keywords: normalizedKeywords,
        seo_title: shouldGenerateSeo
          ? buildAutoSeoTitle({
              neighbourhood,
              city: String(data.city || ""),
            })
          : null,
        seo_meta_description: shouldGenerateSeo
          ? buildAutoSeoMetaDescription({
              neighbourhood,
              guideFirstName,
              stopNames,
              maxGuests: Number(data.max_capacity || 10),
            })
          : null,
        photos: [],
        meeting_point: data.meeting_point || null,
        meeting_point_details: data.meeting_point_details || null,
        what_to_expect: data.what_to_expect || null,
        what_to_bring: data.what_to_bring || "",
        accessibility_info: data.accessibility_info || "",
        status: data.status || "draft",
        published_at: data.status === "published" ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Supabase error creating tour:", error.message, error.code)
      return NextResponse.json({ error: `Failed to create tour: ${error.message}` }, { status: 400 })
    }

    try {
      await syncAndRefreshTourStopContent({
        supabase,
        tourId: tour.id,
        city: String(data.city || ""),
        neighbourhood,
        guideDescription: String(data.description || ""),
        highlights: stopNames,
        forceHighlightRegeneration: String(data.title || "").trim().toLowerCase() === "city of lights walking tour",
      })
    } catch (stopSyncError) {
      console.warn("[v0] Failed to sync tour_stops after tour creation:", stopSyncError)
    }

    if (tour.status === "published") {
      revalidateTourSeo({
        city: tour.city,
        citySlug: tour.city_slug,
        title: tour.title,
        tourSlug: tour.tour_slug,
      })
    }

    return NextResponse.json(tour, { status: 201 })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error"
    console.error("[v0] Error in createTour:", errMsg)
    return NextResponse.json({ error: `Error: ${errMsg}` }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    let query = supabase.from("tours").select("*, reviews(rating), tour_schedules(start_time)").eq("guide_id", user.id)

    if (status) {
      query = query.eq("status", status)
    }

    const { data, error } = await query

    if (error) {
      console.error("[v0] Error fetching tours:", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Server error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
