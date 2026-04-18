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

// GET - fetch notifications (unread by default)
export async function GET(request: NextRequest) {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get("unread") !== "false"

    const serviceSupabase = createServiceRoleClient()
    let query = serviceSupabase
      .from("admin_notifications")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(50)

    if (unreadOnly) {
      query = query.eq("is_read", false)
    }

    const { data: notifications, error: notifError, count } = await query

    if (notifError) return NextResponse.json({ error: notifError.message }, { status: 400 })

    return NextResponse.json({ notifications: notifications || [], total: count || 0 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}

// POST - create a new notification (called internally after guide submission)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, title, message, data } = body

    if (!title || !message) {
      return NextResponse.json({ error: "title and message are required" }, { status: 400 })
    }

    const serviceSupabase = createServiceRoleClient()
    const { error: insertError } = await serviceSupabase
      .from("admin_notifications")
      .insert({ type: type || "guide_application", title, message, data: data || {} })

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}

// PATCH - mark all notifications as read
export async function PATCH() {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const serviceSupabase = createServiceRoleClient()
    const { error: updateError } = await serviceSupabase
      .from("admin_notifications")
      .update({ is_read: true })
      .eq("is_read", false)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}
