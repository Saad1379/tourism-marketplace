import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ensureProfile } from "@/lib/supabase/ensure-profile"

type AnalyticsRow = {
  day: string
  total_bookings: number
  completed_bookings: number
  guide_confirmations: number
  tourist_confirmations: number
}

type BookingRow = {
  id: string
  status: string
  adults: number | null
  children: number | null
  created_at: string
  tour_schedules?: {
    tours?: {
      id: string
      title: string | null
      city: string | null
      guide_id: string | null
    } | null
  } | null
  attendance?: {
    attended: boolean | null
  }[]
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const profile = await ensureProfile(supabase, user)
    if (!profile || profile.role !== "guide") {
      return NextResponse.json({ error: "Only guides can view analytics" }, { status: 403 })
    }

    const { data: analyticsRows, error: analyticsError } = await supabase
      .from("guide_analytics_daily")
      .select("day,total_bookings,completed_bookings,guide_confirmations,tourist_confirmations")
      .eq("guide_id", user.id)
      .order("day", { ascending: true })

    if (analyticsError) {
      console.warn("[v0] Analytics view error:", analyticsError.message)
    }

    const { data: guideSchedules, error: schedulesError } = await supabase
      .from("tour_schedules")
      .select("id, tours!inner(guide_id)")
      .eq("tours.guide_id", user.id)

    if (schedulesError) {
      return NextResponse.json({ error: schedulesError.message }, { status: 400 })
    }

    const scheduleIds = (guideSchedules || []).map((schedule: any) => schedule.id)

    let guideBookings: BookingRow[] = []
    if (scheduleIds.length > 0) {
      const { data: bookings, error: bookingsError } = await supabase
        .from("bookings")
        .select(
          `
          id,
          status,
          adults,
          children,
          created_at,
          tour_schedules(
            tours(id, title, city, guide_id)
          ),
          attendance(attended)
        `,
        )
        .in("schedule_id", scheduleIds)
        .order("created_at", { ascending: false })

      if (bookingsError) {
        return NextResponse.json({ error: bookingsError.message }, { status: 400 })
      }

      guideBookings = (bookings || []) as BookingRow[]
    }

    const totalBookings = guideBookings.length
    const completedBookings = guideBookings.filter((booking) => booking.status === "completed").length
    const totalGuests = guideBookings.reduce(
      (sum, booking) => sum + (booking.adults ?? 0) + (booking.children ?? 0),
      0,
    )
    const attendanceCount = guideBookings.filter((booking) => booking.attendance?.[0]?.attended).length
    const attendanceRate = totalBookings ? Math.round((attendanceCount / totalBookings) * 100) : 0

    const tourStats = new Map<
      string,
      { id: string; title: string; city: string; bookings: number; attendance: number }
    >()

    guideBookings.forEach((booking) => {
      const tour = booking.tour_schedules?.tours
      if (!tour?.id) return

      const existing = tourStats.get(tour.id) || {
        id: tour.id,
        title: tour.title || "Tour",
        city: tour.city || "Unknown",
        bookings: 0,
        attendance: 0,
      }

      existing.bookings += 1
      if (booking.attendance?.[0]?.attended) {
        existing.attendance += 1
      }
      tourStats.set(tour.id, existing)
    })

    const tourIds = Array.from(tourStats.keys())
    let ratingsMap = new Map<string, { rating: number; count: number }>()

    if (tourIds.length > 0) {
      const { data: reviews, error: reviewsError } = await supabase
        .from("reviews")
        .select("rating, tour_id")
        .in("tour_id", tourIds)

      if (!reviewsError && reviews) {
        ratingsMap = reviews.reduce((map, review: { tour_id: string; rating: number }) => {
          const entry = map.get(review.tour_id) || { rating: 0, count: 0 }
          entry.rating += review.rating || 0
          entry.count += 1
          map.set(review.tour_id, entry)
          return map
        }, ratingsMap)
      }
    }

    const topTours = Array.from(tourStats.values())
      .map((tour) => {
        const ratingInfo = ratingsMap.get(tour.id)
        const averageRating = ratingInfo && ratingInfo.count ? ratingInfo.rating / ratingInfo.count : 0
        return {
          ...tour,
          attendanceRate: tour.bookings ? Math.round((tour.attendance / tour.bookings) * 100) : 0,
          rating: Number(averageRating.toFixed(1)),
        }
      })
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 3)

    const { data: fees, error: feesError } = await supabase
      .from("fee_items")
      .select("amount, created_at")
      .eq("guide_id", user.id)

    if (feesError) {
      console.warn("[v0] Fee items error:", feesError.message)
    }

    const revenueByDay = (fees || []).reduce((map, fee: { amount: number; created_at: string }) => {
      const day = fee.created_at.slice(0, 10)
      map.set(day, (map.get(day) || 0) + (fee.amount || 0))
      return map
    }, new Map<string, number>())

    const seriesRows = (analyticsRows as AnalyticsRow[]) || []
    const lastSeven = seriesRows.slice(-7)
    const weekly = lastSeven.map((row) => ({
      name: new Date(row.day).toLocaleDateString(undefined, { weekday: "short" }),
      bookings: row.total_bookings || 0,
      attendance: row.guide_confirmations || row.completed_bookings || 0,
      revenue: revenueByDay.get(row.day) || 0,
    }))

    const totalRevenue = Array.from(revenueByDay.values()).reduce((sum, value) => sum + value, 0)

    const summary = {
      bookings: totalBookings,
      attendanceRate,
      averageRating: Number(
        (
          Array.from(ratingsMap.values()).reduce((sum, value) => sum + value.rating, 0) /
          Math.max(1, Array.from(ratingsMap.values()).reduce((sum, value) => sum + value.count, 0))
        ).toFixed(1),
      ),
      revenue: totalRevenue,
    }

    return NextResponse.json({
      summary,
      weekly,
      topTours,
      totals: {
        totalBookings,
        completedBookings,
        totalGuests,
      },
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Error in GET /api/analytics:", errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
