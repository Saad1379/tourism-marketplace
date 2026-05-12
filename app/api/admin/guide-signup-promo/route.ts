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

const CONFIG_KEY_ENABLED = "guide_signup_free_pro_enabled"
const CONFIG_KEY_CREDITS = "guide_signup_free_pro_credits"

/**
 * GET  — read current "Guide Signup Free Pro" settings
 */
export async function GET() {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const serviceSupabase = createServiceRoleClient()
    const { data, error: dbError } = await serviceSupabase
      .from("platform_config")
      .select("key, value")
      .in("key", [CONFIG_KEY_ENABLED, CONFIG_KEY_CREDITS])

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 })

    const map = Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))

    return NextResponse.json({
      enabled: map[CONFIG_KEY_ENABLED] === "true",
      credits: parseInt(map[CONFIG_KEY_CREDITS] ?? "200", 10) || 200,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}

/**
 * PATCH — update "Guide Signup Free Pro" settings
 * Body: { enabled?: boolean, credits?: number }
 */
export async function PATCH(request: NextRequest) {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const body = await request.json()
    const serviceSupabase = createServiceRoleClient()
    const nowIso = new Date().toISOString()

    if (typeof body.enabled === "boolean") {
      await serviceSupabase.from("platform_config").upsert(
        {
          key: CONFIG_KEY_ENABLED,
          value: String(body.enabled),
          value_type: "boolean",
          description:
            "When true, every new guide who completes signup is instantly given a Pro plan (instead of Free) without any payment.",
          is_public: true,
          category: "guide_signup",
          updated_at: nowIso,
        },
        { onConflict: "key" },
      )
    }

    if (body.credits !== undefined) {
      const v = Number(body.credits)
      if (!Number.isInteger(v) || v < 0 || v > 10000) {
        return NextResponse.json(
          { error: "credits must be a whole number between 0 and 10,000" },
          { status: 400 },
        )
      }
      await serviceSupabase.from("platform_config").upsert(
        {
          key: CONFIG_KEY_CREDITS,
          value: String(v),
          value_type: "integer",
          description:
            "Number of bonus credits granted to new guides at signup when guide_signup_free_pro_enabled is true.",
          is_public: true,
          category: "guide_signup",
          updated_at: nowIso,
        },
        { onConflict: "key" },
      )
    }

    // Re-read to return confirmed values
    const { data } = await serviceSupabase
      .from("platform_config")
      .select("key, value")
      .in("key", [CONFIG_KEY_ENABLED, CONFIG_KEY_CREDITS])

    const map = Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))

    return NextResponse.json({
      enabled: map[CONFIG_KEY_ENABLED] === "true",
      credits: parseInt(map[CONFIG_KEY_CREDITS] ?? "200", 10) || 200,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}
