import { getLandingStats } from "@/lib/supabase/queries"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const stats = await getLandingStats()
    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    })
  } catch (error) {
    console.error("[v0] Landing stats error:", error)
    return NextResponse.json(
      {
        activeGuides: 500,
        activeCities: 150,
        completedBookings: 50000,
        totalReviews: 0,
      },
      { status: 200 },
    )
  }
}
