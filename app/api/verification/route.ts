import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ensureProfile } from "@/lib/supabase/ensure-profile"
import { isSeller } from "@/lib/marketplace/roles"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const profile = await ensureProfile(supabase, user)
    if (!profile || !isSeller(profile.role)) {
      return NextResponse.json({ error: "Only sellers can access verification" }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("guide_verifications")
      .select("*, documents:guide_verification_documents(id, document_type, file_path, uploaded_at)")
      .eq("guide_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ verification: data })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Error in GET /api/verification:", errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const profile = await ensureProfile(supabase, user)
    if (!profile || !isSeller(profile.role)) {
      return NextResponse.json({ error: "Only sellers can submit verification" }, { status: 403 })
    }

    const body = await request.json()
    const { full_name, country, address, city, notes, status = "submitted" } = body

    const { data: existing, error: fetchError } = await supabase
      .from("guide_verifications")
      .select("id")
      .eq("guide_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 400 })
    }

    if (existing?.id) {
      const { data, error } = await supabase
        .from("guide_verifications")
        .update({
          full_name,
          country,
          address,
          city,
          notes,
          status,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ verification: data })
    }

    const { data, error } = await supabase
      .from("guide_verifications")
      .insert({
        guide_id: user.id,
        full_name,
        country,
        address,
        city,
        notes,
        status,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ verification: data })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Error in POST /api/verification:", errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
