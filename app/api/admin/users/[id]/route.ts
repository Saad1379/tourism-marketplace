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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const { id } = await params
    const body = await request.json()
    const serviceSupabase = createServiceRoleClient()

    const allowedFields = ["full_name", "email", "role", "city", "phone", "is_banned"]
    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field]
    }
    updates.updated_at = new Date().toISOString()

    // Prevent demoting the last admin
    if (body.role && body.role !== "admin") {
      const { count } = await serviceSupabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("is_deleted", false)

      if ((count || 0) <= 1) {
        const { data: current } = await serviceSupabase.from("profiles").select("role").eq("id", id).single()
        if (current?.role === "admin") {
          return NextResponse.json({ error: "Cannot demote the last admin user" }, { status: 400 })
        }
      }
    }

    const { data: user, error: updateError } = await serviceSupabase
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })
    return NextResponse.json({ user })
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

    // Check not deleting last admin
    const { data: targetUser } = await serviceSupabase.from("profiles").select("role").eq("id", id).single()
    if (targetUser?.role === "admin") {
      const { count } = await serviceSupabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("is_deleted", false)
      if ((count || 0) <= 1) {
        return NextResponse.json({ error: "Cannot delete the last admin user" }, { status: 400 })
      }
    }

    // Soft delete
    const { error: deleteError } = await serviceSupabase
      .from("profiles")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq("id", id)

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}
