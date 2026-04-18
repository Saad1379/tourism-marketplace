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

export async function GET() {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const serviceSupabase = createServiceRoleClient()
    const { data, error: dbError } = await serviceSupabase
      .from("plan_settings")
      .select("*")
      .eq("plan_type", "free")
      .single()

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 })
    return NextResponse.json({ settings: data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const body = await request.json()
    const { max_tours, max_schedules_per_week, max_tourist_capacity } = body

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (max_tours !== undefined) {
      const v = Number(max_tours)
      if (!Number.isInteger(v) || v < 0 || v > 100) {
        return NextResponse.json({ error: "max_tours must be a whole number between 0 and 100" }, { status: 400 })
      }
      updates.max_tours = v
    }

    if (max_schedules_per_week !== undefined) {
      const v = Number(max_schedules_per_week)
      if (!Number.isInteger(v) || v < 0 || v > 100) {
        return NextResponse.json({ error: "max_schedules_per_week must be a whole number between 0 and 100" }, { status: 400 })
      }
      updates.max_schedules_per_week = v
    }

    if (max_tourist_capacity !== undefined) {
      const v = Number(max_tourist_capacity)
      if (!Number.isInteger(v) || v < 1 || v > 500) {
        return NextResponse.json({ error: "max_tourist_capacity must be a whole number between 1 and 500" }, { status: 400 })
      }
      updates.max_tourist_capacity = v
    }

    const serviceSupabase = createServiceRoleClient()
    const { data, error: dbError } = await serviceSupabase
      .from("plan_settings")
      .update(updates)
      .eq("plan_type", "free")
      .select()
      .single()

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 })
    return NextResponse.json({ settings: data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}
