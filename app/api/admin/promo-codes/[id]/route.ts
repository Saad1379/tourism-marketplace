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

    const allowedFields = ["code", "credits_to_give", "gives_pro_status", "max_uses", "is_active", "expires_at"]
    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field]
    }
    if (updates.code) updates.code = String(updates.code).trim().toUpperCase()

    const { data: code, error: updateError } = await serviceSupabase
      .from("promo_codes")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })
    return NextResponse.json({ code })
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

    const { error: deleteError } = await serviceSupabase
      .from("promo_codes")
      .delete()
      .eq("id", id)

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}
