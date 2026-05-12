import { type NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"

const CONFIG_KEY_ENABLED = "guide_signup_free_pro_enabled"
const CONFIG_KEY_CREDITS = "guide_signup_free_pro_credits"

/**
 * POST /api/auth/provision-signup-promo
 *
 * Called by the become-guide page right after the guide's profile is updated.
 * If the "Free Pro on Signup" feature is enabled in platform_config, this
 * upgrades the guide to Pro plan and adds the configured credits.
 *
 * Body: { guideId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const guideId = body.guideId

    if (!guideId || typeof guideId !== "string") {
      return NextResponse.json({ error: "guideId is required" }, { status: 400 })
    }

    const serviceSupabase = createServiceRoleClient()

    // Read the feature-flag config
    const { data: configRows } = await serviceSupabase
      .from("platform_config")
      .select("key, value")
      .in("key", [CONFIG_KEY_ENABLED, CONFIG_KEY_CREDITS])

    const config = Object.fromEntries(
      (configRows ?? []).map((r: { key: string; value: string }) => [r.key, r.value]),
    )

    const enabled = config[CONFIG_KEY_ENABLED] === "true"
    if (!enabled) {
      return NextResponse.json({ provisioned: false, reason: "promo_disabled" })
    }

    const credits = parseInt(config[CONFIG_KEY_CREDITS] ?? "200", 10) || 200

    // 1. Upgrade guide_plans to Pro (12 months)
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + 12)

    await serviceSupabase.from("guide_plans").upsert(
      {
        guide_id: guideId,
        plan_type: "pro",
        started_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        auto_renew: false,
      },
      { onConflict: "guide_id" },
    )

    // 2. Set credit balance
    await serviceSupabase.from("guide_credits").upsert(
      {
        guide_id: guideId,
        balance: credits,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "guide_id" },
    )

    // 3. Record the bonus transaction
    await serviceSupabase.from("credit_transactions").insert({
      guide_id: guideId,
      amount: credits,
      type: "bonus",
      description: `Signup promo: ${credits} free credits + Pro plan`,
    })

    return NextResponse.json({ provisioned: true, credits, plan: "pro" })
  } catch (err) {
    console.error("[provision-signup-promo] Error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    )
  }
}
