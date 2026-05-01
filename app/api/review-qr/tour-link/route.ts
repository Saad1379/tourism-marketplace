import { type NextRequest, NextResponse } from "next/server"
import { createHash, randomBytes } from "node:crypto"
import { getSiteUrl } from "@/lib/site-url"
import { mapQrRpcError } from "@/lib/review-qr"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

type TourLinkRow = {
  tour_id: string
  guide_id: string
  public_token: string
  status: string
}

type FallbackResult =
  | { ok: true; row: TourLinkRow }
  | { ok: false; status: number; error: string }

export const runtime = "nodejs"

function normalizeCitySlug(citySlug: unknown, city: unknown): string {
  const slug = typeof citySlug === "string" ? citySlug.trim().toLowerCase() : ""
  if (slug) return slug

  const cityValue = typeof city === "string" ? city.trim().toLowerCase() : ""
  const normalized = cityValue
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return normalized || "unknown-city"
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

function formatDbError(error: unknown): string {
  if (!error) return "Unknown QR error"
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  if (typeof error === "object") {
    const maybe = error as Record<string, unknown>
    const parts = [maybe.message, maybe.details, maybe.hint, maybe.code]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim())
    if (parts.length > 0) return parts.join(" | ")
  }
  return "Unknown QR error"
}

async function getOrCreateTourLinkFallback(
  serviceSupabase: ReturnType<typeof createServiceRoleClient>,
  tourId: string,
  guideId: string,
): Promise<FallbackResult> {
  const { data: tour, error: tourError } = await serviceSupabase
    .from("tours")
    .select("*")
    .eq("id", tourId)
    .maybeSingle()

  if (tourError) {
    throw new Error(formatDbError(tourError))
  }

  if (!tour || tour.guide_id !== guideId) {
    return { ok: false, status: 403, error: "You can only access review QR for your own tour." }
  }

  const citySlug = normalizeCitySlug((tour as Record<string, unknown>).city_slug, (tour as Record<string, unknown>).city)
  const { data: allowlistRows, error: allowlistError } = await serviceSupabase
    .from("review_qr_allowlist")
    .select("id")
    .eq("guide_id", guideId)
    .eq("city_slug", citySlug)
    .eq("enabled", true)
    .limit(1)

  if (allowlistError) {
    const allowlistErrorMessage = formatDbError(allowlistError)
    if (allowlistErrorMessage.toUpperCase().includes("REVIEW_QR_ALLOWLIST") && allowlistErrorMessage.toUpperCase().includes("DOES NOT EXIST")) {
      // Backward-compatible fallback if pilot table is missing in a partially migrated DB.
    } else {
      throw new Error(allowlistErrorMessage)
    }
  }

  if (!allowlistError && (!Array.isArray(allowlistRows) || allowlistRows.length === 0)) {
    return {
      ok: false,
      status: 403,
      error: "Your account is not enabled for QR review pilot in this city.",
    }
  }

  const { data: existing, error: existingError } = await serviceSupabase
    .from("review_qr_tour_links")
    .select("*")
    .eq("tour_id", tourId)
    .maybeSingle()

  if (existingError) {
    throw new Error(formatDbError(existingError))
  }

  if (existing) {
    const existingGuideId = String((existing as Record<string, unknown>).guide_id || "")
    if (existingGuideId !== guideId) {
      return { ok: false, status: 403, error: "You can only access review QR for your own tour." }
    }

    if (String((existing as Record<string, unknown>).status || "") !== "active") {
      const { error: activateError } = await serviceSupabase
        .from("review_qr_tour_links")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("tour_id", tourId)
        .eq("guide_id", guideId)

      if (activateError) {
        throw new Error(formatDbError(activateError))
      }
    }

    const existingToken = String((existing as Record<string, unknown>).public_token || "")
    if (!existingToken) {
      return {
        ok: false,
        status: 500,
        error: "Tour QR link is missing token data. Re-run the latest QR SQL migration.",
      }
    }

    return {
      ok: true,
      row: {
        tour_id: String((existing as Record<string, unknown>).tour_id),
        guide_id: existingGuideId,
        public_token: existingToken,
        status: "active",
      },
    }
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = randomBytes(24).toString("hex")
    const tokenHash = hashToken(token)

    const { data: created, error: createError } = await serviceSupabase
      .from("review_qr_tour_links")
      .insert({
        tour_id: tourId,
        guide_id: guideId,
        public_token: token,
        public_token_hash: tokenHash,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .select("tour_id, guide_id, public_token, status")
      .single()

    if (!createError && created) {
      return {
        ok: true,
        row: {
          tour_id: String(created.tour_id),
          guide_id: String(created.guide_id),
          public_token: String(created.public_token),
          status: String(created.status || "active"),
        },
      }
    }

    if (createError?.code !== "23505") {
      throw new Error(formatDbError(createError))
    }

    const { data: conflicted, error: conflictFetchError } = await serviceSupabase
      .from("review_qr_tour_links")
      .select("tour_id, guide_id, public_token, status")
      .eq("tour_id", tourId)
      .maybeSingle()

    if (conflictFetchError) {
      throw new Error(formatDbError(conflictFetchError))
    }

    if (conflicted) {
      if (conflicted.guide_id !== guideId) {
        return { ok: false, status: 403, error: "You can only access review QR for your own tour." }
      }
      return {
        ok: true,
        row: {
          tour_id: String(conflicted.tour_id),
          guide_id: String(conflicted.guide_id),
          public_token: String(conflicted.public_token),
          status: String(conflicted.status || "active"),
        },
      }
    }
  }

  return { ok: false, status: 500, error: "Unable to process request right now." }
}

import { isSeller } from "@/lib/marketplace/roles"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    if (profile && !isSeller(profile.role)) {
      return NextResponse.json({ error: "Only sellers can access tour QR links." }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const tourId = typeof body?.tour_id === "string" ? body.tour_id.trim() : ""
    if (!/^[0-9a-fA-F-]{36}$/.test(tourId)) {
      return NextResponse.json({ error: "tour_id must be a valid UUID." }, { status: 400 })
    }

    let row: TourLinkRow | undefined

    const { data: rpcData, error: rpcError } = await supabase.rpc("get_or_create_review_qr_tour_link", {
      p_tour_id: tourId,
      p_guide_id: user.id,
    })

    if (!rpcError) {
      const rpcRow = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as TourLinkRow | undefined
      if (rpcRow?.tour_id && rpcRow?.public_token) {
        row = {
          tour_id: String(rpcRow.tour_id),
          guide_id: String(rpcRow.guide_id),
          public_token: String(rpcRow.public_token),
          status: String(rpcRow.status || "active"),
        }
      }
    }

    if (!row) {
      const baseError = formatDbError(rpcError)
      const upper = baseError.toUpperCase()
      const shouldFallbackToServiceRole =
        Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
        (upper.includes("DOES NOT EXIST") ||
          upper.includes("FUNCTION") ||
          upper.includes("COLUMN") ||
          upper.includes("AMBIGUOUS") ||
          upper.includes("PERMISSION"))

      if (!shouldFallbackToServiceRole) {
        const mapped = mapQrRpcError(baseError)
        return NextResponse.json({ error: mapped.message }, { status: mapped.status })
      }

      const serviceSupabase = createServiceRoleClient()
      try {
        const fallback = await getOrCreateTourLinkFallback(serviceSupabase, tourId, user.id)
        if (!fallback.ok) {
          return NextResponse.json({ error: fallback.error }, { status: fallback.status })
        }
        row = fallback.row
      } catch (fallbackError) {
        const fallbackBaseError = formatDbError(fallbackError)
        const mapped = mapQrRpcError(fallbackBaseError)

        if (mapped.status === 500 && mapped.message === "Unable to process request right now.") {
          const fallbackUpper = fallbackBaseError.toUpperCase()
          if (fallbackUpper.includes("REVIEW_QR_TOUR_LINKS") && fallbackUpper.includes("DOES NOT EXIST")) {
            return NextResponse.json(
              { error: "QR database setup is incomplete. Run the latest QR SQL migration first." },
              { status: 500 },
            )
          }
          if (fallbackUpper.includes("PUBLIC_TOKEN") && fallbackUpper.includes("DOES NOT EXIST")) {
            return NextResponse.json(
              { error: "QR table schema is outdated. Re-run the latest QR SQL migration." },
              { status: 500 },
            )
          }
          if (fallbackUpper.includes("SUPABASE_SERVICE_ROLE_KEY")) {
            return NextResponse.json(
              { error: "Server configuration missing SUPABASE_SERVICE_ROLE_KEY." },
              { status: 500 },
            )
          }
        }

        return NextResponse.json({ error: mapped.message }, { status: mapped.status })
      }
    }

    if (!row?.tour_id || !row?.public_token) {
      return NextResponse.json({ error: "Failed to get tour review QR link." }, { status: 500 })
    }

    const qrUrl = `${getSiteUrl()}/rt/${row.public_token}`

    return NextResponse.json({
      tourId: row.tour_id,
      qrUrl,
      status: row.status,
    })
  } catch (error) {
    console.error("[review-qr] Failed to get tour link:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
