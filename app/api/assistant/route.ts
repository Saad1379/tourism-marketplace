import { NextRequest, NextResponse } from "next/server"
import {
  ASSISTANT_MAX_MESSAGE_CHARS,
  normalizePageContext,
  normalizeText,
  parseTourContextFromPathname,
  sanitizeAssistantHistory,
} from "@/lib/assistant/context"
import type {
  AssistantContextCard,
  AssistantMode,
  AssistantRequestBody,
  AssistantResponseBody,
  AssistantResponseSection,
} from "@/lib/assistant/types"
import { getRequestIp } from "@/lib/review-qr"
import { checkAssistantRateLimit, type AssistantRateLimitResult, type AssistantRateLimitScope } from "@/lib/assistant/rate-limit"
import { faqCategories } from "@/lib/mock-data"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"
const DEFAULT_ASSISTANT_MODEL = "gpt-4o-mini"
const OPENAI_ASSISTANT_TIMEOUT_MS = 12000
const ASSISTANT_MAX_ANSWER_CHARS = 1200
const ASSISTANT_MAX_ACTION_CHARS = 90

type TourContext = {
  id: string
  title: string
  city: string
  citySlug: string | null
  tourSlug: string | null
  meetingPoint: string | null
  meetingPointDetails: string | null
  durationMinutes: number | null
  maxCapacity: number | null
  minimumAttendees: number | null
  languages: string[]
  guideId: string | null
  guideName: string | null
  nextStartTime: string | null
}

function isAssistantMode(value: unknown): value is AssistantMode {
  return value === "guest" || value === "guide"
}

function selectReadClient() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createServiceRoleClient()
  }
  return createClient()
}

function extractFaqGrounding(mode: AssistantMode, pathname: string | null): string[] {
  const isGuideOnboarding = pathname?.startsWith("/become-guide")
  const allowedCategories =
    mode === "guide" || isGuideOnboarding
      ? new Set(["For Guides", "Credits & Premium", "Booking & Payments"])
      : new Set(["For Travelers", "Booking & Payments"])

  return faqCategories
    .filter((category) => allowedCategories.has(category.name))
    .flatMap((category) =>
      category.faqs.slice(0, 8).map((entry) => `[${category.name}] Q: ${entry.question} A: ${entry.answer}`),
    )
    .slice(0, 12)
}

async function resolveTourContext(pageContext: ReturnType<typeof normalizePageContext>): Promise<TourContext | null> {
  const readClient = await selectReadClient()
  const pathSlugs = parseTourContextFromPathname(pageContext.pathname || null)
  const citySlug = pageContext.citySlug || pathSlugs?.citySlug || null
  const tourSlug = pageContext.tourSlug || pathSlugs?.tourSlug || null

  let query = readClient
    .from("tours")
    .select(`
      id,
      title,
      city,
      city_slug,
      tour_slug,
      meeting_point,
      meeting_point_details,
      duration_minutes,
      max_capacity,
      minimum_attendees,
      languages,
      guide_id,
      status,
      guide:guide_id(full_name)
    `)
    .eq("status", "published")
    .limit(1)

  if (pageContext.tourId) {
    query = query.eq("id", pageContext.tourId)
  } else if (citySlug && tourSlug) {
    query = query.eq("city_slug", citySlug).eq("tour_slug", tourSlug)
  } else {
    return null
  }

  const { data, error } = await query.maybeSingle()
  if (error || !data) return null

  const { data: nextSchedule } = await readClient
    .from("tour_schedules")
    .select("start_time")
    .eq("tour_id", data.id)
    .gt("start_time", new Date().toISOString())
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle()

  const guideRecord = Array.isArray(data.guide) ? data.guide[0] : data.guide

  return {
    id: String(data.id),
    title: String(data.title || ""),
    city: String(data.city || ""),
    citySlug: data.city_slug ? String(data.city_slug) : null,
    tourSlug: data.tour_slug ? String(data.tour_slug) : null,
    meetingPoint: data.meeting_point ? String(data.meeting_point) : null,
    meetingPointDetails: data.meeting_point_details ? String(data.meeting_point_details) : null,
    durationMinutes: Number.isFinite(Number(data.duration_minutes)) ? Number(data.duration_minutes) : null,
    maxCapacity: Number.isFinite(Number(data.max_capacity)) ? Number(data.max_capacity) : null,
    minimumAttendees: Number.isFinite(Number(data.minimum_attendees)) ? Number(data.minimum_attendees) : null,
    languages: Array.isArray(data.languages) ? data.languages.map((value: unknown) => String(value)).filter(Boolean) : [],
    guideId: data.guide_id ? String(data.guide_id) : null,
    guideName: guideRecord?.full_name ? String(guideRecord.full_name) : null,
    nextStartTime: nextSchedule?.start_time ? String(nextSchedule.start_time) : null,
  }
}

async function resolveGuideContext(guideId: string): Promise<{
  summaryLines: string[]
  totalTours: number
  publishedTours: number
  draftTours: number
  upcomingSchedules: number
  quickTours: Array<{ id: string; title: string; status: string; city: string }>
}> {
  const supabase = await createClient()
  const { data: tours } = await supabase
    .from("tours")
    .select("id, title, city, status, max_capacity, minimum_attendees, updated_at")
    .eq("guide_id", guideId)
    .order("updated_at", { ascending: false })
    .limit(10)

  const allTours = Array.isArray(tours) ? tours : []
  const publishedTours = allTours.filter((tour) => String(tour.status || "") === "published").length
  const draftTours = allTours.filter((tour) => String(tour.status || "") !== "published").length

  const tourIds = allTours.map((tour) => String(tour.id || "")).filter(Boolean)
  let upcomingSchedules = 0
  if (tourIds.length > 0) {
    const { count } = await supabase
      .from("tour_schedules")
      .select("id", { count: "exact", head: true })
      .in("tour_id", tourIds)
      .gt("start_time", new Date().toISOString())
    upcomingSchedules = Number(count || 0)
  }

  return {
    summaryLines: [
      `Guide has ${allTours.length} total tours (${publishedTours} published, ${draftTours} not published).`,
      `Upcoming schedule slots: ${upcomingSchedules}.`,
    ],
    totalTours: allTours.length,
    publishedTours,
    draftTours,
    upcomingSchedules,
    quickTours: allTours.slice(0, 6).map((tour) => ({
      id: String(tour.id),
      title: String(tour.title || "Untitled tour"),
      status: String(tour.status || "draft"),
      city: String(tour.city || ""),
    })),
  }
}

function buildGuideContextCard(guideContext: {
  totalTours: number
  publishedTours: number
  draftTours: number
  upcomingSchedules: number
}): AssistantContextCard {
  return {
    mode: "guide",
    title: "Guide Snapshot",
    subtitle: "Current dashboard status",
    facts: [
      {
        label: "Tours",
        value: `${guideContext.totalTours} total (${guideContext.publishedTours} published / ${guideContext.draftTours} draft)`,
      },
      {
        label: "Upcoming Slots",
        value: `${guideContext.upcomingSchedules} scheduled`,
      },
      {
        label: "Quick Focus",
        value: "Keep one published tour with fresh future slots for steady bookings",
      },
    ],
    actions: [
      { id: "open_my_tours", label: "Open My Tours", kind: "navigate", href: "/dashboard/tours" },
      { id: "open_schedules", label: "Open Schedules", kind: "navigate", href: "/dashboard/bookings" },
      { id: "talk_human", label: "Talk to human", kind: "handoff" },
    ],
  }
}

function buildSystemPrompt(mode: AssistantMode): string {
  if (mode === "guide") {
    return [
      "You are Touricho's guide assistant embedded in the dashboard.",
      "Use only provided grounding facts and known product behavior.",
      "If a detail is unknown, say you do not have that exact data and suggest Talk to human.",
      "Do not invent product features, prices, legal rules, or booking outcomes.",
      "Be concise, practical, and action-oriented.",
      'Return JSON only: {"answer":"...","suggestedActions":["...","..."]}.',
    ].join(" ")
  }

  return [
    "You are Touricho's guest assistant on tour and booking pages.",
    "Use a warm, friendly, practical tone that helps travelers make decisions quickly.",
    "Answer directly in plain language, then give one practical next step.",
    "Use only provided grounding facts and known product behavior.",
    "If a detail is unknown, say you do not have that exact data and suggest Talk to human.",
    "Do not invent guide promises, schedule guarantees, prices, or policies.",
    "Keep answers concise (typically under 120 words) and avoid robotic phrasing.",
    'Return JSON only: {"answer":"...","suggestedActions":["...","..."]}.',
  ].join(" ")
}

function buildGuestFallback(tourContext: TourContext | null, isGuideOnboarding: boolean): AssistantResponseBody {
  if (isGuideOnboarding) {
    return {
      answer:
        "I can help with the guide application flow, approval expectations, and what to prepare before final submission. If you need account-specific confirmation, use Talk to human.",
      suggestedActions: [
        "What does the approval review include?",
        "What should I complete before I submit?",
        "Talk to human",
      ],
      groundingSummary: ["Fallback response returned (OpenAI unavailable).", "Guide onboarding context detected."],
    }
  }

  if (!tourContext) {
    return {
      answer:
        "I can help with booking flow, cancellation basics, and tipping guidance. If you need confirmation tied to a specific tour or guide, use Talk to human.",
      suggestedActions: ["Ask about booking steps", "Ask about tipping", "Talk to human"],
      groundingSummary: ["Fallback response returned (OpenAI unavailable).", "FAQ grounding available."],
    }
  }

  return {
    answer: `I can help with this tour. Meeting point: ${tourContext.meetingPoint || "shown on the tour page"}. If you need a confirmed answer from the guide, use Talk to human.`,
    suggestedActions: ["Where exactly is the meeting point?", "What is the cancellation policy?", "Talk to human"],
    groundingSummary: [
      "Fallback response returned (OpenAI unavailable).",
      `Tour context loaded: ${tourContext.title} (${tourContext.id}).`,
    ],
  }
}

function buildGuideFallback(): AssistantResponseBody {
  return {
    answer:
      "I can help with tour setup, publish readiness, and schedule questions. If you need account-specific support from the team, use Talk to human.",
    suggestedActions: ["How do I publish a tour?", "How should I set schedules?", "Talk to human"],
    groundingSummary: ["Fallback response returned (OpenAI unavailable).", "Guide dashboard context available."],
  }
}

function buildContextOnlyAnswer(input: {
  mode: AssistantMode
  tourContext: TourContext | null
  isGuideOnboarding: boolean
  guideContext: {
    totalTours: number
    publishedTours: number
    draftTours: number
    upcomingSchedules: number
  }
}): { answer: string } {
  if (input.mode === "guide") {
    return {
      answer: `You currently have ${input.guideContext.totalTours} tours with ${input.guideContext.upcomingSchedules} upcoming schedule slots. I can help prioritize publish and scheduling tasks.`,
    }
  }

  if (input.tourContext) {
    const meetingPoint = input.tourContext.meetingPoint || "the meeting point shown on this page"
    return {
      answer: `I can help with this tour, including where to meet, booking steps, cancellation basics, and typical tipping guidance. The meeting point is ${meetingPoint}.`,
    }
  }

  if (input.isGuideOnboarding) {
    return {
      answer:
        "I can help you finish your guide application: profile basics, approval expectations, and what to complete before submit.",
    }
  }

  return {
    answer:
      "I can help with booking flow, cancellation basics, and typical tipping guidance. Ask me a specific question and I will keep it practical.",
  }
}

function parseAssistantJson(content: string): {
  answer: string
  suggestedActions: string[]
} | null {
  const trimmed = normalizeText(content)
  if (!trimmed) return null

  const cleaned = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")

  try {
    const parsed = JSON.parse(cleaned) as {
      answer?: unknown
      suggestedActions?: unknown
    }
    const answer = normalizeText(parsed.answer).slice(0, ASSISTANT_MAX_ANSWER_CHARS)
    const suggestedActions = Array.isArray(parsed.suggestedActions)
      ? parsed.suggestedActions
          .map((item) => normalizeText(item).replace(/\s+/g, " ").trim().slice(0, ASSISTANT_MAX_ACTION_CHARS))
          .filter(Boolean)
          .slice(0, 4)
      : []

    if (!answer) return null
    return {
      answer,
      suggestedActions,
    }
  } catch {
    return null
  }
}

async function callAssistantModel(input: {
  mode: AssistantMode
  message: string
  history: ReturnType<typeof sanitizeAssistantHistory>
  pageContext: ReturnType<typeof normalizePageContext>
  faqGrounding: string[]
  tourContext: TourContext | null
  guideSummaryLines: string[]
  guideQuickTours: Array<{ id: string; title: string; status: string; city: string }>
}): Promise<{ answer: string; suggestedActions: string[] } | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return null

  const model = process.env.OPENAI_ASSISTANT_MODEL?.trim() || DEFAULT_ASSISTANT_MODEL
  const groundingBlob = JSON.stringify(
    {
      pathname: input.pageContext.pathname || null,
      mode: input.mode,
      faq: input.faqGrounding,
      tour: input.tourContext,
      guideSummaryLines: input.guideSummaryLines,
      guideQuickTours: input.guideQuickTours,
    },
    null,
    2,
  )

  const userPrompt = [
    `User message: ${input.message}`,
    "",
    "Grounding context (use only this data + common language understanding):",
    groundingBlob,
    "",
    input.mode === "guest"
      ? "Guest help priorities: meeting point, booking steps, cancellation basics, tipping guidance, how to contact the guide."
      : "Guide help priorities: publish readiness, schedule setup, messaging workflow, dashboard next actions.",
    "",
    "For suggestedActions, provide short, practical follow-up prompts the user can click.",
    "If information is missing, say so clearly and suggest Talk to human.",
  ].join("\n")

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), OPENAI_ASSISTANT_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 450,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt(input.mode) },
          ...input.history.map((entry) => ({ role: entry.role, content: entry.content })),
          { role: "user", content: userPrompt },
        ],
      }),
    })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`OPENAI_ASSISTANT_TIMEOUT: ${OPENAI_ASSISTANT_TIMEOUT_MS}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const payload = await response.text().catch(() => "")
    throw new Error(`OPENAI_ASSISTANT_FAILED: ${response.status} ${payload}`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null
      }
    }>
  }
  const content = normalizeText(payload.choices?.[0]?.message?.content)
  if (!content) return null

  const parsed = parseAssistantJson(content)
  if (parsed) return parsed

  return {
    answer: content.slice(0, ASSISTANT_MAX_ANSWER_CHARS),
    suggestedActions: [],
  }
}

function buildGroundingSummary(input: {
  mode: AssistantMode
  faqGrounding: string[]
  tourContext: TourContext | null
  guideSummaryLines: string[]
}): string[] {
  const summary: string[] = [`Mode: ${input.mode}.`, `FAQ grounding entries: ${input.faqGrounding.length}.`]

  if (input.tourContext) {
    summary.push(`Tour context loaded: ${input.tourContext.title} (${input.tourContext.id}).`)
  }
  if (input.guideSummaryLines.length > 0) {
    summary.push(...input.guideSummaryLines)
  }

  return summary
}

function buildResponseSections(input: { answer: string }): AssistantResponseSection[] {
  const sections: AssistantResponseSection[] = []
  const answer = normalizeText(input.answer)

  if (answer) {
    sections.push({
      type: "answer",
      label: "Answer",
      content: answer,
    })
  }

  return sections
}

function normalizeSuggestedActions(input: {
  mode: AssistantMode
  message: string
  modelActions: string[]
  hasTourContext: boolean
  isGuideOnboarding: boolean
}): string[] {
  const genericPatterns = [
    /view more details/i,
    /contact customer support/i,
    /learn more/i,
    /click here/i,
    /^next step$/i,
  ]

  const unique = new Set<string>()
  const pushAction = (value: string) => {
    const text = normalizeText(value).replace(/\s+/g, " ").trim()
    if (!text) return
    if (text.length > ASSISTANT_MAX_ACTION_CHARS) return
    if (genericPatterns.some((pattern) => pattern.test(text))) return
    if (!unique.has(text)) unique.add(text)
  }

  const modelActions =
    input.mode === "guest" && !input.isGuideOnboarding
      ? input.modelActions.filter((action) => {
          const text = normalizeText(action)
          if (!text) return false
          const lower = text.toLowerCase()
          if (
            lower.includes("view tour details") ||
            lower.includes("view details") ||
            lower.includes("learn about") ||
            lower.includes("contact customer support")
          ) {
            return false
          }

          const looksQuestion = text.endsWith("?")
          const guestRelevant =
            lower.includes("meeting") ||
            lower.includes("cancel") ||
            lower.includes("booking") ||
            lower.includes("reserve") ||
            lower.includes("tip") ||
            lower.includes("guide") ||
            lower.includes("arrive") ||
            lower.includes("spot") ||
            lower.includes("apply") ||
            lower.includes("approval") ||
            lower.includes("publish") ||
            lower.includes("schedule")

          return looksQuestion && guestRelevant
        })
      : input.modelActions

  modelActions.forEach((action) => pushAction(action))

  const message = input.message.toLowerCase()
  if (input.mode === "guest") {
    if (input.isGuideOnboarding) {
      if (message.includes("review") || message.includes("approval")) {
        pushAction("What does the approval review include?")
      }
      if (message.includes("submit") || message.includes("form")) {
        pushAction("What should I complete before I submit?")
      }
      if (message.includes("how long") || message.includes("when")) {
        pushAction("How long does guide approval usually take?")
      }
    } else {
      if (message.includes("meet") || message.includes("where")) {
        pushAction("Where exactly is the meeting point?")
      }
      if (message.includes("cancel") || message.includes("refund")) {
        pushAction("How does cancellation work?")
      }
      if (message.includes("book") || message.includes("reserve") || message.includes("availability")) {
        pushAction("How do I reserve my spot?")
      }
      if (message.includes("tip") || message.includes("price") || message.includes("cost")) {
        pushAction("How much do guests usually tip?")
      }
      if (input.hasTourContext) {
        pushAction("What time should I arrive at the meeting point?")
      }
    }
    pushAction("Talk to human")
  } else {
    pushAction("What is my fastest publish checklist?")
    pushAction("How should I improve schedule setup?")
    pushAction("Talk to human")
  }

  const fallback = input.mode === "guide"
    ? ["What is my fastest publish checklist?", "How should I improve schedule setup?", "Talk to human"]
    : input.isGuideOnboarding
      ? [
          "What does the approval review include?",
          "What should I complete before I submit?",
          "How long does guide approval usually take?",
          "Talk to human",
        ]
      : [
        "Where exactly is the meeting point?",
        "How does cancellation work?",
        "How much do guests usually tip?",
        "Talk to human",
      ]

  const result = Array.from(unique)
  if (result.length === 0) return fallback
  const sliced = result.slice(0, 4)
  if (input.mode === "guest" && !sliced.some((entry) => entry.toLowerCase() === "talk to human")) {
    if (sliced.length < 4) sliced.push("Talk to human")
    else sliced[sliced.length - 1] = "Talk to human"
  }
  return sliced
}

function resolveAssistantRateLimitScope(input: {
  mode: AssistantMode
  contextOnly: boolean
}): AssistantRateLimitScope {
  if (input.mode === "guide") {
    return input.contextOnly ? "guide_context" : "guide"
  }
  return input.contextOnly ? "guest_context" : "guest"
}

function appendRateLimitHeaders(response: NextResponse, result: AssistantRateLimitResult, includeRetryAfter: boolean) {
  response.headers.set("x-ratelimit-limit", String(result.limit))
  response.headers.set("x-ratelimit-remaining", String(result.remaining))
  response.headers.set("x-ratelimit-reset", String(Math.floor(result.resetAt / 1000)))
  if (includeRetryAfter) {
    response.headers.set("retry-after", String(result.retryAfterSeconds))
  }
}

import { isSeller } from "@/lib/marketplace/roles"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AssistantRequestBody
    if (!isAssistantMode(body?.mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
    }

    const mode = body.mode
    const contextOnly = body?.contextOnly === true
    const message = normalizeText(body.message).slice(0, ASSISTANT_MAX_MESSAGE_CHARS)
    if (!contextOnly && !message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 })
    }

    const pageContext = normalizePageContext(body.pageContext)
    const history = sanitizeAssistantHistory(body.history)
    const authClient = await createClient()
    const {
      data: { user },
    } = await authClient.auth.getUser()

    if (mode === "guide") {
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      const { data: profile } = await authClient.from("profiles").select("role").eq("id", user.id).single()
      if (profile && !isSeller(profile.role)) {
        return NextResponse.json({ error: "Seller access required" }, { status: 403 })
      }
    }

    const requesterKey =
      mode === "guide" && user?.id
        ? `guide_user:${user.id}`
        : user?.id
          ? `guest_user:${user.id}`
          : `guest_ip:${getRequestIp(request)}`
    const rateLimit = checkAssistantRateLimit({
      scope: resolveAssistantRateLimitScope({ mode, contextOnly }),
      requesterKey,
    })

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        { error: "Too many assistant requests. Please wait a moment and try again." },
        { status: 429 },
      )
      appendRateLimitHeaders(response, rateLimit, true)
      return response
    }

    const isGuideOnboarding = pageContext.pathname?.startsWith("/become-guide") ?? false
    const faqGrounding = extractFaqGrounding(mode, pageContext.pathname || null)
    const tourContext = mode === "guest" ? await resolveTourContext(pageContext) : null
    const guideContext =
      mode === "guide" && user?.id
        ? await resolveGuideContext(user.id)
        : {
            summaryLines: [],
            totalTours: 0,
            publishedTours: 0,
            draftTours: 0,
            upcomingSchedules: 0,
            quickTours: [] as Array<{ id: string; title: string; status: string; city: string }>,
          }
    const contextCard = mode === "guide" ? buildGuideContextCard(guideContext) : null

    const groundingSummary = buildGroundingSummary({
      mode,
      faqGrounding,
      tourContext,
      guideSummaryLines: guideContext.summaryLines,
    })

    if (contextOnly) {
      const contextOnlyResult = buildContextOnlyAnswer({
        mode,
        tourContext,
        isGuideOnboarding,
        guideContext,
      })

      const payload: AssistantResponseBody = {
        answer: contextOnlyResult.answer,
        suggestedActions:
          mode === "guide"
            ? ["What is my fastest publish checklist?", "How should I improve schedule setup?", "Talk to human"]
            : isGuideOnboarding
              ? [
                  "What does the approval review include?",
                  "What should I complete before I submit?",
                  "How long does guide approval usually take?",
                  "Talk to human",
                ]
              : [
                  "Where exactly is the meeting point?",
                  "How does cancellation work?",
                  "How do I reserve my spot?",
                  "Talk to human",
                ],
        groundingSummary,
        responseSections: buildResponseSections({
          answer: contextOnlyResult.answer,
        }),
        contextCard,
      }
      const response = NextResponse.json(payload)
      appendRateLimitHeaders(response, rateLimit, false)
      return response
    }

    try {
      const modelResult = await callAssistantModel({
        mode,
        message,
        history,
        pageContext,
        faqGrounding,
        tourContext,
        guideSummaryLines: guideContext.summaryLines,
        guideQuickTours: guideContext.quickTours,
      })

      if (modelResult?.answer) {
        const payload: AssistantResponseBody = {
          answer: modelResult.answer,
          suggestedActions: normalizeSuggestedActions({
            mode,
            message,
            modelActions: modelResult.suggestedActions,
            hasTourContext: Boolean(tourContext),
            isGuideOnboarding,
          }),
          groundingSummary,
          responseSections: buildResponseSections({
            answer: modelResult.answer,
          }),
          contextCard,
        }

        const response = NextResponse.json(payload)
        appendRateLimitHeaders(response, rateLimit, false)
        return response
      }
    } catch (openAiError) {
      console.error("[assistant] OpenAI call failed:", openAiError)
    }

    const fallback = mode === "guide" ? buildGuideFallback() : buildGuestFallback(tourContext, isGuideOnboarding)
    fallback.groundingSummary = groundingSummary
    fallback.responseSections = buildResponseSections({
      answer: fallback.answer,
    })
    fallback.contextCard = contextCard
    const response = NextResponse.json(fallback)
    appendRateLimitHeaders(response, rateLimit, false)
    return response
  } catch (error) {
    console.error("[assistant] route error:", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
