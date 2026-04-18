import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/server"

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized", status: 401, user: null, supabase: null }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return { error: "Admin access required", status: 403, user: null, supabase: null }
  return { error: null, status: 200, user, supabase }
}

export async function GET(_request: NextRequest) {
  try {
    const { error, status } = await verifyAdmin()
    if (error) return NextResponse.json({ error }, { status })

    // Use service role client for cross-table analytics
    const serviceSupabase = createServiceRoleClient()

    // Fetch all analytics data in parallel
    const [
      profilesResult,
      toursResult,
      bookingsResult,
      revenueResult,
    ] = await Promise.all([
      serviceSupabase.from("profiles").select("id, role, created_at").eq("is_deleted", false),
      serviceSupabase.from("tours").select("id, title, status, created_at, guide_id, guide:guide_id(full_name)"),
      serviceSupabase.from("bookings").select("id, status, created_at, total_guests, tour_id, tours(title, guide_id)"),
      serviceSupabase.from("credit_transactions").select("id, amount, type, created_at").eq("type", "spend"),
    ])

    const profiles = profilesResult.data || []
    const tours = toursResult.data || []
    const bookings = bookingsResult.data || []
    const spendTxns = revenueResult.data || []

    // KPI counts
    const totalUsers = profiles.length
    const totalGuides = profiles.filter((p) => p.role === "guide").length
    const totalTourists = profiles.filter((p) => p.role === "tourist").length
    const totalTours = tours.length
    const activeTours = tours.filter((t) => t.status === "published").length
    const totalBookings = bookings.length
    const totalRevenue = spendTxns.reduce((sum, t) => sum + Math.abs(t.amount), 0)

    // Bookings by status
    const bookingsByStatus = bookings.reduce((acc: Record<string, number>, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1
      return acc
    }, {})

    // Monthly data for last 12 months
    const now = new Date()
    const months: string[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    }

    const monthlyBookings = months.map((month) => ({
      month,
      count: bookings.filter((b) => b.created_at?.startsWith(month)).length,
    }))

    const monthlyRevenue = months.map((month) => ({
      month,
      revenue: spendTxns
        .filter((t) => t.created_at?.startsWith(month))
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
    }))

    // Top 5 tours by booking count
    const tourBookingCounts: Record<string, { title: string; count: number; guideName: string }> = {}
    bookings.forEach((b) => {
      if (b.tour_id) {
        if (!tourBookingCounts[b.tour_id]) {
          tourBookingCounts[b.tour_id] = {
            title: (b.tours as any)?.title || "Unknown Tour",
            count: 0,
            guideName: "",
          }
        }
        tourBookingCounts[b.tour_id].count++
      }
    })
    const topTours = Object.entries(tourBookingCounts)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Top 5 earning guides (by credits spent on their tours)
    const guideRevenue: Record<string, { guideName: string; revenue: number }> = {}
    // For each spend transaction, look up the booking → tour → guide
    // Simplified: use credit_transactions joined with reference
    // Instead, compute from bookings: for each booking, find guide via tour
    const toursMap: Record<string, any> = {}
    tours.forEach((t) => { toursMap[t.id] = t })

    bookings.forEach((b) => {
      if (b.tour_id && toursMap[b.tour_id]) {
        const tour = toursMap[b.tour_id]
        const guideId = tour.guide_id
        const guideName = (tour.guide as any)?.full_name || "Unknown Guide"
        if (!guideRevenue[guideId]) {
          guideRevenue[guideId] = { guideName, revenue: 0 }
        }
        guideRevenue[guideId].revenue += b.total_guests || 0
      }
    })
    const topGuides = Object.entries(guideRevenue)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // Monthly user growth
    const monthlyUsers = months.map((month) => ({
      month,
      count: profiles.filter((p) => p.created_at?.startsWith(month)).length,
    }))

    return NextResponse.json({
      kpis: {
        totalUsers,
        totalGuides,
        totalTourists,
        totalTours,
        activeTours,
        totalBookings,
        totalRevenue,
        bookingsByStatus,
      },
      monthlyBookings,
      monthlyRevenue,
      monthlyUsers,
      topTours,
      topGuides,
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[admin] Error in GET /api/admin/overview:", errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
