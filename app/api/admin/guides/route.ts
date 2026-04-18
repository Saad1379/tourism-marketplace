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
    const approvalStatus = searchParams.get("approval_status") || "pending"
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const offset = (page - 1) * limit

    const serviceSupabase = createServiceRoleClient()
    let query = serviceSupabase
      .from("profiles")
      .select(
        "id, email, full_name, role, avatar_url, created_at, city, phone, bio, languages, guide_approval_status, onboarding_completed",
        { count: "exact" }
      )
      .eq("role", "guide")
      .eq("is_deleted", false)

    if (approvalStatus !== "all") {
      query = query.eq("guide_approval_status", approvalStatus)
    }

    const { data: guides, error: guidesError, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (guidesError) return NextResponse.json({ error: guidesError.message }, { status: 400 })

    return NextResponse.json({ guides: guides || [], total: count || 0, page, limit })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}
