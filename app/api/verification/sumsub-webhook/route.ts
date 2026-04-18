import { type NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import crypto from "crypto"

const SUMSUB_SECRET_KEY = process.env.SUMSUB_WEBHOOK_SECRET!

function verifySignature(body: string, digest: string | null): boolean {
  if (!digest) return false
  const expected = crypto.createHmac("sha256", SUMSUB_SECRET_KEY).update(body).digest("hex")
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(digest, "hex"))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const digest = request.headers.get("x-payload-digest")

    if (!verifySignature(body, digest)) {
      console.warn("[sumsub] Webhook signature mismatch")
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
    }

    const payload = JSON.parse(body)
    const { type, externalUserId, reviewResult } = payload

    // Strip potential "level-" prefix that Sumsub SDK prepends to the userId
    const userId = typeof externalUserId === "string" ? externalUserId.replace(/^level-/, "") : externalUserId

    console.log("[sumsub] Webhook event:", type, "rawUserId:", externalUserId, "resolvedUserId:", userId)
    console.log("[sumsub] Full payload:", JSON.stringify(payload))

    if (type !== "applicantReviewed") {
      return NextResponse.json({ ok: true })
    }

    if (reviewResult?.reviewAnswer === "GREEN") {
      const supabase = createServiceRoleClient()
      const { error, count } = await supabase
        .from("profiles")
        .update({ guide_verified: true }, { count: "exact" })
        .eq("id", userId)

      if (error) {
        console.error("[sumsub] Failed to update guide_verified:", error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (count === 0) {
        console.error("[sumsub] No profile matched userId:", userId, "(rawUserId:", externalUserId, ")")
        return NextResponse.json({ error: "Profile not found" }, { status: 404 })
      }

      console.log("[sumsub] Guide verified:", userId)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[sumsub] Webhook error:", errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
