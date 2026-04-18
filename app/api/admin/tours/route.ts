import { type NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { revalidateTourSeo } from "@/lib/seo/revalidate"

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized", status: 401 }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return { error: "Admin access required", status: 403 }
  return { error: null, status: 200 }
}

export async function GET(request: NextRequest) {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const statusFilter = searchParams.get("status") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const offset = (page - 1) * limit

    const serviceSupabase = createServiceRoleClient()
    let query = serviceSupabase
      .from("tours")
      .select(`
        id, title, city, country, status, created_at, updated_at,
        duration_minutes, max_group_size, languages, categories, photos,
        guide:guide_id(id, full_name, email, avatar_url)
      `, { count: "exact" })

    if (search) {
      query = query.or(`title.ilike.%${search}%,city.ilike.%${search}%,country.ilike.%${search}%`)
    }
    if (statusFilter) {
      query = query.eq("status", statusFilter)
    }

    const { data: tours, error: toursError, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (toursError) return NextResponse.json({ error: toursError.message }, { status: 400 })

    return NextResponse.json({ tours: tours || [], total: count || 0, page, limit })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const body = await request.json()
    const serviceSupabase = createServiceRoleClient()

    const { data: tour, error: insertError } = await serviceSupabase
      .from("tours")
      .insert({
        title: body.title,
        description: body.description,
        city: body.city,
        country: body.country,
        status: body.status || "draft",
        guide_id: body.guide_id,
        duration_minutes: body.duration_minutes,
        max_group_size: body.max_group_size,
        languages: body.languages || [],
        categories: body.categories || [],
        highlights: body.highlights || [],
      })
      .select()
      .single()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })

    if (tour.status === "published") {
      revalidateTourSeo({
        city: tour.city,
        citySlug: tour.city_slug,
        title: tour.title,
        tourSlug: tour.tour_slug,
      })
    }

    return NextResponse.json({ tour }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}
