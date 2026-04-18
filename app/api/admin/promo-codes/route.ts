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

export async function GET(request: NextRequest) {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const offset = (page - 1) * limit

    const serviceSupabase = createServiceRoleClient()
    let query = serviceSupabase
      .from("promo_codes")
      .select("*", { count: "exact" })

    if (search) {
      query = query.ilike("code", `%${search}%`)
    }

    const { data: codes, error: codesError, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (codesError) return NextResponse.json({ error: codesError.message }, { status: 400 })

    return NextResponse.json({ codes: codes || [], total: count || 0, page, limit })
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

    if (!body.code?.trim()) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 })
    }

    const { data: code, error: insertError } = await serviceSupabase
      .from("promo_codes")
      .insert({
        code: body.code.trim().toUpperCase(),
        credits_to_give: body.credits_to_give || 0,
        gives_pro_status: body.gives_pro_status || false,
        max_uses: body.max_uses || 1,
        is_active: body.is_active !== false,
        expires_at: body.expires_at || null,
      })
      .select()
      .single()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })
    return NextResponse.json({ code }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}
