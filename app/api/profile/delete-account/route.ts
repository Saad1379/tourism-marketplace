import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function DELETE(request: NextRequest) {
  try {
    const anonClient = await createClient()
    const {
      data: { user },
    } = await anonClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const serviceClient = createServiceRoleClient()

    // 0. If user is a guide, "draft" their tours so they immediately disappear from the app
    const { error: toursError } = await serviceClient
      .from("tours")
      .update({ status: "draft" })
      .eq("guide_id", user.id)

    if (toursError) {
      console.error("[v0] Error auto-drafting guide tours:", toursError)
      // Continue anyway; anonymization is more critical
    }
    
    // 1. Anonymize the profile data and mark as deleted (GDPR Compliance)
    const { error: anonymizeError } = await serviceClient
      .from("profiles")
      .update({
        email: `deleted_${user.id}@tipwalk.com`,
        full_name: "Deleted User",
        phone: null,
        bio: null,
        avatar_url: null,
        is_deleted: true,
        is_public: false,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (anonymizeError) {
      console.error("[v0] Account anonymization error:", anonymizeError)
      return NextResponse.json({ error: "Failed to anonymize user data" }, { status: 500 })
    }

    // 2. Deleting the user from auth.users via admin API
    // If the DB is configured with ON DELETE CASCADE this will completely wipe
    // the profile record. If it's configured to preserve it, the anonymization 
    // above ensures GDPR compliance.
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id)

    if (deleteError) {
      console.error("[v0] Account deletion error:", deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Account deletion unexpected error:", error)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
