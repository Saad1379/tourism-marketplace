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

export async function GET(_request: NextRequest) {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const serviceSupabase = createServiceRoleClient()
    const { data: packages, error: packagesError } = await serviceSupabase
      .from("credit_packages")
      .select("*")
      .order("display_order", { ascending: true })

    if (packagesError) return NextResponse.json({ error: packagesError.message }, { status: 400 })
    return NextResponse.json({ packages: packages || [] })
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

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Package name is required" }, { status: 400 })
    }

    const { data: pkg, error: insertError } = await serviceSupabase
      .from("credit_packages")
      .insert({
        name: body.name.trim(),
        credits: body.credits || 0,
        price_eur: body.price_eur || 0,
        is_active: body.is_active !== false,
        is_popular: body.is_popular || false,
        savings_percentage: body.savings_percentage || null,
        display_order: body.display_order || 0,
      })
      .select()
      .single()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })
    return NextResponse.json({ package: pkg }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}
