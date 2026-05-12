import { NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"

const CONFIG_KEY_ENABLED = "guide_signup_free_pro_enabled"
const CONFIG_KEY_CREDITS = "guide_signup_free_pro_credits"

/**
 * Public (unauthenticated) endpoint.
 * Returns whether the "Free Pro on signup" promo is active and the bonus credit amount.
 * Used by the /become-guide page to show the promo banner.
 */
export async function GET() {
  try {
    const serviceSupabase = createServiceRoleClient()
    const { data, error } = await serviceSupabase
      .from("platform_config")
      .select("key, value")
      .in("key", [CONFIG_KEY_ENABLED, CONFIG_KEY_CREDITS])

    if (error) {
      return NextResponse.json({ enabled: false, credits: 0 })
    }

    const map = Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]))

    return NextResponse.json({
      enabled: map[CONFIG_KEY_ENABLED] === "true",
      credits: parseInt(map[CONFIG_KEY_CREDITS] ?? "0", 10) || 0,
    })
  } catch {
    return NextResponse.json({ enabled: false, credits: 0 })
  }
}
