"use server"

// Server-side Supabase query functions
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getSupabaseEnv } from "./env"
import { resolveCitySlug } from "@/lib/tour-url"
import { createServiceRoleClient } from "./server"

let hasWarnedMissingEnv = false
let hasWarnedFeaturedCitiesFetch = false

type FeaturedCity = {
  name: string
  country: string
  tours: number
  image: string
}

const FEATURED_CITIES_FALLBACK: FeaturedCity[] = [
  { name: "Paris", country: "France", tours: 120, image: "/paris-cityscape-eiffel-tower.jpg" },
  { name: "Rome", country: "Italy", tours: 105, image: "/rome-cityscape-colosseum.jpg" },
  { name: "Barcelona", country: "Spain", tours: 94, image: "/barcelona-cityscape-sagrada-familia.jpg" },
  { name: "London", country: "United Kingdom", tours: 88, image: "/london-cityscape-big-ben.jpg" },
  { name: "Prague", country: "Czech Republic", tours: 72, image: "/prague-castle-old-town-square.jpg" },
]

const CITY_LANDMARK_IMAGE_OVERRIDES: Record<string, string> = {
  paris: "/paris-cityscape-eiffel-tower.jpg",
  rome: "/rome-cityscape-colosseum.jpg",
  barcelona: "/barcelona-cityscape-sagrada-familia.jpg",
  london: "/london-cityscape-big-ben.jpg",
  amsterdam: "/amsterdam-canal-houses-boats.jpg",
  prague: "/prague-castle-old-town-square.jpg",
  berlin: "/berlin-wall-memorial-graffiti.jpg",
  lisbon: "/lisbon-alfama-colorful-streets.jpg",
  vienna: "/vienna-palace-baroque-architecture.jpg",
  athens: "/athens-acropolis-parthenon-view.jpg",
  florence: "/florence-duomo-renaissance-architecture.jpg",
}

const DEFAULT_CANCELLATION_POLICY_SHORT = "Cancel at least 24h before start so others can join."

export type PublicTourSort = "recommended" | "rating_desc" | "reviews_desc" | "duration_asc"

interface PublicTourFilters {
  city?: string
  limit?: number
  q?: string
  language?: string
  duration?: string
  sort?: PublicTourSort
}

async function getSupabaseServer() {
  const env = getSupabaseEnv()
  if (!env) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Supabase credentials missing: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY not set in environment",
      )
    }

    if (!hasWarnedMissingEnv) {
      hasWarnedMissingEnv = true
      console.warn(
        "[v0] Supabase environment variables are missing. Returning empty server query results until NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are configured.",
      )
    }
    return null
  }

  const cookieStore = await cookies()
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      },
    },
  })
}

function getSupabaseStaticReader() {
  try {
    return createServiceRoleClient()
  } catch {
    return null
  }
}

async function getSupabasePublicReader() {
  const staticReader = getSupabaseStaticReader()
  if (staticReader) return staticReader
  return getSupabaseServer()
}

type QrReviewAggregate = {
  count: number
  sum: number
}

type QrReviewRow = {
  id: string
  rating: number | null
  title: string | null
  content: string | null
  created_at: string | null
  reviewer_name: string | null
}

function normalizeTourStopsForOutput(tour: any) {
  const directStops = Array.isArray(tour?.tour_stops) ? tour.tour_stops : []
  if (directStops.length > 0) {
    return directStops
      .map((stop: any, index: number) => ({
        id: String(stop?.id || `${tour?.id || "tour"}-stop-${index + 1}`),
        tour_id: String(stop?.tour_id || tour?.id || ""),
        position: Number(stop?.position || index + 1),
        stop_name: String(stop?.stop_name || ""),
        highlight: stop?.highlight ? String(stop.highlight) : null,
        route_snapshot: stop?.route_snapshot ? String(stop.route_snapshot) : null,
        google_context: stop?.google_context ? String(stop.google_context) : null,
        highlight_manually_overridden: Boolean(stop?.highlight_manually_overridden),
        route_snapshot_manually_overridden: Boolean(stop?.route_snapshot_manually_overridden),
      }))
      .sort((a: any, b: any) => Number(a.position || 0) - Number(b.position || 0))
  }

  const highlights = Array.isArray(tour?.highlights) ? tour.highlights : []
  return highlights
    .map((value: unknown) => String(value || "").trim())
    .filter(Boolean)
    .map((stopName: string, index: number) => ({
      id: `${tour?.id || "tour"}-legacy-stop-${index + 1}`,
      tour_id: String(tour?.id || ""),
      position: index + 1,
      stop_name: stopName,
      highlight: stopName,
      route_snapshot: null,
      google_context: null,
      highlight_manually_overridden: false,
      route_snapshot_manually_overridden: false,
    }))
}

function mergeReviewStats(baseCount: number, baseAverage: number, qrStats?: QrReviewAggregate) {
  const qrCount = qrStats?.count || 0
  const qrSum = qrStats?.sum || 0
  const safeBaseCount = Math.max(Number(baseCount || 0), 0)
  const safeBaseAverage = Number.isFinite(baseAverage) ? Number(baseAverage) : 0
  const baseSum = safeBaseCount > 0 ? safeBaseAverage * safeBaseCount : 0
  const totalCount = safeBaseCount + qrCount
  const totalSum = baseSum + qrSum

  return {
    count: totalCount,
    average: totalCount > 0 ? Number((totalSum / totalCount).toFixed(1)) : 0,
  }
}

async function getQrReviewAggregatesForTours(
  supabase: any,
  tourIds: string[],
): Promise<Map<string, QrReviewAggregate>> {
  const uniqueTourIds = Array.from(new Set(tourIds.filter(Boolean)))
  if (uniqueTourIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from("review_qr_reviews")
    .select("tour_id, rating")
    .eq("is_published", true)
    .in("tour_id", uniqueTourIds)
    .limit(10000)

  if (error || !data) {
    return new Map()
  }

  const aggregates = new Map<string, QrReviewAggregate>()
  for (const row of data as Array<{ tour_id: string; rating: number | null }>) {
    const tourId = row.tour_id
    if (!tourId) continue
    const current = aggregates.get(tourId) || { count: 0, sum: 0 }
    current.count += 1
    current.sum += Number(row.rating || 0)
    aggregates.set(tourId, current)
  }

  return aggregates
}

async function getQrReviewsForTour(
  supabase: any,
  tourId: string,
  limit = 500,
): Promise<Array<{
  id: string
  rating: number
  content: string
  title: string | null
  created_at: string
  tourist: { full_name: string; avatar_url: string | null }
}>> {
  if (!tourId) return []

  const { data, error } = await supabase
    .from("review_qr_reviews")
    .select("id, rating, title, content, created_at, reviewer_name")
    .eq("tour_id", tourId)
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !Array.isArray(data)) return []

  return (data as QrReviewRow[]).map((row) => ({
    id: String(row.id),
    rating: Number(row.rating || 0),
    content: String(row.content || row.title || ""),
    title: row.title ? String(row.title) : null,
    created_at: String(row.created_at || new Date().toISOString()),
    tourist: {
      full_name: row.reviewer_name?.trim() || "Verified Guest",
      avatar_url: null,
    },
  }))
}

function normalizePublicTourSort(sort?: string): PublicTourSort {
  if (sort === "rating_desc" || sort === "reviews_desc" || sort === "duration_asc") {
    return sort
  }
  return "recommended"
}

function getFeaturedCitiesFallback(limit: number): FeaturedCity[] {
  return FEATURED_CITIES_FALLBACK.slice(0, Math.max(limit, 1))
}

function getCityLandmarkImage(city: string | null | undefined): string | null {
  if (!city) return null
  const key = resolveCitySlug(city)
  return CITY_LANDMARK_IMAGE_OVERRIDES[key] || null
}

function matchesDurationFilter(duration: string | undefined, minutes: number): boolean {
  if (!duration) return true
  if (duration === "short") return minutes < 120
  if (duration === "medium") return minutes >= 120 && minutes <= 180
  if (duration === "long") return minutes > 180
  return true
}

// Get all public tours with optional filters, ranking, and explicit sort modes for conversion UX.
export async function getPublicTours(filters?: PublicTourFilters) {
  const supabase = await getSupabasePublicReader()
  if (!supabase) return []
  const pageLimit = filters?.limit || 20
  const sortMode = normalizePublicTourSort(filters?.sort)

  const { data, error } = await supabase.rpc("get_ranked_tours", {
    search_city: filters?.city || null,
    search_language: filters?.language || null,
    limit_val: pageLimit * 6,
    offset_val: 0,
  })

  if (error) {
    console.error("[v0] Error fetching ranked tours:", error)
    return []
  }

  if (!data || data.length === 0) return []

  let filteredData = data
  if (filters?.q) {
    const searchTerm = filters.q.toLowerCase()
    filteredData = filteredData.filter(
      (t: any) =>
        (t.title && t.title.toLowerCase().includes(searchTerm)) ||
        (t.city && t.city.toLowerCase().includes(searchTerm)),
    )
  }

  filteredData = filteredData.filter((t: any) => matchesDurationFilter(filters?.duration, t.duration_minutes || 0))
  if (filteredData.length === 0) return []

  const toursById = new Map<string, any>()
  const nowMs = Date.now()
  filteredData.forEach((rpcData: any) => {
    const tourId = rpcData.tour_id
    const existing = toursById.get(tourId)
    const schedule = {
      id: rpcData.schedule_id,
      start_time: rpcData.start_time,
      capacity: rpcData.capacity,
      booked_count: rpcData.booked_count,
      language: rpcData.language,
    }

    const spotsLeft = Math.max((rpcData.capacity || 0) - (rpcData.booked_count || 0), 0)
    const startTime = rpcData.start_time ? new Date(rpcData.start_time).getTime() : Number.POSITIVE_INFINITY
    const isFutureSlot = spotsLeft > 0 && Number.isFinite(startTime) && startTime > nowMs

    if (!existing) {
      toursById.set(tourId, {
        id: tourId,
        guide_id: rpcData.guide_id,
        title: rpcData.title,
        city: rpcData.city,
        city_slug: rpcData.city_slug || null,
        tour_slug: rpcData.tour_slug || null,
        price: rpcData.price,
        duration_minutes: rpcData.duration_minutes,
        meeting_point: rpcData.meeting_point,
        images: rpcData.images || [],
        photos: rpcData.photos || [],
        max_capacity: rpcData.capacity,
        languages: rpcData.language ? [rpcData.language] : ["English"],
        guide: {
          id: rpcData.guide_id,
          full_name: rpcData.guide_name,
          avatar_url: rpcData.guide_avatar,
          bio: null,
          role: rpcData.guide_role,
          plan_type: rpcData.plan_type || "free",
          is_pro: (rpcData.plan_type || "free") === "pro",
          guide_rating: null,
          guide_total_reviews: null,
        },
        reviews: Array.from({ length: rpcData.tour_review_count || 0 }).map(() => ({ rating: rpcData.tour_rating })),
        review_count: rpcData.tour_review_count || 0,
        average_rating: Number(rpcData.tour_rating || 0),
        tour_schedules: [schedule],
        pool_type: rpcData.pool_type,
        plan_type: rpcData.plan_type || "free",
        guide_is_pro: (rpcData.plan_type || "free") === "pro",
        rank_score: rpcData.rank_score,
        is_premium: rpcData.is_boosted,
        next_available_start_time: isFutureSlot ? rpcData.start_time : null,
        next_available_spots: isFutureSlot ? spotsLeft : null,
        _next_available_ts: isFutureSlot ? startTime : Number.POSITIVE_INFINITY,
      })
      return
    }

    existing.tour_schedules.push(schedule)
    if (rpcData.language && !existing.languages.includes(rpcData.language)) {
      existing.languages.push(rpcData.language)
    }
    existing.max_capacity = Math.max(existing.max_capacity || 0, rpcData.capacity || 0)

    if (isFutureSlot && startTime < existing._next_available_ts) {
      existing._next_available_ts = startTime
      existing.next_available_start_time = rpcData.start_time
      existing.next_available_spots = spotsLeft
    }
  })

  const qrAggregates = await getQrReviewAggregatesForTours(supabase, Array.from(toursById.keys()))
  for (const [tourId, tour] of toursById.entries()) {
    const merged = mergeReviewStats(
      Number(tour.review_count || 0),
      Number(tour.average_rating || 0),
      qrAggregates.get(tourId),
    )
    tour.review_count = merged.count
    tour.average_rating = merged.average
  }

  const aggregatedTours = Array.from(toursById.values()).map((tour) => {
    const { _next_available_ts, ...publicTour } = tour
    return publicTour
  })

  const hydrateCanonicalSlugs = async (tours: any[]) => {
    if (tours.length === 0) return tours

    const tourIds = tours
      .map((tour) => tour.id)
      .filter((value): value is string => Boolean(value))

    if (tourIds.length === 0) return tours

    const { data: slugRows, error: slugError } = await supabase
      .from("tours")
      .select("id, city_slug, tour_slug, languages")
      .in("id", tourIds)
      .limit(5000)

    if (slugError || !slugRows) return tours

    const slugMap = new Map<string, { city_slug: string | null; tour_slug: string | null; languages: string[] }>()
    for (const row of slugRows) {
      slugMap.set(row.id, {
        city_slug: row.city_slug || null,
        tour_slug: row.tour_slug || null,
        languages: Array.isArray(row.languages) ? row.languages.filter((lang: unknown) => Boolean(lang)).map(String) : [],
      })
    }

    return tours.map((tour) => {
      const found = slugMap.get(tour.id)
      if (!found) return tour
      const mergedLanguages = Array.from(
        new Set(
          [
            ...(Array.isArray(tour.languages) ? tour.languages : []).map((lang: unknown) => String(lang)),
            ...found.languages,
          ]
            .map((lang) => lang.trim())
            .filter(Boolean),
        ),
      )
      return {
        ...tour,
        city_slug: tour.city_slug || found.city_slug,
        tour_slug: tour.tour_slug || found.tour_slug,
        languages: mergedLanguages.length > 0 ? mergedLanguages : ["English"],
      }
    })
  }

  const hydrateGuideProfiles = async (tours: any[]) => {
    if (tours.length === 0) return tours

    const guideIds = Array.from(
      new Set(
        tours
          .map((tour) => tour?.guide?.id)
          .filter((value): value is string => Boolean(value)),
      ),
    )

    if (guideIds.length === 0) {
      return tours.map((tour) => ({
        ...tour,
        is_new_tour: Number(tour.review_count || 0) === 0,
        cancellation_policy_short: DEFAULT_CANCELLATION_POLICY_SHORT,
      }))
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, bio, guide_rating, guide_total_reviews")
      .in("id", guideIds)
      .limit(5000)

    if (profilesError || !profiles) {
      return tours.map((tour) => ({
        ...tour,
        is_new_tour: Number(tour.review_count || 0) === 0,
        cancellation_policy_short: DEFAULT_CANCELLATION_POLICY_SHORT,
      }))
    }

    const profileMap = new Map<string, { bio: string | null; guide_rating: number | null; guide_total_reviews: number | null }>()
    for (const profile of profiles) {
      profileMap.set(profile.id, {
        bio: profile.bio || null,
        guide_rating: typeof profile.guide_rating === "number" ? profile.guide_rating : null,
        guide_total_reviews: typeof profile.guide_total_reviews === "number" ? profile.guide_total_reviews : null,
      })
    }

    return tours.map((tour) => {
      const profile = tour?.guide?.id ? profileMap.get(tour.guide.id) : null
      return {
        ...tour,
        is_new_tour: Number(tour.review_count || 0) === 0,
        cancellation_policy_short: tour.cancellation_policy_short || DEFAULT_CANCELLATION_POLICY_SHORT,
        guide: tour.guide
          ? {
              ...tour.guide,
              bio: tour.guide.bio || profile?.bio || null,
              guide_rating: profile?.guide_rating ?? tour.guide.guide_rating ?? null,
              guide_total_reviews: profile?.guide_total_reviews ?? tour.guide.guide_total_reviews ?? null,
            }
          : null,
      }
    })
  }

  if (sortMode !== "recommended") {
    const sorted = [...aggregatedTours]
    if (sortMode === "rating_desc") {
      sorted.sort((a, b) => (b.average_rating - a.average_rating) || (b.review_count - a.review_count))
    } else if (sortMode === "reviews_desc") {
      sorted.sort((a, b) => (b.review_count - a.review_count) || (b.average_rating - a.average_rating))
    } else if (sortMode === "duration_asc") {
      sorted.sort((a, b) => (a.duration_minutes || 0) - (b.duration_minutes || 0))
    }
    const withCanonicalSlugs = await hydrateCanonicalSlugs(sorted.slice(0, pageLimit))
    return hydrateGuideProfiles(withCanonicalSlugs)
  }

  // Recommended mode: keep quota mixer behavior.
  const proTarget = Math.round(pageLimit * 0.58)
  const freeTarget = Math.round(pageLimit * 0.27)
  const newTarget = pageLimit - proTarget - freeTarget

  const pools = {
    pro: filteredData.filter((t: any) => t.pool_type === "pro"),
    free: filteredData.filter((t: any) => t.pool_type === "free"),
    newcomer: filteredData.filter((t: any) => t.pool_type === "newcomer"),
  }

  const finalPage: any[] = []
  const guideFrequencyCount = new Map<string, number>()
  const insertedTours = new Set<string>()

  const pullFromPool = (poolName: "pro" | "free" | "newcomer") => {
    const pool = pools[poolName]
    for (let i = 0; i < pool.length; i++) {
      const item = pool[i]
      const guideCount = guideFrequencyCount.get(item.guide_id) || 0
      if (guideCount < 2 && !insertedTours.has(item.tour_id)) {
        guideFrequencyCount.set(item.guide_id, guideCount + 1)
        insertedTours.add(item.tour_id)
        pool.splice(i, 1)
        return item
      }
    }
    return null
  }

  let proCount = 0
  let freeCount = 0
  let newCount = 0

  for (let i = 0; i < pageLimit; i++) {
    let item = null
    if (newCount < newTarget) {
      item = pullFromPool("newcomer")
      if (item) newCount++
    }
    if (!item && freeCount < freeTarget) {
      item = pullFromPool("free")
      if (item) freeCount++
    }
    if (!item && proCount < proTarget) {
      item = pullFromPool("pro")
      if (item) proCount++
    }
    if (!item) item = pullFromPool("pro")
    if (!item) item = pullFromPool("free")
    if (!item) item = pullFromPool("newcomer")
    if (item) {
      finalPage.push(item)
    } else {
      break
    }
  }

  const recommendedTours = finalPage
    .map((row) => toursById.get(row.tour_id))
    .filter(Boolean)

  const withCanonicalSlugs = await hydrateCanonicalSlugs(recommendedTours)
  return hydrateGuideProfiles(withCanonicalSlugs)
}

// Get single tour with guide and schedules
export async function getTourById(tourId: string) {
  const supabase = await getSupabaseServer()
  if (!supabase) return null

  const { data, error } = await supabase
    .from("tours")
    .select(`
      *,
      guide:guide_id(id, full_name, avatar_url, bio, role),
      tour_stops(id, tour_id, position, stop_name, highlight, route_snapshot, google_context, highlight_manually_overridden, route_snapshot_manually_overridden),
      tour_schedules(id, start_time, capacity, language, booked_count),
      reviews(id, rating, content, title, created_at, tourist:tourist_id(full_name, avatar_url))
    `)
    .eq("id", tourId)
    .eq("status", "published")
    .single()

  if (error) {
    console.error("[v0] Error fetching tour:", error)
    return null
  }

  const qrReviews = await getQrReviewsForTour(supabase, tourId)
  const baseReviews = Array.isArray(data.reviews) ? data.reviews : []
  const baseCount = baseReviews.length
  const baseAverage = baseCount > 0
    ? Number((baseReviews.reduce((sum: number, row: any) => sum + Number(row?.rating || 0), 0) / baseCount).toFixed(1))
    : 0
  const qrAggregates = await getQrReviewAggregatesForTours(supabase, [tourId])
  const merged = mergeReviewStats(baseCount, baseAverage, qrAggregates.get(tourId))
  const reviews = [...baseReviews, ...qrReviews].sort((a: any, b: any) => {
    const left = a?.created_at ? new Date(a.created_at).getTime() : 0
    const right = b?.created_at ? new Date(b.created_at).getTime() : 0
    return right - left
  })

  return {
    ...data,
    tour_stops: normalizeTourStopsForOutput(data),
    reviews,
    review_count: merged.count,
    average_rating: merged.average,
  }
}

function cityNameFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ")
}

function wordCount(value: string | null | undefined): number {
  if (!value) return 0
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

function buildCityEditorialFallback(citySlug: string, cityName: string): string {
  if (citySlug === "paris") {
    return [
      `Paris rewards travelers who explore it on foot, and free walking tours help you understand each district beyond postcard landmarks. On TipWalk, you can compare local guides, languages, and start times before you reserve. Booking is free, and you tip your guide at the end based on the quality of the experience.`,
      `If this is your first time in Paris, start with routes around the Marais, Ile de la Cite, and the Latin Quarter for major history and architecture. Montmartre is ideal if you want views, art stories, and neighborhood character. Returning travelers often prefer quieter routes with local markets, side streets, and practical recommendations for where to eat or continue exploring after the tour.`,
      `For planning, wear comfortable shoes, check the weather, and arrive 10 to 15 minutes early at the listed meeting point. Spring and early fall usually provide the easiest walking conditions, while summer afternoons can feel crowded around top landmarks. Most tours run with small groups so you can ask questions and move at a steady pace. Before booking, review tour duration, language, and group limits to choose the best fit for your trip schedule.`,
    ].join("\n\n")
  }

  return [
    `Discover free walking tours in ${cityName} with verified local guides on TipWalk. Compare routes, languages, and schedules to find the right tour style for your trip.`,
    `Reserve your spot for free, join your guide at the listed meeting point, and tip at the end based on the value of the experience.`,
    `Before booking, check the duration, group size, and practical details so you can choose the best option for your day.`,
  ].join("\n\n")
}

export async function getTourCanonicalById(tourId: string) {
  const supabase = await getSupabasePublicReader()
  if (!supabase) return null

  const { data, error } = await supabase
    .from("tours")
    .select("id, title, city, city_slug, tour_slug, status")
    .eq("id", tourId)
    .maybeSingle()

  if (error || !data || data.status !== "published") {
    return null
  }

  const citySlug = data.city_slug || resolveCitySlug(data.city || "")
  const tourSlug = data.tour_slug || "tour"
  return {
    id: data.id,
    title: data.title,
    city: data.city,
    city_slug: citySlug,
    tour_slug: tourSlug,
  }
}

export async function getTourByCityAndTourSlug(citySlug: string, tourSlug: string) {
  const supabase = await getSupabasePublicReader()
  if (!supabase) return null

  const normalizedCitySlug = resolveCitySlug(citySlug)
  const normalizedTourSlug = tourSlug.trim().toLowerCase()

  const { data, error } = await supabase
    .from("tours")
    .select(`
      *,
      guide:guide_id(id, full_name, avatar_url, bio, role),
      tour_stops(id, tour_id, position, stop_name, highlight, route_snapshot, google_context, highlight_manually_overridden, route_snapshot_manually_overridden),
      tour_schedules(id, start_time, capacity, language, booked_count),
      reviews(id, rating, content, title, created_at, tourist:tourist_id(full_name, avatar_url))
    `)
    .eq("status", "published")
    .eq("city_slug", normalizedCitySlug)
    .eq("tour_slug", normalizedTourSlug)
    .maybeSingle()

  if (error) {
    console.error("[v0] Error fetching canonical tour:", error)
    return null
  }

  if (!data) return null

  const qrReviews = await getQrReviewsForTour(supabase, data.id)
  const baseReviews = Array.isArray(data.reviews) ? data.reviews : []
  const baseCount = baseReviews.length
  const baseAverage = baseCount > 0
    ? Number((baseReviews.reduce((sum: number, row: any) => sum + Number(row?.rating || 0), 0) / baseCount).toFixed(1))
    : 0
  const qrAggregates = await getQrReviewAggregatesForTours(supabase, [data.id])
  const merged = mergeReviewStats(baseCount, baseAverage, qrAggregates.get(data.id))
  const reviews = [...baseReviews, ...qrReviews].sort((a: any, b: any) => {
    const left = a?.created_at ? new Date(a.created_at).getTime() : 0
    const right = b?.created_at ? new Date(b.created_at).getTime() : 0
    return right - left
  })

  return {
    ...data,
    tour_stops: normalizeTourStopsForOutput(data),
    reviews,
    review_count: merged.count,
    average_rating: merged.average,
  }
}

export async function getToursForCitySlug(citySlug: string, limit = 500) {
  const supabase = await getSupabasePublicReader()
  if (!supabase) return []

  const normalizedCitySlug = resolveCitySlug(citySlug)

  const { data, error } = await supabase
    .from("tours")
    .select(`
      id,
      title,
      description,
      city,
      country,
      city_slug,
      tour_slug,
      duration_minutes,
      max_capacity,
      meeting_point,
      languages,
      images,
      photos,
      guide:guide_id(id, full_name, avatar_url, role, bio),
      reviews(rating),
      tour_schedules(start_time, capacity, booked_count)
    `)
    .eq("status", "published")
    .eq("city_slug", normalizedCitySlug)
    .limit(limit)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching city tours:", error)
    return []
  }

  const rows = data || []
  const qrAggregates = await getQrReviewAggregatesForTours(
    supabase,
    rows.map((tour: any) => String(tour.id)),
  )
  const nowMs = Date.now()

  return rows.map((tour: any) => {
    const reviews = Array.isArray(tour.reviews) ? tour.reviews : []
    const baseCount = reviews.length
    const baseAverage = baseCount > 0
      ? Number((reviews.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) / baseCount).toFixed(1))
      : 0
    const merged = mergeReviewStats(baseCount, baseAverage, qrAggregates.get(String(tour.id)))

    const schedules = Array.isArray(tour.tour_schedules) ? tour.tour_schedules : []
    const nextAvailable = schedules
      .filter((schedule: any) => {
        const capacity = Number(schedule.capacity || 0)
        const booked = Number(schedule.booked_count || 0)
        const startMs = new Date(String(schedule.start_time || "")).getTime()
        return Boolean(schedule.start_time) && Number.isFinite(startMs) && startMs > nowMs && capacity - booked > 0
      })
      .sort((a: any, b: any) => new Date(String(a.start_time)).getTime() - new Date(String(b.start_time)).getTime())[0]

    const nextAvailableSpots = nextAvailable
      ? Math.max(Number(nextAvailable.capacity || 0) - Number(nextAvailable.booked_count || 0), 0)
      : null

    const guideRecord = Array.isArray(tour.guide) ? tour.guide[0] : tour.guide

    return {
      ...tour,
      review_count: merged.count,
      average_rating: merged.average,
      is_new_tour: merged.count === 0,
      cancellation_policy_short: DEFAULT_CANCELLATION_POLICY_SHORT,
      next_available_start_time: nextAvailable?.start_time || null,
      next_available_spots: nextAvailableSpots,
      guide: guideRecord || null,
    }
  })
}

export async function getCitySeoContentBySlug(citySlug: string) {
  const supabase = await getSupabasePublicReader()
  if (!supabase) return null

  const normalizedCitySlug = resolveCitySlug(citySlug)
  const { data, error } = await supabase
    .from("city_seo_content")
    .select("city_slug, city_name, description, updated_at")
    .eq("city_slug", normalizedCitySlug)
    .maybeSingle()

  if (error) {
    return null
  }
  return data || null
}

export async function getPublishedCitySlugs(limit = 2000) {
  const supabase = getSupabaseStaticReader()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("tours")
    .select("city_slug, city")
    .eq("status", "published")
    .limit(limit)

  if (error || !data) return []

  const slugs = new Set<string>()
  for (const row of data) {
    const slug = row.city_slug || resolveCitySlug(row.city || "")
    if (slug) slugs.add(slug)
  }

  return Array.from(slugs)
}

export async function getPublishedTourSlugParams(limit = 5000) {
  const supabase = getSupabaseStaticReader()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("tours")
    .select("city_slug, city, tour_slug, title")
    .eq("status", "published")
    .limit(limit)

  if (error || !data) return []

  return data
    .map((row) => {
      const city = row.city_slug || resolveCitySlug(row.city || "")
      const tour = row.tour_slug || "tour"
      return {
        city,
        tour,
      }
    })
    .filter((row) => Boolean(row.city) && Boolean(row.tour))
}

export async function getCitySeoPageData(citySlug: string) {
  const [cityTours, citySeo] = await Promise.all([
    getToursForCitySlug(citySlug),
    getCitySeoContentBySlug(citySlug),
  ])

  if (cityTours.length === 0) return null

  const normalizedCitySlug = resolveCitySlug(citySlug)
  const cityName = citySeo?.city_name || cityTours[0]?.city || cityNameFromSlug(normalizedCitySlug)
  const storedDescription = citySeo?.description?.trim() || ""
  const fallbackDescription = buildCityEditorialFallback(normalizedCitySlug, cityName)
  const description = wordCount(storedDescription) >= 120 ? storedDescription : fallbackDescription

  return {
    citySlug: normalizedCitySlug,
    cityName,
    description,
    lastModified: citySeo?.updated_at || null,
    tours: cityTours,
  }
}

// Get current user profile
export async function getCurrentProfile(userId: string) {
  const supabase = await getSupabaseServer()
  if (!supabase) return null

  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single()

  if (error) {
    console.error("[v0] Error fetching profile:", error)
    return null
  }

  return data
}

// Get user's bookings (for travelers)
export async function getUserBookings(userId: string) {
  const supabase = await getSupabaseServer()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      *,
      tour_schedules(
        id,
        start_time,
        capacity,
        tours(id, title, city, country, price, meeting_point, duration_minutes, images, guide_id)
      )
    `)
    .eq("tourist_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching bookings:", error)
    return []
  }

  return data || []
}

// Get guide's tours
export async function getGuideTours(guideId: string) {
  const supabase = await getSupabaseServer()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("tours")
    .select(`
      *,
      tour_schedules(id, start_time, capacity, language)
    `)
    .eq("guide_id", guideId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching guide tours:", error)
    return []
  }

  return data || []
}

// Get guide's bookings
export async function getGuideBookings(guideId: string) {
  const supabase = await getSupabaseServer()
  if (!supabase) return []

  const { data: allBookings, error } = await supabase
    .from("bookings")
    .select(`
      *,
      tour_schedules(
        id,
        start_time,
        capacity,
        tours(id, title, city, guide_id)
      ),
      profiles:tourist_id(id, full_name, avatar_url, email)
    `)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching guide bookings:", error)
    return []
  }

  // Filter to only include bookings for this guide's tours
  const guideBookings = (allBookings || []).filter((booking) => booking.tour_schedules?.tours?.guide_id === guideId)

  return guideBookings || []
}

// Get guide's bookings with full details
export async function getGuideBookingsWithDetails(guideId: string) {
  const supabase = await getSupabaseServer()
  if (!supabase) return []

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      *,
      schedule:schedule_id(
        id,
        start_time,
        tour:tour_id(id, title, city, guide_id)
      ),
      tourist:tourist_id(id, full_name, avatar_url, email)
    `)
    .eq("schedule.tour.guide_id", guideId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching guide bookings:", error)
    return []
  }

  return data || []
}

// Create a booking (tourist books a tour)
export async function createBooking(touristId: string, scheduleId: string, groupSize: number, totalPrice: number) {
  const supabase = await getSupabaseServer()
  if (!supabase) return null

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      tourist_id: touristId,
      schedule_id: scheduleId,
      group_size: groupSize,
      total_price: totalPrice,
      status: "confirmed",
      payment_status: "completed",
    })
    .select()
    .single()

  if (error) {
    console.error("[v0] Error creating booking:", error)
    return null
  }

  return data
}

// Update booking status
export async function updateBookingStatus(bookingId: string, status: "confirmed" | "cancelled" | "completed") {
  const supabase = await getSupabaseServer()
  if (!supabase) return null

  const { data, error } = await supabase.from("bookings").update({ status }).eq("id", bookingId).select().single()

  if (error) {
    console.error("[v0] Error updating booking:", error)
    return null
  }

  return data
}

// Get public reviews
export async function getPublicReviews(limit = 12) {
  const supabase = await getSupabasePublicReader()
  if (!supabase) return []

  const [bookingReviewsResult, qrReviewsResult] = await Promise.all([
    supabase
      .from("reviews")
      .select(`
        *,
        tourist:tourist_id(full_name, avatar_url),
        tour:tours(id, title, city)
      `)
      .eq("is_published", true)
      .limit(limit * 2)
      .order("created_at", { ascending: false }),
    supabase
      .from("review_qr_reviews")
      .select(`
        id,
        rating,
        title,
        content,
        created_at,
        reviewer_name,
        tour:tour_id(id, title, city)
      `)
      .eq("is_published", true)
      .limit(limit * 2)
      .order("created_at", { ascending: false }),
  ])

  if (bookingReviewsResult.error) {
    console.error("[v0] Error fetching booking reviews:", bookingReviewsResult.error)
  }
  if (qrReviewsResult.error) {
    console.error("[v0] Error fetching QR reviews:", qrReviewsResult.error)
  }

  const bookingReviews = Array.isArray(bookingReviewsResult.data) ? bookingReviewsResult.data : []
  const qrReviews = Array.isArray(qrReviewsResult.data)
    ? qrReviewsResult.data.map((row: any) => ({
        id: row.id,
        rating: row.rating,
        title: row.title,
        content: row.content,
        created_at: row.created_at,
        tourist: {
          full_name: row.reviewer_name || "Verified Guest",
          avatar_url: null,
        },
        tour: row.tour,
        source: "qr",
      }))
    : []

  return [...bookingReviews, ...qrReviews]
    .sort((a: any, b: any) => {
      const left = a?.created_at ? new Date(a.created_at).getTime() : 0
      const right = b?.created_at ? new Date(b.created_at).getTime() : 0
      return right - left
    })
    .slice(0, limit)
}

// Get featured cities (derived from tours)
export async function getFeaturedCities(limit = 5) {
  const supabase = await getSupabasePublicReader()
  if (!supabase) return getFeaturedCitiesFallback(limit)

  const { data, error } = await supabase
    .from("tours")
    .select("city, country, photos, images")
    .eq("status", "published")
    .limit(1000)

  if (error) {
    if (!hasWarnedFeaturedCitiesFetch) {
      hasWarnedFeaturedCitiesFetch = true
      const details = [error.message, error.details].filter(Boolean).join(" | ")
      console.warn("[v0] Falling back to default featured cities due to fetch issue.", details)
    }
    return getFeaturedCitiesFallback(limit)
  }

  // Group by city and count, and take the first photo we find
  const cityMap = new Map<string, { city: string; country: string; count: number; image: string }>()
  data?.forEach((tour) => {
    if (tour.city) {
      const existing = cityMap.get(tour.city)
      const rawImage = tour.photos?.[0] || tour.images?.[0]
      const imageUrl = typeof rawImage === "string" ? rawImage : rawImage?.url
      const curatedImage = getCityLandmarkImage(tour.city)

      cityMap.set(tour.city, {
        city: tour.city,
        country: tour.country || "",
        count: (existing?.count || 0) + 1,
        image: curatedImage || existing?.image || imageUrl || "",
      })
    }
  })

  // Sort by count and return top cities
  const cities = Array.from(cityMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((c) => ({
      name: c.city,
      country: c.country,
      tours: c.count,
      image: getCityLandmarkImage(c.city) || c.image || "/placeholder.svg",
    }))

  return cities.length > 0 ? cities : getFeaturedCitiesFallback(limit)
}

export async function getLandingStats() {
  const supabase = await getSupabasePublicReader()
  if (!supabase) {
    return {
      activeGuides: 500,
      activeCities: 150,
      completedBookings: 50000,
      totalReviews: 0,
    }
  }

  const [
    { count: guidesCount },
    { data: citiesData },
    { count: bookingsCount },
    { count: reviewsCount },
    { count: qrReviewsCount },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "guide"),
    supabase.from("tours").select("city").eq("status", "published").limit(5000),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .in("status", ["confirmed", "upcoming", "completed"]),
    supabase.from("reviews").select("*", { count: "exact", head: true }),
    supabase.from("review_qr_reviews").select("*", { count: "exact", head: true }).eq("is_published", true),
  ])

  const uniqueCities = new Set<string>()
  citiesData?.forEach((row: any) => {
    if (row.city) {
      uniqueCities.add(String(row.city).trim().toLowerCase())
    }
  })

  return {
    activeGuides: guidesCount || 0,
    activeCities: uniqueCities.size,
    completedBookings: bookingsCount || 0,
    totalReviews: (reviewsCount || 0) + (qrReviewsCount || 0),
  }
}
