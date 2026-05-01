import { createHash, randomBytes } from "node:crypto"
import { notFound, permanentRedirect } from "next/navigation"
import type { Metadata } from "next"
import { createServiceRoleClient } from "@/lib/supabase/server"

type PageProps = {
  params: Promise<{ token: string }>
}

type LegacySessionRow = {
  tour_id: string
  guide_id: string
}

type TourLinkRow = {
  public_token: string
  guide_id: string
  status: string
}

export const metadata: Metadata = {
  title: "Leave a Tour Review | Touricho",
  description: "Share your experience with your local guide on Touricho.",
  robots: { index: false, follow: false },
}

function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

async function getOrCreateTourToken(
  supabase: ReturnType<typeof createServiceRoleClient>,
  tourId: string,
  guideId: string,
): Promise<string | null> {
  const { data: existing, error: existingError } = await supabase
    .from("review_qr_tour_links")
    .select("public_token, guide_id, status")
    .eq("tour_id", tourId)
    .maybeSingle()

  if (existingError) {
    console.error("[review-qr] Failed loading tour QR link:", existingError)
    return null
  }

  if (existing) {
    const row = existing as TourLinkRow
    if (row.guide_id !== guideId || !row.public_token) return null
    if (row.status !== "active") {
      await supabase
        .from("review_qr_tour_links")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("tour_id", tourId)
        .eq("guide_id", guideId)
    }
    return row.public_token
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = randomBytes(24).toString("hex")
    const tokenHash = hashToken(token)

    const { data: created, error: createError } = await supabase
      .from("review_qr_tour_links")
      .insert({
        tour_id: tourId,
        guide_id: guideId,
        public_token: token,
        public_token_hash: tokenHash,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .select("public_token")
      .single()

    if (!createError && created?.public_token) {
      return String(created.public_token)
    }

    if (createError?.code !== "23505") {
      console.error("[review-qr] Failed creating tour QR link:", createError)
      return null
    }

    const { data: conflicted } = await supabase
      .from("review_qr_tour_links")
      .select("public_token, guide_id")
      .eq("tour_id", tourId)
      .maybeSingle()

    if (conflicted?.public_token && conflicted?.guide_id === guideId) {
      return String(conflicted.public_token)
    }
  }

  return null
}

export default async function LegacyQrRedirectPage({ params }: PageProps) {
  const { token } = await params
  const rawToken = token?.trim()
  if (!rawToken || rawToken.length < 16) {
    notFound()
  }

  const supabase = createServiceRoleClient()
  const tokenHash = hashToken(rawToken)

  const { data: legacySession, error: sessionError } = await supabase
    .from("review_qr_sessions")
    .select("tour_id, guide_id")
    .eq("public_token_hash", tokenHash)
    .maybeSingle()

  if (sessionError) {
    console.error("[review-qr] Failed resolving legacy token:", sessionError)
    notFound()
  }

  if (!legacySession) {
    notFound()
  }

  const session = legacySession as LegacySessionRow
  const tourToken = await getOrCreateTourToken(supabase, session.tour_id, session.guide_id)
  if (!tourToken) {
    notFound()
  }

  permanentRedirect(`/rt/${tourToken}`)
}
