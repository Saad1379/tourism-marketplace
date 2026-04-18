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
    const role = searchParams.get("role") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const offset = (page - 1) * limit

    const serviceSupabase = createServiceRoleClient()
    let query = serviceSupabase
      .from("profiles")
      .select("id, email, full_name, role, avatar_url, created_at, city, phone, is_deleted, is_banned, onboarding_completed", { count: "exact" })
      .eq("is_deleted", false)

    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
    }
    if (role) {
      query = query.eq("role", role)
    }

    const { data: users, error: usersError, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (usersError) return NextResponse.json({ error: usersError.message }, { status: 400 })

    return NextResponse.json({ users: users || [], total: count || 0, page, limit })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}
