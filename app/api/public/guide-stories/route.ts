import { NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

type PublicGuideStory = {
  id: string
  name: string
  city: string
  avatar: string | null
  quote: string
  tours: number
  rating: number
  reviewCount: number
}

type GuideProfileRow = {
  id: string
  full_name: string | null
  avatar_url: string | null
  city: string | null
  bio: string | null
  role: string | null
  guide_rating: number | null
  guide_total_reviews: number | null
  guide_approval_status: string | null
  is_deleted: boolean | null
  updated_at: string | null
  created_at: string | null
}

type TourRow = {
  guide_id: string | null
  city: string | null
  updated_at: string | null
}

function toSingleLine(input: string): string {
  return input.replace(/\s+/g, " ").trim()
}

function toQuote(bio: string | null | undefined, city: string): string {
  const trimmed = toSingleLine(bio || "")
  if (trimmed.length >= 24) {
    return trimmed.length > 180 ? `${trimmed.slice(0, 177).trimEnd()}...` : trimmed
  }
  return `I guide travelers through ${city} and share local stories, culture, and hidden spots.`
}

export async function GET() {
  try {
    const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? createServiceRoleClient() : await createClient()

    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, city, bio, role, guide_rating, guide_total_reviews, guide_approval_status, is_deleted, updated_at, created_at",
      )
      .eq("role", "guide")
      .limit(300)

    if (profileError) {
      throw new Error(profileError.message)
    }

    const profiles = ((profileRows || []) as GuideProfileRow[]).filter((profile) => profile.is_deleted !== true)
    if (profiles.length === 0) {
      return NextResponse.json({ guides: [] })
    }

    const approved = profiles.filter((profile) => profile.guide_approval_status === "approved")
    const usableProfiles = (approved.length > 0 ? approved : profiles).slice(0, 150)

    const guideIds = usableProfiles.map((profile) => profile.id)
    const { data: tourRows, error: tourError } = await supabase
      .from("tours")
      .select("guide_id, city, updated_at")
      .eq("status", "published")
      .in("guide_id", guideIds)
      .limit(5000)

    if (tourError) {
      throw new Error(tourError.message)
    }

    const guideTourStats = new Map<string, { tours: number; city: string; updatedAt: number }>()
    for (const row of ((tourRows || []) as TourRow[])) {
      const guideId = row.guide_id
      if (!guideId) continue

      const city = (row.city || "").trim() || "your city"
      const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0
      const existing = guideTourStats.get(guideId)

      if (!existing) {
        guideTourStats.set(guideId, { tours: 1, city, updatedAt })
        continue
      }

      existing.tours += 1
      if (updatedAt > existing.updatedAt && city) {
        existing.city = city
        existing.updatedAt = updatedAt
      }
    }

    const guides: PublicGuideStory[] = usableProfiles
      .map((profile) => {
        const stat = guideTourStats.get(profile.id)
        const tours = stat?.tours || 0

        const city = (profile.city || "").trim() || stat?.city || "your city"
        const rating = Number(profile.guide_rating || 0)
        const reviewCount = Number(profile.guide_total_reviews || 0)
        const activityTime = profile.updated_at
          ? new Date(profile.updated_at).getTime()
          : profile.created_at
            ? new Date(profile.created_at).getTime()
            : 0
        const bioLength = toSingleLine(profile.bio || "").length

        return {
          id: profile.id,
          name: (profile.full_name || "Local Guide").trim(),
          city,
          avatar: profile.avatar_url || null,
          quote: toQuote(profile.bio, city),
          tours,
          rating: Number.isFinite(rating) ? Math.max(0, Math.min(5, Number(rating.toFixed(1)))) : 0,
          reviewCount: Number.isFinite(reviewCount) ? Math.max(0, reviewCount) : 0,
          _activityTime: Number.isFinite(activityTime) ? activityTime : 0,
          _bioLength: bioLength,
        }
      })
      .filter((guide): guide is PublicGuideStory & { _activityTime: number; _bioLength: number } => Boolean(guide))
      .sort((a, b) => {
        if (b._bioLength !== a._bioLength) return b._bioLength - a._bioLength
        if (b.rating !== a.rating) return b.rating - a.rating
        if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount
        if (b.tours !== a.tours) return b.tours - a.tours
        return b._activityTime - a._activityTime
      })
      .map(({ _activityTime, _bioLength, ...guide }) => guide)
      .slice(0, 6)

    return NextResponse.json(
      { guides },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    )
  } catch (error) {
    console.error("[v0] Public guide stories fetch failed:", error)
    return NextResponse.json({ guides: [] }, { status: 200 })
  }
}
