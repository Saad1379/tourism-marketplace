import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { ensureProfile } from "@/lib/supabase/ensure-profile"
import crypto from "crypto"

const SUMSUB_APP_TOKEN = process.env.SAMSUB_ACCESS_TOKEN!
const SUMSUB_SECRET_KEY = process.env.SAMSUB_SECRET_KEY!
const SUMSUB_BASE_URL = "https://api.sumsub.com"
const SUMSUB_LEVEL_NAME = process.env.SUMSUB_LEVEL_NAME || "basic-kyc-level"

function sign(method: string, path: string, body: string, ts: number): string {
  const data = `${ts}${method.toUpperCase()}${path}${body}`
  return crypto.createHmac("sha256", SUMSUB_SECRET_KEY).update(data).digest("hex")
}

export async function POST() {
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
      return NextResponse.json({ error: "Only guides can access verification" }, { status: 403 })
    }

    const ts = Math.floor(Date.now() / 1000)
    const path = `/resources/accessTokens?userId=${user.id}&ttlInSecs=1800&levelName=${SUMSUB_LEVEL_NAME}`

    const response = await fetch(`${SUMSUB_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "X-App-Token": SUMSUB_APP_TOKEN,
        "X-App-Access-Sig": sign("POST", path, "", ts),
        "X-App-Access-Ts": ts.toString(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: "",
    })

    if (!response.ok) {
      const err = await response.text()
      console.error("[sumsub] Token generation failed:", err)
      return NextResponse.json({ error: "Failed to generate Sumsub token" }, { status: 500 })
    }

    const data = await response.json()
    return NextResponse.json({ token: data.token })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error"
    console.error("[sumsub] Error in POST /api/verification/sumsub-token:", errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
