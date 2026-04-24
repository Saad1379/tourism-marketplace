import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Email-confirmation / OAuth callback for Supabase auth.
 *
 * After the NextAuth refactor, NextAuth is the client-side session source of
 * truth. To avoid ever leaving the user half-authenticated (Supabase cookie
 * set, NextAuth session missing), we hand off to /auth/complete which reads
 * the Supabase session and mints a NextAuth session via the supabase-session
 * credentials provider. That works for both the email-confirmation flow
 * (password signups) and the Supabase Google OAuth flow.
 *
 * Steps:
 *   1. Exchange the code (sets Supabase cookies, lets us read the user).
 *   2. Upgrade the profile if `?role=guide` is present (belt-and-suspenders
 *      alongside the handle_new_user trigger, which reads `requested_role`
 *      from metadata).
 *   3. Redirect to /auth/complete?next=<target> with Supabase cookies still
 *      set — the bridge page uses them to obtain a NextAuth session, then
 *      forwards to <target>.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next")

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/error?error=auth_callback_missing_code`)
  }

  const supabase = await createClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/auth/error?error=auth_callback_error`)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/error?error=auth_callback_no_user`)
  }

  // Fetch existing profile (may not exist yet for OAuth signups)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (profileError && profileError.code !== "PGRST116") {
    console.error("[auth/callback] profile fetch error:", profileError.message)
  }

  const requestedRole = searchParams.get("role") as "tourist" | "guide" | null
  const currentRoles: string[] = profile?.roles || ["tourist"]
  const newRoles = [...currentRoles]
  let onboardingCompleted: boolean = profile?.onboarding_completed ?? true

  if (requestedRole === "guide" && !newRoles.includes("guide")) {
    newRoles.push("guide")
    onboardingCompleted = false
  }

  const primaryRole = newRoles.includes("guide") ? "guide" : "tourist"

  const needsUpdate =
    !profile ||
    JSON.stringify(currentRoles) !== JSON.stringify(newRoles) ||
    profile.role !== primaryRole ||
    profile.onboarding_completed !== onboardingCompleted

  if (needsUpdate) {
    const updatePayload: Record<string, unknown> = {
      role: primaryRole,
      roles: newRoles,
      onboarding_completed: onboardingCompleted,
    }
    // guide_approval_status is intentionally left NULL at signup; it becomes
    // 'pending' only when the onboarding form is submitted.

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id)

    if (updateError) {
      console.error("[auth/callback] profile update failed:", updateError.message)
    }

    // Provision guide-side records when the user is now a guide.
    if (newRoles.includes("guide")) {
      await supabase.from("guide_plans").upsert({ guide_id: user.id, plan_type: "free" })
      await supabase.from("guide_credits").upsert({ guide_id: user.id, balance: 0 })
    }
  }

  // Figure out where the user should land after they sign in.
  let target: string
  if (next && next !== "/") {
    target = next
  } else if (newRoles.includes("guide") && !onboardingCompleted) {
    target = "/become-guide"
  } else if (primaryRole === "guide") {
    target = "/dashboard"
  } else {
    target = "/profile"
  }

  // Keep the Supabase session cookies — the /auth/complete bridge needs them
  // to read the access token and mint a NextAuth session via the
  // supabase-session credentials provider.
  const completeUrl = new URL("/auth/complete", origin)
  completeUrl.searchParams.set("next", target)
  return NextResponse.redirect(completeUrl.toString())
}
