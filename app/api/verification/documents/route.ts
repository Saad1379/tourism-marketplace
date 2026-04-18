import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ensureProfile } from "@/lib/supabase/ensure-profile"

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
    if (!profile || profile.role !== "guide") {
      return NextResponse.json({ error: "Only guides can upload verification documents" }, { status: 403 })
    }

    const body = await request.json()
    const { verification_id, document_type, file_path } = body

    if (!verification_id || !document_type || !file_path) {
      return NextResponse.json({ error: "verification_id, document_type, and file_path are required" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("guide_verification_documents")
      .insert({
        verification_id,
        document_type,
        file_path,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ document: data })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Error in POST /api/verification/documents:", errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
