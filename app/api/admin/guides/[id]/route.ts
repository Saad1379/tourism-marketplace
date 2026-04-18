import { type NextRequest, NextResponse } from "next/server"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { sendGuideApprovalEmail } from "@/lib/email/mailgun"

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized", status: 401 }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") return { error: "Admin access required", status: 403 }
  return { error: null, status: 200 }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await verifyAdmin()
  if (error) return NextResponse.json({ error }, { status })

  try {
    const { id } = await params
    const body = await request.json()
    const { guide_approval_status } = body

    if (!["approved", "rejected"].includes(guide_approval_status)) {
      return NextResponse.json({ error: "Invalid status. Must be 'approved' or 'rejected'" }, { status: 400 })
    }

    const serviceSupabase = createServiceRoleClient()

    const { data: guide, error: updateError } = await serviceSupabase
      .from("profiles")
      .update({ guide_approval_status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("email, full_name")
      .single()

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

    // Send approval email via shared Mailgun utility
    if (guide_approval_status === "approved" && guide?.email) {
      try {
        await sendGuideApprovalEmail(guide.full_name || "Guide", guide.email)
      } catch (emailErr) {
        // Log but don't fail the request — approval is already saved in DB
        console.error("[Guide Approval] Email delivery failed:", emailErr)
      }
    }

    // Mark related admin notifications as read
    await serviceSupabase
      .from("admin_notifications")
      .update({ is_read: true })
      .filter("data->>guide_id", "eq", id)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 })
  }
}
