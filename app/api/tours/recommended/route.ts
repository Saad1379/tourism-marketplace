import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { resolveCitySlug } from "@/lib/tour-url"
import { type NextRequest, NextResponse } from "next/server"

type RawTour = {
  id: string
  title: string
  city: string
  city_slug: string | null
  tour_slug: string | null
  country: string | null
  duration_minutes: number | null
  max_capacity: number | null
  languages: string[] | null
  images: any[] | null
  photos: any[] | null
  guide:
    | {
        full_name: string | null
        avatar_url: string | null
      }
    | Array<{
        full_name: string | null
        avatar_url: string | null
      }>
    | null
  reviews: Array<{ rating: number | null }> | null
  tour_schedules: Array<{
    start_time: string | null
    capacity: number | null
    booked_count: number | null
  }> | null
}

export async function GET(request: NextRequest) {
  const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" }

  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const city = (searchParams.get("city") || "").trim()
    const citySlug = resolveCitySlug(searchParams.get("city_slug") || "")
    const excludeId = (searchParams.get("exclude") || "").trim()
    const limitValue = Number.parseInt(searchParams.get("limit") || "3", 10)
    const limit = Math.min(Math.max(Number.isFinite(limitValue) ? limitValue : 3, 1), 12)

    if (!citySlug && !city) {
      return NextResponse.json({ error: "city or city_slug is required" }, { status: 400, headers: noStoreHeaders })
    }

    let query = supabase
      .from("tours")
      .select(`
        id,
        title,
        city,
        city_slug,
        tour_slug,
        country,
        duration_minutes,
        max_capacity,
        languages,
        images,
        photos,
        guide:guide_id(full_name, avatar_url),
        reviews(rating),
        tour_schedules(start_time, capacity, booked_count)
      `)
      .eq("status", "published")
      .limit(40)

    if (citySlug) {
      query = query.eq("city_slug", citySlug)
    } else {
      query = query.ilike("city", city)
    }

    if (excludeId) {
      query = query.neq("id", excludeId)
    }

    const { data, error } = await query

    if (error) {
      console.error("[v0] Error fetching recommended tours:", error)
      return NextResponse.json({ error: "Failed to fetch recommended tours" }, { status: 500, headers: noStoreHeaders })
    }

    const rows = Array.isArray(data) ? (data as RawTour[]) : []
    const tourIds = rows.map((tour) => tour.id)
    let boostedTourIds = new Set<string>()
    const qrStats = new Map<string, { count: number; sum: number }>()

    if (tourIds.length > 0) {
      const { data: boostedRows } = await supabase
        .from("tour_boosts")
        .select("tour_id")
        .in("tour_id", tourIds)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())

      boostedTourIds = new Set((boostedRows || []).map((row: { tour_id: string }) => row.tour_id))

      try {
        const serviceSupabase = createServiceRoleClient()
        const { data: qrRows } = await serviceSupabase
          .from("review_qr_reviews")
          .select("tour_id, rating")
          .eq("is_published", true)
          .in("tour_id", tourIds)
          .limit(10000)

        for (const row of qrRows || []) {
          if (!row.tour_id) continue
          const current = qrStats.get(row.tour_id) || { count: 0, sum: 0 }
          current.count += 1
          current.sum += Number(row.rating || 0)
          qrStats.set(row.tour_id, current)
        }
      } catch {
        // Ignore QR stats errors to keep fallback behavior.
      }
    }

    const nowMs = Date.now()
    const results = rows
      .map((tour) => {
        const reviews = Array.isArray(tour.reviews) ? tour.reviews : []
        const baseReviewCount = reviews.length
        const baseAverageRating =
          baseReviewCount > 0
            ? Number((reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / baseReviewCount).toFixed(1))
            : 0
        const baseReviewSum = baseReviewCount > 0 ? baseAverageRating * baseReviewCount : 0
        const qr = qrStats.get(tour.id)
        const reviewCount = baseReviewCount + Number(qr?.count || 0)
        const averageRating =
          reviewCount > 0 ? Number(((baseReviewSum + Number(qr?.sum || 0)) / reviewCount).toFixed(1)) : 0

        const schedules = Array.isArray(tour.tour_schedules) ? tour.tour_schedules : []
        const nextAvailable = schedules
          .filter((schedule) => {
            const capacity = Number(schedule.capacity || 0)
            const booked = Number(schedule.booked_count || 0)
            const startMs = new Date(String(schedule.start_time || "")).getTime()
            return Number.isFinite(startMs) && startMs > nowMs && capacity - booked > 0
          })
          .sort((a, b) => new Date(String(a.start_time)).getTime() - new Date(String(b.start_time)).getTime())[0]

        const nextAvailableSpots = nextAvailable
          ? Math.max(Number(nextAvailable.capacity || 0) - Number(nextAvailable.booked_count || 0), 0)
          : null

        const guideRecord = Array.isArray(tour.guide) ? tour.guide[0] : tour.guide

        return {
          id: tour.id,
          title: tour.title,
          city: tour.city,
          city_slug: tour.city_slug,
          tour_slug: tour.tour_slug,
          country: tour.country,
          duration_minutes: tour.duration_minutes || 90,
          max_capacity: tour.max_capacity || 15,
          languages: Array.isArray(tour.languages) ? tour.languages : [],
          images: tour.images || [],
          photos: tour.photos || [],
          guide: guideRecord || null,
          review_count: reviewCount,
          average_rating: averageRating,
          next_available_start_time: nextAvailable?.start_time || null,
          next_available_spots: nextAvailableSpots,
          is_premium: boostedTourIds.has(tour.id),
        }
      })
      .sort((a, b) => {
        const reviewsDelta = Number(b.review_count || 0) - Number(a.review_count || 0)
        if (reviewsDelta !== 0) return reviewsDelta
        const ratingDelta = Number(b.average_rating || 0) - Number(a.average_rating || 0)
        if (ratingDelta !== 0) return ratingDelta
        return String(a.title || "").localeCompare(String(b.title || ""))
      })

    return NextResponse.json(results.slice(0, limit), { headers: noStoreHeaders })
  } catch (error) {
    console.error("[v0] Server error in GET /api/tours/recommended:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500, headers: noStoreHeaders })
  }
}
