import { type NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized", status: 401 }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return { error: "Admin access required", status: 403 }
  return { error: null, status: 200 }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const { id } = await params
    const body = await request.json()
    const { name, country, credits_per_adult, is_active } = body

    if (!name?.trim() || !country?.trim()) {
      return NextResponse.json({ error: "Name and country are required" }, { status: 400 })
    }

    const fee = Number(credits_per_adult)
    if (!Number.isInteger(fee) || fee < 0 || fee > 100) {
      return NextResponse.json({ error: "Fee must be a whole number between 0 and 100" }, { status: 400 })
    }

    const serviceSupabase = createServiceRoleClient()
    const { data, error: dbError } = await serviceSupabase
      .from("cities")
      .update({
        name: name.trim(),
        country: country.trim(),
        credits_per_adult: fee,
        is_active: is_active !== false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 })
    return NextResponse.json({ city: data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const { id } = await params
    const serviceSupabase = createServiceRoleClient()

    // Check if any active tours reference this city
    const { data: cityData } = await serviceSupabase
      .from("cities")
      .select("slug")
      .eq("id", id)
      .single()

    if (cityData) {
      const { count } = await serviceSupabase
        .from("tours")
        .select("id", { count: "exact", head: true })
        .eq("city", cityData.slug)
        .is("deleted_at", null)

      if (count && count > 0) {
        return NextResponse.json(
          { error: `Cannot delete: ${count} tour(s) are using this city. Deactivate it instead.` },
          { status: 409 }
        )
      }
    }

    const { error: dbError } = await serviceSupabase
      .from("cities")
      .delete()
      .eq("id", id)

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}
