import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await createClient()

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        // 1. Fetch the user's existing profile
        // We select only 'role' first to check migration status for 'onboarding_completed'
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        if (profileError && profileError.code !== "PGRST116") {
          console.error("[v0] Auth callback - Error fetching profile:", profileError.message)
        }

        // 2. Determine target roles
        const requestedRole = searchParams.get("role") as "tourist" | "guide" | null
        const currentRoles = profile?.roles || ["tourist"]
        let newRoles = [...currentRoles]
        let onboardingCompleted = profile?.onboarding_completed ?? true

        // Rule: If "Register as Guide" was clicked, ensure 'guide' is in the roles array
        if (requestedRole === "guide" && !newRoles.includes("guide")) {
          newRoles.push("guide")
          onboardingCompleted = false // New guides need onboarding
        }

        // Determine the "primary" role for backward compatibility
        const primaryRole = newRoles.includes("guide") ? "guide" : "tourist"

        console.log("[v0] Auth callback - session for:", user.id, "Current:", currentRoles, "Target:", newRoles)

        // 3. Update the profiles table if necessary
        const needsUpdate = !profile || 
                            JSON.stringify(currentRoles) !== JSON.stringify(newRoles) ||
                            profile.role !== primaryRole ||
                            profile.onboarding_completed !== onboardingCompleted

        if (needsUpdate) {
          const { error: updateError } = await supabase
            .from("profiles")
            .update({ 
              role: primaryRole,
              roles: newRoles,
              onboarding_completed: onboardingCompleted
            })
            .eq("id", user.id)

          if (updateError) {
            console.error("[v0] Auth callback - Failed to update profile roles:", updateError.message)
          }

          // 3b. Provision Guide records if they are now a guide
          if (newRoles.includes("guide")) {
            console.log("[v0] Auth callback - Provisioning guide records for:", user.id)
            await supabase.from("guide_plans").upsert({ guide_id: user.id, plan_type: "free" })
            await supabase.from("guide_credits").upsert({ guide_id: user.id, balance: 0 })
          }
        }

        // 4. Determine redirect path
        let redirectPath = "/tours" // Default for tourists
        
        if (newRoles.includes("guide")) {
          // If they haven't completed onboarding, send them back to the guide wizard
          if (!onboardingCompleted) {
            redirectPath = "/become-guide"
          } else {
            redirectPath = "/dashboard"
          }
        }

        return NextResponse.redirect(`${origin}${next === "/" ? redirectPath : next}`)
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/error?error=auth_callback_error`)
}
