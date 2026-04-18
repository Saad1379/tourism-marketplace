import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function PATCH(request: NextRequest) {
  try {
    const anonClient = await createClient()
    const {
      data: { user },
    } = await anonClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { 
      full_name, 
      phone, 
      bio, 
      languages, 
      avatar_url,
      city // Added city as it was in migration 016
    } = body

    // We use service role to bypass RLS if needed, although profiles usually have update policy for own ID
    const serviceClient = createServiceRoleClient()
    
    const { data: profile, error: updateError } = await serviceClient
      .from("profiles")
      .update({
        full_name,
        phone,
        bio,
        languages,
        avatar_url,
        city,
      })
      .eq("id", user.id)
      .select()
      .single()


    if (updateError) {
      console.error("[v0] Profile update error:", updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Profile update unexpected error:", error)
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}
