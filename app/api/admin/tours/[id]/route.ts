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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const { id } = await params
    const serviceSupabase = createServiceRoleClient()
    const { data: tour, error: fetchError } = await serviceSupabase
      .from("tours")
      .select(`*, guide:guide_id(id, full_name, email, avatar_url)`)
      .eq("id", id)
      .single()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 404 })
    return NextResponse.json({ tour })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const { id } = await params
    const body = await request.json()
    const serviceSupabase = createServiceRoleClient()
    const { data: previousTour } = await serviceSupabase
      .from("tours")
      .select("city, city_slug, title, tour_slug")
      .eq("id", id)
      .maybeSingle()

    // Only allow updating safe fields
    const allowedFields = [
      "title", "description", "city", "country", "status",
      "duration_minutes", "max_group_size", "languages", "categories",
      "highlights", "what_to_expect", "what_to_bring", "accessibility_info",
      "meeting_point_address", "meeting_point_details",
    ]
    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field]
    }
    updates.updated_at = new Date().toISOString()

    const { data: tour, error: updateError } = await serviceSupabase
      .from("tours")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

    if (previousTour) {
      revalidateTourSeo({
        city: previousTour.city,
        citySlug: previousTour.city_slug,
        title: previousTour.title,
        tourSlug: previousTour.tour_slug,
      })
    }
    revalidateTourSeo({
      city: tour.city,
      citySlug: tour.city_slug,
      title: tour.title,
      tourSlug: tour.tour_slug,
    })

    return NextResponse.json({ tour })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const { id } = await params
    const serviceSupabase = createServiceRoleClient()
    const { data: previousTour } = await serviceSupabase
      .from("tours")
      .select("city, city_slug, title, tour_slug")
      .eq("id", id)
      .maybeSingle()

    const { error: deleteError } = await serviceSupabase
      .from("tours")
      .delete()
      .eq("id", id)

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 })

    if (previousTour) {
      revalidateTourSeo({
        city: previousTour.city,
        citySlug: previousTour.city_slug,
        title: previousTour.title,
        tourSlug: previousTour.tour_slug,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}
