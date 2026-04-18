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

function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export async function GET(_request: NextRequest) {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const serviceSupabase = createServiceRoleClient()
    const { data, error: dbError } = await serviceSupabase
      .from("cities")
      .select("*")
      .order("name", { ascending: true })

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 })
    return NextResponse.json({ cities: data || [] })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const body = await request.json()
    const { name, country, credits_per_adult, is_active } = body

    if (!name?.trim() || !country?.trim()) {
      return NextResponse.json({ error: "Name and country are required" }, { status: 400 })
    }

    const fee = Number(credits_per_adult)
    if (!Number.isInteger(fee) || fee < 0 || fee > 100) {
      return NextResponse.json({ error: "Fee must be a whole number between 0 and 100" }, { status: 400 })
    }

    const slug = toSlug(name.trim())
    const serviceSupabase = createServiceRoleClient()

    const { data, error: dbError } = await serviceSupabase
      .from("cities")
      .insert({
        name: name.trim(),
        country: country.trim(),
        slug,
        credits_per_adult: fee,
        is_active: is_active !== false,
      })
      .select()
      .single()

    if (dbError) {
      if (dbError.code === "23505") {
        return NextResponse.json({ error: `A city with slug "${slug}" already exists` }, { status: 409 })
      }
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }

    return NextResponse.json({ city: data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}
