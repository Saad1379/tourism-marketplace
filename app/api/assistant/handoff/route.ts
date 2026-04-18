import { NextRequest, NextResponse } from "next/server"
import { normalizePageContext, normalizeText, parseTourContextFromPathname } from "@/lib/assistant/context"
import type { AssistantHandoffRequestBody, AssistantHandoffResponseBody, AssistantMode } from "@/lib/assistant/types"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

function isAssistantMode(value: unknown): value is AssistantMode {
  return value === "guest" || value === "guide"
}

function isUuid(value: string | null | undefined): value is string {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function selectReadClient() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createServiceRoleClient()
  }
  return createClient()
}

async function resolveTourRef(input: {
  tourId: string | null
  guideId: string | null
  pageContext: ReturnType<typeof normalizePageContext>
}): Promise<{ tourId: string | null; guideId: string | null }> {
  let tourId = isUuid(input.tourId) ? input.tourId : null
  let guideId = isUuid(input.guideId) ? input.guideId : null

  if (tourId && guideId) return { tourId, guideId }

  const pathSlugs = parseTourContextFromPathname(input.pageContext.pathname || null)
  const citySlug = input.pageContext.citySlug || pathSlugs?.citySlug || null
  const tourSlug = input.pageContext.tourSlug || pathSlugs?.tourSlug || null
  if (!tourId && isUuid(input.pageContext.tourId || null)) {
    tourId = String(input.pageContext.tourId)
  }
  if (!guideId && isUuid(input.pageContext.guideId || null)) {
    guideId = String(input.pageContext.guideId)
  }

  if (tourId && guideId) return { tourId, guideId }
  if (!tourId && (!citySlug || !tourSlug)) return { tourId, guideId }

  const readClient = await selectReadClient()
  let query = readClient
    .from("tours")
    .select("id, guide_id, status")
    .eq("status", "published")
    .limit(1)

  if (tourId) {
    query = query.eq("id", tourId)
  } else if (citySlug && tourSlug) {
    query = query.eq("city_slug", citySlug).eq("tour_slug", tourSlug)
  }

  const { data } = await query.maybeSingle()
  if (!data) return { tourId, guideId }

  return {
    tourId: String(data.id || tourId || ""),
    guideId: String(data.guide_id || guideId || ""),
  }
}

async function createOrLoadConversation(input: {
  touristId: string
  guideId: string
  tourId: string | null
}): Promise<string> {
  const supabase = await createClient()

  let existingQuery = supabase
    .from("conversations")
    .select("id")
    .eq("tourist_id", input.touristId)
    .eq("guide_id", input.guideId)
    .limit(1)

  if (input.tourId) {
    existingQuery = existingQuery.eq("tour_id", input.tourId)
  } else {
    existingQuery = existingQuery.is("tour_id", null)
  }

  const { data: existing } = await existingQuery.maybeSingle()
  if (existing?.id) return String(existing.id)

  const { data: inserted, error } = await supabase
    .from("conversations")
    .insert({
      tourist_id: input.touristId,
      guide_id: input.guideId,
      tour_id: input.tourId,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error || !inserted?.id) {
    throw new Error(error?.message || "Failed to create conversation")
  }

  return String(inserted.id)
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AssistantHandoffRequestBody
    if (!isAssistantMode(body?.mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
    }

    const mode = body.mode
    const pageContext = normalizePageContext(body.pageContext)
    const authClient = await createClient()
    const {
      data: { user },
    } = await authClient.auth.getUser()

    if (mode === "guide") {
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      const { data: profile } = await authClient.from("profiles").select("role").eq("id", user.id).single()
      if (profile?.role !== "guide") {
        return NextResponse.json({ error: "Guide access required" }, { status: 403 })
      }

      const payload: AssistantHandoffResponseBody = { redirectUrl: "/dashboard/messages" }
      return NextResponse.json(payload)
    }

    const requestedTourId = normalizeText(body.tourId)
    const requestedGuideId = normalizeText(body.guideId)
    const resolved = await resolveTourRef({
      tourId: requestedTourId || null,
      guideId: requestedGuideId || null,
      pageContext,
    })

    const resolvedTourId = isUuid(resolved.tourId) ? resolved.tourId : null
    const resolvedGuideId = isUuid(resolved.guideId) ? resolved.guideId : null

    if (!user) {
      const redirectTarget = new URLSearchParams()
      redirectTarget.set("assistant_handoff", "1")
      if (resolvedTourId) redirectTarget.set("tour_id", resolvedTourId)
      if (resolvedGuideId) redirectTarget.set("guide_id", resolvedGuideId)
      const destination = `/messages${redirectTarget.toString() ? `?${redirectTarget.toString()}` : ""}`
      const payload: AssistantHandoffResponseBody = {
        redirectUrl: `/login?redirect=${encodeURIComponent(destination)}`,
      }
      return NextResponse.json(payload)
    }

    if (!resolvedGuideId) {
      const payload: AssistantHandoffResponseBody = { redirectUrl: "/messages" }
      return NextResponse.json(payload)
    }

    const conversationId = await createOrLoadConversation({
      touristId: user.id,
      guideId: resolvedGuideId,
      tourId: resolvedTourId,
    })

    const payload: AssistantHandoffResponseBody = {
      redirectUrl: `/messages?conversation_id=${conversationId}`,
      conversationId,
    }
    return NextResponse.json(payload)
  } catch (error) {
    console.error("[assistant-handoff] route error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
