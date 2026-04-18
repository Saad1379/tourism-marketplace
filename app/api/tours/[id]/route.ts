import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { normalizeSeoKeywords } from "@/lib/tours/seo-quality"
import { generateUniqueTourSlugPair } from "@/lib/tours/slugs"
import { revalidateTourSeo } from "@/lib/seo/revalidate"
import { TOUR_IMAGE_POLICY } from "@/lib/images/policy"
import { buildAutoSeoMetaDescription, buildAutoSeoTitle, deriveNeighbourhood, getGuideFirstName } from "@/lib/tours/seo-autogen"
import { validatePublishRequirements } from "@/lib/tours/publish-validation"
import { DESCRIPTION_MIN_MESSAGE, TOUR_DESCRIPTION_MIN_CHARS } from "@/lib/tours/publish-rules"
import { listTourStops, sanitizeStopNames, syncAndRefreshTourStopContent } from "@/lib/tours/tour-stops"
import { type NextRequest, NextResponse } from "next/server"

function parseIntegerOrNull(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return null
  return parsed
}

type PublicTourStop = {
  id: string
  tour_id: string
  position: number
  stop_name: string
  highlight: string | null
  route_snapshot: string | null
  google_context: string | null
  highlight_manually_overridden: boolean | null
  route_snapshot_manually_overridden: boolean | null
}

function buildFallbackStopsFromHighlights(tourId: string, highlights: unknown[]): PublicTourStop[] {
  return sanitizeStopNames(highlights).map((stopName, index) => ({
    id: `${tourId}-legacy-${index + 1}`,
    tour_id: tourId,
    position: index + 1,
    stop_name: stopName,
    highlight: stopName,
    route_snapshot: null,
    google_context: null,
    highlight_manually_overridden: false,
    route_snapshot_manually_overridden: false,
  }))
}

async function getTourStopsForResponse(supabase: any, tourId: string, legacyHighlights: unknown[]): Promise<PublicTourStop[]> {
  try {
    const rows = await listTourStops(supabase, tourId)
    if (rows.length > 0) return rows
  } catch {
    // Ignore and fallback to legacy highlights.
  }

  return buildFallbackStopsFromHighlights(tourId, legacyHighlights)
}

async function getFutureScheduleCount(supabase: any, tourId: string): Promise<number> {
  const { count } = await supabase
    .from("tour_schedules")
    .select("id", { count: "exact", head: true })
    .eq("tour_id", tourId)
    .gt("start_time", new Date().toISOString())

  return Number(count || 0)
}

async function getGuideBioAndName(supabase: any, guideId: string): Promise<{ bio: string; fullName: string }> {
  const { data } = await supabase
    .from("profiles")
    .select("bio, full_name")
    .eq("id", guideId)
    .maybeSingle()

  return {
    bio: String(data?.bio || ""),
    fullName: String(data?.full_name || ""),
  }
}

async function getStopNamesForPublish(supabase: any, tourId: string, highlightsCandidate: unknown[]): Promise<string[]> {
  const fromHighlights = sanitizeStopNames(highlightsCandidate)
  if (fromHighlights.length > 0) return fromHighlights

  try {
    const rows = await listTourStops(supabase, tourId)
    const fromStops = rows.map((row) => String(row.stop_name || "").trim()).filter(Boolean)
    if (fromStops.length > 0) return fromStops
  } catch {
    // Ignore table-read failures during staged rollout.
  }

  return []
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { id } = await context.params

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
      return NextResponse.json({ error: "id must be a valid UUID" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("tours")
      .select(`
        id,
        guide_id,
        title,
        description,
        city,
        city_slug,
        tour_slug,
        country,
        price,
        created_at,
        duration_minutes,
        max_group_size,
        languages,
        categories,
        highlights,
        seo_title,
        seo_meta_description,
        what_to_expect,
        what_to_bring,
        accessibility_info,
        seo_keywords,
        meeting_point_address,
        meeting_point_details,
        photos,
        status,
        updated_at,
        images,
        max_capacity,
        minimum_attendees,
        meeting_point_lat,
        meeting_point_lng,
        meeting_point,
        published_at,
        guide:guide_id(id, full_name, bio, role, avatar_url),
        tour_schedules(id, start_time, capacity, language, booked_count),
        reviews(id, rating, content, title, created_at, tourist:tourist_id(full_name, avatar_url))
      `)
      .eq("id", id)
      .eq("status", "published")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    const [planResult, boostResult, guidePublishedToursResult, guideFirstTourResult, tourStops] = await Promise.all([
      supabase.from("guide_plans").select("plan_type").eq("guide_id", data.guide_id).maybeSingle(),
      supabase
        .from("tour_boosts")
        .select("id")
        .eq("tour_id", data.id)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1),
      supabase.from("tours").select("id", { count: "exact", head: true }).eq("guide_id", data.guide_id).eq("status", "published"),
      supabase
        .from("tours")
        .select("created_at")
        .eq("guide_id", data.guide_id)
        .not("created_at", "is", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      getTourStopsForResponse(supabase, data.id, data.highlights || []),
    ])

    const guidePlanType = planResult.data?.plan_type || "free"
    const isBoosted = Array.isArray(boostResult.data) && boostResult.data.length > 0
    const publishedToursCount = guidePublishedToursResult.count || 0
    const firstPublishedTourAt = guideFirstTourResult.data?.created_at || null

    let qrReviewCount = 0
    let qrReviewSum = 0
    let qrReviews: Array<{
      id: string
      rating: number
      content: string
      title: string | null
      created_at: string
      tourist: {
        full_name: string
        avatar_url: string | null
      }
    }> = []
    const qrReaders: any[] = []
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        qrReaders.push(createServiceRoleClient())
      } catch {
        // Ignore service role setup errors and fallback to request client.
      }
    }
    qrReaders.push(supabase)

    for (const reader of qrReaders) {
      const { data: qrReviewRows, error: qrError } = await reader
        .from("review_qr_reviews")
        .select("id, rating, title, content, created_at, reviewer_name")
        .eq("tour_id", data.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(5000)

      if (qrError || !Array.isArray(qrReviewRows)) {
        continue
      }

      qrReviewCount = qrReviewRows.length
      qrReviewSum = qrReviewRows.reduce((sum: number, row: { rating?: number | null }) => sum + Number(row?.rating || 0), 0)
      qrReviews = qrReviewRows.map((row: any) => ({
        id: String(row.id),
        rating: Number(row.rating || 0),
        content: String(row.content || row.title || ""),
        title: row.title ? String(row.title) : null,
        created_at: String(row.created_at || new Date().toISOString()),
        tourist: {
          full_name: String(row.reviewer_name || "Verified Guest"),
          avatar_url: null,
        },
      }))
      break
    }

    const images = data.images && data.images.length > 0 ? data.images : data.photos || []
    const schedules = Array.isArray(data.tour_schedules) ? data.tour_schedules : []
    const reviews = Array.isArray(data.reviews) ? data.reviews : []
    const combinedReviews = [...reviews, ...qrReviews].sort((a: any, b: any) => {
      const left = a?.created_at ? new Date(a.created_at).getTime() : 0
      const right = b?.created_at ? new Date(b.created_at).getTime() : 0
      return right - left
    })

    const nowMs = Date.now()
    const next30DaysMs = nowMs + 30 * 24 * 60 * 60 * 1000
    const totalReservedSpots = schedules.reduce((sum, schedule) => sum + Math.max(Number(schedule.booked_count || 0), 0), 0)
    const bookingsNext30Days = schedules.reduce((sum, schedule) => {
      const startAtMs = new Date(schedule.start_time).getTime()
      if (!Number.isFinite(startAtMs) || startAtMs < nowMs || startAtMs > next30DaysMs) return sum
      return sum + Math.max(Number(schedule.booked_count || 0), 0)
    }, 0)
    const upcomingScheduleCount = schedules.filter((schedule) => {
      const startAtMs = new Date(schedule.start_time).getTime()
      return Number.isFinite(startAtMs) && startAtMs > nowMs
    }).length

    const baseReviewCount = reviews.length
    const baseReviewSum = reviews.reduce((sum: number, row: { rating?: number | null }) => sum + Number(row?.rating || 0), 0)
    const combinedReviewCount = baseReviewCount + qrReviewCount
    const combinedAverageRating =
      combinedReviewCount > 0 ? Number(((baseReviewSum + qrReviewSum) / combinedReviewCount).toFixed(1)) : 0
    const verifiedBookingSignal = totalReservedSpots > 0 || combinedReviewCount > 0

    const rawGuide = Array.isArray(data.guide) ? data.guide[0] : data.guide
    const guide = rawGuide
      ? {
          ...rawGuide,
          plan_type: guidePlanType,
          is_pro: guidePlanType === "pro",
          verified_badge: false,
          first_published_tour_at: firstPublishedTourAt || null,
          total_published_tours: publishedToursCount,
        }
      : null

    return NextResponse.json(
      {
        ...data,
        images,
        tour_stops: tourStops,
        reviews: combinedReviews,
        review_count: combinedReviewCount,
        average_rating: combinedAverageRating,
        rating: combinedAverageRating,
        guide,
        is_premium: isBoosted,
        booking_aggregates: {
          total_reserved_spots: totalReservedSpots,
          bookings_next_30_days: bookingsNext30Days,
          upcoming_schedule_count: upcomingScheduleCount,
          trusted_review_count: combinedReviewCount,
          verified_booking_signal: verifiedBookingSignal,
        },
        practical_policies: {
          minimum_attendees: Math.max(1, Number(data.minimum_attendees || 1)),
          payment_methods: ["Tip after the tour (cash or digital, as accepted by your guide)."],
          group_policy: `Max ${data.max_capacity || data.max_group_size || 10} guests`,
          accessibility: data.accessibility_info || null,
          cancellation_policy_short: null,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    )
  } catch (error) {
    console.error("Error fetching tour:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { id } = await context.params

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: tour } = await supabase
      .from("tours")
      .select(
        "id, guide_id, title, city, city_slug, tour_slug, status, description, highlights, seo_keywords, seo_title, seo_meta_description, seo_title_manually_overridden, seo_meta_description_manually_overridden, max_capacity, minimum_attendees",
      )
      .eq("id", id)
      .single()

    if (!tour || tour.guide_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()

    const requestedMaxCapacity =
      body.max_capacity === undefined ? null : parseIntegerOrNull(body.max_capacity)
    if (body.max_capacity !== undefined && (requestedMaxCapacity === null || requestedMaxCapacity < 1)) {
      return NextResponse.json({ error: "max_capacity must be at least 1" }, { status: 400 })
    }

    const requestedMinimumAttendees =
      body.minimum_attendees === undefined ? null : parseIntegerOrNull(body.minimum_attendees)
    if (body.minimum_attendees !== undefined && (requestedMinimumAttendees === null || requestedMinimumAttendees < 1)) {
      return NextResponse.json({ error: "minimum_attendees must be at least 1" }, { status: 400 })
    }

    const currentMaxCapacity = parseIntegerOrNull(tour.max_capacity) || 10
    const currentMinimumAttendees = parseIntegerOrNull(tour.minimum_attendees) || 1
    const nextMaxCapacity = requestedMaxCapacity ?? currentMaxCapacity
    const nextMinimumAttendees = requestedMinimumAttendees ?? currentMinimumAttendees
    if (nextMinimumAttendees > nextMaxCapacity) {
      return NextResponse.json(
        { error: `minimum_attendees cannot be greater than max_capacity (${nextMaxCapacity})` },
        { status: 400 },
      )
    }

    if (body.description !== undefined && String(body.description).trim().length < TOUR_DESCRIPTION_MIN_CHARS) {
      return NextResponse.json({ error: DESCRIPTION_MIN_MESSAGE }, { status: 400 })
    }

    if (body.images !== undefined) {
      if (!Array.isArray(body.images)) {
        return NextResponse.json({ error: "images must be an array" }, { status: 400 })
      }
      if (body.images.length > TOUR_IMAGE_POLICY.maxImagesPerTour) {
        return NextResponse.json(
          { error: `Maximum ${TOUR_IMAGE_POLICY.maxImagesPerTour} images per tour` },
          { status: 400 },
        )
      }
    }

    const payload: Record<string, any> = {
      ...body,
      updated_at: new Date().toISOString(),
      published_at:
        body.status === "published"
          ? new Date().toISOString()
          : body.status === "draft"
            ? null
            : undefined,
    }

    if (body.seo_keywords !== undefined) {
      payload.seo_keywords = normalizeSeoKeywords(body.seo_keywords)
    }
    if (requestedMaxCapacity !== null) {
      payload.max_capacity = requestedMaxCapacity
    }
    if (requestedMinimumAttendees !== null) {
      payload.minimum_attendees = requestedMinimumAttendees
    }

    const nextCity = String(body.city ?? tour.city ?? "")
    const nextTitle = String(body.title ?? tour.title ?? "")
    const nextDescription = String(body.description ?? tour.description ?? "")
    const nextStatus = String(body.status ?? tour.status ?? "draft")

    const cityChanged = typeof body.city === "string" && body.city !== tour.city
    const titleChanged = typeof body.title === "string" && body.title !== tour.title

    if (cityChanged || titleChanged || !tour.city_slug || !tour.tour_slug) {
      const { citySlug, tourSlug } = await generateUniqueTourSlugPair(supabase, nextCity, nextTitle, id)
      payload.city_slug = citySlug
      payload.tour_slug = tourSlug
    }

    const nextStopNames = await getStopNamesForPublish(supabase, id, body.highlights ?? tour.highlights ?? [])

    if (nextStatus === "published") {
      const [{ bio, fullName }, futureScheduleCount] = await Promise.all([
        getGuideBioAndName(supabase, user.id),
        getFutureScheduleCount(supabase, id),
      ])

      const publishIssues = validatePublishRequirements({
        description: nextDescription,
        guideBio: bio,
        stopCount: nextStopNames.length,
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

      const neighbourhood = deriveNeighbourhood(nextTitle, nextCity, nextStopNames)
      if (!Boolean(tour.seo_title_manually_overridden) && !String(body.seo_title ?? tour.seo_title ?? "").trim()) {
        payload.seo_title = buildAutoSeoTitle({
          neighbourhood,
          city: nextCity,
        })
      }

      if (
        !Boolean(tour.seo_meta_description_manually_overridden) &&
        !String(body.seo_meta_description ?? tour.seo_meta_description ?? "").trim()
      ) {
        payload.seo_meta_description = buildAutoSeoMetaDescription({
          neighbourhood,
          guideFirstName: getGuideFirstName(fullName),
          stopNames: nextStopNames,
          maxGuests: Number(body.max_capacity ?? tour.max_capacity ?? 10),
        })
      }
    }

    const { data, error } = await supabase.from("tours").update(payload).eq("id", id).select().single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const shouldRefreshStops =
      body.highlights !== undefined || body.description !== undefined || body.city !== undefined || body.title !== undefined

    if (shouldRefreshStops) {
      try {
        await syncAndRefreshTourStopContent({
          supabase,
          tourId: id,
          city: nextCity,
          neighbourhood: deriveNeighbourhood(nextTitle, nextCity, nextStopNames),
          guideDescription: nextDescription,
          highlights: nextStopNames,
          forceHighlightRegeneration: nextTitle.trim().toLowerCase() === "city of lights walking tour",
        })
      } catch (stopSyncError) {
        console.warn("[v0] Failed to sync tour_stops after tour update:", stopSyncError)
      }
    }

    revalidateTourSeo({
      city: tour.city,
      citySlug: tour.city_slug,
      title: tour.title,
      tourSlug: tour.tour_slug,
    })
    revalidateTourSeo({
      city: data.city,
      citySlug: data.city_slug,
      title: data.title,
      tourSlug: data.tour_slug,
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error updating tour:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { id } = await context.params

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: tour } = await supabase
      .from("tours")
      .select("guide_id, city, city_slug, title, tour_slug")
      .eq("id", id)
      .single()

    if (!tour || tour.guide_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { error } = await supabase.from("tours").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    revalidateTourSeo({
      city: tour.city,
      citySlug: tour.city_slug,
      title: tour.title,
      tourSlug: tour.tour_slug,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting tour:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
