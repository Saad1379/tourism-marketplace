import { type SupabaseClient } from "@supabase/supabase-js"

/**
 * Ensures a profile exists for the authenticated user.
 * If not found, creates one with sensible defaults.
 * Normalizes role to lowercase.
 */
export async function ensureProfile(
  supabase: SupabaseClient,
  user: { id: string; email: string; user_metadata?: { role?: string } }
) {
  try {
    // Try to fetch existing profile
    const { data: existingProfile, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()

    if (existingProfile) {
      return existingProfile
    }

    // If not found (404 is expected), create a new profile
    if (fetchError && fetchError.code === "PGRST116") {
      const userRole = user.user_metadata?.role
        ? String(user.user_metadata.role).toLowerCase()
        : "tourist"

      // Validate role
      const validRoles = ["guide", "tourist", "admin"]
      const normalizedRole = validRoles.includes(userRole) ? userRole : "tourist"

      const { data: newProfile, error: createError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email,
          role: normalizedRole,
          guide_tier: normalizedRole === "guide" ? "free" : null,
        })
        .select()
        .single()

      if (createError) {
        console.error("[v0] Error creating profile:", createError)
        return null
      }

      return newProfile
    }

    // Other errors
    if (fetchError) {
      console.error("[v0] Error fetching profile:", fetchError)
      return null
    }

    return null
  } catch (error) {
    console.error("[v0] Unexpected error in ensureProfile:", error)
    return null
  }
}
