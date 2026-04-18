import { createClient } from "@/lib/supabase/server"
import { ensureProfile } from "@/lib/supabase/ensure-profile"
import { revalidateTourSeo } from "@/lib/seo/revalidate"
import { buildAutoSeoMetaDescription, buildAutoSeoTitle, deriveNeighbourhood, getGuideFirstName } from "@/lib/tours/seo-autogen"
import { validatePublishRequirements } from "@/lib/tours/publish-validation"
import { listTourStops, sanitizeStopNames, syncAndRefreshTourStopContent } from "@/lib/tours/tour-stops"
import { DESCRIPTION_MIN_MESSAGE, TOUR_DESCRIPTION_MIN_CHARS } from "@/lib/tours/publish-rules"
import { type NextRequest, NextResponse } from "next/server"

async function getFutureScheduleCount(supabase: any, tourId: string): Promise<number> {
  const { count } = await supabase
    .from("tour_schedules")
    .select("id", { count: "exact", head: true })
    .eq("tour_id", tourId)
    .gt("start_time", new Date().toISOString())

  return Number(count || 0)
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

    if (!user.email) {
      return NextResponse.json({ error: "User email is required" }, { status: 400 })
    }

    const profile = await ensureProfile(supabase, { id: user.id, email: user.email })
    if (!profile) {
      return NextResponse.json({ error: "Failed to access profile" }, { status: 500 })
    }

    if (profile.role && profile.role !== "guide") {
      return NextResponse.json({ error: "Only guides can publish tours" }, { status: 403 })
    }

    const body = await request.json()
    const { tour_id } = body

    if (!tour_id) {
      return NextResponse.json({ error: "tour_id is required" }, { status: 400 })
    }

    const { data: tour, error: tourError } = await supabase
      .from("tours")
      .select(
        "id, guide_id, title, city, city_slug, tour_slug, description, highlights, max_capacity, photos, images, seo_title, seo_meta_description, seo_title_manually_overridden, seo_meta_description_manually_overridden",
      )
      .eq("id", tour_id)
      .single()

    if (tourError || !tour) {
      return NextResponse.json({ error: "Tour not found" }, { status: 404 })
    }

    if (tour.guide_id !== user.id) {
      return NextResponse.json({ error: "Tour does not belong to you" }, { status: 403 })
    }

    if (String(tour.description || "").trim().length < TOUR_DESCRIPTION_MIN_CHARS) {
      return NextResponse.json({ error: DESCRIPTION_MIN_MESSAGE }, { status: 400 })
    }

    const photosArray = Array.isArray(tour.photos) ? tour.photos : Array.isArray(tour.images) ? tour.images : []
    if (photosArray.length === 0) {
      return NextResponse.json({ error: "Tour must have at least 1 photo before publishing" }, { status: 400 })
    }

    let stopNames = sanitizeStopNames(tour.highlights || [])
    if (stopNames.length === 0) {
      const stopRows = await listTourStops(supabase, tour_id)
      stopNames = stopRows.map((row) => String(row.stop_name || "").trim()).filter(Boolean)
    }

    const futureScheduleCount = await getFutureScheduleCount(supabase, tour_id)
    const publishIssues = validatePublishRequirements({
      description: String(tour.description || ""),
      guideBio: String(profile.bio || ""),
      stopCount: stopNames.length,
      futureScheduleCount,
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

    const neighbourhood = deriveNeighbourhood(tour.title, tour.city, stopNames)
    const updatePayload: Record<string, unknown> = {
      status: "published",
      published_at: new Date().toISOString(),
    }

    if (!Boolean(tour.seo_title_manually_overridden) && !String(tour.seo_title || "").trim()) {
      updatePayload.seo_title = buildAutoSeoTitle({
        neighbourhood,
        city: String(tour.city || ""),
      })
    }

    if (!Boolean(tour.seo_meta_description_manually_overridden) && !String(tour.seo_meta_description || "").trim()) {
      updatePayload.seo_meta_description = buildAutoSeoMetaDescription({
        neighbourhood,
        guideFirstName: getGuideFirstName(profile.full_name),
        stopNames,
        maxGuests: Number(tour.max_capacity || 10),
      })
    }

    const { data: publishedTour, error: publishError } = await supabase
      .from("tours")
      .update(updatePayload)
      .eq("id", tour_id)
      .select()
      .single()

    if (publishError) {
      console.error("[v0] Error publishing tour:", publishError)
      return NextResponse.json({ error: `Failed to publish tour: ${publishError.message}` }, { status: 500 })
    }

    try {
      await syncAndRefreshTourStopContent({
        supabase,
        tourId: tour_id,
        city: String(tour.city || ""),
        neighbourhood,
        guideDescription: String(tour.description || ""),
        highlights: stopNames,
        forceHighlightRegeneration: String(tour.title || "").trim().toLowerCase() === "city of lights walking tour",
      })
    } catch (stopSyncError) {
      console.warn("[v0] Publish succeeded but tour stop sync failed:", stopSyncError)
    }

    revalidateTourSeo({
      city: publishedTour.city,
      citySlug: publishedTour.city_slug,
      title: publishedTour.title,
      tourSlug: publishedTour.tour_slug,
    })

    return NextResponse.json(publishedTour, { status: 200 })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Error in POST /api/tours/publish:", errMsg)
    return NextResponse.json({ error: `Server error: ${errMsg}` }, { status: 500 })
  }
}
